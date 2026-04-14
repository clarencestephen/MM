"""Prompt Understanding Service — LLM-powered prompt parsing via local Ollama.

Extracts genre, mood, tempo, arrangement, vocal mode from natural language.
Falls back to keyword matching if Ollama isn't available.
"""
import logging

from backend.services import llm_service

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the prompt parser for a Hip Hop / Rap / R&B music production platform.

Given a user's natural language prompt, extract structured musical intent as JSON.

Output EXACTLY this JSON structure:
{
  "genre": "hip_hop" | "melodic_rap" | "rnb" | "lofi",
  "mood": "dark" | "hype" | "emotional" | "chill" | "victorious" | "sensual" | "nocturnal",
  "bpm": <integer 60-180>,
  "key": "<musical key like Cm, Gmaj, etc>",
  "vocal_mode": "rap" | "melodic" | "sung" | "spoken",
  "energy": "low" | "medium" | "high",
  "arrangement_hints": "<sparse|dense|cinematic|minimal|hard-hitting>",
  "confidence": <float 0-1 how confident you are in the extraction>
}

Rules:
- Default genre to "hip_hop" if unclear
- Default BPM: hip_hop=90, melodic_rap=130, rnb=75, lofi=85
- Adjust BPM for mood: hype=+40, dark=-5, chill=-10
- Never reference specific artist names in output
- If the prompt is vague, use sensible defaults and set confidence low"""


# Fallback keyword matching (used when Ollama is unavailable)
GENRE_KEYWORDS = {
    "hip_hop": ["hip hop", "hiphop", "rap", "trap", "boom bap", "drill"],
    "melodic_rap": ["melodic", "melodic rap", "singing rap", "autotune"],
    "rnb": ["r&b", "rnb", "r and b", "soul", "neo soul"],
    "lofi": ["lo-fi", "lofi", "chill", "study", "ambient", "chillhop"],
}

MOOD_KEYWORDS = {
    "dark": ["dark", "aggressive", "menacing", "sinister"],
    "hype": ["hype", "energy", "turnt", "lit", "club"],
    "emotional": ["emotional", "sad", "pain", "heartbreak", "deep"],
    "chill": ["chill", "relaxed", "smooth", "laid back", "mellow"],
    "victorious": ["victory", "winning", "flex", "braggadocious", "triumph"],
}


def parse_prompt(prompt: str, quality: str = "draft") -> dict:
    """Parse a natural language prompt into structured musical intent.

    Tries Ollama first. Falls back to keyword matching.
    """
    # Try LLM-powered parsing
    result = llm_service.generate_json(
        prompt=f"Parse this music prompt:\n\n{prompt}",
        system=SYSTEM_PROMPT,
        quality=quality,
    )

    if result and "genre" in result:
        log.info(f"LLM prompt parse: genre={result['genre']}, mood={result.get('mood')}")
        return {
            "genre": result.get("genre", "hip_hop"),
            "mood": result.get("mood", "chill"),
            "bpm": result.get("bpm", 90),
            "key": result.get("key", "Cm"),
            "vocal_mode": result.get("vocal_mode", "rap"),
            "energy": result.get("energy", "medium"),
            "confidence": result.get("confidence", 0.8),
            "raw_prompt": prompt,
        }

    # Fallback: keyword matching
    log.info("Using keyword fallback for prompt parsing")
    return _keyword_parse(prompt)


def _keyword_parse(prompt: str) -> dict:
    """Fallback keyword-based prompt parsing."""
    prompt_lower = prompt.lower()

    genre = "hip_hop"
    for g, keywords in GENRE_KEYWORDS.items():
        if any(k in prompt_lower for k in keywords):
            genre = g
            break

    mood = "chill"
    for m, keywords in MOOD_KEYWORDS.items():
        if any(k in prompt_lower for k in keywords):
            mood = m
            break

    bpm = {"hip_hop": 90, "melodic_rap": 130, "rnb": 75, "lofi": 85}.get(genre, 90)
    if mood == "hype":
        bpm += 40

    return {
        "genre": genre,
        "mood": mood,
        "bpm": bpm,
        "key": "Cm",
        "vocal_mode": "rap" if genre in ("hip_hop", "melodic_rap") else "melodic",
        "energy": "medium",
        "confidence": 0.5,
        "raw_prompt": prompt,
    }
