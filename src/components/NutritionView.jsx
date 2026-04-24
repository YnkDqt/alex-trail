import { useState, useMemo } from 'react';
import { C } from '../constants.js';
import { fmtTime, calcNutrition } from '../utils.jsx';
import { Btn, Modal, ConfirmDialog, KPI } from '../atoms.jsx';
import { CIQUAL, CIQUAL_CATEGORIES } from '../data/ciqual.js';
import {
  ProduitForm,
  RecetteForm,
  emptyProduit as emptyProduitNew,
  emptyRecette as emptyRecetteNew,
  normalizeProduit,
  normalizeRecette,
  loadProduitForEdit,
  loadRecetteForEdit
} from '../ProduitRecetteForm.jsx';

export default function NutritionView({ 
  segments, 
  race, 
  setRace, 
  profil, 
  poids, 
  recettes = [],
  produits = [],
  settings
}) {
  // Bibliothèque course
  const bibliotheque = useMemo(() => {
    const bib = race.bibliotheque;
    if (!bib || Array.isArray(bib)) {
      // Init bibliothèque avec Eau par défaut
      const eauDefaut = {
        id: "eau-default-" + Date.now(),
        nom: "Eau",
        kcal: 0, glucides: 0, proteines: 0, lipides: 0,
        sodium: 0, potassium: 0, magnesium: 0, zinc: 0, calcium: 0,
        categorie: "Boisson", source: "default", notes: "Eau pure",
        boisson: true
      };
      return { produits: [eauDefaut], recettes: [] };
    }
    
    // Si bibliothèque existe mais pas d'eau, l'ajouter
    const produits = bib.produits || [];
    const hasEau = produits.some(p => p.nom.toLowerCase() === "eau" || p.source === "default");
    if (!hasEau && produits.length > 0) {
      const eauDefaut = {
        id: "eau-default-" + Date.now(),
        nom: "Eau",
        kcal: 0, glucides: 0, proteines: 0, lipides: 0,
        sodium: 0, potassium: 0, magnesium: 0, zinc: 0, calcium: 0,
        categorie: "Boisson", source: "default", notes: "Eau pure",
        boisson: true
      };
      return { produits: [eauDefaut, ...produits], recettes: bib.recettes || [] };
    }
    
    return { produits, recettes: bib.recettes || [] };
  }, [race.bibliotheque]);
  
  const updBibliotheque = (newBib) => setRace(r => ({ ...r, bibliotheque: newBib }));

  const userWeight = profil?.poids || [...(poids || [])].sort((a,b) => new Date(b.date) - new Date(a.date))[0]?.poids || 70;

  // Produits départ (persistés dans race.depart)
  const produitsDepartLocal = race.depart?.produits || [];
  const setProduitsDepartLocal = (prods) => setRace(r => ({ ...r, depart: { produits: prods } }));

  // Ravitaillements (filtrer assistant présente + exclure km=0 automatique)
  const ravitos = useMemo(() => 
    [...(race.ravitos || [])]
      .filter(rv => rv.km !== 0)
      .sort((a, b) => a.km - b.km)
  , [race.ravitos]);

  const updRavitos = (newRavitos) => setRace(r => ({ ...r, ravitos: newRavitos }));

  // ── États modaux bibliothèque ──
  const [prodModal, setProdModal] = useState(false);
  const [recModal, setRecModal] = useState(false);
  const [ciqualModal, setCiqualModal] = useState(false);
  const [entrainementRecModal, setEntrainementRecModal] = useState(false);
  const [entrainementProdModal, setEntrainementProdModal] = useState(false);
  const [editProdId, setEditProdId] = useState(null);
  const [editRecId, setEditRecId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmType, setConfirmType] = useState(null);
  const [autoCompletePreview, setAutoCompletePreview] = useState(null);

  // emptyProduit/emptyRecette sont importés depuis ProduitRecetteForm.jsx
  const emptyProduit = emptyProduitNew;
  const emptyRecette = emptyRecetteNew;

  const [prodForm, setProdForm] = useState(emptyProduit());
  const [recForm, setRecForm] = useState(emptyRecette());
  const [prodInputMode, setProdInputMode] = useState("100g"); // mode de saisie (state local)
  const [ciqualSearch, setCiqualSearch] = useState("");
  const [ciqualCat, setCiqualCat] = useState("Toutes");
  const [ingCiqualModal, setIngCiqualModal] = useState(false);
  const [ingCiqualSearch, setIngCiqualSearch] = useState("");
  const [ingCiqualCat, setIngCiqualCat] = useState("Toutes");
  const [ingMesProduitsModal, setIngMesProduitsModal] = useState(false);
  const [ingMesProduitsSearch, setIngMesProduitsSearch] = useState("");

  // updP, updR, removeIngredient, updateIngredientQte sont gérés par ProduitForm/RecetteForm

  // ── CALCULS ESTIMÉS ──
  const nutriEstimes = useMemo(() => {
    return segments.reduce((acc, seg) => {
      if (seg.type === "ravito" || seg.type === "repos") return acc;
      const n = calcNutrition(seg, { ...settings, weight: userWeight });
      const dH = seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh : 0;
      return {
        kcal: acc.kcal + n.kcal,
        eau: acc.eau + Math.round(n.eauH * dH),
        proteines: acc.proteines + Math.round(n.proteinesH * dH),
        lipides: acc.lipides + Math.round(n.lipidesH * dH),
        glucides: acc.glucides + Math.round(n.glucidesH * dH),
        sodium: acc.sodium + Math.round(n.selH * dH),
        potassium: acc.potassium + Math.round(dH * 200),
        magnesium: acc.magnesium + Math.round(dH * 50),
        zinc: acc.zinc + Math.round(dH * 2),
        calcium: acc.calcium + Math.round(dH * 100)
      };
    }, { kcal: 0, eau: 0, proteines: 0, lipides: 0, glucides: 0, sodium: 0, potassium: 0, magnesium: 0, zinc: 0, calcium: 0 });
  }, [segments, settings, userWeight]);

  // ── CALCULS PLANIFIÉS ──
  const nutriPlanifies = useMemo(() => {
    const allItems = [...bibliotheque.produits, ...bibliotheque.recettes];
    
    // Inclure produits départ + ravitos
    const allProduits = [
      ...produitsDepartLocal,
      ...ravitos.flatMap(rv => rv.produits || [])
    ];
    
    return allProduits.reduce((total, item) => {
        const prod = allItems.find(p => p.id === item.id);
        if (!prod) return total;
        
        const qte = item.quantite || 0;
        
        if (prod.ingredients) {
          const macros = (prod.ingredients || []).reduce((m, ing) => {
            // Gère les deux cas : ingrédient CIQUAL inline OU produit bibliothèque
            const ingProd = ing._ciqualData || [...produits, ...bibliotheque.produits].find(p => p.id === ing.produitId);
            if (!ingProd) return m;
            const qteGrammes = ing.quantite || 0;
            
            return {
              kcal: m.kcal + (ingProd.kcal || 0) * qteGrammes / 100,
              eau: m.eau + (ingProd.boisson ? qteGrammes : 0), // 1g eau = 1ml
              proteines: m.proteines + (ingProd.proteines || 0) * qteGrammes / 100,
              lipides: m.lipides + (ingProd.lipides || 0) * qteGrammes / 100,
              glucides: m.glucides + (ingProd.glucides || 0) * qteGrammes / 100,
              sodium: m.sodium + (ingProd.sodium || 0) * qteGrammes / 100,
              potassium: m.potassium + (ingProd.potassium || 0) * qteGrammes / 100,
              magnesium: m.magnesium + (ingProd.magnesium || 0) * qteGrammes / 100,
              zinc: m.zinc + (ingProd.zinc || 0) * qteGrammes / 100,
              calcium: m.calcium + (ingProd.calcium || 0) * qteGrammes / 100
            };
          }, { kcal: 0, eau: 0, proteines: 0, lipides: 0, glucides: 0, sodium: 0, potassium: 0, magnesium: 0, zinc: 0, calcium: 0 });
          
          return Object.keys(macros).reduce((t, k) => ({ ...t, [k]: t[k] + macros[k] * qte }), total);
        }
        
        // Produit simple - si boisson, quantité = volume eau (1g = 1ml)
        const eauProd = prod.boisson ? qte * 100 : 0; // qte en portions, 1 portion = 100g
        
        return {
          kcal: total.kcal + (prod.kcal || 0) * qte,
          eau: total.eau + eauProd,
          proteines: total.proteines + (prod.proteines || 0) * qte,
          lipides: total.lipides + (prod.lipides || 0) * qte,
          glucides: total.glucides + (prod.glucides || 0) * qte,
          sodium: total.sodium + (prod.sodium || 0) * qte,
          potassium: total.potassium + (prod.potassium || 0) * qte,
          magnesium: total.magnesium + (prod.magnesium || 0) * qte,
          zinc: total.zinc + (prod.zinc || 0) * qte,
          calcium: total.calcium + (prod.calcium || 0) * qte
        };
    }, { kcal: 0, eau: 0, proteines: 0, lipides: 0, glucides: 0, sodium: 0, potassium: 0, magnesium: 0, zinc: 0, calcium: 0 });
  }, [ravitos, produitsDepartLocal, bibliotheque, produits]);

  const calcProgress = (planifie, estime) => estime > 0 ? Math.round((planifie / estime) * 100) : 0;
  const progressColor = (pct) => pct >= 90 ? C.green : pct >= 70 ? C.yellow : C.red;

  // ── CRUD Bibliothèque ──
  const openNewProd = () => {
    setEditProdId(null);
    setProdForm(emptyProduit());
    setProdInputMode("100g");
    setProdModal(true);
  };

  const openEditProd = (p) => {
    setEditProdId(p.id);
    setProdForm(loadProduitForEdit(p));
    setProdInputMode("100g");
    setProdModal(true);
  };

  const saveProduit = () => {
    if(!prodForm.nom.trim()) return;
    const normalized = normalizeProduit(prodForm, prodInputMode);
    const item = { ...normalized, id: editProdId || Date.now()+Math.random() };
    if(editProdId) {
      updBibliotheque({ ...bibliotheque, produits: bibliotheque.produits.map(p=>p.id===editProdId?item:p) });
    } else {
      updBibliotheque({ ...bibliotheque, produits: [...bibliotheque.produits, item] });
    }
    setProdModal(false);
  };

  const delProduit = (id) => {
    updBibliotheque({ ...bibliotheque, produits: bibliotheque.produits.filter(p=>p.id!==id) });
    setConfirmId(null);
  };

  const addFromCiqual = (alim) => {
    const isBoisson = alim.c && alim.c.toLowerCase().includes("boisson");
    const newProd = {
      ...emptyProduit(),
      id: Date.now()+Math.random(), nom: alim.n,
      type: isBoisson ? (alim.n.toLowerCase().includes("eau") ? "Eau pure" : "Boisson énergétique") : "",
      kcal: alim.e || 0, glucides: alim.g || 0, proteines: alim.p || 0,
      lipides: alim.l || 0, sodium: alim.na || 0, potassium: alim.k || 0,
      magnesium: alim.mg || 0, zinc: 0, calcium: 0,
      categorie: alim.c || "", source: "ciqual", notes: "",
      boisson: isBoisson
    };
    updBibliotheque({ ...bibliotheque, produits: [...bibliotheque.produits, newProd] });
    setCiqualModal(false);
    setCiqualSearch("");
  };

  const addFromEntrainementProduits = (selectedIds) => {
    const selected = produits.filter(p=>selectedIds.includes(p.id));
    const newProds = selected.map(p=>({ ...p, id: Date.now()+Math.random(), source: "entrainement" }));
    updBibliotheque({ ...bibliotheque, produits: [...bibliotheque.produits, ...newProds] });
    setEntrainementProdModal(false);
  };

  const openNewRec = () => {
    setEditRecId(null);
    setRecForm(emptyRecette());
    setRecModal(true);
  };

  const openEditRec = (r) => {
    setEditRecId(r.id);
    setRecForm(loadRecetteForEdit(r));
    setRecModal(true);
  };

  const saveRecette = () => {
    if(!recForm.nom.trim()) return;
    const normalized = normalizeRecette(recForm);
    const item = { ...normalized, id: editRecId || Date.now()+Math.random() };
    if(editRecId) {
      updBibliotheque({ ...bibliotheque, recettes: bibliotheque.recettes.map(r=>r.id===editRecId?item:r) });
    } else {
      updBibliotheque({ ...bibliotheque, recettes: [...bibliotheque.recettes, item] });
    }
    setRecModal(false);
  };

  const delRecette = (id) => {
    updBibliotheque({ ...bibliotheque, recettes: bibliotheque.recettes.filter(r=>r.id!==id) });
    setConfirmId(null);
  };

  const addFromEntrainementRecettes = (selectedIds) => {
    const selected = recettes.filter(r=>selectedIds.includes(r.id));
    const newRecs = selected.map(r=>({ ...r, id: Date.now()+Math.random(), source: "entrainement" }));
    updBibliotheque({ ...bibliotheque, recettes: [...bibliotheque.recettes, ...newRecs] });
    setEntrainementRecModal(false);
  };

  const allProduitsForIngredients = useMemo(() => [
    ...bibliotheque.produits,
    ...produits.map(p=>({...p, fromEntrainement: true}))
  ], [bibliotheque.produits, produits]);

  const addIngredientFromProduit = (produitId) => {
    const exists = recForm.ingredients.find(i=>i.produitId===produitId);
    if(exists) return;
    
    const prod = allProduitsForIngredients.find(p=>p.id===produitId);
    if(prod?.fromEntrainement) {
      const newProd = { ...prod, id: Date.now()+Math.random(), fromEntrainement: undefined, source: "entrainement" };
      updBibliotheque({ ...bibliotheque, produits: [...bibliotheque.produits, newProd] });
      setRecForm(f=>({ ...f, ingredients: [...f.ingredients, {produitId: newProd.id, quantite: 100}] }));
    } else {
      setRecForm(f=>({ ...f, ingredients: [...f.ingredients, {produitId, quantite: 100}] }));
    }
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

  const calcMacros = (rec) => {
    return (rec.ingredients||[]).reduce((acc, ing)=>{
      // Gère les deux cas : ingrédient CIQUAL inline OU produit de la bibliothèque
      const data = ing._ciqualData || allProduitsForIngredients.find(p=>p.id===ing.produitId);
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

  const nutriProduit = (item, quantite) => {
    if (item.itemType === "recette") {
      const macros = calcMacros(item);
      const ratio = quantite / (item.portions || 1);
      const eauMl = item.boisson ? (item.volumeMlParPortion || 0) * ratio : 0;
      return {
        kcal: macros.kcal * ratio,
        glucides: macros.glucides * ratio,
        eauMl
      };
    }
    // Produit simple
    const ratio = quantite / 100;
    const eauMl = item.boisson ? quantite : 0; // 1g boisson = 1ml
    return {
      kcal: (item.kcal || 0) * ratio,
      glucides: (item.glucides || 0) * ratio,
      eauMl
    };
  };

  const handleAutoComplete = () => {
    // ── 1. FUSION ZONES AUTONOMES ──
    const zonesAjustees = [];
    let i = 0;
    while (i < zones.length) {
      const zone = zones[i];
      const isAutonome = i > 0 && ravitos[i - 1]?.assistancePresente === false;
      
      if (isAutonome && zonesAjustees.length > 0) {
        const prev = zonesAjustees[zonesAjustees.length - 1];
        prev.to = zone.to;
        prev.dist = prev.to - prev.from;
        prev.toLbl = zone.toLbl;
        prev.besoin.kcal += zone.besoin.kcal;
        prev.besoin.glucides += zone.besoin.glucides;
        prev.besoin.eau += zone.besoin.eau;
        prev.fusionAutonome = true;
      } else {
        zonesAjustees.push({ ...zone, fusionAutonome: false });
      }
      i++;
    }

    // ── 2. CLASSIFICATION PRODUITS ──
    const eauPure = allBibItems.find(p => p.boisson && p.nom && p.nom.toLowerCase() === "eau");
    const boissonsEnergie = allBibItems.filter(p => p.boisson && p.id !== eauPure?.id);
    const solides = allBibItems.filter(p => !p.boisson);

    if (!eauPure && boissonsEnergie.length === 0 && solides.length === 0) {
      alert("Bibliothèque vide.");
      return;
    }

    // Trier solides par densité glucides (priorité trail)
    solides.sort((a, b) => {
      const densA = a.itemType === "recette" ? (a.macros?.glucides || 0) / (a.portions || 1) * 100 : (a.glucides || 0);
      const densB = b.itemType === "recette" ? (b.macros?.glucides || 0) / (b.portions || 1) * 100 : (b.glucides || 0);
      return densB - densA;
    });

    const newPlan = {};

    // ── 3. OPTIMISATION PAR ZONE ──
    zonesAjustees.forEach((zone, zi) => {
      const { pointKey, besoin } = zone;
      const isDepart = zi === 0;
      
      // Cibles avec marges
      const marge = isDepart ? 1.1 : (zone.fusionAutonome ? 1.15 : 1.0);
      const cibleKcal = Math.round(besoin.kcal * marge);
      const cibleGlucides = Math.round(besoin.glucides * marge);
      const cibleEau = Math.round(besoin.eau * marge); // en ml
      
      const plan = [];
      let totalKcal = 0, totalGluc = 0, totalEau = 0;

      // ── Étape 1 : Eau pure (300ml min sécurité sauf départ) ──
      if (eauPure) {
        const eauMin = isDepart ? 0 : 300; // ml
        const eauCible = Math.max(cibleEau * 0.4, eauMin); // 40% besoin ou min
        const qteGrammes = Math.ceil(eauCible / 100) * 100; // Arrondi 100g
        
        plan.push({ id: eauPure.id, quantite: qteGrammes });
        const nutri = nutriProduit(eauPure, qteGrammes);
        totalEau += nutri.eauMl;
      }

      // ── Étape 2 : Boisson énergétique (compléter eau + kcal) ──
      if (boissonsEnergie.length > 0) {
        const b = boissonsEnergie[0];
        const eauRestante = cibleEau - totalEau;
        
        if (eauRestante > 100) { // Si > 100ml manquant
          let qte = 0;
          
          if (b.itemType === "recette") {
            // Recette : calcul portions
            const volParPortion = parseFloat(b.volumeMlParPortion) || 500;
            const portions = Math.ceil(eauRestante / volParPortion);
            qte = portions;
          } else {
            // Produit : grammes = ml
            qte = Math.ceil(eauRestante / 100) * 100;
          }
          
          plan.push({ id: b.id, quantite: qte });
          const nutri = nutriProduit(b, qte);
          totalKcal += nutri.kcal;
          totalGluc += nutri.glucides;
          totalEau += nutri.eauMl;
        }
      }

      // ── Étape 3 : Solides (glucides + kcal) ──
      if (solides.length > 0) {
        const produitsUtilises = Math.min(3, solides.length); // Variété max 3
        
        for (let round = 0; round < 10; round++) { // Max 10 itérations
          const manqueKcal = cibleKcal - totalKcal;
          const manqueGluc = cibleGlucides - totalGluc;
          
          // Seuil acceptation : ±10%
          if (manqueKcal < cibleKcal * 0.1 && manqueGluc < cibleGlucides * 0.1) break;
          if (manqueKcal < 0 && manqueGluc < 0) break;
          
          // Sélectionner meilleur produit pour besoin actuel
          let bestProd = null;
          let bestScore = -Infinity;
          
          for (let p of solides.slice(0, produitsUtilises)) {
            const isProduit = p.itemType === "produit";
            const qteTest = isProduit ? 50 : 1; // 50g ou 1 portion
            const nutri = nutriProduit(p, qteTest);
            
            // Score = gain kcal + 1.5× gain glucides (priorité glucides trail)
            const gainKcal = Math.min(manqueKcal, nutri.kcal);
            const gainGluc = Math.min(manqueGluc, nutri.glucides);
            const score = gainKcal + gainGluc * 1.5;
            
            if (score > bestScore) {
              bestScore = score;
              bestProd = { prod: p, qteTest, nutri };
            }
          }
          
          if (!bestProd || bestScore <= 0) break;
          
          // Ajouter au plan
          const existing = plan.find(x => x.id === bestProd.prod.id);
          if (existing) {
            existing.quantite += bestProd.qteTest;
          } else {
            plan.push({ id: bestProd.prod.id, quantite: bestProd.qteTest });
          }
          
          totalKcal += bestProd.nutri.kcal;
          totalGluc += bestProd.nutri.glucides;
        }
      }

      // ── Étape 4 : Arrondir quantités ──
      const planFinal = plan.map(p => {
        const item = allBibItems.find(x => x.id === p.id);
        if (!item) return p;
        
        const isProduit = item.itemType === "produit";
        const arrondi = isProduit ? Math.round(p.quantite / 10) * 10 : Math.round(p.quantite);
        
        return { ...p, quantite: Math.max(arrondi, isProduit ? 10 : 1) };
      });

      newPlan[pointKey] = planFinal;
    });

    setAutoCompletePreview(newPlan);
  };

  const applyAutoComplete = () => {
    if (!autoCompletePreview) return;
    
    // Séparer depart vs ravitos
    const departItems = autoCompletePreview["depart"];
    if (departItems) {
      setProduitsDepartLocal(departItems);
    }
    
    // Batch update tous ravitos en une seule fois
    const ravitoKeys = Object.keys(autoCompletePreview).filter(k => k !== "depart");
    if (ravitoKeys.length > 0) {
      const updated = ravitos.map(rv => {
        const pointKey = String(rv.id);
        if (autoCompletePreview[pointKey]) {
          return { ...rv, produits: autoCompletePreview[pointKey] };
        }
        return rv;
      });
      updRavitos(updated);
    }
    
    setAutoCompletePreview(null);
  };

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

  // ── Plan ravitaillement ──
  const totalDist = segments.filter(s => s.type !== "ravito" && s.type !== "repos").reduce((s, seg) => Math.max(s, seg.endKm), 0);
  const bornes = [0, ...ravitos.map(r => r.km), totalDist].filter((v, i, a) => v !== a[i-1]);
  
  const zones = useMemo(() => bornes.slice(0, -1).map((from, i) => {
    const to = bornes[i + 1];
    const label = i === 0 ? "Départ" : (ravitos[i-1]?.name || `Ravito ${i}`);
    const toLbl = i === bornes.length - 2 ? "Arrivée" : (ravitos[i]?.name || `Ravito ${i+1}`);
    const pointKey = i === 0 ? "depart" : String(ravitos[i-1]?.id);
    
    const segsZ = segments.filter(s => s.type !== "ravito" && s.type !== "repos" && s.startKm < to && s.endKm > from);
    const besoin = segsZ.reduce((acc, seg) => {
      const overlap = Math.min(seg.endKm, to) - Math.max(seg.startKm, from);
      const ratio = overlap / (seg.endKm - seg.startKm || 1);
      const n = calcNutrition(seg, { ...settings, weight: userWeight });
      const dH = (seg.endKm - seg.startKm) / seg.speedKmh * ratio;
      return { 
        kcal: acc.kcal + Math.round(n.kcalH * dH), 
        eau: acc.eau + Math.round(n.eauH * dH), 
        glucides: acc.glucides + Math.round(n.glucidesH * dH) 
      };
    }, { kcal: 0, eau: 0, glucides: 0 });
    
    return { label, toLbl, from, to, pointKey, besoin, dist: to - from };
  }), [bornes, ravitos, segments, settings, userWeight]);

  const updateRavitoQte = (ravitoId, prodId, delta) => {
    // Zone départ (ravitoId = 'depart-local')
    if (ravitoId === 'depart-local') {
      const existing = produitsDepartLocal.find(p => p.id === prodId);
      if (existing) {
        const newQte = Math.max(0, (existing.quantite || 0) + delta);
        if (newQte === 0) {
          setProduitsDepartLocal(produitsDepartLocal.filter(p => p.id !== prodId));
        } else {
          setProduitsDepartLocal(produitsDepartLocal.map(p => p.id === prodId ? { ...p, quantite: newQte } : p));
        }
      } else if (delta > 0) {
        setProduitsDepartLocal([...produitsDepartLocal, { id: prodId, quantite: delta }]);
      }
      return;
    }
    
    // Ravitos normaux
    const updated = ravitos.map(rv => {
      if (rv.id !== ravitoId) return rv;
      const prods = rv.produits || [];
      const existing = prods.find(p => p.id === prodId);
      
      if (existing) {
        const newQte = Math.max(0, (existing.quantite || 0) + delta);
        if (newQte === 0) {
          return { ...rv, produits: prods.filter(p => p.id !== prodId) };
        }
        return { ...rv, produits: prods.map(p => p.id === prodId ? { ...p, quantite: newQte } : p) };
      } else if (delta > 0) {
        return { ...rv, produits: [...prods, { id: prodId, quantite: delta }] };
      }
      return rv;
    });
    updRavitos(updated);
  };

  const allBibItems = useMemo(() => {
    const prods = bibliotheque.produits.map(p=>({...p, itemType: "produit"}));
    const recs = bibliotheque.recettes.map(r=>({...r, itemType: "recette", macros: calcMacros(r)}));
    return [...prods, ...recs];
  }, [bibliotheque]);

  const card = {background:C.white,border:`1px solid ${C.border}`,borderRadius:12};
  const lbl = {fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted};

  // Nutriments hiérarchisés par importance (Tier 1 = essentiel, Tier 3 = indicatif)
  // Basé sur la science du trail : eau/glucides/sodium sont critiques, les micros sont secondaires
  const nutrientsTier1 = [
    { key: 'eau',      label: 'Eau',      unit: 'L',    factor: 1000, icon: '💧', color: C.blue },
    { key: 'kcal',     label: 'Kcal',     unit: 'kcal', factor: 1,    icon: '🔥', color: C.red },
    { key: 'glucides', label: 'Glucides', unit: 'g',    factor: 1,    icon: '🍌', color: '#1d9e75' },
    { key: 'sodium',   label: 'Sodium',   unit: 'mg',   factor: 1,    icon: '🧂', color: '#BA7517' }
  ];
  const nutrientsTier2 = [
    { key: 'proteines', label: 'Protéines', unit: 'g', factor: 1, icon: '🥩', color: '#185FA5' },
    { key: 'lipides',   label: 'Lipides',   unit: 'g', factor: 1, icon: '🥑', color: '#7F77DD' }
  ];
  const nutrientsTier3 = [
    { key: 'potassium', label: 'Potassium', unit: 'mg', factor: 1, color: C.muted },
    { key: 'magnesium', label: 'Magnésium', unit: 'mg', factor: 1, color: C.muted },
    { key: 'zinc',      label: 'Zinc',      unit: 'mg', factor: 1, color: C.muted },
    { key: 'calcium',   label: 'Calcium',   unit: 'mg', factor: 1, color: C.muted }
  ];

  // Composant carte nutriment avec besoin + planifié + progress bar
  const NutrientCard = ({ n, size = "md" }) => {
    const estime = nutriEstimes[n.key] || 0;
    const planifie = nutriPlanifies[n.key] || 0;
    const pct = calcProgress(planifie, estime);
    const col = progressColor(pct);
    const fmt = v => n.factor > 1 ? (v / n.factor).toFixed(1) : Math.round(v);
    
    const sizes = {
      lg: { padding: "14px 16px", labelFs: 10, valueFs: 22, subFs: 11, gap: 6 },
      md: { padding: "12px 14px", labelFs: 10, valueFs: 20, subFs: 11, gap: 5 }
    };
    const s = sizes[size] || sizes.md;

    return (
      <div style={{background:C.stone,borderRadius:10,padding:s.padding,border:`1.5px solid ${col}25`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:s.gap}}>
          <div style={{fontSize:s.labelFs,color:C.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em"}}>
            {n.icon && <span style={{marginRight:4}}>{n.icon}</span>}
            {n.label}
          </div>
          <div style={{fontSize:s.labelFs,fontWeight:600,color:col,fontFamily:"'DM Mono',monospace"}}>{pct}%</div>
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:s.valueFs,fontWeight:500,color:n.color,lineHeight:1,marginBottom:s.gap}}>
          {fmt(planifie)}
          <span style={{fontSize:s.subFs,color:C.muted,fontWeight:400,marginLeft:3}}>/ {fmt(estime)} {n.unit}</span>
        </div>
        {/* Progress bar */}
        <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:col,transition:"width 0.3s"}}/>
        </div>
      </div>
    );
  };

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <div style={{marginBottom:20}}>
        <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Nutrition course</h1>
        <p style={{fontSize:12,color:C.muted}}>Besoins · Apports · Bibliothèque · Plan ravitaillement</p>
      </div>

      {/* ── CALIBRATION (info de contexte) ── */}
      {(() => {
        const totalTime = segments.reduce((s, seg) => {
          if (seg.type === "ravito" || seg.type === "repos") return s;
          return s + (seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh : 0);
        }, 0);
        const kcalH = totalTime > 0 ? Math.round(nutriEstimes.kcal / totalTime) : 0;
        const glucidesH = totalTime > 0 ? Math.round(nutriEstimes.glucides / totalTime) : 0;
        return (
          <div style={{fontSize:11,color:C.muted,fontStyle:"italic",marginBottom:14}}>
            Base calibration : {kcalH} kcal/h · {glucidesH}g glucides/h {settings.glucidesTargetGh ? `(cible ${settings.glucidesTargetGh}g/h)` : "(auto)"}
          </div>
        );
      })()}

      {/* ── TIER 1 : ESSENTIEL ── */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:10}}>
          <div style={{...lbl,color:C.inkLight,fontWeight:600}}>Tier 1 · Essentiel</div>
          <div style={{fontSize:11,color:C.muted}}>Les apports critiques pour la performance et la sécurité</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
          {nutrientsTier1.map(n => <NutrientCard key={n.key} n={n} size="lg" />)}
        </div>
      </div>

      {/* ── TIER 2 : IMPORTANT ── */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:10}}>
          <div style={{...lbl,color:C.inkLight,fontWeight:600}}>Tier 2 · Important</div>
          <div style={{fontSize:11,color:C.muted}}>Le confort et l'endurance sur longue durée</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
          {nutrientsTier2.map(n => <NutrientCard key={n.key} n={n} size="md" />)}
        </div>
      </div>

      {/* ── TIER 3 : INDICATIF ── */}
      <div style={{marginBottom:30}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:10}}>
          <div style={{...lbl,color:C.inkLight,fontWeight:600}}>Tier 3 · Indicatif</div>
          <div style={{fontSize:11,color:C.muted}}>Micronutriments — non optimisés par l'algo, informatifs</div>
        </div>
        <div style={{padding:"12px 14px",background:C.stone,borderRadius:10,opacity:0.85}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:16,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
            {nutrientsTier3.map(n => {
              const estime = nutriEstimes[n.key] || 0;
              const planifie = nutriPlanifies[n.key] || 0;
              const pct = calcProgress(planifie, estime);
              return (
                <div key={n.key} style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{color:C.muted,fontFamily:"inherit"}}>{n.label}</span>
                  <span style={{color:C.inkLight}}>{Math.round(planifie)}</span>
                  <span style={{color:C.muted}}>/ {Math.round(estime)} {n.unit}</span>
                  <span style={{color:C.muted,fontSize:11,opacity:0.7}}>({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── BIBLIOTHÈQUE ── */}
      <div style={{marginBottom:30}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{...lbl}}>Bibliothèque de produits</div>
          <div style={{display:"flex",gap:8}}>
            <div style={{fontSize:11,color:C.muted,alignSelf:"center",fontStyle:"italic"}}>
              Modifs depuis Entraînement = rechargez la page
            </div>
            <Btn variant="soft" size="sm" onClick={()=>setEntrainementRecModal(true)}>📚 Mes recettes</Btn>
            <Btn variant="soft" size="sm" onClick={()=>setEntrainementProdModal(true)}>🥕 Mes produits</Btn>
            <Btn variant="soft" size="sm" onClick={()=>setCiqualModal(true)}>🔍 CIQUAL</Btn>
            <Btn size="sm" onClick={openNewProd}>+ Produit</Btn>
            <Btn size="sm" onClick={openNewRec}>+ Recette</Btn>
          </div>
        </div>

        {allBibItems.length===0?(
          <div style={{textAlign:"center",padding:"40px 20px",color:C.muted,background:C.stone,borderRadius:10}}>
            <div style={{fontSize:14,marginBottom:8}}>Bibliothèque vide</div>
            <div style={{fontSize:12}}>Ajoute des produits et recettes pour cette course</div>
          </div>
        ):(
          <div style={{...card,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"80px 1fr 60px 60px 60px 60px 60px 60px 60px 60px 60px 32px",
              padding:"7px 14px",background:C.stone,gap:8,fontSize:9,fontWeight:600,color:C.muted,
              textTransform:"uppercase",letterSpacing:"0.04em"}}>
              <span>Type</span><span>Nom</span>
              <span style={{textAlign:"right"}}>Kcal</span>
              <span style={{textAlign:"right"}}>Gluc. (g)</span>
              <span style={{textAlign:"right"}}>Prot. (g)</span>
              <span style={{textAlign:"right"}}>Lip. (g)</span>
              <span style={{textAlign:"right"}}>Na (mg)</span>
              <span style={{textAlign:"right"}}>K (mg)</span>
              <span style={{textAlign:"right"}}>Mg (mg)</span>
              <span style={{textAlign:"right"}}>Zn (mg)</span>
              <span style={{textAlign:"right"}}>Ca (mg)</span>
              <span/>
            </div>
            <div style={{maxHeight:320,overflowY:"auto"}}>
              {allBibItems.map(item=>{
                const isProd = item.itemType==="produit";
                const macros = isProd ? item : item.macros;
                return (
                  <div key={item.id} style={{display:"grid",gridTemplateColumns:"80px 1fr 60px 60px 60px 60px 60px 60px 60px 60px 60px 32px",
                    padding:"9px 14px",gap:8,borderBottom:`1px solid ${C.border}`,alignItems:"center",fontSize:12}}>
                    <span style={{fontSize:10,fontWeight:500,color:isProd?C.forest:"#7F77DD"}}>
                      {isProd?"Produit":"Recette"}
                    </span>
                    <div>
                      <div style={{fontWeight:500,color:C.inkLight,fontSize:13}}>
                        {item.nom}
                        {item.boisson&&<span style={{fontSize:10,marginLeft:6,padding:"2px 6px",background:C.bluePale,color:C.blue,borderRadius:4,fontWeight:600}}>💧</span>}
                      </div>
                      {item.categorie&&<div style={{fontSize:10,color:C.muted}}>{item.categorie}</div>}
                    </div>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#e65100",fontSize:11}}>{Math.round(macros?.kcal||0)}</span>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#1d9e75",fontSize:11}}>{Math.round(macros?.glucides||0)}</span>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#185FA5",fontSize:11}}>{Math.round(macros?.proteines||0)}</span>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:"#7F77DD",fontSize:11}}>{Math.round(macros?.lipides||0)}</span>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:10}}>{Math.round(macros?.sodium||0)}</span>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:10}}>{Math.round(macros?.potassium||0)}</span>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:10}}>{Math.round(macros?.magnesium||0)}</span>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:10}}>{Math.round(macros?.zinc||0)}</span>
                    <span style={{textAlign:"right",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:10}}>{Math.round(macros?.calcium||0)}</span>
                    <button onClick={()=>{setConfirmId(item.id);setConfirmType(item.itemType);}} 
                      style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:C.red}}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── PLAN RAVITAILLEMENT ── */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{...lbl}}>Plan de ravitaillement</div>
          <Btn variant="soft" size="sm" onClick={handleAutoComplete} disabled style={{opacity:0.4,cursor:"not-allowed"}}>🤖 Auto-compléter (bientôt)</Btn>
        </div>

        {autoCompletePreview && (
          <div style={{background:C.primaryPale,border:`1px solid ${C.primary}40`,borderRadius:14,padding:"16px 20px",marginBottom:20}}>
            <div style={{fontWeight:700,color:C.primary,marginBottom:8,fontSize:15}}>
              🪄 Proposition auto-complétion
            </div>
            <div style={{fontSize:13,color:C.primary,marginBottom:12,lineHeight:1.6}}>
              Répartition intelligente sur {zones.length} zones · Poids limite : {Math.round(userWeight * 0.12 * 10) / 10} kg
              {(() => {
                const totalKcal = Object.values(autoCompletePreview).reduce((acc, items) => {
                  return acc + items.reduce((s, { id, quantite }) => {
                    const p = allBibItems.find(x => x.id === id);
                    if (!p) return s;
                    const n = nutriProduit(p, quantite);
                    return s + n.kcal;
                  }, 0);
                }, 0);
                const totalGlu = Object.values(autoCompletePreview).reduce((acc, items) => {
                  return acc + items.reduce((s, { id, quantite }) => {
                    const p = allBibItems.find(x => x.id === id);
                    if (!p) return s;
                    const n = nutriProduit(p, quantite);
                    return s + n.glucides;
                  }, 0);
                }, 0);
                const totalEau = Object.values(autoCompletePreview).reduce((acc, items) => {
                  return acc + items.reduce((s, { id, quantite }) => {
                    const p = allBibItems.find(x => x.id === id);
                    if (!p) return s;
                    const n = nutriProduit(p, quantite);
                    return s + n.eauMl;
                  }, 0);
                }, 0);
                const pctKcal = nutriEstimes.kcal > 0 ? Math.round(totalKcal / nutriEstimes.kcal * 100) : 0;
                const pctGlu = nutriEstimes.glucides > 0 ? Math.round(totalGlu / nutriEstimes.glucides * 100) : 0;
                const pctEau = nutriEstimes.eau > 0 ? Math.round(totalEau / nutriEstimes.eau * 100) : 0;
                const color = pctKcal >= 90 && pctKcal <= 120 ? C.green : (pctKcal >= 70 ? C.yellow : C.red);
                
                return (
                  <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
                    <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                      <span><strong>{Math.round(totalKcal)} kcal</strong> <span style={{color,fontWeight:600}}>({pctKcal}%)</span></span>
                      <span><strong>{Math.round(totalGlu)}g glucides</strong> <span style={{color:pctGlu>=90&&pctGlu<=120?C.green:C.yellow,fontWeight:600}}>({pctGlu}%)</span></span>
                      <span><strong>{(totalEau/1000).toFixed(1)}L eau</strong> <span style={{color:pctEau>=80?C.green:C.yellow,fontWeight:600}}>({pctEau}%)</span></span>
                    </div>
                    {zones.map((z, zi) => {
                      const pointKey = zi === 0 ? "depart" : String(ravitos[zi - 1]?.id);
                      const items = autoCompletePreview[pointKey] || [];
                      if (items.length === 0) return null;
                      
                      const zoneKcal = items.reduce((s, { id, quantite }) => {
                        const p = allBibItems.find(x => x.id === id);
                        if (!p) return s;
                        return s + nutriProduit(p, quantite).kcal;
                      }, 0);
                      const zoneGlu = items.reduce((s, { id, quantite }) => {
                        const p = allBibItems.find(x => x.id === id);
                        if (!p) return s;
                        return s + nutriProduit(p, quantite).glucides;
                      }, 0);
                      const zPctKcal = z.besoin.kcal > 0 ? Math.round(zoneKcal / z.besoin.kcal * 100) : 0;
                      const zColor = zPctKcal >= 90 && zPctKcal <= 130 ? C.green : (zPctKcal >= 70 ? C.yellow : C.red);
                      
                      return (
                        <div key={zi} style={{fontSize:11,color:C.primary,paddingLeft:10,borderLeft:`2px solid ${C.primary}40`,marginTop:4}}>
                          <strong>{z.label}</strong>: {Math.round(zoneKcal)} kcal · {Math.round(zoneGlu)}g gluc. 
                          <span style={{color:zColor,fontWeight:600,marginLeft:6}}>({zPctKcal}%)</span>
                          <span style={{color:C.muted,marginLeft:6}}>· {items.length} produit{items.length>1?"s":""}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={applyAutoComplete}>✓ Appliquer</Btn>
              <Btn variant="ghost" onClick={()=>setAutoCompletePreview(null)}>Annuler</Btn>
            </div>
          </div>
        )}

        {zones.map((z, zi) => {
          // Zone départ = state local, autres = ravitos normaux
          const ravitoId = zi === 0 ? 'depart-local' : ravitos[zi - 1]?.id;
          const ravitoProds = zi === 0 ? produitsDepartLocal : (ravitos[zi - 1]?.produits || []);
          const isAutonome = zi > 0 && ravitos[zi - 1]?.assistancePresente === false;
          
          // Calcul plan zone
          const planZone = ravitoProds.reduce((acc, {id, quantite}) => {
            const item = allBibItems.find(x => x.id === id);
            if (!item) return acc;
            const n = nutriProduit(item, quantite);
            return {
              kcal: acc.kcal + n.kcal,
              glucides: acc.glucides + n.glucides,
              eau: acc.eau + n.eauMl
            };
          }, {kcal: 0, glucides: 0, eau: 0});
          
          return (
            <div key={zi} style={{...card,padding:16,marginBottom:12,opacity:isAutonome?0.7:1}}>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:15,fontWeight:600,color:C.inkLight,marginBottom:4}}>
                  {zi === 0 ? "🏁" : "📍"} {z.label} — {z.toLbl} · {z.dist.toFixed(1)} km
                  {isAutonome && <span style={{fontSize:11,fontWeight:500,color:C.muted,marginLeft:8,padding:"2px 8px",background:C.stone,borderRadius:6}}>⚠️ Autonome</span>}
                </div>
                <div style={{fontSize:11,color:C.muted,marginBottom:2}}>
                  <strong>Besoin :</strong> {z.besoin.kcal} kcal · {z.besoin.glucides}g glucides · {(z.besoin.eau/1000).toFixed(1)}L eau
                  {isAutonome && <span style={{marginLeft:8,fontStyle:"italic"}}>· Tout transporter</span>}
                </div>
                <div style={{fontSize:11,color:C.inkLight}}>
                  <strong>Plan :</strong> {Math.round(planZone.kcal)} kcal 
                  <span style={{color:planZone.kcal>=z.besoin.kcal*0.9&&planZone.kcal<=z.besoin.kcal*1.3?C.green:C.yellow,fontWeight:600,marginLeft:4}}>
                    ({z.besoin.kcal>0?Math.round(planZone.kcal/z.besoin.kcal*100):0}%)
                  </span> · 
                  {Math.round(planZone.glucides)}g glucides
                  <span style={{color:planZone.glucides>=z.besoin.glucides*0.9&&planZone.glucides<=z.besoin.glucides*1.3?C.green:C.yellow,fontWeight:600,marginLeft:4}}>
                    ({z.besoin.glucides>0?Math.round(planZone.glucides/z.besoin.glucides*100):0}%)
                  </span> · 
                  {(planZone.eau/1000).toFixed(1)}L eau
                  <span style={{color:planZone.eau>=z.besoin.eau*0.8?C.green:C.yellow,fontWeight:600,marginLeft:4}}>
                    ({z.besoin.eau>0?Math.round(planZone.eau/z.besoin.eau*100):0}%)
                  </span>
                </div>
              </div>

              {isAutonome ? (
                <div style={{padding:"12px 16px",background:C.stone,borderRadius:8,fontSize:12,color:C.muted,fontStyle:"italic",textAlign:"center"}}>
                  Ravito autonome — Nutrition à transporter depuis le départ ou ravito précédent
                </div>
              ) : (
                allBibItems.map(item => {
                  const existing = ravitoProds.find(p => p.id === item.id);
                  const qte = existing?.quantite || 0;
                  const isProd = item.itemType === "produit";
                  const macros = isProd ? item : item.macros;
                  
                  return (
                    <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"8px 12px",background:C.stone,borderRadius:8,marginBottom:6}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>{item.nom}</div>
                        <div style={{fontSize:11,color:C.muted}}>
                          {Math.round(macros?.kcal||0)} kcal · {Math.round(macros?.glucides||0)}g gluc. / {isProd?"100g":"portion"}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <button onClick={() => updateRavitoQte(ravitoId, item.id, -1)}
                          style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,
                            background:C.white,cursor:"pointer",fontSize:16,color:C.inkLight}}>−</button>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:500,minWidth:30,textAlign:"center"}}>{qte}</span>
                        <button onClick={() => updateRavitoQte(ravitoId, item.id, 1)}
                          style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,
                            background:C.white,cursor:"pointer",fontSize:16,color:C.inkLight}}>+</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      {/* ── MODAL PRODUIT (formulaire unifié) ── */}
      <Modal 
        open={prodModal} 
        onClose={()=>setProdModal(false)} 
        title={editProdId?"Modifier produit":"Créer produit"} 
        width={700}
        footer={<>
          <Btn variant="ghost" onClick={()=>setProdModal(false)}>Annuler</Btn>
          <Btn onClick={saveProduit}>{editProdId?"Enregistrer":"Créer"}</Btn>
        </>}
      >
        <ProduitForm form={prodForm} setForm={setProdForm} onModeChange={setProdInputMode} />
      </Modal>

      {/* ── MODAL RECETTE (formulaire unifié) ── */}
      <Modal 
        open={recModal} 
        onClose={()=>setRecModal(false)} 
        title={editRecId?"Modifier recette":"Créer recette"} 
        width={760}
        footer={<>
          <Btn variant="ghost" onClick={()=>setRecModal(false)}>Annuler</Btn>
          <Btn onClick={saveRecette}>{editRecId?"Enregistrer":"Créer"}</Btn>
        </>}
      >
        <RecetteForm
          form={recForm}
          setForm={setRecForm}
          allProduits={allProduitsForIngredients}
          onOpenCiqualIng={()=>setIngCiqualModal(true)}
          onOpenMesProduitsIng={()=>setIngMesProduitsModal(true)}
          calcMacros={calcMacros}
        />
      </Modal>

      <Modal open={ciqualModal} onClose={()=>setCiqualModal(false)} title="Base CIQUAL" width={800}>
        <div style={{marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:12}}>
            <input value={ciqualSearch} onChange={e=>setCiqualSearch(e.target.value)}
              placeholder="Rechercher..." style={{fontSize:13,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,width:"100%"}}/>
            <select value={ciqualCat} onChange={e=>setCiqualCat(e.target.value)}
              style={{padding:"8px 12px",fontSize:13,borderRadius:8,border:`1px solid ${C.border}`,minWidth:180}}>
              <option value="Toutes">Toutes</option>
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
                <Btn size="sm" onClick={()=>addFromCiqual(alim)}>＋</Btn>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal open={ingCiqualModal} onClose={()=>setIngCiqualModal(false)} title="Ajouter ingrédient CIQUAL" width={800}>
        <div style={{marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:12}}>
            <input value={ingCiqualSearch} onChange={e=>setIngCiqualSearch(e.target.value)}
              placeholder="Rechercher..." style={{fontSize:13,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,width:"100%"}}/>
            <select value={ingCiqualCat} onChange={e=>setIngCiqualCat(e.target.value)}
              style={{padding:"8px 12px",fontSize:13,borderRadius:8,border:`1px solid ${C.border}`,minWidth:180}}>
              <option value="Toutes">Toutes</option>
              {CIQUAL_CATEGORIES.map(cat=><option key={cat} value={cat}>{cat}</option>)}
            </select>
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
                </div>
                <Btn size="sm" onClick={()=>addIngredientFromCiqual(alim)}>＋</Btn>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal open={ingMesProduitsModal} onClose={()=>{setIngMesProduitsModal(false);setIngMesProduitsSearch("");}} title="Mes produits" width={700}>
        <div style={{marginBottom:16}}>
          <input value={ingMesProduitsSearch} onChange={e=>setIngMesProduitsSearch(e.target.value)}
            placeholder="Rechercher un produit..." style={{fontSize:13,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,width:"100%"}}/>
        </div>
        <div style={{maxHeight:400,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:8}}>
          {(() => {
            const filtered = allProduitsForIngredients.filter(p => {
              const terms = ingMesProduitsSearch.toLowerCase().split(" ").filter(Boolean);
              return terms.every(t => (p.nom||"").toLowerCase().includes(t));
            });
            if (filtered.length === 0) return (
              <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>Aucun résultat</div>
            );
            return filtered.map(p => (
              <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"10px 14px",borderBottom:`1px solid ${C.border}`,gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:500,color:C.inkLight,marginBottom:2}}>
                    {p.nom}
                    {p.fromEntrainement&&<span style={{fontSize:11,color:C.muted,marginLeft:6}}>(entraînement)</span>}
                  </div>
                  {p.categorie&&<div style={{fontSize:11,color:C.muted}}>{p.categorie}</div>}
                </div>
                <Btn size="sm" onClick={()=>{addIngredientFromProduit(p.id);setIngMesProduitsModal(false);setIngMesProduitsSearch("");}}>＋ Ajouter</Btn>
              </div>
            ));
          })()}
        </div>
      </Modal>

      <Modal open={entrainementRecModal} onClose={()=>setEntrainementRecModal(false)} title="Mes recettes entraînement" width={700}>
        {recettes.length===0?(
          <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>Aucune recette</div>
        ):(
          <div style={{maxHeight:500,overflowY:"auto"}}>
            {recettes.map(r=>{
              const added = bibliotheque.recettes.some(br=>br.nom===r.nom);
              return (
                <div key={r.id} style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500,color:C.inkLight}}>{r.nom}</div>
                    <div style={{fontSize:12,color:C.muted}}>{r.description||"—"}</div>
                  </div>
                  {added?(
                    <span style={{fontSize:12,color:C.muted}}>✓ Ajoutée</span>
                  ):(
                    <Btn size="sm" onClick={()=>addFromEntrainementRecettes([r.id])}>＋</Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal open={entrainementProdModal} onClose={()=>setEntrainementProdModal(false)} title="Mes produits entraînement" width={700}>
        {(() => {
          // N'importer que les produits à emporter (pas les ingrédients bruts)
          const produitsImportables = produits.filter(p => p.aEmporter !== false);
          if (produitsImportables.length === 0) {
            return <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>Aucun produit à emporter disponible</div>;
          }
          return (
            <div style={{maxHeight:500,overflowY:"auto"}}>
              {produitsImportables.map(p=>{
                const added = bibliotheque.produits.some(bp=>bp.nom===p.nom);
                return (
                  <div key={p.id} style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:500,color:C.inkLight}}>{p.nom}</div>
                      {p.categorie&&<div style={{fontSize:11,color:C.muted}}>{p.categorie}</div>}
                    </div>
                    {added?(
                      <span style={{fontSize:12,color:C.muted}}>✓ Ajouté</span>
                    ):(
                      <Btn size="sm" onClick={()=>addFromEntrainementProduits([p.id])}>＋</Btn>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog 
        open={!!confirmId} 
        message={`Supprimer ${confirmType==="produit"?"ce produit":"cette recette"} ?`}
        onConfirm={()=>confirmType==="produit"?delProduit(confirmId):delRecette(confirmId)} 
        onCancel={()=>{setConfirmId(null);setConfirmType(null);}}
      />
    </div>
  );
}
