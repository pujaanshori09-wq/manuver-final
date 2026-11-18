import type { LatLng } from '../../lib/polyline.js';

/** The public activity page (/a/<code>): plain server-rendered HTML, no app or account needed. */

type Lang = 'id' | 'en';
type ActivityType = 'RUN' | 'RIDE' | 'HIKE';

export type PublicActivity = {
  type: ActivityType;
  title: string;
  startedAt: Date;
  movingSec: number;
  distanceM: number;
  firstName: string;
  route: LatLng[];
};

const T = {
  en: {
    RUN: 'Run',
    RIDE: 'Ride',
    HIKE: 'Hike',
    by: 'by',
    distance: 'Distance',
    pace: 'Avg pace',
    speed: 'Avg speed',
    time: 'Moving time',
    hidden: 'The route is hidden to protect the athlete’s privacy.',
    cta: { RUN: 'Run together on Manuver', RIDE: 'Ride together on Manuver', HIKE: 'Hike together on Manuver' },
    ctaSub: 'Manuver matches you with people who play your sport, near you.',
    soon: 'Manuver is coming soon to the Play Store and App Store.',
    gone: 'This activity is not available',
    goneSub: 'The link may have been switched off or the activity deleted.',
    recorded: 'Recorded with Manuver',
  },
  id: {
    RUN: 'Lari',
    RIDE: 'Gowes',
    HIKE: 'Hiking',
    by: 'oleh',
    distance: 'Jarak',
    pace: 'Pace rata-rata',
    speed: 'Kecepatan rata-rata',
    time: 'Waktu bergerak',
    hidden: 'Rute disembunyikan untuk menjaga privasi atlet.',
    cta: { RUN: 'Ajak lari bareng di Manuver', RIDE: 'Ajak gowes bareng di Manuver', HIKE: 'Ajak hiking bareng di Manuver' },
    ctaSub: 'Manuver mempertemukanmu dengan teman olahraga di sekitarmu.',
    soon: 'Manuver segera hadir di Play Store dan App Store.',
    gone: 'Aktivitas ini tidak tersedia',
    goneSub: 'Link-nya mungkin sudah dimatikan atau aktivitasnya dihapus.',
    recorded: 'Direkam dengan Manuver',
  },
} as const;

export const pickLang = (accepts: string | false): Lang => (accepts === 'id' ? 'id' : 'en');

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const km = (m: number) => (m / 1000).toFixed(2);
function duration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h ? `${h}:` : ''}${h ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
}
function pace(sec: number, m: number) {
  const perKm = Math.round(sec / (m / 1000));
  return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, '0')}`;
}
const speed = (sec: number, m: number) => (m / 1000 / (sec / 3600)).toFixed(1);

const STYLE = `
:root{--bg:#0A0A0A;--card:#141414;--line:#262626;--text:#F5F5F4;--muted:#A3A09B;--orange:#FF5A1F;--orange2:#FF8F52}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text)}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;
  background:radial-gradient(1200px 600px at 50% -200px,rgba(255,90,31,.28),transparent 60%),var(--bg);min-height:100vh}
