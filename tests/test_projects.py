"""Tests for project CRUD endpoints."""


def test_create_project(client):
    resp = client.post("/api/projects", json={
        "title": "My Album",
        "description": "First album",
        "user_id": "user-abc",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "My Album"
    assert data["user_id"] == "user-abc"
    assert "id" in data


def test_create_project_auto_creates_user(client):
    resp = client.post("/api/projects", json={
        "title": "Project X",
        "user_id": "brand-new-user",
    })
    assert resp.status_code == 200
    assert resp.json()["user_id"] == "brand-new-user"


def test_list_projects(client, sample_project):
    resp = client.get("/api/projects")
    assert resp.status_code == 200
    projects = resp.json()
    assert len(projects) >= 1
    assert any(p["id"] == sample_project["id"] for p in projects)


def test_list_projects_by_user(client, sample_project):
    resp = client.get("/api/projects", params={"user_id": "test-user-1"})
    assert resp.status_code == 200
    assert all(p["user_id"] == "test-user-1" for p in resp.json())


def test_get_project(client, sample_project):
    resp = client.get(f"/api/projects/{sample_project['id']}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test Project"


def test_get_project_not_found(client):
    resp = client.get("/api/projects/nonexistent-id")
    assert resp.status_code == 404
