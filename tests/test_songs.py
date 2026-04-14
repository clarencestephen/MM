"""Tests for song CRUD endpoints."""


def test_create_song(client, sample_project):
    resp = client.post("/api/songs/", json={
        "title": "Fire Track",
        "lyrics": "[Verse]\nBars on bars\n\n[Hook]\nCatchy hook",
        "genre": "hip_hop",
        "bpm": 90,
        "project_id": sample_project["id"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Fire Track"
    assert data["genre"] == "hip_hop"
    assert data["bpm"] == 90
    assert data["status"] == "draft"


def test_create_song_defaults(client, sample_project):
    resp = client.post("/api/songs/", json={
        "project_id": sample_project["id"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Untitled"
    assert data["genre"] == "hip_hop"


def test_get_song(client, sample_song):
    resp = client.get(f"/api/songs/{sample_song['id']}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test Song"


def test_get_song_not_found(client):
    resp = client.get("/api/songs/nonexistent-id")
    assert resp.status_code == 404


def test_update_song(client, sample_song):
    resp = client.patch(f"/api/songs/{sample_song['id']}", json={
        "title": "Updated Title",
        "bpm": 140,
        "mood": "hype",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated Title"
    assert data["bpm"] == 140
    assert data["mood"] == "hype"
    # Unchanged fields stay the same
    assert data["genre"] == "hip_hop"


def test_update_song_partial(client, sample_song):
    """PATCH with only one field shouldn't null out others."""
    resp = client.patch(f"/api/songs/{sample_song['id']}", json={"mood": "dark"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["mood"] == "dark"
    assert data["title"] == "Test Song"
    assert data["lyrics"] is not None


def test_list_songs_by_project(client, sample_project, sample_song):
    resp = client.get(f"/api/songs/project/{sample_project['id']}")
    assert resp.status_code == 200
    songs = resp.json()
    assert len(songs) >= 1
    assert any(s["id"] == sample_song["id"] for s in songs)
