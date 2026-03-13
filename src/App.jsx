import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

// ─── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  bg:           "#F4F0EA",
  white:        "#FDFCFA",
  sand:         "#EDE8DF",
  sandDark:     "#DDD5C8",
  primary:      "#7C5C3E",
  primaryLight: "#9E7A58",
  primaryPale:  "#F0E8DC",
  primaryDeep:  "#4E3726",
  secondary:    "#5C7A5C",
  secondaryPale:"#E8F0E8",
  secondaryDark:"#3D5C3D",
  text:         "#2A2218",
  muted:        "#8C7B6A",
  border:       "#D8CEC0",
  green:        "#5C8C6A",  greenPale:  "#E6F2EA",
  yellow:       "#B8863A",  yellowPale: "#FBF3E2",
  red:          "#B84A3A",  redPale:    "#FBECEB",
  blue:         "#4A7A9B",  bluePale:   "#E8F2F8",
  dark:         "#1C1610",
  darkSurface:  "#2A211A",
  darkSurface2: "#332820",
};

// ─── CONSTANTES GLOBALES ─────────────────────────────────────────────────────
const DEFAULT_FLAT_SPEED = 9.5;
const EMPTY_SETTINGS = {
  name: "", weight: 70, kcalPerKm: 65,
  raceName: "", startTime: "07:00",
  tempC: 15, rain: false, wind: false, heat: false,
  darkMode: false,
  garminCoeff: 1, garminStats: null,
};

