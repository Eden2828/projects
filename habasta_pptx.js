'use strict';
const pptxgen = require('pptxgenjs');

const OUT = 'הבסטה_דאשבורד_מאי_2026.pptx';

// ── Palette (warm terracotta / Mediterranean) ──────────────────────────────────
const TERRA  = '8B2500';
const TERRA2 = '6B1C00';
const RUST   = 'C04830';
const GOLD   = 'D4A017';
const SAND   = 'E8D5A3';
const CREAM  = 'FAF6F0';
const WHITE  = 'FFFFFF';
const DARK   = '1E1E1E';
const MED    = '555555';
const LIGHT  = '999999';

const CAMP_COLORS = [RUST, GOLD];

// ── Data ───────────────────────────────────────────────────────────────────────
const camps = [
  { name:'אירועים',        obj:'לידים לאירועים',
    spend:2067.29, reach:13163, impr:37959, cpm:54.46,
    clicks:329,    ctr:0.867,  cpc:6.284,   lpv:6,
    results:23,    rtype:'לידים', cpr:89.88, color:RUST },
  { name:'רמבם – 17.5',   obj:'לידים – אירוע ספציפי',
    spend:686.00,  reach:9548,  impr:22029, cpm:31.14,
    clicks:111,    ctr:0.504,  cpc:6.180,   lpv:7,
    results:10,    rtype:'לידים', cpr:68.60, color:GOLD },
];

const totalSpend  = camps.reduce((s,c)=>s+c.spend,0);
const totalReach  = camps.reduce((s,c)=>s+c.reach,0);
const totalImpr   = camps.reduce((s,c)=>s+c.impr,0);
const totalClicks = camps.reduce((s,c)=>s+c.clicks,0);
const totalLPV    = camps.reduce((s,c)=>s+c.lpv,0);
const totalLeads  = camps.reduce((s,c)=>s+c.results,0);

const fILS = v => `₪${Math.round(v).toLocaleString('en')}`;
const fNum = v => v.toLocaleString('en');
const fPct = v => `${v.toFixed(2)}%`;

const pres = new pptxgen();
pres.layout  = 'LAYOUT_16x9';
pres.title   = 'הבסטה – דוח ביצועים מאי 2026';
pres.author  = 'Think Digital';

