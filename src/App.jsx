import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, XAxis, YAxis,
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
const DEFAULT_EQUIPMENT = [
  { id: 1,  cat: "Équipement",     label: "Gilet de trail",           checked: false, actif: true },
  { id: 2,  cat: "Équipement",     label: "T-shirt course",           checked: false, actif: true },
  { id: 3,  cat: "Équipement",     label: "T-shirt change × 2",       checked: false, actif: false },
  { id: 4,  cat: "Équipement",     label: "Short / cuissard",         checked: false, actif: true },
  { id: 5,  cat: "Équipement",     label: "Chaussettes",              checked: false, actif: true },
  { id: 6,  cat: "Équipement",     label: "Chaussures de trail",      checked: false, actif: true },
  { id: 7,  cat: "Équipement",     label: "Bâtons",                   checked: false, actif: false },
  { id: 8,  cat: "Équipement",     label: "Veste imperméable",        checked: false, actif: true },
  { id: 9,  cat: "Équipement",     label: "Casquette / buff",         checked: false, actif: true },
  { id: 10, cat: "Équipement",     label: "Lampe frontale + piles",   checked: false, actif: true },
  { id: 11, cat: "Équipement",     label: "Couverture de survie",     checked: false, actif: true },
  { id: 12, cat: "Équipement",     label: "Sifflet",                  checked: false, actif: true },
  { id: 13, cat: "Ravitaillement", label: "Pâtes de fruits sucrées",  checked: false, actif: false },
  { id: 14, cat: "Ravitaillement", label: "Pâtes de fruits salées",   checked: false, actif: false },
  { id: 15, cat: "Ravitaillement", label: "Barres de céréales",       checked: false, actif: false },
  { id: 16, cat: "Ravitaillement", label: "Gels énergétiques",        checked: false, actif: false },
  { id: 17, cat: "Ravitaillement", label: "Gourde / flasques",        checked: false, actif: true },
  { id: 18, cat: "Ravitaillement", label: "Sel / électrolytes",       checked: false, actif: false },
  { id: 19, cat: "Divers",         label: "Dossard + épingles",       checked: false, actif: true },
  { id: 20, cat: "Divers",         label: "Téléphone chargé",         checked: false, actif: true },
  { id: 21, cat: "Divers",         label: "Crème anti-frottements",   checked: false, actif: false },
  { id: 22, cat: "Divers",         label: "Brosse à dents / hygiène", checked: false, actif: false },
  { id: 23, cat: "Divers",         label: "Vêtements post-course",    checked: false, actif: false },
];

const EMPTY_SETTINGS = {
  name: "", weight: 70, kcalPerKm: 65, kcalPerKmUphill: 90,
  emergencyName: "", emergencyPhone: "",
  raceName: "", startTime: "07:00", raceDate: "",
  meteoLoading: false, meteoFetched: false, meteoInfo: "",
  tempC: 15, rain: false, wind: false, heat: false, snow: false,
  darkMode: false,
  garminCoeff: 1, garminStats: null, kcalSource: "minetti",
  glucidesTargetGh: null,
  runnerLevel: "intermediaire",
  effortTarget: "normal",
  paceStrategy: 0,
  ravitoTimeMin: 3,
  equipment: DEFAULT_EQUIPMENT,
  produits: [],   // bibliothèque permanente de produits nutritionnels
};

// ─── ALGOS TRAIL ─────────────────────────────────────────────────────────────
const RUNNER_LEVELS = [
  { key: "debutant",      label: "Débutant",      coeff: 0.72, desc: "Premiers trails, objectif finisher" },
  { key: "intermediaire", label: "Intermédiaire", coeff: 0.88, desc: "Quelques courses, chrono réaliste" },
  { key: "confirme",      label: "Confirmé",      coeff: 1.00, desc: "Niveau entraîné, bonne régularité" },
  { key: "expert",        label: "Expert",        coeff: 1.12, desc: "Compétiteur, podium régional" },
];
const TERRAIN_TYPES = [
  { key: "normal",    label: "Normal",         coeff: 1.00, desc: "Chemin balisé, single track roulant" },
  { key: "technique", label: "Technique",      coeff: 0.82, desc: "Cailloux, racines, passages délicats" },
  { key: "trestech",  label: "Très technique", coeff: 0.68, desc: "Éboulis, hors-sentier, passages engagés" },
];
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
  // Supprimer TOUS les namespaces XML — ils cassent querySelectorAll
  // Cas 1: xmlns="url" ou xmlns="" sur n'importe quel élément (togpx, OS Maps...)
  // Cas 2: xmlns:prefix="url" (namespaces préfixés)
  // Cas 3: xsi:schemaLocation et autres attributs xsi:*
  const cleaned = xmlText
    .replace(/ xmlns(:\w+)?="[^"]*"/g, '')  // xmlns="url" et xmlns:prefix="url"
    .replace(/ xmlns=""/g, '')               // xmlns="" (valeur vide sur sous-éléments)
    .replace(/ xsi:\w+(?::\w+)?="[^"]*"/g, ''); // xsi:* attributs

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, "text/xml");

  // ── Nom de la course : <name> ou <n> (variante calculitineraires.fr etc.) ──
  const nameEl = doc.querySelector("trk > name") || doc.querySelector("trk > n")
    || doc.querySelector("name") || doc.querySelector("n");
  const trackName = nameEl?.textContent?.trim() || "";

  // ── Points : fusionner tous les <trkseg> + fallback <wpt> ──────────────────
  const allTrkpts = Array.from(doc.querySelectorAll("trkseg trkpt"));
  const allPts = allTrkpts.length ? allTrkpts : Array.from(doc.querySelectorAll("wpt"));
  if (!allPts.length) throw new Error("Aucun point trouvé dans le fichier GPX");

  const rawPoints = [];
  allPts.forEach(pt => {
    const lat = parseFloat(pt.getAttribute("lat"));
    const lon = parseFloat(pt.getAttribute("lon"));
    if (isNaN(lat) || isNaN(lon)) return;
    const eleEl = pt.querySelector("ele");
    const ele = eleEl ? parseFloat(eleEl.textContent) : null;
    // Filtrer les altitudes aberrantes (> 9000m ou < -500m)
    const eleClean = (ele !== null && !isNaN(ele) && ele > -500 && ele < 9000) ? ele : null;
    rawPoints.push({ lat, lon, ele: eleClean });
  });

  if (rawPoints.length < 2) throw new Error("Pas assez de points valides dans le GPX");

  // ── Interpolation des altitudes manquantes (null) ──────────────────────────
  // Cherche le voisin avant et après avec altitude connue, interpole linéairement
  for (let i = 0; i < rawPoints.length; i++) {
    if (rawPoints[i].ele !== null) continue;
    // Trouver le précédent avec altitude
    let prevIdx = i - 1;
    while (prevIdx >= 0 && rawPoints[prevIdx].ele === null) prevIdx--;
    // Trouver le suivant avec altitude
    let nextIdx = i + 1;
    while (nextIdx < rawPoints.length && rawPoints[nextIdx].ele === null) nextIdx++;

    if (prevIdx >= 0 && nextIdx < rawPoints.length) {
      // Interpolation linéaire
      const ratio = (i - prevIdx) / (nextIdx - prevIdx);
      rawPoints[i].ele = rawPoints[prevIdx].ele + ratio * (rawPoints[nextIdx].ele - rawPoints[prevIdx].ele);
    } else if (prevIdx >= 0) {
      rawPoints[i].ele = rawPoints[prevIdx].ele;
    } else if (nextIdx < rawPoints.length) {
      rawPoints[i].ele = rawPoints[nextIdx].ele;
    } else {
      rawPoints[i].ele = 0;
    }
  }

  // ── Dédoublonnage : supprimer les points strictement identiques consécutifs ──
  const deduped = rawPoints.filter((pt, i) => {
    if (i === 0) return true;
    const prev = rawPoints[i - 1];
    return !(pt.lat === prev.lat && pt.lon === prev.lon);
  });

  // ── Calcul distances cumulées ───────────────────────────────────────────────
  let cumDist = 0;
  const withDist = deduped.map((pt, i) => {
    if (i > 0) {
      const prev = deduped[i - 1];
      const dLat = (pt.lat - prev.lat) * Math.PI / 180;
      const dLon = (pt.lon - prev.lon) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(prev.lat*Math.PI/180)*Math.cos(pt.lat*Math.PI/180)*Math.sin(dLon/2)**2;
      cumDist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    return { ...pt, dist: +cumDist.toFixed(4) };
  });

  // ── Détection GPX sans altitude ─────────────────────────────────────────────
  const hasEle = withDist.some(pt => pt.ele !== null && pt.ele !== 0);
  const eleAllZero = !hasEle;

  // ── Calcul dénivelé ─────────────────────────────────────────────────────────
  // Lissage par moyenne mobile (fenêtre 5) pour réduire le bruit GPS natif
  const SMOOTH = 5;
  const eles = withDist.map(pt => pt.ele ?? 0);
  const smoothedEles = eles.map((_, i) => {
    const half = Math.floor(SMOOTH / 2);
    const start = Math.max(0, i - half);
    const end = Math.min(eles.length - 1, i + half);
    const sl = eles.slice(start, end + 1);
    return sl.reduce((a, b) => a + b, 0) / sl.length;
  });

  let totalElevPos = 0, totalElevNeg = 0;
  if (!eleAllZero) {
    smoothedEles.forEach((ele, i) => {
      if (i === 0) return;
      const dEle = ele - smoothedEles[i-1];
      if (dEle > 0.5) totalElevPos += dEle;
      else if (dEle < -0.5) totalElevNeg += Math.abs(dEle);
    });
  }

  // Appliquer les altitudes lissées aux points
  const points = withDist.map((pt, i) => ({ ...pt, ele: smoothedEles[i] }));

  return { points, totalDistance: cumDist, totalElevPos, totalElevNeg, trackName, needsElevation: eleAllZero };
}

