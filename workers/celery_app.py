"""Celery worker configuration — GPU-typed queues per MODEL_DECISIONS.md.

Queue assignment:
  GPU 0 (voice):  voice, generation, llm
  GPU 1 (audio):  audio, separation, alignment, instrument
  CPU:            export, mixing, studio_mix, default
"""
from celery import Celery

celery_app = Celery(
    "mm_workers",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_routes={
        # GPU 0 — Voice / Persona / LLM
        "workers.jobs.generate_vocal.*": {"queue": "voice"},
        "workers.jobs.voice_convert.*": {"queue": "voice"},
        "workers.jobs.llm_generate.*": {"queue": "llm"},

        # GPU 1 — Audio / Separation / Alignment / Instrument Conversion
        "workers.jobs.separate_stems.*": {"queue": "separation"},
        "workers.jobs.align_audio.*": {"queue": "alignment"},
        "workers.jobs.convert_instrument.*": {"queue": "instrument"},

        # CPU — Export / Mixing / Lightweight
        "workers.jobs.mix_song.*": {"queue": "mixing"},
        "workers.jobs.export_audio.*": {"queue": "export"},
        "workers.jobs.studio_export.*": {"queue": "export"},
    },
)

celery_app.autodiscover_tasks(["workers.jobs"])
