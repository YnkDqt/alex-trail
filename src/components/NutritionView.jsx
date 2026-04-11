import { useState, useMemo, useEffect } from 'react';
import { C } from '../constants.js';
import { fmtTime, fmtPace, calcNutrition } from '../utils.jsx';
import { Btn, Modal, Field, ConfirmDialog } from '../atoms.jsx';
import { CIQUAL, CIQUAL_CATEGORIES } from '../data/ciqual.js';

// ─── VUE NUTRITION COURSE ────────────────────────────────────────────────────
export default function NutritionView({ 
  segments, 
  race, 
  setRace, 
  profil, 
  poids, 
  recettes = [],  // Recettes entraînement
  produits = []   // Produits entraînement
}) {
  // Bibliothèque course (structure séparée)
  const bibliotheque = useMemo(() => {
    const bib = race.bibliotheque;
    // Si ancien format (array) ou undefined, convertir en nouveau format
    if (!bib || Array.isArray(bib)) {
      return { produits: [], recettes: [] };
    }
    // Si nouveau format mais incomplet
    return {
      produits: bib.produits || [],
      recettes: bib.recettes || []
    };
  }, [race.bibliotheque]);
  
  const updBibliotheque = (newBib) => setRace(r => ({ ...r, bibliotheque: newBib }));

  // Poids utilisateur
  const lastPoids = useMemo(() => 
    [...(poids || [])].sort((a,b) => new Date(b.date) - new Date(a.date))[0]?.poids || 70
  , [poids]);
  const userWeight = profil?.poids || lastPoids;

  // Ravitaillements
  const ravitos = useMemo(() => 
    [...(race.ravitos || [])].sort((a, b) => a.km - b.km).filter(rv => rv.assistancePresente !== false)
  , [race.ravitos]);

  // ── État ──
  const [view, setView] = useState("bibliotheque"); // bibliotheque | plan

  // Modaux bibliothèque
  const [prodModal, setProdModal] = useState(false);
  const [recModal, setRecModal] = useState(false);
  const [ciqualModal, setCiqualModal] = useState(false);
  const [strideRecModal, setStrideRecModal] = useState(false);
  const [strideProdModal, setStrideProdModal] = useState(false);
  
  const [editProdId, setEditProdId] = useState(null);
  const [editRecId, setEditRecId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmType, setConfirmType] = useState(null); // "produit" | "recette"

  // Forms
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
    notes: ""
  });

  const emptyRecette = () => ({
    id: Date.now()+Math.random(),
    nom: "",
    description: "",
    portions: 1,
    ingredients: [], // {produitId, quantite}
    notes: ""
  });

  const [prodForm, setProdForm] = useState(emptyProduit());
  const [recForm, setRecForm] = useState(emptyRecette());

  // CIQUAL
  const [ciqualSearch, setCiqualSearch] = useState("");
  const [ciqualCat, setCiqualCat] = useState("Toutes");

  // Ingrédients recette CIQUAL
  const [ingCiqualModal, setIngCiqualModal] = useState(false);
  const [ingCiqualSearch, setIngCiqualSearch] = useState("");
  const [ingCiqualCat, setIngCiqualCat] = useState("Toutes");

  const updP = (k,v) => setProdForm(f=>({...f,[k]:v}));
  const updR = (k,v) => setRecForm(f=>({...f,[k]:v}));

  // ── CRUD Bibliothèque Produits ──
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
    
    if(editProdId) {
      updBibliotheque({
        ...bibliotheque,
        produits: bibliotheque.produits.map(p=>p.id===editProdId?item:p)
      });
    } else {
      updBibliotheque({
        ...bibliotheque,
        produits: [...bibliotheque.produits, item]
      });
    }
    setProdModal(false);
  };

  const delProduit = (id) => {
    updBibliotheque({
      ...bibliotheque,
      produits: bibliotheque.produits.filter(p=>p.id!==id)
    });
    setConfirmId(null);
  };

  // Ajout depuis CIQUAL
  const addFromCiqual = (alim) => {
    const newProd = {
      id: Date.now()+Math.random(),
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
      notes: ""
    };
    updBibliotheque({
      ...bibliotheque,
      produits: [...bibliotheque.produits, newProd]
    });
    setCiqualModal(false);
    setCiqualSearch("");
  };

  // Ajout depuis mes produits entraînement
  const addFromStrideProduits = (selectedIds) => {
    const selected = produits.filter(p=>selectedIds.includes(p.id));
    const newProds = selected.map(p=>({
      ...p,
      id: Date.now()+Math.random(), // Nouvel ID pour éviter conflits
      source: "stride"
    }));
    updBibliotheque({
      ...bibliotheque,
      produits: [...bibliotheque.produits, ...newProds]
    });
    setStrideProdModal(false);
  };

  // ── CRUD Bibliothèque Recettes ──
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
    
    if(editRecId) {
      updBibliotheque({
        ...bibliotheque,
        recettes: bibliotheque.recettes.map(r=>r.id===editRecId?item:r)
      });
    } else {
      updBibliotheque({
        ...bibliotheque,
        recettes: [...bibliotheque.recettes, item]
      });
    }
    setRecModal(false);
  };

  const delRecette = (id) => {
    updBibliotheque({
      ...bibliotheque,
      recettes: bibliotheque.recettes.filter(r=>r.id!==id)
    });
    setConfirmId(null);
  };

  // Ajout depuis mes recettes entraînement
  const addFromStrideRecettes = (selectedIds) => {
    const selected = recettes.filter(r=>selectedIds.includes(r.id));
    const newRecs = selected.map(r=>({
      ...r,
      id: Date.now()+Math.random(),
      source: "stride"
    }));
    updBibliotheque({
      ...bibliotheque,
      recettes: [...bibliotheque.recettes, ...newRecs]
    });
    setStrideRecModal(false);
  };

  // Ingrédients recette - tous produits disponibles (bibliothèque + entraînement)
  const allProduitsForIngredients = useMemo(() => [
    ...bibliotheque.produits,
    ...produits.map(p=>({...p, fromStride: true}))
  ], [bibliotheque.produits, produits]);

  const addIngredientFromProduit = (produitId) => {
    const exists = recForm.ingredients.find(i=>i.produitId===produitId);
    if(exists) return;
    
    // Si produit vient de stride, l'ajouter à la bibliothèque course
    const prod = allProduitsForIngredients.find(p=>p.id===produitId);
    if(prod?.fromStride) {
      const newProd = {
        ...prod,
        id: Date.now()+Math.random(),
        fromStride: undefined,
        source: "stride"
      };
      updBibliotheque({
        ...bibliotheque,
        produits: [...bibliotheque.produits, newProd]
      });
      setRecForm(f=>({
        ...f,
        ingredients: [...f.ingredients, {produitId: newProd.id, quantite: 100}]
      }));
    } else {
      setRecForm(f=>({
        ...f,
        ingredients: [...f.ingredients, {produitId, quantite: 100}]
      }));
    }
  };

  const addIngredientFromCiqual = (alim) => {
    const newProd = {
      id: Date.now()+Math.random(),
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
      notes: ""
    };
    
    updBibliotheque({
      ...bibliotheque,
      produits: [...bibliotheque.produits, newProd]
    });
    
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
      const prod = allProduitsForIngredients.find(p=>p.id===ing.produitId);
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

  // Filtres CIQUAL
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

  // ── UI ──
  const card = {background:C.white,border:`1px solid ${C.border}`,borderRadius:12};
  const lbl = {fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted};

  // Tableau unifié bibliothèque
  const allBibItems = useMemo(() => {
    const prods = bibliotheque.produits.map(p=>({...p, itemType: "produit"}));
    const recs = bibliotheque.recettes.map(r=>({...r, itemType: "recette", macros: calcMacros(r)}));
    return [...prods, ...recs];
  }, [bibliotheque]);

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Nutrition course</h1>
          <p style={{fontSize:12,color:C.muted}}>Bibliothèque · Plan ravitaillement · Besoins énergétiques</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,marginBottom:20}}>
        {[
          {id:"bibliotheque", label:`Bibliothèque (${allBibItems.length})`},
          {id:"plan", label:"Plan ravitaillement"}
        ].map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)}
            style={{background:"none",border:"none",padding:"8px 16px",cursor:"pointer",fontSize:13,
              fontWeight:view===t.id?500:400,color:view===t.id?C.forest:C.muted,
              borderBottom:view===t.id?`2px solid ${C.forest}`:"2px solid transparent",
              marginBottom:-1,fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BIBLIOTHÈQUE ── */}
      {view==="bibliotheque"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            <Btn variant="soft" onClick={()=>setStrideRecModal(true)}>📚 Mes recettes entraînement</Btn>
            <Btn variant="soft" onClick={()=>setStrideProdModal(true)}>🥕 Mes produits entraînement</Btn>
            <Btn variant="soft" onClick={()=>setCiqualModal(true)}>🔍 Base CIQUAL</Btn>
            <Btn onClick={openNewProd}>＋ Créer produit</Btn>
            <Btn onClick={openNewRec}>＋ Créer recette</Btn>
          </div>

          {allBibItems.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:40,marginBottom:12}}>🍽️</div>
              <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Bibliothèque vide</div>
              <div style={{fontSize:13,marginBottom:20}}>Ajoute des produits et recettes pour cette course</div>
              <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                <Btn variant="soft" onClick={()=>setStrideRecModal(true)}>📚 Mes recettes</Btn>
                <Btn variant="soft" onClick={()=>setCiqualModal(true)}>🔍 CIQUAL</Btn>
                <Btn onClick={openNewProd}>＋ Créer produit</Btn>
              </div>
            </div>
          ):(
            <div style={{...card,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"120px 1fr 70px 70px 70px 70px 70px 70px 70px 70px 70px 32px",
                padding:"8px 16px",background:C.stone,gap:8,fontSize:10,fontWeight:600,color:C.muted,
                textTransform:"uppercase",letterSpacing:"0.04em"}}>
                <span>Type</span>
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
                <span/>
              </div>
              <div style={{maxHeight:520,overflowY:"auto"}}>
                {allBibItems.map(item=>{
                  const isProd = item.itemType==="produit";
                  const macros = isProd ? item : item.macros;
                  return (
                    <div key={item.id} style={{display:"grid",gridTemplateColumns:"120px 1fr 70px 70px 70px 70px 70px 70px 70px 70px 70px 32px",
                      padding:"10px 16px",gap:8,borderBottom:`1px solid ${C.border}`,alignItems:"center",fontSize:13}}>
                      <span style={{fontSize:11,fontWeight:500,color:isProd?C.forest:"#7F77DD"}}>
                        {isProd?"Produit":"Recette"}
                      </span>
                      <div>
                        <div style={{fontWeight:500,color:C.inkLight}}>{item.nom}</div>
                        {item.categorie&&<div style={{fontSize:11,color:C.muted}}>{item.categorie}</div>}
                        {!isProd&&item.description&&<div style={{fontSize:11,color:C.muted}}>{item.description}</div>}
                      </div>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#e65100"}}>{macros?.kcal||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#1d9e75"}}>{macros?.glucides||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#185FA5"}}>{macros?.proteines||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#7F77DD"}}>{macros?.lipides||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#BA7517",fontSize:11}}>{macros?.sodium||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:11}}>{item.potassium||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:11}}>{item.magnesium||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:11}}>{item.zinc||0}</span>
                      <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:11}}>{item.calcium||0}</span>
                      <div style={{display:"flex",gap:2}}>
                        <button onClick={()=>isProd?openEditProd(item):openEditRec(item)} 
                          style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.forest}}>✎</button>
                        <button onClick={()=>{setConfirmId(item.id);setConfirmType(item.itemType);}} 
                          style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.red}}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PLAN RAVITAILLEMENT ── */}
      {view==="plan"&&(
        <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
          <div style={{fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:6}}>Plan ravitaillement</div>
          <div style={{fontSize:13}}>Fonctionnalité à venir</div>
        </div>
      )}

      {/* ── MODAL PRODUIT ── */}
      <Modal open={prodModal} onClose={()=>setProdModal(false)} title={editProdId?"Modifier le produit":"Créer un produit"} width={600}>
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
          <Btn onClick={saveProduit}>{editProdId?"Enregistrer":"Créer"}</Btn>
        </div>
      </Modal>

      {/* ── MODAL RECETTE ── */}
      <Modal open={recModal} onClose={()=>setRecModal(false)} title={editRecId?"Modifier la recette":"Créer une recette"} width={700}>
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

        <div style={{marginBottom:16}}>
          <div style={{...lbl,marginBottom:8}}>Ingrédients</div>
          {recForm.ingredients.length===0?(
            <div style={{textAlign:"center",padding:"20px",background:C.stone,borderRadius:8,color:C.muted,fontSize:13}}>
              Aucun ingrédient ajouté
            </div>
          ):(
            <div style={{display:"grid",gap:6}}>
              {recForm.ingredients.map((ing,idx)=>{
                const prod = allProduitsForIngredients.find(p=>p.id===ing.produitId);
                return (
                  <div key={idx} style={{display:"flex",gap:8,alignItems:"center",padding:8,background:C.stone,borderRadius:6}}>
                    <span style={{flex:1,fontSize:13,color:C.inkLight}}>
                      {prod?.nom||"Produit inconnu"}
                      {prod?.fromStride&&<span style={{fontSize:11,color:C.muted,marginLeft:6}}>(entraînement)</span>}
                    </span>
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
              <option value="">+ Ingrédient...</option>
              <optgroup label="Bibliothèque course">
                {bibliotheque.produits.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
              </optgroup>
              <optgroup label="Mes produits entraînement">
                {produits.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
              </optgroup>
            </select>
            <Btn variant="soft" size="sm" onClick={()=>setIngCiqualModal(true)}>🔍 CIQUAL</Btn>
          </div>
        </div>

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

      {/* ── MODAL CIQUAL ── */}
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
                  </div>
                </div>
                <Btn size="sm" onClick={()=>addIngredientFromCiqual(alim)}>＋ Ajouter</Btn>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* ── MODAL MES RECETTES ENTRAÎNEMENT ── */}
      <Modal open={strideRecModal} onClose={()=>setStrideRecModal(false)} title="Mes recettes entraînement" width={700}>
        {recettes.length===0?(
          <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
            <div style={{fontSize:14,marginBottom:8}}>Aucune recette entraînement</div>
            <div style={{fontSize:12}}>Crée des recettes dans la section Entraînement → Nutrition</div>
          </div>
        ):(
          <div style={{maxHeight:500,overflowY:"auto"}}>
            {recettes.map(r=>{
              const alreadyAdded = bibliotheque.recettes.some(br=>br.nom===r.nom);
              return (
                <div key={r.id} style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500,color:C.inkLight}}>{r.nom}</div>
                    <div style={{fontSize:12,color:C.muted}}>{r.description||"—"}</div>
                  </div>
                  {alreadyAdded?(
                    <span style={{fontSize:12,color:C.muted}}>✓ Ajoutée</span>
                  ):(
                    <Btn size="sm" onClick={()=>addFromStrideRecettes([r.id])}>＋ Ajouter</Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ── MODAL MES PRODUITS ENTRAÎNEMENT ── */}
      <Modal open={strideProdModal} onClose={()=>setStrideProdModal(false)} title="Mes produits entraînement" width={700}>
        {produits.length===0?(
          <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
            <div style={{fontSize:14,marginBottom:8}}>Aucun produit entraînement</div>
            <div style={{fontSize:12}}>Ajoute des produits dans la section Entraînement → Nutrition</div>
          </div>
        ):(
          <div style={{maxHeight:500,overflowY:"auto"}}>
            {produits.map(p=>{
              const alreadyAdded = bibliotheque.produits.some(bp=>bp.nom===p.nom);
              return (
                <div key={p.id} style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500,color:C.inkLight}}>{p.nom}</div>
                    {p.categorie&&<div style={{fontSize:11,color:C.muted}}>{p.categorie}</div>}
                  </div>
                  {alreadyAdded?(
                    <span style={{fontSize:12,color:C.muted}}>✓ Ajouté</span>
                  ):(
                    <Btn size="sm" onClick={()=>addFromStrideProduits([p.id])}>＋ Ajouter</Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <ConfirmDialog 
        open={!!confirmId} 
        message={`Supprimer ${confirmType==="produit"?"ce produit":"cette recette"} de la bibliothèque ?`}
        onConfirm={()=>confirmType==="produit"?delProduit(confirmId):delRecette(confirmId)} 
        onCancel={()=>{setConfirmId(null);setConfirmType(null);}}
      />
    </div>
  );
}
