"""Render an Ableton Live Set (.als) to a single mixed WAV file.

ALS is gzipped XML referencing audio samples on disk. We walk the XML for
AudioClip nodes, resolve their FileRef paths, and overlay the samples onto
a flat stereo canvas at the session BPM. MidiClip nodes are also walked,
collected per track, rendered to a temporary MIDI file, and synthesized
via FluidSynth + a General MIDI SoundFont, then mixed with the audio clips.

What works:
  - Audio clips that point to WAV/MP3/etc. files we can find on disk
  - .zip uploads of an Ableton project (.als + Samples/ folder)
  - MIDI clips on instrument tracks (rendered via FluidSynth + SF2)
  - Tempo from <Tempo><Manual Value=".."/>

What does NOT work:
  - Effects, automation, sidechain, send routing
  - Per-track plugin sounds (we fall back to a GM patch by track name)
  - Absolute sample paths pointing at the user's local disk (the server
    can't see those — upload as a zip with samples bundled)
"""
import gzip
import logging
import os
import shutil
import subprocess
import tempfile
import uuid
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Iterator, Optional

from pydub import AudioSegment

from backend.config import settings

log = logging.getLogger(__name__)


class AlsRenderError(Exception):
    """Raised when an .als cannot be rendered to audio."""


def render_als_to_wav(als_path: str | Path) -> str:
    """Render an Ableton Live Set to a single mixed WAV.

    `als_path` may be a `.als` file or a `.zip` containing one. Returns the
    path to the rendered WAV. Raises AlsRenderError if no usable audio is
    found (e.g. project is MIDI-only with no FluidSynth available, or
    samples are missing).
    """
    src = Path(als_path)
    if not src.exists():
        raise AlsRenderError(f"File not found: {als_path}")

    # If it's a zip, extract to a temp dir and find the .als inside
    if src.suffix.lower() == ".zip":
        return _render_zip(src)

    return _render_als_file(src, project_dir=src.parent)


def _render_zip(zip_path: Path) -> str:
    """Extract an Ableton project zip and render the .als inside."""
    with tempfile.TemporaryDirectory(prefix="als_") as tmp:
        tmp_dir = Path(tmp)
        try:
            with zipfile.ZipFile(str(zip_path)) as zf:
                zf.extractall(str(tmp_dir))
        except zipfile.BadZipFile as e:
            raise AlsRenderError(f"Invalid zip file: {e}")

        als_files = list(tmp_dir.rglob("*.als"))
        if not als_files:
            raise AlsRenderError("No .als file found inside the zip")

        # If multiple, render the first; warn so we know
        if len(als_files) > 1:
            log.warning("Zip contains %d .als files, using %s", len(als_files), als_files[0])
        als = als_files[0]
        return _render_als_file(als, project_dir=als.parent)


def _render_als_file(als: Path, project_dir: Path) -> str:
    """Core rendering: gunzip, parse, walk clips, mix, save."""
    try:
        with gzip.open(str(als), "rb") as f:
            xml_bytes = f.read()
        root = ET.fromstring(xml_bytes)
    except (OSError, gzip.BadGzipFile) as e:
        raise AlsRenderError(f"Not a valid gzipped .als file: {e}")
    except ET.ParseError as e:
        raise AlsRenderError(f"Could not parse .als XML: {e}")

    bpm = _get_bpm(root)
    audio_clips = list(_iter_audio_clips(root, project_dir))
    midi_tracks = list(_iter_midi_tracks(root))
    midi_clip_count = sum(len(t["clips"]) for t in midi_tracks)

    midi_segment: Optional[AudioSegment] = None
    midi_render_error: Optional[str] = None
    if midi_tracks:
        try:
            midi_segment = _render_midi_tracks(midi_tracks, bpm)
        except _FluidSynthUnavailable as e:
            midi_render_error = str(e)
            log.warning("MIDI rendering skipped: %s", e)
        except Exception as e:
            midi_render_error = f"MIDI rendering failed: {e}"
            log.warning(midi_render_error)

    if not audio_clips and midi_segment is None:
        if midi_clip_count > 0:
            raise AlsRenderError(
                f"Found {midi_clip_count} MIDI clip(s) across {len(midi_tracks)} "
                "instrument track(s), but couldn't render them: "
                f"{midi_render_error or 'FluidSynth or SoundFont missing'}. "
                "Install fluidsynth + a General MIDI SoundFont (e.g. "
                "FluidR3_GM.sf2) under storage/soundfonts/, or bounce the "
                "project to WAV from Ableton and upload that instead."
            )
        raise AlsRenderError(
            "No playable audio clips found in this .als. Either the project "
            "uses only MIDI/instrument tracks, or the referenced sample files "
            "aren't bundled. Bounce to WAV from Ableton "
            "(File → Export Audio/Video) and upload that instead, or upload "
            "the project as a zip with the Samples/ folder included."
        )

    mix = _build_mix(audio_clips, bpm, midi_segment=midi_segment)

    out_dir = settings.beats_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"als_render_{uuid.uuid4().hex[:12]}.wav"
    mix.export(str(out_path), format="wav")

    log.info(
        "Rendered %s: %d audio clip(s), %d MIDI clip(s) across %d instrument "
        "track(s), bpm=%.1f, duration=%.1fs → %s",
        als.name, len(audio_clips), midi_clip_count, len(midi_tracks),
        bpm, len(mix) / 1000, out_path.name,
    )
    return str(out_path)


