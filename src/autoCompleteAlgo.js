// ─── ALGO AUTOCOMPLÉTION NUTRITION COURSE — Phase 4a ────────────────────────
//
// Objectif : à partir de la bibliothèque, remplir chaque zone avec les produits
// qui couvrent les besoins en priorité : Eau (T1) > Glucides (T1) > Sodium (T1)
// > Kcal (T2) > reste.
//
// Principes :
//   1. On respecte la répartition eau pure / boisson énergétique de la stratégie
//   2. On priorise les glucides via la meilleure densité (g glucides / g produit)
//   3. On diversifie (pas plus de 60% d'un même solide par zone)
//   4. On arrondit par unité si format unitaire connu, sinon par 10g
//   5. On laisse les micros T3 "tomber" naturellement sans chercher à les viser
//
// Phase 4a : on traite chaque zone indépendamment.
// Phase 4b ajoutera la répartition intelligente entre ravitos.
// Phase 4c ajoutera la gestion zones autonomes.

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Détection "Eau pure" : robuste (nom contient "eau" + macros nuls), pour gérer
// les produits utilisateurs sans flag boisson explicite (cas legacy / import).
export function isEauPure(it) {
  if (it.type === "Eau pure") return true;
  const nom = (it.nom || "").toLowerCase();
  if (!nom.includes("eau")) return false;
  // Eau = nutriments à zéro (sodium possible mais marginal)
  const isProduit = it.itemType === "produit" || (!it.itemType && !it.macros);
  if (isProduit) {
    const k = it.kcal || 0, g = it.glucides || 0, p = it.proteines || 0, l = it.lipides || 0;
    return k <= 5 && g <= 1 && p <= 1 && l <= 1;
  }
  // Recette : check macros
  const m = it.macros || {};
  return (m.kcal || 0) <= 5 && (m.glucides || 0) <= 1;
}

// Détection "Boisson énergétique" : tout liquide qui n'est pas de l'eau pure
export function isBoissonEnergetique(it) {
  if (it.type === "Boisson énergétique") return true;
  if (isEauPure(it)) return false;
  // Recette boisson : flag explicite ou volumeMlParPortion défini
  if (it.itemType === "recette") {
    return !!(it.boisson || (it.volumeMlParPortion && it.volumeMlParPortion > 0));
  }
  // Produit boisson : flag ou catégorie
  return !!(it.boisson || (it.categorie || "").toLowerCase().includes("boisson"));
}

// Test "produit liquide" pour calcul de l'eauMl (utilisé par nutrimentsFor)
function isLiquide(item) {
  return isEauPure(item) || isBoissonEnergetique(item);
}

// Retourne le nutriment pour une quantité donnée d'un item (produit ou recette)
// Pour un produit : quantite en grammes, valeurs en /100g
// Pour une recette : quantite en portions
function nutrimentsFor(item, quantite) {
  const isProduit = item.itemType === "produit";
  const liquide = isLiquide(item);
  
  if (isProduit) {
    const factor = (parseFloat(quantite) || 0) / 100;
    return {
      kcal: (item.kcal || 0) * factor,
      glucides: (item.glucides || 0) * factor,
      proteines: (item.proteines || 0) * factor,
      lipides: (item.lipides || 0) * factor,
      sodium: (item.sodium || 0) * factor,
      eauMl: liquide ? (parseFloat(quantite) || 0) : 0,  // 1g eau = 1ml
      poidsG: parseFloat(quantite) || 0,
      volumeMl: liquide ? (parseFloat(quantite) || 0) : 0
    };
  }
  
  // Recette : quantite = nombre de portions
  const portions = parseFloat(quantite) || 0;
  const macros = item.macros || {};
  const poidsPortion = parseFloat(item.grammesParPortion) || 0;
  const volumePortion = parseFloat(item.volumeMlParPortion) || 0;
  
  return {
    kcal: (macros.kcal || 0) * portions,
    glucides: (macros.glucides || 0) * portions,
    proteines: (macros.proteines || 0) * portions,
    lipides: (macros.lipides || 0) * portions,
    sodium: (macros.sodium || 0) * portions,
    eauMl: liquide ? volumePortion * portions : 0,
    poidsG: poidsPortion * portions,
    volumeMl: liquide ? volumePortion * portions : 0
  };
}

