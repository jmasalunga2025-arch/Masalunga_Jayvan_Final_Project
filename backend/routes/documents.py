import json
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user, require_permission
from domain.documents import blocks_to_text
from domain.roles import PERM_CREATE
from domain.workflow import DocumentStatus
from models import Approval, Document, DocumentTemplate, DocumentVersion, User
from routes.templates import record_template_use
from schemas import ApprovalOut, DocumentCreate, DocumentOut, DocumentUpdate, VersionOut
from services.activity import log_activity, notify_reviewers
from services.doc_generator import render_docx, render_pdf, safe_filename
from services.rendering import derive_fields, render_stored_content, render_with_template
from services.serializers import document_out

router = APIRouter(prefix="/api/documents", tags=["documents"])


# ------------------------------------------------------------------ helpers
def visible_query(db: Session, user: User):
    query = db.query(Document)
    if user.role == "admin":
        return query
    if user.role == "approver":
        return query.filter(or_(Document.owner_id == user.id, Document.status != DocumentStatus.DRAFT.value))
    return query.filter(Document.owner_id == user.id)


def get_visible(db: Session, user: User, document_id: int) -> Document:
    doc = db.get(Document, document_id)
    # 404 (not 403) so nobody can probe which document ids exist
    if doc is None or not user.policy.can_view_document(user.id, doc.owner_id, doc.status):
        raise HTTPException(404, "Document not found.")
    return doc


def render_document(doc: Document) -> dict:
    t = doc.template
    if t is not None and doc.values:
        return render_with_template(t.layout or "plain", t.fields or derive_fields(t.body), t.config, t.body,
                                    doc.title, doc.values, doc.reference_no)
    return render_stored_content(doc.title, doc.content, doc.reference_no)


def refresh_content(doc: Document) -> list[str]:
    """Rebuilds the stored plain text from the field values. Returns missing required fields."""
    if doc.template is not None and doc.values:
        rendered = render_document(doc)
        doc.content = blocks_to_text(rendered["blocks"])
        return rendered["missing"]
    return []


def snapshot(db: Session, doc: Document, user: User, note: str) -> None:
    last = db.query(DocumentVersion.version_no).filter(DocumentVersion.document_id == doc.id).order_by(DocumentVersion.version_no.desc()).first()
    db.add(DocumentVersion(document_id=doc.id, version_no=(last[0] + 1) if last else 1, title=doc.title,
                           content=doc.content, field_values=doc.field_values, note=note, created_by=user.id))


def _require_complete(missing: list[str]) -> None:
    if missing:
        raise HTTPException(422, "Please complete these fields first: " + ", ".join(missing) + ".")


def _owner_or_admin(user: User, doc: Document) -> None:
    if not user.policy.can_edit_document(user.id, doc.owner_id):
        raise HTTPException(403, "Only the owner of a document can do this.")


# ------------------------------------------------------------------ create / read
@router.get("", response_model=list[DocumentOut])
def list_documents(q: str | None = None, status_filter: str | None = Query(default=None, alias="status"),
                   category: str | None = None, template_id: int | None = None, layout: str | None = None,
                   date_from: date | None = None, date_to: date | None = None, mine: bool = False,
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = visible_query(db, user)
    if mine:
        query = query.filter(Document.owner_id == user.id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Document.title.ilike(like), Document.content.ilike(like), Document.reference_no.ilike(like)))
    if status_filter:
        query = query.filter(Document.status == status_filter)
    if template_id:
        query = query.filter(Document.template_id == template_id)
    if category or layout:
        query = query.join(DocumentTemplate, Document.template_id == DocumentTemplate.id)
        if category:
            query = query.filter(DocumentTemplate.category == category)
        if layout:
            query = query.filter(DocumentTemplate.layout == layout)
    if date_from:
        query = query.filter(Document.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        query = query.filter(Document.created_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))
    return [document_out(d, user) for d in query.order_by(Document.updated_at.desc()).all()]


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(payload: DocumentCreate, db: Session = Depends(get_db), user: User = Depends(require_permission(PERM_CREATE))):
    template = None
    if payload.template_id is not None:
        template = db.get(DocumentTemplate, payload.template_id)
        if template is None:
            raise HTTPException(404, "Template not found.")
    if payload.field_values is not None and template is None:
        raise HTTPException(422, "Choose a template to use field values.")
    if payload.field_values is None and not (payload.content or "").strip():
        raise HTTPException(422, "Add some content or fill in the template fields.")

    submitting = payload.action == "submit"
    doc = Document(title=payload.title.strip(), template=template, content=payload.content or "",
                   owner_id=user.id, field_values=json.dumps(payload.field_values) if payload.field_values is not None else None,
                   status=DocumentStatus.PENDING.value if submitting else DocumentStatus.DRAFT.value,
                   submitted_at=datetime.now(timezone.utc) if submitting else None)
    db.add(doc)
    db.flush()
    doc.reference_no = f"DAMS-{datetime.now(timezone.utc).year}-{doc.id:05d}"
    missing = refresh_content(doc)  # builds the stored text now that the reference number exists
    if submitting:
        _require_complete(missing)
    snapshot(db, doc, user, "Created")
    if template:
        record_template_use(db, user, template.id)
    log_activity(db, user, "document_create", "document", doc.id, doc.title)
    if submitting:
        log_activity(db, user, "document_submit", "document", doc.id, doc.title)
        notify_reviewers(db, f"“{doc.title}” is waiting for review.", "#/approvals", exclude_user_id=user.id)
    db.commit()
    return document_out(doc, user)


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return document_out(get_visible(db, user, document_id), user)


