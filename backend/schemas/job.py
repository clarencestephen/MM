from pydantic import BaseModel
from datetime import datetime


class JobStatusResponse(BaseModel):
    id: str
    job_type: str
    status: str
    result_path: str | None
    error: str | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
