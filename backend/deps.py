"""FastAPI dependencies: who is calling, and what are they allowed to do."""
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import AuthSession, User
from security import as_utc, hash_token, utc_now


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in to continue.",
                                 headers={"WWW-Authenticate": "Bearer"})
    if not authorization or not authorization.lower().startswith("bearer "):
        raise unauthorized
    session = db.query(AuthSession).filter(AuthSession.token_hash == hash_token(authorization[7:].strip())).first()
    if session is None or as_utc(session.expires_at) < utc_now() or not session.user.is_active:
        raise unauthorized
    return session.user


def require_permission(permission: str):
    """Use as `Depends(require_permission("documents.review"))`. Checked on the server, not just in the UI."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if not user.policy.can(permission):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role does not allow this action.")
        return user
    return checker
