import { useEffect } from 'react';
import { C, DEFAULT_FLAT_SPEED, RUNNER_LEVELS, TERRAIN_TYPES } from './constants.js';

export function fmtTime(seconds) {
  if (!seconds || seconds <= 0) return "--:--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
export function fmtPace(speedKmh) {
  if (!speedKmh || speedKmh <= 0) return "--:--";
  const minPerKm = 60 / speedKmh;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2,"0")}`;
}
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

  // ── Impact équipement ───────────────────────────────────────────────────
  const poidsCoureur = settings.weight || 70;
  const equipment = settings.equipment || [];

  // Poids total des items emportés (même logique que EquipementView : emporte !== false)
  const poidsEquipementKg = equipment
    .filter(e => e.emporte !== false)
    .reduce((s, e) => s + (e.poidsG || 0), 0) / 1000;

  // Seuil dynamique = 10% poids corporel — au-delà : -3% par kg
  const seuilKg = poidsCoureur * 0.10;
  const surplusKg = Math.max(0, poidsEquipementKg - seuilKg);
  const weightPenalty = 1 - surplusKg * 0.03;

  // Bâtons emportés → +3% sur les montées (slope ≥ 5%)
  const hasPoles = equipment.some(e => e.label?.toLowerCase().includes("bâton") && e.emporte !== false);
  const polesBonus = (hasPoles && slopePct >= 5) ? 1.03 : 1;

  // Veste imper emportée + pluie active → -10%
  const hasRainJacket = equipment.some(e => e.label?.toLowerCase().includes("veste") && e.emporte !== false);
  const rainMalus = (hasRainJacket && settings.rain) ? 0.90 : 1;

  return +(base * coeff * levelCoeff * fatigueCoeff
    * weightPenalty
    * polesBonus
    * rainMalus
    * (settings.snow ? 0.85 : 1)
    * (settings.tempC <= -10 ? 0.95 : 1)
  ).toFixed(1);
}
export function calcSlopeFromGPX(points, startKm, endKm) {
  if (!points.length) return 0;
  const inRange = points.filter(p => p.dist >= startKm && p.dist <= endKm);
  if (inRange.length < 2) return 0;
  const dEle = inRange[inRange.length - 1].ele - inRange[0].ele;
  const dDist = (endKm - startKm) * 1000;
  return dDist === 0 ? 0 : Math.round((dEle / dDist) * 100);
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
  const rawSegs = validated.map((seg, i) => {
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

  // ── PASSE 4 — fusion des segments trop courts ou à vitesse identique ──────
  // Règle 1 : segments < 1km fusionnés avec le voisin à vitesse la plus proche
  // Règle 2 : segments consécutifs à ±0.5 km/h fusionnés (même allure pratique)
  const mergeSegs = (segs) => {
    if (segs.length <= 1) return segs;
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

        // Fusion si vitesses proches (±0.5 km/h)
        if (nextSeg && Math.abs(seg.speedKmh - nextSeg.speedKmh) <= 0.5) {
          const mergedDist = nextSeg.endKm - seg.startKm;
          const weightedSpeed = +((seg.speedKmh * dist + nextSeg.speedKmh * (nextSeg.endKm - nextSeg.startKm)) / mergedDist).toFixed(1);
          const mergedSlope = Math.round((seg.slopePct * dist + nextSeg.slopePct * (nextSeg.endKm - nextSeg.startKm)) / mergedDist);
          next.push({ ...seg, endKm: nextSeg.endKm, speedKmh: weightedSpeed, slopePct: mergedSlope });
          i += 2; changed = true;
          continue;
        }

        // Fusion si segment < 1km
        if (dist < 1.0 && nextSeg) {
          const mergedDist = nextSeg.endKm - seg.startKm;
          const weightedSpeed = +((seg.speedKmh * dist + nextSeg.speedKmh * (nextSeg.endKm - nextSeg.startKm)) / mergedDist).toFixed(1);
          const mergedSlope = Math.round((seg.slopePct * dist + nextSeg.slopePct * (nextSeg.endKm - nextSeg.startKm)) / mergedDist);
          next.push({ ...seg, endKm: nextSeg.endKm, speedKmh: weightedSpeed, slopePct: mergedSlope });
          i += 2; changed = true;
          continue;
        }

        next.push(seg);
        i++;
      }
      out = next;
    }
    return out;
  };

  return mergeSegs(rawSegs).map((seg, i) => ({ ...seg, id: Date.now() + i }));
}
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

// ─── NUTRITION ───────────────────────────────────────────────────────────────
export function calcNutrition(seg, settings) {
  if (seg.type === "repos") return { kcal: 0, kcalH: 0, glucidesH: 0, lipidesH: 0, proteinesH: 0, eauH: 0, selH: 0, cafeineH: 0, durationH: 0 };
  const { weight = 70, kcalPerKm = 65, kcalPerKmUphill = 90, tempC = 15, rain = false, wind = false, snow = false, kcalSource = "minetti", garminStats = null, glucidesTargetGh = null } = settings;
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
  const isHot = tempC > 25;
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
export function exportRecap(race, segments, settings, profile, passingTimes) {
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
export function saveImage() {
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
export function fmtHeure(sec) {
  const total = ((sec % 86400) + 86400) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
export function isNight(sec) {
  const h = Math.floor(((sec % 86400) + 86400) % 86400 / 3600);
  return h >= 21 || h < 6;
}
// ─── EXPORT GPX MONTRE ───────────────────────────────────────────────────────
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
