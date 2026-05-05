// Calculs nutrition + helpers stock/recette
import { isEauPure } from '../autoCompleteAlgo.js';

// ─── calcNutrition ──────────────────────────────────────────────────────
export function calcNutrition(seg, settings) {
  if (seg.type === "repos") return { kcal: 0, kcalH: 0, glucidesH: 0, lipidesH: 0, proteinesH: 0, eauH: 0, sodiumH: 0, selH: 0, cafeineH: 0, durationH: 0 };
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
    // Minetti et al. (2002) - Journal of Applied Physiology
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
  
  // ── GLUCIDES : Jeukendrup (2014) ──
  // Priorité à la valeur paramétrée (capacité intestinale coureur).
  // Fallback : 60 g/h (recommandation de base pour effort endurance >1h).
  const glucidesH = glucidesTargetGh != null ? Math.round(glucidesTargetGh) : 60;
  
  // ── PROTÉINES : Pugh (2018), Kato (2016) ──
  // 5 g/h de base, plafonné à 10 g/h (au-delà : inutile en course).
  const proteinesH = Math.max(5, Math.min(10, Math.round(kcalH * 0.06 / 4)));
  
  // ── LIPIDES : Burke (2015) ──
  // Résiduel kcal, plafonné à 10 g/h (digestion lente = inconfort).
  const lipidesResiduels = Math.max(0, Math.round((kcalH - glucidesH * 4 - proteinesH * 4) / 9));
  const lipidesH = Math.min(10, lipidesResiduels);
  
  // ── EAU : Sawka (2007), ACSM (2016) ──
  // 500 ml/h base, 750 chaud, 350 froid. +100 si vent (déshydratation accrue).
  const waterBase = isHot ? 750 : isCold ? 350 : 500;
  const eauH = Math.round(waterBase + (wind ? 100 : 0));
  
  // ── SODIUM : Hoffman (2015), Costa (2019) ──
  // 500 mg/h base, 700 chaud, 400 froid (pertes sudorales variables).
  // Attention : "sodium" ≠ "sel" (NaCl). 1g sel = 400mg sodium.
  const sodiumH = isHot ? 700 : isCold ? 400 : 500;
  // selH conservé pour rétro-compat (convertit sodium → sel NaCl)
  const selH = Math.round(sodiumH / 0.4);
  
  const cumDurationH = seg.speedKmh > 0 ? (seg.startKm || 0) / seg.speedKmh : 0;
  const cafeineH = cumDurationH >= 2 ? Math.round(30 + Math.min(seg.slopePct * 2, 40)) : 0;
  return { kcal, kcalH, glucidesH, lipidesH, proteinesH, eauH, sodiumH, selH, cafeineH, durationH };
}

// ─── Helpers recette / stock ────────────────────────────────────────────
export function isRecette(item) {
  return Array.isArray(item?.ingredients);
}

// Calcule le poids en grammes d'une quantité stockée.
// - Produit liquide (boisson) : quantite en ml ≈ grammes (1 ml d'eau = 1 g)
// - Produit solide : quantite en grammes directement
// - Recette : quantite × (volumeMlParPortion ou grammesParPortion)
export function poidsDuStock(item, quantite) {
  if (!item || !quantite) return 0;
  if (isRecette(item)) {
    const portionMl = parseFloat(item.volumeMlParPortion) || 0;
    const portionG = parseFloat(item.grammesParPortion) || 0;
    if (portionMl > 0) return Math.round(quantite * portionMl);
    if (portionG > 0) return Math.round(quantite * portionG);
    return 0;
  }
  return Math.round(quantite);
}