const W = 10, H = 5.625;
const makeShadow = () => ({ type:'outer', blur:8, offset:3, angle:135, color:'000000', opacity:0.10 });

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 – Title
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: TERRA2 };

  // Decorative circles
  s.addShape(pres.shapes.OVAL, { x:7.5, y:-1.5, w:4.5, h:4.5, fill:{ color:TERRA, transparency:55 }, line:{ color:TERRA, width:0 } });
  s.addShape(pres.shapes.OVAL, { x:8.4, y:-0.6, w:2.5, h:2.5, fill:{ color:RUST, transparency:65 }, line:{ color:RUST, width:0 } });

  // Left gold accent bar
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.12, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  // Restaurant name badge
  s.addShape(pres.shapes.OVAL, { x:0.5, y:0.5, w:1.5, h:1.5, fill:{ color:WHITE, transparency:15 }, line:{ color:GOLD, width:2 } });
  s.addText('הבסטה', { x:0.5, y:0.85, w:1.5, h:0.7, align:'center', fontSize:15, bold:true, color:WHITE, fontFace:'Calibri' });

  // Main title
  s.addText('דוח ביצועי פרסום', { x:0.3, y:1.8, w:9.4, h:1.0, align:'center', fontSize:40, bold:true, color:WHITE, fontFace:'Calibri' });

  // Month
  s.addText('מאי 2026', { x:0.3, y:2.8, w:9.4, h:0.8, align:'center', fontSize:52, bold:true, color:GOLD, fontFace:'Calibri' });

  // Divider
  s.addShape(pres.shapes.RECTANGLE, { x:2.5, y:3.7, w:5, h:0.04, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  s.addText('Meta Ads  |  01/05/2026 – 31/05/2026  |  Think Digital', { x:0.3, y:3.85, w:9.4, h:0.5, align:'center', fontSize:13, color:SAND, fontFace:'Calibri' });
  s.addText('2 קמפיינים פעילים', { x:3.5, y:4.6, w:3, h:0.5, align:'center', fontSize:11, color:'C8A060', fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 – KPI Summary
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: CREAM };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:TERRA }, line:{ color:TERRA, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('סיכום ביצועים – מאי 2026', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:22, bold:true, color:WHITE, fontFace:'Calibri' });

  // 5 KPI cards in one row
  const kpis = [
    { label:'סה"כ השקעה',    value:fILS(totalSpend),  sub:'₪ ILS',   color:TERRA },
    { label:'חשיפה ייחודית', value:fNum(totalReach),  sub:'אנשים',   color:RUST  },
    { label:'חשיפות',        value:fNum(totalImpr),   sub:'נוצרו',   color:GOLD  },
    { label:'קליקים',        value:fNum(totalClicks), sub:'לינק',    color:'6B8E6B' },
    { label:'לידים',         value:String(totalLeads),sub:'הושגו',   color:'3D7CB5' },
  ];

  const KW = 1.8, KH = 3.5, KGX = 0.15;
  const totalKW = kpis.length*KW + (kpis.length-1)*KGX;
  const startX = (W - totalKW)/2;

  kpis.forEach((k,i) => {
    const kx = startX + i*(KW+KGX);
    const ky = 1.0;
    s.addShape(pres.shapes.RECTANGLE, { x:kx, y:ky, w:KW, h:KH, fill:{ color:WHITE }, line:{ color:'E8D8C8', width:1 }, shadow:makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x:kx, y:ky, w:KW, h:0.12, fill:{ color:k.color }, line:{ color:k.color, width:0 } });
    s.addText(k.value, { x:kx, y:ky+0.25, w:KW, h:0.8, align:'center', fontSize:22, bold:true, color:DARK, fontFace:'Calibri' });
    s.addText(k.label, { x:kx, y:ky+1.1, w:KW, h:0.5, align:'center', fontSize:12, color:MED, fontFace:'Calibri' });
    s.addShape(pres.shapes.RECTANGLE, { x:kx+0.3, y:ky+1.65, w:KW-0.6, h:0.03, fill:{ color:'E8D8C8' }, line:{ color:'E8D8C8', width:0 } });
    s.addText(k.sub, { x:kx, y:ky+1.75, w:KW, h:0.4, align:'center', fontSize:10, bold:true, color:k.color, fontFace:'Calibri' });
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:TERRA }, line:{ color:TERRA, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  הבסטה', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:SAND, fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 – Spend comparison (bar chart)
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: CREAM };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:TERRA }, line:{ color:TERRA, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('השקעה לפי קמפיין (₪)', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:22, bold:true, color:WHITE, fontFace:'Calibri' });

  s.addChart(pres.charts.BAR, [{
    name: 'השקעה',
    labels: camps.map(c=>c.name),
    values: camps.map(c=>c.spend),
  }], {
    x:0.5, y:0.95, w:9.0, h:4.2,
    barDir: 'col',
    chartColors: CAMP_COLORS,
    chartArea: { fill:{ color:WHITE }, roundedCorners:false },
    plotArea: { fill:{ color:WHITE } },
    catAxisLabelColor: MED,
    valAxisLabelColor: MED,
    valGridLine: { color:'E8E0D0', size:0.5 },
    catGridLine: { style:'none' },
    showValue: true,
    dataLabelColor: DARK,
    dataLabelFontSize: 12,
    dataLabelFontBold: true,
    dataLabelPosition: 'outEnd',
    showLegend: false,
    valAxisLineShow: false,
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:TERRA }, line:{ color:TERRA, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  הבסטה', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:SAND, fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 – Comparison table
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: CREAM };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:TERRA }, line:{ color:TERRA, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('השוואת קמפיינים', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:22, bold:true, color:WHITE, fontFace:'Calibri' });

  const headers = ['קמפיין','הוצאה (₪)','חשיפה','חשיפות','קליקים','CTR','CPM (₪)','לידים','CPL (₪)'];
  const colW    = [2.2, 1.1, 0.95, 0.95, 0.9, 0.8, 0.9, 0.85, 0.85];

  const rows = [
    headers.map(h => ({ text:h, options:{ bold:true, color:WHITE, fill:{ color:TERRA }, align:'center', valign:'middle', fontSize:10, fontFace:'Calibri' } })),
    ...camps.map(c => [
      { text:c.name, options:{ bold:true, color:c.color, align:'right', valign:'middle', fontSize:11, fontFace:'Calibri' } },
      { text:fILS(c.spend), options:{ align:'center', valign:'middle', fontSize:11, fontFace:'Calibri', color:DARK } },
      { text:fNum(c.reach), options:{ align:'center', valign:'middle', fontSize:11, fontFace:'Calibri', color:DARK } },
      { text:fNum(c.impr),  options:{ align:'center', valign:'middle', fontSize:11, fontFace:'Calibri', color:DARK } },
      { text:fNum(c.clicks),options:{ align:'center', valign:'middle', fontSize:11, fontFace:'Calibri', color:DARK } },
      { text:fPct(c.ctr),   options:{ align:'center', valign:'middle', fontSize:11, fontFace:'Calibri', color:DARK } },
      { text:`₪${c.cpm.toFixed(2)}`, options:{ align:'center', valign:'middle', fontSize:11, fontFace:'Calibri', color:DARK } },
      { text:String(c.results), options:{ align:'center', valign:'middle', fontSize:12, bold:true, fontFace:'Calibri', color:c.color } },
      { text:`₪${c.cpr.toFixed(2)}`, options:{ align:'center', valign:'middle', fontSize:11, fontFace:'Calibri', color:DARK } },
    ])
  ];

  s.addTable(rows, {
    x:0.2, y:1.2, w:9.6, h:3.0,
    colW,
    border:{ pt:0.5, color:'E8D8C8' },
    fill:{ color:WHITE },
    rowH: 0.85,
  });

  // Summary totals row
  const totals = [
    { l:'סה"כ השקעה', v:fILS(totalSpend) },
    { l:'סה"כ חשיפה',  v:fNum(totalReach) },
    { l:'סה"כ קליקים', v:fNum(totalClicks) },
    { l:'סה"כ לידים',  v:String(totalLeads) },
  ];
  totals.forEach((t,i)=>{
    const tx = 0.5 + i*2.4;
    s.addShape(pres.shapes.RECTANGLE, { x:tx, y:4.3, w:2.1, h:0.85, fill:{ color:TERRA, transparency:88 }, line:{ color:TERRA, width:1 } });
    s.addText(t.v, { x:tx, y:4.33, w:2.1, h:0.42, align:'center', fontSize:14, bold:true, color:TERRA, fontFace:'Calibri' });
    s.addText(t.l, { x:tx, y:4.72, w:2.1, h:0.3, align:'center', fontSize:9, color:MED, fontFace:'Calibri' });
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:TERRA }, line:{ color:TERRA, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  הבסטה', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:SAND, fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 – Campaign deep-dive cards
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: CREAM };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:TERRA }, line:{ color:TERRA, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('פירוט קמפיינים', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:22, bold:true, color:WHITE, fontFace:'Calibri' });

  const CW = 4.5, CH = 4.3;
  const startX = (W - 2*CW - 0.5)/2;

  camps.forEach((c,i) => {
    const cx = startX + i*(CW+0.5);
    const cy = 0.95;

    // Card
    s.addShape(pres.shapes.RECTANGLE, { x:cx, y:cy, w:CW, h:CH, fill:{ color:WHITE }, line:{ color:'E8D8C8', width:1 }, shadow:makeShadow() });
    // Header
    s.addShape(pres.shapes.RECTANGLE, { x:cx, y:cy, w:CW, h:0.65, fill:{ color:c.color }, line:{ color:c.color, width:0 } });
    s.addText(c.name, { x:cx, y:cy+0.1, w:CW, h:0.45, align:'center', fontSize:16, bold:true, color:WHITE, fontFace:'Calibri' });

    // Objective tag
    s.addText(c.obj, { x:cx, y:cy+0.68, w:CW, h:0.3, align:'center', fontSize:9, color:LIGHT, fontFace:'Calibri' });

    // Big spend
    s.addText(fILS(c.spend), { x:cx, y:cy+0.95, w:CW, h:0.7, align:'center', fontSize:30, bold:true, color:DARK, fontFace:'Calibri' });
    s.addText('סה"כ הוצאה', { x:cx, y:cy+1.62, w:CW, h:0.28, align:'center', fontSize:9, color:LIGHT, fontFace:'Calibri' });

    // Divider
    s.addShape(pres.shapes.RECTANGLE, { x:cx+0.3, y:cy+1.93, w:CW-0.6, h:0.03, fill:{ color:'E8D8C8' }, line:{ color:'E8D8C8', width:0 } });

    // 3-col metrics
    const mets = [
      { l:'חשיפה',    v:fNum(c.reach)  },
      { l:'חשיפות',   v:fNum(c.impr)   },
      { l:'קליקים',   v:fNum(c.clicks) },
    ];
    const mets2 = [
      { l:'CTR',      v:fPct(c.ctr) },
      { l:'CPM',      v:`₪${c.cpm.toFixed(2)}` },
      { l:'CPC',      v:`₪${c.cpc.toFixed(2)}` },
    ];
    const mcw = CW/3;
    [mets, mets2].forEach((row, ri) => {
      const my = cy + 2.0 + ri*0.7;
      row.forEach((m,mi) => {
        const mx = cx + mi*mcw;
        s.addText(m.v, { x:mx, y:my, w:mcw, h:0.38, align:'center', fontSize:13, bold:true, color:DARK, fontFace:'Calibri' });
        s.addText(m.l, { x:mx, y:my+0.36, w:mcw, h:0.25, align:'center', fontSize:8, color:LIGHT, fontFace:'Calibri' });
      });
    });

    // Leads badge
    s.addShape(pres.shapes.RECTANGLE, { x:cx+0.2, y:cy+CH-0.62, w:CW-0.4, h:0.55, fill:{ color:c.color }, line:{ color:c.color, width:0 } });
    s.addText(`${c.results} לידים  |  עלות לליד: ₪${c.cpr.toFixed(2)}`, {
      x:cx+0.2, y:cy+CH-0.58, w:CW-0.4, h:0.45,
      align:'center', fontSize:12, bold:true, color:WHITE, fontFace:'Calibri'
    });
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:TERRA }, line:{ color:TERRA, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  הבסטה', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:SAND, fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 – Closing
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: TERRA2 };

  s.addShape(pres.shapes.OVAL, { x:7.5, y:-1.5, w:4.5, h:4.5, fill:{ color:TERRA, transparency:55 }, line:{ color:TERRA, width:0 } });
  s.addShape(pres.shapes.OVAL, { x:-1.5, y:3.5,  w:3.5, h:3.5, fill:{ color:RUST, transparency:70 }, line:{ color:RUST, width:0 } });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.12, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  s.addText('תודה!', { x:0.3, y:0.9, w:9.4, h:1.2, align:'center', fontSize:60, bold:true, color:WHITE, fontFace:'Calibri' });
  s.addShape(pres.shapes.RECTANGLE, { x:2.5, y:2.2, w:5, h:0.04, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  const stats = [
    { v:fILS(totalSpend), l:'הושקע' },
    { v:String(totalLeads), l:'לידים' },
    { v:fNum(totalReach),   l:'הגעה ייחודית' },
  ];
  stats.forEach((st,i) => {
    const sx = 1.5 + i*2.7;
    s.addText(st.v, { x:sx, y:2.5, w:2.5, h:0.9, align:'center', fontSize:30, bold:true, color:GOLD, fontFace:'Calibri' });
    s.addText(st.l, { x:sx, y:3.38, w:2.5, h:0.4, align:'center', fontSize:13, color:SAND, fontFace:'Calibri' });
  });

  s.addText('Think Digital  |  Meta Ads  |  מאי 2026', { x:0.3, y:4.8, w:9.4, h:0.4, align:'center', fontSize:10, color:'C8A060', fontFace:'Calibri' });
}

// ── Write ──────────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: OUT })
  .then(() => console.log('PPTX saved:', OUT))
  .catch(e  => console.error(e));
