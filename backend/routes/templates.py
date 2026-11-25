from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user, require_permission
from domain.documents import extract_placeholders
from domain.roles import PERM_MANAGE_TEMPLATES
from models import Document, DocumentTemplate, TemplateFavorite, TemplateUse, User
from schemas import PreviewRequest, TemplateCreate, TemplateOut
from services.activity import log_activity
from services.rendering import derive_fields, render_with_template
from services.serializers import template_out

router = APIRouter(prefix="/api/templates", tags=["templates"])


def _context(db: Session, user: User):
    favorites = {f.template_id for f in db.query(TemplateFavorite).filter(TemplateFavorite.user_id == user.id)}
    uses = {u.template_id: u for u in db.query(TemplateUse).filter(TemplateUse.user_id == user.id)}
    return favorites, uses


def _get_or_404(db: Session, template_id: int) -> DocumentTemplate:
    template = db.get(DocumentTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Template not found.")
    return template


@router.get("", response_model=list[TemplateOut])
def list_templates(q: str | None = None, category: str | None = None, favorites: bool = False,
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(DocumentTemplate)
    if category:
        query = query.filter(DocumentTemplate.category == category)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(DocumentTemplate.name.ilike(like) | DocumentTemplate.description.ilike(like) | DocumentTemplate.category.ilike(like))
    fav_ids, uses = _context(db, user)
    items = [template_out(t, fav_ids, uses) for t in query.order_by(DocumentTemplate.category, DocumentTemplate.id).all()]
    return [t for t in items if t["is_favorite"]] if favorites else items


@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [c for (c,) in db.query(DocumentTemplate.category).distinct().order_by(DocumentTemplate.category).all()]


@router.get("/recent", response_model=list[TemplateOut])
def recent_templates(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    fav_ids, uses = _context(db, user)
    rows = (db.query(DocumentTemplate).join(TemplateUse, TemplateUse.template_id == DocumentTemplate.id)
            .filter(TemplateUse.user_id == user.id).order_by(TemplateUse.last_used_at.desc()).limit(6).all())
    return [template_out(t, fav_ids, uses) for t in rows]


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(payload: TemplateCreate, db: Session = Depends(get_db),
                    user: User = Depends(require_permission(PERM_MANAGE_TEMPLATES))):
    if not extract_placeholders(payload.body):
        raise HTTPException(422, "Add at least one {{placeholder}} so the generator has something to fill in.")
    template = DocumentTemplate(name=payload.name.strip(), category=payload.category.strip() or "General", body=payload.body,
                                layout="plain", description="Custom plain-text template.", is_builtin=False)
    db.add(template)
    db.flush()
    log_activity(db, user, "template_create", "template", template.id, template.name)
    db.commit()
    return template_out(template)


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    fav_ids, uses = _context(db, user)
    return template_out(_get_or_404(db, template_id), fav_ids, uses)


@router.get("/{template_id}/placeholders")
def get_placeholders(template_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    template = _get_or_404(db, template_id)
    fields = template.fields or derive_fields(template.body)
    return {"placeholders": [f["key"] for f in fields], "fields": fields}


@router.post("/{template_id}/preview")
def preview(template_id: int, payload: PreviewRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Live preview: same layout engine the DOCX/PDF downloads use."""
    t = _get_or_404(db, template_id)
    return render_with_template(t.layout or "plain", t.fields or derive_fields(t.body), t.config, t.body,
                                payload.title or t.name, payload.values)


@router.post("/{template_id}/favorite")
def toggle_favorite(template_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _get_or_404(db, template_id)
    row = db.query(TemplateFavorite).filter_by(user_id=user.id, template_id=template_id).first()
    if row:
        db.delete(row)
    else:
        db.add(TemplateFavorite(user_id=user.id, template_id=template_id))
    db.commit()
    return {"is_favorite": row is None}


def record_template_use(db: Session, user: User, template_id: int) -> None:
    row = db.query(TemplateUse).filter_by(user_id=user.id, template_id=template_id).first()
    if row:
        row.use_count += 1
        row.last_used_at = datetime.now(timezone.utc)
    else:
        db.add(TemplateUse(user_id=user.id, template_id=template_id))


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: int, db: Session = Depends(get_db), user: User = Depends(require_permission(PERM_MANAGE_TEMPLATES))):
    template = _get_or_404(db, template_id)
    if template.is_builtin:
        raise HTTPException(400, "Built-in templates cannot be deleted.")
    db.query(Document).filter(Document.template_id == template_id).update({"template_id": None}, synchronize_session=False)  # documents keep their text
    db.query(TemplateFavorite).filter_by(template_id=template_id).delete(synchronize_session=False)
    db.query(TemplateUse).filter_by(template_id=template_id).delete(synchronize_session=False)
    log_activity(db, user, "template_delete", "template", template_id, template.name)
    db.delete(template)
    db.commit()
