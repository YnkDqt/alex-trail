import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useAuth } from './AuthContext';
import { loadAthleteProfile, saveAthleteProfile, loadActivities, saveActivities, loadSeances, saveSeances, loadSommeil, saveSommeil, loadVFC, saveVFC, loadPoids, savePoids, loadObjectifs, saveObjectifs, loadCurrentRace, saveCurrentRace, loadCourses, saveCourse, deleteCourse, loadNutrition, saveNutrition, loadStrideSettings, saveStrideSettings } from './supabaseHelpers';
import Login from './Login';

// ─── ALEX IMPORTS ─────────────────────────────────────────────────────────────
import { EMPTY_SETTINGS, DEFAULT_EQUIPMENT, DEFAULT_FLAT_SPEED } from './constants.js';
import ProfilView     from './components/ProfilView.jsx';
import StrategieView  from './components/StrategieView.jsx';
import AnalyseView    from './components/AnalyseView.jsx';
import NutritionView  from './components/NutritionView.jsx';
import EquipementView from './components/EquipementView.jsx';
import TeamView       from './components/TeamView.jsx';
import MesCoursesView from './components/MesCoursesView.jsx';
import ProfilCompte   from './components/ProfilCompte.jsx';
import Confidentialite from './components/Confidentialite.jsx';
import { CIQUAL, CIQUAL_CATEGORIES } from './data/ciqual.js';

// ─── STRIDE IMPORTS ───────────────────────────────────────────────────────────
import { C, LS_KEY, ACTIVITY_TYPES, STATUT_OPTIONS, ACT_ICON,
  GARMIN_TO_STRIDE, TYPE_MIGRATION, DEFAULT_PLANNING,
  isRunning, lsRead, lsWrite, exportJSON, localDate, fmtDate, daysUntil,
  actColor, actColorPale, actIcon, actShort,
  parseCSVActivities, parseCSVSommeil, parseCSVVFC,
  emptySeance, emptyObjectif, emptyPoids, emptyVFC, emptySommeil } from './constants.js';
import { Btn, Modal, Field, FormGrid, ConfirmDialog, statusBadge } from './atoms.jsx';
import Dashboard from './components/Dashboard.jsx';
import { StatusBadge, ActCell, DiffSpan, EntrainementProgramme, ProgrammeView, Programme } from './components/Programme.jsx';
import { FormeVFC, FormeSommeil, FormePoids, Forme } from './components/Forme.jsx';
import { Activites, LinkModal } from './components/Activites.jsx';
import Objectifs from './components/Objectifs.jsx';
import { JournalNutri, Nutrition } from './components/Nutrition.jsx';
import SemaineType from './components/SemaineType.jsx';
import MonCoachIA from './components/MonCoachIA.jsx';
import { Donnees, Parametres, DonneesParams } from './components/Donnees.jsx';

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

