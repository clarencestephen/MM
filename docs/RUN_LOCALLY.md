# Run MM Locally

## Prerequisites

- Python 3.12+
- PostgreSQL 16
- Redis 7
- ffmpeg (`sudo apt install ffmpeg`)
- Ollama (`curl -fsSL https://ollama.com/install.sh | sh`)
- NVIDIA GPU (recommended, CPU works but slower)

## Option 1: Docker Compose (recommended)

```bash
# Start everything (Postgres, Redis, Ollama, API, GPU workers)
docker-compose up -d

# Pull the LLM model (first time only)
docker exec -it mm-ollama-1 ollama pull qwen2.5:14b

# API: http://localhost:8000
# Swagger docs: http://localhost:8000/docs
# Health check: http://localhost:8000/health
```

## Option 2: Manual setup

```bash
# 1. Install core deps
pip install -r requirements.txt

# 2. Install ML model deps (optional — graceful fallbacks without these)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements-models.txt

# 3. Start Ollama and pull the model
ollama serve &
ollama pull qwen2.5:14b

# 4. Create database
createdb mm_dev

# 5. Copy and configure env
cp .env.example .env

# 6. Create tables
python scripts/create_tables.py

# 7. Run model setup check
python scripts/setup_models.py

# 8. Start the API
uvicorn backend.main:app --reload --port 8000

# 9. (Optional) Start Celery workers
celery -A workers.celery_app worker --loglevel=info -Q voice,generation,llm -n voice@%h &
celery -A workers.celery_app worker --loglevel=info -Q audio,separation,alignment -n audio@%h &
celery -A workers.celery_app worker --loglevel=info -Q export,mixing,default -n cpu@%h &
```

## Test Pipeline 1: Beat + Lyrics → Song

```bash
# 1. Create project
curl -s -X POST http://localhost:8000/api/projects/ \
  -H "Content-Type: application/json" \
  -d '{"title": "My First Track", "user_id": "user1"}' | python -m json.tool

# 2. Create song (replace PROJECT_ID)
curl -s -X POST http://localhost:8000/api/songs/ \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Demo Track",
    "lyrics": "[Verse]\nI came up from nothing now I got it all\nEvery day I hustle never gonna fall\nCity lights are shining and the bass is loud\nStep up to the mic and move the crowd\n\n[Hook]\nThis is my moment yeah\nThis is my time\nEverybody watching\nWhile I shine",
    "genre": "hip_hop",
    "project_id": "PROJECT_ID"
  }' | python -m json.tool

# 3. Upload a beat
curl -s -X POST http://localhost:8000/api/upload/beat \
  -F "song_id=SONG_ID" \
  -F "file=@/path/to/beat.mp3" | python -m json.tool

# 4. Generate (draft mode — fast)
curl -s -X POST http://localhost:8000/api/generate/ \
  -H "Content-Type: application/json" \
  -d '{"song_id": "SONG_ID", "quality": "draft"}' | python -m json.tool

# 5. Export WAV
curl -s -X POST http://localhost:8000/api/export/ \
  -H "Content-Type: application/json" \
  -d '{"song_id": "SONG_ID", "format": "wav"}' | python -m json.tool
```

## Test Pipeline 2: Source → Parody

```bash
# 1. Create song with parody lyrics
curl -s -X POST http://localhost:8000/api/songs/ \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Parody Track",
    "lyrics": "[Verse]\nYour parody lyrics here\nMake them match the original cadence",
    "genre": "hip_hop",
    "project_id": "PROJECT_ID"
  }' | python -m json.tool

# 2. Upload source track
curl -s -X POST http://localhost:8000/api/upload/source \
  -F "song_id=SONG_ID" \
  -F "file=@/path/to/source.mp3" | python -m json.tool

# 3. Run full parody pipeline (separate + align + generate + overlay)
curl -s -X POST http://localhost:8000/api/transform/parody \
  -H "Content-Type: application/json" \
  -d '{"song_id": "SONG_ID", "mode": "parody", "quality": "draft"}' | python -m json.tool

# 4. Export
curl -s -X POST http://localhost:8000/api/export/ \
  -H "Content-Type: application/json" \
  -d '{"song_id": "SONG_ID", "format": "wav"}' | python -m json.tool
```

## Test LLM-powered features

```bash
# Generate lyrics from a prompt (uses local Ollama)
curl -s -X POST http://localhost:8000/api/generate/lyrics \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a dark trap song about late night in the city", "genre": "hip_hop", "mood": "dark"}' | python -m json.tool

# Parody rewrite
curl -s -X POST http://localhost:8000/api/generate/rewrite \
  -H "Content-Type: application/json" \
  -d '{
    "song_id": "SONG_ID",
    "original_lyrics": "I got money on my mind all day\nHustling hard in every single way",
    "new_theme": "cats taking over the world"
  }' | python -m json.tool

# Align lyrics to audio
curl -s -X POST http://localhost:8000/api/transform/align \
  -H "Content-Type: application/json" \
  -d '{"song_id": "SONG_ID", "lyrics": "I got money on my mind"}' | python -m json.tool
```

## Google Colab

For users without a local GPU, use the Colab notebook approach:

```python
# In a Colab cell:
!pip install llama-cpp-python
from llama_cpp import Llama
llm = Llama.from_pretrained("bartowski/Qwen2.5-14B-Instruct-GGUF", filename="*Q4_K_M.gguf")
```

See `requirements-models.txt` for the full model dependency list.
