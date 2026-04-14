from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.song import Song
from backend.models.job import ExportJob
from backend.schemas.export import ExportRequest, ExportResponse
from backend.services.export_service import export_wav, export_mp3

router = APIRouter(prefix="/export", tags=["export"])


@router.post("/", response_model=ExportResponse)
def export_song(data: ExportRequest, db: Session = Depends(get_db)):
    """Export a song as WAV or MP3."""
    song = db.query(Song).filter(Song.id == data.song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    if not song.mix_path:
        raise HTTPException(400, "Song has no mix yet. Generate first.")

    job = ExportJob(
        format=data.format,
        status="running",
        song_id=song.id,
    )
    db.add(job)
    db.flush()

    try:
        if data.format == "mp3":
            result_path = export_mp3(song.mix_path)
        else:
            result_path = export_wav(song.mix_path)

        job.status = "done"
        job.result_path = result_path

    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        db.commit()
        raise HTTPException(500, f"Export failed: {e}")

    db.commit()

    return ExportResponse(
        job_id=job.id,
        song_id=song.id,
        format=data.format,
        status="done",
        download_path=result_path,
    )


@router.get("/download/{job_id}")
def download_export(job_id: str, db: Session = Depends(get_db)):
    """Download an exported file."""
    job = db.query(ExportJob).filter(ExportJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Export job not found")
    if job.status != "done" or not job.result_path:
        raise HTTPException(400, "Export not ready")

    return FileResponse(
        job.result_path,
        media_type="audio/wav" if job.format == "wav" else "audio/mpeg",
        filename=f"mm_export.{job.format}",
    )
