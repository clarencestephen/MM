from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.persona import Persona
from backend.schemas.persona import PersonaCreate, PersonaResponse
from backend.services.persona_service import save_voice_sample

router = APIRouter(prefix="/personas", tags=["personas"])


@router.post("", response_model=PersonaResponse)
def create_persona(data: PersonaCreate, db: Session = Depends(get_db)):
    # Auto-create the user if it doesn't exist (matches the wizard's
    # "default-user" convenience pattern used elsewhere)
    from backend.models.user import User
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        user = User(id=data.user_id, email=f"{data.user_id}@mm.local", display_name=data.user_id)
        db.add(user)
        db.flush()

    persona = Persona(
        name=data.name,
        description=data.description,
        style_mode=data.style_mode,
        voice_engine=data.voice_engine or "xtts",
        elevenlabs_voice_id=data.elevenlabs_voice_id,
        voice_sample_path=data.voice_sample_path,
        user_id=data.user_id,
    )
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return persona


@router.post("/{persona_id}/voice-sample")
async def upload_voice_sample(
    persona_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a voice sample for a persona.

    The sample IS the persona model — no training needed.
    seed-vc uses this reference audio directly for zero-shot conversion.
    6-30 seconds of clean speech works best.
    """
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(404, "Persona not found")

    content = await file.read()
    result = save_voice_sample(content, file.filename, persona.user_id)

    persona.voice_sample_path = result["voice_sample_path"]
    # Store the normalized path as the "embedding" — this is what seed-vc uses
    persona.embedding_path = result["normalized_path"]

    db.commit()
    db.refresh(persona)

    return {
        "persona": PersonaResponse.model_validate(persona),
        "voice_analysis": result["embedding_info"],
    }


@router.get("", response_model=list[PersonaResponse])
def list_personas(user_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Persona)
    if user_id:
        q = q.filter(Persona.user_id == user_id)
    return q.all()


@router.get("/{persona_id}", response_model=PersonaResponse)
def get_persona(persona_id: str, db: Session = Depends(get_db)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(404, "Persona not found")
    return persona
