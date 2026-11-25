import json

from models import DocumentTemplate
from services.template_catalog import CATALOG, LEGACY_STARTERS, collect_placeholder_text


def seed_templates(db) -> None:
    """Adds any missing built-in templates. Existing and custom templates are never touched."""
    was_empty = db.query(DocumentTemplate).count() == 0
    have = {slug for (slug,) in db.query(DocumentTemplate.slug).filter(DocumentTemplate.slug.isnot(None)).all()}
    for entry in CATALOG:
        if entry["slug"] in have:
            continue
        db.add(DocumentTemplate(
            slug=entry["slug"], name=entry["name"], category=entry["category"], description=entry["description"],
            layout=entry["layout"], fields_json=json.dumps(entry["fields"]), config_json=json.dumps(entry["config"]),
            body=collect_placeholder_text(entry["config"]) or entry["name"], is_builtin=True))
    if was_empty:  # same behaviour as the original MVP: three plain starter templates on a brand-new database
        for starter in LEGACY_STARTERS:
            db.add(DocumentTemplate(**starter, layout="plain", description="Plain-text starter template.", is_builtin=False))
    db.commit()
