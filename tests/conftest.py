"""Shared fixtures for MM test suite.

Uses SQLite in-memory DB and mocks all heavy AI services
(Ollama, XTTS, Demucs, WhisperX) so tests run without GPU or models.
"""
import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Force SQLite + test storage before any backend imports
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["STORAGE_PATH"] = tempfile.mkdtemp(prefix="mm_test_")

from backend.database import get_db
from backend.models.base import Base
from backend.main import app


@pytest.fixture()
def db_engine():
    """In-memory SQLite engine with StaticPool (single shared connection)."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Enable WAL-like behavior for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)


@pytest.fixture()
def db_session(db_engine):
    """Create a session for each test."""
    Session = sessionmaker(bind=db_engine, autocommit=False, autoflush=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    """FastAPI test client with overridden DB dependency."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def sample_project(client):
    """Create a project + auto-user for reuse."""
    resp = client.post("/api/projects", json={
        "title": "Test Project",
        "description": "For testing",
        "user_id": "test-user-1",
    })
    assert resp.status_code == 200, f"Failed to create project: {resp.text}"
    return resp.json()


@pytest.fixture()
def sample_song(client, sample_project):
    """Create a song with lyrics inside the sample project."""
    resp = client.post("/api/songs", json={
        "title": "Test Song",
        "lyrics": "[Verse]\nFirst line of the verse\nSecond line of the verse\n\n[Hook]\nThis is the hook yeah\nCatchy line right here",
        "genre": "hip_hop",
        "project_id": sample_project["id"],
    })
    assert resp.status_code == 200, f"Failed to create song: {resp.text}"
    return resp.json()


@pytest.fixture()
def sample_persona(client):
    """Create a persona for testing."""
    # Need a user first — create via project (auto-creates user)
    client.post("/api/projects", json={
        "title": "Setup Project",
        "user_id": "test-user-1",
    })
    resp = client.post("/api/personas", json={
        "name": "Test MC",
        "description": "Test rap persona",
        "style_mode": "rap",
        "user_id": "test-user-1",
    })
    assert resp.status_code == 200, f"Failed to create persona: {resp.text}"
    return resp.json()
