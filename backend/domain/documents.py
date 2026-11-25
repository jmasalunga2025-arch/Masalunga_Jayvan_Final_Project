"""Document types (abstraction, inheritance, polymorphism).

Every document type turns a template's fields + the user's values into the same
neutral structure: a list of "blocks". The browser preview, the DOCX writer and
the PDF writer all consume those blocks, so what you see is what you download.

    BaseDocumentType (ABC)
    ├── LetterDocument
    ├── CertificateDocument
    ├── MemoDocument
    │   └── AnnouncementDocument
    ├── ReportDocument
    │   └── FormDocument
    └── PlainDocument            (legacy placeholder-text templates)

Placeholder rules used by every type:
  * {{key}} is replaced with the value the user typed.
  * Empty + required  -> shown as "[Field label]" so gaps are obvious in the preview.
  * Empty + optional  -> the whole line / sentence / row that uses it is dropped.
"""
import re
from abc import ABC, abstractmethod
from datetime import date

PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
DEFAULT_ACCENT = "#6D28D9"


def extract_placeholders(text: str) -> list[str]:
    seen: list[str] = []
    for key in PLACEHOLDER_RE.findall(text or ""):
        if key not in seen:
            seen.append(key)
    return seen


def humanize(key: str) -> str:
    return key.replace("_", " ").strip().capitalize()


def format_date(value: str) -> str:
    try:
        d = date.fromisoformat(value)
    except (TypeError, ValueError):
        return value
    return f"{d:%B} {d.day}, {d.year}"


def blocks_to_text(blocks: list[dict]) -> str:
    """Flatten blocks into plain text (used for search, summaries and the legacy `content` column)."""
    parts: list[str] = []
    for b in blocks:
        t = b.get("t")
        lines: list[str] = []
        if t == "org":
            lines = [b.get("name", ""), b.get("tagline", "")]
        elif t in ("title", "subtitle", "heading", "p", "recipient"):
            lines = [b.get("text", "")]
        elif t == "meta" or t == "kv":
            lines = [f"{label}: {value}" for label, value in b.get("rows", [])]
        elif t == "lines":
            lines = list(b.get("lines", []))
        elif t == "list":
            lines = [f"- {item}" for item in b.get("items", [])]
        elif t == "signatures":
            for s in b.get("items", []):
                lines += [x for x in (s.get("label"), s.get("name"), s.get("title")) if x]
        text = "\n".join(x for x in lines if x)
        if text:
            parts.append(text)
    return "\n\n".join(parts)


