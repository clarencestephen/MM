"""Tests for root and health endpoints."""
from unittest.mock import patch


def test_root(client):
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "MM"
    assert data["api_calls"] == "zero"
    assert "version" in data


def test_health_returns_ok(client):
    """Health endpoint should return structured response without crashing."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "services" in data
    assert "ollama" in data["services"]
    assert "ffmpeg" in data["services"]
    assert "database" in data["services"]
    assert "models" in data
    assert "gpu" in data
