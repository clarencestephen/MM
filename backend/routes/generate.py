"""Generation routes — Pipeline 1 with draft/render modes + region regeneration."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.song import Song
from backend.models.persona import Persona
from backend.models.job import RenderJob
from backend.schemas.generate import (
    GenerateRequest, GenerateResponse,
    GenerateLyricsRequest, RewriteRequest,
)
from backend.services.generation_service import generate_vocal
from backend.services.voice_conversion_service import convert_voice
from backend.services.mix_service import mix_beat_and_vocal
from backend.services.prompt_service import parse_prompt
from backend.services.lyrics_service import generate_lyrics, rewrite_parody, rewrite_section

router = APIRouter(prefix="/generate", tags=["generate"])


@router.post("/", response_model=GenerateResponse)
def generate_song(data: GenerateRequest, db: Session = Depends(get_db)):
    """Generate vocals from lyrics and mix with beat.

    Pipeline 1:
    1. Parse prompt via local Ollama
    2. Generate vocal via XTTS v2 (local)
    3. Apply persona voice conversion if persona_id provided
    4. Mix vocal with uploaded beat
    5. Save result

    Supports draft (fast) and render (quality) modes.
    Supports section-level regeneration (don't re-render the whole song).
    """
    song = db.query(Song).filter(Song.id == data.song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")

    if data.lyrics:
        song.lyrics = data.lyrics
    if data.prompt:
        song.prompt = data.prompt
        parsed = parse_prompt(data.prompt, quality=data.quality)
        song.genre = parsed["genre"]
        song.mood = parsed["mood"]
        song.bpm = parsed["bpm"]

    lyrics = song.lyrics
    if not lyrics:
        raise HTTPException(400, "No lyrics provided. Paste lyrics first.")

    # If regenerating a section, extract just that section's lyrics
    target_lyrics = lyrics
    if data.section:
        from backend.services.lyrics_service import parse_lyrics_into_sections
        sections = parse_lyrics_into_sections(lyrics)
        matching = [s for s in sections if s["label"] == data.section]
        if matching:
            target_lyrics = matching[0]["lyrics"]

    job = RenderJob(
        job_type="vocal_gen",
        status="running",
        params={
            "quality": data.quality,
            "section": data.section,
            "style": song.genre or "hip_hop",
        },
        song_id=song.id,
    )
    db.add(job)
    db.flush()

    try:
        vocal_style = "rap" if song.genre in ("hip_hop", "melodic_rap") else "melodic"

        # ── Voice engine routing ──────────────────────────────────
        if data.voice_engine == "azure":
            # Azure Cloud TTS
            from backend.services.azure_tts_service import synthesize as azure_synth, is_available as azure_ok
            if not azure_ok():
                raise HTTPException(400, "Azure TTS not configured. Set AZURE_SPEECH_KEY in .env")
            vocal_path = azure_synth(
                target_lyrics,
                voice_key=data.azure_voice or "davis",
                quality=data.quality,
            )
        else:
            # Local XTTS (default) — with optional voice cloning
            persona_voice_path = None
            persona_embedding = None

            # Use uploaded voice clip for cloning
            if data.voice_engine == "recorded" and data.voice_clip_path:
                persona_voice_path = data.voice_clip_path
                persona_embedding = data.voice_clip_path

            # Or use persona's stored voice
            elif data.persona_id:
                persona = db.query(Persona).filter(Persona.id == data.persona_id).first()
                if persona:
                    persona_voice_path = persona.voice_sample_path
                    persona_embedding = persona.embedding_path

            vocal_path = generate_vocal(
                target_lyrics,
                style=vocal_style,
                persona_voice_path=persona_voice_path,
                quality=data.quality,
            )

            # Apply voice conversion if we have a reference voice
            if persona_embedding:
                diffusion_steps = 10 if data.quality == "draft" else 25
                vocal_path = convert_voice(
                    vocal_path,
                    reference_voice_path=persona_embedding,
                    style_mode=vocal_style,
                    diffusion_steps=diffusion_steps,
                )

        song.vocal_path = vocal_path

        # Mix with beat if available
        if song.beat_path:
            mix_path = mix_beat_and_vocal(song.beat_path, vocal_path)
            song.mix_path = mix_path
            job.result_path = mix_path
        else:
            song.mix_path = vocal_path
            job.result_path = vocal_path

        song.status = "generated"
        job.status = "done"

    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        db.commit()
        raise HTTPException(500, f"Generation failed: {e}")

    db.commit()

    return GenerateResponse(
        job_id=job.id,
        song_id=song.id,
        status=job.status,
        quality=data.quality,
    )


@router.get("/voices")
def list_available_voices():
    """List available voice engines and voices."""
    from backend.services.azure_tts_service import is_available as azure_ok, list_voices as azure_voices

    engines = [
        {
            "engine": "xtts",
            "name": "XTTS v2 (Local)",
            "description": "Local neural TTS — runs on your GPU",
            "available": True,
            "voices": [],
        },
    ]

    if azure_ok():
        engines.append({
            "engine": "azure",
            "name": "Azure Cloud Voice",
            "description": "Microsoft Azure Neural TTS — cloud service",
            "available": True,
            "voices": azure_voices(),
        })

    engines.append({
        "engine": "recorded",
        "name": "Record My Voice",
        "description": "Record 10-30s of your voice for cloning",
        "available": True,
        "voices": [],
    })

    return {"engines": engines}


@router.post("/lyrics")
def generate_lyrics_endpoint(data: GenerateLyricsRequest):
    """Generate lyrics from a prompt using local Ollama. No audio involved."""
    lyrics = generate_lyrics(
        prompt=data.prompt,
        genre=data.genre,
        mood=data.mood,
        quality=data.quality,
    )
    return {"lyrics": lyrics}


@router.post("/rewrite")
def rewrite_lyrics_endpoint(data: RewriteRequest, db: Session = Depends(get_db)):
    """Rewrite lyrics — parody mode or section-level editing."""
    if data.new_theme:
        result = rewrite_parody(
            data.original_lyrics,
            new_theme=data.new_theme,
            quality=data.quality,
        )
    elif data.instruction:
        result = rewrite_section(
            data.original_lyrics,
            instruction=data.instruction,
            quality=data.quality,
        )
    else:
        raise HTTPException(400, "Provide new_theme (for parody) or instruction (for rewrite)")

    # Update song if song_id provided
    if data.song_id:
        song = db.query(Song).filter(Song.id == data.song_id).first()
        if song:
            song.lyrics = result
            db.commit()

    return {"lyrics": result}
