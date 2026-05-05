// GPX : parsing, élévation, segments, export montre, passing times
import { RUNNER_LEVELS } from '../constants.js';
import { fmtPace } from './time.js';

// ─── parseGPX ───────────────────────────────────────────────────────────
export function parseGPX(xmlText) {
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

  // ── Calcul dénivelé — méthode adaptative selon la densité des points ─────────
  //
  // Deux types de GPX très différents :
  // • Tracé officiel (SRTM enrichi) : points espacés 15-100m → lissage w=5 validé
  // • Activité Garmin (altimètre baro) : points espacés 3-10m → cumul 2m comme Garmin
  //
  // Espacement moyen calculé depuis les distances cumulées déjà disponibles
  const totalDist = cumDist; // km
  const avgSpacingM = withDist.length > 1 ? (totalDist * 1000) / (withDist.length - 1) : 30;
  const isGPSActivity = avgSpacingM < 15; // activité GPS barométrique dense

  const eles = withDist.map(pt => pt.ele ?? 0);
  let totalElevPos = 0, totalElevNeg = 0;
  let smoothedEles;

  if (isGPSActivity) {
    // Méthode cumul 2m : ignore les montées < 2m avant de les comptabiliser
    // Reproduit l'algorithme Garmin — erreur < 5% sur activités barométriques
    smoothedEles = eles; // on garde les altitudes brutes (précision baro)
    if (!eleAllZero) {
      let cumulPos = 0, cumulNeg = 0;
      for (let i = 1; i < eles.length; i++) {
        const diff = eles[i] - eles[i - 1];
        if (diff > 0) {
          cumulPos += diff;
          cumulNeg = 0;
          if (cumulPos >= 2) { totalElevPos += cumulPos; cumulPos = 0; }
        } else if (diff < 0) {
          cumulNeg += Math.abs(diff);
          cumulPos = 0;
          if (cumulNeg >= 2) { totalElevNeg += cumulNeg; cumulNeg = 0; }
        }
      }
    }
  } else {
    // Méthode lissage w=5 : validée sur Diagonale des Fous (+2.1%), UTMB Lavaredo (-0.5%)
    const SMOOTH = 5;
    smoothedEles = eles.map((_, i) => {
      const half = Math.floor(SMOOTH / 2);
      const start = Math.max(0, i - half);
      const end = Math.min(eles.length - 1, i + half);
      const sl = eles.slice(start, end + 1);
      return sl.reduce((a, b) => a + b, 0) / sl.length;
    });
    if (!eleAllZero) {
      smoothedEles.forEach((ele, i) => {
        if (i === 0) return;
        const dEle = ele - smoothedEles[i - 1];
        if (dEle > 0.5) totalElevPos += dEle;
        else if (dEle < -0.5) totalElevNeg += Math.abs(dEle);
      });
    }
  }

  // Appliquer les altitudes aux points
  const points = withDist.map((pt, i) => ({ ...pt, ele: smoothedEles[i] }));

  return { points, totalDistance: cumDist, totalElevPos, totalElevNeg, trackName, needsElevation: eleAllZero };
}

// ── Enrichissement altitude via OpenTopoData (SRTM 90m, mondial) ────────────

