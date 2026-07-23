# MM

**AI-native Hip Hop music creation platform. 100% local. Zero API calls.**

Upload beats, generate vocals, separate stems, create parodies, build your AI artist voice — all running on your own GPU.

## What it does

| Pipeline | Flow |
|----------|------|
| **Create** | Upload beat → paste lyrics → generate rap vocal → mix → export WAV |
| **Transform** | Upload source → separate vocals → write parody → generate new vocal → overlay → export |
| **Identity** | Upload your voice → create persona → reuse across songs |

## Stack

Everything runs locally. No cloud APIs, no subscriptions, no data leaves your machine.

- **LLM**: Ollama + Qwen 2.5 (prompt parsing, lyric generation, parody rewriting)
- **Vocals**: XTTS v2 with voice cloning
- **Separation**: Demucs (vocal/instrumental splitting)
- **Alignment**: WhisperX + torchaudio (lyrics-to-audio timing)
- **Voice Identity**: RVC voice conversion (coming soon)
- **Backend**: FastAPI + PostgreSQL + Redis + Celery
- **Audio**: pydub + ffmpeg

## Quick start

```bash
# 1. Clone (private repo — requires access)
git clone https://github.com/clarencestephen/MM.git && cd MM

# 2. Install Ollama + pull the LLM
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:14b

# 3. Start with Docker
docker-compose up -d

# 4. Open
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

### Without Docker

```bash
pip install -r requirements.txt
pip install -r requirements-models.txt  # optional, has graceful fallbacks

# Start Postgres + Redis yourself, then:
python scripts/migrate.py
uvicorn backend.main:app --reload
```

### First-time model setup

```bash
python scripts/setup_models.py
```

Checks Ollama, pulls models, verifies GPU, reports status.

## GPU strategy

| GPU | Workload |
|-----|----------|
| GPU 0 | Voice generation, persona conversion, LLM |
| GPU 1 | Source separation, alignment, audio transforms |
| CPU | API server, mixing, export, orchestration |

Single GPU works fine — everything shares it. Dual GPU is optimal.

## Genre focus

Optimized for Hip Hop, Melodic Rap, R&B, and Lo-fi. Not trying to be "all music."

The wedge is **editability + transformation + vocal identity**, not generic text-to-song.

## License

Proprietary. All rights reserved. This code is private and confidential.
