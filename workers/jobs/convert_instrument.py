"""Celery task for instrument conversion — runs on GPU 1."""
import logging

from workers.celery_app import celery_app

log = logging.getLogger(__name__)


@celery_app.task(name="convert_instrument", queue="instrument")
def convert_instrument_task(
    track_id: str,
    audio_path: str,
    instrument_description: str,
    quality: str = "draft",
) -> dict:
    """Convert a recording to an instrument sound using MusicGen."""
    log.info(f"Converting track {track_id} to '{instrument_description}' (quality={quality})")

    from backend.services.instrument_service import convert_to_instrument

    output_path = convert_to_instrument(
        audio_path=audio_path,
        instrument_description=instrument_description,
        quality=quality,
    )

    # Update the track in the database
    from backend.database import SessionLocal
    from backend.models.studio_track import StudioTrack

    db = SessionLocal()
    try:
        track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
        if track:
            track.processed_audio_path = output_path
            track.instrument_label = instrument_description
            db.commit()
            log.info(f"Track {track_id} converted: {output_path}")
    finally:
        db.close()

    return {"track_id": track_id, "output_path": output_path}
