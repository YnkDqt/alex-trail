// Parser CSV Garmin
import { DEFAULT_FLAT_SPEED } from '../constants.js';

export function parseGarminCSV(text) {
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
    fcMoy:    header.findIndex(h => /fr.*quence cardiaque moyenne/i.test(h)),
    fcMax:    header.findIndex(h => /fr.*quence cardiaque maximale/i.test(h)),
    te:       header.findIndex(h => /te a.robie/i.test(h)),
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
    const fcMoy = idx.fcMoy >= 0 ? parseInt(cells[idx.fcMoy] || "") : NaN;
    const fcMax = idx.fcMax >= 0 ? parseInt(cells[idx.fcMax] || "") : NaN;
    const te    = idx.te   >= 0 ? parseFloat((cells[idx.te] || "").replace(",",".")) : NaN;
    rows.push({ gap, dist, kcal: isNaN(kcal) || kcal < 10 ? null : kcal, ascent: isNaN(ascent) ? 0 : ascent, fcMoy: isNaN(fcMoy) ? null : fcMoy, fcMax: isNaN(fcMax) ? null : fcMax, te: isNaN(te) ? null : te });
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

  // FC max observée sur l'historique
  const fcMaxRows = rows.filter(r => r.fcMax && r.fcMax > 100);
  const fcMaxObs = fcMaxRows.length ? Math.max(...fcMaxRows.map(r => r.fcMax)) : null;

  // Allure Zone 2 : sorties avec TE aérobie < 2.5 (effort facile/modéré)
  // Si pas de TE, fallback sur FC moyenne < 70% FCmax
  let gapZone2Kmh = null;
  const z2Threshold = fcMaxObs ? fcMaxObs * 0.70 : null;
  const z2Rows = rows.filter(r => {
    if (r.te !== null) return r.te < 2.5 && r.gap;
    if (z2Threshold && r.fcMoy) return r.fcMoy < z2Threshold && r.gap;
    return false;
  });
  if (z2Rows.length >= 3) {
    const totalDistZ2 = z2Rows.reduce((s,r) => s+r.dist, 0);
    gapZone2Kmh = +(z2Rows.reduce((s,r) => s+r.gap*r.dist, 0) / totalDistZ2).toFixed(2);
  }

  return {
    count: rows.length, avgGapKmh: +avgGapKmh.toFixed(2),
    coeff: +(avgGapKmh/DEFAULT_FLAT_SPEED).toFixed(3),
    lastDate: new Date().toLocaleDateString("fr-FR"),
    kcalPerKmFlat, kcalPerKmUphill, kcalActivityCount,
    fcMaxObs, gapZone2Kmh, z2Count: z2Rows.length,
  };
}

// ─── COMPUTE GARMIN STATS DEPUIS LE STATE `activites` ─────────────────────────
// Source unique : l'onglet Activités (utilisé partout au lieu de re-uploader le CSV).
// Reproduit le format produit par parseGarminCSV pour rester drop-in compatible.
const TRAIL_TYPES_RX = /trail|course à pied|running|run/i;
// Accepte "5:30", "5:30 /km", "5:30/km", etc.
const parsePaceStr = (str) => {
  if (!str || str === "--") return null;
  const m = str.toString().match(/(\d+):(\d{2})/);
  if (!m) return null;
  const totalMin = parseInt(m[1]) + parseInt(m[2]) / 60;
  return totalMin > 0 ? 60 / totalMin : null;
};
// Parse durée Garmin "3:24:15" (h:m:s) ou "45:23" (m:s) → heures décimales
const parseDurationToHours = (str) => {
  if (!str || str === "--") return null;
  const parts = str.toString().trim().split(":").map(p => parseInt(p));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600;
  if (parts.length === 2) return parts[0] / 60 + parts[1] / 3600;
  return null;
};
// Distance stockée par parseCSVActivities = cleanNum (virgules/espaces supprimés).
// Donc "12,34" → "1234" et "12.34" → "12.34". Heuristique : si pas de "." et > 200, on divise par 100.
const parseDistanceFR = (raw) => {
  if (!raw) return NaN;
  const s = raw.toString();
  if (s.includes(".")) return parseFloat(s);
  const n = parseFloat(s);
  if (isNaN(n)) return NaN;
  // Distances réalistes < 200km en course à pied. Au-delà → centièmes mangés par cleanNum.
  return n > 200 ? n / 100 : n;
};

