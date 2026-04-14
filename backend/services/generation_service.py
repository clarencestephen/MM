"""Audio Generation Service — local vocal generation. Zero API calls.

MVP vocal pipeline:
  1. XTTS v2 (coqui TTS) — generates speech from lyrics with voice cloning
  2. Voice Conversion (RVC) — stylizes into persona identity (when available)

Falls back gracefully:
  - No XTTS installed → uses pyttsx3 (offline system TTS)
  - No RVC → passes vocal through unchanged

Runs on GPU 0 (voice GPU) per dual-GPU strategy.
"""
import logging
import uuid
from pathlib import Path

from backend.config import settings

log = logging.getLogger(__name__)


def generate_vocal(
    lyrics: str,
    style: str = "rap",
    persona_voice_path: str | None = None,
    quality: str = "draft",
) -> str:
    """Generate a vocal track from lyrics. Returns file path.

    Args:
        lyrics: Text to vocalize.
        style: "rap", "melodic", "rnb", "deep".
        persona_voice_path: Path to a voice sample for cloning (XTTS).
        quality: "draft" = faster/rougher, "render" = slower/cleaner.
    """
    output_path = str(
        settings.vocals_dir / f"vocal_{uuid.uuid4().hex[:12]}.wav"
    )

    # Try XTTS v2 (best quality, supports voice cloning — needs a reference voice)
    if persona_voice_path:
        if _try_xtts(lyrics, output_path, persona_voice_path, style, quality):
            return output_path

    # Try non-cloning TTS models (no reference voice needed)
    if _try_tts_default(lyrics, output_path, style):
        return output_path

    # Fallback: pyttsx3 (offline system TTS — always available, no install needed)
    if _try_pyttsx3(lyrics, output_path, style):
        return output_path

    # Last resort: generate silence with duration estimate
    log.warning("No TTS engine available. Generating silent placeholder.")
    return _generate_silence(lyrics, output_path)


def _try_xtts(
    lyrics: str,
    output_path: str,
    voice_sample: str | None,
    style: str,
    quality: str,
) -> bool:
    """Try generating vocal with XTTS v2 (coqui TTS)."""
    try:
        from TTS.api import TTS
        import torch

        device = f"cuda:{settings.gpu_voice}" if torch.cuda.is_available() else "cpu"

        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

        if voice_sample and Path(voice_sample).exists():
            # Voice cloning mode — use persona's voice
            tts.tts_to_file(
                text=lyrics,
                file_path=output_path,
                speaker_wav=voice_sample,
                language="en",
            )
        else:
            # Default voice
            tts.tts_to_file(
                text=lyrics,
                file_path=output_path,
                language="en",
            )

        log.info(f"XTTS vocal generated: {output_path}")
        return True

    except ImportError:
        log.info("XTTS not installed. pip install coqui-tts[codec]")
        return False
    except Exception as e:
        log.warning(f"XTTS generation failed: {e}")
        return False


def _try_tts_default(lyrics: str, output_path: str, style: str) -> bool:
    """Try a non-cloning TTS model. Uses preloaded model from model_manager if available."""
    try:
        # Try preloaded model first (instant — no load time)
        from backend.services.model_manager import models
        tts = models.get_tts()
        if tts:
            tts.tts_to_file(text=lyrics, file_path=output_path)
            log.info(f"TTS vocal generated (preloaded): {output_path}")
            return True
    except Exception:
        pass

    # Cold load fallback
    try:
        import os
        os.environ["COQUI_TOS_AGREED"] = "1"
        from TTS.api import TTS
        import torch

        device = f"cuda:{settings.gpu_voice}" if torch.cuda.is_available() else "cpu"
        tts = TTS("tts_models/en/ljspeech/tacotron2-DDC").to(device)
        tts.tts_to_file(text=lyrics, file_path=output_path)

        log.info(f"TTS vocal generated (cold loaded): {output_path}")
        return True

    except ImportError:
        return False
    except Exception as e:
        log.warning(f"Default TTS failed: {e}")
        return False


def _try_pyttsx3(lyrics: str, output_path: str, style: str) -> bool:
    """Fallback: offline system TTS via pyttsx3."""
    try:
        import pyttsx3

        engine = pyttsx3.init()

        # Adjust voice properties based on style
        rate = engine.getProperty("rate")
        if style == "rap":
            engine.setProperty("rate", rate + 30)  # Faster for rap
        elif style == "melodic":
            engine.setProperty("rate", rate - 20)

        # Try to pick a deeper voice for rap
        voices = engine.getProperty("voices")
        for voice in voices:
            if "male" in voice.name.lower():
                engine.setProperty("voice", voice.id)
                break

        engine.save_to_file(lyrics, output_path)
        engine.runAndWait()

        log.info(f"pyttsx3 vocal generated: {output_path}")
        return True

    except Exception as e:
        log.info(f"pyttsx3 not available: {e}")
        return False


def _generate_silence(lyrics: str, output_path: str) -> str:
    """Generate a silent audio file with estimated duration."""
    from pydub import AudioSegment

    words = len(lyrics.split())
    duration_ms = int(words * 400)  # ~0.4s per word
    silence = AudioSegment.silent(duration=max(duration_ms, 1000))
    silence.export(output_path, format="wav")
    return output_path
