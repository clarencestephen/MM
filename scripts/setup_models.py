#!/usr/bin/env python3
"""One-command setup: pull all required local models.

Run this after installing dependencies:
    python scripts/setup_models.py

This pulls:
    - Ollama LLM (Qwen 2.5 14B) for prompt parsing + lyrics
    - XTTS v2 downloads automatically on first use
    - Demucs downloads automatically on first use
"""
import subprocess
import sys
import shutil


def main():
    print("=" * 60)
    print("MM: Model Setup")
    print("=" * 60)

    # 1. Check Ollama
    print("\n[1/4] Checking Ollama...")
    if shutil.which("ollama"):
        print("  Ollama found.")
    else:
        print("  Ollama not found. Install from: https://ollama.com")
        print("  curl -fsSL https://ollama.com/install.sh | sh")
        sys.exit(1)

    # 2. Pull Ollama models
    print("\n[2/4] Pulling Ollama models...")
    models = ["qwen2.5:14b"]
    for model in models:
        print(f"  Pulling {model}...")
        result = subprocess.run(
            ["ollama", "pull", model],
            capture_output=False,
        )
        if result.returncode != 0:
            print(f"  WARNING: Failed to pull {model}")
        else:
            print(f"  {model} ready.")

    # 3. Check ffmpeg
    print("\n[3/4] Checking ffmpeg...")
    if shutil.which("ffmpeg"):
        print("  ffmpeg found.")
    else:
        print("  ffmpeg not found. Install:")
        print("    Ubuntu/Debian: sudo apt install ffmpeg")
        print("    macOS: brew install ffmpeg")
        print("    Windows: choco install ffmpeg")

    # 4. Check GPU
    print("\n[4/4] Checking GPU...")
    try:
        import torch
        if torch.cuda.is_available():
            count = torch.cuda.device_count()
            for i in range(count):
                name = torch.cuda.get_device_name(i)
                mem = torch.cuda.get_device_properties(i).total_mem / (1024**3)
                print(f"  GPU {i}: {name} ({mem:.1f} GB)")
            if count >= 2:
                print("  Dual-GPU detected — voice on GPU 0, audio on GPU 1")
            else:
                print("  Single GPU — all workloads share GPU 0")
        else:
            print("  No CUDA GPU detected. Will run on CPU (slower).")
    except ImportError:
        print("  PyTorch not installed. pip install torch torchaudio")

    print("\n" + "=" * 60)
    print("Setup complete. Start with:")
    print("  docker-compose up -d")
    print("  # or")
    print("  uvicorn backend.main:app --reload")
    print("=" * 60)


if __name__ == "__main__":
    main()
