import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine } from "recharts";

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
import { CIQUAL, CIQUAL_CATEGORIES } from './data/ciqual.js';

// ─── STRIDE IMPORTS ───────────────────────────────────────────────────────────
import { CS as C, LS_KEY, ACTIVITY_TYPES, STATUT_OPTIONS, ACT_ICON,
  GARMIN_TO_STRIDE, TYPE_MIGRATION, DEFAULT_PLANNING,
  isRunning, lsRead, lsWrite, exportJSON, localDate, fmtDate, daysUntil,
  actColor, actColorPale, actIcon, actShort,
  parseCSVActivities, parseCSVSommeil, parseCSVVFC,
  emptySeance, emptyObjectif, emptyPoids, emptyVFC, emptySommeil } from './stride/constants.js';
import { Btn, Modal, Field, FormGrid, ConfirmDialog, statusBadge } from './stride/atoms.jsx';
import Dashboard from './components/stride/Dashboard.jsx';
import { StatusBadge, ActCell, DiffSpan, EntrainementProgramme, ProgrammeView, Programme } from './components/stride/Programme.jsx';
import { FormeVFC, FormeSommeil, FormePoids, Forme } from './components/stride/Forme.jsx';
import { Activites, LinkModal } from './components/stride/Activites.jsx';
import Objectifs from './components/stride/Objectifs.jsx';
import { JournalNutri, Nutrition } from './components/stride/Nutrition.jsx';
import SemaineType from './components/stride/SemaineType.jsx';
import MonCoachIA from './components/stride/MonCoachIA.jsx';
import { Donnees, Parametres, DonneesParams } from './components/stride/Donnees.jsx';

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

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
function Topbar({ context, setContext }) {
  const navConfigs = {
    home:   [{ id:"train", label:"Entraînement", icon:"🏃" }, { id:"course", label:"Course", icon:"🗺️" }],
    train:  [{ id:"home",  label:"Accueil",      icon:"⌂" },  { id:"course", label:"Course", icon:"🗺️" }],
    course: [{ id:"train", label:"Entraînement", icon:"🏃" }, { id:"home",   label:"Accueil", icon:"⌂" }],
  };
  const buttons = navConfigs[context] || navConfigs.home;
  const accentColor = context === "course" ? ALEX_C.primary : "#1D9E75";

  return (
    <div style={{height:52,background:C.white,borderBottom:`1px solid ${C.border}`,
      display:"flex",alignItems:"center",padding:"0 20px",flexShrink:0,zIndex:200,gap:16}}>
      <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:500,
        color:accentColor,letterSpacing:"-0.03em",flex:1,cursor:"pointer"}}
        onClick={()=>setContext("home")}>Alex</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {buttons.map((b,i) => (
          <button key={b.id} onClick={()=>setContext(b.id)}
            style={{display:"flex",alignItems:"center",gap:6,
              padding:"6px 14px",borderRadius:6,border:`1px solid ${C.border}`,
              background:"transparent",color:C.inkLight,cursor:"pointer",
              fontSize:13,fontWeight:500,fontFamily:"inherit",
              animation:`fadeUp 0.32s cubic-bezier(0.4,0,0.2,1) ${i*0.05}s both`}}>
            <span style={{fontSize:14}}>{b.icon}</span>
            <span className="hide-mobile">{b.label}</span>
          </button>
        ))}
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const setSubV = (parent,sub) => setSubView(sv=>({...sv,[parent]:sub}));

  const TEAL = "#1D9E75";
  const TEAL_PALE = "#e8f5f0";

  const TRAIN_GROUPS = [
    { label: null, items: [{ id:"dashboard", label:"Tableau de bord", icon:"◉" }] },
    { label: "Séances", items: [{ id:"entrainement", label:"Programme & Activités", icon:"↑" }] },
    { label: "Suivi", items: [
      { id:"forme",     label:"Forme",     icon:"♡" },
      { id:"objectifs", label:"Objectifs", icon:"🏔" },
    ]},
    { label: "Outils", items: [{ id:"coach", label:"Coach IA", icon:"✦" }] },
    { label: null, items: [{ id:"donnees", label:"Données & Params", icon:"⬆" }] },
  ];

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

  const [strideDark, setStrideDark] = useState(()=>document.documentElement.classList.contains("dark"));
  const toggleStrideDark = () => {
    const next = !strideDark;
    setStrideDark(next);
    if(next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  const SidebarContent = () => (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"24px 20px 16px"}}>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:TEAL,letterSpacing:"-0.02em"}}>Entraînement</div>
      </div>
      <div style={{height:1,background:C.border,margin:"0 16px"}}/>
      <nav style={{padding:"0 8px",flex:1,display:"flex",flexDirection:"column",gap:1,overflowY:"auto"}}>
        {TRAIN_GROUPS.map((g,gi) => (
          <div key={gi}>
            {g.label && <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:C.stoneDeep,padding:"10px 10px 3px",opacity:.7}}>{g.label}</div>}
            {g.items.map(n => (
              <div key={n.id} onClick={()=>{setView(n.id);setDrawerOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,cursor:"pointer",
                  fontWeight:500,fontSize:13,userSelect:"none",transition:"background .15s, color .15s",
                  background:view===n.id?TEAL_PALE:"transparent",
                  color:view===n.id?TEAL:C.muted}}>
                <span style={{fontSize:13}}>{n.icon}</span>
                <span>{n.label}</span>
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div style={{height:1,background:C.border,margin:"0 16px"}}/>
      {/* Dark mode */}
      <div style={{padding:"10px 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:12,color:C.muted,fontWeight:500}}>{strideDark?"🌙 Mode sombre":"☀️ Mode clair"}</span>
        <div onClick={toggleStrideDark}
          style={{width:36,height:20,borderRadius:10,cursor:"pointer",position:"relative",
            background:strideDark?TEAL:C.stoneDark,transition:"background .2s",flexShrink:0}}>
          <div style={{position:"absolute",top:2,left:strideDark?18:2,width:16,height:16,borderRadius:"50%",
            background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
        </div>
      </div>
      {/* Profil */}
      <div onClick={()=>{setView("profil_compte");setDrawerOpen(false);}}
        style={{padding:"10px 16px 20px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",
          transition:"background .15s",borderRadius:"0 0 0 0"}}
        onMouseEnter={e=>{e.currentTarget.style.background=C.stone}}
        onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:TEAL,flexShrink:0,
          display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:600}}>
          {(profil?.prenom||"?").slice(0,2).toUpperCase()}
        </div>
        <span style={{fontSize:12,color:C.inkLight,fontWeight:500,flex:1}}>{profil?.prenom||"Mon profil"}</span>
        <span style={{fontSize:14,color:C.stoneDeep}}>›</span>
      </div>
    </div>
  );

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
          <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:500,color:TEAL}}>
            {TRAIN_GROUPS.flatMap(g=>g.items).find(n=>n.id===view)?.label||"Entraînement"}
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

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",paddingTop:isMobile?48:0,paddingBottom:isMobile?0:0}}>
        {view==="dashboard"    && <Dashboard {...allProps}/>}
        {view==="objectifs"    && <Objectifs objectifs={objectifs} setObjectifs={setObjectifs} seances={seances} activites={activites} vfcData={vfcData} poids={poids} profil={profil} produits={produits} recettes={recettes} allData={allData}/>}
        {view==="coach"        && <MonCoachIA seances={seances} setSeances={setSeances} activites={activites} sommeil={sommeil} vfcData={vfcData} poids={poids} objectifs={objectifs} planningType={planningType} produits={produits} recettes={recettes} journalNutri={journalNutri} activityTypes={activityTypes}/>}
        {view==="entrainement" && (
          <div>
            <div style={{padding:"10px 40px",borderBottom:`1px solid ${C.border}`,background:C.white,display:"flex",gap:6,flexWrap:"wrap"}}>
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
            <div style={{padding:"10px 40px",borderBottom:`1px solid ${C.border}`,background:C.white,display:"flex",gap:6,flexWrap:"wrap"}}>
              {[{id:"vfc",l:"VFC & Charge"},{id:"sommeil",l:"Sommeil"},{id:"nutrition",l:"Journal nutritionnel"},{id:"poids",l:"Suivi corporel"}]
                .map(({id,l})=>subNavBtn(id,l,subView.forme===id,()=>setSubV("forme",id)))}
            </div>
            {subView.forme==="vfc"       && <FormeVFC sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData} poids={poids} setPoids={setPoids} activites={activites}/>}
            {subView.forme==="sommeil"   && <FormeSommeil sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData} poids={poids} setPoids={setPoids} activites={activites}/>}
            {subView.forme==="nutrition" && <JournalNutri journalNutri={journalNutri} setJournalNutri={setJournalNutri}/>}
            {subView.forme==="poids"     && <FormePoids sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData} poids={poids} setPoids={setPoids} activites={activites} profil={profil} setProfil={setProfil}/>}
          </div>
        )}
        {view==="donnees"       && <DonneesParams {...allProps} confirmReset={confirmReset} setConfirmReset={setConfirmReset}/>}
        {view==="profil_compte" && (
          <div style={{padding:"0 0 0 0",height:"100%"}}>
            <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.border}`,background:C.white,
              display:"flex",alignItems:"center",gap:12}}>
              <button onClick={()=>setView("dashboard")}
                style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:C.muted,
                  fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>← Retour</button>
              <span style={{fontSize:11,color:C.stoneDark}}>|</span>
              <span style={{fontSize:13,color:C.inkLight,fontWeight:500}}>Profil</span>
            </div>
            <ProfilCompte profil={profil} setProfil={setProfil}/>
          </div>
        )}
      </div>

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
`;

// ─── COURSE LAYOUT (Alex exact) ──────────────────────────────────────────────
function CourseLayout({ isMobile, strideObjectifs, profil: alexProfil, setProfil: setAlexProfil }) {
  const [view,         setView]         = useState("profil");
  const [raceRaw,      setRaceRaw]      = useState({});
  const [segmentsRaw,  setSegmentsRaw]  = useState([]);
  const [settingsRaw,  setSettingsRaw]  = useState({...EMPTY_SETTINGS});
  const [hasUnsaved,   setHasUnsaved]   = useState(false);
  const [autoSaved,    setAutoSaved]    = useState(false);
  const [courses,      setCourses]      = useState([]);
  const [sharedMode,   setSharedMode]   = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [reposModal,   setReposModal]   = useState(false);
  const [reposForm,    setReposForm]    = useState({ label: "", startKm: "", dureeMin: 20 });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installDone,  setInstallDone]  = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [featuresModal, setFeaturesModal] = useState(false);

  // ── Features toggles ────────────────────────────────────────────────────────
  const FEATURES_DEFAULT = { nutrition: true, equipement: true, analyse: true, team: true, courses: true, profilDetail: true };
  const [features, setFeatures] = useState(() => {
    try { const s = localStorage.getItem("alex-features"); return s ? { ...FEATURES_DEFAULT, ...JSON.parse(s) } : FEATURES_DEFAULT; } catch { return FEATURES_DEFAULT; }
  });
  const toggleFeature = key => {
    setFeatures(prev => { const next = { ...prev, [key]: !prev[key] }; try { localStorage.setItem("alex-features", JSON.stringify(next)); } catch {} return next; });
  };
  const FEATURE_LABELS = [
    { key: "profilDetail", label: "Profil détaillé",   icon: "🗺️", desc: "Répartition rythme, calibration Garmin, FC, calibration énergétique" },
    { key: "nutrition",    label: "Nutrition",         icon: "🍌", desc: "Plan nutritionnel par ravito, bibliothèque de produits" },
    { key: "equipement",   label: "Équipement",        icon: "🎒", desc: "Checklist équipement, poids, préparation chronologique" },
    { key: "analyse",      label: "Analyse",           icon: "📊", desc: "Cohérence stratégie, poids, autonomie nutritionnelle" },
    { key: "team",         label: "Team",              icon: "👥", desc: "Partage avec l'équipe d'assistance, suivi en direct" },
    { key: "courses",      label: "Mes courses",       icon: "📚", desc: "Historique et sauvegarde de tes stratégies" },
  ];
  const NAVS_ACTIVE = ALEX_NAVS.filter(n => {
    if (n.id === "nutrition")  return features.nutrition;
    if (n.id === "parametres") return features.equipement;
    if (n.id === "analyse")    return features.analyse;
    if (n.id === "team")       return features.team;
    if (n.id === "courses")    return features.courses;
    return true;
  });
  useEffect(() => {
    const map = { nutrition: "nutrition", parametres: "equipement", analyse: "analyse", team: "team", courses: "courses" };
    const k = map[view];
    if (k && !features[k]) setView("profil");
  }, [features]);

  // ── IndexedDB ──────────────────────────────────────────────────────────────
  const IDB_NAME = "alex-trail", IDB_STORE = "state", IDB_COURSES = "courses", IDB_KEY = "current";
  const openDB = () => new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 3);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE))   db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains(IDB_COURSES))  db.createObjectStore(IDB_COURSES, { keyPath: "id" });
      if (!db.objectStoreNames.contains("stride"))     db.createObjectStore("stride");
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
  const idbSave = async data => { try { const db = await openDB(); db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put(data, IDB_KEY); } catch {} };
  const idbLoad = async () => { try { const db = await openDB(); return new Promise(res => { const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(IDB_KEY); req.onsuccess = e => res(e.target.result); req.onerror = () => res(null); }); } catch { return null; } };
  const idbSaveCourse = async (id, data) => { try { const db = await openDB(); db.transaction(IDB_COURSES, "readwrite").objectStore(IDB_COURSES).put({ id, ...data }); } catch {} };
  const idbLoadCourses = async () => { try { const db = await openDB(); return new Promise(res => { const req = db.transaction(IDB_COURSES, "readonly").objectStore(IDB_COURSES).getAll(); req.onsuccess = e => res(e.target.result || []); req.onerror = () => res([]); }); } catch { return []; } };
  const idbDeleteCourse = async id => { try { const db = await openDB(); db.transaction(IDB_COURSES, "readwrite").objectStore(IDB_COURSES).delete(id); } catch {} };

  // ── Setters wrappés ────────────────────────────────────────────────────────
  const race     = raceRaw;
  const segments = segmentsRaw;
  const settings = settingsRaw;
  const setRace     = useCallback(upd => { setRaceRaw(upd);     setHasUnsaved(true); }, []);
  const setSegments = useCallback(upd => { setSegmentsRaw(upd); setHasUnsaved(true); }, []);
  const setSettings = useCallback(upd => { setSettingsRaw(upd); setHasUnsaved(true); }, []);

  // ── PWA ────────────────────────────────────────────────────────────────────
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") { setInstallDone(true); setInstallPrompt(null); }
    } else { setShowInstallGuide(true); }
  };

  // ── Chargement initial ─────────────────────────────────────────────────────
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let shared = urlParams.get("s");
    if (!shared && window.location.hash.startsWith("#s=")) shared = window.location.hash.slice(3);
    if (shared) {
      const data = decodeStrategy(shared);
      if (data) {
        if (data.race)     setRaceRaw(data.race);
        if (data.segments) setSegmentsRaw(data.segments);
        if (data.settings) setSettingsRaw({ ...EMPTY_SETTINGS, ...data.settings });
        setSharedMode(true);
        setView("team");
        idbSave({ race: data.race, segments: data.segments, settings: { ...EMPTY_SETTINGS, ...data.settings } });
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
    }
    idbLoad().then(d => {
      if (d?.race)     setRaceRaw(d.race);
      if (d?.segments) setSegmentsRaw(d.segments);
      if (d?.settings) setSettingsRaw({ ...EMPTY_SETTINGS, ...d.settings });
    });
    idbLoadCourses().then(list => setCourses(list.sort((a, b) => b.savedAt - a.savedAt)));
  }, []);

  useEffect(() => {
    if (!race && !segments.length) return;
    const timer = setTimeout(() => {
      idbSave({ race, segments, settings });
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 800);
    return () => clearTimeout(timer);
  }, [race, segments, settings]);

  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [settings.darkMode]);

  // ── Repos ──────────────────────────────────────────────────────────────────
  const addRepos = () => {
    if (!reposForm.label.trim() || !reposForm.dureeMin) return;
    const startKm = parseFloat(reposForm.startKm) || 0;
    setSegments(s => [...s, { id: Date.now(), type: "repos", label: reposForm.label, startKm, dureeMin: Number(reposForm.dureeMin), endKm: startKm, speedKmh: 0, slopePct: 0, terrain: "normal", notes: "" }]
      .sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
    setReposModal(false);
    setReposForm({ label: "", startKm: "", dureeMin: 20 });
  };

  // ── Save/Load JSON ─────────────────────────────────────────────────────────
  const saveData = () => {
    const json = JSON.stringify({ race, segments, settings }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "alex-data.json"; a.click();
    URL.revokeObjectURL(url);
    setHasUnsaved(false);
  };
  const loadData = (file) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d.race) setRaceRaw(d.race);
        if (d.segments) setSegmentsRaw(d.segments);
        if (d.settings) {
          const merged = { ...EMPTY_SETTINGS, ...d.settings };
          if (d.settings.equipment) {
            const existingIds = new Set(d.settings.equipment.map(i => i.id));
            const newItems = DEFAULT_EQUIPMENT.filter(i => !existingIds.has(i.id));
            const upgraded = d.settings.equipment.map(i => {
              const def = DEFAULT_EQUIPMENT.find(x => x.id === i.id);
              return { ...i, emporte: i.emporte !== undefined ? i.emporte : (def?.emporte ?? true), poidsG: i.poidsG !== undefined ? i.poidsG : (def?.poidsG ?? 0) };
            });
            merged.equipment = [...upgraded, ...newItems];
          }
          setSettingsRaw(merged);
        }
        idbSave({ race: d.race || {}, segments: d.segments || [], settings: { ...EMPTY_SETTINGS, ...(d.settings || {}) } });
        setHasUnsaved(false);
        setView("profil");
        setDrawerOpen(false);
      } catch { alert("Fichier JSON invalide."); }
    };
    reader.readAsText(file);
  };

  // ── CRUD courses ───────────────────────────────────────────────────────────
  const saveCourse = () => {
    const id = Date.now();
    const segsCourse  = segments.filter(s => s.type !== "ravito" && s.type !== "repos");
    const segsRepos   = segments.filter(s => s.type === "repos");
    const totalCourse    = segsCourse.reduce((s, seg) => s + (seg.endKm - seg.startKm) / seg.speedKmh * 3600, 0);
    const totalReposSec  = segsRepos.reduce((s, seg) => s + (seg.dureeMin || 0) * 60, 0);
    const totalRavitoSec = (race.ravitos?.length || 0) * (settings.ravitoTimeMin || 3) * 60;
    const entry = {
      id, savedAt: id,
      name: settings.raceName || race.name || "Course sans nom",
      distance: race.totalDistance || 0, elevPos: race.totalElevPos || 0,
      segCount: segsCourse.length, startTime: settings.startTime || "07:00",
      totalTime: totalCourse + totalReposSec + totalRavitoSec,
      race, segments, settings,
    };
    idbSaveCourse(id, entry);
    setCourses(prev => [entry, ...prev]);
    return entry;
  };
  const loadCourse = entry => {
    const mergedSettings = { ...EMPTY_SETTINGS, ...(entry.settings || {}), produits: settings.produits || [], equipment: settings.equipment || DEFAULT_EQUIPMENT };
    setRaceRaw(entry.race || {});
    setSegmentsRaw(entry.segments || []);
    setSettingsRaw(mergedSettings);
    idbSave({ race: entry.race, segments: entry.segments, settings: mergedSettings });
    setHasUnsaved(false);
    setView("profil");
    setDrawerOpen(false);
  };
  const deleteCourse = id => { idbDeleteCourse(id); setCourses(prev => prev.filter(c => c.id !== id)); };
  const updateCourse = (id, patch) => setCourses(prev => prev.map(c => { if (c.id !== id) return c; const u = { ...c, ...patch }; idbSaveCourse(id, u); return u; }));
  const overwriteCourse = id => {
    const totalTime = segments.filter(s => s.type !== "ravito" && s.type !== "repos").reduce((s, seg) => s + (seg.endKm - seg.startKm) / seg.speedKmh * 3600, 0);
    setCourses(prev => prev.map(c => {
      if (c.id !== id) return c;
      const u = { ...c, name: settings.raceName || race.name || c.name, distance: race.totalDistance || 0, elevPos: race.totalElevPos || 0, segCount: segments.filter(s => s.type !== "ravito" && s.type !== "repos").length, startTime: settings.startTime || "07:00", totalTime, race, segments, settings, updatedAt: Date.now() };
      idbSaveCourse(id, u);
      return u;
    }));
  };

  const navigate = id => { setView(id); setDrawerOpen(false); };
  const hasRace = !!race.gpxPoints?.length;

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "24px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, color: ALEX_C.primary, letterSpacing: "-0.02em" }}>Trail Running Strategy</div>
          {window.location.hostname !== "alex-trail.vercel.app" && !window.location.hostname.includes("localhost") && (
            <span style={{ fontSize: 10, fontWeight: 700, background: C.yellow + "30", color: C.yellow, border: `1px solid ${C.yellow}60`, borderRadius: 5, padding: "2px 7px", letterSpacing: "0.05em", flexShrink: 0 }}>DEV</span>
          )}
        </div>
      </div>
      <div style={{ height: 1, background: "var(--border-c)", margin: "0 16px" }} />

      {/* Nav */}
      <nav style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 1, flex: 1, overflowY: "auto" }}>
        {(() => {
          const groups = [...new Set(NAVS_ACTIVE.map(n => n.group))];
          return groups.map(group => (
            <div key={group}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 10px 3px", opacity: 0.7 }}>{group}</div>
              {NAVS_ACTIVE.filter(n => n.group === group).map(n => (
                <div key={n.id} onClick={() => navigate(n.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                    fontWeight: 500, fontSize: 13, userSelect: "none", transition: "background .15s, color .15s",
                    background: view === n.id ? ALEX_C.primaryPale : "transparent",
                    color: view === n.id ? ALEX_C.primaryDeep : "var(--muted-c)" }}>
                  <span style={{ fontSize: 13 }}>{n.icon}</span>
                  <span>{n.label}</span>
                </div>
              ))}
            </div>
          ));
        })()}
        {hasRace && (
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px", fontSize: 13, marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-c)" }}>{settings.raceName || race.name || "Course sans nom"}</div>
            <div style={{ color: "var(--muted-c)", fontSize: 12 }}>{race.totalDistance?.toFixed(1)} km · {Math.round(race.totalElevPos || 0)} m D+</div>
            <div style={{ color: "var(--muted-c)", fontSize: 12 }}>{segments.filter(s => s.type !== "ravito" && s.type !== "repos").length} segments · {race.ravitos?.length || 0} ravitos</div>
          </div>
        )}
        {/* Données & Params */}
        <div onClick={() => navigate("donnees_params")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, cursor: "pointer",
            fontWeight: 500, fontSize: 13, userSelect: "none", transition: "background .15s, color .15s",
            marginTop: 8, borderTop: "1px solid var(--border-c)", paddingTop: 12,
            background: view === "donnees_params" ? ALEX_C.primaryPale : "transparent",
            color: view === "donnees_params" ? ALEX_C.primaryDeep : "var(--muted-c)" }}>
          <span style={{ fontSize: 13 }}>⚙</span>
          <span>Données & Params</span>
          {autoSaved && <span style={{ marginLeft: "auto", fontSize: 10, color: C.green, fontWeight: 600 }}>✓ Sauvé</span>}
          {hasUnsaved && !autoSaved && <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: C.yellow, display: "inline-block" }} />}
        </div>
      </nav>

      <div style={{ height: 1, background: "var(--border-c)", margin: "0 16px" }} />

      {/* Dark mode */}
      <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--muted-c)", fontWeight: 500 }}>{settings.darkMode ? "🌙 Mode sombre" : "☀️ Mode clair"}</span>
        <div onClick={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))}
          style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", position: "relative",
            background: settings.darkMode ? ALEX_C.primary : "var(--border-c)", transition: "background .2s", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 2, left: settings.darkMode ? 18 : 2, width: 16, height: 16, borderRadius: "50%",
            background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
        </div>
      </div>

      {/* Profil */}
      <div onClick={() => { navigate("profil_compte"); }}
        style={{ padding: "10px 16px 20px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "background .15s" }}
        onMouseEnter={e => {e.currentTarget.style.background = "var(--surface-2)"}}
        onMouseLeave={e => {e.currentTarget.style.background = "transparent"}}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: ALEX_C.primary, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>
          {(alexProfil?.prenom || "?").slice(0, 2).toUpperCase()}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-c)", fontWeight: 500, flex: 1 }}>{alexProfil?.prenom || "Mon profil"}</span>
        <span style={{ fontSize: 14, color: "var(--muted-c)" }}>›</span>
      </div>
    </div>
  );

  return (
    <>
      <style>{ALEX_G}</style>
      <div className="alex-scope" style={{display:"flex",flex:1,overflow:"hidden",background:"var(--bg)"}}>
      {/* MODAL REPOS */}
      {reposModal && (
        <div onClick={() => setReposModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(28,25,22,0.55)", backdropFilter: "blur(3px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface,#fff)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border-c)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600 }}>Ajouter un segment de repos</div>
              <button onClick={() => setReposModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted-c)" }}>×</button>
            </div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-c)", marginBottom: 6 }}>Nom du repos</label>
                <input value={reposForm.label} onChange={e => setReposForm(f => ({ ...f, label: e.target.value }))} placeholder="Sommet, village, refuge..."/></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-c)", marginBottom: 6 }}>Km de début</label>
                  <input type="number" value={reposForm.startKm} onChange={e => setReposForm(f => ({ ...f, startKm: e.target.value }))} placeholder="0"/></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-c)", marginBottom: 6 }}>Durée (min)</label>
                  <input type="number" value={reposForm.dureeMin} onChange={e => setReposForm(f => ({ ...f, dureeMin: e.target.value }))} placeholder="20"/></div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setReposModal(false)} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--border-c)", background: "transparent", color: "var(--muted-c)", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>Annuler</button>
                <button onClick={addRepos} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: ALEX_C.primary, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 500 }}>Ajouter</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GUIDE INSTALL */}
      {showInstallGuide && (
        <div onClick={() => setShowInstallGuide(false)} style={{ position: "fixed", inset: 0, background: "rgba(28,25,22,0.55)", backdropFilter: "blur(3px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface,#fff)", borderRadius: 16, width: "100%", maxWidth: 400, padding: 28 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Installer Alex</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[{ step: "1", text: "Ouvre le menu du navigateur (⋮ ou ···)" }, { step: "2", text: "Cherche « Ajouter à l'écran d'accueil » ou « Installer »" }, { step: "3", text: "Confirme l'installation" }].map(s => (
                <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: ALEX_C.primary, color: "#fff", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.step}</div>
                  <span style={{ fontSize: 13, lineHeight: 1.5 }}>{s.text}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowInstallGuide(false)} style={{ background: ALEX_C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Compris</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* SIDEBAR DESKTOP */}
        {!isMobile && (
          <div style={{ width: 240, flexShrink: 0, background: "var(--surface,#fdfcfa)", borderRight: "1px solid var(--border-c)", overflowY: "auto", display: "flex", flexDirection: "column", height: "100%" }}>
            <SidebarContent />
          </div>
        )}

        {/* MOBILE TOPBAR */}
        {isMobile && (
          <div style={{ position: "fixed", top: 52, left: 0, right: 0, height: 48, zIndex: 100, background: "var(--surface,#fdfcfa)", borderBottom: "1px solid var(--border-c)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: ALEX_C.primary }}>Alex</div>
            <div style={{ fontSize: 13, color: "var(--muted-c)" }}>{NAVS_ACTIVE.find(n => n.id === view)?.label}</div>
            <button onClick={() => setDrawerOpen(true)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-c,#2a2218)" }}>☰</button>
          </div>
        )}

        {/* MOBILE DRAWER */}
        {isMobile && drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
            <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 260, background: "var(--surface,#fdfcfa)", overflowY: "auto", animation: "slideInLeft 0.25s ease", display: "flex", flexDirection: "column" }}>
              <button onClick={() => setDrawerOpen(false)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted-c)" }}>✕</button>
              <SidebarContent />
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "108px 16px 32px" : "44px 52px" }}>
          {view === "profil"      && <ProfilView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} onOpenRepos={() => setReposModal(true)} isMobile={isMobile} profilDetail={features.profilDetail} />}
          {view === "preparation" && <StrategieView race={race} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} onOpenRepos={() => setReposModal(true)} isMobile={isMobile} />}
          {view === "nutrition"   && <NutritionView segments={segments} settings={settings} setSettings={setSettings} race={race} setRace={setRace} isMobile={isMobile} onNavigate={navigate} />}
          {view === "analyse"     && <AnalyseView race={race} segments={segments} settings={settings} isMobile={isMobile} onNavigate={navigate} />}
          {view === "parametres"  && <EquipementView settings={settings} setSettings={setSettings} race={race} setRace={setRace} segments={segments} isMobile={isMobile} />}
          {view === "team"        && <TeamView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} sharedMode={sharedMode} installPrompt={installPrompt} onInstall={handleInstall} isMobile={isMobile} onLoadStrategy={data => {
            if (data.race)     setRaceRaw(data.race);
            if (data.segments) setSegmentsRaw(data.segments);
            if (data.settings) setSettingsRaw({ ...EMPTY_SETTINGS, ...data.settings });
            idbSave({ race: data.race, segments: data.segments, settings: { ...EMPTY_SETTINGS, ...data.settings } });
          }} />}
          {view === "courses"        && <MesCoursesView courses={courses} onLoad={loadCourse} onDelete={deleteCourse} onUpdate={updateCourse} onOverwrite={overwriteCourse} onSaveCurrent={() => { saveCourse(); alert("✅ Stratégie sauvegardée dans Mes courses !"); }} race={race} segments={segments} settings={settings} />}
          {view === "donnees_params" && (
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, marginBottom: 24, color: "var(--text-c)" }}>Données & Params</h2>
              {/* Stratégie */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-c)", marginBottom: 12 }}>Stratégie de course</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={saveData} style={{ background: hasUnsaved ? ALEX_C.primary : "var(--surface-2)", color: hasUnsaved ? "#fff" : "var(--text-c)", border: "none", borderRadius: 12, padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, transition: "all .2s", width: "100%", fontFamily: "inherit" }}>
                    💾 Télécharger la stratégie
                    {hasUnsaved && <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.8 }}>Modifications non sauvegardées</span>}
                  </button>
                  <label style={{ display: "block" }}>
                    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-c)", borderRadius: 12, padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--text-c)", display: "flex", alignItems: "center", gap: 8 }}>📂 Charger une stratégie</div>
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) loadData(e.target.files[0]); }} />
                  </label>
                  <button onClick={() => {
                    const hasData = race.gpxPoints?.length > 0 || segments.length > 0;
                    if (hasData) { const choice = window.confirm(`Démarrer une nouvelle course ?\n\nOK = sauvegarder "${settings.raceName || race.name || "la course actuelle"}" avant.\nAnnuler = tout effacer.`); if (choice) saveCourse(); }
                    const newSettings = { ...EMPTY_SETTINGS, produits: settings.produits || [], equipment: settings.equipment || DEFAULT_EQUIPMENT, darkMode: settings.darkMode };
                    setRaceRaw({}); setSegmentsRaw([]); setSettingsRaw(newSettings);
                    setHasUnsaved(false); setView("profil"); setDrawerOpen(false);
                    idbSave({ race: {}, segments: [], settings: newSettings });
                  }} style={{ background: "none", border: "1px solid var(--border-c)", borderRadius: 12, padding: "12px 16px", cursor: "pointer", fontSize: 13, width: "100%", fontWeight: 500, color: "var(--muted-c)", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
                    🔄 Nouvelle course
                  </button>
                  {!isStandalone && !installDone && (
                    <button onClick={handleInstall} style={{ background: ALEX_C.primaryPale, border: `1px solid ${ALEX_C.primary}40`, borderRadius: 12, padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, color: ALEX_C.primaryDeep, width: "100%", fontFamily: "inherit" }}>
                      📲 Installer l'app
                    </button>
                  )}
                  {isStandalone && <div style={{ fontSize: 12, color: C.green, padding: "4px 0" }}>✓ App installée</div>}
                </div>
              </div>
              {/* Fonctionnalités */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-c)", marginBottom: 12 }}>Fonctionnalités actives</div>
                <p style={{ fontSize: 13, color: "var(--muted-c)", marginBottom: 16, lineHeight: 1.6 }}>Active uniquement les fonctionnalités dont tu as besoin. Les onglets désactivés disparaissent de la navigation.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {FEATURE_LABELS.map(({ key, label, icon, desc }) => {
                    const active = features[key];
                    return (
                      <div key={key} onClick={() => toggleFeature(key)}
                        style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                          transition: "all .15s", border: `2px solid ${active ? ALEX_C.primary + "60" : "var(--border-c)"}`,
                          background: active ? ALEX_C.primaryPale : "var(--surface-2)" }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: active ? ALEX_C.primaryDeep : "var(--text-c)" }}>{label}</div>
                          <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>{desc}</div>
                        </div>
                        <div style={{ width: 40, height: 22, borderRadius: 11, flexShrink: 0, background: active ? ALEX_C.primary : "var(--border-c)", position: "relative", transition: "background .2s" }}>
                          <div style={{ position: "absolute", top: 3, left: active ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 12, color: "var(--muted-c)" }}>
                  💡 Profil de course et Stratégie sont toujours visibles.
                </div>
              </div>
            </div>
          )}
          {view === "profil_compte"  && (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24, paddingBottom:16, borderBottom:"1px solid var(--border-c)" }}>
                <button onClick={() => setView("profil")}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:13,
                    color:"var(--muted-c)", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>← Retour</button>
                <span style={{ fontSize:11, color:"var(--muted-c)" }}>|</span>
                <span style={{ fontSize:13, color:"var(--text-c)", fontWeight:500 }}>Profil</span>
              </div>
              <ProfilCompte profil={alexProfil||{}} setProfil={setAlexProfil||(() => {})}/>
            </div>
          )}
        </main>
      </div>
      </div>{/* end alex-scope */}
    </>
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
        {context==="course" && <CourseLayout isMobile={isMobile} strideObjectifs={objectifs} profil={profil} setProfil={setProfil}/>}
      </div>
    </>
  );
}