export function computeStatsFromActivities(activites, opts = {}) {
  // opts.raceDplusPerKm : ratio D+/km de la course cible (active filtre flottant 75/50/25%)
  // opts.maxTE : seuil TE max (défaut 4) — exclut séances haute intensité
  if (!Array.isArray(activites) || !activites.length) return null;
  const maxTE = opts.maxTE != null ? opts.maxTE : 4;
  const raceRatio = opts.raceDplusPerKm || 0;

  // 1) Pré-filtrage commun : type pertinent + distance + GAP exploitable + TE OK
  const allRows = [];
  for (const a of activites) {
    // Type : on accepte "trail" uniquement (exclut "course à pied", "running" qui sont presque toujours du plat)
    // Note : si l'utilisateur classe ses séances trail intense en "trail", elles seront filtrées par TE/ratio en aval
    if (!/trail/i.test(a.type || "")) continue;
    const dist = parseDistanceFR(a.distance);
    if (!dist || dist < 2) continue;
    const gap = parsePaceStr(a.gapMoy) || parsePaceStr(a.allure);
    if (!gap) continue;
    const kcal = parseFloat((a.calories || "").toString().replace(",", "."));
    const ascent = parseFloat((a.dp || "").toString().replace(",", "."));
    const fcMoy = parseInt(a.fcMoy || "");
    const fcMax = parseInt(a.fcMax || "");
    const te = parseFloat((a.teAero || "").toString().replace(",", "."));
    const durationH = parseDurationToHours(a.duree);
    // Filtre intensité : TE renseigné ET supérieur au seuil → exclu (séances quali)
    if (!isNaN(te) && te > maxTE) continue;
    allRows.push({
      gap, dist,
      ratio: ascent && !isNaN(ascent) ? ascent / dist : 0,
      kcal: isNaN(kcal) || kcal < 10 ? null : kcal,
      ascent: isNaN(ascent) ? 0 : ascent,
      fcMoy: isNaN(fcMoy) ? null : fcMoy,
      fcMax: isNaN(fcMax) ? null : fcMax,
      te: isNaN(te) ? null : te,
      durationH,
    });
  }
  if (!allRows.length) return null;

  // 2) Filtre flottant D+/km : 75% → 50% → 25% → 0% (no filter), prend le 1er seuil avec ≥ 5 activités
  let rows = allRows;
  let appliedRatioPct = 0; // 0 = no filter
  if (raceRatio > 0) {
    const seuils = [0.75, 0.50, 0.25];
    for (const s of seuils) {
      const filtered = allRows.filter(r => r.ratio >= raceRatio * s);
      if (filtered.length >= 5) { rows = filtered; appliedRatioPct = Math.round(s * 100); break; }
    }
  }

  const totalDist = rows.reduce((s, r) => s + r.dist, 0);
  const avgGapKmh = rows.reduce((s, r) => s + r.gap * r.dist, 0) / totalDist;

  let kcalPerKmFlat = null, kcalPerKmUphill = null, kcalActivityCount = 0;
  const kcalRows = rows.filter(r => r.kcal !== null);
  if (kcalRows.length >= 3) {
    kcalActivityCount = kcalRows.length;
    const pts = kcalRows.map(r => ({ x: r.ascent / r.dist, y: r.kcal / r.dist }));
    const n = pts.length;
    const sumX = pts.reduce((s, p) => s + p.x, 0);
    const sumY = pts.reduce((s, p) => s + p.y, 0);
    const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) > 0.001) {
      const b = (n * sumXY - sumX * sumY) / denom;
      const a = (sumY - b * sumX) / n;
      kcalPerKmFlat = Math.round(Math.max(40, Math.min(120, a)));
      kcalPerKmUphill = Math.round(Math.max(50, Math.min(180, a + b * 100)));
    } else {
      kcalPerKmFlat = Math.round(sumY / n);
    }
  }

  const fcMaxRows = rows.filter(r => r.fcMax && r.fcMax > 100);
  const fcMaxObs = fcMaxRows.length ? Math.max(...fcMaxRows.map(r => r.fcMax)) : null;

  let gapZone2Kmh = null;
  const z2Threshold = fcMaxObs ? fcMaxObs * 0.70 : null;
  const z2Rows = rows.filter(r => {
    if (r.te !== null) return r.te < 2.5 && r.gap;
    if (z2Threshold && r.fcMoy) return r.fcMoy < z2Threshold && r.gap;
    return false;
  });
  if (z2Rows.length >= 3) {
    const totalDistZ2 = z2Rows.reduce((s, r) => s + r.dist, 0);
    gapZone2Kmh = +(z2Rows.reduce((s, r) => s + r.gap * r.dist, 0) / totalDistZ2).toFixed(2);
  }

  // TE moyen pondéré par distance (sur les rows ayant un TE renseigné)
  const teRows = rows.filter(r => r.te !== null);
  let avgTE = null;
  if (teRows.length >= 3) {
    const totalDistTE = teRows.reduce((s, r) => s + r.dist, 0);
    avgTE = +(teRows.reduce((s, r) => s + r.te * r.dist, 0) / totalDistTE).toFixed(2);
  }

  // Durées des activités utilisées (triées desc) pour calcul Riegel par computeRaceLevel
  const durationsH = rows.filter(r => r.durationH != null && r.durationH > 0)
    .map(r => r.durationH).sort((a, b) => b - a);

  return {
    count: rows.length, avgGapKmh: +avgGapKmh.toFixed(2),
    coeff: +(avgGapKmh / DEFAULT_FLAT_SPEED).toFixed(3),
    lastDate: new Date().toLocaleDateString("fr-FR"),
    kcalPerKmFlat, kcalPerKmUphill, kcalActivityCount,
    fcMaxObs, gapZone2Kmh, z2Count: z2Rows.length,
    appliedRatioPct, totalCount: allRows.length,
    avgTE,
    durationsH,
  };
}

