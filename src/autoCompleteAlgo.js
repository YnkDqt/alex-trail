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

// Retourne le nutriment pour une quantité donnée d'un item (produit ou recette)
// Pour un produit : quantite en grammes, valeurs en /100g
// Pour une recette : quantite en portions
function nutrimentsFor(item, quantite) {
  const isProduit = item.itemType === "produit";
  
  if (isProduit) {
    const factor = (parseFloat(quantite) || 0) / 100;
    return {
      kcal: (item.kcal || 0) * factor,
      glucides: (item.glucides || 0) * factor,
      proteines: (item.proteines || 0) * factor,
      lipides: (item.lipides || 0) * factor,
      sodium: (item.sodium || 0) * factor,
      eauMl: item.boisson ? (parseFloat(quantite) || 0) : 0,  // 1g eau = 1ml
      poidsG: parseFloat(quantite) || 0,
      volumeMl: item.boisson ? (parseFloat(quantite) || 0) : 0
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
    eauMl: item.boisson ? volumePortion * portions : 0,
    poidsG: poidsPortion * portions,
    volumeMl: item.boisson ? volumePortion * portions : 0
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
  if (item.boisson) return 250;  // 250ml par dose boisson par défaut
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
  
  if (item.boisson) {
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
  // On s'appuie sur le `type` défini dans la nouvelle architecture, avec fallback
  // sur `boisson` pour les produits legacy.
  const eauxPures = bibliotheque.filter(it =>
    it.type === "Eau pure" ||
    (!it.type && it.boisson && (it.nom || "").toLowerCase().includes("eau"))
  );
  const boissonsEnergie = bibliotheque.filter(it =>
    it.type === "Boisson énergétique" ||
    (!it.type && it.boisson && !(it.nom || "").toLowerCase().includes("eau"))
  );
  const pastillesSel = bibliotheque.filter(it => it.type === "Pastille sel / électrolytes");
  const solides = bibliotheque.filter(it =>
    !it.boisson &&
    it.type !== "Pastille sel / électrolytes" &&
    it.type !== "Eau pure" &&
    it.type !== "Boisson énergétique"
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
  
  // Ajuster à la cible de la zone (on ne transporte pas plus que le besoin + 10%)
  const cibleTotalMl = Math.round(cibleEau * 1.1);
  const ratioAjust = stratTotalMl > 0 ? Math.min(1, cibleTotalMl / stratTotalMl) : 1;
  const eauCibleMl = Math.round(stratEauMl * ratioAjust);
  const boissonCibleMl = Math.round(stratBoissonMl * ratioAjust);
  
  // Fallback si stratégie = 0 : on prend 50/50 basé sur la cible
  const eauFinalMl = stratTotalMl > 0 ? eauCibleMl : Math.round(cibleEau * 0.5);
  const boissonFinalMl = stratTotalMl > 0 ? boissonCibleMl : Math.round(cibleEau * 0.5);

  // Ajouter eau pure
  if (eauFinalMl > 0 && eauxPures.length > 0) {
    const eau = eauxPures[0];
    const qte = arrondirQuantite(eau, eauFinalMl);
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
  // Les incréments sont déjà quantifiés, mais pour les boissons on consolide.
  return plan.map(p => {
    const item = bibliotheque.find(b => b.id === p.id);
    if (!item) return p;
    return { ...p, quantite: arrondirQuantite(item, p.quantite) };
  });
}

// ─── ALGO GLOBAL (toutes les zones) ──────────────────────────────────────────

/**
 * Calcule un plan complet pour toutes les zones d'une course.
 *
 * @param {Object} params
 * @param {Array}  params.zones        - zones calculées depuis NutritionView
 * @param {Array}  params.bibliotheque - allBibItems (produits + recettes enrichis)
 * @param {Object} params.strategy     - getNutritionStrategy(race)
 * @returns {Object} plan = { [pointKey]: [{id, quantite}] }
 */
export function calculerPlanComplet({ zones, bibliotheque, strategy }) {
  const plan = {};
  
  zones.forEach((zone, i) => {
    const isDepart = i === 0;
    plan[zone.pointKey] = planPourZone({
      besoin: zone.besoin,
      bibliotheque,
      strategy,
      isDepart
    });
  });
  
  return plan;
}

// ─── VALIDATION : CE QUE LE PLAN RAPPORTE VS CIBLE ───────────────────────────

/**
 * Retourne pour chaque zone les écarts entre cible et planifié.
 * Utile pour la preview (Phase 5).
 */
export function evaluerPlan({ zones, plan, bibliotheque }) {
  return zones.map(zone => {
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
