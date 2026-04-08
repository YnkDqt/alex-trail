// ─── STRIDE CONSTANTS & HELPERS ──────────────────────────────────────────────

export const CS = {
  bg:          "#F5F3EF",
  white:       "#FFFFFF",
  stone:       "#EAE6DF",
  stoneDark:   "#D4CEC4",
  stoneDeep:   "#9A9189",
  ink:         "#1C1916",
  inkLight:    "#3D3830",
  muted:       "#7A7268",
  border:      "#DDD9D1",
  forest:      "#2D5A3D",
  forestLight: "#4A8C5C",
  forestPale:  "#E8F2EC",
  summit:      "#C4521A",
  summitLight: "#E07040",
  summitPale:  "#FAF0E8",
  sky:         "#2B5F8C",
  skyLight:    "#4A82B0",
  skyPale:     "#EAF1F8",
  green:       "#2D7A4A",
  greenPale:   "#E6F4EC",
  yellow:      "#B5860A",
  yellowPale:  "#FDF6E3",
  red:         "#B03A2A",
  redPale:     "#FAE9E7",
};

export const LS_KEY = "stride_v2";
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

export const GARMIN_TO_STRIDE = {
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

export const isRunning = (a) => RUNNING_TYPES.includes(TYPE_MIGRATION[a]||a);
export const lsRead  = (k, fb) => { try { const r = localStorage.getItem(LS_KEY); if (!r) return fb; return JSON.parse(r)[k] ?? fb; } catch { return fb; } };
export const lsWrite = (data) => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {} };
export const exportJSON = (data, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:"application/json"})); a.download = name; a.click(); };
export const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const fmtDate = (s) => { if (!s) return "—"; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
export const daysUntil = (s) => { if (!s) return null; const diff = new Date(s) - new Date(new Date().toDateString()); return Math.ceil(diff/86400000); };

export const actColor = (type) => {
  const t = TYPE_MIGRATION[type]||type;
  return {"Trail":CS.forest,"Course à pied":CS.green,"Marche à pied":CS.yellow,
    "Musculation":CS.sky,"Mobilité / Gainage":CS.stoneDeep,
    "Hyrox":"#7B5EA7","Vélo":"#0891b2","Repos":CS.stoneDark}[t] || CS.muted;
};
export const actColorPale = (type) => {
  const t = TYPE_MIGRATION[type]||type;
  return {"Trail":CS.forestPale,"Course à pied":CS.greenPale,"Marche à pied":CS.yellowPale,
    "Musculation":CS.skyPale,"Repos":CS.stone}[t] || CS.stone;
};
export const actIcon  = (type) => ACT_ICON[TYPE_MIGRATION[type]||type] || "·";
export const actShort = (type) => {
  const t = TYPE_MIGRATION[type]||type;
  return {"Trail":"Trail","Course à pied":"Course","Marche à pied":"Marche",
    "Musculation":"Muscu","Mobilité / Gainage":"Mob.","Hyrox":"Hyrox",
    "Vélo":"Vélo","Repos":"Repos"}[t] || t?.slice(0,6) || "—";
};

export const parseCSVActivities = (text) => {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,""));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v=>v.trim().replace(/^"|"$/g,""));
    const o = {}; headers.forEach((h,i) => o[h] = vals[i]||"");
    return {
      id: Date.now()+Math.random(), date: o["Date"]?.slice(0,10)||"",
      dateHeure: o["Date"]||"", type: o["Type d'activité"]||"Trail",
      titre: o["Titre"]||"", distance: o["Distance"]||"", calories: o["Calories"]||"",
      duree: o["Durée"]||"", fcMoy: o["Fréquence cardiaque moyenne"]||"",
      fcMax: o["Fréquence cardiaque maximale"]||"",
      dp: o["Ascension totale"]||o["D+ Réalisé"]||"",
      tss: o["Training Stress Score® (TSS®)"]||"",
      allure: o["Allure moyenne"]||o["Vitesse moyenne"]||"",
      teAero: o["TE aérobie"]||"", gapMoy: o["GAP moyen"]||"",
      cadence: o["Cadence moyenne"]||"", bodyBattery: o["Body Battery"]||"",
      z0: o["% en dessous de Z1"]||"", z1: o["% Z1"]||"",
      z2: o["% Z2"]||"", z3: o["% Z3"]||"",
      z4: o["% Z4"]||"", z5: o["% Z5"]||"",
    };
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
