import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useAuth } from './AuthContext';
import { loadAthleteProfile, saveAthleteProfile, loadActivities, saveActivities, loadSeances, saveSeances, loadSommeil, saveSommeil, loadVFC, saveVFC, loadPoids, savePoids, loadObjectifs, saveObjectifs, loadCurrentRace, saveCurrentRace, loadCourses, saveCourse, deleteCourse, loadNutrition, saveNutrition, loadEntrainementSettings, saveEntrainementSettings } from './supabaseHelpers';
import Login from './Login';

// ─── COURSE IMPORTS ───────────────────────────────────────────────────────────
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

// ─── ENTRAINEMENT IMPORTS ─────────────────────────────────────────────────────
import { C, ACTIVITY_TYPES, STATUT_OPTIONS, ACT_ICON,
  GARMIN_TO_ACTIVITE, TYPE_MIGRATION, DEFAULT_PLANNING,
  isRunning, exportJSON, localDate, fmtDate, daysUntil,
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

// ─── COURSE NAVS ─────────────────────────────────────────────────────────────
const COURSE_NAVS = [
  { id: "profil",      label: "Profil de course",   icon: "🗺️", group: "Préparation" },
  { id: "preparation", label: "Stratégie de course", icon: "🎯", group: "Préparation" },
  { id: "nutrition",   label: "Nutrition",           icon: "🍌", group: "Préparation" },
  { id: "parametres",  label: "Équipement",          icon: "🎒", group: "Préparation" },
  { id: "analyse",     label: "Analyse",             icon: "📊", group: "Analyse" },
  { id: "team",        label: "Team",                icon: "👥", group: "Équipe" },
  { id: "courses",     label: "Mes courses",         icon: "📚", group: "Historique" },
];

// ─── COURSE STYLES (styles.jsx exact) ────────────────────────────────────────
const COURSE_C = { bg:"#F4F0EA", white:"#FDFCFA", sand:"#EDE8DF", sandDark:"#DDD5C8", primary:"#7C5C3E", primaryLight:"#9E7A58", primaryPale:"#F0E8DC", primaryDeep:"#4E3726", secondary:"#5C7A5C", secondaryPale:"#E8F0E8", secondaryDark:"#3D5C3D", text:"#2A2218", muted:"#8C7B6A", border:"#D8CEC0", green:"#5C8C6A", greenPale:"#E6F2EA", yellow:"#B8863A", yellowPale:"#FBF3E2", red:"#B84A3A", redPale:"#FBECEB", blue:"#4A7A9B", bluePale:"#E8F2F8" };
const COURSE_G = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
  .course-scope *, .course-scope *::before, .course-scope *::after { box-sizing: border-box; }
  .course-scope { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text-c); font-size: 14px; line-height: 1.5; }
  :root {
    --bg: ${COURSE_C.bg};
    --surface: ${COURSE_C.white};
    --surface-2: ${COURSE_C.sand};
    --surface-3: ${COURSE_C.sandDark};
    --border-c: ${COURSE_C.border};
    --text-c: ${COURSE_C.text};
    --muted-c: ${COURSE_C.muted};
    --primary: ${COURSE_C.primary};
  }
  :root.dark {
    --bg: #14100C;
    --surface: #1E1810;
    --surface-2: #26201A;
    --surface-3: #302820;
    --border-c: #3C3028;
    --text-c: #F0EAE0;
    --muted-c: #9A8870;
    --primary: ${COURSE_C.primaryLight};
  }
  .course-scope input, .course-scope select, .course-scope textarea {
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    background: var(--surface-2); color: var(--text-c);
    border: 1px solid var(--border-c); border-radius: 10px;
    padding: 9px 12px; width: 100%; outline: none;
    transition: border 0.2s, box-shadow 0.2s;
  }
  .course-scope input:focus, .course-scope select:focus, .course-scope textarea:focus {
    border-color: ${COURSE_C.primary};
    box-shadow: 0 0 0 3px ${COURSE_C.primaryPale};
  }
  .course-scope input[type="range"] { background: transparent; border: none; padding: 0; box-shadow: none; accent-color: ${COURSE_C.primary}; }
  .course-scope table { border-collapse: collapse; width: 100%; }
  .course-scope thead th { font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted-c); background: var(--surface-2); padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--border-c); }
  .course-scope tbody tr { border-bottom: 1px solid var(--border-c); transition: background 0.15s; cursor: pointer; }
  .course-scope tbody tr:hover { background: var(--surface-2); }
  .course-scope tbody td { padding: 10px 14px; }
  .course-scope .tbl-wrap { overflow-x: auto; border-radius: 16px; border: 1px solid var(--border-c); }
  .course-scope .anim { animation: courseFadeUp 0.35s ease both; }
  @keyframes courseFadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .course-scope .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .course-scope .form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .course-scope .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .course-scope .badge-green  { background: ${COURSE_C.greenPale};      color: ${COURSE_C.green}; }
  .course-scope .badge-yellow { background: ${COURSE_C.yellowPale};     color: ${COURSE_C.yellow}; }
  .course-scope .badge-red    { background: ${COURSE_C.redPale};        color: ${COURSE_C.red}; }
  .course-scope .badge-blue   { background: ${COURSE_C.bluePale};       color: ${COURSE_C.blue}; }
  .course-scope .badge-brown  { background: ${COURSE_C.primaryPale};    color: ${COURSE_C.primaryDeep}; }
  .course-scope .badge-sage   { background: ${COURSE_C.secondaryPale};  color: ${COURSE_C.secondaryDark}; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: center; justify-content: center; }
  .modal-box { background: var(--surface); border-radius: 20px; border: 1px solid var(--border-c); max-width: 680px; width: 94vw; max-height: 88vh; overflow-y: auto; padding: 32px; box-shadow: 0 24px 60px rgba(0,0,0,0.18); }
  .confirm-box { background: var(--surface); border-radius: 16px; border: 1px solid var(--border-c); max-width: 400px; width: 90vw; padding: 28px; text-align: center; box-shadow: 0 16px 40px rgba(0,0,0,0.15); }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; cursor: pointer; transition: background 0.15s, color 0.15s; font-weight: 500; color: var(--muted-c); font-size: 14px; user-select: none; }
  .nav-item:hover { background: var(--surface-2); color: var(--text-c); }
  .nav-item.active { background: ${COURSE_C.primaryPale}; color: ${COURSE_C.primaryDeep}; }
  :root.dark .nav-item.active { background: #3A2C1E; color: ${COURSE_C.primaryLight}; }
  @media (max-width: 768px) {
    .course-scope .grid-2col { grid-template-columns: 1fr; }
    .course-scope .form-grid { grid-template-columns: repeat(2, 1fr); }
    .modal-overlay { align-items: flex-end; }
    .modal-box { border-radius: 20px 20px 0 0; max-height: 90vh; width: 100vw; padding: 24px; }
  }
  /* Dark mode Entraînement — override couleurs inline */
  :root.dark .entrainement-scope { background: #1a1714 !important; color: #e8e4de !important; }
  :root.dark .entrainement-scope .card-white { background: #242018 !important; border-color: #3a342c !important; }
  :root.dark .entrainement-scope input,
  :root.dark .entrainement-scope select,
  :root.dark .entrainement-scope textarea { background: #2a231c !important; color: #e8e4de !important; border-color: #3a342c !important; }
`;
// ─── COULEURS ENTRAINEMENT ──────────────────────────────────────────────────
const TEAL = "#1D9E75";
const TEAL_PALE = "#e8f5f0";

// ─── ACCUEIL (page d'accueil unifiée) ────────────────────────────────────────


// ─── DONNÉES & PARAMS VIEW ────────────────────────────────────────────────────
function DonneesParamsView({
  saveAllData, saveData, loadData, saveCourse, race, segments, settings,
  setRace, setSegments, setSettings, hasUnsaved, isStandalone, installDone,
  handleInstall, setView, setDrawerOpen,
  seances, setSeances, activites, setActivites, sommeil, setSommeil,
  vfcData, setVfcData, poids, setPoids, planningType, objectifs,
  allData, loadEntrainementData, resetAll, journalNutri, confirmReset, setConfirmReset,
  features, toggleFeature, FEATURE_LABELS,
  entrainementFeatures, toggleEntrainementFeature, ENTRAINEMENT_FEATURE_LABELS,
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
                    loadEntrainementSettings(user.id),
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
                        data.settings && saveEntrainementSettings(user.id, data.settings),
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
              active={entrainementFeatures._section!==false}
              onToggle={()=>toggleEntrainementFeature("_section")}
              color={TEAL}
            />
            {entrainementFeatures._section!==false&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8,paddingLeft:16,borderLeft:`2px solid ${TEAL}30`}}>
                {ENTRAINEMENT_FEATURE_LABELS.map(({key,label,icon,desc})=>(
                  <ToggleRow key={key} icon={icon} label={label} desc={desc}
                    active={entrainementFeatures[key]!==false}
                    onToggle={()=>toggleEntrainementFeature(key)}
                    color={TEAL}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Course">
            <ToggleRow icon="🗺️" label="Section Course"
              desc="Masque entièrement la section dans la navigation"
              active={courseFeatures._section!==false}
              onToggle={()=>toggleFeature("_section")}
              color={COURSE_C.primary}
            />
            {courseFeatures._section!==false&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8,paddingLeft:16,borderLeft:`2px solid ${COURSE_C.primary}30`}}>
                {FEATURE_LABELS.map(({key,label,icon,desc})=>(
                  <ToggleRow key={key} icon={icon} label={label} desc={desc}
                    active={courseFeatures[key]}
                    onToggle={()=>toggleFeature(key)}
                    color={COURSE_C.primary}
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

          <Section title="Stockage des données">
            <div style={{background:C.stone,borderRadius:12,padding:"16px",fontSize:12,color:C.muted,lineHeight:1.6}}>
              <div style={{marginBottom:8,fontWeight:600,color:C.inkLight}}>✅ Stockage Supabase actif</div>
              <div>• Toutes tes données (profil, activités, forme, courses) sont synchronisées sur Supabase (EU - Paris)</div>
              <div>• Accès depuis n'importe quel appareil après connexion</div>
              <div>• Sauvegarde automatique en temps réel</div>
              <div style={{marginTop:8,color:C.stoneDeep}}>Tes données restent privées et sont conformes RGPD.</div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ─── APP LAYOUT UNIFIÉ ────────────────────────────────────────────────────────

function AppLayout({
  // Entrainement state
  seances, setSeances, activites, setActivites, sommeil, setSommeil,
  vfcData, setVfcData, poids, setPoids, objectifs, setObjectifs,
  planningType, setPlanningType, activityTypes, setActivityTypes,
  journalNutri, setJournalNutri, produits, setProduits, recettes, setRecettes,
  allData, loadEntrainementData, resetAll, profil, setProfil,
  confirmReset, setConfirmReset, isMobile,
  // Course state (depuis CourseLayout inline)
  view, setView, race, setRace, segments, setSegments, settings, setSettings,
  hasUnsaved, autoSaved, courses, drawerOpen, setDrawerOpen,
  reposModal, setReposModal, reposForm, setReposForm, addRepos,
  saveData, loadData, saveCourse, loadCourse, deleteCourse, updateCourse, overwriteCourse,
  navigate, hasRace, isStandalone, installDone, handleInstall,
  features, toggleFeature, FEATURE_LABELS, NAVS_ACTIVE,
  entrainementFeatures, toggleEntrainementFeature, ENTRAINEMENT_FEATURE_LABELS,
  profilType, setProfilType,
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

  // Navigation unifiée avec filtrage selon profilType
  const NAV_GROUPS = [
    { label: null, color: null, items: [
      { id:"accueil", label:"Tableau de bord", icon:"◉" },
    ]},
    // Section Entraînement
    // Visible si : full, training_only (masquée si course_prep ou team)
    ...( (entrainementFeatures._section!==false && profilType !== 'course_prep' && profilType !== 'team') ? [{ label: "Entraînement", color: TEAL, items: [
      { id:"entrainement", label:"Programme",  icon:"↑", feat:"programme" },
      { id:"activites",    label:"Activités",  icon:"▣", feat:"activites" },
      { id:"forme",        label:"Forme",      icon:"♡", feat:"forme" },
      { id:"gut_training", label:"Gut Training", icon:"🍽️", feat:"gut_training" },
      { id:"objectifs",    label:"Objectifs",  icon:"🏔", feat:"objectifs" },
    ].filter(n=>entrainementFeatures[n.feat]!==false)}] : []),
    // Section Course
    // Visible si : full, course_prep (masquée si training_only)
    // Si team : afficher uniquement Team
    ...( (features._section!==false && profilType !== 'training_only') ? [{ label: "Course", color: COURSE_C.primary, items: [
      ...(profilType === 'team' ? [] : [{ id:"profil_course", label:"Profil de course", icon:"🗺️" }]),
      ...(profilType === 'team' ? [] : [{ id:"strategie", label:"Stratégie", icon:"🎯" }]),
      ...(profilType === 'team' ? [] : features.nutrition  ? [{ id:"nutrition_course",  label:"Nutrition",   icon:"🍌" }] : []),
      ...(profilType === 'team' ? [] : features.equipement ? [{ id:"equipement",      label:"Équipement",  icon:"🎒" }] : []),
      ...(profilType === 'team' ? [] : features.analyse ? [{ id:"analyse", label:"Analyse", icon:"📊" }] : []),
      ...(features.team ? [{ id:"team", label:"Team", icon:"👥" }] : []),
      ...(profilType === 'team' ? [] : features.courses ? [{ id:"mes_courses", label:"Mes courses", icon:"📚" }] : []),
    ].filter(Boolean)}] : []),
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
                    <span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:COURSE_C.primary,flexShrink:0}}/>
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

      {/* Installer l'app */}
      {!isStandalone&&!installDone&&installPrompt&&(
        <div onClick={handleInstall}
          style={{margin:"10px 14px 0",padding:"10px 12px",borderRadius:9,
            background:accentColor+"12",border:`1px solid ${accentColor}30`,
            display:"flex",alignItems:"center",gap:10,cursor:"pointer",
            transition:"background .15s"}}
          onMouseEnter={e=>{e.currentTarget.style.background=accentColor+"20"}}
          onMouseLeave={e=>{e.currentTarget.style.background=accentColor+"12"}}>
          <span style={{fontSize:16}}>📲</span>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:1}}>
            <span style={{fontSize:12,fontWeight:600,color:accentColor}}>Installer l'app</span>
            <span style={{fontSize:10,color:C.muted}}>Accès direct depuis l'écran d'accueil</span>
          </div>
        </div>
      )}

      {/* Dark mode */}
      <div style={{padding:"10px 14px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:12,color:C.muted,fontWeight:500}}>{isDark?"🌙 Mode sombre":"☀️ Mode clair"}</span>
        <div onClick={()=>setSettings(s=>({...s,darkMode:!s.darkMode}))}
          style={{width:36,height:20,borderRadius:10,cursor:"pointer",position:"relative",
            background:isDark?COURSE_C.primary:C.stoneDark,transition:"background .2s",flexShrink:0}}>
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
      <style>{COURSE_G}</style>
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
                <button onClick={addRepos} style={{padding:"9px 20px",borderRadius:10,border:"none",background:COURSE_C.primary,color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>Ajouter</button>
              </div>
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
        <div className="course-scope" style={{flex:1,overflowY:"auto",paddingTop:isMobile?mobileTopH:0,background:isDark?"#14100C":undefined}}>
          {/* Vues Entraînement */}
          {view==="accueil" && <Dashboard setView={setView} seances={seances} vfcData={vfcData} sommeil={sommeil} poids={poids} objectifs={objectifs} race={race} settings={settings} profilType={profilType} setProfilType={setProfilType}/>}
          {view==="objectifs" && <Objectifs objectifs={objectifs} setObjectifs={setObjectifs} seances={seances} activites={activites} vfcData={vfcData} poids={poids} profil={profil} produits={produits} recettes={recettes} allData={allData} setView={setView}/>}
          {view==="coach" && <MonCoachIA seances={seances} setSeances={setSeances} activites={activites} sommeil={sommeil} vfcData={vfcData} poids={poids} objectifs={objectifs} planningType={planningType} produits={produits} recettes={recettes} journalNutri={journalNutri} activityTypes={activityTypes}/>}
          {view==="activites" && <Activites activites={activites} setActivites={setActivites} seances={seances} setSeances={setSeances}/>}
          {view==="gut_training" && <Nutrition produits={produits} setProduits={setProduits} recettes={recettes} setRecettes={setRecettes} seances={seances} setSeances={setSeances} activites={activites}/>}
          {view==="entrainement" && (
            <div>
              <div style={{padding:"10px 24px",borderBottom:`1px solid ${C.border}`,background:C.white,display:"flex",gap:6,flexWrap:"wrap"}}>
                {[{id:"programme",l:"Programme"},{id:"planning",l:"Semaine type"}]
                  .map(({id,l})=>subNavBtn(id,l,subView.entrainement===id,()=>setSubV("entrainement",id)))}
              </div>
              {subView.entrainement==="programme"&&<EntrainementProgramme seances={seances} setSeances={setSeances} activites={activites} setActivites={setActivites} objectifs={objectifs} planningType={planningType} setPlanningType={setPlanningType} activityTypes={activityTypes} setActivityTypes={setActivityTypes} allData={allData} loadData={loadEntrainementData} resetAll={resetAll} setView={setView}/>}
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
          {/* Vues Course */}
          {view==="profil_course"&&<div style={{padding:"24px 32px"}}><ProfilView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} onOpenRepos={()=>setReposModal(true)} isMobile={isMobile} profilDetail={features.profilDetail} profil={profil}/></div>}
          {view==="strategie"&&<div style={{padding:"24px 32px"}}><StrategieView race={race} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} onOpenRepos={()=>setReposModal(true)} isMobile={isMobile} profil={profil}/></div>}
          {view==="nutrition_course"&&<div style={{padding:"24px 32px"}}><NutritionView segments={segments} settings={settings} setSettings={setSettings} race={race} setRace={setRace} isMobile={isMobile} onNavigate={setView} profil={profil} poids={poids} recettes={recettes} produits={produits}/></div>}
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
            allData={allData} loadEntrainementData={loadEntrainementData} resetAll={resetAll}
            journalNutri={journalNutri} confirmReset={confirmReset} setConfirmReset={setConfirmReset}
            features={features} toggleFeature={toggleFeature} FEATURE_LABELS={FEATURE_LABELS}
            entrainementFeatures={entrainementFeatures} toggleEntrainementFeature={toggleEntrainementFeature} ENTRAINEMENT_FEATURE_LABELS={ENTRAINEMENT_FEATURE_LABELS}
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

  // ── Entrainement state ────────────────────────────────────────────────────
  const migrateSeances = ss=>ss.map(s=>({...s,
    activite:TYPE_MIGRATION[s.activite]||s.activite,
    statut:s.statut==="Planifié"?"Planifié":s.statut==="Effectué"?"Effectué":s.statut==="Annulé"?"Annulé":s.statut||"Planifié",
  }));
  const migrateActivites = aa=>aa.map(a=>({...a,type:GARMIN_TO_ACTIVITE[a.type]||TYPE_MIGRATION[a.type]||a.type}));

  // ── Entrainement states (chargés depuis Supabase) ─────────────────────────
  const [seances,       setSeances]      = useState([]);
  const [activites,     setActivites]    = useState([]);
  const [sommeil,       setSommeil]      = useState([]);
  const [vfcData,       setVfcData]      = useState([]);
  const [poids,         setPoids]        = useState([]);
  const [objectifs,     setObjectifs]    = useState([]);
  const [planningType,  setPlanningType] = useState(DEFAULT_PLANNING);
  const [activityTypes, setActivityTypes]= useState(ACTIVITY_TYPES.filter(t=>t));
  const [journalNutri,  setJournalNutri] = useState([]);
  const [produits,      setProduits]     = useState([]);
  const [recettes,      setRecettes]     = useState([]);
  const [profil,        setProfil]       = useState({sexe:"Homme",taille:180});
  const [profilType,    setProfilType]   = useState(null); // null = premier lancement
  
  // ── Feature toggles (chargés depuis Supabase) ──────────────────────────────
  const ENTRAINEMENT_FEATURES_DEFAULT = {programme:true,activites:true,forme:true,gut_training:true,objectifs:true,coach:true};
  const COURSE_FEATURES_DEFAULT = {nutrition:true,equipement:true,analyse:true,team:true,courses:true,profilDetail:true};
  const [entrainementFeatures, setEntrainementFeatures] = useState(ENTRAINEMENT_FEATURES_DEFAULT);
  const [courseFeatures, setCourseFeatures] = useState(COURSE_FEATURES_DEFAULT);
  
  const [confirmReset,  setConfirmReset] = useState(false);
  const [dataLoaded,    setDataLoaded]   = useState(false);
  const [loadError,     setLoadError]    = useState(false);
  const [loadAttempt,   setLoadAttempt]  = useState(0);

  // ── Load ALL data from Supabase at login (avec timeout + retry) ───────────
  useEffect(() => {
    if (!user?.id || dataLoaded) return;

    let cancelled = false;

    // Timeout wrapper : rejette si la promesse ne résout pas en `ms` ms
    const withTimeout = (promise, ms, label) => Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout ${label} (${ms}ms)`)), ms)),
    ]);

    // Retry wrapper : jusqu'à `maxAttempts` tentatives avec backoff exponentiel
    const loadWithRetry = async () => {
      const maxAttempts = 3;
      const timeoutMs = 10000;
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const results = await withTimeout(
            Promise.all([
              loadAthleteProfile(user.id),
              loadActivities(user.id),
              loadSeances(user.id),
              loadSommeil(user.id),
              loadVFC(user.id),
              loadPoids(user.id),
              loadObjectifs(user.id),
              loadNutrition(user.id),
              loadEntrainementSettings(user.id),
            ]),
            timeoutMs,
            `tentative ${attempt}`
          );
          return results;
        } catch (err) {
          lastError = err;
          console.warn(`Chargement échoué (tentative ${attempt}/${maxAttempts}):`, err.message);
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
          }
        }
      }
      throw lastError;
    };

    loadWithRetry().then((results) => {
      if (cancelled) return;
      const [profile, acts, seances, som, vfc, pds, objs, nutr, settings] = results;
      if (profile) setProfil(profile);
      if (acts?.length) setActivites(migrateActivites(acts));
      if (seances?.length) setSeances(migrateSeances(seances));
      if (som?.length) setSommeil(som);
      if (vfc?.length) setVfcData(vfc);
      if (pds?.length) setPoids(pds);
      if (objs?.length) setObjectifs(objs);
      if (nutr) {
        if (nutr.journalNutri?.length) setJournalNutri(nutr.journalNutri);
        if (nutr.produits?.length) setProduits(nutr.produits.map(p => ({ ...p, type: p.type || 'produit' })));
        if (nutr.recettes?.length) setRecettes(nutr.recettes.map(r => ({ ...r, type: r.type || 'recette' })));
      }
      if (settings) {
        if (settings.planningType && Object.keys(settings.planningType).length > 0) {
          setPlanningType(settings.planningType);
        }
        if (settings.activityTypes?.length) setActivityTypes(settings.activityTypes);
        if (settings.entrainementFeatures) setEntrainementFeatures(settings.entrainementFeatures);
        if (settings.courseFeatures) setCourseFeatures(settings.courseFeatures);
        if (settings.profilType !== undefined) setProfilType(settings.profilType);
      }
      setLoadError(false);
      setDataLoaded(true);
    }).catch(err => {
      if (cancelled) return;
      console.error('Erreur chargement données (toutes tentatives échouées):', err);
      setLoadError(true);
      // IMPORTANT : on NE passe PAS dataLoaded à true → aucune écriture ne pourra partir
    });

    return () => { cancelled = true; };
  }, [user?.id, dataLoaded, loadAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flush pending saves au beforeunload ──────────────────────────────────
  // Chaque auto-save enregistre sa fonction de flush ici. Si l'utilisateur
  // quitte la page pendant la fenêtre de debounce (2s), on déclenche toutes
  // les saves pending immédiatement au lieu de les perdre.
  const pendingSavesRef = useRef({});

  useEffect(() => {
    const handler = () => {
      const pending = pendingSavesRef.current;
      Object.keys(pending).forEach(key => {
        try { pending[key](); } catch (e) { /* fire-and-forget */ }
      });
    };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler); // fiabilité mobile (Safari iOS)
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, []);

  // Auto-save activités vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || !dataLoaded) return;
    pendingSavesRef.current.activites = () => saveActivities(user.id, activites).catch(()=>{});
    const timer = setTimeout(() => {
      saveActivities(user.id, activites).catch(err => console.error('Erreur save activités:', err));
      delete pendingSavesRef.current.activites;
    }, 2000);
    return () => clearTimeout(timer);
  }, [activites, user?.id, dataLoaded]);

  // Auto-save séances vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || !dataLoaded) return;
    pendingSavesRef.current.seances = () => saveSeances(user.id, seances).catch(()=>{});
    const timer = setTimeout(() => {
      saveSeances(user.id, seances).catch(err => console.error('Erreur save séances:', err));
      delete pendingSavesRef.current.seances;
    }, 2000);
    return () => clearTimeout(timer);
  }, [seances, user?.id, dataLoaded]);

  // Auto-save sommeil vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || !dataLoaded) return;
    pendingSavesRef.current.sommeil = () => saveSommeil(user.id, sommeil).catch(()=>{});
    const timer = setTimeout(() => {
      saveSommeil(user.id, sommeil).catch(err => console.error('Erreur save sommeil:', err));
      delete pendingSavesRef.current.sommeil;
    }, 2000);
    return () => clearTimeout(timer);
  }, [sommeil, user?.id, dataLoaded]);

  // Auto-save VFC vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || !dataLoaded) return;
    pendingSavesRef.current.vfc = () => saveVFC(user.id, vfcData).catch(()=>{});
    const timer = setTimeout(() => {
      saveVFC(user.id, vfcData).catch(err => console.error('Erreur save VFC:', err));
      delete pendingSavesRef.current.vfc;
    }, 2000);
    return () => clearTimeout(timer);
  }, [vfcData, user?.id, dataLoaded]);

  // Auto-save poids vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || !dataLoaded) return;
    pendingSavesRef.current.poids = () => savePoids(user.id, poids).catch(()=>{});
    const timer = setTimeout(() => {
      savePoids(user.id, poids).catch(err => console.error('Erreur save poids:', err));
      delete pendingSavesRef.current.poids;
    }, 2000);
    return () => clearTimeout(timer);
  }, [poids, user?.id, dataLoaded]);

  // Auto-save objectifs vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || !dataLoaded) return;
    pendingSavesRef.current.objectifs = () => saveObjectifs(user.id, objectifs).catch(()=>{});
    const timer = setTimeout(() => {
      saveObjectifs(user.id, objectifs).catch(err => console.error('Erreur save objectifs:', err));
      delete pendingSavesRef.current.objectifs;
    }, 2000);
    return () => clearTimeout(timer);
  }, [objectifs, user?.id, dataLoaded]);

  // Auto-save nutrition vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || !dataLoaded) return;
    pendingSavesRef.current.nutrition = () => saveNutrition(user.id, journalNutri, produits, recettes).catch(()=>{});
    const timer = setTimeout(() => {
      saveNutrition(user.id, journalNutri, produits, recettes).catch(err => console.error('Erreur save nutrition:', err));
      delete pendingSavesRef.current.nutrition;
    }, 2000);
    return () => clearTimeout(timer);
  }, [journalNutri, produits, recettes, user?.id, dataLoaded]);

  // Auto-save entrainement settings + features vers Supabase (debounced 2s)
  useEffect(()=>{
    if (!user?.id || !dataLoaded) return;
    pendingSavesRef.current.entrainementSettings = () => saveEntrainementSettings(user.id, planningType, activityTypes, entrainementFeatures, courseFeatures, profilType).catch(()=>{});
    const timer = setTimeout(() => {
      saveEntrainementSettings(user.id, planningType, activityTypes, entrainementFeatures, courseFeatures, profilType).catch(err => console.error('Erreur save entrainement settings:', err));
      delete pendingSavesRef.current.entrainementSettings;
    }, 2000);
    return () => clearTimeout(timer);
  }, [planningType, activityTypes, entrainementFeatures, courseFeatures, profilType, user?.id, dataLoaded]);

  // Init profil.taille depuis dernier poids si vide (mount uniquement)
  useEffect(()=>{
    if(!profil.taille && poids.length){
      const last = [...poids].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
      if(last.taille) setProfil(p=>({...p, taille:last.taille}));
    }
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const allData = {seances,activites,sommeil,vfcData,poids,objectifs,planningType,activityTypes,journalNutri,produits,recettes,profil};
  const loadEntrainementData = data => {
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

  // ── Course state (ex-CourseLayout) ────────────────────────────────────────
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

  // Features labels (Entrainement)
  const ENTRAINEMENT_FEATURE_LABELS=[
    {key:"programme",label:"Programme",icon:"↑",desc:"Planification des séances, suivi hebdomadaire"},
    {key:"activites",label:"Activités",icon:"▣",desc:"Historique activités Garmin importées"},
    {key:"forme",label:"Forme",icon:"♡",desc:"VFC, sommeil, poids, journal nutritionnel"},
    {key:"gut_training",label:"Gut Training",icon:"🍽️",desc:"Nutrition entraînement : produits, recettes, historique"},
    {key:"objectifs",label:"Objectifs",icon:"🏔",desc:"Courses cibles, planification compétitions"},
    {key:"coach",label:"Coach IA",icon:"✦",desc:"Conseils personnalisés basés sur tes données"},
  ];
  
  // Toggle Entrainement features → auto-save vers Supabase
  const toggleEntrainementFeature=key=>{
    setEntrainementFeatures(prev=>{
      const next={...prev,[key]:!prev[key]};
      if (user?.id) {
        saveEntrainementSettings(user.id, planningType, activityTypes, next, courseFeatures, profilType)
          .catch(err => console.error('Erreur save entrainement features:', err));
      }
      return next;
    });
  };
  
  // Features labels (Course)
  const FEATURE_LABELS=[
    {key:"profilDetail",label:"Profil détaillé",icon:"🗺️",desc:"Répartition rythme, calibration Garmin, FC"},
    {key:"nutrition",label:"Nutrition",icon:"🍌",desc:"Plan nutritionnel par ravito, bibliothèque produits"},
    {key:"equipement",label:"Équipement",icon:"🎒",desc:"Checklist, poids, préparation chronologique"},
    {key:"analyse",label:"Analyse",icon:"📊",desc:"Cohérence stratégie, autonomie nutritionnelle"},
    {key:"team",label:"Team",icon:"👥",desc:"Partage avec l'équipe d'assistance"},
    {key:"courses",label:"Mes courses",icon:"📚",desc:"Historique et sauvegarde des stratégies"},
  ];
  
  // Toggle Course features → auto-save vers Supabase
  const toggleFeature=key=>{
    setCourseFeatures(prev=>{
      const next={...prev,[key]:!prev[key]};
      if (user?.id) {
        saveEntrainementSettings(user.id, planningType, activityTypes, entrainementFeatures, next, profilType)
          .catch(err => console.error('Erreur save course features:', err));
      }
      return next;
    });
  };
  
  // Navigation Course filtrée selon features actives
  const NAVS_ACTIVE=COURSE_NAVS.filter(n=>{
    if(n.id==="nutrition")return courseFeatures.nutrition;
    if(n.id==="parametres")return courseFeatures.equipement;
    if(n.id==="analyse")return courseFeatures.analyse;
    if(n.id==="team")return courseFeatures.team;
    if(n.id==="courses")return courseFeatures.courses;
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
    if(!installPrompt)return;
    installPrompt.prompt();
    const{outcome}=await installPrompt.userChoice;
    if(outcome==="accepted"){setInstallDone(true);setInstallPrompt(null);}
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
        if (user?.id) {
          saveCurrentRace(user.id, data.race, data.segments, {...EMPTY_SETTINGS,...data.settings})
            .catch(err => console.error('Erreur save stratégie partagée:', err));
        }
        window.history.replaceState({},"",window.location.pathname);
        return;
      }
    }
    if (user?.id) {
      loadCurrentRace(user.id).then(d=>{
        if(d?.race && Object.keys(d.race).length > 0) {
          // Init bibliotheque si absente
          const raceWithBib = {
            ...d.race,
            bibliotheque: d.race.bibliotheque || { produits: [], recettes: [] }
          };
          setRaceRaw(raceWithBib);
        }
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
      // Entrainement
      seances, activites, sommeil, vfcData, poids, objectifs,
      planningType, activityTypes, journalNutri, produits, recettes, profil,
      // Course
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

  // Data load guard — bloque l'app tant que les données ne sont pas chargées
  // Si le chargement a échoué : écran d'erreur avec bouton Réessayer (empêche tout écrasement)
  if (loadError) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F5F3EF', padding:'2rem', fontFamily:'DM Sans, sans-serif' }}>
        <div style={{ maxWidth:480, textAlign:'center', background:'#FFFFFF', padding:'2rem', borderRadius:12, border:'1px solid #DDD9D1' }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#1C1916', marginBottom:12 }}>Impossible de charger tes données</div>
          <div style={{ fontSize:14, color:'#7A7268', lineHeight:1.5, marginBottom:20 }}>
            La connexion à la base de données a échoué. Tes données sont en sécurité — l'app est bloquée en écriture pour ne rien écraser. Vérifie ta connexion internet et réessaie.
          </div>
          <button
            onClick={() => { setLoadError(false); setLoadAttempt(a => a + 1); }}
            style={{ padding:'10px 20px', background:'#2D5A3D', color:'#FFFFFF', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
          >
            Réessayer
          </button>
          <div style={{ marginTop:16 }}>
            <button
              onClick={() => signOut()}
              style={{ padding:'6px 12px', background:'transparent', color:'#7A7268', border:'none', fontSize:12, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!dataLoaded) {
    return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>Chargement de tes données...</div>;
  }

  return (
    <AppLayout
      seances={seances} setSeances={setSeances} activites={activites} setActivites={setActivites}
      sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData}
      poids={poids} setPoids={setPoids} objectifs={objectifs} setObjectifs={setObjectifs}
      planningType={planningType} setPlanningType={setPlanningType}
      activityTypes={activityTypes} setActivityTypes={setActivityTypes}
      journalNutri={journalNutri} setJournalNutri={setJournalNutri}
      produits={produits} setProduits={setProduits} recettes={recettes} setRecettes={setRecettes}
      allData={allData} loadEntrainementData={loadEntrainementData} resetAll={resetAll}
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
      handleInstall={handleInstall}
      features={courseFeatures} toggleFeature={toggleFeature} FEATURE_LABELS={FEATURE_LABELS} NAVS_ACTIVE={NAVS_ACTIVE}
      entrainementFeatures={entrainementFeatures} toggleEntrainementFeature={toggleEntrainementFeature} ENTRAINEMENT_FEATURE_LABELS={ENTRAINEMENT_FEATURE_LABELS}
      profilType={profilType} setProfilType={setProfilType}
      saveAllData={saveAllData}
      sharedMode={sharedMode} installPrompt={installPrompt}
      signOut={signOut}
      user={user}
    />
  );
}
