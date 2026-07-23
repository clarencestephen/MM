from pydantic import BaseModel


class PersonaCreate(BaseModel):
    name: str
    description: str | None = None
    style_mode: str = "rap"
    user_id: str
    voice_engine: str | None = "xtts"
    elevenlabs_voice_id: str | None = None
    voice_sample_path: str | None = None


class PersonaResponse(BaseModel):
    id: str
    name: str
    description: str | None
    voice_sample_path: str | None
    style_mode: str | None
    user_id: str
    voice_engine: str | None
    elevenlabs_voice_id: str | None

    model_config = {"from_attributes": True}
