"""Local LLM Service — all intelligence runs through Ollama. Zero API calls.

Wraps Ollama for structured prompt parsing, lyric generation, and planning.
Falls back to rule-based logic if Ollama isn't running (dev convenience).
"""
import json
import logging

import ollama as ollama_client

from backend.config import settings

log = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = ollama_client.Client(host=settings.ollama_url)
    return _client


def generate(
    prompt: str,
    system: str = "",
    json_mode: bool = False,
    quality: str | None = None,
) -> str:
    """Send a prompt to the local Ollama instance.

    Args:
        prompt: User prompt text.
        system: System prompt for context/instructions.
        json_mode: If True, forces JSON output.
        quality: "draft" uses the default model, "render" uses the quality model.

    Returns:
        Model response as string (or JSON string if json_mode).
    """
    model = settings.ollama_model
    if quality == "render":
        model = settings.ollama_model_quality

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    try:
        kwargs = {"model": model, "messages": messages}
        if json_mode:
            kwargs["format"] = "json"

        response = _get_client().chat(**kwargs)
        return response["message"]["content"]

    except Exception as e:
        log.warning(f"Ollama unavailable ({e}). Using fallback.")
        return ""


def generate_json(prompt: str, system: str = "", quality: str | None = None) -> dict:
    """Generate structured JSON from Ollama. Returns empty dict on failure."""
    raw = generate(prompt, system=system, json_mode=True, quality=quality)
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        log.warning(f"Failed to parse LLM JSON: {raw[:200]}")
        return {}


def is_available() -> bool:
    """Check if Ollama is running and has our model."""
    try:
        response = _get_client().list()
        model_list = getattr(response, "models", [])
        target = settings.ollama_model.split(":")[0]
        return any(target in getattr(m, "model", "") for m in model_list)
    except Exception:
        return False
