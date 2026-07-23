"""Tests for persona CRUD and voice sample upload."""
import io


def _ensure_user(client):
    """Create a project to auto-create the user (MVP convenience)."""
    client.post("/api/projects", json={"title": "Setup", "user_id": "test-user-1"})


def test_create_persona(client):
    _ensure_user(client)
    resp = client.post("/api/personas", json={
        "name": "Lil Test",
        "description": "Test rapper persona",
        "style_mode": "rap",
        "user_id": "test-user-1",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Lil Test"
    assert data["style_mode"] == "rap"
    assert data["voice_sample_path"] is None


def test_create_persona_defaults(client):
    _ensure_user(client)
    resp = client.post("/api/personas", json={
        "name": "Default MC",
        "user_id": "test-user-1",
    })
    assert resp.status_code == 200
    assert resp.json()["style_mode"] == "rap"


def test_list_personas(client, sample_persona):
    resp = client.get("/api/personas")
    assert resp.status_code == 200
    personas = resp.json()
    assert len(personas) >= 1


def test_list_personas_by_user(client, sample_persona):
    resp = client.get("/api/personas", params={"user_id": "test-user-1"})
    assert resp.status_code == 200
    assert all(p["user_id"] == "test-user-1" for p in resp.json())


def test_get_persona(client, sample_persona):
    resp = client.get(f"/api/personas/{sample_persona['id']}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test MC"


def test_get_persona_not_found(client):
    resp = client.get("/api/personas/nonexistent")
    assert resp.status_code == 404
