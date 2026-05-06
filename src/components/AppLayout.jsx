import { useState } from "react";
import { C, COURSE_C, TEAL } from '../constants.js';
import { G, COURSE_G } from '../globalStyles.js';
import { ConfirmDialog } from '../atoms.jsx';
import Dashboard from './Dashboard.jsx';
import EntrainementProgramme from './EntrainementProgramme.jsx';
import { FormeVFC, FormeSommeil, FormePoids } from './Forme.jsx';
import { Activites } from './Activites.jsx';
import Journal from './Journal.jsx';
import Objectifs from './Objectifs.jsx';
import { JournalNutri, Nutrition } from './Nutrition.jsx';
import SemaineType from './SemaineType.jsx';
import MonCoachIA from './MonCoachIA.jsx';
import ProfilView from './ProfilView.jsx';
import StrategieView from './StrategieView.jsx';
import AnalyseView from './AnalyseView.jsx';
import NutritionView from './NutritionView.jsx';
import EquipementView from './EquipementView.jsx';
import TeamView from './TeamView.jsx';
import MesCoursesView from './MesCoursesView.jsx';
import ProfilCompte from './ProfilCompte.jsx';
import Confidentialite from './Confidentialite.jsx';
import DonneesParamsView from './DonneesParamsView.jsx';

