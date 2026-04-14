"""Azure Cognitive Services Text-to-Speech for vocal generation.

This is an OPTIONAL cloud voice engine. Local XTTS v2 remains the default.
Requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.
"""

import hashlib
import logging
from pathlib import Path

from backend.config import settings

log = logging.getLogger(__name__)

try:
    import azure.cognitiveservices.speech as speechsdk

    _AZURE_SDK_AVAILABLE = True
except ImportError:
    _AZURE_SDK_AVAILABLE = False
    log.info("Azure Speech SDK not installed — Azure TTS disabled")


# ─── Curated voice catalog (hip-hop / rap friendly) ─────────────────────────

AZURE_VOICES = {
    # Male voices
    "davis": {
        "id": "en-US-DavisNeural",
        "name": "Davis",
        "gender": "male",
        "desc": "Deep, authoritative",
    },
    "guy": {
        "id": "en-US-GuyNeural",
        "name": "Guy",
        "gender": "male",
        "desc": "Natural, smooth",
    },
    "jason": {
        "id": "en-US-JasonNeural",
        "name": "Jason",
        "gender": "male",
        "desc": "Young, energetic",
    },
    "tony": {
        "id": "en-US-TonyNeural",
        "name": "Tony",
        "gender": "male",
        "desc": "Casual, conversational",
    },
    "brandon": {
        "id": "en-US-BrandonNeural",
        "name": "Brandon",
        "gender": "male",
        "desc": "Warm, expressive",
    },
    # Female voices
    "jenny": {
        "id": "en-US-JennyNeural",
        "name": "Jenny",
        "gender": "female",
        "desc": "Warm, clear",
    },
    "aria": {
        "id": "en-US-AriaNeural",
        "name": "Aria",
        "gender": "female",
        "desc": "Expressive, versatile",
    },
    "sara": {
        "id": "en-US-SaraNeural",
        "name": "Sara",
        "gender": "female",
        "desc": "Friendly, bright",
    },
}


def is_available() -> bool:
    """Check if Azure TTS is configured and ready."""
    return _AZURE_SDK_AVAILABLE and bool(settings.azure_speech_key)


def list_voices() -> list[dict]:
    """Return the curated voice catalog."""
    return [{"key": k, **v} for k, v in AZURE_VOICES.items()]


def synthesize(
    text: str,
    voice_key: str = "davis",
    quality: str = "draft",
) -> str:
    """Generate speech from text using Azure Neural TTS.

    Returns path to the generated WAV file.
    """
    if not is_available():
        raise RuntimeError("Azure Speech SDK not available or not configured")

    voice_info = AZURE_VOICES.get(voice_key)
    if not voice_info:
        raise ValueError(f"Unknown Azure voice: {voice_key}. Available: {list(AZURE_VOICES.keys())}")

    # Configure Azure Speech
    speech_config = speechsdk.SpeechConfig(
        subscription=settings.azure_speech_key,
        region=settings.azure_speech_region,
    )

    # Use higher quality for render mode
    if quality == "render":
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
        )
    else:
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm
        )

    speech_config.speech_synthesis_voice_name = voice_info["id"]

    # Generate unique output path
    content_hash = hashlib.md5(f"{text}{voice_key}{quality}".encode()).hexdigest()[:12]
    output_path = str(settings.vocals_dir / f"azure_{content_hash}.wav")

    # Check cache
    if Path(output_path).exists():
        log.info(f"Azure TTS cache hit: {output_path}")
        return output_path

    # Synthesize
    audio_config = speechsdk.audio.AudioOutputConfig(filename=output_path)
    synthesizer = speechsdk.SpeechSynthesizer(
        speech_config=speech_config,
        audio_config=audio_config,
    )

    log.info(f"Azure TTS: synthesizing with voice={voice_info['id']} quality={quality}")
    result = synthesizer.speak_text_async(text).get()

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        log.info(f"Azure TTS: generated {output_path}")
        return output_path

    cancellation = result.cancellation_details
    error_msg = f"Azure TTS failed: {cancellation.reason}"
    if cancellation.error_details:
        error_msg += f" — {cancellation.error_details}"
    raise RuntimeError(error_msg)
