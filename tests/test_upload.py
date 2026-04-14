"""Tests for file upload endpoints."""
import io


def _make_wav_bytes():
    """Minimal valid WAV header (44 bytes of silence)."""
    import struct
    sample_rate = 16000
    num_samples = 16000  # 1 second
    data_size = num_samples * 2  # 16-bit mono
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16,
        b"data", data_size,
    )
    return header + b"\x00" * data_size


def test_upload_beat(client, sample_song):
    wav_bytes = _make_wav_bytes()
    resp = client.post(
        "/api/upload/beat",
        data={"song_id": sample_song["id"]},
        files={"file": ("test_beat.wav", io.BytesIO(wav_bytes), "audio/wav")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["file_type"] == "beat"
    assert data["song_id"] == sample_song["id"]
    assert data["file_path"].endswith(".wav")


def test_upload_source(client, sample_song):
    wav_bytes = _make_wav_bytes()
    resp = client.post(
        "/api/upload/source",
        data={"song_id": sample_song["id"]},
        files={"file": ("source.wav", io.BytesIO(wav_bytes), "audio/wav")},
    )
    assert resp.status_code == 200
    assert resp.json()["file_type"] == "source"


def test_upload_vocal(client, sample_song):
    wav_bytes = _make_wav_bytes()
    resp = client.post(
        "/api/upload/vocal",
        data={"song_id": sample_song["id"]},
        files={"file": ("voice.wav", io.BytesIO(wav_bytes), "audio/wav")},
    )
    assert resp.status_code == 200
    assert resp.json()["file_type"] == "vocal"


def test_upload_beat_bad_format(client, sample_song):
    resp = client.post(
        "/api/upload/beat",
        data={"song_id": sample_song["id"]},
        files={"file": ("bad.txt", io.BytesIO(b"not audio"), "text/plain")},
    )
    assert resp.status_code == 400


def test_upload_beat_song_not_found(client):
    wav_bytes = _make_wav_bytes()
    resp = client.post(
        "/api/upload/beat",
        data={"song_id": "nonexistent"},
        files={"file": ("beat.wav", io.BytesIO(wav_bytes), "audio/wav")},
    )
    assert resp.status_code == 404
