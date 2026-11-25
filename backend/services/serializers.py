"""Turns ORM objects into the dictionaries the API returns."""
from domain.workflow import DocumentStatus
from models import Document, DocumentTemplate, User


def user_out(user: User) -> dict:
    return {"id": user.id, "username": user.username, "email": user.email, "full_name": user.full_name,
            "role": user.role, "role_label": user.policy.label, "is_active": user.is_active,
            "created_at": user.created_at, "permissions": sorted(user.policy.permissions)}


def template_out(t: DocumentTemplate, favorite_ids: set | None = None, uses: dict | None = None) -> dict:
    from services.rendering import derive_fields
    use = (uses or {}).get(t.id)
    config = t.config
    return {"id": t.id, "name": t.name, "category": t.category, "body": t.body, "created_at": t.created_at,
            "slug": t.slug, "description": t.description, "layout": t.layout or "plain",
            "accent": config.get("accent", "#6D28D9"), "frame": config.get("frame", "none"),
            "is_builtin": bool(t.is_builtin), "fields": t.fields or derive_fields(t.body),
            "is_favorite": t.id in (favorite_ids or set()),
            "use_count": use.use_count if use else 0, "last_used_at": use.last_used_at if use else None}


def document_out(doc: Document, viewer: User) -> dict:
    owner_ok = viewer.policy.can_edit_document(viewer.id, doc.owner_id)
    template = doc.template
    return {
        "id": doc.id, "title": doc.title, "template_id": doc.template_id, "content": doc.content, "status": doc.status,
        "created_at": doc.created_at, "updated_at": doc.updated_at, "approval_comment": doc.approval_comment,
        "reference_no": doc.reference_no, "template_name": template.name if template else None,
        "template_category": template.category if template else None, "layout": (template.layout if template else None) or "plain",
        "owner_id": doc.owner_id, "owner_name": doc.owner.full_name if doc.owner else None,
        "reviewer_name": doc.reviewer.full_name if doc.reviewer else None,
        "submitted_at": doc.submitted_at, "reviewed_at": doc.reviewed_at, "field_values": doc.values,
        "can_edit": owner_ok and doc.status in DocumentStatus.editable(),
        "can_submit": owner_ok and doc.status in DocumentStatus.submittable(),
        "can_delete": owner_ok and (doc.status in DocumentStatus.editable() or viewer.role == "admin"),
    }
