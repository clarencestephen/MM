"""Generation routes — Pipeline 1 with draft/render modes + region regeneration."""
from fastapi import APIRouter, Body, Depends, HTTPException
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


@router.post("", response_model=GenerateResponse)
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
            "style_tags": data.style_tags or [],
        },
        song_id=song.id,
    )
    db.add(job)
    db.flush()

    try:
        vocal_style = "rap" if song.genre in ("hip_hop", "melodic_rap") else "melodic"

        # ── Persona promotion: an ElevenLabs persona overrides voice_engine ──
        # If the caller passed a persona_id whose stored voice is on ElevenLabs,
        # promote the request to engine=elevenlabs with that voice_id. Lets
        # users pick a saved persona and Just Have It Work without thinking
        # about engines.
        persona_obj = None
        if data.persona_id:
            persona_obj = db.query(Persona).filter(Persona.id == data.persona_id).first()
            if persona_obj and persona_obj.voice_engine == "elevenlabs" and persona_obj.elevenlabs_voice_id:
                data.voice_engine = "elevenlabs"
                data.elevenlabs_voice_id = persona_obj.elevenlabs_voice_id

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
        elif data.voice_engine == "elevenlabs":
            # ElevenLabs — Pro tier only. We check via the song's project owner.
            from backend.services.elevenlabs_service import (
                synthesize as eleven_synth, is_available as eleven_ok,
            )
            from backend.services.tier_service import get_user_tier
            if not eleven_ok():
                raise HTTPException(400, "ElevenLabs not configured. Set ELEVENLABS_API_KEY.")
            owner_id = song.project.user_id if song.project else None
            if owner_id and get_user_tier(db, owner_id) != "pro":
                raise HTTPException(
                    402,
                    "ElevenLabs voices are a Pro-tier feature. Upgrade or pick the default voice.",
                )
            vocal_path = eleven_synth(
                target_lyrics,
                voice_id=data.elevenlabs_voice_id,
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

            # Or use persona's stored voice (XTTS personas only — ElevenLabs
            # personas were promoted to engine=elevenlabs at the top of try:)
            elif persona_obj:
                persona_voice_path = persona_obj.voice_sample_path
                persona_embedding = persona_obj.embedding_path

            # Voice described in natural language — record on the job for future
            # preset-matching; falls back to default XTTS until preset library exists.
            if data.voice_engine == "described" and data.voice_description:
                job.params = {**(job.params or {}), "voice_description": data.voice_description}
                db.flush()

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
    from backend.services.elevenlabs_service import (
        is_available as eleven_ok, list_voices as eleven_voices,
    )

    engines = [
        {
            "engine": "xtts",
            "name": "XTTS v2 (Local)",
            "description": "Local neural TTS — runs on your GPU",
            "available": True,
            "voices": [],
            "tier": "free",
        },
    ]

    if azure_ok():
        engines.append({
            "engine": "azure",
            "name": "Azure Cloud Voice",
            "description": "Microsoft Azure Neural TTS — cloud service",
            "available": True,
            "voices": azure_voices(),
            "tier": "pro",
        })

    if eleven_ok():
        engines.append({
            "engine": "elevenlabs",
            "name": "ElevenLabs (Studio)",
            "description": "Premium expressive vocals — Pro tier",
            "available": True,
            "voices": eleven_voices(),
            "tier": "pro",
        })

    engines.append({
        "engine": "recorded",
        "name": "Record My Voice",
        "description": "Record 10-30s of your voice for cloning",
        "available": True,
        "voices": [],
        "tier": "free",
    })

    return {"engines": engines}


def _require_pro_or_402(db: Session, user_id: str | None) -> None:
    """Raise 402 if the user_id isn't on the Pro tier (free / unknown blocked)."""
    from backend.services.tier_service import get_user_tier
    if not user_id:
        raise HTTPException(401, "user_id required for ElevenLabs features")
    if get_user_tier(db, user_id) != "pro":
        raise HTTPException(402, "ElevenLabs is a Pro-tier feature.")


@router.get("/elevenlabs/quota")
def elevenlabs_quota():
    """Surface ElevenLabs credit balance for the dashboard / sidebar."""
    from backend.services.elevenlabs_service import get_quota
    return get_quota()


@router.post("/elevenlabs/clone")
async def elevenlabs_clone(
    voice_clip_path: str = Body(..., embed=True),
    name: str = Body("MM-cloned", embed=True),
    user_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    """Upload a voice reference to ElevenLabs Instant Voice Cloning.

    Pro-tier only. The clip must already be a transcoded WAV on disk
    (use /api/upload/voice-clip first).
    """
    _require_pro_or_402(db, user_id)
    from backend.services.elevenlabs_service import clone_voice, is_available as eleven_ok
    if not eleven_ok():
        raise HTTPException(400, "ElevenLabs not configured.")
    try:
        voice_id = clone_voice(voice_clip_path, name=name)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return {"voice_id": voice_id, "name": name}


@router.post("/elevenlabs/voice-design")
def elevenlabs_voice_design(
    description: str = Body(..., embed=True),
    sample_text: str | None = Body(None, embed=True),
    user_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    """Generate 3 preview voices from a natural-language description.

    Pro-tier. Returns previews each with a `generated_voice_id` + base64
    audio sample. Call /elevenlabs/voice-design/commit to persist the
    chosen one to the user's voice library.
    """
    _require_pro_or_402(db, user_id)
    from backend.services.elevenlabs_service import design_voice, is_available as eleven_ok
    if not eleven_ok():
        raise HTTPException(400, "ElevenLabs not configured.")
    try:
        kwargs = {"description": description}
        if sample_text:
            kwargs["sample_text"] = sample_text
        return design_voice(**kwargs)
    except RuntimeError as e:
        raise HTTPException(502, str(e))


@router.post("/elevenlabs/voice-design/commit")
def elevenlabs_voice_design_commit(
    generated_voice_id: str = Body(..., embed=True),
    voice_name: str = Body(..., embed=True),
    voice_description: str = Body(..., embed=True),
    user_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    """Persist a designed-voice preview to the user's library, returns voice_id."""
    _require_pro_or_402(db, user_id)
    from backend.services.elevenlabs_service import commit_designed_voice, is_available as eleven_ok
    if not eleven_ok():
        raise HTTPException(400, "ElevenLabs not configured.")
    try:
        voice_id = commit_designed_voice(generated_voice_id, voice_name, voice_description)
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return {"voice_id": voice_id, "name": voice_name}


@router.post("/elevenlabs/speech-to-speech")
def elevenlabs_sts(
    source_audio_path: str = Body(..., embed=True),
    target_voice_id: str = Body(..., embed=True),
    quality: str = Body("draft", embed=True),
    user_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    """Re-render a recorded vocal in a different ElevenLabs voice (Pro-tier).

    Keeps the source's rhythm, cadence, and emotion — substitutes the timbre.
    """
    _require_pro_or_402(db, user_id)
    from backend.services.elevenlabs_service import speech_to_speech, is_available as eleven_ok
    if not eleven_ok():
        raise HTTPException(400, "ElevenLabs not configured.")
    try:
        path = speech_to_speech(source_audio_path, target_voice_id, quality=quality)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return {"file_path": path, "target_voice_id": target_voice_id}


@router.post("/lyrics")
def generate_lyrics_endpoint(data: GenerateLyricsRequest):
    """Generate lyrics from a prompt using local Ollama. No audio involved."""
    lyrics = generate_lyrics(
        prompt=data.prompt,
        genre=data.genre,
        mood=data.mood,
        quality=data.quality,
        style_tags=data.style_tags,
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
