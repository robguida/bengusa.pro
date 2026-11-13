// BUWEB-130: read a pulled GoAccess report (its HTML embeds `var json_data=`), keep totals only, write
// analytics/data/visits.json and regenerate the private dashboard HTML (data inline, no external scripts).
// Usage: node scripts/analytics/extract-dashboard-data.mjs [report.html|--empty] [dashboard-out.html]
// No report given = newest analytics/reports/bengusa-*.html; none at all = the "No data yet" state.
// Totals only: no IPs, no user-agent strings, no probe paths ever leave this script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const top = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repDir = path.join(top, 'analytics', 'reports');
const DEFAULT_OUT = 'C:/Users/robgu/Downloads/scratch/bengusa-visits-2026-11-13/dashboard/bengusa-visits.html';
const [a1, a2] = process.argv.slice(2);
const outHtml = a2 || DEFAULT_OUT;

let report = null;
if (a1 !== '--empty') {
  report = a1 || (fs.existsSync(repDir) ? fs.readdirSync(repDir).filter((f) => /^bengusa-.*\.html$/.test(f)).sort().pop() : null);
  if (report && !path.isAbsolute(report) && !fs.existsSync(report)) report = path.join(repDir, report);
  if (report) report = path.resolve(report);
}

const REAL = { '/': 'Home', '/privacy/': 'Privacy', '/privacy': 'Privacy', '/index.html': 'Home' };
const stripVersion = (s) => String(s).replace(/[0-9.]+$/, '').trim() || String(s);

