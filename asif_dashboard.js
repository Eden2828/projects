/* eslint-disable */
'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ── Fonts ──────────────────────────────────────────────────────────────────────
const FONT_REG  = 'C:\\Windows\\Fonts\\arial.ttf';
const FONT_BOLD = 'C:\\Windows\\Fonts\\arialbd.ttf';

// ── Output ────────────────────────────────────────────────────────────────────
const OUT = path.join(__dirname, 'אסיף_דאשבורד_מאי_2026.pdf');

// ── Palette ───────────────────────────────────────────────────────────────────
const P = {
  bg:      '#F7F4EF',
  card:    '#FFFFFF',
  olive:   '#4A6234',
  green:   '#6A8E45',
  gold:    '#C8A84B',
  orange:  '#D07030',
  dark:    '#1E1E1E',
  medium:  '#555555',
  light:   '#999999',
  line:    '#E0D8CC',
  blue:    '#3D7CB5',
  red:     '#B84040',
  muted:   '#EEF2E8',
  white:   '#FFFFFF',
  hdr:     '#D4E4B8',
};

// ── Data ──────────────────────────────────────────────────────────────────────
const camps = [
  { name:'בוקר באסיף – הזמנת מקום', obj:'הזמנות דרך Tabит',
    spend:1179.94, reach:57683, impr:177296, cpm:6.66,
    clicks:1604,   ctr:0.905,  cpc:0.735,   lpv:887,
    results:62,    rtype:'לידים',            cpr:19.03,  color:P.green  },
  { name:'אירועים – לידים לעמוד נחיתה', obj:'לידים לאירועים',
    spend:1243.34, reach:23642, impr:65088, cpm:19.10,
    clicks:456,    ctr:0.701,  cpc:2.727,   lpv:387,
    results:29,    rtype:'לידים',            cpr:42.87,  color:P.orange },
  { name:'הזמנת מקום – טראפיק', obj:'הזמנות דרך Tabит',
    spend:50.27,   reach:5043,  impr:6881,  cpm:7.31,
    clicks:74,     ctr:1.076,  cpc:0.679,   lpv:34,
    results:0,     rtype:'—',               cpr:0,       color:P.gold   },
  { name:'גיוס עובדים – מסרים', obj:'גיוס עובדים',
    spend:539.03,  reach:19008, impr:53992, cpm:9.98,
    clicks:162,    ctr:0.300,  cpc:3.327,   lpv:2,
    results:42,    rtype:'שיחות',           cpr:12.83,  color:P.blue   },
  { name:'מודעות מותג – Awareness', obj:'חשיפה ומודעות',
    spend:142.56,  reach:4842,  impr:10362, cpm:13.76,
    clicks:58,     ctr:0.560,  cpc:2.459,   lpv:27,
    results:4842,  rtype:'חשיפה',           cpr:0.029,  color:P.red    },
];

const totalSpend  = camps.reduce((s,c)=>s+c.spend,0);
const totalReach  = camps.reduce((s,c)=>s+c.reach,0);
const totalImpr   = camps.reduce((s,c)=>s+c.impr,0);
const totalClicks = camps.reduce((s,c)=>s+c.clicks,0);
const totalLPV    = camps.reduce((s,c)=>s+c.lpv,0);
const totalLeads  = camps.filter(c=>c.rtype==='לידים').reduce((s,c)=>s+c.results,0);
const totalMsgs   = camps.filter(c=>c.rtype==='שיחות').reduce((s,c)=>s+c.results,0);

