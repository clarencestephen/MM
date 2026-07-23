"""Alignment Service — dual-mode lyrics-to-audio alignment. 100% local.

Mode 1 (TRANSCRIBE): WhisperX (microservice) — when we DON'T have lyrics.
    Extracts text + word-level timestamps from vocal audio.

    WhisperX runs as a sidecar FastAPI service in its own conda env
    (`mm-whisper`) on :8100 because its deps (numpy 2.x, torch 2.8, pandas 3.x)
    are incompatible with the main MM env's TTS + seed-vc stack. This module
    calls it over HTTP. See `whisper_service/main.py`.

Mode 2 (ALIGN): torchaudio forced_align — when we DO have lyrics.
    Aligns known text to audio for parody timing preservation.
    Skips transcription entirely. This is the parody pipeline's secret weapon.

Both modes run on GPU 1 (audio GPU) per the dual-GPU strategy.
"""
import logging
import os
import uuid
from pathlib import Path

from backend.config import settings
from backend.services import cache_service

log = logging.getLogger(__name__)

WHISPER_SERVICE_URL = os.environ.get(
    "WHISPER_SERVICE_URL",
    getattr(settings, "whisper_service_url", "http://localhost:8100"),
)
WHISPER_SERVICE_TIMEOUT = float(os.environ.get("WHISPER_SERVICE_TIMEOUT", "300"))


def _whisper_post(endpoint: str, audio_path: str, extra_fields: dict | None = None) -> dict | None:
    """POST a file to the WhisperX microservice. Returns parsed JSON or None on failure."""
    try:
        import requests
    except ImportError:
        log.warning("requests not installed; cannot reach whisper service")
        return None

    url = WHISPER_SERVICE_URL.rstrip("/") + endpoint
    try:
        with open(audio_path, "rb") as f:
            files = {"file": (Path(audio_path).name, f, "application/octet-stream")}
            data = extra_fields or {}
            resp = requests.post(url, files=files, data=data, timeout=WHISPER_SERVICE_TIMEOUT)
        if resp.status_code != 200:
            log.warning(
                "Whisper service %s returned %s: %s",
                endpoint, resp.status_code, resp.text[:300],
            )
            return None
        return resp.json()
    except requests.exceptions.ConnectionError:
        log.warning(
            "Whisper service unreachable at %s. Start it with: "
            "./scripts/run_whisper_service.sh",
            WHISPER_SERVICE_URL,
        )
        return None
    except Exception as e:
        log.warning("Whisper service call failed: %s", e)
        return None


def transcribe_with_timestamps(audio_path: str) -> dict:
    """Mode 1: Transcribe audio and get word-level timestamps using WhisperX.

    Calls the `mm-whisper` HTTP microservice (default http://localhost:8100).
    Override via WHISPER_SERVICE_URL env var.

    Returns:
        {
            "text": "full transcript...",
            "words": [{"word": "money", "start": 1.23, "end": 1.56}, ...]
        }
    """
    # Check cache first
    cached = cache_service.get("transcript", audio_path)
    if cached:
        log.info("Transcript cache hit")
        return cached

    response = _whisper_post("/transcribe", audio_path)
    if response is None:
        return _stub_transcription(audio_path)

    # Flatten word list from segments for backwards compatibility with callers
    # that expect the legacy {text, words} shape.
    words = []
    for segment in response.get("segments", []):
        for w in segment.get("words", []):
            words.append({
                "word": w.get("word", ""),
                "start": w.get("start", 0),
                "end": w.get("end", 0),
            })

    output = {
        "text": response.get("text") or " ".join(w["word"] for w in words),
        "words": words,
        # Preserve segments + language for newer callers that want them.
        "segments": response.get("segments", []),
        "language": response.get("language"),
    }

    cache_service.put("transcript", audio_path, data=output)
    return output


