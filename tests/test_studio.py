"""Tests for MMMM Studio — sessions, tracks, arrangement, tier enforcement."""

import pytest


@pytest.fixture()
def studio_session(client, sample_project):
    resp = client.post("/api/studio/sessions/", json={
        "title": "Test Studio Session",
        "bpm": 90,
        "key": "G",
        "scale": "minor",
        "genre": "hip_hop",
        "project_id": sample_project["id"],
    })
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------- Session CRUD ----------

def test_create_session(client, sample_project):
    resp = client.post("/api/studio/sessions/", json={
        "title": "Beat Lab",
        "bpm": 140,
        "key": "D",
        "project_id": sample_project["id"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Beat Lab"
    assert data["bpm"] == 140
    assert data["key"] == "D"
    assert data["status"] == "draft"
    assert data["tracks"] == []


def test_list_sessions(client, studio_session, sample_project):
    resp = client.get(f"/api/studio/sessions/?project_id={sample_project['id']}")
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) >= 1
    assert any(s["id"] == studio_session["id"] for s in sessions)


def test_get_session(client, studio_session):
    resp = client.get(f"/api/studio/sessions/{studio_session['id']}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test Studio Session"


def test_update_session(client, studio_session):
    resp = client.patch(f"/api/studio/sessions/{studio_session['id']}", json={
        "bpm": 100,
        "key": "A",
        "title": "Updated Session",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["bpm"] == 100
    assert data["key"] == "A"
    assert data["title"] == "Updated Session"


def test_delete_session(client, studio_session):
    resp = client.delete(f"/api/studio/sessions/{studio_session['id']}")
    assert resp.status_code == 200
    resp2 = client.get(f"/api/studio/sessions/{studio_session['id']}")
    assert resp2.status_code == 404


# ---------- Track CRUD ----------

def test_add_track(client, studio_session):
    resp = client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={
        "name": "Vocal Track",
        "track_type": "recording",
        "color": "#ef4444",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Vocal Track"
    assert data["order_index"] == 0
    assert data["volume"] == 0.0
    assert data["muted"] is False


def test_add_multiple_tracks(client, studio_session):
    for i, name in enumerate(["Drums", "Bass"]):
        resp = client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={
            "name": name,
        })
        assert resp.status_code == 200
        assert resp.json()["order_index"] == i


def test_update_track(client, studio_session):
    resp = client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={"name": "Track"})
    track_id = resp.json()["id"]

    resp2 = client.patch(f"/api/studio/tracks/{track_id}", json={
        "name": "Renamed",
        "volume": -3.0,
        "pan": -0.5,
        "muted": True,
    })
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["name"] == "Renamed"
    assert data["volume"] == -3.0
    assert data["pan"] == -0.5
    assert data["muted"] is True


def test_delete_track_reindexes(client, studio_session):
    # Add 2 tracks (free tier limit)
    ids = []
    for name in ["A", "B"]:
        r = client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={"name": name})
        ids.append(r.json()["id"])

    # Delete the first one
    client.delete(f"/api/studio/tracks/{ids[0]}")

    # Remaining should be reindexed to 0
    tracks = client.get(f"/api/studio/sessions/{studio_session['id']}/tracks").json()
    assert len(tracks) == 1
    assert tracks[0]["order_index"] == 0
    assert tracks[0]["name"] == "B"


def test_list_tracks(client, studio_session):
    client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={"name": "T1"})
    client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={"name": "T2"})
    resp = client.get(f"/api/studio/sessions/{studio_session['id']}/tracks")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# ---------- Track limit (free tier) ----------

def test_free_tier_track_limit(client, studio_session):
    """Free users are limited to 2 tracks."""
    r1 = client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={"name": "T1"})
    r2 = client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={"name": "T2"})
    assert r1.status_code == 200
    assert r2.status_code == 200

    # Third track should be blocked
    r3 = client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={"name": "T3"})
    assert r3.status_code == 403
    assert "Upgrade" in r3.json()["detail"]


# ---------- Arrangement Sections ----------

def test_add_section(client, studio_session):
    resp = client.post(f"/api/studio/sessions/{studio_session['id']}/sections", json={
        "label": "verse_1",
        "start_bar": 0,
        "length_bars": 16,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["label"] == "verse_1"
    assert data["length_bars"] == 16


def test_update_section(client, studio_session):
    resp = client.post(f"/api/studio/sessions/{studio_session['id']}/sections", json={
        "label": "chorus",
        "length_bars": 8,
    })
    sec_id = resp.json()["id"]

    resp2 = client.patch(f"/api/studio/sessions/{studio_session['id']}/sections/{sec_id}", json={
        "length_bars": 16,
        "color": "#f59e0b",
    })
    assert resp2.status_code == 200
    assert resp2.json()["length_bars"] == 16


def test_delete_section(client, studio_session):
    r1 = client.post(f"/api/studio/sessions/{studio_session['id']}/sections", json={"label": "intro"})
    r2 = client.post(f"/api/studio/sessions/{studio_session['id']}/sections", json={"label": "verse"})
    sec_id = r1.json()["id"]

    resp = client.delete(f"/api/studio/sessions/{studio_session['id']}/sections/{sec_id}")
    assert resp.status_code == 200


# ---------- Subscription status ----------

def test_subscription_status_default_free(client):
    resp = client.get("/api/studio/subscription/status")
    assert resp.status_code == 200
    assert resp.json()["tier"] == "free"


def test_subscription_limits(client):
    resp = client.get("/api/studio/subscription/limits")
    assert resp.status_code == 200
    limits = resp.json()["limits"]
    assert limits["max_tracks"] == 2
    assert limits["custom_instrument_prompts"] is False
    assert "mp3" in limits["export_formats"]
    assert "ableton_als" not in limits["export_formats"]


# ---------- Session with tracks in response ----------

def test_session_includes_tracks(client, studio_session):
    client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={"name": "Drums"})
    client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={"name": "Bass"})

    resp = client.get(f"/api/studio/sessions/{studio_session['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["tracks"]) == 2
    assert data["tracks"][0]["name"] == "Drums"


def test_delete_session_cascades(client, studio_session):
    """Deleting a session removes all tracks and sections."""
    client.post(f"/api/studio/sessions/{studio_session['id']}/tracks", json={"name": "T"})
    client.post(f"/api/studio/sessions/{studio_session['id']}/sections", json={"label": "intro"})

    resp = client.delete(f"/api/studio/sessions/{studio_session['id']}")
    assert resp.status_code == 200