class BaseDocumentType(ABC):
    layout = "base"
    orientation = "portrait"

    def __init__(self, title: str, fields: list[dict], values: dict | None = None,
                 config: dict | None = None, reference_no: str | None = None):
        self._title = title
        self._fields = {f["key"]: f for f in fields}
        self._values = {k: str(v).strip() for k, v in (values or {}).items() if v is not None}
        self._config = config or {}
        self._reference_no = reference_no

    # ---- read-only state -------------------------------------------------
    @property
    def title(self) -> str:
        return self._title

    @property
    def accent(self) -> str:
        return self._config.get("accent", DEFAULT_ACCENT)

    @property
    def reference_display(self) -> str:
        return self._reference_no or f"DAMS-{date.today().year}-(assigned on save)"

    # ---- placeholder handling -------------------------------------------
    def display(self, key: str) -> str:
        raw = self._values.get(key, "")
        field = self._fields.get(key)
        if raw and field and field.get("type") == "date":
            return format_date(raw)
        return raw

    def _is_required(self, key: str) -> bool:
        field = self._fields.get(key)
        return True if field is None else bool(field.get("required", True))

    def skippable(self, text: str) -> bool:
        """True if the text uses an optional placeholder that is empty."""
        return any(not self.display(k) and not self._is_required(k) for k in extract_placeholders(text))

    def fill(self, text: str) -> str:
        def repl(match):
            key = match.group(1)
            value = self.display(key)
            if value:
                return value
            if not self._is_required(key):
                return ""
            label = self._fields.get(key, {}).get("label") or humanize(key)
            return f"[{label}]"
        return PLACEHOLDER_RE.sub(repl, text or "")

    def fill_all(self, texts) -> list[str]:
        """Fill several lines, dropping any line that depends on an empty optional field."""
        out = []
        for text in texts:
            if self.skippable(text):
                continue
            filled = self.fill(text).strip()
            if filled:
                out.append(filled)
        return out

    def fill_rows(self, rows) -> list[list[str]]:
        out = []
        for label, value in rows:
            if self.skippable(value):
                continue
            out.append([label, self.fill(value)])
        return out

    def missing_required(self) -> list[str]:
        return [f.get("label") or humanize(k) for k, f in self._fields.items()
                if f.get("required", True) and not self._values.get(k)]

    # ---- shared building blocks -----------------------------------------
    def org_block(self) -> dict:
        name = self.display("org_name") or self._config.get("org_default") or self._title
        return {"t": "org", "name": name, "tagline": self._config.get("tagline", "")}

    def signature_items(self) -> list[dict]:
        items = []
        for spec in self._config.get("signatures", [{"name": "{{signatory_name}}", "title": "{{signatory_title}}"}]):
            if self.skippable(spec.get("name", "")):
                continue
            items.append({"label": spec.get("label", ""),
                          "name": self.fill(spec.get("name", "")),
                          "title": self.fill(spec.get("title", "")) if not self.skippable(spec.get("title", "")) else ""})
        return items

    def signature_block(self) -> list[dict]:
        items = self.signature_items()
        return [{"t": "spacer", "h": 14}, {"t": "signatures", "items": items}] if items else []

    def section_blocks(self, index: int, section: dict) -> list[dict]:
        """One report/memo section: optional heading, key/value rows, and/or text."""
        rows = self.fill_rows(section.get("rows", []))
        text = section.get("text", "")
        has_text = bool(text) and not self.skippable(text)
        if section.get("rows") and not rows and not has_text:
            return []
        if text and not section.get("rows") and not has_text:
            return []
        blocks: list[dict] = []
        if section.get("heading"):
            blocks.append(self.heading_block(section["heading"], index))
        if rows:
            blocks.append({"t": "kv", "rows": rows})
        if has_text:
            filled = self.fill(text)
            kind = section.get("kind", "text")
            if kind in ("list", "numbered"):
                items = [ln.strip(" -•\t") for ln in filled.splitlines() if ln.strip()]
                blocks.append({"t": "list", "ordered": kind == "numbered", "items": items})
            else:
                for para in [p for p in re.split(r"\n\s*\n", filled) if p.strip()]:
                    blocks.append({"t": "p", "text": para.strip()})
        return blocks

    def heading_block(self, text: str, index: int) -> dict:
        return {"t": "heading", "text": text}

    # ---- the polymorphic part -------------------------------------------
    @abstractmethod
    def build_blocks(self) -> list[dict]:
        """Each document type lays itself out differently."""

    def render(self) -> dict:
        blocks = self.build_blocks()
        return {
            "layout": self.layout,
            "orientation": self.orientation,
            "accent": self.accent,
            "frame": self._config.get("frame", "none"),
            "title": self._title,
            "org_name": self.org_block()["name"],
            "reference_no": self.reference_display,
            "blocks": blocks,
            "missing": self.missing_required(),
        }


class LetterDocument(BaseDocumentType):
    layout = "letter"

    def build_blocks(self) -> list[dict]:
        c = self._config
        blocks = [self.org_block(), {"t": "rule"}]
        if c.get("title"):
            blocks.append({"t": "title", "text": c["title"], "align": "center"})
        meta = c.get("meta", [["Date", "{{date}}"], ["Ref. No.", self.reference_display]])
        blocks.append({"t": "meta", "align": "right", "rows": self.fill_rows(meta)})
        lines = self.fill_all(c.get("recipient_lines", []))
        if lines:
            blocks.append({"t": "lines", "lines": lines})
        if c.get("subject") and not self.skippable(c["subject"]):
            blocks.append({"t": "p", "text": "Subject: " + self.fill(c["subject"]), "bold": True})
        if c.get("salutation"):
            blocks.append({"t": "p", "text": self.fill(c["salutation"])})
        for para in self.fill_all(c.get("paragraphs", [])):
            blocks.append({"t": "p", "text": para, "align": "justify"})
        blocks.append({"t": "p", "text": c.get("closing", "Respectfully yours,")})
        blocks += self.signature_block()
        return blocks