// Construit les zones de poids nutrition entre points de rechargement.
// Rechargement = départ (km 0) ou ravito avec assistancePresente !== false.
// Les ravitos autonomes sont ignorés (leurs produits sont déjà inclus dans le
// rechargement précédent via la stratégie "porter").
// Retour : [{ startKm, endKm, poidsInitialG }, ...]
export function buildPoidsZones(race, allItems = []) {
  const totalDist = race?.totalDistance || 0;
  if (totalDist <= 0) return [];
  const ravitosAssist = (race?.ravitos || []).filter(r => r.assistancePresente !== false)
    .slice().sort((a, b) => (a.km || 0) - (b.km || 0));
  const sumPoids = (produits = []) =>
    produits.reduce((s, { id, quantite }) => {
      const item = allItems.find(it => it.id === id);
      return s + poidsDuStock(item, parseFloat(quantite) || 0);
    }, 0);
  const zones = [];
  let prev = { km: 0, produits: race?.depart?.produits || [] };
  for (const r of ravitosAssist) {
    if ((r.km || 0) <= prev.km) continue;
    zones.push({ startKm: prev.km, endKm: r.km, poidsInitialG: sumPoids(prev.produits) });
    prev = { km: r.km, produits: r.produits || [] };
  }
  zones.push({ startKm: prev.km, endKm: totalDist, poidsInitialG: sumPoids(prev.produits) });
  return zones;
}

// Poids nutrition transporté à un km donné — décroissance linéaire dans la zone.
export function poidsNutritionAtKm(km, zones) {
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

// Calcule les kcal totaux d'une recette (somme des ingrédients × quantité/100).
// `allItems` doit contenir les produits référencés dans `recette.ingredients`.
export function calcKcalRecette(recette, allItems) {
  return (recette.ingredients || []).reduce((acc, ing) => {
    const data = ing._ciqualData || allItems.find(p => p.id === ing.produitId);
    if (!data) return acc;
    const factor = parseFloat(ing.quantite) || 0;
    return acc + (data.kcal || 0) * factor / 100;
  }, 0);
}

// Calcule les kcal d'une quantité stockée (produit ou recette).
// - Produit : kcal/100g, quantite en grammes
// - Recette : (kcal_total_recette / portions) × quantite_en_portions
export function kcalDuStock(item, quantite, allItems) {
  if (isRecette(item)) {
    const total = calcKcalRecette(item, allItems);
    const portions = parseFloat(item.portions) || 1;
    return Math.round((total / portions) * (quantite || 0));
  }
  return Math.round((item.kcal || 0) * (quantite || 0) / 100);
}

// Formate une quantité avec son unité claire selon le type d'item :
// - Recette → "× N" (portions)
// - Produit boisson → "N ml" (1g de liquide ≈ 1ml)
// - Produit solide → "N g"
export function formatQuantiteStock(item, quantite, flasqueMl = 500) {
  // Eau pure : affichage en flasques si quantité multiple entier
  if (isEauPure(item) && flasqueMl > 0) {
    const n = quantite / flasqueMl;
    if (Number.isInteger(n) && n > 0) return `${n} × ${flasqueMl}ml`;
    return `${quantite} ml`;
  }
  if (isRecette(item)) {
    // Recette : quantite = nb portions
    const portionMl = parseFloat(item.volumeMlParPortion) || 0;
    const portionG = parseFloat(item.grammesParPortion) || 0;
    if (portionMl > 0) return `${quantite} × ${portionMl}ml`;
    if (portionG > 0) return `${quantite} × ${portionG}g`;
    return `${quantite} portion${quantite > 1 ? "s" : ""}`;
  }
  // Produit : quantite = grammes (ou ml pour boisson)
  const unitMl = parseFloat(item.volumeMlParUnite) || 0;
  const unitG = parseFloat(item.grammesParUnite) || 0;
  if (unitMl > 0) {
    const n = quantite / unitMl;
    if (Number.isInteger(n) && n > 0) return `${n} × ${unitMl}ml`;
  } else if (unitG > 0) {
    const n = quantite / unitG;
    if (Number.isInteger(n) && n > 0) return `${n} × ${unitG}g`;
  }
  const isLiq = item.boisson || (item.categorie || "").toLowerCase().includes("boisson");
  return isLiq ? `${quantite} ml` : `${quantite} g`;
}
