import re
from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator


def _ensure_utc(dt: datetime) -> datetime:
    """SQLite hands back naive datetimes (stored as UTC); tag them so browsers show the right local time."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


UTCDateTime = Annotated[datetime, AfterValidator(_ensure_utc)]
MAX_FIELD_CHARS = 20000


def _clean_values(values: dict | None) -> dict | None:
    if values is None:
        return None
    if len(values) > 80:
        raise ValueError("Too many fields.")
    out = {}
    for k, v in values.items():
        text = "" if v is None else str(v)
        if len(text) > MAX_FIELD_CHARS:
            raise ValueError(f"Field '{k}' is too long.")
        out[str(k)[:64]] = text
    return out


# ---------------------------------------------------------------- templates
class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(default="General", max_length=80)
    body: str = Field(min_length=1)


class TemplateOut(TemplateCreate):
    id: int
    created_at: UTCDateTime
    slug: str | None = None
    description: str | None = None
    layout: str = "plain"
    accent: str = "#6D28D9"
    frame: str = "none"
    is_builtin: bool = False
    fields: list[dict[str, Any]] = []
    is_favorite: bool = False
    use_count: int = 0
    last_used_at: UTCDateTime | None = None
    model_config = ConfigDict(from_attributes=True)


class PreviewRequest(BaseModel):
    values: dict[str, Any] = {}
    title: str | None = None

    @field_validator("values")
    @classmethod
    def _v(cls, v):
        return _clean_values(v)


# ---------------------------------------------------------------- documents
class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    template_id: int | None = None
    content: str | None = None            # still accepted (plain-text documents)
    field_values: dict[str, Any] | None = None
    action: str = "draft"                 # "draft" or "submit" (as before)

    @field_validator("action")
    @classmethod
    def _a(cls, v):
        return "submit" if (v or "").strip().lower() in ("submit", "submitted", "pending", "pending approval") else "draft"

    @field_validator("field_values")
    @classmethod
    def _v(cls, v):
        return _clean_values(v)


class DocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = None
    field_values: dict[str, Any] | None = None

    @field_validator("field_values")
    @classmethod
    def _v(cls, v):
        return _clean_values(v)


class ApprovalDecision(BaseModel):
    decision: str
    comment: str = Field(default="", max_length=2000)


class DocumentOut(BaseModel):
    id: int
    title: str
    template_id: int | None
    content: str
    status: str
    created_at: UTCDateTime
    updated_at: UTCDateTime
    approval_comment: str | None
    reference_no: str | None = None
    template_name: str | None = None
    template_category: str | None = None
    layout: str = "plain"
    owner_id: int | None = None
    owner_name: str | None = None
    reviewer_name: str | None = None
    submitted_at: UTCDateTime | None = None
    reviewed_at: UTCDateTime | None = None
    field_values: dict[str, Any] = {}
    can_edit: bool = False
    can_delete: bool = False
    can_submit: bool = False
    model_config = ConfigDict(from_attributes=True)


class ApprovalOut(BaseModel):
    id: int
    document_id: int
    document_title: str | None = None
    reviewer_name: str | None = None
    decision: str
    comment: str
    created_at: UTCDateTime


class VersionOut(BaseModel):
    id: int
    version_no: int
    title: str
    content: str
    note: str
    author_name: str | None = None
    created_at: UTCDateTime


# ---------------------------------------------------------------- accounts
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _password_ok(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if len(v) > 128:
        raise ValueError("Password is too long.")
    if v.isdigit() or v.isalpha():
        raise ValueError("Use a mix of letters and numbers.")
    return v


class UserRegister(BaseModel):
    username: str
    email: str
    full_name: str = Field(min_length=2, max_length=120)
    password: str

    @field_validator("username")
    @classmethod
    def _u(cls, v):
        v = v.strip()
        if not USERNAME_RE.match(v):
            raise ValueError("Username must be 3-32 characters: letters, numbers, dot, dash or underscore.")
        return v

    @field_validator("email")
    @classmethod
    def _e(cls, v):
        v = v.strip().lower()
        if not EMAIL_RE.match(v) or len(v) > 160:
            raise ValueError("Enter a valid email address.")
        return v

    @field_validator("full_name")
    @classmethod
    def _n(cls, v):
        return v.strip()

    @field_validator("password")
    @classmethod
    def _p(cls, v):
        return _password_ok(v)


class UserLogin(BaseModel):
    identifier: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    role_label: str = ""
    is_active: bool = True
    created_at: UTCDateTime
    permissions: list[str] = []
    model_config = ConfigDict(from_attributes=True)


class TokenOut(BaseModel):
    token: str
    user: UserOut


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: str | None = None

    @field_validator("email")
    @classmethod
    def _e(cls, v):
        if v is None:
            return v
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address.")
        return v


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _p(cls, v):
        return _password_ok(v)


class AdminUserUpdate(BaseModel):
    role: Literal["admin", "employee", "approver"] | None = None
    is_active: bool | None = None


class NotificationOut(BaseModel):
    id: int
    message: str
    link: str
    is_read: bool
    created_at: UTCDateTime
    model_config = ConfigDict(from_attributes=True)


class ActivityOut(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int | None
    detail: str
    user_name: str | None = None
    created_at: UTCDateTime


# ---------------------------------------------------------------- AI
class _AIConsent(BaseModel):
    consent: bool = False   # the user must have agreed to send this text to the AI provider


class AITransformRequest(_AIConsent):
    action: Literal["improve", "rewrite", "shorten", "correct", "formalize"]
    text: str = Field(min_length=1, max_length=8000)


class AISuggestRequest(_AIConsent):
    template_id: int
    field_key: str
    values: dict[str, Any] = {}

    @field_validator("values")
    @classmethod
    def _v(cls, v):
        return _clean_values(v)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AIChatRequest(_AIConsent):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)


class AISummarizeRequest(_AIConsent):
    document_id: int | None = None
    text: str | None = Field(default=None, max_length=8000)


class AICheckRequest(BaseModel):
    template_id: int
    values: dict[str, Any] = {}

    @field_validator("values")
    @classmethod
    def _v(cls, v):
        return _clean_values(v)