// Densité glucidique (g glucides par gramme transporté) — pour optimiser le poids transporté
function densiteGlucides(item) {
  if (item.itemType === "produit") {
    return (item.glucides || 0) / 100;  // ex: 70g glu / 100g barre = 0.70
  }
  // Recette
  const poids = parseFloat(item.grammesParPortion) || 100;  // fallback 100g/portion
  const glu = (item.macros?.glucides || 0);
  return glu / poids;
}

// Quantité par "incrément" d'un item selon son format
//   - Format unitaire défini : 1 unité (= grammesParUnite ou 1 portion)
//   - Sinon pour un solide : 30g par incrément
//   - Pour une boisson : 250ml par incrément
function incrementQuantite(item) {
  if (item.itemType === "recette") return 1;  // 1 portion
  if (item.grammesParUnite && item.grammesParUnite > 0) {
    return parseFloat(item.grammesParUnite);
  }
  if (isLiquide(item)) return 250;  // 250ml par dose boisson par défaut
  return 30;  // 30g de solide par incrément par défaut
}

// Arrondi final intelligent
//   - Si recette : arrondir à l'entier
//   - Si format unitaire : arrondir au multiple du poids unitaire
//   - Sinon : arrondir par 10g (solide) ou 50ml (boisson)
function arrondirQuantite(item, quantite) {
  if (item.itemType === "recette") return Math.max(1, Math.round(quantite));
  
  if (item.grammesParUnite && item.grammesParUnite > 0) {
    const unite = parseFloat(item.grammesParUnite);
    return Math.max(unite, Math.round(quantite / unite) * unite);
  }
  
  if (isLiquide(item)) {
    return Math.max(50, Math.round(quantite / 50) * 50);
  }
  
  return Math.max(10, Math.round(quantite / 10) * 10);
}

// ─── ALGO PAR ZONE ───────────────────────────────────────────────────────────

/**
 * Calcule un plan pour UNE zone (ensemble de besoins sur une portion de course).
 *
 * @param {Object} params
 * @param {Object} params.besoin        - {kcal, eau, glucides, sodium} estimés pour la zone
 * @param {Array}  params.bibliotheque  - produits + recettes dispo (avec itemType)
 * @param {Object} params.strategy      - stratégie nutrition de la course (hydratation, transport, etc.)
 * @param {Boolean} params.isDepart     - true si c'est la zone départ (pas de minimum sécurité)
 * @returns {Array} plan = [{id, quantite}]
 */
