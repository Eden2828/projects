import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

# ── Fonts ──────────────────────────────────────────────────────────────────────
FONT_DIR = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont('Arial',      os.path.join(FONT_DIR, 'arial.ttf')))
pdfmetrics.registerFont(TTFont('Arial-Bold', os.path.join(FONT_DIR, 'arialbd.ttf')))

try:
    from bidi.algorithm import get_display
    def rtl(t): return get_display(str(t))
except ImportError:
    def rtl(t): return str(t)

# ── Brand palette ──────────────────────────────────────────────────────────────
C_BG        = colors.HexColor('#F7F4EF')   # warm cream
C_CARD      = colors.HexColor('#FFFFFF')
C_OLIVE     = colors.HexColor('#5A6B3A')   # dark olive green
C_GREEN     = colors.HexColor('#7A9B52')   # medium green
C_GOLD      = colors.HexColor('#C8A84B')   # warm gold
C_ORANGE    = colors.HexColor('#D97C3A')   # warm orange
C_DARK      = colors.HexColor('#2B2B2B')
C_MEDIUM    = colors.HexColor('#555555')
C_LIGHT     = colors.HexColor('#888888')
C_LINE      = colors.HexColor('#E0DAD0')
C_ACCENT1   = colors.HexColor('#4A7C9E')   # blue accent
C_ACCENT2   = colors.HexColor('#C25E5E')   # red accent
C_MUTED_BG  = colors.HexColor('#EEF2E8')   # light green tint

# ── Data ───────────────────────────────────────────────────────────────────────
campaigns = [
    {
        'name':        rtl('בוקר באסיף – הזמנת מקום'),
        'objective':   rtl('הזמנות דרך Tabbит'),
        'spend':       1179.94,
        'reach':       57683,
        'impressions': 177296,
        'cpm':         6.66,
        'link_clicks': 1604,
        'ctr':         0.905,
        'cpc':         0.735,
        'lpv':         887,
        'results':     62,
        'result_type': rtl('לידים'),
        'cpr':         19.03,
        'color':       C_GREEN,
    },
    {
        'name':        rtl('אירועים – לידים לעמוד נחיתה'),
        'objective':   rtl('לידים לאירועים'),
        'spend':       1243.34,
        'reach':       23642,
        'impressions': 65088,
        'cpm':         19.10,
        'link_clicks': 456,
        'ctr':         0.701,
        'cpc':         2.727,
        'lpv':         387,
        'results':     29,
        'result_type': rtl('לידים'),
        'cpr':         42.87,
        'color':       C_ORANGE,
    },
    {
        'name':        rtl('הזמנת מקום – טראפיק'),
        'objective':   rtl('הזמנות דרך Tabbит'),
        'spend':       50.27,
        'reach':       5043,
        'impressions': 6881,
        'cpm':         7.31,
        'link_clicks': 74,
        'ctr':         1.076,
        'cpc':         0.679,
        'lpv':         34,
        'results':     0,
        'result_type': rtl('—'),
        'cpr':         0,
        'color':       C_GOLD,
    },
    {
        'name':        rtl('גיוס עובדים – מסרים'),
        'objective':   rtl('גיוס עובדים'),
        'spend':       539.03,
        'reach':       19008,
        'impressions': 53992,
        'cpm':         9.98,
        'link_clicks': 162,
        'ctr':         0.300,
        'cpc':         3.327,
        'lpv':         2,
        'results':     42,
        'result_type': rtl('שיחות'),
        'cpr':         12.83,
        'color':       C_ACCENT1,
    },
    {
        'name':        rtl('מודעות מותג – Awareness'),
        'objective':   rtl('חשיפה ומודעות'),
        'spend':       142.56,
        'reach':       4842,
        'impressions': 10362,
        'cpm':         13.76,
        'link_clicks': 58,
        'ctr':         0.560,
        'cpc':         2.459,
        'lpv':         27,
        'results':     4842,
        'result_type': rtl('חשיפה'),
        'cpr':         0.029,
        'color':       C_ACCENT2,
    },
]

