"""Sample library service for MMMM Studio.

Provides a curated library of royalty-free loops and sounds organized by category.
Generates basic samples using synthesis when audio files aren't available.
"""
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from backend.config import settings
from backend.models.sample_library import SamplePack

log = logging.getLogger(__name__)

# Categories with icons and colors (kid-friendly names)
CATEGORIES = [
    {"id": "drums", "name": "Drums & Beats", "icon": "drum", "color": "#ef4444", "emoji": "🥁"},
    {"id": "bass", "name": "Bass", "icon": "waves", "color": "#8b5cf6", "emoji": "🎸"},
    {"id": "melody", "name": "Melodies", "icon": "music", "color": "#3b82f6", "emoji": "🎵"},
    {"id": "keys", "name": "Piano & Keys", "icon": "piano", "color": "#f59e0b", "emoji": "🎹"},
    {"id": "guitar", "name": "Guitar", "icon": "guitar", "color": "#10b981", "emoji": "🎸"},
    {"id": "vocals", "name": "Voice & Choir", "icon": "mic", "color": "#ec4899", "emoji": "🎤"},
    {"id": "fx", "name": "Sound Effects", "icon": "zap", "color": "#06b6d4", "emoji": "✨"},
    {"id": "loops", "name": "Full Loops", "icon": "repeat", "color": "#84cc16", "emoji": "🔁"},
]

# Seed samples — these represent what's in the library
# Audio files are generated on first access via synthesis
SEED_SAMPLES = [
    # Drums (free)
    {"name": "Boom Boom Kick", "category": "drums", "bpm": 90, "tags": "kick,808,trap", "is_free": True, "color": "#ef4444"},
    {"name": "Snappy Snare", "category": "drums", "bpm": 90, "tags": "snare,crisp", "is_free": True, "color": "#ef4444"},
    {"name": "Ticky Hi-Hat", "category": "drums", "bpm": 120, "tags": "hihat,fast", "is_free": True, "color": "#ef4444"},
    {"name": "Big Clap", "category": "drums", "bpm": 90, "tags": "clap,reverb", "is_free": True, "color": "#ef4444"},
    {"name": "Trap Beat Loop", "category": "drums", "bpm": 140, "tags": "loop,trap,full", "is_free": True, "color": "#ef4444"},
    {"name": "Boom Bap Pattern", "category": "drums", "bpm": 90, "tags": "loop,boombap,classic", "is_free": False, "color": "#ef4444"},
    {"name": "Drill Slide", "category": "drums", "bpm": 140, "tags": "drill,808,slide", "is_free": False, "color": "#ef4444"},

    # Bass (free)
    {"name": "Deep 808", "category": "bass", "bpm": 90, "key": "C", "tags": "808,deep,sub", "is_free": True, "color": "#8b5cf6"},
    {"name": "Wobbly Bass", "category": "bass", "bpm": 120, "key": "E", "tags": "wobble,synth", "is_free": True, "color": "#8b5cf6"},
    {"name": "Funky Slap", "category": "bass", "bpm": 100, "key": "G", "tags": "funk,slap", "is_free": False, "color": "#8b5cf6"},
    {"name": "Smooth R&B Bass", "category": "bass", "bpm": 80, "key": "D", "tags": "rnb,smooth", "is_free": False, "color": "#8b5cf6"},

    # Melody (free)
    {"name": "Dreamy Bells", "category": "melody", "bpm": 120, "key": "C", "tags": "bells,dreamy,lofi", "is_free": True, "color": "#3b82f6"},
    {"name": "Sparkle Chime", "category": "melody", "bpm": 100, "key": "F", "tags": "chime,bright", "is_free": True, "color": "#3b82f6"},
    {"name": "Dark Strings", "category": "melody", "bpm": 80, "key": "Am", "tags": "strings,dark,cinematic", "is_free": False, "color": "#3b82f6"},
    {"name": "Flute Loop", "category": "melody", "bpm": 90, "key": "G", "tags": "flute,ethnic", "is_free": False, "color": "#3b82f6"},

    # Keys
    {"name": "Simple Piano", "category": "keys", "bpm": 80, "key": "C", "tags": "piano,simple,clean", "is_free": True, "color": "#f59e0b"},
    {"name": "Rhodes Vibes", "category": "keys", "bpm": 90, "key": "Eb", "tags": "rhodes,electric,smooth", "is_free": True, "color": "#f59e0b"},
    {"name": "Gospel Organ", "category": "keys", "bpm": 100, "key": "Bb", "tags": "organ,gospel,church", "is_free": False, "color": "#f59e0b"},

    # Guitar
    {"name": "Acoustic Strum", "category": "guitar", "bpm": 100, "key": "G", "tags": "acoustic,strum,folk", "is_free": True, "color": "#10b981"},
    {"name": "Electric Clean", "category": "guitar", "bpm": 120, "key": "E", "tags": "electric,clean,jazz", "is_free": True, "color": "#10b981"},
    {"name": "Heavy Distortion", "category": "guitar", "bpm": 160, "key": "E", "tags": "metal,distortion,heavy", "is_free": False, "color": "#10b981"},

    # Vocals
    {"name": "Ooh Choir", "category": "vocals", "bpm": 80, "key": "C", "tags": "choir,ooh,pad", "is_free": True, "color": "#ec4899"},
    {"name": "Yeah Adlib", "category": "vocals", "tags": "adlib,yeah,hype", "is_free": True, "color": "#ec4899"},
    {"name": "Vocal Chop", "category": "vocals", "bpm": 120, "tags": "chop,glitch,edm", "is_free": False, "color": "#ec4899"},

    # FX
    {"name": "Vinyl Crackle", "category": "fx", "tags": "vinyl,noise,lofi", "is_free": True, "color": "#06b6d4"},
    {"name": "Reverse Cymbal", "category": "fx", "tags": "cymbal,reverse,transition", "is_free": True, "color": "#06b6d4"},
    {"name": "Laser Zap", "category": "fx", "tags": "laser,zap,retro", "is_free": True, "color": "#06b6d4"},
    {"name": "Rain Ambience", "category": "fx", "tags": "rain,ambient,nature", "is_free": False, "color": "#06b6d4"},

    # Full loops
    {"name": "Lo-Fi Chill Beat", "category": "loops", "bpm": 80, "key": "C", "tags": "lofi,chill,full", "is_free": True, "color": "#84cc16"},
    {"name": "Trap Banger", "category": "loops", "bpm": 140, "key": "Am", "tags": "trap,hard,full", "is_free": False, "color": "#84cc16"},
]


