"""Generate Prism Capital documentation PDF from markdown."""
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
)

PRIMARY = colors.HexColor("#166534")
INK = colors.HexColor("#0F1B14")
MUTED = colors.HexColor("#5A6B60")
LIGHT_BG = colors.HexColor("#F2F5F3")
BORDER = colors.HexColor("#D5DED8")


def build_styles():
    ss = getSampleStyleSheet()
    styles = {
        "cover_title": ParagraphStyle("cover_title", parent=ss["Title"], fontName="Helvetica-Bold",
                                      fontSize=42, leading=48, textColor=PRIMARY, spaceAfter=8),
        "cover_sub":   ParagraphStyle("cover_sub", parent=ss["Normal"], fontName="Helvetica",
                                      fontSize=14, leading=20, textColor=MUTED, spaceAfter=4),
        "cover_meta":  ParagraphStyle("cover_meta", parent=ss["Normal"], fontName="Helvetica",
                                      fontSize=10, leading=14, textColor=MUTED),
        "h1": ParagraphStyle("h1", parent=ss["Heading1"], fontName="Helvetica-Bold",
                             fontSize=22, leading=28, textColor=PRIMARY,
                             spaceBefore=18, spaceAfter=8),
        "h2": ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold",
                             fontSize=14, leading=20, textColor=INK,
                             spaceBefore=12, spaceAfter=4),
        "h3": ParagraphStyle("h3", parent=ss["Heading3"], fontName="Helvetica-Bold",
                             fontSize=11, leading=16, textColor=PRIMARY,
                             spaceBefore=10, spaceAfter=2),
        "body": ParagraphStyle("body", parent=ss["BodyText"], fontName="Helvetica",
                               fontSize=10, leading=15, textColor=INK, spaceAfter=6, alignment=TA_LEFT),
        "bullet": ParagraphStyle("bullet", parent=ss["BodyText"], fontName="Helvetica",
                                 fontSize=10, leading=15, textColor=INK,
                                 leftIndent=14, bulletIndent=2, spaceAfter=2),
        "code": ParagraphStyle("code", parent=ss["Code"], fontName="Courier",
                               fontSize=8.5, leading=12, textColor=INK,
                               backColor=LIGHT_BG, borderColor=BORDER, borderWidth=0.5,
                               borderPadding=6, leftIndent=0, spaceAfter=8),
        "small": ParagraphStyle("small", parent=ss["Normal"], fontName="Helvetica-Oblique",
                                fontSize=8.5, leading=12, textColor=MUTED),
    }
    return styles


INLINE_RE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|⭐)")

def inline(text: str) -> str:
    """Convert markdown inline to reportlab HTML-lite."""
    def repl(m):
        s = m.group(0)
        if s.startswith("**"):
            return f"<b>{s[2:-2]}</b>"
        if s.startswith("`"):
            return f'<font face="Courier" color="#166534">{s[1:-1]}</font>'
        if s == "⭐":
            return '<font color="#166534">★</font>'
        return s
    # escape reportlab reserved chars first
    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # re-apply markdown after escape (adjust patterns for escaped chars)
    def esc_repl(m):
        s = m.group(0)
        if s.startswith("**"):
            return f"<b>{s[2:-2]}</b>"
        if s.startswith("`"):
            return f'<font face="Courier" color="#166534">{s[1:-1]}</font>'
        if s == "⭐":
            return '<font color="#166534">★</font>'
        return s
    return re.sub(r"(\*\*.+?\*\*|`[^`]+`|⭐)", esc_repl, safe)


def parse_md_to_flow(md: str, styles):
    """Very small subset markdown → platypus flowables."""
    flow = []
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        # code fence
        if line.strip().startswith("```"):
            i += 1
            code_lines = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            code_text = "<br/>".join(l.replace(" ", "&nbsp;").replace("<", "&lt;").replace(">", "&gt;") or "&nbsp;"
                                     for l in code_lines)
            flow.append(Paragraph(code_text, styles["code"]))
            i += 1
            continue
        # table
        if line.strip().startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s\-:|]+\|$", lines[i + 1].strip()):
            header = [c.strip() for c in line.strip().strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            data = [[Paragraph(inline(h), styles["body"]) for h in header]]
            for r in rows:
                # pad/truncate to header length
                r = (r + [""] * len(header))[:len(header)]
                data.append([Paragraph(inline(c), styles["body"]) for c in r])
            # column widths auto
            tbl = Table(data, colWidths=[(170 * mm) / max(1, len(header))] * len(header), repeatRows=1)
            tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            flow.append(tbl)
            flow.append(Spacer(1, 6))
            continue
        # header rules
        if line.startswith("# "):
            flow.append(Paragraph(inline(line[2:].strip()), styles["h1"]))
        elif line.startswith("## "):
            flow.append(Paragraph(inline(line[3:].strip()), styles["h2"]))
        elif line.startswith("### "):
            flow.append(Paragraph(inline(line[4:].strip()), styles["h3"]))
        elif line.startswith("- "):
            flow.append(Paragraph(inline(line[2:]), styles["bullet"], bulletText="•"))
        elif line.startswith("> "):
            flow.append(Paragraph(f"<i>{inline(line[2:])}</i>", styles["small"]))
        elif line.strip() == "---":
            flow.append(Spacer(1, 4))
        elif line.strip() == "":
            flow.append(Spacer(1, 4))
        else:
            flow.append(Paragraph(inline(line), styles["body"]))
        i += 1
    return flow


def on_page(canvas, doc):
    canvas.saveState()
    # footer bar
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(20 * mm, 15 * mm, 190 * mm, 15 * mm)
    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 10 * mm, "Prism Capital · Documentation")
    canvas.drawRightString(190 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf(out_path: str):
    styles = build_styles()
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=22 * mm,
        title="Prism Capital — Documentation",
        author="Prism Capital",
    )
    flow = []

    # ---------- Cover ----------
    flow.append(Spacer(1, 60 * mm))
    flow.append(Paragraph("Prism Capital", styles["cover_title"]))
    flow.append(Paragraph("Institutional-grade Shariah-compliant private-placement platform.",
                          styles["cover_sub"]))
    flow.append(Spacer(1, 8))
    flow.append(Paragraph("User guide + technical reference · Formerly RibhShare",
                          styles["cover_sub"]))
    flow.append(Spacer(1, 40))
    flow.append(Paragraph("Version: 2026-07-24 · Phases P1–P4 shipped", styles["cover_meta"]))
    flow.append(Paragraph("Contents: product overview · roles · end-to-end flow · screen reference · "
                          "profit maker-checker · ledger · schema · RPCs · deploy",
                          styles["cover_meta"]))
    flow.append(PageBreak())

    # ---------- Part I: User Guide ----------
    with open("/app/docs/USER_GUIDE.md", "r", encoding="utf-8") as f:
        user_md = f.read()
    flow.extend(parse_md_to_flow(user_md, styles))
    flow.append(PageBreak())

    # ---------- Part II: Technical Reference ----------
    with open("/app/docs/TECHNICAL_REFERENCE.md", "r", encoding="utf-8") as f:
        tech_md = f.read()
    flow.extend(parse_md_to_flow(tech_md, styles))

    doc.build(flow, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    build_pdf("/app/docs/Prism_Capital_Documentation.pdf")
