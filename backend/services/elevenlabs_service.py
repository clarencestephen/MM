"""ElevenLabs cloud TTS + Instant Voice Cloning.

Pro-tier premium voice engine. Free users stay on local XTTS; only Pro
users hit ElevenLabs to keep credit burn under control.

Reads `ELEVENLABS_API_KEY` from the user's env (see backend/config.py —
env_file tuple includes `/home/cs/.env`).
"""

import hashlib
import logging
from pathlib import Path
from typing import Optional

import httpx

from backend.config import settings

log = logging.getLogger(__name__)

API_BASE = "https://api.elevenlabs.io/v1"
DEFAULT_TIMEOUT = 60.0


def is_available() -> bool:
    """ElevenLabs is usable if we have an API key."""
    return bool(settings.elevenlabs_api_key)


def _headers() -> dict:
    return {
        "xi-api-key": settings.elevenlabs_api_key,
        "Accept": "application/json",
    }


def list_voices() -> list[dict]:
    """Return the user's available voices on their ElevenLabs account.

    Includes ElevenLabs' library voices plus any voices the user has
    cloned through MM. Each entry: {key, id, name, gender, desc}.
    """
    if not is_available():
        return []

    try:
        r = httpx.get(f"{API_BASE}/voices", headers=_headers(), timeout=DEFAULT_TIMEOUT)
        r.raise_for_status()
        voices = r.json().get("voices", [])
    except httpx.HTTPError as e:
        log.warning(f"ElevenLabs list_voices failed: {e}")
        return []

    catalog = []
    for v in voices:
        labels = v.get("labels") or {}
        catalog.append({
            "key": v["voice_id"],          # we use voice_id as the key
            "id": v["voice_id"],
            "name": v.get("name") or "Unnamed",
            "gender": labels.get("gender") or "unknown",
            "desc": labels.get("description") or v.get("category") or "",
            "category": v.get("category"),  # "premade" | "cloned" | "professional"
        })
    return catalog


def synthesize(
    text: str,
    voice_id: Optional[str] = None,
    quality: str = "draft",
) -> str:
    """Generate vocals from text using ElevenLabs TTS.

    Returns path to the generated WAV file. Caches by (text, voice_id, model)
    so the same lyric on the same voice doesn't burn fresh credits.
    """
    if not is_available():
        raise RuntimeError("ElevenLabs API key not configured")

    voice_id = voice_id or settings.elevenlabs_default_voice_id

    # Draft: cheap turbo model. Render: full-quality multilingual.
    if quality == "render":
        model_id = settings.elevenlabs_model_id  # eleven_multilingual_v2
    else:
        model_id = "eleven_turbo_v2_5"

    # Content-addressed cache key
    digest = hashlib.md5(f"{text}|{voice_id}|{model_id}".encode()).hexdigest()[:12]
    out_path = settings.vocals_dir / f"elevenlabs_{digest}.wav"
    if out_path.exists():
        log.info(f"ElevenLabs TTS cache hit: {out_path.name}")
        return str(out_path)

    # Request PCM 22050 mono so it drops cleanly into the existing mix pipeline.
    url = f"{API_BASE}/text-to-speech/{voice_id}"
    params = {"output_format": "pcm_22050"}
    headers = {**_headers(), "Content-Type": "application/json", "Accept": "audio/wav"}
    body = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }

    log.info(f"ElevenLabs TTS: voice={voice_id} model={model_id} chars={len(text)}")
    with httpx.stream(
        "POST", url, headers=headers, params=params, json=body, timeout=DEFAULT_TIMEOUT
    ) as r:
        if r.status_code != 200:
            r.read()
            raise RuntimeError(
                f"ElevenLabs TTS failed: {r.status_code} {r.text[:200]}"
            )
        # ElevenLabs returns raw PCM samples — wrap in a WAV header via soundfile.
        import io
        import soundfile as sf
        import numpy as np

        raw = b"".join(chunk for chunk in r.iter_bytes())
        # PCM 22050: 16-bit signed little-endian mono
        samples = np.frombuffer(raw, dtype=np.int16)
        sf.write(str(out_path), samples, 22050, subtype="PCM_16")

    log.info(f"ElevenLabs TTS: wrote {out_path.name} ({out_path.stat().st_size} bytes)")
    return str(out_path)


def clone_voice(audio_path: str, name: str = "MM-cloned") -> str:
    """Upload a reference clip to ElevenLabs Instant Voice Cloning.

    Returns the new voice_id, which can be passed to synthesize() going
    forward. Creator tier requires a single reference clip ≥1 min for best
    results, but ElevenLabs accepts shorter clips.
    """
    if not is_available():
        raise RuntimeError("ElevenLabs API key not configured")

    src = Path(audio_path)
    if not src.exists():
        raise FileNotFoundError(f"Voice reference not found: {audio_path}")

    url = f"{API_BASE}/voices/add"
    with open(src, "rb") as f:
        files = {"files": (src.name, f, "audio/wav")}
        data = {
            "name": name,
            "description": "Cloned via MM from user-recorded reference",
        }
        r = httpx.post(url, headers=_headers(), data=data, files=files, timeout=120.0)

    if r.status_code != 200:
        raise RuntimeError(f"ElevenLabs IVC failed: {r.status_code} {r.text[:200]}")

    voice_id = r.json().get("voice_id")
    if not voice_id:
        raise RuntimeError(f"ElevenLabs IVC returned no voice_id: {r.text[:200]}")
    log.info(f"ElevenLabs IVC: cloned voice_id={voice_id}")
    return voice_id


