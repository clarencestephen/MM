"""Voice Conversion Service — THIS IS YOUR MOAT.

Uses seed-vc for zero-shot voice conversion:
- No model training needed for MVP
- User uploads 6-30 seconds of their voice
- That reference audio IS the persona — no training step
- Supports both speech AND singing voice conversion

Pipeline: XTTS rough vocal → seed-vc (convert to persona) → final styled vocal

Future: RVC with trained .pth models for power users who want
persistent, high-quality persona models.

Runs on GPU 0 (voice GPU).
"""
import logging
import shutil
import uuid
from pathlib import Path

from backend.config import settings
from backend.services import cache_service

log = logging.getLogger(__name__)


def convert_voice(
    audio_path: str,
    reference_voice_path: str | None = None,
    style_mode: str = "rap",
    diffusion_steps: int = 10,
) -> str:
    """Convert a vocal to match a persona's voice identity.

    Args:
        audio_path: Path to the source vocal audio (TTS output).
        reference_voice_path: Path to the persona's reference voice sample.
            This is the target voice — seed-vc will make the source sound like this.
        style_mode: "rap", "melodic", "rnb" — adjusts conversion parameters.
        diffusion_steps: Quality control. 10=draft, 25=render.

    Returns:
        Path to the converted vocal audio.
    """
    if not reference_voice_path or not Path(reference_voice_path).exists():
        log.info("No persona reference voice — returning original audio.")
        return audio_path

    # Check cache
    cached = cache_service.get_file(
        "voice_convert", audio_path, reference_voice_path, str(diffusion_steps)
    )
    if cached and Path(cached).exists():
        log.info("Voice conversion cache hit")
        return cached

    # Try seed-vc (primary — zero-shot, supports singing)
    result = _seed_vc_convert(audio_path, reference_voice_path, diffusion_steps)
    if result:
        cache_service.put_file(
            "voice_convert", audio_path, reference_voice_path,
            str(diffusion_steps), src_path=result,
        )
        return result

    # Try OpenVoice (fallback — lighter, lower quality)
    result = _openvoice_convert(audio_path, reference_voice_path)
    if result:
        return result

    # Last resort: pass through unchanged
    log.warning("No voice conversion engine available. Returning original.")
    return audio_path


def _seed_vc_convert(
    source_path: str, reference_path: str, diffusion_steps: int
) -> str | None:
    """Zero-shot voice conversion using seed-vc.

    seed-vc converts any voice to sound like the reference voice
    using just a short audio clip. No training needed.
    """
    try:
        import torch
        import subprocess
        import tempfile

        output_name = f"vc_{uuid.uuid4().hex[:12]}.wav"
        output_path = str(settings.vocals_dir / output_name)

        # seed-vc exposes inference via `python -m seed_vc.inference`
        # (the package has no `__main__`, so the bare `-m seed_vc` form fails).
        # Use subprocess for clean isolation (avoids VRAM leaks).
        import sys
        cmd = [
            sys.executable, "-m", "seed_vc.inference",
            "--source", source_path,
            "--target", reference_path,
            "--output", str(settings.vocals_dir),
            "--diffusion-steps", str(diffusion_steps),
        ]

        device = f"cuda:{settings.gpu_voice}" if torch.cuda.is_available() else "cpu"
        env = {"CUDA_VISIBLE_DEVICES": str(settings.gpu_voice)}

        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120,
            env={**__import__("os").environ, **env},
        )

        if result.returncode == 0:
            # Find the output file (seed-vc names it based on source)
            source_stem = Path(source_path).stem
            candidates = list(settings.vocals_dir.glob(f"*{source_stem}*"))
            if candidates:
                # Rename to our convention
                final_path = str(settings.vocals_dir / output_name)
                shutil.move(str(candidates[-1]), final_path)
                log.info(f"seed-vc conversion done: {final_path}")
                return final_path

        log.warning(f"seed-vc failed: {result.stderr[:200]}")
        return None

    except ImportError:
        log.info("seed-vc not installed. pip install seed-vc")
        return None
    except Exception as e:
        log.warning(f"seed-vc error: {e}")
        return None


def _openvoice_convert(source_path: str, reference_path: str) -> str | None:
    """Fallback voice conversion using OpenVoice v2 tone color converter."""
    try:
        import torch
        from openvoice.api import ToneColorConverter
        from openvoice import se_extractor

        device = f"cuda:{settings.gpu_voice}" if torch.cuda.is_available() else "cpu"

        # OpenVoice needs checkpoint files — check if they exist
        ckpt_dir = settings.storage_dir / "models" / "openvoice_v2"
        config_path = ckpt_dir / "converter" / "config.json"
        if not config_path.exists():
            log.info("OpenVoice checkpoints not found. Skipping.")
            return None

        converter = ToneColorConverter(str(config_path), device=device)
        converter.load_ckpt(str(ckpt_dir / "converter" / "checkpoint.pth"))

        # Extract target voice embedding from reference
        target_se, _ = se_extractor.get_se(reference_path, converter, vad=True)

        # Extract source speaker embedding
        source_se, _ = se_extractor.get_se(source_path, converter, vad=True)

        output_name = f"vc_{uuid.uuid4().hex[:12]}.wav"
        output_path = str(settings.vocals_dir / output_name)

        converter.convert(
            audio_src_path=source_path,
            src_se=source_se,
            tgt_se=target_se,
            output_path=output_path,
        )

        log.info(f"OpenVoice conversion done: {output_path}")
        return output_path

    except ImportError:
        log.info("OpenVoice not installed.")
        return None
    except Exception as e:
        log.warning(f"OpenVoice error: {e}")
        return None


def extract_voice_embedding(reference_path: str) -> dict:
    """Extract a voice embedding from a reference audio clip.

    For seed-vc, the "embedding" IS the reference audio itself.
    We just validate it and store metadata.

    For future RVC integration, this would extract a proper embedding.
    """
    from pydub import AudioSegment

    audio = AudioSegment.from_file(reference_path)
    duration_sec = len(audio) / 1000.0

    return {
        "reference_path": reference_path,
        "duration_seconds": round(duration_sec, 1),
        "sample_rate": audio.frame_rate,
        "channels": audio.channels,
        "usable": 3.0 <= duration_sec <= 120.0,
        "quality_note": (
            "good" if 6.0 <= duration_sec <= 30.0
            else "short — 6-30 seconds recommended" if duration_sec < 6.0
            else "long — will use first 30 seconds"
        ),
    }
