"""Song Planning Service — LLM-enhanced structure, BPM, energy curves.

Uses Ollama for smart planning decisions. Falls back to rule-based defaults.
"""
import logging

from backend.services import llm_service

log = logging.getLogger(__name__)

PLANNING_SYSTEM = """You are a music producer planning the structure of a Hip Hop / Rap / R&B song.

Output EXACTLY this JSON structure:
{
  "structure": ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"],
  "bpm": <integer>,
  "key": "<musical key>",
  "time_signature": "4/4",
  "sections": [
    {"label": "intro", "bars": 4, "energy": "low", "description": "sparse atmospheric pad"},
    {"label": "verse", "bars": 16, "energy": "medium", "description": "full beat, rap delivery"},
    ...
  ],
  "total_bars": <integer>,
  "estimated_duration_seconds": <integer>
}

Rules:
- Hip hop standard: 4/4 time
- Intro: 2-8 bars
- Verse: 8-16 bars
- Hook: 4-8 bars, catchy
- Bridge: 4-8 bars (optional)
- Outro: 2-8 bars
- Energy should build and release naturally
- Estimate duration: (total_bars / bpm) * 240"""


def plan_song_structure(
    genre: str = "hip_hop",
    mood: str = "chill",
    prompt: str = "",
    quality: str = "draft",
) -> dict:
    """Generate a song plan — LLM-enhanced when available."""
    if prompt:
        user_prompt = f"Plan a {genre.replace('_', ' ')} song structure.\nMood: {mood}\nConcept: {prompt}"
    else:
        user_prompt = f"Plan a {genre.replace('_', ' ')} song structure with a {mood} mood."

    result = llm_service.generate_json(user_prompt, system=PLANNING_SYSTEM, quality=quality)

    if result and "structure" in result:
        log.info(f"LLM song plan: {len(result.get('sections', []))} sections, {result.get('bpm')} BPM")
        return result

    # Fallback: rule-based planning
    return _rule_based_plan(genre, mood)


def _rule_based_plan(genre: str, mood: str) -> dict:
    """Fallback rule-based song structure planning."""
    structure = ["intro", "verse", "hook", "verse", "hook", "outro"]

    bpm_map = {
        "hip_hop": {"dark": 85, "hype": 140, "chill": 90, "emotional": 80, "victorious": 100},
        "melodic_rap": {"dark": 120, "hype": 135, "chill": 125, "emotional": 115, "victorious": 130},
        "rnb": {"dark": 70, "hype": 80, "chill": 75, "emotional": 65, "victorious": 80},
        "lofi": {"dark": 80, "hype": 90, "chill": 85, "emotional": 75, "victorious": 85},
    }
    bpm = bpm_map.get(genre, bpm_map["hip_hop"]).get(mood, 90)

    bar_map = {"intro": 4, "verse": 16, "hook": 8, "bridge": 8, "outro": 4}
    energy_map = {"intro": "low", "verse": "medium", "hook": "high", "bridge": "medium", "outro": "low"}

    sections = [
        {
            "label": s,
            "bars": bar_map.get(s, 8),
            "energy": energy_map.get(s, "medium"),
            "description": "",
        }
        for s in structure
    ]

    total_bars = sum(s["bars"] for s in sections)

    return {
        "structure": structure,
        "bpm": bpm,
        "key": "Cm",
        "time_signature": "4/4",
        "sections": [{"order_index": i, **s} for i, s in enumerate(sections)],
        "total_bars": total_bars,
        "estimated_duration_seconds": int((total_bars / bpm) * 240),
    }