class CertificateDocument(BaseDocumentType):
    layout = "certificate"
    orientation = "landscape"

    def build_blocks(self) -> list[dict]:
        c = self._config
        blocks = [{"t": "seal"}, self.org_block(),
                  {"t": "title", "text": c.get("title", "Certificate").upper(), "align": "center", "size": "xl"},
                  {"t": "p", "text": c.get("lead", "This certificate is proudly presented to"), "align": "center", "muted": True},
                  {"t": "recipient", "text": self.fill(c.get("recipient", "{{recipient_name}}"))}]
        for para in self.fill_all(c.get("paragraphs", [])):
            blocks.append({"t": "p", "text": para, "align": "center"})
        blocks.append({"t": "p", "text": f"Given this {self.fill('{{date}}')}  ·  Ref. {self.reference_display}",
                       "align": "center", "muted": True})
        blocks += self.signature_block()
        return blocks


class MemoDocument(BaseDocumentType):
    layout = "memo"

    def heading_blocks(self) -> list[dict]:
        c = self._config
        return [self.org_block(), {"t": "title", "text": c.get("title", "MEMORANDUM").upper(), "align": "center"},
                {"t": "kv", "style": "memo", "rows": self.fill_rows(c.get("header_rows", []))}, {"t": "rule"}]

    def closing_blocks(self) -> list[dict]:
        return self.signature_block() if self._config.get("signatures") else []

    def build_blocks(self) -> list[dict]:
        blocks = self.heading_blocks()
        for i, section in enumerate(self._config.get("sections", []), start=1):
            blocks += self.section_blocks(i, section)
        return blocks + self.closing_blocks()


class AnnouncementDocument(MemoDocument):
    """Same body as a memo, but with a banner headline and an event-details box."""
    layout = "announcement"

    def heading_blocks(self) -> list[dict]:
        c = self._config
        blocks = [self.org_block(), {"t": "title", "text": c.get("title", "ANNOUNCEMENT").upper(), "align": "center", "size": "xl"},
                  {"t": "subtitle", "text": self.fill(c.get("headline", "{{headline}}"))}]
        details = self.fill_rows(c.get("details", []))
        if details:
            blocks.append({"t": "kv", "style": "box", "rows": details})
        return blocks

    def closing_blocks(self) -> list[dict]:
        return [{"t": "p", "text": f"Posted: {self.fill('{{date}}')}", "muted": True}] + self.signature_block()


class ReportDocument(BaseDocumentType):
    layout = "report"

    def heading_block(self, text: str, index: int) -> dict:
        return {"t": "heading", "text": f"{index}. {text}"}

    def build_blocks(self) -> list[dict]:
        c = self._config
        blocks = [self.org_block(), {"t": "title", "text": c.get("title", "REPORT").upper(), "align": "center"}]
        meta = self.fill_rows(c.get("meta", []))
        if meta:
            blocks.append({"t": "kv", "rows": meta})
        shown = 0
        for section in c.get("sections", []):
            sec_blocks = self.section_blocks(shown + 1, section)
            if sec_blocks:
                shown += 1
                blocks += sec_blocks
        blocks += self.signature_block()
        return blocks


class FormDocument(ReportDocument):
    """Structured form: shaded section bars and boxed fields, no numbering."""
    layout = "form"

    def heading_block(self, text: str, index: int) -> dict:
        return {"t": "heading", "text": text, "style": "bar"}


class PlainDocument(BaseDocumentType):
    """Legacy templates: a block of text with {{placeholders}} (or already-filled content)."""
    layout = "plain"

    def build_blocks(self) -> list[dict]:
        text = self._config.get("body_text")
        if text is None:
            text = self.fill(self._config.get("body", ""))
        return [{"t": "p", "text": para.strip()} for para in re.split(r"\n\s*\n", text) if para.strip()]

    def missing_required(self) -> list[str]:
        return [] if self._config.get("body_text") is not None else super().missing_required()


DOCUMENT_TYPES = {cls.layout: cls for cls in
                  (LetterDocument, CertificateDocument, MemoDocument, AnnouncementDocument,
                   ReportDocument, FormDocument, PlainDocument)}


def get_document_type(layout: str) -> type[BaseDocumentType]:
    return DOCUMENT_TYPES.get(layout or "plain", PlainDocument)