def align_lyrics_to_audio(audio_path: str, lyrics: str) -> list[dict]:
    """Mode 2: Align known lyrics to audio using torchaudio forced alignment.

    This is the parody pipeline's core — we KNOW the lyrics, we just need
    the exact timing so the replacement vocal matches.

    Returns:
        [{"word": "money", "start": 1.23, "end": 1.56}, ...]
    """
    # Check cache
    cache_key_args = (audio_path, lyrics[:200])
    cached = cache_service.get("alignment", *cache_key_args)
    if cached:
        log.info("Alignment cache hit")
        return cached.get("words", [])

    try:
        import torch
        import torchaudio
        from torchaudio.functional import forced_align

        device = f"cuda:{settings.gpu_audio}" if torch.cuda.is_available() else "cpu"

        # Use preloaded model if available (instant)
        from backend.services.model_manager import models as model_mgr
        preloaded_model, preloaded_labels = model_mgr.get_alignment()


        # Load audio
        waveform, sample_rate = torchaudio.load(audio_path)
        if sample_rate != 16000:
            waveform = torchaudio.functional.resample(waveform, sample_rate, 16000)
            sample_rate = 16000
        waveform = waveform.to(device)

        # Use preloaded or cold load
        if preloaded_model is not None:
            model = preloaded_model
            labels = preloaded_labels
        else:
            bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
            model = bundle.get_model().to(device)
            labels = bundle.get_labels()

        # Get emissions
        with torch.inference_mode():
            emissions, _ = model(waveform)

        # Tokenize lyrics
        transcript = lyrics.upper().replace("\n", " ").strip()
        tokens = []
        for char in transcript:
            if char in labels:
                tokens.append(labels.index(char))
            elif char == " ":
                tokens.append(labels.index("|"))
            # Skip unknown chars

        if not tokens:
            return _stub_alignment(lyrics)

        token_tensor = torch.tensor([tokens], dtype=torch.int32, device=device)

        # Run forced alignment
        aligned_tokens, scores = forced_align(emissions, token_tensor)

        # Convert token alignments to word-level timestamps
        words = _tokens_to_words(aligned_tokens[0], scores[0], labels, transcript, sample_rate)

        # Cache
        cache_service.put("alignment", *cache_key_args, data={"words": words})
        return words

    except ImportError:
        log.warning("torchaudio not installed. Install PyTorch: pip install torch torchaudio")
        return _stub_alignment(lyrics)
    except Exception as e:
        log.warning(f"Forced alignment failed: {e}. Using stub.")
        return _stub_alignment(lyrics)


def _tokens_to_words(
    aligned_tokens, scores, labels: list[str], transcript: str, sample_rate: int
) -> list[dict]:
    """Convert CTC token alignments to word-level timestamps."""
    import torch

    words = []
    current_word = ""
    word_start = None

    ratio = 320 / sample_rate  # wav2vec2 downsampling ratio

    for i, (token_idx, score) in enumerate(zip(aligned_tokens, scores)):
        token_idx = token_idx.item() if isinstance(token_idx, torch.Tensor) else token_idx
        time_sec = i * ratio

        if token_idx < len(labels):
            char = labels[token_idx]
        else:
            continue

        if char == "|" or char == "<pad>":
            if current_word:
                words.append({
                    "word": current_word,
                    "start": round(word_start, 3),
                    "end": round(time_sec, 3),
                })
                current_word = ""
                word_start = None
        else:
            if word_start is None:
                word_start = time_sec
            current_word += char

    if current_word and word_start is not None:
        words.append({
            "word": current_word,
            "start": round(word_start, 3),
            "end": round(len(aligned_tokens) * ratio, 3),
        })

    return words


def _stub_transcription(audio_path: str) -> dict:
    """Stub transcription when the WhisperX microservice is unavailable."""
    return {
        "text": (
            "[transcription requires the WhisperX microservice — "
            "start with: ./scripts/run_whisper_service.sh]"
        ),
        "words": [],
        "segments": [],
        "language": None,
    }


def _stub_alignment(lyrics: str) -> list[dict]:
    """Stub alignment — evenly space words across estimated duration."""
    words = lyrics.split()
    if not words:
        return []

    estimated_duration = len(words) * 0.4  # ~0.4s per word for rap
    time_per_word = estimated_duration / len(words)

    return [
        {
            "word": w,
            "start": round(i * time_per_word, 3),
            "end": round((i + 1) * time_per_word, 3),
        }
        for i, w in enumerate(words)
    ]
