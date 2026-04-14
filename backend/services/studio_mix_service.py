"""Multi-track mixing for MMMM Studio.

Renders all tracks in a session into a stereo master mix,
applying volume, pan, mute/solo, and arrangement sections.
"""
import logging
import math
from pathlib import Path

from pydub import AudioSegment

from backend.config import settings

log = logging.getLogger(__name__)


def mix_session(session_id: str, quality: str = "draft") -> str:
    """Render all tracks in a session to a stereo master mix.

    Returns path to the mixed WAV file.
    """
    from backend.database import SessionLocal
    from backend.models.studio_session import StudioSession

    db = SessionLocal()
    try:
        session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        tracks = [t for t in session.tracks if not t.muted]

        # Handle solo: if any track is soloed, only play soloed tracks
        soloed = [t for t in tracks if t.solo]
        if soloed:
            tracks = soloed

        if not tracks:
            log.warning(f"No active tracks in session {session_id}")
            raise ValueError("No active tracks to mix")

        # Load all track audio
        segments = []
        for track in tracks:
            audio_path = track.processed_audio_path or track.raw_audio_path
            if not audio_path or not Path(audio_path).exists():
                continue

            seg = AudioSegment.from_file(audio_path)

            # Apply volume (dB)
            if track.volume != 0:
                seg = seg + track.volume

            # Apply pan (-1.0 to 1.0)
            if track.pan != 0:
                seg = seg.pan(track.pan)

            segments.append(seg)

        if not segments:
            raise ValueError("No audio files found for tracks")

        # Match all segments to the longest duration
        max_len = max(len(s) for s in segments)
        padded = []
        for seg in segments:
            if len(seg) < max_len:
                silence = AudioSegment.silent(duration=max_len - len(seg))
                seg = seg + silence
            padded.append(seg)

        # Overlay all tracks
        mixed = padded[0]
        for seg in padded[1:]:
            mixed = mixed.overlay(seg)

        # Normalize to -14 LUFS (approximate via peak normalization)
        target_dbfs = -14.0
        change_db = target_dbfs - mixed.dBFS
        mixed = mixed.apply_gain(change_db)

        # Save
        output_dir = settings.studio_dir / session_id
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(output_dir / "master_mix.wav")
        mixed.export(output_path, format="wav")

        # Update session
        session.master_mix_path = output_path
        session.status = "mixing"
        db.commit()

        log.info(f"Session {session_id} mixed: {output_path} ({len(tracks)} tracks, {max_len}ms)")
        return output_path

    finally:
        db.close()


def render_stems(session_id: str) -> dict[str, str]:
    """Render each track as a separate WAV file.

    Returns: {"track_id": "path_to_wav", ...}
    """
    from backend.database import SessionLocal
    from backend.models.studio_session import StudioSession

    db = SessionLocal()
    try:
        session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        output_dir = settings.studio_dir / session_id / "stems"
        output_dir.mkdir(parents=True, exist_ok=True)

        stems = {}
        for track in session.tracks:
            audio_path = track.processed_audio_path or track.raw_audio_path
            if not audio_path or not Path(audio_path).exists():
                continue

            seg = AudioSegment.from_file(audio_path)
            stem_path = str(output_dir / f"{track.name.replace(' ', '_')}_{track.id[:8]}.wav")
            seg.export(stem_path, format="wav")
            stems[track.id] = stem_path

        log.info(f"Rendered {len(stems)} stems for session {session_id}")
        return stems

    finally:
        db.close()
