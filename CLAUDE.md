# MM

AI-native Hip Hop music creation platform. **100% local. Zero API calls. Proprietary — private repo.**

## Philosophy
- This is a LOCAL-FIRST application. Everything runs on your machine.
- Zero external API calls. No OpenAI, no Anthropic, no cloud TTS.
- **PROPRIETARY CODE** — private GitHub repo, no public access, no open-source license.
- VPS deployment is optional/later.
- Genre focus: Hip Hop, Melodic Rap, R&B, Lo-fi. No all-genre abstractions.
- Wedge: editability + transformation + identity, NOT generic text-to-song.

## Stack (all local)
| Layer | Tool | GPU |
|-------|------|-----|
| LLM (prompts, lyrics) | Ollama + Qwen 2.5 14B | GPU 0 |
| TTS (vocals) | XTTS v2 (coqui) | GPU 0 |
| Voice conversion | RVC (stub, next priority) | GPU 0 |
| Instrument conversion | MusicGen (audiocraft) | GPU 1 |
| Source separation | Demucs | GPU 1 |
| Transcription | WhisperX | GPU 1 |
| Pitch/tempo analysis | librosa + torchcrepe | GPU 1 |
| MIDI rendering | FluidSynth + SoundFont | CPU |
| Lyrics alignment | torchaudio forced_align | GPU 1 |
| Audio mixing | pydub + ffmpeg | CPU |
| Backend | FastAPI + Postgres + Redis | CPU |
| Workers | Celery (GPU-typed queues) | per queue |

## Run locally
```bash
# 1. Install Ollama + pull model
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:14b

# 2. Start infrastructure
docker-compose up -d db redis ollama

# 3. Install Python deps
pip install -r requirements.txt
pip install -r requirements-models.txt  # ML models (optional, has fallbacks)

# 4. Sync schema + run
python scripts/migrate.py
uvicorn backend.main:app --reload

# Or all-in-one with Docker:
docker-compose up -d
```

## Project structure
```
backend/
  main.py              # FastAPI app (v0.2.0)
  config.py            # Settings — GPU assignment, Ollama URL, quality modes
  database.py          # SQLAlchemy engine/session
  models/              # SQLAlchemy ORM (User, Project, Song, Stem, Persona, etc.)
  schemas/             # Pydantic request/response
  routes/              # API endpoints
    generate.py        # Pipeline 1: lyrics + beat → vocal → mix
    transform.py       # Pipeline 2: source → separate → parody → overlay
    studio.py          # MMMM Studio: sessions, tracks, MIDI, mix, export
  services/
    llm_service.py     # Ollama wrapper (all LLM calls go through here)
    prompt_service.py   # LLM-powered prompt parsing
    lyrics_service.py   # LLM-powered lyric generation + parody rewriting
    planning_service.py # LLM-enhanced song structure planning
    generation_service.py  # XTTS v2 vocal generation (local)
    voice_conversion_service.py  # RVC voice stylization (stub → real moat)
    separation_service.py  # Demucs stem splitting (cached)
    alignment_service.py   # WhisperX transcription + torchaudio forced alignment
    mix_service.py     # pydub beat+vocal mixing
    instrument_service.py  # MusicGen sound-to-instrument conversion
    pitch_service.py   # Key detection + pitch shifting
    tempo_service.py   # BPM detection + time stretching
    midi_service.py    # FluidSynth MIDI rendering
    studio_mix_service.py  # Multi-track session mixing
    ableton_service.py # ALS (Ableton Live Set) export
    tier_service.py    # Free/Pro subscription enforcement
    cache_service.py   # Content-addressed file cache
    export_service.py  # WAV/MP3/stems ZIP export
workers/
  celery_app.py        # GPU-typed queue routing
  jobs/                # Async tasks split by GPU assignment
storage/               # Local file storage (git-ignored)
scripts/
  setup_models.py      # One-command model setup
  migrate.py           # Idempotent schema sync (tables + missing columns)
```

## Key conventions
- ALL inference is local. If Ollama/XTTS/Demucs aren't installed, services fall back gracefully.
- Songs are structured projects with versioning + lineage.
- Draft mode = fast/rough for iteration. Render mode = slow/clean for export.
- Section-level regeneration — don't re-render whole songs for one line change.
- Stems, transcripts, and embeddings are cached aggressively.
- Workers are split by GPU: voice (GPU 0), audio (GPU 1), CPU (mixing/export).
- Voice conversion (RVC) is the real moat — stub now, priority build next.

## API routes (all under /api)
- `POST /api/projects/` — create project
- `POST /api/songs/` — create song with lyrics
- `POST /api/upload/beat` — upload beat file
- `POST /api/upload/source` — upload source track for transformation
- `POST /api/generate/` — Pipeline 1: lyrics + beat → vocal → mix (draft/render)
- `POST /api/generate/lyrics` — generate lyrics from prompt (Ollama)
- `POST /api/generate/rewrite` — parody rewrite or section edit (Ollama)
- `POST /api/transform/separate` — separate source into stems (Demucs, cached)
- `POST /api/transform/parody` — Pipeline 2: separate → align → generate → overlay
- `POST /api/transform/align` — transcribe or align lyrics to audio
- `POST /api/personas/` — create persona
- `POST /api/personas/{id}/voice-sample` — upload voice for cloning
- `POST /api/export/` — export WAV/MP3
- `GET /api/export/download/{job_id}` — download exported file
- `GET /api/jobs/render/{job_id}` — check job status
- `GET /health` — service health check (Ollama, ffmpeg, DB)

### MMMM Studio routes (all under /api/studio)
- `POST /api/studio/sessions/` — create studio session
- `GET /api/studio/sessions/` — list sessions (optional ?project_id=)
- `GET /api/studio/sessions/{id}` — get session with tracks
- `PATCH /api/studio/sessions/{id}` — update session (bpm, key, title)
- `DELETE /api/studio/sessions/{id}` — delete session (cascades)
- `POST /api/studio/sessions/{id}/tracks` — add track (enforces tier limit)
- `POST /api/studio/tracks/{id}/upload` — upload audio file to track
- `POST /api/studio/tracks/{id}/record` — upload recorded blob
- `PATCH /api/studio/tracks/{id}` — update track (volume, pan, mute, solo)
- `DELETE /api/studio/tracks/{id}` — delete track (auto-reindex)
- `GET /api/studio/tracks/{id}/audio` — stream track audio
- `POST /api/studio/tracks/{id}/convert` — convert to instrument (MusicGen)
- `GET /api/studio/tracks/{id}/suggestions` — AI suggest instruments
- `POST /api/studio/tracks/{id}/analyze` — detect key + BPM (Pro)
- `POST /api/studio/sessions/{id}/sync` — sync all tracks to master key/BPM (Pro)
- `POST /api/studio/tracks/{id}/midi` — upload MIDI data
- `POST /api/studio/tracks/{id}/render-midi` — render MIDI to audio (FluidSynth)
- `POST /api/studio/sessions/{id}/sections` — add arrangement section
- `POST /api/studio/sessions/{id}/suggest-arrangement` — LLM suggests structure
- `POST /api/studio/sessions/{id}/mix` — render master mix
- `POST /api/studio/sessions/{id}/export` — export (mp3|wav|stems_zip|ableton_als)
- `GET /api/studio/subscription/status` — current tier (free/pro)
- `GET /api/studio/subscription/limits` — tier limits detail
