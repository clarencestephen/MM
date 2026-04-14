"""Celery task for async audio alignment — runs on GPU 1 (alignment queue)."""
from workers.celery_app import celery_app
from backend.services.alignment_service import transcribe_with_timestamps, align_lyrics_to_audio


@celery_app.task(name="align_audio", bind=True)
def align_audio_task(
    self, audio_path: str, lyrics: str | None = None
) -> dict:
    """Align or transcribe audio (async). Results are cached."""
    try:
        if lyrics:
            self.update_state(state="ALIGNING")
            words = align_lyrics_to_audio(audio_path, lyrics)
            return {"status": "done", "mode": "aligned", "words": words}
        else:
            self.update_state(state="TRANSCRIBING")
            result = transcribe_with_timestamps(audio_path)
            return {"status": "done", "mode": "transcribed", **result}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