// ─── ALGOS TRAIL ─────────────────────────────────────────────────────────────
function fmtTime(seconds) {
  if (!seconds || seconds <= 0) return "--:--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function fmtPace(speedKmh) {
  if (!speedKmh || speedKmh <= 0) return "--:--";
  const minPerKm = 60 / speedKmh;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2,"0")}`;
}
function parseGPX(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const trkpts = doc.querySelectorAll("trkpt");
  const allPts = trkpts.length ? trkpts : doc.querySelectorAll("wpt");
  if (!allPts.length) throw new Error("Aucun point trouvé dans le fichier GPX");
  const points = [];
  allPts.forEach(pt => {
    const lat = parseFloat(pt.getAttribute("lat"));
    const lon = parseFloat(pt.getAttribute("lon"));
    const eleEl = pt.querySelector("ele");
    const ele = eleEl ? parseFloat(eleEl.textContent) : 0;
    if (!isNaN(lat) && !isNaN(lon)) points.push({ lat, lon, ele });
  });
  if (points.length < 2) throw new Error("Pas assez de points dans le GPX");
  let cumDist = 0, totalElevPos = 0, totalElevNeg = 0;
  const enriched = points.map((pt, i) => {
    if (i > 0) {
      const prev = points[i - 1];
      const dLat = (pt.lat - prev.lat) * Math.PI / 180;
      const dLon = (pt.lon - prev.lon) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(prev.lat*Math.PI/180)*Math.cos(pt.lat*Math.PI/180)*Math.sin(dLon/2)**2;
      cumDist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dEle = pt.ele - prev.ele;
      if (dEle > 0) totalElevPos += dEle; else totalElevNeg += Math.abs(dEle);
    }
    return { ...pt, dist: cumDist };
  });
  return { points: enriched, totalDistance: cumDist, totalElevPos, totalElevNeg };
}
function buildElevationProfile(points, resolution = 250) {
  if (!points.length) return [];
  const total = points[points.length - 1].dist;
  const step = total / resolution;
  const profile = [];
  let ptIdx = 0;
  for (let i = 0; i <= resolution; i++) {
    const targetDist = i * step;
    while (ptIdx < points.length - 1 && points[ptIdx + 1].dist < targetDist) ptIdx++;
    const pt = points[Math.min(ptIdx, points.length - 1)];
    profile.push({ dist: +targetDist.toFixed(3), ele: +pt.ele.toFixed(1) });
  }
  return profile;
}
function suggestSpeed(slopePct, coeff = 1) {
  let base;
  if      (slopePct >= 20)  base = 3.5;
  else if (slopePct >= 15)  base = 4.5;
  else if (slopePct >= 10)  base = 5.0;
  else if (slopePct >= 7)   base = 6.0;
  else if (slopePct >= 4)   base = 7.5;
  else if (slopePct >= 1)   base = 8.5;
  else if (slopePct >= -2)  base = 9.5;
  else if (slopePct >= -6)  base = 10.5;
  else if (slopePct >= -13) base = 9.0;
  else                      base = 7.5;
  return +(base * coeff).toFixed(1);
}
function calcSlopeFromGPX(points, startKm, endKm) {
  if (!points.length) return 0;
  const inRange = points.filter(p => p.dist >= startKm && p.dist <= endKm);
  if (inRange.length < 2) return 0;
  const dEle = inRange[inRange.length - 1].ele - inRange[0].ele;
  const dDist = (endKm - startKm) * 1000;
  return dDist === 0 ? 0 : Math.round((dEle / dDist) * 100);
}
function autoSegmentGPX(points, coeff = 1) {
  if (points.length < 10) return [];
  const total = points[points.length - 1].dist;

  // Pente lissée sur une fenêtre centrée sur `dist`
  const slopeAt = (dist, window) => {
    const pts = points.filter(p => Math.abs(p.dist - dist) <= window / 2);
    if (pts.length < 2) return 0;
    const dEle = pts[pts.length-1].ele - pts[0].ele;
    const dDist = (pts[pts.length-1].dist - pts[0].dist) * 1000;
    return dDist > 0 ? (dEle / dDist) * 100 : 0;
  };

  // Proportion de points >threshold dans une fenêtre de 400m autour de dist
  const pctAbove = (dist, threshold, window = 0.4) => {
    const step = 0.05;
    let total = 0, above = 0;
    for (let d = dist - window/2; d <= dist + window/2; d = +(d + step).toFixed(3)) {
      const s = slopeAt(d, 0.15);
      above += s > threshold ? 1 : 0;
      total++;
    }
    return total > 0 ? above / total : 0;
  };

  // Classification d'un point : walk_up si pente soutenue (lissée OU proportion)
  // Seuil abaissé à 7% (vs 9% avant) — calibré sur les courses réelles
  const WALK_UP_THRESHOLD   = 7;
  const WALK_DOWN_THRESHOLD = -12;
  const PCT_THRESHOLD       = 0.40; // 40% des points >7% dans la fenêtre → walk

  const classify = (sf, ss, dist) => {
    // Montée : pente lissée 200m > seuil OU pente lissée 500m > seuil OU proportion soutenue
    if (sf >= WALK_UP_THRESHOLD) return "walk_up";
    if (ss >= WALK_UP_THRESHOLD && sf > -3) return "walk_up";
    if (sf >= 5 && pctAbove(dist, WALK_UP_THRESHOLD) >= PCT_THRESHOLD) return "walk_up";
    // Descente raide
    if (sf <= WALK_DOWN_THRESHOLD) return "walk_down";
    return "run";
  };

  // PASSE 1 — échantillonnage fin (pas 150m)
  const samples = [];
  for (let d = 0; d <= total + 0.05; d = +(d + 0.15).toFixed(2)) {
    const dd = Math.min(+d.toFixed(2), +total.toFixed(2));
    samples.push({ dist: dd, regime: classify(slopeAt(dd, 0.2), slopeAt(dd, 0.5), dd) });
  }

  const groupSamples = (smps, minWalk, minRun) => {
    const raw = [];
    let cur = { start: smps[0].dist, regime: smps[0].regime };
    for (let i = 1; i < smps.length; i++) {
      if (smps[i].regime !== cur.regime) {
        const dist = smps[i].dist - cur.start;
        if (dist >= (cur.regime === "run" ? minRun : minWalk)) {
          raw.push({ start: cur.start, end: smps[i].dist, regime: cur.regime });
          cur = { start: smps[i].dist, regime: smps[i].regime };
        }
      }
    }
    raw.push({ start: cur.start, end: +total.toFixed(1), regime: cur.regime });
    return raw;
  };

  const mergeMicro = (segs, minSize) => {
    const out = [];
    for (const seg of segs) {
      if (seg.end - seg.start < minSize && out.length > 0) {
        out[out.length-1].end = seg.end;
      } else if (out.length > 0 && out[out.length-1].regime === seg.regime) {
        out[out.length-1].end = seg.end;
      } else { out.push({ ...seg }); }
    }
    return out;
  };

  // Proportion de points >threshold sur un segment entier
  const pctAboveSegment = (start, end, threshold) => {
    const step = 0.1;
    let total = 0, above = 0;
    for (let d = start; d <= end; d = +(d + step).toFixed(2)) {
      if (slopeAt(d, 0.15) > threshold) above++;
      total++;
    }
    return total > 0 ? above / total : 0;
  };

  let segs = groupSamples(samples, 0.3, 0.5);

  // PASSE 2 — fusion walk + run_court + walk
  let changed = true;
  while (changed) {
    changed = false;
    const out = [];
    let i = 0;
    while (i < segs.length) {
      if (i+2 < segs.length && segs[i].regime !== "run" && segs[i+1].regime === "run" &&
          segs[i+2].regime === segs[i].regime && segs[i+1].end - segs[i+1].start < 0.4) {
        out.push({ start: segs[i].start, end: segs[i+2].end, regime: segs[i].regime });
        i += 3; changed = true;
      } else { out.push(segs[i]); i++; }
    }
    segs = out;
  }

  segs = mergeMicro(segs, 0.4);

  // PASSE 3 — validation par proportion
  // Un segment classé walk_up est reclassé run si moins de 25% de ses points
  // dépassent le seuil (= pic isolé, pas une montée soutenue)
  const validated = [];
  for (const seg of segs) {
    let fs = seg;
    if (seg.regime === "walk_up") {
      const pct = pctAboveSegment(seg.start, seg.end, WALK_UP_THRESHOLD);
      if (pct < 0.25) fs = { ...seg, regime: "run" };
    } else if (seg.regime === "walk_down") {
      // Symétrique : vérifier proportion de points < seuil descente
      const step = 0.1;
      let tot = 0, below = 0;
      for (let d = seg.start; d <= seg.end; d = +(d + step).toFixed(2)) {
        if (slopeAt(d, 0.15) < WALK_DOWN_THRESHOLD) below++;
        tot++;
      }
      if (tot > 0 && below / tot < 0.25) fs = { ...seg, regime: "run" };
    }
    if (validated.length > 0 && validated[validated.length-1].regime === fs.regime)
      validated[validated.length-1].end = fs.end;
    else validated.push({ ...fs });
  }

  return validated.map((seg, i) => {
    const realSlope = calcSlopeFromGPX(points, seg.start, seg.end);
    return { id: Date.now()+i, startKm: +seg.start.toFixed(1), endKm: +seg.end.toFixed(1), slopePct: realSlope, speedKmh: suggestSpeed(realSlope, coeff), notes: "" };
  });
}
function parseGarminCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const splitCSV = (line) => {
    const cells = []; let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { cells.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cells.push(cur.trim()); return cells;
  };
  const header = splitCSV(lines[0]);
  const idx = {
    type: header.findIndex(h => /type.*activit/i.test(h)),
    gap:  header.findIndex(h => /^gap/i.test(h)),
    distance: header.findIndex(h => /^distance$/i.test(h)),
  };
  if (idx.gap === -1) return null;
  const TRAIL_TYPES = /trail|course à pied|running|run/i;
  const parsePace = (str) => {
    if (!str || str === "--") return null;
    const m = str.match(/^(\d+):(\d{2})$/);
    if (!m) return null;
    const totalMin = parseInt(m[1]) + parseInt(m[2]) / 60;
    return totalMin > 0 ? 60 / totalMin : null;
  };
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitCSV(lines[i]);
    const type = cells[idx.type] || "";
    if (!TRAIL_TYPES.test(type)) continue;
    const dist = parseFloat((cells[idx.distance] || "").replace(",","."));
    if (!dist || dist < 2) continue;
    const gap = parsePace(cells[idx.gap]);
    if (!gap) continue;
    rows.push({ gap, dist });
  }
  if (!rows.length) return null;
  const totalDist = rows.reduce((s,r) => s+r.dist, 0);
  const avgGapKmh = rows.reduce((s,r) => s+r.gap*r.dist, 0) / totalDist;
  return { count: rows.length, avgGapKmh: +avgGapKmh.toFixed(2), coeff: +(avgGapKmh/DEFAULT_FLAT_SPEED).toFixed(3), lastDate: new Date().toLocaleDateString("fr-FR") };
}

// ─── NUTRITION ───────────────────────────────────────────────────────────────
function calcNutrition(seg, settings) {
  const { weight = 70, kcalPerKm = 65, tempC = 15, rain = false, wind = false, heat = false } = settings;
  const distKm = seg.endKm - seg.startKm;
  const durationH = distKm / seg.speedKmh;
  const kcal = Math.round(distKm * kcalPerKm * (weight / 70));
  const kcalH = durationH > 0 ? Math.round(kcal / durationH) : 0;
  const isHot = heat || tempC > 25;
  const glucidesH = Math.round(kcalH * 0.55 / 4);
  const proteinesH = Math.round(kcalH * 0.10 / 4);
  const waterBase = isHot ? 750 : 500;
  const eauH = Math.round(waterBase + (wind ? 100 : 0));
  const selH = Math.round(isHot ? 800 : 500);
  const startKmTot = seg.startKm;
  const cumDurationH = startKmTot / seg.speedKmh;
  const cafeineH = cumDurationH >= 2 ? Math.round(30 + Math.min(seg.slopePct * 2, 40)) : 0;
  return { kcal, kcalH, glucidesH, proteinesH, eauH, selH, cafeineH, durationH };
}

// ─── STYLES GLOBAUX ──────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text-c); font-size: 14px; line-height: 1.5; }
  :root {
    --bg: ${C.bg};
    --surface: ${C.white};
    --surface-2: ${C.sand};
    --surface-3: ${C.sandDark};
    --border-c: ${C.border};
    --text-c: ${C.text};
    --muted-c: ${C.muted};
    --primary: ${C.primary};
  }
  :root.dark {
    --bg: #14100C;
    --surface: #1E1810;
    --surface-2: #26201A;
    --surface-3: #302820;
    --border-c: #3C3028;
    --text-c: #F0EAE0;
    --muted-c: #9A8870;
    --primary: ${C.primaryLight};
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-c); border-radius: 3px; }
  input, select, textarea {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    background: var(--surface-2);
    color: var(--text-c);
    border: 1px solid var(--border-c);
    border-radius: 10px;
    padding: 9px 12px;
    width: 100%;
    outline: none;
    transition: border 0.2s, box-shadow 0.2s;
  }
  input:focus, select:focus, textarea:focus {
    border-color: ${C.primary};
    box-shadow: 0 0 0 3px ${C.primaryPale};
  }
  input[type="range"] {
    background: transparent;
    border: none;
    padding: 0;
    box-shadow: none;
    accent-color: ${C.primary};
  }
  table { border-collapse: collapse; width: 100%; }
  thead th { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-c); background: var(--surface-2); padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border-c); }
  tbody tr { border-bottom: 1px solid var(--border-c); transition: background 0.15s; cursor: pointer; }
  tbody tr:hover { background: var(--surface-2); }
  tbody td { padding: 10px 14px; }
  .tbl-wrap { overflow-x: auto; border-radius: 16px; border: 1px solid var(--border-c); }
  .anim { animation: fadeUp 0.35s ease both; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
  .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .badge-green  { background: ${C.greenPale};  color: ${C.green}; }
  .badge-yellow { background: ${C.yellowPale}; color: ${C.yellow}; }
  .badge-red    { background: ${C.redPale};    color: ${C.red}; }
  .badge-blue   { background: ${C.bluePale};   color: ${C.blue}; }
  .badge-brown  { background: ${C.primaryPale}; color: ${C.primaryDeep}; }
  .badge-sage   { background: ${C.secondaryPale}; color: ${C.secondaryDark}; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: center; justify-content: center; }
  .modal-box { background: var(--surface); border-radius: 20px; border: 1px solid var(--border-c); max-width: 680px; width: 94vw; max-height: 88vh; overflow-y: auto; padding: 32px; box-shadow: 0 24px 60px rgba(0,0,0,0.18); }
  .confirm-box { background: var(--surface); border-radius: 16px; border: 1px solid var(--border-c); max-width: 400px; width: 90vw; padding: 28px; text-align: center; box-shadow: 0 16px 40px rgba(0,0,0,0.15); }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; cursor: pointer; transition: background 0.15s, color 0.15s; font-weight: 500; color: var(--muted-c); font-size: 14px; user-select: none; }
  .nav-item:hover { background: var(--surface-2); color: var(--text-c); }
  .nav-item.active { background: ${C.primaryPale}; color: ${C.primaryDeep}; }
  :root.dark .nav-item.active { background: #3A2C1E; color: ${C.primaryLight}; }
  @media (max-width: 768px) {
    .grid-2col { grid-template-columns: 1fr; }
    .form-grid { grid-template-columns: 1fr; }
    .modal-overlay { align-items: flex-end; }
    .modal-box { border-radius: 20px 20px 0 0; max-height: 90vh; width: 100vw; padding: 24px; }
  }
`;