total_spend  = sum(c['spend']       for c in campaigns)
total_reach  = sum(c['reach']       for c in campaigns)
total_impr   = sum(c['impressions'] for c in campaigns)
total_clicks = sum(c['link_clicks'] for c in campaigns)
total_lpv    = sum(c['lpv']         for c in campaigns)
leads        = sum(c['results'] for c in campaigns if c['result_type'] in (rtl('לידים'),))
messages     = sum(c['results'] for c in campaigns if c['result_type'] == rtl('שיחות'))

# ── Canvas helper class ────────────────────────────────────────────────────────
OUT = r"C:\Users\Guy\OneDrive\Desktop\דאשבורד\אסיף_דאשבורד_מאי_2026.pdf"

PAGE_W, PAGE_H = landscape(A4)

def draw_rounded_rect(c, x, y, w, h, r, fill_color, stroke_color=None, stroke_width=0):
    c.saveState()
    c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(stroke_width)
    else:
        c.setStrokeColor(fill_color)
        c.setLineWidth(0)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1 if stroke_color else 0)
    c.restoreState()

def draw_text(c, text, x, y, font='Arial', size=10, color=C_DARK, align='center'):
    c.saveState()
    c.setFont(font, size)
    c.setFillColor(color)
    if align == 'center':
        c.drawCentredString(x, y, text)
    elif align == 'right':
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)
    c.restoreState()

def fmt_usd(v):   return f'${v:,.0f}'
def fmt_num(v):   return f'{v:,}'
def fmt_pct(v):   return f'{v:.2f}%'

# ── Build PDF ──────────────────────────────────────────────────────────────────
c = pdfcanvas.Canvas(OUT, pagesize=landscape(A4))
W, H = PAGE_W, PAGE_H

MARGIN = 1.5*cm
INNER_W = W - 2*MARGIN

# ── PAGE 1 ─────────────────────────────────────────────────────────────────────

# Background
draw_rounded_rect(c, 0, 0, W, H, 0, C_BG)

# Header bar
HEADER_H = 3.8*cm
draw_rounded_rect(c, 0, H - HEADER_H, W, HEADER_H, 0, C_OLIVE)

# Logo placeholder circle
draw_rounded_rect(c, MARGIN, H - HEADER_H + 0.5*cm, 2.8*cm, 2.8*cm, 1.4*cm, colors.white)
draw_text(c, rtl('אסיף'), MARGIN + 1.4*cm, H - HEADER_H + 1.35*cm, 'Arial-Bold', 14, C_OLIVE)

# Title
draw_text(c, rtl('דוח ביצועי פרסום – מאי 2026'), W/2, H - HEADER_H + 2.2*cm, 'Arial-Bold', 20, colors.white)
draw_text(c, rtl('מסעדת אסיף   |   Meta Ads   |   01/05/2026 – 31/05/2026'), W/2, H - HEADER_H + 1.1*cm, 'Arial', 10, colors.HexColor('#D4E4C0'))

# Small date label right
draw_text(c, rtl('הופק: יוני 2026'), W - MARGIN, H - HEADER_H + 2.2*cm, 'Arial', 8, colors.HexColor('#B8CCB0'), 'right')

# ── KPI Cards ──────────────────────────────────────────────────────────────────
KPI_Y     = H - HEADER_H - 3.6*cm
KPI_W     = (INNER_W - 5*0.4*cm) / 6
KPI_H     = 3.0*cm
KPI_GAP   = 0.4*cm

kpis = [
    (rtl('סה"כ השקעה'),    fmt_usd(total_spend),  rtl('USD'),  C_OLIVE),
    (rtl('חשיפה ייחודית'), fmt_num(total_reach),  rtl('אנשים'), C_GREEN),
    (rtl('חשיפות'),        fmt_num(total_impr),   rtl('נוצרו'),  C_GOLD),
    (rtl('קליקים'),        fmt_num(total_clicks), rtl('לינק'),   C_ORANGE),
    (rtl('לידים'),         str(leads),            rtl('הושגו'),  C_ACCENT1),
    (rtl('שיחות'),         str(messages),         rtl('התחלו'),  C_ACCENT2),
]

