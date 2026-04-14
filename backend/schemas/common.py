from pydantic import BaseModel
from datetime import datetime


class StatusResponse(BaseModel):
    status: str
    message: str | None = None


class TimestampSchema(BaseModel):
    created_at: datetime | None = None
    updated_at: datetime | None = None
