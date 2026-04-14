from pydantic import BaseModel


class PersonaCreate(BaseModel):
    name: str
    description: str | None = None
    style_mode: str = "rap"
    user_id: str


class PersonaResponse(BaseModel):
    id: str
    name: str
    description: str | None
    voice_sample_path: str | None
    style_mode: str | None
    user_id: str

    model_config = {"from_attributes": True}
