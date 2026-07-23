#!/usr/bin/env bash
# Launch the MM WhisperX microservice.
#
# Runs the FastAPI app from `whisper_service/main.py` using the `mm-whisper`
# conda env's uvicorn (isolates whisperx deps from the main `mm` env).
#
# Default port is 8100. Override with WHISPER_PORT=... or by editing below.

set -euo pipefail

cd "$(dirname "$0")/.."

WHISPER_HOST="${WHISPER_HOST:-0.0.0.0}"
WHISPER_PORT="${WHISPER_PORT:-8100}"
WHISPER_ENV_BIN="${WHISPER_ENV_BIN:-/home/cs/anaconda3/envs/mm-whisper/bin}"

exec "${WHISPER_ENV_BIN}/uvicorn" \
    whisper_service.main:app \
    --host "${WHISPER_HOST}" \
    --port "${WHISPER_PORT}"
