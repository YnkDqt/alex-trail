import React, { useState, useRef } from "react";
import { CS as C, exportJSON, lsRead, parseCSVActivities, parseCSVSommeil, parseCSVVFC,
  localDate, fmtDate, daysUntil, actColor, actShort, isRunning,
  DAY_NAMES, DEFAULT_PLANNING, ACTIVITY_TYPES, emptyObjectif, emptySeance } from "../../stride/constants.js";
import { Btn, Field, ConfirmDialog } from "../../stride/atoms.jsx";
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


// ─── TOPBAR ───────────────────────────────────────────────────────────────────

export { Donnees, Parametres, DonneesParams };