// ─── PARTAGE STRATÉGIE ────────────────────────────────────────────────────────
function encodeStrategy(race, segments, settings) {
  const { gpxPoints, ...raceLight } = race;
  const { equipment, garminStats, ...settingsLight } = settings;
  const payload = { race: raceLight, segments, settings: settingsLight, v: 2, ts: Date.now() };
  try {
    const json = JSON.stringify(payload);
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

// ─── ALEX NAVS ───────────────────────────────────────────────────────────────
const ALEX_NAVS = [
  { id: "profil",      label: "Profil de course",   icon: "🗺️", group: "Préparation" },
  { id: "preparation", label: "Stratégie de course", icon: "🎯", group: "Préparation" },
  { id: "nutrition",   label: "Nutrition",           icon: "🍌", group: "Préparation" },
  { id: "parametres",  label: "Équipement",          icon: "🎒", group: "Préparation" },
  { id: "analyse",     label: "Analyse",             icon: "📊", group: "Analyse" },
  { id: "team",        label: "Team",                icon: "👥", group: "Équipe" },
  { id: "courses",     label: "Mes courses",         icon: "📚", group: "Historique" },
];

// ─── ALEX STYLES (styles.jsx exact) ──────────────────────────────────────────
const ALEX_C = { bg:"#F4F0EA", white:"#FDFCFA", sand:"#EDE8DF", sandDark:"#DDD5C8", primary:"#7C5C3E", primaryLight:"#9E7A58", primaryPale:"#F0E8DC", primaryDeep:"#4E3726", secondary:"#5C7A5C", secondaryPale:"#E8F0E8", secondaryDark:"#3D5C3D", text:"#2A2218", muted:"#8C7B6A", border:"#D8CEC0", green:"#5C8C6A", greenPale:"#E6F2EA", yellow:"#B8863A", yellowPale:"#FBF3E2", red:"#B84A3A", redPale:"#FBECEB", blue:"#4A7A9B", bluePale:"#E8F2F8" };
const ALEX_G = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
  .alex-scope *, .alex-scope *::before, .alex-scope *::after { box-sizing: border-box; }
  .alex-scope { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text-c); font-size: 14px; line-height: 1.5; }
  :root {
    --bg: ${ALEX_C.bg};
    --surface: ${ALEX_C.white};
    --surface-2: ${ALEX_C.sand};
    --surface-3: ${ALEX_C.sandDark};
    --border-c: ${ALEX_C.border};
    --text-c: ${ALEX_C.text};
    --muted-c: ${ALEX_C.muted};
    --primary: ${ALEX_C.primary};
  }
  :root.dark {
    --bg: #14100C;
    --surface: #1E1810;
    --surface-2: #26201A;
    --surface-3: #302820;
    --border-c: #3C3028;
    --text-c: #F0EAE0;
    --muted-c: #9A8870;
    --primary: ${ALEX_C.primaryLight};
  }
  .alex-scope input, .alex-scope select, .alex-scope textarea {
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    background: var(--surface-2); color: var(--text-c);
    border: 1px solid var(--border-c); border-radius: 10px;
    padding: 9px 12px; width: 100%; outline: none;
    transition: border 0.2s, box-shadow 0.2s;
  }
  .alex-scope input:focus, .alex-scope select:focus, .alex-scope textarea:focus {
    border-color: ${ALEX_C.primary};
    box-shadow: 0 0 0 3px ${ALEX_C.primaryPale};
  }
  .alex-scope input[type="range"] { background: transparent; border: none; padding: 0; box-shadow: none; accent-color: ${ALEX_C.primary}; }
  .alex-scope table { border-collapse: collapse; width: 100%; }
  .alex-scope thead th { font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted-c); background: var(--surface-2); padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--border-c); }
  .alex-scope tbody tr { border-bottom: 1px solid var(--border-c); transition: background 0.15s; cursor: pointer; }
  .alex-scope tbody tr:hover { background: var(--surface-2); }
  .alex-scope tbody td { padding: 10px 14px; }
  .alex-scope .tbl-wrap { overflow-x: auto; border-radius: 16px; border: 1px solid var(--border-c); }
  .alex-scope .anim { animation: alexFadeUp 0.35s ease both; }
  @keyframes alexFadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .alex-scope .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .alex-scope .form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .alex-scope .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .alex-scope .badge-green  { background: ${ALEX_C.greenPale};      color: ${ALEX_C.green}; }
  .alex-scope .badge-yellow { background: ${ALEX_C.yellowPale};     color: ${ALEX_C.yellow}; }
  .alex-scope .badge-red    { background: ${ALEX_C.redPale};        color: ${ALEX_C.red}; }
  .alex-scope .badge-blue   { background: ${ALEX_C.bluePale};       color: ${ALEX_C.blue}; }
  .alex-scope .badge-brown  { background: ${ALEX_C.primaryPale};    color: ${ALEX_C.primaryDeep}; }
  .alex-scope .badge-sage   { background: ${ALEX_C.secondaryPale};  color: ${ALEX_C.secondaryDark}; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: center; justify-content: center; }
  .modal-box { background: var(--surface); border-radius: 20px; border: 1px solid var(--border-c); max-width: 680px; width: 94vw; max-height: 88vh; overflow-y: auto; padding: 32px; box-shadow: 0 24px 60px rgba(0,0,0,0.18); }
  .confirm-box { background: var(--surface); border-radius: 16px; border: 1px solid var(--border-c); max-width: 400px; width: 90vw; padding: 28px; text-align: center; box-shadow: 0 16px 40px rgba(0,0,0,0.15); }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; cursor: pointer; transition: background 0.15s, color 0.15s; font-weight: 500; color: var(--muted-c); font-size: 14px; user-select: none; }
  .nav-item:hover { background: var(--surface-2); color: var(--text-c); }
  .nav-item.active { background: ${ALEX_C.primaryPale}; color: ${ALEX_C.primaryDeep}; }
  :root.dark .nav-item.active { background: #3A2C1E; color: ${ALEX_C.primaryLight}; }
  @media (max-width: 768px) {
    .alex-scope .grid-2col { grid-template-columns: 1fr; }
    .alex-scope .form-grid { grid-template-columns: repeat(2, 1fr); }
    .modal-overlay { align-items: flex-end; }
    .modal-box { border-radius: 20px 20px 0 0; max-height: 90vh; width: 100vw; padding: 24px; }
  }
  /* Dark mode Stride — override couleurs inline */
  :root.dark .stride-view { background: #1a1714 !important; color: #e8e4de !important; }
  :root.dark .stride-view .card-white { background: #242018 !important; border-color: #3a342c !important; }
  :root.dark .stride-view input,
  :root.dark .stride-view select,
  :root.dark .stride-view textarea { background: #2a231c !important; color: #e8e4de !important; border-color: #3a342c !important; }
`;
// ─── COULEURS STRIDE ────────────────────────────────────────────────────────
const TEAL = "#1D9E75";
const TEAL_PALE = "#e8f5f0";

// ─── ACCUEIL (page d'accueil unifiée) ────────────────────────────────────────
function Accueil({ setView, seances, vfcData, sommeil, poids, objectifs, race, settings }) {
  const today = localDate(new Date());
  const lastVFC     = useMemo(()=>[...vfcData].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[vfcData]);
  const lastSommeil = useMemo(()=>[...sommeil].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[sommeil]);
  const lastPoids   = useMemo(()=>[...poids].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[poids]);
  const nextObj     = useMemo(()=>[...objectifs].filter(o=>o.date>=today).sort((a,b)=>new Date(a.date)-new Date(b.date))[0]||null,[objectifs,today]);

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

  const formeColor = formeScore>=5?C.green:formeScore>=3?C.yellow:C.red;
  const formeLabel = formeScore>=5?"Bonne forme":formeScore>=3?"Forme moyenne":"Récupération";
  const j     = nextObj?daysUntil(nextObj.date):null;
  const phase = j===null?null:j>90?"Fondamental":j>42?"Spécifique":j>14?"Affûtage":j>0?"Tapering":"Course !";
  const phaseColor = j===null?C.muted:j>90?C.sky:j>42?"#e65100":j>14?C.yellow:j>0?C.summit:C.green;
  const ratio = lastVFC?.chargeAigue&&lastVFC?.chargeChronique
    ?Math.round(parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique)*100)/100:null;

  const weeklyKm = useMemo(()=>{
    const now=new Date(); const dow=(now.getDay()+6)%7;
    const thisMon=new Date(now); thisMon.setDate(now.getDate()-dow);
    return Array.from({length:12},(_,i)=>{
      const mon=new Date(thisMon); mon.setDate(thisMon.getDate()-(11-i)*7);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      const monStr=localDate(mon); const sunStr=localDate(sun);
      const ws=seances.filter(s=>s.date>=monStr&&s.date<=sunStr&&s.statut==="Effectué"&&isRunning(s.activite));
      return {
        label:i===11?"Sem.":i===5?"S-6":`S-${11-i}`,
        km:Math.round(ws.reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0)*10)/10,
        dp:Math.round(ws.reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0)),
      };
    });
  },[seances]);
  const maxKm=Math.max(...weeklyKm.map(w=>w.km),1);

  const prepScore = useMemo(()=>{
    if(!nextObj||j===null) return null;
    const raceKm=parseFloat(nextObj.distance)||0;
    const raceDp=parseFloat(nextObj.dp)||0;
    const longMax=Math.max(0,...seances.filter(s=>s.statut==="Effectué"&&isRunning(s.activite)).map(s=>parseFloat(s.kmGarmin)||0));
    const last8=weeklyKm.slice(-8);
    const dpMoy=last8.length?Math.round(last8.reduce((s,w)=>s+w.dp,0)/last8.length):0;
    const dpCible=raceDp>0?Math.round(raceDp/8):0;
    let score=0;
    if(raceKm>0) score+=(longMax>=raceKm*0.7?1:longMax>=raceKm*0.5?0.5:0);
    if(raceDp>0) score+=(dpMoy>=dpCible*0.8?1:dpMoy>=dpCible*0.5?0.5:0);
    score+=formeScore>=5?1:formeScore>=3?0.5:0;
    const pct=Math.round(score/3*100);
    return {pct,longMax,raceKm,dpMoy,dpCible,label:pct>=75?"En bonne voie":pct>=50?"À surveiller":"Insuffisant"};
  },[nextObj,j,seances,weeklyKm,formeScore]);

  const todaySeances=seances.filter(s=>s.date===today&&s.activite!=="Repos");
  const hasRaceGpx=!!(race?.gpxPoints?.length);
  const card={background:C.white,border:`1px solid ${C.border}`,borderRadius:14};
  const lbl={fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:C.muted,marginBottom:8,display:"block"};

  return (
    <div style={{maxWidth:980,margin:"0 auto",padding:"28px 24px 60px"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Fraunces',serif",fontSize:26,fontWeight:500,color:C.inkLight,letterSpacing:"-0.02em",lineHeight:1.2}}>
          Tableau de bord
        </h1>
        {nextObj&&j!==null&&(
          <div style={{fontSize:13,color:C.muted,marginTop:4}}>
            <span style={{fontWeight:600,color:phaseColor}}>{phase}</span>
            {" · "}{nextObj.nom} dans{" "}
            <span style={{fontWeight:600,color:C.inkLight}}>{j} jour{j>1?"s":""}</span>
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:14}}>
        {/* Forme */}
        <div style={{...card,padding:"16px 18px",borderTop:`3px solid ${formeColor}`}}>
          <span style={lbl}>Forme du jour</span>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:formeColor,marginBottom:10}}>{formeLabel}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[{l:"VFC",v:lastVFC?.vfc,u:"ms"},{l:"Sommeil",v:lastSommeil?.score,u:"/100"},{l:"Charge",v:ratio,u:""},{l:"Poids",v:lastPoids?.poids,u:"kg"}].map(({l,v,u})=>(
              <div key={l} style={{background:C.bg,borderRadius:8,padding:"7px 10px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:2}}>{l}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,color:v?C.inkLight:C.stoneDark}}>
                  {v||"—"}{v&&u?<span style={{fontSize:10,color:C.muted}}> {u}</span>:""}
                </div>
              </div>
            ))}
          </div>
          {!lastVFC&&!lastSommeil&&(
            <div style={{marginTop:10,fontSize:12,color:C.muted}}>
              <span onClick={()=>setView("forme")} style={{color:C.forest,cursor:"pointer",fontWeight:500}}>Importer les données Garmin →</span>
            </div>
          )}
        </div>

        {/* Course countdown */}
        <div style={{...card,padding:"16px 18px",borderTop:`3px solid ${phaseColor}`}}>
          <span style={lbl}>Prochaine course</span>
          {nextObj?(
            <>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:4}}>{nextObj.nom||"Course"}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:32,fontWeight:500,color:phaseColor,lineHeight:1,marginBottom:6}}>J-{j}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:10}}>
                {nextObj.distance&&`${nextObj.distance} km`}{nextObj.dp&&` · ${nextObj.dp} m D+`}
              </div>
              <div style={{display:"flex",gap:2,height:5,borderRadius:3,overflow:"hidden",marginBottom:4}}>
                {[{max:180,min:90,col:C.sky},{max:90,min:42,col:"#e65100"},{max:42,min:14,col:C.yellow},{max:14,min:0,col:C.summit}].map(({max,min,col})=>{
                  const active=j!==null&&j<=max&&j>min;
                  return <div key={min} style={{flex:max-min,background:active?col:col+"33",borderRadius:2}}/>;
                })}
              </div>
              <div style={{fontSize:10,color:phaseColor,fontWeight:600,marginBottom:10}}>{phase}</div>
              <button onClick={()=>setView("objectifs")}
                style={{fontSize:11,padding:"4px 10px",borderRadius:7,border:`1px solid ${C.border}`,
                  background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
                Gérer les objectifs →
              </button>
              {prepScore&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:4}}>
                    <span>Préparation</span><span style={{fontWeight:600,color:prepScore.pct>=75?C.green:prepScore.pct>=50?C.yellow:C.red}}>{prepScore.pct}%</span>
                  </div>
                  <div style={{height:5,borderRadius:3,background:C.stone}}>
                    <div style={{height:"100%",borderRadius:3,width:`${prepScore.pct}%`,
                      background:prepScore.pct>=75?C.green:prepScore.pct>=50?C.yellow:C.red,transition:"width .4s"}}/>
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>{prepScore.label}</div>
                </div>
              )}
            </>
          ):(
            <div>
              <div style={{fontSize:13,color:C.muted,fontStyle:"italic",marginBottom:12}}>Aucune course planifiée</div>
              <button onClick={()=>setView("objectifs")}
                style={{fontSize:12,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.border}`,
                  background:"transparent",color:C.inkLight,cursor:"pointer",fontFamily:"inherit"}}>
                Ajouter un objectif →
              </button>
            </div>
          )}
        </div>

        {/* Aujourd'hui */}
        <div style={{...card,padding:"16px 18px",borderTop:`3px solid ${C.forest}`}}>
          <span style={lbl}>Aujourd'hui</span>
          {todaySeances.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:10}}>
              {todaySeances.slice(0,3).map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,background:C.bg}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:actColor(s.activite),flexShrink:0}}/>
                  <div style={{flex:1,fontSize:12,fontWeight:500,color:C.inkLight,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.activite}</div>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:6,background:s.statut==="Effectué"?C.greenPale:C.stone,color:s.statut==="Effectué"?C.green:C.muted,fontWeight:500}}>{s.statut}</span>
                </div>
              ))}
              {todaySeances.length>3&&<div style={{fontSize:11,color:C.muted,textAlign:"center"}}>+{todaySeances.length-3} autres</div>}
            </div>
          ):(
            <div style={{fontSize:13,color:C.muted,fontStyle:"italic",marginBottom:12}}>Repos ou journée libre</div>
          )}
          <button onClick={()=>setView("entrainement")}
            style={{fontSize:12,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.border}`,
              background:"transparent",color:"#1D9E75",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>
            Voir le programme →
          </button>
        </div>
      </div>

      {/* Graphique km 12 semaines */}
      <div style={{...card,padding:"16px 20px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{...lbl,marginBottom:0}}>Charge trail · 12 semaines</span>
          <div style={{display:"flex",gap:16,fontSize:11,color:C.muted}}>
            <span><b style={{color:C.inkLight}}>{weeklyKm.reduce((s,w)=>s+w.km,0).toFixed(0)} km</b> total</span>
            <span><b style={{color:C.inkLight}}>{weeklyKm.reduce((s,w)=>s+w.dp,0).toLocaleString()} m</b> D+</span>
          </div>
        </div>
        <div style={{display:"flex",gap:3,alignItems:"flex-end",height:80}}>
          {weeklyKm.map((w,i)=>{
            const h=Math.max(3,Math.round((w.km/maxKm)*82));
            const isLast=i===11;
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{fontSize:8,color:C.muted,fontFamily:"'DM Mono',monospace",opacity:w.km>0?1:0}}>
                  {w.km>0?w.km:""}
                </div>
                <div title={`${w.km} km · ${w.dp}m D+`}
                  style={{width:"100%",height:h,borderRadius:"3px 3px 0 0",
                    background:isLast?C.forest:w.km>0?C.forestPale:C.stone,
                    border:isLast?`1px solid ${C.forest}`:"none",
                    cursor:"default",transition:"height .3s"}}/>
                <div style={{fontSize:8,color:isLast?C.forest:C.stoneDeep,fontWeight:isLast?600:400,
                  minHeight:10,textAlign:"center",whiteSpace:"nowrap"}}>
                  {i===0||i===5||i===11?w.label:""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stratégie course active */}
      {hasRaceGpx&&(
        <div style={{...card,padding:"16px 20px",borderLeft:`3px solid ${ALEX_C.primary}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <span style={{...lbl,color:ALEX_C.primary}}>Stratégie en cours</span>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:500,color:C.inkLight}}>
              {settings?.raceName||race?.name||"Course sans nom"}
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              {race.totalDistance?.toFixed(1)} km · {Math.round(race.totalElevPos||0)} m D+
              {settings?.startTime&&` · Départ ${settings.startTime}`}
            </div>
          </div>
          <button onClick={()=>setView("profil_course")}
            style={{fontSize:13,padding:"8px 16px",borderRadius:10,border:`1px solid ${ALEX_C.primary}`,
              background:ALEX_C.primaryPale,color:ALEX_C.primaryDeep,cursor:"pointer",fontFamily:"inherit",fontWeight:500,whiteSpace:"nowrap"}}>
            Voir la stratégie →
          </button>
        </div>
      )}
    </div>
  );
}


