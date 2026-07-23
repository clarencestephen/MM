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
# Browser MediaRecorder defaults to webm/opus — accept and transcode.
RECORDED_EXTENSIONS = {".webm"}
ABLETON_EXTENSIONS = {".als", ".zip"}  # auto-rendered to WAV before use


@router.post("/beat", response_model=UploadResponse)
async def upload_beat(
    song_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a beat/instrumental for a song.

    Accepts audio files directly, or an Ableton Live Set (.als / project .zip)
    which is auto-rendered to WAV before being attached as the beat.
    """
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS and ext not in ABLETON_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format: {ext}")

    filename = f"beat_{uuid.uuid4().hex[:12]}{ext}"
    dest = settings.beats_dir / filename

    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    beat_path = str(dest)

    # Ableton uploads: render to a flat WAV and use that as the beat
    if ext in ABLETON_EXTENSIONS:
        from backend.services.ableton_import_service import (
            render_als_to_wav, AlsRenderError,
        )
        try:
            beat_path = render_als_to_wav(dest)
        except AlsRenderError as e:
            # Keep the upload file around for debugging but don't attach it
            raise HTTPException(400, str(e))

    song.beat_path = beat_path
    db.commit()

    return UploadResponse(
        file_id=filename,
        file_path=beat_path,
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

    Browser recordings come in as .webm/opus; we transcode to WAV here so
    XTTS gets a format it can use directly as a cloning reference.

    Returns the file path to pass as voice_clip_path in /generate/.
    """
    ext = Path(file.filename).suffix.lower() if file.filename else ".wav"
    if ext not in ALLOWED_EXTENSIONS and ext not in RECORDED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format: {ext}")

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > 20:
        raise HTTPException(400, "Voice clip too large (max 20MB)")

    raw_name = f"voiceclip_raw_{uuid.uuid4().hex[:12]}{ext}"
    raw_path = settings.personas_dir / raw_name
    with open(raw_path, "wb") as f:
        f.write(content)

    # Always end up with a clean WAV ready for XTTS to use as a reference.
    if ext == ".wav":
        final_path = raw_path
    else:
        from pydub import AudioSegment
        wav_name = f"voiceclip_{uuid.uuid4().hex[:12]}.wav"
        final_path = settings.personas_dir / wav_name
        try:
            seg = AudioSegment.from_file(str(raw_path))
            # XTTS wants mono, 22050 Hz works fine
            seg = seg.set_channels(1).set_frame_rate(22050)
            seg.export(str(final_path), format="wav")
        except Exception as e:
            raise HTTPException(400, f"Could not transcode voice clip: {e}")
        finally:
            try:
                raw_path.unlink(missing_ok=True)
            except Exception:
                pass

    return {
        "voice_clip_path": str(final_path),
        "filename": final_path.name,
        "size_mb": round(size_mb, 2),
    }