def seed_sample_library(db: Session):
    """Seed the sample library with default samples. Idempotent."""
    existing = db.query(SamplePack).count()
    if existing > 0:
        log.info(f"Sample library already seeded ({existing} samples)")
        return

    for i, sample in enumerate(SEED_SAMPLES):
        pack = SamplePack(
            name=sample["name"],
            category=sample["category"],
            icon=_category_icon(sample["category"]),
            color=sample.get("color", "#8b5cf6"),
            bpm=sample.get("bpm"),
            key=sample.get("key"),
            tags=sample.get("tags", ""),
            is_free=sample.get("is_free", True),
            sort_order=i,
        )
        db.add(pack)

    db.commit()
    log.info(f"Seeded sample library with {len(SEED_SAMPLES)} samples")


def get_categories() -> list[dict]:
    return CATEGORIES


def list_samples(
    db: Session,
    category: str | None = None,
    free_only: bool = False,
    search: str | None = None,
) -> list[SamplePack]:
    q = db.query(SamplePack)
    if category:
        q = q.filter(SamplePack.category == category)
    if free_only:
        q = q.filter(SamplePack.is_free == True)
    if search:
        search_lower = f"%{search.lower()}%"
        q = q.filter(
            (SamplePack.name.ilike(search_lower)) |
            (SamplePack.tags.ilike(search_lower))
        )
    return q.order_by(SamplePack.sort_order).all()


def generate_sample_audio(sample: SamplePack) -> str:
    """Generate a simple synthesized audio file for a sample.

    This creates basic audio so the library has something to play.
    In production, these would be replaced with real recorded samples.
    """
    import numpy as np
    import soundfile as sf

    output_dir = settings.sample_library_dir / sample.category
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(output_dir / f"{sample.name.replace(' ', '_').lower()}.wav")

    if Path(output_path).exists():
        return output_path

    sr = 44100
    duration = 2.0  # 2 second samples
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)

    if sample.category == "drums":
        audio = _synth_drums(t, sr, sample.name)
    elif sample.category == "bass":
        audio = _synth_bass(t, sr, sample.key or "C")
    elif sample.category in ("melody", "keys"):
        audio = _synth_melody(t, sr, sample.key or "C")
    elif sample.category == "fx":
        audio = _synth_fx(t, sr, sample.name)
    else:
        audio = _synth_melody(t, sr, sample.key or "C")

    # Normalize
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.8

    sf.write(output_path, audio.astype(np.float32), sr)
    log.info(f"Generated sample audio: {output_path}")
    return output_path


