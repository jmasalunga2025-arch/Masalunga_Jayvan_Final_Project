"""Dashboard numbers, notifications and the activity feed."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user
from domain.workflow import DocumentStatus
from models import ActivityLog, Document, DocumentTemplate, Notification, User
from routes.documents import visible_query
from schemas import ActivityOut, NotificationOut
from services.serializers import document_out

router = APIRouter(prefix="/api", tags=["workspace"])


def _activity_rows(db: Session, user: User, limit: int) -> list[dict]:
    query = db.query(ActivityLog)
    if user.role != "admin":
        query = query.filter(ActivityLog.user_id == user.id)
    rows = query.order_by(ActivityLog.id.desc()).limit(limit).all()
    return [{"id": a.id, "action": a.action, "entity_type": a.entity_type, "entity_id": a.entity_id, "detail": a.detail,
             "user_name": a.user.full_name if a.user else None, "created_at": a.created_at} for a in rows]


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    docs = visible_query(db, user)
    counts = dict(docs.with_entities(Document.status, func.count(Document.id)).group_by(Document.status).all())
    recent = docs.order_by(Document.updated_at.desc()).limit(5).all()
    return {
        "stats": {"total": sum(counts.values()), "drafts": counts.get(DocumentStatus.DRAFT.value, 0),
                  "pending": counts.get(DocumentStatus.PENDING.value, 0), "approved": counts.get(DocumentStatus.APPROVED.value, 0),
                  "rejected": counts.get(DocumentStatus.REJECTED.value, 0), "templates": db.query(DocumentTemplate).count()},
        "recent_documents": [document_out(d, user) for d in recent],
        "recent_activity": _activity_rows(db, user, 8),
    }


@router.get("/activity", response_model=list[ActivityOut])
def activity(limit: int = 50, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _activity_rows(db, user, max(1, min(limit, 200)))


@router.get("/notifications", response_model=list[NotificationOut])
def notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(30).all()


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
def read_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False)).update({"is_read": True}, synchronize_session=False)
    db.commit()


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_one(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.get(Notification, notification_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(404, "Notification not found.")
    row.is_read = True
    db.commit()
