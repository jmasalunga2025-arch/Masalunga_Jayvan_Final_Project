"""Writes a rendered document (see domain/documents.py) to DOCX or PDF bytes.

Both writers read the same `blocks`, so headings, margins, tables, signature
lines, page numbers and the certificate frame stay consistent in each format.
"""
import io
from xml.sax.saxutils import escape

from docx import Document as Docx
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

MUTED = "6B7280"
INK = "111827"


def _hex(color: str) -> str:
    return color.lstrip("#").upper()


def _tint(color: str, amount: float = 0.9) -> str:
    """Mix a hex color with white (amount=0.9 -> very light)."""
    c = _hex(color)
    r, g, b = (int(c[i:i + 2], 16) for i in (0, 2, 4))
    mix = lambda v: int(v + (255 - v) * amount)
    return f"{mix(r):02X}{mix(g):02X}{mix(b):02X}"


def safe_filename(title: str, ext: str) -> str:
    stem = "".join(ch if ch.isalnum() or ch in " -_" else "" for ch in title).strip().replace(" ", "_")
    return f"{stem or 'document'}.{ext}"


# =============================================================== DOCX
_ALIGN = {"center": WD_ALIGN_PARAGRAPH.CENTER, "right": WD_ALIGN_PARAGRAPH.RIGHT,
          "justify": WD_ALIGN_PARAGRAPH.JUSTIFY, "left": WD_ALIGN_PARAGRAPH.LEFT}


def _border(paragraph, side="bottom", color="CCCCCC", size=6, space=1):
    ppr = paragraph._p.get_or_add_pPr()
    borders = ppr.find(qn("w:pBdr"))
    if borders is None:
        borders = OxmlElement("w:pBdr")
        ppr.append(borders)
    el = OxmlElement(f"w:{side}")
    for k, v in (("val", "single"), ("sz", str(size)), ("space", str(space)), ("color", color)):
        el.set(qn(f"w:{k}"), v)
    borders.append(el)


def _shade(element_pr, fill):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    element_pr.append(shd)


def _field(paragraph, instruction, size=8, color=MUTED):
    run = paragraph.add_run()
    run.font.size, run.font.color.rgb = Pt(size), RGBColor.from_string(color)
    for kind, text in (("begin", None), ("instr", instruction), ("separate", None), ("text", "1"), ("end", None)):
        if kind == "instr":
            el = OxmlElement("w:instrText")
            el.set(qn("xml:space"), "preserve")
            el.text = text
        elif kind == "text":
            el = OxmlElement("w:t")
            el.text = text
        else:
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), kind)
        run._r.append(el)


def _add_text(paragraph, text, size=11, bold=False, italic=False, color=INK, font=None):
    lines = str(text).split("\n")
    for i, line in enumerate(lines):
        run = paragraph.add_run(line)
        run.bold, run.italic = bold, italic
        run.font.size, run.font.color.rgb = Pt(size), RGBColor.from_string(_hex(color))
        if font:
            run.font.name = font
        if i < len(lines) - 1:
            run.add_break()
    return paragraph


def _para(doc_or_cell, text="", align="left", size=11, bold=False, italic=False, color=INK, before=0, after=6, font=None):
    p = doc_or_cell.add_paragraph()
    p.alignment = _ALIGN.get(align, WD_ALIGN_PARAGRAPH.LEFT)
    p.paragraph_format.space_before, p.paragraph_format.space_after = Pt(before), Pt(after)
    if text:
        _add_text(p, text, size, bold, italic, color, font)
    return p


def _page_frame(section, accent, frame):
    sect_pr = section._sectPr
    borders = OxmlElement("w:pgBorders")
    borders.set(qn("w:offsetFrom"), "page")
    for side in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), "double" if frame == "classic" else "single")
        el.set(qn("w:sz"), "18" if frame == "classic" else "24")
        el.set(qn("w:space"), "28")
        el.set(qn("w:color"), _hex(accent))
        borders.append(el)
    sect_pr.find(qn("w:pgMar")).addnext(borders)


