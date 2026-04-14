from pydantic import BaseModel


class ProjectCreate(BaseModel):
    title: str
    description: str | None = None
    user_id: str


class ProjectResponse(BaseModel):
    id: str
    title: str
    description: str | None
    user_id: str

    model_config = {"from_attributes": True}
