import React, { useState, useMemo, useRef } from "react";
import { C, isRunning, fmtDate, localDate, exportJSON } from "../constants.js";
import { Btn, Modal, Field, ConfirmDialog } from "../atoms.jsx";
import { CIQUAL, CIQUAL_CATEGORIES } from "../data/ciqual.js";

// ─── JOURNAL NUTRITIONNEL (inchangé)
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
                <div key={j.id} style={{display:"grid",gridTemplateColumns:"110px 1fr 1fr 90px 1fr 1fr 1fr 1fr 32px",
                  padding:"10px 16px",gap:8,borderBottom:`1px solid ${C.border}`,alignItems:"center",fontSize:13}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.inkLight}}>{fmtDate(j.date)}</span>
                  {COLS_KCAL.map(({k,col})=><span key={k} style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:col,fontWeight:500}}>{j[k]||"—"}</span>)}
                  <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:500,color:deltaColor}}>
                    {hasDelta?(delta>0?"+":"")+delta:"—"}
                  </span>
                  {COLS_MACRO.map(({k,col})=><span key={k} style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:col}}>{j[k]||"—"}</span>)}
                  <span style={{fontSize:12,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={j.notes||""}>{j.notes||""}</span>
                  <div style={{display:"flex",gap:2}}>
                    <button onClick={()=>openEdit(j)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.forest}}>✎</button>
                    <button onClick={()=>setConfirmId(j.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.red}}>🗑</button>
                  </div>
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

// ─── NUTRITION ENTRAÎNEMENT ───────────────────────────────────────────────────
const emptyProduit = () => ({
  id: Date.now()+Math.random(),
  nom: "",
  kcal: "",
  glucides: "",
  proteines: "",
  lipides: "",
  sodium: "",
  potassium: "",
  magnesium: "",
  zinc: "",
  calcium: "",
  categorie: "",
  source: "perso", // "perso" ou "ciqual"
  notes: ""
});

const emptyRecette = () => ({
  id: Date.now()+Math.random(),
  nom: "",
  description: "",
  usage: "Entraînement",
  portions: 1,
  ingredients: [], // {produitId, quantite}
  notes: ""
});

function Nutrition({ produits, setProduits, recettes, setRecettes, seances, setSeances }) {
  const [subTab, setSubTab] = useState("recettes_produits"); // recettes_produits | historique

  // ── RECETTES & PRODUITS ──
  const [viewMode, setViewMode] = useState("recettes"); // recettes | produits
  const [search, setSearch] = useState("");
  
  // Produits
  const [prodModal, setProdModal] = useState(false);
  const [prodForm, setProdForm] = useState(emptyProduit());
  const [editProdId, setEditProdId] = useState(null);
  const [confirmProdId, setConfirmProdId] = useState(null);

  // Recettes
  const [recModal, setRecModal] = useState(false);
  const [recForm, setRecForm] = useState(emptyRecette());
  const [editRecId, setEditRecId] = useState(null);
  const [confirmRecId, setConfirmRecId] = useState(null);

  // Recherche CIQUAL pour produits
  const [ciqualSearch, setCiqualSearch] = useState("");
  const [ciqualCat, setCiqualCat] = useState("Toutes");
  const [ciqualModal, setCiqualModal] = useState(false);

  // Recherche CIQUAL pour ingrédients recette (nouveau)
  const [ingCiqualModal, setIngCiqualModal] = useState(false);
  const [ingCiqualSearch, setIngCiqualSearch] = useState("");
  const [ingCiqualCat, setIngCiqualCat] = useState("Toutes");

  const updP = (k,v) => setProdForm(f=>({...f,[k]:v}));
  const updR = (k,v) => setRecForm(f=>({...f,[k]:v}));

  // ── CRUD Produits ──
  const openNewProd = () => {
    setEditProdId(null);
    setProdForm(emptyProduit());
    setProdModal(true);
  };
  const openEditProd = (p) => {
    setEditProdId(p.id);
    setProdForm({...emptyProduit(), ...p});
    setProdModal(true);
  };
  const saveProduit = () => {
    if(!prodForm.nom.trim()) return;
    const item = {
      ...prodForm,
      id: editProdId || Date.now()+Math.random(),
      type: "produit",
      kcal: parseFloat(prodForm.kcal)||0,
      glucides: parseFloat(prodForm.glucides)||0,
      proteines: parseFloat(prodForm.proteines)||0,
      lipides: parseFloat(prodForm.lipides)||0,
      sodium: parseFloat(prodForm.sodium)||0,
      potassium: parseFloat(prodForm.potassium)||0,
      magnesium: parseFloat(prodForm.magnesium)||0,
      zinc: parseFloat(prodForm.zinc)||0,
      calcium: parseFloat(prodForm.calcium)||0
    };
    if(editProdId) setProduits(pp=>pp.map(p=>p.id===editProdId?item:p));
    else setProduits(pp=>[...pp,item]);
    setProdModal(false);
  };
  const delProduit = (id) => {
    setProduits(pp=>pp.filter(p=>p.id!==id));
    setConfirmProdId(null);
  };

  // Ajout produit depuis CIQUAL (modal produits)
  const addFromCiqual = (alim) => {
    const newProd = {
      id: Date.now()+Math.random(),
      type: "produit",
      nom: alim.n,
      kcal: alim.e || 0,
      glucides: alim.g || 0,
      proteines: alim.p || 0,
      lipides: alim.l || 0,
      sodium: alim.na || 0,
      potassium: alim.k || 0,
      magnesium: alim.mg || 0,
      zinc: 0,
      calcium: 0,
      categorie: alim.c || "",
      source: "ciqual",
      notes: `Ajouté depuis CIQUAL`
    };
    setProduits(pp=>[...pp, newProd]);
    setCiqualModal(false);
    setCiqualSearch("");
  };

  // ── CRUD Recettes ──
  const openNewRec = () => {
    setEditRecId(null);
    setRecForm(emptyRecette());
    setRecModal(true);
  };
  const openEditRec = (r) => {
    setEditRecId(r.id);
    setRecForm({...emptyRecette(), ...r});
    setRecModal(true);
  };
  const saveRecette = () => {
    if(!recForm.nom.trim()) return;
    const item = {
      ...recForm,
      id: editRecId || Date.now()+Math.random(),
      portions: parseInt(recForm.portions)||1
    };
    if(editRecId) setRecettes(rr=>rr.map(r=>r.id===editRecId?item:r));
    else setRecettes(rr=>[...rr,item]);
    setRecModal(false);
  };
  const delRecette = (id) => {
    setRecettes(rr=>rr.filter(r=>r.id!==id));
    setConfirmRecId(null);
  };

  // Ajouter ingrédient dans recette depuis base perso
  const addIngredientFromProduit = (produitId) => {
    const exists = recForm.ingredients.find(i=>i.produitId===produitId);
    if(exists) return; // déjà présent
    setRecForm(f=>({
      ...f,
      ingredients: [...f.ingredients, {produitId, quantite: 100}] // 100g par défaut
    }));
  };

  // Ajouter ingrédient depuis CIQUAL (crée produit temp + ajoute à recette)
  const addIngredientFromCiqual = (alim) => {
    // Créer produit temporaire dans la liste produits
    const newProd = {
      id: Date.now()+Math.random(),
      type: "produit",
      nom: alim.n,
      kcal: alim.e || 0,
      glucides: alim.g || 0,
      proteines: alim.p || 0,
      lipides: alim.l || 0,
      sodium: alim.na || 0,
      potassium: alim.k || 0,
      magnesium: alim.mg || 0,
      zinc: 0,
      calcium: 0,
      categorie: alim.c || "",
      source: "ciqual",
      notes: `Ajouté depuis CIQUAL`
    };
    setProduits(pp=>[...pp, newProd]);
    
    // Ajouter à la recette
    setRecForm(f=>({
      ...f,
      ingredients: [...f.ingredients, {produitId: newProd.id, quantite: 100}]
    }));
    
    setIngCiqualModal(false);
    setIngCiqualSearch("");
  };

  const removeIngredient = (idx) => {
    setRecForm(f=>({
      ...f,
      ingredients: f.ingredients.filter((_, i)=>i!==idx)
    }));
  };

  const updateIngredientQte = (idx, qte) => {
    setRecForm(f=>({
      ...f,
      ingredients: f.ingredients.map((ing, i)=>i===idx?{...ing, quantite: parseFloat(qte)||0}:ing)
    }));
  };

  // Calcul macros recette
  const calcMacros = (rec) => {
    return (rec.ingredients||[]).reduce((acc, ing)=>{
      const prod = produits.find(p=>p.id===ing.produitId);
      if(!prod) return acc;
      const factor = parseFloat(ing.quantite)||0;
      return {
        kcal: acc.kcal + Math.round((prod.kcal||0)*factor/100),
        glucides: acc.glucides + Math.round((prod.glucides||0)*factor/100),
        proteines: acc.proteines + Math.round((prod.proteines||0)*factor/100),
        lipides: acc.lipides + Math.round((prod.lipides||0)*factor/100),
        sodium: acc.sodium + Math.round((prod.sodium||0)*factor/100)
      };
    }, {kcal:0, glucides:0, proteines:0, lipides:0, sodium:0});
  };

  // Filtres recherche CIQUAL (modal produits)
  const filteredCiqual = useMemo(()=>{
    let results = CIQUAL;
    if(ciqualCat!=="Toutes") results = results.filter(a=>a.c===ciqualCat);
    if(ciqualSearch.trim()) {
      const terms = ciqualSearch.toLowerCase().split(" ").filter(Boolean);
      results = results.filter(a=>
        terms.every(t=>(a.n||"").toLowerCase().includes(t))
      );
    }
    return results.slice(0, 50); // Limite 50 résultats
  }, [ciqualSearch, ciqualCat]);

  // Filtres recherche CIQUAL ingrédients (modal recette)
  const filteredIngCiqual = useMemo(()=>{
    let results = CIQUAL;
    if(ingCiqualCat!=="Toutes") results = results.filter(a=>a.c===ingCiqualCat);
    if(ingCiqualSearch.trim()) {
      const terms = ingCiqualSearch.toLowerCase().split(" ").filter(Boolean);
      results = results.filter(a=>
        terms.every(t=>(a.n||"").toLowerCase().includes(t))
      );
    }
    return results.slice(0, 50);
  }, [ingCiqualSearch, ingCiqualCat]);

  // Filtres produits/recettes
  const filteredProduits = useMemo(()=>{
    if(!search) return produits;
    return produits.filter(p=>
      (p.nom||"").toLowerCase().includes(search.toLowerCase()) ||
      (p.categorie||"").toLowerCase().includes(search.toLowerCase())
    );
  }, [produits, search]);

  const filteredRecettes = useMemo(()=>{
    if(!search) return recettes;
    return recettes.filter(r=>
      (r.nom||"").toLowerCase().includes(search.toLowerCase()) ||
      (r.description||"").toLowerCase().includes(search.toLowerCase())
    );
  }, [recettes, search]);

  // ── HISTORIQUE ENTRAÎNEMENTS ──
  const seancesEff = useMemo(()=>
    [...seances].filter(s=>s.statut==="Effectué"&&isRunning(s.activite))
      .sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,50)
  , [seances]);

  const linkRecetteToSeance = (seanceId, recetteId) => {
    setSeances(ss=>ss.map(s=>s.id===seanceId?{...s,recetteId}:s));
  };
  const unlinkRecette = (seanceId) => {
    setSeances(ss=>ss.map(s=>s.id===seanceId?{...s,recetteId:undefined}:s));
  };

  const card = {background:C.white,border:`1px solid ${C.border}`,borderRadius:12};
  const lbl = {fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted};
  const inp = {fontSize:13,padding:"6px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,width:"100%"};

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Nutrition entraînement</h1>
          <p style={{fontSize:12,color:C.muted}}>Recettes personnalisées · Produits · Base alimentaire CIQUAL · Historique</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,marginBottom:20}}>
        {[
          {id:"recettes_produits", label:"Recettes & Produits"},
          {id:"historique", label:"Historique entraînements"}
        ].map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{background:"none",border:"none",padding:"8px 16px",cursor:"pointer",fontSize:13,
              fontWeight:subTab===t.id?500:400,color:subTab===t.id?C.forest:C.muted,
              borderBottom:subTab===t.id?`2px solid ${C.forest}`:"2px solid transparent",
              marginBottom:-1,fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RECETTES & PRODUITS ── */}
      {subTab==="recettes_produits"&&(
        <div>
          {/* Toggle Recettes/Produits */}
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <Btn variant={viewMode==="recettes"?"default":"ghost"} onClick={()=>setViewMode("recettes")}>
              Recettes ({recettes.length})
            </Btn>
            <Btn variant={viewMode==="produits"?"default":"ghost"} onClick={()=>setViewMode("produits")}>
              Produits ({produits.length})
            </Btn>
          </div>

          {/* Barre actions */}
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder={viewMode==="recettes"?"Rechercher une recette...":"Rechercher un produit..."}
              style={{...inp,flex:1,minWidth:200}}
            />
            {viewMode==="recettes"&&<Btn onClick={openNewRec}>＋ Recette</Btn>}
            {viewMode==="produits"&&(
              <>
                <Btn onClick={openNewProd}>＋ Produit perso</Btn>
                <Btn variant="sage" onClick={()=>setCiqualModal(true)}>🔍 Base alimentaire</Btn>
              </>
            )}
          </div>

          {/* Liste Recettes */}
          {viewMode==="recettes"&&(
            filteredRecettes.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>🍽️</div>
                <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Aucune recette</div>
                <div style={{fontSize:13,marginBottom:20}}>Crée tes recettes pour tes entraînements</div>
                <Btn onClick={openNewRec}>＋ Créer une recette</Btn>
              </div>
            ):(
              <div style={{display:"grid",gap:12}}>
                {filteredRecettes.map(r=>{
                  const macros = calcMacros(r);
                  return (
                    <div key={r.id} style={{...card,padding:16}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:8}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:15,fontWeight:500,color:C.inkLight,marginBottom:2}}>{r.nom}</div>
                          <div style={{fontSize:12,color:C.muted}}>{r.description||"—"}</div>
                        </div>
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={()=>openEditRec(r)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.forest}}>✎</button>
                          <button onClick={()=>setConfirmRecId(r.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.red}}>🗑</button>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:12,fontSize:12,color:C.muted,marginBottom:8}}>
                        <span>Portions: {r.portions}</span>
                        <span>•</span>
                        <span>Ingrédients: {r.ingredients.length}</span>
                      </div>
                      <div style={{display:"flex",gap:12,fontSize:12}}>
                        <span style={{color:"#e65100",fontWeight:500}}>{macros.kcal} kcal</span>
                        <span style={{color:"#1d9e75"}}>{macros.glucides}g gluc.</span>
                        <span style={{color:"#185FA5"}}>{macros.proteines}g prot.</span>
                        <span style={{color:"#7F77DD"}}>{macros.lipides}g lip.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Liste Produits */}
          {viewMode==="produits"&&(
            (() => {
              const produitsOnly = filteredProduits.filter(p => !p.type || p.type === "produit");
              return produitsOnly.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>🥕</div>
                <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Aucun produit</div>
                <div style={{fontSize:13,marginBottom:20}}>Ajoute des produits depuis la base alimentaire ou crée les tiens</div>
                <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                  <Btn onClick={openNewProd}>＋ Produit perso</Btn>
                  <Btn variant="sage" onClick={()=>setCiqualModal(true)}>🔍 Base alimentaire</Btn>
                </div>
              </div>
            ):(
              <div style={{...card,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 70px 70px 70px 70px 70px 70px 70px 100px 32px",
                  padding:"8px 16px",background:C.stone,gap:8,fontSize:10,fontWeight:600,color:C.muted,
                  textTransform:"uppercase",letterSpacing:"0.04em"}}>
                  <span>Nom</span>
                  <span style={{textAlign:"right"}}>Kcal</span>
                  <span style={{textAlign:"right"}}>Gluc.</span>
                  <span style={{textAlign:"right"}}>Prot.</span>
                  <span style={{textAlign:"right"}}>Lip.</span>
                  <span style={{textAlign:"right"}}>Na</span>
                  <span style={{textAlign:"right"}}>K</span>
                  <span style={{textAlign:"right"}}>Mg</span>
                  <span style={{textAlign:"right"}}>Zn</span>
                  <span style={{textAlign:"right"}}>Ca</span>
                  <span>Source</span>
                  <span/>
                </div>
                <div style={{maxHeight:520,overflowY:"auto"}}>
                  {produitsOnly.map(p=>(
                    <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 70px 70px 70px 70px 70px 70px 70px 100px 32px",
                      padding:"10px 16px",gap:8,borderBottom:`1px solid ${C.border}`,alignItems:"center",fontSize:13}}>
                      <div>
                        <div style={{fontWeight:500,color:C.inkLight}}>{p.nom}</div>
                        {p.categorie&&<div style={{fontSize:11,color:C.muted}}>{p.categorie}</div>}
                      </div>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#e65100"}}>{p.kcal||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#1d9e75"}}>{p.glucides||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#185FA5"}}>{p.proteines||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#7F77DD"}}>{p.lipides||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#BA7517",fontSize:11}}>{p.sodium||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:11}}>{p.potassium||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:11}}>{p.magnesium||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:11}}>{p.zinc||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:11}}>{p.calcium||0}</span>
                      <span style={{fontSize:11,color:C.muted}}>{p.source==="ciqual"?"CIQUAL":"Perso"}</span>
                      <div style={{display:"flex",gap:2}}>
                        <button onClick={()=>openEditProd(p)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.forest}}>✎</button>
                        <button onClick={()=>setConfirmProdId(p.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.red}}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
            })()
          )}
        </div>
      )}

      {/* ── HISTORIQUE ENTRAÎNEMENTS ── */}
      {subTab==="historique"&&(
        seancesEff.length===0?(
          <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>🏃</div>
            <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Aucune séance</div>
            <div style={{fontSize:13}}>Tes séances d'entraînement effectuées apparaîtront ici</div>
          </div>
        ):(
          <div style={{...card,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"100px 1fr 100px 100px 1fr",
              padding:"8px 16px",background:C.stone,gap:8,fontSize:10,fontWeight:600,color:C.muted,
              textTransform:"uppercase",letterSpacing:"0.04em"}}>
              <span>Date</span>
              <span>Activité</span>
              <span style={{textAlign:"right"}}>Durée</span>
              <span style={{textAlign:"right"}}>Distance</span>
              <span>Recette liée</span>
            </div>
            <div style={{maxHeight:520,overflowY:"auto"}}>
              {seancesEff.map(s=>{
                const linkedRec = recettes.find(r=>r.id===s.recetteId);
                return (
                  <div key={s.id} style={{display:"grid",gridTemplateColumns:"100px 1fr 100px 100px 1fr",
                    padding:"10px 16px",gap:8,borderBottom:`1px solid ${C.border}`,alignItems:"center",fontSize:13}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.inkLight}}>{fmtDate(s.date)}</span>
                    <span style={{fontWeight:500,color:C.inkLight}}>{s.activite}</span>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{s.duree_obj||"—"}</span>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{s.distance_obj?s.distance_obj+"km":"—"}</span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {linkedRec?(
                        <>
                          <span style={{fontSize:12,color:C.forest}}>{linkedRec.nom}</span>
                          <button onClick={()=>unlinkRecette(s.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.red}}>✕</button>
                        </>
                      ):(
                        <select value="" onChange={e=>e.target.value&&linkRecetteToSeance(s.id, e.target.value)}
                          style={{fontSize:12,padding:"4px 8px",borderRadius:6,border:`1px solid ${C.border}`,cursor:"pointer"}}>
                          <option value="">Lier une recette...</option>
                          {recettes.map(r=><option key={r.id} value={r.id}>{r.nom}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* ── MODAL PRODUIT ── */}
      <Modal open={prodModal} onClose={()=>setProdModal(false)} title={editProdId?"Modifier le produit":"Nouveau produit"} width={600}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Nom" full>
            <input value={prodForm.nom} onChange={e=>updP("nom",e.target.value)} placeholder="ex: Banane" style={{width:"100%"}}/>
          </Field>
          <Field label="Catégorie" full>
            <input value={prodForm.categorie} onChange={e=>updP("categorie",e.target.value)} placeholder="ex: Fruits" style={{width:"100%"}}/>
          </Field>
          <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
            {[
              {k:"kcal",label:"Kcal",unit:"kcal"},
              {k:"glucides",label:"Glucides",unit:"g"},
              {k:"proteines",label:"Protéines",unit:"g"},
              {k:"lipides",label:"Lipides",unit:"g"},
              {k:"sodium",label:"Sodium",unit:"mg"}
            ].map(({k,label,unit})=>(
              <Field key={k} label={`${label} (${unit})`}>
                <input type="number" min="0" step="0.1" value={prodForm[k]||""} onChange={e=>updP(k,e.target.value)} style={{width:"100%"}}/>
              </Field>
            ))}
          </div>
          <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[
              {k:"potassium",label:"Potassium",unit:"mg"},
              {k:"magnesium",label:"Magnésium",unit:"mg"},
              {k:"zinc",label:"Zinc",unit:"mg"},
              {k:"calcium",label:"Calcium",unit:"mg"}
            ].map(({k,label,unit})=>(
              <Field key={k} label={`${label} (${unit})`}>
                <input type="number" min="0" step="0.1" value={prodForm[k]||""} onChange={e=>updP(k,e.target.value)} style={{width:"100%"}}/>
              </Field>
            ))}
          </div>
          <Field label="Notes" full>
            <textarea value={prodForm.notes||""} onChange={e=>updP("notes",e.target.value)} placeholder="Remarques..." style={{width:"100%",minHeight:60}}/>
          </Field>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setProdModal(false)}>Annuler</Btn>
          <Btn onClick={saveProduit}>{editProdId?"Enregistrer":"Ajouter"}</Btn>
        </div>
      </Modal>

      {/* ── MODAL RECETTE ── */}
      <Modal open={recModal} onClose={()=>setRecModal(false)} title={editRecId?"Modifier la recette":"Nouvelle recette"} width={700}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <Field label="Nom" full>
            <input value={recForm.nom} onChange={e=>updR("nom",e.target.value)} placeholder="ex: Energy balls" style={{width:"100%"}}/>
          </Field>
          <Field label="Portions">
            <input type="number" min="1" value={recForm.portions} onChange={e=>updR("portions",e.target.value)} style={{width:"100%"}}/>
          </Field>
          <Field label="Description" full>
            <textarea value={recForm.description||""} onChange={e=>updR("description",e.target.value)} placeholder="Courte description..." style={{width:"100%",minHeight:50}}/>
          </Field>
        </div>

        {/* Ingrédients */}
        <div style={{marginBottom:16}}>
          <div style={{...lbl,marginBottom:8}}>Ingrédients</div>
          {recForm.ingredients.length===0?(
            <div style={{textAlign:"center",padding:"20px",background:C.stone,borderRadius:8,color:C.muted,fontSize:13}}>
              Aucun ingrédient ajouté
            </div>
          ):(
            <div style={{display:"grid",gap:6}}>
              {recForm.ingredients.map((ing,idx)=>{
                const prod = produits.find(p=>p.id===ing.produitId);
                return (
                  <div key={idx} style={{display:"flex",gap:8,alignItems:"center",padding:8,background:C.stone,borderRadius:6}}>
                    <span style={{flex:1,fontSize:13,color:C.inkLight}}>{prod?.nom||"Produit inconnu"}</span>
                    <input type="number" min="0" step="1" value={ing.quantite} onChange={e=>updateIngredientQte(idx,e.target.value)}
                      style={{width:80,padding:"4px 8px",fontSize:12,borderRadius:6,border:`1px solid ${C.border}`,textAlign:"right"}}/>
                    <span style={{fontSize:12,color:C.muted}}>g</span>
                    <button onClick={()=>removeIngredient(idx)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.red}}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <select value="" onChange={e=>{if(e.target.value)addIngredientFromProduit(e.target.value)}}
              style={{flex:1,padding:"6px 10px",fontSize:13,borderRadius:7,border:`1px solid ${C.border}`,cursor:"pointer"}}>
              <option value="">+ Ingrédient depuis mes produits...</option>
              {produits.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
            <Btn variant="sage" size="sm" onClick={()=>setIngCiqualModal(true)}>🔍 Base alimentaire</Btn>
          </div>
        </div>

        {/* Macros totales */}
        {recForm.ingredients.length>0&&(()=>{
          const macros = calcMacros(recForm);
          return (
            <div style={{padding:12,background:C.stone,borderRadius:8,marginBottom:16}}>
              <div style={{...lbl,marginBottom:6}}>Total recette</div>
              <div style={{display:"flex",gap:12,fontSize:13}}>
                <span style={{color:"#e65100",fontWeight:500}}>{macros.kcal} kcal</span>
                <span style={{color:"#1d9e75"}}>{macros.glucides}g gluc.</span>
                <span style={{color:"#185FA5"}}>{macros.proteines}g prot.</span>
                <span style={{color:"#7F77DD"}}>{macros.lipides}g lip.</span>
              </div>
            </div>
          );
        })()}

        <Field label="Notes">
          <textarea value={recForm.notes||""} onChange={e=>updR("notes",e.target.value)} placeholder="Instructions, remarques..." style={{width:"100%",minHeight:60}}/>
        </Field>

        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setRecModal(false)}>Annuler</Btn>
          <Btn onClick={saveRecette}>{editRecId?"Enregistrer":"Créer"}</Btn>
        </div>
      </Modal>

      {/* ── MODAL CIQUAL PRODUITS ── */}
      <Modal open={ciqualModal} onClose={()=>setCiqualModal(false)} title="Base alimentaire CIQUAL" width={800}>
        <div style={{marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:12}}>
            <input value={ciqualSearch} onChange={e=>setCiqualSearch(e.target.value)}
              placeholder="Rechercher un aliment..."
              style={{...inp}}/>
            <select value={ciqualCat} onChange={e=>setCiqualCat(e.target.value)}
              style={{padding:"6px 12px",fontSize:13,borderRadius:7,border:`1px solid ${C.border}`,minWidth:180}}>
              <option value="Toutes">Toutes catégories</option>
              {CIQUAL_CATEGORIES.map(cat=><option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div style={{fontSize:12,color:C.muted}}>
            {filteredCiqual.length} résultat{filteredCiqual.length>1?"s":""} {filteredCiqual.length===50&&"(max 50)"}
          </div>
        </div>
        <div style={{maxHeight:400,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:8}}>
          {filteredCiqual.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>Aucun résultat</div>
          ):(
            filteredCiqual.map(alim=>(
              <div key={alim.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"10px 14px",borderBottom:`1px solid ${C.border}`,gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:500,color:C.inkLight,marginBottom:2}}>{alim.n}</div>
                  <div style={{fontSize:11,color:C.muted}}>{alim.c}</div>
                  <div style={{display:"flex",gap:10,fontSize:11,marginTop:4}}>
                    <span style={{color:"#e65100"}}>{Math.round(alim.e||0)} kcal</span>
                    <span style={{color:"#1d9e75"}}>{(alim.g||0).toFixed(1)}g gluc.</span>
                    <span style={{color:"#185FA5"}}>{(alim.p||0).toFixed(1)}g prot.</span>
                    <span style={{color:"#7F77DD"}}>{(alim.l||0).toFixed(1)}g lip.</span>
                    <span style={{color:C.muted,fontSize:10}}>{Math.round(alim.k||0)}mg K · {Math.round(alim.mg||0)}mg Mg</span>
                  </div>
                </div>
                <Btn size="sm" onClick={()=>addFromCiqual(alim)}>＋ Ajouter</Btn>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* ── MODAL CIQUAL INGRÉDIENTS (recette) ── */}
      <Modal open={ingCiqualModal} onClose={()=>setIngCiqualModal(false)} title="Ajouter ingrédient depuis CIQUAL" width={800}>
        <div style={{marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:12}}>
            <input value={ingCiqualSearch} onChange={e=>setIngCiqualSearch(e.target.value)}
              placeholder="Rechercher un aliment..."
              style={{...inp}}/>
            <select value={ingCiqualCat} onChange={e=>setIngCiqualCat(e.target.value)}
              style={{padding:"6px 12px",fontSize:13,borderRadius:7,border:`1px solid ${C.border}`,minWidth:180}}>
              <option value="Toutes">Toutes catégories</option>
              {CIQUAL_CATEGORIES.map(cat=><option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div style={{fontSize:12,color:C.muted}}>
            {filteredIngCiqual.length} résultat{filteredIngCiqual.length>1?"s":""} {filteredIngCiqual.length===50&&"(max 50)"}
          </div>
        </div>
        <div style={{maxHeight:400,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:8}}>
          {filteredIngCiqual.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>Aucun résultat</div>
          ):(
            filteredIngCiqual.map(alim=>(
              <div key={alim.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"10px 14px",borderBottom:`1px solid ${C.border}`,gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:500,color:C.inkLight,marginBottom:2}}>{alim.n}</div>
                  <div style={{fontSize:11,color:C.muted}}>{alim.c}</div>
                  <div style={{display:"flex",gap:10,fontSize:11,marginTop:4}}>
                    <span style={{color:"#e65100"}}>{Math.round(alim.e||0)} kcal</span>
                    <span style={{color:"#1d9e75"}}>{(alim.g||0).toFixed(1)}g gluc.</span>
                    <span style={{color:"#185FA5"}}>{(alim.p||0).toFixed(1)}g prot.</span>
                    <span style={{color:"#7F77DD"}}>{(alim.l||0).toFixed(1)}g lip.</span>
                    <span style={{color:C.muted,fontSize:10}}>{Math.round(alim.k||0)}mg K · {Math.round(alim.mg||0)}mg Mg</span>
                  </div>
                </div>
                <Btn size="sm" onClick={()=>addIngredientFromCiqual(alim)}>＋ Ajouter</Btn>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Dialogs confirmation */}
      <ConfirmDialog open={!!confirmProdId} message="Supprimer ce produit ?"
        onConfirm={()=>delProduit(confirmProdId)} onCancel={()=>setConfirmProdId(null)}/>
      <ConfirmDialog open={!!confirmRecId} message="Supprimer cette recette ?"
        onConfirm={()=>delRecette(confirmRecId)} onCancel={()=>setConfirmRecId(null)}/>
    </div>
  );
}

export { JournalNutri, Nutrition };