// ─── ATOMS ───────────────────────────────────────────────────────────────────
const VARIANT_STYLES = {
  primary: { background: C.primary, color: C.white, border: "none" },
  ghost:   { background: "transparent", color: "var(--text-c)", border: "1px solid var(--border-c)" },
  soft:    { background: "var(--surface-2)", color: "var(--text-c)", border: "1px solid var(--border-c)" },
  danger:  { background: C.redPale, color: C.red, border: `1px solid ${C.red}30` },
  sage:    { background: C.secondaryPale, color: C.secondaryDark, border: "none" },
  success: { background: C.greenPale, color: C.green, border: "none" },
};
function Btn({ children, onClick, variant = "primary", size = "md", disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...VARIANT_STYLES[variant],
      padding: size === "sm" ? "6px 14px" : "9px 20px",
      borderRadius: 10, fontSize: size === "sm" ? 13 : 14,
      fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "'DM Sans', sans-serif",
      opacity: disabled ? 0.5 : 1,
      transition: "opacity 0.15s, transform 0.1s",
      display: "inline-flex", alignItems: "center", gap: 6,
      whiteSpace: "nowrap",
      ...style,
    }}>{children}</button>
  );
}
function Card({ children, style, noPad }) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 20,
      border: "1px solid var(--border-c)",
      padding: noPad ? 0 : "24px",
      overflow: noPad ? "hidden" : undefined,
      ...style,
    }}>{children}</div>
  );
}
function KPI({ label, value, sub, color, icon }) {
  const col = color || C.primary;
  return (
    <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border-c)", padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-c)" }}>{label}</span>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, color: col, lineHeight: 1.2, marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
function PageTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, color: "var(--text-c)", lineHeight: 1.2 }}>{children}</h1>
      {sub && <p style={{ color: "var(--muted-c)", marginTop: 6, fontSize: 14 }}>{sub}</p>}
    </div>
  );
}
function Field({ label, children, full }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
function Modal({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600 }}>{title}</div>
            {subtitle && <div style={{ color: "var(--muted-c)", fontSize: 13, marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted-c)", padding: "0 4px", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: "var(--muted-c)", marginBottom: 24, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Btn variant="ghost" onClick={onCancel}>Annuler</Btn>
          <Btn variant="danger" onClick={onConfirm}>Supprimer</Btn>
        </div>
      </div>
    </div>
  );
}
function Empty({ icon, title, sub, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", gap: 12, textAlign: "center" }}>
      <span style={{ fontSize: 48 }}>{icon}</span>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600 }}>{title}</div>
      {sub && <p style={{ color: "var(--muted-c)", maxWidth: 340 }}>{sub}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────
function Hr() { return <div style={{ height: 1, background: "var(--border-c)", margin: "20px 0" }} />; }

function SliderField({ label, value, min, max, step = 1, unit, onChange }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}
function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <div style={{
        width: 40, height: 22, borderRadius: 11, background: checked ? C.primary : "var(--surface-3)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16,
          borderRadius: "50%", background: "#fff", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
      <span style={{ fontSize: 14, color: "var(--text-c)" }}>{label}</span>
    </label>
  );
}
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-c)", borderRadius: 10, padding: "10px 14px", fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: {p.value}</div>)}
    </div>
  );
};

