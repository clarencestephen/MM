"""Cache Service — content-addressed file cache for expensive operations.

Caches: separated stems, transcripts, persona embeddings, BPM estimates,
waveform previews, section boundaries, temporary renders.

This dramatically improves perceived speed. Don't recompute what hasn't changed.
"""
import hashlib
import json
import logging
from pathlib import Path

from backend.config import settings

log = logging.getLogger(__name__)


def _cache_key(namespace: str, *args: str) -> str:
    """Generate a cache key from namespace + content identifiers."""
    content = "|".join(args)
    h = hashlib.sha256(content.encode()).hexdigest()[:16]
    return f"{namespace}_{h}"


def get(namespace: str, *args: str) -> dict | None:
    """Retrieve cached result. Returns None on miss."""
    key = _cache_key(namespace, *args)
    cache_file = settings.cache_dir / f"{key}.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text())
        except (json.JSONDecodeError, OSError):
            return None
    return None


def put(namespace: str, *args: str, data: dict) -> None:
    """Store result in cache."""
    key = _cache_key(namespace, *args)
    cache_file = settings.cache_dir / f"{key}.json"
    try:
        cache_file.write_text(json.dumps(data))
    except OSError as e:
        log.warning(f"Cache write failed: {e}")


def get_file(namespace: str, *args: str) -> str | None:
    """Check if a cached file exists. Returns path or None."""
    key = _cache_key(namespace, *args)
    # Check for any file with this key prefix
    for f in settings.cache_dir.glob(f"{key}.*"):
        if f.suffix != ".json":
            return str(f)
    return None


def put_file(namespace: str, *args: str, src_path: str) -> str:
    """Copy a file into cache. Returns cached path."""
    import shutil
    key = _cache_key(namespace, *args)
    ext = Path(src_path).suffix
    dest = settings.cache_dir / f"{key}{ext}"
    shutil.copy2(src_path, str(dest))
    return str(dest)


def invalidate(namespace: str, *args: str) -> None:
    """Remove cached entries for a given key."""
    key = _cache_key(namespace, *args)
    for f in settings.cache_dir.glob(f"{key}.*"):
        f.unlink(missing_ok=True)


def clear_all() -> int:
    """Clear entire cache. Returns number of files removed."""
    count = 0
    for f in settings.cache_dir.iterdir():
        if f.name != ".gitkeep":
            f.unlink(missing_ok=True)
            count += 1
    return count
