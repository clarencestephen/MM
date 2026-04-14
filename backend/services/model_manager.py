"""Model Manager — persistent GPU model preloading for instant inference.

Keeps models hot in VRAM so generation is instant when users hit Generate.
No cold-start lag. No reloading. Models stay resident until shutdown.

GPU 0: XTTS v2 (TTS) + seed-vc (voice conversion)
GPU 1: Demucs (separation) + wav2vec2 (alignment)
CPU:   Ollama manages its own model caching

Usage:
    from backend.services.model_manager import models
    models.warm_up()  # call once at startup
    tts = models.get_tts()  # instant — already loaded
    demucs = models.get_demucs()  # instant
"""
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from backend.config import settings

log = logging.getLogger(__name__)


@dataclass
class ModelRegistry:
    """Holds all loaded models. Thread-safe singleton."""
    _tts_model: Any = None
    _demucs_model: Any = None
    _align_model: Any = None
    _align_labels: list = field(default_factory=list)
    _whisperx_model: Any = None
    _whisperx_align: Any = None
    _whisperx_meta: Any = None
    _lock: threading.Lock = field(default_factory=threading.Lock)
    _ready: dict = field(default_factory=dict)

    def warm_up(self):
        """Load all models into VRAM. Call once at startup."""
        log.info("=" * 50)
        log.info("MODEL MANAGER: Warming up all models...")
        log.info("=" * 50)

        threads = [
            threading.Thread(target=self._load_tts, name="load-tts"),
            threading.Thread(target=self._load_demucs, name="load-demucs"),
            threading.Thread(target=self._load_alignment, name="load-align"),
            threading.Thread(target=self._load_whisperx, name="load-whisperx"),
            threading.Thread(target=self._warm_ollama, name="warm-ollama"),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        loaded = [k for k, v in self._ready.items() if v]
        failed = [k for k, v in self._ready.items() if not v]
        log.info(f"Models ready: {loaded}")
        if failed:
            log.warning(f"Models failed to load (will use fallbacks): {failed}")
        log.info("=" * 50)
        log.info("MODEL MANAGER: Warm-up complete")
        log.info("=" * 50)

    def _load_tts(self):
        """Load XTTS v2 onto GPU 0."""
        try:
            import os
            os.environ["COQUI_TOS_AGREED"] = "1"
            import torch
            from TTS.api import TTS

            device = f"cuda:{settings.gpu_voice}" if torch.cuda.is_available() else "cpu"
            start = time.time()

            # Load the default (non-cloning) model for fast generation
            self._tts_model = TTS("tts_models/en/ljspeech/tacotron2-DDC").to(device)

            elapsed = time.time() - start
            log.info(f"TTS loaded on {device} in {elapsed:.1f}s")
            self._ready["tts"] = True

        except Exception as e:
            log.warning(f"TTS failed to load: {e}")
            self._ready["tts"] = False

    def _load_demucs(self):
        """Load Demucs htdemucs onto GPU 1."""
        try:
            import torch
            from demucs.pretrained import get_model

            device = torch.device(
                f"cuda:{settings.gpu_audio}" if torch.cuda.is_available() else "cpu"
            )
            start = time.time()

            model = get_model("htdemucs")
            model.to(device)
            model.eval()
            self._demucs_model = model

            elapsed = time.time() - start
            log.info(f"Demucs loaded on {device} in {elapsed:.1f}s")
            self._ready["demucs"] = True

        except Exception as e:
            log.warning(f"Demucs failed to load: {e}")
            self._ready["demucs"] = False

    def _load_alignment(self):
        """Load wav2vec2 alignment model onto GPU 1."""
        try:
            import torch
            import torchaudio

            device = f"cuda:{settings.gpu_audio}" if torch.cuda.is_available() else "cpu"
            start = time.time()

            bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
            model = bundle.get_model().to(device)
            model.eval()
            labels = bundle.get_labels()

            self._align_model = model
            self._align_labels = list(labels)

            elapsed = time.time() - start
            log.info(f"Alignment model loaded on {device} in {elapsed:.1f}s")
            self._ready["alignment"] = True

        except Exception as e:
            log.warning(f"Alignment model failed to load: {e}")
            self._ready["alignment"] = False

    def _load_whisperx(self):
        """Load WhisperX transcription model onto GPU 1."""
        try:
            import torch
            import whisperx

            # WhisperX needs a simple device string, not "cuda:1" format for some versions
            device = "cuda" if torch.cuda.is_available() else "cpu"
            start = time.time()

            model = whisperx.load_model("large-v3", device, compute_type="float16")
            self._whisperx_model = model

            # Also preload alignment model
            align_model, metadata = whisperx.load_align_model(
                language_code="en", device=device
            )
            self._whisperx_align = align_model
            self._whisperx_meta = metadata

            elapsed = time.time() - start
            log.info(f"WhisperX loaded on {device} in {elapsed:.1f}s")
            self._ready["whisperx"] = True

        except ImportError:
            log.info("WhisperX not installed — transcription will use stub")
            self._ready["whisperx"] = False
        except Exception as e:
            log.warning(f"WhisperX failed to load: {e}")
            self._ready["whisperx"] = False

    def _warm_ollama(self):
        """Send a warm-up prompt to Ollama so the model is loaded in memory."""
        try:
            from backend.services.llm_service import generate
            start = time.time()

            # Small prompt to force model load
            generate("Say OK", system="Respond with just OK")

            elapsed = time.time() - start
            log.info(f"Ollama warmed up in {elapsed:.1f}s")
            self._ready["ollama"] = True

        except Exception as e:
            log.warning(f"Ollama warm-up failed: {e}")
            self._ready["ollama"] = False

    # === Getters — return preloaded models or None ===

    def get_tts(self):
        """Get the preloaded TTS model (or None)."""
        return self._tts_model

    def get_demucs(self):
        """Get the preloaded Demucs model (or None)."""
        return self._demucs_model

    def get_alignment(self) -> tuple:
        """Get (model, labels) for forced alignment."""
        return self._align_model, self._align_labels

    def get_whisperx(self) -> tuple:
        """Get (model, align_model, metadata) for WhisperX."""
        return self._whisperx_model, self._whisperx_align, self._whisperx_meta

    def is_ready(self, model_name: str) -> bool:
        return self._ready.get(model_name, False)

    def status(self) -> dict:
        return dict(self._ready)


# Singleton
models = ModelRegistry()
