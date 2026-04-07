import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { CS as C, localDate, fmtDate, daysUntil, isRunning, actColor, actColorPale, actIcon, actShort,
  exportJSON, parseCSVActivities, emptySeance, ACTIVITY_TYPES, STATUT_OPTIONS, TYPE_MIGRATION,
  ACT_ICON, DAY_NAMES, DAY_SHORT, MOIS_FR, DEFAULT_PLANNING } from "../../stride/constants.js";
import { Btn, Modal, Field, FormGrid, ConfirmDialog, statusBadge } from "../../stride/atoms.jsx";
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


export { StatusBadge, ActCell, DiffSpan, EntrainementProgramme, ProgrammeView, Programme };
