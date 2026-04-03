import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── ALEX IMPORTS ────────────────────────────────────────────────────────────
import { EMPTY_SETTINGS, DEFAULT_EQUIPMENT, DEFAULT_FLAT_SPEED } from './constants.js';
import ProfilView    from './components/ProfilView.jsx';
import StrategieView from './components/StrategieView.jsx';
import AnalyseView   from './components/AnalyseView.jsx';
import NutritionView from './components/NutritionView.jsx';
import EquipementView from './components/EquipementView.jsx';
import TeamView      from './components/TeamView.jsx';
import MesCoursesView from './components/MesCoursesView.jsx';

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg:           "#F5F3EF",
  white:        "#FFFFFF",
  stone:        "#EAE6DF",
  stoneDark:    "#D4CEC4",
  stoneDeep:    "#9A9189",
  ink:          "#1C1916",
  inkLight:     "#3D3830",
  muted:        "#7A7268",
  border:       "#DDD9D1",
  // Trail green
  forest:       "#2D5A3D",
  forestLight:  "#4A8C5C",
  forestPale:   "#E8F2EC",
  // Race orange
  summit:       "#C4521A",
  summitLight:  "#E07040",
  summitPale:   "#FAF0E8",
  // Sky blue
  sky:          "#2B5F8C",
  skyLight:     "#4A82B0",
  skyPale:      "#EAF1F8",
  // Status
  green:        "#2D7A4A",
  greenPale:    "#E6F4EC",
  yellow:       "#B5860A",
  yellowPale:   "#FDF6E3",
  red:          "#B03A2A",
  redPale:      "#FAE9E7",
};

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const LS_KEY = "stride_v2";
const DAY_NAMES = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const DAY_SHORT = ["Lu","Ma","Me","Je","Ve","Sa","Di"];
const MOIS_FR = ["","Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

// Types Stride alignés Garmin — référentiel fixe
const ACTIVITY_TYPES = [
  "Trail",
  "Course à pied",
  "Marche à pied",
  "Musculation",
  "Mobilité / Gainage",
  "Hyrox",
  "Vélo",
  "Repos",
];

const STATUT_OPTIONS = ["Planifié","Effectué","Partiel","Remplacé","Annulé"];

// Icônes activité (accessibles daltoniens : forme + symbole)
const ACT_ICON = {
  "Trail":             "↑",
  "Course à pied":     "↑",
  "Marche à pied":     "~",
  "Musculation":       "▣",
  "Mobilité / Gainage":"◈",
  "Hyrox":             "⊕",
  "Vélo":              "⊙",
  "Repos":             "·",
};

// Matching Garmin → Stride (pour import CSV activités)
const GARMIN_TO_STRIDE = {
  "Trail":                          "Trail",
  "Course à pied sur tapis roulant":"Course à pied",
  "Marche à pied":                  "Marche à pied",
  "Musculation":                    "Musculation",
  "Autre":                          "Hyrox",
  "Cyclisme":                       "Vélo",
  "Vélo d'intérieur":              "Vélo",
  "Cardio":                         "Course à pied",
};

// Migration anciens types → nouveaux
const TYPE_MIGRATION = {
  "Trailrunning":       "Trail",
  "Musculation - Lower":"Musculation",
  "Musculation - Upper":"Musculation",
  "Cardio":             "Course à pied",
  "Autre (Hyrox)":      "Hyrox",
  "Mobilité / Gainage": "Mobilité / Gainage",
  "Marche à pied":      "Marche à pied",
  "Repos":              "Repos",
  "Trail":              "Trail",
  "Course à pied":      "Course à pied",
  "Musculation":        "Musculation",
  "Hyrox":              "Hyrox",
  "Vélo":               "Vélo",
};

// Activités qui comptent dans km/D+ (trail/course)
const RUNNING_TYPES = ["Trail","Course à pied"];
const isRunning = (a) => RUNNING_TYPES.includes(TYPE_MIGRATION[a]||a);

const DEFAULT_PLANNING = {
  "Lundi AM":"Musculation","Lundi PM":"Repos",
  "Mardi AM":"Trail","Mardi PM":"Repos",
  "Mercredi AM":"Trail","Mercredi PM":"Repos",
  "Jeudi AM":"Trail","Jeudi PM":"Repos",
  "Vendredi AM":"Musculation","Vendredi PM":"Repos",
  "Samedi AM":"Trail","Samedi PM":"Repos",
  "Dimanche AM":"Repos","Dimanche PM":"Repos",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const lsRead  = (k, fb) => { try { const r = localStorage.getItem(LS_KEY); if (!r) return fb; return JSON.parse(r)[k] ?? fb; } catch { return fb; } };
const lsWrite = (data) => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {} };
const exportJSON = (data, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:"application/json"})); a.download = name; a.click(); };
const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fmtDate = (s) => { if (!s) return "—"; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
const daysUntil = (s) => { if (!s) return null; const diff = new Date(s) - new Date(new Date().toDateString()); return Math.ceil(diff/86400000); };

const actColor = (type) => {
  const t = TYPE_MIGRATION[type]||type;
  return {"Trail":C.forest,"Course à pied":C.green,"Marche à pied":C.yellow,
    "Musculation":C.sky,"Mobilité / Gainage":C.stoneDeep,
    "Hyrox":"#7B5EA7","Vélo":"#0891b2","Repos":C.stoneDark}[t] || C.muted;
};

const actColorPale = (type) => {
  const t = TYPE_MIGRATION[type]||type;
  return {"Trail":C.forestPale,"Course à pied":C.greenPale,"Marche à pied":C.yellowPale,
    "Musculation":C.skyPale,"Repos":C.stone}[t] || C.stone;
};

const actIcon = (type) => ACT_ICON[TYPE_MIGRATION[type]||type] || "·";

const actShort = (type) => {
  const t = TYPE_MIGRATION[type]||type;
  return {"Trail":"Trail","Course à pied":"Course","Marche à pied":"Marche",
    "Musculation":"Muscu","Mobilité / Gainage":"Mob.","Hyrox":"Hyrox",
    "Vélo":"Vélo","Repos":"Repos"}[t] || t?.slice(0,6) || "—";
};

// ─── CSV PARSERS ─────────────────────────────────────────────────────────────
const parseCSVActivities = (text) => {
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

const parseCSVSommeil = (text) => {
  // Strip BOM + normalize non-breaking spaces in headers
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.trim().split("\n");
  const headers = lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,"").replace(/\u00a0/g," "));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v=>v.trim().replace(/^"|"$/g,""));
    const o = {}; headers.forEach((h,i) => o[h] = vals[i]||"");
    // La colonne date peut s'appeler "Score de sommeil 4 semaines" (1ère colonne)
    const dateRaw = o["Score de sommeil 4 semaines"]||o["Date"]||vals[0]||"";
    return {
      id: Date.now()+Math.random(),
      date: dateRaw.includes("-") ? dateRaw.slice(0,10) : dateRaw,
      score: o["Score"]||"",
      fcRepos: o["Fréquence cardiaque au repos"]||"",
      bodyBattery: o["Body Battery"]||"",
      bodyBatteryMatin: o["Body Battery au lever"]||o["Body Battery Début de journée"]||"",
      spo2: o["Oxymètre de pouls"]||"",
      respiration: o["Respiration"]||"",
      vfc: o["Statut de la variabilité de la fréquence cardiaque"]||"",
      qualite: o["Qualité"]||"",
      duree: o["Durée"]||o["Durée du sommeil"]||"",
      coucher: o["Heure de coucher"]||o["Heure du coucher"]||"",
      lever: o["Heure de lever"]||o["Heure du lever"]||"",
    };
  }).filter(s=>s.date && s.date.match(/^\d{4}-\d{2}-\d{2}/));
};

// Convertit "22 Mar." → "2026-03-22" en inférant l'année
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
  // Inférer l'année : si le mois est dans le futur proche, c'est l'année courante, sinon l'année passée
  const now = new Date();
  const year = now.getFullYear();
  const testDate = new Date(`${year}-${mon}-${day}`);
  const finalYear = testDate > new Date(now.getTime() + 30*86400000) ? year-1 : year;
  return `${finalYear}-${mon}-${day}`;
};

const parseCSVVFC = (text) => {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.trim().split("\n");
  const headers = lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,"").replace(/\u00a0/g," "));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v=>v.trim().replace(/^"|"$/g,""));
    const o = {}; headers.forEach((h,i) => o[h] = vals[i]||"");
    const dateRaw = o["Date"]||vals[0]||"";
    const date = parseFrDateVFC(dateRaw);
    const stripMs = (v) => (v||"").replace(/ms/gi,"").trim();
    return {
      id: Date.now()+Math.random(),
      date,
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

// ─── EMPTY FACTORIES ─────────────────────────────────────────────────────────
const emptySeance = () => ({
  id: Date.now()+Math.random(), date: localDate(new Date()),
  demiJournee: "Lundi AM", activite: "Trailrunning", statut: "Planifié",
  commentaire: "", dureeObj: "", kmObj: "", dpObj: "",
  garminTitre: "", dureeGarmin: "", kmGarmin: "", dpGarmin: "",
  allure: "", fcMoy: "", fcMax: "", cal: "", _nonPlanifie: false,
  z1: "", z2: "", z3: "", z4: "", z5: "",
});
const emptyObjectif = () => ({
  id: Date.now()+Math.random(), date: "", nom: "", distance: "", dp: "",
  statut: "À venir", temps: "", priorite: "A", region: "", lien: "",
});
const emptyPoids = () => ({
  id: Date.now()+Math.random(), date: localDate(new Date()),
  poids: "", taille: 180, cou: "", taille_cm: "", ventre: "",
  hanche: "", cuisse: "", mollet: "",
});
const emptyVFC = () => ({
  id: Date.now()+Math.random(), date: localDate(new Date()),
  vfc: "", baseline: "", moy7j: "", vo2max: "",
  chargeAigue: "", chargeChronique: "",
});
const emptySommeil = () => ({
  id: Date.now()+Math.random(), date: localDate(new Date()),
  score: "", fcRepos: "", bodyBattery: "", bodyBatteryMatin: "",
  spo2: "", respiration: "", vfc: "", qualite: "Bon",
  duree: "", coucher: "", lever: "",
});

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,300&family=DM+Sans:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: ${C.bg}; }
  #root { height: 100%; display: flex; flex-direction: column; }
  body { font-family: 'DM Sans', sans-serif; color: ${C.ink}; font-size: 14px; line-height: 1.5; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${C.stoneDark}; border-radius: 2px; }

  input, select, textarea {
    font-family: inherit; font-size: 14px; color: ${C.ink};
    background: ${C.white}; border: 1px solid ${C.border};
    border-radius: 8px; padding: 8px 12px; width: 100%; outline: none;
    transition: border-color 0.15s;
  }
  input:focus, select:focus, textarea:focus { border-color: ${C.forest}; }
  textarea { resize: vertical; min-height: 72px; }

  .anim { animation: fadeUp 0.18s ease both; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }

  .badge { display:inline-flex; align-items:center; font-size:11px; font-weight:500; padding:2px 7px; border-radius:20px; white-space:nowrap; }
  .badge-plan { background:${C.skyPale}; color:${C.sky}; }
  .badge-done { background:${C.greenPale}; color:${C.green}; }
  .badge-cancel { background:${C.stone}; color:${C.muted}; }
  .badge-race { background:${C.summitPale}; color:${C.summit}; }
  .badge-warn { background:${C.yellowPale}; color:${C.yellow}; }

  @media (max-width: 640px) {
    .hide-mobile { display: none !important; }
  }
  @media (min-width: 641px) {
    .hide-desktop { display: none !important; }
  }
`;

// ─── ATOMS ────────────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant="primary", size="md", style={}, disabled=false }) => {
  const base = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
    border:"none", borderRadius:8, cursor:disabled?"not-allowed":"pointer", fontFamily:"inherit",
    fontWeight:500, transition:"all 0.12s", opacity:disabled?0.5:1, ...style };
  const sz = size==="sm" ? {fontSize:12,padding:"5px 11px"} : size==="lg" ? {fontSize:15,padding:"11px 22px"} : {fontSize:13,padding:"8px 16px"};
  const vars = {
    primary: {background:C.forest, color:"#fff"},
    ghost:   {background:"transparent", color:C.inkLight, border:`1px solid ${C.border}`},
    soft:    {background:C.forestPale, color:C.forest},
    danger:  {background:C.redPale, color:C.red, border:`1px solid ${C.red}22`},
    sage:    {background:C.stone, color:C.inkLight},
    summit:  {background:C.summit, color:"#fff"},
  };
  return <button style={{...base,...sz,...vars[variant]}} onClick={onClick} disabled={disabled}>{children}</button>;
};

const Modal = ({ open, onClose, title, subtitle, children, width=560 }) => {
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(28,25,22,0.55)",backdropFilter:"blur(3px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:16,width:"100%",maxWidth:width,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{padding:"18px 22px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:C.inkLight}}>{title}</div>
            {subtitle && <div style={{fontSize:12,color:C.muted,marginTop:2}}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.stoneDeep,padding:"0 2px",lineHeight:1}}>×</button>
        </div>
        <div style={{padding:22,overflowY:"auto",flex:1}}>{children}</div>
      </div>
    </div>
  );
};

const Field = ({ label, children, full, style={} }) => (
  <div style={{gridColumn:full?"1/-1":undefined,...style}}>
    <label style={{display:"block",fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted,marginBottom:5}}>{label}</label>
    {children}
  </div>
);

const FormGrid = ({ children }) => (
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{children}</div>
);

const ConfirmDialog = ({ open, message, onConfirm, onCancel, danger=true }) => {
  if (!open) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,25,22,0.6)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.white,borderRadius:14,padding:28,maxWidth:360,width:"100%",boxShadow:"0 16px 48px rgba(0,0,0,0.2)"}}>
        <div style={{fontSize:14,color:C.ink,marginBottom:22,lineHeight:1.6}}>{message}</div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn variant="ghost" onClick={onCancel}>Annuler</Btn>
          <Btn variant={danger?"danger":"primary"} onClick={onConfirm}>Confirmer</Btn>
        </div>
      </div>
    </div>
  );
};

const statusBadge = (s) => {
  if (s==="Effectué") return <span className="badge badge-done">✓ Effectué</span>;
  if (s==="Annulé")   return <span className="badge badge-cancel">Annulé</span>;
  return <span className="badge badge-plan">Planifié</span>;
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ seances, objectifs, sommeil, vfcData, poids, activites, setView }) {
  const today   = localDate(new Date());
  const nowMkey = today.slice(0,7);

  const lastVFC     = useMemo(()=>[...vfcData].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[vfcData]);
  const lastSommeil = useMemo(()=>[...sommeil].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[sommeil]);

  // ── Forme du jour ──────────────────────────────────────────────
  const formeScore = useMemo(()=>{
    const vfc=lastVFC?parseInt(lastVFC.vfc)||0:0;
    const base=lastVFC?.baseline?parseInt(lastVFC.baseline.match(/(\d+)ms/)?.[1]||70):70;
    const som=lastSommeil?parseInt(lastSommeil.score)||0:0;
    const bb=lastSommeil?parseInt(lastSommeil.bodyBatteryMatin)||0:0;
    const ratio=lastVFC?.chargeAigue&&lastVFC?.chargeChronique?parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique):1;
    let s=0;
    if(vfc>=base*0.9)s+=2;else if(vfc>=base*0.75)s+=1;
    if(som>=80)s+=2;else if(som>=65)s+=1;
    if(bb>=70)s+=2;else if(bb>=45)s+=1;
    if(ratio<=1.2)s+=1;else if(ratio>1.4)s-=1;
    return s;
  },[lastVFC,lastSommeil]);
  const formeColor=formeScore>=5?C.green:formeScore>=3?C.yellow:C.red;
  const formePale =formeScore>=5?C.greenPale:formeScore>=3?C.yellowPale:C.redPale;
  const formeLabel=formeScore>=5?"Bonne forme":formeScore>=3?"Forme moyenne":"Récupération";
  const formeEmoji=formeScore>=5?"🟢":formeScore>=3?"🟡":"🔴";

  // ── Objectif & phase ────────────────────────────────────────────
  const nextObj = useMemo(()=>[...objectifs].filter(o=>o.date>=today).sort((a,b)=>new Date(a.date)-new Date(b.date))[0]||null,[objectifs,today]);
  const j=nextObj?daysUntil(nextObj.date):null;
  const phase=j===null?null:j>90?"Fondamental":j>42?"Spécifique":j>14?"Affûtage":j>0?"Tapering":"Terminé";
  const phaseColor=j===null?C.muted:j>90?C.sky:j>42?"#e65100":j>14?C.yellow:j>0?C.summit:C.muted;
  const phasePale=j===null?"transparent":j>90?C.skyPale:j>42?"#fff3e0":j>14?C.yellowPale:j>0?C.summitPale:"transparent";

  // Barre runway : % du chemin parcouru entre J-ref et course
  const runwayPct = useMemo(()=>{
    if(!nextObj) return 0;
    const totalDays = 180; // ~6 mois de prépa type
    const elapsed = Math.max(0, totalDays - (j||0));
    return Math.min(100, Math.round(elapsed/totalDays*100));
  },[j,nextObj]);

  // ── Ratio charge ────────────────────────────────────────────────
  const ratio=lastVFC?.chargeAigue&&lastVFC?.chargeChronique?Math.round(parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique)*100)/100:null;
  const ratioColor=ratio===null?C.muted:ratio>1.4?C.red:ratio>1.2?C.yellow:ratio<0.8?C.sky:C.green;

  // ── Semaine courante ────────────────────────────────────────────
  const weekDays=useMemo(()=>{
    const d=new Date(); const dow=(d.getDay()+6)%7;
    const mon=new Date(d); mon.setDate(d.getDate()-dow);
    return Array.from({length:7},(_,i)=>{
      const day=new Date(mon); day.setDate(mon.getDate()+i);
      const dateStr=localDate(day);
      const runSeances=seances.filter(s=>s.date===dateStr&&isRunning(s.activite));
      const kmDay=Math.round(runSeances.filter(s=>s.statut==="Effectué").reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0)*10)/10;
      const dpDay=Math.round(runSeances.filter(s=>s.statut==="Effectué").reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0));
      const hasDone=runSeances.some(s=>s.statut==="Effectué");
      const hasPlan=seances.some(s=>s.date===dateStr&&s.activite!=="Repos"&&s.statut==="Planifié");
      const allSeances=seances.filter(s=>s.date===dateStr&&s.activite!=="Repos");
      const types=[...new Set(allSeances.map(s=>s.activite))];
      return {label:["Lu","Ma","Me","Je","Ve","Sa","Di"][i],dateStr,hasDone,hasPlan,
        isTod:dateStr===today,isPast:dateStr<today,types,kmDay,dpDay};
    });
  },[seances,today]);
  const weekEff=weekDays.filter(d=>d.hasDone);
  const weekKm=Math.round(weekDays.reduce((s,d)=>s+d.kmDay,0)*10)/10;
  const weekDp=weekDays.reduce((s,d)=>s+d.dpDay,0);
  const weekPlan=weekDays.filter(d=>d.hasPlan).length;

  // ── 12 semaines glissantes ──────────────────────────────────────
  const twelveWeeks=useMemo(()=>{
    const result=[];
    const d=new Date();
    const dow=(d.getDay()+6)%7;
    const thisMon=new Date(d); thisMon.setDate(d.getDate()-dow);
    for(let w=11;w>=0;w--){
      const mon=new Date(thisMon); mon.setDate(thisMon.getDate()-w*7);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      const monStr=localDate(mon); const sunStr=localDate(sun);
      const wSeances=seances.filter(s=>s.date>=monStr&&s.date<=sunStr&&s.statut==="Effectué"&&isRunning(s.activite));
      const km=Math.round(wSeances.reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0)*10)/10;
      const dp=Math.round(wSeances.reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0));
      // VFC moy de la semaine
      const wVfc=vfcData.filter(v=>v.date>=monStr&&v.date<=sunStr);
      const vfcMoy=wVfc.length?Math.round(wVfc.reduce((s,v)=>s+(parseInt(v.vfc)||0),0)/wVfc.length):null;
      // Phase selon J restants au milieu de la semaine
      const midDate=new Date(mon); midDate.setDate(mon.getDate()+3);
      const jMid=nextObj?Math.round((new Date(nextObj.date)-midDate)/86400000):null;
      const ph=jMid===null?0:jMid>90?0:jMid>42?1:jMid>14?2:3;
      const label=w===0?"Cette sem.":`S-${w}`;
      result.push({label,km,dp,vfcMoy,phase:ph});
    }
    return result;
  },[seances,vfcData,nextObj]);

  // ── Données pour nuage D+ × VFC ─────────────────────────────────
  const scatterData=useMemo(()=>twelveWeeks.filter(w=>w.dp>0&&w.vfcMoy).map(w=>({x:w.dp,y:w.vfcMoy,label:w.label})),[twelveWeeks]);

  // ── Prévision course ────────────────────────────────────────────
  const prevision=useMemo(()=>{
    if(!nextObj) return null;
    const raceDp=parseFloat(nextObj.dp)||0;
    const raceKm=parseFloat(nextObj.distance)||0;
    const ratioCourse=raceKm>0?Math.round(raceDp/raceKm):0;
    // Long run max
    const longRunMax=Math.max(0,...seances.filter(s=>s.statut==="Effectué"&&isRunning(s.activite)).map(s=>parseFloat(s.kmGarmin)||0));
    // Sorties > 1000m D+
    const sortiesDP=seances.filter(s=>s.statut==="Effectué"&&isRunning(s.activite)&&(parseFloat(s.dpGarmin)||0)>=1000).length;
    const sortiesDPReq=raceDp>1500?2:raceDp>800?1:0;
    // D+ semaine moyen (8 dernières semaines)
    const last8=twelveWeeks.slice(-8);
    const dpMoySem=last8.length?Math.round(last8.reduce((s,w)=>s+w.dp,0)/last8.length):0;
    const dpCibleSem=Math.round(raceDp/8);
    // Charge chronique
    const chargeOk=lastVFC?.chargeChronique?parseInt(lastVFC.chargeChronique)>200:false;
    // VFC trend (3 dernières semaines vs 3 précédentes)
    const vfcLast3=vfcData.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,3);
    const vfcMoyLast3=vfcLast3.length?Math.round(vfcLast3.reduce((s,v)=>s+(parseInt(v.vfc)||0),0)/vfcLast3.length):0;
    // Score global
    let score=0;
    if(longRunMax>=raceKm*0.7)score+=2; else if(longRunMax>=raceKm*0.5)score+=1;
    if(sortiesDP>=sortiesDPReq)score+=2; else if(sortiesDP>0)score+=1;
    if(dpMoySem>=dpCibleSem*0.8)score+=2; else if(dpMoySem>=dpCibleSem*0.5)score+=1;
    if(chargeOk)score+=1;
    if(vfcMoyLast3>60)score+=1;
    const verdict=score>=7?"En bonne voie":score>=4?"Préparation à risque":"Préparation insuffisante";
    const verdictColor=score>=7?C.green:score>=4?C.yellow:C.red;
    const verdictPale=score>=7?C.greenPale:score>=4?C.yellowPale:C.redPale;
    // Recommandations
    const recs=[];
    if(longRunMax<raceKm*0.7)recs.push(`Long run max ${Math.round(longRunMax)}km — viser ${Math.round(raceKm*0.7)}km avant la course`);
    if(sortiesDP<sortiesDPReq)recs.push(`${sortiesDPReq-sortiesDP} sortie(s) > 1000m D+ manquante(s) pour préparer le dénivelé`);
    if(dpMoySem<dpCibleSem*0.8)recs.push(`D+ hebdo moyen ${dpMoySem}m vs ${dpCibleSem}m cible — augmenter progressivement`);
    if(ratio&&ratio>1.3)recs.push(`Ratio de charge ${ratio} — semaine allégée recommandée avant de reprendre`);
    if(recs.length===0)recs.push("Continue sur cette lancée — la préparation est solide");
    return {verdict,verdictColor,verdictPale,score,longRunMax,raceKm,sortiesDP,sortiesDPReq,dpMoySem,dpCibleSem,chargeOk,recs,ratioCourse};
  },[nextObj,seances,vfcData,lastVFC,twelveWeeks,ratio]);

  // ── Heatmap forme 4 semaines ────────────────────────────────────
  const heatmap4=useMemo(()=>{
    const result=[];
    const d=new Date(); const dow=(d.getDay()+6)%7;
    const thisMon=new Date(d); thisMon.setDate(d.getDate()-dow);
    for(let w=3;w>=0;w--){
      const mon=new Date(thisMon); mon.setDate(thisMon.getDate()-w*7);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      const monStr=localDate(mon); const sunStr=localDate(sun);
      const wVfc=vfcData.filter(v=>v.date>=monStr&&v.date<=sunStr);
      const wSom=sommeil.filter(s=>s.date>=monStr&&s.date<=sunStr);
      const vfcMoy=wVfc.length?wVfc.reduce((s,v)=>s+(parseInt(v.vfc)||0),0)/wVfc.length:0;
      const somMoy=wSom.length?wSom.reduce((s,v)=>s+(parseInt(v.score)||0),0)/wSom.length:0;
      const wRatio=lastVFC?.chargeAigue&&lastVFC?.chargeChronique?parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique):1;
      let sc=0;
      if(vfcMoy>70)sc+=2;else if(vfcMoy>60)sc+=1;
      if(somMoy>80)sc+=2;else if(somMoy>65)sc+=1;
      if(w===0&&wRatio<=1.2)sc+=1;
      const lbl=w===0?"Cette sem.":`S-${w}`;
      result.push({lbl,sc,vfcMoy:Math.round(vfcMoy),somMoy:Math.round(somMoy)});
    }
    return result;
  },[vfcData,sommeil,lastVFC]);

  // ── Manqués ─────────────────────────────────────────────────────
  const manques=useMemo(()=>{
    const since=localDate(new Date(Date.now()-7*86400000));
    return seances.filter(s=>s.date>=since&&s.date<today&&s.statut==="Planifié"&&s.activite!=="Repos");
  },[seances,today]);

  // ── Refs charts ─────────────────────────────────────────────────
  const chartRef12=useRef(null); const chartRefScatter=useRef(null);
  const chartRefCharge=useRef(null); const chartInst12=useRef(null);
  const chartInstScatter=useRef(null); const chartInstCharge=useRef(null);

  useEffect(()=>{
    const loadChart = () => {
      if(typeof Chart!=="undefined"){
        runCharts();
        return;
      }
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload=runCharts;
      document.head.appendChild(s);
    };
    const runCharts = () => {
    if(typeof Chart==="undefined") return;
    const isDark=window.matchMedia("(prefers-color-scheme:dark)").matches;
    const gc=isDark?"rgba(255,255,255,.07)":"rgba(0,0,0,.06)";
    const tc=isDark?"#9c9a92":"#73726c";
    const phaseColors=["#378ADD","#BA7517","#A32D2D","#7F77DD"];
    const phasePales=["#B5D4F4","#FAC775","#F09595","#EEEDFE"];

    // Graphique 12 semaines
    if(chartRef12.current&&twelveWeeks.length){
      if(chartInst12.current)chartInst12.current.destroy();
      chartInst12.current=new Chart(chartRef12.current,{
        type:"bar",
        data:{
          labels:twelveWeeks.map(w=>w.label),
          datasets:[
            {label:"km trail",data:twelveWeeks.map(w=>w.km),
              backgroundColor:twelveWeeks.map(w=>phasePales[w.phase]||phasePales[0]),
              borderColor:twelveWeeks.map(w=>phaseColors[w.phase]||phaseColors[0]),
              borderWidth:1,borderRadius:4,yAxisID:"y"},
            {label:"D+÷40",data:twelveWeeks.map(w=>w.dp>0?Math.round(w.dp/40):null),
              type:"line",borderColor:"#e6510099",backgroundColor:"transparent",
              pointBackgroundColor:"#e65100",pointRadius:3,tension:.4,
              borderWidth:1.5,borderDash:[4,3],yAxisID:"y"},
            {label:"VFC moy.",data:twelveWeeks.map(w=>w.vfcMoy),
              type:"line",borderColor:"#185FA5",backgroundColor:"transparent",
              pointBackgroundColor:"#185FA5",pointRadius:4,tension:.4,
              borderWidth:2,yAxisID:"y2"},
          ]
        },
        options:{
          responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{
            if(ctx.datasetIndex===0)return(ctx.parsed.y||0)+" km";
            if(ctx.datasetIndex===1)return twelveWeeks[ctx.dataIndex]?.dp+"m D+";
            return(ctx.parsed.y||"—")+" ms VFC";
          }}}},
          scales:{
            x:{grid:{color:gc},ticks:{color:tc,font:{size:10},maxRotation:0,autoSkip:false}},
            y:{grid:{color:gc},ticks:{color:tc,font:{size:10}},min:0,
               title:{display:true,text:"km",color:tc,font:{size:10}}},
            y2:{position:"right",grid:{display:false},min:55,max:90,
                ticks:{color:"#185FA5",font:{size:10}},
                title:{display:true,text:"VFC ms",color:"#185FA5",font:{size:10}}}
          }
        }
      });
    }

    // Nuage D+ × VFC
    if(chartRefScatter.current&&scatterData.length){
      if(chartInstScatter.current)chartInstScatter.current.destroy();
      chartInstScatter.current=new Chart(chartRefScatter.current,{
        type:"scatter",
        data:{datasets:[{
          label:"Semaine",data:scatterData.map(d=>({x:d.x,y:d.y})),
          backgroundColor:isDark?"#378ADDaa":"#185FA5aa",
          pointRadius:7,pointHoverRadius:9,
        }]},
        options:{
          responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{
            label:ctx=>`${scatterData[ctx.dataIndex]?.label} — ${ctx.parsed.x}m D+ · ${ctx.parsed.y}ms VFC`
          }}},
          scales:{
            x:{grid:{color:gc},ticks:{color:tc,font:{size:10}},
               title:{display:true,text:"D+/semaine (m)",color:tc,font:{size:10}},min:0},
            y:{grid:{color:gc},ticks:{color:tc,font:{size:10}},
               title:{display:true,text:"VFC moyen (ms)",color:tc,font:{size:10}},min:55,max:90}
          }
        }
      });
    }

    // Charge aiguë/chronique
    const chargeWeeks=twelveWeeks.map(w=>w.label);
    const chargeA=twelveWeeks.map((_,i)=>{
      const d=new Date(); const dow=(d.getDay()+6)%7;
      const thisMon=new Date(d); thisMon.setDate(d.getDate()-dow);
      const wk=11-i; const mon=new Date(thisMon); mon.setDate(thisMon.getDate()-wk*7);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      const monStr=localDate(mon); const sunStr=localDate(sun);
      const wvfc=vfcData.filter(v=>v.date>=monStr&&v.date<=sunStr&&v.chargeAigue);
      return wvfc.length?Math.round(parseInt(wvfc[wvfc.length-1].chargeAigue)):null;
    });
    const chargeC=twelveWeeks.map((_,i)=>{
      const d=new Date(); const dow=(d.getDay()+6)%7;
      const thisMon=new Date(d); thisMon.setDate(d.getDate()-dow);
      const wk=11-i; const mon=new Date(thisMon); mon.setDate(thisMon.getDate()-wk*7);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      const monStr=localDate(mon); const sunStr=localDate(sun);
      const wvfc=vfcData.filter(v=>v.date>=monStr&&v.date<=sunStr&&v.chargeChronique);
      return wvfc.length?Math.round(parseInt(wvfc[wvfc.length-1].chargeChronique)):null;
    });
    if(chartRefCharge.current){
      if(chartInstCharge.current)chartInstCharge.current.destroy();
      chartInstCharge.current=new Chart(chartRefCharge.current,{
        type:"line",
        data:{
          labels:chargeWeeks,
          datasets:[
            {label:"Charge aiguë",data:chargeA,borderColor:"#e65100",
             backgroundColor:"#e6510015",pointRadius:3,pointBackgroundColor:"#e65100",
             tension:.4,fill:true,borderWidth:2},
            {label:"Charge chronique",data:chargeC,borderColor:"#185FA5",
             backgroundColor:"transparent",pointRadius:3,pointBackgroundColor:"#185FA5",
             tension:.4,borderDash:[4,3],borderWidth:2}
          ]
        },
        options:{
          responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{
            label:ctx=>ctx.dataset.label+": "+(ctx.parsed.y||"—")
          }}},
          scales:{
            x:{grid:{color:gc},ticks:{color:tc,font:{size:10},maxRotation:0,autoSkip:false}},
            y:{grid:{color:gc},ticks:{color:tc,font:{size:10}},min:0}
          }
        }
      });
    }
    }; // fin runCharts
    loadChart();
  },[twelveWeeks,scatterData,vfcData]);

  // Styles communs
  const card=(extra={})=>({background:C.white,border:`1px solid ${C.border}`,borderRadius:12,...extra});
  const lbl={fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted,marginBottom:8};
  const heatScore=(sc)=>sc>=4?{bg:C.greenPale,col:C.green,txt:"Très bonne"}:sc>=3?{bg:C.forestPale,col:C.forest,txt:"Bonne"}:sc>=2?{bg:C.yellowPale,col:C.yellow,txt:"Moyenne"}:{bg:C.redPale,col:C.red,txt:"Fatigue"};

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>

      {/* ── FORME DU JOUR ── */}
      <div style={{...card(),background:formePale,border:`1.5px solid ${formeColor}33`,padding:"20px 28px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
        <div>
          <div style={{...lbl,color:formeColor,marginBottom:4}}>Forme du jour</div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:28,fontWeight:500,color:formeColor,lineHeight:1}}>{formeEmoji} {formeLabel}</div>
          <div style={{fontSize:11,color:formeColor,marginTop:4,opacity:.8}}>
            {formeScore>=5?"VFC et sommeil bons — tu peux pousser":formeScore>=3?"Forme correcte — reste à l'écoute":"Récupération conseillée — réduis l'intensité"}
          </div>
        </div>
        <div style={{display:"flex",gap:24}}>
          {[
            {k:"VFC",v:lastVFC?.vfc?`${lastVFC.vfc}ms`:"—",s:lastVFC?.baseline||""},
            {k:"Sommeil",v:lastSommeil?.score?`${lastSommeil.score}/100`:"—",s:lastSommeil?.qualite||""},
            {k:"Body Bat.",v:lastSommeil?.bodyBatteryMatin?`${lastSommeil.bodyBatteryMatin}%`:"—",s:"au lever"},
            {k:"Ratio",v:ratio?String(ratio):"—",s:ratio?ratio>1.4?"⚠ Surcharge":ratio>1.2?"Élevée":ratio<0.8?"Sous-charge":"Équilibré":""},
          ].map(({k,v,s})=>(
            <div key={k} style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:formeColor,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em"}}>{k}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:500,color:formeColor}}>{v}</div>
              <div style={{fontSize:9,color:formeColor,opacity:.7}}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── GRILLE PRINCIPALE : Runway + Prévision ── */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>

        {/* Runway progression */}
        <div style={{...card(),padding:"20px 24px"}}>
          {nextObj?(
            <>
              <div style={{...lbl}}>Progression vers la course</div>
              <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:4}}>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:32,fontWeight:500,color:phaseColor}}>J-{j}</span>
                <span style={{fontSize:13,fontWeight:500,color:C.inkLight}}>{nextObj.nom}</span>
                <span style={{fontSize:12,color:phaseColor,background:phasePale,padding:"2px 8px",borderRadius:10,marginLeft:4}}>{phase}</span>
              </div>
              <div style={{fontSize:11,color:C.muted,marginBottom:16}}>{nextObj.distance}km · {nextObj.dp}m D+ · ratio {prevision?.ratioCourse}m/km · {fmtDate(nextObj.date)}</div>

              {/* Barre runway */}
              <div style={{fontSize:10,color:C.muted,marginBottom:4,display:"flex",justifyContent:"space-between"}}>
                <span>Début prépa</span><span style={{color:phaseColor,fontWeight:500}}>Aujourd'hui ({runwayPct}%)</span><span>Race</span>
              </div>
              <div style={{height:8,borderRadius:4,background:C.stone,overflow:"hidden",marginBottom:8,position:"relative"}}>
                <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${runwayPct}%`,
                  background:`linear-gradient(90deg,${C.forest},${phaseColor})`,borderRadius:4}}/>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:20}}>
                {[{l:"Fondamental",c:C.sky},{l:"Spécifique",c:"#e65100"},{l:"Affûtage",c:C.yellow},{l:"Tapering",c:C.summit}].map(({l,c})=>(
                  <span key={l} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:c+"22",color:c,fontWeight:phase===l?600:400,border:phase===l?`1px solid ${c}44`:"none"}}>{l}</span>
                ))}
              </div>

              {/* Jalons */}
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {prevision&&[
                  {label:`Long run max: ${Math.round(prevision.longRunMax)}km`,target:`Cible: ${Math.round(prevision.raceKm*0.7)}km`,ok:prevision.longRunMax>=prevision.raceKm*0.7},
                  {label:`Sorties > 1000m D+: ${prevision.sortiesDP}`,target:`Requises: ${prevision.sortiesDPReq}`,ok:prevision.sortiesDP>=prevision.sortiesDPReq},
                  {label:`D+ moyen/sem: ${prevision.dpMoySem}m`,target:`Cible: ${prevision.dpCibleSem}m`,ok:prevision.dpMoySem>=prevision.dpCibleSem*0.8},
                  {label:`Charge chronique`,target:`${lastVFC?.chargeChronique||"—"}`,ok:prevision.chargeOk},
                ].map(({label,target,ok})=>(
                  <div key={label} style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:ok?C.green:C.red,flexShrink:0}}/>
                    <span style={{fontSize:12,color:C.inkLight,flex:1}}>{label}</span>
                    <div style={{flex:1,height:1,borderTop:`1px dashed ${C.border}`}}/>
                    <span style={{fontSize:11,color:ok?C.green:C.muted}}>{target}</span>
                  </div>
                ))}
              </div>
            </>
          ):(
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:14,color:C.muted,marginBottom:12}}>Aucune course objectif définie</div>
              <Btn variant="soft" onClick={()=>setView("objectifs")}>＋ Ajouter un objectif</Btn>
            </div>
          )}
        </div>

        {/* Prévision & recommandations */}
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{...lbl}}>Prévision course</div>
          {prevision?(
            <>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:20,
                background:prevision.verdictPale,marginBottom:16}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:prevision.verdictColor}}/>
                <span style={{fontSize:13,fontWeight:500,color:prevision.verdictColor}}>{prevision.verdict}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {prevision.recs.map((r,i)=>(
                  <div key={i} style={{fontSize:12,color:i===0&&prevision.score>=7?C.forest:C.inkLight,
                    background:C.stone,borderRadius:8,padding:"9px 12px",lineHeight:1.5,
                    borderLeft:`3px solid ${i===0&&prevision.score>=7?C.forest:prevision.score>=4?C.yellow:C.red}`}}>
                    {r}
                  </div>
                ))}
              </div>
            </>
          ):(
            <div style={{fontSize:12,color:C.muted}}>Ajouter un objectif pour voir la prévision</div>
          )}
        </div>
      </div>

      {/* ── GRILLE : Semaine + Heatmap + Manqués ── */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:16,marginBottom:16}}>

        {/* Semaine en cours avec km/jour */}
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{...lbl,marginBottom:0}}>Cette semaine</div>
            <div style={{display:"flex",gap:10,fontSize:12}}>
              {weekKm>0&&<span style={{fontFamily:"'DM Mono',monospace",color:C.forest,fontWeight:500}}>{weekKm}km</span>}
              {weekDp>0&&<span style={{fontFamily:"'DM Mono',monospace",color:C.muted}}>{weekDp}m↑</span>}
              <span style={{color:C.muted}}>{weekEff.length}/{weekEff.length+weekPlan} séances</span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
            {weekDays.map(({label,dateStr,hasDone,hasPlan,isTod,isPast,types,kmDay,dpDay})=>(
              <div key={dateStr} style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:isTod?C.forest:C.muted,fontWeight:isTod?600:400,marginBottom:3}}>{label}</div>
                <div style={{borderRadius:10,padding:"8px 4px 6px",
                  background:hasDone?C.forestPale:hasPlan?C.stone:isPast?C.redPale+"66":C.stone,
                  border:isTod?`1.5px solid ${C.forest}`:hasDone?`1px solid ${C.forest}44`:`1px solid ${C.border}`}}>
                  {kmDay>0?(
                    <>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500,color:C.forest}}>{kmDay}</div>
                      <div style={{fontSize:9,color:C.muted}}>km</div>
                      {dpDay>0&&<div style={{fontSize:9,color:C.muted}}>{dpDay}m↑</div>}
                    </>
                  ):hasPlan?(
                    <div style={{width:8,height:8,borderRadius:2,background:types[0]?actColor(types[0]):C.muted,opacity:.5,margin:"4px auto"}}/>
                  ):(
                    <div style={{fontSize:9,color:isPast?C.red:C.stoneDeep,padding:"4px 0"}}>{isPast?"—":"·"}</div>
                  )}
                </div>
                {isTod&&<div style={{fontSize:8,color:C.forest,marginTop:2}}>auj.</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap forme */}
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{...lbl}}>Forme · 4 semaines</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {heatmap4.map(({lbl:wl,sc,vfcMoy,somMoy})=>{
              const {bg,col,txt}=heatScore(sc);
              return (
                <div key={wl} style={{borderRadius:8,padding:"8px 10px",background:bg}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:500,color:col}}>{wl}</span>
                    <span style={{fontSize:10,color:col,fontWeight:500}}>{txt}</span>
                  </div>
                  <div style={{fontSize:10,color:col,opacity:.75,marginTop:2}}>
                    {vfcMoy>0?`VFC ${vfcMoy}ms`:""}{vfcMoy>0&&somMoy>0?" · ":""}{somMoy>0?`Som. ${somMoy}/100`:""}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:10,color:C.muted,marginTop:10}}>Score: VFC + sommeil + ratio charge</div>
        </div>

        {/* Manqués */}
        <div style={{...card(),background:manques.length>0?C.redPale:C.white,
          border:`1px solid ${manques.length>0?C.red+"33":C.border}`,padding:"20px 24px"}}>
          <div style={{...lbl,color:manques.length>0?C.red:C.muted}}>Manqué (7j)</div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:44,fontWeight:500,
            color:manques.length>0?C.red:C.green,lineHeight:1,marginBottom:8}}>{manques.length}</div>
          {manques.length===0?(
            <div style={{fontSize:12,color:C.green}}>Rien de manqué</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {manques.slice(0,3).map(s=>(
                <div key={s.id} style={{fontSize:11,color:C.red,background:C.white+"88",borderRadius:5,padding:"3px 7px"}}>
                  {s.demiJournee.split(" ")[0]} — {s.activite}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── GRAPHIQUES CROISÉS ── */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>

        {/* 12 semaines : km + D+ + VFC */}
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{...lbl,marginBottom:0}}>12 semaines · km trail · D+ · VFC</div>
            <div style={{display:"flex",gap:12,fontSize:11,color:C.muted}}>
              {[{c:"#378ADD",l:"Fondamental"},{c:"#e65100",l:"Spécifique"},{c:"#A32D2D",l:"Affûtage"}].map(({c,l})=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{width:10,height:10,borderRadius:2,background:c,display:"inline-block"}}/>
                  {l}
                </span>
              ))}
              <span style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:10,height:2,background:"#e65100",display:"inline-block",borderTop:"2px dashed #e65100"}}/> D+
              </span>
              <span style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:10,height:2,background:"#185FA5",display:"inline-block"}}/> VFC
              </span>
            </div>
          </div>
          <div style={{position:"relative",height:180}}>
            <canvas ref={chartRef12}/>
          </div>
        </div>

        {/* Charge aiguë/chronique */}
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{...lbl}}>Charge aiguë / chronique</div>
          <div style={{display:"flex",gap:12,fontSize:11,color:C.muted,marginBottom:8}}>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:2,background:"#e65100",display:"inline-block"}}/> Aiguë</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:2,background:"#185FA5",display:"inline-block",borderTop:"2px dashed #185FA5"}}/> Chronique</span>
          </div>
          <div style={{position:"relative",height:152}}>
            <canvas ref={chartRefCharge}/>
          </div>
          <div style={{fontSize:10,color:C.muted,marginTop:6}}>Zone optimale ratio : 0.8 – 1.3</div>
        </div>
      </div>

      {/* ── Nuage D+ × VFC ── */}
      {scatterData.length>=3&&(
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{...lbl}}>Corrélation D+/semaine × VFC moyen — 12 semaines</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:10}}>
            Si la VFC baisse quand le D+ monte, le dénivelé génère de la fatigue. Chaque point = 1 semaine.
          </div>
          <div style={{position:"relative",height:180}}>
            <canvas ref={chartRefScatter}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ENTRAÎNEMENT PROGRAMME (vue principale fusionnée) ───────────────────────