def design_voice(
    description: str,
    sample_text: str = (
        "Yo, this is the sound of the studio. Late night in the booth, "
        "lights low, the beat hits and the mic is hot. I run these streets "
        "and I run this song, every bar locked in, every line earned."
    ),
    loudness: float = 0.5,
    quality: float = 0.9,
    seed: int | None = None,
) -> dict:
    """Generate three preview voices from a natural-language description.

    ElevenLabs Voice Design (`/v1/text-to-voice/create-previews`) — Creator+
    feature. Returns a list of previews, each with `generated_voice_id` and a
    short audio sample (base64) so the caller can audition them and pick one
    to materialise via `commit_designed_voice()`.
    """
    if not is_available():
        raise RuntimeError("ElevenLabs API key not configured")

    url = f"{API_BASE}/text-to-voice/create-previews"
    headers = {**_headers(), "Content-Type": "application/json"}
    body = {
        "voice_description": description,
        "text": sample_text,
        "loudness": loudness,
        "quality": quality,
    }
    if seed is not None:
        body["seed"] = seed

    r = httpx.post(url, headers=headers, json=body, timeout=DEFAULT_TIMEOUT)
    if r.status_code != 200:
        raise RuntimeError(f"ElevenLabs voice design failed: {r.status_code} {r.text[:200]}")
    return r.json()  # { previews: [{generated_voice_id, audio_base_64, ...}], text }


def commit_designed_voice(
    generated_voice_id: str,
    voice_name: str,
    voice_description: str,
) -> str:
    """Save a voice-design preview to the user's voice library, returns voice_id."""
    if not is_available():
        raise RuntimeError("ElevenLabs API key not configured")

    url = f"{API_BASE}/text-to-voice/create-voice-from-preview"
    headers = {**_headers(), "Content-Type": "application/json"}
    body = {
        "voice_name": voice_name,
        "voice_description": voice_description,
        "generated_voice_id": generated_voice_id,
    }
    r = httpx.post(url, headers=headers, json=body, timeout=DEFAULT_TIMEOUT)
    if r.status_code != 200:
        raise RuntimeError(f"ElevenLabs voice commit failed: {r.status_code} {r.text[:200]}")
    return r.json().get("voice_id")


def speech_to_speech(
    source_audio_path: str,
    target_voice_id: str,
    quality: str = "draft",
) -> str:
    """Convert a recorded vocal performance into a different voice.

    Speech-to-Speech (`/v1/speech-to-speech/{voice_id}`) — keeps the rhythm,
    cadence, and emotion of the source but renders it in `target_voice_id`'s
    timbre. Much higher fidelity than text-driven TTS for delivering
    expressive vocals: record a rough take in your own voice, then convert
    to a studio voice.
    """
    if not is_available():
        raise RuntimeError("ElevenLabs API key not configured")

    src = Path(source_audio_path)
    if not src.exists():
        raise FileNotFoundError(f"Source audio not found: {source_audio_path}")

    model_id = "eleven_english_sts_v2" if quality == "render" else "eleven_multilingual_sts_v2"

    digest = hashlib.md5(f"sts|{src.read_bytes()[:1024]}|{target_voice_id}|{model_id}".encode()).hexdigest()[:12]
    out_path = settings.vocals_dir / f"sts_{digest}.wav"
    if out_path.exists():
        log.info(f"STS cache hit: {out_path.name}")
        return str(out_path)

    url = f"{API_BASE}/speech-to-speech/{target_voice_id}"
    params = {"output_format": "pcm_22050"}
    headers = {**_headers(), "Accept": "audio/wav"}
    with open(src, "rb") as f:
        files = {"audio": (src.name, f, "audio/wav")}
        data = {
            "model_id": model_id,
            "voice_settings": '{"stability":0.5,"similarity_boost":0.85,"style":0.0,"use_speaker_boost":true}',
        }
        log.info(f"ElevenLabs STS: source={src.name} → voice={target_voice_id}")
        r = httpx.post(url, headers=headers, params=params, data=data, files=files, timeout=120.0)

    if r.status_code != 200:
        raise RuntimeError(f"ElevenLabs STS failed: {r.status_code} {r.text[:200]}")

    import io
    import soundfile as sf
    import numpy as np
    samples = np.frombuffer(r.content, dtype=np.int16)
    sf.write(str(out_path), samples, 22050, subtype="PCM_16")
    log.info(f"ElevenLabs STS: wrote {out_path.name} ({out_path.stat().st_size} bytes)")
    return str(out_path)


def get_quota() -> dict:
    """Return current subscription credit usage."""
    if not is_available():
        return {"available": False}
    try:
        r = httpx.get(f"{API_BASE}/user/subscription", headers=_headers(), timeout=10.0)
        r.raise_for_status()
        data = r.json()
        return {
            "available": True,
            "tier": data.get("tier"),
            "character_count": data.get("character_count"),
            "character_limit": data.get("character_limit"),
            "credits_remaining": (
                data.get("character_limit", 0) - data.get("character_count", 0)
            ),
        }
    except httpx.HTTPError as e:
        log.warning(f"ElevenLabs quota check failed: {e}")
        return {"available": False, "error": str(e)}
