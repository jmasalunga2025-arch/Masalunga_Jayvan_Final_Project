import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from deps import require_permission
from domain.roles import PERM_REVIEW
from domain.workflow import DocumentStatus, normalize_decision
from models import Approval, Document, User
from routes.documents import snapshot
from schemas import ApprovalDecision, ApprovalOut, DocumentOut
from services.activity import log_activity, notify
from services.serializers import document_out

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


def _self_approval_allowed() -> bool:
    """Off by default (separation of duties). Set ALLOW_SELF_APPROVAL=true for single-user demos."""
    return os.getenv("ALLOW_SELF_APPROVAL", "").strip().lower() in ("1", "true", "yes")


@router.get("", response_model=list[DocumentOut])
def pending_approvals(db: Session = Depends(get_db), user: User = Depends(require_permission(PERM_REVIEW))):
    query = db.query(Document).filter(Document.status == DocumentStatus.PENDING.value)
    if not _self_approval_allowed():
        query = query.filter(or_(Document.owner_id != user.id, Document.owner_id.is_(None)))
    return [document_out(d, user) for d in query.order_by(Document.submitted_at).all()]


@router.get("/history", response_model=list[ApprovalOut])
def decision_history(db: Session = Depends(get_db), user: User = Depends(require_permission(PERM_REVIEW))):
    query = db.query(Approval)
    if user.role != "admin":
        query = query.filter(Approval.reviewer_id == user.id)
    return [{"id": a.id, "document_id": a.document_id, "document_title": a.document.title if a.document else None,
             "reviewer_name": a.reviewer.full_name if a.reviewer else None, "decision": a.decision,
             "comment": a.comment, "created_at": a.created_at} for a in query.order_by(Approval.id.desc()).limit(100).all()]


@router.post("/{document_id}/decision", response_model=DocumentOut)
def decide(document_id: int, payload: ApprovalDecision, db: Session = Depends(get_db),
           user: User = Depends(require_permission(PERM_REVIEW))):
    decision = normalize_decision(payload.decision)
    if decision is None:
        raise HTTPException(422, "Decision must be 'approve' or 'reject'.")
    comment = payload.comment.strip()
    if decision == DocumentStatus.REJECTED.value and not comment:
        raise HTTPException(422, "Please explain why the document is rejected so the owner can fix it.")
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(404, "Document not found.")
    if doc.status not in DocumentStatus.reviewable():
        raise HTTPException(409, f"This document is “{doc.status}”, so it is not waiting for review.")
    if doc.owner_id == user.id and not _self_approval_allowed():
        raise HTTPException(403, "You cannot review your own document. Ask another approver.")

    doc.status = decision
    doc.approval_comment = comment or None
    doc.reviewer_id = user.id
    doc.reviewed_at = datetime.now(timezone.utc)
    db.add(Approval(document_id=doc.id, reviewer_id=user.id, decision=decision, comment=comment))
    snapshot(db, doc, user, decision)
    verb = "approved" if decision == DocumentStatus.APPROVED.value else "rejected"
    log_activity(db, user, f"document_{verb}", "document", doc.id, doc.title)
    notify(db, doc.owner_id, f"“{doc.title}” was {verb} by {user.full_name}." + (f" Comment: {comment}" if comment else ""), "#/documents")
    db.commit()
    return document_out(doc, user)