export function planPourZone({ besoin, bibliotheque, strategy, isDepart = false }) {
  const plan = [];
  const addOrMerge = (id, qte) => {
    const existing = plan.find(p => p.id === id);
    if (existing) existing.quantite += qte;
    else plan.push({ id, quantite: qte });
  };

  // ── CLASSIFICATION DES ITEMS ──
  // Détection robuste via helpers (ne dépend pas du flag boisson uniquement).
  const eauxPures = bibliotheque.filter(isEauPure);
  const boissonsEnergie = bibliotheque.filter(isBoissonEnergetique);
  const pastillesSel = bibliotheque.filter(it => it.type === "Pastille sel / électrolytes");
  const solides = bibliotheque.filter(it =>
    !isEauPure(it) &&
    !isBoissonEnergetique(it) &&
    it.type !== "Pastille sel / électrolytes"
  );

  // Tri solides par densité glucidique décroissante (optimiser poids transporté)
  solides.sort((a, b) => densiteGlucides(b) - densiteGlucides(a));

  // ── ÉTAT D'AVANCEMENT ──
  let totalKcal = 0, totalGluc = 0, totalEau = 0, totalSodium = 0, poidsSolide = 0;
  const cibleKcal = besoin.kcal || 0;
  const cibleGluc = besoin.glucides || 0;
  const cibleEau = besoin.eau || 0;  // en ml
  const cibleSodium = besoin.sodium || 0;

  // ── PASSE 1 : HYDRATATION (selon stratégie) ──
  // On applique la répartition eau pure / boisson énergétique définie dans la stratégie.
  // Si la cible eau de la zone est inférieure à la stratégie, on réduit proportionnellement.
  const stratEauMl = strategy?.hydratation?.eauPureMl || 0;
  const stratBoissonMl = strategy?.hydratation?.boissonEnergetiqueMl || 0;
  const stratTotalMl = stratEauMl + stratBoissonMl;
  const flasqueMl = strategy?.hydratation?.flasqueMl || 500;
  
  // Ajuster à la cible de la zone (on ne transporte pas plus que le besoin + 10%)
  const cibleTotalMl = Math.round(cibleEau * 1.1);
  const ratioAjust = stratTotalMl > 0 ? Math.min(1, cibleTotalMl / stratTotalMl) : 1;
  const eauCibleMl = Math.round(stratEauMl * ratioAjust);
  const boissonCibleMl = Math.round(stratBoissonMl * ratioAjust);
  
  // Fallback si stratégie = 0 : on prend 50/50 basé sur la cible
  const eauFinalMl = stratTotalMl > 0 ? eauCibleMl : Math.round(cibleEau * 0.5);
  const boissonFinalMl = stratTotalMl > 0 ? boissonCibleMl : Math.round(cibleEau * 0.5);

  // Ajouter eau pure (arrondie au multiple de flasque — remplissage pratique)
  if (eauFinalMl > 0 && eauxPures.length > 0) {
    const eau = eauxPures[0];
    // Arrondir au multiple de flasque le plus proche (au moins 1 flasque si besoin > 0)
    const nbFlasques = Math.max(1, Math.round(eauFinalMl / flasqueMl));
    const qte = nbFlasques * flasqueMl;
    if (qte > 0) {
      addOrMerge(eau.id, qte);
      const n = nutrimentsFor(eau, qte);
      totalEau += n.eauMl;
      totalKcal += n.kcal;
      totalGluc += n.glucides;
      totalSodium += n.sodium;
    }
  }

  // Ajouter boisson énergétique (on prend la mieux dotée en glucides)
  if (boissonFinalMl > 0 && boissonsEnergie.length > 0) {
    // Meilleure boisson = celle avec le plus de glucides au ml
    const meilleureBoisson = [...boissonsEnergie].sort((a, b) => {
      const dA = densiteGlucides(a);
      const dB = densiteGlucides(b);
      return dB - dA;
    })[0];
    
    const isRecette = meilleureBoisson.itemType === "recette";
    let qte;
    if (isRecette) {
      const volPortion = parseFloat(meilleureBoisson.volumeMlParPortion) || 500;
      qte = Math.max(1, Math.round(boissonFinalMl / volPortion));
    } else {
      qte = arrondirQuantite(meilleureBoisson, boissonFinalMl);
    }
    if (qte > 0) {
      addOrMerge(meilleureBoisson.id, qte);
      const n = nutrimentsFor(meilleureBoisson, qte);
      totalEau += n.eauMl;
      totalKcal += n.kcal;
      totalGluc += n.glucides;
      totalSodium += n.sodium;
    }
  }

  // ── PASSE 2 : GLUCIDES VIA SOLIDES ──
  // Compléter le manque en glucides via les solides, en diversifiant (max ~60% par produit)
  // et en respectant la capacité de transport solide.
  const solideMaxG = strategy?.transport?.solideMaxG || 500;
  let manqueGluc = cibleGluc - totalGluc;
  const maxIterations = 40;  // garde-fou
  const utilisationParSolide = {};  // tracking diversité
  
  for (let i = 0; i < maxIterations && manqueGluc > 3 && solides.length > 0; i++) {
    if (poidsSolide >= solideMaxG) break;  // saturation transport
    
    // Choisir le meilleur solide pour le manque actuel, en évitant la sur-utilisation
    let bestItem = null;
    let bestScore = -Infinity;
    
    for (const s of solides) {
      const inc = incrementQuantite(s);
      const nutri = nutrimentsFor(s, inc);
      if (nutri.glucides <= 0) continue;
      
      // Score = gain glucides / poids (efficacité transport)
      const poidsInc = nutri.poidsG || inc;
      if (poidsSolide + poidsInc > solideMaxG) continue;  // skip si dépasse transport
      
      const efficacite = nutri.glucides / Math.max(1, poidsInc);
      // Pénalité de diversité : -50% si déjà beaucoup utilisé
      const dejaUtilise = utilisationParSolide[s.id] || 0;
      const penaliteDivers = dejaUtilise > 0 ? Math.max(0.5, 1 - dejaUtilise * 0.15) : 1;
      const score = efficacite * penaliteDivers;
      
      if (score > bestScore) {
        bestScore = score;
        bestItem = { item: s, inc, nutri };
      }
    }
    
    if (!bestItem) break;
    
    addOrMerge(bestItem.item.id, bestItem.inc);
    totalKcal += bestItem.nutri.kcal;
    totalGluc += bestItem.nutri.glucides;
    totalSodium += bestItem.nutri.sodium;
    poidsSolide += bestItem.nutri.poidsG || bestItem.inc;
    utilisationParSolide[bestItem.item.id] = (utilisationParSolide[bestItem.item.id] || 0) + 1;
    manqueGluc = cibleGluc - totalGluc;
  }

  // ── PASSE 3 : SODIUM SI DÉFICIT MARQUÉ ──
  // Si le sodium planifié < 80% de la cible et qu'on a une pastille sel, ajouter.
  if (cibleSodium > 0 && totalSodium < cibleSodium * 0.8 && pastillesSel.length > 0) {
    const pastille = pastillesSel[0];
    const inc = incrementQuantite(pastille);
    const nutri = nutrimentsFor(pastille, inc);
    if (nutri.sodium > 0) {
      // Combien de pastilles pour combler le déficit ?
      const deficit = cibleSodium - totalSodium;
      const nbPastilles = Math.min(3, Math.ceil(deficit / nutri.sodium));
      addOrMerge(pastille.id, inc * nbPastilles);
      totalSodium += nutri.sodium * nbPastilles;
      totalKcal += nutri.kcal * nbPastilles;
    }
  }

  // ── PASSE 4 : ARRONDI FINAL ──
  // Les incréments sont déjà quantifiés, mais pour les autres items on consolide.
  // Note : pour l'eau pure, on préserve le multiple de flasque déjà appliqué.
  return plan.map(p => {
    const item = bibliotheque.find(b => b.id === p.id);
    if (!item) return p;
    // Eau pure : déjà arrondie au multiple de flasque, on ne touche pas
    if (isEauPure(item)) return p;
    return { ...p, quantite: arrondirQuantite(item, p.quantite) };
  });
}

