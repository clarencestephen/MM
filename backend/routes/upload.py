import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models.song import Song
from backend.schemas.upload import UploadResponse

router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a"}


@router.post("/beat", response_model=UploadResponse)
async def upload_beat(
    song_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a beat/instrumental for a song."""
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format: {ext}")

    filename = f"beat_{uuid.uuid4().hex[:12]}{ext}"
    dest = settings.beats_dir / filename

    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    song.beat_path = str(dest)
    db.commit()

    return UploadResponse(
        file_id=filename,
        file_path=str(dest),
        file_type="beat",
        song_id=song_id,
    )


@router.post("/source", response_model=UploadResponse)
async def upload_source(
    song_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a source track for separation/transformation."""
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format: {ext}")

    filename = f"source_{uuid.uuid4().hex[:12]}{ext}"
    dest = settings.beats_dir / filename

    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    song.beat_path = str(dest)
    db.commit()

    return UploadResponse(
        file_id=filename,
        file_path=str(dest),
        file_type="source",
        song_id=song_id,
    )


@router.post("/vocal", response_model=UploadResponse)
async def upload_vocal(
    song_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a voice sample (for persona creation or direct use)."""
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format: {ext}")

    filename = f"vocal_{uuid.uuid4().hex[:12]}{ext}"
    dest = settings.vocals_dir / filename

    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    return UploadResponse(
        file_id=filename,
        file_path=str(dest),
        file_type="vocal",
        song_id=song_id,
    )


@router.post("/voice-clip")
async def upload_voice_clip(
    file: UploadFile = File(...),
):
    """Upload a voice recording for voice cloning (10-30s clip).

    Returns the file path to pass as voice_clip_path in /generate/.
    No song_id required — this is a quick clip for immediate use.
    """
    ext = Path(file.filename).suffix.lower() if file.filename else ".wav"
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format: {ext}")

    filename = f"voiceclip_{uuid.uuid4().hex[:12]}{ext}"
    dest = settings.personas_dir / filename

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > 20:
        raise HTTPException(400, "Voice clip too large (max 20MB)")

    with open(dest, "wb") as f:
        f.write(content)

    return {
        "voice_clip_path": str(dest),
        "filename": filename,
        "size_mb": round(size_mb, 2),
    }
