"""Celery task for async audio export."""
from workers.celery_app import celery_app
from backend.services.export_service import export_wav, export_mp3


@celery_app.task(name="export_audio", bind=True)
def export_audio_task(self, mix_path: str, format: str = "wav") -> dict:
    """Export audio to WAV or MP3 (async via Celery)."""
    try:
        self.update_state(state="RUNNING")
        if format == "mp3":
            output_path = export_mp3(mix_path)
        else:
            output_path = export_wav(mix_path)
        return {"status": "done", "path": output_path}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
