from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    database_url: str = "postgresql://mm:mm_dev_password@localhost:5432/mm_dev"
    redis_url: str = "redis://localhost:6379/0"
    storage_path: str = "./storage"
    secret_key: str = "change-me-in-production"
    debug: bool = True
    cors_origins: str = "http://localhost:3000,http://localhost:8000"

    # Ollama (local LLM — zero API calls)
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:14b"
    ollama_model_quality: str = "qwen2.5:32b"  # for render mode

    # GPU assignment (per MODEL_DECISIONS.md)
    # GPU 0 = voice / persona / LLM
    # GPU 1 = audio / separation / alignment
    gpu_voice: int = 0
    gpu_audio: int = 1

    # Quality modes
    default_quality: str = "draft"  # draft or render

    # TTS engine: "xtts" (XTTS v2 via coqui) or "piper" (lightweight fallback)
    tts_engine: str = "xtts"
    tts_default_voice: str = "male_rap"

    # Azure Speech (optional cloud TTS — local XTTS is default)
    azure_speech_key: str = ""
    azure_speech_region: str = "eastus"

    @property
    def storage_dir(self) -> Path:
        p = Path(self.storage_path)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def beats_dir(self) -> Path:
        p = self.storage_dir / "beats"
        p.mkdir(exist_ok=True)
        return p

    @property
    def vocals_dir(self) -> Path:
        p = self.storage_dir / "vocals"
        p.mkdir(exist_ok=True)
        return p

    @property
    def stems_dir(self) -> Path:
        p = self.storage_dir / "stems"
        p.mkdir(exist_ok=True)
        return p

    @property
    def exports_dir(self) -> Path:
        p = self.storage_dir / "exports"
        p.mkdir(exist_ok=True)
        return p

    @property
    def personas_dir(self) -> Path:
        p = self.storage_dir / "personas"
        p.mkdir(exist_ok=True)
        return p

    @property
    def cache_dir(self) -> Path:
        p = self.storage_dir / "cache"
        p.mkdir(exist_ok=True)
        return p

    @property
    def studio_dir(self) -> Path:
        p = self.storage_dir / "studio"
        p.mkdir(exist_ok=True)
        return p

    @property
    def soundfonts_dir(self) -> Path:
        p = self.storage_dir / "soundfonts"
        p.mkdir(exist_ok=True)
        return p

    @property
    def sample_library_dir(self) -> Path:
        p = self.storage_dir / "sample_library"
        p.mkdir(exist_ok=True)
        return p

    # Stripe (for subscription billing)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id_pro: str = ""  # Stripe Price ID for $10/mo Pro plan

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
