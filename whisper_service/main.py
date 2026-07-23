"""WhisperX HTTP microservice for MM (Music Maker).

WHY THIS EXISTS
---------------
WhisperX's dependency pin (numpy 2.x, torch 2.8, pandas 3.x, transformers 4.57+)
is fundamentally incompatible with the main MM backend's `mm` conda env, which
runs coqui-TTS 0.22.0 + seed-vc on torch 2.5.1 / numpy 1.26.

Solution: isolate WhisperX in its own `mm-whisper` conda env, expose it as a
tiny FastAPI service on :8100, and have the main backend call it over HTTP
(`backend/services/alignment_service.py`). Both processes live on the same host
so latency is negligible.

ARCHITECTURE
------------
- Loaded once at startup via FastAPI lifespan (cold-load adds ~5-10s).
- Model defaults to `large-v3` on `cuda:1` (audio GPU) with float16.
- Falls back to CPU + float32 / int8 when no GPU is available.
- Two endpoints:
    GET  /health      → liveness + model_loaded + device
    POST /transcribe  → audio file in, transcript + word-level timing out
    POST /align       → audio + reference lyrics → word-level timing (optional)

LOCAL-FIRST GUARANTEE
---------------------
Everything runs on the host. No cloud API keys are read or required. WhisperX
will download model weights from Hugging Face on first run (~3GB for large-v3
+ ~360MB for the English wav2vec2 aligner), then cache them in
~/.cache/huggingface/. Set HF_HUB_OFFLINE=1 once cached to enforce offline.
"""
from __future__ import annotations

import logging
import os
import shutil
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s | %(message)s",
)
log = logging.getLogger("whisper_service")


# ---------------------------------------------------------------------------
# Config (env-overridable, but sensible defaults)
# ---------------------------------------------------------------------------
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "large-v3")
# MM's GPU 1 is the audio/alignment GPU per CLAUDE.md. cuda:0 is held by XTTS.
WHISPER_DEVICE_INDEX = int(os.environ.get("WHISPER_DEVICE_INDEX", "1"))
WHISPER_LANGUAGE = os.environ.get("WHISPER_LANGUAGE", "en")
WHISPER_BATCH_SIZE = int(os.environ.get("WHISPER_BATCH_SIZE", "16"))


# ---------------------------------------------------------------------------
# Lifespan: load model once
# ---------------------------------------------------------------------------
STATE: dict[str, Any] = {
    "model": None,
    "align_model": None,
    "align_meta": None,
    "device": "cpu",
    "device_str": "cpu",
    "compute_type": "int8",
    "model_loaded": False,
    "load_error": None,
}


