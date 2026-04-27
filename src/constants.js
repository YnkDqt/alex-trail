// ─── PALETTE UNIFIÉE ─────────────────────────────────────────────────────────
// Palette unique pour toute l'app Alex (sections Entraînement + Course)
export const C = {
  // Neutres base
  bg:          "#F5F3EF",
  white:       "#FFFFFF",
  stone:       "#EAE6DF",
  stoneDark:   "#D4CEC4",
  stoneDeep:   "#9A9189",
  ink:         "#1C1916",
  inkLight:    "#3D3830",
  muted:       "#7A7268",
  border:      "#DDD9D1",
  
  // Couleurs primaires (Entraînement forest + Course primary)
  forest:      "#2D5A3D",
  forestLight: "#4A8C5C",
  forestPale:  "#E8F2EC",
  primary:     "#7C5C3E",      // Course primary
  primaryLight:"#9E7A58",
  primaryPale: "#F0E8DC",
  primaryDeep: "#4E3726",
  
  // Couleurs secondaires
  secondary:    "#5C7A5C",     // Course secondary
  secondaryPale:"#E8F0E8",
  secondaryDark:"#3D5C3D",
  summit:      "#C4521A",
  summitLight: "#E07040",
  summitPale:  "#FAF0E8",
  sky:         "#2B5F8C",
  skyLight:    "#4A82B0",
  skyPale:     "#EAF1F8",
  
  // Couleurs sémantiques
  green:       "#2D7A4A",
  greenPale:   "#E6F4EC",
  yellow:      "#B5860A",
  yellowPale:  "#FDF6E3",
  red:         "#B03A2A",
  redPale:     "#FAE9E7",
  blue:        "#4A7A9B",
  bluePale:    "#E8F2F8",
};