const fUSD = v => `$${v.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const fNum = v => v.toLocaleString('en');
const fPct = v => `${v.toFixed(2)}%`;

// ── Document ──────────────────────────────────────────────────────────────────
const doc = new PDFDocument({
  size: 'A4',
  layout: 'landscape',
  margin: 0,
  info: { Title: 'אסיף – דאשבורד מאי 2026', Author: 'Think Digital' },
});

doc.registerFont('Reg',  FONT_REG);
doc.registerFont('Bold', FONT_BOLD);

doc.pipe(fs.createWriteStream(OUT));

// ── helpers ───────────────────────────────────────────────────────────────────
const W = doc.page.width;   // 841.89
const H = doc.page.height;  // 595.28
const M = 20;               // margin

function bg(color) {
  doc.rect(0,0,W,H).fill(color);
}

function rrect(x,y,w,h,r,fill,strokeColor,strokeW) {
  doc.roundedRect(x,y,w,h,r).fill(fill);
  if (strokeColor) {
    doc.roundedRect(x,y,w,h,r).lineWidth(strokeW||1).stroke(strokeColor);
  }
}

function txt(text, x, y, opts={}) {
  const { font='Reg', size=10, color=P.dark, align='center', width=200 } = opts;
  doc.font(font).fontSize(size).fill(color)
     .text(text, x - (align==='center'?width/2:0), y,
           { width, align, lineBreak:false });
}

function shadow(x,y,w,h,r=8) {
  doc.roundedRect(x+2,y-2,w,h,r).fill('#DADAD0');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE 1
// ═══════════════════════════════════════════════════════════════════════════════
bg(P.bg);

// ── Header ────────────────────────────────────────────────────────────────────
const HDR_H = 65;
doc.rect(0, 0, W, HDR_H).fill(P.olive);

// Left accent bar
doc.rect(0, 0, 6, HDR_H).fill(P.gold);

// Title (centered)
txt('דוח ביצועי פרסום – מאי 2026', W/2, 22, { font:'Bold', size:18, color:P.white, width:400 });

// Right: report date
txt('הופק: יוני 2026', W-M, 24, { font:'Reg', size:8, color:P.hdr, align:'right', width:120 });

// Logo circle (left)
doc.circle(M+28, HDR_H/2, 22).fill(P.white);
doc.circle(M+28, HDR_H/2, 22).lineWidth(2).stroke(P.gold);
txt('אסיף', M+28, HDR_H/2-8, { font:'Bold', size:11, color:P.olive, width:50 });

// ── KPI Cards ─────────────────────────────────────────────────────────────────
const kpis = [
  { label:'סה"כ השקעה',    value:fUSD(totalSpend),  sub:'USD',     color:P.olive  },
  { label:'חשיפה ייחודית', value:fNum(totalReach),  sub:'אנשים',   color:P.green  },
  { label:'חשיפות',        value:fNum(totalImpr),   sub:'נוצרו',   color:P.gold   },
  { label:'קליקים',        value:fNum(totalClicks), sub:'לינק',    color:P.orange },
  { label:'לידים',         value:String(totalLeads),sub:'הושגו',   color:P.blue   },
  { label:'שיחות',         value:String(totalMsgs), sub:'התחלו',   color:P.red    },
];

const KY = HDR_H + 12;
const KH = 70;
const KW = (W - 2*M - 5*8) / 6;

kpis.forEach((k,i)=>{
  const kx = M + i*(KW+8);
  shadow(kx,KY,KW,KH);
  rrect(kx,KY,KW,KH,8,P.card);
  // top color bar
  doc.rect(kx,KY,KW,5).fill(k.color);
  doc.roundedRect(kx,KY,KW,5,2).fill(k.color);
  // value
  txt(k.value, kx+KW/2, KY+16, { font:'Bold', size:17, color:P.dark, width:KW-4 });
  // label
  txt(k.label, kx+KW/2, KY+37, { font:'Reg', size:8, color:P.medium, width:KW-4 });
  // sub
  txt(k.sub, kx+KW/2, KY+53, { font:'Bold', size:7.5, color:k.color, width:KW-4 });
});

// ── Mid section: Bar Chart + Table ────────────────────────────────────────────
const MID_Y = KY + KH + 14;
const MID_H = 210;
const CHART_W = (W - 2*M)*0.42;
const TABLE_W = (W - 2*M)*0.55;

// ── Bar chart card ─────────────────────────────────────────────────────────────
shadow(M, MID_Y, CHART_W, MID_H);
rrect(M, MID_Y, CHART_W, MID_H, 8, P.card);
doc.rect(M, MID_Y, CHART_W, 4).fill(P.olive);
doc.roundedRect(M, MID_Y, CHART_W, 4, 2).fill(P.olive);
txt('השקעה לפי קמפיין', M+CHART_W/2, MID_Y+10, { font:'Bold', size:10, color:P.dark, width:CHART_W-10 });

const maxSpend = Math.max(...camps.map(c=>c.spend));
const barAreaX = M+16;
const barAreaY = MID_Y+28;
const barAreaH = MID_H-50;
const barAreaW = CHART_W-32;
const bw = barAreaW/camps.length - 10;
const bGap = barAreaW/camps.length;

camps.forEach((c,i)=>{
  const bx = barAreaX + i*bGap + 5;
  const bh = (c.spend/maxSpend)*barAreaH;
  const by = barAreaY + barAreaH - bh;
  // bar with rounded top
  rrect(bx, by, bw, bh, 4, c.color);
  // value above
  txt(fUSD(c.spend), bx+bw/2, by-14, { font:'Bold', size:7, color:P.dark, width:bw+10 });
  // mini campaign name (short) below
  const short = c.name.length>12 ? c.name.substring(0,11)+'…' : c.name;
  txt(short, bx+bw/2, barAreaY+barAreaH+5, { font:'Reg', size:6.5, color:P.medium, width:bGap-2 });
});

// ── Table card ────────────────────────────────────────────────────────────────
const TX = M + CHART_W + 12;
shadow(TX, MID_Y, TABLE_W, MID_H);
rrect(TX, MID_Y, TABLE_W, MID_H, 8, P.card);
doc.rect(TX, MID_Y, TABLE_W, 4).fill(P.olive);
doc.roundedRect(TX, MID_Y, TABLE_W, 4, 2).fill(P.olive);
txt('סיכום קמפיינים', TX+TABLE_W/2, MID_Y+10, { font:'Bold', size:10, color:P.dark, width:TABLE_W-10 });

const COLS = [
  { label:'קמפיין',   w:TABLE_W*0.30 },
  { label:'הוצאה',    w:TABLE_W*0.13 },
  { label:'חשיפה',    w:TABLE_W*0.14 },
  { label:'קליקים',   w:TABLE_W*0.12 },
  { label:'CTR',      w:TABLE_W*0.12 },
  { label:'לידים',    w:TABLE_W*0.10 },
  { label:'CPR',      w:TABLE_W*0.09 },
];

const TH_Y   = MID_Y+30;
const ROW_H  = (MID_H-38)/( camps.length+1);
const COL_START = TX+8;

// header row bg
doc.rect(TX+4, TH_Y-3, TABLE_W-8, ROW_H).fill(P.muted);

let cx2 = COL_START;
COLS.forEach(col=>{
  txt(col.label, cx2+col.w/2, TH_Y+2, { font:'Bold', size:8, color:P.olive, width:col.w });
  cx2 += col.w;
});

camps.forEach((camp,i)=>{
  const ry = TH_Y + ROW_H*(i+1);
  if(i%2===0) doc.rect(TX+4, ry-3, TABLE_W-8, ROW_H).fill('#F9F7F3');

  const vals = [
    camp.name,
    fUSD(camp.spend),
    fNum(camp.reach),
    fNum(camp.clicks),
    fPct(camp.ctr),
    camp.results>0 ? String(camp.results) : '—',
    camp.cpr>0 ? `$${camp.cpr.toFixed(2)}` : '—',
  ];

  let cx3 = COL_START;
  vals.forEach((v,j)=>{
    const col = COLS[j];
    const clr = j===0 ? camp.color : P.dark;
    const fnt = j===0 ? 'Bold' : 'Reg';
    txt(v, cx3+col.w/2, ry+2, { font:fnt, size:7.5, color:clr, width:col.w-2 });
    cx3 += col.w;
  });
});


// ── Footer p1 ─────────────────────────────────────────────────────────────────
doc.rect(0, H-26, W, 26).fill(P.olive);
txt('Think Digital  |  דוח ביצועים חודשי  |  מאי 2026  |  מסעדת אסיף', W/2, H-18, { font:'Reg', size:8, color:P.white, width:500 });

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE 2 – Campaign deep-dive
// ═══════════════════════════════════════════════════════════════════════════════
doc.addPage({ size:'A4', layout:'landscape' });
bg(P.bg);

// Header
doc.rect(0,0,W,55).fill(P.olive);
doc.rect(0,0,6,55).fill(P.gold);
txt('פירוט קמפיינים – מאי 2026', W/2, 12, { font:'Bold', size:16, color:P.white, width:400 });
txt('מסעדת אסיף   |   Meta Ads', W/2, 34, { font:'Reg', size:9, color:P.hdr, width:300 });

// Cards grid: 3 top row, 2 bottom row
const CD_W  = (W - 2*M - 2*12)/3;
const CD_H  = 215;
const CD_GX = 12;
const CD_GY = 12;
const CD_SY = 55 + CD_GY;

camps.forEach((camp,idx)=>{
  const col = idx%3;
  const row = Math.floor(idx/3);
  const cx4 = M + col*(CD_W+CD_GX);
  const cy4 = CD_SY + row*(CD_H+CD_GY);

  // Shadow
  doc.roundedRect(cx4+2,cy4-2,CD_W,CD_H,8).fill('#DEDAD2');
  // Card
  rrect(cx4,cy4,CD_W,CD_H,8,P.card);

  // Header strip
  const SH = 38;
  doc.roundedRect(cx4,cy4,CD_W,SH,8).fill(camp.color);
  doc.rect(cx4,cy4+SH/2,CD_W,SH/2).fill(camp.color);

  txt(camp.name, cx4+CD_W/2, cy4+7, { font:'Bold', size:9.5, color:P.white, width:CD_W-12 });
  txt(camp.obj,  cx4+CD_W/2, cy4+22, { font:'Reg',  size:8,   color:'#E0F0C8', width:CD_W-12 });

  // Spend big number
  txt(fUSD(camp.spend), cx4+CD_W/2, cy4+44, { font:'Bold', size:20, color:P.dark, width:CD_W-10 });
  txt('השקעה', cx4+CD_W/2, cy4+66, { font:'Reg', size:8, color:P.light, width:80 });

  // Divider
  doc.moveTo(cx4+12,cy4+78).lineTo(cx4+CD_W-12,cy4+78).lineWidth(0.5).stroke(P.line);

  // 3x2 metric grid
  const mets = [
    { l:'חשיפה',    v:fNum(camp.reach)  },
    { l:'חשיפות',   v:fNum(camp.impr)   },
    { l:'CPM',      v:`$${camp.cpm.toFixed(2)}` },
    { l:'קליקים',   v:fNum(camp.clicks) },
    { l:'CTR',      v:fPct(camp.ctr)    },
    { l:'CPC',      v:`$${camp.cpc.toFixed(3)}` },
  ];

  const MW  = CD_W/3;
  const MH2 = 44;
  const MX0 = cx4;
  const MY0 = cy4 + 82;

  mets.forEach((m2,mi)=>{
    const mc = mi%3, mr = Math.floor(mi/3);
    const mx5 = MX0 + mc*MW;
    const my5 = MY0 + mr*MH2;
    txt(m2.v, mx5+MW/2, my5+8,  { font:'Bold', size:12, color:P.dark,   width:MW-4 });
    txt(m2.l, mx5+MW/2, my5+24, { font:'Reg',  size:7,  color:P.light,  width:MW-4 });
    if(mc>0) {
      doc.moveTo(mx5,my5+6).lineTo(mx5,my5+MH2-6).lineWidth(0.5).stroke(P.line);
    }
  });

  // Divider 2
  doc.moveTo(cx4+12,cy4+172).lineTo(cx4+CD_W-12,cy4+172).lineWidth(0.5).stroke(P.line);

  // Result badge
  if(camp.results>0 && camp.rtype!=='חשיפה'){
    const btxt = `${camp.rtype}: ${camp.results}   |   עלות: $${camp.cpr.toFixed(2)}`;
    rrect(cx4+8, cy4+175, CD_W-16, 28, 5, camp.color);
    txt(btxt, cx4+CD_W/2, cy4+183, { font:'Bold', size:8.5, color:P.white, width:CD_W-20 });
  } else if(camp.rtype==='—'||camp.results===0){
    const btxt = `דפי נחיתה: ${fNum(camp.lpv)}`;
    rrect(cx4+8, cy4+175, CD_W-16, 28, 5, P.muted);
    txt(btxt, cx4+CD_W/2, cy4+183, { font:'Bold', size:8.5, color:camp.color, width:CD_W-20 });
  }
});

// Footer p2
doc.rect(0, H-26, W, 26).fill(P.olive);
txt('Think Digital  |  דוח ביצועים חודשי  |  מאי 2026  |  מסעדת אסיף', W/2, H-18, { font:'Reg', size:8, color:P.white, width:500 });

doc.end();
console.log('PDF saved:', OUT);