def _docx_kv(doc, block, accent):
    rows = block["rows"]
    table = doc.add_table(rows=len(rows), cols=2)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    boxed = block.get("style") == "box"
    memo = block.get("style") == "memo"
    for r, (label, value) in enumerate(rows):
        left, right = table.rows[r].cells
        left.width, right.width = Cm(4.2), Cm(12.3)
        for cell in (left, right):
            cell.paragraphs[0].paragraph_format.space_after = Pt(2)
        _add_text(left.paragraphs[0], label, 10, bold=True, color=accent if (boxed or memo) else INK)
        _add_text(right.paragraphs[0], value, 10.5, bold=memo and label.upper() == "SUBJECT")
        _shade(left._tc.get_or_add_tcPr(), _tint(accent, 0.92))
        if memo:
            for cell in (left, right):
                borders = OxmlElement("w:tcBorders")
                for side in ("top", "left", "right", "bottom"):
                    el = OxmlElement(f"w:{side}")
                    el.set(qn("w:val"), "nil")
                    borders.append(el)
                cell._tc.get_or_add_tcPr().append(borders)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def _docx_signatures(doc, items, centered=False):
    table = doc.add_table(rows=1, cols=len(items))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER if (centered or len(items) > 1) else WD_TABLE_ALIGNMENT.LEFT
    if len(items) == 1:
        table.autofit = False
        table.rows[0].cells[0].width = Cm(7.5)
    for cell, item in zip(table.rows[0].cells, items):
        if item.get("label"):
            _add_text(cell.paragraphs[0], item["label"], 9, color=MUTED)
        spacer = cell.add_paragraph()
        spacer.paragraph_format.space_after = Pt(20)
        line = cell.add_paragraph()
        line.paragraph_format.space_after = Pt(0)
        _border(line, "top", "444444", 6, 4)
        _add_text(line, item["name"], 11, bold=True)
        if item.get("title"):
            _para(cell, item["title"], size=10, color=MUTED, after=0)


def render_docx(rendered: dict) -> bytes:
    accent, landscape_page = rendered["accent"], rendered["orientation"] == "landscape"
    doc = Docx()
    section = doc.sections[0]
    if landscape_page:
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width, section.page_height = Cm(29.7), Cm(21.0)
        section.left_margin = section.right_margin = Cm(2.8)
        section.top_margin = section.bottom_margin = Cm(2.2)
    else:
        section.page_width, section.page_height = Cm(21.0), Cm(29.7)
        section.left_margin = section.right_margin = Cm(2.4)
        section.top_margin, section.bottom_margin = Cm(2.2), Cm(2.0)
    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = "Calibri", Pt(11)

    if rendered.get("frame", "none") != "none":
        _page_frame(section, accent, rendered["frame"])
    else:
        header = section.header.paragraphs[0]
        header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        _add_text(header, rendered["org_name"], 8, color=MUTED)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _add_text(footer, f"{rendered['reference_no']}   |   Page ", 8, color=MUTED)
    _field(footer, "PAGE")
    _add_text(footer, " of ", 8, color=MUTED)
    _field(footer, "NUMPAGES")

    cert = rendered["layout"] == "certificate"
    for b in rendered["blocks"]:
        t = b["t"]
        if t == "org":
            _para(doc, b["name"].upper() if cert else b["name"], "center", 11 if cert else 17, bold=True, color=accent,
                  after=0 if b.get("tagline") else 4)
            if b.get("tagline"):
                _para(doc, b["tagline"], "center", 9, color=MUTED, after=4)
        elif t == "rule":
            _border(_para(doc, after=8), "bottom", _hex(accent), 12)
        elif t == "title":
            xl = b.get("size") == "xl"
            _para(doc, b["text"], b.get("align", "left"), 34 if xl else 16, bold=True, color=accent,
                  before=6 if xl else 4, after=10, font="Georgia")
        elif t == "subtitle":
            _para(doc, b["text"], "center", 15, italic=True, color=INK, after=10, font="Georgia")
        elif t == "meta":
            _para(doc, "\n".join(f"{l}: {v}" for l, v in b["rows"]), b.get("align", "left"), 10, color=MUTED, after=10)
        elif t == "lines":
            _para(doc, "\n".join(b["lines"]), after=10)
        elif t == "heading":
            if b.get("style") == "bar":
                p = _para(doc, b["text"].upper(), size=10, bold=True, color=accent, before=10, after=4)
                _shade(p._p.get_or_add_pPr(), _tint(accent, 0.88))
            else:
                p = _para(doc, b["text"], size=12, bold=True, color=accent, before=10, after=4)
                _border(p, "bottom", _tint(accent, 0.6), 4)
        elif t == "p":
            align = b.get("align", "left")
            if align == "justify" and "\n" in b["text"]:
                align = "left"
            _para(doc, b["text"], align, 11, bold=b.get("bold", False),
                  color=MUTED if b.get("muted") else INK, after=8)
        elif t == "recipient":
            _border(_para(doc, b["text"], "center", 30, bold=True, italic=True, color=accent, before=6, after=8, font="Georgia"),
                    "bottom", _tint(accent, 0.5), 6, 6)
        elif t == "list":
            for n, item in enumerate(b["items"], start=1):
                p = _para(doc, after=2)
                p.paragraph_format.left_indent, p.paragraph_format.first_line_indent = Cm(0.9), Cm(-0.5)
                _add_text(p, (f"{n}.  " if b.get("ordered") else "•  ") + item, 11)
        elif t == "kv":
            _docx_kv(doc, b, accent)
        elif t == "signatures" and b["items"]:
            _docx_signatures(doc, b["items"], centered=cert)
        elif t == "spacer":
            _para(doc, after=b.get("h", 8))
        elif t == "seal":
            _para(doc, "[ School seal / logo ]", "center", 8, color=MUTED, after=2)

    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