// ─── CONSTANTES ENTRAINEMENT ─────────────────────────────────────────────────
export const DAY_NAMES = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
export const DAY_SHORT = ["Lu","Ma","Me","Je","Ve","Sa","Di"];
export const MOIS_FR = ["","Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

export const ACTIVITY_TYPES = [
  "Trail","Course à pied","Marche à pied","Musculation",
  "Mobilité / Gainage","Hyrox","Vélo","Repos",
];
export const STATUT_OPTIONS = ["Planifié","Effectué","Partiel","Remplacé","Annulé"];

export const ACT_ICON = {
  "Trail":"↑","Course à pied":"↑","Marche à pied":"~",
  "Musculation":"▣","Mobilité / Gainage":"◈","Hyrox":"⊕","Vélo":"⊙","Repos":"·",
};

export const GARMIN_TO_ACTIVITE = {
  "Trail":"Trail","Course à pied sur tapis roulant":"Course à pied",
  "Marche à pied":"Marche à pied","Musculation":"Musculation",
  "Autre":"Hyrox","Cyclisme":"Vélo","Vélo d'intérieur":"Vélo","Cardio":"Course à pied",
};

export const TYPE_MIGRATION = {
  "Trailrunning":"Trail","Musculation - Lower":"Musculation","Musculation - Upper":"Musculation",
  "Cardio":"Course à pied","Autre (Hyrox)":"Hyrox","Mobilité / Gainage":"Mobilité / Gainage",
  "Marche à pied":"Marche à pied","Repos":"Repos","Trail":"Trail","Course à pied":"Course à pied",
  "Vélo":"Vélo","Hyrox":"Hyrox",
};

export const RUNNING_TYPES = ["Trail","Course à pied","Marche à pied"];

export const DEFAULT_PLANNING = {
  "Lundi AM":"Musculation","Lundi PM":"Repos","Mardi AM":"Trail","Mardi PM":"Repos",
  "Mercredi AM":"Trail","Mercredi PM":"Repos","Jeudi AM":"Trail","Jeudi PM":"Repos",
  "Vendredi AM":"Musculation","Vendredi PM":"Repos","Samedi AM":"Trail","Samedi PM":"Repos",
  "Dimanche AM":"Repos","Dimanche PM":"Repos",
};

// ─── CONSTANTES COURSE ───────────────────────────────────────────────────────
export const DEFAULT_FLAT_SPEED = 9.5;
export const DEFAULT_EQUIPMENT = [
  { id: 1,  cat: "Équipement",     label: "Gilet de trail",           checked: false, actif: true,  emporte: true,  poidsG: 400 },
  { id: 2,  cat: "Équipement",     label: "T-shirt course",           checked: false, actif: true,  emporte: true,  poidsG: 150 },
  { id: 3,  cat: "Équipement",     label: "T-shirt change × 2",       checked: false, actif: false, emporte: false, poidsG: 300 },
  { id: 4,  cat: "Équipement",     label: "Short / cuissard",         checked: false, actif: true,  emporte: true,  poidsG: 120 },
  { id: 5,  cat: "Équipement",     label: "Chaussettes",              checked: false, actif: true,  emporte: true,  poidsG: 60  },
  { id: 6,  cat: "Équipement",     label: "Chaussures de trail",      checked: false, actif: true,  emporte: true,  poidsG: 600 },
  { id: 7,  cat: "Équipement",     label: "Bâtons",                   checked: false, actif: false, emporte: true,  poidsG: 400 },
  { id: 8,  cat: "Équipement",     label: "Veste imperméable",        checked: false, actif: true,  emporte: true,  poidsG: 250 },
  { id: 9,  cat: "Équipement",     label: "Casquette / buff",         checked: false, actif: true,  emporte: true,  poidsG: 60  },
  { id: 10, cat: "Équipement",     label: "Lampe frontale + piles",   checked: false, actif: true,  emporte: true,  poidsG: 120 },
  { id: 11, cat: "Équipement",     label: "Couverture de survie",     checked: false, actif: true,  emporte: true,  poidsG: 80  },
  { id: 12, cat: "Équipement",     label: "Sifflet",                  checked: false, actif: true,  emporte: true,  poidsG: 20  },
  { id: 13, cat: "Ravitaillement", label: "Pâtes de fruits sucrées",  checked: false, actif: false, emporte: true,  poidsG: 0   },
  { id: 14, cat: "Ravitaillement", label: "Pâtes de fruits salées",   checked: false, actif: false, emporte: true,  poidsG: 0   },
  { id: 15, cat: "Ravitaillement", label: "Barres de céréales",       checked: false, actif: false, emporte: true,  poidsG: 0   },
  { id: 16, cat: "Ravitaillement", label: "Gels énergétiques",        checked: false, actif: false, emporte: true,  poidsG: 0   },
  { id: 17, cat: "Ravitaillement", label: "Gourde / flasques",        checked: false, actif: true,  emporte: true,  poidsG: 200 },
  { id: 18, cat: "Ravitaillement", label: "Sel / électrolytes",       checked: false, actif: false, emporte: true,  poidsG: 50  },
  { id: 19, cat: "Divers",         label: "Dossard + épingles",       checked: false, actif: true,  emporte: true,  poidsG: 20  },
  { id: 20, cat: "Divers",         label: "Téléphone chargé",         checked: false, actif: true,  emporte: true,  poidsG: 180 },
  { id: 21, cat: "Divers",         label: "Crème anti-frottements",   checked: false, actif: true,  emporte: true,  poidsG: 50  },
  { id: 22, cat: "Divers",         label: "Brosse à dents / hygiène", checked: false, actif: false, emporte: false, poidsG: 0   },
  { id: 23, cat: "Divers",         label: "Vêtements post-course",    checked: false, actif: false, emporte: false, poidsG: 0   },
  { id: 24, cat: "Préparation",    label: "Strapping pieds / genoux", checked: false, actif: false, emporte: true,  poidsG: 30  },
  { id: 25, cat: "Préparation",    label: "Crème solaire",            checked: false, actif: false, emporte: true,  poidsG: 50  },
  { id: 26, cat: "Préparation",    label: "Vaseline / nez crème",     checked: false, actif: false, emporte: true,  poidsG: 30  },
  { id: 27, cat: "Préparation",    label: "Carte d'identité",         checked: false, actif: true,  emporte: true,  poidsG: 10  },
  { id: 28, cat: "Préparation",    label: "Certificat médical",       checked: false, actif: false, emporte: true,  poidsG: 10  },
  { id: 29, cat: "Préparation",    label: "Chargeur portable",        checked: false, actif: false, emporte: false, poidsG: 200 },
  { id: 30, cat: "Préparation",    label: "Collants de compression",  checked: false, actif: false, emporte: false, poidsG: 150 },
];

export const PREP_TIMELINE = [
  { id: "j14_chaussures",  phase: "J−14", cat: "Équipement",  label: "Vérifier les chaussures (semelles > 2mm, couture OK)" },
  { id: "j14_sac",         phase: "J−14", cat: "Équipement",  label: "Tester le sac / gilet chargé sur une sortie" },
  { id: "j14_gels",        phase: "J−14", cat: "Nutrition",   label: "Commander gels et produits manquants" },
  { id: "j14_logement",    phase: "J−14", cat: "Logistique",  label: "Réserver logement à proximité du départ" },
  { id: "j14_transport",   phase: "J−14", cat: "Logistique",  label: "Organiser transport aller-retour" },
  { id: "j7_gps",          phase: "J−7",  cat: "Équipement",  label: "Charger GPS et batteries externes, tester la montre" },
  { id: "j7_meteo",        phase: "J−7",  cat: "Logistique",  label: "Vérifier la météo, adapter l'équipement" },
  { id: "j7_drop",         phase: "J−7",  cat: "Logistique",  label: "Préparer les drop-bags si ultra long" },
  { id: "j7_inscrip",      phase: "J−7",  cat: "Logistique",  label: "Confirmer inscription, récupération du dossard" },
  { id: "h48_flasques",    phase: "H−48", cat: "Équipement",  label: "Test remplissage flasques, vérifier étanchéité" },
  { id: "h48_nutrition",   phase: "H−48", cat: "Nutrition",   label: "Préparer et peser la nutrition complète" },
  { id: "h48_drop2",       phase: "H−48", cat: "Logistique",  label: "Finaliser drop-bags, étiqueter clairement" },
  { id: "h48_route",       phase: "H−48", cat: "Logistique",  label: "Planifier itinéraire et horaire pour le départ" },
  { id: "h24_piles",       phase: "H−24", cat: "Équipement",  label: "Piles lampe frontale 100%, charger téléphone" },
  { id: "h24_dossard",     phase: "H−24", cat: "Équipement",  label: "Épingler le dossard, vérifier le règlement" },
  { id: "h24_recup",       phase: "H−24", cat: "Logistique",  label: "Récupérer le dossard si retrait en avance" },
  { id: "h24_sommeil",     phase: "H−24", cat: "Logistique",  label: "Se coucher tôt, éviter les repas lourds" },
  { id: "h1_creme",        phase: "H−1",  cat: "Préparation", label: "Crème anti-frottements, vaseline, strapping pieds" },
  { id: "h1_check",        phase: "H−1",  cat: "Équipement",  label: "Check final sac : eau, nutrition, lampe, veste" },
  { id: "h1_solaire",      phase: "H−1",  cat: "Préparation", label: "Crème solaire si course ensoleillée" },
  { id: "h1_ravitos",      phase: "H−1",  cat: "Logistique",  label: "Confirmer plan ravitos avec l'équipe d'assistance" },
];

export const EMPTY_SETTINGS = {
  weight: 70, kcalPerKm: 65, kcalPerKmUphill: 90,
  fcMax: null, fcZone2Max: null,
  raceName: "", startTime: "07:00", raceDate: "",
  meteoLoading: false, meteoFetched: false, meteoInfo: "",
  tempC: 15, rain: false, wind: false, snow: false,
  darkMode: false,
  garminCoeff: 1, garminStats: null, kcalSource: "minetti",
  glucidesTargetGh: null,
  runnerLevel: "intermediaire",
  effortTarget: "normal",
  paceStrategy: 0,
  ravitoTimeMin: 3,
  segmentDetail: "equilibre",
  equipment: DEFAULT_EQUIPMENT,
  produits: [],
  prepChecks: {},
};

export const RUNNER_LEVELS = [
  { key: "debutant",      label: "Débutant",      coeff: 0.72, desc: "Premiers trails, objectif finisher" },
  { key: "intermediaire", label: "Intermédiaire", coeff: 0.88, desc: "Quelques courses, chrono réaliste" },
  { key: "confirme",      label: "Confirmé",      coeff: 1.00, desc: "Niveau entraîné, bonne régularité" },
  { key: "expert",        label: "Expert",        coeff: 1.12, desc: "Compétiteur, podium régional" },
];

export const TERRAIN_TYPES = [
  { key: "normal",    label: "Normal",         coeff: 1.00, desc: "Chemin balisé, single track roulant" },
  { key: "technique", label: "Technique",      coeff: 0.82, desc: "Cailloux, racines, passages délicats" },
  { key: "trestech",  label: "Très technique", coeff: 0.68, desc: "Éboulis, hors-sentier, passages engagés" },
];

// ─── CONSTANTES NUTRITION ────────────────────────────────────────────────────
export const PRODUIT_TYPES = [
  "Eau pure",
  "Boisson énergétique",
  "Gel",
  "Barre",
  "Solide mou",
  "Solide dur",
  "Pastille sel / électrolytes",
  "Aliment vrai",
];

export const PRODUIT_UNITES = ["gel", "barre", "dose", "pastille", "portion", "sachet"];

export const TEXTURES = ["Liquide", "Mou", "Dur"];

export const TOLERANCES = ["Facile", "Moyen", "Difficile"];

export const SOURCES_GLUCIDES = ["Glucose", "Fructose", "Maltodextrine", "Mix", "Amidon"];

export const PHASES_COURSE = ["Tout moment", "Début", "Milieu", "Fin"];

// Les types qui sont nativement des boissons (détection automatique legacy)
export const TYPES_BOISSON = ["Eau pure", "Boisson énergétique"];

// ─── STRATÉGIE NUTRITION COURSE ──────────────────────────────────────────────
// Priorités globales qui influencent l'algo d'autocomplétion
export const PRIORITES_NUTRITION = [
  { key: "performance", label: "Performance", icon: "🔥", desc: "Glucides poussés au max, tous les micros visés" },
  { key: "confort",     label: "Confort",     icon: "⚖️", desc: "Équilibre : glucides modérés, sodium visé" },
  { key: "leger",       label: "Léger",       icon: "🪶", desc: "Minimise le poids transporté, glucides suffisants" }
];

// Stratégies pour les ravitos autonomes (où l'équipe n'est pas présente)
export const STRATEGIES_AUTONOME = [
  { key: "porter", label: "Je porte depuis avant", icon: "🎒", desc: "Tout est ajouté au ravito précédent" },
  { key: "orga",   label: "Je prends sur stand orga", icon: "🏁", desc: "Couvert par l'organisation" },
  { key: "mix",    label: "Mix (50/50)", icon: "🤝", desc: "Moitié porté, moitié orga" }
];

// Valeurs par défaut de la stratégie
export const NUTRITION_STRATEGY_DEFAULTS = {
  transport: {
    liquideMaxMl: 1500,
    solideMaxG: 500
  },
  hydratation: {
    eauPureMl: 500,
    boissonEnergetiqueMl: 500,
    flasqueMl: 500  // Volume d'une flasque d'eau. L'algo arrondit au multiple.
  },
  priorite: "confort",
  ravitos: {}  // map: ravitoId -> { strategieAutonome }
};

// ─── PRESETS NUTRITION (matrice 3 durées × 3 températures) ───────────────────
// Bornes : court < 3h, moyen 3-6h, long > 6h
//          froid < 10°C, neutre 10-22°C, chaud > 22°C
export const NUTRITION_PRESETS = [
  { id: "court_froid",  label: "Court & froid",  icon: "🥶", dureeMax: 3, tempMax: 10,
    eauPureMl: 300, boissonEnergetiqueMl: 700, liquideMaxMl: 1000, solideMaxG: 400, priorite: "kcal" },
  { id: "court_neutre", label: "Court & neutre", icon: "🏃", dureeMax: 3, tempMax: 22,
    eauPureMl: 400, boissonEnergetiqueMl: 600, liquideMaxMl: 1000, solideMaxG: 300, priorite: "confort" },
  { id: "court_chaud",  label: "Court & chaud",  icon: "🌞", dureeMax: 3, tempMax: 99,
    eauPureMl: 700, boissonEnergetiqueMl: 300, liquideMaxMl: 1500, solideMaxG: 250, priorite: "hydratation" },
  { id: "moyen_froid",  label: "Moyen & froid",  icon: "❄️", dureeMax: 6, tempMax: 10,
    eauPureMl: 300, boissonEnergetiqueMl: 700, liquideMaxMl: 1500, solideMaxG: 600, priorite: "kcal" },
  { id: "moyen_neutre", label: "Moyen & neutre", icon: "⚖️", dureeMax: 6, tempMax: 22,
    eauPureMl: 500, boissonEnergetiqueMl: 500, liquideMaxMl: 1500, solideMaxG: 500, priorite: "confort" },
  { id: "moyen_chaud",  label: "Moyen & chaud",  icon: "☀️", dureeMax: 6, tempMax: 99,
    eauPureMl: 800, boissonEnergetiqueMl: 200, liquideMaxMl: 2000, solideMaxG: 400, priorite: "hydratation" },
  { id: "long_froid",   label: "Long & froid",   icon: "🧊", dureeMax: 99, tempMax: 10,
    eauPureMl: 400, boissonEnergetiqueMl: 600, liquideMaxMl: 2000, solideMaxG: 700, priorite: "kcal" },
  { id: "long_neutre",  label: "Long & neutre",  icon: "🏔️", dureeMax: 99, tempMax: 22,
    eauPureMl: 500, boissonEnergetiqueMl: 500, liquideMaxMl: 2000, solideMaxG: 600, priorite: "confort" },
  { id: "long_chaud",   label: "Long & chaud",   icon: "🔥", dureeMax: 99, tempMax: 99,
    eauPureMl: 900, boissonEnergetiqueMl: 100, liquideMaxMl: 2500, solideMaxG: 500, priorite: "hydratation" }
];

// Détecte le preset correspondant à une durée (en heures) et une température (°C)
export const detectPreset = (dureeH, tempC) => {
  if (dureeH == null || tempC == null) return null;
  return NUTRITION_PRESETS.find(p => dureeH <= p.dureeMax && tempC <= p.tempMax) || null;
};

// Applique un preset à une stratégie existante (préserve ravitos, flasqueMl)
export const applyPreset = (strategy, preset) => ({
  ...strategy,
  transport: { liquideMaxMl: preset.liquideMaxMl, solideMaxG: preset.solideMaxG },
  hydratation: {
    ...strategy.hydratation,
    eauPureMl: preset.eauPureMl,
    boissonEnergetiqueMl: preset.boissonEnergetiqueMl
  },
  priorite: preset.priorite
});

// Module un preset selon les conditions évènementielles (pluie, neige, vent)
// Retourne un nouveau preset modifié (pas de mutation)
export const applyMeteoModifiers = (preset, { rain, snow, wind } = {}) => {
  if (!preset) return preset;
  let p = { ...preset };
  if (rain || snow) {
    // Pluie/neige : besoin thermique +, transpiration -
    p = { ...p, solideMaxG: p.solideMaxG + 50, priorite: "kcal" };
  }
  if (wind) {
    // Vent : manipulation pénible, on allège un peu le solide
    p = { ...p, solideMaxG: Math.max(150, p.solideMaxG - 50) };
  }
  return p;
};

// Indique si la stratégie courante correspond exactement à un preset
export const matchPreset = (strategy) => {
  return NUTRITION_PRESETS.find(p =>
    strategy.transport?.liquideMaxMl === p.liquideMaxMl &&
    strategy.transport?.solideMaxG === p.solideMaxG &&
    strategy.hydratation?.eauPureMl === p.eauPureMl &&
    strategy.hydratation?.boissonEnergetiqueMl === p.boissonEnergetiqueMl &&
    strategy.priorite === p.priorite
  ) || null;
};

// ─── HELPERS ENTRAINEMENT ────────────────────────────────────────────────────
export const isRunning = (a) => RUNNING_TYPES.includes(TYPE_MIGRATION[a]||a);
export const exportJSON = (data, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:"application/json"})); a.download = name; a.click(); };
export const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const fmtDate = (s) => { if (!s) return "—"; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
export const daysUntil = (s) => { if (!s) return null; const diff = new Date(s) - new Date(new Date().toDateString()); return Math.ceil(diff/86400000); };

export const actColor = (type) => {
  const t = TYPE_MIGRATION[type]||type;
  return {"Trail":C.forest,"Course à pied":C.green,"Marche à pied":C.yellow,
    "Musculation":C.sky,"Mobilité / Gainage":C.stoneDeep,
    "Hyrox":"#7B5EA7","Vélo":"#0891b2","Repos":C.stoneDark}[t] || C.muted;
};
export const actColorPale = (type) => {
  const t = TYPE_MIGRATION[type]||type;
  return {"Trail":C.forestPale,"Course à pied":C.greenPale,"Marche à pied":C.yellowPale,
    "Musculation":C.skyPale,"Repos":C.stone}[t] || C.stone;
};
export const actIcon  = (type) => ACT_ICON[TYPE_MIGRATION[type]||type] || "·";
export const actShort = (type) => {
  const t = TYPE_MIGRATION[type]||type;
  return {"Trail":"Trail","Course à pied":"Course","Marche à pied":"Marche",
    "Musculation":"Muscu","Mobilité / Gainage":"Mob.","Hyrox":"Hyrox",
    "Vélo":"Vélo","Repos":"Repos"}[t] || t?.slice(0,6) || "—";
};

// ─── PARSERS CSV GARMIN ──────────────────────────────────────────────────────
// Parser CSV basique qui gère les guillemets
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const parseCSVActivities = (text) => {
  const lines = text.trim().split("\n");
  const headers = parseCSVLine(lines[0]);
  
  // Nettoie les nombres (supprime virgules et espaces de séparation)
  const cleanNum = (v) => (v||"").toString().replace(/[,\s]/g, "");
  
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const o = {}; 
    headers.forEach((h,i) => o[h] = vals[i]||"");
    
    const activity = {
      id: Date.now()+Math.random(), date: o["Date"]?.slice(0,10)||"",
      dateHeure: o["Date"]||"", type: o["Type d'activité"]||"Trail",
      titre: o["Titre"]||"", 
      distance: cleanNum(o["Distance"]), 
      calories: cleanNum(o["Calories"]),
      duree: o["Durée"]||"", 
      fcMoy: cleanNum(o["Fréquence cardiaque moyenne"]),
      fcMax: cleanNum(o["Fréquence cardiaque maximale"]),
      dp: cleanNum(o["Ascension totale"]||o["D+ Réalisé"]||""),
      tss: cleanNum(o["Training Stress Score® (TSS®)"]||""),
      allure: o["Allure moyenne"]||o["Vitesse moyenne"]||"",
      teAero: o["TE aérobie"]||"", gapMoy: o["GAP moyen"]||"",
      cadence: cleanNum(o["Cadence moyenne"]||""), 
      bodyBattery: cleanNum(o["Body Battery"]||""),
      z0: cleanNum(o["% en dessous de Z1"]||""), 
      z1: cleanNum(o["% Z1"]||""),
      z2: cleanNum(o["% Z2"]||""), 
      z3: cleanNum(o["% Z3"]||""),
      z4: cleanNum(o["% Z4"]||""), 
      z5: cleanNum(o["% Z5"]||""),
    };
    
    return activity;
  }).filter(a=>a.date);
};