// ─── COMPUTE RACE LEVEL ──────────────────────────────────────────────────────
// Convertit le GAP d'endurance habituel (Garmin) en niveau de course personnalisé.
//
// Bonus selon TE moyen entraînement (intensité réelle observée) :
//   TE < 2.5         → +10% (Z2 pur, grosse marge en course)
//   TE 2.5 - 3.0     → +6%  (mix endurance/tempo, marge moyenne)
//   TE 3.0 - 3.5     → +3%  (entraînement déjà soutenu)
//   TE > 3.5 ou null → 0%   (proche du seuil, pas de marge)
//
// Correction Riegel (extrapolation de durée) : pénalise quand la course dépasse
// largement les sorties d'entraînement les plus longues.
//   correction = (durée_long_avg / durée_course)^0.06
//   Pool sorties longues = activités ≥ 50% durée course (fallback 30% puis 15%, min 3 activités).
//   Exposant 0.06 = Riegel adapté trail (vs 0.07 route, plafonnement par la pente).
//
// autoLevelCoeff (option 3) : interpole entre Intermédiaire (0.88) et Confirmé (1.00)
// selon la position de raceGapKmh × correctionRiegel entre les vitesses moyennes attendues
// d'un Inter et d'un Confirmé sur la même course (refVelocities). Sinon fallback simple.
//
// Renvoie null si pas de stats Garmin exploitables.
export function computeRaceLevel(gs, totalTimeH = 0, refVelocities = null) {
  if (!gs || !gs.avgGapKmh) return null;
  // Bonus selon TE moyen (granulaire)
  let bonusPct, intensityBucket;
  const te = gs.avgTE;
  if (te === null || te === undefined) {
    bonusPct = 0; intensityBucket = "TE non disponible";
  } else if (te < 2.5)  { bonusPct = 10; intensityBucket = `TE moyen ${te} (Z2 pur)`; }
  else if (te < 3.0)    { bonusPct = 6;  intensityBucket = `TE moyen ${te} (endurance soutenue)`; }
  else if (te < 3.5)    { bonusPct = 3;  intensityBucket = `TE moyen ${te} (tempo)`; }
  else                  { bonusPct = 0;  intensityBucket = `TE moyen ${te} (intense)`; }

  let durationBucket;
  if (totalTimeH <= 0)      durationBucket = "indéterminée";
  else if (totalTimeH < 2)  durationBucket = "< 2h";
  else if (totalTimeH < 4)  durationBucket = "2-4h";
  else if (totalTimeH < 8)  durationBucket = "4-8h";
  else                      durationBucket = "> 8h (ultra)";

  const enduranceGapKmh = gs.avgGapKmh;
  const baseRaceGapKmh = enduranceGapKmh * (1 + bonusPct / 100);

  // ─── Correction Riegel (pool flottant) ───
  let riegelCorr = 1, riegelInfo = "désactivée (durées non disponibles)", longAvgH = 0, longCount = 0, longThresholdPct = 0;
  if (totalTimeH > 0 && Array.isArray(gs.durationsH) && gs.durationsH.length > 0) {
    const seuils = [0.50, 0.30, 0.15];
    for (const s of seuils) {
      const pool = gs.durationsH.filter(d => d >= totalTimeH * s);
      if (pool.length >= 3) {
        longAvgH = pool.reduce((sum, d) => sum + d, 0) / pool.length;
        longCount = pool.length;
        longThresholdPct = Math.round(s * 100);
        break;
      }
    }
    if (longAvgH > 0) {
      // Riegel : v_course = v_long × (T_long / T_course)^0.06
      // Si T_course > T_long → ratio < 1 → correction < 1 (malus)
      riegelCorr = Math.pow(longAvgH / totalTimeH, 0.06);
      // Cap entre 0.88 (malus max -12%) et 1.05 (bonus max +5% si on a fait plus long que la course)
      riegelCorr = Math.max(0.88, Math.min(1.05, riegelCorr));
      const pct = Math.round((riegelCorr - 1) * 100);
      riegelInfo = `${pct >= 0 ? "+" : ""}${pct}% (${longCount} sorties ≥ ${longThresholdPct}% durée, moy. ${longAvgH.toFixed(1)}h)`;
    } else {
      riegelInfo = "désactivée (pas assez de sorties longues)";
    }
  }

  const raceGapKmh = +(baseRaceGapKmh * riegelCorr).toFixed(2);

  // autoLevelCoeff : option 3 si refVelocities fournies, sinon fallback simple
  let autoLevelCoeff;
  if (refVelocities && refVelocities.vInter > 0 && refVelocities.vConfirme > refVelocities.vInter) {
    const t = (raceGapKmh - refVelocities.vInter) / (refVelocities.vConfirme - refVelocities.vInter);
    autoLevelCoeff = +(0.88 + t * (1.00 - 0.88)).toFixed(3);
  } else {
    autoLevelCoeff = +(raceGapKmh / DEFAULT_FLAT_SPEED).toFixed(3);
  }
  const raceCoeff = autoLevelCoeff;
  return {
    enduranceGapKmh, raceGapKmh, raceCoeff, autoLevelCoeff,
    bonusPct, durationBucket, intensityBucket,
    riegelCorr: +riegelCorr.toFixed(3), riegelInfo, longAvgH: +longAvgH.toFixed(2), longCount, longThresholdPct,
  };
}

// ─── NUTRITION ───────────────────────────────────────────────────────────────
// Cibles horaires basées sur la littérature scientifique (trail/ultra-endurance).
// Sources :
//   - Glucides : Jeukendrup (Sports Medicine 2014) — 60-90 g/h pour efforts >2h,
//     jusqu'à 120 g/h chez coureurs gut-trained (mix glucose/fructose).
//   - Eau : Sawka (MSSE 2007) + ACSM Position Stand (2016) — 400-800 ml/h
//     selon conditions climatiques et intensité.
//   - Sodium : Hoffman (Clin J Sport Med 2015), Costa (Nutrients 2019) —
//     300-700 mg de sodium par heure en endurance.
//   - Protéines : Pugh et al. (Nutrients 2018), Kato (PLOS ONE 2016) —
//     5-10 g/h pour efforts >4h (préservation masse musculaire).
//   - Lipides : Burke (Int J Sport Nutr 2015) — digestion lente, apport
//     plafonné à ~10 g/h sur effort intense.
//   - Minetti et al. (J Appl Physiol 2002) — coût énergétique course à pied.
