import React, { useState, useMemo, useRef } from "react";
import { C, localDate, fmtDate, actColor, actIcon, actShort,
  TYPE_MIGRATION, parseCSVActivities } from "../constants.js";
import { Btn, Modal, Field, ConfirmDialog } from "../atoms.jsx";
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
      <style>{`
        @media (max-width: 768px) {
          .act-header, .act-row { 
            grid-template-columns: 60px 140px 100px 1fr 70px 80px 60px 40px !important; 
            min-width: 650px !important;
          }
          .act-hide-mobile { display: none !important; }
        }
      `}</style>
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
          <div className="act-header" style={{display:"grid",gridTemplateColumns:"60px 140px 100px 1fr 70px 80px 60px 60px 60px 70px 48px 48px 48px 48px 48px 40px",minWidth:1200,borderBottom:`1px solid ${C.border}`}}>
            {[["","Statut"],["dateHeure","ID (date + heure)"],["type","Type"],["titre","Titre"],["distance","Dist."],["duree","Durée"],["fcMoy","FC Ø"],["fcMax","FC Max"],["dp","D+"],["calories","Cal."],["z1","Z1%"],["z2","Z2%"],["z3","Z3%"],["z4","Z4%"],["z5","Z5%"],["",""]].map(([k,l],idx)=>{
              const hideMobile = idx >= 7 && idx <= 14; // FC Max, D+, Cal, Z1-Z5
              return (
                <div key={k||`col-${idx}`} className={hideMobile?"act-hide-mobile":""} style={{...thStyle(k)}} onClick={()=>k&&sort(k)}>{l}{sortKey===k?sortDir>0?" ↑":" ↓":""}</div>
              );
            })}
          </div>
          {/* Rows */}
          <div style={{maxHeight:800,overflowY:"auto"}}>
            {filtered.length===0 && (
              <div style={{padding:"32px",textAlign:"center",color:C.muted,fontSize:13}}>Aucune activité · Importer un fichier Activities.csv depuis Garmin Connect</div>
            )}
            {filtered.map(a=>{
              const showZ=true; // zones FC pour toutes les activités
              const isCopied=copied===a.dateHeure;
              return (
                <div key={a.id} className="act-row" style={{display:"grid",gridTemplateColumns:"60px 140px 100px 1fr 70px 80px 60px 60px 60px 70px 48px 48px 48px 48px 48px 40px",borderTop:`1px solid ${C.border}`,alignItems:"center",minWidth:1200,background:"transparent",transition:"background .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.stone+"30"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {/* Statut lié + bouton lier */}
                  <div style={{padding:"8px 6px",display:"flex",flexDirection:"column",gap:4,alignItems:"center",borderRight:`1px solid ${C.border}`}}>
                    <span style={{
                      fontSize:9,fontWeight:600,padding:"2px 6px",borderRadius:4,whiteSpace:"nowrap",
                      background:liees.has(a.dateHeure)?C.forestPale:C.stone,
                      color:liees.has(a.dateHeure)?C.forest:C.stoneDeep,
                    }}>
                      {liees.has(a.dateHeure)?"✓ Lié":"Libre"}
                    </span>
                    <button onClick={()=>setLinkAct(a)}
                      style={{fontSize:9,padding:"2px 6px",borderRadius:4,cursor:"pointer",fontWeight:500,
                        border:`0.5px solid ${liees.has(a.dateHeure)?C.forest:C.sky}`,
                        background:liees.has(a.dateHeure)?C.forestPale:C.skyPale,
                        color:liees.has(a.dateHeure)?C.forest:C.sky,whiteSpace:"nowrap"}}>
                      {liees.has(a.dateHeure)?"→":"Lier"}
                    </button>
                  </div>
                  {/* ID cliquable */}
                  <div
                    onClick={()=>copyID(a.dateHeure)}
                    title="Cliquer pour copier l'ID"
                    style={{padding:"8px 6px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10,
                      color:isCopied?C.green:C.sky,background:isCopied?C.greenPale:C.skyPale+"66",
                      borderRight:`1px solid ${C.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                      display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:9,flexShrink:0}}>{isCopied?"✓":"⎘"}</span>
                    {isCopied?"Copié !" : a.dateHeure}
                  </div>
                  <div style={{padding:"8px 6px",fontSize:11,color:C.inkLight,borderRight:`1px solid ${C.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>
                    <span style={{display:"inline-block",width:7,height:7,borderRadius:2,background:actColor(a.type||"Trail"),flexShrink:0}}/>
                    {a.type||"—"}
                  </div>
                  <div style={{padding:"8px 6px",fontSize:11,color:C.inkLight,borderRight:`1px solid ${C.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={a.titre}>{a.titre||"—"}</div>
                  {[
                    {k:"distance",u:"km",hide:false},{k:"duree",u:"",hide:false},{k:"fcMoy",u:"",hide:false},{k:"fcMax",u:"",hide:true},{k:"dp",u:"m",hide:true},{k:"calories",u:"",hide:true},
                  ].map(({k,u,hide})=>(
                    <div key={k} className={hide?"act-hide-mobile":""} style={{padding:"8px 4px",borderRight:`1px solid ${C.border}`}}>
                      <input value={a[k]||""} onChange={e=>updAct(a.id,k,e.target.value)}
                        style={{fontSize:11,padding:"2px 4px",border:`1px solid ${C.border}`,borderRadius:4,width:"100%",background:C.bg,fontFamily:"'DM Mono',monospace",textAlign:"right"}}/>
                    </div>
                  ))}
                  {/* Zones FC */}
                  {["z1","z2","z3","z4","z5"].map(z=>(
                    <div key={z} className="act-hide-mobile" style={{padding:"8px 4px",borderRight:`1px solid ${C.border}`}}>
                      {showZ
                        ? <input type="number" min="0" max="100" step="1" value={a[z] != null ? a[z] : ""}
                            onChange={e=>updAct(a.id,z,e.target.value)}
                            style={{fontSize:11,padding:"2px 4px",border:`1px solid ${C.border}`,borderRadius:4,width:"100%",textAlign:"center",background:C.bg,fontFamily:"'DM Mono',monospace"}}/>
                        : <span style={{fontSize:9,color:C.border,padding:"0 4px"}}>—</span>
                      }
                    </div>
                  ))}
                  <div style={{padding:"8px 4px",display:"flex",justifyContent:"center"}}>
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
    const seance = seances.find(s => s.id === sid);
    const activityMatch = linkAct.type === seance?.activite;
    const newStatut = seance?.statut === "Planifié" 
      ? (activityMatch ? "Effectué" : "Remplacé")
      : seance?.statut;
    
    setSeances(ss=>ss.map(s=>s.id!==sid?s:{...s,
      _garminId:linkAct.dateHeure,garminTitre:linkAct.titre||"",
      dureeGarmin:linkAct.duree||"",kmGarmin:linkAct.distance||"",
      dpGarmin:linkAct.dp||"",fcMoy:linkAct.fcMoy||"",fcMax:linkAct.fcMax||"",
      cal:linkAct.calories||"",allure:linkAct.gapMoy||linkAct.allure||"",
      z1:linkAct.z1||"",z2:linkAct.z2||"",z3:linkAct.z3||"",
      z4:linkAct.z4||"",z5:linkAct.z5||"",
      statut:newStatut}));
    onClose();
  };
  const doUnlink=(sid)=>{
    setSeances(ss=>ss.map(s=>s.id!==sid?s:{...s,
      _garminId:"",garminTitre:"",dureeGarmin:"",kmGarmin:"",dpGarmin:"",
      fcMoy:"",fcMax:"",cal:"",allure:"",z1:"",z2:"",z3:"",z4:"",z5:"",
      statut:(s.statut==="Effectué"||s.statut==="Remplacé")?"Planifié":s.statut}));
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



export { Activites, LinkModal };
