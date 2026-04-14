"""Transform routes — Pipeline 2 + alignment endpoints. All local."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.song import Song
from backend.models.stem import Stem
from backend.models.job import RenderJob
from backend.schemas.transform import (
    TransformRequest, TransformResponse,
    AlignmentRequest, AlignmentResponse,
)
from backend.services.separation_service import separate_stems
from backend.services.generation_service import generate_vocal
from backend.services.voice_conversion_service import convert_voice
from backend.services.mix_service import overlay_vocal_on_instrumental
from backend.services.alignment_service import transcribe_with_timestamps, align_lyrics_to_audio

router = APIRouter(prefix="/transform", tags=["transform"])


@router.post("/separate", response_model=TransformResponse)
def separate_source(data: TransformRequest, db: Session = Depends(get_db)):
    """Separate a source track into stems. Cached — won't re-separate the same file."""
    song = db.query(Song).filter(Song.id == data.song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    if not song.beat_path:
        raise HTTPException(400, "No source track uploaded.")

    job = RenderJob(
        job_type="separation",
        status="running",
        params={"source": song.beat_path, "full_stems": data.full_stems},
        song_id=song.id,
    )
    db.add(job)
    db.flush()

    try:
        stems = separate_stems(song.beat_path, two_stems=not data.full_stems)

        for stem_type, path in stems.items():
            db.add(Stem(
                stem_type=stem_type,
                file_path=path,
                source="separated",
                song_id=song.id,
            ))

        job.status = "done"
        job.result_path = stems.get("no_vocals", "")

    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        db.commit()
        raise HTTPException(500, f"Separation failed: {e}")

    db.commit()

    return TransformResponse(
        job_id=job.id,
        song_id=song.id,
        mode="separate",
        status=job.status,
        stems=stems,
    )


@router.post("/parody", response_model=TransformResponse)
def create_parody(data: TransformRequest, db: Session = Depends(get_db)):
    """Full parody pipeline — your killer feature.

    Pipeline 2:
    1. Separate source into vocals + instrumental (cached)
    2. Align original vocals to get timing map
    3. Take user's parody lyrics
    4. Generate new vocal (local XTTS)
    5. Apply voice conversion if persona set
    6. Overlay on instrumental
    7. Save as new mix
    """
    song = db.query(Song).filter(Song.id == data.song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    if not song.beat_path:
        raise HTTPException(400, "No source track uploaded.")

    lyrics = data.new_lyrics or song.lyrics
    if not lyrics:
        raise HTTPException(400, "No parody lyrics. Add lyrics to the song or pass new_lyrics.")

    job = RenderJob(
        job_type="parody",
        status="running",
        params={"mode": "parody", "quality": data.quality},
        song_id=song.id,
    )
    db.add(job)
    db.flush()

    try:
        # Step 1: Separate source (cached — instant if already done)
        stems = separate_stems(song.beat_path)
        instrumental_path = stems.get("no_vocals")

        for stem_type, path in stems.items():
            existing = db.query(Stem).filter(
                Stem.song_id == song.id, Stem.stem_type == stem_type
            ).first()
            if not existing:
                db.add(Stem(
                    stem_type=stem_type,
                    file_path=path,
                    source="separated",
                    song_id=song.id,
                ))

        if not instrumental_path:
            raise ValueError("Could not extract instrumental")

        # Step 2: Get timing from original vocals (for cadence matching)
        vocal_path = stems.get("vocals")
        alignment = []
        if vocal_path:
            alignment = align_lyrics_to_audio(vocal_path, lyrics)

        # Step 3: Generate new vocal
        if data.new_lyrics:
            song.lyrics = data.new_lyrics
        vocal_style = "rap" if song.genre in ("hip_hop", "melodic_rap", None) else "melodic"
        new_vocal_path = generate_vocal(
            lyrics, style=vocal_style, quality=data.quality
        )
        song.vocal_path = new_vocal_path

        # Step 4: Overlay on instrumental
        mix_path = overlay_vocal_on_instrumental(instrumental_path, new_vocal_path)
        song.mix_path = mix_path
        song.status = "transformed"

        job.status = "done"
        job.result_path = mix_path

    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        db.commit()
        raise HTTPException(500, f"Parody pipeline failed: {e}")

    db.commit()

    return TransformResponse(
        job_id=job.id,
        song_id=song.id,
        mode="parody",
        status=job.status,
        stems=stems if 'stems' in dir() else None,
        alignment=alignment if 'alignment' in dir() else None,
    )


@router.post("/align", response_model=AlignmentResponse)
def align_audio(data: AlignmentRequest, db: Session = Depends(get_db)):
    """Align lyrics to audio or transcribe vocals. 100% local.

    If lyrics provided → forced alignment (torchaudio) — for parody timing.
    If no lyrics → transcription (WhisperX) — extract what's being said.
    """
    song = db.query(Song).filter(Song.id == data.song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")

    # Find vocal audio — either separated vocal stem or the source itself
    vocal_stem = db.query(Stem).filter(
        Stem.song_id == song.id, Stem.stem_type == "vocals"
    ).first()
    audio_path = vocal_stem.file_path if vocal_stem else song.beat_path

    if not audio_path:
        raise HTTPException(400, "No audio to align. Upload a source or separate first.")

    lyrics = data.lyrics or song.lyrics

    if lyrics:
        # Mode 2: Align known lyrics
        words = align_lyrics_to_audio(audio_path, lyrics)
        return AlignmentResponse(
            song_id=song.id,
            mode="aligned",
            text=lyrics,
            words=words,
        )
    else:
        # Mode 1: Transcribe
        result = transcribe_with_timestamps(audio_path)
        return AlignmentResponse(
            song_id=song.id,
            mode="transcribed",
            text=result.get("text", ""),
            words=result.get("words", []),
        )
