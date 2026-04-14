"""MIDI handling for MMMM Studio.

Converts MIDI note data (from Web MIDI API) into audio using FluidSynth + SoundFonts.
Falls back to a simple sine-wave synthesizer if FluidSynth is unavailable.
"""
import logging
import json
from pathlib import Path

import numpy as np

from backend.config import settings

log = logging.getLogger(__name__)

DEFAULT_SOUNDFONT = "FluidR3_GM.sf2"

# General MIDI instrument programs (subset)
GM_INSTRUMENTS = {
    "piano": 0, "electric piano": 4, "organ": 19,
    "acoustic guitar": 25, "electric guitar": 27,
    "bass": 33, "slap bass": 36,
    "strings": 48, "violin": 40, "cello": 42,
    "trumpet": 56, "trombone": 57, "saxophone": 66, "flute": 73,
    "synth": 80, "synth pad": 88,
    "choir": 52,
}


def midi_to_audio(
    midi_data: list[dict],
    instrument: str = "piano",
    bpm: int = 120,
    key: str = "C",
    output_path: str | None = None,
) -> str:
    """Convert MIDI note data to audio.

    midi_data: [{"note": 60, "velocity": 100, "start": 0.0, "end": 0.5}, ...]
    """
    if not midi_data:
        log.warning("Empty MIDI data")
        return ""

    if output_path is None:
        output_dir = settings.studio_dir / "midi"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(output_dir / f"midi_{instrument.replace(' ', '_')}_{len(midi_data)}notes.wav")

    # Try FluidSynth
    result = _render_with_fluidsynth(midi_data, instrument, output_path)
    if result:
        return result

    # Fallback: simple sine synthesis
    return _render_with_sine(midi_data, output_path)


def _render_with_fluidsynth(
    midi_data: list[dict],
    instrument: str,
    output_path: str,
) -> str | None:
    """Render MIDI using FluidSynth + SoundFont."""
    try:
        import fluidsynth

        # Find SoundFont
        sf_path = settings.soundfonts_dir / DEFAULT_SOUNDFONT
        if not sf_path.exists():
            log.warning(f"SoundFont not found: {sf_path}")
            return None

        fs = fluidsynth.Synth(samplerate=44100.0)
        sfid = fs.sfload(str(sf_path))

        # Set instrument program
        program = GM_INSTRUMENTS.get(instrument.lower(), 0)
        fs.program_select(0, sfid, 0, program)

        # Calculate total duration
        max_end = max(n["end"] for n in midi_data) if midi_data else 1.0
        total_samples = int((max_end + 1.0) * 44100)
        buffer = np.zeros(total_samples * 2, dtype=np.float32)  # stereo

        # Schedule notes
        sample_rate = 44100
        for note in midi_data:
            start_sample = int(note["start"] * sample_rate)
            end_sample = int(note["end"] * sample_rate)

            fs.noteon(0, note["note"], note.get("velocity", 100))
            # Generate audio for this note's duration
            dur_samples = end_sample - start_sample
            if dur_samples > 0:
                samples = fs.get_samples(dur_samples)
                end_idx = min(start_sample * 2 + len(samples), len(buffer))
                actual_len = end_idx - start_sample * 2
                buffer[start_sample * 2:end_idx] += samples[:actual_len]
            fs.noteoff(0, note["note"])

        fs.delete()

        # Normalize and save
        if np.max(np.abs(buffer)) > 0:
            buffer = buffer / np.max(np.abs(buffer)) * 0.8

        import soundfile as sf
        audio = buffer.reshape(-1, 2)
        sf.write(output_path, audio, 44100)

        log.info(f"FluidSynth rendered: {output_path}")
        return output_path

    except ImportError:
        log.warning("FluidSynth not installed. Install with: pip install pyfluidsynth")
        return None
    except Exception as e:
        log.error(f"FluidSynth rendering failed: {e}")
        return None


def _render_with_sine(midi_data: list[dict], output_path: str) -> str:
    """Fallback: render MIDI as simple sine waves."""
    import soundfile as sf

    sample_rate = 44100
    max_end = max(n["end"] for n in midi_data) if midi_data else 1.0
    total_samples = int((max_end + 0.5) * sample_rate)
    audio = np.zeros(total_samples, dtype=np.float32)

    for note in midi_data:
        freq = 440.0 * (2.0 ** ((note["note"] - 69) / 12.0))
        velocity = note.get("velocity", 100) / 127.0
        start = int(note["start"] * sample_rate)
        end = int(note["end"] * sample_rate)
        duration = end - start

        if duration <= 0:
            continue

        t = np.arange(duration) / sample_rate
        # Sine with simple ADSR envelope
        envelope = np.ones(duration)
        attack = min(int(0.01 * sample_rate), duration)
        release = min(int(0.05 * sample_rate), duration)
        envelope[:attack] = np.linspace(0, 1, attack)
        if release > 0:
            envelope[-release:] = np.linspace(1, 0, release)

        wave = np.sin(2 * np.pi * freq * t) * envelope * velocity * 0.3
        end_idx = min(start + duration, total_samples)
        actual = end_idx - start
        audio[start:end_idx] += wave[:actual]

    # Normalize
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.8

    sf.write(output_path, audio, sample_rate)
    log.info(f"Sine fallback rendered: {output_path}")
    return output_path
