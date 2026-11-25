"""Glue between stored templates/documents and the document-type classes. No DB imports."""
import json

from domain.documents import PlainDocument, extract_placeholders, get_document_type, humanize

TEXTAREA_HINTS = ("message", "description", "details", "body", "content", "reason", "summary", "notes", "remarks")


def derive_fields(body: str) -> list[dict]:
    """Fields for legacy/custom templates: one input per {{placeholder}}."""
    fields = []
    for key in extract_placeholders(body):
        kind = "date" if key == "date" or key.endswith("_date") else "textarea" if any(h in key for h in TEXTAREA_HINTS) else "text"
        fields.append({"key": key, "label": humanize(key), "type": kind, "required": True,
                       "default": "@today" if key == "date" else "", "placeholder": ""})
    return fields


def loads(raw, default):
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return default


def render_with_template(layout: str, fields: list[dict], config: dict, body: str, title: str,
                         values: dict, reference_no: str | None = None) -> dict:
    cls = get_document_type(layout)
    cfg = dict(config or {})
    if cls is PlainDocument:
        cfg.setdefault("body", body)
    return cls(title, fields, values, cfg, reference_no).render()


def render_stored_content(title: str, content: str, reference_no: str | None = None) -> dict:
    """Documents that only have text (created before structured templates existed)."""
    return PlainDocument(title, [], {}, {"body_text": content}, reference_no).render()
