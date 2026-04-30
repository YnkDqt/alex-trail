import React, { useState, useMemo, useRef } from "react";
import { C, isRunning, fmtDate, localDate, exportJSON, TYPES_BOISSON } from "../constants.js";
import { Btn, Modal, Field, ConfirmDialog, PageTitle, ScrollableTable, ScrollableRow, ScrollableCell } from "../atoms.jsx";
import { CIQUAL, CIQUAL_CATEGORIES } from "../data/ciqual.js";
import {
  ProduitForm,
  RecetteForm,
  emptyProduit as emptyProduitNew,
  emptyRecette as emptyRecetteNew,
  normalizeProduit,
  normalizeRecette,
  loadProduitForEdit,
  loadRecetteForEdit,
  inferType
} from "../ProduitRecetteForm.jsx";

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
  const fileRef = useRef();

  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const openNew  = ()  => { setEditId(null);  setForm(emptyJourEntry()); setModal(true); };
  const openEdit = (e) => { setEditId(e.id);  setForm({...emptyJourEntry(),...e}); setModal(true); };

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
        <PageTitle sub="Suivi quotidien · Kcal brûlées vs consommées · Macros">Journal nutritionnel</PageTitle>
        <div style={{display:"flex",gap:8}}>
          <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={handleImport}/>
          <Btn variant="ghost" size="sm" onClick={()=>fileRef.current?.click()}>⬆ Importer JSON</Btn>
          <Btn onClick={openNew}>＋ Entrée</Btn>
        </div>
      </div>

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

      {sorted.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>📊</div>
          <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Aucune entrée</div>
          <div style={{fontSize:13,marginBottom:20}}>Enregistre tes données nutritionnelles quotidiennes</div>
          <Btn onClick={openNew}>＋ Ajouter aujourd'hui</Btn>
        </div>
      ):(() => {
        const NUT_COLS = ["110px","1fr","1fr","90px","1fr","1fr","1fr","1fr","32px"];
        return (
          <ScrollableTable
            columns={NUT_COLS}
            minWidth={900}
            maxHeight={520}
            headerCells={[
              <span key="d">Date</span>,
              ...COLS_KCAL.map(({l})=><span key={l} style={{display:"block",textAlign:"right"}}>{l}</span>),
              <span key="dk" style={{display:"block",textAlign:"right"}}>Delta Kcal</span>,
              ...COLS_MACRO.map(({l})=><span key={l} style={{display:"block",textAlign:"right"}}>{l}</span>),
              <span key="n">Notes</span>,
              <span key="x" />
            ]}
          >
            {sorted.map(j=>{
              const delta = (parseFloat(j.kcalBrulees)||0)-(parseFloat(j.kcalConso)||0);
              const hasDelta = j.kcalBrulees&&j.kcalConso;
              const deltaColor = !hasDelta?C.muted:delta<-100?C.green:delta>100?C.red:C.muted;
              return (
                <ScrollableRow key={j.id}>
                  <ScrollableCell style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.inkLight}}>{fmtDate(j.date)}</ScrollableCell>
                  {COLS_KCAL.map(({k,col})=><ScrollableCell key={k} align="right" style={{fontFamily:"'DM Mono',monospace",color:col,fontWeight:500}}>{j[k]||"—"}</ScrollableCell>)}
                  <ScrollableCell align="right" style={{fontFamily:"'DM Mono',monospace",fontWeight:500,color:deltaColor}}>
                    {hasDelta?(delta>0?"+":"")+delta:"—"}
                  </ScrollableCell>
                  {COLS_MACRO.map(({k,col})=><ScrollableCell key={k} align="right" style={{fontFamily:"'DM Mono',monospace",color:col}}>{j[k]||"—"}</ScrollableCell>)}
                  <ScrollableCell style={{fontSize:12,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={j.notes||""}>{j.notes||""}</ScrollableCell>
                  <ScrollableCell align="center">
                    <div style={{display:"flex",gap:2,justifyContent:"center"}}>
                      <button onClick={()=>openEdit(j)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.forest}}>✎</button>
                      <button onClick={()=>setConfirmId(j.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.red}}>🗑</button>
                    </div>
                  </ScrollableCell>
                </ScrollableRow>
              );
            })}
          </ScrollableTable>
        );
      })()}

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
// Les fonctions emptyProduit/emptyRecette sont importées depuis ProduitRecetteForm.jsx
const emptyProduit = emptyProduitNew;
const emptyRecette = emptyRecetteNew;