def _pick_device() -> tuple[str, str, str]:
    """Return (device, device_str, compute_type)."""
    try:
        import torch
        if torch.cuda.is_available() and torch.cuda.device_count() > WHISPER_DEVICE_INDEX:
            return ("cuda", f"cuda:{WHISPER_DEVICE_INDEX}", "float16")
        if torch.cuda.is_available():
            # Asked for GPU 1 but only GPU 0 exists — fall back to it.
            return ("cuda", "cuda:0", "float16")
    except Exception as e:  # pragma: no cover
        log.warning("torch import failed during device probe: %s", e)
    return ("cpu", "cpu", "int8")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load WhisperX model + English aligner at startup."""
    device, device_str, compute_type = _pick_device()
    STATE["device"] = device
    STATE["device_str"] = device_str
    STATE["compute_type"] = compute_type
    log.info("Loading WhisperX '%s' on %s (compute=%s)",
             WHISPER_MODEL, device_str, compute_type)

    try:
        import whisperx  # noqa: F401

        # whisperx.load_model takes the device as the string "cuda" or "cpu"
        # and uses the WHISPER_DEVICE_INDEX implicitly via CUDA_VISIBLE_DEVICES
        # OR we pass device_index. faster-whisper supports `device_index`.
        device_index = WHISPER_DEVICE_INDEX if device == "cuda" else 0
        try:
            STATE["model"] = whisperx.load_model(
                WHISPER_MODEL,
                device,
                device_index=device_index,
                compute_type=compute_type,
                language=WHISPER_LANGUAGE,
            )
        except TypeError:
            # Older whisperx signatures didn't accept device_index
            STATE["model"] = whisperx.load_model(
                WHISPER_MODEL,
                device,
                compute_type=compute_type,
                language=WHISPER_LANGUAGE,
            )

        align_model, align_meta = whisperx.load_align_model(
            language_code=WHISPER_LANGUAGE,
            device=device_str if device == "cuda" else "cpu",
        )
        STATE["align_model"] = align_model
        STATE["align_meta"] = align_meta
        STATE["model_loaded"] = True
        log.info("WhisperX ready (model=%s, align=%s)", WHISPER_MODEL, WHISPER_LANGUAGE)
    except Exception as e:
        STATE["model_loaded"] = False
        STATE["load_error"] = str(e)
        log.exception("Failed to load WhisperX: %s", e)

    yield

    # Teardown — release GPU memory
    STATE["model"] = None
    STATE["align_model"] = None
    STATE["align_meta"] = None
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


app = FastAPI(
    title="MM WhisperX Service",
    version="0.1.0",
    description="Local WhisperX HTTP wrapper for the MM backend.",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _save_upload(upload: UploadFile) -> Path:
    """Persist an UploadFile to a tempfile and return the path."""
    suffix = Path(upload.filename or "audio.wav").suffix or ".wav"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        shutil.copyfileobj(upload.file, tmp)
    finally:
        tmp.close()
    return Path(tmp.name)


def _format_segments(aligned: dict) -> list[dict]:
    out = []
    for seg in aligned.get("segments", []):
        out.append({
            "start": float(seg.get("start") or 0.0),
            "end": float(seg.get("end") or 0.0),
            "text": (seg.get("text") or "").strip(),
            "words": [
                {
                    "word": w.get("word", ""),
                    "start": float(w.get("start") or 0.0),
                    "end": float(w.get("end") or 0.0),
                    "score": float(w.get("score") or 0.0) if w.get("score") is not None else None,
                }
                for w in seg.get("words", [])
            ],
        })
    return out


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok" if STATE["model_loaded"] else "degraded",
        "model_loaded": STATE["model_loaded"],
        "model": WHISPER_MODEL,
        "device": STATE["device_str"],
        "compute_type": STATE["compute_type"],
        "load_error": STATE["load_error"],
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
    batch_size: int | None = Form(default=None),
):
    """Transcribe an audio file with word-level timestamps."""
    if not STATE["model_loaded"]:
        raise HTTPException(
            status_code=503,
            detail=f"Model not loaded: {STATE['load_error'] or 'unknown error'}",
        )

    tmp_path = _save_upload(file)
    try:
        import whisperx

        audio = whisperx.load_audio(str(tmp_path))
        result = STATE["model"].transcribe(
            audio,
            batch_size=batch_size or WHISPER_BATCH_SIZE,
            language=language or WHISPER_LANGUAGE,
        )

        detected_lang = result.get("language", language or WHISPER_LANGUAGE)
        device_for_align = STATE["device_str"] if STATE["device"] == "cuda" else "cpu"

        # Align for word-level timestamps when language matches the loaded aligner.
        if detected_lang == WHISPER_LANGUAGE and STATE["align_model"] is not None:
            aligned = whisperx.align(
                result["segments"],
                STATE["align_model"],
                STATE["align_meta"],
                audio,
                device_for_align,
                return_char_alignments=False,
            )
        else:
            # No aligner for this language — return raw segments without word timing.
            aligned = {"segments": result.get("segments", [])}

        segments = _format_segments(aligned)
        full_text = " ".join(s["text"] for s in segments if s["text"]).strip()
        return {
            "text": full_text,
            "segments": segments,
            "language": detected_lang,
        }
    except Exception as e:
        log.exception("transcribe failed")
        raise HTTPException(status_code=500, detail=f"transcribe failed: {e}")
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


@app.post("/align")
async def align(
    file: UploadFile = File(...),
    lyrics: str = Form(...),
    language: str | None = Form(default=None),
):
    """Align known lyrics to audio. v1 wraps WhisperX's aligner with a single
    pseudo-segment that spans the audio; for real production we'd split into
    sentence segments first, but this is good enough as a fallback path."""
    if not STATE["model_loaded"]:
        raise HTTPException(
            status_code=503,
            detail=f"Model not loaded: {STATE['load_error'] or 'unknown error'}",
        )

    tmp_path = _save_upload(file)
    try:
        import whisperx

        audio = whisperx.load_audio(str(tmp_path))
        duration = float(len(audio)) / 16000.0
        lang = language or WHISPER_LANGUAGE
        if lang != WHISPER_LANGUAGE or STATE["align_model"] is None:
            raise HTTPException(
                status_code=400,
                detail=f"align endpoint only supports language={WHISPER_LANGUAGE} in this build",
            )

        pseudo_segment = {"start": 0.0, "end": duration, "text": lyrics.strip()}
        aligned = whisperx.align(
            [pseudo_segment],
            STATE["align_model"],
            STATE["align_meta"],
            audio,
            STATE["device_str"] if STATE["device"] == "cuda" else "cpu",
            return_char_alignments=False,
        )
        segments = _format_segments(aligned)
        words = [w for s in segments for w in s.get("words", [])]
        return {"words": words, "segments": segments, "language": lang}
    except HTTPException:
        raise
    except Exception as e:
        log.exception("align failed")
        raise HTTPException(status_code=500, detail=f"align failed: {e}")
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass
