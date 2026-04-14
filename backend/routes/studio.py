import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models.studio_session import StudioSession
from backend.models.studio_track import StudioTrack
from backend.models.track_version import TrackVersion
from backend.models.arrangement_section import ArrangementSection
from backend.schemas.studio import (
    StudioSessionCreate, StudioSessionUpdate, StudioSessionResponse, StudioSessionListResponse,
    StudioTrackCreate, StudioTrackUpdate, StudioTrackResponse,
    TrackReorder,
    ArrangementSectionCreate, ArrangementSectionUpdate, ArrangementSectionResponse,
    SubscriptionResponse,
)
from backend.services.tier_service import get_user_tier, get_tier_limits, check_track_limit

log = logging.getLogger(__name__)
router = APIRouter(prefix="/studio", tags=["studio"])

ALLOWED_AUDIO = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".webm"}

# ---------- Sessions ----------

@router.post("/sessions/", response_model=StudioSessionResponse)
def create_session(data: StudioSessionCreate, db: Session = Depends(get_db)):
    session = StudioSession(
        title=data.title,
        bpm=data.bpm,
        key=data.key,
        scale=data.scale,
        time_signature=data.time_signature,
        genre=data.genre,
        project_id=data.project_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    from backend.services.analytics_service import log_event
    log_event(db, "session_create", metadata={"session_id": session.id, "genre": data.genre})
    return session


@router.get("/sessions/", response_model=list[StudioSessionListResponse])
def list_sessions(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(StudioSession)
    if project_id:
        q = q.filter(StudioSession.project_id == project_id)
    sessions = q.order_by(StudioSession.created_at.desc()).all()
    result = []
    for s in sessions:
        resp = StudioSessionListResponse.model_validate(s)
        resp.track_count = len(s.tracks)
        result.append(resp)
    return result


@router.get("/sessions/{session_id}", response_model=StudioSessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Studio session not found")
    return session


@router.patch("/sessions/{session_id}", response_model=StudioSessionResponse)
def update_session(session_id: str, data: StudioSessionUpdate, db: Session = Depends(get_db)):
    session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Studio session not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Studio session not found")
    db.query(ArrangementSection).filter(ArrangementSection.session_id == session_id).delete()
    for track in session.tracks:
        db.query(TrackVersion).filter(TrackVersion.track_id == track.id).delete()
    db.query(StudioTrack).filter(StudioTrack.session_id == session_id).delete()
    db.delete(session)
    db.commit()
    return {"status": "deleted", "id": session_id}


# ---------- Tracks ----------

@router.post("/sessions/{session_id}/tracks", response_model=StudioTrackResponse)
def add_track(
    session_id: str,
    data: StudioTrackCreate,
    user_id: str = "default",
    db: Session = Depends(get_db),
):
    session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Studio session not found")

    # Tier enforcement
    current_count = db.query(StudioTrack).filter(StudioTrack.session_id == session_id).count()
    limit_check = check_track_limit(db, user_id, current_count)
    if not limit_check["allowed"]:
        raise HTTPException(403, limit_check["upgrade_message"])

    track = StudioTrack(
        name=data.name,
        order_index=current_count,
        track_type=data.track_type,
        instrument_label=data.instrument_label,
        color=data.color,
        session_id=session_id,
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return track


@router.get("/sessions/{session_id}/tracks", response_model=list[StudioTrackResponse])
def list_tracks(session_id: str, db: Session = Depends(get_db)):
    return (
        db.query(StudioTrack)
        .filter(StudioTrack.session_id == session_id)
        .order_by(StudioTrack.order_index)
        .all()
    )


@router.patch("/tracks/{track_id}", response_model=StudioTrackResponse)
def update_track(track_id: str, data: StudioTrackUpdate, db: Session = Depends(get_db)):
    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(track, field, value)
    db.commit()
    db.refresh(track)
    return track


@router.delete("/tracks/{track_id}")
def delete_track(track_id: str, db: Session = Depends(get_db)):
    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    session_id = track.session_id
    db.query(TrackVersion).filter(TrackVersion.track_id == track_id).delete()
    db.delete(track)
    db.flush()  # flush deletion before re-querying
    # Re-index remaining tracks
    remaining = (
        db.query(StudioTrack)
        .filter(StudioTrack.session_id == session_id)
        .order_by(StudioTrack.order_index)
        .all()
    )
    for i, t in enumerate(remaining):
        t.order_index = i
    db.commit()
    return {"status": "deleted", "id": track_id}


@router.post("/tracks/{track_id}/reorder")
def reorder_tracks(track_id: str, data: TrackReorder, db: Session = Depends(get_db)):
    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    for i, tid in enumerate(data.track_ids):
        t = db.query(StudioTrack).filter(StudioTrack.id == tid).first()
        if t:
            t.order_index = i
    db.commit()
    return {"status": "reordered"}


@router.post("/tracks/{track_id}/upload", response_model=StudioTrackResponse)
async def upload_track_audio(
    track_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")

    ext = Path(file.filename or "audio.wav").suffix.lower()
    if ext not in ALLOWED_AUDIO:
        raise HTTPException(400, f"Unsupported format: {ext}")

    save_dir = settings.studio_dir / track.session_id
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / f"{track_id}_raw{ext}"

    content = await file.read()
    save_path.write_bytes(content)

    track.raw_audio_path = str(save_path)
    track.track_type = "import" if track.track_type == "recording" and ext != ".webm" else track.track_type
    db.commit()
    db.refresh(track)
    log.info(f"Track {track_id}: uploaded {ext} ({len(content)} bytes)")
    return track


@router.post("/tracks/{track_id}/record", response_model=StudioTrackResponse)
async def record_track_audio(
    track_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a recorded audio blob from the browser (typically WebM)."""
    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")

    ext = Path(file.filename or "recording.webm").suffix.lower()

    save_dir = settings.studio_dir / track.session_id
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / f"{track_id}_raw{ext}"

    content = await file.read()
    save_path.write_bytes(content)

    track.raw_audio_path = str(save_path)
    track.track_type = "recording"
    db.commit()
    db.refresh(track)
    log.info(f"Track {track_id}: recorded {ext} ({len(content)} bytes)")
    return track


@router.get("/tracks/{track_id}/audio")
def stream_track_audio(track_id: str, version: str = "processed", db: Session = Depends(get_db)):
    """Serve track audio. version=processed|raw"""
    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    audio_path = track.processed_audio_path if version == "processed" else track.raw_audio_path
    if not audio_path:
        audio_path = track.raw_audio_path  # fallback to raw
    if not audio_path:
        raise HTTPException(404, "No audio available for this track")
    path = Path(audio_path)
    if not path.exists():
        raise HTTPException(404, "Audio file not found on disk")
    media = "audio/mpeg" if path.suffix == ".mp3" else "audio/wav"
    if path.suffix == ".webm":
        media = "audio/webm"
    return FileResponse(path, media_type=media)


# ---------- Arrangement Sections ----------

@router.post("/sessions/{session_id}/sections", response_model=ArrangementSectionResponse)
def add_section(session_id: str, data: ArrangementSectionCreate, db: Session = Depends(get_db)):
    session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Studio session not found")
    count = db.query(ArrangementSection).filter(ArrangementSection.session_id == session_id).count()
    section = ArrangementSection(
        label=data.label,
        order_index=count,
        start_bar=data.start_bar,
        length_bars=data.length_bars,
        color=data.color,
        session_id=session_id,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


@router.patch("/sessions/{session_id}/sections/{section_id}", response_model=ArrangementSectionResponse)
def update_section(session_id: str, section_id: str, data: ArrangementSectionUpdate, db: Session = Depends(get_db)):
    section = db.query(ArrangementSection).filter(
        ArrangementSection.id == section_id,
        ArrangementSection.session_id == session_id,
    ).first()
    if not section:
        raise HTTPException(404, "Section not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(section, field, value)
    db.commit()
    db.refresh(section)
    return section


@router.delete("/sessions/{session_id}/sections/{section_id}")
def delete_section(session_id: str, section_id: str, db: Session = Depends(get_db)):
    section = db.query(ArrangementSection).filter(
        ArrangementSection.id == section_id,
        ArrangementSection.session_id == session_id,
    ).first()
    if not section:
        raise HTTPException(404, "Section not found")
    db.delete(section)
    # Re-index
    remaining = (
        db.query(ArrangementSection)
        .filter(ArrangementSection.session_id == session_id)
        .order_by(ArrangementSection.order_index)
        .all()
    )
    for i, s in enumerate(remaining):
        s.order_index = i
    db.commit()
    return {"status": "deleted", "id": section_id}


# ---------- Instrument Conversion ----------

@router.post("/tracks/{track_id}/convert")
def convert_track(
    track_id: str,
    instrument_description: str,
    quality: str = "draft",
    user_id: str = "default",
    db: Session = Depends(get_db),
):
    """Convert a track's audio to an instrument sound using AI.
    Free tier: preset instruments only. Pro tier: custom prompts.
    """
    from backend.services.tier_service import check_feature_access, get_user_tier, get_tier_limits
    from backend.services.instrument_service import PRESET_INSTRUMENTS

    tier = get_user_tier(db, user_id)
    limits = get_tier_limits(tier)

    # Free tier: only preset instruments
    if not limits["custom_instrument_prompts"]:
        if instrument_description.lower() not in [p.lower() for p in PRESET_INSTRUMENTS]:
            raise HTTPException(403, "Custom instrument prompts are a Pro feature. Upgrade for $10/mo")

    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    if not track.raw_audio_path:
        raise HTTPException(400, "No audio to convert")

    # Synchronous for now (Phase 4 can make this async via Celery)
    from backend.services.instrument_service import convert_to_instrument

    output = convert_to_instrument(
        audio_path=track.raw_audio_path,
        instrument_description=instrument_description,
        quality=quality,
    )

    track.processed_audio_path = output
    track.instrument_label = instrument_description
    db.commit()
    db.refresh(track)

    from backend.services.analytics_service import log_event
    log_event(db, "track_convert", metadata={"track_id": track_id, "instrument": instrument_description})

    return {"track_id": track_id, "instrument": instrument_description, "output_path": output}


@router.get("/tracks/{track_id}/suggestions")
def suggest_instruments(track_id: str, db: Session = Depends(get_db)):
    """LLM suggests instruments based on audio analysis."""
    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")

    from backend.services.instrument_service import PRESET_INSTRUMENTS, classify_input

    if track.raw_audio_path:
        input_type = classify_input(track.raw_audio_path)
    else:
        input_type = "mixed"

    # Suggest based on classification
    if input_type == "pitched":
        suggestions = ["electric guitar", "acoustic guitar", "saxophone", "piano", "strings", "flute", "synth"]
    elif input_type == "percussive":
        suggestions = ["drums", "snare", "hi-hat", "clap", "bass"]
    else:
        suggestions = PRESET_INSTRUMENTS[:8]

    return {"input_type": input_type, "suggestions": suggestions}


# ---------- Track Analysis (Pro) ----------

@router.post("/tracks/{track_id}/analyze", response_model=StudioTrackResponse)
def analyze_track(track_id: str, user_id: str = "default", db: Session = Depends(get_db)):
    """Auto-detect key and BPM for a track. Pro feature."""
    from backend.services.tier_service import check_feature_access
    access = check_feature_access(db, user_id, "key_tempo_sync")
    if not access["allowed"]:
        raise HTTPException(403, access["upgrade_message"])

    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    audio_path = track.raw_audio_path or track.processed_audio_path
    if not audio_path:
        raise HTTPException(400, "No audio to analyze")

    from backend.services.pitch_service import detect_key
    from backend.services.tempo_service import detect_bpm

    key_result = detect_key(audio_path)
    bpm_result = detect_bpm(audio_path)

    track.detected_key = key_result["key"]
    track.detected_bpm = bpm_result["bpm"]
    db.commit()
    db.refresh(track)
    log.info(f"Track {track_id} analyzed: key={key_result['key']}, bpm={bpm_result['bpm']}")
    return track


@router.post("/sessions/{session_id}/sync")
def sync_session(session_id: str, user_id: str = "default", db: Session = Depends(get_db)):
    """Sync all tracks to the session's master key and BPM. Pro feature."""
    from backend.services.tier_service import check_feature_access
    access = check_feature_access(db, user_id, "key_tempo_sync")
    if not access["allowed"]:
        raise HTTPException(403, access["upgrade_message"])

    session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Studio session not found")

    from backend.services.pitch_service import calculate_semitone_shift, pitch_shift
    from backend.services.tempo_service import calculate_stretch_ratio, time_stretch

    synced_tracks = []
    for track in session.tracks:
        audio_path = track.raw_audio_path
        if not audio_path:
            continue

        changed = False
        current_path = audio_path

        # Key sync
        if track.detected_key and track.detected_key != session.key:
            semitones = calculate_semitone_shift(track.detected_key, session.key)
            if semitones != 0:
                current_path = pitch_shift(current_path, semitones)
                track.pitch_shift_semitones = semitones
                changed = True

        # Tempo sync
        if track.detected_bpm and abs(track.detected_bpm - session.bpm) > 1.0:
            ratio = calculate_stretch_ratio(track.detected_bpm, session.bpm)
            if abs(ratio - 1.0) > 0.01:
                current_path = time_stretch(current_path, ratio)
                track.tempo_stretch_ratio = ratio
                changed = True

        if changed:
            track.processed_audio_path = current_path
            synced_tracks.append(track.id)

    db.commit()
    return {"synced_tracks": synced_tracks, "master_key": session.key, "master_bpm": session.bpm}


# ---------- MIDI ----------

@router.post("/tracks/{track_id}/midi", response_model=StudioTrackResponse)
def upload_midi_data(track_id: str, midi_data: list[dict], db: Session = Depends(get_db)):
    """Upload MIDI note data to a track (from Web MIDI API)."""
    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    track.midi_data = midi_data
    track.track_type = "midi"
    db.commit()
    db.refresh(track)
    return track


@router.post("/tracks/{track_id}/render-midi", response_model=StudioTrackResponse)
def render_midi(
    track_id: str,
    instrument: str = "piano",
    db: Session = Depends(get_db),
):
    """Render MIDI data to audio using FluidSynth."""
    track = db.query(StudioTrack).filter(StudioTrack.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    if not track.midi_data:
        raise HTTPException(400, "No MIDI data to render")

    session = db.query(StudioSession).filter(StudioSession.id == track.session_id).first()

    from backend.services.midi_service import midi_to_audio

    output_path = midi_to_audio(
        midi_data=track.midi_data,
        instrument=instrument,
        bpm=session.bpm if session else 120,
        key=session.key if session else "C",
    )

    track.processed_audio_path = output_path
    track.instrument_label = instrument
    db.commit()
    db.refresh(track)
    return track


# ---------- Arrangement LLM ----------

@router.post("/sessions/{session_id}/suggest-arrangement")
def suggest_arrangement(session_id: str, db: Session = Depends(get_db)):
    """Use LLM to suggest a song arrangement structure."""
    session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Studio session not found")

    # Use planning service if available, otherwise default structure
    try:
        from backend.services.planning_service import plan_song_structure

        genre = session.genre or "hip_hop"
        plan = plan_song_structure(genre, "default", session.bpm)
        return {"sections": plan.get("sections", _default_arrangement())}
    except Exception:
        return {"sections": _default_arrangement()}


def _default_arrangement():
    return [
        {"label": "intro", "length_bars": 4, "color": "#6366f1"},
        {"label": "verse_1", "length_bars": 16, "color": "#8b5cf6"},
        {"label": "chorus", "length_bars": 8, "color": "#ef4444"},
        {"label": "verse_2", "length_bars": 16, "color": "#8b5cf6"},
        {"label": "chorus", "length_bars": 8, "color": "#ef4444"},
        {"label": "bridge", "length_bars": 8, "color": "#f59e0b"},
        {"label": "chorus", "length_bars": 8, "color": "#ef4444"},
        {"label": "outro", "length_bars": 4, "color": "#6366f1"},
    ]


# ---------- Mix + Export ----------

@router.post("/sessions/{session_id}/mix")
def mix_session_endpoint(session_id: str, quality: str = "draft", db: Session = Depends(get_db)):
    """Render master mix of all tracks."""
    session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Studio session not found")

    from backend.services.studio_mix_service import mix_session

    try:
        output_path = mix_session(session_id, quality)
        return {"status": "mixed", "output_path": output_path}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/sessions/{session_id}/export")
def export_session(
    session_id: str,
    format: str = "mp3",
    user_id: str = "default",
    db: Session = Depends(get_db),
):
    """Export session in various formats. Tier-enforced."""
    from backend.services.tier_service import get_user_tier, get_tier_limits

    tier = get_user_tier(db, user_id)
    limits = get_tier_limits(tier)

    if format not in limits["export_formats"]:
        raise HTTPException(403, f"{format.upper()} export is a Pro feature. Upgrade for $10/mo")

    session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Studio session not found")

    from backend.services.studio_mix_service import mix_session, render_stems

    if format == "mp3":
        mix_path = mix_session(session_id)
        from pydub import AudioSegment
        seg = AudioSegment.from_wav(mix_path)
        mp3_path = mix_path.replace(".wav", ".mp3")
        seg.export(mp3_path, format="mp3", bitrate="320k")
        return {"status": "exported", "format": "mp3", "download_path": mp3_path}

    elif format == "wav":
        mix_path = mix_session(session_id)
        return {"status": "exported", "format": "wav", "download_path": mix_path}

    elif format == "stems_zip":
        stems = render_stems(session_id)
        from zipfile import ZipFile
        zip_path = str(settings.exports_dir / f"studio_{session_id}_stems.zip")
        with ZipFile(zip_path, "w") as zf:
            for track_id, stem_path in stems.items():
                zf.write(stem_path, Path(stem_path).name)
        return {"status": "exported", "format": "stems_zip", "download_path": zip_path}

    elif format == "ableton_als":
        from backend.services.ableton_service import export_als
        zip_path = export_als(session_id)
        return {"status": "exported", "format": "ableton_als", "download_path": zip_path}

    else:
        raise HTTPException(400, f"Unsupported format: {format}")


@router.get("/sessions/{session_id}/download")
def download_session_export(session_id: str, path: str, db: Session = Depends(get_db)):
    """Download an exported file."""
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(404, "File not found")
    media = "audio/mpeg" if file_path.suffix == ".mp3" else "audio/wav"
    if file_path.suffix == ".zip":
        media = "application/zip"
    if file_path.suffix == ".als":
        media = "application/octet-stream"
    return FileResponse(file_path, media_type=media, filename=file_path.name)


# ---------- Sample Library ----------

@router.get("/samples/categories")
def get_sample_categories():
    """Get all sample library categories."""
    from backend.services.sample_library_service import get_categories
    return get_categories()


@router.get("/samples/")
def list_samples(
    category: str | None = None,
    search: str | None = None,
    user_id: str = "default",
    db: Session = Depends(get_db),
):
    """List samples. Free users see free samples only."""
    from backend.services.sample_library_service import list_samples, seed_sample_library
    from backend.services.tier_service import get_user_tier

    seed_sample_library(db)  # idempotent

    tier = get_user_tier(db, user_id)
    free_only = tier == "free"

    samples = list_samples(db, category=category, free_only=free_only, search=search)
    return [
        {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "icon": s.icon,
            "color": s.color,
            "bpm": s.bpm,
            "key": s.key,
            "tags": s.tags,
            "is_free": s.is_free,
            "has_audio": s.file_path is not None,
        }
        for s in samples
    ]


@router.get("/samples/{sample_id}/audio")
def get_sample_audio(sample_id: str, db: Session = Depends(get_db)):
    """Stream sample audio. Generates on first access."""
    from backend.models.sample_library import SamplePack
    from backend.services.sample_library_service import generate_sample_audio

    sample = db.query(SamplePack).filter(SamplePack.id == sample_id).first()
    if not sample:
        raise HTTPException(404, "Sample not found")

    # Generate audio if not already created
    if not sample.file_path or not Path(sample.file_path).exists():
        audio_path = generate_sample_audio(sample)
        sample.file_path = audio_path
        db.commit()

    path = Path(sample.file_path)
    if not path.exists():
        raise HTTPException(404, "Sample audio not found")

    return FileResponse(path, media_type="audio/wav")


@router.post("/sessions/{session_id}/tracks/from-sample")
def add_track_from_sample(
    session_id: str,
    sample_id: str,
    user_id: str = "default",
    db: Session = Depends(get_db),
):
    """Add a sample from the library as a new track."""
    from backend.models.sample_library import SamplePack
    from backend.services.sample_library_service import generate_sample_audio

    session = db.query(StudioSession).filter(StudioSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Studio session not found")

    # Track limit check
    current_count = db.query(StudioTrack).filter(StudioTrack.session_id == session_id).count()
    limit_check = check_track_limit(db, user_id, current_count)
    if not limit_check["allowed"]:
        raise HTTPException(403, limit_check["upgrade_message"])

    sample = db.query(SamplePack).filter(SamplePack.id == sample_id).first()
    if not sample:
        raise HTTPException(404, "Sample not found")

    # Generate audio if needed
    if not sample.file_path or not Path(sample.file_path).exists():
        audio_path = generate_sample_audio(sample)
        sample.file_path = audio_path

    # Create track from sample
    import shutil
    track_dir = settings.studio_dir / session_id
    track_dir.mkdir(parents=True, exist_ok=True)

    track = StudioTrack(
        name=sample.name,
        order_index=current_count,
        track_type="import",
        instrument_label=sample.category,
        color=sample.color,
        session_id=session_id,
    )
    db.add(track)
    db.flush()

    # Copy sample to track directory
    dest = track_dir / f"{track.id}_raw.wav"
    shutil.copy2(sample.file_path, str(dest))
    track.raw_audio_path = str(dest)

    db.commit()
    db.refresh(track)
    return StudioTrackResponse.model_validate(track)


# ---------- Subscription status ----------

@router.get("/subscription/status", response_model=SubscriptionResponse)
def subscription_status(user_id: str = "default", db: Session = Depends(get_db)):
    from backend.services.tier_service import get_user_tier, get_tier_limits
    tier = get_user_tier(db, user_id)
    limits = get_tier_limits(tier)
    return SubscriptionResponse(tier=tier, status="active")


@router.get("/subscription/limits")
def subscription_limits(user_id: str = "default", db: Session = Depends(get_db)):
    from backend.services.tier_service import get_user_tier, get_tier_limits
    tier = get_user_tier(db, user_id)
    return {"tier": tier, "limits": get_tier_limits(tier)}