// ─── VUE PROFIL DE COURSE ────────────────────────────────────────────────────
function ProfilView({ race, setRace, segments, setSegments, settings }) {
  const [gpxError, setGpxError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [hoveredSeg, setHoveredSeg] = useState(null);
  const [ravitoModal, setRavitoModal] = useState(false);
  const [ravitoForm, setRavitoForm] = useState({ km: "", name: "" });
  const [editRavitoId, setEditRavitoId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const fileRef = useRef();

  const profile = useMemo(() => race.gpxPoints?.length ? buildElevationProfile(race.gpxPoints, 300) : [], [race.gpxPoints]);
  const totalTime = segments.reduce((s, seg) => {
    const dist = seg.endKm - seg.startKm;
    return s + (dist / seg.speedKmh) * 3600;
  }, 0);

  const handleGPX = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const { points, totalDistance, totalElevPos, totalElevNeg } = parseGPX(e.target.result);
        setRace(r => ({ ...r, gpxPoints: points, totalDistance, totalElevPos, totalElevNeg }));
        setGpxError(null);
      } catch(err) { setGpxError(err.message); }
    };
    reader.readAsText(file);
  };
  const onDrop = e => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".gpx")) handleGPX(file);
    else setGpxError("Fichier GPX requis (.gpx)");
  };

  const saveRavito = () => {
    const km = parseFloat(ravitoForm.km);
    if (isNaN(km) || !ravitoForm.name) return;
    if (editRavitoId) {
      setRace(r => ({ ...r, ravitos: r.ravitos.map(rv => rv.id === editRavitoId ? { ...ravitoForm, km, id: editRavitoId } : rv) }));
    } else {
      setRace(r => ({ ...r, ravitos: [...(r.ravitos||[]), { ...ravitoForm, km, id: Date.now() }] }));
    }
    setRavitoModal(false); setRavitoForm({ km: "", name: "" }); setEditRavitoId(null);
  };
  const openEditRavito = rv => { setEditRavitoId(rv.id); setRavitoForm({ km: rv.km, name: rv.name }); setRavitoModal(true); };
  const deleteRavito = id => { setRace(r => ({ ...r, ravitos: (r.ravitos||[]).filter(rv => rv.id !== id) })); setConfirmId(null); };

  const minEle = profile.length ? Math.min(...profile.map(p => p.ele)) - 20 : 0;

  return (
    <div className="anim">
      <PageTitle sub={race.gpxPoints?.length ? `${race.totalDistance?.toFixed(1)} km chargés` : "Importe ton tracé GPX pour commencer"}>
        {race.name || "Profil de course"}
      </PageTitle>

      {!race.gpxPoints?.length ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? C.primary : "var(--border-c)"}`,
            borderRadius: 20, padding: "60px 24px", textAlign: "center",
            cursor: "pointer", background: dragging ? C.primaryPale : "var(--surface)",
            transition: "all 0.2s",
          }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, marginBottom: 8 }}>Glisse ton fichier GPX ici</div>
          <p style={{ color: "var(--muted-c)" }}>ou clique pour sélectionner un fichier .gpx</p>
          {gpxError && <p style={{ color: C.red, marginTop: 12, fontSize: 13 }}>{gpxError}</p>}
          <input ref={fileRef} type="file" accept=".gpx" style={{ display: "none" }} onChange={e => handleGPX(e.target.files[0])} />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
            <KPI label="Distance" value={`${race.totalDistance?.toFixed(1)} km`} icon="📏" />
            <KPI label="D+" value={`${Math.round(race.totalElevPos)} m`} color={C.red} icon="⛰️" />
            <KPI label="D−" value={`${Math.round(race.totalElevNeg)} m`} color={C.blue} icon="🏔️" />
            <KPI label="Segments" value={segments.length} icon="✂️" />
            <KPI label="Temps estimé" value={fmtTime(totalTime)} color={C.secondary} icon="⏱️" />
          </div>

          <Card noPad style={{ marginBottom: 24 }}>
            <div style={{ padding: "20px 20px 0" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Profil altimétrique</div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={profile} margin={{ top: 10, right: 20, bottom: 10, left: 40 }}>
                <defs>
                  <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.primary} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={C.primary} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dist" tickFormatter={v => `${v.toFixed(0)}km`} tick={{ fontSize: 11, fill: C.muted }} />
                <YAxis domain={[minEle, "auto"]} tick={{ fontSize: 11, fill: C.muted }} />
                <RTooltip content={<CustomTooltip />} formatter={(v, n) => [n === "ele" ? `${v} m` : `${v} km`, n === "ele" ? "Altitude" : "Dist"]} />
                {hoveredSeg && (
                  <ReferenceLine x={hoveredSeg.startKm} stroke={C.yellow} strokeDasharray="4 2" />
                )}
                {hoveredSeg && (
                  <ReferenceLine x={hoveredSeg.endKm} stroke={C.yellow} strokeDasharray="4 2" />
                )}
                {(race.ravitos||[]).map(rv => (
                  <ReferenceLine key={rv.id} x={rv.km} stroke={C.green} label={{ value: rv.name, position: "top", fontSize: 10, fill: C.green }} />
                ))}
                <Area type="monotone" dataKey="ele" stroke={C.primary} strokeWidth={2} fill="url(#eleGrad)" dot={false} name="Altitude" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid-2col" style={{ marginBottom: 24 }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>Ravitaillements</div>
                <Btn size="sm" onClick={() => { setEditRavitoId(null); setRavitoForm({ km: "", name: "" }); setRavitoModal(true); }}>+ Ravito</Btn>
              </div>
              {!(race.ravitos?.length) ? (
                <p style={{ color: "var(--muted-c)", fontSize: 13 }}>Aucun ravitaillement défini</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...(race.ravitos||[])].sort((a,b) => a.km - b.km).map(rv => (
                    <div key={rv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--surface-2)", borderRadius: 10 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{rv.name}</span>
                        <span style={{ color: "var(--muted-c)", marginLeft: 8, fontSize: 13 }}>{rv.km} km</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Btn size="sm" variant="ghost" onClick={() => openEditRavito(rv)}>✏️</Btn>
                        <Btn size="sm" variant="danger" onClick={() => setConfirmId(rv.id)}>✕</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <div style={{ fontWeight: 600, marginBottom: 16 }}>Infos course</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Heure de départ">
                  <input type="time" value={settings.startTime || "07:00"} onChange={e => {}} style={{ width: "100%" }} />
                </Field>
                <SliderField label="Température" value={settings.tempC} min={-5} max={45} unit="°C" onChange={() => {}} />
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <Toggle label="🌧️ Pluie" checked={settings.rain} onChange={() => {}} />
                  <Toggle label="💨 Vent" checked={settings.wind} onChange={() => {}} />
                  <Toggle label="🌡️ Forte chaleur" checked={settings.heat} onChange={() => {}} />
                </div>
                <p style={{ fontSize: 12, color: "var(--muted-c)" }}>Modifier ces valeurs dans Paramètres</p>
              </div>
            </Card>
          </div>

          {segments.length > 0 && (
            <Card noPad>
              <div style={{ padding: "18px 20px 0", fontWeight: 600 }}>Segments — aperçu</div>
              <div className="tbl-wrap">
                <table>
                  <thead><tr>
                    <th>#</th><th>Début</th><th>Fin</th><th>Pente</th><th>Vitesse</th><th>Allure</th><th>Durée</th>
                  </tr></thead>
                  <tbody>{segments.map((seg, i) => {
                    const dist = seg.endKm - seg.startKm;
                    const dur = fmtTime((dist / seg.speedKmh) * 3600);
                    return (
                      <tr key={seg.id} onMouseEnter={() => setHoveredSeg(seg)} onMouseLeave={() => setHoveredSeg(null)}>
                        <td style={{ color: "var(--muted-c)" }}>{i+1}</td>
                        <td>{seg.startKm} km</td>
                        <td>{seg.endKm} km</td>
                        <td>
                          <span className={`badge ${seg.slopePct > 9 ? "badge-red" : seg.slopePct < -12 ? "badge-blue" : "badge-sage"}`}>
                            {seg.slopePct > 0 ? "+" : ""}{seg.slopePct}%
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{seg.speedKmh} km/h</td>
                        <td style={{ fontFamily: "'Playfair Display', serif" }}>{fmtPace(seg.speedKmh)}/km</td>
                        <td>{dur}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </Card>
          )}

          <div style={{ marginTop: 16 }}>
            <Btn variant="ghost" size="sm" onClick={() => { setRace(r => ({ ...r, gpxPoints: null, totalDistance: 0, totalElevPos: 0, totalElevNeg: 0 })); setSegments([]); }}>
              🔄 Recharger un autre GPX
            </Btn>
          </div>
        </>
      )}

      <Modal open={ravitoModal} onClose={() => setRavitoModal(false)} title={editRavitoId ? "Modifier ravito" : "Nouveau ravitaillement"}>
        <div className="form-grid">
          <Field label="Kilomètre"><input type="number" min={0} step={0.1} value={ravitoForm.km} onChange={e => setRavitoForm(f => ({ ...f, km: e.target.value }))} /></Field>
          <Field label="Nom du point" full><input value={ravitoForm.name} onChange={e => setRavitoForm(f => ({ ...f, name: e.target.value }))} /></Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setRavitoModal(false)}>Annuler</Btn>
          <Btn onClick={saveRavito}>Enregistrer</Btn>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmId} message="Supprimer ce ravitaillement ?" onConfirm={() => deleteRavito(confirmId)} onCancel={() => setConfirmId(null)} />
    </div>
  );
}

// ─── VUE PRÉPARATION ─────────────────────────────────────────────────────────
function PreparationView({ race, segments, setSegments, settings }) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [computing, setComputing] = useState(false);
  const emptyForm = { startKm: "", endKm: "", slopePct: 0, speedKmh: 9.5, notes: "" };
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setEditId(null); setForm(emptyForm); setModal(true); };
  const openEdit = seg => { setEditId(seg.id); setForm(seg); setModal(true); };
  const upd = (key, val) => {
    setForm(f => {
      const nf = { ...f, [key]: val };
      if (key === "startKm" || key === "endKm") {
        const slope = race.gpxPoints?.length ? calcSlopeFromGPX(race.gpxPoints, parseFloat(nf.startKm)||0, parseFloat(nf.endKm)||0) : nf.slopePct;
        nf.slopePct = slope;
        nf.speedKmh = suggestSpeed(slope, settings.garminCoeff);
      }
      if (key === "slopePct") { nf.speedKmh = suggestSpeed(val, settings.garminCoeff); }
      return nf;
    });
  };
  const save = () => {
    const seg = { ...form, startKm: parseFloat(form.startKm)||0, endKm: parseFloat(form.endKm)||0 };
    if (seg.endKm <= seg.startKm) return;
    if (editId) setSegments(s => s.map(x => x.id === editId ? { ...seg, id: editId } : x));
    else setSegments(s => [...s, { ...seg, id: Date.now() }]);
    setModal(false);
  };

  const autoSegment = () => {
    if (!race.gpxPoints?.length) return;
    setComputing(true);
    setTimeout(() => {
      const segs = autoSegmentGPX(race.gpxPoints, settings.garminCoeff);
      setSegments(segs);
      setComputing(false);
    }, 50);
  };

  const totalTime = segments.reduce((s, seg) => s + ((seg.endKm - seg.startKm) / seg.speedKmh) * 3600, 0);
  const nutriTotals = segments.reduce((acc, seg) => {
    const n = calcNutrition(seg, settings);
    const dist = seg.endKm - seg.startKm;
    const durationH = dist / seg.speedKmh;
    return {
      kcal: acc.kcal + n.kcal,
      eau: acc.eau + Math.round(n.eauH * durationH),
      glucides: acc.glucides + Math.round(n.glucidesH * durationH),
      sel: acc.sel + Math.round(n.selH * durationH),
    };
  }, { kcal: 0, eau: 0, glucides: 0, sel: 0 });

  const barData = segments.map((s, i) => ({ name: `S${i+1}`, vitesse: s.speedKmh, pente: s.slopePct }));

  return (
    <div className="anim">
      <PageTitle sub={`${segments.length} segment${segments.length > 1 ? "s" : ""} — temps total estimé ${fmtTime(totalTime)}`}>Préparation</PageTitle>

      {!race.gpxPoints?.length && (
        <div style={{ background: C.yellowPale, border: `1px solid ${C.yellow}40`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: C.yellow }}>
          ⚠️ Charge d'abord un fichier GPX dans l'onglet Profil pour utiliser le découpage automatique et le calcul de pente.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <Btn onClick={openNew}>+ Ajouter un segment</Btn>
        {race.gpxPoints?.length > 0 && (
          <Btn variant="sage" onClick={autoSegment} disabled={computing}>
            {computing ? "⏳ Calcul…" : "⚡ Découpage auto"}
          </Btn>
        )}
      </div>

      {!segments.length ? (
        <Empty icon="✂️" title="Aucun segment défini" sub="Ajoute des segments manuellement ou utilise le découpage automatique depuis un GPX." action={<Btn onClick={openNew}>+ Ajouter un segment</Btn>} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
            <KPI label="Calories" value={`${nutriTotals.kcal} kcal`} icon="🔥" />
            <KPI label="Eau totale" value={`${(nutriTotals.eau/1000).toFixed(1)} L`} color={C.blue} icon="💧" />
            <KPI label="Glucides" value={`${nutriTotals.glucides} g`} color={C.yellow} icon="🍌" />
            <KPI label="Sel" value={`${nutriTotals.sel} mg`} color={C.green} icon="🧂" />
          </div>

          <Card noPad style={{ marginBottom: 24 }}>
            <div style={{ padding: "18px 20px 0", fontWeight: 600 }}>Vitesses par segment</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} />
                <RTooltip content={<CustomTooltip />} />
                <Bar dataKey="vitesse" name="km/h" radius={[4,4,0,0]}>
                  {barData.map((d, i) => (
                    <Cell key={i} fill={d.pente > 9 ? C.red : d.pente < -12 ? C.blue : d.pente > 4 ? C.yellow : C.green} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card noPad style={{ marginBottom: 24 }}>
            <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Segments</span>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead><tr>
                  <th>#</th><th>De</th><th>À</th><th>Dist.</th><th>Pente</th><th>Vitesse</th><th>Allure</th><th>Durée</th><th>Nutrition/h</th><th></th>
                </tr></thead>
                <tbody>{segments.map((seg, i) => {
                  const dist = seg.endKm - seg.startKm;
                  const dur = fmtTime((dist / seg.speedKmh) * 3600);
                  const n = calcNutrition(seg, settings);
                  return (
                    <tr key={seg.id} onClick={() => openEdit(seg)}>
                      <td style={{ color: "var(--muted-c)" }}>{i+1}</td>
                      <td>{seg.startKm} km</td>
                      <td>{seg.endKm} km</td>
                      <td>{dist.toFixed(1)} km</td>
                      <td>
                        <span className={`badge ${seg.slopePct > 9 ? "badge-red" : seg.slopePct < -12 ? "badge-blue" : "badge-sage"}`}>
                          {seg.slopePct > 0 ? "+" : ""}{seg.slopePct}%
                        </span>
                        {seg.slopePct > 10 && <span style={{ marginLeft: 6, fontSize: 11 }}>⚠️ marche</span>}
                      </td>
                      <td style={{ fontWeight: 600 }}>{seg.speedKmh} km/h</td>
                      <td style={{ fontFamily: "'Playfair Display', serif" }}>{fmtPace(seg.speedKmh)}/km</td>
                      <td>{dur}</td>
                      <td style={{ fontSize: 12, color: "var(--muted-c)" }}>
                        💧{n.eauH} · 🍌{n.glucidesH}g · 🔥{n.kcalH}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <Btn size="sm" variant="danger" onClick={() => setConfirmId(seg.id)}>✕</Btn>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>Récap nutrition totale</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
              {[
                { label: "🔥 Calories", val: `${nutriTotals.kcal} kcal` },
                { label: "💧 Eau", val: `${(nutriTotals.eau/1000).toFixed(1)} L` },
                { label: "🍌 Glucides", val: `${nutriTotals.glucides} g` },
                { label: "🧂 Sel", val: `${nutriTotals.sel} mg` },
              ].map(item => (
                <div key={item.label} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, color: "var(--muted-c)" }}>{item.label}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, marginTop: 4 }}>{item.val}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "Modifier segment" : "Nouveau segment"}>
        <div className="form-grid">
          <Field label="Début (km)"><input type="number" min={0} step={0.1} value={form.startKm} onChange={e => upd("startKm", e.target.value)} /></Field>
          <Field label="Fin (km)"><input type="number" min={0} step={0.1} value={form.endKm} onChange={e => upd("endKm", e.target.value)} /></Field>
          <Field label="Pente (%)">
            <div>
              <input type="range" min={-25} max={30} step={1} value={form.slopePct} onChange={e => upd("slopePct", Number(e.target.value))} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted-c)", marginTop: 4 }}>
                <span>-25%</span><span style={{ fontWeight: 600, color: form.slopePct > 10 ? C.red : "var(--text-c)" }}>{form.slopePct > 0 ? "+" : ""}{form.slopePct}%</span><span>+30%</span>
              </div>
            </div>
          </Field>
          <Field label="Vitesse (km/h)">
            <div>
              <input type="range" min={2} max={15} step={0.5} value={form.speedKmh} onChange={e => upd("speedKmh", Number(e.target.value))} />
              <div style={{ textAlign: "center", fontSize: 13, marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>{form.speedKmh} km/h</span>
                <span style={{ color: "var(--muted-c)", marginLeft: 8 }}>({fmtPace(form.speedKmh)}/km)</span>
              </div>
            </div>
          </Field>
          <Field label="Notes" full><textarea value={form.notes} onChange={e => upd("notes", e.target.value)} rows={2} /></Field>
        </div>
        {form.slopePct > 10 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.yellowPale, borderRadius: 10, fontSize: 13, color: C.yellow }}>
            ⚠️ Marche conseillée — pente élevée ({form.slopePct}%)
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setModal(false)}>Annuler</Btn>
          <Btn onClick={save}>Enregistrer</Btn>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmId} message="Supprimer ce segment ?" onConfirm={() => { setSegments(s => s.filter(x => x.id !== confirmId)); setConfirmId(null); }} onCancel={() => setConfirmId(null)} />
    </div>
  );
}

// ─── VUE ONE-PAGER ───────────────────────────────────────────────────────────
function OnePagerView({ race, segments, settings }) {
  const canvasRef = useRef();
  const profile = useMemo(() => race.gpxPoints?.length ? buildElevationProfile(race.gpxPoints, 80) : [], [race.gpxPoints]);

  const totalTime = segments.reduce((s, seg) => s + ((seg.endKm - seg.startKm) / seg.speedKmh) * 3600, 0);
  const nutriTotals = segments.reduce((acc, seg) => {
    const n = calcNutrition(seg, settings);
    const durationH = (seg.endKm - seg.startKm) / seg.speedKmh;
    return { kcal: acc.kcal + n.kcal, eau: acc.eau + Math.round(n.eauH * durationH), glucides: acc.glucides + Math.round(n.glucidesH * durationH), sel: acc.sel + Math.round(n.selH * durationH) };
  }, { kcal: 0, eau: 0, glucides: 0, sel: 0 });

  const exportPNG = async () => {
    const W = 1080, H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#14100C";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = C.primaryLight;
    ctx.font = "bold 52px serif";
    ctx.textAlign = "center";
    ctx.fillText(settings.raceName || race.name || "Ma Course", W/2, 100);

    ctx.fillStyle = "#9A8870";
    ctx.font = "32px sans-serif";
    ctx.fillText(`Départ ${settings.startTime || "07:00"} — ${fmtTime(totalTime)}`, W/2, 155);

    if (profile.length) {
      const minE = Math.min(...profile.map(p => p.ele));
      const maxE = Math.max(...profile.map(p => p.ele));
      const chartX = 60, chartY = 200, chartW = W - 120, chartH = 220;
      ctx.strokeStyle = C.primary;
      ctx.lineWidth = 3;
      ctx.beginPath();
      profile.forEach((pt, i) => {
        const x = chartX + (pt.dist / profile[profile.length-1].dist) * chartW;
        const y = chartY + chartH - ((pt.ele - minE) / (maxE - minE)) * chartH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.strokeStyle = "#30281A";
      ctx.beginPath();
      ctx.moveTo(chartX, chartY + chartH);
      profile.forEach(pt => {
        const x = chartX + (pt.dist / profile[profile.length-1].dist) * chartW;
        ctx.lineTo(x, chartY + chartH);
      });
      ctx.stroke();
    }

    ctx.fillStyle = "#F0EAE0";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("SEG   DE      À    VITESSE   ALLURE", 60, 480);

    ctx.fillStyle = "#9A8870";
    ctx.font = "26px sans-serif";
    segments.slice(0, 14).forEach((seg, i) => {
      const y = 520 + i * 72;
      const dist = seg.endKm - seg.startKm;
      ctx.fillStyle = i % 2 === 0 ? "#1E1810" : "transparent";
      ctx.fillRect(50, y - 28, W - 100, 60);
      ctx.fillStyle = "#F0EAE0";
      ctx.fillText(`${i+1}`, 70, y+8);
      ctx.fillText(`${seg.startKm}km`, 130, y+8);
      ctx.fillText(`${seg.endKm}km`, 310, y+8);
      ctx.fillStyle = seg.slopePct > 9 ? C.red : C.primaryLight;
      ctx.fillText(`${seg.speedKmh}km/h`, 480, y+8);
      ctx.fillStyle = "#F0EAE0";
      ctx.fillText(`${fmtPace(seg.speedKmh)}/km`, 700, y+8);
      ctx.fillStyle = seg.slopePct > 10 ? C.yellow : "#9A8870";
      ctx.fillText(seg.slopePct > 10 ? "🚶" : "🏃", 920, y+8);
    });

    const nutY = H - 280;
    ctx.fillStyle = "#26201A";
    ctx.fillRect(0, nutY - 30, W, 280);
    ctx.fillStyle = C.primaryLight;
    ctx.font = "bold 32px serif";
    ctx.textAlign = "center";
    ctx.fillText("NUTRITION", W/2, nutY + 20);
    ctx.fillStyle = "#F0EAE0";
    ctx.font = "26px sans-serif";
    ctx.fillText(`🔥 ${nutriTotals.kcal} kcal  💧 ${(nutriTotals.eau/1000).toFixed(1)}L  🍌 ${nutriTotals.glucides}g  🧂 ${nutriTotals.sel}mg`, W/2, nutY + 72);
    const weatherStr = [settings.tempC+"°C", settings.rain ? "🌧️" : "", settings.wind ? "💨" : "", settings.heat ? "🌡️" : ""].filter(Boolean).join(" ");
    ctx.fillStyle = "#9A8870";
    ctx.font = "24px sans-serif";
    ctx.fillText(weatherStr, W/2, nutY + 120);

    const link = document.createElement("a");
    link.download = `${settings.raceName || "course"}-alex.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="anim">
      <PageTitle sub="Aperçu du récapitulatif course — exportable en PNG fond d'écran">One-pager</PageTitle>

      {!segments.length ? (
        <Empty icon="📄" title="Aucun segment à afficher" sub="Définis d'abord ta stratégie dans l'onglet Préparation." />
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <Btn onClick={exportPNG}>📥 Export PNG (1080×1920)</Btn>
          </div>

          <div style={{
            background: "#14100C", borderRadius: 20, padding: "28px 24px",
            maxWidth: 420, margin: "0 auto", color: "#F0EAE0",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}>
            <div style={{ textAlign: "center", borderBottom: "1px solid #302820", paddingBottom: 16, marginBottom: 16 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.primaryLight, fontWeight: 600 }}>
                {settings.raceName || race.name || "Ma Course"}
              </div>
              <div style={{ color: "#9A8870", fontSize: 13, marginTop: 4 }}>
                Départ {settings.startTime || "07:00"} — {fmtTime(totalTime)}
              </div>
            </div>

            {profile.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={profile} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="darkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.primary} stopOpacity={0.5} />
                        <stop offset="95%" stopColor={C.primary} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="ele" stroke={C.primaryLight} strokeWidth={1.5} fill="url(#darkGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <table style={{ width: "100%", fontSize: 12, marginBottom: 16 }}>
              <thead><tr>
                {["#","Km","→","km/h","Allure","Pente"].map(h => (
                  <th key={h} style={{ color: "#9A8870", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", padding: "4px 6px", background: "transparent", borderBottom: "1px solid #302820" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{segments.map((seg, i) => (
                <tr key={seg.id} style={{ borderBottom: "1px solid #26201A" }}>
                  <td style={{ padding: "5px 6px", color: "#9A8870" }}>{i+1}</td>
                  <td style={{ padding: "5px 6px" }}>{seg.startKm}</td>
                  <td style={{ padding: "5px 6px" }}>{seg.endKm}</td>
                  <td style={{ padding: "5px 6px", fontWeight: 600, color: seg.slopePct > 9 ? C.red : C.primaryLight }}>{seg.speedKmh}</td>
                  <td style={{ padding: "5px 6px", fontFamily: "'Playfair Display', serif" }}>{fmtPace(seg.speedKmh)}</td>
                  <td style={{ padding: "5px 6px" }}>
                    <span style={{ color: seg.slopePct > 10 ? C.yellow : "#9A8870", fontSize: 11 }}>
                      {seg.slopePct > 0 ? "+" : ""}{seg.slopePct}%{seg.slopePct > 10 ? " 🚶" : ""}
                    </span>
                  </td>
                </tr>
              ))}</tbody>
            </table>

            <div style={{ borderTop: "1px solid #302820", paddingTop: 12 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: C.primaryLight, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Nutrition</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                {[
                  { e: "🔥", l: "Calories", v: `${nutriTotals.kcal} kcal` },
                  { e: "💧", l: "Eau", v: `${(nutriTotals.eau/1000).toFixed(1)} L` },
                  { e: "🍌", l: "Glucides", v: `${nutriTotals.glucides} g` },
                  { e: "🧂", l: "Sel", v: `${nutriTotals.sel} mg` },
                ].map(item => (
                  <div key={item.l} style={{ background: "#26201A", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ color: "#9A8870", fontSize: 10 }}>{item.e} {item.l}</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{item.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#9A8870", textAlign: "center" }}>
                {settings.tempC}°C {settings.rain ? "🌧️ " : ""}{settings.wind ? "💨 " : ""}{settings.heat ? "🌡️ chaleur" : ""}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── VUE PARAMÈTRES ──────────────────────────────────────────────────────────
function ParamètresView({ settings, setSettings, race, setRace, segments }) {
  const garminRef = useRef();
  const upd = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const totalTime = segments.reduce((s, seg) => s + ((seg.endKm - seg.startKm) / seg.speedKmh) * 3600, 0);
  const nutriTotals = segments.reduce((acc, seg) => {
    const n = calcNutrition(seg, settings);
    const durationH = (seg.endKm - seg.startKm) / seg.speedKmh;
    return { kcal: acc.kcal + n.kcal, eau: acc.eau + Math.round(n.eauH * durationH), glucides: acc.glucides + Math.round(n.glucidesH * durationH) };
  }, { kcal: 0, eau: 0, glucides: 0 });

  const handleGarmin = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = parseGarminCSV(ev.target.result);
      if (result) { upd("garminCoeff", result.coeff); upd("garminStats", result); }
      else alert("Fichier CSV Garmin non reconnu. Vérifie le format Activities.csv.");
    };
    reader.readAsText(file);
  };

  return (
    <div className="anim">
      <PageTitle sub="Profil coureur, infos course, météo et calibration">Paramètres</PageTitle>
      <div className="grid-2col" style={{ gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>👤 Profil coureur</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Nom"><input value={settings.name} onChange={e => upd("name", e.target.value)} placeholder="Ton prénom" /></Field>
            <SliderField label="Poids" value={settings.weight} min={40} max={120} unit=" kg" onChange={v => upd("weight", v)} />
            <SliderField label="Kcal brûlées par km" value={settings.kcalPerKm} min={40} max={100} unit=" kcal/km" onChange={v => upd("kcalPerKm", v)} />
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>🏔️ Course actuelle</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Nom de la course"><input value={settings.raceName || race.name || ""} onChange={e => { upd("raceName", e.target.value); setRace(r => ({ ...r, name: e.target.value })); }} placeholder="Ex : UTMB, TDS..." /></Field>
            <Field label="Heure de départ"><input type="time" value={settings.startTime || "07:00"} onChange={e => upd("startTime", e.target.value)} /></Field>
            <Btn variant="danger" size="sm" onClick={() => { if (confirm("Reset complet — es-tu sûr ?")) { setRace({}); upd("raceName", ""); } }}>
              🔄 Reset complet course
            </Btn>
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>🌤️ Météo</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SliderField label="Température" value={settings.tempC} min={-10} max={45} unit="°C" onChange={v => upd("tempC", v)} />
            <Toggle label="🌧️ Pluie" checked={settings.rain} onChange={v => upd("rain", v)} />
            <Toggle label="💨 Vent fort" checked={settings.wind} onChange={v => upd("wind", v)} />
            <Toggle label="🌡️ Forte chaleur (> 25°C)" checked={settings.heat} onChange={v => upd("heat", v)} />
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>🎨 Apparence</div>
          <Toggle label="🌙 Mode sombre" checked={settings.darkMode} onChange={v => upd("darkMode", v)} />
        </Card>

        <Card style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⌚ Calibration Garmin</div>
          <p style={{ color: "var(--muted-c)", fontSize: 13, marginBottom: 16 }}>
            Importe ton export CSV Garmin Connect (Activities.csv) pour calibrer les vitesses suggérées à ton niveau réel.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="soft" onClick={() => garminRef.current?.click()}>📂 Charger Activities.csv</Btn>
            <input ref={garminRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleGarmin} />
            <span style={{ color: "var(--muted-c)", fontSize: 13 }}>
              Coefficient actuel : <strong>{settings.garminCoeff}</strong>
              {settings.garminStats && ` (${settings.garminStats.count} sorties, GAP moy. ${settings.garminStats.avgGapKmh} km/h)`}
            </span>
          </div>
          {settings.garminStats && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 13, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>📊 {settings.garminStats.count} activités analysées</span>
              <span>⚡ GAP moyen : {settings.garminStats.avgGapKmh} km/h</span>
              <span>🎯 Coefficient : ×{settings.garminStats.coeff}</span>
              <span>📅 Calculé le {settings.garminStats.lastDate}</span>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Btn variant="ghost" size="sm" onClick={() => { upd("garminCoeff", 1); upd("garminStats", null); }}>Réinitialiser (coeff = 1)</Btn>
          </div>
        </Card>

        <Card style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>🧪 Simulateur d'effort</div>
          {!segments.length ? (
            <p style={{ color: "var(--muted-c)", fontSize: 13 }}>Définis d'abord des segments dans l'onglet Préparation.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {[
                { icon: "⏱️", label: "Temps total estimé", value: fmtTime(totalTime) },
                { icon: "🔥", label: "Calories totales", value: `${nutriTotals.kcal} kcal` },
                { icon: "💧", label: "Eau nécessaire", value: `${(nutriTotals.eau/1000).toFixed(1)} L` },
                { icon: "🍌", label: "Glucides totaux", value: `${nutriTotals.glucides} g` },
                { icon: "⚖️", label: "Pour ton profil", value: `${settings.weight} kg · ${settings.kcalPerKm} kcal/km` },
              ].map(item => (
                <div key={item.label} style={{ background: "var(--surface-2)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-c)" }}>{item.label}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, marginTop: 2 }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const NAVS = [
  { id: "profil",      label: "Profil de course",  icon: "🗺️" },
  { id: "preparation", label: "Préparation",        icon: "✂️" },
  { id: "onepager",   label: "One-pager",           icon: "📄" },
  { id: "parametres", label: "Paramètres",          icon: "⚙️" },
];

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("profil");
  const [race, setRaceRaw] = useState({});
  const [segments, setSegmentsRaw] = useState([]);
  const [settings, setSettingsRaw] = useState(EMPTY_SETTINGS);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [onboarding, setOnboarding] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [settings.darkMode]);

  const setRace = useCallback(upd => { setRaceRaw(upd); setHasUnsaved(true); }, []);
  const setSegments = useCallback(upd => { setSegmentsRaw(upd); setHasUnsaved(true); }, []);
  const setSettings = useCallback(upd => { setSettingsRaw(upd); setHasUnsaved(true); }, []);

  const saveData = () => {
    const json = JSON.stringify({ race, segments, settings }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "alex-data.json"; a.click();
    URL.revokeObjectURL(url);
    setHasUnsaved(false);
  };
  const loadData = (file) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d.race) setRaceRaw(d.race);
        if (d.segments) setSegmentsRaw(d.segments);
        if (d.settings) setSettingsRaw({ ...EMPTY_SETTINGS, ...d.settings });
        setHasUnsaved(false); setOnboarding(false);
      } catch { alert("Fichier JSON invalide"); }
    };
    reader.readAsText(file);
  };

  const navigate = id => { setView(id); setDrawerOpen(false); };
  const hasRace = !!race.gpxPoints?.length;

  const SidebarContent = () => (
    <>
      <div style={{ padding: "24px 20px 16px" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: C.primary }}>Alex</div>
        <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>Trail Running Strategy</div>
      </div>
      <Hr />
      <nav style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAVS.map(n => (
          <div key={n.id} className={`nav-item${view === n.id ? " active" : ""}`} onClick={() => navigate(n.id)}>
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </div>
        ))}
      </nav>
      <Hr />
      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {hasRace && (
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px", fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{settings.raceName || race.name || "Course sans nom"}</div>
            <div style={{ color: "var(--muted-c)", fontSize: 12 }}>
              {race.totalDistance?.toFixed(1)} km · {Math.round(race.totalElevPos)} m D+
            </div>
            <div style={{ color: "var(--muted-c)", fontSize: 12 }}>{segments.length} segments</div>
          </div>
        )}
        <button
          onClick={saveData}
          style={{
            background: hasUnsaved ? C.primary : "var(--surface-2)",
            color: hasUnsaved ? C.white : "var(--text-c)",
            border: "none", borderRadius: 12, padding: "10px 14px", cursor: "pointer",
            fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
          }}>
          💾 Données {hasUnsaved && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.yellowPale, display: "inline-block" }} />}
        </button>
        <label style={{ display: "block" }}>
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border-c)",
            borderRadius: 12, padding: "9px 14px", cursor: "pointer", fontSize: 14,
            fontWeight: 500, textAlign: "center",
          }}>📂 Charger</div>
          <input type="file" accept=".json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) loadData(e.target.files[0]); }} />
        </label>
      </div>
    </>
  );

  return (
    <>
      <style>{G}</style>

      {/* ONBOARDING */}
      {onboarding && (
        <div className="modal-overlay">
          <div className="confirm-box" style={{ maxWidth: 440, textAlign: "left" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: C.primary, marginBottom: 8 }}>Alex 🏔️</div>
            <p style={{ color: "var(--muted-c)", marginBottom: 20, lineHeight: 1.6 }}>
              Ton outil de stratégie trail. Charge un GPX, définis ta stratégie par segment, génère ton récap de course.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Btn onClick={() => { setOnboarding(false); setView("profil"); }}>🚀 Commencer</Btn>
              <label style={{ display: "block" }}>
                <Btn variant="soft" style={{ width: "100%", justifyContent: "center" }} onClick={() => {}}>📂 Charger mes données</Btn>
                <input type="file" accept=".json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) { loadData(e.target.files[0]); setOnboarding(false); } }} />
              </label>
              <Btn variant="ghost" onClick={() => { setOnboarding(false); setView("parametres"); }}>⚙️ Configurer d'abord</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* SIDEBAR DESKTOP */}
        {!isMobile && (
          <div style={{
            width: 240, flexShrink: 0, background: "var(--surface)", borderRight: "1px solid var(--border-c)",
            overflowY: "auto", display: "flex", flexDirection: "column",
          }}>
            <SidebarContent />
          </div>
        )}

        {/* MOBILE TOPBAR */}
        {isMobile && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 100,
            background: "var(--surface)", borderBottom: "1px solid var(--border-c)",
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px",
          }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: C.primary }}>Alex</div>
            <div style={{ fontSize: 13, color: "var(--muted-c)" }}>{NAVS.find(n => n.id === view)?.label}</div>
            <button onClick={() => setDrawerOpen(true)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-c)" }}>☰</button>
          </div>
        )}

        {/* MOBILE DRAWER */}
        {isMobile && drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
            <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: 260,
              background: "var(--surface)", overflowY: "auto",
              animation: "slideInLeft 0.25s ease",
              display: "flex", flexDirection: "column",
            }}>
              <button onClick={() => setDrawerOpen(false)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted-c)" }}>✕</button>
              <SidebarContent />
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <main style={{
          flex: 1, overflowY: "auto",
          padding: isMobile ? "76px 16px 32px" : "44px 52px",
        }}>
          {view === "profil" && <ProfilView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} />}
          {view === "preparation" && <PreparationView race={race} segments={segments} setSegments={setSegments} settings={settings} />}
          {view === "onepager" && <OnePagerView race={race} segments={segments} settings={settings} />}
          {view === "parametres" && <ParamètresView settings={settings} setSettings={setSettings} race={race} setRace={setRace} segments={segments} />}
        </main>
      </div>
    </>
  );
}
