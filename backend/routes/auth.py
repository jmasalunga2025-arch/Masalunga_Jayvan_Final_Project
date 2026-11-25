from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user
from models import AuthSession, Document, User
from schemas import PasswordChange, ProfileUpdate, TokenOut, UserLogin, UserOut, UserRegister
from security import LoginThrottle, as_utc, hash_password, hash_token, new_token, utc_now, verify_password
from services.activity import log_activity
from services.serializers import user_out
from datetime import timedelta

router = APIRouter(prefix="/api/auth", tags=["auth"])
SESSION_DAYS = 7
throttle = LoginThrottle(limit=5, window=300)
_DUMMY_HASH = hash_password("not-a-real-password-1")  # keeps login timing similar for unknown users


def _start_session(db: Session, user: User) -> str:
    db.query(AuthSession).filter(AuthSession.expires_at < utc_now()).delete(synchronize_session=False)
    token = new_token()
    db.add(AuthSession(token_hash=hash_token(token), user_id=user.id, expires_at=utc_now() + timedelta(days=SESSION_DAYS)))
    return token


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    username = payload.username.lower()
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(409, "That username is already taken.")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "An account with that email already exists.")
    first_user = db.query(User).count() == 0
    user = User(username=username, email=payload.email, full_name=payload.full_name,
                password_hash=hash_password(payload.password), role="admin" if first_user else "employee")
    db.add(user)
    db.flush()
    if first_user:  # documents from before accounts existed become the first admin's
        db.query(Document).filter(Document.owner_id.is_(None)).update({"owner_id": user.id}, synchronize_session=False)
    token = _start_session(db, user)
    log_activity(db, user, "register", "user", user.id, "Account created" + (" (administrator)" if first_user else ""))
    db.commit()
    db.refresh(user)
    return {"token": token, "user": user_out(user)}


@router.post("/login", response_model=TokenOut)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    key = payload.identifier.strip().lower()
    if throttle.is_blocked(key):
        raise HTTPException(429, "Too many failed attempts. Please wait a few minutes and try again.")
    user = db.query(User).filter(or_(User.username == key, User.email == key)).first()
    valid = verify_password(payload.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not valid:
        throttle.record_failure(key)
        raise HTTPException(401, "Incorrect username/email or password.")
    if not user.is_active:
        raise HTTPException(403, "This account has been disabled. Contact an administrator.")
    throttle.reset(key)
    token = _start_session(db, user)
    log_activity(db, user, "login", "user", user.id, "Signed in")
    db.commit()
    return {"token": token, "user": user_out(user)}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    token = (authorization or "")[7:].strip()
    db.query(AuthSession).filter(AuthSession.token_hash == hash_token(token)).delete(synchronize_session=False)
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.patch("/me", response_model=UserOut)
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.email and payload.email != user.email:
        if db.query(User).filter(User.email == payload.email, User.id != user.id).first():
            raise HTTPException(409, "An account with that email already exists.")
        user.email = payload.email
    if payload.full_name:
        user.full_name = payload.full_name.strip()
    log_activity(db, user, "profile_update", "user", user.id, "Profile updated")
    db.commit()
    return user_out(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChange, authorization: str | None = Header(default=None),
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(400, "Your current password is incorrect.")
    user.password_hash = hash_password(payload.new_password)
    keep = hash_token((authorization or "")[7:].strip())
    db.query(AuthSession).filter(AuthSession.user_id == user.id, AuthSession.token_hash != keep).delete(synchronize_session=False)  # sign out other devices
    log_activity(db, user, "password_change", "user", user.id, "Password changed")
    db.commit()