for i, (label, value, sub, clr) in enumerate(kpis):
    kx = MARGIN + i * (KPI_W + KPI_GAP)
    ky = KPI_Y
    # Card shadow
    draw_rounded_rect(c, kx+2, ky-2, KPI_W, KPI_H, 8, colors.HexColor('#D8D0C4'))
    # Card
    draw_rounded_rect(c, kx, ky, KPI_W, KPI_H, 8, C_CARD)
    # Top accent bar
    draw_rounded_rect(c, kx, ky + KPI_H - 4, KPI_W, 4, 4, clr)
    # Value
    draw_text(c, value, kx + KPI_W/2, ky + KPI_H/2 + 0.1*cm, 'Arial-Bold', 18, C_DARK)
    # Label
    draw_text(c, label, kx + KPI_W/2, ky + KPI_H/2 - 0.65*cm, 'Arial', 8, C_MEDIUM)
    # Sub
    draw_text(c, sub, kx + KPI_W/2, ky + 0.35*cm, 'Arial', 7, clr)

# ── Campaign Bar Chart (spend) ─────────────────────────────────────────────────
CHART_Y = KPI_Y - 6.0*cm
CHART_X = MARGIN
CHART_W = INNER_W * 0.45
CHART_H = 5.5*cm

draw_rounded_rect(c, CHART_X, CHART_Y, CHART_W, CHART_H, 8, C_CARD)
draw_rounded_rect(c, CHART_X, CHART_Y + CHART_H - 3, CHART_W, 3, 4, C_OLIVE)
draw_text(c, rtl('השקעה לפי קמפיין (USD)'), CHART_X + CHART_W/2, CHART_Y + CHART_H - 0.8*cm, 'Arial-Bold', 10, C_DARK)

spends = [c2['spend'] for c2 in campaigns]
names  = [c2['name']  for c2 in campaigns]
clrs   = [c2['color'] for c2 in campaigns]
max_s  = max(spends)

BAR_AREA_X = CHART_X + 0.5*cm
BAR_AREA_Y = CHART_Y + 0.5*cm
BAR_AREA_W = CHART_W - 1.2*cm
BAR_AREA_H = CHART_H - 1.8*cm
bar_w = BAR_AREA_W / len(campaigns) - 0.2*cm
bar_gap = BAR_AREA_W / len(campaigns)

for i, (sp, nm, clr2) in enumerate(zip(spends, names, clrs)):
    bx = BAR_AREA_X + i * bar_gap + 0.1*cm
    bh = (sp / max_s) * BAR_AREA_H
    by = BAR_AREA_Y
    draw_rounded_rect(c, bx, by, bar_w, bh, 3, clr2)
    draw_text(c, f'${sp:,.0f}', bx + bar_w/2, by + bh + 0.15*cm, 'Arial-Bold', 7, C_DARK)

# ── Campaign table ─────────────────────────────────────────────────────────────
TABLE_X = MARGIN + CHART_W + 0.5*cm
TABLE_Y = CHART_Y
TABLE_W = INNER_W - CHART_W - 0.5*cm
TABLE_H = CHART_H

draw_rounded_rect(c, TABLE_X, TABLE_Y, TABLE_W, TABLE_H, 8, C_CARD)
draw_rounded_rect(c, TABLE_X, TABLE_Y + TABLE_H - 3, TABLE_W, 3, 4, C_OLIVE)
draw_text(c, rtl('סיכום קמפיינים'), TABLE_X + TABLE_W/2, TABLE_Y + TABLE_H - 0.8*cm, 'Arial-Bold', 10, C_DARK)

col_titles = [rtl('קמפיין'), rtl('הוצאה'), rtl('חשיפה'), rtl('קליקים'), rtl('לידים'), rtl('CPR')]
col_xs = [TABLE_X + 0.3*cm, TABLE_X + TABLE_W*0.32, TABLE_X + TABLE_W*0.48,
          TABLE_X + TABLE_W*0.63, TABLE_X + TABLE_W*0.77, TABLE_X + TABLE_W*0.91]

row_h = (TABLE_H - 1.5*cm) / (len(campaigns) + 1)
header_y = TABLE_Y + TABLE_H - 1.6*cm

# Header row bg
draw_rounded_rect(c, TABLE_X + 0.2*cm, header_y - 0.05*cm, TABLE_W - 0.4*cm, row_h, 4, C_MUTED_BG)

