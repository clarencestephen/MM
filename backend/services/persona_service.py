"""Voice Persona Service — manage reusable vocal identities.

With seed-vc, the persona IS the reference voice clip.
No training step needed — just upload your voice, and every future
generation uses that clip as the conversion target.

The pipeline:
1. User uploads 6-30 seconds of their voice
2. We validate the sample quality
3. We store the sample as the persona's "model"
4. At generation time: XTTS rough vocal → seed-vc(reference=persona sample) → done

Future RVC integration: train a .pth model for power users.
"""
import uuid
import shutil
import logging
from pathlib import Path

from pydub import AudioSegment

from backend.config import settings
from backend.services.voice_conversion_service import extract_voice_embedding

log = logging.getLogger(__name__)


def save_voice_sample(file_data: bytes, filename: str, user_id: str) -> dict:
    """Save and validate an uploaded voice sample.

    Returns dict with path and quality metadata.
    """
    ext = Path(filename).suffix or ".wav"
    dest_name = f"persona_{user_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = settings.personas_dir / dest_name

    with open(dest_path, "wb") as f:
        f.write(file_data)

    # Validate and extract embedding metadata
    embedding_info = extract_voice_embedding(str(dest_path))

    if not embedding_info["usable"]:
        log.warning(f"Voice sample too short/long: {embedding_info['duration_seconds']}s")

    # Normalize to WAV 16kHz mono for consistent processing
    normalized_path = _normalize_audio(str(dest_path))
    if normalized_path != str(dest_path):
        embedding_info["reference_path"] = normalized_path

    return {
        "voice_sample_path": str(dest_path),
        "normalized_path": normalized_path,
        "embedding_info": embedding_info,
    }


def _normalize_audio(audio_path: str) -> str:
    """Normalize voice sample to 16kHz mono WAV for consistent processing."""
    try:
        audio = AudioSegment.from_file(audio_path)

        # Convert to mono
        if audio.channels > 1:
            audio = audio.set_channels(1)

        # Resample to 16kHz
        if audio.frame_rate != 16000:
            audio = audio.set_frame_rate(16000)

        # Trim to 30 seconds max (seed-vc works best with 6-30s)
        if len(audio) > 30000:
            audio = audio[:30000]

        # Normalize volume
        target_dbfs = -20.0
        change = target_dbfs - audio.dBFS
        audio = audio.apply_gain(change)

        # Save normalized version
        normalized_path = audio_path.rsplit(".", 1)[0] + "_norm.wav"
        audio.export(normalized_path, format="wav")

        return normalized_path

    except Exception as e:
        log.warning(f"Audio normalization failed: {e}")
        return audio_path
