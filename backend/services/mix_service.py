"""Mix / Master Service — combine beat + vocal into finished track."""
import uuid
from pathlib import Path

from pydub import AudioSegment

from backend.config import settings


def mix_beat_and_vocal(beat_path: str, vocal_path: str, vocal_db_boost: float = 3.0) -> str:
    """Overlay vocal on beat, normalize, return mixed file path."""
    beat = AudioSegment.from_file(beat_path)
    vocal = AudioSegment.from_file(vocal_path)

    # Match vocal length to beat (or pad beat if vocal is longer)
    if len(vocal) > len(beat):
        # Loop the beat to match vocal length
        loops_needed = (len(vocal) // len(beat)) + 1
        beat = beat * loops_needed
        beat = beat[:len(vocal)]
    elif len(vocal) < len(beat):
        # Pad vocal with silence to match beat length
        silence = AudioSegment.silent(duration=len(beat) - len(vocal))
        vocal = vocal + silence

    # Boost vocal slightly for hip hop (vocal-forward mix)
    vocal = vocal + vocal_db_boost

    # Overlay
    mixed = beat.overlay(vocal)

    # Basic loudness normalization (target -14 LUFS approximation)
    target_dbfs = -14.0
    change_in_dbfs = target_dbfs - mixed.dBFS
    mixed = mixed.apply_gain(change_in_dbfs)

    filename = f"mix_{uuid.uuid4().hex[:12]}.wav"
    output_path = str(settings.exports_dir / filename)
    mixed.export(output_path, format="wav")

    return output_path


def overlay_vocal_on_instrumental(instrumental_path: str, vocal_path: str) -> str:
    """Overlay a new vocal on a separated instrumental. Used for parody pipeline."""
    return mix_beat_and_vocal(instrumental_path, vocal_path, vocal_db_boost=4.0)