# =============================================================== PDF
def _rl(text: str) -> str:
    return escape(str(text)).replace("\n", "<br/>")


def _styles(accent: str):
    ac = colors.HexColor(accent)
    base = dict(fontName="Helvetica", fontSize=10.5, leading=15, textColor=colors.HexColor("#" + INK))
    return {
        "p": ParagraphStyle("p", spaceAfter=7, **base),
        "justify": ParagraphStyle("j", alignment=TA_JUSTIFY, spaceAfter=7, **base),
        "center": ParagraphStyle("c", alignment=TA_CENTER, spaceAfter=7, **base),
        "right": ParagraphStyle("r", alignment=TA_RIGHT, **{**base, "fontSize": 9.5, "textColor": colors.HexColor("#" + MUTED)}, spaceAfter=8),
        "muted": ParagraphStyle("m", alignment=TA_CENTER, **{**base, "fontSize": 9, "textColor": colors.HexColor("#" + MUTED)}, spaceAfter=7),
        "org": ParagraphStyle("o", alignment=TA_CENTER, **{**base, "fontName": "Helvetica-Bold", "fontSize": 16, "leading": 20, "textColor": ac}, spaceAfter=4),
        "title": ParagraphStyle("t", alignment=TA_CENTER, **{**base, "fontName": "Times-Bold", "fontSize": 17, "leading": 22, "textColor": ac}, spaceBefore=4, spaceAfter=10),
        "xl": ParagraphStyle("xl", alignment=TA_CENTER, **{**base, "fontName": "Times-Bold", "fontSize": 32, "leading": 38, "textColor": ac}, spaceAfter=10),
        "subtitle": ParagraphStyle("s", alignment=TA_CENTER, **{**base, "fontName": "Times-Italic", "fontSize": 15, "leading": 20}, spaceAfter=10),
        "heading": ParagraphStyle("h", **{**base, "fontName": "Helvetica-Bold", "fontSize": 12, "textColor": ac}, spaceBefore=10, spaceAfter=4),
        "bar": ParagraphStyle("b", **{**base, "fontName": "Helvetica-Bold", "fontSize": 9.5, "textColor": ac}, backColor=colors.HexColor("#" + _tint(accent, 0.88)),
                              borderPadding=(4, 6, 4, 6), spaceBefore=12, spaceAfter=8),
        "recipient": ParagraphStyle("rc", alignment=TA_CENTER, **{**base, "fontName": "Times-BoldItalic", "fontSize": 28, "leading": 34, "textColor": ac}, spaceAfter=8),
        "cell": ParagraphStyle("cell", **{**base, "fontSize": 10, "leading": 13}),
        "cellb": ParagraphStyle("cellb", **{**base, "fontName": "Helvetica-Bold", "fontSize": 9.5, "leading": 13, "textColor": ac}),
        "sig": ParagraphStyle("sig", alignment=TA_CENTER, **{**base, "fontName": "Helvetica-Bold", "fontSize": 10.5}, spaceAfter=0),
        "sigt": ParagraphStyle("sigt", alignment=TA_CENTER, **{**base, "fontSize": 9, "textColor": colors.HexColor("#" + MUTED)}, spaceAfter=0),
        "siglab": ParagraphStyle("sigl", alignment=TA_LEFT, **{**base, "fontSize": 8.5, "textColor": colors.HexColor("#" + MUTED)}, spaceAfter=0),
    }