# ─── XML walking: audio ───────────────────────────────────────────────────

def _get_bpm(root: ET.Element) -> float:
    for tempo in root.iter("Tempo"):
        manual = tempo.find("Manual")
        if manual is not None and "Value" in manual.attrib:
            try:
                return float(manual.attrib["Value"])
            except ValueError:
                pass
    return 120.0


def _iter_audio_clips(root: ET.Element, project_dir: Path) -> Iterator[dict]:
    """Yield one dict per playable audio clip we could resolve on disk."""
    for clip in root.iter("AudioClip"):
        sample = _resolve_sample_path(clip, project_dir)
        if not sample:
            continue
        try:
            seg = AudioSegment.from_file(str(sample))
        except Exception as e:
            log.warning("Failed to load %s: %s", sample, e)
            continue

        yield {
            "audio": seg,
            "start_beats": _get_float(clip, "CurrentStart", 0.0) or 0.0,
        }


def _resolve_sample_path(clip: ET.Element, project_dir: Path) -> Optional[Path]:
    """Try every FileRef path strategy until one points to an existing file."""
    for fileref in clip.iter("FileRef"):
        # 1. RelativePath from project root
        rel = fileref.find("RelativePath")
        if rel is not None and "Value" in rel.attrib:
            cand = (project_dir / rel.attrib["Value"]).resolve()
            if cand.exists():
                return cand
            # Sometimes RelativePath uses backslashes from Windows projects
            cand = (project_dir / rel.attrib["Value"].replace("\\", "/")).resolve()
            if cand.exists():
                return cand

        # 2. Absolute Path
        for tag in ("Path", "AbsolutePath"):
            abs_el = fileref.find(tag)
            if abs_el is not None and "Value" in abs_el.attrib:
                cand = Path(abs_el.attrib["Value"])
                if cand.exists():
                    return cand

        # 3. Filename in project_dir or its Samples/ subdir
        name_el = fileref.find("Name")
        if name_el is not None and "Value" in name_el.attrib:
            name = name_el.attrib["Value"]
            for parent in (project_dir, project_dir / "Samples", project_dir / "Samples" / "Imported"):
                cand = parent / name
                if cand.exists():
                    return cand
    return None


def _get_float(parent: ET.Element, tag: str, default=None):
    el = parent.find(tag)
    if el is not None and "Value" in el.attrib:
        try:
            return float(el.attrib["Value"])
        except ValueError:
            pass
    return default


# ─── XML walking: MIDI ────────────────────────────────────────────────────

