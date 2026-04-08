import React, { useState, useMemo, useRef } from "react";
import { CS as C, isRunning, fmtDate, localDate, exportJSON } from "../../constants.js";
import { Btn, Modal, Field, ConfirmDialog } from "../../atoms.jsx";
import { CIQUAL, CIQUAL_CATEGORIES } from "../../data/ciqual.js";
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
  const [ciqualSearch,  setCiqualSearch]  = useState("");
  const [ciqualCat,     setCiqualCat]     = useState("Toutes");
  const [ciqualModal,   setCiqualModal]   = useState(false);

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
         {[{id:"produits",label:`Produits (${produits.length})`},{id:"ciqual",label:"Base alimentaire"},{id:"recettes",label:`Recettes (${recettes.length})`},{id:"historique",label:"Historique entraînements"}].map(t=>(
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

            {tab==="ciqual"&&(
        <div>
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            <input value={ciqualSearch} onChange={e=>setCiqualSearch(e.target.value)}
              placeholder="Rechercher un aliment (ex: banane, riz, saumon)..."
              style={{...inp,flex:1,minWidth:200}}/>
            <select value={ciqualCat} onChange={e=>setCiqualCat(e.target.value)}
              style={{...inp,width:"auto",minWidth:160}}>
              <option>Toutes</option>
              {CIQUAL_CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          {(()=>{
            const q = ciqualSearch.toLowerCase();
            const filtered = CIQUAL.filter(a=>
              (ciqualCat==="Toutes"||a.c===ciqualCat) &&
              (!q || a.n.toLowerCase().includes(q) || a.c.toLowerCase().includes(q))
            ).slice(0,80);
            return (
              <div style={{...card,overflow:"hidden"}}>
                <div style={{padding:"8px 16px",background:C.stone,
                  display:"grid",gridTemplateColumns:"1fr 70px 70px 70px 70px 70px 70px 100px",gap:8,
                  fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>
                  <span>Aliment</span>
                  <span style={{textAlign:"right"}}>Kcal</span>
                  <span style={{textAlign:"right"}}>Gluc.</span>
                  <span style={{textAlign:"right"}}>Prot.</span>
                  <span style={{textAlign:"right"}}>Lip.</span>
                  <span style={{textAlign:"right"}}>Fibres</span>
                  <span style={{textAlign:"right"}}>Na(mg)</span>
                  <span/>
                </div>
                <div style={{maxHeight:520,overflowY:"auto"}}>
                  {filtered.length===0?(
                    <div style={{padding:"32px 16px",textAlign:"center",color:C.muted,fontSize:13}}>Aucun aliment trouvé</div>
                  ):filtered.map((a,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 70px 70px 70px 70px 100px",
                      padding:"8px 16px",borderTop:`1px solid ${C.border}`,gap:8,alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>{a.n}</div>
                        <div style={{fontSize:11,color:C.muted}}>{a.c} · pour 100g</div>
                      </div>
                      {[a.e,a.g,a.p,a.l,a.f,a.na].map((v,j)=>(
                        <span key={j} style={{fontFamily:"'DM Mono',monospace",fontSize:12,
                          textAlign:"right",color:[MACROS[0]?.color,MACROS[1]?.color,MACROS[2]?.color,MACROS[3]?.color,C.forest,C.muted][j],fontWeight:500}}>
                          {v||"—"}
                        </span>
                      ))}
                      <button onClick={()=>{
                        setProduits(pp=>[...pp,{
                          id:Date.now()+Math.random(),
                          nom:a.n, categorie:a.c,
                          kcal:a.e, glucides:a.g, proteines:a.p, lipides:a.l,
                          sodium:a.na, potassium:a.k, magnesium:a.mg,
                          notes:`CIQUAL 2020 · pour 100g`
                        }]);
                      }} style={{fontSize:12,padding:"4px 10px",borderRadius:6,
                        background:C.forestPale,color:C.forest,border:`1px solid ${C.forest}30`,
                        cursor:"pointer",fontFamily:"inherit",fontWeight:500,whiteSpace:"nowrap"}}>
                        + Ajouter
                      </button>
                    </div>
                  ))}
                </div>
                {filtered.length===80&&(
                  <div style={{padding:"8px 16px",fontSize:11,color:C.muted,borderTop:`1px solid ${C.border}`}}>
                    Affichage limité à 80 résultats — affine ta recherche
                  </div>
                )}
              </div>
            );
          })()}
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


export { JournalNutri, Nutrition };