def render_pdf(rendered: dict) -> bytes:
    accent = rendered["accent"]
    ac = colors.HexColor(accent)
    cert = rendered["layout"] == "certificate"
    page = landscape(A4) if rendered["orientation"] == "landscape" else A4
    out = io.BytesIO()
    margin_x, margin_y = (2.8 * cm, 2.4 * cm) if cert else (2.4 * cm, 2.2 * cm)
    doc = SimpleDocTemplate(out, pagesize=page, leftMargin=margin_x, rightMargin=margin_x,
                            topMargin=margin_y, bottomMargin=margin_y, title=rendered["title"], author=rendered["org_name"])
    S = _styles(accent)
    story = []
    frame = rendered.get("frame", "none")

    def decorate(canvas, d):
        canvas.saveState()
        w, h = page
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#" + MUTED))
        canvas.drawCentredString(w / 2, (1.8 if frame != "none" else 1.1) * cm, f"{rendered['reference_no']}   |   Page {d.page}")
        if frame == "none":
            canvas.drawRightString(w - margin_x, h - 1.2 * cm, rendered["org_name"])
        else:
            canvas.setStrokeColor(ac)
            canvas.setLineWidth(3 if frame == "classic" else 2)
            canvas.rect(1 * cm, 1 * cm, w - 2 * cm, h - 2 * cm)
            if frame == "classic":
                canvas.setLineWidth(0.8)
                canvas.rect(1.25 * cm, 1.25 * cm, w - 2.5 * cm, h - 2.5 * cm)
        canvas.restoreState()

    for b in rendered["blocks"]:
        t = b["t"]
        if t == "org":
            story.append(Paragraph(_rl(b["name"].upper() if cert else b["name"]), S["org"] if not cert else ParagraphStyle("oc", parent=S["org"], fontSize=11)))
            if b.get("tagline"):
                story.append(Paragraph(_rl(b["tagline"]), S["muted"]))
        elif t == "rule":
            story.append(HRFlowable(width="100%", thickness=1.2, color=ac, spaceAfter=8))
        elif t == "title":
            story.append(Paragraph(_rl(b["text"]), S["xl"] if b.get("size") == "xl" else S["title"]))
        elif t == "subtitle":
            story.append(Paragraph(_rl(b["text"]), S["subtitle"]))
        elif t == "meta":
            story.append(Paragraph(_rl("\n".join(f"{l}: {v}" for l, v in b["rows"])), S["right"]))
        elif t == "lines":
            story.append(Paragraph(_rl("\n".join(b["lines"])), S["p"]))
        elif t == "heading":
            story.append(Paragraph(_rl(b["text"].upper() if b.get("style") == "bar" else b["text"]), S["bar" if b.get("style") == "bar" else "heading"]))
        elif t == "p":
            style = S["muted"] if b.get("muted") else S.get(b.get("align", "left"), S["p"]) if b.get("align") != "left" else S["p"]
            text = _rl(b["text"])
            story.append(Paragraph(f"<b>{text}</b>" if b.get("bold") else text, style))
        elif t == "recipient":
            story += [Paragraph(_rl(b["text"]), S["recipient"]),
                      HRFlowable(width="60%", thickness=0.8, color=colors.HexColor("#" + _tint(accent, 0.5)), spaceAfter=10)]
        elif t == "list":
            for n, item in enumerate(b["items"], start=1):
                bullet = f"{n}." if b.get("ordered") else "•"
                story.append(Paragraph(_rl(item), ParagraphStyle("li", parent=S["p"], leftIndent=18, bulletIndent=4, spaceAfter=2), bulletText=bullet))
            story.append(Spacer(1, 6))
        elif t == "kv":
            memo = b.get("style") == "memo"
            data = [[Paragraph(_rl(l), S["cellb"]), Paragraph(f"<b>{_rl(v)}</b>" if memo and l.upper() == "SUBJECT" else _rl(v), S["cell"])] for l, v in b["rows"]]
            table = Table(data, colWidths=[4.2 * cm, doc.width - 4.2 * cm], hAlign="LEFT")
            style = [("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#" + _tint(accent, 0.92))), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                     ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
            if not memo:
                style.append(("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")))
            table.setStyle(TableStyle(style))
            story += [table, Spacer(1, 8)]
        elif t == "signatures" and b["items"]:
            n = len(b["items"])
            gap = 1.0 * cm
            col_w = 7.5 * cm if n == 1 else (doc.width - gap * (n - 1)) / n
            widths, labels, spacers, names, titles = [], [], [], [], []
            for i, item in enumerate(b["items"]):
                widths.append(col_w)
                labels.append(Paragraph(_rl(item.get("label", "")), S["siglab"]))
                spacers.append("")
                names.append(Paragraph(_rl(item["name"]), S["sig"]))
                titles.append(Paragraph(_rl(item.get("title", "")), S["sigt"]))
                if i < n - 1:
                    widths.append(gap)
                    labels.append(""); spacers.append(""); names.append(""); titles.append("")
            table = Table([labels, spacers, names, titles], colWidths=widths, rowHeights=[None, 26, None, None],
                          hAlign="CENTER" if (cert or n > 1) else "LEFT")
            style = [("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]
            for i in range(0, len(widths), 2):
                style.append(("LINEABOVE", (i, 2), (i, 2), 0.8, colors.HexColor("#444444")))
            table.setStyle(TableStyle(style))
            story.append(table)
        elif t == "spacer":
            story.append(Spacer(1, b.get("h", 8)))
        elif t == "seal":
            story.append(Paragraph("[ School seal / logo ]", S["muted"]))

    if not story:
        story.append(Paragraph(" ", S["p"]))
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return out.getvalue()