def _synth_drums(t, sr, name):
    """Synthesize a simple drum sound."""
    import numpy as np

    name_lower = name.lower()
    if "kick" in name_lower or "boom" in name_lower:
        # Sine sweep down for kick
        freq = 150 * np.exp(-t * 8)
        env = np.exp(-t * 6)
        return np.sin(2 * np.pi * freq * t) * env
    elif "snare" in name_lower or "snap" in name_lower:
        noise = np.random.randn(len(t)) * np.exp(-t * 15)
        tone = np.sin(2 * np.pi * 200 * t) * np.exp(-t * 20)
        return noise * 0.6 + tone * 0.4
    elif "hat" in name_lower or "hi" in name_lower:
        noise = np.random.randn(len(t)) * np.exp(-t * 30)
        return noise * 0.5
    elif "clap" in name_lower:
        noise = np.random.randn(len(t)) * np.exp(-t * 12)
        return noise * 0.7
    else:
        # Generic percussion pattern
        audio = np.zeros_like(t)
        bpm = 120
        beat_samples = int(sr * 60 / bpm)
        for i in range(0, len(t), beat_samples):
            end = min(i + int(sr * 0.1), len(t))
            audio[i:end] = np.sin(2 * np.pi * 100 * t[:end-i]) * np.exp(-t[:end-i] * 10)
        return audio


def _synth_bass(t, sr, key):
    """Synthesize a bass sound."""
    import numpy as np

    key_freqs = {"C": 65.4, "D": 73.4, "E": 82.4, "F": 87.3, "G": 98.0, "A": 110.0, "B": 123.5}
    freq = key_freqs.get(key[0] if key else "C", 65.4)

    # Fat bass with harmonics
    audio = np.sin(2 * np.pi * freq * t) * 0.6
    audio += np.sin(2 * np.pi * freq * 2 * t) * 0.25
    audio += np.sin(2 * np.pi * freq * 3 * t) * 0.1

    # Envelope
    env = np.ones_like(t)
    attack = int(0.02 * sr)
    release = int(0.3 * sr)
    env[:attack] = np.linspace(0, 1, attack)
    env[-release:] = np.linspace(1, 0, release)

    return audio * env


def _synth_melody(t, sr, key):
    """Synthesize a simple melody."""
    import numpy as np

    key_freqs = {"C": 523.2, "D": 587.3, "E": 659.2, "F": 698.5, "G": 784.0, "A": 880.0, "B": 987.8}
    base = key_freqs.get(key[0] if key else "C", 523.2)

    # Simple arpeggio
    notes = [base, base * 1.25, base * 1.5, base * 1.25]
    note_dur = len(t) // len(notes)

    audio = np.zeros_like(t)
    for i, freq in enumerate(notes):
        start = i * note_dur
        end = min(start + note_dur, len(t))
        seg_t = t[:end-start]
        env = np.exp(-seg_t * 3)
        audio[start:end] = np.sin(2 * np.pi * freq * seg_t) * env * 0.5

    return audio


def _synth_fx(t, sr, name):
    """Synthesize a sound effect."""
    import numpy as np

    name_lower = name.lower()
    if "crackle" in name_lower or "vinyl" in name_lower:
        # Random crackle
        audio = np.random.randn(len(t)) * 0.05
        pops = np.random.choice(len(t), size=50, replace=False)
        audio[pops] = np.random.randn(50) * 0.3
        return audio
    elif "reverse" in name_lower or "cymbal" in name_lower:
        # Reverse cymbal (noise ramp up)
        noise = np.random.randn(len(t))
        env = np.linspace(0, 1, len(t)) ** 2
        return noise * env * 0.5
    elif "laser" in name_lower or "zap" in name_lower:
        # Frequency sweep
        freq = np.linspace(2000, 100, len(t))
        env = np.exp(-t * 4)
        return np.sin(2 * np.pi * freq * t / sr * np.cumsum(np.ones_like(t))) * env * 0.5
    elif "rain" in name_lower:
        # Filtered noise
        noise = np.random.randn(len(t)) * 0.15
        # Simple low-pass by averaging
        kernel = np.ones(100) / 100
        return np.convolve(noise, kernel, mode='same')
    else:
        return np.random.randn(len(t)) * 0.1


def _category_icon(category: str) -> str:
    for c in CATEGORIES:
        if c["id"] == category:
            return c["icon"]
    return "music"