@router.get("/{document_id}/render")
def render_document_blocks(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return render_document(get_visible(db, user, document_id))


@router.get("/{document_id}/versions", response_model=list[VersionOut])
def list_versions(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = get_visible(db, user, document_id)
    names = {u.id: u.full_name for u in db.query(User).filter(User.id.in_([v.created_by for v in doc.versions if v.created_by]))}
    return [{"id": v.id, "version_no": v.version_no, "title": v.title, "content": v.content, "note": v.note,
             "author_name": names.get(v.created_by), "created_at": v.created_at} for v in reversed(doc.versions)]


@router.get("/{document_id}/approvals", response_model=list[ApprovalOut])
def approval_history(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = get_visible(db, user, document_id)
    return [{"id": a.id, "document_id": doc.id, "document_title": doc.title, "reviewer_name": a.reviewer.full_name if a.reviewer else None,
             "decision": a.decision, "comment": a.comment, "created_at": a.created_at} for a in reversed(doc.approvals)]


# ------------------------------------------------------------------ change
@router.patch("/{document_id}", response_model=DocumentOut)
def update_document(document_id: int, payload: DocumentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = get_visible(db, user, document_id)
    _owner_or_admin(user, doc)
    if doc.status not in DocumentStatus.editable():
        raise HTTPException(409, "This document is locked while it is pending or after approval. Duplicate it to make changes.")
    if payload.title is not None:
        doc.title = payload.title.strip()
    if payload.field_values is not None:
        if doc.template is None:
            raise HTTPException(422, "This document has no template, so edit its content instead.")
        doc.field_values = json.dumps(payload.field_values)
    elif payload.content is not None:
        if doc.values:
            raise HTTPException(422, "Edit this document through its form fields.")
        if not payload.content.strip():
            raise HTTPException(422, "Content cannot be empty.")
        doc.content = payload.content
    refresh_content(doc)
    if doc.status == DocumentStatus.REJECTED.value:
        doc.status = DocumentStatus.DRAFT.value  # edited after rejection: back to draft, ready to resubmit
    snapshot(db, doc, user, "Edited")
    log_activity(db, user, "document_edit", "document", doc.id, doc.title)
    db.commit()
    return document_out(doc, user)


@router.post("/{document_id}/submit", response_model=DocumentOut)
def submit_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = get_visible(db, user, document_id)
    _owner_or_admin(user, doc)
    if doc.status not in DocumentStatus.submittable():
        raise HTTPException(409, f"A document that is “{doc.status}” cannot be submitted.")
    _require_complete(render_document(doc)["missing"] if doc.values else [])
    doc.status = DocumentStatus.PENDING.value
    doc.submitted_at = datetime.now(timezone.utc)
    doc.approval_comment = None
    snapshot(db, doc, user, "Submitted for approval")
    log_activity(db, user, "document_submit", "document", doc.id, doc.title)
    notify_reviewers(db, f"“{doc.title}” is waiting for review.", "#/approvals", exclude_user_id=user.id)
    db.commit()
    return document_out(doc, user)


@router.post("/{document_id}/duplicate", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def duplicate_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(require_permission(PERM_CREATE))):
    source = get_visible(db, user, document_id)
    copy = Document(title=f"Copy of {source.title}"[:200], template_id=source.template_id, content=source.content,
                    field_values=source.field_values, owner_id=user.id, status=DocumentStatus.DRAFT.value)
    db.add(copy)
    db.flush()
    copy.reference_no = f"DAMS-{datetime.now(timezone.utc).year}-{copy.id:05d}"
    refresh_content(copy)
    snapshot(db, copy, user, f"Duplicated from {source.reference_no or source.id}")
    log_activity(db, user, "document_duplicate", "document", copy.id, copy.title)
    db.commit()
    return document_out(copy, user)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = get_visible(db, user, document_id)
    _owner_or_admin(user, doc)
    if doc.status not in DocumentStatus.editable() and user.role != "admin":
        raise HTTPException(409, "Pending and approved documents can only be deleted by an administrator.")
    log_activity(db, user, "document_delete", "document", doc.id, doc.title)
    db.delete(doc)
    db.commit()


# ------------------------------------------------------------------ downloads
@router.get("/{document_id}/download/{fmt}")
def download_document(document_id: int, fmt: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if fmt not in ("docx", "pdf"):
        raise HTTPException(404, "Unknown format. Use docx or pdf.")
    doc = get_visible(db, user, document_id)
    rendered = render_document(doc)
    data = render_docx(rendered) if fmt == "docx" else render_pdf(rendered)
    media = ("application/vnd.openxmlformats-officedocument.wordprocessingml.document" if fmt == "docx" else "application/pdf")
    log_activity(db, user, "document_download", "document", doc.id, f"{doc.title} (.{fmt})")
    db.commit()
    return Response(content=data, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{safe_filename(doc.title, fmt)}"'})
