"""Ableton Live Set (.als) export for MMMM Studio.

ALS files are gzipped XML following Ableton's internal schema.
This generates a minimal but valid ALS that Ableton Live can open,
containing audio tracks with referenced sample files.
"""
import gzip
import logging
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

from backend.config import settings

log = logging.getLogger(__name__)


def export_als(session_id: str) -> str:
    """Generate an Ableton Live Set from a studio session.

    Returns path to a ZIP containing the .als file and Samples/ folder.
    """
    from backend.database import SessionLocal
    from backend.models.studio_session import StudioSession

    db = SessionLocal()
    try:
        session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        output_dir = settings.studio_dir / session_id / "ableton"
        output_dir.mkdir(parents=True, exist_ok=True)
        samples_dir = output_dir / "Samples"
        samples_dir.mkdir(exist_ok=True)

        # Build ALS XML
        root = _build_als_xml(session, samples_dir)

        # Write gzipped XML (.als)
        als_path = output_dir / f"{session.title.replace(' ', '_')}.als"
        xml_bytes = ET.tostring(root, encoding="unicode", xml_declaration=True).encode("utf-8")
        with gzip.open(str(als_path), "wb") as f:
            f.write(xml_bytes)

        # Package as ZIP
        zip_path = str(settings.exports_dir / f"studio_{session_id}_ableton.zip")
        with ZipFile(zip_path, "w") as zf:
            zf.write(str(als_path), f"{session.title}/{session.title}.als")
            for sample in samples_dir.iterdir():
                zf.write(str(sample), f"{session.title}/Samples/{sample.name}")

        log.info(f"Ableton ALS exported: {zip_path}")
        return zip_path

    finally:
        db.close()


def _build_als_xml(session, samples_dir: Path) -> ET.Element:
    """Build the Ableton Live Set XML structure."""
    # Root
    ableton = ET.Element("Ableton")
    ableton.set("MajorVersion", "5")
    ableton.set("MinorVersion", "11.0.0")
    ableton.set("Creator", "MM")

    live_set = ET.SubElement(ableton, "LiveSet")

    # Master Track
    master = ET.SubElement(live_set, "MasterTrack")
    _add_track_device_chain(master)

    # Tempo
    tempo_el = ET.SubElement(live_set, "Tempo")
    manual = ET.SubElement(tempo_el, "Manual")
    manual.set("Value", str(float(session.bpm)))

    # Time Signature
    time_sig = ET.SubElement(live_set, "TimeSignature")
    numerator = ET.SubElement(time_sig, "Numerator")
    numerator.set("Value", session.time_signature.split("/")[0] if "/" in session.time_signature else "4")
    denominator = ET.SubElement(time_sig, "Denominator")
    denominator.set("Value", session.time_signature.split("/")[1] if "/" in session.time_signature else "4")

    # Audio Tracks
    tracks_el = ET.SubElement(live_set, "Tracks")

    for i, track in enumerate(session.tracks):
        audio_path = track.processed_audio_path or track.raw_audio_path
        if not audio_path or not Path(audio_path).exists():
            continue

        # Copy audio to Samples directory
        src = Path(audio_path)
        sample_name = f"{track.name.replace(' ', '_')}_{track.id[:8]}{src.suffix}"
        dest = samples_dir / sample_name
        shutil.copy2(str(src), str(dest))

        # Create audio track element
        audio_track = ET.SubElement(tracks_el, "AudioTrack")
        audio_track.set("Id", str(i))

        name_el = ET.SubElement(audio_track, "Name")
        effective = ET.SubElement(name_el, "EffectiveName")
        effective.set("Value", track.name)
        user_name = ET.SubElement(name_el, "UserName")
        user_name.set("Value", track.name)

        # Color
        color = ET.SubElement(audio_track, "Color")
        color.set("Value", str(i % 16))

        # Volume
        mixer = ET.SubElement(audio_track, "DeviceChain")
        mixer_el = ET.SubElement(mixer, "Mixer")
        volume = ET.SubElement(mixer_el, "Volume")
        vol_manual = ET.SubElement(volume, "Manual")
        # Convert dB to Ableton's linear scale (approximate)
        linear = 10 ** (track.volume / 20) if track.volume != 0 else 1.0
        vol_manual.set("Value", str(round(linear, 4)))

        # Pan
        pan_el = ET.SubElement(mixer_el, "Pan")
        pan_manual = ET.SubElement(pan_el, "Manual")
        pan_manual.set("Value", str(round(track.pan, 4)))

        # Audio clip reference
        clip_slot = ET.SubElement(audio_track, "MainSequencer")
        sample_ref = ET.SubElement(clip_slot, "Sample")
        file_ref = ET.SubElement(sample_ref, "FileRef")
        rel_path = ET.SubElement(file_ref, "RelativePath")
        rel_path.set("Value", f"Samples/{sample_name}")

    return ableton


def _add_track_device_chain(track_el: ET.Element):
    """Add a minimal device chain to a track element."""
    device_chain = ET.SubElement(track_el, "DeviceChain")
    mixer = ET.SubElement(device_chain, "Mixer")
    volume = ET.SubElement(mixer, "Volume")
    manual = ET.SubElement(volume, "Manual")
    manual.set("Value", "1.0")