// ─── APP LAYOUT UNIFIÉ ────────────────────────────────────────────────────────
export default function AppLayout({
  // Entrainement state
  seances, setSeances, activites, setActivites, sommeil, setSommeil,
  vfcData, setVfcData, poids, setPoids, objectifs, setObjectifs,
  planningType, setPlanningType, activityTypes, setActivityTypes,
  journalNutri, setJournalNutri, journalMoments, setJournalMoments, produits, setProduits, recettes, setRecettes,
  allData, loadEntrainementData, resetAll, profil, setProfil,
  confirmReset, setConfirmReset, isMobile,
  // Course state (depuis CourseLayout inline)
  view, setView, race, setRace, segments, setSegments, settings, setSettings,
  hasUnsaved, autoSaved, courses, drawerOpen, setDrawerOpen,
  reposModal, setReposModal, reposForm, setReposForm, addRepos,
  loadData, onSaveCourse, loadCourse, deleteCourse, updateCourse, overwriteCourse,
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
  const [journalOpenNew, setJournalOpenNew] = useState(false);
  const setSubV = (parent,sub) => setSubView(sv=>({...sv,[parent]:sub}));

  const isDark = settings?.darkMode || false;

  // Settings effectifs : cascade course → profil → settings legacy
  // Permet aux composants de lire kcalSource/kcalPerKm/glucidesTargetGh sans connaître la source
  const effSettings = {
    ...settings,
    kcalSource: profil?.kcalSource ?? settings.kcalSource,
    kcalPerKm: profil?.kcalPerKm ?? settings.kcalPerKm,
    kcalPerKmUphill: profil?.kcalPerKmUphill ?? settings.kcalPerKmUphill,
    glucidesTargetGh: race?.nutritionStrategy?.glucidesTargetGh ?? profil?.glucidesTargetGh ?? settings.glucidesTargetGh
  };

  // Navigation unifiée avec filtrage selon profilType
  const NAV_GROUPS = [
    { label: null, color: null, items: [
      { id:"accueil",   label:"Tableau de bord", icon:"◉" },
      ...(entrainementFeatures.objectifs!==false ? [{ id:"objectifs", label:"Objectifs", icon:"🏔" }] : []),
    ]},
    ...(entrainementFeatures.journal!==false ? [{ label: null, color: null, items: [
      { id:"journal", label:"Journal", icon:"✎" },
    ]}] : []),
    // Section Entraînement
    // Visible si : full, training_only (masquée si course_prep ou team)
    ...( (entrainementFeatures._section!==false && profilType !== 'course_prep' && profilType !== 'team') ? [{ label: "Entraînement", color: TEAL, items: [
      { id:"entrainement", label:"Programme",  icon:"↑", feat:"programme" },
      { id:"activites",    label:"Activités",  icon:"▣", feat:"activites" },
      { id:"forme",        label:"Forme",      icon:"♡", feat:"forme" },
      { id:"gut_training", label:"Gut Training", icon:"🍽️", feat:"gut_training" },
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
          {view==="accueil" && <Dashboard setView={setView} seances={seances} activites={activites} journalMoments={journalMoments} setJournalMoments={setJournalMoments} requestJournalNew={()=>setJournalOpenNew(true)} vfcData={vfcData} sommeil={sommeil} poids={poids} objectifs={objectifs} race={race} settings={settings} profilType={profilType} setProfilType={setProfilType}/>}
          {view==="objectifs" && <Objectifs objectifs={objectifs} setObjectifs={setObjectifs} seances={seances} activites={activites} vfcData={vfcData} poids={poids} profil={profil} produits={produits} recettes={recettes} allData={allData} setView={setView}/>}
          {view==="coach" && <MonCoachIA seances={seances} setSeances={setSeances} activites={activites} sommeil={sommeil} vfcData={vfcData} poids={poids} objectifs={objectifs} planningType={planningType} produits={produits} recettes={recettes} journalNutri={journalNutri} activityTypes={activityTypes}/>}
          {view==="activites" && <Activites activites={activites} setActivites={setActivites} seances={seances} setSeances={setSeances}/>}
          {view==="journal" && <Journal journalMoments={journalMoments} setJournalMoments={setJournalMoments} objectifs={objectifs} race={race} isMobile={isMobile} openNewSignal={journalOpenNew} clearOpenNewSignal={()=>setJournalOpenNew(false)}/>}
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
          {view==="profil_course"&&<div style={{padding:"24px 32px"}}><ProfilView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={effSettings} setSettings={setSettings} onOpenRepos={()=>setReposModal(true)} isMobile={isMobile} profilDetail={features.profilDetail} profil={profil} poids={poids} activites={activites} produits={produits} recettes={recettes}/></div>}
          {view==="strategie"&&<div style={{padding:"24px 32px"}}><StrategieView race={race} segments={segments} setSegments={setSegments} settings={effSettings} setSettings={setSettings} onOpenRepos={()=>setReposModal(true)} isMobile={isMobile} profil={profil}/></div>}
          {view==="nutrition_course"&&<div style={{padding:"24px 32px"}}><NutritionView segments={segments} settings={settings} setSettings={setSettings} race={race} setRace={setRace} isMobile={isMobile} onNavigate={setView} profil={profil} poids={poids} recettes={recettes} setRecettes={setRecettes} produits={produits} setProduits={setProduits}/></div>}
          {view==="equipement"&&<div style={{padding:"24px 32px"}}><EquipementView settings={settings} setSettings={setSettings} race={race} setRace={setRace} segments={segments} isMobile={isMobile}/></div>}
          {view==="analyse"&&<div style={{padding:"24px 32px"}}><AnalyseView race={race} segments={segments} settings={effSettings} produits={produits} recettes={recettes} activites={activites} isMobile={isMobile} onNavigate={setView}/></div>}
          {view==="team"&&<div style={{padding:"24px 32px"}}><TeamView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={effSettings} setSettings={setSettings} produits={produits} recettes={recettes} sharedMode={sharedMode} installPrompt={installPrompt} onInstall={handleInstall} isMobile={isMobile} onLoadStrategy={data=>{
            if(data.race)setRace(data.race);
            if(data.segments)setSegments(data.segments);
            if(data.settings)setSettings({...EMPTY_SETTINGS,...data.settings});
          }}/></div>}
          {view==="mes_courses"&&<div style={{padding:"24px 32px"}}><MesCoursesView courses={courses} onLoad={loadCourse} onDelete={deleteCourse} onUpdate={updateCourse} onOverwrite={overwriteCourse} onSaveCurrent={()=>{onSaveCourse();alert("✅ Stratégie sauvegardée !");}} onLoadFile={loadData} onNewRace={()=>{
            const hasData=race.gpxPoints?.length>0||segments.length>0;
            if(hasData){const ok=window.confirm(`Démarrer une nouvelle course ?

OK = sauvegarder avant.
Annuler = tout effacer.`);if(ok)onSaveCourse();}
            const ns={...EMPTY_SETTINGS,produits:settings.produits||[],equipment:settings.equipment||DEFAULT_EQUIPMENT,darkMode:settings.darkMode};
            setRace({});setSegments([]);setSettings(ns);setView("profil_course");setDrawerOpen(false);
          }} race={race} segments={segments} settings={settings}/></div>}
          {/* Données & Params unifiés */}
          {view==="donnees_params"&&<DonneesParamsView
            saveAllData={saveAllData}
            race={race} segments={segments} settings={settings}
            isStandalone={isStandalone} installDone={installDone}
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
              <ProfilCompte profil={profil} setProfil={setProfil} settings={settings} setSettings={setSettings}/>
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