export const parseCSVSommeil = (text) => {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.trim().split("\n");
  const headers = lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,"").replace(/\u00a0/g," "));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v=>v.trim().replace(/^"|"$/g,""));
    const o = {}; headers.forEach((h,i) => o[h] = vals[i]||"");
    const dateRaw = o["Score de sommeil 4 semaines"]||o["Date"]||vals[0]||"";
    return {
      id: Date.now()+Math.random(),
      date: dateRaw.includes("-") ? dateRaw.slice(0,10) : dateRaw,
      score: o["Score"]||"", fcRepos: o["Fréquence cardiaque au repos"]||"",
      bodyBattery: o["Body Battery"]||"",
      bodyBatteryMatin: o["Body Battery au lever"]||o["Body Battery Début de journée"]||"",
      spo2: o["Oxymètre de pouls"]||"", respiration: o["Respiration"]||"",
      vfc: o["Statut de la variabilité de la fréquence cardiaque"]||"",
      qualite: o["Qualité"]||"", duree: o["Durée"]||o["Durée du sommeil"]||"",
      coucher: o["Heure de coucher"]||o["Heure du coucher"]||"",
      lever: o["Heure de lever"]||o["Heure du lever"]||"",
    };
  }).filter(s=>s.date && s.date.match(/^\d{4}-\d{2}-\d{2}/));
};

