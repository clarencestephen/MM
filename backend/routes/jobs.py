from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.job import RenderJob, ExportJob
from backend.schemas.job import JobStatusResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/render/{job_id}", response_model=JobStatusResponse)
def get_render_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(RenderJob).filter(RenderJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Render job not found")
    return JobStatusResponse(
        id=job.id,
        job_type=job.job_type,
        status=job.status,
        result_path=job.result_path,
        error=job.error,
        created_at=job.created_at,
    )


@router.get("/export/{job_id}", response_model=JobStatusResponse)
def get_export_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(ExportJob).filter(ExportJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Export job not found")
    return JobStatusResponse(
        id=job.id,
        job_type=f"export_{job.format}",
        status=job.status,
        result_path=job.result_path,
        error=job.error,
        created_at=job.created_at,
    )
