"""Pitch detection, key estimation, and pitch shifting for MMMM Studio.

Uses librosa for key detection and pitch contour analysis.
Optional: torchcrepe for GPU-accelerated f0 tracking.
pyrubberband for high-quality pitch shifting.
"""
import logging
from pathlib import Path

import numpy as np

from backend.config import settings

log = logging.getLogger(__name__)

# Key names for chroma-based detection
KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def detect_key(audio_path: str) -> dict:
    """Detect the musical key of an audio file using chroma features.

    Returns: {"key": "C", "scale": "major", "confidence": 0.85}
    """
    try:
        import librosa

        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)

        # Krumhansl-Kessler key profiles
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

        best_key = "C"
        best_scale = "major"
        best_corr = -1.0

        for i in range(12):
            rolled = np.roll(chroma_mean, -i)
            corr_major = float(np.corrcoef(rolled, major_profile)[0, 1])
            corr_minor = float(np.corrcoef(rolled, minor_profile)[0, 1])

            if corr_major > best_corr:
                best_corr = corr_major
                best_key = KEY_NAMES[i]
                best_scale = "major"
            if corr_minor > best_corr:
                best_corr = corr_minor
                best_key = KEY_NAMES[i]
                best_scale = "minor"

        log.info(f"Key detected: {best_key} {best_scale} (confidence={best_corr:.2f})")
        return {"key": best_key, "scale": best_scale, "confidence": round(best_corr, 3)}

    except ImportError:
        log.warning("librosa not available, returning default key")
        return {"key": "C", "scale": "major", "confidence": 0.0}
    except Exception as e:
        log.error(f"Key detection failed: {e}")
        return {"key": "C", "scale": "major", "confidence": 0.0}


def detect_pitch_contour(audio_path: str) -> list[dict]:
    """Extract f0 pitch contour from audio.

    Returns: [{"time": 0.0, "freq": 440.0, "confidence": 0.95}, ...]
    """
    try:
        # Try GPU-accelerated CREPE first
        import torchcrepe
        import torch
        import torchaudio

        audio, sr = torchaudio.load(audio_path)
        if audio.shape[0] > 1:
            audio = audio.mean(dim=0, keepdim=True)

        device = torch.device(f"cuda:{settings.gpu_audio}" if torch.cuda.is_available() else "cpu")
        pitch, confidence = torchcrepe.predict(
            audio, sr,
            hop_length=512,
            fmin=50, fmax=2000,
            model="tiny",
            device=device,
            return_periodicity=True,
        )

        times = np.arange(len(pitch[0])) * 512 / sr
        result = []
        for t, f, c in zip(times, pitch[0].cpu().numpy(), confidence[0].cpu().numpy()):
            result.append({"time": round(float(t), 4), "freq": round(float(f), 2), "confidence": round(float(c), 3)})
        return result

    except ImportError:
        pass

    try:
        # Fallback to librosa pyin
        import librosa

        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y, fmin=50, fmax=2000, sr=sr,
        )
        times = librosa.times_like(f0, sr=sr)

        result = []
        for t, f, v in zip(times, f0, voiced_probs):
            if np.isnan(f):
                continue
            result.append({"time": round(float(t), 4), "freq": round(float(f), 2), "confidence": round(float(v), 3)})
        return result

    except Exception as e:
        log.error(f"Pitch contour extraction failed: {e}")
        return []


def pitch_shift(audio_path: str, semitones: int, output_path: str | None = None) -> str:
    """Shift the pitch of an audio file by a number of semitones.

    Returns the path to the shifted audio file.
    """
    if semitones == 0:
        return audio_path

    if output_path is None:
        p = Path(audio_path)
        sign = "up" if semitones > 0 else "down"
        output_path = str(p.parent / f"{p.stem}_pitch{sign}{abs(semitones)}{p.suffix}")

    try:
        import pyrubberband as pyrb
        import soundfile as sf

        y, sr = sf.read(audio_path)
        shifted = pyrb.pitch_shift(y, sr, n_steps=semitones)
        sf.write(output_path, shifted, sr)
        log.info(f"Pitch shifted {semitones} semitones: {output_path}")
        return output_path

    except ImportError:
        # Fallback to librosa (lower quality)
        try:
            import librosa
            import soundfile as sf

            y, sr = librosa.load(audio_path, sr=None, mono=False)
            shifted = librosa.effects.pitch_shift(y=y, sr=sr, n_steps=semitones)
            sf.write(output_path, shifted.T if shifted.ndim > 1 else shifted, sr)
            log.info(f"Pitch shifted (librosa fallback) {semitones} semitones: {output_path}")
            return output_path
        except Exception as e:
            log.error(f"Pitch shift failed: {e}")
            return audio_path


def calculate_semitone_shift(source_key: str, target_key: str) -> int:
    """Calculate the number of semitones to shift from source_key to target_key."""
    if source_key not in KEY_NAMES or target_key not in KEY_NAMES:
        return 0
    source_idx = KEY_NAMES.index(source_key)
    target_idx = KEY_NAMES.index(target_key)
    shift = target_idx - source_idx
    # Take the shortest path
    if shift > 6:
        shift -= 12
    elif shift < -6:
        shift += 12
    return shift
