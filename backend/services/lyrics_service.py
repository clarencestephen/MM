"""Lyrics Service — LLM-powered lyric generation, editing, and parody rewriting.

All generation runs through local Ollama. Zero API calls.
Section parsing is rule-based (no LLM needed for that).
"""
import logging

from backend.services import llm_service

log = logging.getLogger(__name__)

LYRICS_SYSTEM = """You are a professional Hip Hop / Rap / R&B songwriter.

Rules:
- Write lyrics ONLY. No explanations, no commentary, no markdown.
- Use section labels: [Verse], [Hook], [Bridge], [Intro], [Outro]
- Match the requested mood, genre, and energy
- For rap: prioritize cadence, rhyme density, and flow over perfect grammar
- For R&B/melodic: prioritize melody-friendly phrasing and emotional resonance
- Keep verses to 8-16 bars
- Keep hooks to 4-8 bars, catchy and repeatable
- Include ad-lib suggestions in parentheses where natural: (yeah), (uh), (let's go)
- Never use slurs or hate speech
- Profanity is acceptable when contextually appropriate"""

PARODY_SYSTEM = """You are a comedy songwriter specializing in parody rewrites.

Rules:
- Preserve the EXACT cadence, syllable count, and rhythmic pattern of the original
- Change the meaning/topic to the new theme
- Keep the same rhyme scheme
- Match the syllable count per line as closely as possible
- Make it funny but clever, not crude
- Output lyrics ONLY. No explanations."""


def generate_lyrics(
    prompt: str,
    genre: str = "hip_hop",
    mood: str = "chill",
    quality: str = "draft",
) -> str:
    """Generate full song lyrics from a prompt using local LLM."""
    user_prompt = f"""Write a complete {genre.replace('_', ' ')} song with a {mood} mood.

Theme/concept: {prompt}

Include: [Intro], [Verse 1], [Hook], [Verse 2], [Hook], [Outro]"""

    result = llm_service.generate(user_prompt, system=LYRICS_SYSTEM, quality=quality)

    if result:
        return result.strip()

    # Fallback placeholder
    return _placeholder_lyrics(genre, mood)


def rewrite_parody(
    original_lyrics: str,
    new_theme: str,
    quality: str = "draft",
) -> str:
    """Rewrite lyrics as a parody — preserving cadence, changing meaning."""
    user_prompt = f"""Original lyrics:
{original_lyrics}

Rewrite these lyrics as a parody about: {new_theme}

CRITICAL: Keep the EXACT same cadence, syllable count, and rhyme pattern.
Only change the words/meaning. The new lyrics must fit the same beat."""

    result = llm_service.generate(user_prompt, system=PARODY_SYSTEM, quality=quality)

    if result:
        return result.strip()

    return original_lyrics  # Fallback: return original


def rewrite_section(
    section_lyrics: str,
    instruction: str,
    quality: str = "draft",
) -> str:
    """Rewrite a single section with a specific instruction."""
    user_prompt = f"""Current lyrics:
{section_lyrics}

Instruction: {instruction}

Rewrite the lyrics following the instruction. Keep the same structure and cadence."""

    result = llm_service.generate(user_prompt, system=LYRICS_SYSTEM, quality=quality)
    return result.strip() if result else section_lyrics


def parse_lyrics_into_sections(lyrics: str) -> list[dict]:
    """Split lyrics text into labeled sections. Rule-based — no LLM needed."""
    sections = []
    current_label = "verse"
    current_lines = []
    order = 0

    section_markers = {
        "verse": ["verse", "verse 1", "verse 2", "verse 3", "v1", "v2", "v3"],
        "hook": ["hook", "chorus", "hook 1", "chorus 1"],
        "bridge": ["bridge"],
        "intro": ["intro"],
        "outro": ["outro"],
    }

    for line in lyrics.strip().split("\n"):
        stripped = line.strip()
        if not stripped:
            if current_lines:
                sections.append({
                    "label": current_label,
                    "order_index": order,
                    "lyrics": "\n".join(current_lines),
                })
                order += 1
                current_lines = []
            continue

        lower = stripped.lower().strip("[]() ")
        matched = False
        for label, markers in section_markers.items():
            if lower in markers:
                if current_lines:
                    sections.append({
                        "label": current_label,
                        "order_index": order,
                        "lyrics": "\n".join(current_lines),
                    })
                    order += 1
                    current_lines = []
                current_label = label
                matched = True
                break

        if not matched:
            current_lines.append(stripped)

    if current_lines:
        sections.append({
            "label": current_label,
            "order_index": order,
            "lyrics": "\n".join(current_lines),
        })

    return sections


def _placeholder_lyrics(genre: str, mood: str) -> str:
    """Fallback lyrics when Ollama isn't available."""
    return f"""[Verse]
This is a placeholder verse for {genre.replace('_', ' ')}
Ollama isn't running so these lyrics are generic
Install it and pull qwen2.5:14b for the real thing
Then watch this platform start delivering

[Hook]
MM Music Maker, making hits all day
Local AI, no API, that's the way we play
Every beat, every bar, every single line
All running on your GPU, and it works just fine

[Outro]
Set up Ollama, pull the model, let it ride
This is just the beginning of the creative ride"""