for j, (ct, cx) in enumerate(zip(col_titles, col_xs)):
    draw_text(c, ct, cx, header_y + 0.1*cm, 'Arial-Bold', 7.5, C_OLIVE)

for i, camp in enumerate(campaigns):
    ry = header_y - (i+1)*row_h
    if i % 2 == 0:
        draw_rounded_rect(c, TABLE_X + 0.2*cm, ry - 0.05*cm, TABLE_W - 0.4*cm, row_h, 3, colors.HexColor('#F9F7F3'))
    cpr_str = f'${camp["cpr"]:.2f}' if camp["cpr"] > 0 else '—'
    row_vals = [
        camp['name'],
        f'${camp["spend"]:,.0f}',
        fmt_num(camp['reach']),
        fmt_num(camp['link_clicks']),
        str(camp['results']) if camp['results'] > 0 else '—',
        cpr_str,
    ]
    for j, (val, cx) in enumerate(zip(row_vals, col_xs)):
        clr_v = camp['color'] if j == 0 else C_DARK
        fnt   = 'Arial-Bold' if j == 0 else 'Arial'
        draw_text(c, val, cx, ry + 0.1*cm, fnt, 7, clr_v)

# ── Bottom metrics strip ────────────────────────────────────────────────────────
STRIP_Y = CHART_Y - 2.5*cm
STRIP_H = 2.1*cm

metrics = [
    (rtl('ממוצע CTR'), fmt_pct(sum(c2['ctr'] for c2 in campaigns)/len(campaigns)), C_GREEN),
    (rtl('ממוצע CPM'), f'${sum(c2["cpm"] for c2 in campaigns)/len(campaigns):.2f}', C_GOLD),
    (rtl('ממוצע CPC'), f'${sum(c2["cpc"] for c2 in campaigns if c2["cpc"]>0)/4:.2f}', C_ORANGE),
    (rtl('דפי נחיתה'), fmt_num(total_lpv), C_ACCENT1),
    (rtl('תדירות ממוצעת'), f'{sum(c["reach"] and c["impressions"]/c["reach"] for c in campaigns if c["reach"])/len(campaigns):.2f}x', C_OLIVE),
]

met_w = (INNER_W - 4*0.3*cm) / 5

for i, (lbl, val, clr3) in enumerate(metrics):
    mx = MARGIN + i*(met_w + 0.3*cm)
    draw_rounded_rect(c, mx, STRIP_Y, met_w, STRIP_H, 6, C_CARD)
    draw_rounded_rect(c, mx, STRIP_Y, 3, STRIP_H, 3, clr3)
    draw_text(c, val,  mx + met_w/2, STRIP_Y + STRIP_H/2 + 0.05*cm, 'Arial-Bold', 13, C_DARK)
    draw_text(c, lbl,  mx + met_w/2, STRIP_Y + 0.3*cm, 'Arial', 7.5, C_MEDIUM)

# ── Footer ──────────────────────────────────────────────────────────────────────
c.saveState()
c.setFillColor(C_OLIVE)
c.rect(0, 0, W, 1.0*cm, fill=1, stroke=0)
c.restoreState()
draw_text(c, rtl('Think Digital  |  דוח ביצועים חודשי  |  מאי 2026  |  מסעדת אסיף'), W/2, 0.3*cm, 'Arial', 8, colors.white)

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 2 – Campaign deep-dive
# ═══════════════════════════════════════════════════════════════════════════════
c.showPage()
draw_rounded_rect(c, 0, 0, W, H, 0, C_BG)

# Header
draw_rounded_rect(c, 0, H - 2.5*cm, W, 2.5*cm, 0, C_OLIVE)
draw_text(c, rtl('פירוט קמפיינים – מאי 2026'), W/2, H - 1.6*cm, 'Arial-Bold', 16, colors.white)
draw_text(c, rtl('מסעדת אסיף   |   Meta Ads'), W/2, H - 0.9*cm, 'Arial', 9, colors.HexColor('#D4E4C0'))

# Campaign cards grid: 3 top + 2 bottom
CARD_COLS = 3
CARD_W = (INNER_W - (CARD_COLS-1)*0.5*cm) / CARD_COLS
CARD_H = 6.8*cm
CARD_GAP_X = 0.5*cm
CARD_GAP_Y = 0.5*cm

