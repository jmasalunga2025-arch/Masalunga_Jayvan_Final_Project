"""Role policies (encapsulation + abstraction + polymorphism).

Each role is a small class that answers permission questions. The API layer asks
the policy instead of scattering `if role == ...` checks everywhere.
This module has no web or database imports, so it is easy to unit-test.
"""
from abc import ABC, abstractmethod

PERM_CREATE = "documents.create"
PERM_VIEW_ALL = "documents.view_all"
PERM_REVIEW = "documents.review"
PERM_MANAGE_TEMPLATES = "templates.manage"
PERM_MANAGE_USERS = "users.manage"


class RolePolicy(ABC):
    role: str = ""
    label: str = ""

    @property
    @abstractmethod
    def permissions(self) -> frozenset:
        """Permissions granted to this role."""

    @abstractmethod
    def can_view_document(self, user_id: int, owner_id: int | None, status: str) -> bool:
        """Whether a user with this role may open a document."""

    def can(self, permission: str) -> bool:
        return permission in self.permissions

    def can_edit_document(self, user_id: int, owner_id: int | None) -> bool:
        """Owners edit their own documents; admins may edit any (status rules are separate)."""
        return owner_id is not None and owner_id == user_id


class AdminPolicy(RolePolicy):
    role = "admin"
    label = "Administrator"

    @property
    def permissions(self) -> frozenset:
        return frozenset({PERM_CREATE, PERM_VIEW_ALL, PERM_REVIEW, PERM_MANAGE_TEMPLATES, PERM_MANAGE_USERS})

    def can_view_document(self, user_id, owner_id, status) -> bool:
        return True

    def can_edit_document(self, user_id, owner_id) -> bool:
        return True


class EmployeePolicy(RolePolicy):
    role = "employee"
    label = "Staff / Employee"

    @property
    def permissions(self) -> frozenset:
        return frozenset({PERM_CREATE})

    def can_view_document(self, user_id, owner_id, status) -> bool:
        return owner_id is not None and owner_id == user_id


class ApproverPolicy(RolePolicy):
    role = "approver"
    label = "Approver"

    @property
    def permissions(self) -> frozenset:
        return frozenset({PERM_CREATE, PERM_REVIEW})

    def can_view_document(self, user_id, owner_id, status) -> bool:
        # Own documents, plus anything that has left the "Draft" stage (submitted for review).
        if owner_id is not None and owner_id == user_id:
            return True
        return status != "Draft"


_POLICIES = {p.role: p for p in (AdminPolicy(), EmployeePolicy(), ApproverPolicy())}
ROLES = tuple(_POLICIES)


def get_policy(role: str) -> RolePolicy:
    try:
        return _POLICIES[role]
    except KeyError:
        raise ValueError(f"Unknown role: {role!r}") from None