function Nutrition({ produits, setProduits, recettes, setRecettes, seances, setSeances, activites = [] }) {
  const [tab, setTab] = useState("bibliotheque"); // bibliotheque | historique
  const [bibFilter, setBibFilter] = useState("tous"); // tous | produits | recettes
  const [search, setSearch] = useState("");
  
  // ── Produits ──
  const [prodModal, setProdModal] = useState(false);
  const [prodForm, setProdForm] = useState(emptyProduit());
  const [prodInputMode, setProdInputMode] = useState("100g"); // state local, non persisté
  const [editProdId, setEditProdId] = useState(null);
  const [confirmProdId, setConfirmProdId] = useState(null);
  const [showProdTypeErr, setShowProdTypeErr] = useState(false);
  
  // Recherche CIQUAL produits
  const [ciqualModal, setCiqualModal] = useState(false);
  const [ciqualSearch, setCiqualSearch] = useState("");
  const [ciqualCat, setCiqualCat] = useState("Toutes");

  // ── Recettes ──
  const [recModal, setRecModal] = useState(false);
  const [recForm, setRecForm] = useState(emptyRecette());
  const [editRecId, setEditRecId] = useState(null);
  const [confirmRecId, setConfirmRecId] = useState(null);
  const [showRecTypeErr, setShowRecTypeErr] = useState(false);
  const [showRecPortionErr, setShowRecPortionErr] = useState(false);

  // Recherche CIQUAL pour ingrédients recette
  const [ingCiqualModal, setIngCiqualModal] = useState(false);
  const [ingCiqualSearch, setIngCiqualSearch] = useState("");
  const [ingCiqualCat, setIngCiqualCat] = useState("Toutes");

  // Modal mes produits pour ingrédients
  const [mesProduitsModal, setMesProduitsModal] = useState(false);
  const [mesProduitsSearch, setMesProduitsSearch] = useState("");

  // Note : updP, updR, removeIngredient, updateIngredientQte ont été retirés
  // car désormais gérés par les composants ProduitForm et RecetteForm importés

  // ── CRUD Produits ──
  const openNewProd = () => {
    setEditProdId(null);
    setProdForm(emptyProduit());
    setProdInputMode("100g");
    setShowProdTypeErr(false);
    setProdModal(true);
  };
  
  const openEditProd = (p) => {
    setEditProdId(p.id);
    setProdForm(loadProduitForEdit(p));
    setProdInputMode("100g");
    setShowProdTypeErr(false);
    setProdModal(true);
  };
  
  const saveProduit = () => {
    if(!prodForm.nom.trim()) return;
    if(!prodForm.type) { setShowProdTypeErr(true); return; }
    const normalized = normalizeProduit(prodForm, prodInputMode);
    const item = { ...normalized, id: editProdId || Date.now()+Math.random() };
    if(editProdId) setProduits(pp=>pp.map(p=>p.id===editProdId?item:p));
    else setProduits(pp=>[...pp,item]);
    setShowProdTypeErr(false);
    setProdModal(false);
  };
  
  const delProduit = (id) => {
    setProduits(pp=>pp.filter(p=>p.id!==id));
    setConfirmProdId(null);
  };

  // Ajout depuis CIQUAL
  const addFromCiqual = (alim) => {
    const isBoisson = alim.c && alim.c.toLowerCase().includes("boisson");
    const newProd = {
      ...emptyProduit(),
      id: Date.now()+Math.random(),
      nom: alim.n,
      type: isBoisson ? (alim.n.toLowerCase().includes("eau") ? "Eau pure" : "Boisson énergétique") : "",
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
      boisson: isBoisson,
      notes: ""
    };
    setProduits(pp=>[...pp, newProd]);
    setCiqualModal(false);
    setCiqualSearch("");
  };

  // ── CRUD Recettes ──
  const openNewRec = () => {
    setEditRecId(null);
    setRecForm(emptyRecette());
    setShowRecTypeErr(false);
    setShowRecPortionErr(false);
    setRecModal(true);
  };
  
  const openEditRec = (r) => {
    setEditRecId(r.id);
    setRecForm(loadRecetteForEdit(r));
    setShowRecTypeErr(false);
    setShowRecPortionErr(false);
    setRecModal(true);
  };
  
  const saveRecette = () => {
    if(!recForm.nom.trim()) return;
    if(!recForm.type) { setShowRecTypeErr(true); return; }
    const isBoissonRec = TYPES_BOISSON.includes(recForm.type);
    const portionVal = parseFloat(isBoissonRec ? recForm.volumeMlParPortion : recForm.grammesParPortion) || 0;
    if (portionVal <= 0) { setShowRecPortionErr(true); return; }
    const normalized = normalizeRecette(recForm);
    const item = { ...normalized, id: editRecId || Date.now()+Math.random() };
    if(editRecId) setRecettes(rr=>rr.map(r=>r.id===editRecId?item:r));
    else setRecettes(rr=>[...rr,item]);
    setShowRecTypeErr(false);
    setShowRecPortionErr(false);
    setRecModal(false);
  };
  
  const delRecette = (id) => {
    setRecettes(rr=>rr.filter(r=>r.id!==id));
    setConfirmRecId(null);
  };

  // Ingrédients recette
  const addIngredientFromProduit = (produitId) => {
    const exists = recForm.ingredients.find(i=>i.produitId===produitId);
    if(exists) return;
    setRecForm(f=>({
      ...f,
      ingredients: [...f.ingredients, {produitId, quantite: 100}]
    }));
  };

  const addIngredientFromCiqual = (alim) => {
    // Les ingrédients CIQUAL ne polluent plus la bibliothèque produits.
    // Les données nutritionnelles sont stockées directement dans l'ingrédient.
    setRecForm(f=>({
      ...f,
      ingredients: [...f.ingredients, {
        produitId: "ciqual-" + Date.now() + "-" + Math.random(),
        quantite: 100,
        _ciqualData: {
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
          categorie: alim.c || ""
        }
      }]
    }));
    setIngCiqualModal(false);
    setIngCiqualSearch("");
  };

  // Les fonctions removeIngredient et updateIngredientQte sont maintenant
  // gérées en interne par le composant RecetteForm

  const calcMacros = (rec) => {
    return (rec.ingredients||[]).reduce((acc, ing)=>{
      const data = ing._ciqualData || produits.find(p=>p.id===ing.produitId);
      if(!data) return acc;
      const factor = parseFloat(ing.quantite)||0;
      return {
        kcal: acc.kcal + Math.round((data.kcal||0)*factor/100),
        glucides: acc.glucides + Math.round((data.glucides||0)*factor/100),
        proteines: acc.proteines + Math.round((data.proteines||0)*factor/100),
        lipides: acc.lipides + Math.round((data.lipides||0)*factor/100),
        sodium: acc.sodium + Math.round((data.sodium||0)*factor/100),
        potassium: acc.potassium + Math.round((data.potassium||0)*factor/100),
        magnesium: acc.magnesium + Math.round((data.magnesium||0)*factor/100),
        zinc: acc.zinc + Math.round((data.zinc||0)*factor/100),
        calcium: acc.calcium + Math.round((data.calcium||0)*factor/100)
      };
    }, {kcal:0, glucides:0, proteines:0, lipides:0, sodium:0, potassium:0, magnesium:0, zinc:0, calcium:0});
  };

  // Filtres
  const filteredCiqual = useMemo(()=>{
    let results = CIQUAL;
    if(ciqualCat!=="Toutes") results = results.filter(a=>a.c===ciqualCat);
    if(ciqualSearch.trim()) {
      const terms = ciqualSearch.toLowerCase().split(" ").filter(Boolean);
      results = results.filter(a=>terms.every(t=>(a.n||"").toLowerCase().includes(t)));
    }
    return results.slice(0, 50);
  }, [ciqualSearch, ciqualCat]);

  const filteredIngCiqual = useMemo(()=>{
    let results = CIQUAL;
    if(ingCiqualCat!=="Toutes") results = results.filter(a=>a.c===ingCiqualCat);
    if(ingCiqualSearch.trim()) {
      const terms = ingCiqualSearch.toLowerCase().split(" ").filter(Boolean);
      results = results.filter(a=>terms.every(t=>(a.n||"").toLowerCase().includes(t)));
    }
    return results.slice(0, 50);
  }, [ingCiqualSearch, ingCiqualCat]);

  const filteredProduits = useMemo(()=>{
    // On n'affiche dans la bibliothèque que les produits à emporter en course.
    // Les ingrédients bruts (aEmporter === false) restent disponibles pour les recettes
    // via la modal "Mes produits" mais ne polluent pas la vue principale.
    const aEmporter = produits.filter(p => p.aEmporter !== false);
    if(!search) return aEmporter;
    return aEmporter.filter(p=>
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

  // ── Historique entraînements ──
  const seancesEff = useMemo(()=>
    [...seances].filter(s=>s.statut==="Effectué"&&isRunning(s.activite))
      .sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,50)
  , [seances]);

  // Modal nutrition séance
  const [nutritionSeanceModal, setNutritionSeanceModal] = useState(false);
  const [editNutritionSeanceId, setEditNutritionSeanceId] = useState(null);
  const [nutritionSeanceForm, setNutritionSeanceForm] = useState([]); // [{id, quantite}]

  const openNutritionSeance = (seance) => {
    setEditNutritionSeanceId(seance.id);
    setNutritionSeanceForm(seance.nutrition || []); // [{id, quantite}]
    setNutritionSeanceModal(true);
  };

  const saveNutritionSeance = () => {
    setSeances(ss=>ss.map(s=>
      s.id===editNutritionSeanceId 
        ? {...s, nutrition: nutritionSeanceForm} 
        : s
    ));
    setNutritionSeanceModal(false);
  };

  const toggleNutritionItem = (id) => {
    const exists = nutritionSeanceForm.find(n=>n.id===id);
    if(exists) {
      setNutritionSeanceForm(f=>f.filter(n=>n.id!==id));
    } else {
      setNutritionSeanceForm(f=>[...f, {id, quantite: 1}]); // 1 portion par défaut
    }
  };

  const updateNutritionQte = (id, qte) => {
    setNutritionSeanceForm(f=>f.map(n=>n.id===id?{...n, quantite: parseFloat(qte)||0}:n));
  };

  const unlinkNutritionSeance = (seanceId) => {
    setSeances(ss=>ss.map(s=>s.id===seanceId?{...s,nutrition:[]}:s));
  };

  const card = {background:C.white,border:`1px solid ${C.border}`,borderRadius:12};
  const lbl = {fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted};

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <PageTitle sub="Ma bibliothèque · Historique">Nutrition entraînement</PageTitle>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,marginBottom:20}}>
        {[
          {id:"bibliotheque", label:`Ma bibliothèque (${produits.filter(p=>p.aEmporter!==false).length + recettes.length})`},
          {id:"historique", label:"Historique entraînements"}
        ].map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setSearch("");}}
            style={{background:"none",border:"none",padding:"8px 16px",cursor:"pointer",fontSize:13,
              fontWeight:tab===t.id?500:400,color:tab===t.id?C.forest:C.muted,
              borderBottom:tab===t.id?`2px solid ${C.forest}`:"2px solid transparent",
              marginBottom:-1,fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB BIBLIOTHÈQUE (unifiée) ── */}
      {tab==="bibliotheque"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Rechercher..."
              style={{flex:1,minWidth:200,fontSize:13,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`}}/>
            <select value={bibFilter} onChange={e=>setBibFilter(e.target.value)}
              style={{padding:"8px 12px",fontSize:13,borderRadius:8,border:`1px solid ${C.border}`,background:C.white,cursor:"pointer"}}>
              <option value="tous">Tous</option>
              <option value="produits">Produits uniquement</option>
              <option value="recettes">Recettes uniquement</option>
            </select>
            <Btn variant="soft" onClick={()=>setCiqualModal(true)}>🔍 Base CIQUAL</Btn>
            <Btn variant="soft" onClick={openNewRec}>＋ Recette</Btn>
            <Btn onClick={openNewProd}>＋ Produit</Btn>
          </div>

          {(() => {
            // Construire la liste unifiée selon le filtre
            const items = [];
            if (bibFilter !== "recettes") {
              filteredProduits.forEach(p => items.push({ ...p, _itemType: "produit" }));
            }
            if (bibFilter !== "produits") {
              filteredRecettes.forEach(r => items.push({ ...r, _itemType: "recette" }));
            }
            // Tri alphabétique
            items.sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));

            if (items.length === 0) {
              return (
                <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>🥕</div>
                  <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Bibliothèque vide</div>
                  <div style={{fontSize:13,marginBottom:20}}>Ajoute des produits depuis CIQUAL, crée tes produits perso ou tes recettes</div>
                  <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                    <Btn variant="soft" onClick={()=>setCiqualModal(true)}>🔍 Base CIQUAL</Btn>
                    <Btn variant="soft" onClick={openNewRec}>＋ Recette</Btn>
                    <Btn onClick={openNewProd}>＋ Produit</Btn>
                  </div>
                </div>
              );
            }

            return (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(420px,1fr))",gap:10}}>
                {items.map(it => {
                  const isProduit = it._itemType === "produit";
                  const type = isProduit ? (it.type || inferType(it)) : (it.type || "");
                  const macros = isProduit 
                    ? { kcal: it.kcal || 0, glucides: it.glucides || 0, proteines: it.proteines || 0, lipides: it.lipides || 0, sodium: it.sodium || 0 }
                    : calcMacros(it);
                  const needsType = isProduit && !it.type;
                  
                  return (
                    <div key={it.id} style={{...card, padding:12, display:"flex", flexDirection:"column", gap:8}}>
                      {/* Ligne 1 : badge + nom + actions */}
                      <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
                        <div style={{
                          minWidth:70, padding:"3px 8px", borderRadius:6, fontSize:10, fontWeight:500,
                          textAlign:"center",
                          background: isProduit ? C.forestPale : C.primaryPale,
                          color: isProduit ? C.forest : C.primary,
                          flexShrink:0
                        }}>
                          {isProduit ? "Produit" : "Recette"}
                        </div>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:500,color:C.inkLight,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                            {it.nom}
                            {type && (
                              <span style={{fontSize:10,background:C.stone,color:C.muted,padding:"2px 7px",borderRadius:10,fontWeight:400}}>
                                {type}
                              </span>
                            )}
                            {needsType && (
                              <span style={{fontSize:10,background:C.yellowPale,color:C.yellow,padding:"2px 7px",borderRadius:10,fontWeight:500}}>
                                Type à définir
                              </span>
                            )}
                            {isProduit && it.source === "ciqual" && (
                              <span style={{fontSize:10,color:C.muted}}>CIQUAL</span>
                            )}
                          </div>
                          <div style={{fontSize:11,color:C.muted,marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                            {it.categorie && <span>{it.categorie}</span>}
                            {!isProduit && <span>{it.portions} portion{it.portions>1?"s":""} · {it.ingredients?.length||0} ingrédient{(it.ingredients?.length||0)>1?"s":""}</span>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:2,flexShrink:0}}>
                          <button onClick={()=>isProduit?openEditProd(it):openEditRec(it)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.forest,padding:4}}>✎</button>
                          <button onClick={()=>isProduit?setConfirmProdId(it.id):setConfirmRecId(it.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.red,padding:4}}>🗑</button>
                        </div>
                      </div>
                      
                      {/* Ligne 2 : macros */}
                      <div style={{display:"flex",gap:10,fontSize:11,fontFamily:"'DM Mono',monospace",flexWrap:"wrap",paddingLeft:80}}>
                        <span style={{color:"#e65100",fontWeight:500}}>{Math.round(macros.kcal)} kcal</span>
                        <span style={{color:"#1d9e75"}}>{Math.round(macros.glucides)}g gluc.</span>
                        <span style={{color:"#185FA5"}}>{Math.round(macros.proteines||0)}g prot.</span>
                        <span style={{color:"#7F77DD"}}>{Math.round(macros.lipides||0)}g lip.</span>
                        <span style={{color:"#BA7517"}}>{Math.round(macros.sodium)}mg Na</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TAB HISTORIQUE ── */}
      {tab==="historique"&&(
        seancesEff.length===0?(
          <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>🏃</div>
            <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Aucune séance</div>
            <div style={{fontSize:13}}>Tes séances d'entraînement effectuées apparaîtront ici</div>
          </div>
        ):(() => {
          const SE_COLS = ["100px","1fr","1fr"];
          return (
            <ScrollableTable
              columns={SE_COLS}
              minWidth={600}
              maxHeight={520}
              headerCells={[
                <span key="d">Date</span>,
                <span key="a">Activité</span>,
                <span key="n">Nutrition liée</span>
              ]}
            >
              {seancesEff.map(s=>{
                const nutrition = s.nutrition || [];
                const linkedItems = nutrition.map(n=>{
                  const rec = recettes.find(r=>r.id===n.id);
                  const prod = produits.find(p=>p.id===n.id);
                  return {item: rec || prod, qte: n.quantite};
                }).filter(x=>x.item);
                
                return (
                  <ScrollableRow key={s.id}>
                    <ScrollableCell style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.inkLight}}>{fmtDate(s.date)}</ScrollableCell>
                    <ScrollableCell style={{fontWeight:500,color:C.inkLight}}>{s.activite}</ScrollableCell>
                    <ScrollableCell>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        {linkedItems.length>0?(
                          <>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1}}>
                              {linkedItems.map(({item,qte},idx)=>(
                                <span key={idx} style={{fontSize:11,background:C.stone,padding:"2px 8px",borderRadius:12,color:C.inkLight}}>
                                  {item.nom} <span style={{color:C.muted}}>×{qte}</span>
                                </span>
                              ))}
                            </div>
                            <button onClick={()=>openNutritionSeance(s)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:C.forest}}>✎</button>
                            <button onClick={()=>unlinkNutritionSeance(s.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.red}}>✕</button>
                          </>
                        ):(
                          <button onClick={()=>openNutritionSeance(s)} 
                            style={{fontSize:12,padding:"4px 12px",borderRadius:6,border:`1px solid ${C.border}`,
                              background:C.white,cursor:"pointer",color:C.muted}}>
                            + Lier nutrition
                          </button>
                        )}
                      </div>
                    </ScrollableCell>
                  </ScrollableRow>
                );
              })}
            </ScrollableTable>
          );
        })()
      )}

      {/* ── MODAL PRODUIT (nouveau formulaire unifié) ── */}
      <Modal 
        open={prodModal} 
        onClose={()=>setProdModal(false)} 
        title={editProdId?"Modifier le produit":"Nouveau produit"} 
        width={700}
        footer={<>
          <Btn variant="ghost" onClick={()=>setProdModal(false)}>Annuler</Btn>
          <Btn onClick={saveProduit}>{editProdId?"Enregistrer":"Ajouter"}</Btn>
        </>}
      >
        <ProduitForm form={prodForm} setForm={setProdForm} onModeChange={setProdInputMode} showTypeError={showProdTypeErr} />
      </Modal>

      {/* ── MODAL RECETTE (nouveau formulaire unifié) ── */}
      <Modal 
        open={recModal} 
        onClose={()=>setRecModal(false)} 
        title={editRecId?"Modifier la recette":"Nouvelle recette"} 
        width={760}
        footer={<>
          <Btn variant="ghost" onClick={()=>setRecModal(false)}>Annuler</Btn>
          <Btn onClick={saveRecette}>{editRecId?"Enregistrer":"Créer"}</Btn>
        </>}
      >
        <RecetteForm
          form={recForm}
          setForm={setRecForm}
          allProduits={produits}
          onOpenCiqualIng={()=>setIngCiqualModal(true)}
          onOpenMesProduitsIng={()=>setMesProduitsModal(true)}
          calcMacros={calcMacros}
          showTypeError={showRecTypeErr}
          showPortionError={showRecPortionErr}
        />
      </Modal>

      {/* ── MODAL CIQUAL PRODUITS ── */}
      <Modal open={ciqualModal} onClose={()=>setCiqualModal(false)} title="Base alimentaire CIQUAL" width={800}>
        <div style={{marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:12}}>
            <input value={ciqualSearch} onChange={e=>setCiqualSearch(e.target.value)}
              placeholder="Rechercher un aliment..."
              style={{fontSize:13,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,width:"100%"}}/>
            <select value={ciqualCat} onChange={e=>setCiqualCat(e.target.value)}
              style={{padding:"8px 12px",fontSize:13,borderRadius:8,border:`1px solid ${C.border}`,minWidth:180}}>
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

      {/* ── MODAL CIQUAL INGRÉDIENTS ── */}
      <Modal open={ingCiqualModal} onClose={()=>setIngCiqualModal(false)} title="Ajouter ingrédient depuis CIQUAL" width={800}>
        <div style={{marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:12}}>
            <input value={ingCiqualSearch} onChange={e=>setIngCiqualSearch(e.target.value)}
              placeholder="Rechercher un aliment..."
              style={{fontSize:13,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,width:"100%"}}/>
            <select value={ingCiqualCat} onChange={e=>setIngCiqualCat(e.target.value)}
              style={{padding:"8px 12px",fontSize:13,borderRadius:8,border:`1px solid ${C.border}`,minWidth:180}}>
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

      {/* ── MODAL MES PRODUITS (pour ingrédients) ── */}
      <Modal open={mesProduitsModal} onClose={()=>{setMesProduitsModal(false);setMesProduitsSearch("");}} title="Mes produits" width={700}>
        <div style={{marginBottom:16}}>
          <input value={mesProduitsSearch} onChange={e=>setMesProduitsSearch(e.target.value)}
            placeholder="Rechercher dans mes produits..."
            style={{fontSize:13,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,width:"100%"}}/>
        </div>
        <div style={{maxHeight:400,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:8}}>
          {produits.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
              <div style={{fontSize:14,marginBottom:8}}>Aucun produit</div>
              <div style={{fontSize:12}}>Crée des produits dans l'onglet "Produits"</div>
            </div>
          ):(()=>{
            const filtered = produits.filter(p=>
              !mesProduitsSearch || (p.nom||"").toLowerCase().includes(mesProduitsSearch.toLowerCase())
            );
            const alreadyAdded = new Set(recForm.ingredients.map(i=>i.produitId));
            
            return filtered.length===0?(
              <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>Aucun résultat</div>
            ):(
              filtered.map(p=>{
                const added = alreadyAdded.has(p.id);
                return (
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"10px 14px",borderBottom:`1px solid ${C.border}`,gap:12,opacity:added?0.5:1}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:500,color:C.inkLight,marginBottom:2}}>{p.nom}</div>
                      {p.categorie&&<div style={{fontSize:11,color:C.muted}}>{p.categorie}</div>}
                      <div style={{display:"flex",gap:10,fontSize:11,marginTop:4}}>
                        <span style={{color:"#e65100"}}>{Math.round(p.kcal||0)} kcal</span>
                        <span style={{color:"#1d9e75"}}>{(p.glucides||0).toFixed(1)}g gluc.</span>
                        <span style={{color:"#185FA5"}}>{(p.proteines||0).toFixed(1)}g prot.</span>
                        <span style={{color:"#7F77DD"}}>{(p.lipides||0).toFixed(1)}g lip.</span>
                      </div>
                    </div>
                    {added?(
                      <span style={{fontSize:12,color:C.muted}}>✓ Ajouté</span>
                    ):(
                      <Btn size="sm" onClick={()=>{addIngredientFromProduit(p.id);setMesProduitsModal(false);setMesProduitsSearch("");}}>＋ Ajouter</Btn>
                    )}
                  </div>
                );
              })
            );
          })()}
        </div>
      </Modal>

      {/* ── MODAL NUTRITION SÉANCE ── */}
      <Modal open={nutritionSeanceModal} onClose={()=>setNutritionSeanceModal(false)} title="Nutrition de la séance" width={600}>
        {recettes.length===0 && produits.filter(p=>p.aEmporter!==false).length===0?(
          <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
            <div style={{fontSize:14,marginBottom:8}}>Aucun produit ou recette</div>
            <div style={{fontSize:12}}>Crée des produits ou recettes dans les onglets correspondants</div>
          </div>
        ):(
          <>
            {recettes.length>0&&(
              <div style={{marginBottom:20}}>
                <div style={{...lbl,marginBottom:10}}>Recettes</div>
                <div style={{display:"grid",gap:6}}>
                  {recettes.map(r=>{
                    const item = nutritionSeanceForm.find(n=>n.id===r.id);
                    const checked = !!item;
                    return (
                      <label key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
                        borderRadius:8,border:`1px solid ${checked?C.forest:C.border}`,
                        background:checked?C.forest+"10":C.white,cursor:"pointer"}}>
                        <input type="checkbox" checked={checked} onChange={()=>toggleNutritionItem(r.id)}
                          style={{width:16,height:16,cursor:"pointer",accentColor:C.forest}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:500,color:C.inkLight}}>{r.nom}</div>
                          {r.description&&<div style={{fontSize:11,color:C.muted}}>{r.description}</div>}
                        </div>
                        {checked&&(
                          <div style={{display:"flex",alignItems:"center",gap:6}} onClick={e=>e.preventDefault()}>
                            <input type="number" min="0.1" step="0.5" value={item.quantite} 
                              onChange={e=>updateNutritionQte(r.id, e.target.value)}
                              style={{width:60,padding:"4px 8px",fontSize:12,borderRadius:6,border:`1px solid ${C.border}`,textAlign:"right"}}/>
                            <span style={{fontSize:12,color:C.muted}}>portion{item.quantite>1?"s":""}</span>
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {produits.filter(p=>p.aEmporter!==false).length>0&&(
              <div>
                <div style={{...lbl,marginBottom:10}}>Produits</div>
                <div style={{display:"grid",gap:6}}>
                  {produits.filter(p=>p.aEmporter!==false).map(p=>{
                    const item = nutritionSeanceForm.find(n=>n.id===p.id);
                    const checked = !!item;
                    return (
                      <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
                        borderRadius:8,border:`1px solid ${checked?C.forest:C.border}`,
                        background:checked?C.forest+"10":C.white,cursor:"pointer"}}>
                        <input type="checkbox" checked={checked} onChange={()=>toggleNutritionItem(p.id)}
                          style={{width:16,height:16,cursor:"pointer",accentColor:C.forest}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:500,color:C.inkLight}}>{p.nom}</div>
                          {p.categorie&&<div style={{fontSize:11,color:C.muted}}>{p.categorie}</div>}
                        </div>
                        {checked&&(
                          <div style={{display:"flex",alignItems:"center",gap:6}} onClick={e=>e.preventDefault()}>
                            <input type="number" min="1" step="1" value={item.quantite} 
                              onChange={e=>updateNutritionQte(p.id, e.target.value)}
                              style={{width:60,padding:"4px 8px",fontSize:12,borderRadius:6,border:`1px solid ${C.border}`,textAlign:"right"}}/>
                            <span style={{fontSize:12,color:C.muted}}>g</span>
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setNutritionSeanceModal(false)}>Annuler</Btn>
          <Btn onClick={saveNutritionSeance}>Enregistrer</Btn>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmProdId} message="Supprimer ce produit ?"
        onConfirm={()=>delProduit(confirmProdId)} onCancel={()=>setConfirmProdId(null)}/>
      <ConfirmDialog open={!!confirmRecId} message="Supprimer cette recette ?"
        onConfirm={()=>delRecette(confirmRecId)} onCancel={()=>setConfirmRecId(null)}/>
    </div>
  );
}

export { JournalNutri, Nutrition };
