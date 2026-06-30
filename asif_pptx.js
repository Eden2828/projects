'use strict';
const pptxgen = require('pptxgenjs');

const OUT = 'אסיף_דאשבורד_מאי_2026.pptx';

// ── Palette ────────────────────────────────────────────────────────────────────
const OLIVE  = '4A6234';
const OLIVE2 = '3A4E28';
const GREEN  = '7A9B52';
const GOLD   = 'C8A84B';
const ORANGE = 'D07030';
const BLUE   = '3D7CB5';
const RED    = 'B84040';
const CREAM  = 'F7F4EF';
const WHITE  = 'FFFFFF';
const DARK   = '1E1E1E';
const MED    = '555555';
const LIGHT  = '999999';
const MUTED  = 'EEF2E8';

const CAMP_COLORS = [GREEN, ORANGE, GOLD, BLUE, RED];

// ── Data ───────────────────────────────────────────────────────────────────────
const camps = [
  { name:'בוקר באסיף – הזמנת מקום', obj:'הזמנות דרך Tabit',
    spend:1179.94, reach:57683, impr:177296, cpm:6.66,
    clicks:1604,   ctr:0.905,  cpc:0.735,   lpv:887,
    results:62,    rtype:'לידים', cpr:19.03, color:GREEN  },
  { name:'אירועים – לידים לעמוד נחיתה', obj:'לידים לאירועים',
    spend:1243.34, reach:23642, impr:65088, cpm:19.10,
    clicks:456,    ctr:0.701,  cpc:2.727,   lpv:387,
    results:29,    rtype:'לידים', cpr:42.87, color:ORANGE },
  { name:'הזמנת מקום – טראפיק', obj:'הזמנות דרך Tabit',
    spend:50.27,   reach:5043,  impr:6881,  cpm:7.31,
    clicks:74,     ctr:1.076,  cpc:0.679,   lpv:34,
    results:0,     rtype:'—',   cpr:0,       color:GOLD   },
  { name:'גיוס עובדים – מסרים', obj:'גיוס עובדים',
    spend:539.03,  reach:19008, impr:53992, cpm:9.98,
    clicks:162,    ctr:0.300,  cpc:3.327,   lpv:2,
    results:42,    rtype:'שיחות', cpr:12.83, color:BLUE   },
  { name:'מודעות מותג', obj:'חשיפה ומודעות',
    spend:142.56,  reach:4842,  impr:10362, cpm:13.76,
    clicks:58,     ctr:0.560,  cpc:2.459,   lpv:27,
    results:4842,  rtype:'חשיפה', cpr:0.029, color:RED    },
];

const totalSpend  = camps.reduce((s,c)=>s+c.spend,0);
const totalReach  = camps.reduce((s,c)=>s+c.reach,0);
const totalImpr   = camps.reduce((s,c)=>s+c.impr,0);
const totalClicks = camps.reduce((s,c)=>s+c.clicks,0);
const totalLPV    = camps.reduce((s,c)=>s+c.lpv,0);
const totalLeads  = camps.filter(c=>c.rtype==='לידים').reduce((s,c)=>s+c.results,0);
const totalMsgs   = camps.filter(c=>c.rtype==='שיחות').reduce((s,c)=>s+c.results,0);

const fUSD = v => `$${Math.round(v).toLocaleString('en')}`;
const fNum = v => v.toLocaleString('en');
const fPct = v => `${v.toFixed(2)}%`;

const pres = new pptxgen();
pres.layout  = 'LAYOUT_16x9';  // 10" × 5.625"
pres.title   = 'אסיף – דוח ביצועים מאי 2026';
pres.author  = 'Think Digital';

const W = 10, H = 5.625;

