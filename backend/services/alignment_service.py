"""Alignment Service — dual-mode lyrics-to-audio alignment. 100% local.

Mode 1 (TRANSCRIBE): WhisperX — when we DON'T have lyrics.
    Extracts text + word-level timestamps from vocal audio.

Mode 2 (ALIGN): torchaudio forced_align — when we DO have lyrics.
    Aligns known text to audio for parody timing preservation.
    Skips transcription entirely. This is the parody pipeline's secret weapon.

Both modes run on GPU 1 (audio GPU) per the dual-GPU strategy.
"""
import logging
import uuid
from pathlib import Path

from backend.config import settings
from backend.services import cache_service

log = logging.getLogger(__name__)


def transcribe_with_timestamps(audio_path: str) -> dict:
    """Mode 1: Transcribe audio and get word-level timestamps using WhisperX.

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

    try:
        import whisperx
        import torch

        device = f"cuda:{settings.gpu_audio}" if torch.cuda.is_available() else "cpu"

        # Use preloaded models if available (instant)
        from backend.services.model_manager import models as model_mgr
        wx_model, wx_align, wx_meta = model_mgr.get_whisperx()

        if wx_model is None:
            wx_model = whisperx.load_model("large-v3", device, compute_type="float16")
        if wx_align is None:
            wx_align, wx_meta = whisperx.load_align_model(
                language_code="en", device=device
            )

        audio = whisperx.load_audio(audio_path)
        result = wx_model.transcribe(audio, batch_size=16)

        result = whisperx.align(
            result["segments"], wx_align, wx_meta, audio, device,
            return_char_alignments=False,
        )

        # Flatten to word list
        words = []
        for segment in result.get("segments", []):
            for w in segment.get("words", []):
                words.append({
                    "word": w.get("word", ""),
                    "start": w.get("start", 0),
                    "end": w.get("end", 0),
                })

        full_text = " ".join(w["word"] for w in words)
        output = {"text": full_text, "words": words}

        # Cache it
        cache_service.put("transcript", audio_path, data=output)
        return output

    except ImportError:
        log.warning("WhisperX not installed. Install: pip install git+https://github.com/m-bain/whisperX.git")
        return _stub_transcription(audio_path)


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
    """Stub transcription when WhisperX isn't installed."""
    return {
        "text": "[transcription requires WhisperX — install with: pip install git+https://github.com/m-bain/whisperX.git]",
        "words": [],
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
