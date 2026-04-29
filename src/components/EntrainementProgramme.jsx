import React, { useState, useMemo, useRef } from "react";
import { C, localDate, fmtDate, isRunning, actColor, actIcon,
  emptySeance, ACTIVITY_TYPES, TYPE_MIGRATION, DAY_NAMES } from "../constants.js";
import { Btn, Modal, Field, ConfirmDialog } from "../atoms.jsx";
// ─── ENTRAÎNEMENT PROGRAMME (vue principale fusionnée) ───────────────────────
// Statuts enrichis
const STATUTS = [
  {id:"Planifié",  icon:"●", col:C.sky,    bg:C.skyPale},
  {id:"Effectué",  icon:"■", col:C.forest, bg:C.forestPale},
  {id:"Partiel",   icon:"◆", col:"#BA7517", bg:"#FFF3E0"},
  {id:"Remplacé",  icon:"▲", col:"#D85A30", bg:"#FEE8E1"},
  {id:"Annulé",    icon:"✕", col:C.red,    bg:C.redPale},
];
const statutCfg = (st) => STATUTS.find(s=>s.id===st)||STATUTS[0];

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
  planningType, activityTypes, setView, allData, loadData, resetAll,
  setPlanningType, setActivityTypes }) {

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
        if(!data._alex_programme&&!data.seances){alert("Format non reconnu. Attendu : _alex_programme + seances[]");return;}
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
  const updateField = (id,field,val) => {
    setSeances(ss=>ss.map(s=>s.id===id?{...s,[field]:val}:s));
  };

  // Couleur fond ligne par statut
  const rowBg = (st) => ({
    "Effectué":"#E1F5EE18","Partiel":"#FAEEDA22","Remplacé":"#EEEDFE22",
    "Annulé":"transparent","Planifié":"transparent"
  }[st]||"transparent");

  // Colonnes de la grille
  const GRID = "88px 110px 140px 140px minmax(80px,1fr) 70px 68px 58px 58px 48px 50px 70px 68px 58px 58px 48px 50px 36px 36px 36px 36px 36px";

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
                    <div style={{gridColumn:"6/12",fontSize:9,fontWeight:500,color:C.forest,textAlign:"center",padding:"4px 0",borderLeft:`1.5px solid ${C.forest}33`}}>— Prévu —</div>
                    <div style={{gridColumn:"12/18",fontSize:9,fontWeight:500,color:"#BA7517",textAlign:"center",padding:"4px 0",borderLeft:`1.5px solid #BA751744`}}>— Réalisé —</div>
                    <div style={{gridColumn:"18/23",fontSize:9,fontWeight:500,color:"#534AB7",textAlign:"center",padding:"4px 0",borderLeft:`1.5px solid #7F77DD44`}}>Zones FC %</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:GRID,
                    padding:"0 16px",gap:0,borderTop:`0.5px solid ${C.border}`,minWidth:900}}>
                    <div style={{padding:"3px 0",fontSize:9,color:C.muted}}>Statut</div>
                    <div style={{padding:"3px 0",fontSize:9,color:C.muted}}>Date · Créne.</div>
                    <div style={{padding:"3px 0",fontSize:9,color:C.muted}}>Activité prévue</div>
                    <div style={{padding:"3px 0",fontSize:9,color:C.muted}}>Activité réalisée</div>
                    <div style={{padding:"3px 0",fontSize:9,color:C.muted}}>Commentaire</div>
                    {["Durée","Km","D+","Allure","Ratio","FC"].map(h=><div key={h} style={{padding:"3px 4px",fontSize:9,color:C.forest,textAlign:"right",borderLeft:h==="Durée"?`1.5px solid ${C.forest}33`:"none"}}>{h}</div>)}
                    {["Durée","Km","D+","Allure","Ratio","FC"].map(h=><div key={h+"r"} style={{padding:"3px 4px",fontSize:9,color:"#BA7517",textAlign:"right",borderLeft:h==="Durée"?"1.5px solid #BA751744":"none"}}>{h}</div>)}
                    {["Z1","Z2","Z3","Z4","Z5"].map((z,i)=><div key={z} style={{padding:"3px 2px",fontSize:9,textAlign:"center",borderLeft:i===0?"1.5px solid #7F77DD44":"none",color:["#378ADD","#639922","#BA7517","#D85A30","#A32D2D"][i]}}>{z}</div>)}
                  </div>

                  {/* Lignes */}
                  {wSlots.map(({dateStr,slot,dayName,half,seance,defaultType})=>{
                    if(!seance&&!defaultType) return null;
                    const s=seance;
                    const st=s?.statut||"Planifié";
                    const isDone=st==="Effectué"||st==="Partiel"||st==="Remplacé";
                    const actPrev=s?.activite||defaultType;
                    const actReal=s?._garminId 
                      ? (activites.find(a=>a.dateHeure===s._garminId)?.type || actPrev)
                      : (isDone ? actPrev : null);
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
                          {s ? (
                            <select
                              value={st}
                              onChange={e => updateField(s.id, "statut", e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{
                                fontSize:10,
                                padding:"2px 6px",
                                borderRadius:5,
                                border:`1px solid ${statutCfg(st).col}44`,
                                background:statutCfg(st).bg,
                                color:statutCfg(st).col,
                                fontWeight:500,
                                cursor:"pointer",
                                width:"100%",
                                maxWidth:90
                              }}>
                              {STATUTS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.id}</option>)}
                            </select>
                          ) : (
                            <span style={{fontSize:10,color:C.sky}}>● Planifié</span>
                          )}
                        </div>
                        {/* Date + Créneau */}
                        <div style={{padding:"8px 4px",display:"flex",flexDirection:"column",gap:1}}>
                          <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:500,color:raceDates.has(dateStr)?C.summit:s?.date===today?C.forest:C.inkLight}}>{fmtDate(dateStr)}{raceDates.has(dateStr)&&<span style={{marginLeft:4}}>🏔</span>}</span>
                          <span style={{fontSize:10,color:C.muted}}>{dayName.slice(0,3)} {half}</span>
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
                        {/* Ratio Prévu (D+/km) */}
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          {(()=>{
                            const dp=parseFloat(s?.dpObj);
                            const km=parseFloat(s?.kmObj);
                            if(!dp||!km||km===0) return <span style={{fontSize:11,color:C.stoneDeep}}>—</span>;
                            const ratio=Math.round(dp/km);
                            return <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:C.stoneDeep}}>{ratio}</span>;
                          })()}
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
                        {/* Ratio Réalisé (D+/km) */}
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          {isDone&&(()=>{
                            const dp=parseFloat(s?.dpGarmin);
                            const km=parseFloat(s?.kmGarmin);
                            const dpPlan=parseFloat(s?.dpObj);
                            const kmPlan=parseFloat(s?.kmObj);
                            if(!dp||!km||km===0) return <span style={{fontSize:11,color:C.stoneDeep}}>—</span>;
                            const ratio=Math.round(dp/km);
                            const ratioPlan=(dpPlan&&kmPlan&&kmPlan>0)?Math.round(dpPlan/kmPlan):null;
                            const col=!ratioPlan?C.summit:ratio>ratioPlan?C.red:ratio<ratioPlan?C.green:C.muted;
                            return <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:col,fontWeight:500}}>{ratio}</span>;
                          })()}
                          {!isDone&&<span style={{fontSize:11,color:C.stoneDeep}}>—</span>}
                        </div>
                        <div style={{padding:"8px 6px",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                          {isDone?<span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:C.forest}}>{s?.fcMoy||"—"}</span>:<span style={{fontSize:11,color:C.stoneDeep}}>—</span>}
                        </div>
                        {/* Zones FC — après Réalisé */}
                        {["z1","z2","z3","z4","z5"].map((z,i)=>(
                          <div key={z} style={{padding:"8px 2px",display:"flex",alignItems:"center",justifyContent:"center",borderLeft:i===0?"1.5px solid #7F77DD44":"none"}}>
                            {isDone&&s?.[z]?<span style={{fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:500,color:["#378ADD","#639922","#BA7517","#D85A30","#A32D2D"][i]}}>{s[z]}</span>:<span style={{fontSize:10,color:C.stoneDeep}}>—</span>}
                          </div>
                        ))}
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

export default EntrainementProgramme;