function parse(file) {
  const html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf('var json_data=');
  if (start < 0) throw new Error('json_data not found in report');
  const i = html.indexOf('{', start);
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  const d = JSON.parse(html.slice(i, end));
  const num = (v) => (v && typeof v === 'object' ? v.count : v) || 0;
  const items = (p) => (d[p] && d[p].data) || [];
  const g = d.general || {};

  const days = items('visitors').map((it) => {
    const s = String(it.data);
    return { day: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`, visits: num(it.visitors), views: num(it.hits) };
  }).sort((x, y) => x.day.localeCompare(y.day));

  // Top pages: real pages by name; everything else lumped, paths never listed.
  const pg = {};
  let junkViews = 0, junkVisits = 0, hasPages = false;
  for (const it of items('requests')) {
    hasPages = true;
    const p = String(it.data).split('?')[0];
    if (REAL[p]) {
      const n = REAL[p];
      pg[n] = pg[n] || { page: n, visits: 0, views: 0 };
      pg[n].visits += num(it.visitors); pg[n].views += num(it.hits);
    } else { junkViews += num(it.hits); junkVisits += num(it.visitors); }
  }
  const pages = Object.values(pg).sort((x, y) => y.views - x.views);
  if (hasPages && junkViews) pages.push({ page: 'bot probes / junk', visits: junkVisits, views: junkViews, junk: true });

  // 404s: the site's own 404 page is the only real one; any other not-found path is a probe.
  let real404 = 0, probe404 = 0, has404 = false;
  for (const it of items('not_found')) {
    has404 = true;
    const p = String(it.data).split('?')[0];
    if (p === '/404/' || p === '/404.html' || p === '/404') real404 += num(it.hits); else probe404 += num(it.hits);
  }

  const topN = (p, f = (x) => x) => {
    const m = {};
    for (const it of items(p)) { const k = f(String(it.data)); m[k] = (m[k] || 0) + num(it.visitors); }
    return Object.entries(m).map(([name, visits]) => ({ name, visits })).sort((x, y) => y.visits - x.visits).slice(0, 8);
  };
  const status = items('status_codes').find((it) => String(it.data).startsWith('4'));
  return {
    source: path.basename(file),
    window: { start: g.start_date ? String(g.start_date) : null, end: g.end_date ? String(g.end_date) : null },
    summary: {
      visits: days.reduce((s, x) => s + x.visits, 0) || num(g.unique_visitors),
      views: num(g.total_requests) || num(g.valid_requests),
      notFound: has404 ? real404 + probe404 : (status ? num(status.hits) : null),
    },
    days, pages, referrers: topN('referring_sites'), browsers: topN('browsers', stripVersion), os: topN('os'),
    notFound: has404 ? { real: real404, probes: probe404 } : null,
  };
}

let data = null;
if (report && fs.existsSync(report)) data = parse(report);
if (data) {
  data.generated = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(path.join(top, 'analytics', 'data'), { recursive: true });
  fs.writeFileSync(path.join(top, 'analytics', 'data', 'visits.json'), JSON.stringify(data, null, 1));
}

const TEMPLATE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>bengusa.pro Visits</title><style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#1b2430;--mute:#5d6b7c;--line:#dde2e8;--bar:#2f6fb3;--bar2:#a9bfd6}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#12161c;--card:#1b222b;--ink:#e6ebf1;--mute:#9aa8b8;--line:#2b3542;--bar:#6aa6e0;--bar2:#3d5670}}
:root[data-theme=dark]{--bg:#12161c;--card:#1b222b;--ink:#e6ebf1;--mute:#9aa8b8;--line:#2b3542;--bar:#6aa6e0;--bar2:#3d5670}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif;padding:16px}
main{max-width:960px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}.sub{color:var(--mute);margin:0 0 16px;font-size:13px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}.row{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;min-width:0}.card h2{font-size:14px;margin:0 0 10px}
.big{font-size:28px;font-weight:700}.lbl{color:var(--mute);font-size:12px}.note{color:var(--mute);font-size:12px;margin-top:8px}
.b{display:flex;align-items:center;gap:8px;margin:5px 0;font-size:13px}.b span.n{flex:0 0 40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.b i{display:block;height:10px;background:var(--bar);border-radius:3px;min-width:2px}.b i.j{background:var(--bar2)}.b em{font-style:normal;color:var(--mute);font-size:12px}
svg{width:100%;display:block}.empty{text-align:center;padding:40px 12px;color:var(--mute)}
</style></head><body><main><h1>bengusa.pro Visits</h1><p class="sub" id="sub"></p><div id="app"></div></main>
<script>var DATA=/*DATA*/null;
(function(){var app=document.getElementById('app'),sub=document.getElementById('sub');
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
if(!DATA){app.innerHTML='<div class="card empty"><h2>No data yet \\u2014 pull a report first</h2><p>Run the pull script with the key drive mounted, then the extract script.</p></div>';return}
sub.textContent='Report '+DATA.source+' \\u00b7 built '+DATA.generated+' \\u00b7 totals only, no addresses';
function bars(rows,key){if(!rows||!rows.length)return'<div class="lbl">None in this report.</div>';var m=Math.max.apply(null,rows.map(function(r){return r[key]}))||1;
return rows.map(function(r){return'<div class="b"><span class="n">'+esc(r.page||r.name)+'</span><i class="'+(r.junk?'j':'')+'" style="width:'+Math.max(2,r[key]/m*45)+'%"></i><em>'+r[key]+'</em></div>'}).join('')}
var s=DATA.summary,h='<div class="row">'+[['Visitor-days',s.visits],['Page views',s.views],['404s',s.notFound==null?'n/a':s.notFound]].map(function(t){return'<div class="card"><div class="big">'+t[1]+'</div><div class="lbl">'+t[0]+'</div></div>'}).join('')+'</div>';
h+='<p class="note" style="margin:-4px 0 12px">Visitor-days \\u2014 the CDN address makes unique counts read low.</p>';
var d=DATA.days;if(d.length){var m=Math.max.apply(null,d.map(function(x){return x.visits}))||1,w=100/d.length,sv='';
d.forEach(function(x,i){var hh=x.visits/m*70;sv+='<rect x="'+(i*w+w*.12)+'" y="'+(80-hh)+'" width="'+w*.76+'" height="'+hh+'" rx="1" fill="var(--bar)"><title>'+x.day+': '+x.visits+'</title></rect>'});
h+='<div class="card" style="margin-bottom:12px"><h2>Visits by day</h2><svg viewBox="0 0 100 82" preserveAspectRatio="none" style="height:140px">'+sv+'</svg><div class="lbl">'+d[0].day+' to '+d[d.length-1].day+' \\u00b7 peak '+m+'</div></div>'}
h+='<div class="grid"><div class="card"><h2>Top pages (page views)</h2>'+bars(DATA.pages,'views')+'<div class="note">Every other address is grouped as bot probes / junk.</div></div>';
h+='<div class="card"><h2>Referring sites</h2>'+bars(DATA.referrers,'visits')+'</div><div class="card"><h2>Browsers</h2>'+bars(DATA.browsers,'visits')+'</div><div class="card"><h2>Operating systems</h2>'+bars(DATA.os,'visits')+'</div>';
var n=DATA.notFound;h+='<div class="card"><h2>404s: real vs bot probes</h2>'+(n?bars([{name:'Real 404 page',v:n.real},{name:'Bot probes',v:n.probes,junk:1}],'v'):'<div class="lbl">Not in this report.</div>')+'</div></div>';
app.innerHTML=h})();</script></body></html>`;

const json = data ? JSON.stringify(data).replace(/</g, '\\u003c') : 'null';
fs.mkdirSync(path.dirname(outHtml), { recursive: true });
fs.writeFileSync(outHtml, TEMPLATE.replace('/*DATA*/null', () => json));
console.log(data ? `dashboard written with data from ${data.source}` : 'dashboard written: empty state (no report)', '->', outHtml);
