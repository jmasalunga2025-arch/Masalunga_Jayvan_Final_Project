"""Tiny additive migration so an existing dams.db keeps its data after the upgrade.

`Base.metadata.create_all` creates missing tables but never adds columns to existing
ones, so we add the new columns here. For real production use, switch to Alembic.
"""
from sqlalchemy import inspect, text

NEW_COLUMNS = {
    "templates": {
        "slug": "VARCHAR(80)", "description": "TEXT", "layout": "VARCHAR(40) DEFAULT 'plain'",
        "fields_json": "TEXT", "config_json": "TEXT", "is_builtin": "BOOLEAN DEFAULT 0",
    },
    "documents": {
        "owner_id": "INTEGER", "reviewer_id": "INTEGER", "reference_no": "VARCHAR(40)",
        "field_values": "TEXT", "submitted_at": "DATETIME", "reviewed_at": "DATETIME",
    },
}

LEGACY_STATUS = {
    "Pending Approval": ("Pending", "Submitted", "Pending approval", "pending", "submitted"),
    "Approved": ("approved", "APPROVED"),
    "Rejected": ("rejected", "REJECTED"),
}


def run_migrations(engine) -> list[str]:
    applied: list[str] = []
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, columns in NEW_COLUMNS.items():
            if table not in existing_tables:
                continue
            have = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns.items():
                if name not in have:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                    applied.append(f"{table}.{name}")
        if "documents" in existing_tables:
            for canonical, old_values in LEGACY_STATUS.items():
                marks = ", ".join(f":v{i}" for i in range(len(old_values)))
                params = {f"v{i}": v for i, v in enumerate(old_values)}
                conn.execute(text(f"UPDATE documents SET status = :new WHERE status IN ({marks})"), {"new": canonical, **params})
    return applied