// ─── ALGO GLOBAL (toutes les zones) ──────────────────────────────────────────

/**
 * Pré-traite les zones selon les stratégies de zones autonomes.
 *
 * Une zone est considérée autonome si elle est marquée `isAutonome: true`
 * (passé par NutritionView) OU si une stratégie explicite est définie pour elle.
 *
 * Stratégie par défaut pour zone autonome sans config explicite : "porter" + "avant".
 *
 * - "orga" : besoin de la zone = 0 (couvert par l'organisation)
 * - "porter" + repartition="avant" : 100% du besoin transféré sur la zone précédente
 * - "porter" + repartition="split" : 50% sur précédente, 50% sur suivante
 * - "mix" : 50% sur précédente, 50% effacé (orga)
 */
function appliquerStrategiesAutonomes(zones, strategy) {
  const adjusted = zones.map(z => ({ ...z, besoin: { ...z.besoin } }));
  
  const addBesoin = (target, source, ratio = 1) => {
    Object.keys(source).forEach(k => {
      target[k] = (target[k] || 0) + (source[k] || 0) * ratio;
    });
  };
  
  for (let i = adjusted.length - 1; i >= 1; i--) {
    const zone = adjusted[i];
    const explicitConfig = strategy?.ravitos?.[zone.pointKey];
    
    // Pas de config explicite + pas autonome → on saute
    if (!explicitConfig?.strategieAutonome && !zone.isAutonome) continue;
    
    // Sinon : config explicite OU défaut "porter avant" pour zone autonome
    const strat = explicitConfig?.strategieAutonome || "porter";
    const repartition = explicitConfig?.repartitionPorter || "avant";
    const besoinZone = { ...zone.besoin };
    
    if (strat === "orga") {
      Object.keys(zone.besoin).forEach(k => { zone.besoin[k] = 0; });
    } else if (strat === "porter") {
      if (repartition === "split" && i + 1 < adjusted.length) {
        addBesoin(adjusted[i - 1].besoin, besoinZone, 0.5);
        addBesoin(adjusted[i + 1].besoin, besoinZone, 0.5);
      } else {
        addBesoin(adjusted[i - 1].besoin, besoinZone, 1);
      }
      Object.keys(zone.besoin).forEach(k => { zone.besoin[k] = 0; });
    } else if (strat === "mix") {
      addBesoin(adjusted[i - 1].besoin, besoinZone, 0.5);
      Object.keys(zone.besoin).forEach(k => { zone.besoin[k] = 0; });
    }
  }
  
  return adjusted;
}