// ── Enrichissement altitude via OpenTopoData (SRTM 90m, mondial) ────────────
async function enrichElevation(points) {
  const BATCH = 200;
  const allEles = [];

  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);

    // API 1 : elevation.racemap.com — CORS activé, conçue pour navigateurs
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('https://elevation.racemap.com/api/elevation/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map(p => [p.lat, p.lon])),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length === batch.length) {
          data.forEach(ele => allEles.push(typeof ele === 'number' ? ele : 0));
          continue;
        }
      }
    } catch {}

    // API 2 : open-elevation.com — fallback
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 12000);
      const body = { locations: batch.map(p => ({ latitude: p.lat, longitude: p.lon })) };
      const res2 = await fetch('https://api.open-elevation.com/api/v1/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller2.signal,
      });
      clearTimeout(timeout2);
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.results?.length === batch.length) {
          data2.results.forEach(r => allEles.push(r.elevation ?? 0));
          continue;
        }
      }
    } catch {}

    // Les deux APIs ont échoué
    throw new Error("APIs d'élévation inaccessibles depuis ce réseau");
  }

  // Lissage par moyenne mobile (fenêtre de 5) pour réduire le bruit SRTM 90m
  // Sans lissage, les micro-variations s'accumulent et gonflent le D+
  const SMOOTH = 5;
  const smoothed = allEles.map((_, i) => {
    const half = Math.floor(SMOOTH / 2);
    const start = Math.max(0, i - half);
    const end = Math.min(allEles.length - 1, i + half);
    const slice = allEles.slice(start, end + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  let totalElevPos = 0, totalElevNeg = 0;
  const enriched = points.map((pt, i) => {
    const ele = smoothed[i] ?? 0;
    if (i > 0) {
      const dEle = ele - (smoothed[i-1] ?? 0);
      if (dEle > 0.5) totalElevPos += dEle;
      else if (dEle < -0.5) totalElevNeg += Math.abs(dEle);
    }
    return { ...pt, ele };
  });

  return { enriched, totalElevPos, totalElevNeg };
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
function suggestSpeed(slopePct, coeff = 1, settings = {}, segIndex = 0, totalSegs = 1, totalDistKm = 0, coveredDistKm = 0) {
  // Vitesse de base selon la pente
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

  // Niveau coureur
  const levelData = RUNNER_LEVELS.find(l => l.key === settings.runnerLevel) || RUNNER_LEVELS[1];
  const levelCoeff = levelData.coeff;

  // Coefficient fatigue progressif
  // Effort cumulé = distance parcourue + D+ cumulé / 100 (le dénivelé épuise plus)
  // On utilise la progression dans la course (0→1)
  const paceStrat = settings.paceStrategy || 0;
  const fatigueIntensity = paceStrat < 0 ? 0.18 : paceStrat > 0 ? 0.04 : 0.10;
  const progress = totalDistKm > 0 ? coveredDistKm / totalDistKm : (segIndex / (totalSegs - 1 || 1));
  // Fatigue nulle au départ, maximale à l'arrivée — courbe progressive
  const fatigueCoeff = 1 - progress * fatigueIntensity;

  return +(base * coeff * levelCoeff * fatigueCoeff
    * (settings.snow ? 0.85 : 1)
    * (settings.tempC <= -10 ? 0.95 : 1)
  ).toFixed(1);
}
function calcSlopeFromGPX(points, startKm, endKm) {
  if (!points.length) return 0;
  const inRange = points.filter(p => p.dist >= startKm && p.dist <= endKm);
  if (inRange.length < 2) return 0;
  const dEle = inRange[inRange.length - 1].ele - inRange[0].ele;
  const dDist = (endKm - startKm) * 1000;
  return dDist === 0 ? 0 : Math.round((dEle / dDist) * 100);
}
function autoSegmentGPX(points, coeff = 1, settings = {}) {
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
  const WALK_UP_THRESHOLD = 7;    // % — calibré sur 4 courses réelles
  const PCT_THRESHOLD     = 0.40; // 40% des points >7% dans la fenêtre → walk
  // Pas de walk_down — descentes toujours courues (pas chassés, cheval…)

  const classify = (sf, ss, dist) => {
    if (sf >= WALK_UP_THRESHOLD) return "walk_up";
    if (ss >= WALK_UP_THRESHOLD && sf > -3) return "walk_up";
    if (sf >= 5 && pctAbove(dist, WALK_UP_THRESHOLD) >= PCT_THRESHOLD) return "walk_up";
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
    }
    if (validated.length > 0 && validated[validated.length-1].regime === fs.regime)
      validated[validated.length-1].end = fs.end;
    else validated.push({ ...fs });
  }

  const effortMult = settings.effortTarget === "perf" ? 1.08 : settings.effortTarget === "comfort" ? 0.88 : 1.0;
  const totalSegs = validated.length || 1;
  // Distance totale pour calcul fatigue
  const totalDistKm = +validated[validated.length - 1]?.end?.toFixed(1) || 0;

  return validated.map((seg, i) => {
    const realSlope = calcSlopeFromGPX(points, seg.start, seg.end);
    const coveredDistKm = seg.start;
    const speed = suggestSpeed(realSlope, coeff, settings, i, totalSegs, totalDistKm, coveredDistKm);
    const finalSpeed = +(speed * effortMult).toFixed(1);
    return {
      id: Date.now()+i,
      startKm: +seg.start.toFixed(1),
      endKm: +seg.end.toFixed(1),
      slopePct: realSlope,
      speedKmh: Math.max(2, finalSpeed),
      terrain: "normal",
      notes: "",
    };
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
    type:     header.findIndex(h => /type.*activit/i.test(h)),
    gap:      header.findIndex(h => /^gap/i.test(h)),
    distance: header.findIndex(h => /^distance$/i.test(h)),
    kcal:     header.findIndex(h => /^calories$/i.test(h)),
    ascent:   header.findIndex(h => /ascension/i.test(h)),
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
    const kcal = idx.kcal >= 0 ? parseFloat((cells[idx.kcal] || "").replace(",",".")) : NaN;
    const ascent = idx.ascent >= 0 ? parseFloat((cells[idx.ascent] || "").replace(",",".")) : NaN;
    rows.push({ gap, dist, kcal: isNaN(kcal) || kcal < 10 ? null : kcal, ascent: isNaN(ascent) ? 0 : ascent });
  }
  if (!rows.length) return null;
  const totalDist = rows.reduce((s,r) => s+r.dist, 0);
  const avgGapKmh = rows.reduce((s,r) => s+r.gap*r.dist, 0) / totalDist;

  // Calcul kcal/km depuis l'historique Garmin (FC-based → fiable)
  let kcalPerKmFlat = null, kcalPerKmUphill = null, kcalActivityCount = 0;
  const kcalRows = rows.filter(r => r.kcal !== null);
  if (kcalRows.length >= 3) {
    kcalActivityCount = kcalRows.length;
    // Régression linéaire : kcal/km = a + b * (D+/km)
    // On isole le coût de base (plat) et le surcoût par m de D+
    const pts = kcalRows.map(r => ({ x: r.ascent / r.dist, y: r.kcal / r.dist }));
    const n = pts.length;
    const sumX  = pts.reduce((s,p) => s+p.x, 0);
    const sumY  = pts.reduce((s,p) => s+p.y, 0);
    const sumXY = pts.reduce((s,p) => s+p.x*p.y, 0);
    const sumX2 = pts.reduce((s,p) => s+p.x*p.x, 0);
    const denom = n*sumX2 - sumX*sumX;
    if (Math.abs(denom) > 0.001) {
      const b = (n*sumXY - sumX*sumY) / denom; // kcal/km par m de D+/km
      const a = (sumY - b*sumX) / n;            // kcal/km plat
      // kcal/km uphill = coût à +10% de pente (100m D+ / km)
      kcalPerKmFlat    = Math.round(Math.max(40, Math.min(120, a)));
      kcalPerKmUphill  = Math.round(Math.max(50, Math.min(180, a + b * 100)));
    } else {
      // Pas assez de variance en D+ : moyenne simple pour le plat
      kcalPerKmFlat = Math.round(sumY / n);
    }
  }

  return {
    count: rows.length, avgGapKmh: +avgGapKmh.toFixed(2),
    coeff: +(avgGapKmh/DEFAULT_FLAT_SPEED).toFixed(3),
    lastDate: new Date().toLocaleDateString("fr-FR"),
    kcalPerKmFlat, kcalPerKmUphill, kcalActivityCount,
  };
}

// ─── NUTRITION ───────────────────────────────────────────────────────────────
function calcNutrition(seg, settings) {
  if (seg.type === "repos") return { kcal: 0, kcalH: 0, glucidesH: 0, lipidesH: 0, proteinesH: 0, eauH: 0, selH: 0, cafeineH: 0, durationH: 0 };
  const { weight = 70, kcalPerKm = 65, kcalPerKmUphill = 90, tempC = 15, rain = false, wind = false, heat = false, snow = false, kcalSource = "minetti", garminStats = null, glucidesTargetGh = null } = settings;
  const distKm = seg.endKm - seg.startKm;
  const durationH = seg.speedKmh > 0 ? distKm / seg.speedKmh : 0;
  let flatRate, uphillRate;
  if (kcalSource === "garmin" && garminStats?.kcalPerKmFlat) {
    flatRate   = garminStats.kcalPerKmFlat;
    uphillRate = garminStats.kcalPerKmUphill ?? garminStats.kcalPerKmFlat;
  } else if (kcalSource === "manual") {
    flatRate   = kcalPerKm;
    uphillRate = kcalPerKmUphill;
  } else {
    flatRate   = Math.round(3.6 * weight * 1000 / 4184);
    const i10  = 0.10;
    const cr10 = 155.4*i10**5 - 30.4*i10**4 - 43.3*i10**3 + 46.3*i10**2 + 19.5*i10 + 3.6;
    uphillRate = Math.round(cr10 * weight * 1000 / 4184);
  }
  const kcalRate = (seg.slopePct || 0) >= 5 ? uphillRate : flatRate;
  const kcal = Math.round(distKm * kcalRate * (weight / 70));
  const kcalH = durationH > 0 ? Math.round(kcal / durationH) : 0;
  const isHot = heat || tempC > 25;
  const isCold = tempC < 0 || snow;
  // Glucides : cible manuelle si définie, sinon 55% des kcal (règle empirique)
  const glucidesH = glucidesTargetGh != null ? Math.round(glucidesTargetGh) : Math.round(kcalH * 0.55 / 4);
  const proteinesH = Math.round(kcalH * 0.10 / 4);
  // Lipides : résidu énergétique après glucides et protéines (1g lipides = 9 kcal)
  const lipidesH = Math.max(0, Math.round((kcalH - glucidesH * 4 - proteinesH * 4) / 9));
  const waterBase = isHot ? 750 : isCold ? 350 : 500;
  const eauH = Math.round(waterBase + (wind ? 100 : 0));
  const selH = Math.round(isHot ? 800 : snow ? 700 : 500);
  const cumDurationH = seg.speedKmh > 0 ? (seg.startKm || 0) / seg.speedKmh : 0;
  const cafeineH = cumDurationH >= 2 ? Math.round(30 + Math.min(seg.slopePct * 2, 40)) : 0;
  return { kcal, kcalH, glucidesH, lipidesH, proteinesH, eauH, selH, cafeineH, durationH };
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
  thead th { font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted-c); background: var(--surface-2); padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--border-c); }
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
    .form-grid { grid-template-columns: repeat(2, 1fr); }
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
    <div style={{ background: "var(--surface)", borderRadius: 14, border: "0.5px solid var(--border-c)", borderTop: `3px solid ${col}`, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.11em", color: "var(--muted-c)" }}>{label}</span>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: col, lineHeight: 1.2, marginTop: 7 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 3 }}>{sub}</div>}
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
    <label onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <div style={{
        width: 40, height: 22, borderRadius: 11, background: checked ? C.primary : "var(--border-c)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16,
          borderRadius: "50%", background: "#fff", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
      <span style={{ fontSize: 13, color: "var(--text-c)" }}>{label}</span>
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

// ─── EXPORT FOND D'ÉCRAN (1080×1920) ─────────────────────────────────────────
function exportRecap(race, segments, settings, profile, passingTimes) {
  const raceName    = settings.raceName || race.name || "Ma Course";
  const raceDate    = settings.raceDate || "";
  const startTime   = settings.startTime || "07:00";
  const segsNormaux = segments.filter(s => s.type !== "ravito" && s.type !== "repos");
  const ravitos     = [...(race.ravitos || [])].sort((a, b) => a.km - b.km);
  const totalSec    = segsNormaux.reduce((s, seg) => s + (seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh * 3600 : 0), 0);
  const ravitoSec   = ravitos.reduce((s, rv) => s + ((rv.dureeMin || settings.ravitoTimeMin || 3) * 60), 0);
  const totalWithRavitos = totalSec + ravitoSec;
  const nutriTotals = segsNormaux.reduce((acc, seg) => {
    const n = calcNutrition(seg, settings);
    const dH = seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh : 0;
    return { kcal: acc.kcal + n.kcal, eau: acc.eau + Math.round(n.eauH * dH), glucides: acc.glucides + Math.round(n.glucidesH * dH), sel: acc.sel + Math.round(n.selH * dH) };
  }, { kcal: 0, eau: 0, glucides: 0, sel: 0 });

  // ─── Profil altimétrique SVG ─────────────────────────────────────────────
  const svgProfile = (() => {
    if (!profile.length) return "<p style=\"color:#888;font-size:12px;\">Profil non disponible</p>";
    const W = 700, H = 100;
    const minE = Math.min(...profile.map(p => p.ele));
    const maxE = Math.max(...profile.map(p => p.ele));
    const maxD = profile[profile.length - 1].dist;
    const px = d => (d / maxD) * W;
    const py = e => H - ((e - minE) / (maxE - minE + 1)) * (H - 10) - 4;
    const pts = profile.map(p => `${px(p.dist).toFixed(1)},${py(p.ele).toFixed(1)}`).join(" ");
    const fill = profile.map(p => `${px(p.dist).toFixed(1)},${py(p.ele).toFixed(1)}`).join(" ")
      + ` ${px(maxD).toFixed(1)},${H} 0,${H}`;

    const ravitoLines = ravitos.map(rv => {
      const x = px(rv.km).toFixed(1);
      return `<line x1="${x}" y1="2" x2="${x}" y2="${H}" stroke="#2D7A4F" stroke-width="1" stroke-dasharray="3,2"/>
              <text x="${(+x + 3).toFixed(1)}" y="12" font-size="9" fill="#2D7A4F" font-family="sans-serif">${rv.name.charAt(0)}</text>`;
    }).join("");

    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;margin:8px 0;">
      <polygon points="${fill}" fill="#9A6B4B22"/>
      <polyline points="${pts}" fill="none" stroke="#9A6B4B" stroke-width="2"/>
      ${ravitoLines}
    </svg>`;
  })();

  // ─── Lignes du tableau segments ──────────────────────────────────────────
  const ravitoSegs = segments.map((seg, i) => ({ seg, i })).filter(({ seg }) => seg.type === "ravito");
  const getTheoSec = ravitoId => {
    const e = ravitoSegs.find(({ seg }) => seg.ravitoId === ravitoId);
    return e ? passingTimes[e.i] : null;
  };
  const fmtH = sec => {
    if (!sec) return "--:--";
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  };

  let segNum = 0;
  const tableRows = segments.map((seg, i) => {
    const t = passingTimes[i];
    if (seg.type === "ravito") {
      const produits = settings.produits || [];
      const plan = (settings.planNutrition || {})[seg.ravitoId] || {};
      const prodLines = Object.entries(plan)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => {
          const p = produits.find(p => String(p.id) === String(id));
          if (!p) return "";
          const kcal = p.par100g ? Math.round(p.kcal * p.poids * q / 100) : Math.round(p.kcal * q);
          return `<span style="margin-right:16px;font-size:11px;color:#555;">${p.nom} <strong>×${q}</strong> — ${kcal} kcal</span>`;
        }).filter(Boolean).join("");
      return `
        <tr style="background:#F1F8F4;">
          <td style="padding:8px;font-size:16px;text-align:center;">🥤</td>
          <td colspan="4" style="padding:8px;font-weight:600;color:#2D7A4F;">${seg.label} · km ${seg.startKm}</td>
          <td style="padding:8px;text-align:right;font-weight:600;color:#2D7A4F;">${fmtH(t)}</td>
        </tr>
        ${prodLines ? `<tr style="background:#F9FBF9;"><td></td><td colspan="5" style="padding:4px 8px 8px 16px;">${prodLines}</td></tr>` : ""}`;
    }
    if (seg.type === "repos") {
      return `<tr style="background:#F5F5F5;">
        <td style="padding:8px;font-size:16px;text-align:center;">💤</td>
        <td colspan="4" style="padding:8px;color:#666;">${seg.label} — ${seg.dureeMin} min</td>
        <td style="padding:8px;text-align:right;color:#666;">${fmtH(t)}</td>
      </tr>`;
    }
    segNum++;
    const dist = (seg.endKm - seg.startKm).toFixed(1);
    const dur = (() => { const s = (seg.endKm - seg.startKm) / seg.speedKmh * 3600; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return `${h > 0 ? h+"h" : ""}${String(m).padStart(2,"0")}min`; })();
    const slopeColor = seg.slopePct > 9 ? "#C0392B" : seg.slopePct < -10 ? "#1565C0" : "#2E7D52";
    const slopeBg = seg.slopePct > 9 ? "#FDEDEC" : seg.slopePct < -10 ? "#E3F2FD" : "#E8F5E9";
    return `<tr style="border-bottom:0.5px solid #E0E0E0;">
      <td style="padding:7px 8px;color:#888;">${segNum}</td>
      <td style="padding:7px 8px;">${seg.startKm} → ${seg.endKm} km</td>
      <td style="padding:7px 8px;">${dist} km</td>
      <td style="padding:7px 8px;"><span style="background:${slopeBg};color:${slopeColor};border-radius:4px;padding:1px 6px;font-size:11px;">${seg.slopePct > 0 ? "+" : ""}${seg.slopePct}%</span>${seg.slopePct > 10 ? ' <span style="font-size:10px;color:#888;">marche</span>' : ""}</td>
      <td style="padding:7px 8px;font-weight:600;">${seg.speedKmh} km/h</td>
      <td style="padding:7px 8px;text-align:right;font-weight:600;color:#7A5230;">${fmtH(t)}</td>
    </tr>`;
  }).join("");

  // ─── Météo ───────────────────────────────────────────────────────────────
  const meteoStr = [
    `${settings.tempC}°C`,
    settings.rain ? "Pluie" : null,
    settings.snow ? "Neige" : null,
    settings.wind ? "Vent fort" : null,
  ].filter(Boolean).join(" · ");

  const objectifLabels = { comfort: "Finisher", normal: "Chrono", perf: "Performance" };

  // ─── HTML ────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${raceName} — Récap Alex</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; color: #1A1A1A; background: #fff; font-size: 13px; }
  .page { max-width: 780px; margin: 0 auto; padding: 32px 40px; }
  h1 { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #3D2B1F; }
  .sub { color: #666; font-size: 12px; margin-top: 4px; }
  .section-label { font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 8px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 20px 0; }
  .kpi { background: #F7F5F2; border-radius: 8px; padding: 10px 12px; text-align: center; }
  .kpi-label { font-size: 10px; color: #888; margin-bottom: 3px; }
  .kpi-val { font-size: 15px; font-weight: 500; }
  .profile-box { border: 0.5px solid #E0E0E0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { font-size: 10px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 0.5px solid #E0E0E0; text-align: left; }
  thead th:last-child { text-align: right; }
  .nutri-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #F7F5F2; border-radius: 8px; padding: 14px 16px; margin: 20px 0; }
  .nutri-item { text-align: center; }
  .nutri-label { font-size: 10px; color: #888; margin-bottom: 2px; }
  .nutri-val { font-size: 16px; font-weight: 500; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-box { background: #F7F5F2; border-radius: 8px; padding: 12px 16px; }
  .footer { border-top: 0.5px solid #E0E0E0; padding-top: 12px; margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
    .page { padding: 20px; }
    @page { margin: 1cm; size: A4; }
  }
</style>
</head><body>
<div class="page">
  <div class="no-print" style="background:#F0EAE0;border-radius:8px;padding:10px 16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:13px;color:#5A3E2B;font-weight:500;">Récap de course — Alex Trail Strategy</span>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#7A5230;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:500;">🖨️ Imprimer / PDF</button>
      <button id="btn-img" onclick="saveImage()" style="background:#fff;color:#7A5230;border:1px solid #7A5230;border-radius:8px;padding:8px 18px;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:500;">🖼️ Enregistrer image</button>
    </div>
  </div>
  <div id="recap-content">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:0.5px solid #E0E0E0;margin-bottom:20px;">
    <div>
      <div class="section-label">Stratégie de course · Alex</div>
      <h1>${raceName}</h1>
      <div class="sub">${raceDate ? new Date(raceDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""} ${raceDate && startTime ? "·" : ""} Départ ${startTime}${race.startAddress ? " · " + race.startAddress : ""}</div>
    </div>
    <div style="text-align:right;flex-shrink:0;margin-left:20px;">
      <div style="font-size:10px;color:#888;margin-bottom:2px;">Arrivée estimée</div>
      <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#7A5230;">${fmtH(passingTimes[passingTimes.length - 1] || 0)}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Distance</div><div class="kpi-val">${race.totalDistance?.toFixed(1) || "?"} km</div></div>
    <div class="kpi"><div class="kpi-label">D+</div><div class="kpi-val" style="color:#B84A3A;">${Math.round(race.totalElevPos || 0)} m</div></div>
    <div class="kpi"><div class="kpi-label">Temps total</div><div class="kpi-val">${fmtTime(totalWithRavitos)}</div></div>
    <div class="kpi"><div class="kpi-label">Segments</div><div class="kpi-val">${segsNormaux.length}</div></div>
    <div class="kpi"><div class="kpi-label">Ravitos</div><div class="kpi-val">${ravitos.length}</div></div>
  </div>

  <div class="profile-box">
    <div class="section-label">Profil altimétrique</div>
    ${svgProfile}
  </div>

  <div class="section-label" style="margin-bottom:10px;">Segments & ravitaillements</div>
  <table style="margin-bottom:20px;">
    <thead><tr>
      <th style="width:32px;">#</th>
      <th>Tronçon</th>
      <th>Dist.</th>
      <th>Pente</th>
      <th>Vitesse</th>
      <th style="text-align:right;">Heure</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="section-label">Bilan nutrition</div>
  <div class="nutri-grid">
    <div class="nutri-item"><div class="nutri-label">Calories</div><div class="nutri-val" style="color:#B84A3A;">${nutriTotals.kcal} kcal</div></div>
    <div class="nutri-item"><div class="nutri-label">Glucides</div><div class="nutri-val" style="color:#8B6914;">${nutriTotals.glucides} g</div></div>
    <div class="nutri-item"><div class="nutri-label">Sodium</div><div class="nutri-val">${nutriTotals.sel} mg</div></div>
    <div class="nutri-item"><div class="nutri-label">Eau estimée</div><div class="nutri-val" style="color:#1565C0;">${(nutriTotals.eau / 1000).toFixed(1)} L</div></div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="section-label">Météo prévue</div>
      <div style="font-size:16px;font-weight:500;margin-top:4px;">${meteoStr || "Non définie"}</div>
    </div>
    <div class="info-box">
      <div class="section-label">Objectif & rythme</div>
      <div style="font-size:15px;font-weight:500;margin-top:4px;">${objectifLabels[settings.effortTarget] || "Chrono"}</div>
      <div style="font-size:11px;color:#666;margin-top:2px;">Niveau ${(settings.runnerLevel || "intermediaire")} · Garmin ×${settings.garminCoeff || 1}</div>
    </div>
  </div>

  </div>

  <div class="footer" style="margin-top:0;">
    <span>Généré par Alex — Trail Running Strategy</span>
    <span>alex-trail.vercel.app</span>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script>
function saveImage() {
  const btn = document.getElementById('btn-img');
  btn.textContent = '⏳ Génération...';
  btn.disabled = true;
  const target = document.getElementById('recap-content');
  html2canvas(target, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  }).then(canvas => {
    const a = document.createElement('a');
    a.download = '${(raceName).replace(/\s+/g, "-").toLowerCase()}-recap.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    btn.textContent = '🖼️ Enregistrer image';
    btn.disabled = false;
  }).catch(() => {
    btn.textContent = '🖼️ Enregistrer image';
    btn.disabled = false;
    alert('Erreur lors de la génération de l\\'image.');
  });
}
</script>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}


// ─── HELPERS HEURES ──────────────────────────────────────────────────────────
function fmtHeure(sec) {
  const total = ((sec % 86400) + 86400) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
function isNight(sec) {
  const h = Math.floor(((sec % 86400) + 86400) % 86400 / 3600);
  return h >= 21 || h < 6;
}
// ─── EXPORT GPX MONTRE ───────────────────────────────────────────────────────
function exportGPXMontre(race, segments, settings, passingTimes) {
  const raceName = settings.raceName || race.name || "Ma Course";
  const points   = race.gpxPoints || [];
  const ravitos  = [...(race.ravitos || [])].sort((a, b) => a.km - b.km);

  const fmtH = sec => {
    if (!sec) return "--:--";
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  };

  // ── Tracé GPS ──────────────────────────────────────────────────────────────
  const trkpts = points.map(p =>
    `    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`
  ).join("\n");

  // ── Waypoints : départ, ravitos (avec détail nutrition), arrivée ───────────
  const wpts = [];

  // Départ
  if (points.length > 0) {
    const p0 = points[0];
    const startHM = settings.startTime || "07:00";
    wpts.push(`<wpt lat="${p0.lat.toFixed(6)}" lon="${p0.lon.toFixed(6)}">
  <name>Départ</name>
  <desc>Départ : ${startHM} — ${raceName}</desc>
  <sym>Flag, Blue</sym>
  <type>user</type>
</wpt>`);
  }

  // Ravitos
  ravitos.forEach(rv => {
    // Trouver le point GPX le plus proche du km du ravito
    const targetKm = rv.km;
    let closest = points[0];
    let minDiff = Infinity;
    for (const p of points) {
      const diff = Math.abs(p.dist - targetKm);
      if (diff < minDiff) { minDiff = diff; closest = p; }
    }

    // Heure de passage
    const ravitoSeg = segments.find(s => s.type === "ravito" && s.ravitoId === rv.id);
    const segIdx = ravitoSeg ? segments.indexOf(ravitoSeg) : -1;
    const passingTime = segIdx >= 0 ? passingTimes[segIdx] : null;
    const heureStr = passingTime ? fmtH(passingTime) : "--:--";
    const duree = rv.dureeMin || settings.ravitoTimeMin || 3;

    // Produits nutrition
    const produits = settings.produits || [];
    const plan = (settings.planNutrition || {})[rv.id] || {};
    const nutrition = Object.entries(plan)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const p = produits.find(p => String(p.id) === String(id));
        return p ? `${p.nom} x${q}` : null;
      }).filter(Boolean).join(", ");

    const desc = [
      `Arrivée : ${heureStr}`,
      `Arrêt : ${duree} min`,
      nutrition ? `Nutrition : ${nutrition}` : null,
      rv.address ? `Lieu : ${rv.address}` : null,
    ].filter(Boolean).join(" | ");

    wpts.push(`<wpt lat="${closest.lat.toFixed(6)}" lon="${closest.lon.toFixed(6)}">
  <name>${rv.name} — km ${rv.km}</name>
  <desc>${desc}</desc>
  <sym>Food</sym>
  <type>user</type>
</wpt>`);
  });

  // Arrivée
  if (points.length > 0) {
    const pEnd = points[points.length - 1];
    const lastTime = passingTimes[passingTimes.length - 1];
    wpts.push(`<wpt lat="${pEnd.lat.toFixed(6)}" lon="${pEnd.lon.toFixed(6)}">
  <name>Arrivée</name>
  <desc>Arrivée estimée : ${fmtH(lastTime)} — ${raceName}</desc>
  <sym>Flag, Green</sym>
  <type>user</type>
</wpt>`);
  }

  // ── GPX final ──────────────────────────────────────────────────────────────
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Alex — Trail Running Strategy"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${raceName}</name>
    <desc>Stratégie exportée depuis Alex — Trail Running Strategy</desc>
  </metadata>
${wpts.join("\n")}
  <trk>
    <name>${raceName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], { type: "application/gpx+xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.download = `${raceName.replace(/\s+/g, "-").toLowerCase()}-strategie.gpx`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

function calcPassingTimes(segments, startTime) {
  const parts = (startTime || "07:00").split(":").map(Number);
  const startSec = parts[0] * 3600 + (parts[1] || 0) * 60;
  const times = [];
  let cum = startSec;
  segments.forEach(seg => {
    if (seg.type === "ravito" || seg.type === "repos") {
      cum += (seg.dureeMin || 0) * 60;
    } else {
      const dist = (seg.endKm || 0) - (seg.startKm || 0);
      cum += seg.speedKmh > 0 ? (dist / seg.speedKmh) * 3600 : 0;
    }
    times.push(cum);
  });
  return { times, startSec };
}

// ─── VUE PROFIL DE COURSE ────────────────────────────────────────────────────
function ProfilView({ race, setRace, segments, setSegments, settings, setSettings, onOpenRepos, isMobile }) {
  const [gpxError, setGpxError]       = useState(null);
  const [gpxStatus, setGpxStatus]     = useState(null);
  const [dragging, setDragging]       = useState(false);
  const [hoveredSeg, setHoveredSeg]   = useState(null);
  const [ravitoModal, setRavitoModal] = useState(false);
  const [ravitoForm, setRavitoForm]   = useState({ km: "", name: "", address: "", notes: "", dureeMin: "" });
  const [editRavitoId, setEditRavitoId] = useState(null);
  const [confirmId, setConfirmId]     = useState(null);
  const [segModal, setSegModal]       = useState(false);
  const [editSegId, setEditSegId]     = useState(null);
  const [computing, setComputing]     = useState(false);
  const emptySegForm = { startKm: "", endKm: "", slopePct: 0, speedKmh: 9.5, terrain: "normal", notes: "" };
  const [segForm, setSegForm]         = useState(emptySegForm);
  const fileRef = useRef();

  const profile = useMemo(() => race.gpxPoints?.length ? buildElevationProfile(race.gpxPoints, 300) : [], [race.gpxPoints]);
  // Même logique que StrategieView — segments normaux + repos séparément, ravitos depuis race.ravitos
  const segsNormaux  = segments.filter(s => s.type !== "ravito" && s.type !== "repos");
  const segsRepos    = segments.filter(s => s.type === "repos");
  const totalTime    = segsNormaux.reduce((s, seg) => s + (seg.speedKmh > 0 ? ((seg.endKm - seg.startKm) / seg.speedKmh) * 3600 : 0), 0);
  const totalReposSec = segsRepos.reduce((s, seg) => s + (seg.dureeMin || 0) * 60, 0);
  const totalRavitoSec = (race.ravitos?.length || 0) * (settings.ravitoTimeMin || 3) * 60;
  const nutriTotals = useMemo(() => segments.reduce((acc, seg) => {
    if (seg.type === "ravito" || seg.type === "repos") return acc;
    const n = calcNutrition(seg, settings);
    const durationH = seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh : 0;
    return { kcal: acc.kcal + n.kcal, eau: acc.eau + Math.round(n.eauH * durationH), glucides: acc.glucides + Math.round(n.glucidesH * durationH), sel: acc.sel + Math.round(n.selH * durationH) };
  }, { kcal: 0, eau: 0, glucides: 0, sel: 0 }), [segments, settings]);

  const highlightData = useMemo(() => {
    if (!profile.length) return profile;
    if (!hoveredSeg) return profile.map(p => ({ ...p, eleHL: null }));
    return profile.map(p => ({
      ...p,
      eleHL: p.dist >= hoveredSeg.startKm && p.dist <= hoveredSeg.endKm ? p.ele : null,
    }));
  }, [hoveredSeg, profile]);

  const handleGPX = (file) => {
    if (!file) return;
    setGpxError(null);
    setGpxStatus(null);

    const reader = new FileReader();
    reader.onload = e => {
      const process = async () => {
        try {
          const parsed = parseGPX(e.target.result);
          let { points, totalDistance, totalElevPos, totalElevNeg, trackName } = parsed;

          if (trackName && !settings.raceName) setSettings(s => ({ ...s, raceName: trackName }));

          if (parsed.needsElevation) {
            setGpxStatus("📡 Altitude absente — récupération en cours...");
            try {
              const result = await enrichElevation(points);
              points = result.enriched;
              totalElevPos = result.totalElevPos;
              totalElevNeg = result.totalElevNeg;
              setGpxStatus("✅ Altitude récupérée (SRTM 90m)");
              setTimeout(() => setGpxStatus(null), 4000);
            } catch (apiErr) {
              setGpxStatus(null);
              setGpxError(`⚠️ GPX sans altitude — récupération impossible (${apiErr.message}). Enrichis ton fichier sur gpx.studio puis recharge-le.`);
            }
          }

          setRace(r => ({ ...r, gpxPoints: points, totalDistance, totalElevPos, totalElevNeg }));
        } catch (err) {
          setGpxError(err.message);
          setGpxStatus(null);
        }
      };
      process();
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
    const dureeMin = ravitoForm.dureeMin !== "" ? Number(ravitoForm.dureeMin) : (settings.ravitoTimeMin || 3);
    if (editRavitoId) {
      setRace(r => ({ ...r, ravitos: r.ravitos.map(rv => rv.id === editRavitoId ? { ...ravitoForm, km, dureeMin, id: editRavitoId } : rv) }));
      setSegments(s => s.map(seg =>
        seg.type === "ravito" && seg.ravitoId === editRavitoId
          ? { ...seg, startKm: km, endKm: km, label: ravitoForm.name, dureeMin }
          : seg
      ).sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
    } else {
      const id = Date.now();
      setRace(r => ({ ...r, ravitos: [...(r.ravitos||[]), { ...ravitoForm, km, dureeMin, id }] }));
      setSegments(s => [...s, {
        id: id + 1, type: "ravito", ravitoId: id,
        label: ravitoForm.name, startKm: km, endKm: km,
        dureeMin,
        speedKmh: 0, slopePct: 0, terrain: "normal", notes: "",
      }].sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
    }
    setRavitoModal(false); setRavitoForm({ km: "", name: "", address: "", notes: "", dureeMin: "" }); setEditRavitoId(null);
  };
  const openEditRavito = rv => { setEditRavitoId(rv.id); setRavitoForm({ km: rv.km, name: rv.name, address: rv.address || "", notes: rv.notes || "", dureeMin: rv.dureeMin || "" }); setRavitoModal(true); };
  const deleteRavito = id => {
    setRace(r => ({ ...r, ravitos: (r.ravitos||[]).filter(rv => rv.id !== id) }));
    setSegments(s => s.filter(seg => !(seg.type === "ravito" && seg.ravitoId === id)));
    setConfirmId(null);
  };

  const updSeg = (key, val) => {
    setSegForm(f => {
      const nf = { ...f, [key]: val };
      if (key === "startKm" || key === "endKm") {
        const slope = race.gpxPoints?.length ? calcSlopeFromGPX(race.gpxPoints, parseFloat(nf.startKm)||0, parseFloat(nf.endKm)||0) : nf.slopePct;
        nf.slopePct = slope; nf.speedKmh = suggestSpeed(slope, settings.garminCoeff, settings);
      }
      if (key === "slopePct") nf.speedKmh = suggestSpeed(val, settings.garminCoeff, settings);
      return nf;
    });
  };
  const openNewSeg  = ()  => { setEditSegId(null);   setSegForm(emptySegForm); setSegModal(true); };
  const openEditSeg = seg => { setEditSegId(seg.id); setSegForm(seg);          setSegModal(true); };
  const saveSeg = () => {
    const seg = { ...segForm, startKm: parseFloat(segForm.startKm)||0, endKm: parseFloat(segForm.endKm)||0 };
    if (seg.endKm <= seg.startKm) return;
    if (editSegId) setSegments(s => [...s.map(x => x.id === editSegId ? { ...seg, id: editSegId } : x)].sort((a,b) => a.startKm - b.startKm));
    else           setSegments(s => [...s, { ...seg, id: Date.now() }].sort((a,b) => a.startKm - b.startKm));
    setSegModal(false);
  };
  const deleteSeg = id => { setSegments(s => s.filter(x => x.id !== id)); setConfirmId(null); };
  const autoSegment = () => {
    if (!race.gpxPoints?.length) return;
    setComputing(true);
    setTimeout(() => {
      const newSegs = autoSegmentGPX(race.gpxPoints, settings.garminCoeff, settings);
      // Préserver ravitos et repos existants, remplacer uniquement les segments normaux
      const preserved = segments.filter(s => s.type === "ravito" || s.type === "repos");
      setSegments([...newSegs, ...preserved].sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
      setComputing(false);
    }, 50);
  };

  const minEle = profile.length ? Math.min(...profile.map(p => p.ele)) - 20 : 0;

  return (
    <div className="anim">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <PageTitle sub={race.gpxPoints?.length ? `${race.totalDistance?.toFixed(1)} km chargés` : "Importe ton tracé GPX pour commencer"}>
          {settings.raceName || race.name || "Profil de course"}
        </PageTitle>
      </div>

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
          {gpxStatus && <p style={{ color: gpxStatus.startsWith("✅") ? C.green : C.primary, marginTop: 12, fontSize: 13 }}>{gpxStatus}</p>}
          <input ref={fileRef} type="file" accept=".gpx" style={{ display: "none" }} onChange={e => handleGPX(e.target.files[0])} />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(auto-fit, minmax(140px, 1fr))", gap: isMobile ? 8 : 14, marginBottom: 16 }}>
            <KPI label="Distance" value={`${race.totalDistance?.toFixed(1)} km`} icon="📏" />
            <KPI label="D+" value={`${Math.round(race.totalElevPos)} m`} color={C.red} icon="⛰️" />
            <KPI label="D−" value={`${Math.round(race.totalElevNeg)} m`} color={C.blue} icon="🏔️" />
            <KPI label="Segments" value={segments.filter(s => s.type !== "ravito" && s.type !== "repos").length} icon="✂️" />
            <KPI label="Temps estimé" value={fmtTime(totalTime + totalRavitoSec + totalReposSec)} color={C.secondary} icon="⏱️" sub="ravitos inclus" />
          </div>
          {gpxStatus && (
            <div style={{ padding: "8px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13, fontWeight: 500,
              background: gpxStatus.startsWith("✅") ? C.green + "15" : C.primary + "12",
              color: gpxStatus.startsWith("✅") ? C.green : C.primaryDeep,
            }}>
              {gpxStatus}
            </div>
          )}
          {gpxError && (
            <div style={{ padding: "8px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13, background: C.red + "12", color: C.red }}>
              {gpxError}
            </div>
          )}

          {/* Graphe sticky */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--surface)", paddingBottom: 6, marginBottom: 6 }}>
            <Card noPad>
              <div style={{ padding: "14px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 600 }}>Profil altimétrique</div>
                {hoveredSeg && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.yellow }}>
                    S{segments.indexOf(hoveredSeg)+1} — {hoveredSeg.startKm}→{hoveredSeg.endKm} km · {hoveredSeg.slopePct > 0 ? "+" : ""}{hoveredSeg.slopePct}%
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={highlightData} margin={{ top: 10, right: 20, bottom: 10, left: 40 }}>
                  <defs>
                    <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.primary} stopOpacity={hoveredSeg ? 0.12 : 0.35} />
                      <stop offset="95%" stopColor={C.primary} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="eleHover" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.yellow} stopOpacity={0.72} />
                      <stop offset="100%" stopColor={C.yellow} stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dist" type="number" domain={profile.length ? [0, profile[profile.length-1].dist] : ["auto","auto"]} tickFormatter={v => `${v.toFixed(0)}km`} tick={{ fontSize: 11, fill: C.muted }} />
                  <YAxis domain={[minEle, "auto"]} tick={{ fontSize: 11, fill: C.muted }} />
                  <RTooltip content={<CustomTooltip />} formatter={(v, n) => [n === "ele" ? `${v} m` : `${v} km`, n === "ele" ? "Altitude" : "Dist"]} />
                  {(race.ravitos||[]).map(rv => (
                    <ReferenceLine key={rv.id} x={rv.km} stroke={C.green} strokeWidth={1.5}
                      label={({ viewBox }) => {
                        const { x, y } = viewBox;
                        const words = rv.name.split(" ");
                        const lines = [];
                        let line = "";
                        words.forEach(w => {
                          if ((line + w).length > 12) { lines.push(line.trim()); line = w + " "; }
                          else line += w + " ";
                        });
                        if (line.trim()) lines.push(line.trim());
                        return (
                          <g>
                            {lines.map((l, i) => (
                              <text key={i} x={x + 4} y={y + 14 + i * 13}
                                fontSize={10} fill={C.green} fontWeight={600}
                                style={{ pointerEvents: "none" }}>{l}</text>
                            ))}
                          </g>
                        );
                      }}
                    />
                  ))}
                  {/* Surbrillance segment — remplissage dégradé plein, sans pointillés */}
                  <Area type="monotone" dataKey="ele" stroke={C.primary}
                    strokeWidth={hoveredSeg ? 1.5 : 2.5} strokeOpacity={hoveredSeg ? 0.3 : 1}
                    fill="url(#eleGrad)" dot={false} name="Altitude" />
                  <Area type="monotone" dataKey="eleHL"
                    stroke={C.yellow} strokeWidth={2.5} fill="url(#eleHover)"
                    dot={false} connectNulls={false} name="Segment" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Résumé de course — bloc orangé si segments, bandeau discret sinon */}
          {segments.filter(s => s.type !== "ravito" && s.type !== "repos").length > 0 ? (
            <div style={{
              background: "#A04010", borderRadius: 14, padding: "18px 24px",
              marginBottom: 20, display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#F5C080", marginBottom: 4 }}>
                  Résumé de course
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#FDF5EE", marginBottom: 2 }}>
                  {settings.raceName || race.name || "Course"}
                </div>
                <div style={{ fontSize: 11, color: "#D08860" }}>
                  Départ {settings.startTime || "07:00"} · {settings.tempC}°C
                  {settings.rain ? " · Pluie" : ""}{settings.snow ? " · Neige" : ""}{settings.wind ? " · Vent" : ""}{settings.heat ? " · Chaleur" : ""}
                  
                </div>
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {[
                  { label: "Temps total", val: fmtTime(totalTime + totalRavitoSec + totalReposSec) },
                  { label: "Segments", val: segments.filter(s => s.type !== "ravito" && s.type !== "repos").length },
                  { label: "Ravitos", val: race.ravitos?.length || 0 },
                  { label: "Calories", val: `${nutriTotals.kcal}`, accent: "#F5C080" },
                  { label: "Eau", val: `${(nutriTotals.eau/1000).toFixed(1)} L`, accent: "#90C4E8" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: s.accent || "#FDF5EE" }}>{s.val}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "#D08860", marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
              padding: "9px 16px", marginBottom: 20,
              background: "var(--surface-2)", borderRadius: 10,
              border: "1px solid var(--border-c)", fontSize: 13, color: "var(--muted-c)",
            }}>
              <span style={{ fontWeight: 600, color: "var(--text-c)" }}>Course</span>
              <span>Départ {settings.startTime || "07:00"}</span>
              <span>{settings.tempC}°C</span>
              {settings.rain && <span>Pluie</span>}
              {settings.snow && <span>Neige</span>}
              {settings.wind && <span>Vent</span>}
              {settings.heat && <span>Chaleur</span>}
              <span style={{ marginLeft: "auto", fontSize: 12, color: C.primary }}>Modifier dans Stratégie →</span>
            </div>
          )}

          {/* ── BLOCS CONFIGURATION COURSE ── */}
          {(() => {
            const updS = (k, v) => setSettings(s => ({ ...s, [k]: v }));

            const fetchMeteo = async () => {
              const pt = race.gpxPoints?.[0];
              if (!pt) { alert("Charge d'abord un fichier GPX pour obtenir la météo automatique."); return; }

              // Vérifier la distance en jours
              if (settings.raceDate) {
                const daysAway = Math.round((new Date(settings.raceDate) - new Date()) / 86400000);
                if (daysAway > 14) {
                  alert(`Ta course est dans ${daysAway} jours.\n\nLes prévisions météo ne sont pas disponibles au-delà de 14 jours. Reviens à J-14 pour obtenir une météo indicative, ou à J-7 pour une météo fiable.`);
                  return;
                }
              }

              updS("meteoLoading", true);
              try {
                // Calcul de la fenêtre horaire : date de course + heure de départ + durée estimée
                const dateStr = settings.raceDate || new Date().toISOString().slice(0, 10);
                const [hh, mm] = (settings.startTime || "07:00").split(":").map(Number);
                const startDate = new Date(`${dateStr}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`);
                // Durée estimée en heures depuis les segments
                const totalSecsEst = segments.filter(s => s.type !== "ravito" && s.type !== "repos")
                  .reduce((acc, seg) => acc + (seg.endKm - seg.startKm) / seg.speedKmh * 3600, 0);
                const durationH = Math.max(2, Math.ceil(totalSecsEst / 3600) + 1);

                const url = `https://api.open-meteo.com/v1/forecast?latitude=${pt.lat.toFixed(4)}&longitude=${pt.lon.toFixed(4)}&hourly=temperature_2m,precipitation,windspeed_10m,snowfall&timezone=auto&forecast_days=7`;
                const res = await fetch(url);
                if (!res.ok) throw new Error("API indisponible");
                const data = await res.json();

                // Trouver l'index de l'heure de départ dans le tableau hourly
                const times = data.hourly.time;
                const startIso = startDate.toISOString().slice(0, 13); // "2026-06-07T06"
                let startIdx = times.findIndex(t => t.startsWith(startIso));
                if (startIdx === -1) startIdx = 0;
                const endIdx = Math.min(startIdx + durationH, times.length);

                // Moyenner sur la durée de course
                const slice = (arr) => arr.slice(startIdx, endIdx);
                const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

                const temps = slice(data.hourly.temperature_2m);
                const precips = slice(data.hourly.precipitation);
                const winds = slice(data.hourly.windspeed_10m);
                const snows = slice(data.hourly.snowfall);

                const avgTemp = Math.round(avg(temps));
                const totalPrecip = precips.reduce((a, b) => a + b, 0);
                const totalSnow = snows.reduce((a, b) => a + b, 0);
                const maxWind = Math.max(...winds);
                const hasRain = totalPrecip > 1;
                const hasSnow = totalSnow > 0.5;
                const hasWind = maxWind > 30;

                updS("tempC", avgTemp);
                updS("rain", hasRain && !hasSnow);
                updS("snow", hasSnow);
                updS("wind", hasWind);
                updS("meteoLoading", false);
                updS("meteoFetched", true);
                updS("meteoInfo", `${dateStr} · ${avgTemp}°C moy · précip ${totalPrecip.toFixed(1)}mm · vent max ${Math.round(maxWind)} km/h`);
              } catch (e) {
                updS("meteoLoading", false);
                alert("Impossible de récupérer la météo. Vérifie ta connexion et réessaie.");
              }
            };
            const EFFORT_OPTIONS_P = [
              { key: "comfort", label: "Finisher",   desc: "Terminer sans se cramer — vitesses -12%", color: C.green },
              { key: "normal",  label: "Chrono",     desc: "Objectif temps réaliste — vitesses normales", color: C.primary },
              { key: "perf",    label: "Performance", desc: "Repousser les limites — vitesses +8%", color: C.red },
            ];
            const PACE_LABELS_P = ["Très positif", "Positif", "Régulier", "Négatif", "Très négatif"];
            const paceIdx_P = (settings.paceStrategy || 0) + 2;
            const ravitoCount_P = race.ravitos?.length || 0;
            const totalRavitoSec_P = ravitoCount_P * (settings.ravitoTimeMin || 3) * 60;
            return (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
                {/* Course */}
                <Card>
                  <div style={{ fontWeight: 600, marginBottom: 14 }}>Course</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Field label="Nom de la course">
                      <input value={settings.raceName || race.name || ""} onChange={e => updS("raceName", e.target.value)} placeholder="Ex : UTMB, TDS..." />
                    </Field>
                    <Field label="Date de la course">
                      <input type="date" value={settings.raceDate || ""} onChange={e => updS("raceDate", e.target.value)} />
                    </Field>
                    <Field label="Heure de départ">
                      <input type="time" value={settings.startTime || "07:00"} onChange={e => updS("startTime", e.target.value)} />
                    </Field>
                    <Field label="Adresse de départ">
                      <input value={race.startAddress || ""} onChange={e => setRace(r => ({ ...r, startAddress: e.target.value }))} placeholder="Ex : Place du village, 73210 Bourg-Saint-Maurice" />
                    </Field>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Field label="Adresse d'arrivée">
                        <input value={race.endAddress || ""} onChange={e => setRace(r => ({ ...r, endAddress: e.target.value }))} placeholder="Idem si boucle" disabled={race.sameAddress} style={{ opacity: race.sameAddress ? 0.5 : 1 }} />
                      </Field>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--muted-c)" }}>
                        <input type="checkbox" checked={!!race.sameAddress} onChange={e => setRace(r => ({ ...r, sameAddress: e.target.checked, endAddress: e.target.checked ? r.startAddress : r.endAddress }))} />
                        Même adresse que le départ (boucle)
                      </label>
                    </div>
                  </div>
                </Card>

                {/* Météo */}
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontWeight: 600 }}>Météo</div>
                    <button onClick={fetchMeteo} disabled={settings.meteoLoading} style={{
                      background: C.primaryPale, border: `1px solid ${C.primary}50`,
                      color: C.primaryDeep, borderRadius: 10, padding: "5px 12px",
                      fontSize: 12, fontWeight: 700, cursor: settings.meteoLoading ? "wait" : "pointer",
                      fontFamily: "'DM Sans', sans-serif", opacity: settings.meteoLoading ? 0.7 : 1,
                    }}>
                      {settings.meteoLoading ? "⏳ Chargement..." : "⛅ Météo auto"}
                    </button>
                  </div>
                  {settings.meteoFetched && settings.meteoInfo && (() => {
                    const daysAway = settings.raceDate
                      ? Math.round((new Date(settings.raceDate) - new Date()) / 86400000)
                      : null;
                    const isUnreliable = daysAway !== null && daysAway > 7;
                    return (
                      <>
                        <div style={{ fontSize: 11, color: isUnreliable ? C.yellow : C.green, marginBottom: 8, padding: "6px 10px", background: (isUnreliable ? C.yellow : C.green) + "12", borderRadius: 8 }}>
                          {isUnreliable ? "⚠️" : "✓"} {settings.meteoInfo}
                        </div>
                        {isUnreliable && (
                          <div style={{ fontSize: 11, color: C.yellow, marginBottom: 12, padding: "6px 10px", background: C.yellow + "12", borderRadius: 8, lineHeight: 1.5 }}>
                            Ta course est dans <strong>{daysAway} jours</strong>. Les prévisions entre J-7 et J-14 sont indicatives — reviens à J-7 pour une météo fiable.
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {!settings.meteoFetched && (() => {
                    const daysAway = settings.raceDate
                      ? Math.round((new Date(settings.raceDate) - new Date()) / 86400000)
                      : null;
                    const zone = daysAway === null ? "nodate"
                      : daysAway > 14 ? "tooFar"
                      : daysAway > 7  ? "indicative"
                      : "reliable";
                    return (
                      <div style={{ fontSize: 12, color: "var(--muted-c)", marginBottom: 12, lineHeight: 1.6 }}>
                        {zone === "nodate" && `Configure la date et l'heure de départ, puis clique sur "Météo auto" pour récupérer les prévisions sur ton parcours.`}
                        {zone === "tooFar" && (
                          <span style={{ color: C.red }}>
                            ⛔ Ta course est dans <strong>{daysAway} jours</strong> — la météo auto n'est pas disponible au-delà de J-14. Reviens plus proche de la date.
                          </span>
                        )}
                        {zone === "indicative" && (
                          <>
                            Clique sur "Météo auto" pour obtenir des prévisions indicatives.
                            <span style={{ display: "block", marginTop: 6, color: C.yellow, fontSize: 11 }}>
                              ⚠️ Ta course est dans <strong>{daysAway} jours</strong> — les prévisions seront fiables à partir de J-7.
                            </span>
                          </>
                        )}
                        {zone === "reliable" && `Clique sur "Météo auto" pour récupérer les prévisions sur ton parcours.`}
                      </div>
                    );
                  })()}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <SliderField label="Température" value={settings.tempC} min={-30} max={45} unit="°C" onChange={v => updS("tempC", v)} />
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <Toggle label="🌧️ Pluie" checked={settings.rain} onChange={v => updS("rain", v)} />
                      <Toggle label="❄️ Neige" checked={settings.snow} onChange={v => updS("snow", v)} />
                      <Toggle label="💨 Vent fort" checked={settings.wind} onChange={v => updS("wind", v)} />
                    </div>
                  </div>
                </Card>

                {/* Objectif */}
                <Card>
                  <div style={{ fontWeight: 600, marginBottom: 14 }}>Objectif</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {EFFORT_OPTIONS_P.map(opt => (
                      <div key={opt.key} onClick={() => updS("effortTarget", opt.key)} style={{
                        padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                        border: `2px solid ${settings.effortTarget === opt.key ? opt.color : "var(--border-c)"}`,
                        background: settings.effortTarget === opt.key ? opt.color + "18" : "var(--surface-2)",
                        transition: "all 0.15s",
                      }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: settings.effortTarget === opt.key ? opt.color : "var(--text-c)" }}>{opt.label}</div>
                        <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 3 }}>{opt.desc}</div>
                      </div>
                    ))}
                  </div>
                </Card>
                {/* Gestion effort */}
                <Card>
                  <div style={{ fontWeight: 600, marginBottom: 14 }}>Gestion de l'effort</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Répartition du rythme</span>
                        <span style={{ fontSize: 12, color: C.primary, fontWeight: 600 }}>{PACE_LABELS_P[paceIdx_P]}</span>
                      </div>
                      <input type="range" min={-2} max={2} step={1} value={settings.paceStrategy || 0} onChange={e => updS("paceStrategy", Number(e.target.value))} style={{ width: "100%" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted-c)", marginTop: 4 }}>
                        <span>Partir vite</span><span>Partir lentement</span>
                      </div>
                      <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 9, fontSize: 12, color: "var(--muted-c)", lineHeight: 1.5 }}>
                        {(settings.paceStrategy || 0) < 0 && "Vitesses plus élevées au départ, tu ralentis progressivement."}
                        {(settings.paceStrategy || 0) === 0 && "Allure régulière tout au long de la course."}
                        {(settings.paceStrategy || 0) > 0 && "Tu pars conservateur et tu accélères sur la fin — split négatif."}
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Temps aux ravitos</span>
                        <span style={{ fontSize: 12, color: C.primary, fontWeight: 600 }}>{settings.ravitoTimeMin || 3} min</span>
                      </div>
                      <input type="range" min={1} max={20} step={1} value={settings.ravitoTimeMin || 3} onChange={e => {
                        const val = Number(e.target.value);
                        updS("ravitoTimeMin", val);
                        setSegments(s => s.map(seg =>
                          seg.type === "ravito" && !(race.ravitos||[]).find(rv => rv.id === seg.ravitoId && rv.dureeMin)
                            ? { ...seg, dureeMin: val } : seg
                        ));
                      }} style={{ width: "100%" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted-c)", marginTop: 4 }}>
                        <span>1 min</span><span>20 min</span>
                      </div>
                      {ravitoCount_P > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted-c)" }}>
                          {ravitoCount_P} ravito{ravitoCount_P > 1 ? "s" : ""} × {settings.ravitoTimeMin || 3} min = <strong style={{ color: "var(--text-c)" }}>{fmtTime(totalRavitoSec_P)}</strong> ajoutées
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })()}

          {/* ── PROFIL COUREUR + GARMIN ── */}
          {(() => {
            const updS = (k, v) => setSettings(s => ({ ...s, [k]: v }));
            const handleGarmin2 = e => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => {
                const result = parseGarminCSV(ev.target.result);
                if (result) {
                  updS("garminCoeff", result.coeff);
                  updS("garminStats", result);
                  if (result.kcalPerKmFlat) updS("kcalSource", "garmin");
                }
                else alert("Fichier CSV Garmin non reconnu. Vérifie le format Activities.csv.");
              };
              reader.readAsText(file);
            };
            return (
              <Card style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 600, marginBottom: 16, borderBottom: "1px solid var(--border-c)", paddingBottom: 12 }}>
                  Profil du coureur & algo
                  <span style={{ fontSize: 12, color: "var(--muted-c)", fontWeight: 400, marginLeft: 8 }}>Influence directement les vitesses calculées</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Niveau coureur — 4 boutons sur une ligne */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Niveau coureur</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                      {RUNNER_LEVELS.map(lvl => {
                        const isActive = (settings.runnerLevel || "intermediaire") === lvl.key;
                        return (
                          <div key={lvl.key} onClick={() => updS("runnerLevel", lvl.key)} style={{
                            padding: isMobile ? "8px 6px" : "10px 12px", borderRadius: 10, cursor: "pointer",
                            border: `2px solid ${isActive ? C.primary : "var(--border-c)"}`,
                            background: isActive ? C.primaryPale : "var(--surface-2)",
                            transition: "all 0.15s", textAlign: "center",
                          }}>
                            <div style={{ fontWeight: 600, fontSize: isMobile ? 12 : 13, color: isActive ? C.primaryDeep : "var(--text-c)" }}>{lvl.label}</div>
                            {!isMobile && <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 2 }}>{lvl.desc}</div>}
                          </div>
                        );
                      })}
                    </div>
                    {(() => {
                      const lvl = RUNNER_LEVELS.find(l => l.key === (settings.runnerLevel || "intermediaire"));
                      return <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-c)" }}>
                        {isMobile && <span style={{ marginRight: 6 }}>{lvl?.desc} — </span>}
                        Coefficient : <strong style={{ color: "var(--text-c)" }}>×{lvl?.coeff}</strong>
                      </div>;
                    })()}
                  </div>
                  {/* Calibration Garmin — pleine largeur en dessous */}
                  <div style={{ borderTop: "1px solid var(--border-c)", paddingTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Calibration Garmin</div>
                    <p style={{ color: "var(--muted-c)", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                      Importe ton Activities.csv depuis Garmin Connect pour calibrer les vitesses à ton niveau réel.
                    </p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                      <Btn variant="soft" size="sm" onClick={() => document.getElementById("garmin-input-profil").click()}>
                        Charger Activities.csv
                      </Btn>
                      <input id="garmin-input-profil" type="file" accept=".csv" style={{ display: "none" }} onChange={handleGarmin2} />
                      <span style={{ color: "var(--muted-c)", fontSize: 12 }}>
                        Coeff. : <strong>{settings.garminCoeff}</strong>
                        {settings.garminStats && ` (${settings.garminStats.count} sorties)`}
                      </span>
                    </div>
                    {settings.garminStats && (
                      <div style={{ padding: "8px 12px", background: "var(--surface-2)", borderRadius: 9, fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span>{settings.garminStats.count} activités</span>
                        <span>GAP moy. {settings.garminStats.avgGapKmh} km/h</span>
                        <span style={{ color: C.primary, fontWeight: 600 }}>×{settings.garminStats.coeff}</span>
                      </div>
                    )}
                    {settings.garminCoeff !== 1 && (
                      <Btn variant="ghost" size="sm" style={{ marginTop: 8 }} onClick={() => { updS("garminCoeff", 1); updS("garminStats", null); updS("kcalSource", "minetti"); }}>
                        Réinitialiser (coeff = 1)
                      </Btn>
                    )}
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* Ravitos + Segments */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "260px 1fr", gap: 20, marginBottom: 24, alignItems: "start" }}>
            {/* Ravitos */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontWeight: 600 }}>Ravitaillements</div>
                <Btn size="sm" onClick={() => { setEditRavitoId(null); setRavitoForm({ km: "", name: "", address: "", notes: "", dureeMin: "" }); setRavitoModal(true); }}>+ Ravito</Btn>
              </div>
              {!(race.ravitos?.length) ? (
                <p style={{ color: "var(--muted-c)", fontSize: 13 }}>Aucun ravitaillement défini</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...(race.ravitos||[])].sort((a,b) => a.km - b.km).map(rv => (
                    <div key={rv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "7px 10px", background: "var(--surface-2)", borderRadius: 9, gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, wordBreak: "break-word", lineHeight: 1.3 }}>{rv.name}</div>
                        <div style={{ color: "var(--muted-c)", fontSize: 12, marginTop: 2 }}>{rv.km} km</div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <Btn size="sm" variant="ghost" onClick={() => openEditRavito(rv)}>✏️</Btn>
                        <Btn size="sm" variant="danger" onClick={() => setConfirmId("rv-" + rv.id)}>✕</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Segments */}
            <Card noPad>
              <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>Segments</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {race.gpxPoints?.length > 0 && (
                    <Btn size="sm" variant="sage" onClick={autoSegment} disabled={computing}>
                      {computing ? "Calcul…" : "Découpage auto"}
                    </Btn>
                  )}
                  <Btn size="sm" variant="ghost" onClick={onOpenRepos}>💤 Repos</Btn>
                  <Btn size="sm" onClick={openNewSeg}>+ Segment</Btn>
                </div>
              </div>
              {!segments.length ? (
                <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted-c)", fontSize: 13 }}>
                  Aucun segment — utilise le découpage auto ou ajoute-en un manuellement.
                </div>
              ) : (
                <div className="tbl-wrap" style={{ maxHeight: 520, overflowY: "auto" }}>
                  <table>
                    <thead><tr>
                      <th>#</th><th>Début</th><th>Fin</th><th>Pente moy.</th><th>Vitesse</th><th>Allure</th><th>Durée</th><th></th>
                    </tr></thead>
                    <tbody>{(() => {
                      let segNum = 0;
                      return segments.map((seg, i) => {
                        // ── Ravito ──
                        if (seg.type === "ravito") {
                          return (
                            <tr key={seg.id} style={{ background: C.green + "10", cursor: "default" }}
                              onMouseEnter={() => setHoveredSeg(seg)} onMouseLeave={() => setHoveredSeg(null)}>
                              <td style={{ fontSize: 16 }}>🥤</td>
                              <td style={{ fontWeight: 600, color: C.green }} colSpan={3}>{seg.label} — km {seg.startKm}</td>
                              <td colSpan={2} style={{ color: "var(--muted-c)", fontSize: 12 }}>{seg.dureeMin} min</td>
                              <td></td>
                              <td onClick={e => e.stopPropagation()}>
                                <Btn size="sm" variant="danger" onClick={() => setConfirmId("seg-" + seg.id)}>✕</Btn>
                              </td>
                            </tr>
                          );
                        }
                        // ── Repos ──
                        if (seg.type === "repos") {
                          return (
                            <tr key={seg.id} style={{ background: "var(--surface-2)", cursor: "default" }}
                              onMouseEnter={() => setHoveredSeg(seg)} onMouseLeave={() => setHoveredSeg(null)}>
                              <td style={{ fontSize: 16 }}>💤</td>
                              <td style={{ fontWeight: 600, color: C.blue }} colSpan={3}>{seg.label} — km {seg.startKm}</td>
                              <td colSpan={2} style={{ color: "var(--muted-c)", fontSize: 12 }}>{seg.dureeMin} min</td>
                              <td></td>
                              <td onClick={e => e.stopPropagation()}>
                                <Btn size="sm" variant="danger" onClick={() => setConfirmId("seg-" + seg.id)}>✕</Btn>
                              </td>
                            </tr>
                          );
                        }
                        // ── Segment normal ──
                        segNum++;
                        const dur = fmtTime(((seg.endKm - seg.startKm) / seg.speedKmh) * 3600);
                        const isH = hoveredSeg?.id === seg.id;
                        return (
                          <tr key={seg.id}
                            onMouseEnter={() => setHoveredSeg(seg)}
                            onMouseLeave={() => setHoveredSeg(null)}
                            onClick={() => openEditSeg(seg)}
                            style={{ background: isH ? C.yellowPale : undefined, cursor: "pointer" }}>
                            <td style={{ color: isH ? C.yellow : "var(--muted-c)", fontWeight: isH ? 700 : 400 }}>{segNum}</td>
                            <td style={{ fontWeight: isH ? 700 : 400 }}>{seg.startKm} km</td>
                            <td style={{ fontWeight: isH ? 700 : 400 }}>{seg.endKm} km</td>
                            <td>
                              <span className={`badge ${seg.slopePct > 9 ? "badge-red" : seg.slopePct < 0 ? "badge-blue" : "badge-sage"}`}>
                                {seg.slopePct > 0 ? "+" : ""}{seg.slopePct}%
                              </span>
                              {seg.slopePct > 15 && <span style={{ marginLeft: 5, fontSize: 10, color: C.red }}>bâtons</span>}
                              {seg.slopePct > 8 && seg.slopePct <= 15 && <span style={{ marginLeft: 5, fontSize: 10, color: C.yellow }}>marche</span>}
                            </td>
                            <td style={{ fontWeight: isH ? 700 : 600 }}>{seg.speedKmh} km/h</td>
                            <td style={{ fontFamily: "'Playfair Display', serif", fontWeight: isH ? 700 : 400 }}>{fmtPace(seg.speedKmh)}/km</td>
                            <td style={{ fontWeight: isH ? 700 : 400 }}>{dur}</td>
                            <td onClick={e => e.stopPropagation()}>
                              <Btn size="sm" variant="danger" onClick={() => setConfirmId("seg-" + seg.id)}>✕</Btn>
                            </td>
                          </tr>
                        );
                      });
                    })()}</tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn variant="ghost" size="sm" onClick={() => { setRace(r => ({ ...r, gpxPoints: null, totalDistance: 0, totalElevPos: 0, totalElevNeg: 0 })); setSegments([]); }}>
              🔄 Recharger un autre GPX
            </Btn>
            {race.gpxPoints?.length > 0 && (
              <Btn variant="ghost" size="sm" onClick={() => {
                // Inverser = retourner l'ordre des points, puis recalculer les distances cumulées
                const orig = race.gpxPoints;
                const rev = [...orig].reverse();
                let cumDist = 0;
                const reversed = rev.map((p, i) => {
                  if (i > 0) {
                    const prev = rev[i - 1];
                    const dLat = (p.lat - prev.lat) * Math.PI / 180;
                    const dLon = (p.lon - prev.lon) * Math.PI / 180;
                    const a = Math.sin(dLat/2)**2 + Math.cos(prev.lat*Math.PI/180)*Math.cos(p.lat*Math.PI/180)*Math.sin(dLon/2)**2;
                    cumDist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  }
                  return { ...p, dist: +cumDist.toFixed(3) };
                });
                // Recalcul D+ et D-
                let elvPos = 0, elvNeg = 0;
                for (let i = 1; i < reversed.length; i++) {
                  const dE = reversed[i].ele - reversed[i-1].ele;
                  if (dE > 0) elvPos += dE; else elvNeg += Math.abs(dE);
                }
                setRace(r => ({ ...r, gpxPoints: reversed, totalElevPos: elvPos, totalElevNeg: elvNeg }));
                setSegments([]);
              }}>
                ↔️ Inverser le sens du parcours
              </Btn>
            )}
          </div>
        </>
      )}

      <Modal open={ravitoModal} onClose={() => setRavitoModal(false)} title={editRavitoId ? "Modifier ravito" : "Nouveau ravitaillement"}>
        <div className="form-grid">
          <Field label="Kilomètre"><input type="number" min={0} step={0.1} value={ravitoForm.km} onChange={e => setRavitoForm(f => ({ ...f, km: e.target.value }))} /></Field>
          <Field label="Nom du point" full><input value={ravitoForm.name} onChange={e => setRavitoForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Durée d'arrêt (min)">
            <input type="number" min={1} max={60} step={1}
              value={ravitoForm.dureeMin}
              onChange={e => setRavitoForm(f => ({ ...f, dureeMin: e.target.value }))}
              placeholder={`Défaut : ${settings.ravitoTimeMin || 3} min`} />
          </Field>
          <Field label="Adresse (pour l'assistance)" full>
            <input value={ravitoForm.address || ""} onChange={e => setRavitoForm(f => ({ ...f, address: e.target.value }))} placeholder="Ex : Col du Lautaret, D1091, 05480 Villar-d'Arêne" />
          </Field>
          <Field label="Notes pour l'assistance" full>
            <textarea value={ravitoForm.notes || ""} onChange={e => setRavitoForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Ex : Parking en contrebas, préparer les bâtons, changer les chaussettes" />
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setRavitoModal(false)}>Annuler</Btn>
          <Btn onClick={saveRavito}>Enregistrer</Btn>
        </div>
      </Modal>

      <Modal open={segModal} onClose={() => setSegModal(false)} title={editSegId ? "Modifier segment" : "Nouveau segment"}>
        <div className="form-grid">
          <Field label="Début (km)">
            <input type="number" min={0} step={0.1} value={segForm.startKm} onChange={e => updSeg("startKm", e.target.value)} />
          </Field>
          <Field label="Fin (km)">
            <input type="number" min={0} step={0.1} value={segForm.endKm} onChange={e => updSeg("endKm", e.target.value)} />
          </Field>
          <Field label="Pente (%)">
            <input type="range" min={-25} max={30} step={1} value={segForm.slopePct} onChange={e => updSeg("slopePct", Number(e.target.value))} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted-c)", marginTop: 4 }}>
              <span>-25%</span>
              <span style={{ fontWeight: 600, color: segForm.slopePct > 10 ? C.red : "var(--text-c)" }}>{segForm.slopePct > 0 ? "+" : ""}{segForm.slopePct}%</span>
              <span>+30%</span>
            </div>
          </Field>
          <Field label="Vitesse (km/h)">
            <input type="range" min={2} max={15} step={0.5} value={segForm.speedKmh} onChange={e => updSeg("speedKmh", Number(e.target.value))} />
            <div style={{ textAlign: "center", fontSize: 13, marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>{segForm.speedKmh} km/h</span>
              <span style={{ color: "var(--muted-c)", marginLeft: 8 }}>({fmtPace(segForm.speedKmh)}/km)</span>
            </div>
          </Field>
          <Field label="Terrain" full>
            <div style={{ display: "flex", gap: 8 }}>
              {TERRAIN_TYPES.map(t => {
                const terrainCoeff = t.coeff;
                const isActive = (segForm.terrain || "normal") === t.key;
                return (
                  <div key={t.key} onClick={() => {
                    const baseSpeed = suggestSpeed(segForm.slopePct, settings.garminCoeff, settings);
                    updSeg("terrain", t.key);
                    setSegForm(f => ({ ...f, terrain: t.key, speedKmh: Math.max(2, +(baseSpeed * terrainCoeff).toFixed(1)) }));
                  }} style={{
                    flex: 1, padding: "8px 6px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                    border: `2px solid ${isActive ? C.primary : "var(--border-c)"}`,
                    background: isActive ? C.primaryPale : "var(--surface-2)",
                    transition: "all 0.15s",
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? C.primaryDeep : "var(--text-c)" }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 2 }}>×{t.coeff}</div>
                  </div>
                );
              })}
            </div>
          </Field>
          <Field label="Notes" full><textarea value={segForm.notes} onChange={e => updSeg("notes", e.target.value)} rows={2} /></Field>
        </div>
        {segForm.slopePct > 10 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.yellowPale, borderRadius: 10, fontSize: 13, color: C.yellow }}>
            Marche conseillée — pente élevée ({segForm.slopePct}%)
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setSegModal(false)}>Annuler</Btn>
          <Btn onClick={saveSeg}>Enregistrer</Btn>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        message={confirmId?.startsWith("rv-") ? "Supprimer ce ravitaillement ?" : "Supprimer ce segment ?"}
        onConfirm={() => {
          if (confirmId?.startsWith("rv-")) deleteRavito(Number(confirmId.replace("rv-", "")));
          else deleteSeg(Number(confirmId.replace("seg-", "")));
        }}
        onCancel={() => setConfirmId(null)} />
    </div>
  );
}

// ─── VUE STRATÉGIE DE COURSE ─────────────────────────────────────────────────
function StrategieView({ race, segments, setSegments, settings, setSettings, onOpenRepos, isMobile }) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [computing, setComputing] = useState(false);
  const emptyForm = { startKm: "", endKm: "", slopePct: 0, speedKmh: 9.5, terrain: "normal", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const updS = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const openNew  = ()  => { setEditId(null);   setForm(emptyForm); setModal(true); };
  const openEdit = seg => { setEditId(seg.id); setForm(seg);       setModal(true); };
  const updForm = (key, val) => {
    setForm(f => {
      const nf = { ...f, [key]: val };
      if (key === "startKm" || key === "endKm") {
        const slope = race.gpxPoints?.length ? calcSlopeFromGPX(race.gpxPoints, parseFloat(nf.startKm)||0, parseFloat(nf.endKm)||0) : nf.slopePct;
        nf.slopePct = slope;
        nf.speedKmh = suggestSpeed(slope, settings.garminCoeff, settings);
      }
      if (key === "slopePct") nf.speedKmh = suggestSpeed(val, settings.garminCoeff, settings);
      return nf;
    });
  };
  const save = () => {
    const seg = { ...form, startKm: parseFloat(form.startKm)||0, endKm: parseFloat(form.endKm)||0 };
    if (seg.endKm <= seg.startKm) return;
    if (editId) setSegments(s => s.map(x => x.id === editId ? { ...seg, id: editId } : x));
    else setSegments(s => [...s, { ...seg, id: Date.now() }].sort((a,b) => a.startKm - b.startKm));
    setModal(false);
  };
  const autoSegment = () => {
    if (!race.gpxPoints?.length) return;
    setComputing(true);
    setTimeout(() => {
      const newSegs = autoSegmentGPX(race.gpxPoints, settings.garminCoeff, settings);
      const preserved = segments.filter(s => s.type === "ravito" || s.type === "repos");
      setSegments([...newSegs, ...preserved].sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
      setComputing(false);
    }, 50);
  };

  // Segments de course normaux vs segments de repos vs ravitos
  const segsNormaux = segments.filter(s => s.type !== "repos" && s.type !== "ravito");
  const segsRepos   = segments.filter(s => s.type === "repos");

  // Temps course = segments normaux seulement
  const totalTime = segsNormaux.reduce((s, seg) => s + ((seg.endKm - seg.startKm) / seg.speedKmh) * 3600, 0);
  // Temps repos = somme des durées de repos
  const totalReposSec = segsRepos.reduce((s, seg) => s + (seg.dureeMin || 0) * 60, 0);
  const ravitoCount = race.ravitos?.length || 0;
  const totalRavitoSec = ravitoCount * (settings.ravitoTimeMin || 3) * 60;
  const totalWithRavitos = totalTime + totalRavitoSec + totalReposSec;

  const barData = segsNormaux.map((s, i) => ({ name: `S${i+1}`, vitesse: s.speedKmh, pente: s.slopePct }));

  // ── Heures de passage ──────────────────────────────────────────────────────
  const { times: passingTimes, startSec } = calcPassingTimes(segments, settings.startTime);
  const arrivalTime = passingTimes.length ? passingTimes[passingTimes.length - 1] : startSec;

  const EFFORT_OPTIONS = [
    { key: "comfort", label: "Finisher", desc: "Terminer sans se cramer — vitesses -12%", color: C.green },
    { key: "normal",  label: "Course normale", desc: "Equilibre selon ton profil Garmin", color: C.primary },
    { key: "perf",    label: "Chrono", desc: "Aller chercher le temps — vitesses +8%", color: C.red },
  ];
  const PACE_LABELS = ["Partir très vite", "Partir vite", "Régulier", "Partir lentement", "Très négatif"];

  const paceIdx = (settings.paceStrategy || 0) + 2;

  return (
    <div className="anim">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <PageTitle sub={segments.length ? `${segments.filter(s => s.type !== "ravito" && s.type !== "repos").length} segments · ${ravitoCount} ravito${ravitoCount>1?"s":""} — ${fmtTime(totalWithRavitos)}` : "Définis ta stratégie et génère tes segments"}>
          Stratégie de course
        </PageTitle>
        {segments.length > 0 && race.gpxPoints?.length > 0 && !isMobile && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0, marginTop: 4 }}>
            <Btn size="sm" variant="soft" onClick={() => {
              const profile = race.gpxPoints?.length ? buildElevationProfile(race.gpxPoints, 300) : [];
              exportRecap(race, segments, settings, profile, passingTimes);
            }}>📄 Récap course</Btn>
            <Btn size="sm" variant="soft" onClick={() => exportGPXMontre(race, segments, settings, passingTimes)}>📡 Export montre</Btn>
            <Btn size="sm" variant="soft" style={{ opacity: 0.55, cursor: "default" }}
              title="Export Garmin FIT avec alertes de pace — bientôt disponible"
              onClick={() => alert("🏅 Fonctionnalité Premium\n\nL'export Garmin FIT avec alertes de pace par segment arrive prochainement.\n\nUtilise « Export montre » pour un GPX compatible toutes montres.")}>
              🎯 Garmin FIT <span style={{ fontSize: 9, background: C.primary, color: "#fff", borderRadius: 4, padding: "1px 5px", marginLeft: 4, verticalAlign: "middle" }}>Premium</span>
            </Btn>
          </div>
        )}
      </div>
      {segments.length > 0 && race.gpxPoints?.length > 0 && isMobile && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <Btn size="sm" variant="soft" onClick={() => {
            const profile = race.gpxPoints?.length ? buildElevationProfile(race.gpxPoints, 300) : [];
            exportRecap(race, segments, settings, profile, passingTimes);
          }}>📄 Récap course</Btn>
          <Btn size="sm" variant="soft" onClick={() => exportGPXMontre(race, segments, settings, passingTimes)}>📡 Export montre</Btn>
          <Btn size="sm" variant="soft" style={{ opacity: 0.55, cursor: "default" }}
            title="Export Garmin FIT avec alertes de pace — bientôt disponible"
            onClick={() => alert("🏅 Fonctionnalité Premium\n\nL'export Garmin FIT avec alertes de pace par segment arrive prochainement.\n\nUtilise « Export montre » pour un GPX compatible toutes montres.")}>
            🎯 Garmin FIT <span style={{ fontSize: 9, background: C.primary, color: "#fff", borderRadius: 4, padding: "1px 5px", marginLeft: 4, verticalAlign: "middle" }}>Premium</span>
          </Btn>
        </div>
      )}

      <div style={{ background: C.primaryPale, border: `1px solid ${C.primary}40`, borderRadius: 12, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: C.primaryDeep }}>
        Configure ta course dans <strong>Profil de course</strong> — retrouve ici les heures de passage et les segments.
      </div>

      {/* ── RÉSULTATS ── */}
      {!segments.length ? (
        <Empty icon="✂️" title="Aucun segment défini" sub="Génère les segments depuis ta stratégie, ou ajoute-en un manuellement." action={<Btn onClick={openNew}>+ Ajouter un segment</Btn>} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(auto-fit, minmax(180px, 1fr))", gap: isMobile ? 8 : 14, marginBottom: 20 }}>
            <KPI label="Temps course" value={fmtTime(totalTime)} color={C.secondary} icon="⏱️" sub="hors ravitos" />
            <KPI label="Temps total" value={fmtTime(totalWithRavitos)} icon="🏁" sub={`+${ravitoCount} ravito${ravitoCount>1?"s":""}`} />
            {segments.length > 0 && <KPI label="Arrivée estimée" value={fmtHeure(arrivalTime)} icon={isNight(arrivalTime) ? "🌙" : "☀️"} color={isNight(arrivalTime) ? C.blue : C.yellow} sub={`départ ${settings.startTime || "07:00"}`} />}
          </div>

          <Card noPad style={{ marginBottom: 20 }}>
            <div style={{ padding: "14px 20px 0", fontWeight: 600 }}>Vitesses par segment</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={barData} margin={{ top: 8, right: 20, bottom: 4, left: 10 }}>
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

          <Card noPad>
            <div style={{ padding: "14px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Segments</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn size="sm" variant="ghost" onClick={onOpenRepos}>💤 Repos</Btn>
                <Btn size="sm" onClick={openNew}>+ Segment</Btn>
              </div>
            </div>
            <div className="tbl-wrap">
              <table style={{ fontSize: isMobile ? 11 : undefined }}>
                <thead><tr>
                  <th>#</th><th>De</th><th>À</th><th>Dist.</th><th>Pente</th><th>Terrain</th><th>Vitesse</th><th>Allure</th><th>Durée</th><th>Heure</th><th>Nutrition/h</th><th></th>
                </tr></thead>
                <tbody>{(() => {
                  let segNum = 0;
                  return segments.map((seg, i) => {
                  // ── Segment ravitaillement ──
                  if (seg.type === "ravito") {
                    const t = passingTimes[i];
                    const night = isNight(t);
                    return (
                      <tr key={seg.id} style={{ background: C.green + "10", cursor: "default" }}>
                        <td style={{ color: "var(--muted-c)", fontSize: 16 }}>🥤</td>
                        <td style={{ fontWeight: 600, color: C.green }}>{seg.label}</td>
                        <td style={{ color: "var(--muted-c)", fontSize: 12 }}>km {seg.startKm}</td>
                        <td colSpan={2} style={{ color: "var(--muted-c)", fontSize: 13 }}>
                          {seg.dureeMin} min — {fmtTime(seg.dureeMin * 60)}
                        </td>
                        <td colSpan={4} style={{ color: "var(--muted-c)", fontSize: 12, fontStyle: "italic" }}>
                          Arrêt ravitaillement · pas de distance
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: 13, color: night ? C.blue : C.primary }}>
                            {fmtHeure(t)}
                          </span>
                          {night && <span style={{ marginLeft: 4, fontSize: 11 }}>🌙</span>}
                        </td>
                        <td></td>
                        <td><span style={{ fontSize: 11, color: "var(--muted-c)" }}>auto</span></td>
                      </tr>
                    );
                  }
                  // ── Segment de repos ──
                  if (seg.type === "repos") {
                    const t = passingTimes[i];
                    const night = isNight(t);
                    return (
                      <tr key={seg.id} style={{ background: "var(--surface-2)", cursor: "default" }}>
                        <td style={{ color: "var(--muted-c)", fontSize: 16 }}>💤</td>
                        <td style={{ fontWeight: 600, color: C.blue }}>{seg.label}</td>
                        <td style={{ color: "var(--muted-c)", fontSize: 12 }}>km {seg.startKm}</td>
                        <td colSpan={2} style={{ color: "var(--muted-c)", fontSize: 13 }}>
                          {seg.dureeMin} min — {fmtTime(seg.dureeMin * 60)}
                        </td>
                        <td colSpan={4} style={{ color: "var(--muted-c)", fontSize: 12, fontStyle: "italic" }}>
                          Pas de distance · temps ajouté au total
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: 13, color: night ? C.blue : C.primary }}>
                            {fmtHeure(t)}
                          </span>
                          {night && <span style={{ marginLeft: 4, fontSize: 11 }}>🌙</span>}
                        </td>
                        <td></td>
                        <td onClick={e => e.stopPropagation()}>
                          <Btn size="sm" variant="danger" onClick={() => setConfirmId(seg.id)}>✕</Btn>
                        </td>
                      </tr>
                    );
                  }
                  // ── Segment normal ──
                  segNum++;
                  const dist = seg.endKm - seg.startKm;
                  const dur  = fmtTime((dist / seg.speedKmh) * 3600);
                  const n    = calcNutrition(seg, settings);
                  const terrainLabel = TERRAIN_TYPES.find(t => t.key === (seg.terrain || "normal"))?.label || "Normal";
                  const terrainKey   = seg.terrain || "normal";
                  const t    = passingTimes[i];
                  const night = isNight(t);
                  return (
                    <tr key={seg.id} onClick={() => openEdit(seg)} style={{ cursor: "pointer" }}>
                      <td style={{ color: "var(--muted-c)" }}>{segNum}</td>
                      <td>{seg.startKm} km</td>
                      <td>{seg.endKm} km</td>
                      <td>{dist.toFixed(1)} km</td>
                      <td>
                        <span className={`badge ${seg.slopePct > 9 ? "badge-red" : seg.slopePct < -12 ? "badge-blue" : "badge-sage"}`}>
                          {seg.slopePct > 0 ? "+" : ""}{seg.slopePct}%
                        </span>
                        {seg.slopePct > 10 && <span style={{ marginLeft: 6, fontSize: 11, color: C.yellow }}>marche</span>}
                      </td>
                      <td>
                        {terrainKey !== "normal"
                          ? <span className="badge badge-yellow" style={{ fontSize: 11 }}>{terrainLabel}</span>
                          : <span style={{ fontSize: 12, color: "var(--muted-c)" }}>—</span>}
                      </td>
                      <td style={{ fontWeight: 600 }}>{seg.speedKmh} km/h</td>
                      <td style={{ fontFamily: "'Playfair Display', serif" }}>{fmtPace(seg.speedKmh)}/km</td>
                      <td>{dur}</td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 13, color: night ? C.blue : C.primary }}>
                          {fmtHeure(t)}
                        </span>
                        {night && <span style={{ marginLeft: 4, fontSize: 11 }}>🌙</span>}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted-c)" }}>{n.eauH}mL · {n.glucidesH}g · {n.kcalH}kcal</td>
                      <td onClick={e => e.stopPropagation()}>
                        <Btn size="sm" variant="danger" onClick={() => setConfirmId(seg.id)}>✕</Btn>
                      </td>
                    </tr>
                  );
                  });
                })()}</tbody>
              </table>
            </div>
          </Card>

          {/* ── PROFIL DE FATIGUE CUMULÉE ── */}
          {(() => {
            const [tooltipFatigue, setTooltipFatigue] = useState(false);
            const levelData = RUNNER_LEVELS.find(l => l.key === (settings.runnerLevel || "intermediaire")) || RUNNER_LEVELS[1];
            const paceStrat = settings.paceStrategy || 0;
            const garminCoeff = settings.garminCoeff || 1;

            // ITRA Effort Score : EK = dist + D+/100 + D-/200
            // Source : Vernillo et al. 2017 + formule officielle ITRA
            const totalEK = segsNormaux.reduce((s, seg) => {
              const dist = seg.endKm - seg.startKm;
              const dplus  = seg.slopePct > 0 ? (seg.slopePct / 100) * dist * 1000 : 0;
              const dminus = seg.slopePct < 0 ? Math.abs(seg.slopePct / 100) * dist * 1000 : 0;
              return s + dist + dplus / 100 + dminus / 200;
            }, 0) || 1;

            let cumEK = 0, segNum = 0;
            const fatigueData = segments.map(seg => {
              if (seg.type === "ravito") {
                const duree = seg.dureeMin || settings.ravitoTimeMin || 3;
                const rec = Math.min(duree * 0.6 * levelData.coeff * garminCoeff, 4);
                cumEK = Math.max(0, cumEK - rec);
                return { label: seg.label || "Ravito", type: "ravito", charge: Math.round(cumEK / totalEK * 100), reserve: Math.max(0, Math.round(100 - cumEK / totalEK * 100)) };
              }
              if (seg.type === "repos") {
                const rec = Math.min((seg.dureeMin || 20) * 0.4 * levelData.coeff, 8);
                cumEK = Math.max(0, cumEK - rec);
                return { label: seg.label || "Repos", type: "repos", charge: Math.round(cumEK / totalEK * 100), reserve: Math.max(0, Math.round(100 - cumEK / totalEK * 100)) };
              }
              segNum++;
              const dist = seg.endKm - seg.startKm;
              const dplus  = seg.slopePct > 0 ? (seg.slopePct / 100) * dist * 1000 : 0;
              const dminus = seg.slopePct < 0 ? Math.abs(seg.slopePct / 100) * dist * 1000 : 0;
              const ek = dist + dplus / 100 + dminus / 200;
              const progress = segNum / (segsNormaux.length || 1);
              const paceFactor = paceStrat < 0 ? (1 + progress * 0.25) : paceStrat > 0 ? (1 - progress * 0.15 + 0.08) : 1;
              cumEK += ek * paceFactor / (levelData.coeff * garminCoeff);
              const chargePct = Math.min(100, Math.round(cumEK / totalEK * 100));
              return { label: `S${segNum}`, fullLabel: `${seg.startKm}→${seg.endKm} km`, type: "seg", charge: chargePct, reserve: Math.max(0, 100 - chargePct) };
            });

            const SEUIL = 80;
            const enZoneRouge = fatigueData.some(d => d.charge >= SEUIL);

            return (
              <Card style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Profil de fatigue cumulée</span>
                    <span onClick={() => setTooltipFatigue(t => !t)} style={{ cursor: "pointer", fontSize: 13, color: C.primary, userSelect: "none" }}>ⓘ</span>
                  </div>
                  {enZoneRouge && (
                    <span style={{ fontSize: 11, background: C.redPale, color: C.red, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>Zone critique atteinte</span>
                  )}
                </div>
                {tooltipFatigue && (
                  <div style={{ background: "var(--surface-2)", border: `1px solid var(--border-c)`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text-c)", marginBottom: 12, lineHeight: 1.8 }}>
                    <strong>ITRA Effort Score</strong> — formule officielle ITRA / UTMB<br/>
                    <code style={{ fontSize: 11, background: "var(--surface)", padding: "2px 6px", borderRadius: 4 }}>EK = distance (km) + D+ / 100 + D− / 200</code><br/><br/>
                    <strong>Vernillo et al. (2017)</strong> — <em>Sports Medicine</em><br/>
                    Le D+ est un prédicteur de fatigue plus fort que la distance seule. La charge intègre distance, dénivelé positif et négatif.<br/><br/>
                    <strong>Millet et al. (2011)</strong> — <em>Medicine & Science in Sports & Exercise</em><br/>
                    Étude UTMB : fatigue neuromusculaire sur ultra-trail. La récupération aux ravitos est ajustée selon la durée et le niveau coureur.<br/><br/>
                    <span style={{ color: "var(--muted-c)", fontSize: 11 }}>La courbe de réserve est une modélisation comparative — pas une prédiction physiologique exacte.</span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                  {[
                    { color: C.blue,   label: "Charge cumulée", line: false },
                    { color: C.red,    label: "Réserve estimée", line: true },
                    { color: C.yellow, label: "Seuil critique (80%)", dashed: true },
                  ].map(({ color, label, line, dashed }) => (
                    <span key={label} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                      {dashed
                        ? <span style={{ width: 14, borderTop: `2px dashed ${color}`, display: "inline-block" }} />
                        : line
                          ? <span style={{ width: 14, borderTop: `2px solid ${color}`, display: "inline-block" }} />
                          : <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                      }
                      <span style={{ color: "var(--muted-c)" }}>{label}</span>
                    </span>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={fatigueData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.muted }} tickFormatter={v => `${v}%`} width={36} />
                    <RTooltip
                      formatter={(value, name) => [`${value}%`, name === "charge" ? "Charge cumulée" : "Réserve estimée"]}
                      labelFormatter={(label, payload) => { const d = payload?.[0]?.payload; return d?.fullLabel ? `${label} — ${d.fullLabel}` : label; }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }}
                    />
                    <ReferenceLine y={SEUIL} stroke={C.yellow} strokeDasharray="5 4" strokeWidth={1.5} />
                    <Bar dataKey="charge" name="charge" radius={[3,3,0,0]}>
                      {fatigueData.map((d, i) => (
                        <Cell key={i} fill={
                          d.type === "ravito" ? C.green  + "99" :
                          d.type === "repos"  ? C.blue   + "55" :
                          d.charge >= SEUIL   ? C.red    + "cc" :
                          d.charge >= 60      ? C.yellow + "cc" : C.blue + "cc"
                        } />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="reserve" name="reserve" stroke={C.red} strokeWidth={2} dot={{ r: 2, fill: C.red }} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 8 }}>
                  ITRA Effort Score · niveau <strong style={{ color: "var(--text-c)" }}>{levelData.label}</strong> · coeff Garmin ×{garminCoeff}
                  {paceStrat !== 0 && <> · pace {paceStrat < 0 ? "positif" : "négatif"} pris en compte</>}
                </div>
              </Card>
            );
          })()}
        </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "Modifier segment" : "Nouveau segment"}>
        <div className="form-grid">
          <Field label="Début (km)"><input type="number" min={0} step={0.1} value={form.startKm} onChange={e => updForm("startKm", e.target.value)} /></Field>
          <Field label="Fin (km)"><input type="number" min={0} step={0.1} value={form.endKm} onChange={e => updForm("endKm", e.target.value)} /></Field>
          <Field label="Pente (%)">
            <input type="range" min={-25} max={30} step={1} value={form.slopePct} onChange={e => updForm("slopePct", Number(e.target.value))} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted-c)", marginTop: 4 }}>
              <span>-25%</span>
              <span style={{ fontWeight: 600, color: form.slopePct > 10 ? C.red : "var(--text-c)" }}>{form.slopePct > 0 ? "+" : ""}{form.slopePct}%</span>
              <span>+30%</span>
            </div>
          </Field>
          <Field label="Vitesse (km/h)">
            <input type="range" min={2} max={15} step={0.5} value={form.speedKmh} onChange={e => updForm("speedKmh", Number(e.target.value))} />
            <div style={{ textAlign: "center", fontSize: 13, marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>{form.speedKmh} km/h</span>
              <span style={{ color: "var(--muted-c)", marginLeft: 8 }}>({fmtPace(form.speedKmh)}/km)</span>
            </div>
          </Field>
          <Field label="Terrain" full>
            <div style={{ display: "flex", gap: 8 }}>
              {TERRAIN_TYPES.map(t => {
                const terrainCoeff = t.coeff;
                const isActive = (form.terrain || "normal") === t.key;
                return (
                  <div key={t.key} onClick={() => {
                    const baseSpeed = suggestSpeed(form.slopePct, settings.garminCoeff, settings);
                    setForm(f => ({ ...f, terrain: t.key, speedKmh: Math.max(2, +(baseSpeed * terrainCoeff).toFixed(1)) }));
                  }} style={{
                    flex: 1, padding: "8px 6px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                    border: `2px solid ${isActive ? C.primary : "var(--border-c)"}`,
                    background: isActive ? C.primaryPale : "var(--surface-2)",
                    transition: "all 0.15s",
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? C.primaryDeep : "var(--text-c)" }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 2 }}>×{t.coeff}</div>
                  </div>
                );
              })}
            </div>
          </Field>
          <Field label="Notes" full><textarea value={form.notes} onChange={e => updForm("notes", e.target.value)} rows={2} /></Field>
        </div>
        {form.slopePct > 10 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.yellowPale, borderRadius: 10, fontSize: 13, color: C.yellow }}>
            Marche conseillée — pente élevée ({form.slopePct}%)
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

// ─── VUE PARAMÈTRES ──────────────────────────────────────────────────────────
function ParamètresView({ settings, setSettings, race, setRace, segments, isMobile }) {
  const upd = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const [newItem, setNewItem] = useState("");
  const [newCat, setNewCat]   = useState("Équipement");
  const [checklistModal, setChecklistModal] = useState(false);

  const equipment = settings.equipment || DEFAULT_EQUIPMENT;
  const cats = [...new Set(equipment.map(i => i.cat))];

  const toggleItem   = id => upd("equipment", equipment.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  const toggleActif  = id => upd("equipment", equipment.map(i => i.id === id ? { ...i, actif: !i.actif, checked: false } : i));
  const deleteItem   = id => upd("equipment", equipment.filter(i => i.id !== id));
  const addItem      = () => {
    if (!newItem.trim()) return;
    upd("equipment", [...equipment, { id: Date.now(), cat: newCat, label: newItem.trim(), checked: false, actif: true }]);
    setNewItem("");
  };
  const resetChecks  = () => upd("equipment", equipment.map(i => ({ ...i, checked: false })));

  const activeItems  = equipment.filter(i => i.actif !== false); // items sélectionnés pour la course
  const checkedCount = activeItems.filter(i => i.checked).length;

  return (
    <div className="anim">
      <PageTitle sub="Profil, équipement et calibration">Paramètres du coureur</PageTitle>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>

        {/* Colonne gauche : profil + dark mode */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Profil coureur</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Nom"><input value={settings.name} onChange={e => upd("name", e.target.value)} placeholder="Ton prénom" /></Field>

              {/* Poids */}
              <Field label="Poids (kg)">
                <input type="number" min={40} max={150} value={settings.weight}
                  onChange={e => upd("weight", e.target.value === "" ? "" : +e.target.value)}
                  onBlur={e => upd("weight", Math.max(40, Math.min(150, +e.target.value || 70)))}
                  style={{ width: 90 }} />
              </Field>

              {/* Dépense énergétique — 3 sources */}
              {(() => {
                const w = settings.weight || 70;
                const minettiFlatKcal = Math.round(3.6 * w * 1000 / 4184);
                const i10 = 0.10;
                const cr10 = 155.4*i10**5 - 30.4*i10**4 - 43.3*i10**3 + 46.3*i10**2 + 19.5*i10 + 3.6;
                const minettiUpKcal = Math.round(cr10 * w * 1000 / 4184);
                const gs = settings.garminStats;
                const src = settings.kcalSource || "minetti";
                const [tooltip, setTooltip] = useState(false);

                const SourceCard = ({ id, label, sub, flatVal, upVal, unavailable }) => {
                  const active = src === id;
                  return (
                    <div onClick={() => !unavailable && upd("kcalSource", id)} style={{
                      flex: 1, minWidth: 0, borderRadius: 10, padding: "10px 12px", cursor: unavailable ? "default" : "pointer",
                      border: `2px solid ${active ? C.primary : "var(--border-c)"}`,
                      background: active ? C.primaryPale : "var(--surface-2)",
                      opacity: unavailable ? 0.45 : 1, transition: "all 0.15s",
                      display: "flex", flexDirection: "column", gap: 4,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: active ? C.primaryDeep : "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-c)", lineHeight: 1.4 }}>{sub}</div>
                      {unavailable ? (
                        <div style={{ fontSize: 11, color: "var(--muted-c)", fontStyle: "italic", marginTop: 2 }}>Non disponible</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: active ? C.primaryDeep : "var(--text-c)", fontFamily: "'Playfair Display', serif" }}>
                            {flatVal} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted-c)" }}>kcal/km plat</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: active ? C.primaryDeep : "var(--text-c)", fontFamily: "'Playfair Display', serif" }}>
                            {upVal ?? "—"} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted-c)" }}>kcal/km montée</span>
                          </div>
                        </div>
                      )}
                      {active && !unavailable && (
                        <div style={{ marginTop: 4, fontSize: 10, color: C.primary, fontWeight: 600 }}>✓ Sélectionné</div>
                      )}
                    </div>
                  );
                };

                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--muted-c)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Dépense énergétique</span>
                      <span onClick={() => setTooltip(t => !t)} style={{ cursor: "pointer", fontSize: 13, color: C.primary, lineHeight: 1, userSelect: "none" }} title="Voir la formule">ⓘ</span>
                    </div>
                    {tooltip && (
                      <div style={{ background: "var(--surface-2)", border: `1px solid var(--border-c)`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text-c)", marginBottom: 10, lineHeight: 1.7 }}>
                        <strong>Formule Minetti et al. (2002)</strong> — <em>Journal of Applied Physiology</em><br/>
                        <code style={{ fontSize: 11, background: "var(--surface)", padding: "2px 6px", borderRadius: 4 }}>Cr = (155.4i⁵ − 30.4i⁴ − 43.3i³ + 46.3i² + 19.5i + 3.6) × poids</code><br/><br/>
                        Pour {w} kg : plat ~{minettiFlatKcal} kcal/km · montée +10% ~{minettiUpKcal} kcal/km
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <SourceCard
                        id="minetti" label="Minetti" sub="Formule scientifique"
                        flatVal={minettiFlatKcal} upVal={minettiUpKcal}
                      />
                      <SourceCard
                        id="garmin" label="Garmin perso" sub={gs?.kcalActivityCount ? `${gs.kcalActivityCount} sorties` : "Import requis"}
                        flatVal={gs?.kcalPerKmFlat} upVal={gs?.kcalPerKmUphill}
                        unavailable={!gs?.kcalPerKmFlat}
                      />
                      <SourceCard
                        id="manual" label="Manuel" sub="Valeur personnalisée"
                        flatVal={settings.kcalPerKm} upVal={settings.kcalPerKmUphill}
                      />
                    </div>
                    {src === "manual" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 9, border: `1px solid var(--border-c)` }}>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 4 }}>Plat (kcal/km)</div>
                          <input type="number" min={40} max={150} value={settings.kcalPerKm}
                            onChange={e => upd("kcalPerKm", e.target.value === "" ? "" : +e.target.value)}
                            onBlur={e => upd("kcalPerKm", Math.max(40, Math.min(150, +e.target.value || 65)))}
                            style={{ width: "100%" }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 4 }}>Montée ≥5% (kcal/km)</div>
                          <input type="number" min={40} max={200} value={settings.kcalPerKmUphill}
                            onChange={e => upd("kcalPerKmUphill", e.target.value === "" ? "" : +e.target.value)}
                            onBlur={e => upd("kcalPerKmUphill", Math.max(40, Math.min(200, +e.target.value || 90)))}
                            style={{ width: "100%" }} />
                        </div>
                      </div>
                    )}
                    {gs?.kcalPerKmFlat && (() => {
                      const diffFlat = gs.kcalPerKmFlat - minettiFlatKcal;
                      const diffSign = diffFlat >= 0 ? "+" : "";
                      return (
                        <div style={{ padding: "10px 12px", background: C.secondaryPale, borderRadius: 9, fontSize: 12, lineHeight: 1.6, color: "var(--text-c)", marginTop: 8 }}>
                          Ton historique suggère <strong>{gs.kcalPerKmFlat} kcal/km</strong> sur plat
                          {gs.kcalPerKmUphill ? <> et <strong>{gs.kcalPerKmUphill} kcal/km</strong> en montée</> : null}
                          {" "}— {diffFlat === 0 ? "identique aux" : <>{diffSign}{diffFlat} kcal/km par rapport aux</>} valeurs Minetti ({minettiFlatKcal}/{minettiUpKcal}).
                          {" "}<span style={{ color: "var(--muted-c)" }}>Calculé sur {gs.kcalActivityCount} sorties avec données FC.</span>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Glucides & substrats */}
              {(() => {
                const [tooltipGlu, setTooltipGlu] = useState(false);
                const target = settings.glucidesTargetGh;
                // Répartition estimée pour affichage
                const kcalH = 400; // référence indicative à effort modéré
                const glucidesH = target != null ? target : Math.round(kcalH * 0.55 / 4);
                const proteinesH = Math.round(kcalH * 0.10 / 4);
                const lipidesH = Math.max(0, Math.round((kcalH - glucidesH * 4 - proteinesH * 4) / 9));
                const totalCalc = glucidesH * 4 + lipidesH * 9 + proteinesH * 4;
                const pctGlu  = totalCalc > 0 ? Math.round(glucidesH * 4 / totalCalc * 100) : 55;
                const pctLip  = totalCalc > 0 ? Math.round(lipidesH * 9 / totalCalc * 100) : 35;
                const pctPro  = 100 - pctGlu - pctLip;
                return (
                  <div style={{ borderTop: "1px solid var(--border-c)", paddingTop: 14, marginTop: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--muted-c)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Glucides & substrats</span>
                      <span onClick={() => setTooltipGlu(t => !t)} style={{ cursor: "pointer", fontSize: 13, color: C.primary, lineHeight: 1, userSelect: "none" }}>ⓘ</span>
                    </div>
                    {tooltipGlu && (
                      <div style={{ background: "var(--surface-2)", border: `1px solid var(--border-c)`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text-c)", marginBottom: 10, lineHeight: 1.8 }}>
                        <strong>Jeukendrup (2004)</strong> — <em>Nutrition</em><br/>
                        Absorption intestinale plafonnée à ~60 g/h (glucose seul) ou ~90 g/h (glucose + fructose, transporteurs multiples).<br/><br/>
                        <strong>Jeukendrup (2011)</strong> — <em>Sports Medicine</em><br/>
                        Le "gut training" permet d'atteindre 90–120 g/h chez les athlètes entraînés sur effort long.<br/><br/>
                        <strong>Brooks & Mercier (1994)</strong> — <em>Journal of Applied Physiology</em><br/>
                        Concept du "crossover" : en dessous de ~65% VO₂max, les lipides dominent. Au-delà, les glucides deviennent le substrat principal. Sur trail, l'intensité variable justifie un mix.<br/><br/>
                        <span style={{ color: "var(--muted-c)", fontSize: 11 }}>La répartition protéines (10%) est une règle empirique, sans étude spécifique trail.</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 4 }}>Glucides visés (g/h)</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="number" min={20} max={150} placeholder="Auto"
                            value={target ?? ""}
                            onChange={e => upd("glucidesTargetGh", e.target.value === "" ? null : +e.target.value)}
                            onBlur={e => { if (e.target.value !== "") upd("glucidesTargetGh", Math.max(20, Math.min(150, +e.target.value))); }}
                            style={{ width: 90 }} />
                          {target != null && (
                            <button onClick={() => upd("glucidesTargetGh", null)}
                              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, border: `1px solid var(--border-c)`, background: "var(--surface-2)", color: "var(--muted-c)", cursor: "pointer" }}>
                              Auto
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 4 }}>
                          {target == null ? "Calculé automatiquement (55% des kcal)" : (
                            target <= 60 ? "Débutant / effort long faible intensité" :
                            target <= 90 ? "Entraîné — profil standard" :
                            "Gut training — athlète expérimenté"
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Répartition estimée */}
                    <div style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 9, fontSize: 12 }}>
                      <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 8 }}>Répartition estimée à effort modéré (~400 kcal/h)</div>
                      <div style={{ display: "flex", gap: 0, height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ width: `${pctGlu}%`, background: C.yellow, transition: "width 0.3s" }} />
                        <div style={{ width: `${pctLip}%`, background: C.primary, transition: "width 0.3s" }} />
                        <div style={{ width: `${pctPro}%`, background: C.secondary, transition: "width 0.3s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                        <span style={{ color: C.yellow, fontWeight: 600 }}>Glucides {pctGlu}% <span style={{ fontWeight: 400, color: "var(--muted-c)" }}>({glucidesH} g/h)</span></span>
                        <span style={{ color: C.primary, fontWeight: 600 }}>Lipides {pctLip}% <span style={{ fontWeight: 400, color: "var(--muted-c)" }}>({lipidesH} g/h)</span></span>
                        <span style={{ color: C.secondary, fontWeight: 600 }}>Protéines {pctPro}% <span style={{ fontWeight: 400, color: "var(--muted-c)" }}>({proteinesH} g/h)</span></span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ borderTop: "1px solid var(--border-c)", paddingTop: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Contact d'urgence SOS</div>
                <Field label="Nom du contact">
                  <input value={settings.emergencyName} onChange={e => upd("emergencyName", e.target.value)} placeholder="Ex : Morgane, Coach, Accompagnatrice..." />
                </Field>
                <Field label="Numéro de téléphone">
                  <input value={settings.emergencyPhone} onChange={e => upd("emergencyPhone", e.target.value)} placeholder="Ex : +33612345678" type="tel" />
                </Field>
                {settings.emergencyPhone && (
                  <div style={{ fontSize: 12, color: C.green, display: "flex", alignItems: "center", gap: 6 }}>
                    ✓ Le bouton SOS enverra directement à {settings.emergencyName || settings.emergencyPhone}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 16, padding: "10px 14px", background: C.primaryPale, borderRadius: 10, fontSize: 12, color: C.primaryDeep, borderLeft: `3px solid ${C.primary}` }}>
              Niveau coureur et calibration Garmin → <strong>Profil de course</strong>
            </div>
          </Card>

        </div>

        {/* Colonne droite : checklist cochable */}
        <Card style={{ alignSelf: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Checklist équipement</div>
              <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>{checkedCount}/{activeItems.length} préparés</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn size="sm" variant="ghost" onClick={resetChecks}>Tout décocher</Btn>
              <Btn size="sm" variant="soft" onClick={() => setChecklistModal(true)}>⚙️ Configurer</Btn>
            </div>
          </div>

          {/* Barre de progression */}
          <div style={{ height: 5, background: "var(--surface-2)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3, transition: "width 0.3s",
              width: `${activeItems.length ? (checkedCount / activeItems.length) * 100 : 0}%`,
              background: checkedCount === activeItems.length && activeItems.length > 0 ? C.green : C.primary,
            }} />
          </div>

          {/* Items actifs groupés par catégorie */}
          {activeItems.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted-c)", fontSize: 13, padding: "16px 0" }}>
              Aucun item sélectionné.<br/>
              <span style={{ cursor: "pointer", color: C.primary, textDecoration: "underline" }} onClick={() => setChecklistModal(true)}>Configure ta liste</span>
            </div>
          ) : (
            [...new Set(activeItems.map(i => i.cat))].map(cat => (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{cat}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {activeItems.filter(i => i.cat === cat).map(item => (
                    <div key={item.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                      borderRadius: 8, background: item.checked ? C.green + "14" : "var(--surface-2)",
                      transition: "background 0.15s", cursor: "pointer",
                    }} onClick={() => toggleItem(item.id)}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        border: `2px solid ${item.checked ? C.green : "var(--border-c)"}`,
                        background: item.checked ? C.green : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                      }}>
                        {item.checked && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{
                        fontSize: 13, flex: 1,
                        color: item.checked ? "var(--muted-c)" : "var(--text-c)",
                        textDecoration: item.checked ? "line-through" : "none",
                        transition: "all 0.15s",
                      }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Modal checklist — configuration */}
      <Modal open={checklistModal} onClose={() => setChecklistModal(false)} title="Configurer ma checklist">
        <p style={{ fontSize: 13, color: "var(--muted-c)", marginBottom: 16 }}>
          Sélectionne les items que tu emportes. Seuls les items actifs apparaîtront dans ta checklist.
        </p>
        {cats.map(cat => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{cat}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {equipment.filter(i => i.cat === cat).map(item => {
                const isActif = item.actif !== false;
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    borderRadius: 9, background: isActif ? C.primaryPale : "var(--surface-2)",
                    border: `1px solid ${isActif ? C.primary + "40" : "var(--border-c)"}`,
                    cursor: "pointer", transition: "all 0.15s",
                  }} onClick={() => toggleActif(item.id)}>
                    {/* Toggle switch — distinct de la checkbox de la checklist */}
                    <div style={{
                      width: 32, height: 18, borderRadius: 9, flexShrink: 0,
                      background: isActif ? C.primary : "var(--border-c)",
                      position: "relative", transition: "background 0.2s",
                    }}>
                      <div style={{
                        position: "absolute", top: 2, left: isActif ? 14 : 2,
                        width: 14, height: 14, borderRadius: "50%", background: "#fff",
                        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                    <span style={{ fontSize: 13, flex: 1, fontWeight: isActif ? 500 : 400, color: isActif ? "var(--text-c)" : "var(--muted-c)" }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted-c)", opacity: 0.5, cursor: "pointer", padding: "0 4px" }}
                      onClick={e => { e.stopPropagation(); deleteItem(item.id); }}>✕</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border-c)", paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-c)", marginBottom: 8 }}>Ajouter un item</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={newCat} onChange={e => setNewCat(e.target.value)} style={{ flex: "0 0 auto", fontSize: 13 }}>
              {cats.map(c => <option key={c}>{c}</option>)}
              <option value="Autre">Autre</option>
            </select>
            <input value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              placeholder="Ex : Baume à lèvres..."
              style={{ flex: 1, minWidth: 120, fontSize: 13 }} />
            <Btn size="sm" onClick={addItem}>Ajouter</Btn>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn onClick={() => setChecklistModal(false)}>Fermer</Btn>
        </div>
      </Modal>
    </div>
  );
}


// ─── VUE NUTRITION ───────────────────────────────────────────────────────────
function NutritionView({ segments, settings, setSettings, race, setRace, isMobile, onNavigate }) {
  const produits = settings.produits || [];
  const planNutrition = race.planNutrition || {};
  const ravitos = [...(race.ravitos || [])].sort((a, b) => a.km - b.km);

  const updProduits = v => setSettings(s => ({ ...s, produits: v }));
  const updPlan = v => setRace(r => ({ ...r, planNutrition: v }));

  // ── État modaux ──
  const [prodModal, setProdModal] = useState(false);
  const [editProdId, setEditProdId] = useState(null);
  const [confirmProdId, setConfirmProdId] = useState(null);
  const emptyProd = { nom: "", par100g: true, poids: "", kcal: "", proteines: "", lipides: "", glucides: "", sodium: "", potassium: "", magnesium: "", zinc: "", calcium: "", boisson: false, volumeMl: "" };
  const [prodForm, setProdForm] = useState(emptyProd);
  const updP = (k, v) => setProdForm(f => ({ ...f, [k]: v }));

  const openNewProd  = ()  => { setEditProdId(null);  setProdForm(emptyProd); setProdModal(true); };
  const openEditProd = p   => { setEditProdId(p.id);  setProdForm({ ...emptyProd, ...p }); setProdModal(true); };
  const saveProd = () => {
    if (!prodForm.nom.trim()) return;
    const item = { ...prodForm, id: editProdId || Date.now(), poids: +prodForm.poids||0, kcal: +prodForm.kcal||0, proteines: +prodForm.proteines||0, lipides: +prodForm.lipides||0, glucides: +prodForm.glucides||0, sodium: +prodForm.sodium||0, potassium: +prodForm.potassium||0, magnesium: +prodForm.magnesium||0, zinc: +prodForm.zinc||0, calcium: +prodForm.calcium||0 };
    if (editProdId) updProduits(produits.map(p => p.id === editProdId ? item : p));
    else updProduits([...produits, item]);
    setProdModal(false);
  };

  // ── Helpers nutrition ──
  const nutriProduit = (prod, qte) => {
    const factor = prod.par100g ? (prod.poids * qte / 100) : qte;
    const eauMl = prod.boisson ? ((prod.par100g ? prod.volumeMl * qte / 100 : prod.volumeMl * qte) || 0) : 0;
    return { kcal: Math.round(prod.kcal * factor), glucides: Math.round(prod.glucides * factor), proteines: Math.round(prod.proteines * factor), sodium: Math.round(prod.sodium * factor), eauMl: Math.round(eauMl) };
  };

  const totalPoint = pointKey => {
    const items = planNutrition[pointKey] || [];
    return items.reduce((acc, { produitId, quantite }) => {
      const p = produits.find(x => x.id === produitId);
      if (!p) return acc;
      const n = nutriProduit(p, quantite);
      return { kcal: acc.kcal + n.kcal, glucides: acc.glucides + n.glucides, proteines: acc.proteines + n.proteines, sodium: acc.sodium + n.sodium, eauMl: acc.eauMl + n.eauMl };
    }, { kcal: 0, glucides: 0, proteines: 0, sodium: 0, eauMl: 0 });
  };

  const totalEmporte = ["depart", ...ravitos.map(r => String(r.id))].reduce((acc, key) => {
    const t = totalPoint(key);
    return { kcal: acc.kcal + t.kcal, glucides: acc.glucides + t.glucides, proteines: acc.proteines + t.proteines, sodium: acc.sodium + t.sodium, eauMl: acc.eauMl + t.eauMl };
  }, { kcal: 0, glucides: 0, proteines: 0, sodium: 0, eauMl: 0 });

  const setQte = (pointKey, produitId, qte) => {
    const current = planNutrition[pointKey] || [];
    let updated;
    if (qte <= 0) {
      updated = current.filter(x => x.produitId !== produitId);
    } else {
      const exists = current.find(x => x.produitId === produitId);
      updated = exists ? current.map(x => x.produitId === produitId ? { ...x, quantite: qte } : x) : [...current, { produitId, quantite: qte }];
    }
    updPlan({ ...planNutrition, [pointKey]: updated });
  };

  const getQte = (pointKey, produitId) => (planNutrition[pointKey] || []).find(x => x.produitId === produitId)?.quantite || 0;

  // ── Besoins calculés ──
  const nutriTotals = segments.reduce((acc, seg) => {
    if (seg.type === "ravito" || seg.type === "repos") return acc;
    const n = calcNutrition(seg, settings);
    const dH = seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh : 0;
    return { kcal: acc.kcal + n.kcal, eau: acc.eau + Math.round(n.eauH * dH), glucides: acc.glucides + Math.round(n.glucidesH * dH), sel: acc.sel + Math.round(n.selH * dH) };
  }, { kcal: 0, eau: 0, glucides: 0, sel: 0 });

  const totalTime = segments.reduce((s, seg) => (seg.type === "repos" || seg.type === "ravito") ? s + (seg.dureeMin||0)*60 : s + (seg.speedKmh > 0 ? ((seg.endKm - seg.startKm) / seg.speedKmh) * 3600 : 0), 0);
  const totalDist = segments.filter(s => s.type !== "ravito" && s.type !== "repos").reduce((s, seg) => Math.max(s, seg.endKm), 0);
  const isHot = settings.heat || settings.tempC > 25;
  const waterPerHour = 500 + (settings.wind ? 100 : 0) + (isHot ? 150 : 0);

  // Zones tronçons pour le plan
  const bornes = [0, ...ravitos.map(r => r.km), totalDist].filter((v, i, a) => v !== a[i-1]);
  const zones = bornes.slice(0, -1).map((from, i) => {
    const to = bornes[i + 1];
    const label = i === 0 ? "Départ" : (ravitos[i-1]?.name || `Ravito ${i}`);
    const toLbl = i === bornes.length - 2 ? "Arrivée" : (ravitos[i]?.name || `Ravito ${i+1}`);
    const pointKey = i === 0 ? "depart" : String(ravitos[i-1]?.id);
    const segsZ = segments.filter(s => s.type !== "ravito" && s.type !== "repos" && s.startKm < to && s.endKm > from);
    const besoin = segsZ.reduce((acc, seg) => {
      const overlap = Math.min(seg.endKm, to) - Math.max(seg.startKm, from);
      const ratio = overlap / (seg.endKm - seg.startKm || 1);
      const n = calcNutrition(seg, settings);
      const dH = (seg.endKm - seg.startKm) / seg.speedKmh * ratio;
      return { kcal: acc.kcal + Math.round(n.kcalH * dH), eau: acc.eau + Math.round(n.eauH * dH), glucides: acc.glucides + Math.round(n.glucidesH * dH) };
    }, { kcal: 0, eau: 0, glucides: 0 });
    return { label, toLbl, from, to, pointKey, besoin };
  });

  const barData = segments.filter(s => s.type !== "ravito" && s.type !== "repos").map((s, i) => {
    const n = calcNutrition(s, settings);
    const dH = s.speedKmh > 0 ? (s.endKm - s.startKm) / s.speedKmh : 0;
    return { name: `S${i+1}`, eau: Math.round(n.eauH * dH), glucides: Math.round(n.glucidesH * dH) };
  });

  const gapColor = v => v >= 0 ? C.green : C.red;
  const gapLabel = (v, unit) => v >= 0 ? `+${Math.round(v)} ${unit} excédent` : `${Math.round(v)} ${unit} manque`;

  if (!segments.length) {
    return (
      <div className="anim">
        <PageTitle sub="Besoins, bibliothèque et plan de ravitaillement">Nutrition</PageTitle>
        <Empty icon="🍌" title="Aucun segment défini" sub="Définis des segments dans Stratégie de course pour calculer tes besoins nutritionnels." />
      </div>
    );
  }

  return (
    <div className="anim">
      <PageTitle sub="Besoins, bibliothèque et plan de ravitaillement">Nutrition</PageTitle>

      {/* Bandeau profil nutritionnel actif */}
      {(() => {
        const w = settings.weight || 70;
        const src = settings.kcalSource || "minetti";
        const gs = settings.garminStats;
        let flatRate;
        if (src === "garmin" && gs?.kcalPerKmFlat) flatRate = gs.kcalPerKmFlat;
        else if (src === "manual") flatRate = settings.kcalPerKm || 65;
        else flatRate = Math.round(3.6 * w * 1000 / 4184);
        const target = settings.glucidesTargetGh;
        const glucLabel = target != null ? `${target} g/h glucides` : "glucides auto";
        const srcLabel = src === "garmin" ? "Garmin perso" : src === "manual" ? "Manuel" : "Minetti";
        return (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
            padding: "10px 16px", background: C.primaryPale, borderRadius: 12, marginBottom: 20,
            border: `1px solid ${C.primary}30`, fontSize: 13,
          }}>
            <span style={{ color: C.primaryDeep }}>
              Profil actif : <strong>{flatRate} kcal/km</strong> ({srcLabel}) · <strong>{glucLabel}</strong>
            </span>
            <button onClick={() => onNavigate("parametres")} style={{
              background: "none", border: `1px solid ${C.primary}50`, borderRadius: 8,
              padding: "4px 12px", fontSize: 12, color: C.primary, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
            }}>
              ⚙️ Modifier
            </button>
          </div>
        );
      })()}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
        <KPI label="Calories estimées" value={`${nutriTotals.kcal} kcal`} icon="🔥" color={C.red} sub={`${Math.round(nutriTotals.kcal / (totalDist||1))} kcal/km`} />
        <KPI label="Eau estimée" value={`${(nutriTotals.eau/1000).toFixed(1)} L`} icon="💧" color={C.blue} sub={`${waterPerHour} mL/h visé`} />
        <KPI label="Glucides estimés" value={`${nutriTotals.glucides} g`} icon="🍌" color={C.yellow} sub={`${Math.round(nutriTotals.glucides/(totalTime/3600||1))} g/h`} />
        <KPI label="Sel estimé" value={`${nutriTotals.sel} mg`} icon="🧂" color={C.green} sub="sodium" />
      </div>

      {isHot && (
        <div style={{ background: C.yellowPale, border: `1px solid ${C.yellow}40`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: C.yellow }}>
          Forte chaleur — besoins en eau augmentés. Anticipe les ravitos.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <Card noPad>
          <div style={{ padding: "16px 20px 0", fontWeight: 600 }}>Eau & glucides par segment</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} />
              <RTooltip content={<CustomTooltip />} />
              <Bar dataKey="eau" name="Eau (mL)" fill={C.blue} radius={[3,3,0,0]} />
              <Bar dataKey="glucides" name="Glucides (g)" fill={C.yellow} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Recommandations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Hydratation", val: "Toutes les 15–20 min", detail: `${Math.round(waterPerHour/4)} mL par prise`, color: C.blue },
              { label: "Glucides", val: `${Math.round(nutriTotals.glucides/(totalTime/3600||1))} g/h`, detail: totalTime/3600 > 4 ? "Mix sucré + salé après 3h" : "Sucré seul suffisant", color: C.yellow },
              { label: "Sel", val: totalTime > 14400 ? "Indispensable" : "Recommandé", detail: totalTime > 14400 ? "Pastilles isotoniques" : "Pâtes de fruits salées", color: C.green },
              { label: "Caféine", val: totalTime > 18000 ? "Envisager" : "Optionnel", detail: totalTime > 18000 ? `Gel caféiné après km ${Math.round(totalDist*0.6)}` : "Cola aux ravitos", color: C.primary },
            ].map(r => (
              <div key={r.label} style={{ padding: "9px 12px", background: "var(--surface-2)", borderRadius: 10, borderLeft: `3px solid ${r.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--muted-c)" }}>{r.label}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: r.color }}>{r.val}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>{r.detail}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ══ SECTION 1 : BIBLIOTHÈQUE DE PRODUITS ══════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>Bibliothèque de produits</div>
          <div style={{ fontSize: 13, color: "var(--muted-c)", marginTop: 2 }}>Crée tes produits une fois, utilise-les partout</div>
        </div>
        <Btn onClick={openNewProd}>+ Produit</Btn>
      </div>

      {produits.length === 0 ? (
        <Card style={{ marginBottom: 24, textAlign: "center", color: "var(--muted-c)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏪</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Bibliothèque vide</div>
          <div style={{ fontSize: 13, marginBottom: 14 }}>Ajoute tes barres, gels et boissons pour construire ton plan.</div>
          <Btn onClick={openNewProd}>+ Ajouter un produit</Btn>
        </Card>
      ) : (
        <Card noPad style={{ marginBottom: 24 }}>
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th>Produit</th><th>Base</th><th>Poids</th><th>Kcal</th><th>Glucides</th><th>Protéines</th><th>Na (mg)</th><th></th>
              </tr></thead>
              <tbody>
                {produits.map(p => (
                  <tr key={p.id} onClick={() => openEditProd(p)} style={{ cursor: "pointer" }}>
                    <td style={{ fontWeight: 600 }}>{p.nom}</td>
                    <td style={{ color: "var(--muted-c)", fontSize: 12 }}>{p.par100g ? "/ 100g" : "/ unité"}</td>
                    <td>{p.poids > 0 ? `${p.poids} g` : "—"}</td>
                    <td style={{ color: C.red, fontWeight: 600 }}>{p.kcal} kcal</td>
                    <td style={{ color: C.yellow }}>{p.glucides} g</td>
                    <td style={{ color: "var(--muted-c)" }}>{p.proteines} g</td>
                    <td style={{ color: "var(--muted-c)" }}>{p.sodium} mg</td>
                    <td onClick={e => e.stopPropagation()}>
                      <Btn size="sm" variant="danger" onClick={() => setConfirmProdId(p.id)}>✕</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ══ SECTION 2 : PLAN DE RAVITAILLEMENT ════════════════════════════════ */}
      {produits.length > 0 && (
        <>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Plan de ravitaillement</div>
          <div style={{ fontSize: 13, color: "var(--muted-c)", marginBottom: 16 }}>Définis ce que tu emportes à chaque point</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
            {zones.map(zone => {
              const ptTotal = totalPoint(zone.pointKey);
              const gapKcal = ptTotal.kcal - zone.besoin.kcal;
              const gapGlu  = ptTotal.glucides - zone.besoin.glucides;
              return (
                <Card key={zone.pointKey} style={{ borderLeft: `4px solid ${zone.pointKey === "depart" ? C.primary : C.green}` }}>
                  {/* En-tête zone */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {zone.pointKey === "depart" ? "🏁" : "🥤"} {zone.label}
                        <span style={{ fontSize: 12, color: "var(--muted-c)", fontWeight: 400, marginLeft: 8 }}>→ {zone.toLbl} · {(zone.to - zone.from).toFixed(1)} km</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 3 }}>
                        Besoin : {zone.besoin.kcal} kcal · {zone.besoin.glucides} g glucides · {zone.besoin.eau >= 1000 ? `${(zone.besoin.eau/1000).toFixed(1)} L` : `${zone.besoin.eau} mL`} eau
                      </div>
                    </div>
                    {ptTotal.kcal > 0 && (
                      <div style={{ textAlign: "right", fontSize: 12 }}>
                        <div style={{ fontWeight: 700, color: gapColor(gapKcal), fontSize: 13 }}>{gapLabel(gapKcal, "kcal")}</div>
                        <div style={{ color: gapColor(gapGlu) }}>{gapLabel(gapGlu, "g gluc.")}</div>
                      </div>
                    )}
                  </div>

                  {/* Sélection produits */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {produits.map(p => {
                      const qte = getQte(zone.pointKey, p.id);
                      const n = qte > 0 ? nutriProduit(p, qte) : null;
                      return (
                        <div key={p.id} style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                          borderRadius: 10, background: qte > 0 ? C.green + "14" : "var(--surface-2)",
                          border: `1px solid ${qte > 0 ? C.green + "40" : "var(--border-c)"}`,
                          transition: "all 0.15s",
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nom}</div>
                            <div style={{ fontSize: 11, color: "var(--muted-c)" }}>
                              {p.kcal} kcal · {p.glucides}g glucides{p.par100g ? ` / 100g` : ` / unité`}
                            </div>
                          </div>
                          {/* Quantité */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            {qte > 0 && (
                              <div style={{ fontSize: 11, color: C.green, fontWeight: 600, whiteSpace: "nowrap" }}>
                                → {n.kcal} kcal · {n.glucides}g
                              </div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <button onClick={() => setQte(zone.pointKey, p.id, Math.max(0, qte - 1))} style={{
                                width: 26, height: 26, border: "1px solid var(--border-c)", borderRadius: 6,
                                background: "var(--surface)", cursor: "pointer", fontWeight: 700, fontSize: 14,
                                color: "var(--text-c)", fontFamily: "inherit",
                              }}>−</button>
                              <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700, fontSize: 14 }}>{qte}</span>
                              <button onClick={() => setQte(zone.pointKey, p.id, qte + 1)} style={{
                                width: 26, height: 26, border: "1px solid var(--border-c)", borderRadius: 6,
                                background: qte > 0 ? C.green : "var(--surface)", cursor: "pointer", fontWeight: 700, fontSize: 14,
                                color: qte > 0 ? "#fff" : "var(--text-c)", fontFamily: "inherit", transition: "all 0.15s",
                              }}>+</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total zone */}
                  {ptTotal.kcal > 0 && (
                    <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8, display: "flex", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
                      <span>Total emporté :</span>
                      <span style={{ color: C.red, fontWeight: 600 }}>{ptTotal.kcal} kcal</span>
                      <span style={{ color: C.yellow, fontWeight: 600 }}>{ptTotal.glucides} g glucides</span>
                      <span style={{ color: C.primary, fontWeight: 600 }}>{ptTotal.proteines} g protéines</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Gap analysis global */}
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Bilan global</div>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              {[
                { label: "Calories", besoin: nutriTotals.kcal, emporte: totalEmporte.kcal, unit: "kcal", color: C.red, icon: "🔥" },
                { label: "Glucides", besoin: nutriTotals.glucides, emporte: totalEmporte.glucides, unit: "g", color: C.yellow, icon: "🍌" },
                { label: "Protéines", besoin: null, emporte: totalEmporte.proteines, unit: "g", color: C.primary, icon: "💪" },
                { label: "Sodium", besoin: nutriTotals.sel, emporte: totalEmporte.sodium, unit: "mg", color: C.green, icon: "🧂" },
                { label: "Eau (boissons)", besoin: nutriTotals.eau, emporte: totalEmporte.eauMl, unit: "mL", color: C.blue, icon: "💧" },
              ].map(item => {
                const gap = item.besoin !== null ? item.emporte - item.besoin : null;
                const pct = item.besoin ? Math.min((item.emporte / item.besoin) * 100, 150) : 100;
                const barColor = gap === null ? C.primary : gap >= 0 ? C.green : C.red;
                return (
                  <div key={item.label} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "var(--muted-c)" }}>{item.icon} {item.label}</span>
                      {gap !== null && <span style={{ fontSize: 12, fontWeight: 700, color: gapColor(gap) }}>{gapLabel(gap, item.unit)}</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--muted-c)" }}>Emporté</span>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: barColor }}>{item.emporte} {item.unit}</span>
                    </div>
                    {item.besoin !== null && (
                      <>
                        <div style={{ height: 6, background: "var(--surface)", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.4s" }} />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted-c)" }}>Besoin estimé : {item.besoin} {item.unit}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* Modal produit */}
      <Modal open={prodModal} onClose={() => setProdModal(false)} title={editProdId ? "Modifier le produit" : "Ajouter un produit"}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[{ v: true, l: "Valeurs pour 100g / 100mL" }, { v: false, l: "Valeurs à l'unité" }].map(o => (
            <div key={String(o.v)} onClick={() => updP("par100g", o.v)} style={{
              flex: 1, padding: "8px 12px", borderRadius: 10, cursor: "pointer", textAlign: "center",
              border: `2px solid ${prodForm.par100g === o.v ? C.primary : "var(--border-c)"}`,
              background: prodForm.par100g === o.v ? C.primaryPale : "var(--surface-2)",
              fontSize: 13, fontWeight: prodForm.par100g === o.v ? 600 : 400,
              color: prodForm.par100g === o.v ? C.primaryDeep : "var(--text-c)",
            }}>{o.l}</div>
          ))}
        </div>
        <div className="form-grid">
          <Field label="Nom du produit" full><input value={prodForm.nom} onChange={e => updP("nom", e.target.value)} placeholder="Ex : Barre Trail Power" autoFocus /></Field>
          <Field label={prodForm.par100g ? "Poids unitaire (g)" : "Poids (g)"}><input type="number" min={0} value={prodForm.poids} onChange={e => updP("poids", e.target.value)} /></Field>
          <Field label="Kcal"><input type="number" min={0} value={prodForm.kcal} onChange={e => updP("kcal", e.target.value)} /></Field>
          <Field label="Glucides (g)"><input type="number" min={0} value={prodForm.glucides} onChange={e => updP("glucides", e.target.value)} /></Field>
          <Field label="Protéines (g)"><input type="number" min={0} value={prodForm.proteines} onChange={e => updP("proteines", e.target.value)} /></Field>
          <Field label="Lipides (g)"><input type="number" min={0} value={prodForm.lipides} onChange={e => updP("lipides", e.target.value)} /></Field>
          <Field label="Sodium (mg)"><input type="number" min={0} value={prodForm.sodium} onChange={e => updP("sodium", e.target.value)} /></Field>
          <Field label="Potassium (mg)"><input type="number" min={0} value={prodForm.potassium} onChange={e => updP("potassium", e.target.value)} /></Field>
          <Field label="Magnésium (mg)"><input type="number" min={0} value={prodForm.magnesium} onChange={e => updP("magnesium", e.target.value)} /></Field>
          <Field label="Zinc (mg)"><input type="number" min={0} value={prodForm.zinc} onChange={e => updP("zinc", e.target.value)} /></Field>
          <Field label="Calcium (mg)"><input type="number" min={0} value={prodForm.calcium} onChange={e => updP("calcium", e.target.value)} /></Field>
          <Field label="C'est une boisson" full>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <div onClick={() => updP("boisson", !prodForm.boisson)} style={{
                width: 40, height: 22, borderRadius: 11, cursor: "pointer", transition: "background 0.2s", position: "relative",
                background: prodForm.boisson ? C.blue : "var(--border-c)", flexShrink: 0,
              }}>
                <div style={{ position: "absolute", top: 3, left: prodForm.boisson ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
              <span style={{ fontSize: 13, color: "var(--muted-c)" }}>Compte dans le total eau</span>
            </div>
          </Field>
          {prodForm.boisson && (
            <Field label={prodForm.par100g ? "Volume (mL / 100g)" : "Volume par unité (mL)"}>
              <input type="number" min={0} value={prodForm.volumeMl} onChange={e => updP("volumeMl", e.target.value)} placeholder="Ex : 500" />
            </Field>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setProdModal(false)}>Annuler</Btn>
          <Btn onClick={saveProd}>Enregistrer</Btn>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmProdId} message="Supprimer ce produit de la bibliothèque ?" onConfirm={() => { updProduits(produits.filter(p => p.id !== confirmProdId)); setConfirmProdId(null); }} onCancel={() => setConfirmProdId(null)} />
    </div>
  );
}


// ─── VUE TEAM ────────────────────────────────────────────────────────────────
function wazeUrl(query) {
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
}

function TeamView({ race, setRace, segments, setSegments, settings, setSettings, sharedMode, installPrompt, onInstall, onLoadStrategy, isMobile }) {
  const [realTimes, setRealTimes] = useState({});
  const [activeRavito, setActiveRavito] = useState(null);
  const [sosActive, setSosActive] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);


  const ravitos = [...(race.ravitos || [])].sort((a, b) => a.km - b.km);
  const { times: passingTimes } = calcPassingTimes(segments, settings.startTime);

  // Map segIndex → ravito pour retrouver les heures théoriques
  const ravitoSegs = segments
    .map((seg, i) => ({ seg, i }))
    .filter(({ seg }) => seg.type === "ravito");

  const getTheoSec = ravitoId => {
    const entry = ravitoSegs.find(({ seg }) => seg.ravitoId === ravitoId);
    return entry ? passingTimes[entry.i] : null;
  };

  // ── Recalibration vitesse Option B ──────────────────────────────────────────
  // On cherche les deux derniers ravitos avec heure réelle saisie
  // pour calculer un coefficient de vitesse réelle vs théorique
  const realEntries = ravitos.filter(rv => realTimes[rv.id]);

  // Coefficient vitesse : temps réel entre 2 ravitos / temps théo entre ces 2 ravitos
  // Si on n'a qu'un seul ravito réel → fallback décalage fixe
  const speedCoeff = (() => {
    if (realEntries.length >= 2) {
      const prev = realEntries[realEntries.length - 2];
      const last = realEntries[realEntries.length - 1];
      const prevTheo = getTheoSec(prev.id);
      const lastTheo = getTheoSec(last.id);
      if (!prevTheo || !lastTheo || lastTheo === prevTheo) return null;
      const prevParts = realTimes[prev.id].split(":").map(Number);
      const lastParts = realTimes[last.id].split(":").map(Number);
      const prevReal = prevParts[0] * 3600 + prevParts[1] * 60;
      const lastReal = lastParts[0] * 3600 + lastParts[1] * 60;
      const realDuration = lastReal - prevReal;
      const theoDuration = lastTheo - prevTheo;
      if (theoDuration <= 0 || realDuration <= 0) return null;
      return realDuration / theoDuration; // >1 = plus lent, <1 = plus rapide
    }
    return null; // pas assez de données pour recalibrer
  })();

  // Heure réelle au dernier ravito renseigné (point d'ancrage)
  const anchorRavito = realEntries[realEntries.length - 1] || null;
  const anchorSec = anchorRavito ? (() => {
    const parts = realTimes[anchorRavito.id].split(":").map(Number);
    return parts[0] * 3600 + parts[1] * 60;
  })() : null;
  const anchorTheo = anchorRavito ? getTheoSec(anchorRavito.id) : null;

  const getAdjustedSec = ravitoId => {
    const theo = getTheoSec(ravitoId);
    if (!theo) return null;
    if (!anchorRavito || !anchorSec || !anchorTheo) return theo;

    // Ce ravito est-il avant ou après l'ancre ?
    const anchorIdx = ravitos.findIndex(rv => rv.id === anchorRavito.id);
    const thisIdx   = ravitos.findIndex(rv => rv.id === ravitoId);

    if (thisIdx <= anchorIdx) {
      // Déjà passé — on renvoie l'heure réelle si disponible, sinon théo + delta fixe
      if (realTimes[ravitoId]) {
        const p = realTimes[ravitoId].split(":").map(Number);
        return p[0] * 3600 + p[1] * 60;
      }
      return theo + (anchorSec - anchorTheo);
    }

    // Ravito futur — recalibrer avec coefficient vitesse si disponible
    const timeFromAnchor = theo - anchorTheo; // durée théo depuis l'ancre
    if (speedCoeff !== null) {
      return anchorSec + timeFromAnchor * speedCoeff;
    }
    // Fallback : décalage fixe
    return theo + (anchorSec - anchorTheo);
  };

  // Heure d'arrivée recalibrée (dernier temps passingTimes + correction)
  const getAdjustedArrival = () => {
    const theoArrival = passingTimes[passingTimes.length - 1];
    if (!theoArrival) return null;
    if (!anchorRavito || !anchorSec || !anchorTheo) return theoArrival;
    const timeFromAnchor = theoArrival - anchorTheo;
    if (speedCoeff !== null) return anchorSec + timeFromAnchor * speedCoeff;
    return theoArrival + (anchorSec - anchorTheo);
  };

  const adjustedArrival = getAdjustedArrival();

  const getDelta = ravitoId => {
    const theo = getTheoSec(ravitoId);
    const adj  = getAdjustedSec(ravitoId);
    if (!theo || !adj) return 0;
    return adj - theo; // positif = retard, négatif = avance
  };

  const fmtDelta = sec => {
    if (Math.abs(sec) < 60) return "Dans les temps";
    const sign = sec > 0 ? "+" : "-";
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    return `${sign}${m} min`;
  };

  const deltaColor = sec => {
    if (Math.abs(sec) < 120) return C.green;
    if (sec > 0) return C.red;
    return C.blue;
  };

  // Prochain ravito non encore passé
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60;
  const nextRavito = ravitos.find(rv => {
    const t = getAdjustedSec(rv.id) || getTheoSec(rv.id);
    return t && t > nowSec;
  });

  const nextRavitoSec = nextRavito
    ? (getAdjustedSec(nextRavito.id) || getTheoSec(nextRavito.id))
    : null;
  const minutesToNext = nextRavitoSec
    ? Math.max(0, Math.round((nextRavitoSec - nowSec) / 60))
    : null;

  // Nutrition pour un ravito (segments entre le précédent et ce ravito)
  const getNutritionForRavito = rv => {
    const rvIdx = ravitos.indexOf(rv);
    const prevKm = rvIdx === 0 ? 0 : ravitos[rvIdx - 1].km;
    const segsZone = segments.filter(s =>
      s.type !== "ravito" && s.type !== "repos" &&
      s.startKm >= prevKm && s.endKm <= rv.km
    );
    return segsZone.reduce((acc, seg) => {
      const n = calcNutrition(seg, settings);
      const dH = (seg.endKm - seg.startKm) / seg.speedKmh;
      return { eau: acc.eau + Math.round(n.eauH * dH), glucides: acc.glucides + Math.round(n.glucidesH * dH), kcal: acc.kcal + n.kcal };
    }, { eau: 0, glucides: 0, kcal: 0 });
  };

  // SOS géoloc
  const handleSOS = () => {
    setSosActive(true);
    const share = (msg) => {
      if (navigator.share) {
        navigator.share({ title: "🆘 SOS Alex", text: msg }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(msg)
          .then(() => alert("Message SOS copié — colle-le dans ton appli de messagerie."))
          .catch(() => alert(msg));
      }
      setTimeout(() => setSosActive(false), 3000);
    };

    navigator.geolocation?.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsCoords({ lat: latitude, lon: longitude, acc: Math.round(accuracy) });
        const msg = `🆘 SOS — Position de ${settings.name || "coureur"} via l'appli Alex.\n\nJe suis localisé à cet endroit :\nhttps://maps.google.com/?q=${latitude},${longitude}\n(±${Math.round(accuracy)}m)\n\nCourse : ${settings.raceName || race.name || "?"}`;
        share(msg);
      },
      () => {
        const msg = `🆘 SOS — ${settings.name || "Coureur"} a besoin d'aide.\n\nCourse : ${settings.raceName || race.name || "?"}\nPosition GPS non disponible.`;
        share(msg);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const copyAddress = addr => {
    navigator.clipboard?.writeText(addr).catch(() => {});
  };

  if (!segments.length && !ravitos.length) {
    return (
      <div className="anim">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <PageTitle sub="Vue assistance — ravitos, horaires, préparation">Team</PageTitle>
          <label style={{ display: "flex", alignItems: "center", flexShrink: 0, cursor: "pointer", marginTop: 4 }}>
            <div style={{
              background: C.primaryPale, border: `1px solid ${C.primary}50`,
              color: C.primaryDeep, borderRadius: 14, padding: "10px 16px",
              fontWeight: 700, fontSize: 13,
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              📋 Charger stratégie
            </div>
            <input type="file" accept=".json" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  try {
                    const d = JSON.parse(ev.target.result);
                    onLoadStrategy(d);
                  } catch { alert("Fichier JSON invalide."); }
                };
                reader.readAsText(file);
                e.target.value = "";
              }} />
          </label>
        </div>
        <Empty icon="👥" title="Aucune stratégie définie"
          sub="Charge une stratégie via le bouton ci-dessus, ou définis des segments dans l'onglet Profil de course." />
      </div>
    );
  }

  return (
    <div className="anim">

      {/* Bannière installation pour l'assistant */}
      {sharedMode && !window.matchMedia("(display-mode: standalone)").matches && (
        <div style={{
          background: `linear-gradient(135deg, ${C.primary}18, ${C.primaryPale})`,
          border: `1px solid ${C.primary}40`, borderRadius: 16,
          padding: "16px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              📲 Installe Alex sur ton téléphone
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-c)", lineHeight: 1.5 }}>
              Accède à la stratégie hors-ligne en montagne et suis le coureur en temps réel.
            </div>
          </div>
          <button onClick={onInstall} style={{
            background: C.primary, color: "#fff", border: "none",
            borderRadius: 12, padding: "10px 18px", cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            flexShrink: 0,
          }}>
            Installer gratuitement
          </button>
        </div>
      )}

      {/* Header + SOS + Partage */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-start", gap: isMobile ? 10 : 0, marginBottom: 24 }}>
        <PageTitle sub={`${ravitos.length} ravito${ravitos.length > 1 ? "s" : ""} · départ ${settings.startTime || "07:00"}`}>
          {settings.raceName || race.name || "Team"}
        </PageTitle>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8, marginTop: isMobile ? 0 : 4, flexShrink: 0 }}>

          {/* Bouton charger stratégie — file picker JSON, toujours visible */}
          <label style={{ display: "flex", alignItems: "center", flexShrink: 0, cursor: "pointer" }}>
            <div style={{
              background: C.primaryPale, border: `1px solid ${C.primary}50`,
              color: C.primaryDeep, borderRadius: 14, padding: "10px 16px",
              fontWeight: 700, fontSize: 13, width: isMobile ? "100%" : "auto",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              📋 Charger stratégie
            </div>
            <input type="file" accept=".json" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  try {
                    const d = JSON.parse(ev.target.result);
                    onLoadStrategy(d);
                  } catch { alert("Fichier JSON invalide."); }
                };
                reader.readAsText(file);
                e.target.value = "";
              }} />
          </label>

          {/* Bouton partager — côté coureur uniquement, génère JSON + ouvre SMS */}
          {!sharedMode && (
            <button onClick={() => {
              const nom = settings.raceName || race.name || "ma-course";
              const filename = `alex-${nom.toLowerCase().replace(/\s+/g, "-")}.json`;
              const blob = new Blob([JSON.stringify({ race, segments, settings })], { type: "application/json" });
              const file = new File([blob], filename, { type: "application/json" });
              const appUrl = window.location.origin + window.location.pathname;

              const smsMsg = `Voici ma stratégie de course pour ${settings.raceName || race.name || "ma course"} 🏔️\n\n1- Télécharge le fichier JSON que je t'envoie\n2- Va sur Alex : ${appUrl}\n3- Onglet "Team"\n4- Clique sur "Charger stratégie" et sélectionne le fichier`;

              const doShare = () => {
                // Ouvrir le share sheet avec le message texte
                if (navigator.share) {
                  navigator.share({ title: `Stratégie Alex — ${nom}`, text: smsMsg })
                    .catch(() => {
                      // Fallback SMS
                      window.location.href = `sms:?body=${encodeURIComponent(smsMsg)}`;
                    });
                } else {
                  window.location.href = `sms:?body=${encodeURIComponent(smsMsg)}`;
                }
              };

              // D'abord télécharger le JSON, puis ouvrir le share
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                // Android moderne : partage direct avec fichier joint
                navigator.share({ title: `Stratégie Alex — ${nom}`, text: smsMsg, files: [file] })
                  .catch(() => {
                    // Fallback : télécharger + message séparé
                    const u = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = u; a.download = filename; a.click();
                    URL.revokeObjectURL(u);
                    setTimeout(doShare, 800);
                  });
              } else {
                // Télécharger le JSON puis ouvrir le message
                const u = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = u; a.download = filename; a.click();
                URL.revokeObjectURL(u);
                setTimeout(doShare, 800);
              }
            }} style={{
              background: C.green + "18", border: `1px solid ${C.green}50`,
              color: C.green, borderRadius: 14, padding: "10px 16px",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              width: isMobile ? "100%" : "auto",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              📤 Partager
            </button>
          )}
          <button onClick={handleSOS} style={{
            background: sosActive ? C.red + "cc" : C.red,
            color: "#fff", border: "none", borderRadius: 14, padding: "10px 18px",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: isMobile ? "100%" : "auto",
            boxShadow: `0 4px 16px ${C.red}50`, transition: "all 0.2s",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            🆘 SOS Position
          </button>
        </div>
      </div>

      {gpsCoords && (
        <div style={{ background: C.red + "18", border: `1px solid ${C.red}40`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          Position envoyée : <strong>{gpsCoords.lat.toFixed(5)}, {gpsCoords.lon.toFixed(5)}</strong> (±{gpsCoords.acc}m)
        </div>
      )}

      {/* Adresses départ / arrivée */}
      {(race.startAddress || race.endAddress) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {race.startAddress && (
            <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 12, borderLeft: `3px solid ${C.green}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.green, marginBottom: 4 }}>Départ</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{race.startAddress}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => copyAddress(race.startAddress)} style={{ background: "none", border: `1px solid var(--border-c)`, borderRadius: 8, padding: "3px 8px", fontSize: 11, cursor: "pointer", color: "var(--text-c)" }}>📋 Copier</button>
                <a href={wazeUrl(race.startAddress)} target="_blank" rel="noreferrer" style={{ background: "#05C8F7", color: "#fff", borderRadius: 8, padding: "3px 8px", fontSize: 11, textDecoration: "none", fontWeight: 600 }}>🚗 Waze</a>
              </div>
            </div>
          )}
          {(race.endAddress || race.sameAddress) && (
            <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 12, borderLeft: `3px solid ${C.primary}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.primary, marginBottom: 4 }}>Arrivée</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{race.sameAddress ? race.startAddress : race.endAddress}</div>
              {race.sameAddress && <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 2 }}>Même lieu que le départ</div>}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => copyAddress(race.sameAddress ? race.startAddress : race.endAddress)} style={{ background: "none", border: `1px solid var(--border-c)`, borderRadius: 8, padding: "3px 8px", fontSize: 11, cursor: "pointer", color: "var(--text-c)" }}>📋 Copier</button>
                <a href={wazeUrl(race.sameAddress ? race.startAddress : race.endAddress)} target="_blank" rel="noreferrer" style={{ background: "#05C8F7", color: "#fff", borderRadius: 8, padding: "3px 8px", fontSize: 11, textDecoration: "none", fontWeight: 600 }}>🚗 Waze</a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Statut global */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: anchorRavito ? 12 : 24 }}>
        <KPI label="Départ" value={settings.startTime || "07:00"} icon="🏁" />
        <KPI
          label="Arrivée estimée"
          value={fmtHeure(adjustedArrival || passingTimes[passingTimes.length - 1] || 0)}
          icon="🏆" color={C.primary}
          sub={adjustedArrival && adjustedArrival !== passingTimes[passingTimes.length - 1]
            ? `Théo. ${fmtHeure(passingTimes[passingTimes.length - 1] || 0)}`
            : undefined}
        />
        {nextRavito && minutesToNext !== null && (
          <KPI label={`Prochain : ${nextRavito.name}`} value={`~${minutesToNext} min`}
            icon="🥤" color={minutesToNext < 20 ? C.red : C.yellow}
            sub={`Arrivée théo. ${fmtHeure(getAdjustedSec(nextRavito.id) || getTheoSec(nextRavito.id) || 0)}`} />
        )}
        {anchorRavito && (() => {
          const d = getDelta(anchorRavito.id);
          return <KPI label="Écart actuel" value={fmtDelta(d)} icon={d > 120 ? "🐢" : d < -120 ? "⚡" : "✅"} color={deltaColor(d)} sub={`depuis ${anchorRavito.name}`} />;
        })()}
      </div>

      {/* Bandeau recalibration vitesse */}
      {speedCoeff !== null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
          padding: "10px 14px", borderRadius: 12,
          background: speedCoeff > 1.05 ? C.red + "15" : speedCoeff < 0.95 ? C.blue + "15" : C.green + "15",
          border: `1px solid ${speedCoeff > 1.05 ? C.red : speedCoeff < 0.95 ? C.blue : C.green}30`,
        }}>
          <span style={{ fontSize: 18 }}>{speedCoeff > 1.05 ? "🐢" : speedCoeff < 0.95 ? "⚡" : "✅"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: speedCoeff > 1.05 ? C.red : speedCoeff < 0.95 ? C.blue : C.green }}>
              {speedCoeff > 1.05
                ? `Allure −${Math.round((speedCoeff - 1) * 100)}% — prévisions ajustées`
                : speedCoeff < 0.95
                  ? `Allure +${Math.round((1 - speedCoeff) * 100)}% — prévisions ajustées`
                  : "Allure conforme — prévisions fiables"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 1 }}>
              Basé sur {realEntries[realEntries.length-2]?.name} → {anchorRavito.name}
            </div>
          </div>
        </div>
      )}

      {/* Ravitos */}
      {ravitos.length === 0 ? (
        <div style={{ background: C.yellowPale, border: `1px solid ${C.yellow}40`, borderRadius: 12, padding: "14px 18px", fontSize: 13, color: C.yellow, marginBottom: 20 }}>
          Aucun ravitaillement défini — ajoute-en dans l'onglet Profil de course.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {ravitos.map((rv, ri) => {
            const theoSec  = getTheoSec(rv.id);
            const adjSec   = getAdjustedSec(rv.id);
            const delta    = getDelta(rv.id);
            const isOpen   = activeRavito === rv.id;
            const realVal  = realTimes[rv.id] || "";
            const night    = theoSec ? isNight(adjSec || theoSec) : false;

            return (
              <Card key={rv.id} style={{ borderLeft: `4px solid ${rv.assistancePresente === false ? C.muted : (isOpen ? C.primary : C.green)}`, opacity: rv.assistancePresente === false ? 0.7 : 1 }}>
                {/* En-tête ravito */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setActiveRavito(isOpen ? null : rv.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18 }}>
                        🥤 {rv.name}
                      </span>
                      <span className="badge badge-sage" style={{ fontSize: 12 }}>km {rv.km}</span>
                      {night && <span style={{ fontSize: 12 }}>🌙</span>}
                      {rv.assistancePresente === false && (
                        <span style={{ fontSize: 11, background: "var(--surface-2)", color: "var(--muted-c)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>Autonome</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--muted-c)", flexWrap: "wrap" }}>
                      <span>Théo. <strong style={{ color: "var(--text-c)" }}>{theoSec ? fmtHeure(theoSec) : "--:--"}</strong></span>
                      {adjSec && adjSec !== theoSec && (
                        <span>Ajusté <strong style={{ color: deltaColor(delta) }}>{fmtHeure(adjSec)}</strong></span>
                      )}
                      {Math.abs(delta) >= 60 && (
                        <span style={{ color: deltaColor(delta), fontWeight: 600 }}>{fmtDelta(delta)}</span>
                      )}
                      <span>Arrêt {settings.ravitoTimeMin || 3} min</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2, flexShrink: 0 }}>
                    {/* Toggle assistance */}
                    {!sharedMode && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--muted-c)" }}>Assistance</span>
                        <div onClick={e => {
                          e.stopPropagation();
                          setRace(r => ({ ...r, ravitos: r.ravitos.map(x => x.id === rv.id ? { ...x, assistancePresente: x.assistancePresente === false ? true : false } : x) }));
                        }} style={{
                          width: 36, height: 20, borderRadius: 10, cursor: "pointer", transition: "background 0.2s", position: "relative",
                          background: rv.assistancePresente === false ? "var(--border-c)" : C.green,
                        }}>
                          <div style={{ position: "absolute", top: 2, left: rv.assistancePresente === false ? 2 : 18, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                        </div>
                      </div>
                    )}
                    <span style={{ fontSize: 18, color: "var(--muted-c)", cursor: "pointer" }} onClick={() => setActiveRavito(isOpen ? null : rv.id)}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Heure réelle de passage */}
                    <div style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>Heure réelle de passage</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <input type="time" value={realVal}
                          onChange={e => setRealTimes(t => ({ ...t, [rv.id]: e.target.value }))}
                          style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Playfair Display', serif", padding: "8px 12px", borderRadius: 10, border: `2px solid ${realVal ? C.primary : "var(--border-c)"}`, background: "var(--surface)", color: "var(--text-c)", cursor: "pointer" }} />
                        {realVal && (
                          <div style={{ fontSize: 13 }}>
                            <span style={{ color: deltaColor(delta), fontWeight: 700, fontSize: 15 }}>{fmtDelta(delta)}</span>
                            <div style={{ color: "var(--muted-c)", fontSize: 12, marginTop: 2 }}>Heures suivantes recalculées</div>
                          </div>
                        )}
                        {realVal && (
                          <button onClick={() => setRealTimes(t => { const n = { ...t }; delete n[rv.id]; return n; })}
                            style={{ background: "none", border: "none", color: "var(--muted-c)", cursor: "pointer", fontSize: 18 }}>✕</button>
                        )}
                      </div>
                    </div>

                    {/* Adresse */}
                    {rv.address ? (
                      <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>Adresse</span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => copyAddress(rv.address)} style={{ background: "none", border: `1px solid var(--border-c)`, borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--text-c)" }}>
                              📋 Copier
                            </button>
                            <a href={wazeUrl(rv.address)} target="_blank" rel="noreferrer"
                              style={{ background: "#05C8F7", color: "#fff", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", textDecoration: "none", fontWeight: 600 }}>
                              🚗 Waze
                            </a>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--muted-c)" }}>{rv.address}</div>
                      </div>
                    ) : (
                      <div style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 13, color: "var(--muted-c)", fontStyle: "italic" }}>
                        Aucune adresse — modifie ce ravito dans l'onglet Profil pour en ajouter une.
                      </div>
                    )}

                    {/* Ravito à préparer */}
                    {(() => {
                      const pointKey = String(rv.id);
                      const items = (race.planNutrition?.[pointKey] || []);
                      const produits = settings.produits || [];
                      if (!items.length) return (
                        <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 12, fontSize: 13, color: "var(--muted-c)", fontStyle: "italic" }}>
                          Aucun produit planifié — configure le plan dans l'onglet Nutrition.
                        </div>
                      );
                      return (
                        <div style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>Ravito à préparer</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {items.map(({ produitId, quantite }) => {
                              const p = produits.find(x => x.id === produitId);
                              if (!p) return null;
                              return (
                                <div key={produitId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "var(--surface)", borderRadius: 8, fontSize: 13 }}>
                                  <span style={{ fontWeight: 600 }}>{p.nom}</span>
                                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <span style={{ color: "var(--muted-c)", fontSize: 12 }}>× {quantite}</span>
                                    <span style={{ color: C.red, fontWeight: 600, fontSize: 12 }}>
                                      {p.par100g ? Math.round(p.kcal * p.poids * quantite / 100) : Math.round(p.kcal * quantite)} kcal
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Notes */}
                    {rv.notes && (
                      <div style={{ padding: "12px 16px", background: C.primaryPale, borderRadius: 12, fontSize: 13, borderLeft: `3px solid ${C.primary}` }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Notes</div>
                        <div style={{ color: "var(--muted-c)" }}>{rv.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Segments après dernier ravito */}
      {ravitos.length > 0 && (() => {
        const lastRv = ravitos[ravitos.length - 1];
        const segsAfter = segments.filter(s => s.type !== "ravito" && s.type !== "repos" && s.startKm >= lastRv.km);
        if (!segsAfter.length) return null;
        const theoArrival = passingTimes[passingTimes.length - 1];
        return (
          <Card style={{ marginTop: 16, borderLeft: `4px solid ${C.primary}` }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🏁 Dernier tronçon → Arrivée</div>
            <div style={{ fontSize: 13, color: "var(--muted-c)", marginTop: 4 }}>
              {(segsAfter[segsAfter.length-1]?.endKm - lastRv.km).toFixed(1)} km restants depuis {lastRv.name}
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
              {adjustedArrival && adjustedArrival !== theoArrival ? (
                <>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 2 }}>Arrivée ajustée</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 22, color: C.primary }}>
                      {fmtHeure(adjustedArrival)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 2 }}>Théorique</div>
                    <div style={{ fontSize: 16, color: "var(--muted-c)", fontWeight: 500, marginTop: 4 }}>
                      {fmtHeure(theoArrival)}
                    </div>
                  </div>
                </>
              ) : theoArrival ? (
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 2 }}>Arrivée estimée</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 22, color: C.primary }}>
                    {fmtHeure(theoArrival)}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}

// ─── VUE MES COURSES ─────────────────────────────────────────────────────────
function MesCoursesView({ courses, onLoad, onDelete, onUpdate, onOverwrite, onSaveCurrent, race, segments, settings }) {
  const [confirmId, setConfirmId] = useState(null);
  const [confirmOverwriteId, setConfirmOverwriteId] = useState(null);
  const hasCurrentRace = race.gpxPoints?.length > 0 || segments.length > 0;

  return (
    <div className="anim">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <PageTitle sub={`${courses.length} stratégie${courses.length > 1 ? "s" : ""} sauvegardée${courses.length > 1 ? "s" : ""}`}>
          Mes courses
        </PageTitle>
        {hasCurrentRace && (
          <Btn onClick={onSaveCurrent} style={{ marginTop: 4, flexShrink: 0 }}>
            💾 Sauvegarder la course actuelle
          </Btn>
        )}
      </div>

      {courses.length === 0 ? (
        <Empty icon="📚" title="Aucune stratégie sauvegardée"
          sub={hasCurrentRace ? "Clique sur \"Sauvegarder la course actuelle\" pour l'ajouter ici." : "Prépare une course et sauvegarde-la ici pour la retrouver plus tard."}
          action={hasCurrentRace ? <Btn onClick={onSaveCurrent}>💾 Sauvegarder</Btn> : null}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {courses.map(c => {
            const date = new Date(c.savedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
            const time = new Date(c.savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            return (
              <Card key={c.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Nom + date */}
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-c)" }}>
                    {c.updatedAt
                      ? `Mis à jour le ${new Date(c.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à ${new Date(c.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                      : `Sauvegardée le ${date} à ${time}`
                    }
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Distance", value: c.distance ? `${c.distance.toFixed(1)} km` : "—" },
                    { label: "D+", value: c.elevPos ? `${Math.round(c.elevPos)} m` : "—" },
                    { label: "Segments", value: c.segCount || "—" },
                    { label: "Départ", value: c.startTime || "—" },
                    { label: "Temps estimé", value: c.totalTime ? fmtTime(c.totalTime) : "—" },
                    { label: "Ravitos", value: c.race?.ravitos?.length || 0 },
                  ].map(s => (
                    <div key={s.label} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Commentaire */}
                <div>
                  <textarea
                    value={c.comment || ""}
                    onChange={e => onUpdate(c.id, { comment: e.target.value })}
                    placeholder="Commentaire : stratégie ambitieuse, V1, sans glucides..."
                    rows={2}
                    style={{ fontSize: 12, resize: "none", lineHeight: 1.5 }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <Btn onClick={() => onLoad(c)} style={{ flex: 1, justifyContent: "center" }}>
                    Charger
                  </Btn>
                  {hasCurrentRace && (
                    <Btn variant="soft" size="sm" onClick={() => setConfirmOverwriteId(c.id)} title="Écraser avec la version actuelle">
                      ↻
                    </Btn>
                  )}
                  <Btn variant="danger" size="sm" onClick={() => setConfirmId(c.id)}>✕</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmId}
        message="Supprimer cette stratégie définitivement ?"
        onConfirm={() => { onDelete(confirmId); setConfirmId(null); }}
        onCancel={() => setConfirmId(null)}
      />
      <ConfirmDialog
        open={!!confirmOverwriteId}
        message="Écraser cette stratégie avec la version en cours ? L'ancienne sera perdue."
        onConfirm={() => { onOverwrite(confirmOverwriteId); setConfirmOverwriteId(null); }}
        onCancel={() => setConfirmOverwriteId(null)}
      />
    </div>
  );
}

const NAVS = [
  { id: "profil",      label: "Profil de course",    icon: "🗺️" },
  { id: "preparation", label: "Stratégie de course",  icon: "🎯" },
  { id: "nutrition",   label: "Nutrition",            icon: "🍌" },
  { id: "team",        label: "Team",                 icon: "👥" },
  { id: "courses",     label: "Mes courses",          icon: "📚" },
  { id: "parametres",  label: "Paramètres du coureur", icon: "⚙️" },
];

// ─── PARTAGE STRATÉGIE ───────────────────────────────────────────────────────
function encodeStrategy(race, segments, settings) {
  // On exclut les points GPX (trop lourds) + équipement + garminStats (inutiles pour l'assistant)
  // On INCLUT produits car nécessaire pour afficher le plan nutrition côté Team
  const { gpxPoints, ...raceLight } = race;
  const { equipment, garminStats, ...settingsLight } = settings;
  const payload = { race: raceLight, segments, settings: settingsLight, v: 2, ts: Date.now() };
  try {
    const json    = JSON.stringify(payload);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return encoded;
  } catch { return null; }
}

function decodeStrategy(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch { return null; }
}

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
  const [autoSaved, setAutoSaved] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installDone, setInstallDone] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [sharedMode, setSharedMode] = useState(false);
  const [courses, setCourses] = useState([]); // galerie des stratégies sauvegardées
  const [reposModal, setReposModal] = useState(false);
  const [reposForm, setReposForm]   = useState({ label: "", startKm: "", dureeMin: 20 });
  const addRepos = () => {
    if (!reposForm.label.trim() || !reposForm.dureeMin) return;
    const startKm = parseFloat(reposForm.startKm) || 0;
    setSegments(s => [...s, { id: Date.now(), type: "repos", label: reposForm.label, startKm, dureeMin: Number(reposForm.dureeMin), endKm: startKm, speedKmh: 0, slopePct: 0, terrain: "normal", notes: "" }]
      .sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
    setReposModal(false);
    setReposForm({ label: "", startKm: "", dureeMin: 20 });
  };

  // Détection navigateur/OS
  const ua = navigator.userAgent;
  const isIOS     = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari  = /^((?!chrome|android).)*safari/i.test(ua);
  const isChrome  = /chrome/i.test(ua) && /google/i.test(navigator.vendor);
  const isOpera   = /opr\//i.test(ua);
  const isFirefox = /firefox/i.test(ua);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  // Capturer l'événement beforeinstallprompt (Chrome, Edge, Opera)
  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      // Chrome / Edge / Opera — prompt natif
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") { setInstallDone(true); setInstallPrompt(null); }
    } else {
      // Autres navigateurs — guide manuel
      setShowInstallGuide(true);
    }
  };

  // ── IndexedDB helpers ────────────────────────────────────────────────────
  const IDB_NAME = "alex-trail", IDB_STORE = "state", IDB_COURSES = "courses", IDB_KEY = "current";
  const openDB = () => new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE))   db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains(IDB_COURSES)) db.createObjectStore(IDB_COURSES, { keyPath: "id" });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
  const idbSave = async data => {
    try {
      const db = await openDB();
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(data, IDB_KEY);
    } catch {}
  };
  const idbLoad = async () => {
    try {
      const db = await openDB();
      return new Promise(res => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => res(null);
      });
    } catch { return null; }
  };
  const idbSaveCourse = async (id, data) => {
    try {
      const db = await openDB();
      const tx = db.transaction(IDB_COURSES, "readwrite");
      tx.objectStore(IDB_COURSES).put({ id, ...data });
    } catch {}
  };
  const idbLoadCourses = async () => {
    try {
      const db = await openDB();
      return new Promise(res => {
        const tx = db.transaction(IDB_COURSES, "readonly");
        const req = tx.objectStore(IDB_COURSES).getAll();
        req.onsuccess = e => res(e.target.result || []);
        req.onerror = () => res([]);
      });
    } catch { return []; }
  };
  const idbDeleteCourse = async id => {
    try {
      const db = await openDB();
      const tx = db.transaction(IDB_COURSES, "readwrite");
      tx.objectStore(IDB_COURSES).delete(id);
    } catch {}
  };

  // ── Chargement au démarrage ──────────────────────────────────────────────
  useEffect(() => {
    // Priorité 1 : lien partagé ?s=... dans l'URL (ou #s=... en fallback)
    const urlParams = new URLSearchParams(window.location.search);
    let shared = urlParams.get("s");

    // Fallback : certains navigateurs iOS préservent mieux le hash que les query params
    if (!shared && window.location.hash.startsWith("#s=")) {
      shared = window.location.hash.slice(3);
    }

    if (shared) {
      const data = decodeStrategy(shared);
      if (data) {
        if (data.race)     setRaceRaw(data.race);
        if (data.segments) setSegmentsRaw(data.segments);
        if (data.settings) setSettingsRaw({ ...EMPTY_SETTINGS, ...data.settings });
        setSharedMode(true);
        setOnboarding(false);
        setView("team");
        idbSave({ race: data.race, segments: data.segments, settings: { ...EMPTY_SETTINGS, ...data.settings } });
        window.history.replaceState({}, "", window.location.pathname);
        return;
      } else {
        // Le lien existe mais est corrompu/tronqué
        console.warn("[Alex] Lien partagé détecté mais invalide. Longueur du code :", shared.length);
        // On continue vers IndexedDB
      }
    }
    // Priorité 2 : données IndexedDB locales
    idbLoad().then(d => {
      if (d?.race) { setRaceRaw(d.race); setOnboarding(false); }
      if (d?.segments) setSegmentsRaw(d.segments);
      if (d?.settings) setSettingsRaw({ ...EMPTY_SETTINGS, ...d.settings });
    });
    // Charger la galerie des courses sauvegardées
    idbLoadCourses().then(list => setCourses(list.sort((a, b) => b.savedAt - a.savedAt)));
  }, []);

  // ── Sauvegarde auto dans IndexedDB à chaque changement ───────────────────
  useEffect(() => {
    if (!race && !segments.length) return;
    const timer = setTimeout(() => {
      idbSave({ race, segments, settings });
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 800); // debounce 800ms
    return () => clearTimeout(timer);
  }, [race, segments, settings]);

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

  const saveCourse = () => {
    const id = Date.now();
    const totalTime = segments
      .filter(s => s.type !== "ravito" && s.type !== "repos")
      .reduce((s, seg) => s + (seg.endKm - seg.startKm) / seg.speedKmh * 3600, 0);
    const entry = {
      id,
      savedAt: id,
      name: settings.raceName || race.name || "Course sans nom",
      distance: race.totalDistance || 0,
      elevPos: race.totalElevPos || 0,
      segCount: segments.filter(s => s.type !== "ravito" && s.type !== "repos").length,
      startTime: settings.startTime || "07:00",
      totalTime,
      race, segments, settings,
    };
    idbSaveCourse(id, entry);
    setCourses(prev => [entry, ...prev]);
    return entry;
  };

  const loadCourse = entry => {
    // Préserver produits et equipment du profil courant — ils ne sont pas liés à une course spécifique
    const mergedSettings = { ...EMPTY_SETTINGS, ...(entry.settings || {}), produits: settings.produits || [], equipment: settings.equipment || DEFAULT_EQUIPMENT };
    setRaceRaw(entry.race || {});
    setSegmentsRaw(entry.segments || []);
    setSettingsRaw(mergedSettings);
    idbSave({ race: entry.race, segments: entry.segments, settings: mergedSettings });
    setHasUnsaved(false);
    setView("profil");
    setDrawerOpen(false);
  };

  const deleteCourse = id => {
    idbDeleteCourse(id);
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  const updateCourse = (id, patch) => {
    setCourses(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, ...patch };
      idbSaveCourse(id, updated);
      return updated;
    }));
  };

  const overwriteCourse = id => {
    const totalTime = segments
      .filter(s => s.type !== "ravito" && s.type !== "repos")
      .reduce((s, seg) => s + (seg.endKm - seg.startKm) / seg.speedKmh * 3600, 0);
    setCourses(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = {
        ...c,
        name: settings.raceName || race.name || c.name,
        distance: race.totalDistance || 0,
        elevPos: race.totalElevPos || 0,
        segCount: segments.filter(s => s.type !== "ravito" && s.type !== "repos").length,
        startTime: settings.startTime || "07:00",
        totalTime,
        race, segments, settings,
        updatedAt: Date.now(),
      };
      idbSaveCourse(id, updated);
      return updated;
    }));
  };
  const hasRace = !!race.gpxPoints?.length;

  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 16px" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: C.primary }}>Alex</div>
        <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>Trail Running Strategy</div>
      </div>
      <Hr />

      {/* Nav — prend tout l'espace disponible */}
      <nav style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {NAVS.map(n => (
          <div key={n.id} className={`nav-item${view === n.id ? " active" : ""}`} onClick={() => navigate(n.id)}>
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </div>
        ))}
        {hasRace && (
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px", fontSize: 13, marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{settings.raceName || race.name || "Course sans nom"}</div>
            <div style={{ color: "var(--muted-c)", fontSize: 12 }}>
              {race.totalDistance?.toFixed(1)} km · {Math.round(race.totalElevPos)} m D+
            </div>
            <div style={{ color: "var(--muted-c)", fontSize: 12 }}>{segments.filter(s => s.type !== "ravito" && s.type !== "repos").length} segments · {race.ravitos?.length || 0} ravitos</div>
          </div>
        )}
      </nav>

      {/* Bas de sidebar — dark mode + boutons données */}
      <Hr />
      <div style={{ padding: "12px 16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Indicateur sauvegarde auto */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "4px 0", height: 20 }}>
          {autoSaved && (
            <span style={{ fontSize: 11, color: C.green, fontWeight: 500, animation: "fadeUp 0.3s ease" }}>
              ✓ Sauvegarde auto
            </span>
          )}
        </div>

        {/* Toggle dark mode */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderRadius: 12, background: "var(--surface-2)",
        }}>
          <span style={{ fontSize: 13, color: "var(--muted-c)", fontWeight: 500 }}>
            {settings.darkMode ? "🌙 Mode sombre" : "☀️ Mode clair"}
          </span>
          <div
            onClick={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))}
            style={{
              width: 40, height: 22, borderRadius: 11, cursor: "pointer", transition: "background 0.2s", position: "relative",
              background: settings.darkMode ? C.primary : "var(--border-c)",
            }}>
            <div style={{
              position: "absolute", top: 3, left: settings.darkMode ? 21 : 3,
              width: 16, height: 16, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
        </div>

        {/* Bouton installation PWA */}
        {!isStandalone && !installDone && (
          <button onClick={handleInstall} style={{
            background: C.primaryPale, border: `1px solid ${C.primary}40`,
            borderRadius: 12, padding: "10px 14px", cursor: "pointer",
            fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8, color: C.primaryDeep,
            width: "100%", transition: "all 0.2s",
          }}>
            📲 Installer l'app
          </button>
        )}
        {isStandalone && (
          <div style={{ fontSize: 11, color: C.green, textAlign: "center", padding: "4px 0" }}>
            ✓ App installée
          </div>
        )}

        <button
          onClick={saveData}
          style={{
            background: hasUnsaved ? C.primary : "var(--surface-2)",
            color: hasUnsaved ? C.white : "var(--text-c)",
            border: "none", borderRadius: 12, padding: "10px 14px", cursor: "pointer",
            fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8, transition: "all 0.2s", width: "100%",
          }}>
          💾 Télécharger la stratégie
          {hasUnsaved && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.yellowPale, display: "inline-block", marginLeft: "auto" }} />}
        </button>

        {/* Charger une stratégie */}
        <label style={{ display: "block" }}>
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border-c)",
            borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontSize: 13,
            fontWeight: 500, color: "var(--text-c)",
            display: "flex", alignItems: "center", gap: 8,
          }}>📂 Charger une stratégie</div>
          <input type="file" accept=".json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) loadData(e.target.files[0]); }} />
        </label>

        {/* Nouvelle course (reset) */}
        <button onClick={() => {
          const hasData = (race.gpxPoints?.length > 0 || segments.length > 0);
          if (hasData) {
            const choice = window.confirm(
              `Démarrer une nouvelle course ?\n\nClique OK pour sauvegarder "${settings.raceName || race.name || "la course actuelle"}" dans Mes courses avant de continuer.\nClique Annuler pour tout effacer sans sauvegarder.`
            );
            if (choice) saveCourse();
          }
          // Préserver produits et equipment — ils appartiennent au profil coureur, pas à la course
          const newSettings = { ...EMPTY_SETTINGS, produits: settings.produits || [], equipment: settings.equipment || DEFAULT_EQUIPMENT, darkMode: settings.darkMode };
          setRaceRaw({});
          setSegmentsRaw([]);
          setSettingsRaw(newSettings);
          setHasUnsaved(false);
          setView("profil");
          setDrawerOpen(false);
          idbSave({ race: {}, segments: [], settings: newSettings });
        }} style={{
          background: "none", border: `1px solid var(--border-c)`, borderRadius: 12,
          padding: "10px 14px", cursor: "pointer", fontSize: 13, width: "100%",
          fontWeight: 500, color: "var(--muted-c)",
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "'DM Sans', sans-serif", transition: "color 0.2s",
        }}>
          🔄 Nouvelle course
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{G}</style>

      {/* MODAL REPOS */}
      <Modal open={reposModal} onClose={() => setReposModal(false)} title="Ajouter un segment de repos">
        <div className="form-grid">
          <Field label="Description" full>
            <input value={reposForm.label} onChange={e => setReposForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Ex : Bivouac, Sieste ravito, Base vie..." autoFocus />
          </Field>
          <Field label="Kilomètre de départ">
            <input type="number" min={0} step={0.1} value={reposForm.startKm}
              onChange={e => setReposForm(f => ({ ...f, startKm: e.target.value }))}
              placeholder="Ex : 60" />
          </Field>
          <Field label="Durée (minutes)">
            <div>
              <input type="range" min={5} max={480} step={5} value={reposForm.dureeMin}
                onChange={e => setReposForm(f => ({ ...f, dureeMin: Number(e.target.value) }))} />
              <div style={{ textAlign: "center", fontSize: 13, marginTop: 6 }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>{reposForm.dureeMin} min</span>
                <span style={{ color: "var(--muted-c)", marginLeft: 8 }}>({fmtTime(reposForm.dureeMin * 60)})</span>
              </div>
            </div>
          </Field>
        </div>
        <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 13, color: "var(--muted-c)" }}>
          Pas de distance associée — ajoute uniquement du temps au total de course.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setReposModal(false)}>Annuler</Btn>
          <Btn onClick={addRepos}>Ajouter</Btn>
        </div>
      </Modal>

      {/* GUIDE INSTALLATION PWA */}
      {showInstallGuide && (
        <div className="modal-overlay" onClick={() => setShowInstallGuide(false)}>
          <div className="confirm-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: C.primary, marginBottom: 16 }}>
              📲 Installer Alex
            </div>
            {isIOS ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "var(--muted-c)", fontSize: 14, lineHeight: 1.6 }}>
                  Sur iPhone/iPad, l'installation se fait depuis <strong>Safari</strong> uniquement :
                </p>
                {[
                  { step: "1", text: "Ouvre alex-trail.vercel.app dans Safari" },
                  { step: "2", text: "Appuie sur l'icône Partage □↑ en bas de l'écran" },
                  { step: "3", text: "Fais défiler et appuie sur « Sur l'écran d'accueil »" },
                  { step: "4", text: "Appuie sur « Ajouter » en haut à droite" },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.primary, color: "#fff", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.step}</div>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{s.text}</span>
                  </div>
                ))}
              </div>
            ) : isFirefox ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "var(--muted-c)", fontSize: 14, lineHeight: 1.6 }}>
                  Sur Firefox Android :
                </p>
                {[
                  { step: "1", text: "Appuie sur le menu ⋮ en haut à droite" },
                  { step: "2", text: "Sélectionne « Installer »" },
                  { step: "3", text: "Confirme l'installation" },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.primary, color: "#fff", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.step}</div>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{s.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "var(--muted-c)", fontSize: 14, lineHeight: 1.6 }}>
                  Sur ce navigateur, cherche l'option d'installation dans le menu :
                </p>
                {[
                  { step: "1", text: "Ouvre le menu du navigateur (⋮ ou ···)" },
                  { step: "2", text: "Cherche « Ajouter à l'écran d'accueil » ou « Installer »" },
                  { step: "3", text: "Confirme l'installation" },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.primary, color: "#fff", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.step}</div>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{s.text}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowInstallGuide(false)} style={{
                background: C.primary, color: "#fff", border: "none", borderRadius: 10,
                padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}>Compris</button>
            </div>
          </div>
        </div>
      )}

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
              <label style={{ display: "block", cursor: "pointer" }}>
                <div style={{
                  background: C.sand, border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: "11px 16px", textAlign: "center", fontSize: 14, fontWeight: 500,
                  color: C.text, fontFamily: "'DM Sans', sans-serif",
                }}>
                  📂 Charger une stratégie
                </div>
                <input type="file" accept=".json" style={{ display: "none" }}
                  onChange={e => { if (e.target.files[0]) { loadData(e.target.files[0]); setOnboarding(false); } }} />
              </label>
              <Btn variant="soft" onClick={() => { setOnboarding(false); setView("team"); }}>🔗 J'ai un lien de stratégie</Btn>
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
            overflowY: "auto", display: "flex", flexDirection: "column", height: "100vh",
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
          {view === "profil"      && <ProfilView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} onOpenRepos={() => setReposModal(true)} isMobile={isMobile} />}
          {view === "preparation" && <StrategieView race={race} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} onOpenRepos={() => setReposModal(true)} isMobile={isMobile} />}
          {view === "nutrition"   && <NutritionView segments={segments} settings={settings} setSettings={setSettings} race={race} setRace={setRace} isMobile={isMobile} onNavigate={navigate} />}
          {view === "team"        && <TeamView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} sharedMode={sharedMode} installPrompt={installPrompt} onInstall={handleInstall} isMobile={isMobile} onLoadStrategy={data => {
            if (data.race)     setRaceRaw(data.race);
            if (data.segments) setSegmentsRaw(data.segments);
            if (data.settings) setSettingsRaw({ ...EMPTY_SETTINGS, ...data.settings });
            idbSave({ race: data.race, segments: data.segments, settings: { ...EMPTY_SETTINGS, ...data.settings } });
          }} />}
          {view === "courses"     && <MesCoursesView courses={courses} onLoad={loadCourse} onDelete={deleteCourse} onUpdate={updateCourse} onOverwrite={overwriteCourse} onSaveCurrent={() => { saveCourse(); alert("✅ Stratégie sauvegardée dans Mes courses !"); }} race={race} segments={segments} settings={settings} />}
          {view === "parametres"  && <ParamètresView settings={settings} setSettings={setSettings} race={race} setRace={setRace} segments={segments} isMobile={isMobile} />}
        </main>
      </div>
    </>
  );
}
