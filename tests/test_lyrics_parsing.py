"""Tests for lyrics section parsing — pure logic, no mocks needed."""
from backend.services.lyrics_service import parse_lyrics_into_sections


def test_parse_basic_sections():
    lyrics = """[Verse]
First line
Second line

[Hook]
Catchy hook line
Another hook line

[Outro]
Final line"""
    sections = parse_lyrics_into_sections(lyrics)
    assert len(sections) == 3
    assert sections[0]["label"] == "verse"
    assert sections[1]["label"] == "hook"
    assert sections[2]["label"] == "outro"
    assert sections[0]["order_index"] == 0
    assert sections[1]["order_index"] == 1


def test_parse_verse_numbers():
    lyrics = """[Verse 1]
First verse bars

[Hook]
Hook yeah

[Verse 2]
Second verse bars"""
    sections = parse_lyrics_into_sections(lyrics)
    assert len(sections) == 3
    assert sections[0]["label"] == "verse"
    assert sections[2]["label"] == "verse"


def test_parse_no_labels():
    """Plain text without section markers becomes a single verse."""
    lyrics = "Just some bars\nMore bars\nEven more bars"
    sections = parse_lyrics_into_sections(lyrics)
    assert len(sections) == 1
    assert sections[0]["label"] == "verse"
    assert "Just some bars" in sections[0]["lyrics"]


def test_parse_empty_string():
    sections = parse_lyrics_into_sections("")
    assert sections == []


def test_parse_preserves_lyrics_content():
    lyrics = """[Verse]
I got the flow that's unstoppable
Rhymes so clean they're untoppable"""
    sections = parse_lyrics_into_sections(lyrics)
    assert "unstoppable" in sections[0]["lyrics"]
    assert "untoppable" in sections[0]["lyrics"]


def test_parse_bridge_and_intro():
    lyrics = """[Intro]
Yeah, let's go

[Verse]
Main verse

[Bridge]
Bridge section here

[Outro]
We out"""
    sections = parse_lyrics_into_sections(lyrics)
    labels = [s["label"] for s in sections]
    assert labels == ["intro", "verse", "bridge", "outro"]


def test_parse_blank_lines_split_sections():
    """Blank lines between unlabeled text create separate sections."""
    lyrics = """Line one
Line two

Line three
Line four"""
    sections = parse_lyrics_into_sections(lyrics)
    assert len(sections) == 2


def test_parse_parenthetical_labels():
    """Labels in parentheses should also be recognized."""
    lyrics = """(Verse)
Bars here

(Hook)
Hook here"""
    sections = parse_lyrics_into_sections(lyrics)
    assert sections[0]["label"] == "verse"
    assert sections[1]["label"] == "hook"