/**
 * Calcule un plan complet pour toutes les zones d'une course.
 *
 * Architecture en 2 passes (Phase 4b) :
 *
 * Passe 1 — Construction d'une PALETTE de produits pour toute la course :
 *   - Sélectionne une variété raisonnable (1 eau, 1-2 boissons, 2-4 solides, 0-1 pastille)
 *   - Évite la fatigue gustative en privilégiant la diversité de profils
 *
 * Passe 2 — Distribution des produits dans les zones :
 *   - Respecte le besoin de chaque zone (pas de sur-couverture)
 *   - Respecte la capacité transport par zone
 *   - Pénalité souple sur les répétitions consécutives
 *   - Skip les zones autonomes (besoins déjà reportés par Phase 4c)
 *
 * @param {Object} params
 * @param {Array}  params.zones        - zones calculées depuis NutritionView
 * @param {Array}  params.bibliotheque - allBibItems (produits + recettes enrichis)
 * @param {Object} params.strategy     - getNutritionStrategy(race)
 * @returns {Object} plan = { [pointKey]: [{id, quantite}] }
 */
export function calculerPlanComplet({ zones, bibliotheque, strategy }) {
  // Phase 4c : ajuster les besoins selon stratégies zones autonomes
  const zonesAjustees = appliquerStrategiesAutonomes(zones, strategy);
  
  // Zones effectivement remplies (pas autonomes ou avec besoin résiduel)
  const zonesActives = zonesAjustees
    .map((z, i) => ({ ...z, originalIndex: i }))
    .filter(z => {
      const total = (z.besoin.kcal || 0) + (z.besoin.glucides || 0) + (z.besoin.eau || 0);
      return total > 0;
    });
  
  // Plan vide pour zones non-actives
  const plan = {};
  zonesAjustees.forEach(z => { plan[z.pointKey] = []; });
  
  if (zonesActives.length === 0) return plan;
  
  // ── PASSE 1 : CONSTRUCTION DE LA PALETTE ──
  const palette = construirePalette(bibliotheque, zonesActives, strategy);
  
  // ── PASSE 2 : DISTRIBUTION DANS LES ZONES ──
  return distribuerPalette(palette, zonesActives, plan, strategy, bibliotheque);
}

// ─── PASSE 1 : CONSTRUCTION PALETTE ──────────────────────────────────────────

/**
 * Construit une palette de produits pour toute la course.
 * Vise la diversité gustative tout en couvrant les besoins macros/eau/sodium.
 */
function construirePalette(bibliotheque, zonesActives, strategy) {
  // Classifications via helpers (cohérent avec planPourZone)
  const eauxPures = bibliotheque.filter(isEauPure);
  const boissonsEnergie = bibliotheque.filter(isBoissonEnergetique);
  const pastillesSel = bibliotheque.filter(it => it.type === "Pastille sel / électrolytes");
  const solides = bibliotheque.filter(it =>
    !isEauPure(it) &&
    !isBoissonEnergetique(it) &&
    it.type !== "Pastille sel / électrolytes"
  );
  
  const palette = {
    eau: eauxPures[0] || null,
    boissons: [],
    solides: [],
    pastille: null
  };
  
  // Boissons énergétiques : on prend la meilleure densité glucidique, +1 alternative si dispo
  if (boissonsEnergie.length > 0) {
    const sorted = [...boissonsEnergie].sort((a, b) => densiteGlucides(b) - densiteGlucides(a));
    palette.boissons.push(sorted[0]);
    // Alternative : différente catégorie si possible (variation gustative)
    if (sorted.length > 1) {
      const alt = sorted.find(b => b.id !== sorted[0].id && (b.categorie || "") !== (sorted[0].categorie || ""))
        || (sorted.length > 2 ? sorted[1] : null);
      if (alt) palette.boissons.push(alt);
    }
  }
  
  // Solides : on cherche la diversité gustative.
  // Tri par densité glucidique, on garde jusqu'à 4 solides différents par nom.
  // La dédup par catégorie est appliquée seulement si on a beaucoup de candidats
  // d'une même catégorie (sinon trop restrictif quand les catégories sont vides).
  if (solides.length > 0) {
    const sorted = [...solides].sort((a, b) => densiteGlucides(b) - densiteGlucides(a));
    const TARGET_SOLIDES = Math.min(4, sorted.length);
    
    // Étape 1 : prendre les N meilleurs en évitant les doublons exacts (même nom)
    const nomsVus = new Set();
    for (const s of sorted) {
      const nom = (s.nom || "").toLowerCase().trim();
      if (nom && nomsVus.has(nom)) continue;
      nomsVus.add(nom);
      palette.solides.push(s);
      if (palette.solides.length >= TARGET_SOLIDES) break;
    }
    
    // Étape 2 : si on a la place et plusieurs candidats d'une même catégorie,
    // remplacer le moins efficace de cette cat par un de catégorie différente
    // (prudent : ne casse pas l'invariant minimum 2 solides)
    if (palette.solides.length >= 3) {
      const parCat = {};
      palette.solides.forEach(s => {
        const c = s.categorie || "autre";
        parCat[c] = (parCat[c] || 0) + 1;
      });
      const catDominante = Object.entries(parCat).find(([, n]) => n >= 3)?.[0];
      if (catDominante) {
        // Chercher un solide d'autre catégorie qu'on n'a pas encore pris
        const alternative = sorted.find(s => 
          (s.categorie || "autre") !== catDominante &&
          !palette.solides.find(p => p.id === s.id)
        );
        if (alternative) {
          // Remplacer le moins dense de la cat dominante
          const aRemplacer = [...palette.solides]
            .filter(s => (s.categorie || "autre") === catDominante)
            .sort((a, b) => densiteGlucides(a) - densiteGlucides(b))[0];
          if (aRemplacer) {
            palette.solides = palette.solides.map(s => s.id === aRemplacer.id ? alternative : s);
          }
        }
      }
    }
  }
  
  // Pastille sel : seulement si déficit prévisible
  // On regarde si la palette actuelle couvre le sodium total
  if (pastillesSel.length > 0) {
    const totalSodiumNeeds = zonesActives.reduce((s, z) => s + (z.besoin.sodium || 0), 0);
    // Estimation rapide : si les boissons + solides ne couvrent probablement pas → ajouter pastille
    // On met toujours la pastille dispo, la passe 2 décidera si on l'utilise
    if (totalSodiumNeeds > 0) {
      palette.pastille = pastillesSel[0];
    }
  }
  
  return palette;
}

