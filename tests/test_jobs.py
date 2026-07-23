"""Tests for job status endpoints."""
from unittest.mock import patch


@patch("backend.routes.generate.generate_vocal")
def test_render_job_status(mock_vocal, client, sample_song):
    """Generate a song, then check the render job status."""
    mock_vocal.return_value = "/tmp/test_vocal.wav"

    gen_resp = client.post("/api/generate", json={
        "song_id": sample_song["id"],
        "quality": "draft",
    })
    assert gen_resp.status_code == 200
    job_id = gen_resp.json()["job_id"]

    resp = client.get(f"/api/jobs/render/{job_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "done"
    assert data["job_type"] == "vocal_gen"


def test_render_job_not_found(client):
    resp = client.get("/api/jobs/render/nonexistent")
    assert resp.status_code == 404


def test_export_job_not_found(client):
    resp = client.get("/api/jobs/export/nonexistent")
    assert resp.status_code == 404
