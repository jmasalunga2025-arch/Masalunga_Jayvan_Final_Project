"""Rule-based document checker. No AI and no network: it reports only what it can verify.

Checks: required fields, leftover "[placeholders]", very short long-text fields, repeated words,
double spaces, lowercase sentence starts, lowercase "i", missing end punctuation, and shouting (ALL CAPS).
These are simple heuristics, not a full grammar checker. Use the AI grammar tool for that.
"""
import re

REPEAT_RE = re.compile(r"\b(\w+)\s+\1\b", re.IGNORECASE)


def check_document(fields: list[dict], values: dict, rendered: dict | None = None) -> list[dict]:
    issues: list[dict] = []

    def add(level, field, message):
        issues.append({"level": level, "field": field, "message": message})

    for f in fields:
        key, label, kind = f["key"], f.get("label", f["key"]), f.get("type", "text")
        value = str(values.get(key, "") or "").strip()
        if not value:
            if f.get("required", True):
                add("error", key, f"{label} is required.")
            continue
        if kind != "textarea":
            if "  " in value:
                add("info", key, f"{label} has double spaces.")
            continue
        if len(value) < 25:
            add("warning", key, f"{label} is very short. Consider adding more detail.")
        if re.search(r"(?m)(^|[.!?]\s+)[a-z]", value):
            add("warning", key, f"{label} has a sentence that starts with a lowercase letter.")
        if re.search(r"\bi\b", value):
            add("warning", key, f'{label} uses a lowercase "i" for the pronoun.')
        if REPEAT_RE.search(value):
            add("warning", key, f"{label} repeats a word ({REPEAT_RE.search(value).group(0)}).")
        if "  " in value:
            add("info", key, f"{label} has double spaces.")
        if "\n" not in value and not re.search(r"[.!?:]\s*$", value):
            add("info", key, f"{label} does not end with punctuation.")
        letters = [c for c in value if c.isalpha()]
        if len(letters) > 30 and sum(c.isupper() for c in letters) / len(letters) > 0.7:
            add("warning", key, f"{label} is mostly capital letters.")

    if rendered:
        leftovers = sum(1 for b in rendered.get("blocks", []) for text in _texts(b) if re.search(r"\[[^\]]+\]", text))
        if leftovers:
            add("info", None, "Some text still shows [bracketed] gaps from empty required fields.")
    if not issues:
        add("ok", None, "No problems found by the automatic checks.")
    return issues


def _texts(block: dict):
    for key in ("text", "name", "title"):
        if isinstance(block.get(key), str):
            yield block[key]
    for row in block.get("rows", []):
        yield row[1]
    yield from block.get("lines", [])
    yield from block.get("items", []) if all(isinstance(i, str) for i in block.get("items", [])) else []