// ─── PASSE 2 : DISTRIBUTION DANS LES ZONES ──────────────────────────────────

/**
 * Distribue les produits de la palette dans les zones actives.
 * Pour chaque zone, on remplit en respectant :
 *  - le besoin (eau, glucides, sodium)
 *  - la capacité transport (solideMaxG, liquideMaxMl)
 *  - une pénalité de répétition consécutive
 */
function distribuerPalette(palette, zonesActives, plan, strategy, bibliotheque) {
  // Tracking : par produit, dans quelles zones consécutives il a été placé
  const dernieresUtilisations = {};  // { itemId: zoneIndex de la dernière utilisation }
  
  zonesActives.forEach((zone) => {
    const isDepart = zone.originalIndex === 0;
    const planZone = remplirZone({
      zone,
      palette,
      strategy,
      isDepart,
      dernieresUtilisations,
      currentZoneIndex: zone.originalIndex
    });
    plan[zone.pointKey] = planZone;
    
    // Mettre à jour les "dernières utilisations" pour la pénalité de répétition
    planZone.forEach(p => {
      dernieresUtilisations[p.id] = zone.originalIndex;
    });
  });
  
  return plan;
}

/**
 * Remplit une zone à partir de la palette en appliquant les contraintes.
 * Logique similaire à planPourZone mais utilise UNIQUEMENT les produits de la palette
 * et applique une pénalité de score sur les produits utilisés dans la zone précédente.
 */