# Best-effort track-name → General MIDI program mapping.
# Channel 10 (index 9 in 0-based mido) is reserved for the GM drum kit.
_GM_MAP = [
    # (substring, program, is_drums)
    ("drum", None, True),
    ("kit", None, True),
    ("808", None, True),
    ("piano", 0, False),
    ("keys", 0, False),
    ("rhodes", 4, False),
    ("epiano", 4, False),
    ("organ", 16, False),
    ("hammond", 16, False),
    ("b3", 16, False),
    ("bass", 33, False),
    ("guitar", 24, False),
    ("strings", 48, False),
    ("violin", 48, False),
    ("cello", 48, False),
    ("sax", 65, False),
    ("flute", 73, False),
    ("trumpet", 56, False),
    ("synth pad", 88, False),
    ("pad", 88, False),
    ("lead", 80, False),
    ("synth", 80, False),
    ("choir", 52, False),
    ("vox", 52, False),
]


def _gm_patch_for_track_name(name: str) -> tuple[int, bool]:
    """Return (program, is_drums) for a track based on its name."""
    n = (name or "").lower()
    for substr, prog, is_drums in _GM_MAP:
        if substr in n:
            return (prog if prog is not None else 0, is_drums)
    return (0, False)  # default: Acoustic Grand Piano


def _iter_midi_tracks(root: ET.Element) -> Iterator[dict]:
    """Yield one dict per MidiTrack that contains at least one MidiClip.

    Each dict has:
      - name: str (best-effort)
      - program: int (GM program 0-127)
      - is_drums: bool
      - clips: list[dict] with start_beats and notes
    """
    for track_el in root.iter("MidiTrack"):
        clips = list(_iter_midi_clips(track_el))
        if not clips:
            continue
        name = _get_track_name(track_el) or "Instrument"
        program, is_drums = _gm_patch_for_track_name(name)
        yield {
            "name": name,
            "program": program,
            "is_drums": is_drums,
            "clips": clips,
        }


def _get_track_name(track_el: ET.Element) -> Optional[str]:
    """Read <Name><EffectiveName Value="..."/></Name> or <UserName>."""
    name_el = track_el.find("Name")
    if name_el is None:
        return None
    for child_tag in ("EffectiveName", "UserName"):
        child = name_el.find(child_tag)
        if child is not None and "Value" in child.attrib:
            v = child.attrib["Value"].strip()
            if v:
                return v
    return None


def _iter_midi_clips(track_el: ET.Element) -> Iterator[dict]:
    """Yield one dict per MidiClip on this track, each with start + notes."""
    for clip in track_el.iter("MidiClip"):
        start_beats = _get_float(clip, "CurrentStart", 0.0) or 0.0
        notes = list(_iter_midi_notes(clip))
        if not notes:
            continue
        yield {"start_beats": start_beats, "notes": notes}


def _iter_midi_notes(clip_el: ET.Element) -> Iterator[dict]:
    """Walk <KeyTracks>/<KeyTrack>/<Notes>/<MidiNoteEvent>.

    Each KeyTrack has <MidiKey Value="X"/> for the MIDI note number.
    Each MidiNoteEvent has Time (beats), Duration (beats), Velocity attrs.
    """
    for key_track in clip_el.iter("KeyTrack"):
        midi_key_el = key_track.find("MidiKey")
        if midi_key_el is None or "Value" not in midi_key_el.attrib:
            continue
        try:
            pitch = int(midi_key_el.attrib["Value"])
        except ValueError:
            continue
        if not (0 <= pitch <= 127):
            continue

        for event in key_track.iter("MidiNoteEvent"):
            try:
                time_b = float(event.attrib.get("Time", 0.0))
                dur_b = float(event.attrib.get("Duration", 0.25))
                vel = int(float(event.attrib.get("Velocity", 100)))
            except (ValueError, TypeError):
                continue
            if dur_b <= 0:
                continue
            yield {
                "pitch": pitch,
                "time_beats": max(0.0, time_b),
                "duration_beats": dur_b,
                "velocity": max(1, min(127, vel)),
            }


# ─── MIDI rendering ───────────────────────────────────────────────────────

class _FluidSynthUnavailable(RuntimeError):
    """Raised when neither pyfluidsynth nor a fluidsynth binary is usable."""


