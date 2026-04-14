from pydantic import BaseModel


class UploadResponse(BaseModel):
    file_id: str
    file_path: str
    file_type: str  # beat, vocal, source
    song_id: str