function remplirZone({ zone, palette, strategy, isDepart, dernieresUtilisations, currentZoneIndex }) {
  const planZone = [];
  const addOrMerge = (id, qte) => {
    const existing = planZone.find(p => p.id === id);
    if (existing) existing.quantite += qte;
    else planZone.push({ id, quantite: qte });
  };
  
  let totalKcal = 0, totalGluc = 0, totalEau = 0, totalSodium = 0, poidsSolide = 0;
  const cibleGluc = zone.besoin.glucides || 0;
  const cibleEau = zone.besoin.eau || 0;
  const cibleSodium = zone.besoin.sodium || 0;
  
  // ── HYDRATATION : eau pure + boisson énergétique ──
  const stratEauMl = strategy?.hydratation?.eauPureMl || 0;
  const stratBoissonMl = strategy?.hydratation?.boissonEnergetiqueMl || 0;
  const stratTotalMl = stratEauMl + stratBoissonMl;
  const flasqueMl = strategy?.hydratation?.flasqueMl || 500;
  
  const cibleTotalMl = Math.round(cibleEau * 1.1);
  const ratioAjust = stratTotalMl > 0 ? Math.min(1, cibleTotalMl / stratTotalMl) : 1;
  const eauCibleMl = stratTotalMl > 0 ? Math.round(stratEauMl * ratioAjust) : Math.round(cibleEau * 0.5);
  const boissonCibleMl = stratTotalMl > 0 ? Math.round(stratBoissonMl * ratioAjust) : Math.round(cibleEau * 0.5);
  
  // Eau pure
  if (eauCibleMl > 0 && palette.eau) {
    const nbFlasques = Math.max(1, Math.round(eauCibleMl / flasqueMl));
    const qte = nbFlasques * flasqueMl;
    addOrMerge(palette.eau.id, qte);
    const n = nutrimentsFor(palette.eau, qte);
    totalEau += n.eauMl;
    totalKcal += n.kcal;
    totalGluc += n.glucides;
    totalSodium += n.sodium;
  }
  
  // Boisson énergétique : alterner entre les boissons disponibles selon la zone précédente
  if (boissonCibleMl > 0 && palette.boissons.length > 0) {
    const boisson = choisirAvecPenalite(
      palette.boissons,
      dernieresUtilisations,
      currentZoneIndex
    );
    
    const isRecette = boisson.itemType === "recette";
    let qte;
    if (isRecette) {
      const volPortion = parseFloat(boisson.volumeMlParPortion) || 500;
      qte = Math.max(1, Math.round(boissonCibleMl / volPortion));
    } else {
      qte = arrondirQuantite(boisson, boissonCibleMl);
    }
    if (qte > 0) {
      addOrMerge(boisson.id, qte);
      const n = nutrimentsFor(boisson, qte);
      totalEau += n.eauMl;
      totalKcal += n.kcal;
      totalGluc += n.glucides;
      totalSodium += n.sodium;
    }
  }
  
  // ── SOLIDES : compléter glucides ──
  const solideMaxG = strategy?.transport?.solideMaxG || 500;
  let manqueGluc = cibleGluc - totalGluc;
  const maxIter = 40;
  const utilisationParSolide = {};
  
  for (let i = 0; i < maxIter && manqueGluc > 3 && palette.solides.length > 0; i++) {
    if (poidsSolide >= solideMaxG) break;
    
    // Combien de solides éligibles n'ont jamais été utilisés dans cette zone ?
    // On veut qu'ils passent en priorité tant que la place le permet.
    const eligibles = palette.solides.filter(s => {
      const inc = incrementQuantite(s);
      const nutri = nutrimentsFor(s, inc);
      if (nutri.glucides <= 0) return false;
      const poidsInc = nutri.poidsG || inc;
      return poidsSolide + poidsInc <= solideMaxG;
    });
    const inutilisesEligibles = eligibles.filter(s => !utilisationParSolide[s.id]);
    const phaseRotation = inutilisesEligibles.length > 0;
    
    let bestItem = null;
    let bestScore = -Infinity;
    
    for (const s of palette.solides) {
      const inc = incrementQuantite(s);
      const nutri = nutrimentsFor(s, inc);
      if (nutri.glucides <= 0) continue;
      
      const poidsInc = nutri.poidsG || inc;
      if (poidsSolide + poidsInc > solideMaxG) continue;
      
      // Phase rotation : on ignore les solides déjà utilisés tant qu'il en reste des inutilisés
      const dejaUtilise = utilisationParSolide[s.id] || 0;
      if (phaseRotation && dejaUtilise > 0) continue;
      
      // Efficacité = glucides / poids
      const efficacite = nutri.glucides / Math.max(1, poidsInc);
      
      // Pénalité intra-zone (renforcée : -25% par utilisation au lieu de -15%)
      // S'applique uniquement après la phase de rotation initiale.
      const penaliteIntraZone = dejaUtilise > 0 ? Math.max(0.4, 1 - dejaUtilise * 0.25) : 1;
      
      // Pénalité 2 : répétition d'une zone à l'autre (anti-doublon entre zones)
      const derniere = dernieresUtilisations[s.id];
      let penaliteInterZone = 1;
      if (derniere !== undefined) {
        const ecart = currentZoneIndex - derniere;
        if (ecart === 1) penaliteInterZone = 0.55;
        else if (ecart === 2) penaliteInterZone = 0.80;
      }
      
      const score = efficacite * penaliteIntraZone * penaliteInterZone;
      
      if (score > bestScore) {
        bestScore = score;
        bestItem = { item: s, inc, nutri };
      }
    }
    
    if (!bestItem) break;
    
    addOrMerge(bestItem.item.id, bestItem.inc);
    totalKcal += bestItem.nutri.kcal;
    totalGluc += bestItem.nutri.glucides;
    totalSodium += bestItem.nutri.sodium;
    poidsSolide += bestItem.nutri.poidsG || bestItem.inc;
    utilisationParSolide[bestItem.item.id] = (utilisationParSolide[bestItem.item.id] || 0) + 1;
    manqueGluc = cibleGluc - totalGluc;
  }
  
  // ── PASTILLE SEL si déficit sodium > 20% ──
  if (cibleSodium > 0 && totalSodium < cibleSodium * 0.8 && palette.pastille) {
    const inc = incrementQuantite(palette.pastille);
    const nutri = nutrimentsFor(palette.pastille, inc);
    if (nutri.sodium > 0) {
      const deficit = cibleSodium - totalSodium;
      const nbPastilles = Math.min(3, Math.ceil(deficit / nutri.sodium));
      addOrMerge(palette.pastille.id, inc * nbPastilles);
    }
  }
  
  // ── ARRONDI FINAL ──
  return planZone.map(p => {
    const item = palette.eau?.id === p.id ? palette.eau
      : palette.pastille?.id === p.id ? palette.pastille
      : palette.boissons.find(b => b.id === p.id)
      || palette.solides.find(s => s.id === p.id);
    if (!item) return p;
    if (isEauPure(item)) return p;
    return { ...p, quantite: arrondirQuantite(item, p.quantite) };
  });
}

