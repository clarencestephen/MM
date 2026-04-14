from pydantic import BaseModel


# --- Studio Session ---

class StudioSessionCreate(BaseModel):
    title: str = "Untitled Session"
    bpm: int = 120
    key: str = "C"
    scale: str = "major"
    time_signature: str = "4/4"
    genre: str | None = "hip_hop"
    project_id: str


class StudioSessionUpdate(BaseModel):
    title: str | None = None
    bpm: int | None = None
    key: str | None = None
    scale: str | None = None
    time_signature: str | None = None
    genre: str | None = None


class StudioTrackResponse(BaseModel):
    id: str
    name: str
    order_index: int
    track_type: str
    instrument_label: str | None
    raw_audio_path: str | None
    processed_audio_path: str | None
    duration_seconds: float | None
    volume: float
    pan: float
    muted: bool
    solo: bool
    color: str
    pitch_shift_semitones: int
    tempo_stretch_ratio: float
    detected_key: str | None
    detected_bpm: float | None
    session_id: str

    model_config = {"from_attributes": True}


class ArrangementSectionResponse(BaseModel):
    id: str
    label: str
    order_index: int
    start_bar: int
    length_bars: int
    color: str
    session_id: str

    model_config = {"from_attributes": True}


class StudioSessionResponse(BaseModel):
    id: str
    title: str
    bpm: int
    key: str
    scale: str
    time_signature: str
    status: str
    genre: str | None
    master_mix_path: str | None
    project_id: str
    song_id: str | None
    tracks: list[StudioTrackResponse] = []
    arrangement_sections: list[ArrangementSectionResponse] = []

    model_config = {"from_attributes": True}


class StudioSessionListResponse(BaseModel):
    id: str
    title: str
    bpm: int
    key: str
    status: str
    genre: str | None
    project_id: str
    track_count: int = 0

    model_config = {"from_attributes": True}


# --- Studio Track ---

class StudioTrackCreate(BaseModel):
    name: str = "New Track"
    track_type: str = "recording"
    instrument_label: str | None = None
    color: str = "#8b5cf6"


class StudioTrackUpdate(BaseModel):
    name: str | None = None
    instrument_label: str | None = None
    volume: float | None = None
    pan: float | None = None
    muted: bool | None = None
    solo: bool | None = None
    color: str | None = None


class TrackReorder(BaseModel):
    track_ids: list[str]


# --- Arrangement Section ---

class ArrangementSectionCreate(BaseModel):
    label: str
    start_bar: int = 0
    length_bars: int = 8
    color: str = "#6366f1"


class ArrangementSectionUpdate(BaseModel):
    label: str | None = None
    start_bar: int | None = None
    length_bars: int | None = None
    color: str | None = None


# --- Subscription ---

class SubscriptionResponse(BaseModel):
    tier: str
    status: str
    current_period_end: str | None = None

    model_config = {"from_attributes": True}
