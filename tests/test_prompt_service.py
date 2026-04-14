"""Tests for prompt parsing service — keyword fallback (no LLM needed)."""
from unittest.mock import patch


@patch("backend.services.llm_service.generate_json", return_value={})
def test_keyword_fallback_hip_hop(mock_llm):
    from backend.services.prompt_service import parse_prompt
    result = parse_prompt("dark trap beat with 808s")
    assert result["genre"] == "hip_hop"
    assert result["mood"] == "dark"
    assert result["confidence"] == 0.5


@patch("backend.services.llm_service.generate_json", return_value={})
def test_keyword_fallback_rnb(mock_llm):
    from backend.services.prompt_service import parse_prompt
    result = parse_prompt("smooth r&b love song")
    assert result["genre"] == "rnb"


@patch("backend.services.llm_service.generate_json", return_value={})
def test_keyword_fallback_lofi(mock_llm):
    from backend.services.prompt_service import parse_prompt
    result = parse_prompt("chill lo-fi study beats")
    assert result["genre"] == "lofi"
    assert result["mood"] == "chill"


@patch("backend.services.llm_service.generate_json", return_value={})
def test_keyword_hype_bpm_boost(mock_llm):
    from backend.services.prompt_service import parse_prompt
    result = parse_prompt("hype club banger hip hop")
    assert result["mood"] == "hype"
    assert result["bpm"] == 130  # 90 base + 40 hype boost


@patch("backend.services.llm_service.generate_json", return_value={
    "genre": "melodic_rap",
    "mood": "emotional",
    "bpm": 135,
    "key": "Am",
    "vocal_mode": "melodic",
    "energy": "medium",
    "confidence": 0.9,
})
def test_llm_parse_success(mock_llm):
    from backend.services.prompt_service import parse_prompt
    result = parse_prompt("emotional melodic rap about heartbreak")
    assert result["genre"] == "melodic_rap"
    assert result["mood"] == "emotional"
    assert result["bpm"] == 135
    assert result["confidence"] == 0.9