const parseFrDateVFC = (raw) => {
  if (!raw) return "";
  raw = raw.trim();
  if (raw.match(/^\d{4}-\d{2}-\d{2}/)) return raw.slice(0,10);
  const MOIS = {"janv.":"01","jan.":"01","jan":"01","fév.":"02","fev.":"02","fév":"02","mars":"03","mar.":"03","avr.":"04","avr":"04","mai":"05","juin":"06","juil.":"07","juil":"07","août":"08","aout":"08","sept.":"09","sep.":"09","oct.":"10","nov.":"11","déc.":"12","dec.":"12"};
  const m = raw.match(/^(\d{1,2})\s+([^\s]+)/i);
  if (!m) return "";
  const day = m[1].padStart(2,"0");
  const mon = MOIS[m[2].toLowerCase()];
  if (!mon) return "";
  const now = new Date(); const year = now.getFullYear();
  const testDate = new Date(`${year}-${mon}-${day}`);
  const finalYear = testDate > new Date(now.getTime() + 30*86400000) ? year-1 : year;
  return `${finalYear}-${mon}-${day}`;
};

export const parseCSVVFC = (text) => {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.trim().split("\n");
  const headers = lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,"").replace(/\u00a0/g," "));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v=>v.trim().replace(/^"|"$/g,""));
    const o = {}; headers.forEach((h,i) => o[h] = vals[i]||"");
    const date = parseFrDateVFC(o["Date"]||vals[0]||"");
    const stripMs = (v) => (v||"").replace(/ms/gi,"").trim();
    return {
      id: Date.now()+Math.random(), date,
      vfc: stripMs(o["Variabilité de la fréquence cardiaque nocturne"]||o["Statut de la variabilité de la fréquence cardiaque"]||o["VFC"]||""),
      baseline: o["Ligne de base"]||o["Ligne de base VFC"]||o["Baseline"]||"",
      moy7j: stripMs(o["Moyenne sur 7 jours"]||o["Moyenne VFC 7 j"]||o["Moy 7j"]||""),
      vo2max: o["VO2 max"]||o["VO2max"]||"",
      chargeAigue: o["Charge d'entraînement aiguë"]||o["Charge aigue"]||"",
      chargeChronique: o["Charge d'entraînement chronique"]||o["Charge chronique"]||"",
      z1debut: o["Z1 Début"]||"", z1fin: o["Z1 Fin"]||"",
      z2debut: o["Z2 Début"]||"", z2fin: o["Z2 Fin"]||"",
      z3debut: o["Z3 Début"]||"", z3fin: o["Z3 Fin"]||"",
      z4debut: o["Z4 Début"]||"", z4fin: o["Z4 Fin"]||"",
      fcMax: o["FC Max"]||o["Fréquence cardiaque maximale"]||"",
    };
  }).filter(v=>v.date && v.date.match(/^\d{4}-\d{2}-\d{2}/));
};

