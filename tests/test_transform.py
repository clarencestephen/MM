"""Tests for transform pipeline endpoints (separation, parody, alignment)."""
import io
from unittest.mock import patch


@patch("backend.routes.transform.separate_stems")
def test_separate_source(mock_sep, client, sample_song):
    """Separate a source track into stems."""
    # First upload a source file so song has beat_path
    import struct
    sr = 16000
    ns = 16000
    ds = ns * 2
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + ds, b"WAVE",
        b"fmt ", 16, 1, 1, sr, sr * 2, 2, 16,
        b"data", ds,
    )
    wav_bytes = header + b"\x00" * ds
    client.post(
        "/api/upload/source",
        data={"song_id": sample_song["id"]},
        files={"file": ("source.wav", io.BytesIO(wav_bytes), "audio/wav")},
    )

    mock_sep.return_value = {
        "vocals": "/tmp/vocals.wav",
        "no_vocals": "/tmp/no_vocals.wav",
    }

    resp = client.post("/api/transform/separate", json={
        "song_id": sample_song["id"],
        "mode": "separate",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "done"
    assert "vocals" in data["stems"]
    assert "no_vocals" in data["stems"]


def test_separate_no_source(client, sample_song):
    """Separation without uploaded source → 400."""
    resp = client.post("/api/transform/separate", json={
        "song_id": sample_song["id"],
        "mode": "separate",
    })
    assert resp.status_code == 400


@patch("backend.routes.transform.separate_stems")
@patch("backend.routes.transform.generate_vocal")
@patch("backend.routes.transform.overlay_vocal_on_instrumental")
@patch("backend.routes.transform.align_lyrics_to_audio")
def test_parody_pipeline(mock_align, mock_overlay, mock_vocal, mock_sep, client, sample_song):
    """Full parody pipeline: separate → align → generate → overlay."""
    # Upload source first
    import struct
    sr = 16000
    ns = 16000
    ds = ns * 2
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + ds, b"WAVE",
        b"fmt ", 16, 1, 1, sr, sr * 2, 2, 16,
        b"data", ds,
    )
    wav_bytes = header + b"\x00" * ds
    client.post(
        "/api/upload/source",
        data={"song_id": sample_song["id"]},
        files={"file": ("source.wav", io.BytesIO(wav_bytes), "audio/wav")},
    )

    mock_sep.return_value = {
        "vocals": "/tmp/vocals.wav",
        "no_vocals": "/tmp/no_vocals.wav",
    }
    mock_align.return_value = [{"word": "test", "start": 0.0, "end": 0.5}]
    mock_vocal.return_value = "/tmp/new_vocal.wav"
    mock_overlay.return_value = "/tmp/parody_mix.wav"

    resp = client.post("/api/transform/parody", json={
        "song_id": sample_song["id"],
        "mode": "parody",
        "new_lyrics": "[Verse]\nParody bars here\n\n[Hook]\nParody hook yeah",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "done"
    assert data["mode"] == "parody"
    mock_sep.assert_called_once()
    mock_vocal.assert_called_once()
    mock_overlay.assert_called_once()


def test_parody_no_lyrics_no_source(client, sample_song):
    """Parody without source track → 400."""
    resp = client.post("/api/transform/parody", json={
        "song_id": sample_song["id"],
        "mode": "parody",
    })
    assert resp.status_code == 400


def test_transform_song_not_found(client):
    resp = client.post("/api/transform/separate", json={
        "song_id": "nonexistent",
        "mode": "separate",
    })
    assert resp.status_code == 404
