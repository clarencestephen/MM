"""Export Service — produce WAV, MP3, stems ZIP from song assets."""
import uuid
import zipfile
from pathlib import Path

from pydub import AudioSegment

from backend.config import settings


def export_wav(mix_path: str) -> str:
    """Export the mix as a WAV file."""
    audio = AudioSegment.from_file(mix_path)
    filename = f"export_{uuid.uuid4().hex[:12]}.wav"
    output_path = str(settings.exports_dir / filename)
    audio.export(output_path, format="wav")
    return output_path


def export_mp3(mix_path: str) -> str:
    """Export the mix as an MP3 file."""
    audio = AudioSegment.from_file(mix_path)
    filename = f"export_{uuid.uuid4().hex[:12]}.mp3"
    output_path = str(settings.exports_dir / filename)
    audio.export(output_path, format="mp3", bitrate="320k")
    return output_path


def export_stems_zip(stem_paths: dict[str, str]) -> str:
    """Bundle stems into a ZIP file."""
    filename = f"stems_{uuid.uuid4().hex[:12]}.zip"
    output_path = str(settings.exports_dir / filename)

    with zipfile.ZipFile(output_path, "w") as zf:
        for stem_type, path in stem_paths.items():
            zf.write(path, f"{stem_type}{Path(path).suffix}")

    return output_path