// ─── enrichElevation ────────────────────────────────────────────────────
export async function enrichElevation(points) {
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

// ─── buildElevationProfile ──────────────────────────────────────────────
export function buildElevationProfile(points, resolution = 250) {
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

// ─── suggestSpeed ───────────────────────────────────────────────────────
export function suggestSpeed(slopePct, coeff = 1, settings = {}, segIndex = 0, totalSegs = 1, totalDistKm = 0, coveredDistKm = 0) {
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
  // Mode AUTO : levelCoeff = settings.autoLevelCoeff (interpolé entre Inter et Confirmé
  // depuis le GAP Garmin réel). coeff garde sa valeur (garminCoeff historique).
  // Mode MANUEL : RUNNER_LEVELS classique.
  const isAutoLevel = settings.levelMode === "auto" && settings.autoLevelCoeff > 0;
  const levelData = RUNNER_LEVELS.find(l => l.key === settings.runnerLevel) || RUNNER_LEVELS[1];
  const levelCoeff = isAutoLevel ? settings.autoLevelCoeff : levelData.coeff;

  // Coefficient fatigue progressif
  // Effort cumulé = distance parcourue + D+ cumulé / 100 (le dénivelé épuise plus)
  // On utilise la progression dans la course (0→1)
  const paceStrat = settings.paceStrategy || 0;
  const fatigueIntensity = paceStrat < 0 ? 0.18 : paceStrat > 0 ? 0.04 : 0.10;
  const progress = totalDistKm > 0 ? coveredDistKm / totalDistKm : (segIndex / (totalSegs - 1 || 1));
  // Fatigue nulle au départ, maximale à l'arrivée — courbe progressive
  const fatigueCoeff = 1 - progress * fatigueIntensity;

  // ── Impact équipement ───────────────────────────────────────────────────
  const poidsCoureur = settings.weight || 70;
  const equipment = settings.equipment || [];

  // Helper rétrocompat : déduit le type d'un item. Priorité au champ explicite
  // `item.type`, sinon fallback sur le label pour les items historiques.
  const inferType = (it) => {
    if (it.type) return it.type;
    const l = (it.label || "").toLowerCase();
    if (l.includes("bâton") || l.includes("baton")) return "batons";
    if (l.includes("veste") || l.includes("imper") || l.includes("k-way") || l.includes("goretex")) return "imper";
    return "autre";
  };
  // Helper rétrocompat : un item est "course" (= compté dans le poids) si
  // usage === "course", ou si pas de usage défini et cat === "Équipement".
  const isCourseUsage = (it) => {
    if (it.usage) return it.usage === "course";
    return (it.cat || "").toLowerCase() === "équipement";
  };

  // Poids total des items emportés (équipement de course + nutrition transportée).
  // - Équipement : items usage="course" avec emporte !== false
  // - Nutrition : settings.poidsNutritionG (calculé en amont par segment via
  //   poidsNutritionAtKm — décroît linéairement entre rechargements)
  const poidsEquipementKg = equipment
    .filter(e => isCourseUsage(e) && e.emporte !== false)
    .reduce((s, e) => s + (e.poidsG || 0), 0) / 1000;
  const poidsNutritionKg = (settings.poidsNutritionG || 0) / 1000;
  const poidsTransporteKg = poidsEquipementKg + poidsNutritionKg;

  // Pénalité poids — non-linéaire avec cap.
  // Sources : Cureton & Sparling 1980 (linéaire jusqu'à ~10% du poids corporel),
  // Knapik et al. 1996 (dégradation accélérée au-delà), Quesada et al. 2000 (rupture
  // de pente vers 15-20%). Modèle : composante linéaire + composante quadratique
  // déclenchée au seuil. Cap inférieur à 0.40 pour éviter les vitesses absurdes
  // sur charges extrêmes (>40% du poids corporel).
  const ratio = poidsCoureur > 0 ? poidsTransporteKg / poidsCoureur : 0;
  const seuilRatio = 0.10;
  const penLin  = 0.30 * ratio;
  const penQuad = 15.0 * Math.max(0, ratio - seuilRatio) ** 2;
  const weightPenalty = Math.max(0.40, 1 - penLin - penQuad);

  // Bâtons emportés → +3% sur les montées (slope ≥ 5%)
  const hasPoles = equipment.some(e => inferType(e) === "batons" && e.emporte !== false);
  const polesBonus = (hasPoles && slopePct >= 5) ? 1.03 : 1;

  // Veste imper emportée + pluie active → -10%
  const hasRainJacket = equipment.some(e => inferType(e) === "imper" && e.emporte !== false);
  const rainMalus = (hasRainJacket && settings.rain) ? 0.90 : 1;

  return +(base * coeff * levelCoeff * fatigueCoeff
    * weightPenalty
    * polesBonus
    * rainMalus
    * (settings.snow ? 0.85 : 1)
    * (settings.tempC <= -10 ? 0.95 : 1)
  ).toFixed(1);
}

// ─── calcSlopeFromGPX ───────────────────────────────────────────────────
export function calcSlopeFromGPX(points, startKm, endKm) {
  if (!points.length) return 0;
  const inRange = points.filter(p => p.dist >= startKm && p.dist <= endKm);
  if (inRange.length < 2) return 0;
  const dEle = inRange[inRange.length - 1].ele - inRange[0].ele;
  const dDist = (endKm - startKm) * 1000;
  return dDist === 0 ? 0 : Math.round((dEle / dDist) * 100);
}

// ─── autoSegmentGPX ─────────────────────────────────────────────────────
// Helper local : poids nutrition à un km donné (décroissance linéaire entre rechargements).
// Cloné de nutrition.js pour éviter la dépendance circulaire gpx → nutrition.
function computePoidsAtKm(km, zones) {
  if (!Array.isArray(zones) || !zones.length) return 0;
  for (const z of zones) {
    if (km >= z.startKm && km <= z.endKm) {
      const span = z.endKm - z.startKm;
      if (span <= 0) return 0;
      const ratio = (z.endKm - km) / span;
      return Math.max(0, Math.min(z.poidsInitialG, z.poidsInitialG * ratio));
    }
  }
  if (km < zones[0].startKm) return zones[0].poidsInitialG;
  return 0;
}

export function autoSegmentGPX(points, coeff = 1, settings = {}) {
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

  // ── Calcul des vitesses ───────────────────────────────────────────────────
  // Pour le poids nutrition dynamique : si settings.poidsZones fourni, on calcule
  // le poids nutrition au km moyen de chaque segment (décroissance linéaire).
  const poidsZones = Array.isArray(settings.poidsZones) ? settings.poidsZones : null;
  const rawSegs = validated.map((seg, i) => {
    const realSlope = calcSlopeFromGPX(points, seg.start, seg.end);
    const coveredDistKm = seg.start;
    const segMidKm = (seg.start + seg.end) / 2;
    const poidsNutritionG = poidsZones ? computePoidsAtKm(segMidKm, poidsZones) : 0;
    const segSettings = poidsZones ? { ...settings, poidsNutritionG } : settings;
    const speed = suggestSpeed(realSlope, coeff, segSettings, i, totalSegs, totalDistKm, coveredDistKm);
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

  // ── PASSE 4 — fusion selon le niveau de détail ────────────────────────────
  const detail = settings.segmentDetail || "equilibre";

  // Vitesse d'un segment fusionné = distance totale / temps total
  // (pondération par temps, pas par distance — évite sous-estimation sur les segments lents)
  const mergeSpeed = (d1, v1, d2, v2) => {
    const t1 = v1 > 0 ? d1 / v1 : 0;
    const t2 = v2 > 0 ? d2 / v2 : 0;
    const totalTime = t1 + t2;
    return totalTime > 0 ? +((d1 + d2) / totalTime).toFixed(1) : v1;
  };

  // Mode Synthétique : analyse macro du profil pour détecter grandes tendances
  // On calcule la tendance altimétrique sur une fenêtre large et on regroupe
  // par grandes zones montée/descente continues
  const macroMerge = (segs) => {
    if (segs.length <= 1) return segs;

    // Fenêtre d'analyse = 10% de la distance totale, min 6km
    const windowKm = Math.max(6, totalDistKm * 0.10);

    // Calculer la tendance macro à chaque km du tracé
    const macroTrend = (km) => {
      const start = Math.max(0, km - windowKm / 2);
      const end = Math.min(totalDistKm, km + windowKm / 2);
      const pts = points.filter(p => p.dist >= start && p.dist <= end);
      if (pts.length < 2) return 0;
      const dEle = pts[pts.length - 1].ele - pts[0].ele;
      const dDist = (pts[pts.length - 1].dist - pts[0].dist) * 1000;
      return dDist > 0 ? dEle / dDist * 100 : 0;
    };

    // Regrouper les segments selon la tendance macro (montée / plat-descente)
    const FLAT_THRESHOLD = 2; // pente < 2% considérée comme plat → suit la tendance macro
    const result = [];
    let group = { ...segs[0] };

    for (let i = 1; i < segs.length; i++) {
      const seg = segs[i];
      const midKm = (group.endKm + seg.endKm) / 2;
      const trend = macroTrend(midKm);
      const groupTrend = macroTrend((group.startKm + group.endKm) / 2);

      // Même tendance macro → on fusionne
      const sameSign = (trend >= FLAT_THRESHOLD) === (groupTrend >= FLAT_THRESHOLD)
                    && (trend <= -FLAT_THRESHOLD) === (groupTrend <= -FLAT_THRESHOLD);

      if (sameSign) {
        const dist = group.endKm - group.startKm;
        const segDist = seg.endKm - seg.startKm;
        const merged = dist + segDist;
        group = {
          ...group,
          endKm: seg.endKm,
          speedKmh: mergeSpeed(dist, group.speedKmh, segDist, seg.speedKmh),
          slopePct: Math.round((group.slopePct * dist + seg.slopePct * segDist) / merged),
        };
      } else {
        result.push(group);
        group = { ...seg };
      }
    }
    result.push(group);

    // Passe finale : absorber les segments orphelins trop courts
    // Seuil adaptatif selon la distance : ultra (>80km) → 5km, long (>40km) → 3km, sinon 2km
    const orphanMin = totalDistKm > 80 ? 5.0 : totalDistKm > 40 ? 3.0 : 2.0;
    const cleaned = [];
    for (let i = 0; i < result.length; i++) {
      const seg = result[i];
      const dist = seg.endKm - seg.startKm;
      if (dist < orphanMin && result.length > 1) {
        const prev = cleaned[cleaned.length - 1];
        const next = result[i + 1];
        // Fusionner avec le voisin à vitesse la plus proche
        if (prev && (!next || Math.abs(seg.speedKmh - prev.speedKmh) <= Math.abs(seg.speedKmh - (next?.speedKmh || 999)))) {
          const pd = prev.endKm - prev.startKm;
          const merged = pd + dist;
          cleaned[cleaned.length - 1] = {
            ...prev,
            endKm: seg.endKm,
            speedKmh: mergeSpeed(pd, prev.speedKmh, dist, seg.speedKmh),
            slopePct: Math.round((prev.slopePct * pd + seg.slopePct * dist) / merged),
          };
        } else if (next) {
          const nd = next.endKm - next.startKm;
          const merged = nd + dist;
          result[i + 1] = {
            ...next,
            startKm: seg.startKm,
            speedKmh: mergeSpeed(dist, seg.speedKmh, nd, next.speedKmh),
            slopePct: Math.round((seg.slopePct * dist + next.slopePct * nd) / merged),
          };
        } else {
          cleaned.push(seg);
        }
      } else {
        cleaned.push(seg);
      }
    }
    return cleaned;
  };

  // Mode standard : fusion par vitesse et distance minimale
  const standardMerge = (segs) => {
    if (segs.length <= 1) return segs;
    const minDist  = detail === "detaille" ? 0.8 : Math.max(1.5, totalDistKm / 25);
    const speedTol = detail === "detaille" ? 0.0 : 0.8;
    let out = [...segs];
    let changed = true;
    while (changed) {
      changed = false;
      const next = [];
      let i = 0;
      while (i < out.length) {
        const seg = out[i];
        const dist = seg.endKm - seg.startKm;
        const nextSeg = out[i + 1];
        const sameDirection = nextSeg && (seg.slopePct >= 0) === (nextSeg.slopePct >= 0);

        if (sameDirection && Math.abs(seg.speedKmh - nextSeg.speedKmh) <= speedTol) {
          const nd = nextSeg.endKm - nextSeg.startKm;
          const mergedDist = nextSeg.endKm - seg.startKm;
          const mergedSlope = Math.round((seg.slopePct * dist + nextSeg.slopePct * nd) / mergedDist);
          next.push({ ...seg, endKm: nextSeg.endKm, speedKmh: mergeSpeed(dist, seg.speedKmh, nd, nextSeg.speedKmh), slopePct: mergedSlope });
          i += 2; changed = true;
          continue;
        }

        if (dist < minDist && nextSeg && sameDirection) {
          const nd = nextSeg.endKm - nextSeg.startKm;
          const mergedDist = nextSeg.endKm - seg.startKm;
          const mergedSlope = Math.round((seg.slopePct * dist + nextSeg.slopePct * nd) / mergedDist);
          next.push({ ...seg, endKm: nextSeg.endKm, speedKmh: mergeSpeed(dist, seg.speedKmh, nd, nextSeg.speedKmh), slopePct: mergedSlope });
          i += 2; changed = true;
          continue;
        }

        next.push(seg);
        i++;
      }
      out = next;
    }

    // Passe orphelins adaptative (même logique que Synthétique)
    const orphanMin = detail === "detaille" ? 0.8
                    : totalDistKm > 80 ? 3.0 : totalDistKm > 40 ? 2.0 : 1.0;
    const cleaned = [];
    for (let i = 0; i < out.length; i++) {
      const seg = out[i];
      const dist = seg.endKm - seg.startKm;
      if (dist < orphanMin && out.length > 1) {
        const prev = cleaned[cleaned.length - 1];
        const nextSeg = out[i + 1];
        if (prev && (!nextSeg || Math.abs(seg.speedKmh - prev.speedKmh) <= Math.abs(seg.speedKmh - (nextSeg?.speedKmh || 999)))) {
          const pd = prev.endKm - prev.startKm;
          cleaned[cleaned.length - 1] = { ...prev, endKm: seg.endKm, speedKmh: mergeSpeed(pd, prev.speedKmh, dist, seg.speedKmh), slopePct: Math.round((prev.slopePct * pd + seg.slopePct * dist) / (pd + dist)) };
        } else if (nextSeg) {
          const nd = nextSeg.endKm - nextSeg.startKm;
          out[i + 1] = { ...nextSeg, startKm: seg.startKm, speedKmh: mergeSpeed(dist, seg.speedKmh, nd, nextSeg.speedKmh), slopePct: Math.round((seg.slopePct * dist + nextSeg.slopePct * nd) / (dist + nd)) };
        } else cleaned.push(seg);
      } else cleaned.push(seg);
    }
    return cleaned;
  };

  const merged = detail === "synthétique" ? macroMerge(rawSegs) : standardMerge(rawSegs);
  return merged.map((seg, i) => ({ ...seg, id: Date.now() + i }));
}

// ─── exportGPXMontre ────────────────────────────────────────────────────
export function exportGPXMontre(race, segments, settings, passingTimes) {
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

  // ── Waypoints ──────────────────────────────────────────────────────────────
  const wpts = [];

  // Segments (changements d'allure)
  const segmentsNormaux = segments.filter(s => s.type !== "ravito" && s.type !== "repos");
  segmentsNormaux.forEach((seg, i) => {
    const targetKm = seg.startKm;
    if (targetKm === 0) return; // départ déjà géré
    let closest = points[0];
    let minDiff = Infinity;
    for (const p of points) {
      const diff = Math.abs(p.dist - targetKm);
      if (diff < minDiff) { minDiff = diff; closest = p; }
    }
    if (!closest) return;

    const segIdx = segments.indexOf(seg);
    const heureStr = passingTimes[segIdx - 1] ? fmtH(passingTimes[segIdx - 1]) : "--:--";
    const slope = seg.slopePct || 0;
    const sym = slope >= 10 ? "Summit" : slope >= 4 ? "Trailhead" : slope <= -6 ? "Valley" : "Waypoint";
    const typeLabel = slope >= 10 ? "↑↑ Montée raide" : slope >= 4 ? "↑ Montée" : slope <= -6 ? "↓↓ Descente raide" : slope <= -2 ? "↓ Descente" : "→ Plat";
    const pace = seg.speedKmh > 0 ? fmtPace(seg.speedKmh) : "--:--";

    wpts.push(`<wpt lat="${closest.lat.toFixed(6)}" lon="${closest.lon.toFixed(6)}">
  <n>S${i + 1} · ${pace}/km</n>
  <desc>${typeLabel} | Allure : ${pace}/km (${seg.speedKmh} km/h) | Pente : ${slope > 0 ? "+" : ""}${slope}% | Heure : ${heureStr} | km ${targetKm.toFixed(1)}</desc>
  <sym>${sym}</sym>
  <type>user</type>
</wpt>`);
  });

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
    const plan = (race.planNutrition || {})[String(rv.id)] || [];
    const nutrition = plan
      .filter(({ quantite }) => quantite > 0)
      .map(({ produitId, quantite }) => {
        const p = produits.find(p => p.id === produitId);
        return p ? `${p.nom} ×${quantite}` : null;
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


// ─── calcPassingTimes ───────────────────────────────────────────────────
export function calcPassingTimes(segments, startTime) {
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

// ─── HELPERS NUTRITION PARTAGÉS ─────────────────────────────────────────────
// Utilisés par NutritionView (panneau ravito) et TeamView (préparation ravitos).
// Garder une seule source de vérité évite les divergences sur le calcul kcal.

// Test : un item est-il une recette (vs un produit simple) ?