/**
 * Choisit un item dans une liste en pénalisant celui utilisé à la zone précédente.
 * Utilisé pour alterner les boissons énergétiques.
 */
function choisirAvecPenalite(items, dernieresUtilisations, currentZoneIndex) {
  if (items.length === 1) return items[0];
  
  // Score : 1 par défaut, -50% si utilisé à la zone juste avant
  const scores = items.map(it => {
    const derniere = dernieresUtilisations[it.id];
    if (derniere !== undefined && currentZoneIndex - derniere === 1) {
      return { item: it, score: 0.5 };
    }
    return { item: it, score: 1 };
  });
  
  scores.sort((a, b) => b.score - a.score);
  return scores[0].item;
}

// ─── VALIDATION : CE QUE LE PLAN RAPPORTE VS CIBLE ───────────────────────────

/**
 * Retourne pour chaque zone les écarts entre cible et planifié.
 * Utile pour la preview (Phase 5).
 *
 * Si `strategy` est fourni, applique les stratégies de zones autonomes
 * (les besoins ajustés sont utilisés pour calculer la couverture).
 */
export function evaluerPlan({ zones, plan, bibliotheque, strategy }) {
  // Si strategy fourni, on évalue par rapport aux besoins ajustés
  const zonesEval = strategy ? appliquerStrategiesAutonomes(zones, strategy) : zones;
  
  return zonesEval.map(zone => {
    const items = plan[zone.pointKey] || [];
    const totaux = items.reduce((acc, { id, quantite }) => {
      const item = bibliotheque.find(b => b.id === id);
      if (!item) return acc;
      const n = nutrimentsFor(item, quantite);
      return {
        kcal: acc.kcal + n.kcal,
        glucides: acc.glucides + n.glucides,
        eau: acc.eau + n.eauMl,
        sodium: acc.sodium + n.sodium,
        poidsG: acc.poidsG + n.poidsG,
        volumeMl: acc.volumeMl + n.volumeMl
      };
    }, { kcal: 0, glucides: 0, eau: 0, sodium: 0, poidsG: 0, volumeMl: 0 });
    
    return {
      pointKey: zone.pointKey,
      label: zone.label,
      besoin: zone.besoin,
      planifie: totaux,
      couverture: {
        kcal: zone.besoin.kcal > 0 ? Math.round(totaux.kcal / zone.besoin.kcal * 100) : 100,
        glucides: zone.besoin.glucides > 0 ? Math.round(totaux.glucides / zone.besoin.glucides * 100) : 100,
        eau: zone.besoin.eau > 0 ? Math.round(totaux.eau / zone.besoin.eau * 100) : 100,
        sodium: zone.besoin.sodium > 0 ? Math.round(totaux.sodium / zone.besoin.sodium * 100) : 100
      }
    };
  });
}
