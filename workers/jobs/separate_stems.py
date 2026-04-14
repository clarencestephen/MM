"""Celery task for async stem separation — runs on GPU 1 (separation queue)."""
from workers.celery_app import celery_app
from backend.services.separation_service import separate_stems


@celery_app.task(name="separate_stems", bind=True)
def separate_stems_task(
    self, audio_path: str, two_stems: bool = True
) -> dict:
    """Separate audio into stems (async). Results are cached."""
    try:
        self.update_state(state="SEPARATING")
        stems = separate_stems(audio_path, two_stems=two_stems)
        return {"status": "done", "stems": stems}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