const makeShadow = () => ({ type:'outer', blur:8, offset:3, angle:135, color:'000000', opacity:0.10 });

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 – Title
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: OLIVE2 };

  // big decorative circle top-right
  s.addShape(pres.shapes.OVAL, { x:7.8, y:-1.5, w:4, h:4, fill:{ color:OLIVE, transparency:60 }, line:{ color:OLIVE, width:0 } });
  s.addShape(pres.shapes.OVAL, { x:8.5, y:-0.8, w:2.5, h:2.5, fill:{ color:GREEN, transparency:70 }, line:{ color:GREEN, width:0 } });

  // gold accent left bar
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.12, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  // Restaurant name badge
  s.addShape(pres.shapes.OVAL, { x:0.5, y:0.5, w:1.5, h:1.5, fill:{ color:WHITE, transparency:15 }, line:{ color:GOLD, width:2 } });
  s.addText('אסיף', { x:0.5, y:0.85, w:1.5, h:0.7, align:'center', fontSize:18, bold:true, color:WHITE, fontFace:'Calibri' });

  // Main title
  s.addText('דוח ביצועי פרסום', {
    x:0.3, y:1.8, w:9.4, h:1.0,
    align:'center', fontSize:40, bold:true, color:WHITE, fontFace:'Calibri'
  });

  // Sub-title with gold accent
  s.addText('מאי 2026', {
    x:0.3, y:2.8, w:9.4, h:0.8,
    align:'center', fontSize:52, bold:true, color:GOLD, fontFace:'Calibri'
  });

  // Divider line
  s.addShape(pres.shapes.RECTANGLE, { x:2.5, y:3.7, w:5, h:0.04, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  s.addText('Meta Ads  |  01/05/2026 – 31/05/2026  |  Think Digital', {
    x:0.3, y:3.85, w:9.4, h:0.5,
    align:'center', fontSize:13, color:'B8CCB0', fontFace:'Calibri'
  });

  s.addText('5 קמפיינים פעילים', {
    x:3.5, y:4.6, w:3, h:0.5,
    align:'center', fontSize:11, color:'98B880', fontFace:'Calibri'
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 – KPI Summary
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: CREAM };

  // Header bar
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:OLIVE }, line:{ color:OLIVE, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('סיכום ביצועים – מאי 2026', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:22, bold:true, color:WHITE, fontFace:'Calibri' });

  // KPI cards – 3 top row
  const kpiTop = [
    { label:'סה"כ השקעה', value:fUSD(totalSpend), sub:'USD', color:OLIVE },
    { label:'חשיפה ייחודית', value:fNum(totalReach), sub:'אנשים', color:GREEN },
    { label:'חשיפות', value:fNum(totalImpr), sub:'נוצרו', color:GOLD },
  ];
  const kpiBot = [
    { label:'קליקים', value:fNum(totalClicks), sub:'לינק', color:ORANGE },
    { label:'לידים', value:String(totalLeads), sub:'הושגו', color:BLUE },
    { label:'שיחות', value:String(totalMsgs), sub:'גיוס עובדים', color:RED },
  ];

  const KW = 2.9, KH = 1.5, KGX = 0.2;

  [kpiTop, kpiBot].forEach((row, ri) => {
    const ky = 1.05 + ri*(KH+0.2);
    row.forEach((k, i) => {
      const kx = 0.25 + i*(KW+KGX);
      // card
      s.addShape(pres.shapes.RECTANGLE, { x:kx, y:ky, w:KW, h:KH, fill:{ color:WHITE }, line:{ color:'E0D8CC', width:1 }, shadow:makeShadow() });
      // top accent
      s.addShape(pres.shapes.RECTANGLE, { x:kx, y:ky, w:KW, h:0.08, fill:{ color:k.color }, line:{ color:k.color, width:0 } });
      // value
      s.addText(k.value, { x:kx, y:ky+0.15, w:KW, h:0.65, align:'center', fontSize:28, bold:true, color:DARK, fontFace:'Calibri' });
      // label
      s.addText(k.label, { x:kx, y:ky+0.78, w:KW, h:0.38, align:'center', fontSize:12, color:MED, fontFace:'Calibri' });
      // sub
      s.addText(k.sub, { x:kx, y:ky+1.18, w:KW, h:0.25, align:'center', fontSize:9, bold:true, color:k.color, fontFace:'Calibri' });
    });
  });

  // Footer
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:OLIVE }, line:{ color:OLIVE, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  מסעדת אסיף', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:'B8CCB0', fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 – Spend by Campaign (bar chart)
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: CREAM };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:OLIVE }, line:{ color:OLIVE, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('השקעה לפי קמפיין', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:22, bold:true, color:WHITE, fontFace:'Calibri' });

  // Bar chart – native
  s.addChart(pres.charts.BAR, [{
    name: 'השקעה',
    labels: camps.map(c => c.name),
    values: camps.map(c => c.spend),
  }], {
    x: 0.3, y: 0.95, w: 9.4, h: 4.2,
    barDir: 'col',
    chartColors: CAMP_COLORS,
    chartArea: { fill:{ color: WHITE }, roundedCorners: false },
    plotArea: { fill:{ color: WHITE } },
    catAxisLabelColor: MED,
    valAxisLabelColor: MED,
    valGridLine: { color: 'E2E8F0', size: 0.5 },
    catGridLine: { style: 'none' },
    showValue: true,
    dataLabelColor: DARK,
    dataLabelFontSize: 10,
    dataLabelFontBold: true,
    dataLabelPosition: 'outEnd',
    showLegend: false,
    valAxisLineShow: false,
    catAxisLineShow: true,
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:OLIVE }, line:{ color:OLIVE, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  מסעדת אסיף', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:'B8CCB0', fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 – Campaign Comparison Table
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: CREAM };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:OLIVE }, line:{ color:OLIVE, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('השוואת קמפיינים', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:22, bold:true, color:WHITE, fontFace:'Calibri' });

  const headers = ['קמפיין','הוצאה','חשיפה','קליקים','CTR','לידים / תוצאות','CPR'];
  const colW    = [2.8, 1.1, 1.1, 1.0, 0.9, 1.5, 1.0];

  const rows = [
    headers.map(h => ({ text: h, options: { bold:true, color:WHITE, fill:{ color:OLIVE }, align:'center', valign:'middle', fontSize:10, fontFace:'Calibri' } })),
    ...camps.map((c,i) => [
      { text: c.name, options: { bold:true, color:c.color, align:'right', valign:'middle', fontSize:9, fontFace:'Calibri' } },
      { text: fUSD(c.spend), options: { align:'center', valign:'middle', fontSize:10, fontFace:'Calibri', color:DARK } },
      { text: fNum(c.reach), options: { align:'center', valign:'middle', fontSize:10, fontFace:'Calibri', color:DARK } },
      { text: fNum(c.clicks), options: { align:'center', valign:'middle', fontSize:10, fontFace:'Calibri', color:DARK } },
      { text: fPct(c.ctr), options: { align:'center', valign:'middle', fontSize:10, fontFace:'Calibri', color:DARK } },
      { text: c.results > 0 ? `${c.results} ${c.rtype}` : '—', options: { align:'center', valign:'middle', fontSize:10, fontFace:'Calibri', color:DARK } },
      { text: c.cpr > 0 ? `$${c.cpr.toFixed(2)}` : '—', options: { align:'center', valign:'middle', fontSize:10, fontFace:'Calibri', color:DARK } },
    ])
  ];

  s.addTable(rows, {
    x: 0.2, y: 0.98, w: 9.6, h: 4.25,
    colW,
    border: { pt:0.5, color:'E0D8CC' },
    fill: { color: WHITE },
    rowH: 0.7,
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:OLIVE }, line:{ color:OLIVE, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  מסעדת אסיף', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:'B8CCB0', fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 – Reach vs Clicks (scatter-style column)
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: CREAM };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:OLIVE }, line:{ color:OLIVE, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('חשיפה מול קליקים – לפי קמפיין', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:22, bold:true, color:WHITE, fontFace:'Calibri' });

  s.addChart(pres.charts.BAR, [
    { name:'חשיפה ייחודית', labels: camps.map(c=>c.name), values: camps.map(c=>c.reach) },
    { name:'קליקים',        labels: camps.map(c=>c.name), values: camps.map(c=>c.clicks) },
  ], {
    x: 0.3, y: 0.95, w: 9.4, h: 4.2,
    barDir: 'col',
    barGrouping: 'clustered',
    chartColors: [OLIVE, GOLD],
    chartArea: { fill:{ color: WHITE } },
    plotArea: { fill:{ color: WHITE } },
    catAxisLabelColor: MED,
    valAxisLabelColor: MED,
    valGridLine: { color: 'E2E8F0', size: 0.5 },
    catGridLine: { style: 'none' },
    showValue: false,
    showLegend: true,
    legendPos: 'b',
    legendColor: MED,
    legendFontSize: 10,
    valAxisLineShow: false,
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:OLIVE }, line:{ color:OLIVE, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  מסעדת אסיף', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:'B8CCB0', fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 – Campaign cards (deep dive)
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: CREAM };

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.85, fill:{ color:OLIVE }, line:{ color:OLIVE, width:0 } });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.1, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });
  s.addText('פירוט קמפיינים', { x:0.2, y:0.12, w:9.6, h:0.6, align:'center', fontSize:22, bold:true, color:WHITE, fontFace:'Calibri' });

  // 3 cards top row + 2 bottom centered
  const CW = 3.0, CH = 2.0, CGX = 0.15;
  const rows = [[0,1,2],[3,4]];
  const rowY = [0.98, 3.1];

  rows.forEach((row, ri) => {
    const totalRowW = row.length * CW + (row.length-1)*CGX;
    const startX = (W - totalRowW) / 2;
    row.forEach((ci, i) => {
      const c = camps[ci];
      const cx = startX + i*(CW+CGX);
      const cy = rowY[ri];

      // card bg
      s.addShape(pres.shapes.RECTANGLE, { x:cx, y:cy, w:CW, h:CH, fill:{ color:WHITE }, line:{ color:'E0D8CC', width:1 }, shadow:makeShadow() });
      // color header
      s.addShape(pres.shapes.RECTANGLE, { x:cx, y:cy, w:CW, h:0.5, fill:{ color:c.color }, line:{ color:c.color, width:0 } });
      s.addText(c.name, { x:cx, y:cy+0.06, w:CW, h:0.38, align:'center', fontSize:9, bold:true, color:WHITE, fontFace:'Calibri' });

      // metrics row 1
      const m1 = [
        { l:'הוצאה', v:fUSD(c.spend) },
        { l:'חשיפה',  v:fNum(c.reach)  },
        { l:'קליקים', v:fNum(c.clicks) },
      ];
      const m2 = [
        { l:'CTR',   v:fPct(c.ctr)        },
        { l:'CPM',   v:`$${c.cpm.toFixed(2)}` },
        { l:'תוצאה', v: c.results>0 && c.rtype!=='חשיפה' ? `${c.results} ${c.rtype}` : '—' },
      ];

      const mcw = CW/3;
      [m1, m2].forEach((mrow, mri) => {
        const my = cy + 0.55 + mri*0.65;
        mrow.forEach((m, mi) => {
          const mx = cx + mi*mcw;
          s.addText(m.v, { x:mx, y:my, w:mcw, h:0.35, align:'center', fontSize:11, bold:true, color:DARK, fontFace:'Calibri' });
          s.addText(m.l, { x:mx, y:my+0.33, w:mcw, h:0.22, align:'center', fontSize:7.5, color:LIGHT, fontFace:'Calibri' });
        });
      });

      // CPR badge at bottom if applicable
      if (c.cpr > 0 && c.rtype !== 'חשיפה') {
        s.addShape(pres.shapes.RECTANGLE, { x:cx+0.15, y:cy+CH-0.28, w:CW-0.3, h:0.22, fill:{ color:c.color, transparency:85 }, line:{ color:c.color, width:0 } });
        s.addText(`עלות לתוצאה: $${c.cpr.toFixed(2)}`, { x:cx+0.15, y:cy+CH-0.28, w:CW-0.3, h:0.22, align:'center', fontSize:8, bold:true, color:c.color, fontFace:'Calibri' });
      }
    });
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:H-0.28, w:W, h:0.28, fill:{ color:OLIVE }, line:{ color:OLIVE, width:0 } });
  s.addText('Think Digital  |  מאי 2026  |  מסעדת אסיף', { x:0, y:H-0.26, w:W, h:0.26, align:'center', fontSize:8, color:'B8CCB0', fontFace:'Calibri' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 7 – Closing
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: OLIVE2 };

  s.addShape(pres.shapes.OVAL, { x:7.8, y:-1.5, w:4, h:4, fill:{ color:OLIVE, transparency:60 }, line:{ color:OLIVE, width:0 } });
  s.addShape(pres.shapes.OVAL, { x:-1.5, y:3.5, w:3.5, h:3.5, fill:{ color:GREEN, transparency:70 }, line:{ color:GREEN, width:0 } });

  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.12, h:H, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  s.addText('תודה!', { x:0.3, y:0.9, w:9.4, h:1.2, align:'center', fontSize:60, bold:true, color:WHITE, fontFace:'Calibri' });

  s.addShape(pres.shapes.RECTANGLE, { x:2.5, y:2.2, w:5, h:0.04, fill:{ color:GOLD }, line:{ color:GOLD, width:0 } });

  // Summary stats
  const stats = [
    { v:`$${Math.round(totalSpend).toLocaleString('en')}`, l:'הושקע' },
    { v:String(totalLeads+totalMsgs), l:'תוצאות' },
    { v:fNum(totalReach), l:'הגעה ייחודית' },
  ];
  stats.forEach((st, i) => {
    const sx = 1.8 + i*2.8;
    s.addText(st.v, { x:sx, y:2.5, w:2.5, h:0.9, align:'center', fontSize:32, bold:true, color:GOLD, fontFace:'Calibri' });
    s.addText(st.l, { x:sx, y:3.38, w:2.5, h:0.4, align:'center', fontSize:13, color:'B8CCB0', fontFace:'Calibri' });
  });

  s.addText('Think Digital  |  Meta Ads  |  מאי 2026', { x:0.3, y:4.8, w:9.4, h:0.4, align:'center', fontSize:10, color:'98B880', fontFace:'Calibri' });
}

// ── Write ─────────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: OUT })
  .then(() => console.log('PPTX saved:', OUT))
  .catch(e  => console.error(e));
