from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.project import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/", response_model=ProjectResponse)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    # Auto-create user if not exists (MVP convenience)
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        user = User(id=data.user_id, email=f"{data.user_id}@mm.local")
        db.add(user)
        db.flush()

    project = Project(title=data.title, description=data.description, user_id=data.user_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/", response_model=list[ProjectResponse])
def list_projects(user_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Project)
    if user_id:
        q = q.filter(Project.user_id == user_id)
    return q.all()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project
