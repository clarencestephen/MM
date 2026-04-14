from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.song import Song
from backend.models.section import Section
from backend.schemas.song import SongCreate, SongUpdate, SongResponse
from backend.services.lyrics_service import parse_lyrics_into_sections

router = APIRouter(prefix="/songs", tags=["songs"])


@router.post("/", response_model=SongResponse)
def create_song(data: SongCreate, db: Session = Depends(get_db)):
    song = Song(
        title=data.title,
        prompt=data.prompt,
        lyrics=data.lyrics,
        genre=data.genre,
        mood=data.mood,
        bpm=data.bpm,
        key=data.key,
        project_id=data.project_id,
    )
    db.add(song)
    db.flush()

    # Parse lyrics into sections if provided
    if data.lyrics:
        sections = parse_lyrics_into_sections(data.lyrics)
        for s in sections:
            section = Section(
                label=s["label"],
                order_index=s["order_index"],
                lyrics=s["lyrics"],
                song_id=song.id,
            )
            db.add(section)

    db.commit()
    db.refresh(song)
    return song


@router.get("/{song_id}", response_model=SongResponse)
def get_song(song_id: str, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    return song


@router.patch("/{song_id}", response_model=SongResponse)
def update_song(song_id: str, data: SongUpdate, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(song, field, value)
    db.commit()
    db.refresh(song)
    return song


@router.get("/project/{project_id}", response_model=list[SongResponse])
def list_songs(project_id: str, db: Session = Depends(get_db)):
    return db.query(Song).filter(Song.project_id == project_id).all()


@router.delete("/{song_id}")
def delete_song(song_id: str, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    # Delete associated sections
    db.query(Section).filter(Section.song_id == song_id).delete()
    db.delete(song)
    db.commit()
    return {"status": "deleted", "id": song_id}


@router.get("/{song_id}/audio")
def stream_song_audio(song_id: str, db: Session = Depends(get_db)):
    """Serve the song's vocal/mix audio file directly for playback."""
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    audio_path = song.mix_path or song.vocal_path
    if not audio_path:
        raise HTTPException(404, "No audio available for this song")
    path = Path(audio_path)
    if not path.exists():
        raise HTTPException(404, "Audio file not found on disk")
    media = "audio/mpeg" if path.suffix == ".mp3" else "audio/wav"
    return FileResponse(path, media_type=media)