main{max-width:720px;margin:0 auto;padding:20px 16px 40px}
.brand{font-weight:800;letter-spacing:-.04em;font-size:26px;color:var(--orange);text-decoration:none}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}
.pill{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;background:rgba(255,90,31,.14);color:var(--orange2);font-weight:700;font-size:14px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--orange);box-shadow:0 0 12px var(--orange)}
h1{font-size:clamp(28px,7vw,44px);line-height:1.05;letter-spacing:-.03em;margin:14px 0 6px}
.meta{color:var(--muted);font-size:15px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:24px 0}
.stat{background:linear-gradient(180deg,#1A1A1A,#121212);border:1px solid var(--line);border-radius:20px;padding:14px 14px 16px}
.stat b{display:block;font-size:clamp(24px,6.4vw,36px);letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1}
.stat small{color:var(--muted);font-size:13px}.stat i{font-style:normal;color:var(--muted);font-size:14px;margin-left:3px}
.mapwrap{position:relative;border-radius:26px;overflow:hidden;border:1px solid var(--line);box-shadow:0 30px 80px -30px rgba(255,90,31,.45)}
#map{height:min(58vh,520px);background:#111}
.leaflet-tile{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.88) saturate(.35)}
.leaflet-container{background:#111;font:inherit}
.leaflet-control-attribution{background:rgba(10,10,10,.7)!important;color:#9a968f!important}.leaflet-control-attribution a{color:#cfcac3!important}
.leaflet-bar a{background:#1b1b1b;color:#eee;border-color:#2a2a2a}
.hidden{padding:28px;border-radius:22px;border:1px dashed var(--line);color:var(--muted);text-align:center}
.cta{display:block;width:100%;margin-top:26px;border:0;border-radius:999px;padding:18px 20px;font:inherit;font-weight:800;font-size:17px;color:#fff;cursor:pointer;
  background:linear-gradient(180deg,#FF8F52,#FF5A1F 55%,#E2400B);box-shadow:0 18px 40px -16px rgba(255,90,31,.8)}
.cta:active{transform:scale(.99)}
.sub{color:var(--muted);text-align:center;font-size:14px;margin:12px 0 0}
.toast{margin-top:14px;padding:14px 16px;border-radius:16px;background:#1a1a1a;border:1px solid var(--line);text-align:center;display:none}
footer{margin-top:34px;color:#6f6b66;font-size:12px;text-align:center}
@media (prefers-reduced-motion:no-preference){.rise{animation:rise .6s cubic-bezier(.2,.8,.2,1) both}.d1{animation-delay:.05s}.d2{animation-delay:.12s}.d3{animation-delay:.2s}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}}
`;

function shell(lang: Lang, head: string, body: string) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#0A0A0A">${head}
<style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
}

export function notAvailablePage(lang: Lang) {
  const t = T[lang];
  return shell(
    lang,
    `<title>${esc(t.gone)} · Manuver</title>`,
    `<div class="top"><span class="brand">manuver</span></div>
<h1>${esc(t.gone)}</h1><p class="meta">${esc(t.goneSub)}</p>`,
  );
}

export function activityPage(a: PublicActivity, lang: Lang, nonce: string) {
  const t = T[lang];
  const type = t[a.type];
  const speedMode = a.type === 'RIDE';
  const avg = speedMode ? speed(a.movingSec, a.distanceM) : pace(a.movingSec, a.distanceM);
  const avgUnit = speedMode ? 'km/h' : '/km';
  const date = a.startedAt.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
  const by = a.firstName ? ` · ${t.by} ${a.firstName}` : '';
  const summary = `${km(a.distanceM)} km · ${avg} ${avgUnit} · ${duration(a.movingSec)}`;
  // JSON inside <script>: escape "<" so a value can never close the tag.
  const route = JSON.stringify(a.route).replace(/</g, '\\u003c');

  const head = `<title>${esc(a.title)} · ${esc(summary)} · Manuver</title>
<meta name="description" content="${esc(`${type}${by} — ${summary}`)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Manuver">
<meta property="og:title" content="${esc(`${a.title} · ${km(a.distanceM)} km`)}">
<meta property="og:description" content="${esc(`${type}${by} — ${summary}`)}">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/a/_/leaflet.css">`;

  const body = `<div class="top rise"><span class="brand">manuver</span><span class="pill"><span class="dot"></span>${esc(type)}</span></div>
<h1 class="rise d1">${esc(a.title)}</h1>
<p class="meta rise d1">${esc(date)}${esc(by)}</p>
<section class="stats rise d2">
  <div class="stat"><small>${esc(t.distance)}</small><b>${km(a.distanceM)}<i>km</i></b></div>
  <div class="stat"><small>${esc(speedMode ? t.speed : t.pace)}</small><b>${avg}<i>${avgUnit}</i></b></div>
  <div class="stat"><small>${esc(t.time)}</small><b>${duration(a.movingSec)}</b></div>
</section>
${a.route.length > 1 ? `<div class="mapwrap rise d3"><div id="map" role="img" aria-label="${esc(type)}"></div></div>` : `<p class="hidden rise d3">${esc(t.hidden)}</p>`}
<button class="cta rise d3" id="cta">${esc(t.cta[a.type])}</button>
<p class="sub">${esc(t.ctaSub)}</p>
<p class="toast" id="soon" role="status">${esc(t.soon)}</p>
<footer>${esc(t.recorded)}</footer>
<script src="/a/_/leaflet.js"></script>
<script nonce="${nonce}">
(function(){
  var route=${route};
  document.getElementById('cta').addEventListener('click',function(){
    var shown=false,t=setTimeout(function(){shown=true;document.getElementById('soon').style.display='block';},1200);
    document.addEventListener('visibilitychange',function(){if(document.hidden&&!shown)clearTimeout(t);},{once:true});
    location.href='manuverapp://';
  });
  if(route.length<2||!window.L)return;
  var map=L.map('map',{zoomControl:true,scrollWheelZoom:false,attributionControl:true});
  map.attributionControl.setPrefix(false);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  var glow=L.polyline(route,{color:'#FF5A1F',weight:14,opacity:.18,lineCap:'round',lineJoin:'round'}).addTo(map);
  var line=L.polyline(route,{color:'#FF6A2F',weight:5,opacity:1,lineCap:'round',lineJoin:'round'}).addTo(map);
  map.fitBounds(line.getBounds(),{padding:[28,28]});
  var end=route[route.length-1];
  function dots(){
    L.circleMarker(route[0],{radius:6,color:'#0A0A0A',weight:3,fillColor:'#F5F5F4',fillOpacity:1}).addTo(map);
    L.circleMarker(end,{radius:7,color:'#0A0A0A',weight:3,fillColor:'#FF5A1F',fillOpacity:1}).addTo(map);
  }
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){dots();return;}
  // The route draws itself from start to finish.
  [glow,line].forEach(function(p){
    var el=p.getElement();if(!el||!el.getTotalLength)return;
    var len=el.getTotalLength();
    el.style.strokeDasharray=len;el.style.strokeDashoffset=len;
    el.getBoundingClientRect();
    el.style.transition='stroke-dashoffset 2.4s cubic-bezier(.35,.1,.15,1) .35s';
    el.style.strokeDashoffset='0';
  });
  setTimeout(dots,2700);
})();
</script>`;
  return shell(lang, head, body);
}
