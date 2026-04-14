"""Tempo detection, onset analysis, and time stretching for MMMM Studio.

Uses librosa for BPM detection and onset detection.
pyrubberband for high-quality time stretching.
"""
import logging
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)


def detect_bpm(audio_path: str) -> dict:
    """Detect the tempo (BPM) of an audio file.

    Returns: {"bpm": 120.0, "confidence": 0.9}
    """
    try:
        import librosa

        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)

        # tempo can be an array in newer librosa
        bpm = float(tempo[0]) if hasattr(tempo, '__len__') else float(tempo)

        # Confidence based on beat regularity
        if len(beat_frames) > 2:
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)
            intervals = np.diff(beat_times)
            if len(intervals) > 0:
                cv = float(np.std(intervals) / np.mean(intervals))  # coefficient of variation
                confidence = max(0.0, min(1.0, 1.0 - cv))
            else:
                confidence = 0.5
        else:
            confidence = 0.3

        log.info(f"BPM detected: {bpm:.1f} (confidence={confidence:.2f})")
        return {"bpm": round(bpm, 1), "confidence": round(confidence, 3)}

    except ImportError:
        log.warning("librosa not available, returning default BPM")
        return {"bpm": 120.0, "confidence": 0.0}
    except Exception as e:
        log.error(f"BPM detection failed: {e}")
        return {"bpm": 120.0, "confidence": 0.0}


def detect_onsets(audio_path: str) -> list[float]:
    """Detect onset times in an audio file (useful for percussion/tapping).

    Returns: list of onset times in seconds.
    """
    try:
        import librosa

        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        onset_frames = librosa.onset.onset_detect(y=y, sr=sr, backtrack=True)
        onset_times = librosa.frames_to_time(onset_frames, sr=sr)
        return [round(float(t), 4) for t in onset_times]

    except ImportError:
        log.warning("librosa not available for onset detection")
        return []
    except Exception as e:
        log.error(f"Onset detection failed: {e}")
        return []


def time_stretch(audio_path: str, ratio: float, output_path: str | None = None) -> str:
    """Time-stretch an audio file by a ratio (e.g., 1.2 = 20% slower, 0.8 = 20% faster).

    Returns the path to the stretched audio file.
    """
    if abs(ratio - 1.0) < 0.001:
        return audio_path

    if output_path is None:
        p = Path(audio_path)
        output_path = str(p.parent / f"{p.stem}_tempo{ratio:.2f}{p.suffix}")

    try:
        import pyrubberband as pyrb
        import soundfile as sf

        y, sr = sf.read(audio_path)
        stretched = pyrb.time_stretch(y, sr, rate=ratio)
        sf.write(output_path, stretched, sr)
        log.info(f"Time stretched ratio={ratio:.2f}: {output_path}")
        return output_path

    except ImportError:
        try:
            import librosa
            import soundfile as sf

            y, sr = librosa.load(audio_path, sr=None, mono=False)
            stretched = librosa.effects.time_stretch(y=y, rate=ratio)
            sf.write(output_path, stretched.T if stretched.ndim > 1 else stretched, sr)
            log.info(f"Time stretched (librosa fallback) ratio={ratio:.2f}: {output_path}")
            return output_path
        except Exception as e:
            log.error(f"Time stretch failed: {e}")
            return audio_path


def calculate_stretch_ratio(source_bpm: float, target_bpm: float) -> float:
    """Calculate the time stretch ratio to convert from source_bpm to target_bpm."""
    if source_bpm <= 0 or target_bpm <= 0:
        return 1.0
    return target_bpm / source_bpm