def _find_soundfont() -> Optional[Path]:
    """Look in storage/soundfonts/ for any .sf2 file, preferring FluidR3_GM."""
    sf_dir = settings.soundfonts_dir
    preferred = sf_dir / "FluidR3_GM.sf2"
    if preferred.exists():
        return preferred
    if sf_dir.exists():
        for sf in sorted(sf_dir.glob("*.sf2")):
            return sf
    return None


def _build_midi_file(midi_tracks: list[dict], bpm: float, mid_path: Path) -> None:
    """Build a Type-1 .mid file at `mid_path` from collected MIDI clips."""
    import mido

    mid = mido.MidiFile(type=1, ticks_per_beat=480)
    tpb = mid.ticks_per_beat

    # Track 0: tempo / meta
    meta = mido.MidiTrack()
    mid.tracks.append(meta)
    meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm), time=0))
    meta.append(mido.MetaMessage("end_of_track", time=1))

    # Channel allocation: skip channel 9 (drums) for non-drum tracks.
    next_chan = 0
    for track_info in midi_tracks:
        if track_info["is_drums"]:
            channel = 9
        else:
            while next_chan == 9:
                next_chan += 1
            if next_chan > 15:
                # Recycle channel 0 if we run out
                channel = 0
            else:
                channel = next_chan
                next_chan += 1

        mt = mido.MidiTrack()
        mid.tracks.append(mt)
        mt.append(mido.MetaMessage("track_name", name=track_info["name"][:32], time=0))
        if not track_info["is_drums"]:
            mt.append(mido.Message("program_change", channel=channel,
                                   program=track_info["program"], time=0))

        # Flatten all (abs_tick, kind, pitch, velocity) events for this track.
        events: list[tuple[int, str, int, int]] = []
        for clip in track_info["clips"]:
            clip_start_beats = clip["start_beats"]
            for note in clip["notes"]:
                abs_beat_on = clip_start_beats + note["time_beats"]
                abs_beat_off = abs_beat_on + note["duration_beats"]
                on_tick = max(0, int(round(abs_beat_on * tpb)))
                off_tick = max(on_tick + 1, int(round(abs_beat_off * tpb)))
                events.append((on_tick, "on", note["pitch"], note["velocity"]))
                events.append((off_tick, "off", note["pitch"], 0))

        # Stable sort: note_off before note_on at the same tick to avoid hung notes
        events.sort(key=lambda e: (e[0], 0 if e[1] == "off" else 1))

        last_tick = 0
        for abs_tick, kind, pitch, vel in events:
            delta = abs_tick - last_tick
            last_tick = abs_tick
            if kind == "on":
                mt.append(mido.Message("note_on", channel=channel,
                                       note=pitch, velocity=vel, time=delta))
            else:
                mt.append(mido.Message("note_off", channel=channel,
                                       note=pitch, velocity=0, time=delta))
        mt.append(mido.MetaMessage("end_of_track", time=1))

    mid.save(str(mid_path))


