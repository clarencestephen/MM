"""Celery task for async song mixing."""
from workers.celery_app import celery_app
from backend.services.mix_service import mix_beat_and_vocal


@celery_app.task(name="mix_song", bind=True)
def mix_song_task(self, beat_path: str, vocal_path: str) -> dict:
    """Mix beat and vocal into final track (async via Celery)."""
    try:
        self.update_state(state="RUNNING")
        output_path = mix_beat_and_vocal(beat_path, vocal_path)
        return {"status": "done", "path": output_path}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
