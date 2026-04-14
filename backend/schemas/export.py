from pydantic import BaseModel


class ExportRequest(BaseModel):
    song_id: str
    format: str = "wav"  # wav, mp3, stems_zip


class ExportResponse(BaseModel):
    job_id: str
    song_id: str
    format: str
    status: str
    download_path: str | None = None
