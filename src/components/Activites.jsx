import React, { useState, useMemo, useRef, useEffect } from "react";
import { C, fmtDate, actColor, actShort, parseCSVActivities } from "../constants.js";
import { Btn, PageTitle, ScrollableTable, ScrollableRow, ScrollableCell } from "../atoms.jsx";
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
  const [ressentiPop, setRessentiPop] = useState(null); // {actId, field, anchorRect}
  const [isMobile,  setIsMobile]  = useState(typeof window !== "undefined" && window.innerWidth <= 768);
  const activitesRef = useRef();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  const addJourOff = () => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const dateHeure = `${date} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
    const newAct = {
      id: Date.now() + Math.random(),
      date,
      dateHeure,
      type: "Repos",
      titre: "Jour off",
      statut: "",
      distance: "", duree: "", fcMoy: "", fcMax: "", dp: "", calories: "",
      z1: 0, z2: 0, z3: 0, z4: 0, z5: 0,
      forme: null, plaisir: null, rpe: null, noteRessenti: ""
    };
    setActivites(as => [newAct, ...as]);
  };

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
    cursor: k ? "pointer" : "default",
    color: sortKey===k ? C.forest : undefined,
    borderRight: `1px solid ${C.border}`,
  });
  const sort = (k) => { if(sortKey===k) setSortDir(d=>-d); else {setSortKey(k);setSortDir(-1);}};

  

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <PageTitle sub={`${activites.length} activité(s) · Cliquer sur l'ID pour le copier, puis le coller dans Programme`}>Activités</PageTitle>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="ghost" size="sm" onClick={addJourOff}>+ Jour off</Btn>
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
      {(() => {
        // Définition complète des colonnes (desktop)
        const ALL_COLS = [
          { key: "",           label: "Statut",            w: "60px",  hideMobile: false },
          { key: "dateHeure",  label: "ID (date + heure)", w: "140px", hideMobile: false },
          { key: "type",       label: "Type",              w: "100px", hideMobile: false },
          { key: "titre",      label: "Titre",             w: "1fr",   hideMobile: false },
          { key: "distance",   label: "Dist.",             w: "70px",  hideMobile: false },
          { key: "duree",      label: "Durée",             w: "80px",  hideMobile: false },
          { key: "fcMoy",      label: "FC Ø",              w: "60px",  hideMobile: false },
          { key: "fcMax",      label: "FC Max",            w: "60px",  hideMobile: true  },
          { key: "dp",         label: "D+",                w: "60px",  hideMobile: true  },
          { key: "calories",   label: "Cal.",              w: "70px",  hideMobile: true  },
          { key: "z1",         label: "Z1%",               w: "48px",  hideMobile: true  },
          { key: "z2",         label: "Z2%",               w: "48px",  hideMobile: true  },
          { key: "z3",         label: "Z3%",               w: "48px",  hideMobile: true  },
          { key: "z4",         label: "Z4%",               w: "48px",  hideMobile: true  },
          { key: "z5",         label: "Z5%",               w: "48px",  hideMobile: true  },
          { key: "forme",      label: "Forme",             w: "60px",  hideMobile: false },
          { key: "plaisir",    label: "Plaisir",           w: "60px",  hideMobile: false },
          { key: "rpe",        label: "RPE",               w: "60px",  hideMobile: true  },
          { key: "noteRessenti", label: "Note",            w: "60px",  hideMobile: true  },
          { key: "",           label: "",                  w: "40px",  hideMobile: false }, // colonne supprimer
        ];
        const visibleCols = isMobile ? ALL_COLS.filter(c => !c.hideMobile) : ALL_COLS;
        const minWidth = isMobile ? 770 : 1440;

        return (
          <ScrollableTable
            columns={visibleCols.map(c => c.w)}
            minWidth={minWidth}
            maxHeight={800}
            headerCells={visibleCols.map((c, idx) => ({
              content: <>{c.label}{sortKey===c.key?sortDir>0?" ↑":" ↓":""}</>,
              onClick: c.key ? () => sort(c.key) : undefined,
              style: thStyle(c.key)
            }))}
          >
            {filtered.length===0 && (
              <ScrollableRow>
                <ScrollableCell align="center" style={{padding:"32px",color:C.muted,fontSize:13}} colSpan={visibleCols.length}>
                  Aucune activité · Importer un fichier Activities.csv depuis Garmin Connect
                </ScrollableCell>
              </ScrollableRow>
            )}
            {filtered.map(a=>{
              const isCopied = copied===a.dateHeure;
              return (
                <ScrollableRow key={a.id}
                  onMouseEnter={e=>e.currentTarget.style.background=C.stone+"30"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {/* Statut */}
                  <ScrollableCell align="center" style={{padding:"8px 6px",borderRight:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center"}}>
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
                  </ScrollableCell>
                  {/* ID cliquable */}
                  <ScrollableCell
                    onClick={()=>copyID(a.dateHeure)}
                    title="Cliquer pour copier l'ID"
                    style={{padding:"8px 6px",fontFamily:"'DM Mono',monospace",fontSize:10,
                      color:isCopied?C.green:C.sky,background:isCopied?C.greenPale:C.skyPale+"66",
                      borderRight:`1px solid ${C.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:9,flexShrink:0}}>{isCopied?"✓":"⎘"}</span>
                      {isCopied?"Copié !" : a.dateHeure}
                    </div>
                  </ScrollableCell>
                  {/* Type */}
                  <ScrollableCell title={a.type} style={{padding:"8px 6px",fontSize:11,color:C.inkLight,borderRight:`1px solid ${C.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{display:"inline-block",width:7,height:7,borderRadius:2,background:actColor(a.type||"Trail"),flexShrink:0}}/>
                      {a.type||"—"}
                    </div>
                  </ScrollableCell>
                  {/* Titre */}
                  <ScrollableCell title={a.titre} style={{padding:"8px 6px",fontSize:11,color:C.inkLight,borderRight:`1px solid ${C.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {a.titre||"—"}
                  </ScrollableCell>
                  {/* Champs numériques (filtrés selon mobile) */}
                  {[
                    {k:"distance",hide:false},{k:"duree",hide:false},{k:"fcMoy",hide:false},
                    {k:"fcMax",hide:true},{k:"dp",hide:true},{k:"calories",hide:true},
                  ].filter(({hide}) => !isMobile || !hide).map(({k})=>(
                    <ScrollableCell key={k} style={{padding:"8px 4px",borderRight:`1px solid ${C.border}`}}>
                      <input value={a[k]||""} onChange={e=>updAct(a.id,k,e.target.value)}
                        style={{fontSize:11,padding:"2px 4px",border:`1px solid ${C.border}`,borderRadius:4,width:"100%",background:C.bg,fontFamily:"'DM Mono',monospace",textAlign:"right"}}/>
                    </ScrollableCell>
                  ))}
                  {/* Zones FC (cachées en mobile) */}
                  {!isMobile && ["z1","z2","z3","z4","z5"].map(z=>(
                    <ScrollableCell key={z} style={{padding:"8px 4px",borderRight:`1px solid ${C.border}`}}>
                      <input type="number" min="0" max="100" step="1" value={a[z] != null ? a[z] : ""}
                        onChange={e=>updAct(a.id,z,e.target.value)}
                        style={{fontSize:11,padding:"2px 4px",border:`1px solid ${C.border}`,borderRadius:4,width:"100%",textAlign:"center",background:C.bg,fontFamily:"'DM Mono',monospace"}}/>
                    </ScrollableCell>
                  ))}
                  {/* Cellules ressenti */}
                  {[
                    {field:"forme",   hide:false},
                    {field:"plaisir", hide:false},
                    {field:"rpe",     hide:true},
                    {field:"noteRessenti", hide:true},
                  ].filter(({hide}) => !isMobile || !hide).map(({field}) => (
                    <ScrollableCell key={field} align="center" style={{padding:"4px",borderRight:`1px solid ${C.border}`}}>
                      <RessentiCell value={a[field]} field={field}
                        onClick={(rect) => setRessentiPop({ actId: a.id, field, anchorRect: rect })}/>
                    </ScrollableCell>
                  ))}
                  {/* Suppression */}
                  <ScrollableCell align="center" style={{padding:"8px 4px"}}>
                    <button onClick={()=>delAct(a.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:11,padding:0}}>✕</button>
                  </ScrollableCell>
                </ScrollableRow>
              );
            })}
          </ScrollableTable>
        );
      })()}
      <LinkModal linkAct={linkAct} seances={seances} setSeances={setSeances} onClose={()=>setLinkAct(null)}/>
      <RessentiPopover pop={ressentiPop} activites={activites} updAct={updAct} onClose={()=>setRessentiPop(null)}/>
    </div>
  );
}

// ─── RESSENTI : SCALES & POPOVER ──────────────────────────────────────────────
const RESSENTI_SCALES = {
  forme:   { label:"Forme",    emojis:["😩","😕","😐","🙂","😄"], legend:["Cassé","Faible","Normal","Bien","Frais"] },
  plaisir: { label:"Plaisir",  emojis:["😖","😒","😐","😊","🤩"], legend:["Subi","Mitigé","OK","Bon","Kiffé"] },
  rpe:     { label:"Difficulté perçue", emojis:["🟢","🟡","🟠","🔴","🟣"], legend:["Très facile","Facile","Modéré","Dur","Max"] },
};

function RessentiCell({ value, field, onClick }) {
  const isNote = field === "noteRessenti";
  const handle = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onClick(rect);
  };
  if (isNote) {
    const hasNote = value && value.trim().length > 0;
    return (
      <button onClick={handle} title={hasNote ? value : "Ajouter une note"}
        style={{background:"none",border:"none",cursor:"pointer",fontSize:14,padding:"4px 6px",
          color:hasNote?C.forest:C.muted,opacity:hasNote?1:0.4}}>
        {hasNote ? "✎" : "+"}
      </button>
    );
  }
  const scale = RESSENTI_SCALES[field];
  if (value != null && value >= 1 && value <= 5) {
    return (
      <button onClick={handle} title={scale.legend[value-1]}
        style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"2px 4px",lineHeight:1}}>
        {scale.emojis[value-1]}
      </button>
    );
  }
  return (
    <button onClick={handle} title={`Saisir ${scale.label.toLowerCase()}`}
      style={{background:"none",border:"none",cursor:"pointer",fontSize:14,padding:"4px 6px",color:C.muted,opacity:0.4}}>
      +
    </button>
  );
}

function RessentiPopover({ pop, activites, updAct, onClose }) {
  if (!pop) return null;
  const act = activites.find(a => a.id === pop.actId);
  if (!act) return null;
  const { field, anchorRect } = pop;
  const isNote = field === "noteRessenti";
  const scale = RESSENTI_SCALES[field];

  // Position : ancré à gauche de la cellule (s'ouvre vers le centre du tableau).
  // Si pas la place à gauche (cellule trop près du bord gauche de la fenêtre),
  // on bascule à droite. On centre verticalement sur la cellule.
  const popW = isNote ? 280 : 280;
  const popH = isNote ? 140 : 70;
  const margin = 8;
  let left = anchorRect.left - popW - margin;
  if (left < 10) left = anchorRect.right + margin; // fallback à droite
  let top = anchorRect.top + anchorRect.height/2 - popH/2;
  if (top < 10) top = 10;
  if (top + popH > window.innerHeight - 10) top = window.innerHeight - popH - 10;

  const setVal = (v) => { updAct(act.id, field, v); onClose(); };
  const clear = () => { updAct(act.id, field, isNote ? "" : null); onClose(); };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:9998,background:"transparent"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        position:"fixed", left, top, width:popW,
        background:C.white, borderRadius:12, border:`1px solid ${C.border}`,
        boxShadow:"0 8px 24px rgba(0,0,0,0.12)", padding:"12px 14px"
      }}>
        <div style={{fontSize:11,fontWeight:600,color:C.inkLight,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>
          {isNote ? "Note ressenti" : scale.label}
        </div>
        {isNote ? (
          <NoteEditor initial={act.noteRessenti||""} onSave={setVal} onClear={clear}/>
        ) : (
          <div style={{display:"flex",gap:6,justifyContent:"space-between"}}>
            {scale.emojis.map((emoji, i) => {
              const v = i+1;
              const selected = act[field] === v;
              return (
                <button key={v} onClick={()=>setVal(v)} title={scale.legend[i]}
                  style={{flex:1,fontSize:22,padding:"6px 4px",border:`1px solid ${selected?C.forest:C.border}`,
                    borderRadius:8,background:selected?C.forestPale:C.bg,cursor:"pointer",lineHeight:1}}>
                  {emoji}
                </button>
              );
            })}
          </div>
        )}
        {!isNote && act[field] != null && (
          <button onClick={clear} style={{marginTop:8,fontSize:11,color:C.muted,background:"none",
            border:"none",cursor:"pointer",padding:0,textDecoration:"underline"}}>Effacer</button>
        )}
      </div>
    </div>
  );
}

function NoteEditor({ initial, onSave, onClear }) {
  const [text, setText] = useState(initial);
  return (
    <div>
      <textarea value={text} onChange={e=>setText(e.target.value)} autoFocus
        placeholder="1-2 phrases sur ce que tu as ressenti…" maxLength={500}
        style={{width:"100%",minHeight:70,padding:"8px",fontSize:12,border:`1px solid ${C.border}`,
          borderRadius:6,fontFamily:"inherit",resize:"vertical",background:C.bg}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,gap:8}}>
        <button onClick={onClear} style={{fontSize:11,color:C.muted,background:"none",border:"none",
          cursor:"pointer",padding:0,textDecoration:"underline"}}>Effacer</button>
        <button onClick={()=>onSave(text)} style={{fontSize:11,padding:"5px 12px",background:C.forest,
          color:C.white,border:"none",borderRadius:6,cursor:"pointer",fontWeight:500}}>Valider</button>
      </div>
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
