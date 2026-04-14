"""Tests for generation pipeline endpoints.

Mocks AI services (XTTS, Ollama, voice conversion) so tests run without GPU.
"""
from unittest.mock import patch


def test_generate_song_no_lyrics(client, sample_song):
    """Song with no lyrics → update with empty lyrics, should fail."""
    # First clear the lyrics
    client.patch(f"/api/songs/{sample_song['id']}", json={"lyrics": ""})

    resp = client.post("/api/generate/", json={
        "song_id": sample_song["id"],
        "quality": "draft",
    })
    # Empty string is falsy, should get 400
    assert resp.status_code == 400


def test_generate_song_not_found(client):
    resp = client.post("/api/generate/", json={
        "song_id": "nonexistent",
        "quality": "draft",
    })
    assert resp.status_code == 404


@patch("backend.routes.generate.generate_vocal")
@patch("backend.routes.generate.mix_beat_and_vocal")
def test_generate_song_with_lyrics(mock_mix, mock_vocal, client, sample_song):
    mock_vocal.return_value = "/tmp/test_vocal.wav"
    mock_mix.return_value = "/tmp/test_mix.wav"

    resp = client.post("/api/generate/", json={
        "song_id": sample_song["id"],
        "lyrics": "[Verse]\nTest bars here\n\n[Hook]\nTest hook yeah",
        "quality": "draft",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "done"
    assert data["song_id"] == sample_song["id"]
    assert "job_id" in data
    mock_vocal.assert_called_once()


@patch("backend.routes.generate.generate_vocal")
def test_generate_song_no_beat(mock_vocal, client, sample_song):
    """Generate without a beat → vocal becomes the mix."""
    mock_vocal.return_value = "/tmp/test_vocal.wav"

    resp = client.post("/api/generate/", json={
        "song_id": sample_song["id"],
        "quality": "draft",
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "done"


@patch("backend.routes.generate.generate_vocal")
def test_generate_song_section_regen(mock_vocal, client, sample_song):
    """Regenerate only the hook section."""
    mock_vocal.return_value = "/tmp/test_vocal.wav"

    resp = client.post("/api/generate/", json={
        "song_id": sample_song["id"],
        "section": "hook",
        "quality": "draft",
    })
    assert resp.status_code == 200
    # Should have called generate_vocal with just the hook lyrics
    call_args = mock_vocal.call_args
    assert "hook" in call_args[0][0].lower() or "catchy" in call_args[0][0].lower()


@patch("backend.routes.generate.generate_vocal")
@patch("backend.routes.generate.convert_voice")
def test_generate_with_persona(mock_convert, mock_vocal, client, sample_song, sample_persona, db_session):
    """Generate with a persona triggers voice conversion."""
    mock_vocal.return_value = "/tmp/test_vocal.wav"
    mock_convert.return_value = "/tmp/test_converted.wav"

    # Give persona an embedding path so voice conversion triggers
    from backend.models.persona import Persona
    persona = db_session.query(Persona).filter(Persona.id == sample_persona["id"]).first()
    persona.embedding_path = "/tmp/fake_embedding.wav"
    db_session.commit()

    resp = client.post("/api/generate/", json={
        "song_id": sample_song["id"],
        "persona_id": sample_persona["id"],
        "quality": "draft",
    })
    assert resp.status_code == 200
    mock_convert.assert_called_once()


@patch("backend.services.llm_service.generate")
def test_generate_lyrics_endpoint(mock_llm, client):
    mock_llm.return_value = "[Verse]\nGenerated bars\n\n[Hook]\nGenerated hook"

    resp = client.post("/api/generate/lyrics", json={
        "prompt": "dark trap about the city",
        "genre": "hip_hop",
        "mood": "dark",
    })
    assert resp.status_code == 200
    assert "lyrics" in resp.json()
    assert len(resp.json()["lyrics"]) > 0


@patch("backend.services.llm_service.generate")
def test_generate_lyrics_ollama_down(mock_llm, client):
    """When Ollama is down, fallback placeholder lyrics are returned."""
    mock_llm.return_value = ""

    resp = client.post("/api/generate/lyrics", json={
        "prompt": "chill lo-fi vibes",
    })
    assert resp.status_code == 200
    assert "lyrics" in resp.json()
    # Placeholder lyrics should mention Ollama
    assert "placeholder" in resp.json()["lyrics"].lower() or len(resp.json()["lyrics"]) > 0


@patch("backend.services.llm_service.generate")
def test_rewrite_parody(mock_llm, client, sample_song):
    mock_llm.return_value = "[Verse]\nParody bars about pizza\n\n[Hook]\nPizza pizza yeah"

    resp = client.post("/api/generate/rewrite", json={
        "song_id": sample_song["id"],
        "original_lyrics": "[Verse]\nOriginal bars\n\n[Hook]\nOriginal hook",
        "new_theme": "pizza delivery",
    })
    assert resp.status_code == 200
    assert "lyrics" in resp.json()


@patch("backend.services.llm_service.generate")
def test_rewrite_section(mock_llm, client, sample_song):
    mock_llm.return_value = "Rewritten verse with more energy"

    resp = client.post("/api/generate/rewrite", json={
        "song_id": sample_song["id"],
        "original_lyrics": "Original verse text",
        "instruction": "Make it more aggressive",
    })
    assert resp.status_code == 200


def test_rewrite_no_instruction(client, sample_song):
    """Rewrite without theme or instruction should fail."""
    resp = client.post("/api/generate/rewrite", json={
        "song_id": sample_song["id"],
        "original_lyrics": "Some lyrics",
    })
    assert resp.status_code == 400