// Statuts enrichis
const STATUTS = [
  {id:"Planifié", icon:"○", bg:"#E6F1FB", col:"#0C447C"},
  {id:"Effectué", icon:"✓", bg:"#E1F5EE", col:"#085041"},
  {id:"Partiel",  icon:"◑", bg:"#FAEEDA", col:"#633806"},
  {id:"Remplacé", icon:"⇄", bg:"#EEEDFE", col:"#3C3489"},
  {id:"Annulé",   icon:"✕", bg:"#F1EFE8", col:"#5F5E5A"},
];
const statutCfg = (st) => STATUTS.find(s=>s.id===st)||STATUTS[0];

function StatusBadge({statut}) {
  const {icon,bg,col}=statutCfg(statut);
  return <span style={{fontSize:10,fontWeight:500,padding:"2px 7px",borderRadius:8,
    background:bg,color:col,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>
    {icon} {statut}
  </span>;
}

function ActCell({type,muted}) {
  const t = TYPE_MIGRATION[type]||type;
  const icon = actIcon(type);
  const col = actColor(type);
  return <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
    <span style={{fontSize:13,color:col,flexShrink:0}}>{icon}</span>
    <span style={{fontSize:12,fontWeight:muted?400:500,
      color:muted?"var(--color-text-secondary)":"var(--color-text-primary)"}}>{t||"—"}</span>
  </span>;
}

const parseHMS = (s) => {
  if(!s) return null;
  const p=String(s).trim().split(":").map(Number);
  if(p.length===3&&!p.some(isNaN)) return p[0]*3600+p[1]*60+p[2];
  const f=parseFloat(s); return isNaN(f)?null:f;
};
const fmtHMSDiff = (sec) => {
  const a=Math.abs(Math.round(sec));
  const h=Math.floor(a/3600), m=Math.floor((a%3600)/60), s=a%60;
  const z=n=>String(n).padStart(2,"0");
  return (sec<0?"-":"+")+z(h)+":"+z(m)+":"+z(s);
};
// Allure min:ss/km à partir d'une durée "HH:MM:SS" et d'un nombre de km
const calcAllure = (duree, km) => {
  const sec = parseHMS(duree);
  const k = parseFloat(km);
  if(!sec || !k || k<=0) return null;
  const secPerKm = sec / k;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2,"0")}`;
};
function DiffSpan({real, plan, unit="", isDuration=false}) {
  if(!real) return <span style={{fontSize:11,color:C.stoneDeep}}>—</span>;
  if(!plan) return <span style={{fontSize:12,fontFamily:"'DM Mono',monospace",color:C.forest,fontWeight:500}}>{real}{isDuration?"":unit}</span>;
  let d=0, diffStr="";
  if(isDuration){
    const r=parseHMS(real), p=parseHMS(plan);
    if(r!==null&&p!==null&&r!==p){d=r-p; diffStr=fmtHMSDiff(d);}
  } else {
    const r=parseFloat(real)||0, p=parseFloat(plan)||0;
    d=Math.round((r-p)*10)/10;
    if(d!==0) diffStr=(d>0?"+":"")+d+unit;
  }
  const col=d<0?C.red:d>0?C.green:C.muted;
  return (
    <span style={{display:"flex",flexDirection:"column",alignItems:"flex-end",lineHeight:1.2}}>
      <span style={{fontSize:12,fontFamily:"'DM Mono',monospace",fontWeight:500,color:C.forest}}>{real}{isDuration?"":unit}</span>
      {diffStr&&<span style={{fontSize:9,color:col}}>{diffStr}</span>}
    </span>
  );
}

function EntrainementProgramme({ seances, setSeances, activites, setActivites, objectifs,
  planningType, activityTypes, journalNutri, produits, recettes, setView,
  setSommeil, setVfcData, setPoids, setObjectifs, setPlanningType, setActivityTypes,
  setJournalNutri, setProduits, setRecettes, allData, loadData, resetAll }) {

  const today = localDate(new Date());
  const currentYear = new Date().getFullYear();

  const [activeYear,  setActiveYear]  = useState(currentYear);
  const [activeMonth, setActiveMonth] = useState(today.slice(0,7)); // "YYYY-MM"
  const [showAll,     setShowAll]     = useState(false);
  const [openWeeks,   setOpenWeeks]   = useState(()=>{
    // Ouvrir la semaine courante par défaut
    const d=new Date(); const dow=(d.getDay()+6)%7;
    const mon=new Date(d); mon.setDate(d.getDate()-dow);
    return new Set([localDate(mon)]);
  });
  const [editModal,   setEditModal]   = useState(false);
  const [editForm,    setEditForm]    = useState(null);
  const [confirmId,   setConfirmId]   = useState(null);
  const [importMsg,   setImportMsg]   = useState("");
  const fileRef = useRef();

  // Importer programme JSON
  const handleImport = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader();
    r.onload=(ev)=>{
      try {
        const data=JSON.parse(ev.target.result);
        if(!data._stride_programme&&!data.seances){alert("Format non reconnu. Attendu : _stride_programme + seances[]");return;}
        const toImport=(data.seances||[]).map(s=>({
          ...emptySeance(),...s,
          id:Date.now()+Math.random(),
          activite:TYPE_MIGRATION[s.activite]||s.activite,
          statut:s.statut||"Planifié",
        }));
        const existingKeys=new Set(seances.map(s=>s.date+"|"+s.demiJournee));
        const news=toImport.filter(s=>!existingKeys.has(s.date+"|"+s.demiJournee));
        const updates=toImport.filter(s=>existingKeys.has(s.date+"|"+s.demiJournee));
        setSeances(ss=>{
          const merged=ss.map(s=>{
            const m=updates.find(u=>u.date===s.date&&u.demiJournee===s.demiJournee);
            if(!m) return s;
            if(s.statut==="Effectué"||s.statut==="Partiel") return {...s,commentaire:s.commentaire||m.commentaire,kmObj:s.kmObj||m.kmObj,dpObj:s.dpObj||m.dpObj,dureeObj:s.dureeObj||m.dureeObj,fcObj:s.fcObj||m.fcObj};
            return {...s,...m,id:s.id};
          });
          return [...merged,...news];
        });
        setImportMsg(`✓ ${news.length} séance(s) ajoutée(s) · ${updates.length} mise(s) à jour`);
        setTimeout(()=>setImportMsg(""),5000);
      } catch { alert("Erreur JSON"); }
    };
    r.readAsText(file,"utf-8"); e.target.value="";
  };

  // Semaines du mois sélectionné
  const weeks = useMemo(()=>{
    const result=[];
    const d=new Date(activeYear,0,1);
    const end=new Date(activeYear,11,31);
    // Aller au premier lundi de l'année
    const dow=(d.getDay()+6)%7;
    if(dow>0) d.setDate(d.getDate()-(dow));

    while(d<=end){
      const monStr=localDate(d);
      const sunD=new Date(d); sunD.setDate(d.getDate()+6);
      const sunStr=localDate(sunD);
      const mkey=monStr.slice(0,7); // mois du lundi

      // Séances de la semaine
      const wSeances=seances.filter(s=>s.date>=monStr&&s.date<=sunStr&&s.activite!=="Repos");
      const wSlots=[];
      for(let i=0;i<7;i++){
        const day=new Date(d); day.setDate(d.getDate()+i);
        const dateStr=localDate(day);
        const dayName=DAY_NAMES[(day.getDay()+6)%7];
        ["AM","PM"].forEach(half=>{
          const slot=`${dayName} ${half}`;
          const seance=seances.find(s=>s.date===dateStr&&s.demiJournee===slot);
          const defaultType=planningType?.[slot]||"";
          if(seance||defaultType) wSlots.push({dateStr,slot,dayName,half,seance,defaultType});
        });
      }

      const effRun=wSeances.filter(s=>s.statut==="Effectué"||s.statut==="Partiel");
      const kmPlan=Math.round(wSeances.filter(s=>isRunning(s.activite)).reduce((s,a)=>s+(parseFloat(a.kmObj)||0),0)*10)/10;
      const kmReal=Math.round(effRun.filter(s=>isRunning(s.activite)).reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0)*10)/10;
      const dpPlan=Math.round(wSeances.filter(s=>isRunning(s.activite)).reduce((s,a)=>s+(parseFloat(a.dpObj)||0),0));
      const dpReal=Math.round(effRun.filter(s=>isRunning(s.activite)).reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0));
      const nPlan=wSeances.length;
      const nReal=effRun.length;
      const isCurrent=monStr<=today&&sunStr>=today;

      result.push({monStr,sunStr,mkey,wSlots,kmPlan,kmReal,dpPlan,dpReal,nPlan,nReal,isCurrent});
      d.setDate(d.getDate()+7);
    }
    return result;
  },[seances,activeYear,planningType,today]);

  // Filtrer par mois ou tout
  const visibleWeeks = useMemo(()=>{
    if(showAll) return weeks;
    return weeks.filter(w=>w.mkey===activeMonth||
      // inclure semaines à cheval sur le mois
      (w.monStr.slice(0,7)===activeMonth||w.sunStr.slice(0,7)===activeMonth));
  },[weeks,activeMonth,showAll]);

  // Mois disponibles
  const months = useMemo(()=>{
    const ms=[]; for(let m=1;m<=12;m++) ms.push(`${activeYear}-${String(m).padStart(2,"0")}`);
    return ms;
  },[activeYear]);
  const MOIS_COURT=["Jan.","Fév.","Mar.","Avr.","Mai","Juin","Juil.","Août","Sept.","Oct.","Nov.","Déc."];

  const toggleWeek = (monStr) => setOpenWeeks(s=>{const n=new Set(s);n.has(monStr)?n.delete(monStr):n.add(monStr);return n;});

  // Édition séance
  const openEdit = (s) => { setEditForm({...s}); setEditModal(true); };
  const saveEdit = () => {
    setSeances(ss=>ss.map(s=>s.id===editForm.id?{...editForm,activite:TYPE_MIGRATION[editForm.activite]||editForm.activite}:s));
    setEditModal(false);
  };
  const updE = (k,v) => setEditForm(f=>({...f,[k]:v}));
  const delSeance = (id) => { setSeances(ss=>ss.filter(s=>s.id!==id)); setConfirmId(null); setEditModal(false); };

  // Couleur fond ligne par statut
  const rowBg = (st) => ({
    "Effectué":"#E1F5EE18","Partiel":"#FAEEDA22","Remplacé":"#EEEDFE22",
    "Annulé":"transparent","Planifié":"transparent"
  }[st]||"transparent");

  // Colonnes de la grille
  const GRID = "88px 110px 140px 140px minmax(80px,1fr) 36px 36px 36px 36px 36px 70px 68px 58px 58px 50px 70px 68px 58px 58px 50px";

  // Dates et mois de course pour mise en avant visuelle
  const raceDates  = useMemo(()=>new Set(objectifs.map(o=>o.date).filter(Boolean)),[objectifs]);
  const raceMonths = useMemo(()=>new Set(objectifs.map(o=>o.date?.slice(0,7)).filter(Boolean)),[objectifs]);
  const raceWeeks  = useMemo(()=>{
    const s=new Set();
    objectifs.forEach(o=>{ if(!o.date) return;
      const d=new Date(o.date); const dow=(d.getDay()+6)%7;
      const mon=new Date(d); mon.setDate(d.getDate()-dow);
      s.add(localDate(mon));
    }); return s;
  },[objectifs]);

  return (
    <div className="anim" style={{padding:"16px 0 80px"}}>

      {/* Toolbar année + mois — sticky */}
      <div style={{padding:"10px 40px",marginBottom:14,display:"flex",alignItems:"center",gap:10,
        flexWrap:"wrap",position:"sticky",top:0,zIndex:10,background:C.white,
        borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>setActiveYear(y=>y-1)} style={{background:"none",border:`0.5px solid ${C.border}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:13,color:C.muted}}>‹</button>
          <span style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:500,color:C.inkLight,minWidth:48,textAlign:"center"}}>{activeYear}</span>
          <button onClick={()=>setActiveYear(y=>y+1)} style={{background:"none",border:`0.5px solid ${C.border}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:13,color:C.muted}}>›</button>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {months.map((m,i)=>{
            const active=!showAll&&m===activeMonth;
            const isRace=raceMonths.has(m);
            return <button key={m} onClick={()=>{setActiveMonth(m);setShowAll(false);}}
              style={{padding:"3px 10px",borderRadius:20,fontSize:11,
                border:`0.5px solid ${active?C.forest:isRace?C.summit:C.border}`,cursor:"pointer",
                background:active?C.forest:isRace?"#FFF3E0":"transparent",
                color:active?C.white:isRace?C.summit:C.muted,fontFamily:"inherit",
                fontWeight:isRace?600:400}}>
              {isRace&&<span style={{marginRight:3}}>🏔</span>}{MOIS_COURT[i]}
            </button>;
          })}
          <button onClick={()=>setShowAll(true)}
            style={{padding:"3px 10px",borderRadius:20,fontSize:11,
              border:`0.5px solid ${showAll?C.forest:C.border}`,cursor:"pointer",
              background:showAll?C.forest:"transparent",
              color:showAll?C.white:C.muted,fontFamily:"inherit"}}>
            Tout
          </button>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:"auto"}}>
          {importMsg&&<span style={{fontSize:11,color:C.green,fontWeight:500}}>{importMsg}</span>}
          <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={handleImport}/>
          <Btn variant="sage" size="sm" onClick={()=>fileRef.current?.click()}>⬆ Importer programme</Btn>
        </div>
      </div>

      {/* Semaines */}
      <div style={{padding:"0 24px"}}>
        {visibleWeeks.length===0&&(
          <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:36,marginBottom:12}}>📋</div>
            <div style={{fontSize:15,fontWeight:500,color:C.inkLight,marginBottom:8}}>Aucune séance ce mois</div>
            <Btn variant="sage" onClick={()=>fileRef.current?.click()}>⬆ Importer un programme JSON</Btn>
          </div>
        )}
        {visibleWeeks.map(({monStr,sunStr,wSlots,kmPlan,kmReal,dpPlan,dpReal,nPlan,nReal,isCurrent})=>{
          const isOpen=openWeeks.has(monStr);
          return (
            <div key={monStr} style={{
              border:`${isCurrent?"1.5px":"0.5px"} solid ${isCurrent?C.forest:C.border}`,
              borderRadius:12,marginBottom:10,overflow:"hidden",
              background:C.white}}>

              {/* Header semaine */}
              <div onClick={()=>toggleWeek(monStr)}
                style={{display:"flex",alignItems:"center",gap:16,padding:"10px 16px",
                  background:isCurrent?C.forestPale:C.stone,cursor:"pointer",flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500,
                    color:isCurrent?C.forest:C.inkLight}}>
                    {fmtDate(monStr)} — {fmtDate(sunStr)}
                  </span>
                  {isCurrent&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:10,
                    background:C.forest,color:C.white,fontWeight:500}}>Cette semaine</span>}
                  {raceWeeks.has(monStr)&&(()=>{
                    const race=objectifs.find(o=>{ if(!o.date) return false; const d=new Date(o.date); const dow=(d.getDay()+6)%7; const mon2=new Date(d); mon2.setDate(d.getDate()-dow); return localDate(mon2)===monStr; });
                    return <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,
                      background:C.summit,color:C.white,fontWeight:600}}>🏔 {race?.nom||"Course"}</span>;
                  })()}
                </div>
                <div style={{display:"flex",gap:20,flex:1,flexWrap:"wrap"}}>
                  {[
                    {l:"km",   pv:kmPlan?`${kmPlan}km`:"",  rv:kmReal?`${kmReal}km`:"",  d:kmReal&&kmPlan?Math.round((kmReal-kmPlan)*10)/10:null},
                    {l:"D+",   pv:dpPlan?`${dpPlan}m`:"",   rv:dpReal?`${dpReal}m`:"",   d:dpReal&&dpPlan?dpReal-dpPlan:null},
                    {l:"Séances",pv:`${nPlan}`,              rv:nReal>0?`${nReal}`:null,  d:null},
                  ].map(({l,pv,rv,d})=>pv?(
                    <div key={l} style={{display:"flex",flexDirection:"column",gap:0}}>
                      <span style={{fontSize:9,color:isCurrent?C.forest:C.muted,textTransform:"uppercase",letterSpacing:".05em"}}>{l}</span>
                      <div style={{display:"flex",alignItems:"baseline",gap:5,fontFamily:"'DM Mono',monospace",fontSize:12}}>
                        <span style={{color:C.muted}}>{pv}</span>
                        {rv&&<><span style={{color:C.stoneDeep,fontSize:10}}>/</span>
                        <span style={{color:C.forest,fontWeight:500}}>{rv}</span></>}
                        {d!==null&&d!==0&&<span style={{fontSize:10,color:d<0?C.red:C.green}}>{d>0?"+":""}{d}</span>}
                      </div>
                    </div>
                  ):null)}
                </div>
                <span style={{fontSize:11,color:C.stoneDeep}}>{isOpen?"▲":"▼"}</span>
              </div>

              {/* Tableau séances */}
              {isOpen&&(
                <>
                  {/* En-têtes colonnes */}
                  <div style={{display:"grid",gridTemplateColumns:GRID,
                    padding:"4px 16px",gap:0,overflowX:"auto",minWidth:900}}>
                    {/* Groupe info */}
                    <div style={{gridColumn:"1/6",fontSize:9,fontWeight:500,textTransform:"uppercase",letterSpacing:".05em",color:C.muted,padding:"4px 0"}}>Date · Activité · Commentaire</div>
                    <div style={{gridColumn:"6/11",fontSize:9,fontWeight:500,color:"#534AB7",textAlign:"center",padding:"4px 0",borderLeft:`1.5px solid #7F77DD44`}}>Zones FC %</div>
                    <div style={{gridColumn:"11/16",fontSize:9,fontWeight:500,color:C.forest,textAlign:"center",padding:"4px 0",borderLeft:`1.5px solid ${C.forest}33`}}>— Prévu —</div>
                    <div style={{gridColumn:"16/21",fontSize:9,fontWeight:500,color:"#BA7517",textAlign:"center",padding:"4px 0",borderLeft:`1.5px solid #BA751744`}}>— Réalisé —</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:GRID,
                    padding:"0 16px",gap:0,borderTop:`0.5px solid ${C.border}`,minWidth:900}}>
                    <div style={{padding:"3px 0",fontSize:9,color:C.muted}}>Statut</div>
                    <div style={{padding:"3px 0",fontSize:9,color:C.muted}}>Date · Créne.</div>
                    <div style={{padding:"3px 0",fontSize:9,color:C.muted}}>Activité prévue</div>
                    <div style={{padding:"3px 0",fontSize:9,color:C.muted}}>Activité réalisée</div>
                    <div style={{padding:"3px 0",fontSize:9,color:C.muted}}>Commentaire</div>
                    {["Z1","Z2","Z3","Z4","Z5"].map((z,i)=><div key={z} style={{padding:"3px 2px",fontSize:9,textAlign:"center",borderLeft:i===0?"1.5px solid #7F77DD44":"none",color:["#378ADD","#639922","#BA7517","#D85A30","#A32D2D"][i]}}>{z}</div>)}
                    {["Durée","Km","D+","Allure","FC"].map(h=><div key={h} style={{padding:"3px 4px",fontSize:9,color:C.forest,textAlign:"right",borderLeft:h==="Durée"?`1.5px solid ${C.forest}33`:"none"}}>{h}</div>)}
                    {["Durée","Km","D+","Allure","FC"].map(h=><div key={h+"r"} style={{padding:"3px 4px",fontSize:9,color:"#BA7517",textAlign:"right",borderLeft:h==="Durée"?"1.5px solid #BA751744":"none"}}>{h}</div>)}
                  </div>

                  {/* Lignes */}
                  {wSlots.map(({dateStr,slot,dayName,half,seance,defaultType})=>{
                    if(!seance&&!defaultType) return null;
                    const s=seance;
                    const st=s?.statut||"Planifié";
                    const isDone=st==="Effectué"||st==="Partiel"||st==="Remplacé";
                    const actPrev=s?.activite||defaultType;
                    const actReal=s?.statut==="Remplacé"&&s?.garminTitre ? (activites.find(a=>a.dateHeure===s?._garminId)?.type||actPrev) : (isDone?actPrev:null);
                    return (
                      <div key={dateStr+slot} onClick={()=>s&&openEdit(s)}
                        style={{display:"grid",gridTemplateColumns:GRID,
                          padding:"0 16px",gap:0,
                          borderTop:raceDates.has(dateStr)?`1.5px solid ${C.summit}44`:`0.5px solid ${C.border}`,
                          cursor:s?"pointer":"default",
                          background:raceDates.has(dateStr)?"#FFF3E022":isDone?rowBg(st):"transparent",
                          opacity:st==="Annulé"?0.45:1,minWidth:900}}>
                        {/* Statut */}
                        <div style={{padding:"8px 4px 8px 0",display:"flex",alignItems:"center"}}>
                          {s?<StatusBadge statut={st}/>:<span style={{fontSize:10,color:C.stoneDeep}}>○ Planifié</span>}
                        </div>
                        {/* Date + Créneau */}
                        <div style={{padding:"8px 4px",display:"flex",flexDirection:"column",gap:1}}>
                          <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:500,color:raceDates.has(dateStr)?C.summit:s?.date===today?C.forest:C.inkLight}}>{fmtDate(dateStr)}{raceDates.has(dateStr)&&<span style={{marginLeft:4}}>🏔</span>}</span>
                          <span style={{fontSize:10,color:C.muted}}>{half}</span>
                        </div>
                        {/* Activité prévue */}
                        <div style={{padding:"8px 4px",display:"flex",alignItems:"center"}}><ActCell type={actPrev}/></div>
                        {/* Activité réalisée */}
                        <div style={{padding:"8px 4px",display:"flex",alignItems:"center"}}>
                          {actReal?<ActCell type={actReal} muted/>:<span style={{fontSize:11,color:C.stoneDeep}}>—</span>}
                        </div>
                        {/* Commentaire */}
                        <div style={{padding:"8px 4px",display:"flex",alignItems:"center",overflow:"hidden"}}>
                          <span style={{fontSize:11,color:C.muted,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s?.commentaire||""}</span>
                        </div>
                        {/* Zones FC — après commentaire */}
                        {["z1","z2","z3","z4","z5"].map((z,i)=>(
                          <div key={z} style={{padding:"8px 2px",display:"flex",alignItems:"center",justifyContent:"center",borderLeft:i===0?"1.5px solid #7F77DD44":"none"}}>
                            {isDone&&s?.[z]?<span style={{fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:500,color:["#378ADD","#639922","#BA7517","#D85A30","#A32D2D"][i]}}>{s[z]}</span>:<span style={{fontSize:10,color:C.stoneDeep}}>—</span>}
                          </div>
                        ))}
                        {/* Prévu */}
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end",borderLeft:`1.5px solid ${C.forest}22`}}>
                          <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:C.stoneDeep}}>{s?.dureeObj||"—"}</span>
                        </div>
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          <span style={{fontSize:12,fontFamily:"'DM Mono',monospace",color:C.stoneDeep}}>{s?.kmObj?`${s.kmObj}km`:"—"}</span>
                        </div>
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:C.stoneDeep}}>{s?.dpObj?`${s.dpObj}m`:"—"}</span>
                        </div>
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          {(()=>{const a=calcAllure(s?.dureeObj,s?.kmObj);return <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:a?C.sky:C.stoneDeep}}>{a?`${a}/km`:"—"}</span>;})()}
                        </div>
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:C.stoneDeep}}>{s?.fcObj||"—"}</span>
                        </div>
                        {/* Réalisé */}
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end",borderLeft:"1.5px solid #BA751744"}}>
                          {isDone?<DiffSpan real={s?.dureeGarmin} plan={s?.dureeObj} isDuration={true}/>:<span style={{fontSize:11,color:C.stoneDeep}}>—</span>}
                        </div>
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          {isDone?<DiffSpan real={s?.kmGarmin} plan={s?.kmObj} unit="km"/>:<span style={{fontSize:11,color:C.stoneDeep}}>—</span>}
                        </div>
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          {isDone?<DiffSpan real={s?.dpGarmin} plan={s?.dpObj} unit="m"/>:<span style={{fontSize:11,color:C.stoneDeep}}>—</span>}
                        </div>
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          {isDone&&(()=>{const a=calcAllure(s?.dureeGarmin,s?.kmGarmin);const ap=calcAllure(s?.dureeObj,s?.kmObj);if(!a) return <span style={{fontSize:11,color:C.stoneDeep}}>—</span>;const col=!ap?C.summit:a<ap?C.green:a>ap?C.red:C.muted;return <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:col,fontWeight:500}}>{a}/km</span>;})()}
                          {!isDone&&<span style={{fontSize:11,color:C.stoneDeep}}>—</span>}
                        </div>
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          {isDone?<span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:C.forest}}>{s?.fcMoy||"—"}</span>:<span style={{fontSize:11,color:C.stoneDeep}}>—</span>}
                        </div>
                      </div>
                    );
                  })}

                  {/* Légende icônes */}
                  <div style={{display:"flex",gap:12,flexWrap:"wrap",padding:"6px 16px",
                    background:C.stone,borderTop:`0.5px solid ${C.border}`,
                    fontSize:10,color:C.stoneDeep}}>
                    {ACTIVITY_TYPES.filter(t=>t!=="Repos").map(t=>(
                      <span key={t}><span style={{color:actColor(t)}}>{actIcon(t)}</span> {t}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal édition */}
      <Modal open={editModal} onClose={()=>setEditModal(false)} title="Modifier la séance" width={560}>
        {editForm&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Date"><input type="date" value={editForm.date||""} onChange={e=>updE("date",e.target.value)} style={{width:"100%"}}/></Field>
              <Field label="Créneau">
                <select value={editForm.demiJournee||""} onChange={e=>updE("demiJournee",e.target.value)} style={{width:"100%"}}>
                  {DAY_NAMES.flatMap(d=>["AM","PM"].map(h=>`${d} ${h}`)).map(s=><option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Activité prévue" full>
                <select value={editForm.activite||""} onChange={e=>updE("activite",e.target.value)} style={{width:"100%"}}>
                  {ACTIVITY_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Commentaire / Intensité" full>
                <input value={editForm.commentaire||""} onChange={e=>updE("commentaire",e.target.value)} placeholder="EF, Seuil, Tempo, Long run Z2..." style={{width:"100%"}}/>
              </Field>
              <Field label="Statut" full>
                <select value={editForm.statut||"Planifié"} onChange={e=>updE("statut",e.target.value)} style={{width:"100%"}}>
                  {STATUTS.map(s=><option key={s.id}>{s.id}</option>)}
                </select>
              </Field>
            </div>
            <div style={{marginTop:14,padding:"12px 16px",background:C.stone,borderRadius:10}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Objectifs</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                {[{k:"dureeObj",l:"Durée"},{k:"kmObj",l:"Km"},{k:"dpObj",l:"D+ (m)"},{k:"fcObj",l:"FC (bpm)"}].map(({k,l})=>(
                  <div key={k}>
                    <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{l}</div>
                    <input value={editForm[k]||""} onChange={e=>updE(k,e.target.value)} placeholder="—"
                      style={{width:"100%",fontSize:12,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,textAlign:"right",fontFamily:"'DM Mono',monospace"}}/>
                  </div>
                ))}
              </div>
            </div>
            {(editForm.statut==="Effectué"||editForm.statut==="Partiel")&&(editForm.kmGarmin||editForm.dpGarmin||editForm.z1)&&(
              <div style={{marginTop:10,padding:"10px 16px",background:C.forestPale,borderRadius:10}}>
                <div style={{fontSize:10,fontWeight:600,color:C.forest,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Réel Garmin</div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:12,fontFamily:"'DM Mono',monospace",marginBottom:editForm.z1?8:0}}>
                  {editForm.kmGarmin&&<span><span style={{color:C.muted}}>Km: </span><span style={{color:C.forest,fontWeight:500}}>{editForm.kmGarmin}</span></span>}
                  {editForm.dpGarmin&&<span><span style={{color:C.muted}}>D+: </span><span style={{color:C.forest,fontWeight:500}}>{editForm.dpGarmin}m</span></span>}
                  {editForm.dureeGarmin&&<span><span style={{color:C.muted}}>Durée: </span>{editForm.dureeGarmin}</span>}
                  {editForm.fcMoy&&<span><span style={{color:C.muted}}>FC: </span>{editForm.fcMoy}bpm</span>}
                </div>
                {(editForm.z1||editForm.z2||editForm.z3||editForm.z4||editForm.z5)&&(
                  <div style={{display:"flex",gap:10}}>
                    {["z1","z2","z3","z4","z5"].map((z,i)=>editForm[z]?(
                      <div key={z} style={{textAlign:"center",background:C.white,borderRadius:6,padding:"4px 8px",minWidth:40}}>
                        <div style={{fontSize:9,color:["#378ADD","#639922","#BA7517","#D85A30","#A32D2D"][i],fontWeight:600}}>Z{i+1}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,color:["#378ADD","#639922","#BA7517","#D85A30","#A32D2D"][i]}}>{editForm[z]}%</div>
                      </div>
                    ):null)}
                  </div>
                )}
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:20}}>
              <Btn variant="danger" size="sm" onClick={()=>setConfirmId(editForm.id)}>Supprimer</Btn>
              <div style={{display:"flex",gap:10}}>
                <Btn variant="ghost" onClick={()=>setEditModal(false)}>Annuler</Btn>
                <Btn onClick={saveEdit}>Enregistrer</Btn>
              </div>
            </div>
          </>
        )}
      </Modal>
      <ConfirmDialog open={!!confirmId} message="Supprimer cette séance ?"
        onConfirm={()=>delSeance(confirmId)} onCancel={()=>setConfirmId(null)}/>
    </div>
  );
}

// ─── PROGRAMME VIEW ──────────────────────────────────────────────────────────
function ProgrammeView({ seances, setSeances, objectifs, activityTypes }) {
  const today = localDate(new Date());
  const [viewMode,    setViewMode]    = useState("blocs");    // "liste" | "blocs"
  const [filterMonth, setFilterMonth] = useState("");         // "YYYY-MM" ou ""
  const [editModal,   setEditModal]   = useState(false);
  const [editForm,    setEditForm]    = useState(null);
  const [confirmId,   setConfirmId]   = useState(null);
  const [importMsg,   setImportMsg]   = useState("");
  const [importRef]   = useState(()=>({current:null}));
  const fileRef = useRef();

  // Séances planifiées (inclut Planifié + Effectué pour voir prévu/réel)
  const planned = useMemo(()=>
    [...seances]
      .filter(s=>s.activite&&s.activite!=="Repos"&&(s.statut==="Planifié"||s.statut==="Annulé"||(s.statut==="Effectué"&&(s.kmObj||s.dpObj||s.dureeObj))))
      .sort((a,b)=>a.date!==b.date?a.date.localeCompare(b.date):a.demiJournee.localeCompare(b.demiJournee))
  ,[seances]);

  // Mois disponibles
  const months = useMemo(()=>[...new Set(planned.map(s=>s.date.slice(0,7)))].sort(),[planned]);

  const filtered = useMemo(()=>filterMonth ? planned.filter(s=>s.date.startsWith(filterMonth)) : planned,[planned,filterMonth]);

  // Grouper par semaine (clé = lundi)
  const byWeek = useMemo(()=>{
    const map = new Map();
    filtered.forEach(s=>{
      const d=new Date(s.date); const dow=(d.getDay()+6)%7;
      const mon=new Date(d); mon.setDate(d.getDate()-dow);
      const wkey=localDate(mon);
      if(!map.has(wkey)) map.set(wkey,[]);
      map.get(wkey).push(s);
    });
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  },[filtered]);

  // Stats semaine
  const weekStats = (seances) => {
    const plan = seances.filter(s=>isRunning(s.activite));
    const eff  = plan.filter(s=>s.statut==="Effectué");
    return {
      kmPlan:  Math.round(plan.reduce((s,a)=>s+(parseFloat(a.kmObj)||0),0)*10)/10,
      dpPlan:  Math.round(plan.reduce((s,a)=>s+(parseFloat(a.dpObj)||0),0)),
      kmEff:   Math.round(eff.reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0)*10)/10,
      dpEff:   Math.round(eff.reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0)),
      n:       plan.length,
      nEff:    eff.length,
    };
  };

  // Import JSON programme
  const handleImport = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader();
    r.onload=(ev)=>{
      try {
        const data=JSON.parse(ev.target.result);
        if(!data._stride_programme&&!data.seances){alert("Format non reconnu. Attendu : _stride_programme + seances[]");return;}
        const toImport=(data.seances||[]).map(s=>({...emptySeance(),...s,id:Date.now()+Math.random()}));
        // Merge : ne pas écraser les séances déjà Effectuées
        const existingKeys=new Set(seances.map(s=>s.date+"|"+s.demiJournee));
        const news=toImport.filter(s=>!existingKeys.has(s.date+"|"+s.demiJournee));
        const updates=toImport.filter(s=>existingKeys.has(s.date+"|"+s.demiJournee));
        setSeances(ss=>{
          const merged=ss.map(s=>{
            const m=updates.find(u=>u.date===s.date&&u.demiJournee===s.demiJournee);
            if(!m) return s;
            // Ne pas écraser si déjà Effectué
            if(s.statut==="Effectué") return {...s,commentaire:s.commentaire||m.commentaire,kmObj:s.kmObj||m.kmObj,dpObj:s.dpObj||m.dpObj,dureeObj:s.dureeObj||m.dureeObj,fcObj:s.fcObj||m.fcObj};
            return {...s,...m,id:s.id};
          });
          return [...merged,...news];
        });
        setImportMsg(`✓ ${news.length} séance(s) ajoutée(s) · ${updates.length} mise(s) à jour`);
        setTimeout(()=>setImportMsg(""),5000);
      } catch { alert("Erreur JSON"); }
    };
    r.readAsText(file,"utf-8"); e.target.value="";
  };

  // Édition séance
  const openEdit = (s) => { setEditForm({...s}); setEditModal(true); };
  const saveEdit = () => {
    setSeances(ss=>ss.map(s=>s.id===editForm.id?{...editForm}:s));
    setEditModal(false);
  };
  const delSeance = (id) => { setSeances(ss=>ss.filter(s=>s.id!==id)); setConfirmId(null); };
  const updE = (k,v) => setEditForm(f=>({...f,[k]:v}));

  // Styles
  const card = {background:C.white,border:`1px solid ${C.border}`,borderRadius:12};
  const lbl  = {fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted};

  const statusBadge = (st) => {
    const cfg={Planifié:{bg:C.stone,col:C.stoneDeep},Effectué:{bg:C.forestPale,col:C.forest},Annulé:{bg:C.redPale,col:C.red}};
    const {bg,col}=cfg[st]||cfg.Planifié;
    return <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:8,background:bg,color:col}}>{st}</span>;
  };

  const diffCell = (real, plan) => {
    const r=parseFloat(real)||0; const p=parseFloat(plan)||0;
    if(!r||!p) return null;
    const d=Math.round((r-p)*10)/10;
    if(d===0) return null;
    return <span style={{fontSize:10,color:d>0?C.red:C.green,marginLeft:4}}>{d>0?"+":""}{d}</span>;
  };

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Programme</h1>
          <p style={{fontSize:12,color:C.muted}}>Plan d'entraînement · Prévu vs Réel · Import Coach Claude</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {importMsg&&<span style={{fontSize:11,color:C.green,fontWeight:500}}>{importMsg}</span>}
          <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={handleImport}/>
          <Btn variant="sage" size="sm" onClick={()=>fileRef.current?.click()}>⬆ Importer programme JSON</Btn>
          {/* Switch vue */}
          <div style={{display:"flex",border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
            {[{id:"blocs",label:"Blocs"},{id:"liste",label:"Liste"}].map(({id,label})=>(
              <button key={id} onClick={()=>setViewMode(id)}
                style={{padding:"6px 14px",background:viewMode===id?C.forest:"transparent",
                  color:viewMode===id?C.white:C.muted,border:"none",cursor:"pointer",
                  fontSize:12,fontWeight:viewMode===id?500:400,fontFamily:"inherit"}}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filtre mois */}
      {months.length>0&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          <button onClick={()=>setFilterMonth("")}
            style={{padding:"4px 12px",borderRadius:20,fontSize:11,border:`1px solid ${C.border}`,
              cursor:"pointer",background:!filterMonth?C.forest:"transparent",
              color:!filterMonth?C.white:C.muted,fontFamily:"inherit"}}>
            Tout
          </button>
          {months.map(m=>(
            <button key={m} onClick={()=>setFilterMonth(m===filterMonth?"":m)}
              style={{padding:"4px 12px",borderRadius:20,fontSize:11,border:`1px solid ${filterMonth===m?C.forest:C.border}`,
                cursor:"pointer",background:filterMonth===m?C.forest:"transparent",
                color:filterMonth===m?C.white:C.muted,fontFamily:"inherit"}}>
              {new Date(m+"-15").toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}
            </button>
          ))}
        </div>
      )}

      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:"80px 20px",color:C.muted}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Aucun programme chargé</div>
          <div style={{fontSize:13,marginBottom:20}}>Importe un JSON généré par ton Coach Claude</div>
          <Btn variant="sage" onClick={()=>fileRef.current?.click()}>⬆ Importer programme JSON</Btn>
        </div>
      )}

      {/* ── VUE BLOCS ── */}
      {viewMode==="blocs"&&filtered.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {byWeek.map(([wkey,wSeances])=>{
            const st=weekStats(wSeances);
            const wEnd=new Date(wkey); wEnd.setDate(wEnd.getDate()+6);
            const isCurrent=wkey<=today&&localDate(wEnd)>=today;
            return (
              <div key={wkey} style={{...card,overflow:"hidden",
                border:isCurrent?`1.5px solid ${C.forest}44`:`1px solid ${C.border}`}}>
                {/* Header semaine */}
                <div style={{background:isCurrent?C.forestPale:C.stone,padding:"10px 18px",
                  display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,
                    color:isCurrent?C.forest:C.inkLight}}>
                    Sem. du {fmtDate(wkey)} au {fmtDate(localDate(wEnd))}
                    {isCurrent&&<span style={{marginLeft:8,fontSize:10,background:C.forest,color:C.white,padding:"1px 7px",borderRadius:10}}>En cours</span>}
                  </span>
                  <div style={{flex:1}}/>
                  <div style={{display:"flex",gap:16,fontSize:12}}>
                    <span style={{color:C.muted}}>{st.n} séances</span>
                    {st.kmPlan>0&&(
                      <span style={{fontFamily:"'DM Mono',monospace"}}>
                        <span style={{color:C.muted}}>Prévu: </span>
                        <span style={{color:C.forest,fontWeight:500}}>{st.kmPlan}km</span>
                        {st.dpPlan>0&&<span style={{color:C.muted}}> · {st.dpPlan}m↑</span>}
                      </span>
                    )}
                    {st.kmEff>0&&(
                      <span style={{fontFamily:"'DM Mono',monospace"}}>
                        <span style={{color:C.muted}}>Réel: </span>
                        <span style={{color:C.forest,fontWeight:500}}>{st.kmEff}km</span>
                        {st.dpEff>0&&<span style={{color:C.muted}}> · {st.dpEff}m↑</span>}
                        <span style={{fontSize:10,color:st.nEff===st.n?C.green:C.muted,marginLeft:6}}>{st.nEff}/{st.n}</span>
                      </span>
                    )}
                  </div>
                </div>
                {/* Séances */}
                {wSeances.map(s=>{
                  const isPast=s.date<today;
                  const isDone=s.statut==="Effectué";
                  return (
                    <div key={s.id}
                      onClick={()=>openEdit(s)}
                      style={{display:"grid",
                        gridTemplateColumns:"100px 38px 160px 1fr 80px 80px 70px 60px 100px",
                        padding:"9px 18px",borderTop:`1px solid ${C.border}`,gap:8,
                        alignItems:"center",cursor:"pointer",
                        background:isDone?C.stone:"transparent",
                        opacity:s.statut==="Annulé"?0.5:1}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,
                        color:s.date===today?C.forest:isPast?C.muted:C.inkLight,fontWeight:s.date===today?600:400}}>
                        {fmtDate(s.date)}
                      </span>
                      <span style={{fontSize:10,color:C.muted}}>{s.demiJournee.split(" ")[1]}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:7,height:7,borderRadius:2,background:actColor(s.activite),flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:500,color:C.inkLight,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.activite}</span>
                      </div>
                      <span style={{fontSize:11,color:C.muted,fontStyle:"italic",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {s.commentaire||""}
                      </span>
                      {/* Prévu */}
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,textAlign:"right",color:C.stoneDeep}}>
                        {s.dureeObj||"—"}
                      </span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,textAlign:"right"}}>
                        {s.kmObj?<span style={{color:C.forest,fontWeight:500}}>{s.kmObj}<span style={{color:C.muted,fontWeight:400}}>km</span></span>:"—"}
                        {isDone&&diffCell(s.kmGarmin,s.kmObj)}
                      </span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,textAlign:"right",color:C.muted}}>
                        {s.dpObj?`${s.dpObj}m`:"—"}
                        {isDone&&diffCell(s.dpGarmin,s.dpObj)}
                      </span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,textAlign:"right",color:C.muted}}>
                        {s.fcObj?`${s.fcObj}bpm`:"—"}
                      </span>
                      <div style={{display:"flex",justifyContent:"flex-end"}}>
                        {statusBadge(s.statut)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── VUE LISTE ── */}
      {viewMode==="liste"&&filtered.length>0&&(
        <div style={{...card,overflow:"hidden"}}>
          <div style={{display:"grid",
            gridTemplateColumns:"100px 50px 160px 1fr 80px 90px 70px 60px 100px 32px",
            padding:"8px 16px",background:C.stone,gap:8,
            fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>
            <span>Date</span><span>Créne.</span><span>Activité</span><span>Commentaire</span>
            <span style={{textAlign:"right"}}>Durée</span>
            <span style={{textAlign:"right"}}>Km prévu / réel</span>
            <span style={{textAlign:"right"}}>D+ prévu / réel</span>
            <span style={{textAlign:"right"}}>FC obj.</span>
            <span>Statut</span><span/>
          </div>
          <div style={{maxHeight:600,overflowY:"auto"}}>
            {filtered.map(s=>{
              const isDone=s.statut==="Effectué";
              const isPast=s.date<today;
              return (
                <div key={s.id} onClick={()=>openEdit(s)}
                  style={{display:"grid",
                    gridTemplateColumns:"100px 50px 160px 1fr 80px 90px 70px 60px 100px 32px",
                    padding:"9px 16px",borderTop:`1px solid ${C.border}`,gap:8,alignItems:"center",
                    cursor:"pointer",background:isDone?C.stone:"transparent",
                    opacity:s.statut==="Annulé"?0.5:1}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,
                    color:s.date===today?C.forest:isPast?C.muted:C.inkLight}}>
                    {fmtDate(s.date)}
                  </span>
                  <span style={{fontSize:10,color:C.muted}}>{s.demiJournee}</span>
                  <div style={{display:"flex",alignItems:"center",gap:5,overflow:"hidden"}}>
                    <div style={{width:7,height:7,borderRadius:2,background:actColor(s.activite),flexShrink:0}}/>
                    <span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.activite}</span>
                  </div>
                  <span style={{fontSize:11,color:C.muted,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.commentaire||"—"}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,textAlign:"right",color:C.stoneDeep}}>{s.dureeObj||"—"}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,textAlign:"right"}}>
                    <span style={{color:C.inkLight}}>{s.kmObj||"—"}</span>
                    {isDone&&s.kmGarmin&&<><span style={{color:C.muted}}> / </span><span style={{color:C.forest,fontWeight:500}}>{s.kmGarmin}</span>{diffCell(s.kmGarmin,s.kmObj)}</>}
                  </span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,textAlign:"right"}}>
                    <span style={{color:C.muted}}>{s.dpObj||"—"}</span>
                    {isDone&&s.dpGarmin&&<><span style={{color:C.muted}}> / </span><span style={{color:C.forest}}>{s.dpGarmin}</span>{diffCell(s.dpGarmin,s.dpObj)}</>}
                  </span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,textAlign:"right",color:C.muted}}>{s.fcObj||"—"}</span>
                  <div>{statusBadge(s.statut)}</div>
                  <button onClick={e=>{e.stopPropagation();setConfirmId(s.id);}}
                    style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL ÉDITION ── */}
      <Modal open={editModal} onClose={()=>setEditModal(false)} title="Modifier la séance" width={520}>
        {editForm&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Date"><input type="date" value={editForm.date||""} onChange={e=>updE("date",e.target.value)} style={{width:"100%"}}/></Field>
              <Field label="Créneau">
                <select value={editForm.demiJournee||""} onChange={e=>updE("demiJournee",e.target.value)} style={{width:"100%"}}>
                  {DAY_NAMES.flatMap(d=>["AM","PM"].map(h=>`${d} ${h}`)).map(s=><option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Activité" full>
                <select value={editForm.activite||""} onChange={e=>updE("activite",e.target.value)} style={{width:"100%"}}>
                  {ACTIVITY_TYPES.filter(t=>t).map(t=><option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Commentaire / Intensité" full>
                <input value={editForm.commentaire||""} onChange={e=>updE("commentaire",e.target.value)}
                  placeholder="EF, Seuil, Tempo, Fractionné..." style={{width:"100%"}}/>
              </Field>
              <Field label="Statut">
                <select value={editForm.statut||"Planifié"} onChange={e=>updE("statut",e.target.value)} style={{width:"100%"}}>
                  {["Planifié","Effectué","Annulé"].map(s=><option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div style={{marginTop:16,padding:"12px 16px",background:C.stone,borderRadius:10}}>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Objectifs</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                {[{k:"dureeObj",l:"Durée"},{k:"kmObj",l:"Km"},{k:"dpObj",l:"D+ (m)"},{k:"fcObj",l:"FC (bpm)"}].map(({k,l})=>(
                  <div key={k}>
                    <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{l}</div>
                    <input value={editForm[k]||""} onChange={e=>updE(k,e.target.value)}
                      placeholder="—"
                      style={{width:"100%",fontSize:12,padding:"5px 8px",borderRadius:6,
                        border:`1px solid ${C.border}`,textAlign:"right",fontFamily:"'DM Mono',monospace"}}/>
                  </div>
                ))}
              </div>
            </div>
            {editForm.statut==="Effectué"&&(editForm.kmGarmin||editForm.dpGarmin)&&(
              <div style={{marginTop:10,padding:"10px 16px",background:C.forestPale,borderRadius:10}}>
                <div style={{fontSize:11,fontWeight:600,color:C.forest,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Réel (Garmin)</div>
                <div style={{display:"flex",gap:16,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                  {editForm.kmGarmin&&<span><span style={{color:C.muted}}>Km: </span><span style={{color:C.forest,fontWeight:500}}>{editForm.kmGarmin}</span>{diffCell(editForm.kmGarmin,editForm.kmObj)}</span>}
                  {editForm.dpGarmin&&<span><span style={{color:C.muted}}>D+: </span><span style={{color:C.forest,fontWeight:500}}>{editForm.dpGarmin}m</span>{diffCell(editForm.dpGarmin,editForm.dpObj)}</span>}
                  {editForm.dureeGarmin&&<span><span style={{color:C.muted}}>Durée: </span><span>{editForm.dureeGarmin}</span></span>}
                  {editForm.fcMoy&&<span><span style={{color:C.muted}}>FC: </span><span>{editForm.fcMoy}bpm</span></span>}
                </div>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:20}}>
              <Btn variant="danger" size="sm" onClick={()=>{setConfirmId(editForm.id);setEditModal(false);}}>Supprimer</Btn>
              <div style={{display:"flex",gap:10}}>
                <Btn variant="ghost" onClick={()=>setEditModal(false)}>Annuler</Btn>
                <Btn onClick={saveEdit}>Enregistrer</Btn>
              </div>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmId}
        message="Supprimer cette séance du programme ?"
        onConfirm={()=>delSeance(confirmId)}
        onCancel={()=>setConfirmId(null)}/>
    </div>
  );
}

// ─── PROGRAMME (Timeline) ────────────────────────────────────────────────────
const AVEC_ZONES_FC = ["Trail","Course à pied","Marche à pied","Vélo"];
const SANS_ZONES_FC = ["Musculation","Mobilité / Gainage","Hyrox","Repos"];
const DEFAULT_ACTIVITY_TYPES = ACTIVITY_TYPES;

function Programme({ seances, setSeances, objectifs, planningType, activites, setActivites, setView, activityTypes }) {
  const [activeYear,      setActiveYear]      = useState(new Date().getFullYear());
  const [openWeek, setOpenWeek] = useState(()=>{
    const d=new Date(); const dow=(d.getDay()+6)%7;
    const mon=new Date(d); mon.setDate(d.getDate()-dow);
    return localDate(mon);
  });
  const [expandedMonths,  setExpandedMonths]  = useState(() => ({ [new Date().toISOString().slice(0,7)]: true }));
  const [confirmId,       setConfirmId]       = useState(null);
  const [importMsg,       setImportMsg]       = useState("");
  const [resetConfirm,    setResetConfirm]    = useState(false);
  const garminRef = useRef();
  const today   = localDate(new Date());
  const nowMkey = today.slice(0,7);

  const toggleMonth = (mkey) => setExpandedMonths(e => ({...e,[mkey]:!e[mkey]}));
  const markDone    = (id)   => setSeances(ss=>ss.map(s=>s.id===id?{...s,statut:"Effectué"}:s));
  // Lier une activité Garmin à une séance
  const linkActivite = (seanceId, id) => {
    const act = activites.find(a=>a.dateHeure===id);
    if (!act) return false;
    updateField(seanceId,"_garminId",id);
    updateField(seanceId,"garminTitre",act.titre||"");
    updateField(seanceId,"dureeGarmin",act.duree||"");
    updateField(seanceId,"kmGarmin",act.distance||"");
    updateField(seanceId,"dpGarmin",act.dp||"");
    updateField(seanceId,"fcMoy",act.fcMoy||"");
    updateField(seanceId,"fcMax",act.fcMax||"");
    updateField(seanceId,"cal",act.calories||"");
    updateField(seanceId,"z1",act.z1||"");
    updateField(seanceId,"z2",act.z2||"");
    updateField(seanceId,"z3",act.z3||"");
    updateField(seanceId,"z4",act.z4||"");
    updateField(seanceId,"z5",act.z5||"");
    updateField(seanceId,"statut","Effectué");
    return true;
  };

  // Coller depuis le presse-papiers
  const pasteAndLink = async (seanceId) => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!linkActivite(seanceId, text)) {
        // ID non trouvé — stocker quand même
        updateField(seanceId,"_garminId",text);
      }
    } catch(e) {
      console.warn("Clipboard read failed:", e);
    }
  };


  const updateField = (id,field,val) => setSeances(ss=>ss.map(s=>s.id===id?{...s,[field]:val}:s));
  const deleteSeance = (id) => setSeances(ss=>ss.filter(s=>s.id!==id));


  // Import Garmin
  const handleGarminImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const imported = parseCSVActivities(ev.target.result);
      const existingDH = new Set(activites.map(a=>a.dateHeure).filter(Boolean));
      const news = imported.filter(a=>!existingDH.has(a.dateHeure));
      let matched=0, created=0;
      const updates = {};
      news.forEach(act => {
        if (!act.dateHeure||act.dateHeure.length<16) return;
        const date = act.dateHeure.slice(0,10);
        const hour = parseInt(act.dateHeure.slice(11,13));
        const half = hour<13?"AM":"PM";
        const d = new Date(date); const dow=(d.getDay()+6)%7;
        const slot = `${DAY_NAMES[dow]} ${half}`;
        const match = seances.find(s=>s.date===date&&s.demiJournee===slot&&s.statut==="Planifié");
        if (match) {
          updates[match.id] = {...match,statut:"Effectué",
            garminTitre:act.titre||match.garminTitre, dureeGarmin:act.duree||match.dureeGarmin,
            kmGarmin:act.distance||match.kmGarmin, dpGarmin:act.dp||match.dpGarmin,
            allure:act.allure||match.allure, fcMoy:act.fcMoy||match.fcMoy,
            fcMax:act.fcMax||match.fcMax, cal:act.calories||match.cal,
            z1:act.z1||match.z1, z2:act.z2||match.z2, z3:act.z3||match.z3,
            z4:act.z4||match.z4, z5:act.z5||match.z5 };
          matched++;
        } else {
          updates["_n"+act.id] = {...emptySeance(),id:Date.now()+Math.random(),date,
            demiJournee:slot, activite:act.type||"Trailrunning", statut:"Effectué",
            commentaire:"⚡ Non planifié", garminTitre:act.titre||"",
            dureeGarmin:act.duree||"", kmGarmin:act.distance||"", dpGarmin:act.dp||"",
            allure:act.allure||"", fcMoy:act.fcMoy||"", fcMax:act.fcMax||"",
            cal:act.calories||"", _nonPlanifie:true,
            z1:act.z1||"", z2:act.z2||"", z3:act.z3||"", z4:act.z4||"", z5:act.z5||"" };
          created++;
        }
      });
      setSeances(ss => {
        const upd = ss.map(s=>updates[s.id]||s);
        const toAdd = Object.entries(updates).filter(([k])=>k.startsWith("_n")).map(([,v])=>v);
        return [...upd,...toAdd];
      });
      setActivites(as=>[...as,...news]);
      const skip = imported.length-news.length;
      setImportMsg(`✓ ${news.length} activité(s) · ${matched} associée(s) · ${created} créée(s) · ${skip} doublon(s)`);
      setTimeout(()=>setImportMsg(""),6000);
    };
    reader.readAsText(file); e.target.value="";
  };

  // Build years
  const years = useMemo(() => {
    const s = new Set(seances.map(a=>a.date?.slice(0,4)).filter(Boolean));
    s.add(String(new Date().getFullYear()));
    objectifs.forEach(o=>{ if(o.date) s.add(o.date.slice(0,4)); });
    return [...s].sort().reverse();
  }, [seances,objectifs]);

  // Build week data
  const weekData = useMemo(() => {
    const byDate = {};
    seances.filter(s=>s.date?.startsWith(String(activeYear))).forEach(s=>{
      if (!byDate[s.date]) byDate[s.date]=[];
      byDate[s.date].push(s);
    });
    const objByDate = {};
    objectifs.filter(o=>o.date?.startsWith(String(activeYear))).forEach(o=>{
      if (!objByDate[o.date]) objByDate[o.date]=[];
      objByDate[o.date].push(o);
    });
    const jan1=new Date(activeYear,0,1); const dec31=new Date(activeYear,11,31);
    const firstMon=new Date(jan1); const dow0=jan1.getDay();
    if (dow0!==1) firstMon.setDate(jan1.getDate()+(dow0===0?1:8-dow0));
    const weeks=[]; let cur=new Date(firstMon);
    while (cur<=dec31) {
      const wkey=localDate(cur);
      const thu=new Date(cur); thu.setDate(cur.getDate()+3);
      const mkey=`${thu.getFullYear()}-${String(thu.getMonth()+1).padStart(2,"0")}`;
      if (!mkey.startsWith(String(activeYear))){ cur.setDate(cur.getDate()+7); continue; }
      const slots=[];
      for (let di=0;di<7;di++) {
        const day=new Date(cur); day.setDate(cur.getDate()+di);
        const dateStr=localDate(day); const dayName=DAY_NAMES[di];
        for (const half of ["AM","PM"]) {
          const slot=`${dayName} ${half}`;
          const seance=(byDate[dateStr]||[]).find(s=>s.demiJournee===slot)||null;
          const defaultType=(planningType||DEFAULT_PLANNING)[slot]||"";
          const dayObjs=half==="AM"?(objByDate[dateStr]||[]):[];
          slots.push({dateStr,slot,dayName,half,seance,defaultType,dayObjs});
        }
      }
      const seancesInWeek=slots.map(sl=>sl.seance).filter(Boolean);
      const effSeances=seancesInWeek.filter(s=>s.statut==="Effectué");
      const effRunning=effSeances.filter(s=>isRunning(s.activite));
      const km=Math.round(effRunning.reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0)*10)/10;
      const dp=Math.round(effRunning.reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0));
      const wEnd=new Date(cur); wEnd.setDate(cur.getDate()+6);
      const wEndStr=localDate(wEnd);
      weeks.push({ wkey, mkey, weekStart:new Date(cur), wEnd, wEndStr,
        isCurrent:wkey<=today&&wEndStr>=today, isPast:wEndStr<today,
        slots, km, dp, effN:effSeances.length,
        totalN:seancesInWeek.filter(s=>s.activite!=="Repos").length,
        hasRace:slots.some(sl=>sl.dayObjs.length>0) });
      cur.setDate(cur.getDate()+7);
    }
    return weeks;
  }, [seances,objectifs,activeYear,planningType,today]);

  const monthGroups = useMemo(() => {
    const g={}; weekData.forEach(w=>{ if(!g[w.mkey])g[w.mkey]=[]; g[w.mkey].push(w); });
    return Object.entries(g).sort((a,b)=>a[0].localeCompare(b[0]));
  }, [weekData]);

  // Dot grid compact
  const DotGrid = ({ slots }) => (
    <div style={{display:"flex",gap:3}}>
      {DAY_NAMES.map((d,di) => {
        const amSlot=slots.find(s=>s.dayName===d&&s.half==="AM");
        const pmSlot=slots.find(s=>s.dayName===d&&s.half==="PM");
        const amAct=amSlot?.seance?.activite||(amSlot?.defaultType)||"";
        const pmAct=pmSlot?.seance?.activite||(pmSlot?.defaultType)||"";
        const amDone=amSlot?.seance?.statut==="Effectué";
        const pmDone=pmSlot?.seance?.statut==="Effectué";
        const hasSun=amSlot?.dayObjs?.length>0||pmSlot?.dayObjs?.length>0;
        return (
          <div key={d} style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
            {hasSun
              ? <div style={{width:6,height:6,borderRadius:"50%",background:C.summit}}/>
              : <div style={{width:6,height:6}}/>}
            <div style={{width:10,height:10,borderRadius:2,background:amAct&&amAct!=="Repos"?actColor(amAct):C.stone,opacity:amDone?1:amAct?0.3:0.1}}/>
            <div style={{width:10,height:10,borderRadius:2,background:pmAct&&pmAct!=="Repos"?actColor(pmAct):C.stone,opacity:pmDone?1:pmAct?0.3:0.1}}/>
          </div>
        );
      })}
    </div>
  );

  const avecZones = (type) => AVEC_ZONES_FC.includes(type);

  return (
    <div className="anim">
      <style>{`
        .wk-row:hover { background: ${C.stone}55 !important; }
        .slot-ln:hover { background: ${C.stone}88 !important; }
        .mth-hdr:hover { background: ${C.stone}44; }
        input[type=number]::-webkit-inner-spin-button { opacity:0.4; }
      `}</style>

      {/* Header */}
      <div style={{padding:"14px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:C.inkLight}}>Journal de bord</h1>
          <p style={{fontSize:11,color:C.muted}}>Timeline annuelle · tout est éditable sur la ligne</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="soft" size="sm" onClick={()=>garminRef.current?.click()}>⬆ Import Garmin</Btn>
          <Btn variant="ghost" size="sm" onClick={()=>setResetConfirm(true)}>↺ Vider</Btn>
        </div>
      </div>
      <input ref={garminRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleGarminImport}/>
      {importMsg && <div style={{margin:"6px 16px",padding:"7px 12px",background:C.greenPale,color:C.green,borderRadius:8,fontSize:12,fontWeight:500}}>{importMsg}</div>}

      {/* Objectifs */}
      {objectifs.length>0 && (
        <div style={{padding:"8px 16px 0",display:"flex",gap:8,flexWrap:"wrap"}}>
          {[...objectifs].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(obj=>{
            const j=daysUntil(obj.date); if(j===null) return null;
            const phase=j>90?"Fondamental":j>42?"Spécifique":j>14?"Affûtage":j>0?"Tapering":"Terminé";
            return (
              <div key={obj.id} style={{display:"flex",alignItems:"center",gap:10,background:j>0?C.summitPale:C.stone,borderRadius:10,padding:"7px 12px",border:`1px solid ${j>0?C.summitLight+"44":C.border}`}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:20,fontWeight:500,color:j>0?C.summit:C.muted,lineHeight:1}}>J{j>=0?`-${j}`:`+${Math.abs(j)}`}</div>
                <div>
                  <div style={{fontSize:12,fontWeight:500,color:j>0?C.inkLight:C.muted}}>{obj.nom}</div>
                  <div style={{fontSize:10,color:j>0?C.summit:C.stoneDeep}}>{phase} · {obj.distance}km · {obj.dp}m D+</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Year tabs */}
      <div style={{padding:"10px 16px 0",display:"flex",gap:2,borderBottom:`1px solid ${C.border}`}}>
        {years.map(y=>(
          <button key={y} onClick={()=>setActiveYear(y)} style={{
            background:"none",border:"none",padding:"5px 12px",cursor:"pointer",
            fontSize:12,fontFamily:"'DM Mono',monospace",
            fontWeight:activeYear===y?500:400,
            color:activeYear===y?C.forest:C.muted,
            borderBottom:activeYear===y?`2px solid ${C.forest}`:"2px solid transparent",marginBottom:-1
          }}>{y}</button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{padding:"0 8px 80px"}}>
        {monthGroups.map(([mkey,weeks]) => {
          const mLabel=`${MOIS_FR[parseInt(mkey.split("-")[1])]} ${mkey.split("-")[0]}`;
          const monthKm=Math.round(weeks.reduce((s,w)=>s+w.km,0)*10)/10;
          const monthEff=weeks.reduce((n,w)=>n+w.effN,0);
          const monthTotal=weeks.reduce((n,w)=>n+w.totalN,0);
          const isMonthOpen=expandedMonths[mkey]===true||(expandedMonths[mkey]===undefined&&mkey===nowMkey);
          const hasRaceMonth=objectifs.some(o=>o.date&&o.date.slice(0,7)===mkey);

          return (
            <div key={mkey} style={{marginBottom:2}}>
              {/* Month header */}
              <div className="mth-hdr" onClick={()=>toggleMonth(mkey)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 8px 6px",cursor:"pointer",borderRadius:8}}>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:15,fontWeight:500,color:mkey===nowMkey?C.forest:C.inkLight}}>{mLabel}</span>
                {mkey===nowMkey&&<span className="badge" style={{background:C.forest,color:"#fff",fontSize:9}}>En cours</span>}
                {hasRaceMonth&&<span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:"#fff3e0",color:"#e65100"}}>● Course</span>}
                <div style={{flex:1}}/>
                {monthKm>0&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted}}>{monthKm} km</span>}
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.stoneDeep}}>{monthEff}/{monthTotal}</span>
                <span style={{color:C.stoneDeep,fontSize:11}}>{isMonthOpen?"▲":"▼"}</span>
              </div>

              {isMonthOpen && weeks.map(w => {
                const isOpen=openWeek===w.wkey;
                const d1=w.weekStart.getDate(); const m1=MOIS_FR[w.weekStart.getMonth()+1];
                const d2=w.wEnd.getDate(); const m2=MOIS_FR[w.wEnd.getMonth()+1];
                const weekLabel=m1===m2?`${d1}–${d2} ${m1}`:`${d1} ${m1} – ${d2} ${m2}`;
                const barW=w.km>0?Math.min(100,Math.round(w.km/60*100)):0;

                return (
                  <div key={w.wkey} style={{marginBottom:2}}>
                    {/* Week row */}
                    <div className="wk-row" onClick={()=>setOpenWeek(isOpen?null:w.wkey)}
                      style={{
                        display:"flex",alignItems:"center",gap:10,padding:"9px 10px",
                        borderRadius:10,cursor:"pointer",
                        background:w.isCurrent?C.forestPale:isOpen?C.stone:"transparent",
                        border:w.isCurrent?`1px solid ${C.forest}44`:"1px solid transparent",
                      }}>
                      <div style={{width:110,flexShrink:0}}>
                        <div style={{fontSize:13,fontFamily:"'DM Mono',monospace",color:w.isCurrent?C.forest:w.isPast?C.muted:C.inkLight,fontWeight:w.isCurrent?500:400}}>{weekLabel}</div>
                        {w.isCurrent&&<div style={{fontSize:10,color:C.forest}}>Cette semaine</div>}
                      </div>
                      <div className="hide-mobile"><DotGrid slots={w.slots}/></div>
                      <div style={{flex:1,display:"flex",alignItems:"center",gap:8,minWidth:0}} className="hide-mobile">
                        {w.km>0&&<>
                          <div style={{flex:1,height:5,background:C.stone,borderRadius:3,overflow:"hidden",maxWidth:120}}>
                            <div style={{width:`${barW}%`,height:"100%",background:w.isPast?C.forest:C.forestLight,borderRadius:3}}/>
                          </div>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.muted,flexShrink:0}}>{w.km} km</span>
                        </>}
                        {w.hasRace&&<span className="badge badge-race" style={{fontSize:10}}>🏔</span>}
                      </div>
                      <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.muted}}>{w.effN}/{w.totalN}</span>
                        <span style={{color:C.stoneDeep,fontSize:12}}>{isOpen?"▲":"▼"}</span>
                      </div>
                    </div>

                    {/* Detail panel */}
                    {isOpen && (
                      <div style={{background:C.white,borderRadius:"0 0 10px 10px",border:`1px solid ${C.border}`,borderTop:"none",marginBottom:4,overflow:"hidden"}} className="anim">
                        {/* Race banners */}
                        {w.slots.filter(sl=>sl.dayObjs.length>0).reduce((acc,sl)=>{
                          sl.dayObjs.forEach(o=>{if(!acc.find(x=>x.id===o.id))acc.push({obj:o,date:sl.dateStr});});return acc;
                        },[]).map(({obj,date})=>(
                          <div key={obj.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",background:C.summitPale,borderBottom:`1px solid ${C.border}`}}>
                            <span style={{fontSize:16}}>🏔</span>
                            <div>
                              <div style={{fontSize:12,fontWeight:500,color:C.summit}}>{obj.nom}</div>
                              <div style={{fontSize:10,color:C.summitLight}}>{fmtDate(date)} · {obj.distance}km · {obj.dp}m D+</div>
                            </div>
                          </div>
                        ))}

                        {/* En-têtes de colonnes */}
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"5px 20px",background:C.stone,borderBottom:`1px solid ${C.border}`,fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                          <div style={{width:42,flexShrink:0}}/>
                          <div style={{width:180,flexShrink:0}}>Activité</div>
                          <div style={{width:80,flexShrink:0}}>Statut</div>
                          <div style={{width:180,flexShrink:0}}>Commentaire</div>
                          <div style={{width:72,flexShrink:0,textAlign:"right"}}>Durée</div>
                          <div style={{width:72,flexShrink:0,textAlign:"right"}}>Km</div>
                          <div style={{width:64,flexShrink:0,textAlign:"right"}}>D+</div>
                          <div style={{width:56,flexShrink:0,textAlign:"right"}}>FC</div>
                          <div style={{flex:1}}/>
                          <div style={{marginLeft:"auto",flexShrink:0,paddingRight:4}}>Actions</div>
                        </div>

                        {/* Day slots */}
                        {DAY_NAMES.map((dayName,di) => {
                          const daySlots=w.slots.filter(s=>s.dayName===dayName);
                          const dateStr=daySlots[0]?.dateStr;
                          const isToday=dateStr===today;
                          return (
                            <div key={dayName} style={{borderBottom:`1px solid ${C.border}`,background:isToday?"#f0f7f2":"transparent"}}>
                              <div style={{padding:"4px 16px",background:isToday?C.forestPale:C.stone+"66",display:"flex",alignItems:"center",gap:10}}>
                                <span style={{fontSize:13,fontWeight:600,color:isToday?C.forest:C.inkLight}}>
                                  {dayName}
                                </span>
                                <span style={{fontFamily:"'DM Mono',monospace",fontWeight:400,fontSize:11,color:isToday?C.forest:C.muted}}>
                                  {dateStr?new Date(dateStr).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"}):""}
                                </span>
                                {isToday&&<span className="badge" style={{background:C.forest,color:"#fff",fontSize:9}}>Aujourd'hui</span>}
                              </div>

                              {daySlots.map(({slot,seance,defaultType,half}) => {
                                const act=seance?.activite;
                                const color=act?actColor(act):defaultType?actColor(defaultType):C.stoneDark;
                                const hasZones=seance&&(seance.z1||seance.z2||seance.z3||seance.z4||seance.z5);
                                const z0calc = hasZones ? Math.max(0, 100 - [seance.z1,seance.z2,seance.z3,seance.z4,seance.z5].reduce((s,v)=>s+(parseFloat(v)||0),0)) : null;

                                const pasteInputRef = React.createRef();
                                // Helpers comparaison prévu→réel
                                const linked = seance?._garminId;
                                const isRepos = seance?.activite === "Repos";
                                const readOnly = linked || isRepos;
                                const diffVal = (real, plan) => {
                                  const r = parseFloat(real); const p = parseFloat(plan);
                                  if (!real || !plan || isNaN(r) || isNaN(p)) return null;
                                  const d = Math.round((r-p)*10)/10;
                                  return d===0 ? null : {v:d, pos:d>0};
                                };
                                const StatCell = ({real,plan,unit,width,mono,isKm}) => {
                                  const diff = linked ? diffVal(real,plan) : null;
                                  const hasReal = real && real !== "0.00" && real !== "--";
                                  const displayVal = linked && hasReal ? real : plan || null;
                                  return (
                                    <div style={{width,flexShrink:0,textAlign:"right"}}>
                                      {displayVal ? (
                                        <span style={{fontFamily:mono?"'DM Mono',monospace":"inherit",fontSize:11,color:linked&&hasReal?(isKm?C.forest:C.inkLight):C.stoneDeep,background:linked&&hasReal&&isKm?C.forestPale:"transparent",borderRadius:3,padding:"0 3px"}}>
                                          {displayVal}{unit}
                                        </span>
                                      ) : (
                                        <span style={{fontSize:11,color:C.stoneDark}}>—</span>
                                      )}
                                      {diff && (
                                        <span style={{fontSize:9,color:diff.pos?C.red:C.green,marginLeft:2}}>
                                          {diff.pos?"+":""}{diff.v}
                                        </span>
                                      )}
                                    </div>
                                  );
                                };
                                const isDone = seance?.statut === "Effectué";
                                return (
                                  <div key={slot} className="slot-ln"
                                    style={{display:"flex",alignItems:"center",gap:10,padding:"7px 20px",borderTop:`0.5px solid ${C.border}`,
                                      background:isDone?C.stone:"transparent",
                                    }}
                                    onClick={ev=>ev.stopPropagation()}>

                                    {/* AM/PM + dot */}
                                    <div style={{display:"flex",alignItems:"center",gap:5,width:42,flexShrink:0}}>
                                      <span style={{fontSize:11,color:C.stoneDeep,width:22}}>{half}</span>
                                      <div style={{width:8,height:8,borderRadius:2,background:color,opacity:seance?1:0.25}}/>
                                    </div>

                                    {/* Activité */}
                                    <div style={{width:180,flexShrink:0}}>
                                      <select
                                        value={seance?seance.activite||"":defaultType||""}
                                        onChange={ev=>{
                                          if(seance) updateField(seance.id,"activite",ev.target.value);
                                          else setSeances(ss=>[...ss,{...emptySeance(),id:Date.now()+Math.random(),date:dateStr,demiJournee:slot,activite:ev.target.value,statut:"Planifié"}]);
                                        }}
                                        style={{fontSize:11,padding:"2px 4px",borderRadius:5,border:`1px solid ${C.border}`,width:"100%",background:actColorPale(seance?seance.activite:defaultType),color:actColor(seance?seance.activite:defaultType),fontWeight:500,opacity:seance?1:0.55}}>
                                        <option value="">— Vide</option>
                                        {(activityTypes||DEFAULT_ACTIVITY_TYPES).map(t=><option key={t} value={t}>{t}</option>)}
                                      </select>
                                    </div>

                                    {/* Statut */}
                                    <div style={{width:80,flexShrink:0}}>
                                      {seance?statusBadge(seance.statut):null}
                                    </div>

                                    {/* Commentaire */}
                                    <input
                                      value={seance?seance.commentaire||"":""}
                                      readOnly={!seance}
                                      onChange={ev=>seance&&updateField(seance.id,"commentaire",ev.target.value)}
                                      placeholder={seance?"Note...":""}
                                      style={{width:180,flexShrink:0,fontSize:11,padding:"2px 7px",borderRadius:5,border:`1px solid ${seance?C.border:"transparent"}`,color:C.stoneDeep,background:seance?C.bg:"transparent",fontStyle:"italic",outline:"none"}}
                                    />

                                    {/* Durée */}
                                    <div style={{width:72,flexShrink:0}}>
                                      {readOnly ? (
                                        <StatCell real={seance?.dureeGarmin} plan={seance?.dureeObj} unit="" width={54} mono={false}/>
                                      ) : (
                                        <input value={seance?seance.dureeObj||"":""} readOnly={!seance}
                                          onChange={ev=>seance&&updateField(seance.id,"dureeObj",ev.target.value)}
                                          placeholder="—" style={{fontSize:11,padding:"2px 6px",borderRadius:4,border:`1px solid ${seance?C.border:"transparent"}`,width:"100%",fontFamily:"'DM Mono',monospace",textAlign:"right",background:seance?C.bg:"transparent"}}/>
                                      )}
                                    </div>

                                    {/* km */}
                                    <div style={{width:72,flexShrink:0}}>
                                      {readOnly ? (
                                        <StatCell real={seance?.kmGarmin} plan={seance?.kmObj} unit="km" width={54} mono isKm/>
                                      ) : (
                                        <input value={seance?seance.kmObj||"":""} readOnly={!seance}
                                          onChange={ev=>seance&&updateField(seance.id,"kmObj",ev.target.value)}
                                          placeholder="—" style={{fontSize:11,padding:"2px 6px",borderRadius:4,border:`1px solid ${seance?C.border:"transparent"}`,width:"100%",fontFamily:"'DM Mono',monospace",textAlign:"right",background:seance?C.bg:"transparent"}}/>
                                      )}
                                    </div>

                                    {/* D+ */}
                                    <div style={{width:64,flexShrink:0}}>
                                      {readOnly ? (
                                        <StatCell real={seance?.dpGarmin} plan={seance?.dpObj} unit="m" width={50} mono/>
                                      ) : (
                                        <input value={seance?seance.dpObj||"":""} readOnly={!seance}
                                          onChange={ev=>seance&&updateField(seance.id,"dpObj",ev.target.value)}
                                          placeholder="—" style={{fontSize:11,padding:"2px 6px",borderRadius:4,border:`1px solid ${seance?C.border:"transparent"}`,width:"100%",fontFamily:"'DM Mono',monospace",textAlign:"right",background:seance?C.bg:"transparent"}}/>
                                      )}
                                    </div>

                                    {/* FC */}
                                    <div style={{width:56,flexShrink:0}}>
                                      {readOnly ? (
                                        <StatCell real={seance?.fcMoy} plan={null} unit="" width={44} mono/>
                                      ) : (
                                        <input value={seance?seance.fcObj||"":""} readOnly={!seance}
                                          onChange={ev=>seance&&updateField(seance.id,"fcObj",ev.target.value)}
                                          placeholder="—" style={{fontSize:11,padding:"2px 6px",borderRadius:4,border:`1px solid ${seance?C.border:"transparent"}`,width:"100%",fontFamily:"'DM Mono',monospace",textAlign:"right",background:seance?C.bg:"transparent"}}/>
                                      )}
                                    </div>

                                    {/* Zones FC si remplies — Z0 calculée + Z1..Z5 */}
                                    {hasZones&&(
                                      <>
                                        <div style={{display:"flex",alignItems:"center",gap:1,flexShrink:0}}>
                                          <span style={{fontSize:9,color:C.stoneDeep,fontFamily:"'DM Mono',monospace"}}>Z0</span>
                                          <div style={{display:"flex",alignItems:"center",background:C.stone,border:`1px solid ${C.border}`,borderRadius:4,padding:"1px 3px",minWidth:46}}>
                                            <span style={{fontSize:10,width:28,textAlign:"center",display:"inline-block",fontFamily:"'DM Mono',monospace",color:C.muted}}>{z0calc!==null?Math.round(z0calc):""}</span>
                                            <span style={{fontSize:9,color:C.stoneDeep,paddingRight:2}}>%</span>
                                          </div>
                                        </div>
                                        {["z1","z2","z3","z4","z5"].map((z,i)=>(
                                          <div key={z} style={{display:"flex",alignItems:"center",gap:1,flexShrink:0}}>
                                            <span style={{fontSize:9,color:C.stoneDeep,fontFamily:"'DM Mono',monospace"}}>Z{i+1}</span>
                                            <div style={{display:"flex",alignItems:"center",background:C.bg,border:`1px solid ${C.border}`,borderRadius:4}}>
                                              <input type="number" min="0" max="100" step="1"
                                                value={seance?seance[z]||"":""}
                                                onChange={ev=>seance&&updateField(seance.id,z,ev.target.value)}
                                                placeholder="—"
                                                style={{fontSize:10,padding:"1px 3px",border:"none",width:38,textAlign:"center",background:"transparent",fontFamily:"'DM Mono',monospace"}}/>
                                              <span style={{fontSize:9,color:C.stoneDeep,paddingRight:2}}>%</span>
                                            </div>
                                          </div>
                                        ))}
                                      </>
                                    )}

                                    {/* Actions : ⎘ID · ✓ · ✗ · ⋯ */}
                                    <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0,marginLeft:"auto"}}>
                                      <div style={{position:"relative"}}>
                                        {seance?._garminId ? (
                                          <button
                                            onClick={()=>{
                                              updateField(seance.id,"_garminId","");
                                              updateField(seance.id,"garminTitre","");
                                              updateField(seance.id,"dureeGarmin","");
                                              updateField(seance.id,"kmGarmin","");
                                              updateField(seance.id,"dpGarmin","");
                                              updateField(seance.id,"fcMoy","");
                                              updateField(seance.id,"fcMax","");
                                              updateField(seance.id,"cal","");
                                              updateField(seance.id,"z1","");
                                              updateField(seance.id,"z2","");
                                              updateField(seance.id,"z3","");
                                              updateField(seance.id,"z4","");
                                              updateField(seance.id,"z5","");
                                            }}
                                            title={"Cliquer pour délier · "+seance._garminId}
                                            style={{fontSize:9,padding:"2px 6px",borderRadius:5,border:`1px solid ${C.forest}`,cursor:"pointer",color:C.forest,background:C.forestPale,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>
                                            ✓ Lié ×
                                          </button>
                                        ) : (
                                          <button onClick={()=>pasteInputRef.current?.focus()}
                                            title="Clic puis Ctrl+V pour coller l'ID Garmin"
                                            style={{fontSize:9,padding:"2px 6px",borderRadius:5,border:`1px solid ${C.border}`,cursor:"pointer",color:C.sky,background:C.bg,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>
                                            ⎘ ID
                                          </button>
                                        )}
                                        <input ref={pasteInputRef}
                                          style={{position:"absolute",opacity:0,width:1,height:1,pointerEvents:"none"}}
                                          onPaste={ev=>{
                                            ev.preventDefault();
                                            const id=(ev.clipboardData.getData("text")||"").trim();
                                            if(!id) return;
                                            if(seance){ linkActivite(seance.id,id); }
                                            else {
                                              const act=activites.find(a=>a.dateHeure===id);
                                              if(!act) return;
                                              const typeMap={"Trail":"Trailrunning","Musculation":"Musculation - Upper","Cardio":"Cardio","Marche à pied":"Marche à pied"};
                                              setSeances(ss=>[...ss,{...emptySeance(),id:Date.now()+Math.random(),
                                                date:dateStr,demiJournee:slot,activite:typeMap[act.type]||act.type||defaultType||"Trailrunning",statut:"Effectué",
                                                _garminId:id,garminTitre:act.titre||"",dureeGarmin:act.duree||"",kmGarmin:act.distance||"",
                                                dpGarmin:act.dp||"",fcMoy:act.fcMoy||"",fcMax:act.fcMax||"",cal:act.calories||"",
                                                z1:act.z1||"",z2:act.z2||"",z3:act.z3||"",z4:act.z4||"",z5:act.z5||"",_nonPlanifie:true}]);
                                            }
                                          }}/>
                                      </div>
                                      {(!seance||seance.statut!=="Effectué")&&(
                                        <button onClick={()=>seance?markDone(seance.id):setSeances(ss=>[...ss,{...emptySeance(),id:Date.now()+Math.random(),date:dateStr,demiJournee:slot,activite:defaultType||"Repos",statut:"Effectué"}])}
                                          title="Marquer Effectué"
                                          style={{background:C.greenPale,border:`1px solid ${C.green}44`,cursor:"pointer",color:C.green,fontSize:12,borderRadius:5,padding:"2px 6px",fontWeight:700}}>✓</button>
                                      )}
                                      {seance&&seance.statut!=="Annulé"&&(
                                        <button onClick={()=>updateField(seance.id,"statut","Annulé")}
                                          title="Marquer Annulé"
                                          style={{background:C.redPale,border:`1px solid ${C.red}44`,cursor:"pointer",color:C.red,fontSize:12,borderRadius:5,padding:"2px 6px",fontWeight:700}}>✗</button>
                                      )}
                                      {seance&&(
                                        <button onClick={()=>setConfirmId(seance.id)}
                                          style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:"0 2px"}}>⋯</button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <ConfirmDialog open={resetConfirm}
        message={`Supprimer toutes les séances planifiées de ${activeYear} ?`}
        onConfirm={()=>{setSeances(ss=>ss.filter(s=>!s.date?.startsWith(String(activeYear))||s.statut==="Effectué"));setResetConfirm(false);}}
        onCancel={()=>setResetConfirm(false)}/>
      <ConfirmDialog open={!!confirmId} message="Supprimer cette séance ?"
        onConfirm={()=>{deleteSeance(confirmId);setConfirmId(null);}}
        onCancel={()=>setConfirmId(null)}/>
    </div>
  );
}

// ─── WRAPPERS FORME ──────────────────────────────────────────────────────────
// Le composant Forme gère déjà VFC/Sommeil/Poids — on le wrap avec tab forcé
function FormeVFC(props) {
  return <Forme {...props} initialTab="vfc"/>;
}
function FormeSommeil(props) {
  return <Forme {...props} initialTab="sommeil"/>;
}
function FormePoids(props) {
  return <Forme {...props} initialTab="poids"/>;
}

// ─── FORME ───────────────────────────────────────────────────────────────────
function Forme({ sommeil, setSommeil, vfcData, setVfcData, poids, setPoids, activites, initialTab, profil, setProfil }) {
  const [tab, setTab] = useState(initialTab||"vfc");
  const sommeilRef=useRef(); const vfcRef=useRef();
  const P = "24px 40px 80px"; // padding commun Forme

  // Import handlers
  const [vfcMsg, setVfcMsg] = useState("");
  const [somMsg, setSomMsg] = useState("");

  const handleImportSommeil = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=(ev)=>{
      const imp=parseCSVSommeil(ev.target.result);
      const ex=new Set(sommeil.map(s=>s.date));
      const news=imp.filter(s=>!ex.has(s.date));
      setSommeil(ss=>[...ss,...news]);
      setSomMsg(`✓ ${news.length} nouvelle(s) · ${imp.length-news.length} doublon(s)`);
      setTimeout(()=>setSomMsg(""),5000);
    }; r.readAsText(file,"utf-8"); e.target.value="";
  };

  const handleImportVFC = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=(ev)=>{
      const imp=parseCSVVFC(ev.target.result);
      const ex=new Set(vfcData.map(v=>v.date));
      const news=imp.filter(v=>!ex.has(v.date));
      // Mettre à jour les entrées existantes si vfc manquant
      const updates=imp.filter(v=>ex.has(v.date)&&!(vfcData.find(x=>x.date===v.date)?.vfc));
      setVfcData(vv=>{
        const merged=vv.map(x=>{const u=updates.find(u=>u.date===x.date);return u?{...x,...u,id:x.id}:x;});
        return [...merged,...news];
      });
      setVfcMsg(`✓ ${news.length} nouvelle(s) · ${updates.length} mise(s) à jour · ${imp.length-news.length-updates.length} doublon(s)`);
      setTimeout(()=>setVfcMsg(""),6000);
    }; r.readAsText(file,"utf-8"); e.target.value="";
  };

  // Computed
  const lastVFC     = useMemo(()=>[...vfcData].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[vfcData]);
  const lastSommeil = useMemo(()=>[...sommeil].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[sommeil]);
  const lastPoids   = useMemo(()=>[...poids].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[poids]);
  const vfcChart    = useMemo(()=>[...vfcData].sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-30).map(v=>({date:v.date.slice(5),vfc:parseInt(v.vfc)||0,moy:parseInt(v.moy7j)||0,chargeA:parseInt(v.chargeAigue)||0,chargeC:parseInt(v.chargeChronique)||0})),[vfcData]);
  const sommeilChart= useMemo(()=>[...sommeil].sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-21).map(s=>({date:s.date.slice(5),score:parseInt(s.score)||0,bb:parseInt(s.bodyBatteryMatin)||0})),[sommeil]);
  const poidsChart  = useMemo(()=>[...poids].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(p=>({date:p.date.slice(5),poids:parseFloat(p.poids)||0})),[poids]);

  // Navy BF calc — formule homme ou femme selon profil
  const calcBF = (p) => {
    const h = parseFloat(profil?.taille) || parseFloat(p.taille) || 180;
    const ab = parseFloat(p.ventre)||0;
    const neck = parseFloat(p.cou)||0;
    if(!ab||!neck||ab<=neck||h<=0) return null;
    const isFemme = (profil?.sexe||"Homme") === "Femme";
    if(isFemme) {
      const hip = parseFloat(p.hanche)||0;
      if(!hip) return null;
      return Math.round((495/(1.29579-0.35004*Math.log10(ab+hip-neck)+0.22100*Math.log10(h))-450)*10)/10;
    }
    return Math.round((495/(1.0324-0.19077*Math.log10(ab-neck)+0.15456*Math.log10(h))-450)*10)/10;
  };

  // Export Alex
  const exportAlex = () => {
    const lv=lastVFC; const ls=lastSommeil; const lp=lastPoids;
    const bf=calcBF(lp);
    const ratio=lv?.chargeAigue&&lv?.chargeChronique?Math.round(parseInt(lv.chargeAigue)/parseInt(lv.chargeChronique)*100)/100:null;
    const recent=activites.filter(a=>new Date(a.date)>=new Date(Date.now()-28*86400000)&&(a.z1||a.z2));
    const avgZ=(k)=>recent.length?Math.round(recent.reduce((s,a)=>s+(parseFloat(a[k])||0),0)/recent.length*100)/100:null;
    const zones=lv?{z1:[parseInt(lv.z1debut)||null,parseInt(lv.z1fin)||null],z2:[parseInt(lv.z2debut)||null,parseInt(lv.z2fin)||null],z3:[parseInt(lv.z3debut)||null,parseInt(lv.z3fin)||null],z4:[parseInt(lv.z4debut)||null,parseInt(lv.z4fin)||null],z5:[null,null],fcMax:parseInt(lv.fcMax)||null}:null;
    exportJSON({date:localDate(new Date()),vfc:lv?parseInt(lv.vfc)||null:null,vfcBaseline:lv?.baseline||null,vfcMoy7j:lv?parseInt(lv.moy7j)||null:null,sommeilScore:ls?parseInt(ls.score)||null:null,poids:lp?parseFloat(lp.poids)||null:null,pcMG:bf,vo2max:lv?parseInt(lv.vo2max)||null:null,ratioCharge:ratio,chargeAigue:lv?parseInt(lv.chargeAigue)||null:null,chargeChronique:lv?parseInt(lv.chargeChronique)||null:null,zonesFC:zones,tempsParZone:{z1:avgZ("z1")/100||null,z2:avgZ("z2")/100||null,z3:avgZ("z3")/100||null,z4:avgZ("z4")/100||null,z5:avgZ("z5")/100||null}},`stride-profil-${localDate(new Date())}.json`);
  };

  // Inline update helpers
  const updSommeil = (id,k,v) => setSommeil(ss=>ss.map(s=>s.id===id?{...s,[k]:v}:s));
  const updVFC     = (id,k,v) => setVfcData(vv=>vv.map(x=>x.id===id?{...x,[k]:v}:x));
  const updPoids   = (id,k,v) => setPoids(pp=>pp.map(p=>p.id===id?{...p,[k]:v}:p));
  const addSommeil = () => setSommeil(ss=>[{...emptySommeil()},...ss]);
  const addVFC     = () => setVfcData(vv=>[{...emptyVFC()},...vv]);
  const addPoids   = () => setPoids(pp=>[{...emptyPoids()},...pp]);
  const delSommeil = (id) => setSommeil(ss=>ss.filter(s=>s.id!==id));
  const delVFC     = (id) => setVfcData(vv=>vv.filter(v=>v.id!==id));
  const delPoids   = (id) => setPoids(pp=>pp.filter(p=>p.id!==id));

  const TABS=[{id:"vfc",label:"VFC & Charge"},{id:"sommeil",label:"Sommeil"},{id:"poids",label:"Suivi corporel"}];

  // Compact inline input style
  const inlineInput = (w=70) => ({fontSize:11,padding:"1px 5px",borderRadius:5,border:`1px solid ${C.border}`,width:w,background:C.bg,fontFamily:"'DM Mono',monospace",textAlign:"center"});

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight}}>Forme</h1>
          <p style={{fontSize:11,color:C.muted}}>VFC · Sommeil · Poids · Récupération</p>
        </div>
        <Btn variant="summit" size="sm" onClick={exportAlex}>→ Alex</Btn>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>
        {[
          {label:"VFC",value:lastVFC?.vfc?`${lastVFC.vfc}ms`:"—",sub:lastVFC?.baseline||"",color:parseInt(lastVFC?.vfc||0)>65?C.green:C.yellow},
          {label:"Sommeil",value:lastSommeil?.score?`${lastSommeil.score}/100`:"—",sub:lastSommeil?.qualite||"",color:parseInt(lastSommeil?.score||0)>=75?C.green:C.yellow},
          {label:"Body Bat.",value:lastSommeil?.bodyBatteryMatin?`${lastSommeil.bodyBatteryMatin}%`:"—",sub:"au lever",color:parseInt(lastSommeil?.bodyBatteryMatin||0)>=70?C.green:C.yellow},
          {label:"Poids",value:lastPoids?.poids?`${lastPoids.poids}kg`:"—",sub:lastPoids?fmtDate(lastPoids.date):"",color:C.sky},
          {label:"VO2max",value:lastVFC?.vo2max||"—",sub:"mL/kg/min",color:C.forest},
          {label:"Ratio",value:lastVFC?.chargeAigue&&lastVFC?.chargeChronique?Math.round(parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique)*100)/100:"—",sub:"aigu/chronique",color:C.muted},
        ].map(k=>(
          <div key={k.label} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",color:C.muted,marginBottom:3}}>{k.label}</div>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:k.color,lineHeight:1}}>{k.value}</div>
            <div style={{fontSize:10,color:C.stoneDeep,marginTop:2}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs — masqués si appelé depuis un sous-onglet nav */}
      {!initialTab&&(
        <div style={{display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,marginBottom:14}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:tab===t.id?500:400,color:tab===t.id?C.forest:C.muted,borderBottom:tab===t.id?`2px solid ${C.forest}`:"2px solid transparent",marginBottom:-1,fontFamily:"inherit"}}>{t.label}</button>
          ))}
        </div>
      )}

      {/* ── VFC ─────────────────────────────────────────────────── */}
      {tab==="vfc" && (
        <div>
          <input ref={vfcRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleImportVFC}/>
          <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
            <Btn variant="sage" size="sm" onClick={()=>vfcRef.current?.click()}>⬆ Import CSV</Btn>
            <Btn size="sm" onClick={addVFC}>＋ Entrée</Btn>
            {vfcMsg&&<span style={{fontSize:11,color:C.green,fontWeight:500}}>{vfcMsg}</span>}
          </div>
          {vfcChart.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:500,color:C.muted,marginBottom:6}}>VFC nocturne 30j</div>
                <ResponsiveContainer width="100%" height={100}>
                  <ComposedChart data={vfcChart}>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} interval={6}/>
                    <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={28}/>
                    <RTooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}} formatter={(v,n)=>[v+" ms",n==="vfc"?"VFC":"Moy 7j"]}/>
                    <Area type="monotone" dataKey="vfc" fill={C.forestPale} stroke={C.forest} strokeWidth={1.5} dot={false}/>
                    <Line type="monotone" dataKey="moy" stroke={C.stoneDeep} strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:500,color:C.muted,marginBottom:6}}>Charges 30j</div>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={vfcChart}>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} interval={6}/>
                    <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={28}/>
                    <RTooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}/>
                    <Line type="monotone" dataKey="chargeA" stroke={C.summit} strokeWidth={1.5} dot={false} name="Aiguë"/>
                    <Line type="monotone" dataKey="chargeC" stroke={C.sky} strokeWidth={1.5} dot={false} name="Chronique"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"110px 80px 120px 90px 90px 100px 100px 70px 32px",padding:"8px 14px",background:C.stone,fontSize:10,fontWeight:600,color:C.muted,gap:8,textTransform:"uppercase",letterSpacing:"0.04em",minWidth:820}}>
                <span>Date</span><span>VFC</span><span>Baseline</span><span>Moy 7j</span><span>VO2max</span><span>Charge Aiguë</span><span>Charge Chron.</span><span style={{color:C.forest}}>Ratio</span><span></span>
              </div>
              <div style={{maxHeight:400,overflowY:"auto"}}>
                {[...vfcData].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(v=>{
                  const ratio = v.chargeAigue && v.chargeChronique
                    ? Math.round(parseFloat(v.chargeAigue)/parseFloat(v.chargeChronique)*100)/100
                    : null;
                  const ratioColor = ratio===null?C.muted:ratio>1.3?C.red:ratio>1.1?C.yellow:ratio>=0.8?C.green:C.sky;
                  return (
                    <div key={v.id} style={{display:"grid",gridTemplateColumns:"110px 80px 120px 90px 90px 100px 100px 70px 32px",padding:"6px 14px",borderTop:`1px solid ${C.border}`,alignItems:"center",gap:8,minWidth:820}}>
                      <input type="date" value={v.date} onChange={e=>updVFC(v.id,"date",e.target.value)} style={{...inlineInput(108),textAlign:"left"}}/>
                      <input value={v.vfc} onChange={e=>updVFC(v.id,"vfc",e.target.value)} placeholder="ms" style={inlineInput(76)}/>
                      <input value={v.baseline} onChange={e=>updVFC(v.id,"baseline",e.target.value)} placeholder="63-83ms" style={{...inlineInput(116),fontSize:11}}/>
                      <input value={v.moy7j} onChange={e=>updVFC(v.id,"moy7j",e.target.value)} placeholder="ms" style={inlineInput(86)}/>
                      <input value={v.vo2max} onChange={e=>updVFC(v.id,"vo2max",e.target.value)} placeholder="—" style={inlineInput(86)}/>
                      <input value={v.chargeAigue} onChange={e=>updVFC(v.id,"chargeAigue",e.target.value)} placeholder="—" style={inlineInput(96)}/>
                      <input value={v.chargeChronique} onChange={e=>updVFC(v.id,"chargeChronique",e.target.value)} placeholder="—" style={inlineInput(96)}/>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color:ratioColor,textAlign:"center"}}>
                        {ratio!==null ? ratio.toFixed(2) : "—"}
                      </span>
                      <button onClick={()=>delVFC(v.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SOMMEIL ──────────────────────────────────────────────── */}
      {tab==="sommeil" && (
        <div>
          <input ref={sommeilRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleImportSommeil}/>
          <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
            <Btn variant="sage" size="sm" onClick={()=>sommeilRef.current?.click()}>⬆ Import CSV</Btn>
            <Btn size="sm" onClick={addSommeil}>＋ Nuit</Btn>
            {somMsg&&<span style={{fontSize:11,color:C.green,fontWeight:500}}>{somMsg}</span>}
          </div>
          {sommeilChart.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:500,color:C.muted,marginBottom:6}}>Score 21j</div>
                <ResponsiveContainer width="100%" height={90}>
                  <AreaChart data={sommeilChart}>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} interval={4}/>
                    <YAxis domain={[40,100]} tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={24}/>
                    <RTooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}/>
                    <Area type="monotone" dataKey="score" fill={C.skyPale} stroke={C.sky} strokeWidth={1.5} dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:500,color:C.muted,marginBottom:6}}>Body Battery matin 21j</div>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={sommeilChart} barSize={5}>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} interval={4}/>
                    <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={24}/>
                    <ReferenceLine y={70} stroke={C.stoneDark} strokeDasharray="3 3"/>
                    <RTooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}/>
                    <Bar dataKey="bb" fill={C.forest} radius={[2,2,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"110px 60px 80px 80px 65px 65px 65px 70px 70px 80px 80px 30px",padding:"8px 14px",background:C.stone,fontSize:10,fontWeight:600,color:C.muted,gap:8,textTransform:"uppercase",letterSpacing:"0.04em",minWidth:880}}>
                <span>Date</span><span>Score</span><span>Qualité</span><span>Durée</span><span>FC ♥</span><span>BB nuit</span><span>BB mat.</span><span>SpO2</span><span>Resp.</span><span>Coucher</span><span>Lever</span><span></span>
              </div>
              <div style={{maxHeight:340,overflowY:"auto"}}>
                {[...sommeil].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(s=>(
                  <div key={s.id} style={{display:"grid",gridTemplateColumns:"110px 60px 80px 80px 65px 65px 65px 70px 70px 80px 80px 30px",padding:"7px 14px",borderTop:`1px solid ${C.border}`,alignItems:"center",gap:8,minWidth:880}}>
                    <input type="date" value={s.date} onChange={e=>updSommeil(s.id,"date",e.target.value)} style={{...inlineInput(108),textAlign:"left"}}/>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,textAlign:"center",color:parseInt(s.score)>=80?C.green:parseInt(s.score)>=60?C.yellow:C.red,fontWeight:500}}>{s.score||"—"}</span>
                    <select value={s.qualite||"Bon"} onChange={e=>updSommeil(s.id,"qualite",e.target.value)} style={{...inlineInput(58),padding:"1px 2px",fontSize:10}}>
                      {["Excellent","Bon","Passable","Mauvais"].map(q=><option key={q}>{q}</option>)}
                    </select>
                    <input value={s.duree} onChange={e=>updSommeil(s.id,"duree",e.target.value)} placeholder="7h30" style={{...inlineInput(58),fontSize:10}}/>
                    <input value={s.fcRepos||""} onChange={e=>updSommeil(s.id,"fcRepos",e.target.value)} placeholder="—" style={inlineInput(50)}/>
                    <input value={s.bodyBattery||""} onChange={e=>updSommeil(s.id,"bodyBattery",e.target.value)} placeholder="—" style={inlineInput(50)}/>
                    <input value={s.bodyBatteryMatin||""} onChange={e=>updSommeil(s.id,"bodyBatteryMatin",e.target.value)} placeholder="—" style={inlineInput(50)}/>
                    <input value={s.spo2||""} onChange={e=>updSommeil(s.id,"spo2",e.target.value)} placeholder="—" style={inlineInput(55)}/>
                    <input value={s.respiration||""} onChange={e=>updSommeil(s.id,"respiration",e.target.value)} placeholder="—" style={inlineInput(50)}/>
                    <input value={s.coucher||""} onChange={e=>updSommeil(s.id,"coucher",e.target.value)} placeholder="23:30" style={{...inlineInput(58),fontSize:10}}/>
                    <input value={s.lever||""} onChange={e=>updSommeil(s.id,"lever",e.target.value)} placeholder="06:30" style={{...inlineInput(58),fontSize:10}}/>
                    <button onClick={()=>delSommeil(s.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUIVI CORPOREL ───────────────────────────────────────── */}
      {tab==="poids" && (
        <div>
          {/* Bloc profil */}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,
            padding:"14px 18px",marginBottom:14,display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",
              letterSpacing:".06em",flexShrink:0}}>Profil personnel</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:12,color:C.muted}}>Sexe</span>
              <div style={{display:"flex",gap:4}}>
                {["Homme","Femme"].map(s=>(
                  <button key={s} onClick={()=>setProfil(p=>({...p,sexe:s}))}
                    style={{padding:"4px 14px",borderRadius:20,fontSize:12,fontWeight:500,
                      border:`0.5px solid ${(profil?.sexe||"Homme")===s?C.forest:C.border}`,
                      background:(profil?.sexe||"Homme")===s?C.forest:"transparent",
                      color:(profil?.sexe||"Homme")===s?C.white:C.muted,
                      cursor:"pointer",fontFamily:"inherit"}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:12,color:C.muted}}>Taille</span>
              <input type="number" min="140" max="220"
                value={profil?.taille||180}
                onChange={e=>setProfil(p=>({...p,taille:parseInt(e.target.value)||180}))}
                style={{width:64,fontSize:12,padding:"4px 8px",borderRadius:6,
                  border:`1px solid ${C.border}`,textAlign:"right",
                  fontFamily:"'DM Mono',monospace"}}/>
              <span style={{fontSize:12,color:C.muted}}>cm</span>
            </div>
            <div style={{fontSize:11,color:C.stoneDeep,marginLeft:"auto"}}>
              {(profil?.sexe||"Homme")==="Femme"
                ? "Formule Navy femme (ventre + hanche requis)"
                : "Formule Navy homme (ventre requis)"}
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <Btn size="sm" onClick={addPoids}>＋ Mesure</Btn>
          </div>
          {poidsChart.length>1&&(
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:500,color:C.muted,marginBottom:6}}>Évolution du poids</div>
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={poidsChart}>
                  <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={32} domain={["auto","auto"]}/>
                  <RTooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}} formatter={v=>[`${v}kg`,"Poids"]}/>
                  <Line type="monotone" dataKey="poids" stroke={C.summit} strokeWidth={2} dot={{fill:C.summit,r:2}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"110px 76px 56px 60px 60px 66px 60px 60px 66px 66px 60px 60px 64px 30px",padding:"8px 14px",background:C.stone,fontSize:10,fontWeight:600,color:C.muted,gap:8,textTransform:"uppercase",letterSpacing:"0.03em",minWidth:980}}>
                <span>Date</span><span>Poids</span><span>Var.</span><span>Cou</span><span>Épaules</span><span>Poitrine</span><span>Bras</span><span>Taille</span><span>Ventre</span><span>Hanche</span><span>Cuisse</span><span>Mollet</span><span>%MG*</span><span></span>
              </div>
              <div style={{maxHeight:340,overflowY:"auto"}}>
                {[...poids].sort((a,b)=>new Date(b.date)-new Date(a.date)).map((p,i,arr)=>{
                  const prev=arr[i+1]; const diff=prev&&p.poids&&prev.poids?(parseFloat(p.poids)-parseFloat(prev.poids)).toFixed(1):null;
                  const bf=calcBF(p);
                  const inp=(w=50)=>({...inlineInput(w),fontSize:10});
                  return (
                    <div key={p.id} style={{display:"grid",gridTemplateColumns:"110px 76px 56px 60px 60px 66px 60px 60px 66px 66px 60px 60px 64px 30px",padding:"7px 14px",borderTop:`1px solid ${C.border}`,alignItems:"center",gap:8,minWidth:980}}>
                      <input type="date" value={p.date} onChange={e=>updPoids(p.id,"date",e.target.value)} style={{...inp(108),textAlign:"left"}}/>
                      <div style={{display:"flex",alignItems:"center",gap:2}}>
                        <input value={p.poids} onChange={e=>updPoids(p.id,"poids",e.target.value)} placeholder="kg" style={{...inp(46),fontWeight:500,color:C.inkLight}}/>
                      </div>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,textAlign:"center",color:diff?parseFloat(diff)>0?C.red:C.green:C.stoneDeep}}>{diff?(parseFloat(diff)>0?"+":"")+diff:"—"}</span>
                      {["cou","epaules","poitrine","bras","taille_cm","ventre","hanche","cuisse","mollet"].map(k=>(
                        <input key={k} value={p[k]||""} onChange={e=>updPoids(p.id,k,e.target.value)} placeholder="—" style={inp(48)}/>
                      ))}
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,textAlign:"center",color:C.forest,fontWeight:500}}>{bf?`${bf}%`:"—"}</span>
                      <button onClick={()=>delPoids(p.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{fontSize:10,color:C.stoneDeep,marginTop:8}}>* %MG formule Navy U.S. · Homme : cou + ventre · Femme : cou + ventre + hanche · Taille dans le profil ci-dessus</div>
        </div>
      )}
    </div>
  );
}

// ─── DONNÉES ─────────────────────────────────────────────────────────────────
function Donnees({ activites, setActivites, sommeil, setSommeil, vfcData, setVfcData, poids, setPoids, seances, setSeances, planningType, objectifs, allData, loadData, resetAll, journalNutri }) {
  const [msgs,          setMsgs]         = useState({});
  const [confirmReset,  setConfirmReset] = useState(false);
  const [saved,         setSaved]        = useState(false);
  const activitesRef=useRef(); const sommeilRef=useRef();
  const vfcRef=useRef(); const progRef=useRef(); const backupRef=useRef();

  const setMsg = (k,m) => { setMsgs(x=>({...x,[k]:m})); setTimeout(()=>setMsgs(x=>({...x,[k]:""})),5000); };

  const handleActivites = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=(ev)=>{
      const imp=parseCSVActivities(ev.target.result);
      const existingDH=new Set(activites.map(a=>a.dateHeure).filter(Boolean));
      const news=imp.filter(a=>!existingDH.has(a.dateHeure));
      setActivites(as=>[...as,...news]);
      setMsg("act",`✓ ${news.length} activité(s) importée(s) · ${imp.length-news.length} doublon(s)`);
    }; r.readAsText(file); e.target.value="";
  };

  const handleSommeil = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=(ev)=>{const imp=parseCSVSommeil(ev.target.result);const ex=new Set(sommeil.map(s=>s.date));const ns=imp.filter(s=>!ex.has(s.date));setSommeil(ss=>[...ss,...ns]);setMsg("som",`✓ ${ns.length} nuit(s) · ${imp.length-ns.length} doublon(s)`);}; r.readAsText(file,"utf-8"); e.target.value="";
  };
  const handleVFC = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=(ev)=>{const imp=parseCSVVFC(ev.target.result);const ex=new Set(vfcData.map(v=>v.date));const ns=imp.filter(v=>!ex.has(v.date));setVfcData(vv=>[...vv,...ns]);setMsg("vfc",`✓ ${ns.length} entrée(s) VFC · ${imp.length-ns.length} doublon(s)`);}; r.readAsText(file,"utf-8"); e.target.value="";
  };
  const handleProgramme = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=(ev)=>{try{const data=JSON.parse(ev.target.result);if(!data._stride_programme&&!data.seances){alert("Format non reconnu.");return;}const toImport=(data.seances||[]).map(s=>({...emptySeance(),...s,id:Date.now()+Math.random()}));const existingKeys=new Set(seances.map(s=>s.date+"|"+s.demiJournee));const news=toImport.filter(s=>!existingKeys.has(s.date+"|"+s.demiJournee));setSeances(ss=>{const u=ss.map(s=>{const m=toImport.find(u=>u.date===s.date&&u.demiJournee===s.demiJournee&&s.statut==="Planifié");return m?{...s,...m,id:s.id}:s;});return [...u,...news];});setMsg("prog",`✓ ${news.length} séance(s) importée(s)`);}catch{alert("Erreur JSON");}}; r.readAsText(file); e.target.value="";
  };

  const openCoachClaude = () => {
    const planStr=Object.entries(planningType||DEFAULT_PLANNING).map(([s,t])=>`  ${s}: ${t}`).join("\n");
    const objStr=objectifs.length>0?objectifs.map(o=>`- ${o.nom} le ${o.date} (${o.distance}km, ${o.dp}m D+)`).join("\n"):"- Aucun objectif défini";
    const prompt=`Je prépare mon programme ultra-trail avec l'app Stride.\n\nCourses objectifs :\n${objStr}\n\nPlanning hebdomadaire type :\n${planStr}\n\nGénère un programme sur les prochaines semaines au format JSON Stride :\n{\n  "_stride_programme": "1.0",\n  "seances": [\n    { "date": "YYYY-MM-DD", "demiJournee": "Lundi AM", "activite": "Trailrunning", "statut": "Planifié", "commentaire": "Description", "kmObj": "15", "dpObj": "400", "dureeObj": "1h30" }\n  ]\n}\nValeurs activite : ${ACTIVITY_TYPES.filter(t=>t).join(", ")}`;
    window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`,"_blank");
  };

  const saveBackup = () => { exportJSON(allData,`stride-data-${localDate(new Date())}.json`); setSaved(true); setTimeout(()=>setSaved(false),2500); };

  const exportLight = () => {
    const today = new Date();
    const daysAgo60 = localDate(new Date(today.getTime()-60*86400000));
    const daysAgo30 = localDate(new Date(today.getTime()-30*86400000));
    const days30    = localDate(new Date(today.getTime()+30*86400000));

    const pick = (obj, keys) => Object.fromEntries(keys.filter(k=>k in obj).map(k=>[k,obj[k]]));

    const data = {
      _stride_export: "light",
      _date: localDate(today),
      _periode: "60j passés + 30j à venir pour séances",

      activites: activites
        .filter(a=>a.dateHeure?.slice(0,10)>=daysAgo60)
        .map(a=>pick(a,["date","dateHeure","type","titre","duree","distance","dp","fcMoy","fcMax","z1","z2","z3","z4","z5","tss","gapMoy","cal"])),

      sommeil: sommeil
        .filter(s=>s.date>=daysAgo60)
        .map(s=>pick(s,["date","score","qualite","duree","bodyBatteryMatin","vfc","fcRepos"])),

      vfcData: vfcData
        .filter(v=>v.date>=daysAgo60)
        .map(v=>pick(v,["date","vfc","moy7j","vo2max","chargeAigue","chargeChronique","z1fin","z2fin","z3fin","z4fin","fcMax"])),

      journalNutri: (journalNutri||[])
        .filter(j=>j.date>=daysAgo60)
        .map(j=>pick(j,["date","kcalBrulees","kcalConso","proteines","lipides","glucides","notes"])),

      poids: poids
        .map(p=>pick(p,["date","poids","ventre","taille_cm","hanche","cuisse","bras"])),

      seances: seances
        .filter(s=>s.date>=daysAgo30&&s.date<=days30)
        .map(s=>pick(s,["date","demiJournee","activite","statut","commentaire","dureeObj","kmObj","dpObj","fcObj","dureeGarmin","kmGarmin","fcMoy","fcMax","z2","z3"])),
    };

    exportJSON(data, `stride-coach-${localDate(today)}.json`);
  };
  const handleLoad = (e) => { const file=e.target.files?.[0]; if(!file) return; const r=new FileReader(); r.onload=(ev)=>{try{loadData(JSON.parse(ev.target.result));}catch{alert("JSON invalide");}}; r.readAsText(file); e.target.value=""; };

  const SOURCES = [
    {key:"act",label:"Activités",sub:"Activities.csv (Garmin)",ref:activitesRef,handler:handleActivites,accept:".csv",count:activites.length,icon:"🏃"},
    {key:"som",label:"Sommeil",sub:"Sommeil.csv (Garmin)",ref:sommeilRef,handler:handleSommeil,accept:".csv",count:sommeil.length,icon:"😴"},
    {key:"vfc",label:"VFC & Charge",sub:"Statut_variabilité.csv (Garmin)",ref:vfcRef,handler:handleVFC,accept:".csv",count:vfcData.length,icon:"❤️"},
  ];

  const rowStyle = {display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderTop:`1px solid ${C.border}`};

  const cardStyle = {background:C.white,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"};
  const secLabel = (txt) => <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:C.muted,marginBottom:12}}>{txt}</div>;

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Données</h1>
      <p style={{fontSize:12,color:C.muted,marginBottom:28}}>Import · Export · Sauvegarde</p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:24,alignItems:"start"}}>

        {/* Colonne 1 : Import */}
        <div>
          {secLabel("Importer depuis Garmin")}
          <div style={cardStyle}>
            {SOURCES.map(({key,label,sub,ref,handler,accept,count,icon})=>(
              <div key={key}>
                <input ref={ref} type="file" accept={accept} style={{display:"none"}} onChange={handler}/>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderTop:`1px solid ${C.border}`}}>
                  <span style={{fontSize:20,width:26,textAlign:"center",flexShrink:0}}>{icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>{label}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:1}}>{sub}</div>
                    {msgs[key]&&<div style={{fontSize:11,color:C.green,fontWeight:500,marginTop:3}}>{msgs[key]}</div>}
                  </div>
                  {count>0&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.stoneDeep,flexShrink:0,fontWeight:500}}>{count}</span>}
                  <Btn variant="soft" size="sm" onClick={()=>ref.current?.click()}>⬆ Import</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Colonne 2 : Sauvegarde */}
        <div>
          {secLabel("Sauvegarde")}
          <div style={cardStyle}>
            <div style={{padding:"10px 18px",background:C.forestPale,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:C.green}}>✓ Sauvegarde automatique active</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderTop:`1px solid ${C.border}`}}>
              <span style={{fontSize:20,width:26,textAlign:"center",flexShrink:0}}>💾</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>Télécharger</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>Fichier JSON — toutes les données</div>
              </div>
              <Btn size="sm" onClick={saveBackup}>{saved?"✓ OK":"⬇ Télécharger"}</Btn>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderTop:`1px solid ${C.border}`}}>
              <span style={{fontSize:20,width:26,textAlign:"center",flexShrink:0}}>📂</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>Charger une sauvegarde</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>Remplace toutes les données</div>
              </div>
              <input ref={backupRef} type="file" accept=".json" style={{display:"none"}} onChange={handleLoad}/>
              <Btn variant="ghost" size="sm" onClick={()=>backupRef.current?.click()}>⬆ Charger</Btn>
            </div>
          </div>
        </div>

        {/* Colonne 3 : Reset */}
        <div>
          {secLabel("Danger")}
          <div style={{background:C.redPale,border:`1px solid ${C.red}33`,borderRadius:14,padding:"20px 22px"}}>
            <div style={{fontSize:15,fontWeight:600,color:C.red,marginBottom:6}}>Repartir de zéro</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16,lineHeight:1.6}}>Efface toutes les activités, séances, données de forme. Le planning type est conservé.</div>
            <Btn variant="danger" size="sm" onClick={()=>setConfirmReset(true)}>Réinitialiser</Btn>
          </div>
        </div>

      </div>

      <ConfirmDialog open={confirmReset} message="Effacer toutes les données ? Cette action est irréversible." onConfirm={()=>{resetAll();setConfirmReset(false);}} onCancel={()=>setConfirmReset(false)}/>
    </div>
  );
}

// ─── OBJECTIFS ───────────────────────────────────────────────────────────────
function Objectifs({ objectifs, setObjectifs, seances, activites, vfcData, poids, profil, produits, recettes, allData }) {
  const [modalObj,     setModalObj]     = useState(false);
  const [formObj,      setFormObj]      = useState(emptyObjectif());
  const [editObjId,    setEditObjId]    = useState(null);
  const [confirmObjId, setConfirmObjId] = useState(null);
  const today = localDate(new Date());

  const updO = (k,v) => setFormObj(f=>({...f,[k]:v}));
  const saveObj = () => {
    if(editObjId) setObjectifs(oo=>oo.map(o=>o.id===editObjId?{...formObj,id:editObjId}:o));
    else setObjectifs(oo=>[...oo,{...formObj,id:Date.now()+Math.random()}]);
    setModalObj(false);
  };

  // ── Calcul jauge de préparation par course ──────────────────────────────────
  const calcPrep = (obj) => {
    if(!obj.date||!obj.distance) return null;
    const dist = parseFloat(obj.distance)||0;
    const dp   = parseFloat(obj.dp)||0;
    const j    = daysUntil(obj.date);
    if(j===null||j<0) return null;

    // Difficulté absolue de la course (score 0-1, pénalité croissante)
    // On distingue 3 niveaux : court (<30km), moyen (30-80km), ultra (>80km)
    const isUltra = dist > 80;
    const isLong  = dist > 30;

    // 1. Long run max 90j vs cible = 70% dist mais plafond strict selon catégorie
    const since90 = localDate(new Date(new Date().getTime()-90*86400000));
    const longRunMax = Math.max(0,...seances
      .filter(s=>s.date>=since90&&(s.statut==="Effectué"||s.statut==="Partiel")&&isRunning(s.activite))
      .map(s=>parseFloat(s.kmGarmin)||0));
    const longRunCible = dist*0.70;
    // Un ultra exige qu'on ait déjà fait au moins 50% de la distance en long run
    // sinon le score est plafonné durement
    const longRunRatio = longRunCible>0 ? longRunMax/longRunCible : 0;
    const longRunScore = isUltra
      ? (longRunMax < dist*0.40 ? longRunRatio*0.5 : Math.min(1, longRunRatio)) // pénalité doublée sous 40% dist
      : Math.min(1, longRunRatio);

    // 2. Volume D+ hebdo pour les courses à fort dénivelé
    const since28 = localDate(new Date(new Date().getTime()-28*86400000));
    const dpRecents = seances
      .filter(s=>s.date>=since28&&(s.statut==="Effectué"||s.statut==="Partiel")&&isRunning(s.activite))
      .reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0);
    const dpHebdoMoy = dpRecents/4;
    // Cible : 20% du D+ total par semaine (ex: 10000m → 2000m/sem)
    const dpCible = dp*0.20;
    const dpScore = dp>500 ? (dpCible>0 ? Math.min(1, dpHebdoMoy/dpCible) : 0) : 1; // ignoré si plat

    // 3. Volume km hebdo moyen vs cible
    const kmRecents = seances
      .filter(s=>s.date>=since28&&(s.statut==="Effectué"||s.statut==="Partiel")&&isRunning(s.activite))
      .reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0);
    const volHebdoMoy = kmRecents/4;
    const volCible = isUltra ? dist*0.20 : isLong ? dist*0.17 : dist*0.15;
    const volScore = volCible>0 ? Math.min(1, volHebdoMoy/volCible) : 0;

    // 4. VFC
    const lastV = [...vfcData].sort((a,b)=>b.date.localeCompare(a.date))[0];
    let vfcScore = 0.5;
    if(lastV?.vfc&&lastV?.moy7j) {
      const ratio = parseInt(lastV.vfc)/parseInt(lastV.moy7j);
      vfcScore = ratio>=0.97 ? 1 : ratio>=0.90 ? 0.7 : 0.3;
    }

    // 5. Charge (ratio aigu/chronique)
    let chargeScore = 0.5;
    if(lastV?.chargeAigue&&lastV?.chargeChronique) {
      const r = parseInt(lastV.chargeAigue)/parseInt(lastV.chargeChronique);
      chargeScore = r>=0.8&&r<=1.3 ? 1 : r>=0.6&&r<=1.5 ? 0.6 : 0.3;
    }

    // Pondération selon type de course
    let score;
    if(isUltra) {
      // Ultra : long run et D+ sont déterminants
      score = longRunScore*0.35 + dpScore*0.25 + volScore*0.20 + vfcScore*0.10 + chargeScore*0.10;
    } else if(isLong) {
      score = longRunScore*0.40 + dpScore*0.15 + volScore*0.25 + vfcScore*0.10 + chargeScore*0.10;
    } else {
      score = longRunScore*0.35 + volScore*0.35 + vfcScore*0.15 + chargeScore*0.15;
    }
    score = Math.round(score*100);

    const indicators = [
      { label:`Long run ${Math.round(longRunMax)}km / ${Math.round(longRunCible)}km cible`, ok: longRunScore>=0.7 },
      ...(dp>500 ? [{ label:`D+ hebdo ${Math.round(dpHebdoMoy)}m / ${Math.round(dpCible)}m cible`, ok: dpScore>=0.7 }] : []),
      { label:`Volume hebdo ${Math.round(volHebdoMoy)}km / ${Math.round(volCible)}km cible`, ok: volScore>=0.7 },
      { label:`VFC ${lastV?.vfc||"—"}ms`, ok: vfcScore>=0.7 },
    ];

    return { score, indicators, longRunMax, longRunCible, volHebdoMoy, dpHebdoMoy };
  };

  // ── Export Alex pour une course ─────────────────────────────────────────────
  const exportAlex = (obj) => {
    const lastV  = [...vfcData].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const lastS  = [...(allData.sommeil||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const lastP  = [...poids].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const bf     = lastP&&profil ? (()=>{
      const h=parseFloat(profil.taille)||180, ab=parseFloat(lastP.ventre)||0, neck=parseFloat(lastP.cou)||0;
      if(!ab||!neck||ab<=neck||h<=0) return null;
      if(profil.sexe==="Femme"){const hip=parseFloat(lastP.hanche)||0;if(!hip)return null;return Math.round((495/(1.29579-0.35004*Math.log10(ab+hip-neck)+0.22100*Math.log10(h))-450)*10)/10;}
      return Math.round((495/(1.0324-0.19077*Math.log10(ab-neck)+0.15456*Math.log10(h))-450)*10)/10;
    })() : null;

    // Allures Z2 depuis activités récentes
    const since60 = localDate(new Date(new Date().getTime()-60*86400000));
    const actZ2 = activites.filter(a=>a.dateHeure?.slice(0,10)>=since60&&["Trail","Course à pied"].includes(a.type)&&(parseFloat(a.z2)||0)>40);
    const z2Kmh = actZ2.length&&actZ2.some(a=>a.allure) ? Math.round(actZ2.filter(a=>a.allure).reduce((s,a)=>{const p=parseFloat(a.allure)||0;return s+(p>0?60/p:0);},0)/actZ2.filter(a=>a.allure).length*10)/10 : null;
    const z3Kmh = null; // non calculable directement

    const data = {
      _version: "stride-alex-1.0",
      _date: today,
      profil: {
        sexe: profil?.sexe||"Homme",
        taille: profil?.taille||180,
        dateNaissance: profil?.dateNaissance||null,
        age: profil?.dateNaissance ? Math.floor((new Date()-new Date(profil.dateNaissance))/31557600000) : null,
      },
      forme: {
        vfc: lastV?.vfc?parseInt(lastV.vfc):null,
        vfcBaseline: lastV?.baseline||null,
        vfcMoy7j: lastV?.moy7j?parseInt(lastV.moy7j):null,
        sommeilScore: lastS?.score?parseInt(lastS.score):null,
        poids: lastP?.poids?parseFloat(lastP.poids):null,
        pcMG: bf,
        vo2max: lastV?.vo2max?parseInt(lastV.vo2max):null,
        ratioCharge: lastV?.chargeAigue&&lastV?.chargeChronique?Math.round(parseInt(lastV.chargeAigue)/parseInt(lastV.chargeChronique)*100)/100:null,
        chargeAigue: lastV?.chargeAigue?parseInt(lastV.chargeAigue):null,
        chargeChronique: lastV?.chargeChronique?parseInt(lastV.chargeChronique):null,
      },
      zonesFC: lastV?{
        z1:[null,parseInt(lastV.z1fin)||null],
        z2:[parseInt(lastV.z2debut)||null,parseInt(lastV.z2fin)||null],
        z3:[parseInt(lastV.z3debut)||null,parseInt(lastV.z3fin)||null],
        z4:[parseInt(lastV.z4debut)||null,parseInt(lastV.z4fin)||null],
        z5:[parseInt(lastV.z5debut)||null,null],
        fcMax:parseInt(lastV.fcMax)||null,
      }:null,
      allures: { z2Kmh, z3Kmh },
      tempsParZone: actZ2.length ? (()=>{
        const avg=(k)=>Math.round(actZ2.reduce((s,a)=>(s+(parseFloat(a[k])||0)),0)/actZ2.length*100)/100;
        return {z1:avg("z1")/100,z2:avg("z2")/100,z3:avg("z3")/100,z4:avg("z4")/100,z5:avg("z5")/100};
      })() : null,
      objectifCourse: {
        nom: obj.nom,
        date: obj.date,
        distanceKm: parseFloat(obj.distance)||null,
        denivelPos: parseFloat(obj.dp)||null,
      },
      produits: (produits||[]).map(p=>({
        nom:p.nom, poids:parseFloat(p.poids)||null, par100g:!!p.par100g, boisson:!!p.boisson,
        volumeMl:p.volumeMl?parseFloat(p.volumeMl):null,
        kcal:parseFloat(p.kcal)||null, proteines:parseFloat(p.proteines)||null,
        lipides:parseFloat(p.lipides)||null, glucides:parseFloat(p.glucides)||null,
        sodium:parseFloat(p.sodium)||null, potassium:parseFloat(p.potassium)||null,
        magnesium:parseFloat(p.magnesium)||null, zinc:parseFloat(p.zinc)||null,
        calcium:parseFloat(p.calcium)||null,
      })),
      recettes: (recettes||[]).map(r=>{
        const portions = parseFloat(r.portions)||1;
        const macro=(k)=>r[k]?Math.round(parseFloat(r[k])/portions*10)/10:null;
        return {
          nom:r.nom, portions, poids:parseFloat(r.poids)||null, par100g:!!r.par100g,
          boisson:!!r.boisson, volumeMl:r.volumeMl?parseFloat(r.volumeMl):null,
          kcal:macro("kcal"), proteines:macro("proteines"), lipides:macro("lipides"),
          glucides:macro("glucides"), sodium:macro("sodium"), potassium:macro("potassium"),
          magnesium:macro("magnesium"), zinc:macro("zinc"), calcium:macro("calcium"),
          notes:r.notes||null,
        };
      }),
    };
    exportJSON(data, `stride-alex-${obj.nom.replace(/\s+/g,"-").toLowerCase()}-${today}.json`);
  };

  // ── Couleurs par priorité ────────────────────────────────────────────────────
  const prioStyle = (p) => ({
    A: { border:"#C4521A", bg:"#FAF0E8", head:"#993C1D", pill:"#E8F2EC", pillTxt:"#085041", countdown:"#F5C4B3", countdownTxt:"#712B13" },
    B: { border:"#BA7517", bg:"#FDF6E3", head:"#854F0B", pill:"#FAEEDA", pillTxt:"#633806", countdown:"#FAC775", countdownTxt:"#412402" },
    C: { border:"#888780", bg:"#F1EFE8", head:"#5F5E5A", pill:"#F1EFE8", pillTxt:"#444441", countdown:"#D3D1C7", countdownTxt:"#2C2C2A" },
  }[p||"A"]);

  const scoreColor = (s) => s>=70?C.green:s>=45?C.yellow:C.red;

  // ── Timeline ────────────────────────────────────────────────────────────────
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd   = new Date(year, 11, 31, 23, 59, 59).getTime();
  const yearSpan  = yearEnd - yearStart;
  const dateToPct = (dateStr) => {
    const [y,m,d] = (dateStr||"").split("-").map(Number);
    if(!y||!m||!d) return 0;
    const t = new Date(y, m-1, d).getTime();
    return Math.max(0, Math.min(100, (t - yearStart) / yearSpan * 100));
  };
  const todayPct = dateToPct(today);

  const sorted = [...objectifs].sort((a,b)=>new Date(a.date)-new Date(b.date));

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Objectifs</h1>
          <p style={{fontSize:12,color:C.muted}}>
            Saison {year}
            {sorted.length>0&&` · ${sorted.length} course${sorted.length>1?"s":""} · ${sorted.reduce((s,o)=>s+(parseFloat(o.distance)||0),0)}km cumulés`}
          </p>
        </div>
        <Btn onClick={()=>{setEditObjId(null);setFormObj(emptyObjectif());setModalObj(true);}}>＋ Ajouter une course</Btn>
      </div>

      {/* Timeline saison */}
      {sorted.length>0&&(
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 20px",marginBottom:20}}>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted,marginBottom:10}}>Saison {year}</div>
          <div style={{position:"relative",height:44}}>
            <div style={{position:"absolute",top:14,left:0,right:0,height:2,background:C.border,borderRadius:1}}/>
            {/* Mois */}
            {["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"].map((m,i)=>{
              const pct = dateToPct(`${year}-${String(i+1).padStart(2,"0")}-01`);
              const hasRace=sorted.some(o=>o.date&&new Date(o.date).getMonth()===i&&new Date(o.date).getFullYear()===year);
              return (
                <span key={m} style={{position:"absolute",top:0,left:`${pct}%`,transform:"translateX(-50%)",fontSize:9,color:hasRace?C.summit:C.muted,fontWeight:hasRace?600:400,userSelect:"none"}}>
                  {m}
                </span>
              );
            })}
            {/* Aujourd'hui */}
            <div style={{position:"absolute",top:6,left:`${todayPct}%`,width:2,height:18,background:C.forest,borderRadius:1}}/>
            {/* Courses */}
            {sorted.map(obj=>{
              if(!obj.date) return null;
              const d=new Date(obj.date);
              if(d.getFullYear()!==year) return null;
              const pct = dateToPct(obj.date);
              const ps = prioStyle(obj.priorite);
              return (
                <div key={obj.id} style={{position:"absolute",top:7,left:`${pct}%`,transform:"translateX(-50%)"}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:ps.border,border:`2px solid ${C.white}`}}/>
                  <div style={{position:"absolute",top:14,left:"50%",transform:"translateX(-50%)",fontSize:8,fontWeight:600,color:ps.head,whiteSpace:"nowrap"}}>{obj.nom?.split(" ")[0]}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cartes */}
      {sorted.length===0?(
        <div style={{textAlign:"center",padding:"80px 20px",color:C.muted}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:48,marginBottom:14}}>🏔</div>
          <div style={{fontSize:18,fontWeight:500,color:C.inkLight,marginBottom:6}}>Aucun objectif</div>
          <div style={{fontSize:13,marginBottom:20}}>Ajoute tes courses pour activer le suivi de préparation</div>
          <Btn onClick={()=>{setEditObjId(null);setFormObj(emptyObjectif());setModalObj(true);}}>＋ Ajouter une course</Btn>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))",gap:16,marginBottom:24}}>
          {sorted.map(obj=>{
            const j=daysUntil(obj.date);
            const prep=calcPrep(obj);
            const phase=j===null?"":j>90?"Fondamental":j>42?"Spécifique":j>14?"Affûtage":j>0?"Tapering":j===0?"Jour J":"Terminé";
            const ps=prioStyle(obj.priorite);
            const isPast=j!==null&&j<0;
            return (
              <div key={obj.id} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",borderLeft:`3px solid ${ps.border}`}}>

                {/* Header */}
                <div style={{background:ps.bg,padding:"16px 18px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:ps.pill,color:ps.pillTxt}}>Priorité {obj.priorite||"A"}</span>
                      {obj.statut&&<span style={{fontSize:10,color:ps.head}}>{obj.statut}</span>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      {j!==null&&j>=0&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600,color:ps.countdownTxt,background:ps.countdown,padding:"2px 8px",borderRadius:8}}>{j}j</span>}
                      {isPast&&<span style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>Terminé</span>}
                      <button onClick={e=>{e.stopPropagation();setEditObjId(obj.id);setFormObj({...emptyObjectif(),...obj});setModalObj(true);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:ps.head,fontSize:12,padding:0}}>✎</button>
                      <button onClick={e=>{e.stopPropagation();setConfirmObjId(obj.id);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                    </div>
                  </div>
                  <h2 style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:ps.head,marginBottom:2,lineHeight:1.2}}>{obj.nom}</h2>
                  <p style={{fontSize:12,color:ps.head,opacity:.8,display:"flex",alignItems:"center",gap:8}}>
                    {fmtDate(obj.date)}{obj.region?` · ${obj.region}`:""}{phase?` · ${phase}`:""}
                    {obj.lien&&<a href={obj.lien} target="_blank" rel="noopener noreferrer"
                      onClick={e=>e.stopPropagation()}
                      style={{fontSize:10,padding:"1px 7px",borderRadius:8,background:ps.countdown,
                        color:ps.countdownTxt,textDecoration:"none",fontWeight:500,flexShrink:0}}>
                      Site officiel ↗
                    </a>}
                  </p>
                </div>

                {/* Stats */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:`0.5px solid ${C.border}`}}>
                  {[
                    {l:"Distance",v:obj.distance?`${obj.distance} km`:"—"},
                    {l:"D+",v:obj.dp?`${obj.dp} m`:"—"},
                    {l:"Objectif",v:obj.temps||"Finisher"},
                  ].map(({l,v})=>(
                    <div key={l} style={{padding:"10px 14px",borderRight:`0.5px solid ${C.border}`}}>
                      <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".05em",color:C.muted,marginBottom:2}}>{l}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,color:C.inkLight}}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Jauge préparation */}
                {prep&&!isPast&&(
                  <div style={{padding:"12px 16px",borderBottom:`0.5px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:11,color:C.muted}}>Niveau de préparation</span>
                      <span style={{fontSize:13,fontWeight:500,color:scoreColor(prep.score)}}>{prep.score}%</span>
                    </div>
                    <div style={{height:5,background:C.stone,borderRadius:3,overflow:"hidden",marginBottom:8}}>
                      <div style={{width:`${prep.score}%`,height:"100%",background:scoreColor(prep.score),borderRadius:3,transition:"width .5s"}}/>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {prep.indicators.map((ind,i)=>(
                        <span key={i} style={{fontSize:10,color:ind.ok?C.green:C.yellow}}>
                          {ind.ok?"●":"○"} {ind.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section Alex */}
                <div style={{padding:"10px 16px",background:C.stone,display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:11,color:C.muted,flex:1}}>Stratégie de course avec Alex</span>
                  <a href="https://alex-trail.vercel.app" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
                    <Btn variant="summit" size="sm">Ouvrir Alex →</Btn>
                  </a>
                  <Btn variant="sage" size="sm" onClick={()=>exportAlex(obj)}>⬇ Export</Btn>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Bandeau Alex */}
      <div style={{background:C.white,border:`1px solid ${C.summitPale||"#FAF0E8"}`,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:36,height:36,borderRadius:8,background:"#FAF0E8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏔</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:500,color:C.inkLight,marginBottom:2}}>Préparer une course avec Alex</div>
          <div style={{fontSize:11,color:C.muted}}>Alex analyse ton GPX, calcule ta stratégie de pace et gère ta nutrition de course. Exporte tes données Stride pour qu'Alex personnalise ses recommandations.</div>
        </div>
        <a href="https://alex-trail.vercel.app" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",flexShrink:0}}>
          <Btn variant="summit">Ouvrir Alex →</Btn>
        </a>
      </div>

      <ConfirmDialog open={!!confirmObjId} message="Supprimer cet objectif ?" onConfirm={()=>{setObjectifs(oo=>oo.filter(o=>o.id!==confirmObjId));setConfirmObjId(null);}} onCancel={()=>setConfirmObjId(null)}/>

      <Modal open={modalObj} onClose={()=>setModalObj(false)} title={editObjId?"Modifier la course":"Nouvelle course objectif"} width={480}>
        <FormGrid>
          <Field label="Nom" full><input value={formObj.nom} onChange={e=>updO("nom",e.target.value)} placeholder="Verdon Canyon Challenge"/></Field>
          <Field label="Date"><input type="date" value={formObj.date} onChange={e=>updO("date",e.target.value)}/></Field>
          <Field label="Priorité">
            <select value={formObj.priorite||"A"} onChange={e=>updO("priorite",e.target.value)}>
              <option value="A">A — Principal</option><option value="B">B — Préparatoire</option><option value="C">C — Test</option>
            </select>
          </Field>
          <Field label="Statut">
            <select value={formObj.statut} onChange={e=>updO("statut",e.target.value)}>
              {["À venir","Inscrit","Terminé","Abandonné"].map(s=><option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Distance (km)"><input type="number" value={formObj.distance} onChange={e=>updO("distance",e.target.value)}/></Field>
          <Field label="D+ (m)"><input type="number" value={formObj.dp} onChange={e=>updO("dp",e.target.value)}/></Field>
          <Field label="Temps objectif"><input value={formObj.temps} onChange={e=>updO("temps",e.target.value)} placeholder="6h30"/></Field>
          <Field label="Région"><input value={formObj.region||""} onChange={e=>updO("region",e.target.value)} placeholder="Verdon, France"/></Field>
          <Field label="Lien officiel" full><input value={formObj.lien||""} onChange={e=>updO("lien",e.target.value)} placeholder="https://..."/></Field>
        </FormGrid>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setModalObj(false)}>Annuler</Btn>
          <Btn onClick={saveObj}>{editObjId?"Enregistrer":"Ajouter"}</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── PARAMÈTRES (onglet plein écran) ─────────────────────────────────────────
function Parametres({ planningType, setPlanningType, seances, setSeances, objectifs, setObjectifs, activityTypes, setActivityTypes }) {
  const [tab,       setTab]       = useState("planning");
  const [form,      setForm]      = useState({...DEFAULT_PLANNING,...planningType});
  const [saved,     setSaved]     = useState(false);
  const [generated, setGenerated] = useState(false);
  const [modalObj,  setModalObj]  = useState(false);
  const [formObj,   setFormObj]   = useState(emptyObjectif());
  const [editObjId, setEditObjId] = useState(null);
  const [confirmObjId,setConfirmObjId]=useState(null);

  const updO = (k,v) => setFormObj(f=>({...f,[k]:v}));
  const saveObj = () => {
    if(editObjId) setObjectifs(oo=>oo.map(o=>o.id===editObjId?{...formObj,id:editObjId}:o));
    else setObjectifs(oo=>[...oo,{...formObj}]);
    setModalObj(false);
  };
  const savePlanning = () => { setPlanningType({...form}); setSaved(true); setTimeout(()=>setSaved(false),2000); };
  const generateSeances = () => {
    const year=new Date().getFullYear();
    const existing=new Set(seances.map(s=>s.date+"|"+s.demiJournee));
    const toCreate=[];
    for(let d=new Date(year,0,1);d<=new Date(year,11,31);d.setDate(d.getDate()+1)){
      const di=(d.getDay()+6)%7;const dayName=DAY_NAMES[di];const dateStr=localDate(d);
      for(const half of["AM","PM"]){const slot=`${dayName} ${half}`;const type=form[slot];if(!existing.has(dateStr+"|"+slot)&&type&&type!=="")toCreate.push({...emptySeance(),id:Date.now()+Math.random(),date:dateStr,demiJournee:slot,activite:type,statut:"Planifié"});}
    }
    setSeances(ss=>[...ss,...toCreate]);
    setGenerated(true); setTimeout(()=>setGenerated(false),3000);
  };

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:20}}>Paramètres</h1>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,marginBottom:28}}>
        {[{id:"planning",label:"Planning & Activités"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",padding:"9px 18px",cursor:"pointer",fontSize:14,fontWeight:tab===t.id?600:400,color:tab===t.id?C.forest:C.muted,borderBottom:tab===t.id?`2px solid ${C.forest}`:"2px solid transparent",marginBottom:-1,fontFamily:"inherit"}}>{t.label}</button>
        ))}
      </div>

      {tab==="planning"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:32,alignItems:"start"}}>
          {/* Types d activités */}
          <div>
            <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:C.muted,marginBottom:14}}>Types d'activités</div>
            <p style={{fontSize:12,color:C.muted,marginBottom:16,lineHeight:1.6}}>Liste utilisée dans le Planning et le Programme.</p>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
              {(activityTypes||[]).map((type,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:C.stone,borderRadius:10,padding:"10px 14px"}}>
                  <div style={{width:10,height:10,borderRadius:3,background:actColor(type),flexShrink:0}}/>
                  <input value={type} onChange={e=>{const arr=[...(activityTypes||[])];arr[i]=e.target.value;setActivityTypes(arr);}}
                    style={{flex:1,fontSize:13,padding:"4px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:C.white}}/>
                  <button onClick={()=>setActivityTypes((activityTypes||[]).filter((_,j)=>j!==i))}
                    style={{background:"none",border:"none",cursor:"pointer",color:C.red,fontSize:15,padding:0,flexShrink:0}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="soft" size="sm" onClick={()=>setActivityTypes([...(activityTypes||[]),"Nouvelle activité"])}>＋ Ajouter</Btn>
              <Btn variant="ghost" size="sm" onClick={()=>setActivityTypes(ACTIVITY_TYPES.filter(t=>t))}>Réinitialiser</Btn>
            </div>
          </div>

          {/* Planning type */}
          <div>
            <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:C.muted,marginBottom:14}}>Semaine type</div>
            <p style={{fontSize:12,color:C.muted,marginBottom:16,lineHeight:1.6}}>Créneaux vides = grisés dans le Programme.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:18}}>
              {DAY_NAMES.map(d=>(
                <div key={d} style={{background:C.stone,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.inkLight,marginBottom:10}}>{d}</div>
                  {["AM","PM"].map(half=>{
                    const slot=`${d} ${half}`; const val=form[slot]||"";
                    return (
                      <div key={half} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                        <span style={{fontSize:11,color:C.muted,width:22}}>{half}</span>
                        <div style={{position:"relative",flex:1}}>
                          {val&&val!=="Repos"&&<div style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",width:7,height:7,borderRadius:2,background:actColor(val),zIndex:1,pointerEvents:"none"}}/>}
                          <select value={val} onChange={e=>setForm(f=>({...f,[slot]:e.target.value}))} style={{paddingLeft:val&&val!=="Repos"?24:10,width:"100%"}}>
                            <option value="">— Vide</option>
                            {(activityTypes||ACTIVITY_TYPES).filter(t=>t!=="").map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <Btn variant="ghost" onClick={()=>setForm({...DEFAULT_PLANNING})}>Réinitialiser</Btn>
              <Btn variant="sage" onClick={generateSeances}>{generated?"✓ Séances créées !":"📅 Générer l'année"}</Btn>
              <Btn onClick={savePlanning}>{saved?"✓ Enregistré !":"Enregistrer"}</Btn>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


// ─── ACTIVITÉS ────────────────────────────────────────────────────────────────
const AVEC_ZONES = ["Trailrunning","Cardio","Marche à pied","Trail","Course à pied sur tapis roulant"];

function Activites({ activites, setActivites, seances, setSeances }) {
  // Set des dateHeure liées dans le programme
  const liees = useMemo(()=>new Set(seances.filter(s=>s._garminId).map(s=>s._garminId)),[seances]);
  const [search,    setSearch]    = useState("");
  const [sortKey,   setSortKey]   = useState("date");
  const [sortDir,   setSortDir]   = useState(-1);
  const [copied,    setCopied]    = useState(null);
  const [linkAct,   setLinkAct]   = useState(null);
  const activitesRef = useRef();

  const copyID = (dateHeure) => {
    navigator.clipboard.writeText(dateHeure).then(()=>{
      setCopied(dateHeure);
      setTimeout(()=>setCopied(null), 2000);
    });
  };

  const handleImport = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=(ev)=>{
      const imp=parseCSVActivities(ev.target.result);
      const ex=new Set(activites.map(a=>a.dateHeure).filter(Boolean));
      const news=imp.filter(a=>!ex.has(a.dateHeure));
      setActivites(as=>[...as,...news]);
    }; r.readAsText(file); e.target.value="";
  };

  const updAct = (id,k,v) => setActivites(as=>as.map(a=>a.id===id?{...a,[k]:v}:a));
  const delAct = (id)    => setActivites(as=>as.filter(a=>a.id!==id));

  const filtered = useMemo(()=>{
    let list=[...activites];
    if(search) list=list.filter(a=>
      (a.titre||"").toLowerCase().includes(search.toLowerCase())||
      (a.type||"").toLowerCase().includes(search.toLowerCase())||
      (a.date||"").includes(search)
    );
    list.sort((a,b)=>{
      const av=a[sortKey]||""; const bv=b[sortKey]||"";
      return sortDir*(av<bv?-1:av>bv?1:0);
    });
    return list;
  },[activites,search,sortKey,sortDir]);

  const thStyle = (k) => ({
    cursor:"pointer", userSelect:"none", padding:"6px 6px",
    fontSize:9, fontWeight:600, color:sortKey===k?C.forest:C.muted,
    textTransform:"uppercase", letterSpacing:"0.04em",
    background:C.stone, borderRight:`1px solid ${C.border}`,
    whiteSpace:"nowrap",
  });
  const sort = (k) => { if(sortKey===k) setSortDir(d=>-d); else {setSortKey(k);setSortDir(-1);}};

  const inpZ = {fontSize:10,padding:"1px 3px",borderRadius:4,border:`1px solid ${C.border}`,width:38,textAlign:"center",background:C.bg,fontFamily:"'DM Mono',monospace"};

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight}}>Activités</h1>
          <p style={{fontSize:11,color:C.muted}}>{activites.length} activité(s) · Cliquer sur l'ID pour le copier, puis le coller dans Programme</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <input ref={activitesRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleImport}/>
          <Btn variant="sage" size="sm" onClick={()=>activitesRef.current?.click()}>⬆ Import Garmin CSV</Btn>
        </div>
      </div>

      {/* Recherche */}
      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Rechercher par titre, type, date..."
        style={{marginBottom:12,padding:"7px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,width:"100%",maxWidth:400,background:C.white}}
      />

      {/* Tableau */}
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          {/* Header */}
          <div style={{display:"grid",gridTemplateColumns:"70px 90px 180px 120px 200px 90px 110px 80px 80px 70px 70px 68px 68px 68px 68px 68px 40px",minWidth:1580,borderBottom:`1px solid ${C.border}`}}>
            {[["","Statut"],["","Lier"],["dateHeure","ID (date + heure)"],["type","Type"],["titre","Titre"],["distance","Dist."],["duree","Durée"],["fcMoy","FC Ø"],["fcMax","FC Max"],["dp","D+"],["calories","Cal."],["","Z0%"],["z1","Z1%"],["z2","Z2%"],["z3","Z3%"],["z4","Z4%"],["z5","Z5%"],["",""]].map(([k,l])=>(
              <div key={k||"del"} style={{...thStyle(k)}} onClick={()=>k&&sort(k)}>{l}{sortKey===k?sortDir>0?" ↑":" ↓":""}</div>
            ))}
          </div>
          {/* Rows */}
          <div style={{maxHeight:500,overflowY:"auto"}}>
            {filtered.length===0 && (
              <div style={{padding:"32px",textAlign:"center",color:C.muted,fontSize:13}}>Aucune activité · Importer un fichier Activities.csv depuis Garmin Connect</div>
            )}
            {filtered.map(a=>{
              const showZ=true; // zones FC pour toutes les activités
              const isCopied=copied===a.dateHeure;
              return (
                <div key={a.id} style={{display:"grid",gridTemplateColumns:"70px 90px 180px 120px 200px 90px 110px 80px 80px 70px 70px 68px 68px 68px 68px 68px 40px",borderTop:`1px solid ${C.border}`,alignItems:"center",minWidth:1580,background:"transparent"}}>
                  {/* Statut lié */}
                  <div style={{padding:"4px 6px",display:"flex",justifyContent:"center",borderRight:`1px solid ${C.border}`}}>
                    <span style={{
                      fontSize:9,fontWeight:600,padding:"2px 6px",borderRadius:4,whiteSpace:"nowrap",
                      background:liees.has(a.dateHeure)?C.forestPale:C.stone,
                      color:liees.has(a.dateHeure)?C.forest:C.stoneDeep,
                    }}>
                      {liees.has(a.dateHeure)?"✓ Lié":"— Libre"}
                    </span>
                  </div>
                  {/* Bouton Lier — col 2 */}
                  <div style={{padding:"4px 8px",display:"flex",justifyContent:"center",borderRight:`1px solid ${C.border}`}}>
                    <button onClick={()=>setLinkAct(a)}
                      style={{fontSize:11,padding:"3px 10px",borderRadius:6,cursor:"pointer",fontWeight:500,
                        border:`0.5px solid ${liees.has(a.dateHeure)?C.forest:C.border}`,
                        background:liees.has(a.dateHeure)?C.forestPale:C.stone,
                        color:liees.has(a.dateHeure)?C.forest:C.sky,whiteSpace:"nowrap"}}>
                      {liees.has(a.dateHeure)?"✓ Lié":"→ Lier"}
                    </button>
                  </div>
                  {/* ID cliquable */}
                  <div
                    onClick={()=>copyID(a.dateHeure)}
                    title="Cliquer pour copier l'ID"
                    style={{padding:"5px 6px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10,
                      color:isCopied?C.green:C.sky,background:isCopied?C.greenPale:C.skyPale+"66",
                      borderRight:`1px solid ${C.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                      display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:9,flexShrink:0}}>{isCopied?"✓":"⎘"}</span>
                    {isCopied?"Copié !" : a.dateHeure}
                  </div>
                  <div style={{padding:"5px 6px",fontSize:10,color:C.inkLight,borderRight:`1px solid ${C.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    <span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:actColor(a.type||"Trail"),marginRight:4,verticalAlign:"middle",flexShrink:0}}/>
                    {a.type||"—"}
                  </div>
                  <div style={{padding:"5px 6px",fontSize:10,color:C.inkLight,borderRight:`1px solid ${C.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={a.titre}>{a.titre||"—"}</div>
                  {[
                    {k:"distance",u:"km"},{k:"duree",u:""},{k:"fcMoy",u:""},{k:"fcMax",u:""},{k:"dp",u:"m"},{k:"calories",u:""},
                  ].map(({k,u})=>(
                    <div key={k} style={{padding:"3px 4px",borderRight:`1px solid ${C.border}`}}>
                      <input value={a[k]||""} onChange={e=>updAct(a.id,k,e.target.value)}
                        style={{fontSize:10,padding:"1px 3px",border:`1px solid ${C.border}`,borderRadius:4,width:"100%",background:C.bg,fontFamily:"'DM Mono',monospace",textAlign:"right"}}/>
                    </div>
                  ))}
                  {/* Z0 calculée */}
                  <div style={{padding:"3px 4px",borderRight:`1px solid ${C.border}`}}>
                    {showZ&&(a.z1||a.z2||a.z3||a.z4||a.z5) ? (
                      <div style={{fontSize:11,padding:"2px 4px",border:`1px solid ${C.border}`,borderRadius:4,width:"100%",textAlign:"center",background:C.stone,fontFamily:"'DM Mono',monospace",color:C.muted}}>
                        {Math.max(0,100-["z1","z2","z3","z4","z5"].reduce((s,k)=>s+(parseFloat(a[k])||0),0))}
                      </div>
                    ) : <span style={{fontSize:9,color:C.stoneDark,textAlign:"center",display:"block"}}>—</span>}
                  </div>
                  {/* Zones FC */}
                  {["z1","z2","z3","z4","z5"].map(z=>(
                    <div key={z} style={{padding:"3px 4px",borderRight:`1px solid ${C.border}`}}>
                      {showZ
                        ? <input type="number" min="0" max="100" step="1" value={a[z]||""}
                            onChange={e=>updAct(a.id,z,e.target.value)}
                            style={{fontSize:11,padding:"2px 4px",border:`1px solid ${C.border}`,borderRadius:4,width:"100%",textAlign:"center",background:C.bg,fontFamily:"'DM Mono',monospace"}}/>
                        : <span style={{fontSize:9,color:C.border,padding:"0 4px"}}>—</span>
                      }
                    </div>
                  ))}
                  <div style={{padding:"3px 4px",display:"flex",justifyContent:"center"}}>
                    <button onClick={()=>delAct(a.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:11,padding:0}}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <LinkModal linkAct={linkAct} seances={seances} setSeances={setSeances} onClose={()=>setLinkAct(null)}/>
    </div>
  );
}

// ─── LINK MODAL ───────────────────────────────────────────────────────────────
function LinkModal({ linkAct, seances, setSeances, onClose }) {
  if(!linkAct) return null;
  const dateAct=linkAct.dateHeure?.slice(0,10)||"";
  const candidates=seances
    .filter(s=>s.date===dateAct)
    .sort((a,b)=>a.demiJournee.localeCompare(b.demiJournee));
  const doLink=(sid)=>{
    setSeances(ss=>ss.map(s=>s.id!==sid?s:{...s,
      _garminId:linkAct.dateHeure,garminTitre:linkAct.titre||"",
      dureeGarmin:linkAct.duree||"",kmGarmin:linkAct.distance||"",
      dpGarmin:linkAct.dp||"",fcMoy:linkAct.fcMoy||"",fcMax:linkAct.fcMax||"",
      cal:linkAct.calories||"",allure:linkAct.gapMoy||linkAct.allure||"",
      z1:linkAct.z1||"",z2:linkAct.z2||"",z3:linkAct.z3||"",
      z4:linkAct.z4||"",z5:linkAct.z5||"",
      statut:s.statut==="Planifié"?"Effectué":s.statut}));
    onClose();
  };
  const doUnlink=(sid)=>{
    setSeances(ss=>ss.map(s=>s.id!==sid?s:{...s,
      _garminId:"",garminTitre:"",dureeGarmin:"",kmGarmin:"",dpGarmin:"",
      fcMoy:"",fcMax:"",cal:"",allure:"",z1:"",z2:"",z3:"",z4:"",z5:""}));
  };
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(28,25,22,0.5)",
      backdropFilter:"blur(3px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:16,
        padding:"24px 28px",width:"min(520px,92vw)",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:500,
          color:C.inkLight,marginBottom:4}}>Lier à une séance</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:16}}>
          {fmtDate(dateAct)} · {linkAct.type} · {linkAct.titre||"—"}{linkAct.distance?` · ${linkAct.distance}km`:""}
        </div>
        {candidates.length===0
          ?<div style={{padding:"24px",textAlign:"center",color:C.muted,fontSize:13}}>Aucune séance planifiée ce jour-là.</div>
          :<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {candidates.map(s=>{
              const isLinked=s._garminId===linkAct.dateHeure;
              const hasOther=!!(s._garminId&&!isLinked);
              return (
                <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"12px 16px",borderRadius:10,
                  background:isLinked?C.forestPale:hasOther?C.yellowPale:C.stone,
                  border:`1px solid ${isLinked?C.forest:hasOther?C.yellow:C.border}`}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>
                      {fmtDate(s.date)} · {s.demiJournee.split(" ")[1]} · {actShort(s.activite)}
                    </div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                      {s.commentaire||""}{s.kmObj?` · ${s.kmObj}km`:""}{s.dpObj?` · ${s.dpObj}m↑`:""}
                      {hasOther&&<span style={{color:C.yellow,marginLeft:6}}>⚠ déjà lié</span>}
                    </div>
                  </div>
                  {isLinked
                    ?<button onClick={()=>doUnlink(s.id)} style={{fontSize:11,padding:"4px 12px",borderRadius:6,
                        flexShrink:0,marginLeft:12,border:`1px solid ${C.red}44`,background:C.redPale,
                        color:C.red,cursor:"pointer",fontFamily:"inherit"}}>Délier</button>
                    :<button onClick={()=>doLink(s.id)} style={{fontSize:11,padding:"4px 12px",borderRadius:6,
                        flexShrink:0,marginLeft:12,border:`1px solid ${C.forest}`,background:C.forest,
                        color:C.white,cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>Lier →</button>
                  }
                </div>
              );
            })}
          </div>
        }
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}>
          <Btn variant="ghost" onClick={onClose}>Fermer</Btn>
        </div>
      </div>
    </div>
  );
}


// ─── JOURNAL NUTRITIONNEL
const emptyJourEntry = () => ({
  id: Date.now()+Math.random(),
  date: localDate(new Date()),
  kcalBrulees: "", kcalConso: "",
  proteines: "", lipides: "", glucides: "",
  notes: "",
});

function JournalNutri({ journalNutri, setJournalNutri }) {
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState(emptyJourEntry());
  const [editId,    setEditId]    = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [importRef] = useState(()=>({current:null}));
  const fileRef = useRef();

  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const openNew  = ()  => { setEditId(null);  setForm(emptyJourEntry()); setModal(true); };
  const openEdit = (e) => { setEditId(e.id);  setForm({...emptyJourEntry(),...e});        setModal(true); };

  const save = () => {
    const item = {
      ...form,
      kcalBrulees: parseFloat(form.kcalBrulees)||"",
      kcalConso:   parseFloat(form.kcalConso)||"",
      proteines:   parseFloat(form.proteines)||"",
      lipides:     parseFloat(form.lipides)||"",
      glucides:    parseFloat(form.glucides)||"",
    };
    if(editId) setJournalNutri(jj=>jj.map(j=>j.id===editId?item:j));
    else       setJournalNutri(jj=>[...jj,item]);
    setModal(false);
  };

  const del = (id) => { setJournalNutri(jj=>jj.filter(j=>j.id!==id)); setConfirmId(null); };

  // Import depuis JSON stride (champ journalNutri ou nutrition)
  const handleImport = (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const raw = data.journalNutri || data.nutrition || [];
        const existing = new Set(journalNutri.map(j=>j.date));
        const news = raw.filter(j=>j.date&&!existing.has(j.date)).map(j=>({
          ...emptyJourEntry(), ...j, id: Date.now()+Math.random(),
        }));
        setJournalNutri(jj=>[...jj,...news]);
      } catch { alert("Format non reconnu"); }
    };
    r.readAsText(file,"utf-8"); e.target.value="";
  };

  const sorted = useMemo(()=>[...journalNutri].sort((a,b)=>new Date(b.date)-new Date(a.date)),[journalNutri]);

  // Stats 7 derniers jours
  const last7 = useMemo(()=>{
    const since = localDate(new Date(Date.now()-6*86400000));
    return sorted.filter(j=>j.date>=since);
  },[sorted]);

  const avg = (key) => {
    const vals = last7.map(j=>parseFloat(j[key])||0).filter(v=>v>0);
    return vals.length ? Math.round(vals.reduce((s,v)=>s+v,0)/vals.length) : null;
  };

  const avgKcalBrulees = avg("kcalBrulees");
  const avgKcalConso   = avg("kcalConso");
  const avgDelta       = avgKcalBrulees&&avgKcalConso ? avgKcalBrulees-avgKcalConso : null;

  const card = {background:C.white,border:`1px solid ${C.border}`,borderRadius:12};
  const lbl  = {fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted};

  const COLS_KCAL = [
    {k:"kcalBrulees", l:"Kcal conso.",  col:"#185FA5"},
    {k:"kcalConso",   l:"Kcal brûlées", col:"#e65100"},
  ];
  const COLS_MACRO = [
    {k:"proteines",   l:"Prot. (g)",    col:"#1d9e75"},
    {k:"lipides",     l:"Lip. (g)",     col:"#7F77DD"},
    {k:"glucides",    l:"Gluc. (g)",    col:"#BA7517"},
  ];

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Journal nutritionnel</h1>
          <p style={{fontSize:12,color:C.muted}}>Suivi quotidien · Kcal brûlées vs consommées · Macros</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={handleImport}/>
          <Btn variant="ghost" size="sm" onClick={()=>fileRef.current?.click()}>⬆ Importer JSON</Btn>
          <Btn onClick={openNew}>＋ Entrée</Btn>
        </div>
      </div>

      {/* KPIs 7j */}
      {last7.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
          {[
            {l:"Kcal conso. moy. (7j)",   v:avgKcalBrulees, col:"#185FA5", unit:"kcal"},
            {l:"Kcal brûlées moy. (7j)",  v:avgKcalConso,   col:"#e65100", unit:"kcal"},
            {l:"Delta moyen (7j)",         v:avgDelta,       col:avgDelta===null?C.muted:avgDelta<0?C.green:C.red, unit:"kcal"},
            {l:"Jours enregistrés (7j)",   v:last7.length,   col:C.forest,  unit:"/ 7"},
          ].map(({l,v,col,unit})=>(
            <div key={l} style={{background:C.stone,borderRadius:10,padding:"12px 16px"}}>
              <div style={{...lbl,marginBottom:6}}>{l}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:24,fontWeight:500,color:col,lineHeight:1}}>
                {v!==null?v:"—"}
                <span style={{fontSize:12,color:C.muted,fontWeight:400,marginLeft:4}}>{v!==null?unit:""}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tableau */}
      {sorted.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>📊</div>
          <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Aucune entrée</div>
          <div style={{fontSize:13,marginBottom:20}}>Enregistre tes données nutritionnelles quotidiennes</div>
          <Btn onClick={openNew}>＋ Ajouter aujourd'hui</Btn>
        </div>
      ):(
        <div style={{...card,overflow:"hidden"}}>
          {/* Header */}
          <div style={{display:"grid",gridTemplateColumns:"110px 1fr 1fr 90px 1fr 1fr 1fr 1fr 32px",
            padding:"8px 16px",background:C.stone,gap:8,
            fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>
            <span>Date</span>
            {COLS_KCAL.map(({l})=><span key={l} style={{textAlign:"right"}}>{l}</span>)}
            <span style={{textAlign:"right"}}>Delta Kcal</span>
            {COLS_MACRO.map(({l})=><span key={l} style={{textAlign:"right"}}>{l}</span>)}
            <span>Notes</span>
            <span/>
          </div>
          <div style={{maxHeight:520,overflowY:"auto"}}>
            {sorted.map(j=>{
              const delta = (parseFloat(j.kcalBrulees)||0)-(parseFloat(j.kcalConso)||0);
              const hasDelta = j.kcalBrulees&&j.kcalConso;
              const deltaColor = !hasDelta?C.muted:delta<-100?C.green:delta>100?C.red:C.muted;
              return (
                <div key={j.id}
                  style={{display:"grid",gridTemplateColumns:"110px 1fr 1fr 90px 1fr 1fr 1fr 1fr 32px",
                    padding:"9px 16px",borderTop:`1px solid ${C.border}`,gap:8,alignItems:"center",cursor:"pointer"}}
                  onClick={()=>openEdit(j)}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted}}>{fmtDate(j.date)}</span>
                  {COLS_KCAL.map(({k,col})=>(
                    <span key={k} style={{fontFamily:"'DM Mono',monospace",fontSize:12,
                      textAlign:"right",color:(j[k])?col:C.stoneDeep,fontWeight:j[k]?500:400}}>
                      {j[k]||"—"}
                    </span>
                  ))}
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,textAlign:"right",fontWeight:500,color:deltaColor}}>
                    {hasDelta?(delta>0?"+":"")+delta:"—"}
                  </span>
                  {COLS_MACRO.map(({k,col})=>(
                    <span key={k} style={{fontFamily:"'DM Mono',monospace",fontSize:12,
                      textAlign:"right",color:(j[k])?col:C.stoneDeep,fontWeight:j[k]?500:400}}>
                      {j[k]||"—"}
                    </span>
                  ))}
                  <span style={{fontSize:11,color:C.muted,fontStyle:"italic",
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {j.notes||""}
                  </span>
                  <button onClick={e=>{e.stopPropagation();setConfirmId(j.id);}}
                    style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal saisie */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editId?"Modifier l'entrée":"Nouvelle entrée"} width={480}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Date" full>
            <input type="date" value={form.date} onChange={e=>upd("date",e.target.value)} style={{width:"100%"}}/>
          </Field>
          <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Kcal consommées">
              <input type="number" min="0" value={form.kcalBrulees||""} onChange={e=>upd("kcalBrulees",e.target.value)}
                placeholder="ex: 2500" style={{width:"100%"}}/>
            </Field>
            <Field label="Kcal brûlées">
              <input type="number" min="0" value={form.kcalConso||""} onChange={e=>upd("kcalConso",e.target.value)}
                placeholder="ex: 2100" style={{width:"100%"}}/>
            </Field>
          </div>
          {/* Delta live */}
          {form.kcalBrulees&&form.kcalConso&&(()=>{
            const d=(parseFloat(form.kcalBrulees)||0)-(parseFloat(form.kcalConso)||0);
            const col=d<-100?C.green:d>100?C.red:C.muted;
            return (
              <div style={{gridColumn:"1/-1",background:C.stone,borderRadius:8,padding:"8px 14px",
                display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:12,color:C.muted}}>Delta kcal</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:500,color:col}}>
                  {d>0?"+":""}{d} kcal
                  <span style={{fontSize:11,color:C.muted,marginLeft:8}}>
                    {d<-200?"Déficit calorique":d>200?"Surplus calorique":"Équilibré"}
                  </span>
                </span>
              </div>
            );
          })()}
          <div style={{gridColumn:"1/-1"}}>
            <div style={{...lbl,marginBottom:8}}>Macros</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[{k:"proteines",l:"Protéines (g)"},{k:"lipides",l:"Lipides (g)"},{k:"glucides",l:"Glucides (g)"}].map(({k,l})=>(
                <div key={k}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{l}</div>
                  <input type="number" min="0" step="0.1" value={form[k]||""}
                    onChange={e=>upd(k,e.target.value)}
                    style={{width:"100%",fontSize:12,padding:"6px 10px",borderRadius:7,border:`1px solid ${C.border}`,textAlign:"right"}}/>
                </div>
              ))}
            </div>
          </div>
          <Field label="Notes" full>
            <input value={form.notes||""} onChange={e=>upd("notes",e.target.value)}
              placeholder="Contexte, ressenti, observations..." style={{width:"100%"}}/>
          </Field>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setModal(false)}>Annuler</Btn>
          <Btn onClick={save}>{editId?"Enregistrer":"Ajouter"}</Btn>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmId} message="Supprimer cette entrée ?"
        onConfirm={()=>del(confirmId)} onCancel={()=>setConfirmId(null)}/>
    </div>
  );
}

// ─── NUTRITION ────────────────────────────────────────────────────────────────
const MACROS = [
  {k:"kcal",     label:"Kcal",     unit:"kcal",  color:"#e65100"},
  {k:"glucides", label:"Glucides", unit:"g",     color:"#1d9e75"},
  {k:"proteines",label:"Protéines",unit:"g",     color:"#185FA5"},
  {k:"lipides",  label:"Lipides",  unit:"g",     color:"#7F77DD"},
  {k:"sodium",   label:"Sodium",   unit:"mg",    color:"#BA7517"},
];

const emptyProduit = () => ({id:Date.now()+Math.random(),nom:"",kcal:"",glucides:"",proteines:"",lipides:"",sodium:"",potassium:"",magnesium:"",categorie:"",notes:""});
const emptyRecette = () => ({id:Date.now()+Math.random(),nom:"",description:"",usage:"Entraînement",portions:1,ingredients:[],notes:""});

function Nutrition({ produits, setProduits, recettes, setRecettes, seances, setSeances }) {
  const [tab,           setTab]           = useState("produits");
  const [prodModal,     setProdModal]     = useState(false);
  const [prodForm,      setProdForm]      = useState(emptyProduit());
  const [editProdId,    setEditProdId]    = useState(null);
  const [confirmProdId, setConfirmProdId] = useState(null);
  const [recModal,      setRecModal]      = useState(false);
  const [recForm,       setRecForm]       = useState(emptyRecette());
  const [editRecId,     setEditRecId]     = useState(null);
  const [confirmRecId,  setConfirmRecId]  = useState(null);
  const [linkModal,     setLinkModal]     = useState(null); // recette à lier
  const [search,        setSearch]        = useState("");
  const [copied,        setCopied]        = useState(false);

  const updP = (k,v) => setProdForm(f=>({...f,[k]:v}));
  const updR = (k,v) => setRecForm(f=>({...f,[k]:v}));

  // CRUD produits
  const saveProduit = () => {
    if(!prodForm.nom.trim()) return;
    const item = {...prodForm, id:editProdId||Date.now()+Math.random(),
      kcal:parseFloat(prodForm.kcal)||0, glucides:parseFloat(prodForm.glucides)||0,
      proteines:parseFloat(prodForm.proteines)||0, lipides:parseFloat(prodForm.lipides)||0,
      sodium:parseFloat(prodForm.sodium)||0};
    if(editProdId) setProduits(pp=>pp.map(p=>p.id===editProdId?item:p));
    else setProduits(pp=>[...pp,item]);
    setProdModal(false);
  };
  const delProduit = (id) => { setProduits(pp=>pp.filter(p=>p.id!==id)); setConfirmProdId(null); };

  // CRUD recettes
  const saveRecette = () => {
    if(!recForm.nom.trim()) return;
    const item = {...recForm, id:editRecId||Date.now()+Math.random(),
      portions:parseInt(recForm.portions)||1};
    if(editRecId) setRecettes(rr=>rr.map(r=>r.id===editRecId?item:r));
    else setRecettes(rr=>[...rr,item]);
    setRecModal(false);
  };
  const delRecette = (id) => { setRecettes(rr=>rr.filter(r=>r.id!==id)); setConfirmRecId(null); };

  // Calcul macros d'une recette (somme des ingrédients)
  const calcMacros = (rec) => {
    return (rec.ingredients||[]).reduce((acc,ing)=>{
      const prod = produits.find(p=>p.id===ing.produitId);
      if(!prod) return acc;
      const factor = parseFloat(ing.quantite)||0;
      return {
        kcal:      acc.kcal      + Math.round((prod.kcal     ||0)*factor/100),
        glucides:  acc.glucides  + Math.round((prod.glucides ||0)*factor/100),
        proteines: acc.proteines + Math.round((prod.proteines||0)*factor/100),
        lipides:   acc.lipides   + Math.round((prod.lipides  ||0)*factor/100),
        sodium:    acc.sodium    + Math.round((prod.sodium   ||0)*factor/100),
      };
    },{kcal:0,glucides:0,proteines:0,lipides:0,sodium:0});
  };

  // Lier recette à une séance
  const linkRecetteToSeance = (seanceId, recetteId) => {
    setSeances(ss=>ss.map(s=>s.id===seanceId?{...s,recetteId}:s));
    setLinkModal(null);
  };
  const unlinkRecette = (seanceId) => {
    setSeances(ss=>ss.map(s=>s.id===seanceId?{...s,recetteId:undefined}:s));
  };

  // Export bibliothèque vers Alex
  const exportToAlex = () => {
    const payload = {
      _stride_nutrition: "1.0",
      produits: produits.map(p=>({
        nom:p.nom, kcal:p.kcal||0, proteines:p.proteines||0,
        lipides:p.lipides||0, glucides:p.glucides||0,
        sodium:p.sodium||0, potassium:p.potassium||0,
        magnesium:p.magnesium||0, categorie:p.categorie||"",
        notes:p.notes||"",
      })),
      recettes: recettes.map(r=>({
        nom:r.nom, description:r.description||"",
        usage:r.usage||"", portions:r.portions||1,
        ingredients:(r.ingredients||[]).map(i=>{
          const p=produits.find(x=>x.id===i.produitId);
          return {produit:p?.nom||"", quantite:i.quantite||0};
        }),
        macros: calcMacros(r),
        notes:r.notes||"",
      })),
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url;
    a.download=`stride-nutrition-${localDate(new Date())}.json`; a.click();
    URL.revokeObjectURL(url);
    setCopied(true); setTimeout(()=>setCopied(false),2500);
  };

  const filteredProduits = useMemo(()=>{
    if(!search) return produits;
    return produits.filter(p=>(p.nom||"").toLowerCase().includes(search.toLowerCase())||(p.categorie||"").toLowerCase().includes(search.toLowerCase()));
  },[produits,search]);

  // Séances effectuées (trail) pour liaison recettes
  const seancesEff = useMemo(()=>
    [...seances].filter(s=>s.statut==="Effectué"&&isRunning(s.activite))
      .sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,50)
  ,[seances]);

  const card = {background:C.white,border:`1px solid ${C.border}`,borderRadius:12};
  const lbl = {fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted};
  const inp = {fontSize:13,padding:"6px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,width:"100%"};

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Recettes & Produits</h1>
          <p style={{fontSize:12,color:C.muted}}>Bibliothèque de produits · Recettes · Liaison aux entraînements · Export Alex</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="sage" size="sm" onClick={exportToAlex}>{copied?"✓ Exporté !":"→ Exporter vers Alex"}</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,marginBottom:20}}>
        {[{id:"produits",label:`Produits (${produits.length})`},{id:"recettes",label:`Recettes (${recettes.length})`},{id:"historique",label:"Historique entraînements"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:"none",border:"none",padding:"8px 16px",cursor:"pointer",fontSize:13,
              fontWeight:tab===t.id?500:400,color:tab===t.id?C.forest:C.muted,
              borderBottom:tab===t.id?`2px solid ${C.forest}`:"2px solid transparent",marginBottom:-1,fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PRODUITS ── */}
      {tab==="produits"&&(
        <div>
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              style={{...inp,maxWidth:320}}/>
            <Btn onClick={()=>{setEditProdId(null);setProdForm(emptyProduit());setProdModal(true);}}>＋ Produit</Btn>
          </div>

          {filteredProduits.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>🥗</div>
              <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Bibliothèque vide</div>
              <div style={{fontSize:13}}>Ajoutez vos produits nutrition (gels, barres, boissons...)</div>
            </div>
          ):(
            <div style={{...card,overflow:"hidden"}}>
              {/* Header */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 80px 80px 80px 32px",
                padding:"8px 16px",background:C.stone,gap:8,
                fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>
                <span>Produit</span><span style={{textAlign:"right"}}>Kcal</span>
                <span style={{textAlign:"right"}}>Gluc.</span><span style={{textAlign:"right"}}>Prot.</span>
                <span style={{textAlign:"right"}}>Lip.</span><span style={{textAlign:"right"}}>Na (mg)</span>
                <span style={{textAlign:"right"}}>Catégorie</span><span/>
              </div>
              <div style={{maxHeight:480,overflowY:"auto"}}>
                {filteredProduits.map(p=>(
                  <div key={p.id}
                    style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 80px 80px 80px 32px",
                      padding:"9px 16px",borderTop:`1px solid ${C.border}`,gap:8,alignItems:"center",cursor:"pointer"}}
                    onClick={()=>{setEditProdId(p.id);setProdForm({...emptyProduit(),...p});setProdModal(true);}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>{p.nom}</div>
                      {p.notes&&<div style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>{p.notes.slice(0,40)}</div>}
                    </div>
                    {[p.kcal,p.glucides,p.proteines,p.lipides,p.sodium].map((v,i)=>(
                      <span key={i} style={{fontFamily:"'DM Mono',monospace",fontSize:12,textAlign:"right",
                        color:MACROS[i]?.color||C.inkLight,fontWeight:500}}>{v||"—"}</span>
                    ))}
                    <span style={{fontSize:11,color:C.muted,textAlign:"right"}}>{p.categorie||"—"}</span>
                    <button onClick={e=>{e.stopPropagation();setConfirmProdId(p.id);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal produit */}
          <Modal open={prodModal} onClose={()=>setProdModal(false)} title={editProdId?"Modifier le produit":"Nouveau produit"} width={520}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Nom" full><input value={prodForm.nom} onChange={e=>updP("nom",e.target.value)} placeholder="Gel énergétique Maurten" style={{width:"100%"}}/></Field>
              <Field label="Catégorie"><input value={prodForm.categorie||""} onChange={e=>updP("categorie",e.target.value)} placeholder="Gel, Barre, Boisson..." style={{width:"100%"}}/></Field>
              <div style={{gridColumn:"1/-1"}}>
                <div style={{...lbl,marginBottom:8}}>Valeurs pour 100g (ou par unité)</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
                  {MACROS.map(({k,label,unit})=>(
                    <div key={k}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{label} ({unit})</div>
                      <input type="number" min="0" step="0.1" value={prodForm[k]||""}
                        onChange={e=>updP(k,e.target.value)}
                        style={{width:"100%",fontSize:12,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,textAlign:"right"}}/>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {[{k:"potassium",l:"Potassium (mg)"},{k:"magnesium",l:"Magnésium (mg)"}].map(({k,l})=>(
                    <div key={k}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{l}</div>
                      <input type="number" min="0" value={prodForm[k]||""}
                        onChange={e=>updP(k,e.target.value)}
                        style={{width:"100%",fontSize:12,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,textAlign:"right"}}/>
                    </div>
                  ))}
                </div>
              </div>
              <Field label="Notes" full><input value={prodForm.notes||""} onChange={e=>updP("notes",e.target.value)} placeholder="Usage conseillé, goût, source..." style={{width:"100%"}}/></Field>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
              <Btn variant="ghost" onClick={()=>setProdModal(false)}>Annuler</Btn>
              <Btn onClick={saveProduit}>{editProdId?"Enregistrer":"Ajouter"}</Btn>
            </div>
          </Modal>
          <ConfirmDialog open={!!confirmProdId} message="Supprimer ce produit ?" onConfirm={()=>delProduit(confirmProdId)} onCancel={()=>setConfirmProdId(null)}/>
        </div>
      )}

      {/* ── RECETTES ── */}
      {tab==="recettes"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
            <Btn onClick={()=>{setEditRecId(null);setRecForm(emptyRecette());setRecModal(true);}}>＋ Recette</Btn>
          </div>

          {recettes.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>🍽️</div>
              <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Aucune recette</div>
              <div style={{fontSize:13}}>Créez vos gels maison, barres énergétiques, boissons de course...</div>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
              {recettes.map(rec=>{
                const macros=calcMacros(rec);
                const linked=seances.filter(s=>s.recetteId===rec.id);
                return (
                  <div key={rec.id} style={{...card,padding:"18px 20px",cursor:"pointer"}}
                    onClick={()=>{setEditRecId(rec.id);setRecForm({...emptyRecette(),...rec,ingredients:rec.ingredients||[]});setRecModal(true);}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:600,color:C.inkLight}}>{rec.nom}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:2}}>{rec.usage||""} · {rec.portions} portion(s)</div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();setConfirmRecId(rec.id);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:14,padding:0}}>✕</button>
                    </div>
                    {rec.description&&<div style={{fontSize:12,color:C.muted,marginBottom:10,fontStyle:"italic"}}>{rec.description}</div>}
                    {/* Macros */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,marginBottom:10}}>
                      {MACROS.map(({k,label,color})=>(
                        <div key={k} style={{textAlign:"center",background:C.stone,borderRadius:6,padding:"6px 4px"}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,color}}>{macros[k]||0}</div>
                          <div style={{fontSize:9,color:C.muted,textTransform:"uppercase"}}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Ingrédients */}
                    {(rec.ingredients||[]).length>0&&(
                      <div style={{fontSize:11,color:C.muted,marginBottom:10}}>
                        {(rec.ingredients||[]).map(i=>{const p=produits.find(x=>x.id===i.produitId);return p?`${p.nom} (${i.quantite}g)`:null;}).filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {/* Séances liées */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontSize:11,color:linked.length>0?C.forest:C.stoneDeep}}>
                        {linked.length>0?`✓ ${linked.length} entraînement(s) lié(s)`:"Non testé en entraînement"}
                      </span>
                      <button onClick={e=>{e.stopPropagation();setLinkModal(rec);}}
                        style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:`1px solid ${C.border}`,
                          cursor:"pointer",background:C.bg,color:C.sky}}>
                        Lier →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal recette */}
          <Modal open={recModal} onClose={()=>setRecModal(false)} title={editRecId?"Modifier la recette":"Nouvelle recette"} width={580}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Nom" full><input value={recForm.nom} onChange={e=>updR("nom",e.target.value)} placeholder="Gel maison Verdon" style={{width:"100%"}}/></Field>
              <Field label="Usage">
                <select value={recForm.usage||"Entraînement"} onChange={e=>updR("usage",e.target.value)} style={{width:"100%"}}>
                  {["Entraînement","Course","Ravitaillement","Récupération","Quotidien"].map(u=><option key={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Portions"><input type="number" min="1" value={recForm.portions||1} onChange={e=>updR("portions",e.target.value)} style={{width:"100%"}}/></Field>
              <Field label="Description" full><input value={recForm.description||""} onChange={e=>updR("description",e.target.value)} placeholder="Description courte..." style={{width:"100%"}}/></Field>
            </div>

            {/* Ingrédients */}
            <div style={{marginTop:16}}>
              <div style={{...lbl,marginBottom:10}}>Ingrédients</div>
              {(recForm.ingredients||[]).map((ing,i)=>{
                const p=produits.find(x=>x.id===ing.produitId);
                return (
                  <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:7}}>
                    <select value={ing.produitId||""} onChange={e=>updR("ingredients",(recForm.ingredients||[]).map((x,j)=>j===i?{...x,produitId:parseFloat(e.target.value)||e.target.value}:x))}
                      style={{flex:1,fontSize:12,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`}}>
                      <option value="">— Choisir un produit</option>
                      {produits.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
                    </select>
                    <input type="number" min="0" placeholder="g" value={ing.quantite||""}
                      onChange={e=>updR("ingredients",(recForm.ingredients||[]).map((x,j)=>j===i?{...x,quantite:parseFloat(e.target.value)||0}:x))}
                      style={{width:70,fontSize:12,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,textAlign:"right"}}/>
                    <span style={{fontSize:11,color:C.muted}}>g</span>
                    <button onClick={()=>updR("ingredients",(recForm.ingredients||[]).filter((_,j)=>j!==i))}
                      style={{background:"none",border:"none",cursor:"pointer",color:C.red,fontSize:13}}>✕</button>
                  </div>
                );
              })}
              <Btn variant="soft" size="sm" onClick={()=>updR("ingredients",[...(recForm.ingredients||[]),{produitId:"",quantite:""}])}>＋ Ingrédient</Btn>
              {/* Preview macros */}
              {(recForm.ingredients||[]).length>0&&(()=>{
                const preview=(recForm.ingredients||[]).reduce((acc,ing)=>{
                  const prod=produits.find(p=>String(p.id)===String(ing.produitId));
                  if(!prod||!ing.quantite) return acc;
                  const f=parseFloat(ing.quantite)||0;
                  return {kcal:acc.kcal+Math.round((prod.kcal||0)*f/100),
                    glucides:acc.glucides+Math.round((prod.glucides||0)*f/100),
                    proteines:acc.proteines+Math.round((prod.proteines||0)*f/100),
                    lipides:acc.lipides+Math.round((prod.lipides||0)*f/100)};
                },{kcal:0,glucides:0,proteines:0,lipides:0});
                return (
                  <div style={{display:"flex",gap:12,marginTop:10,padding:"8px 12px",background:C.stone,borderRadius:8,fontSize:12}}>
                    {[["Kcal","kcal","#e65100"],["Glucides","glucides","#1d9e75"],["Protéines","proteines","#185FA5"],["Lipides","lipides","#7F77DD"]].map(([l,k,col])=>(
                      <span key={k}><span style={{color:C.muted}}>{l}: </span><span style={{fontWeight:500,color:col}}>{preview[k]}</span></span>
                    ))}
                  </div>
                );
              })()}
            </div>
            <Field label="Notes" full><input value={recForm.notes||""} onChange={e=>updR("notes",e.target.value)} placeholder="Préparation, conservation..." style={{width:"100%",marginTop:12}}/></Field>
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
              <Btn variant="ghost" onClick={()=>setRecModal(false)}>Annuler</Btn>
              <Btn onClick={saveRecette}>{editRecId?"Enregistrer":"Ajouter"}</Btn>
            </div>
          </Modal>
          <ConfirmDialog open={!!confirmRecId} message="Supprimer cette recette ?" onConfirm={()=>delRecette(confirmRecId)} onCancel={()=>setConfirmRecId(null)}/>

          {/* Modal lier recette → séance */}
          <Modal open={!!linkModal} onClose={()=>setLinkModal(null)} title={`Lier "${linkModal?.nom}" à un entraînement`} width={480}>
            <p style={{fontSize:12,color:C.muted,marginBottom:14}}>Sélectionne les séances où tu as testé cette recette.</p>
            <div style={{maxHeight:360,overflowY:"auto",display:"flex",flexDirection:"column",gap:7}}>
              {seancesEff.map(s=>{
                const isLinked=s.recetteId===linkModal?.id;
                return (
                  <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"10px 14px",borderRadius:8,background:isLinked?C.forestPale:C.stone,
                    border:`1px solid ${isLinked?C.forest:C.border}`}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>{s.activite}</div>
                      <div style={{fontSize:11,color:C.muted}}>{fmtDate(s.date)} · {s.kmGarmin?s.kmGarmin+"km":""} {s.dpGarmin?s.dpGarmin+"m↑":""}</div>
                    </div>
                    <button onClick={()=>isLinked?unlinkRecette(s.id):linkRecetteToSeance(s.id,linkModal?.id)}
                      style={{fontSize:11,padding:"4px 12px",borderRadius:6,cursor:"pointer",fontWeight:500,
                        border:`1px solid ${isLinked?C.forest:C.border}`,
                        background:isLinked?C.forest:"transparent",
                        color:isLinked?C.white:C.sky}}>
                      {isLinked?"✓ Lié":"Lier"}
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
              <Btn variant="ghost" onClick={()=>setLinkModal(null)}>Fermer</Btn>
            </div>
          </Modal>
        </div>
      )}

      {/* ── HISTORIQUE ── */}
      {tab==="historique"&&(
        <div>
          <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Entraînements liés à une recette — aperçu de ce qui a été testé.</p>
          {seancesEff.filter(s=>s.recetteId).length===0?(
            <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>🔗</div>
              <div style={{fontSize:14,color:C.inkLight,marginBottom:6}}>Aucune liaison</div>
              <div style={{fontSize:12}}>Dans l'onglet Recettes, clique sur "Lier →" pour associer une recette à un entraînement.</div>
            </div>
          ):(
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"110px 1fr 1fr 80px 80px 32px",
                padding:"8px 16px",background:C.stone,fontSize:10,fontWeight:600,color:C.muted,
                gap:8,textTransform:"uppercase",letterSpacing:"0.04em"}}>
                <span>Date</span><span>Séance</span><span>Recette testée</span><span style={{textAlign:"right"}}>Km</span><span style={{textAlign:"right"}}>D+</span><span/>
              </div>
              <div style={{maxHeight:480,overflowY:"auto"}}>
                {seancesEff.filter(s=>s.recetteId).map(s=>{
                  const rec=recettes.find(r=>r.id===s.recetteId);
                  const macros=rec?calcMacros(rec):{};
                  return (
                    <div key={s.id} style={{display:"grid",gridTemplateColumns:"110px 1fr 1fr 80px 80px 32px",
                      padding:"10px 16px",borderTop:`1px solid ${C.border}`,gap:8,alignItems:"center"}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted}}>{fmtDate(s.date)}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>{s.activite}</div>
                        {s.commentaire&&<div style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>{s.commentaire}</div>}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:C.forest}}>{rec?.nom||"—"}</div>
                        {rec&&<div style={{fontSize:11,color:C.muted}}>{macros.kcal}kcal · {macros.glucides}g gluc · {macros.proteines}g prot</div>}
                      </div>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,textAlign:"right",color:C.forest}}>{s.kmGarmin||"—"}</span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,textAlign:"right",color:C.muted}}>{s.dpGarmin||"—"}</span>
                      <button onClick={()=>unlinkRecette(s.id)}
                        style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:11}}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SEMAINE TYPE (sous-onglet Entraînement) ─────────────────────────────────
function SemaineType({ planningType, setPlanningType, seances, setSeances, activityTypes }) {
  const [form,      setForm]      = useState({...DEFAULT_PLANNING,...planningType});
  const [saved,     setSaved]     = useState(false);
  const [generated, setGenerated] = useState(false);

  const savePlanning = () => { setPlanningType({...form}); setSaved(true); setTimeout(()=>setSaved(false),2000); };
  const generateSeances = () => {
    const year=new Date().getFullYear();
    const existing=new Set(seances.map(s=>s.date+"|"+s.demiJournee));
    const toCreate=[];
    for(let d=new Date(year,0,1);d<=new Date(year,11,31);d.setDate(d.getDate()+1)){
      const di=(d.getDay()+6)%7;const dayName=DAY_NAMES[di];const dateStr=localDate(d);
      for(const half of["AM","PM"]){const slot=`${dayName} ${half}`;const type=form[slot];if(!existing.has(dateStr+"|"+slot)&&type&&type!=="Repos")toCreate.push({...emptySeance(),id:Date.now()+Math.random(),date:dateStr,demiJournee:slot,activite:type,statut:"Planifié"});}
    }
    setSeances(ss=>[...ss,...toCreate]);
    setGenerated(true); setTimeout(()=>setGenerated(false),3000);
  };

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Semaine type</h1>
      <p style={{fontSize:12,color:C.muted,marginBottom:24}}>Planifiez votre semaine d'entraînement type. Les créneaux servent de base pour générer le programme annuel.</p>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:24}}>
        {DAY_NAMES.map(d=>(
          <div key={d} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:13,fontWeight:500,color:C.inkLight,marginBottom:12}}>{d}</div>
            {["AM","PM"].map(half=>{
              const slot=`${d} ${half}`; const val=form[slot]||"Repos";
              return (
                <div key={half} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:11,color:C.muted,width:24,flexShrink:0}}>{half}</span>
                  <div style={{position:"relative",flex:1}}>
                    {val&&val!=="Repos"&&<span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:13,zIndex:1,pointerEvents:"none"}}>{actIcon(val)}</span>}
                    <select value={val} onChange={e=>setForm(f=>({...f,[slot]:e.target.value}))}
                      style={{paddingLeft:val&&val!=="Repos"?26:10,width:"100%",fontSize:12}}>
                      {ACTIVITY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <Btn variant="ghost" onClick={()=>setForm({...DEFAULT_PLANNING})}>Réinitialiser</Btn>
        <Btn variant="sage" onClick={generateSeances}>{generated?"✓ Séances créées !":"📅 Générer l'année"}</Btn>
        <Btn onClick={savePlanning}>{saved?"✓ Enregistré !":"Enregistrer"}</Btn>
      </div>
    </div>
  );
}

// ─── DONNÉES & PARAMÈTRES (wrapper fusionné) ─────────────────────────────────
// ─── MON COACH IA ─────────────────────────────────────────────────────────────
function MonCoachIA({ seances, setSeances, activites, sommeil, vfcData, poids, objectifs,
  planningType, produits, recettes, journalNutri, activityTypes }) {

  const today      = localDate(new Date());
  const [copied,   setCopied]   = useState(null);
  const [impMsg,   setImpMsg]   = useState("");
  const progRef    = useRef();

  // Import programme JSON
  const handleProgramme = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader();
    r.onload=(ev)=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data._stride_programme&&!data.seances){alert("Format non reconnu.");return;}
        const toImport=(data.seances||[]).map(s=>({...emptySeance(),...s,id:Date.now()+Math.random()}));
        const existingKeys=new Set(seances.map(s=>s.date+"|"+s.demiJournee));
        const news=toImport.filter(s=>!existingKeys.has(s.date+"|"+s.demiJournee));
        setSeances(ss=>{const u=ss.map(s=>{const m=toImport.find(u=>u.date===s.date&&u.demiJournee===s.demiJournee&&s.statut==="Planifié");return m?{...s,...m,id:s.id}:s;});return [...u,...news];});
        setImpMsg(`✓ ${news.length} séance(s) importée(s)`);
        setTimeout(()=>setImpMsg(""),5000);
      }catch{alert("Erreur JSON");}
    };
    r.readAsText(file); e.target.value="";
  };

  const IA_LINKS = [
    { id:"claude",     label:"Claude",     url:"https://claude.ai/new",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#D97757"/><path d="M8 16l4-8 4 8M9.5 13h5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg> },
    { id:"chatgpt",    label:"ChatGPT",    url:"https://chatgpt.com",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#10a37f"/><path d="M7 12a5 5 0 0 1 10 0v1a5 5 0 0 1-10 0v-1z" stroke="white" strokeWidth="1.5"/><path d="M12 7v10M7.5 9.5l9 5M7.5 14.5l9-5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/></svg> },
    { id:"gemini",     label:"Gemini",     url:"https://gemini.google.com",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#4285F4"/><path d="M12 5c0 3.87-3.13 7-7 7 3.87 0 7 3.13 7 7 0-3.87 3.13-7 7-7-3.87 0-7-3.13-7-7z" fill="white"/></svg> },
    { id:"mistral",    label:"Mistral",    url:"https://chat.mistral.ai",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#FA520F"/><rect x="7" y="8" width="4" height="4" rx="1" fill="white"/><rect x="13" y="8" width="4" height="4" rx="1" fill="white"/><rect x="7" y="14" width="4" height="4" rx="1" fill="white" opacity=".7"/><rect x="13" y="14" width="4" height="4" rx="1" fill="white" opacity=".7"/></svg> },
    { id:"perplexity", label:"Perplexity", url:"https://perplexity.ai",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#20808D"/><path d="M12 6v12M6 12h12M9 9l6 6M15 9l-6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity=".85"/></svg> },
    { id:"copilot",    label:"Copilot",    url:"https://copilot.microsoft.com",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#0078D4"/><path d="M8 8h8v8H8z" fill="none" stroke="white" strokeWidth="1.5"/><path d="M10 12h4M12 10v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  ];

  const copyPrompt = (key, text) => {
    navigator.clipboard.writeText(text).then(()=>{
      setCopied(key); setTimeout(()=>setCopied(null), 2500);
    }).catch(()=>{ setCopied(key); setTimeout(()=>setCopied(null), 2500); });
  };

  const daysAgo = (n) => localDate(new Date(new Date().getTime()-n*86400000));
  const daysAhead = (n) => localDate(new Date(new Date().getTime()+n*86400000));
  const lastVFC   = [...vfcData].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const lastPoids = [...poids].sort((a,b)=>b.date.localeCompare(a.date))[0];

  // ── PROMPT 1 : Configurer mon Coach IA (profil statique) ───────────────────
  const buildPromptConfig = () => {
    const objStr = objectifs.length>0
      ? objectifs.map(o=>`  - ${o.nom} le ${fmtDate(o.date)} · ${o.distance||"?"}km · ${o.dp||"?"}m D+`).join("\n")
      : "  - Aucun objectif défini";

    const planStr = Object.entries(planningType||DEFAULT_PLANNING)
      .map(([slot,type])=>`  ${slot}: ${type}`).join("\n");

    const zonesStr = lastVFC ? [
      lastVFC.z1debut&&lastVFC.z1fin?`  Z1 : ${lastVFC.z1debut}–${lastVFC.z1fin} bpm`:"",
      lastVFC.z2debut&&lastVFC.z2fin?`  Z2 : ${lastVFC.z2debut}–${lastVFC.z2fin} bpm`:"",
      lastVFC.z3debut&&lastVFC.z3fin?`  Z3 : ${lastVFC.z3debut}–${lastVFC.z3fin} bpm`:"",
      lastVFC.z4debut&&lastVFC.z4fin?`  Z4 : ${lastVFC.z4debut}–${lastVFC.z4fin} bpm`:"",
      lastVFC.fcMax?`  FC max : ${lastVFC.fcMax} bpm`:"",
      lastVFC.vo2max?`  VO2max : ${lastVFC.vo2max} mL/kg/min`:"",
    ].filter(Boolean).join("\n") : "  - Zones FC non renseignées";

    const poidsStr = lastPoids
      ? `  Poids : ${lastPoids.poids} kg · Taille : ${lastPoids.taille||180} cm`
      : "  - Données morpho non renseignées";

    return `Tu es mon coach trail running personnel. Voici mon profil complet pour paramétrer notre collaboration.

== PROFIL ATHLÈTE ==
${poidsStr}

== ZONES DE FRÉQUENCE CARDIAQUE ==
${zonesStr}

== COURSES OBJECTIFS ==
${objStr}

== SEMAINE TYPE D'ENTRAÎNEMENT ==
${planStr}

== TYPES D'ACTIVITÉS UTILISÉS ==
${ACTIVITY_TYPES.filter(t=>t).join(", ")}

== FORMAT JSON POUR GÉNÉRER UN PROGRAMME ==
Quand je te demande un programme, réponds UNIQUEMENT avec ce format JSON :
{
  "_stride_programme": "1.0",
  "seances": [
    {
      "date": "YYYY-MM-DD",
      "demiJournee": "Lundi AM",
      "activite": "Trail",
      "statut": "Planifié",
      "commentaire": "Description courte de la séance",
      "kmObj": "15",
      "dpObj": "400",
      "dureeObj": "1h30",
      "fcObj": "140"
    }
  ]
}

== INSTRUCTIONS ==
- Tu analyses mes données d'entraînement et de forme quand je te les transmets
- Tu adaptes tes conseils à mon niveau et mes objectifs de course
- Pour les programmes, tu respectes strictement le format JSON ci-dessus
- Tu es direct, factuel, et tu justifies tes recommandations
- Si tu es Claude : crée un Projet et colle ces instructions dans les instructions système du projet`;
  };

  // ── PROMPT 2 : Analyser ma semaine ─────────────────────────────────────────
  const buildPromptSemaine = () => {
    const since = daysAgo(7);
    const seancesW = seances.filter(s=>s.date>=since&&s.date<=today);
    const activW   = activites.filter(a=>a.dateHeure?.slice(0,10)>=since);
    const sommeilW = [...sommeil].filter(s=>s.date>=since).sort((a,b)=>a.date.localeCompare(b.date));
    const vfcW     = [...vfcData].filter(v=>v.date>=since).sort((a,b)=>a.date.localeCompare(b.date));

    const planN  = seancesW.filter(s=>s.activite!=="Repos").length;
    const doneN  = seancesW.filter(s=>s.statut==="Effectué"||s.statut==="Partiel").length;
    const kmPlan = seancesW.reduce((s,a)=>s+(parseFloat(a.kmObj)||0),0).toFixed(1);
    const kmReal = activW.filter(a=>["Trail","Course à pied","Marche à pied"].includes(a.type))
      .reduce((s,a)=>s+(parseFloat(a.distance)||0),0).toFixed(1);
    const dpReal = activW.reduce((s,a)=>s+(parseFloat(a.dp)||0),0);
    const avgSom = sommeilW.length ? Math.round(sommeilW.reduce((s,v)=>s+(parseInt(v.score)||0),0)/sommeilW.length) : null;
    const lastV  = vfcW[vfcW.length-1];

    const seancesDetail = seancesW
      .filter(s=>s.activite!=="Repos")
      .map(s=>`  ${fmtDate(s.date)} ${s.demiJournee.split(" ")[1]||""} · ${s.activite} · ${s.statut}${s.commentaire?` · ${s.commentaire}`:""}${s.kmGarmin?` · ${s.kmGarmin}km`:""}${s.dureeGarmin?` · ${s.dureeGarmin}`:""}`)
      .join("\n") || "  - Aucune séance cette semaine";

    return `Voici mon bilan de la semaine (${fmtDate(since)} → ${fmtDate(today)}).

== SÉANCES ==
Planifiées : ${planN} · Réalisées : ${doneN}
Km prévus : ${kmPlan}km · Km réalisés : ${kmReal}km · D+ réalisé : ${dpReal}m
Détail :
${seancesDetail}

== SOMMEIL ==
${sommeilW.length>0 ? `Score moyen : ${avgSom}/100
Détail : ${sommeilW.map(s=>`${fmtDate(s.date)} ${s.score}/100${s.bodyBatteryMatin?` BB:${s.bodyBatteryMatin}%`:""}`).join(" · ")}` : "- Pas de données cette semaine"}

== VFC & CHARGE ==
${lastV ? `Dernier relevé (${fmtDate(lastV.date)}) : VFC ${lastV.vfc||"—"}ms · Moy 7j : ${lastV.moy7j||"—"}ms
Charge aiguë : ${lastV.chargeAigue||"—"} · Charge chronique : ${lastV.chargeChronique||"—"}
Ratio : ${lastV.chargeAigue&&lastV.chargeChronique?Math.round(parseInt(lastV.chargeAigue)/parseInt(lastV.chargeChronique)*100)/100:"—"}` : "- Pas de données VFC"}

Qu'est-ce que tu en penses ? Que faut-il ajuster pour la semaine à venir ?`;
  };

  // ── PROMPT 3 : Générer mon programme ───────────────────────────────────────
  const buildPromptProgramme = () => {
    const objStr = objectifs.length>0
      ? objectifs.map(o=>`  - ${o.nom} le ${fmtDate(o.date)} · ${o.distance||"?"}km · ${o.dp||"?"}m D+`).join("\n")
      : "  - Aucun objectif défini";
    const planStr = Object.entries(planningType||DEFAULT_PLANNING)
      .map(([slot,type])=>`  ${slot}: ${type}`).join("\n");
    const lastV = [...vfcData].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const chargeStr = lastV
      ? `Charge aiguë : ${lastV.chargeAigue||"—"} · Charge chronique : ${lastV.chargeChronique||"—"} · Ratio : ${lastV.chargeAigue&&lastV.chargeChronique?Math.round(parseInt(lastV.chargeAigue)/parseInt(lastV.chargeChronique)*100)/100:"—"}`
      : "Données de charge non disponibles";

    return `Je veux que tu génères mon programme d'entraînement.

== MES COURSES OBJECTIFS ==
${objStr}

== MA SEMAINE TYPE ==
${planStr}

== ÉTAT DE FORME ACTUEL ==
${chargeStr}
${lastV?.vo2max?`VO2max : ${lastV.vo2max} mL/kg/min`:""}

== DEMANDE ==
Génère un programme pour les 4 prochaines semaines (du ${fmtDate(daysAhead(1))} au ${fmtDate(daysAhead(28))}).
Respecte strictement ma semaine type et le format JSON Stride défini dans tes instructions.
Adapte la charge progressive en fonction de mes objectifs.`;
  };

  // ── PROMPT 4 : Bilan de forme ───────────────────────────────────────────────
  const buildPromptForme = () => {
    const since = daysAgo(30);
    const vfc30   = [...vfcData].filter(v=>v.date>=since).sort((a,b)=>a.date.localeCompare(b.date));
    const som30   = [...sommeil].filter(s=>s.date>=since);
    const poids30 = [...poids].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
    const lastV   = vfc30[vfc30.length-1];
    const avgSom  = som30.length ? Math.round(som30.reduce((s,v)=>s+(parseInt(v.score)||0),0)/som30.length) : null;
    const avgBB   = som30.length ? Math.round(som30.reduce((s,v)=>s+(parseInt(v.bodyBatteryMatin)||0),0)/som30.length) : null;

    return `Voici mon bilan de forme des 30 derniers jours.

== VFC (${vfc30.length} relevés) ==
${lastV ? `Dernier : ${lastV.vfc||"—"}ms (${fmtDate(lastV.date)}) · Moy 7j : ${lastV.moy7j||"—"}ms
Charge aiguë : ${lastV.chargeAigue||"—"} · Charge chronique : ${lastV.chargeChronique||"—"}
Ratio : ${lastV.chargeAigue&&lastV.chargeChronique?Math.round(parseInt(lastV.chargeAigue)/parseInt(lastV.chargeChronique)*100)/100:"—"}
VO2max : ${lastV.vo2max||"—"} mL/kg/min` : "- Pas de données VFC"}

== SOMMEIL (${som30.length} nuits) ==
${avgSom!==null ? `Score moyen : ${avgSom}/100 · Body Battery moyen au lever : ${avgBB||"—"}%` : "- Pas de données sommeil"}

== POIDS ==
${poids30.length>0 ? poids30.map(p=>`  ${fmtDate(p.date)} : ${p.poids}kg`).join("\n") : "- Pas de données poids"}

Comment je me porte ? Y a-t-il des signaux d'alerte à surveiller ?`;
  };

  // ── PROMPT 5 : Bilan nutrition ──────────────────────────────────────────────
  const buildPromptNutri = () => {
    const since = daysAgo(30);
    const nutri30 = (journalNutri||[]).filter(j=>j.date>=since);
    const actRun  = activites.filter(a=>a.dateHeure?.slice(0,10)>=since&&["Trail","Course à pied","Marche à pied"].includes(a.type));
    const avg = (key) => nutri30.length ? Math.round(nutri30.reduce((s,j)=>s+(parseFloat(j[key])||0),0)/nutri30.length) : null;
    const totalKm = actRun.reduce((s,a)=>s+(parseFloat(a.distance)||0),0).toFixed(0);

    return `Voici mon bilan nutritionnel des 30 derniers jours.

== DONNÉES NUTRITIONNELLES (${nutri30.length} jours enregistrés sur 30) ==
Kcal consommées moy./jour : ${avg("kcalConso")||"—"} kcal
Kcal brûlées moy./jour : ${avg("kcalBrulees")||"—"} kcal
Delta moyen : ${avg("kcalConso")&&avg("kcalBrulees")?avg("kcalConso")-avg("kcalBrulees"):"—"} kcal
Protéines moy. : ${avg("proteines")||"—"} g/jour
Lipides moy. : ${avg("lipides")||"—"} g/jour
Glucides moy. : ${avg("glucides")||"—"} g/jour

== CHARGE D'ENTRAÎNEMENT SUR LA MÊME PÉRIODE ==
${actRun.length} sorties running · ${totalKm} km total

Est-ce que ma nutrition est cohérente avec ma charge d'entraînement ? Que recommandes-tu d'ajuster ?`;
  };

  // ── PROMPT 6 : Stratégie nutrition course ───────────────────────────────────
  const buildPromptNutriCourse = () => {
    const nextObj = [...objectifs].filter(o=>o.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
    const prodsStr = produits.length>0
      ? produits.map(p=>`  - ${p.nom} (${p.categorie||"—"}) : ${p.kcal||"?"}kcal · Gluc:${p.glucides||"?"}g · Prot:${p.proteines||"?"}g`).join("\n")
      : "  - Aucun produit enregistré";
    const recettesStr = recettes.length>0
      ? recettes.map(r=>`  - ${r.nom} : ${r.notes||""}`) .join("\n")
      : "  - Aucune recette enregistrée";

    return `Je prépare ma stratégie nutritionnelle pour ma prochaine course.

== COURSE OBJECTIF ==
${nextObj ? `${nextObj.nom} le ${fmtDate(nextObj.date)} · ${nextObj.distance||"?"}km · ${nextObj.dp||"?"}m D+` : "- Aucune course prochaine définie"}

== MES PRODUITS DISPONIBLES ==
${prodsStr}

== MES RECETTES ==
${recettesStr}

Aide-moi à construire ma stratégie de ravitaillement pour cette course : fréquence, quantités, répartition glucides/protéines/hydratation.`;
  };

  // ── Données export ──────────────────────────────────────────────────────────
  const exportGabarit = () => {
    const today = new Date();
    const d = (offset) => {
      const dt = new Date(today); dt.setDate(dt.getDate()+offset);
      return localDate(dt);
    };
    const gabarit = {
      "_stride_programme": "1.0",
      "_info": "Gabarit — remplace les valeurs par celles générées par ton Coach IA. Importe ce fichier dans Stride > Mon coach IA.",
      "seances": [
        { "date": d(1),  "demiJournee": "Lundi AM",    "activite": "Musculation",        "statut": "Planifié", "commentaire": "Full body / Upper", "dureeObj": "1h00", "kmObj": "",   "dpObj": "",    "fcObj": "" },
        { "date": d(1),  "demiJournee": "Lundi PM",    "activite": "Repos",              "statut": "Planifié", "commentaire": "",                  "dureeObj": "",     "kmObj": "",   "dpObj": "",    "fcObj": "" },
        { "date": d(2),  "demiJournee": "Mardi AM",    "activite": "Trail",              "statut": "Planifié", "commentaire": "EF Z1-Z2",          "dureeObj": "1h15", "kmObj": "12", "dpObj": "300", "fcObj": "135" },
        { "date": d(2),  "demiJournee": "Mardi PM",    "activite": "Repos",              "statut": "Planifié", "commentaire": "",                  "dureeObj": "",     "kmObj": "",   "dpObj": "",    "fcObj": "" },
        { "date": d(3),  "demiJournee": "Mercredi AM", "activite": "Trail",              "statut": "Planifié", "commentaire": "Seuil 3×8min Z4",   "dureeObj": "1h30", "kmObj": "15", "dpObj": "400", "fcObj": "155" },
        { "date": d(4),  "demiJournee": "Jeudi AM",    "activite": "Mobilité / Gainage", "statut": "Planifié", "commentaire": "Gainage + étirements","dureeObj": "0h45","kmObj": "",  "dpObj": "",    "fcObj": "" },
        { "date": d(5),  "demiJournee": "Vendredi AM", "activite": "Musculation",        "statut": "Planifié", "commentaire": "Lower body",        "dureeObj": "1h00", "kmObj": "",   "dpObj": "",    "fcObj": "" },
        { "date": d(6),  "demiJournee": "Samedi AM",   "activite": "Trail",              "statut": "Planifié", "commentaire": "Long run Z2",       "dureeObj": "2h30", "kmObj": "25", "dpObj": "700", "fcObj": "140" },
        { "date": d(7),  "demiJournee": "Dimanche AM", "activite": "Repos",              "statut": "Planifié", "commentaire": "Récupération active","dureeObj": "",    "kmObj": "",   "dpObj": "",    "fcObj": "" }
      ]
    };
    exportJSON(gabarit, "stride-gabarit-programme.json");
  };

  const exportLightFromCoach = () => {
    const daysAgo60 = daysAgo(60); const daysAgo30 = daysAgo(30); const days30 = daysAhead(30);
    const pick = (obj, keys) => Object.fromEntries(keys.filter(k=>k in obj).map(k=>[k,obj[k]]));
    const data = {
      _stride_export:"light", _date:today,
      activites: activites.filter(a=>a.dateHeure?.slice(0,10)>=daysAgo60).map(a=>pick(a,["date","dateHeure","type","titre","duree","distance","dp","fcMoy","fcMax","z1","z2","z3","z4","z5","tss","gapMoy","cal"])),
      sommeil: sommeil.filter(s=>s.date>=daysAgo60).map(s=>pick(s,["date","score","qualite","duree","bodyBatteryMatin","vfc","fcRepos"])),
      vfcData: vfcData.filter(v=>v.date>=daysAgo60).map(v=>pick(v,["date","vfc","moy7j","vo2max","chargeAigue","chargeChronique","z1fin","z2fin","z3fin","z4fin","fcMax"])),
      journalNutri: (journalNutri||[]).filter(j=>j.date>=daysAgo60).map(j=>pick(j,["date","kcalBrulees","kcalConso","proteines","lipides","glucides","notes"])),
      poids: poids.map(p=>pick(p,["date","poids","ventre","taille_cm","hanche","cuisse","bras"])),
      seances: seances.filter(s=>s.date>=daysAgo30&&s.date<=days30).map(s=>pick(s,["date","demiJournee","activite","statut","commentaire","dureeObj","kmObj","dpObj","fcObj","dureeGarmin","kmGarmin","fcMoy","fcMax","z2","z3"])),
    };
    exportJSON(data, `stride-coach-${today}.json`);
  };

  // ── Styles ───────────────────────────────────────────────────────────────────
  const cardStyle = {background:C.white,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:16,overflow:"hidden"};
  const rowStyle  = {display:"flex",alignItems:"center",gap:12,padding:"14px 18px"};
  const secLbl    = (t) => <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted,marginBottom:8,marginTop:4}}>{t}</div>;
  const BADGE_S   = {fontSize:10,padding:"1px 7px",borderRadius:10,fontWeight:500,background:"#E6F1FB",color:"#0C447C"};
  const BADGE_V   = {fontSize:10,padding:"1px 7px",borderRadius:10,fontWeight:500,background:"#FAEEDA",color:"#633806"};

  const PROMPTS = [
    { key:"config",    icon:"⚙",  title:"Configurer mon Coach IA",    badge:BADGE_S, badgeLabel:"Profil statique",  sub:"Profil · zones FC · objectifs · semaine type · instructions IA",    fn:buildPromptConfig },
    { key:"semaine",   icon:"📅", title:"Analyser ma semaine",         badge:BADGE_V, badgeLabel:"Données variables", sub:"7 derniers jours — séances, charge, sommeil, VFC",                  fn:buildPromptSemaine },
    { key:"programme", icon:"🏔", title:"Générer mon programme",       badge:BADGE_V, badgeLabel:"Données variables", sub:"Objectifs + forme actuelle → programme JSON prêt à importer",      fn:buildPromptProgramme },
    { key:"forme",     icon:"❤",  title:"Bilan de forme",              badge:BADGE_V, badgeLabel:"Données variables", sub:"VFC, sommeil, poids, ratio charge — 30 derniers jours",             fn:buildPromptForme },
    { key:"nutri",     icon:"⚡", title:"Bilan nutrition",             badge:BADGE_V, badgeLabel:"Données variables", sub:"Kcal, macros, delta — 30 jours vs charge d'entraînement",          fn:buildPromptNutri },
    { key:"nutricourse",icon:"🍽",title:"Stratégie nutrition course",  badge:BADGE_S, badgeLabel:"Profil statique",  sub:"Tes recettes et produits → plan de ravitaillement de course",       fn:buildPromptNutriCourse },
  ];

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Mon coach IA</h1>
      <p style={{fontSize:12,color:C.muted,marginBottom:24}}>Ouvre ton IA préférée · copie des prompts pré-remplis · importe le programme généré</p>

      {/* ── Ouvrir une IA ── */}
      <div style={{marginBottom:8,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted}}>Ouvrir une IA</div>
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",marginBottom:24}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
          {IA_LINKS.map(ai=>(
            <a key={ai.id} href={ai.url} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                padding:"12px 8px",borderRadius:10,border:`0.5px solid ${C.border}`,
                background:C.stone,cursor:"pointer",textDecoration:"none",
                transition:"border-color .15s"}}>
              {ai.logo}
              <span style={{fontSize:11,fontWeight:500,color:C.inkLight}}>{ai.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ── Layout 2 colonnes ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,alignItems:"start"}}>

        {/* Colonne gauche : Données + Programme */}
        <div>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted,marginBottom:8}}>Données & Programme</div>
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            {/* Export */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px"}}>
              <span style={{fontSize:20,width:26,textAlign:"center",flexShrink:0}}>📤</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>Export Coach</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>Fichier léger — 60j activités, séances ±30j</div>
              </div>
              <Btn variant="sage" size="sm" onClick={exportLightFromCoach}>⬇</Btn>
            </div>
            {/* Import programme */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderTop:`1px solid ${C.border}`}}>
              <span style={{fontSize:20,width:26,textAlign:"center",flexShrink:0}}>📥</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>Importer un programme</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>JSON généré par ton Coach IA</div>
                {impMsg&&<div style={{fontSize:11,color:C.green,fontWeight:500,marginTop:3}}>{impMsg}</div>}
              </div>
              <input ref={progRef} type="file" accept=".json" style={{display:"none"}} onChange={handleProgramme}/>
              <Btn variant="soft" size="sm" onClick={()=>progRef.current?.click()}>⬆</Btn>
            </div>
          </div>

          {/* Légende badges */}
          <div style={{marginTop:20,marginBottom:8,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted}}>Légende</div>
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.muted}}>
              <span style={{...BADGE_S,flexShrink:0}}>Profil statique</span>
              <span>À coller dans les instructions système de ton projet IA — à faire une seule fois</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.muted}}>
              <span style={{...BADGE_V,flexShrink:0}}>Données variables</span>
              <span>À copier au début de chaque conversation — mis à jour avec tes données du moment</span>
            </div>
          </div>
        </div>

        {/* Colonne droite : Prompts */}
        <div>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted,marginBottom:8}}>Prompts prêts à copier</div>
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            {PROMPTS.map((p,i)=>(
              <div key={p.key} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",
                borderTop:i>0?`1px solid ${C.border}`:"none"}}>
                <span style={{fontSize:16,width:22,textAlign:"center",flexShrink:0}}>{p.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.inkLight,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                    {p.title}
                    <span style={p.badge}>{p.badgeLabel}</span>
                  </div>
                  <div style={{fontSize:10,color:C.muted,marginTop:1,lineHeight:1.3}}>{p.sub}</div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  {p.key==="programme"&&(
                    <button onClick={exportGabarit}
                      style={{padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:500,
                        cursor:"pointer",border:`0.5px solid ${C.border}`,
                        background:C.stone,color:C.stoneDeep,fontFamily:"inherit"}}
                      title="Télécharger un gabarit JSON à donner au Coach IA">
                      Gabarit
                    </button>
                  )}
                  <button onClick={()=>copyPrompt(p.key, p.fn())}
                    style={{padding:"4px 12px",borderRadius:8,fontSize:11,fontWeight:500,
                      cursor:"pointer",
                      border:`0.5px solid ${copied===p.key?C.forest:C.border}`,
                      background:copied===p.key?C.forestPale:"transparent",
                      color:copied===p.key?C.forest:C.muted,fontFamily:"inherit"}}>
                    {copied===p.key?"✓":"Copier"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── DONNÉES & PARAMÈTRES (wrapper) ──────────────────────────────────────────
function DonneesParams(props) {
  const [tab, setTab] = useState("donnees");
  const { planningType, setPlanningType, seances, setSeances, objectifs, setObjectifs,
          activityTypes, setActivityTypes } = props;
  const subBtn = (id,l) => (
    <button key={id} onClick={()=>setTab(id)}
      style={{padding:"5px 14px",border:`0.5px solid ${tab===id?C.forest:C.border}`,
        background:tab===id?C.forest:"transparent",color:tab===id?C.white:C.muted,
        borderRadius:20,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:tab===id?500:400}}>
      {l}
    </button>
  );
  return (
    <div>
      <div style={{padding:"10px 40px",borderBottom:`1px solid ${C.border}`,
        background:C.white,display:"flex",gap:6,marginBottom:0}}>
        {subBtn("donnees","Import & Sauvegarde")}
      </div>
      {tab==="donnees" && <Donnees {...props}/>}
    </div>
  );
}

// ─── NAVIGATION CONSTANTS ─────────────────────────────────────────────────────
const TRAIN_NAVS = [
  { id:"dashboard",    label:"Tableau de bord", icon:"◉" },
  { id:"entrainement", label:"Entraînement",    icon:"↑" },
  { id:"forme",        label:"Forme",           icon:"♡" },
  { id:"objectifs",    label:"Objectifs",       icon:"🏔" },
  { id:"coach",        label:"Coach IA",        icon:"✦" },
  { id:"donnees",      label:"Données",         icon:"⬆" },
];

const COURSE_NAVS = [
  { id:"profil-course", label:"Profil de course", group:"Analyse" },
  { id:"strategie",     label:"Stratégie",         group:"Analyse" },
  { id:"analyse",       label:"Analyse",            group:"Analyse" },
  { id:"nutrition-course", label:"Nutrition course", group:"Préparation" },
  { id:"equipement",    label:"Équipement",          group:"Préparation" },
  { id:"team",          label:"Team",                group:"Préparation" },
  { id:"mes-courses",   label:"Mes courses",         group:"Historique" },
];

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
function Topbar({ context, setContext }) {
  const navConfigs = {
    home:   [{ id:"train", label:"Entraînement", icon:"🏃" }, { id:"course", label:"Course", icon:"🗺️" }],
    train:  [{ id:"home",  label:"Accueil",      icon:"⌂" },  { id:"course", label:"Course", icon:"🗺️" }],
    course: [{ id:"train", label:"Entraînement", icon:"🏃" }, { id:"home",   label:"Accueil", icon:"⌂" }],
  };
  const buttons = navConfigs[context] || navConfigs.home;
  const accentColor = context === "course" ? "#D85A30" : "#1D9E75";

  return (
    <div style={{height:52,background:C.white,borderBottom:`1px solid ${C.border}`,
      display:"flex",alignItems:"center",padding:"0 20px",flexShrink:0,zIndex:200,gap:16}}>
      <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:500,
        color:accentColor,letterSpacing:"-0.03em",flex:1}}>Alex</div>
      <div style={{display:"flex",gap:8}}>
        {buttons.map((b,i) => (
          <button key={b.id} onClick={()=>setContext(b.id)}
            style={{display:"flex",alignItems:"center",gap:6,
              padding:"6px 14px",borderRadius:6,border:`1px solid ${C.border}`,
              background:"transparent",color:C.inkLight,cursor:"pointer",
              fontSize:13,fontWeight:500,fontFamily:"inherit",
              animation:`fadeUp 0.32s cubic-bezier(0.4,0,0.2,1) ${i*0.05}s both`}}>
            <span style={{fontSize:15}}>{b.icon}</span>
            <span>{b.label}</span>
          </button>
        ))}
        <div style={{width:32,height:32,borderRadius:"50%",
          background:"#1D9E75",display:"flex",alignItems:"center",justifyContent:"center",
          color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
          Y
        </div>
      </div>
    </div>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ setContext, seances, activites, vfcData, sommeil, poids, objectifs }) {
  const today = localDate(new Date());
  const lastVFC     = useMemo(()=>[...vfcData].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[vfcData]);
  const lastSommeil = useMemo(()=>[...sommeil].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[sommeil]);
  const lastPoids   = useMemo(()=>[...poids].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[poids]);
  const nextObj     = useMemo(()=>[...objectifs].filter(o=>o.date>=today).sort((a,b)=>new Date(a.date)-new Date(b.date))[0]||null,[objectifs,today]);

  const formeScore  = useMemo(()=>{
    const vfc=lastVFC?parseInt(lastVFC.vfc)||0:0;
    const base=lastVFC?.baseline?parseInt(lastVFC.baseline.match(/(\d+)ms/)?.[1]||70):70;
    const som=lastSommeil?parseInt(lastSommeil.score)||0:0;
    const bb=lastSommeil?parseInt(lastSommeil.bodyBatteryMatin)||0:0;
    const ratio=lastVFC?.chargeAigue&&lastVFC?.chargeChronique?parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique):1;
    let s=0;
    if(vfc>=base*0.9)s+=2;else if(vfc>=base*0.75)s+=1;
    if(som>=80)s+=2;else if(som>=65)s+=1;
    if(bb>=70)s+=2;else if(bb>=45)s+=1;
    if(ratio<=1.2)s+=1;else if(ratio>1.4)s-=1;
    return s;
  },[lastVFC,lastSommeil]);

  const formeColor=formeScore>=5?"#1D9E75":formeScore>=3?C.yellow:C.red;
  const formeLabel=formeScore>=5?"Bonne forme":formeScore>=3?"Forme moyenne":"Récupération";
  const ratio=lastVFC?.chargeAigue&&lastVFC?.chargeChronique
    ?Math.round(parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique)*100)/100:null;

  const stat = (label, value, unit="") => (
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:C.muted,marginBottom:3}}>{label}</div>
      <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:500,color:value?"—"===value?C.muted:C.ink:C.muted}}>
        {value||"—"}{value&&value!=="—"?<span style={{fontSize:12,fontWeight:400,color:C.muted,marginLeft:2}}>{unit}</span>:""}
      </div>
    </div>
  );

  const j = nextObj ? daysUntil(nextObj.date) : null;

  return (
    <div style={{flex:1,overflowY:"auto"}}>
      <div style={{maxWidth:920,margin:"0 auto",padding:"32px 24px"}}>

        {/* Barre de forme */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:16,
          padding:"18px 24px",marginBottom:24,borderLeft:`4px solid ${formeColor}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:500,color:C.ink}}>
              Forme du jour
            </div>
            <span style={{fontSize:12,fontWeight:600,color:formeColor,
              background:`${formeColor}18`,padding:"3px 10px",borderRadius:20}}>
              {formeLabel}
            </span>
          </div>
          <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
            {stat("VFC", lastVFC?.vfc||null, "ms")}
            {stat("Sommeil", lastSommeil?.score||null, "/100")}
            {stat("Charge ac./ch.", ratio||null)}
            {stat("Poids", lastPoids?.poids||null, "kg")}
          </div>
          {!lastVFC && !lastSommeil && (
            <div style={{marginTop:12,fontSize:12,color:C.muted}}>
              Importe tes données Garmin dans{" "}
              <span onClick={()=>setContext("train")} style={{color:"#1D9E75",cursor:"pointer",fontWeight:500}}>Entraînement → Forme</span>
              {" "}pour voir ta forme ici.
            </div>
          )}
        </div>

        {/* Deux blocs */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>

          {/* Bloc Entraînement */}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",cursor:"pointer"}}
            onClick={()=>setContext("train")}>
            <div style={{background:"#1D9E75",padding:"20px 24px"}}>
              <div style={{fontSize:24,marginBottom:6}}>🏃</div>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:500,color:"#fff"}}>Entraînement</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:3}}>Programme · Forme · Coach IA</div>
            </div>
            <div style={{padding:"16px 24px"}}>
              {seances.filter(s=>s.date===today).length > 0 ? (
                <div>
                  <div style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:C.muted,marginBottom:8}}>Aujourd'hui</div>
                  {seances.filter(s=>s.date===today).slice(0,3).map(s=>(
                    <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:actColor(s.activite),flexShrink:0}}/>
                      <span style={{fontSize:13,color:C.inkLight}}>{s.activite}</span>
                      <span style={{fontSize:11,color:C.muted,marginLeft:"auto"}}>{s.statut}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{fontSize:13,color:C.muted,fontStyle:"italic"}}>Aucune séance planifiée aujourd'hui</div>
              )}
              <div style={{marginTop:12,display:"flex",alignItems:"center",gap:4,color:"#1D9E75",fontSize:13,fontWeight:500}}>
                <span>Ouvrir</span><span>→</span>
              </div>
            </div>
          </div>

          {/* Bloc Course */}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",cursor:"pointer"}}
            onClick={()=>setContext("course")}>
            <div style={{background:"#D85A30",padding:"20px 24px"}}>
              <div style={{fontSize:24,marginBottom:6}}>🗺️</div>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:500,color:"#fff"}}>Course</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:3}}>Stratégie · Nutrition · Équipement</div>
            </div>
            <div style={{padding:"16px 24px"}}>
              {nextObj ? (
                <div>
                  <div style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:C.muted,marginBottom:8}}>Prochaine course</div>
                  <div style={{fontSize:15,fontWeight:500,color:C.ink,marginBottom:4}}>{nextObj.nom||"Course"}</div>
                  <div style={{fontSize:12,color:C.muted}}>
                    {j !== null ? `Dans ${j} jour${j>1?"s":""}` : "—"}
                    {nextObj.distance ? ` · ${nextObj.distance} km` : ""}
                    {nextObj.dp ? ` · D+ ${nextObj.dp} m` : ""}
                  </div>
                </div>
              ) : (
                <div style={{fontSize:13,color:C.muted,fontStyle:"italic"}}>Aucune course planifiée</div>
              )}
              <div style={{marginTop:12,display:"flex",alignItems:"center",gap:4,color:"#D85A30",fontSize:13,fontWeight:500}}>
                <span>Ouvrir</span><span>→</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── TRAIN LAYOUT (Stride) ────────────────────────────────────────────────────
function TrainLayout({ allTrainProps }) {
  const { seances,setSeances,activites,setActivites,sommeil,setSommeil,
    vfcData,setVfcData,poids,setPoids,objectifs,setObjectifs,planningType,setPlanningType,
    activityTypes,setActivityTypes,journalNutri,setJournalNutri,produits,setProduits,
    recettes,setRecettes,allData,loadData,resetAll,profil,setProfil,confirmReset,setConfirmReset,isMobile } = allTrainProps;

  const [view,    setView]    = useState("dashboard");
  const [subView, setSubView] = useState({entrainement:"programme",forme:"vfc"});
  const setSubV = (parent,sub) => setSubView(sv=>({...sv,[parent]:sub}));

  const TEAL = "#1D9E75";

  const navBtn = (id,label,active,onClick) => (
    <button key={id} onClick={onClick}
      style={{background:active?`${TEAL}18`:"none",border:"none",padding:"6px 14px",
        cursor:"pointer",fontSize:13,fontWeight:active?500:400,
        color:active?TEAL:C.muted,borderRadius:8,fontFamily:"inherit"}}>
      {label}
    </button>
  );

  const subNavBtn = (id,label,active,onClick) => (
    <button key={id} onClick={onClick}
      style={{padding:"5px 14px",border:`0.5px solid ${active?TEAL:C.border}`,
        background:active?TEAL:"transparent",color:active?C.white:C.muted,
        borderRadius:20,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:active?500:400}}>
      {label}
    </button>
  );

  const allProps = {seances,setSeances,activites,setActivites,sommeil,setSommeil,
    vfcData,setVfcData,poids,setPoids,objectifs,setObjectifs,planningType,setPlanningType,
    activityTypes,setActivityTypes,journalNutri,setJournalNutri,produits,setProduits,
    recettes,setRecettes,allData,loadData,resetAll,setView};

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      {/* Sub-topbar teal */}
      {!isMobile && (
        <div style={{height:44,background:TEAL,display:"flex",alignItems:"center",padding:"0 16px",flexShrink:0,gap:2}}>
          {TRAIN_NAVS.map(n=>navBtn(n.id,n.label,view===n.id,()=>setView(n.id)))}
        </div>
      )}

      <div style={{flex:1,overflowY:"auto",paddingBottom:isMobile?60:0}}>
        {view==="dashboard"    && <Dashboard {...allProps}/>}
        {view==="objectifs"    && <Objectifs objectifs={objectifs} setObjectifs={setObjectifs} seances={seances} activites={activites} vfcData={vfcData} poids={poids} profil={profil} produits={produits} recettes={recettes} allData={allData}/>}
        {view==="coach"        && <MonCoachIA seances={seances} setSeances={setSeances} activites={activites} sommeil={sommeil} vfcData={vfcData} poids={poids} objectifs={objectifs} planningType={planningType} produits={produits} recettes={recettes} journalNutri={journalNutri} activityTypes={activityTypes}/>}
        {view==="entrainement" && (
          <div>
            <div style={{padding:"10px 40px",borderBottom:`1px solid ${C.border}`,background:C.white,display:"flex",gap:6}}>
              {[{id:"programme",l:"Programme"},{id:"activites",l:"Activités"},{id:"recettes",l:"Recettes & Produits"},{id:"planning",l:"Semaine type"}]
                .map(({id,l})=>subNavBtn(id,l,subView.entrainement===id,()=>setSubV("entrainement",id)))}
            </div>
            {subView.entrainement==="programme" && <EntrainementProgramme {...allProps}/>}
            {subView.entrainement==="activites" && <Activites activites={activites} setActivites={setActivites} seances={seances} setSeances={setSeances}/>}
            {subView.entrainement==="recettes"  && <Nutrition produits={produits} setProduits={setProduits} recettes={recettes} setRecettes={setRecettes} seances={seances} setSeances={setSeances}/>}
            {subView.entrainement==="planning"  && <SemaineType planningType={planningType} setPlanningType={setPlanningType} seances={seances} setSeances={setSeances} activityTypes={activityTypes}/>}
          </div>
        )}
        {view==="forme" && (
          <div>
            <div style={{padding:"10px 40px",borderBottom:`1px solid ${C.border}`,background:C.white,display:"flex",gap:6}}>
              {[{id:"vfc",l:"VFC & Charge"},{id:"sommeil",l:"Sommeil"},{id:"nutrition",l:"Journal nutritionnel"},{id:"poids",l:"Suivi corporel"}]
                .map(({id,l})=>subNavBtn(id,l,subView.forme===id,()=>setSubV("forme",id)))}
            </div>
            {subView.forme==="vfc"       && <FormeVFC sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData} poids={poids} setPoids={setPoids} activites={activites}/>}
            {subView.forme==="sommeil"   && <FormeSommeil sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData} poids={poids} setPoids={setPoids} activites={activites}/>}
            {subView.forme==="nutrition" && <JournalNutri journalNutri={journalNutri} setJournalNutri={setJournalNutri}/>}
            {subView.forme==="poids"     && <FormePoids sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData} poids={poids} setPoids={setPoids} activites={activites} profil={profil} setProfil={setProfil}/>}
          </div>
        )}
        {view==="donnees" && <DonneesParams {...allProps} confirmReset={confirmReset} setConfirmReset={setConfirmReset}/>}
      </div>

      {isMobile && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,height:56,
          background:C.white,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:200}}>
          {TRAIN_NAVS.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)}
              style={{flex:1,background:"none",border:"none",cursor:"pointer",
                display:"flex",flexDirection:"column",alignItems:"center",
                justifyContent:"center",gap:2,color:view===n.id?TEAL:C.stoneDeep,fontFamily:"inherit"}}>
              <span style={{fontSize:14}}>{n.icon}</span>
              <span style={{fontSize:9,fontWeight:view===n.id?500:400}}>{n.label}</span>
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog open={confirmReset} message="Effacer toutes les données ? Cette action est irréversible."
        onConfirm={()=>{resetAll();setConfirmReset(false);}} onCancel={()=>setConfirmReset(false)}/>
    </div>
  );
}

// ─── PARTAGE STRATÉGIE ────────────────────────────────────────────────────────
function encodeStrategy(race, segments, settings) {
  const { gpxPoints, ...raceLight } = race;
  const { equipment, garminStats, ...settingsLight } = settings;
  const payload = { race: raceLight, segments, settings: settingsLight, v: 2, ts: Date.now() };
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))); } catch { return null; }
}
function decodeStrategy(encoded) {
  try { return JSON.parse(decodeURIComponent(escape(atob(encoded)))); } catch { return null; }
}

// ─── COURSE LAYOUT (Alex) — IndexedDB ────────────────────────────────────────
function CourseLayout({ isMobile, strideObjectifs }) {
  const CORAL = "#D85A30";
  const [courseView,   setCourseView]   = useState("profil-course");
  const [raceRaw,      setRaceRaw]      = useState({});
  const [segmentsRaw,  setSegmentsRaw]  = useState([]);
  const [settingsRaw,  setSettingsRaw]  = useState({...EMPTY_SETTINGS});
  const [hasUnsaved,   setHasUnsaved]   = useState(false);
  const [autoSaved,    setAutoSaved]    = useState(false);
  const [courses,      setCourses]      = useState([]);
  const [sharedMode,   setSharedMode]   = useState(false);
  const [reposModal,   setReposModal]   = useState(false);
  const [reposForm,    setReposForm]    = useState({ label:"", startKm:"", dureeMin:20 });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);

  // ── IndexedDB ──────────────────────────────────────────────────────────────
  const IDB_NAME = "alex-trail", IDB_STORE = "state", IDB_COURSES = "courses", IDB_KEY = "current";
  const openDB = () => new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 3);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE))   db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains(IDB_COURSES))  db.createObjectStore(IDB_COURSES, { keyPath:"id" });
      if (!db.objectStoreNames.contains("stride"))     db.createObjectStore("stride");
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
  const idbSave = async data => { try { const db=await openDB(); db.transaction(IDB_STORE,"readwrite").objectStore(IDB_STORE).put(data,IDB_KEY); } catch {} };
  const idbLoad = async () => { try { const db=await openDB(); return new Promise(res=>{ const req=db.transaction(IDB_STORE,"readonly").objectStore(IDB_STORE).get(IDB_KEY); req.onsuccess=e=>res(e.target.result); req.onerror=()=>res(null); }); } catch { return null; } };
  const idbSaveCourse = async (id, data) => { try { const db=await openDB(); db.transaction(IDB_COURSES,"readwrite").objectStore(IDB_COURSES).put({id,...data}); } catch {} };
  const idbLoadCourses = async () => { try { const db=await openDB(); return new Promise(res=>{ const req=db.transaction(IDB_COURSES,"readonly").objectStore(IDB_COURSES).getAll(); req.onsuccess=e=>res(e.target.result||[]); req.onerror=()=>res([]); }); } catch { return []; } };
  const idbDeleteCourse = async id => { try { const db=await openDB(); db.transaction(IDB_COURSES,"readwrite").objectStore(IDB_COURSES).delete(id); } catch {} };

  // ── setters wrappés ────────────────────────────────────────────────────────
  const race     = raceRaw;
  const segments = segmentsRaw;
  const settings = settingsRaw;
  const setRace     = useCallback(upd => { setRaceRaw(upd);     setHasUnsaved(true); }, []);
  const setSegments = useCallback(upd => { setSegmentsRaw(upd); setHasUnsaved(true); }, []);
  const setSettings = useCallback(upd => { setSettingsRaw(upd); setHasUnsaved(true); }, []);

  // ── Chargement initial ─────────────────────────────────────────────────────
  useEffect(() => {
    // Lien partagé ?s=
    const urlParams = new URLSearchParams(window.location.search);
    let shared = urlParams.get("s");
    if (!shared && window.location.hash.startsWith("#s=")) shared = window.location.hash.slice(3);
    if (shared) {
      const data = decodeStrategy(shared);
      if (data) {
        if (data.race)     setRaceRaw(data.race);
        if (data.segments) setSegmentsRaw(data.segments);
        if (data.settings) setSettingsRaw({...EMPTY_SETTINGS,...data.settings});
        setSharedMode(true);
        setCourseView("team");
        idbSave({ race:data.race, segments:data.segments, settings:{...EMPTY_SETTINGS,...data.settings} });
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
    }
    idbLoad().then(d => {
      if (d?.race)     setRaceRaw(d.race);
      if (d?.segments) setSegmentsRaw(d.segments);
      if (d?.settings) setSettingsRaw({...EMPTY_SETTINGS,...d.settings});
    });
    idbLoadCourses().then(list => setCourses(list.sort((a,b) => b.savedAt - a.savedAt)));
    // Capturer beforeinstallprompt
    const handler = e => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ── Auto-save debounce ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!race && !segments.length) return;
    const t = setTimeout(() => {
      idbSave({ race, segments, settings });
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 800);
    return () => clearTimeout(t);
  }, [race, segments, settings]);

  // ── Repos modal ────────────────────────────────────────────────────────────
  const addRepos = () => {
    if (!reposForm.label.trim() || !reposForm.dureeMin) return;
    const startKm = parseFloat(reposForm.startKm) || 0;
    setSegments(s => [...s, { id:Date.now(), type:"repos", label:reposForm.label, startKm, dureeMin:Number(reposForm.dureeMin), endKm:startKm, speedKmh:0, slopePct:0, terrain:"normal", notes:"" }]
      .sort((a,b) => (a.startKm??0)-(b.startKm??0)));
    setReposModal(false);
    setReposForm({ label:"", startKm:"", dureeMin:20 });
  };

  // ── CRUD courses ───────────────────────────────────────────────────────────
  const saveCourse = () => {
    const id = Date.now();
    const segsCourse = segments.filter(s => s.type !== "ravito" && s.type !== "repos");
    const segsRepos  = segments.filter(s => s.type === "repos");
    const totalCourse   = segsCourse.reduce((s,seg) => s + (seg.endKm-seg.startKm)/seg.speedKmh*3600, 0);
    const totalReposSec = segsRepos.reduce((s,seg) => s + (seg.dureeMin||0)*60, 0);
    const totalRavitoSec = (race.ravitos?.length||0) * (settings.ravitoTimeMin||3) * 60;
    const entry = { id, savedAt:id,
      name: settings.raceName || race.name || "Course sans nom",
      distance: race.totalDistance || 0,
      elevPos:  race.totalElevPos  || 0,
      segCount: segsCourse.length,
      startTime: settings.startTime || "07:00",
      totalTime: totalCourse + totalReposSec + totalRavitoSec,
      race, segments, settings };
    idbSaveCourse(id, entry);
    setCourses(prev => [entry, ...prev]);
    return entry;
  };

  const loadCourse = entry => {
    const mergedSettings = { ...EMPTY_SETTINGS, ...(entry.settings||{}), produits:settings.produits||[], equipment:settings.equipment||DEFAULT_EQUIPMENT };
    setRaceRaw(entry.race || {});
    setSegmentsRaw(entry.segments || []);
    setSettingsRaw(mergedSettings);
    idbSave({ race:entry.race, segments:entry.segments, settings:mergedSettings });
    setHasUnsaved(false);
    setCourseView("profil-course");
    setDrawerOpen(false);
  };

  const deleteCourse = id => { idbDeleteCourse(id); setCourses(prev => prev.filter(c=>c.id!==id)); };

  const updateCourse = (id, patch) => setCourses(prev => prev.map(c => {
    if (c.id !== id) return c;
    const updated = {...c,...patch};
    idbSaveCourse(id, updated);
    return updated;
  }));

  const overwriteCourse = id => {
    const totalTime = segments.filter(s=>s.type!=="ravito"&&s.type!=="repos")
      .reduce((s,seg) => s + (seg.endKm-seg.startKm)/seg.speedKmh*3600, 0);
    setCourses(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c,
        name: settings.raceName || race.name || c.name,
        distance: race.totalDistance || 0, elevPos: race.totalElevPos || 0,
        segCount: segments.filter(s=>s.type!=="ravito"&&s.type!=="repos").length,
        startTime: settings.startTime || "07:00", totalTime,
        race, segments, settings, updatedAt: Date.now() };
      idbSaveCourse(id, updated);
      return updated;
    }));
  };

  const navigate = id => { setCourseView(id); };

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const SidebarContent = () => (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"20px 16px 8px",fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:CORAL,letterSpacing:"-0.02em"}}>
        Alex
        <div style={{fontSize:11,color:C.stoneDeep,fontWeight:400,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>Trail Running Strategy</div>
      </div>
      <nav style={{padding:"0 8px",flex:1,display:"flex",flexDirection:"column",gap:2}}>
        {["Analyse","Préparation","Historique"].map(g => (
          <div key={g}>
            <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:C.stoneDeep,padding:"8px 10px 3px",opacity:.7}}>{g}</div>
            {COURSE_NAVS.filter(n=>n.group===g).map(n => (
              <div key={n.id} onClick={()=>{ navigate(n.id); setDrawerOpen(false); }}
                style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,cursor:"pointer",
                  fontWeight:500,fontSize:13,userSelect:"none",transition:"background .15s, color .15s",
                  background:courseView===n.id?`${CORAL}18`:"transparent",
                  color:courseView===n.id?CORAL:C.muted}}>
                {n.label}
              </div>
            ))}
          </div>
        ))}
        {race.gpxPoints?.length > 0 && (
          <div style={{background:"var(--surface-2,#f5f3ef)",borderRadius:10,padding:"10px 12px",fontSize:12,margin:"8px 0"}}>
            <div style={{fontWeight:600,marginBottom:3,color:C.inkLight}}>{settings.raceName||race.name||"Course sans nom"}</div>
            <div style={{color:C.muted}}>{race.totalDistance?.toFixed(1)} km · {Math.round(race.totalElevPos||0)} m D+</div>
            <div style={{color:C.muted}}>{segments.filter(s=>s.type!=="ravito"&&s.type!=="repos").length} segments · {race.ravitos?.length||0} ravitos</div>
          </div>
        )}
      </nav>
      <div style={{padding:"8px 16px 4px",display:"flex",justifyContent:"center",height:20}}>
        {autoSaved && <span style={{fontSize:11,color:C.green,fontWeight:500,animation:"fadeUp .3s ease"}}>✓ Sauvegarde auto</span>}
      </div>
      <div style={{padding:"12px 16px 20px",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:CORAL,
          display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:600}}>Y</div>
        <span style={{fontSize:12,color:C.inkLight,fontWeight:500}}>Ynk · Profil</span>
      </div>
    </div>
  );

  const commonProps = { race, setRace, segments, setSegments, settings, setSettings, isMobile };

  return (
    <div style={{display:"flex",flex:1,overflow:"hidden"}}>

      {/* Sidebar desktop */}
      {!isMobile && (
        <div style={{width:220,flexShrink:0,background:C.white,borderRight:`1px solid ${C.border}`,
          display:"flex",flexDirection:"column",height:"100%",overflowY:"auto"}}>
          <SidebarContent/>
        </div>
      )}

      {/* Mobile topbar */}
      {isMobile && (
        <div style={{position:"fixed",top:52,left:0,right:0,height:48,zIndex:100,
          background:C.white,borderBottom:`1px solid ${C.border}`,
          display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px"}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:500,color:CORAL}}>
            {COURSE_NAVS.find(n=>n.id===courseView)?.label||"Course"}
          </div>
          <button onClick={()=>setDrawerOpen(true)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.inkLight}}>☰</button>
        </div>
      )}

      {/* Mobile drawer */}
      {isMobile && drawerOpen && (
        <div style={{position:"fixed",inset:0,zIndex:300}}>
          <div onClick={()=>setDrawerOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)"}}/>
          <div style={{position:"absolute",top:0,left:0,bottom:0,width:260,
            background:C.white,overflowY:"auto",animation:"slideInLeft .25s ease",display:"flex",flexDirection:"column"}}>
            <button onClick={()=>setDrawerOpen(false)}
              style={{position:"absolute",top:12,right:12,background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.stoneDeep}}>✕</button>
            <SidebarContent/>
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={{flex:1,overflowY:"auto",padding:isMobile?"108px 16px 32px":"44px 52px"}}>
        {courseView==="profil-course"    && <ProfilView    {...commonProps} onOpenRepos={()=>setReposModal(true)} profilDetail={true}/>}
        {courseView==="strategie"        && <StrategieView {...commonProps} onOpenRepos={()=>setReposModal(true)}/>}
        {courseView==="analyse"          && <AnalyseView   {...commonProps} onNavigate={navigate}/>}
        {courseView==="nutrition-course" && <NutritionView {...commonProps} onNavigate={navigate}/>}
        {courseView==="equipement"       && <EquipementView race={race} setRace={setRace} segments={segments} settings={settings} setSettings={setSettings} isMobile={isMobile}/>}
        {courseView==="team"             && <TeamView {...commonProps} sharedMode={sharedMode} installPrompt={installPrompt} onInstall={async()=>{ if(installPrompt){installPrompt.prompt();const{outcome}=await installPrompt.userChoice;if(outcome==="accepted")setInstallPrompt(null);}}} isMobile={isMobile} onLoadStrategy={data=>{ if(data.race)setRaceRaw(data.race); if(data.segments)setSegmentsRaw(data.segments); if(data.settings)setSettingsRaw({...EMPTY_SETTINGS,...data.settings}); idbSave({race:data.race,segments:data.segments,settings:{...EMPTY_SETTINGS,...data.settings}}); }}/>}
        {courseView==="mes-courses"      && <MesCoursesView courses={courses} onLoad={loadCourse} onDelete={deleteCourse} onUpdate={updateCourse} onOverwrite={overwriteCourse} onSaveCurrent={()=>{saveCourse();}} race={race} segments={segments} settings={settings}/>}
      </main>

      {/* Modal repos */}
      {reposModal && (
        <div onClick={()=>setReposModal(false)}
          style={{position:"fixed",inset:0,background:"rgba(28,25,22,0.55)",backdropFilter:"blur(3px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:C.white,borderRadius:16,width:"100%",maxWidth:400,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:500,color:C.inkLight,marginBottom:16}}>Ajouter une pause</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted,marginBottom:5}}>Nom</label>
                <input value={reposForm.label} onChange={e=>setReposForm(f=>({...f,label:e.target.value}))} placeholder="Sommet, village, refuge..."/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={{display:"block",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted,marginBottom:5}}>Km début</label>
                  <input type="number" value={reposForm.startKm} onChange={e=>setReposForm(f=>({...f,startKm:e.target.value}))} placeholder="0"/>
                </div>
                <div>
                  <label style={{display:"block",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted,marginBottom:5}}>Durée (min)</label>
                  <input type="number" value={reposForm.dureeMin} onChange={e=>setReposForm(f=>({...f,dureeMin:e.target.value}))} placeholder="20"/>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
              <button onClick={()=>setReposModal(false)}
                style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Annuler</button>
              <button onClick={addRepos}
                style={{padding:"8px 16px",borderRadius:8,border:"none",background:CORAL,color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:500}}>Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [context, setContext] = useState("home"); // "home" | "train" | "course"
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<=768); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);

  // ── Stride state ──
  const migrateSeances = (ss) => ss.map(s=>({...s,
    activite: TYPE_MIGRATION[s.activite]||s.activite,
    statut: s.statut==="Planifié"?"Planifié":s.statut==="Effectué"?"Effectué":s.statut==="Annulé"?"Annulé":s.statut||"Planifié",
  }));
  const migrateActivites = (aa) => aa.map(a=>({...a,
    type: GARMIN_TO_STRIDE[a.type]||TYPE_MIGRATION[a.type]||a.type,
  }));
  const [seances,       setSeances]      = useState(()=>migrateSeances(lsRead("seances",[])));
  const [activites,     setActivites]    = useState(()=>migrateActivites(lsRead("activites",[])));
  const [sommeil,       setSommeil]      = useState(()=>lsRead("sommeil",[]));
  const [vfcData,       setVfcData]      = useState(()=>lsRead("vfcData",[]));
  const [poids,         setPoids]        = useState(()=>lsRead("poids",[]));
  const [objectifs,     setObjectifs]    = useState(()=>lsRead("objectifs",[]));
  const [planningType,  setPlanningType] = useState(()=>lsRead("planningType",DEFAULT_PLANNING));
  const [activityTypes, setActivityTypes]= useState(()=>lsRead("activityTypes",ACTIVITY_TYPES.filter(t=>t)));
  const [journalNutri,  setJournalNutri] = useState(()=>lsRead("journalNutri",[]));
  const [produits,      setProduits]     = useState(()=>lsRead("produits",[]));
  const [recettes,      setRecettes]     = useState(()=>lsRead("recettes",[]));
  const [profil,        setProfil]       = useState(()=>lsRead("profil",{sexe:"Homme",taille:180}));
  const [confirmReset,  setConfirmReset] = useState(false);

  useEffect(()=>{ lsWrite({seances,activites,sommeil,vfcData,poids,objectifs,planningType,activityTypes,journalNutri,produits,recettes,profil}); },
    [seances,activites,sommeil,vfcData,poids,objectifs,planningType,activityTypes,journalNutri,produits,recettes,profil]);

  const allData  = {seances,activites,sommeil,vfcData,poids,objectifs,planningType,activityTypes,journalNutri,produits,recettes,profil};
  const loadData = (data) => {
    if(data.seances)       setSeances(data.seances);
    if(data.activites)     setActivites(data.activites);
    if(data.sommeil)       setSommeil(data.sommeil);
    if(data.vfcData)       setVfcData(data.vfcData);
    if(data.poids)         setPoids(data.poids);
    if(data.objectifs)     setObjectifs(data.objectifs);
    if(data.planningType)  setPlanningType(data.planningType);
    if(data.activityTypes) setActivityTypes(data.activityTypes);
    if(data.journalNutri)  setJournalNutri(data.journalNutri);
    if(data.produits)      setProduits(data.produits);
    if(data.recettes)      setRecettes(data.recettes);
  };
  const resetAll = () => { setSeances([]); setActivites([]); setSommeil([]); setVfcData([]); setPoids([]); setObjectifs([]); };

  const allTrainProps = { seances,setSeances,activites,setActivites,sommeil,setSommeil,
    vfcData,setVfcData,poids,setPoids,objectifs,setObjectifs,planningType,setPlanningType,
    activityTypes,setActivityTypes,journalNutri,setJournalNutri,produits,setProduits,
    recettes,setRecettes,allData,loadData,resetAll,profil,setProfil,confirmReset,setConfirmReset,isMobile };

  return (
    <>
      <style>{G}</style>
      <Topbar context={context} setContext={setContext}/>
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {context==="home"   && <HomeScreen setContext={setContext} seances={seances} activites={activites} vfcData={vfcData} sommeil={sommeil} poids={poids} objectifs={objectifs}/>}
        {context==="train"  && <TrainLayout allTrainProps={allTrainProps}/>}
        {context==="course" && <CourseLayout isMobile={isMobile} strideObjectifs={objectifs}/>}
      </div>
    </>
  );
}