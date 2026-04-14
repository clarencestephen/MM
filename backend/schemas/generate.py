from pydantic import BaseModel


class GenerateRequest(BaseModel):
    song_id: str
    prompt: str | None = None
    lyrics: str | None = None
    persona_id: str | None = None
    quality: str = "draft"  # "draft" = fast/rough, "render" = slow/clean
    section: str | None = None  # regenerate only this section (e.g. "hook", "verse_2")
    # Voice engine selection
    voice_engine: str = "xtts"  # "xtts" (local default), "azure" (cloud), "recorded" (uploaded clip)
    azure_voice: str | None = None  # Azure voice key, e.g. "davis", "aria"
    voice_clip_path: str | None = None  # Path to uploaded voice recording for cloning


class GenerateResponse(BaseModel):
    job_id: str
    song_id: str
    status: str
    quality: str = "draft"


class GenerateLyricsRequest(BaseModel):
    prompt: str
    genre: str = "hip_hop"
    mood: str = "chill"
    quality: str = "draft"


class RewriteRequest(BaseModel):
    song_id: str
    original_lyrics: str
    new_theme: str | None = None
    instruction: str | None = None
    section_label: str | None = None  # rewrite only this section
    quality: str = "draft"
