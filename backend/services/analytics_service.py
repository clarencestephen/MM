"""Analytics service for MM — tracks KPIs, computes momentum signals.

Metrics tracked:
- Signups (new users per day)
- Active users (users who did anything)
- Sessions created
- Tracks recorded
- Instrument conversions
- Exports (by format)
- Upgrades (free → pro)

Momentum signals:
- 7-day moving average vs 21-day moving average
- Acceleration/deceleration detection
"""
import json
import logging
from datetime import date, datetime, timedelta, timezone
from collections import defaultdict

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from backend.models.analytics import DailyMetric, EventLog
from backend.models.user import User
from backend.models.studio_session import StudioSession
from backend.models.studio_track import StudioTrack
from backend.models.subscription import Subscription

log = logging.getLogger(__name__)


def log_event(db: Session, event_type: str, user_id: str | None = None, metadata: dict | None = None):
    """Log an analytics event."""
    event = EventLog(
        event_type=event_type,
        user_id=user_id,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(event)
    db.commit()


def compute_daily_metrics(db: Session, target_date: date | None = None):
    """Compute and store daily metrics. Idempotent — overwrites existing data for the date."""
    if target_date is None:
        target_date = date.today()

    # Clear existing metrics for this date
    db.query(DailyMetric).filter(DailyMetric.date == target_date).delete()

    start = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    metrics = []

    # Signups
    signups = db.query(User).filter(
        User.created_at >= start, User.created_at < end
    ).count()
    metrics.append(DailyMetric(date=target_date, metric_name="signups", value=signups))

    # Sessions created
    sessions = db.query(StudioSession).filter(
        StudioSession.created_at >= start, StudioSession.created_at < end
    ).count()
    metrics.append(DailyMetric(date=target_date, metric_name="sessions_created", value=sessions))

    # Tracks recorded
    tracks = db.query(StudioTrack).filter(
        StudioTrack.created_at >= start, StudioTrack.created_at < end
    ).count()
    metrics.append(DailyMetric(date=target_date, metric_name="tracks_recorded", value=tracks))

    # Pro subscribers
    pro_count = db.query(Subscription).filter(
        Subscription.tier == "pro", Subscription.status == "active"
    ).count()
    metrics.append(DailyMetric(date=target_date, metric_name="pro_subscribers", value=pro_count))

    # Total users
    total_users = db.query(User).count()
    metrics.append(DailyMetric(date=target_date, metric_name="total_users", value=total_users))

    # Events by type
    events = db.query(
        EventLog.event_type, func.count(EventLog.id)
    ).filter(
        EventLog.created_at >= start, EventLog.created_at < end
    ).group_by(EventLog.event_type).all()

    for event_type, count in events:
        metrics.append(DailyMetric(
            date=target_date,
            metric_name=f"events_{event_type}",
            value=count,
        ))

    for m in metrics:
        db.add(m)
    db.commit()
    log.info(f"Computed {len(metrics)} daily metrics for {target_date}")


def get_kpi_dashboard(db: Session, days: int = 30) -> dict:
    """Get KPI dashboard data with momentum signals."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days + 21)  # extra for MA calculation

    metrics = db.query(DailyMetric).filter(
        DailyMetric.date >= start_date,
        DailyMetric.date <= end_date,
    ).all()

    # Organize by metric name and date
    by_metric: dict[str, dict[date, float]] = defaultdict(dict)
    for m in metrics:
        by_metric[m.metric_name][m.date] = m.value

    # Core KPIs
    kpis = {}
    for metric_name in ["signups", "sessions_created", "tracks_recorded", "pro_subscribers", "total_users"]:
        series = by_metric.get(metric_name, {})
        dates = sorted(series.keys())

        # Recent values
        today_val = series.get(end_date, 0)
        yesterday_val = series.get(end_date - timedelta(days=1), 0)

        # Moving averages
        ma7 = _moving_average(series, end_date, 7)
        ma21 = _moving_average(series, end_date, 21)
        prev_ma7 = _moving_average(series, end_date - timedelta(days=1), 7)

        # Momentum
        if ma21 > 0:
            momentum = round((ma7 - ma21) / ma21 * 100, 1)
        else:
            momentum = 0.0

        # Acceleration (change in 7d MA)
        if prev_ma7 > 0:
            acceleration = round((ma7 - prev_ma7) / prev_ma7 * 100, 1)
        else:
            acceleration = 0.0

        # Daily series for charting (last N days)
        chart_data = []
        for i in range(days):
            d = end_date - timedelta(days=days - 1 - i)
            chart_data.append({
                "date": d.isoformat(),
                "value": series.get(d, 0),
            })

        kpis[metric_name] = {
            "current": today_val,
            "previous": yesterday_val,
            "change": today_val - yesterday_val,
            "ma7": round(ma7, 2),
            "ma21": round(ma21, 2),
            "momentum_pct": momentum,
            "acceleration_pct": acceleration,
            "trend": "accelerating" if acceleration > 0 else "decelerating" if acceleration < 0 else "flat",
            "signal": "bullish" if momentum > 0 and acceleration > 0 else "bearish" if momentum < 0 and acceleration < 0 else "mixed",
            "chart": chart_data,
        }

    return {
        "date": end_date.isoformat(),
        "period_days": days,
        "kpis": kpis,
    }


def generate_weekly_report(db: Session) -> dict:
    """Generate weekly KPI report with actionable items."""
    dashboard = get_kpi_dashboard(db, days=30)
    kpis = dashboard["kpis"]

    actionable_items = []

    # Analyze each KPI
    signups = kpis.get("signups", {})
    if signups.get("signal") == "bearish":
        actionable_items.append({
            "priority": "high",
            "area": "Growth",
            "finding": f"Signups decelerating. 7d MA ({signups['ma7']}) below 21d MA ({signups['ma21']}). Momentum: {signups['momentum_pct']}%",
            "action": "Review acquisition channels. Consider promotional push or content marketing boost.",
        })
    elif signups.get("signal") == "bullish":
        actionable_items.append({
            "priority": "info",
            "area": "Growth",
            "finding": f"Signups accelerating! 7d MA ({signups['ma7']}) above 21d MA ({signups['ma21']}). Momentum: +{signups['momentum_pct']}%",
            "action": "Capitalize on momentum. Double down on what's working.",
        })

    sessions = kpis.get("sessions_created", {})
    if sessions.get("ma7", 0) > 0:
        conversion = round(sessions["ma7"] / max(signups.get("ma7", 1), 1) * 100, 1)
        actionable_items.append({
            "priority": "medium" if conversion < 50 else "info",
            "area": "Activation",
            "finding": f"Signup → Session conversion: {conversion}%",
            "action": "Improve onboarding flow" if conversion < 50 else "Conversion rate healthy",
        })

    tracks = kpis.get("tracks_recorded", {})
    if tracks.get("signal") == "bearish":
        actionable_items.append({
            "priority": "medium",
            "area": "Engagement",
            "finding": f"Track recording declining. {tracks['trend']}.",
            "action": "Consider adding more sample packs, tutorials, or templates to drive engagement.",
        })

    pro = kpis.get("pro_subscribers", {})
    if pro.get("current", 0) == 0:
        actionable_items.append({
            "priority": "high",
            "area": "Revenue",
            "finding": "No Pro subscribers yet.",
            "action": "Implement Stripe checkout. Add trial period or launch promotion.",
        })

    return {
        "report_title": f"[MM] KPI Report & Actionable Items — {date.today().isoformat()}",
        "dashboard": dashboard,
        "actionable_items": actionable_items,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _moving_average(series: dict[date, float], end_date: date, window: int) -> float:
    values = []
    for i in range(window):
        d = end_date - timedelta(days=i)
        values.append(series.get(d, 0))
    return sum(values) / window if values else 0