// ─── EMPTY FUNCTIONS ─────────────────────────────────────────────────────────
export const emptySeance = () => ({
  id: Date.now()+Math.random(), date: localDate(new Date()),
  demiJournee: "Lundi AM", activite: "Trailrunning", statut: "Planifié",
  commentaire: "", dureeObj: "", kmObj: "", dpObj: "",
  garminTitre: "", dureeGarmin: "", kmGarmin: "", dpGarmin: "",
  allure: "", fcMoy: "", fcMax: "", cal: "", _nonPlanifie: false,
  z1: "", z2: "", z3: "", z4: "", z5: "",
});
export const emptyObjectif = () => ({
  id: Date.now()+Math.random(), date: "", nom: "", distance: "", dp: "",
  statut: "À venir", temps: "", priorite: "A", region: "", lien: "",
});
export const emptyPoids = () => ({
  id: Date.now()+Math.random(), date: localDate(new Date()),
  poids: "", cou: "", taille_cm: "", ventre: "",
  hanche: "", cuisse: "", mollet: "",
});
export const emptyVFC = () => ({
  id: Date.now()+Math.random(), date: localDate(new Date()),
  vfc: "", baseline: "", moy7j: "", vo2max: "",
  chargeAigue: "", chargeChronique: "",
});
export const emptySommeil = () => ({
  id: Date.now()+Math.random(), date: localDate(new Date()),
  score: "", fcRepos: "", bodyBattery: "", bodyBatteryMatin: "",
  spo2: "", respiration: "", vfc: "", qualite: "Bon",
  duree: "", coucher: "", lever: "",
});
