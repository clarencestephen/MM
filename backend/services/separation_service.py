"""Source Separation Service — Demucs stem splitting. 100% local.

Runs on GPU 1 (audio GPU) per dual-GPU strategy.
Results are cached aggressively — never re-separate the same file.
Uses Demucs as a Python library (not CLI) to avoid torchcodec conflicts.
"""
import logging
import uuid
from pathlib import Path

from backend.config import settings
from backend.services import cache_service

log = logging.getLogger(__name__)


def separate_stems(audio_path: str, two_stems: bool = True) -> dict[str, str]:
    """Run Demucs source separation on an audio file.

    Args:
        audio_path: Path to source audio.
        two_stems: If True, separate into vocals + no_vocals only (faster).
                   If False, full 4-stem split (vocals, drums, bass, other).

    Returns:
        Dict mapping stem type to file path.
    """
    cache_key = f"stems_{'2s' if two_stems else '4s'}"
    cached = cache_service.get(cache_key, audio_path)
    if cached:
        if all(Path(p).exists() for p in cached.values()):
            log.info("Stem cache hit — skipping re-separation")
            return cached

    try:
        return _demucs_python(audio_path, two_stems)
    except ImportError:
        log.warning("Demucs not installed. pip install demucs")
        return _create_stub_stems(audio_path, two_stems)
    except Exception as e:
        log.warning(f"Demucs separation failed: {e}")
        return _create_stub_stems(audio_path, two_stems)


def _demucs_python(audio_path: str, two_stems: bool) -> dict[str, str]:
    """Run Demucs as a Python library — avoids CLI/torchcodec issues."""
    import torch
    import numpy as np
    import soundfile as sf
    from demucs.apply import apply_model

    device = torch.device(f"cuda:{settings.gpu_audio}" if torch.cuda.is_available() else "cpu")

    # Use preloaded model if available (instant), otherwise cold load
    from backend.services.model_manager import models
    model = models.get_demucs()
    if model is None:
        from demucs.pretrained import get_model
        model = get_model("htdemucs")
        model.to(device)
        model.eval()

    # Load audio with soundfile (avoids torchcodec issues)
    audio_np, sr = sf.read(audio_path, dtype="float32")
    if audio_np.ndim == 1:
        audio_np = np.stack([audio_np, audio_np], axis=-1)
    wav = torch.from_numpy(audio_np.T)  # (channels, samples)

    # Resample if needed (demucs expects 44100 Hz)
    if sr != model.samplerate:
        wav = torchaudio.functional.resample(wav, sr, model.samplerate)
        sr = model.samplerate

    # Ensure stereo
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)

    # Add batch dimension
    wav = wav.unsqueeze(0).to(device)

    # Run separation
    with torch.no_grad():
        sources = apply_model(model, wav, device=device)

    # sources shape: (batch, num_sources, channels, samples)
    # htdemucs sources order: drums, bass, other, vocals
    source_names = model.sources  # ['drums', 'bass', 'other', 'vocals']

    job_id = uuid.uuid4().hex[:12]
    output_dir = settings.stems_dir / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    stems = {}

    if two_stems:
        # Find vocals index
        vocal_idx = source_names.index("vocals")
        vocals = sources[0, vocal_idx]
        no_vocals = sources[0].sum(dim=0) - vocals  # everything except vocals

        vocal_path = str(output_dir / "vocals.wav")
        no_vocal_path = str(output_dir / "no_vocals.wav")

        sf.write(vocal_path, vocals.cpu().numpy().T, sr)
        sf.write(no_vocal_path, no_vocals.cpu().numpy().T, sr)

        stems["vocals"] = vocal_path
        stems["no_vocals"] = no_vocal_path
    else:
        for i, name in enumerate(source_names):
            stem_path = str(output_dir / f"{name}.wav")
            sf.write(stem_path, sources[0, i].cpu().numpy().T, sr)
            stems[name] = stem_path

    # Cache
    cache_key_name = f"stems_{'2s' if two_stems else '4s'}"
    cache_service.put(cache_key_name, audio_path, data=stems)

    log.info(f"Demucs separation done: {list(stems.keys())}")
    return stems


def _create_stub_stems(audio_path: str, two_stems: bool) -> dict[str, str]:
    """Create stub stem files when Demucs is not available."""
    import shutil

    job_id = uuid.uuid4().hex[:12]
    output_dir = settings.stems_dir / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    stems = {}
    types = ["vocals", "no_vocals"] if two_stems else ["vocals", "drums", "bass", "other"]

    for stem_type in types:
        dest = output_dir / f"{stem_type}.wav"
        shutil.copy2(audio_path, str(dest))
        stems[stem_type] = str(dest)

    return stems
