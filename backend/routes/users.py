from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from deps import require_permission
from domain.roles import PERM_MANAGE_USERS
from models import AuthSession, User
from schemas import AdminUserUpdate, UserOut
from services.activity import log_activity
from services.serializers import user_out

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_permission(PERM_MANAGE_USERS))):
    return [user_out(u) for u in db.query(User).order_by(User.created_at).all()]


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: AdminUserUpdate, db: Session = Depends(get_db),
                admin: User = Depends(require_permission(PERM_MANAGE_USERS))):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found.")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot change your own role or disable your own account.")
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
        if not payload.is_active:
            db.query(AuthSession).filter(AuthSession.user_id == user.id).delete(synchronize_session=False)
    log_activity(db, admin, "user_update", "user", user.id, f"{user.username}: role={user.role}, active={user.is_active}")
    db.commit()
    return user_out(user)
