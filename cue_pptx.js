'use strict';
const pptxgen = require('pptxgenjs');

const OUT = 'CUE_דאשבורד_מאי_2026.pptx';

// ── Palette (premium dark / modern) ───────────────────────────────────────────
const NAVY    = '0F1B2D';
const NAVY2   = '1A2B40';
const BLUE    = '2E6DA4';
const CYAN    = '3AB5C6';
const GOLD    = 'C9A84C';
const AMBER   = 'E8B84B';
const GREEN   = '4CAF7D';
const PURPLE  = '7B68C8';
const RED     = 'E05252';
const CREAM   = 'F5F0E8';
const WHITE   = 'FFFFFF';
const DARK    = '0D1520';
const MED     = '556070';
const LIGHT   = '8899AA';
const SLATE   = 'E8F0F8';

// FB campaign colors
const FB_COLORS = [BLUE, CYAN, GREEN, PURPLE];
// Google color
const G_COLOR   = AMBER;

// ── Facebook Data ─────────────────────────────────────────────────────────────
const fbCamps = [
  { name:'דרושים – כללי',    obj:'גיוס עובדים',
    spend:496.14,  reach:5490,  impr:21442, cpm:23.14,
    clicks:108,    freq:3.91,
    results:18,    rtype:'שיחות WhatsApp', cpr:27.56, color:BLUE },
  { name:'דרושים – טבחים',   obj:'גיוס טבחים',
    spend:1261.40, reach:16596, impr:39403, cpm:32.01,
    clicks:230,    freq:2.37,
    results:30,    rtype:'לידים', cpr:42.05, color:CYAN },
  { name:'דרושים – מלצרים',  obj:'גיוס מלצרים',
    spend:711.55,  reach:4658,  impr:11849, cpm:60.05,
    clicks:47,     freq:2.54,
    results:16,    rtype:'לידים', cpr:44.47, color:GREEN },
  { name:'הזמנות Ontopo',    obj:'הזמנות מסעדה',
    spend:471.91,  reach:9480,  impr:21538, cpm:21.91,
    clicks:110,    freq:2.27,
    results:6,     rtype:'רכישות', cpr:78.65, color:PURPLE },
];

const fbTotalSpend  = fbCamps.reduce((s,c)=>s+c.spend,0);
const fbTotalReach  = fbCamps.reduce((s,c)=>s+c.reach,0);
const fbTotalImpr   = fbCamps.reduce((s,c)=>s+c.impr,0);
const fbTotalClicks = fbCamps.reduce((s,c)=>s+c.clicks,0);
const fbTotalRes    = fbCamps.reduce((s,c)=>s+c.results,0);

// ── Google Data ───────────────────────────────────────────────────────────────
const google = {
  name:    'Performance Max – Asset Group 1',
  spend:   2616.13,
  clicks:  4984,
  impr:    213167,
  ctr:     2.34,
  cpc:     0.52,
  convRate:1.85,
  convs:   103.99,
  cpa:     25.16,
};

// ── Grand totals ───────────────────────────────────────────────────────────────
const grandSpend  = fbTotalSpend + google.spend;
const grandClicks = fbTotalClicks + google.clicks;
const grandImpr   = fbTotalImpr  + google.impr;

const fILS = v => `₪${Math.round(v).toLocaleString('en')}`;
const fNum = v => v.toLocaleString('en');
const fPct = v => `${v.toFixed(2)}%`;

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title  = 'CUE – דוח ביצועים מאי 2026';
pres.author = 'Think Digital';

