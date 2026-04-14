"""Tests for export endpoints."""
from unittest.mock import patch


@patch("backend.routes.export.export_wav")
def test_export_wav(mock_export, client, sample_song, db_session):
    """Export a song as WAV."""
    mock_export.return_value = "/tmp/export_test.wav"

    # Give the song a mix_path so export works
    from backend.models.song import Song
    song = db_session.query(Song).filter(Song.id == sample_song["id"]).first()
    song.mix_path = "/tmp/fake_mix.wav"
    db_session.commit()

    resp = client.post("/api/export/", json={
        "song_id": sample_song["id"],
        "format": "wav",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "done"
    assert data["format"] == "wav"
    assert "job_id" in data


@patch("backend.routes.export.export_mp3")
def test_export_mp3(mock_export, client, sample_song, db_session):
    mock_export.return_value = "/tmp/export_test.mp3"

    from backend.models.song import Song
    song = db_session.query(Song).filter(Song.id == sample_song["id"]).first()
    song.mix_path = "/tmp/fake_mix.wav"
    db_session.commit()

    resp = client.post("/api/export/", json={
        "song_id": sample_song["id"],
        "format": "mp3",
    })
    assert resp.status_code == 200
    assert resp.json()["format"] == "mp3"


def test_export_no_mix(client, sample_song):
    """Export without a mix → 400."""
    resp = client.post("/api/export/", json={
        "song_id": sample_song["id"],
        "format": "wav",
    })
    assert resp.status_code == 400


def test_export_song_not_found(client):
    resp = client.post("/api/export/", json={
        "song_id": "nonexistent",
        "format": "wav",
    })
    assert resp.status_code == 404