// ─── DONNÉES & PARAMS VIEW ────────────────────────────────────────────────────
function DonneesParamsView({
  saveAllData, saveData, loadData, saveCourse, race, segments, settings,
  setRace, setSegments, setSettings, hasUnsaved, isStandalone, installDone,
  handleInstall, setView, setDrawerOpen,
  seances, setSeances, activites, setActivites, sommeil, setSommeil,
  vfcData, setVfcData, poids, setPoids, planningType, objectifs,
  allData, loadStrideData, resetAll, journalNutri, confirmReset, setConfirmReset,
  features, toggleFeature, FEATURE_LABELS,
  strideFeatures, toggleStrideFeature, STRIDE_FEATURE_LABELS,
  user,
}) {
  const [tab, setTab] = useState("sauvegarde");

  const TabBtn = ({id, label}) => (
    <button onClick={()=>setTab(id)}
      style={{padding:"8px 18px",border:"none",background:"none",cursor:"pointer",
        fontFamily:"inherit",fontSize:13,fontWeight:tab===id?600:400,
        color:tab===id?C.inkLight:C.muted,
        borderBottom:`2px solid ${tab===id?C.forest:"transparent"}`,
        transition:"all .15s",marginBottom:-1}}>
      {label}
    </button>
  );

  const ToggleRow = ({icon,label,desc,active,onToggle,color}) => {
    const col = color || C.forest;
    return (
      <div onClick={onToggle}
        style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",
          borderRadius:10,cursor:"pointer",transition:"all .15s",
          border:`1.5px solid ${active?col+"50":C.border}`,
          background:active?col+"0D":C.white}}>
        <span style={{fontSize:18,flexShrink:0,opacity:active?1:.5}}>{icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:500,fontSize:13,color:active?C.inkLight:C.muted}}>{label}</div>
          {desc&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{desc}</div>}
        </div>
        <div style={{width:34,height:19,borderRadius:10,flexShrink:0,position:"relative",
          background:active?col:C.stoneDark,transition:"background .2s"}}>
          <div style={{position:"absolute",top:2,left:active?17:2,width:15,height:15,
            borderRadius:"50%",background:"#fff",transition:"left .2s",
            boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
        </div>
      </div>
    );
  };

  const Section = ({title, children}) => (
    <div style={{marginBottom:28}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.09em",
        color:C.muted,marginBottom:14,paddingBottom:8,borderBottom:`1px solid ${C.stone}`}}>
        {title}
      </div>
      {children}
    </div>
  );

  const ActionBtn = ({onClick, icon, label, variant="ghost", disabled=false, badge=null}) => {
    const bg = variant==="primary"?C.forest:variant==="danger"?C.redPale:"transparent";
    const col = variant==="primary"?"#fff":variant==="danger"?C.red:C.inkLight;
    const border = variant==="ghost"?`1px solid ${C.border}`:variant==="danger"?`1px solid ${C.red}30`:"none";
    return (
      <button onClick={onClick} disabled={disabled}
        style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderRadius:10,
          border,background:bg,color:col,cursor:disabled?"not-allowed":"pointer",
          fontSize:13,fontWeight:500,width:"100%",fontFamily:"inherit",
          opacity:disabled?.5:1,transition:"all .15s"}}>
        <span style={{fontSize:16}}>{icon}</span>
        <span style={{flex:1,textAlign:"left"}}>{label}</span>
        {badge&&<span style={{fontSize:11,background:`${C.forest}20`,color:C.forest,
          padding:"2px 8px",borderRadius:20,fontWeight:600}}>{badge}</span>}
      </button>
    );
  };

  return (
    <div style={{maxWidth:680,margin:"0 auto",padding:"28px 32px 60px"}}>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,
          color:C.inkLight,letterSpacing:"-0.02em",marginBottom:4}}>
          Données & Params
        </h1>
        <p style={{fontSize:13,color:C.muted}}>Sauvegarde, import et personnalisation de l'app.</p>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,marginBottom:28}}>
        <TabBtn id="sauvegarde" label="Sauvegarde"/>
        <TabBtn id="modules"    label="Modules"/>
        <TabBtn id="compte"     label="Compte"/>
      </div>

      {/* ── SAUVEGARDE ── */}
      {tab==="sauvegarde"&&(
        <div>
          <Section title="Export / Import">
            <p style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.6}}>
              Un seul fichier JSON pour toutes tes données : profil, activités, forme, courses, nutrition. Pratique pour sauvegarder ou changer d'appareil.
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <ActionBtn onClick={async () => {
                if (!user?.id) return;
                try {
                  const [profile, activities, seances, sommeil, vfc, poids, objectifs, nutrition, settings, currentRace, courses] = await Promise.all([
                    loadAthleteProfile(user.id),
                    loadActivities(user.id),
                    loadSeances(user.id),
                    loadSommeil(user.id),
                    loadVFC(user.id),
                    loadPoids(user.id),
                    loadObjectifs(user.id),
                    loadNutrition(user.id),
                    loadStrideSettings(user.id),
                    loadCurrentRace(user.id),
                    loadCourses(user.id),
                  ]);
                  const exportData = {
                    format: "alex-export-1.0",
                    exportDate: new Date().toISOString(),
                    userId: user.id,
                    userEmail: user.email,
                    profile, activities, seances, sommeil, vfc, poids, objectifs, nutrition, settings, currentRace, courses,
                  };
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `alex-export-${new Date().toISOString().slice(0,10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('Erreur export:', err);
                  alert('Erreur lors de l\'export');
                }
              }} icon="📥" label="Exporter toutes mes données" variant="primary"/>
              
              <label style={{display:"block"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",
                  borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",
                  color:C.inkLight,cursor:"pointer",fontSize:13,fontWeight:500}}>
                  <span style={{fontSize:16}}>📤</span>
                  <span>Importer mes données</span>
                </div>
                <input type="file" accept=".json" style={{display:"none"}}
                  onChange={async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const confirm = window.confirm(
                      "⚠️ ATTENTION\n\n" +
                      "L'import va ÉCRASER toutes tes données actuelles.\n\n" +
                      "Continue uniquement si tu veux restaurer une sauvegarde complète.\n\n" +
                      "Continuer ?"
                    );
                    if (!confirm) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      if (!data.format?.startsWith('alex-export')) {
                        alert('Format de fichier invalide');
                        return;
                      }
                      // Restaurer tout dans Supabase
                      const raceData = data.currentRace?.race?.race ? data.currentRace.race : data.currentRace;
                      await Promise.all([
                        data.profile && saveAthleteProfile(user.id, data.profile),
                        data.activities && saveActivities(user.id, data.activities),
                        data.seances && saveSeances(user.id, data.seances),
                        data.sommeil && saveSommeil(user.id, data.sommeil),
                        data.vfc && saveVFC(user.id, data.vfc),
                        data.poids && savePoids(user.id, data.poids),
                        data.objectifs && saveObjectifs(user.id, data.objectifs),
                        data.nutrition && saveNutrition(user.id, data.nutrition),
                        data.settings && saveStrideSettings(user.id, data.settings),
                        raceData && saveCurrentRace(user.id, raceData.race, raceData.segments, raceData.settings),
                      ]);
                      alert('✅ Import réussi ! Recharge la page.');
                      window.location.reload();
                    } catch (err) {
                      console.error('Erreur import:', err);
                      alert('Erreur lors de l\'import : ' + err.message);
                    }
                  }}/>
              </label>
            </div>
            <div style={{marginTop:14,padding:"10px 14px",background:C.stone,borderRadius:10,fontSize:12,color:C.muted,lineHeight:1.6}}>
              💡 L'import écrase toutes les données. Exporte d'abord si tu veux garder une copie de l'existant.
            </div>
          </Section>

          <Section title="Stratégie de course">
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <ActionBtn
                onClick={saveData}
                icon="📤"
                label="Télécharger la stratégie courante"
                badge={hasUnsaved?"Non sauvegardé":null}
              />
              <label style={{display:"block"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",
                  borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",
                  color:C.inkLight,cursor:"pointer",fontSize:13,fontWeight:500}}>
                  <span style={{fontSize:16}}>📂</span>
                  <span>Charger une stratégie</span>
                </div>
                <input type="file" accept=".json" style={{display:"none"}}
                  onChange={e=>{if(e.target.files[0])loadData(e.target.files[0]);}}/>
              </label>
              <ActionBtn onClick={()=>{
                const hasData=race.gpxPoints?.length>0||segments.length>0;
                if(hasData){const ok=window.confirm(`Démarrer une nouvelle course ?

OK = sauvegarder avant.
Annuler = tout effacer.`);if(ok)saveCourse();}
                const ns={...EMPTY_SETTINGS,produits:settings.produits||[],equipment:settings.equipment||DEFAULT_EQUIPMENT,darkMode:settings.darkMode};
                setRace({});setSegments([]);setSettings(ns);setView("profil_course");setDrawerOpen(false);
              }} icon="🔄" label="Nouvelle course"/>
              {!isStandalone&&!installDone&&(
                <ActionBtn onClick={handleInstall} icon="📲" label="Installer l'app"/>
              )}
              {isStandalone&&(
                <div style={{fontSize:12,color:C.green,padding:"6px 0",display:"flex",alignItems:"center",gap:6}}>
                  <span>✓</span><span>App installée</span>
                </div>
              )}
            </div>
          </Section>
        </div>
      )}

      {/* ── MODULES ── */}
      {tab==="modules"&&(
        <div>
          <Section title="Entraînement">
            <ToggleRow icon="↑" label="Section Entraînement"
              desc="Masque entièrement la section dans la navigation"
              active={strideFeatures._section!==false}
              onToggle={()=>toggleStrideFeature("_section")}
              color={TEAL}
            />
            {strideFeatures._section!==false&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8,paddingLeft:16,borderLeft:`2px solid ${TEAL}30`}}>
                {STRIDE_FEATURE_LABELS.map(({key,label,icon,desc})=>(
                  <ToggleRow key={key} icon={icon} label={label} desc={desc}
                    active={strideFeatures[key]!==false}
                    onToggle={()=>toggleStrideFeature(key)}
                    color={TEAL}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Course">
            <ToggleRow icon="🗺️" label="Section Course"
              desc="Masque entièrement la section dans la navigation"
              active={features._section!==false}
              onToggle={()=>toggleFeature("_section")}
              color={ALEX_C.primary}
            />
            {features._section!==false&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8,paddingLeft:16,borderLeft:`2px solid ${ALEX_C.primary}30`}}>
                {FEATURE_LABELS.map(({key,label,icon,desc})=>(
                  <ToggleRow key={key} icon={icon} label={label} desc={desc}
                    active={features[key]}
                    onToggle={()=>toggleFeature(key)}
                    color={ALEX_C.primary}
                  />
                ))}
              </div>
            )}
            <div style={{marginTop:14,padding:"10px 14px",background:C.stone,
              borderRadius:10,fontSize:12,color:C.muted,lineHeight:1.5}}>
              💡 Profil de course et Stratégie sont toujours visibles si la section est active.
            </div>
          </Section>
        </div>
      )}

      {/* ── COMPTE ── */}
      {tab==="compte"&&(
        <div>
          <Section title="Synchronisation cloud">
            <div style={{background:C.skyPale,border:`1px solid ${C.sky}30`,
              borderRadius:12,padding:"20px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <span style={{fontSize:28}}>☁️</span>
                <div>
                  <div style={{fontSize:15,fontWeight:600,color:C.sky,marginBottom:2}}>
                    Supabase — bientôt disponible
                  </div>
                  <div style={{fontSize:12,color:C.muted}}>
                    Accède à tes données depuis n'importe quel appareil
                  </div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  "Sauvegarde automatique dans le cloud",
                  "Synchronisation mobile ↔ desktop",
                  "Partage avec un coach",
                  "Historique illimité",
                ].map(f=>(
                  <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.sky}}>
                    <span>→</span><span>{f}</span>
                  </div>
                ))}
              </div>
              <button disabled style={{marginTop:16,width:"100%",padding:"10px",borderRadius:10,
                border:`1px solid ${C.sky}`,background:"transparent",color:C.sky,
                cursor:"not-allowed",fontSize:13,fontWeight:500,fontFamily:"inherit",opacity:0.6}}>
                Créer un compte — bientôt
              </button>
            </div>
          </Section>

          <Section title="Stockage local">
            <div style={{background:C.stone,borderRadius:12,padding:"16px",fontSize:12,color:C.muted,lineHeight:1.6}}>
              <div style={{marginBottom:8,fontWeight:600,color:C.inkLight}}>État actuel</div>
              <div>• Entraînement → localStorage <code>stride_v2</code></div>
              <div>• Stratégie course → IndexedDB <code>alex-trail</code></div>
              <div>• Profil → localStorage <code>profil</code></div>
              <div style={{marginTop:8,color:C.stoneDeep}}>Migration Supabase prévue — données conservées à la transition.</div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ─── APP LAYOUT UNIFIÉ ────────────────────────────────────────────────────────

function AppLayout({
  // Stride state
  seances, setSeances, activites, setActivites, sommeil, setSommeil,
  vfcData, setVfcData, poids, setPoids, objectifs, setObjectifs,
  planningType, setPlanningType, activityTypes, setActivityTypes,
  journalNutri, setJournalNutri, produits, setProduits, recettes, setRecettes,
  allData, loadStrideData, resetAll, profil, setProfil,
  confirmReset, setConfirmReset, isMobile,
  // Alex state (depuis CourseLayout inline)
  view, setView, race, setRace, segments, setSegments, settings, setSettings,
  hasUnsaved, autoSaved, courses, drawerOpen, setDrawerOpen,
  reposModal, setReposModal, reposForm, setReposForm, addRepos,
  saveData, loadData, saveCourse, loadCourse, deleteCourse, updateCourse, overwriteCourse,
  navigate, hasRace, isStandalone, installDone, handleInstall, showInstallGuide, setShowInstallGuide,
  features, toggleFeature, FEATURE_LABELS, NAVS_ACTIVE,
  strideFeatures, toggleStrideFeature, STRIDE_FEATURE_LABELS,
  saveAllData,
  sharedMode, installPrompt,
  signOut,
  user,
}) {
  const subNavBtn = (id,label,active,onClick) => (
    <button key={id} onClick={onClick}
      style={{padding:"5px 14px",border:`0.5px solid ${active?TEAL:C.border}`,
        background:active?TEAL:"transparent",color:active?C.white:C.muted,
        borderRadius:20,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:active?500:400}}>
      {label}
    </button>
  );

  const [subView, setSubView] = useState({entrainement:"programme",forme:"vfc"});
  const setSubV = (parent,sub) => setSubView(sv=>({...sv,[parent]:sub}));

  const isDark = settings?.darkMode || false;

  // Navigation unifiée
  const NAV_GROUPS = [
    { label: null, color: null, items: [
      { id:"accueil", label:"Tableau de bord", icon:"◉" },
    ]},
    ...(strideFeatures._section!==false ? [{ label: "Entraînement", color: TEAL, items: [
      { id:"entrainement", label:"Programme",  icon:"↑", feat:"programme" },
      { id:"activites",    label:"Activités",  icon:"▣", feat:"activites" },
      { id:"forme",        label:"Forme",      icon:"♡", feat:"forme" },
      { id:"objectifs",    label:"Objectifs",  icon:"🏔", feat:"objectifs" },
    ].filter(n=>strideFeatures[n.feat]!==false)}] : []),
    ...(features._section!==false ? [{ label: "Course", color: ALEX_C.primary, items: [
      { id:"profil_course",  label:"Profil de course",   icon:"🗺️" },
      { id:"strategie",      label:"Stratégie",          icon:"🎯" },
      ...(features.nutrition  ? [{ id:"nutrition_alex",  label:"Nutrition",   icon:"🍌" }] : []),
      ...(features.equipement ? [{ id:"equipement",      label:"Équipement",  icon:"🎒" }] : []),
      ...(features.analyse    ? [{ id:"analyse",         label:"Analyse",     icon:"📊" }] : []),
      ...(features.team       ? [{ id:"team",            label:"Team",        icon:"👥" }] : []),
      ...(features.courses    ? [{ id:"mes_courses",     label:"Mes courses", icon:"📚" }] : []),
    ]}] : []),
  ];

  const allViews = NAV_GROUPS.flatMap(g=>g.items).map(i=>i.id);
  const currentGroup = NAV_GROUPS.find(g=>g.items.some(i=>i.id===view));
  const accentColor = currentGroup?.color || TEAL;

  const SidebarContent = () => (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.white}}>
      {/* Logo */}
      <div style={{padding:"20px 18px 14px",display:"flex",alignItems:"center",gap:8}}>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:500,
          color:accentColor,letterSpacing:"-0.03em"}}>Alex</div>
        {window.location.hostname!=="alex-trail.vercel.app"&&!window.location.hostname.includes("localhost")&&(
          <span style={{fontSize:10,fontWeight:700,background:C.yellow+"30",color:C.yellow,
            border:`1px solid ${C.yellow}60`,borderRadius:5,padding:"2px 7px"}}>DEV</span>
        )}
      </div>
      <div style={{height:1,background:C.border,margin:"0 14px"}}/>

      {/* Navigation */}
      <nav style={{padding:"4px 8px",flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:1}}>
        {NAV_GROUPS.map((g,gi)=>(
          <div key={gi} style={{marginBottom:2}}>
            {g.label&&(
              <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",
                color:g.color||C.stoneDeep,padding:"10px 10px 3px",opacity:.8}}>{g.label}</div>
            )}
            {g.items.map(n=>{
              const active=view===n.id;
              const groupColor=g.color||TEAL;
              return (
                <div key={n.id} onClick={()=>{setView(n.id);setDrawerOpen(false);}}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",
                    borderRadius:9,cursor:"pointer",fontWeight:active?600:400,fontSize:13,
                    userSelect:"none",transition:"background .15s, color .15s",
                    background:active?groupColor+"18":"transparent",
                    color:active?groupColor:C.muted}}>
                  <span style={{fontSize:13,opacity:active?1:.7}}>{n.icon}</span>
                  <span>{n.label}</span>
                  {n.id==="profil_course"&&hasRace&&(
                    <span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:ALEX_C.primary,flexShrink:0}}/>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div style={{height:1,background:C.border,margin:"6px 4px"}}/>

        {/* Coach IA */}
        <div onClick={()=>{setView("coach");setDrawerOpen(false);}}
          style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:9,
            cursor:"pointer",fontSize:13,fontWeight:view==="coach"?600:400,userSelect:"none",
            background:view==="coach"?C.summit+"18":"transparent",
            color:view==="coach"?C.summit:C.muted,transition:"background .15s"}}>
          <span style={{fontSize:13}}>✦</span>
          <span>Coach IA</span>
        </div>

        {/* Données & Params */}
        <div onClick={()=>{setView("donnees_params");setDrawerOpen(false);}}
          style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:9,
            cursor:"pointer",fontSize:13,fontWeight:view==="donnees_params"?600:400,userSelect:"none",
            background:view==="donnees_params"?C.stone:"transparent",
            color:view==="donnees_params"?C.inkLight:C.muted,transition:"background .15s"}}>
          <span style={{fontSize:13}}>⚙</span>
          <span>Données & Params</span>
          {(hasUnsaved||autoSaved)&&(
            <span style={{marginLeft:"auto",fontSize:10,color:autoSaved?C.green:C.yellow,fontWeight:600}}>
              {autoSaved?"✓":"●"}
            </span>
          )}
        </div>
      </nav>

      <div style={{height:1,background:C.border,margin:"0 14px"}}/>

      {/* Dark mode */}
      <div style={{padding:"10px 14px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:12,color:C.muted,fontWeight:500}}>{isDark?"🌙 Mode sombre":"☀️ Mode clair"}</span>
        <div onClick={()=>setSettings(s=>({...s,darkMode:!s.darkMode}))}
          style={{width:36,height:20,borderRadius:10,cursor:"pointer",position:"relative",
            background:isDark?ALEX_C.primary:C.stoneDark,transition:"background .2s",flexShrink:0}}>
          <div style={{position:"absolute",top:2,left:isDark?18:2,width:16,height:16,
            borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
        </div>
      </div>

      {/* Profil avatar */}
      <div onClick={()=>{setView("profil_compte");setDrawerOpen(false);}}
        style={{padding:"10px 14px 10px",display:"flex",alignItems:"center",gap:8,
          cursor:"pointer",transition:"background .15s"}}
        onMouseEnter={e=>{e.currentTarget.style.background=C.stone}}
        onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:accentColor,flexShrink:0,
          display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700}}>
          {(profil?.prenom||"?").slice(0,2).toUpperCase()}
        </div>
        <span style={{fontSize:12,color:C.inkLight,fontWeight:500,flex:1}}>{profil?.prenom||"Mon profil"}</span>
        <span style={{fontSize:14,color:C.stoneDeep}}>›</span>
      </div>

      {/* Déconnexion */}
      <div style={{padding:"6px 14px 4px",fontSize:11,color:C.muted,borderTop:`1px solid ${C.border}`,marginTop:6}}>
        <span onClick={()=>{setView("confidentialite");setDrawerOpen(false);}}
          style={{cursor:"pointer",textDecoration:"underline"}}>
          Politique de confidentialité
        </span>
      </div>
      <div onClick={signOut}
        style={{padding:"6px 14px 18px",display:"flex",alignItems:"center",gap:8,
          cursor:"pointer",transition:"background .15s"}}
        onMouseEnter={e=>{e.currentTarget.style.background=C.redPale}}
        onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
        <span style={{fontSize:12,color:C.red,fontWeight:500}}>Déconnexion</span>
      </div>
    </div>
  );

  // Calcul padding mobile
  const mobileTopH = 48;

  return (
    <>
      <style>{G}</style>
      <style>{ALEX_G}</style>
      {/* MODAL REPOS */}
      {reposModal&&(
        <div onClick={()=>setReposModal(false)} style={{position:"fixed",inset:0,background:"rgba(28,25,22,0.55)",backdropFilter:"blur(3px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:16,width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{padding:"18px 22px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:500}}>Ajouter un segment de repos</div>
              <button onClick={()=>setReposModal(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.muted}}>×</button>
            </div>
            <div style={{padding:22,display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={{display:"block",fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",color:C.muted,marginBottom:6}}>Nom du repos</label>
                <input value={reposForm.label} onChange={e=>setReposForm(f=>({...f,label:e.target.value}))} placeholder="Sommet, village..."/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{display:"block",fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",color:C.muted,marginBottom:6}}>Km de début</label>
                  <input type="number" value={reposForm.startKm} onChange={e=>setReposForm(f=>({...f,startKm:e.target.value}))} placeholder="0"/></div>
                <div><label style={{display:"block",fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",color:C.muted,marginBottom:6}}>Durée (min)</label>
                  <input type="number" value={reposForm.dureeMin} onChange={e=>setReposForm(f=>({...f,dureeMin:e.target.value}))} placeholder="20"/></div>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}>
                <button onClick={()=>setReposModal(false)} style={{padding:"9px 18px",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
                <button onClick={addRepos} style={{padding:"9px 20px",borderRadius:10,border:"none",background:ALEX_C.primary,color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>Ajouter</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* GUIDE INSTALL */}
      {showInstallGuide&&(
        <div onClick={()=>setShowInstallGuide(false)} style={{position:"fixed",inset:0,background:"rgba(28,25,22,0.55)",backdropFilter:"blur(3px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:16,width:"100%",maxWidth:400,padding:28}}>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:600,marginBottom:16}}>Installer Alex</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[{step:"1",text:"Ouvre le menu du navigateur (⋮ ou ···)"},{step:"2",text:"Cherche « Ajouter à l'écran d'accueil » ou « Installer »"},{step:"3",text:"Confirme l'installation"}].map(s=>(
                <div key={s.step} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:ALEX_C.primary,color:"#fff",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.step}</div>
                  <span style={{fontSize:13,lineHeight:1.5}}>{s.text}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:20,display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>setShowInstallGuide(false)} style={{background:ALEX_C.primary,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Compris</button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",height:"100%",overflow:"hidden",background:C.bg}}>
        {/* Sidebar desktop */}
        {!isMobile&&(
          <div style={{width:228,flexShrink:0,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",height:"100%",overflowY:"auto"}}>
            <SidebarContent/>
          </div>
        )}

        {/* Mobile topbar */}
        {isMobile&&(
          <div style={{position:"fixed",top:0,left:0,right:0,height:mobileTopH,zIndex:100,
            background:C.white,borderBottom:`1px solid ${C.border}`,
            display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px"}}>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:500,color:accentColor}}>Alex</div>
            <div style={{fontSize:12,color:C.muted,flex:1,textAlign:"center"}}>
              {NAV_GROUPS.flatMap(g=>g.items).find(n=>n.id===view)?.label||""}
            </div>
            <button onClick={()=>setDrawerOpen(true)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.inkLight}}>☰</button>
          </div>
        )}

        {/* Mobile drawer */}
        {isMobile&&drawerOpen&&(
          <div style={{position:"fixed",inset:0,zIndex:300}}>
            <div onClick={()=>setDrawerOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)"}}/>
            <div style={{position:"absolute",top:0,left:0,bottom:0,width:260,
              overflowY:"auto",animation:"slideInLeft .25s ease",display:"flex",flexDirection:"column"}}>
              <button onClick={()=>setDrawerOpen(false)}
                style={{position:"absolute",top:12,right:12,background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.stoneDeep}}>✕</button>
              <SidebarContent/>
            </div>
          </div>
        )}

        {/* Contenu principal */}
        <div className="alex-scope" style={{flex:1,overflowY:"auto",paddingTop:isMobile?mobileTopH:0,background:isDark?"#14100C":undefined}}>
          {/* Vues Stride */}
          {view==="accueil" && <Accueil setView={setView} seances={seances} vfcData={vfcData} sommeil={sommeil} poids={poids} objectifs={objectifs} race={race} settings={settings}/>}
          {view==="objectifs" && <Objectifs objectifs={objectifs} setObjectifs={setObjectifs} seances={seances} activites={activites} vfcData={vfcData} poids={poids} profil={profil} produits={produits} recettes={recettes} allData={allData}/>}
          {view==="coach" && <MonCoachIA seances={seances} setSeances={setSeances} activites={activites} sommeil={sommeil} vfcData={vfcData} poids={poids} objectifs={objectifs} planningType={planningType} produits={produits} recettes={recettes} journalNutri={journalNutri} activityTypes={activityTypes}/>}
          {view==="activites" && <Activites activites={activites} setActivites={setActivites} seances={seances} setSeances={setSeances}/>}
          {view==="entrainement" && (
            <div>
              <div style={{padding:"10px 24px",borderBottom:`1px solid ${C.border}`,background:C.white,display:"flex",gap:6,flexWrap:"wrap"}}>
                {[{id:"programme",l:"Programme"},{id:"nutrition",l:"Nutrition entraînement"},{id:"planning",l:"Semaine type"}]
                  .map(({id,l})=>subNavBtn(id,l,subView.entrainement===id,()=>setSubV("entrainement",id)))}
              </div>
              {subView.entrainement==="programme"&&<EntrainementProgramme seances={seances} setSeances={setSeances} activites={activites} setActivites={setActivites} objectifs={objectifs} planningType={planningType} setPlanningType={setPlanningType} activityTypes={activityTypes} setActivityTypes={setActivityTypes} allData={allData} loadData={loadStrideData} resetAll={resetAll} setView={setView}/>}
              {subView.entrainement==="nutrition"&&<Nutrition produits={produits} setProduits={setProduits} recettes={recettes} setRecettes={setRecettes} seances={seances} setSeances={setSeances}/>}
              {subView.entrainement==="planning"&&<SemaineType planningType={planningType} setPlanningType={setPlanningType} seances={seances} setSeances={setSeances} activityTypes={activityTypes}/>}
            </div>
          )}
          {view==="forme" && (
            <div>
              <div style={{padding:"10px 24px",borderBottom:`1px solid ${C.border}`,background:C.white,display:"flex",gap:6,flexWrap:"wrap"}}>
                {[{id:"vfc",l:"VFC & Charge"},{id:"sommeil",l:"Sommeil"},{id:"nutrition",l:"Journal nutritionnel"},{id:"poids",l:"Suivi corporel"}]
                  .map(({id,l})=>subNavBtn(id,l,subView.forme===id,()=>setSubV("forme",id)))}
              </div>
              {subView.forme==="vfc"&&<FormeVFC sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData} poids={poids} setPoids={setPoids} activites={activites}/>}
              {subView.forme==="sommeil"&&<FormeSommeil sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData} poids={poids} setPoids={setPoids} activites={activites}/>}
              {subView.forme==="nutrition"&&<JournalNutri journalNutri={journalNutri} setJournalNutri={setJournalNutri}/>}
              {subView.forme==="poids"&&<FormePoids sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData} poids={poids} setPoids={setPoids} activites={activites} profil={profil} setProfil={setProfil}/>}
            </div>
          )}
          {/* Vues Alex Course */}
          {view==="profil_course"&&<div style={{padding:"24px 32px"}}><ProfilView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} onOpenRepos={()=>setReposModal(true)} isMobile={isMobile} profilDetail={features.profilDetail} profil={profil}/></div>}
          {view==="strategie"&&<div style={{padding:"24px 32px"}}><StrategieView race={race} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} onOpenRepos={()=>setReposModal(true)} isMobile={isMobile} profil={profil}/></div>}
          {view==="nutrition_alex"&&<div style={{padding:"24px 32px"}}><NutritionView segments={segments} settings={settings} setSettings={setSettings} race={race} setRace={setRace} isMobile={isMobile} onNavigate={setView} profil={profil} poids={poids} produits={produits} setProduits={setProduits} recettes={recettes}/></div>}
          {view==="equipement"&&<div style={{padding:"24px 32px"}}><EquipementView settings={settings} setSettings={setSettings} race={race} setRace={setRace} segments={segments} isMobile={isMobile}/></div>}
          {view==="analyse"&&<div style={{padding:"24px 32px"}}><AnalyseView race={race} segments={segments} settings={settings} isMobile={isMobile} onNavigate={setView}/></div>}
          {view==="team"&&<div style={{padding:"24px 32px"}}><TeamView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} sharedMode={sharedMode} installPrompt={installPrompt} onInstall={handleInstall} isMobile={isMobile} onLoadStrategy={data=>{
            if(data.race)setRace(data.race);
            if(data.segments)setSegments(data.segments);
            if(data.settings)setSettings({...EMPTY_SETTINGS,...data.settings});
          }}/></div>}
          {view==="mes_courses"&&<div style={{padding:"24px 32px"}}><MesCoursesView courses={courses} onLoad={loadCourse} onDelete={deleteCourse} onUpdate={updateCourse} onOverwrite={overwriteCourse} onSaveCurrent={()=>{saveCourse();alert("✅ Stratégie sauvegardée !");}} race={race} segments={segments} settings={settings}/></div>}
          {/* Données & Params unifiés */}
          {view==="donnees_params"&&<DonneesParamsView
            saveAllData={saveAllData} saveData={saveData} loadData={loadData}
            saveCourse={saveCourse} race={race} segments={segments} settings={settings}
            setRace={setRace} setSegments={setSegments} setSettings={setSettings}
            hasUnsaved={hasUnsaved} isStandalone={isStandalone} installDone={installDone}
            handleInstall={handleInstall} setView={setView} setDrawerOpen={setDrawerOpen}
            seances={seances} setSeances={setSeances} activites={activites} setActivites={setActivites}
            sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData}
            poids={poids} setPoids={setPoids} planningType={planningType} objectifs={objectifs}
            allData={allData} loadStrideData={loadStrideData} resetAll={resetAll}
            journalNutri={journalNutri} confirmReset={confirmReset} setConfirmReset={setConfirmReset}
            features={features} toggleFeature={toggleFeature} FEATURE_LABELS={FEATURE_LABELS}
            strideFeatures={strideFeatures} toggleStrideFeature={toggleStrideFeature} STRIDE_FEATURE_LABELS={STRIDE_FEATURE_LABELS}
            user={user}
          />}
          {/* Profil unifié */}
          {view==="profil_compte"&&(
            <div style={{padding:"28px 32px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
                <button onClick={()=>setView("accueil")}
                  style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:C.muted,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>← Retour</button>
                <span style={{fontSize:11,color:C.stoneDark}}>|</span>
                <span style={{fontSize:13,color:C.inkLight,fontWeight:500}}>Profil</span>
              </div>
              <ProfilCompte profil={profil} setProfil={setProfil}/>
            </div>
          )}
          {/* Politique de confidentialité */}
          {view==="confidentialite"&&<Confidentialite setView={setView}/>}
        </div>
      </div>

      <ConfirmDialog open={confirmReset} message="Effacer toutes les données ? Cette action est irréversible."
        onConfirm={()=>{resetAll();setConfirmReset(false);}} onCancel={()=>setConfirmReset(false)}/>
    </>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, signOut } = useAuth();
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<=768); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);

  // ── Stride state ──────────────────────────────────────────────────────────
  const migrateSeances = ss=>ss.map(s=>({...s,
    activite:TYPE_MIGRATION[s.activite]||s.activite,
    statut:s.statut==="Planifié"?"Planifié":s.statut==="Effectué"?"Effectué":s.statut==="Annulé"?"Annulé":s.statut||"Planifié",
  }));
  const migrateActivites = aa=>aa.map(a=>({...a,type:GARMIN_TO_STRIDE[a.type]||TYPE_MIGRATION[a.type]||a.type}));

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

  useEffect(()=>{
    lsWrite({seances,activites,sommeil,vfcData,poids,objectifs,planningType,activityTypes,journalNutri,produits,recettes,profil});
  },[seances,activites,sommeil,vfcData,poids,objectifs,planningType,activityTypes,journalNutri,produits,recettes,profil]);

  // Load activités depuis Supabase au mount
  useEffect(()=>{
    if (!user?.id) return;
    loadActivities(user.id).then(data => {
      if (data && data.length > 0) {
        setActivites(data);
      }
    }).catch(err => console.error('Erreur load activités:', err));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load séances depuis Supabase au mount
  useEffect(()=>{
    if (!user?.id) return;
    loadSeances(user.id).then(data => {
      if (data && data.length > 0) {
        setSeances(data);
      }
    }).catch(err => console.error('Erreur load séances:', err));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load sommeil depuis Supabase au mount
  useEffect(()=>{
    if (!user?.id) return;
    loadSommeil(user.id).then(data => {
      if (data && data.length > 0) setSommeil(data);
    }).catch(err => console.error('Erreur load sommeil:', err));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load VFC depuis Supabase au mount
  useEffect(()=>{
    if (!user?.id) return;
    loadVFC(user.id).then(data => {
      if (data && data.length > 0) setVfcData(data);
    }).catch(err => console.error('Erreur load VFC:', err));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load poids depuis Supabase au mount
  useEffect(()=>{
    if (!user?.id) return;
    loadPoids(user.id).then(data => {
      if (data && data.length > 0) setPoids(data);
    }).catch(err => console.error('Erreur load poids:', err));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load objectifs depuis Supabase au mount
  useEffect(()=>{
    if (!user?.id) return;
    loadObjectifs(user.id).then(data => {
      if (data && data.length > 0) setObjectifs(data);
    }).catch(err => console.error('Erreur load objectifs:', err));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load nutrition depuis Supabase au mount
  useEffect(()=>{
    if (!user?.id) return;
    loadNutrition(user.id).then(data => {
      if (data.produits && data.produits.length > 0) setProduits(data.produits);
      if (data.recettes && data.recettes.length > 0) setRecettes(data.recettes);
      if (data.journalNutri && data.journalNutri.length > 0) setJournalNutri(data.journalNutri);
    }).catch(err => console.error('Erreur load nutrition:', err));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load stride settings (planningType, activityTypes) depuis Supabase au mount
  useEffect(()=>{
    if (!user?.id) return;
    loadStrideSettings(user.id).then(data => {
      if (data.planningType) setPlanningType(data.planningType);
      if (data.activityTypes && data.activityTypes.length > 0) setActivityTypes(data.activityTypes);
    }).catch(err => console.error('Erreur load stride settings:', err));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save activités vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || activites.length === 0) return;
    const timer = setTimeout(() => {
      saveActivities(user.id, activites).catch(err => console.error('Erreur save activités:', err));
    }, 2000);
    return () => clearTimeout(timer);
  }, [activites, user?.id]);

  // Auto-save séances vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || seances.length === 0) return;
    const timer = setTimeout(() => {
      saveSeances(user.id, seances).catch(err => console.error('Erreur save séances:', err));
    }, 2000);
    return () => clearTimeout(timer);
  }, [seances, user?.id]);

  // Auto-save sommeil vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || sommeil.length === 0) return;
    const timer = setTimeout(() => {
      saveSommeil(user.id, sommeil).catch(err => console.error('Erreur save sommeil:', err));
    }, 2000);
    return () => clearTimeout(timer);
  }, [sommeil, user?.id]);

  // Auto-save VFC vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || vfcData.length === 0) return;
    const timer = setTimeout(() => {
      saveVFC(user.id, vfcData).catch(err => console.error('Erreur save VFC:', err));
    }, 2000);
    return () => clearTimeout(timer);
  }, [vfcData, user?.id]);

  // Auto-save poids vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || poids.length === 0) return;
    const timer = setTimeout(() => {
      savePoids(user.id, poids).catch(err => console.error('Erreur save poids:', err));
    }, 2000);
    return () => clearTimeout(timer);
  }, [poids, user?.id]);

  // Auto-save objectifs vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || objectifs.length === 0) return;
    const timer = setTimeout(() => {
      saveObjectifs(user.id, objectifs).catch(err => console.error('Erreur save objectifs:', err));
    }, 2000);
    return () => clearTimeout(timer);
  }, [objectifs, user?.id]);

  // Auto-save nutrition vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id) return;
    if (journalNutri.length === 0 && produits.length === 0 && recettes.length === 0) return;
    const timer = setTimeout(() => {
      saveNutrition(user.id, journalNutri, produits, recettes).catch(err => console.error('Erreur save nutrition:', err));
    }, 2000);
    return () => clearTimeout(timer);
  }, [journalNutri, produits, recettes, user?.id]);

  // Auto-save stride settings vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id) return;
    const timer = setTimeout(() => {
      saveStrideSettings(user.id, planningType, activityTypes).catch(err => console.error('Erreur save stride settings:', err));
    }, 2000);
    return () => clearTimeout(timer);
  }, [planningType, activityTypes, user?.id]);

  // Init profil.taille depuis dernier poids si vide (mount uniquement)
  useEffect(()=>{
    if(!profil.taille && poids.length){
      const last = [...poids].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
      if(last.taille) setProfil(p=>({...p, taille:last.taille}));
    }
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const allData = {seances,activites,sommeil,vfcData,poids,objectifs,planningType,activityTypes,journalNutri,produits,recettes,profil};
  const loadStrideData = data => {
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
    if(data.profil)        setProfil(data.profil);
  };
  const resetAll = ()=>{ setSeances([]); setActivites([]); setSommeil([]); setVfcData([]); setPoids([]); setObjectifs([]); };

  // ── Alex state (ex-CourseLayout) ─────────────────────────────────────────
  const [view,         setView]         = useState("accueil");
  const [raceRaw,      setRaceRaw]      = useState({});
  const [segmentsRaw,  setSegmentsRaw]  = useState([]);
  const [settingsRaw,  setSettingsRaw]  = useState({...EMPTY_SETTINGS});
  const [hasUnsaved,   setHasUnsaved]   = useState(false);
  const [autoSaved,    setAutoSaved]    = useState(false);
  const [courses,      setCourses]      = useState([]);
  const [sharedMode,   setSharedMode]   = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [reposModal,   setReposModal]   = useState(false);
  const [reposForm,    setReposForm]    = useState({label:"",startKm:"",dureeMin:20});
  const [installPrompt,setInstallPrompt]= useState(null);
  const [installDone,  setInstallDone]  = useState(false);
  const [showInstallGuide,setShowInstallGuide]=useState(false);

  // Features Alex (Course)
  const FEATURES_DEFAULT={nutrition:true,equipement:true,analyse:true,team:true,courses:true,profilDetail:true};
  // Features Stride (Entraînement)
  const STRIDE_FEATURES_DEFAULT={programme:true,activites:true,forme:true,objectifs:true,coach:true};
  const [strideFeatures, setStrideFeatures] = useState(()=>{
    try{const s=localStorage.getItem("stride-features");return s?{...STRIDE_FEATURES_DEFAULT,...JSON.parse(s)}:STRIDE_FEATURES_DEFAULT;}catch{return STRIDE_FEATURES_DEFAULT;}
  });
  const toggleStrideFeature=key=>{
    setStrideFeatures(prev=>{const next={...prev,[key]:!prev[key]};try{localStorage.setItem("stride-features",JSON.stringify(next));}catch{}return next;});
  };
  const STRIDE_FEATURE_LABELS=[
    {key:"programme",label:"Programme",icon:"↑",desc:"Planification des séances, suivi hebdomadaire"},
    {key:"activites",label:"Activités",icon:"▣",desc:"Historique activités Garmin importées"},
    {key:"forme",label:"Forme",icon:"♡",desc:"VFC, sommeil, poids, journal nutritionnel"},
    {key:"objectifs",label:"Objectifs",icon:"🏔",desc:"Courses cibles, planification compétitions"},
    {key:"coach",label:"Coach IA",icon:"✦",desc:"Conseils personnalisés basés sur tes données"},
  ];
  const [features, setFeatures] = useState(()=>{
    try{const s=localStorage.getItem("alex-features");return s?{...FEATURES_DEFAULT,...JSON.parse(s)}:FEATURES_DEFAULT;}catch{return FEATURES_DEFAULT;}
  });
  const toggleFeature=key=>{
    setFeatures(prev=>{const next={...prev,[key]:!prev[key]};try{localStorage.setItem("alex-features",JSON.stringify(next));}catch{}return next;});
  };
  const FEATURE_LABELS=[
    {key:"profilDetail",label:"Profil détaillé",icon:"🗺️",desc:"Répartition rythme, calibration Garmin, FC"},
    {key:"nutrition",label:"Nutrition",icon:"🍌",desc:"Plan nutritionnel par ravito, bibliothèque produits"},
    {key:"equipement",label:"Équipement",icon:"🎒",desc:"Checklist, poids, préparation chronologique"},
    {key:"analyse",label:"Analyse",icon:"📊",desc:"Cohérence stratégie, autonomie nutritionnelle"},
    {key:"team",label:"Team",icon:"👥",desc:"Partage avec l'équipe d'assistance"},
    {key:"courses",label:"Mes courses",icon:"📚",desc:"Historique et sauvegarde des stratégies"},
  ];
  const NAVS_ACTIVE=ALEX_NAVS.filter(n=>{
    if(n.id==="nutrition")return features.nutrition;
    if(n.id==="parametres")return features.equipement;
    if(n.id==="analyse")return features.analyse;
    if(n.id==="team")return features.team;
    if(n.id==="courses")return features.courses;
    return true;
  });

  const race=raceRaw; const segments=segmentsRaw; const settings=settingsRaw;
  const setRace=useCallback(upd=>{setRaceRaw(upd);setHasUnsaved(true);},[]);
  const setSegments=useCallback(upd=>{setSegmentsRaw(upd);setHasUnsaved(true);},[]);
  const setSettings=useCallback(upd=>{setSettingsRaw(upd);setHasUnsaved(true);},[]);

  const ua=navigator.userAgent;
  const isStandalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone;

  useEffect(()=>{
    const handler=e=>{e.preventDefault();setInstallPrompt(e);};
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  const handleInstall=async()=>{
    if(installPrompt){installPrompt.prompt();const{outcome}=await installPrompt.userChoice;if(outcome==="accepted"){setInstallDone(true);setInstallPrompt(null);}}
    else setShowInstallGuide(true);
  };

  // Chargement initial
  useEffect(()=>{
    const urlParams=new URLSearchParams(window.location.search);
    let shared=urlParams.get("s");
    if(!shared&&window.location.hash.startsWith("#s="))shared=window.location.hash.slice(3);
    if(shared){
      const data=decodeStrategy(shared);
      if(data){
        if(data.race)setRaceRaw(data.race);
        if(data.segments)setSegmentsRaw(data.segments);
        if(data.settings)setSettingsRaw({...EMPTY_SETTINGS,...data.settings});
        setSharedMode(true);setView("team");
        idbSave({race:data.race,segments:data.segments,settings:{...EMPTY_SETTINGS,...data.settings}});
        window.history.replaceState({},"",window.location.pathname);
        return;
      }
    }
    if (user?.id) {
      loadCurrentRace(user.id).then(d=>{
        if(d?.race && Object.keys(d.race).length > 0) setRaceRaw(d.race);
        if(d?.segments && d.segments.length > 0) setSegmentsRaw(d.segments);
        if(d?.settings && Object.keys(d.settings).length > 0) setSettingsRaw({...EMPTY_SETTINGS,...d.settings});
      }).catch(err => console.error('Erreur load current race:', err));
      
      loadCourses(user.id).then(list=>setCourses(list.sort((a,b)=>b.savedAt-a.savedAt)))
        .catch(err => console.error('Erreur load courses:', err));
    }
  },[user?.id]);

  useEffect(()=>{
    if(!user?.id) return;
    if(!race && !segments.length) return;
    const timer=setTimeout(()=>{
      saveCurrentRace(user.id, race, segments, settings)
        .then(() => {setAutoSaved(true); setTimeout(()=>setAutoSaved(false),2000);})
        .catch(err => console.error('Erreur save current race:', err));
    },800);
    return()=>clearTimeout(timer);
  },[race,segments,settings,user?.id]);

  useEffect(()=>{
    if(settings.darkMode)document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  },[settings.darkMode]);

  const addRepos=()=>{
    if(!reposForm.label.trim()||!reposForm.dureeMin)return;
    const startKm=parseFloat(reposForm.startKm)||0;
    setSegments(s=>[...s,{id:Date.now(),type:"repos",label:reposForm.label,startKm,dureeMin:Number(reposForm.dureeMin),endKm:startKm,speedKmh:0,slopePct:0,terrain:"normal",notes:""}].sort((a,b)=>(a.startKm??0)-(b.startKm??0)));
    setReposModal(false);setReposForm({label:"",startKm:"",dureeMin:20});
  };

  const saveAllData=()=>{
    const payload={
      _version:"1.0", _date:new Date().toISOString(),
      // Stride
      seances, activites, sommeil, vfcData, poids, objectifs,
      planningType, activityTypes, journalNutri, produits, recettes, profil,
      // Alex
      race, segments,
      settings:{...settings, equipment:undefined, garminStats:undefined},
    };
    const json=JSON.stringify(payload,null,2);
    const blob=new Blob([json],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`alex-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const saveData=()=>{
    const json=JSON.stringify({race,segments,settings},null,2);
    const blob=new Blob([json],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="alex-data.json";a.click();
    URL.revokeObjectURL(url);setHasUnsaved(false);
  };
  const loadData=file=>{
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const d=JSON.parse(e.target.result);
        if(d.race)setRaceRaw(d.race);
        if(d.segments)setSegmentsRaw(d.segments);
        if(d.settings){
          const merged={...EMPTY_SETTINGS,...d.settings};
          if(d.settings.equipment){
            const existingIds=new Set(d.settings.equipment.map(i=>i.id));
            const newItems=DEFAULT_EQUIPMENT.filter(i=>!existingIds.has(i.id));
            const upgraded=d.settings.equipment.map(i=>{const def=DEFAULT_EQUIPMENT.find(x=>x.id===i.id);return{...i,emporte:i.emporte!==undefined?i.emporte:(def?.emporte??true),poidsG:i.poidsG!==undefined?i.poidsG:(def?.poidsG??0)};});
            merged.equipment=[...upgraded,...newItems];
          }
          setSettingsRaw(merged);
        }
        setHasUnsaved(false);setView("profil_course");setDrawerOpen(false);
      }catch{alert("Fichier JSON invalide.");}
    };
    reader.readAsText(file);
  };

  // IDB
  const IDB_NAME="alex-trail",IDB_STORE="state",IDB_COURSES="courses",IDB_KEY="current";
  const openDB=()=>new Promise((res,rej)=>{
    const req=indexedDB.open(IDB_NAME,3);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains(IDB_STORE))db.createObjectStore(IDB_STORE);
      if(!db.objectStoreNames.contains(IDB_COURSES))db.createObjectStore(IDB_COURSES,{keyPath:"id"});
      if(!db.objectStoreNames.contains("stride"))db.createObjectStore("stride");
    };
    req.onsuccess=e=>res(e.target.result);
    req.onerror=rej;
  });
  const idbSave=async data=>{try{const db=await openDB();db.transaction(IDB_STORE,"readwrite").objectStore(IDB_STORE).put(data,IDB_KEY);}catch{}};
  const idbLoad=async()=>{try{const db=await openDB();return new Promise(res=>{const req=db.transaction(IDB_STORE,"readonly").objectStore(IDB_STORE).get(IDB_KEY);req.onsuccess=e=>res(e.target.result);req.onerror=()=>res(null);});}catch{return null;}};
  const idbSaveCourse=async(id,data)=>{try{const db=await openDB();db.transaction(IDB_COURSES,"readwrite").objectStore(IDB_COURSES).put({id,...data});}catch{}};
  const idbLoadCourses=async()=>{try{const db=await openDB();return new Promise(res=>{const req=db.transaction(IDB_COURSES,"readonly").objectStore(IDB_COURSES).getAll();req.onsuccess=e=>res(e.target.result||[]);req.onerror=()=>res([]);});}catch{return[];}};
  const idbDeleteCourse=async id=>{try{const db=await openDB();db.transaction(IDB_COURSES,"readwrite").objectStore(IDB_COURSES).delete(id);}catch{}};

  const saveCourseFn=()=>{
    const id=crypto.randomUUID();
    const savedAt=Date.now();
    const segsCourse=segments.filter(s=>s.type!=="ravito"&&s.type!=="repos");
    const totalCourse=segsCourse.reduce((s,seg)=>s+(seg.endKm-seg.startKm)/seg.speedKmh*3600,0);
    const totalReposSec=segments.filter(s=>s.type==="repos").reduce((s,seg)=>s+(seg.dureeMin||0)*60,0);
    const totalRavitoSec=(race.ravitos?.length||0)*(settings.ravitoTimeMin||3)*60;
    const entry={id,savedAt,name:settings.raceName||race.name||"Course sans nom",distance:race.totalDistance||0,elevPos:race.totalElevPos||0,segCount:segsCourse.length,startTime:settings.startTime||"07:00",totalTime:totalCourse+totalReposSec+totalRavitoSec,race,segments,settings};
    if (user?.id) {
      saveCourse(user.id, entry).catch(err => console.error('Erreur save course:', err));
    }
    setCourses(prev=>[entry,...prev]);
    return entry;
  };
  const loadCourseFn=entry=>{
    const ms={...EMPTY_SETTINGS,...(entry.settings||{}),produits:settings.produits||[],equipment:settings.equipment||DEFAULT_EQUIPMENT};
    setRaceRaw(entry.race||{});setSegmentsRaw(entry.segments||[]);setSettingsRaw(ms);
    if (user?.id) {
      saveCurrentRace(user.id, entry.race, entry.segments, ms).catch(err => console.error('Erreur save current race:', err));
    }
    setHasUnsaved(false);setView("profil_course");setDrawerOpen(false);
  };
  const deleteCourseFn=id=>{
    if (user?.id) {
      deleteCourse(user.id, id).catch(err => console.error('Erreur delete course:', err));
    }
    setCourses(prev=>prev.filter(c=>c.id!==id));
  };
  const updateCourseFn=(id,patch)=>setCourses(prev=>prev.map(c=>{
    if(c.id!==id)return c;
    const u={...c,...patch};
    if (user?.id) {
      saveCourse(user.id, u).catch(err => console.error('Erreur update course:', err));
    }
    return u;
  }));
  const overwriteCourseFn=id=>{
    const totalTime=segments.filter(s=>s.type!=="ravito"&&s.type!=="repos").reduce((s,seg)=>s+(seg.endKm-seg.startKm)/seg.speedKmh*3600,0);
    setCourses(prev=>prev.map(c=>{
      if(c.id!==id)return c;
      const u={...c,name:settings.raceName||race.name||c.name,distance:race.totalDistance||0,elevPos:race.totalElevPos||0,segCount:segments.filter(s=>s.type!=="ravito"&&s.type!=="repos").length,startTime:settings.startTime||"07:00",totalTime,race,segments,settings,updatedAt:Date.now()};
      if (user?.id) {
        saveCourse(user.id, u).catch(err => console.error('Erreur overwrite course:', err));
      }
      return u;
    }));
  };

  const navigate=id=>{setView(id);setDrawerOpen(false);};
  const hasRace=!!race.gpxPoints?.length;

  // Auth guard
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>Chargement...</div>;
  if (!user) return <Login />;

  return (
    <AppLayout
      seances={seances} setSeances={setSeances} activites={activites} setActivites={setActivites}
      sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData}
      poids={poids} setPoids={setPoids} objectifs={objectifs} setObjectifs={setObjectifs}
      planningType={planningType} setPlanningType={setPlanningType}
      activityTypes={activityTypes} setActivityTypes={setActivityTypes}
      journalNutri={journalNutri} setJournalNutri={setJournalNutri}
      produits={produits} setProduits={setProduits} recettes={recettes} setRecettes={setRecettes}
      allData={allData} loadStrideData={loadStrideData} resetAll={resetAll}
      profil={profil} setProfil={setProfil} confirmReset={confirmReset} setConfirmReset={setConfirmReset}
      isMobile={isMobile}
      view={view} setView={setView}
      race={race} setRace={setRace} segments={segments} setSegments={setSegments}
      settings={settings} setSettings={setSettings}
      hasUnsaved={hasUnsaved} autoSaved={autoSaved} courses={courses}
      drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}
      reposModal={reposModal} setReposModal={setReposModal}
      reposForm={reposForm} setReposForm={setReposForm} addRepos={addRepos}
      saveData={saveData} loadData={loadData}
      saveCourse={saveCourseFn} loadCourse={loadCourseFn}
      deleteCourse={deleteCourseFn} updateCourse={updateCourseFn} overwriteCourse={overwriteCourseFn}
      navigate={navigate} hasRace={hasRace}
      isStandalone={isStandalone} installDone={installDone}
      handleInstall={handleInstall} showInstallGuide={showInstallGuide} setShowInstallGuide={setShowInstallGuide}
      features={features} toggleFeature={toggleFeature} FEATURE_LABELS={FEATURE_LABELS} NAVS_ACTIVE={NAVS_ACTIVE}
      strideFeatures={strideFeatures} toggleStrideFeature={toggleStrideFeature} STRIDE_FEATURE_LABELS={STRIDE_FEATURE_LABELS}
      saveAllData={saveAllData}
      sharedMode={sharedMode} installPrompt={installPrompt}
      signOut={signOut}
      user={user}
    />
  );
}