def _render_midi_file_to_wav(mid_path: Path, wav_path: Path, soundfont: Path) -> None:
    """Render a .mid to .wav. Prefer pyfluidsynth; fall back to fluidsynth CLI.

    Raises _FluidSynthUnavailable if neither path is usable.
    """
    # Try CLI first (the task spec explicitly recommends this command).
    fluidsynth_bin = shutil.which("fluidsynth")
    if fluidsynth_bin:
        try:
            subprocess.run(
                [
                    fluidsynth_bin, "-ni",
                    "-F", str(wav_path),
                    "-r", "44100",
                    str(soundfont),
                    str(mid_path),
                ],
                check=True,
                capture_output=True,
                timeout=300,
            )
            if wav_path.exists() and wav_path.stat().st_size > 44:
                return
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            log.warning("fluidsynth CLI failed (%s), trying pyfluidsynth", e)

    # Try pyfluidsynth python binding as fallback.
    try:
        import fluidsynth as _fs  # type: ignore
        import numpy as np
        import soundfile as sf
        import mido
    except ImportError as e:
        raise _FluidSynthUnavailable(
            f"Neither the `fluidsynth` binary nor the `pyfluidsynth` Python "
            f"package is available ({e}). Install fluidsynth: "
            f"`apt-get install fluidsynth` or `pip install pyfluidsynth`."
        )

    synth = _fs.Synth(samplerate=44100.0)
    try:
        sfid = synth.sfload(str(soundfont))

        # Pre-select program 0 on all channels; mido stream handles
        # program_change messages on the fly.
        for ch in range(16):
            try:
                synth.program_select(ch, sfid, 128 if ch == 9 else 0, 0)
            except Exception:
                pass

        mid = mido.MidiFile(str(mid_path))
        total_seconds = mid.length + 1.0
        sample_rate = 44100
        out = np.zeros((int(total_seconds * sample_rate) * 2,), dtype=np.float32)

        cursor_samples = 0
        for msg in mid:
            # mido's iteration yields msg.time as seconds (delta from prev)
            delta_samples = int(msg.time * sample_rate)
            if delta_samples > 0:
                samples = synth.get_samples(delta_samples)
                end = min(cursor_samples + len(samples), len(out))
                actual = end - cursor_samples
                if actual > 0:
                    out[cursor_samples:end] += samples[:actual]
                cursor_samples = end

            if msg.is_meta:
                continue
            if msg.type == "note_on":
                synth.noteon(msg.channel, msg.note, msg.velocity)
            elif msg.type == "note_off":
                synth.noteoff(msg.channel, msg.note)
            elif msg.type == "program_change":
                try:
                    synth.program_select(msg.channel, sfid,
                                         128 if msg.channel == 9 else 0,
                                         msg.program)
                except Exception:
                    pass

        # Tail samples to let notes ring out
        tail = synth.get_samples(sample_rate)
        end = min(cursor_samples + len(tail), len(out))
        actual = end - cursor_samples
        if actual > 0:
            out[cursor_samples:end] += tail[:actual]

        peak = float(np.max(np.abs(out))) if out.size else 0.0
        if peak > 0:
            out = (out / peak) * 0.8

        sf.write(str(wav_path), out.reshape(-1, 2), sample_rate)
    finally:
        try:
            synth.delete()
        except Exception:
            pass


def _render_midi_tracks(midi_tracks: list[dict], bpm: float) -> AudioSegment:
    """Materialize all MIDI clips → one AudioSegment.

    Returns an AudioSegment positioned at beat 0 (i.e. CurrentStart values
    are already encoded in the MIDI file).
    """
    soundfont = _find_soundfont()
    if soundfont is None:
        raise _FluidSynthUnavailable(
            f"No .sf2 SoundFont found in {settings.soundfonts_dir}. "
            "Drop FluidR3_GM.sf2 (or any GM-compatible .sf2) there."
        )

    with tempfile.TemporaryDirectory(prefix="als_midi_") as tmp:
        tmp_dir = Path(tmp)
        mid_path = tmp_dir / "render.mid"
        wav_path = tmp_dir / "render.wav"

        _build_midi_file(midi_tracks, bpm, mid_path)
        _render_midi_file_to_wav(mid_path, wav_path, soundfont)

        if not wav_path.exists() or wav_path.stat().st_size < 100:
            raise _FluidSynthUnavailable(
                "FluidSynth produced an empty or missing WAV. "
                "Check that the SoundFont is valid."
            )
        seg = AudioSegment.from_file(str(wav_path))
        return seg.set_frame_rate(44100).set_channels(2)


# ─── Mixing ───────────────────────────────────────────────────────────────

def _build_mix(
    clips: list[dict],
    bpm: float,
    midi_segment: Optional[AudioSegment] = None,
) -> AudioSegment:
    """Overlay every clip onto a silent stereo canvas at its beat position."""
    ms_per_beat = 60_000.0 / bpm

    end_times = [c["start_beats"] * ms_per_beat + len(c["audio"]) for c in clips]
    if midi_segment is not None:
        end_times.append(len(midi_segment))
    total_ms = int(max(end_times)) if end_times else 1000

    mix = AudioSegment.silent(duration=total_ms, frame_rate=44100).set_channels(2)
    for c in clips:
        position = max(0, int(c["start_beats"] * ms_per_beat))
        mix = mix.overlay(c["audio"], position=position)

    if midi_segment is not None:
        mix = mix.overlay(midi_segment, position=0)

    return mix
