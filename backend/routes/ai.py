from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user
from models import DocumentTemplate, User
from routes.documents import get_visible, render_document
from schemas import AIChatRequest, AICheckRequest, AISuggestRequest, AISummarizeRequest, AITransformRequest
from services.ai_service import AIAssistantService, AIUnavailable, ai_status
from services.doc_checker import check_document
from services.rendering import derive_fields, render_with_template

router = APIRouter(prefix="/api/ai", tags=["ai"])

CONSENT_MESSAGE = "Please confirm that you agree to send this text to the AI provider."


def _need_consent(consent: bool) -> None:
    if not consent:
        raise HTTPException(400, CONSENT_MESSAGE)


def _run(fn, *args):
    try:
        return fn(*args)
    except AIUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc


def _template(db: Session, template_id: int) -> DocumentTemplate:
    template = db.get(DocumentTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Template not found.")
    return template


@router.get("/status")
def status(user: User = Depends(get_current_user)):
    return ai_status()


@router.post("/transform")
def transform(payload: AITransformRequest, user: User = Depends(get_current_user)):
    _need_consent(payload.consent)
    return {"original": payload.text, "suggestion": _run(AIAssistantService().transform, payload.action, payload.text)}


@router.post("/suggest")
def suggest(payload: AISuggestRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _need_consent(payload.consent)
    template = _template(db, payload.template_id)
    fields = template.fields or derive_fields(template.body)
    target = next((f for f in fields if f["key"] == payload.field_key), None)
    if target is None:
        raise HTTPException(404, "That field is not part of this template.")
    labels = {f["key"]: f["label"] for f in fields}
    context = {labels.get(k, k): v for k, v in payload.values.items() if k != payload.field_key and v}
    return {"suggestion": _run(AIAssistantService().suggest, template.name, target["label"], context)}


@router.post("/chat")
def chat(payload: AIChatRequest, user: User = Depends(get_current_user)):
    _need_consent(payload.consent)
    return {"reply": _run(AIAssistantService().chat, [m.model_dump() for m in payload.messages])}


@router.post("/summarize")
def summarize(payload: AISummarizeRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _need_consent(payload.consent)
    if payload.document_id is not None:
        text = get_visible(db, user, payload.document_id).content
    elif payload.text and payload.text.strip():
        text = payload.text
    else:
        raise HTTPException(422, "Choose a document or paste some text to summarize.")
    return {"summary": _run(AIAssistantService().summarize, text)}


@router.post("/check")
def check(payload: AICheckRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Local, rule-based checks. Nothing is sent to an external AI service."""
    t = _template(db, payload.template_id)
    fields = t.fields or derive_fields(t.body)
    rendered = render_with_template(t.layout or "plain", fields, t.config, t.body, t.name, payload.values)
    return {"issues": check_document(fields, payload.values, rendered), "missing": rendered["missing"]}
