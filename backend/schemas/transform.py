from pydantic import BaseModel


class TransformRequest(BaseModel):
    song_id: str
    mode: str  # separate, remove_vocals, parody
    quality: str = "draft"
    new_lyrics: str | None = None  # for parody mode
    full_stems: bool = False  # if True, 4-stem split instead of 2-stem


class TransformResponse(BaseModel):
    job_id: str
    song_id: str
    mode: str
    status: str
    stems: dict[str, str] | None = None  # stem_type -> file path
    alignment: list[dict] | None = None  # word timestamps


class AlignmentRequest(BaseModel):
    song_id: str
    lyrics: str | None = None  # if provided, align these; otherwise transcribe


class AlignmentResponse(BaseModel):
    song_id: str
    mode: str  # "transcribed" or "aligned"
    text: str | None = None
    words: list[dict]  # [{word, start, end}, ...]