START_Y = H - 2.5*cm - 0.4*cm

for idx, camp in enumerate(campaigns):
    col = idx % CARD_COLS
    row = idx // CARD_COLS
    cx2 = MARGIN + col * (CARD_W + CARD_GAP_X)
    cy2 = START_Y - (row+1)*(CARD_H + CARD_GAP_Y) + CARD_GAP_Y

    # Shadow
    draw_rounded_rect(c, cx2+2, cy2-2, CARD_W, CARD_H, 8, colors.HexColor('#D8D0C4'))
    # Card body
    draw_rounded_rect(c, cx2, cy2, CARD_W, CARD_H, 8, C_CARD)
    # Header strip
    draw_rounded_rect(c, cx2, cy2 + CARD_H - 1.3*cm, CARD_W, 1.3*cm, 8, camp['color'])
    draw_rounded_rect(c, cx2, cy2 + CARD_H - 1.3*cm, CARD_W, 0.65*cm, 0, camp['color'])

    draw_text(c, camp['name'], cx2 + CARD_W/2, cy2 + CARD_H - 1.0*cm, 'Arial-Bold', 8.5, colors.white)
    draw_text(c, camp['objective'], cx2 + CARD_W/2, cy2 + CARD_H - 0.4*cm - 0.85*cm + 0.5*cm,
              'Arial', 7, colors.HexColor('#E8F4DC'))

    # Inner metrics 2x3
    inner_metrics = [
        (rtl('הוצאה'),       f'${camp["spend"]:,.0f}'),
        (rtl('חשיפה'),       fmt_num(camp['reach'])),
        (rtl('קליקים'),      fmt_num(camp['link_clicks'])),
        (rtl('CTR'),         fmt_pct(camp['ctr'])),
        (rtl('CPM'),         f'${camp["cpm"]:.2f}'),
        (rtl('CPC'),         f'${camp["cpc"]:.3f}'),
    ]

    cell_w = CARD_W / 3
    cell_h = (CARD_H - 1.5*cm) / 2
    cell_start_y = cy2 + CARD_H - 1.5*cm - cell_h

    for mi, (mlbl, mval) in enumerate(inner_metrics):
        mc = mi % 3
        mr = mi // 3
        mxp = cx2 + mc*cell_w
        myp = cell_start_y - mr*cell_h

        # Divider lines
        if mc > 0:
            c.saveState()
            c.setStrokeColor(C_LINE)
            c.setLineWidth(0.5)
            c.line(mxp, myp + 0.15*cm, mxp, myp + cell_h - 0.15*cm)
            c.restoreState()

        draw_text(c, mval,  mxp + cell_w/2, myp + cell_h/2 + 0.1*cm, 'Arial-Bold', 12, C_DARK)
        draw_text(c, mlbl,  mxp + cell_w/2, myp + 0.3*cm,             'Arial',      7,  C_LIGHT)

    # Result badge
    if camp['results'] > 0 and camp['result_type'] != rtl('חשיפה'):
        badge_x = cx2 + CARD_W/2 - 2.5*cm
        badge_y = cy2 + 0.05*cm
        draw_rounded_rect(c, badge_x, badge_y, 5*cm, 0.8*cm, 4, camp['color'])
        badge_text = f'{camp["result_type"]}: {camp["results"]} | CPR: ${camp["cpr"]:.2f}'
        draw_text(c, badge_text, cx2 + CARD_W/2, badge_y + 0.2*cm, 'Arial-Bold', 8, colors.white)

# ── Footer ──────────────────────────────────────────────────────────────────────
c.saveState()
c.setFillColor(C_OLIVE)
c.rect(0, 0, W, 1.0*cm, fill=1, stroke=0)
c.restoreState()
draw_text(c, rtl('Think Digital  |  דוח ביצועים חודשי  |  מאי 2026  |  מסעדת אסיף'), W/2, 0.3*cm, 'Arial', 8, colors.white)

# ── Save ────────────────────────────────────────────────────────────────────────
c.save()
print(f"PDF saved: {OUT}")
