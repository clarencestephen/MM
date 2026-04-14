import logging
import threading

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.routes import projects, songs, upload, generate, transform, persona, export, jobs, studio, auth, analytics

logging.basicConfig(
    level=logging.INFO if settings.debug else logging.WARNING,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: preload all models into VRAM for instant inference."""
    log.info("Starting model warm-up on background thread...")

    def _warmup():
        try:
            from backend.services.model_manager import models
            models.warm_up()
        except Exception as e:
            log.warning(f"Model warm-up failed: {e}")

    # Run warm-up in background so the API is available immediately
    warmup_thread = threading.Thread(target=_warmup, name="model-warmup", daemon=True)
    warmup_thread.start()

    yield  # App is running

    log.info("Shutting down.")


app = FastAPI(
    title="MM — Music Maker",
    description=(
        "AI-native Hip Hop music creation platform. "
        "100% local inference — zero API calls. "
        "Models preloaded in VRAM for instant generation."
    ),
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api")
app.include_router(songs.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(generate.router, prefix="/api")
app.include_router(transform.router, prefix="/api")
app.include_router(persona.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(studio.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": "MM — Music Maker",
        "version": "0.3.0",
        "status": "running",
        "mode": "local-first, GPU-resident",
        "api_calls": "zero",
    }


@app.get("/health")
def health():
    """Health check — reports all services + GPU model status."""
    from backend.services.llm_service import is_available as llm_ok
    from backend.services.model_manager import models

    import shutil
    import torch

    gpu_info = []
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            props = torch.cuda.get_device_properties(i)
            mem_used = torch.cuda.memory_allocated(i) / (1024**3)
            mem_total = props.total_memory / (1024**3)
            gpu_info.append({
                "gpu": i,
                "name": props.name,
                "vram_used_gb": round(mem_used, 2),
                "vram_total_gb": round(mem_total, 2),
                "utilization_pct": round(mem_used / mem_total * 100, 1),
            })

    return {
        "status": "ok",
        "services": {
            "ollama": llm_ok(),
            "ffmpeg": shutil.which("ffmpeg") is not None,
            "database": _check_db(),
        },
        "models": models.status(),
        "gpu": gpu_info,
    }


def _check_db() -> bool:
    try:
        from sqlalchemy import text
        from backend.database import SessionLocal
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return True
    except Exception:
        return False
