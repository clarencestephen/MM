from pydantic import BaseModel


class SongCreate(BaseModel):
    title: str = "Untitled"
    prompt: str | None = None
    lyrics: str | None = None
    genre: str = "hip_hop"
    mood: str | None = None
    bpm: int | None = None
    key: str | None = None
    project_id: str


class SongUpdate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    lyrics: str | None = None
    genre: str | None = None
    mood: str | None = None
    bpm: int | None = None
    key: str | None = None
    status: str | None = None
    mix_path: str | None = None
    vocal_path: str | None = None


class SongResponse(BaseModel):
    id: str
    title: str
    prompt: str | None
    lyrics: str | None
    genre: str | None
    mood: str | None
    bpm: int | None
    key: str | None
    status: str
    beat_path: str | None
    vocal_path: str | None
    mix_path: str | None
    project_id: str

    model_config = {"from_attributes": True}
