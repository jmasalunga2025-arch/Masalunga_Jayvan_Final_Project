"""Activity log + in-app notifications. Callers commit the session."""
from sqlalchemy.orm import Session

from models import ActivityLog, Notification, User


def log_activity(db: Session, user: User | None, action: str, entity_type: str = "", entity_id: int | None = None, detail: str = "") -> None:
    db.add(ActivityLog(user_id=user.id if user else None, action=action, entity_type=entity_type,
                       entity_id=entity_id, detail=detail[:300]))


def notify(db: Session, user_id: int | None, message: str, link: str = "") -> None:
    if user_id:
        db.add(Notification(user_id=user_id, message=message[:300], link=link))


def notify_reviewers(db: Session, message: str, link: str, exclude_user_id: int | None = None) -> None:
    for user in db.query(User).filter(User.is_active.is_(True), User.role.in_(["approver", "admin"])).all():
        if user.id != exclude_user_id:
            notify(db, user.id, message, link)
