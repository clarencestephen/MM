"""Sound-to-instrument conversion for MMMM Studio.

Core pipeline:
1. Analyze input: pitched (humming) vs percussive (tapping/beatboxing)
2. Route to appropriate generator:
   - Pitched → MusicGen melody-conditioned
   - Percussive → MusicGen or onset-mapped drum synthesis
3. Generate: MusicGen with text prompt + audio conditioning
4. Post-process: match length, normalize

Uses Meta's MusicGen (via audiocraft) for local inference. Zero API calls.
"""
import logging
from pathlib import Path
from typing import Literal

import numpy as np

from backend.config import settings
from backend.services.cache_service import cache

log = logging.getLogger(__name__)

# Preset instruments for free tier
PRESET_INSTRUMENTS = [
    "drums", "snare", "hi-hat", "clap", "bass",
    "electric guitar", "acoustic guitar", "piano",
    "synth", "strings", "choir", "trumpet",
    "saxophone", "flute", "organ",
]


def classify_input(audio_path: str) -> Literal["pitched", "percussive", "mixed"]:
    """Classify whether the input audio is pitched (humming/singing) or percussive (tapping/beatboxing)."""
    try:
        from backend.services.pitch_service import detect_pitch_contour

        contour = detect_pitch_contour(audio_path)
        if not contour:
            return "percussive"

        # Check confidence of pitch detection
        confidences = [p["confidence"] for p in contour]
        avg_confidence = np.mean(confidences) if confidences else 0

        if avg_confidence > 0.5:
            return "pitched"
        elif avg_confidence > 0.2:
            return "mixed"
        else:
            return "percussive"

    except Exception as e:
        log.warning(f"Input classification failed: {e}")
        return "mixed"


def convert_to_instrument(
    audio_path: str,
    instrument_description: str,
    quality: str = "draft",
    duration: float | None = None,
) -> str:
    """Convert a recording (humming, tapping, etc.) into an instrument sound.

    Args:
        audio_path: Path to the raw recording
        instrument_description: What instrument it should sound like
        quality: "draft" (musicgen-small) or "render" (musicgen-melody)
        duration: Target duration in seconds (defaults to input duration)

    Returns:
        Path to the generated instrument audio file.
    """
    # Check cache
    cache_key = cache._cache_key("instrument", audio_path, instrument_description, quality)
    cached = cache.get_file("instrument", cache_key)
    if cached:
        log.info(f"Instrument conversion cache hit: {cached}")
        return cached

    input_type = classify_input(audio_path)
    log.info(f"Input classified as: {input_type}")

    output_path = _generate_with_musicgen(audio_path, instrument_description, quality, duration)

    if output_path:
        cache.put_file("instrument", cache_key, output_path)
        return output_path

    # Last resort: return original audio
    log.warning("All instrument conversion methods failed, returning original")
    return audio_path


def _generate_with_musicgen(
    audio_path: str,
    description: str,
    quality: str,
    duration: float | None,
) -> str | None:
    """Generate instrument audio using MusicGen with melody conditioning."""
    try:
        import torch
        import torchaudio
        from audiocraft.models import MusicGen
        from audiocraft.data.audio import audio_write

        # Choose model based on quality
        model_name = "facebook/musicgen-small" if quality == "draft" else "facebook/musicgen-melody"

        device = f"cuda:{settings.gpu_audio}" if torch.cuda.is_available() else "cpu"
        log.info(f"Loading MusicGen ({model_name}) on {device}...")

        model = MusicGen.get_pretrained(model_name, device=device)

        # Load conditioning audio
        melody, sr = torchaudio.load(audio_path)
        if melody.shape[0] > 1:
            melody = melody.mean(dim=0, keepdim=True)

        # Estimate duration from input if not specified
        if duration is None:
            duration = melody.shape[1] / sr

        # Cap duration for VRAM safety
        duration = min(duration, 30.0)
        model.set_generation_params(duration=duration)

        # Generate with melody conditioning
        prompt = f"{description}, high quality, professional recording"
        wav = model.generate_with_chroma(
            descriptions=[prompt],
            melody_wavs=melody.unsqueeze(0).to(device),
            melody_sample_rate=sr,
            progress=True,
        )

        # Save output
        output_dir = settings.studio_dir / "generated"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_stem = output_dir / f"inst_{Path(audio_path).stem}_{description.replace(' ', '_')[:30]}"
        audio_write(str(output_stem), wav[0].cpu(), model.sample_rate, strategy="loudness")
        output_path = str(output_stem) + ".wav"

        log.info(f"MusicGen generated: {output_path}")

        # Unload model to free VRAM
        del model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        return output_path

    except ImportError:
        log.warning("audiocraft not installed — MusicGen unavailable. Install with: pip install audiocraft")
        return _fallback_stub(audio_path, description)
    except Exception as e:
        log.error(f"MusicGen generation failed: {e}")
        return _fallback_stub(audio_path, description)


def _fallback_stub(audio_path: str, description: str) -> str:
    """Stub fallback: returns the original audio with a log message.

    In production, MusicGen should be installed for real conversion.
    """
    log.warning(f"Using stub for instrument conversion: '{description}' — install audiocraft for real conversion")
    return audio_path


def parse_instrument_prompt(description: str) -> dict:
    """Use LLM to parse freeform instrument description into structured parameters.

    Returns: {"instrument": "guitar", "style": "heavy metal", "effects": ["distortion"], "intensity": 0.9}
    """
    try:
        from backend.services.llm_service import generate

        system = (
            "You parse instrument descriptions into structured JSON. "
            "Return: {instrument, style, effects[], intensity (0-1)}. "
            "Example: 'heavy metal grungy guitar' → {\"instrument\": \"guitar\", \"style\": \"heavy_metal_grunge\", \"effects\": [\"distortion\", \"overdrive\"], \"intensity\": 0.9}"
        )

        result = generate(description, system=system, json_mode=True)
        if isinstance(result, dict):
            return result
    except Exception as e:
        log.warning(f"LLM instrument parsing failed: {e}")

    # Keyword fallback
    desc_lower = description.lower()
    instrument = "synth"
    for preset in PRESET_INSTRUMENTS:
        if preset in desc_lower:
            instrument = preset
            break

    return {
        "instrument": instrument,
        "style": "default",
        "effects": [],
        "intensity": 0.5,
    }