const W = 10, H = 5.625;
const makeShadow = () => ({ type:'outer', blur:10, offset:4, angle:135, color:'000000', opacity:0.18 });

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 – Title
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY };

  // Decorative arcs
  s.addShape(pres.shapes.OVAL, { x:8.0, y:-2.0, w:5, h:5, fill:{ color:NAVY2, transparency:0 }, line:{ color:NAVY2, width:0 } });
  s.addShape(pres.shapes.OVAL, { x:8.8, y:-1.2, w:3, h:3, fill:{ color:BLUE, transparency:75 }, line:{ color:BLUE, width:0 } });
  s.addShape(pres.shapes.OVAL, { x:-1.5, y:3.8, w:3.5, h:3.5, fill:{ color:GOLD, transparency:82 }, line:{ color:GOLD, width:0 } });

  // Gold left bar
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.12, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  // CUE badge
  s.addShape(pres.shapes.RECTANGLE, { x:0.5, y:0.45, w:1.6, h:0.75, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('CUE', { x:0.5, y:0.5, w:1.6, h:0.65, align:'center', fontSize:22, bold:true, color:NAVY, fontFace:'Calibri' });

  // Titles
  s.addText('דוח ביצועי פרסום', { x:0.3, y:1.6, w:9.4, h:0.9, align:'center', fontSize:38, bold:true, color:WHITE, fontFace:'Calibri' });
  s.addText('מאי 2026', { x:0.3, y:2.55, w:9.4, h:0.9, align:'center', fontSize:52, bold:true, color:GOLD, fontFace:'Calibri' });

  s.addShape(pres.shapes.RECTANGLE, { x:2.5, y:3.6, w:5, h:0.04, fill:{ color:BLUE }, line:{ color:BLUE, width:0 } });

  // Platform badges
  const platforms = [
    { l:'Meta Ads', c:BLUE },
    { l:'Google Ads', c:AMBER },
  ];
  platforms.forEach((p,i) => {
    const px = 3.3 + i*1.9;
    s.addShape(pres.shapes.RECTANGLE, { x:px, y:3.75, w:1.6, h:0.35, fill:{ color:p.c, transparency:85 }, line:{ color:p.c, width:1 } });
    s.addText(p.l, { x:px, y:3.77, w:1.6, h:0.31, align:'center', fontSize:9, bold:true, color:p.c, fontFace:'Calibri' });
  });

  s.addText('01/05/2026 – 31/05/2026  |  Think Digital', { x:0.3, y:4.25, w:9.4, h:0.4, align:'center', fontSize:11, color:LIGHT, fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 – Budget Split Overview
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: SLATE };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:NAVY }, line:{ color:NAVY, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('תקציב לפי פלטפורמה – מאי 2026', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:22, bold:true, color:WHITE, fontFace:'Calibri' });

  // Grand total card center-top
  s.addShape(pres.shapes.RECTANGLE, { x:3.5, y:1.0, w:3.0, h:1.4, fill:{ color:NAVY }, line:{ color:NAVY, width:0 }, shadow:makeShadow() });
  s.addText(fILS(grandSpend), { x:3.5, y:1.05, w:3.0, h:0.8, align:'center', fontSize:28, bold:true, color:GOLD, fontFace:'Calibri' });
  s.addText('סה"כ תקציב מאי', { x:3.5, y:1.82, w:3.0, h:0.45, align:'center', fontSize:11, color:WHITE, fontFace:'Calibri' });

  // Two platform cards
  const platforms = [
    { name:'Meta Ads', logo:'f', spend:fbTotalSpend, pct:(fbTotalSpend/grandSpend*100).toFixed(1), color:BLUE,
      sub1:`${fbCamps.length} קמפיינים`, sub2:`${fbTotalRes} תוצאות`, sub3:`${fNum(fbTotalReach)} חשיפה` },
    { name:'Google Ads', logo:'G', spend:google.spend, pct:(google.spend/grandSpend*100).toFixed(1), color:AMBER,
      sub1:'קמפיין Performance Max', sub2:`${fNum(Math.round(google.convs))} המרות`, sub3:`${fNum(google.clicks)} קליקים` },
  ];

  platforms.forEach((p,i) => {
    const px = 0.5 + i*5.2;
    const py = 2.55;
    const pw = 4.5, ph = 2.7;

    s.addShape(pres.shapes.RECTANGLE, { x:px, y:py, w:pw, h:ph, fill:{ color:WHITE }, line:{ color:'DDEAF5', width:1 }, shadow:makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x:px, y:py, w:pw, h:0.1, fill:{ color:p.color }, line:{ color:p.color, width:0 } });

    // Platform badge
    s.addShape(pres.shapes.OVAL, { x:px+0.2, y:py+0.2, w:0.65, h:0.65, fill:{ color:p.color }, line:{ color:p.color, width:0 } });
    s.addText(p.logo, { x:px+0.2, y:py+0.24, w:0.65, h:0.55, align:'center', fontSize:14, bold:true, color:WHITE, fontFace:'Calibri' });

    s.addText(p.name, { x:px+1.0, y:py+0.25, w:pw-1.2, h:0.5, align:'left', fontSize:16, bold:true, color:NAVY, fontFace:'Calibri', margin:0 });

    // Spend + pct
    s.addText(fILS(p.spend), { x:px+0.2, y:py+0.95, w:pw-0.4, h:0.7, align:'center', fontSize:26, bold:true, color:p.color, fontFace:'Calibri' });
    s.addText(`${p.pct}% מהתקציב הכולל`, { x:px+0.2, y:py+1.62, w:pw-0.4, h:0.35, align:'center', fontSize:10, color:MED, fontFace:'Calibri' });

    // Sub info
    [p.sub1, p.sub2, p.sub3].forEach((sub,si) => {
      s.addShape(pres.shapes.RECTANGLE, { x:px+0.2, y:py+2.05+si*0.0, w:0.06, h:0.22, fill:{ color:p.color }, line:{ color:p.color, width:0 } });
      s.addText(sub, { x:px+0.35, y:py+2.03+si*0.0, w:pw-0.55, h:0.22, align:'left', fontSize:9, color:MED, fontFace:'Calibri', margin:0 });
    });
    // Actually let's do them stacked
    s.addShape(pres.shapes.RECTANGLE, { x:px+0.2, y:py+2.02, w:pw-0.4, h:0.55, fill:{ color:p.color, transparency:92 }, line:{ color:p.color, width:0 } });
    s.addText(`${p.sub2}  ·  ${p.sub3}`, { x:px+0.2, y:py+2.1, w:pw-0.4, h:0.38, align:'center', fontSize:9, color:p.color, fontFace:'Calibri' });
  });

  // Budget pie chart (bar representation)
  s.addChart(pres.charts.PIE, [{
    name:'תקציב',
    labels:['Meta Ads','Google Ads'],
    values:[fbTotalSpend, google.spend],
  }], {
    x:3.8, y:1.05, w:2.4, h:1.3,
    chartColors:[BLUE, AMBER],
    showPercent:true,
    dataLabelFontSize:9,
    showLegend:false,
    chartArea:{ fill:{ color:WHITE } },
    plotArea:{ fill:{ color:WHITE } },
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:NAVY }, line:{ color:NAVY, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  CUE', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:LIGHT, fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 – Facebook KPIs
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: SLATE };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:BLUE }, line:{ color:BLUE, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  // Facebook logo text
  s.addShape(pres.shapes.OVAL, { x:0.2, y:0.12, w:0.62, h:0.62, fill:{ color:WHITE, transparency:20 }, line:{ color:WHITE, width:0 } });
  s.addText('f', { x:0.2, y:0.15, w:0.62, h:0.55, align:'center', fontSize:16, bold:true, color:WHITE, fontFace:'Calibri' });
  s.addText('Meta Ads – סיכום ביצועים', { x:0.9, y:0.12, w:9.0, h:0.6, align:'left', fontSize:20, bold:true, color:WHITE, fontFace:'Calibri', margin:0 });

  const kpis = [
    { l:'תקציב Meta',      v:fILS(fbTotalSpend),   c:BLUE   },
    { l:'חשיפה ייחודית',   v:fNum(fbTotalReach),   c:CYAN   },
    { l:'חשיפות',          v:fNum(fbTotalImpr),    c:PURPLE },
    { l:'קליקים',          v:fNum(fbTotalClicks),  c:GREEN  },
    { l:'תוצאות כלל',      v:String(fbTotalRes),   c:AMBER  },
  ];

  const KW=1.8, KH=3.6, KGX=0.15;
  const totalKW = kpis.length*KW+(kpis.length-1)*KGX;
  const startX  = (W-totalKW)/2;

  kpis.forEach((k,i) => {
    const kx=startX+i*(KW+KGX), ky=1.0;
    s.addShape(pres.shapes.RECTANGLE, { x:kx, y:ky, w:KW, h:KH, fill:{ color:WHITE }, line:{ color:'DDEAF5', width:1 }, shadow:makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x:kx, y:ky, w:KW, h:0.12, fill:{ color:k.c }, line:{ color:k.c, width:0 } });
    s.addText(k.v, { x:kx, y:ky+0.22, w:KW, h:0.85, align:'center', fontSize:20, bold:true, color:NAVY, fontFace:'Calibri' });
    s.addText(k.l, { x:kx, y:ky+1.1,  w:KW, h:0.5, align:'center', fontSize:11, color:MED, fontFace:'Calibri' });
    s.addShape(pres.shapes.RECTANGLE, { x:kx+0.3, y:ky+1.65, w:KW-0.6, h:0.03, fill:{ color:'DDEAF5' }, line:{ color:'DDEAF5', width:0 } });
    s.addText('₪ ILS', { x:kx, y:ky+1.75, w:KW, h:0.35, align:'center', fontSize:8, color:k.c, fontFace:'Calibri' });
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:BLUE }, line:{ color:BLUE, width:0 } });
  s.addText('Think Digital  |  Meta Ads  |  מאי 2026  |  CUE', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:WHITE, fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 – Facebook Campaign Cards
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: SLATE };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:BLUE }, line:{ color:BLUE, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addShape(pres.shapes.OVAL, { x:0.2, y:0.12, w:0.62, h:0.62, fill:{ color:WHITE, transparency:20 }, line:{ color:WHITE, width:0 } });
  s.addText('f', { x:0.2, y:0.15, w:0.62, h:0.55, align:'center', fontSize:16, bold:true, color:WHITE, fontFace:'Calibri' });
  s.addText('Meta Ads – פירוט קמפיינים', { x:0.9, y:0.12, w:9.0, h:0.6, align:'left', fontSize:20, bold:true, color:WHITE, fontFace:'Calibri', margin:0 });

  const CW=2.2, CH=4.4, CGX=0.12;
  const totalCW = fbCamps.length*CW+(fbCamps.length-1)*CGX;
  const sx = (W-totalCW)/2;

  fbCamps.forEach((c,i) => {
    const cx=sx+i*(CW+CGX), cy=0.95;
    s.addShape(pres.shapes.RECTANGLE, { x:cx, y:cy, w:CW, h:CH, fill:{ color:WHITE }, line:{ color:'DDEAF5', width:1 }, shadow:makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x:cx, y:cy, w:CW, h:0.6, fill:{ color:c.color }, line:{ color:c.color, width:0 } });
    s.addText(c.name, { x:cx, y:cy+0.1, w:CW, h:0.42, align:'center', fontSize:9.5, bold:true, color:WHITE, fontFace:'Calibri' });
    s.addText(c.obj,  { x:cx, y:cy+0.65, w:CW, h:0.3, align:'center', fontSize:8, color:LIGHT, fontFace:'Calibri' });

    s.addText(fILS(c.spend), { x:cx, y:cy+0.95, w:CW, h:0.7, align:'center', fontSize:24, bold:true, color:NAVY, fontFace:'Calibri' });
    s.addText('הוצאה', { x:cx, y:cy+1.6, w:CW, h:0.25, align:'center', fontSize:8, color:LIGHT, fontFace:'Calibri' });

    s.addShape(pres.shapes.RECTANGLE, { x:cx+0.2, y:cy+1.9, w:CW-0.4, h:0.03, fill:{ color:'DDEAF5' }, line:{ color:'DDEAF5', width:0 } });

    const mets=[
      [{l:'חשיפה',  v:fNum(c.reach)},{l:'חשיפות', v:fNum(c.impr)}],
      [{l:'קליקים', v:fNum(c.clicks)},{l:'CPM', v:`₪${c.cpm.toFixed(1)}`}],
    ];
    const mcw=CW/2;
    mets.forEach((row,ri)=>{
      const my=cy+2.0+ri*0.72;
      row.forEach((m,mi)=>{
        s.addText(m.v, { x:cx+mi*mcw, y:my,      w:mcw, h:0.38, align:'center', fontSize:12, bold:true, color:NAVY, fontFace:'Calibri' });
        s.addText(m.l, { x:cx+mi*mcw, y:my+0.36, w:mcw, h:0.25, align:'center', fontSize:7.5, color:LIGHT, fontFace:'Calibri' });
      });
    });

    s.addShape(pres.shapes.RECTANGLE, { x:cx+0.15, y:cy+CH-0.62, w:CW-0.3, h:0.55, fill:{ color:c.color }, line:{ color:c.color, width:0 } });
    s.addText(`${c.results} ${c.rtype}  |  ₪${c.cpr.toFixed(2)} לתוצאה`, {
      x:cx+0.15, y:cy+CH-0.58, w:CW-0.3, h:0.45,
      align:'center', fontSize:8, bold:true, color:WHITE, fontFace:'Calibri'
    });
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:BLUE }, line:{ color:BLUE, width:0 } });
  s.addText('Think Digital  |  Meta Ads  |  מאי 2026  |  CUE', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:WHITE, fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 – Google Ads KPIs
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: SLATE };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:NAVY }, line:{ color:NAVY, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:AMBER }, line:{ color:AMBER, width:0 } });

  // Google "G" badge
  s.addShape(pres.shapes.OVAL, { x:0.2, y:0.12, w:0.62, h:0.62, fill:{ color:AMBER }, line:{ color:AMBER, width:0 } });
  s.addText('G', { x:0.2, y:0.15, w:0.62, h:0.55, align:'center', fontSize:14, bold:true, color:NAVY, fontFace:'Calibri' });
  s.addText('Google Ads – סיכום ביצועים', { x:0.9, y:0.12, w:9.0, h:0.6, align:'left', fontSize:20, bold:true, color:WHITE, fontFace:'Calibri', margin:0 });

  // Campaign name badge
  s.addShape(pres.shapes.RECTANGLE, { x:0.2, y:1.0, w:9.6, h:0.45, fill:{ color:AMBER, transparency:88 }, line:{ color:AMBER, width:1 } });
  s.addText('Performance Max – Asset Group 1  |  סטטוס: Eligible (Limited)', {
    x:0.2, y:1.03, w:9.6, h:0.38, align:'center', fontSize:10, color:NAVY, fontFace:'Calibri'
  });

  const kpis=[
    { l:'תקציב Google',   v:fILS(google.spend),            c:AMBER   },
    { l:'קליקים',         v:fNum(google.clicks),           c:BLUE    },
    { l:'חשיפות',         v:fNum(google.impr),             c:CYAN    },
    { l:'CTR',            v:fPct(google.ctr),              c:GREEN   },
    { l:'המרות',          v:String(Math.round(google.convs)), c:PURPLE },
    { l:'עלות להמרה',     v:`₪${google.cpa.toFixed(2)}`,  c:RED     },
  ];

  const KW=1.5, KH=2.85, KGX=0.1;
  const totalKW=kpis.length*KW+(kpis.length-1)*KGX;
  const startX=(W-totalKW)/2;

  kpis.forEach((k,i)=>{
    const kx=startX+i*(KW+KGX), ky=1.58;
    s.addShape(pres.shapes.RECTANGLE, { x:kx, y:ky, w:KW, h:KH, fill:{ color:WHITE }, line:{ color:'DDEAF5', width:1 }, shadow:makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x:kx, y:ky, w:KW, h:0.1, fill:{ color:k.c }, line:{ color:k.c, width:0 } });
    s.addText(k.v, { x:kx, y:ky+0.15, w:KW, h:0.75, align:'center', fontSize:17, bold:true, color:NAVY, fontFace:'Calibri' });
    s.addText(k.l, { x:kx, y:ky+0.95, w:KW, h:0.45, align:'center', fontSize:9, color:MED, fontFace:'Calibri' });
    s.addText('₪ ILS', { x:kx, y:ky+1.5, w:KW, h:0.3, align:'center', fontSize:7.5, color:k.c, fontFace:'Calibri' });
  });

  // CPC callout
  s.addShape(pres.shapes.RECTANGLE, { x:0.2, y:4.5, w:9.6, h:0.65, fill:{ color:AMBER, transparency:90 }, line:{ color:AMBER, width:1 } });
  s.addText(`ממוצע CPC: ₪${google.cpc.toFixed(2)}  |  שיעור המרה: ${fPct(google.convRate)}  |  קמפיין יחיד – Performance Max`, {
    x:0.2, y:4.55, w:9.6, h:0.52, align:'center', fontSize:10, bold:true, color:NAVY, fontFace:'Calibri'
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:NAVY }, line:{ color:NAVY, width:0 } });
  s.addText('Think Digital  |  Google Ads  |  מאי 2026  |  CUE', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:LIGHT, fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 – Platform Comparison Chart
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: SLATE };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:NAVY }, line:{ color:NAVY, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('השוואת פלטפורמות – קליקים וחשיפות', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:20, bold:true, color:WHITE, fontFace:'Calibri' });

  s.addChart(pres.charts.BAR, [
    { name:'Meta Ads',    labels:['קליקים','חשיפות'], values:[fbTotalClicks, fbTotalImpr] },
    { name:'Google Ads',  labels:['קליקים','חשיפות'], values:[google.clicks, google.impr] },
  ], {
    x:0.3, y:0.95, w:9.4, h:4.2,
    barDir:'col',
    barGrouping:'clustered',
    chartColors:[BLUE, AMBER],
    chartArea:{ fill:{ color:WHITE } },
    plotArea:{ fill:{ color:WHITE } },
    catAxisLabelColor:MED,
    valAxisLabelColor:MED,
    valGridLine:{ color:'E2E8F0', size:0.5 },
    catGridLine:{ style:'none' },
    showValue:true,
    dataLabelFontSize:9,
    showLegend:true,
    legendPos:'b',
    legendFontSize:10,
    legendColor:MED,
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:NAVY }, line:{ color:NAVY, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  CUE', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:LIGHT, fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 7 – Closing
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY };

  s.addShape(pres.shapes.OVAL, { x:7.5, y:-1.5, w:5, h:5, fill:{ color:NAVY2, transparency:0 }, line:{ color:NAVY2, width:0 } });
  s.addShape(pres.shapes.OVAL, { x:8.4, y:-0.5, w:2.8, h:2.8, fill:{ color:BLUE, transparency:72 }, line:{ color:BLUE, width:0 } });
  s.addShape(pres.shapes.OVAL, { x:-1.5, y:3.5,  w:3.5, h:3.5, fill:{ color:AMBER, transparency:82 }, line:{ color:AMBER, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.12, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  s.addText('תודה!', { x:0.3, y:0.8, w:9.4, h:1.1, align:'center', fontSize:58, bold:true, color:WHITE, fontFace:'Calibri' });
  s.addShape(pres.shapes.RECTANGLE, { x:2.5, y:2.05, w:5, h:0.04, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  const stats=[
    { v:fILS(grandSpend),          l:'סה"כ תקציב' },
    { v:fILS(fbTotalSpend),        l:'Meta Ads' },
    { v:fILS(google.spend),        l:'Google Ads' },
    { v:String(fbTotalRes+Math.round(google.convs)), l:'תוצאות + המרות' },
  ];
  stats.forEach((st,i)=>{
    const sx=0.8+i*2.3;
    s.addText(st.v, { x:sx, y:2.3, w:2.1, h:0.8, align:'center', fontSize:22, bold:true, color:GOLD, fontFace:'Calibri' });
    s.addText(st.l, { x:sx, y:3.1, w:2.1, h:0.4, align:'center', fontSize:11, color:LIGHT, fontFace:'Calibri' });
  });

  // Platform badges bottom
  [{ l:'Meta Ads', c:BLUE },{ l:'Google Ads', c:AMBER }].forEach((p,i)=>{
    const px=3.8+i*2.2;
    s.addShape(pres.shapes.RECTANGLE, { x:px, y:3.7, w:1.8, h:0.38, fill:{ color:p.c, transparency:80 }, line:{ color:p.c, width:1 } });
    s.addText(p.l, { x:px, y:3.72, w:1.8, h:0.34, align:'center', fontSize:10, bold:true, color:p.c, fontFace:'Calibri' });
  });

  s.addText('Think Digital  |  Meta Ads + Google Ads  |  מאי 2026', { x:0.3, y:4.8, w:9.4, h:0.4, align:'center', fontSize:10, color:MED, fontFace:'Calibri' });
}

// ── Write ──────────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: OUT })
  .then(()=>console.log('PPTX saved:', OUT))
  .catch(e =>console.error(e));
