"""Document status rules, kept in one place so every route enforces the same workflow."""
from enum import Enum


class DocumentStatus(str, Enum):
    DRAFT = "Draft"
    PENDING = "Pending Approval"
    APPROVED = "Approved"
    REJECTED = "Rejected"

    @classmethod
    def editable(cls) -> tuple:
        """Only drafts and rejected documents can be changed. Approved ones are locked."""
        return (cls.DRAFT.value, cls.REJECTED.value)

    @classmethod
    def submittable(cls) -> tuple:
        return (cls.DRAFT.value, cls.REJECTED.value)

    @classmethod
    def reviewable(cls) -> tuple:
        return (cls.PENDING.value,)


def normalize_decision(raw: str) -> str | None:
    """Accepts 'approve', 'approved', 'Approve' ... and returns a final status or None."""
    value = (raw or "").strip().lower()
    if value.startswith("approv"):
        return DocumentStatus.APPROVED.value
    if value.startswith("reject"):
        return DocumentStatus.REJECTED.value
    return None
