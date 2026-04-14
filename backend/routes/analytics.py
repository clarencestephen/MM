"""Analytics routes — KPI dashboard, weekly report, metrics."""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db

log = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
def get_dashboard(days: int = 30, db: Session = Depends(get_db)):
    """Get KPI dashboard with momentum signals."""
    from backend.services.analytics_service import get_kpi_dashboard
    return get_kpi_dashboard(db, days=days)


@router.get("/weekly-report")
def get_weekly_report(db: Session = Depends(get_db)):
    """Generate weekly KPI report with actionable items."""
    from backend.services.analytics_service import generate_weekly_report
    return generate_weekly_report(db)


@router.post("/compute")
def compute_metrics(db: Session = Depends(get_db)):
    """Compute daily metrics for today. Can be called by cron."""
    from backend.services.analytics_service import compute_daily_metrics
    compute_daily_metrics(db)
    return {"status": "computed"}


@router.post("/event")
def log_analytics_event(
    event_type: str,
    user_id: str | None = None,
    db: Session = Depends(get_db),
):
    """Log an analytics event."""
    from backend.services.analytics_service import log_event
    log_event(db, event_type, user_id)
    return {"status": "logged"}
