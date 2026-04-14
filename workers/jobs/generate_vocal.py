"""Celery task for async vocal generation — runs on GPU 0 (voice queue)."""
from workers.celery_app import celery_app
from backend.services.generation_service import generate_vocal
from backend.services.voice_conversion_service import convert_voice


@celery_app.task(name="generate_vocal", bind=True)
def generate_vocal_task(
    self,
    lyrics: str,
    style: str = "rap",
    persona_voice_path: str | None = None,
    persona_embedding_path: str | None = None,
    quality: str = "draft",
) -> dict:
    """Generate + optionally convert vocal (async)."""
    try:
        self.update_state(state="GENERATING")
        vocal_path = generate_vocal(
            lyrics, style=style,
            persona_voice_path=persona_voice_path,
            quality=quality,
        )

        if persona_embedding_path:
            self.update_state(state="CONVERTING")
            vocal_path = convert_voice(
                vocal_path,
                persona_embedding_path=persona_embedding_path,
                style_mode=style,
            )

        return {"status": "done", "path": vocal_path}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
