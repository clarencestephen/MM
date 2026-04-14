from sqlalchemy.orm import Session
from backend.models.subscription import Subscription

# Tier limits
TIER_LIMITS = {
    "free": {
        "max_tracks": 2,
        "custom_instrument_prompts": False,
        "key_tempo_sync": False,
        "export_formats": ["mp3"],
        "sample_library_limit": 20,
        "preset_instruments": [
            "drums", "snare", "hi-hat", "clap", "bass",
            "electric guitar", "acoustic guitar", "piano",
            "synth", "strings", "choir", "trumpet",
            "saxophone", "flute", "organ",
        ],
    },
    "pro": {
        "max_tracks": 999,
        "custom_instrument_prompts": True,
        "key_tempo_sync": True,
        "export_formats": ["mp3", "wav", "stems_zip", "ableton_als"],
        "sample_library_limit": 999,
        "preset_instruments": None,  # unlimited — freeform prompts allowed
    },
}


def get_user_tier(db: Session, user_id: str) -> str:
    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if not sub or sub.status != "active":
        return "free"
    return sub.tier


def get_tier_limits(tier: str) -> dict:
    return TIER_LIMITS.get(tier, TIER_LIMITS["free"])


def check_track_limit(db: Session, user_id: str, current_track_count: int) -> dict:
    """Check if user can add another track. Returns {allowed, tier, max_tracks, upgrade_message}."""
    tier = get_user_tier(db, user_id)
    limits = get_tier_limits(tier)
    max_tracks = limits["max_tracks"]

    if current_track_count >= max_tracks:
        return {
            "allowed": False,
            "tier": tier,
            "max_tracks": max_tracks,
            "upgrade_message": f"Free plan is limited to {max_tracks} tracks. Upgrade to Pro for unlimited tracks — $10/mo",
        }
    return {"allowed": True, "tier": tier, "max_tracks": max_tracks}


def check_feature_access(db: Session, user_id: str, feature: str) -> dict:
    """Check if user has access to a specific feature."""
    tier = get_user_tier(db, user_id)
    limits = get_tier_limits(tier)

    feature_map = {
        "custom_instrument_prompts": {
            "key": "custom_instrument_prompts",
            "message": "Custom instrument prompts are a Pro feature. Upgrade for $10/mo",
        },
        "key_tempo_sync": {
            "key": "key_tempo_sync",
            "message": "Key and tempo sync is a Pro feature. Upgrade for $10/mo",
        },
        "export_wav": {
            "key": "export_formats",
            "check": lambda v: "wav" in v,
            "message": "WAV export is a Pro feature. Upgrade for $10/mo",
        },
        "export_als": {
            "key": "export_formats",
            "check": lambda v: "ableton_als" in v,
            "message": "Ableton export is a Pro feature. Upgrade for $10/mo",
        },
    }

    if feature not in feature_map:
        return {"allowed": True, "tier": tier}

    fm = feature_map[feature]
    value = limits[fm["key"]]
    if "check" in fm:
        allowed = fm["check"](value)
    else:
        allowed = bool(value)

    if not allowed:
        return {"allowed": False, "tier": tier, "upgrade_message": fm["message"]}
    return {"allowed": True, "tier": tier}
