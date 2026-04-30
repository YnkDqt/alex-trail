import { useState, useMemo } from 'react';
import { C, TYPES_BOISSON } from '../constants.js';
import { Btn, Modal, ConfirmDialog } from '../atoms.jsx';
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

const card = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12 };
const lbl = { fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted };

export default function NutritionLibrary({
  bibliotheque,
  updBibliotheque,
  produits,
  recettes,
  calcMacros
}) {
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
  const [showProdTypeErr, setShowProdTypeErr] = useState(false);
  const [showRecTypeErr, setShowRecTypeErr] = useState(false);
  const [showRecPortionErr, setShowRecPortionErr] = useState(false);

  const emptyProduit = emptyProduitNew;
  const emptyRecette = emptyRecetteNew;

  const [prodForm, setProdForm] = useState(emptyProduit());
  const [recForm, setRecForm] = useState(emptyRecette());
  const [prodInputMode, setProdInputMode] = useState("100g");
  const [ciqualSearch, setCiqualSearch] = useState("");
  const [ciqualCat, setCiqualCat] = useState("Toutes");
  const [ingCiqualModal, setIngCiqualModal] = useState(false);
  const [ingCiqualSearch, setIngCiqualSearch] = useState("");
  const [ingCiqualCat, setIngCiqualCat] = useState("Toutes");
  const [ingMesProduitsModal, setIngMesProduitsModal] = useState(false);
  const [ingMesProduitsSearch, setIngMesProduitsSearch] = useState("");

  // ── CRUD Bibliothèque ──
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
    if (!prodForm.nom.trim()) return;
    if (!prodForm.type) { setShowProdTypeErr(true); return; }
    const normalized = normalizeProduit(prodForm, prodInputMode);
    const item = { ...normalized, id: editProdId || Date.now() + Math.random() };
    if (editProdId) {
      updBibliotheque({ ...bibliotheque, produits: bibliotheque.produits.map(p => p.id === editProdId ? item : p) });
    } else {
      updBibliotheque({ ...bibliotheque, produits: [...bibliotheque.produits, item] });
    }
    setShowProdTypeErr(false);
    setProdModal(false);
  };

  const delProduit = (id) => {
    updBibliotheque({ ...bibliotheque, produits: bibliotheque.produits.filter(p => p.id !== id) });
    setConfirmId(null);
  };

  const addFromCiqual = (alim) => {
    const isBoisson = alim.c && alim.c.toLowerCase().includes("boisson");
    const newProd = {
      ...emptyProduit(),
      id: Date.now() + Math.random(), nom: alim.n,
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
    const selected = produits.filter(p => selectedIds.includes(p.id));
    const newProds = selected.map(p => ({ ...p, id: Date.now() + Math.random(), source: "entrainement" }));
    updBibliotheque({ ...bibliotheque, produits: [...bibliotheque.produits, ...newProds] });
    setEntrainementProdModal(false);
  };

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
    if (!recForm.nom.trim()) return;
    if (!recForm.type) { setShowRecTypeErr(true); return; }
    const isBoissonRec = TYPES_BOISSON.includes(recForm.type);
    const portionVal = parseFloat(isBoissonRec ? recForm.volumeMlParPortion : recForm.grammesParPortion) || 0;
    if (portionVal <= 0) { setShowRecPortionErr(true); return; }
    const normalized = normalizeRecette(recForm);
    const item = { ...normalized, id: editRecId || Date.now() + Math.random() };
    if (editRecId) {
      updBibliotheque({ ...bibliotheque, recettes: bibliotheque.recettes.map(r => r.id === editRecId ? item : r) });
    } else {
      updBibliotheque({ ...bibliotheque, recettes: [...bibliotheque.recettes, item] });
    }
    setShowRecTypeErr(false);
    setShowRecPortionErr(false);
    setRecModal(false);
  };

  const delRecette = (id) => {
    updBibliotheque({ ...bibliotheque, recettes: bibliotheque.recettes.filter(r => r.id !== id) });
    setConfirmId(null);
  };

  const toggleFavori = (item) => {
    if (item.itemType === "recette") {
      updBibliotheque({
        ...bibliotheque,
        recettes: bibliotheque.recettes.map(r => r.id === item.id ? { ...r, favori: !r.favori } : r)
      });
    } else {
      updBibliotheque({
        ...bibliotheque,
        produits: bibliotheque.produits.map(p => p.id === item.id ? { ...p, favori: !p.favori } : p)
      });
    }
  };

  const addFromEntrainementRecettes = (selectedIds) => {
    const selected = recettes.filter(r => selectedIds.includes(r.id));
    const newRecs = selected.map(r => ({ ...r, id: Date.now() + Math.random(), source: "entrainement" }));
    updBibliotheque({ ...bibliotheque, recettes: [...bibliotheque.recettes, ...newRecs] });
    setEntrainementRecModal(false);
  };

  const allProduitsForIngredients = useMemo(() => [
    ...bibliotheque.produits,
    ...produits.map(p => ({ ...p, fromEntrainement: true }))
  ], [bibliotheque.produits, produits]);

  const addIngredientFromProduit = (produitId) => {
    const exists = recForm.ingredients.find(i => i.produitId === produitId);
    if (exists) return;

    const prod = allProduitsForIngredients.find(p => p.id === produitId);
    if (prod?.fromEntrainement) {
      const newProd = { ...prod, id: Date.now() + Math.random(), fromEntrainement: undefined, source: "entrainement" };
      updBibliotheque({ ...bibliotheque, produits: [...bibliotheque.produits, newProd] });
      setRecForm(f => ({ ...f, ingredients: [...f.ingredients, { produitId: newProd.id, quantite: 100 }] }));
    } else {
      setRecForm(f => ({ ...f, ingredients: [...f.ingredients, { produitId, quantite: 100 }] }));
    }
  };

  const addIngredientFromCiqual = (alim) => {
    setRecForm(f => ({
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

  const allBibItems = useMemo(() => {
    const prods = bibliotheque.produits.map(p => ({ ...p, itemType: "produit" }));
    const recs = bibliotheque.recettes.map(r => ({ ...r, itemType: "recette", macros: calcMacros(r) }));
    return [...prods, ...recs];
  }, [bibliotheque, calcMacros]);

  const filteredCiqual = useMemo(() => {
    let results = CIQUAL;
    if (ciqualCat !== "Toutes") results = results.filter(a => a.c === ciqualCat);
    if (ciqualSearch.trim()) {
      const terms = ciqualSearch.toLowerCase().split(" ").filter(Boolean);
      results = results.filter(a => terms.every(t => (a.n || "").toLowerCase().includes(t)));
    }
    return results.slice(0, 50);
  }, [ciqualSearch, ciqualCat]);

  const filteredIngCiqual = useMemo(() => {
    let results = CIQUAL;
    if (ingCiqualCat !== "Toutes") results = results.filter(a => a.c === ingCiqualCat);
    if (ingCiqualSearch.trim()) {
      const terms = ingCiqualSearch.toLowerCase().split(" ").filter(Boolean);
      results = results.filter(a => terms.every(t => (a.n || "").toLowerCase().includes(t)));
    }
    return results.slice(0, 50);
  }, [ingCiqualSearch, ingCiqualCat]);

  return (
    <>
      {/* ── BIBLIOTHÈQUE ── */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ ...lbl }}>Bibliothèque de produits</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ fontSize: 11, color: C.muted, alignSelf: "center", fontStyle: "italic" }}>
              Modifs depuis Entraînement = rechargez la page
            </div>
            <Btn variant="soft" size="sm" onClick={() => setEntrainementRecModal(true)}>📚 Mes recettes</Btn>
            <Btn variant="soft" size="sm" onClick={() => setEntrainementProdModal(true)}>🥕 Mes produits</Btn>
            <Btn variant="soft" size="sm" onClick={() => setCiqualModal(true)}>🔍 CIQUAL</Btn>
            <Btn size="sm" onClick={openNewProd}>+ Produit</Btn>
            <Btn size="sm" onClick={openNewRec}>+ Recette</Btn>
          </div>
        </div>

        {allBibItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted, background: C.stone, borderRadius: 10 }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Bibliothèque vide</div>
            <div style={{ fontSize: 12 }}>Ajoute des produits et recettes pour cette course</div>
          </div>
        ) : (
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "80px 1fr 60px 60px 60px 60px 60px 60px 60px 60px 60px 32px",
              padding: "7px 14px", background: C.stone, gap: 8, fontSize: 9, fontWeight: 600, color: C.muted,
              textTransform: "uppercase", letterSpacing: "0.04em"
            }}>
              <span>Type</span><span>Nom</span>
              <span style={{ textAlign: "right" }}>Kcal</span>
              <span style={{ textAlign: "right" }}>Gluc. (g)</span>
              <span style={{ textAlign: "right" }}>Prot. (g)</span>
              <span style={{ textAlign: "right" }}>Lip. (g)</span>
              <span style={{ textAlign: "right" }}>Na (mg)</span>
              <span style={{ textAlign: "right" }}>K (mg)</span>
              <span style={{ textAlign: "right" }}>Mg (mg)</span>
              <span style={{ textAlign: "right" }}>Zn (mg)</span>
              <span style={{ textAlign: "right" }}>Ca (mg)</span>
              <span />
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {allBibItems.map(item => {
                const isProd = item.itemType === "produit";
                const macros = isProd ? item : item.macros;
                return (
                  <div key={item.id} style={{
                    display: "grid", gridTemplateColumns: "80px 1fr 60px 60px 60px 60px 60px 60px 60px 60px 60px 32px",
                    padding: "9px 14px", gap: 8, borderBottom: `1px solid ${C.border}`, alignItems: "center", fontSize: 12
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: isProd ? C.forest : "#7F77DD" }}>
                      {isProd ? "Produit" : "Recette"}
                    </span>
                    <div>
                      <div style={{ fontWeight: 500, color: C.inkLight, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => toggleFavori(item)}
                          title={item.favori ? "Retirer des favoris" : "Marquer comme favori (priorisé par l'algo)"}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1, color: item.favori ? "#E8B530" : C.muted, opacity: item.favori ? 1 : 0.4 }}>
                          {item.favori ? "★" : "☆"}
                        </button>
                        <span>{item.nom}</span>
                        {item.boisson && <span style={{ fontSize: 10, padding: "2px 6px", background: C.bluePale, color: C.blue, borderRadius: 4, fontWeight: 600 }}>💧</span>}
                      </div>
                      {item.categorie && <div style={{ fontSize: 10, color: C.muted }}>{item.categorie}</div>}
                    </div>
                    <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: "#e65100", fontSize: 11 }}>{Math.round(macros?.kcal || 0)}</span>
                    <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: "#1d9e75", fontSize: 11 }}>{Math.round(macros?.glucides || 0)}</span>
                    <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: "#185FA5", fontSize: 11 }}>{Math.round(macros?.proteines || 0)}</span>
                    <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: "#7F77DD", fontSize: 11 }}>{Math.round(macros?.lipides || 0)}</span>
                    <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: C.muted, fontSize: 10 }}>{Math.round(macros?.sodium || 0)}</span>
                    <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: C.muted, fontSize: 10 }}>{Math.round(macros?.potassium || 0)}</span>
                    <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: C.muted, fontSize: 10 }}>{Math.round(macros?.magnesium || 0)}</span>
                    <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: C.muted, fontSize: 10 }}>{Math.round(macros?.zinc || 0)}</span>
                    <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: C.muted, fontSize: 10 }}>{Math.round(macros?.calcium || 0)}</span>
                    <button onClick={() => { setConfirmId(item.id); setConfirmType(item.itemType); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: C.red }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL PRODUIT (formulaire unifié) ── */}
      <Modal
        open={prodModal}
        onClose={() => setProdModal(false)}
        title={editProdId ? "Modifier produit" : "Créer produit"}
        width={700}
        footer={<>
          <Btn variant="ghost" onClick={() => setProdModal(false)}>Annuler</Btn>
          <Btn onClick={saveProduit}>{editProdId ? "Enregistrer" : "Créer"}</Btn>
        </>}
      >
        <ProduitForm form={prodForm} setForm={setProdForm} onModeChange={setProdInputMode} showTypeError={showProdTypeErr} />
      </Modal>

      {/* ── MODAL RECETTE (formulaire unifié) ── */}
      <Modal
        open={recModal}
        onClose={() => setRecModal(false)}
        title={editRecId ? "Modifier recette" : "Créer recette"}
        width={760}
        footer={<>
          <Btn variant="ghost" onClick={() => setRecModal(false)}>Annuler</Btn>
          <Btn onClick={saveRecette}>{editRecId ? "Enregistrer" : "Créer"}</Btn>
        </>}
      >
        <RecetteForm
          form={recForm}
          setForm={setRecForm}
          allProduits={allProduitsForIngredients}
          onOpenCiqualIng={() => setIngCiqualModal(true)}
          onOpenMesProduitsIng={() => setIngMesProduitsModal(true)}
          calcMacros={calcMacros}
          showTypeError={showRecTypeErr}
          showPortionError={showRecPortionErr}
        />
      </Modal>

      <Modal open={ciqualModal} onClose={() => setCiqualModal(false)} title="Base CIQUAL" width={800}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 12 }}>
            <input value={ciqualSearch} onChange={e => setCiqualSearch(e.target.value)}
              placeholder="Rechercher..." style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, width: "100%" }} />
            <select value={ciqualCat} onChange={e => setCiqualCat(e.target.value)}
              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${C.border}`, minWidth: 180 }}>
              <option value="Toutes">Toutes</option>
              {CIQUAL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {filteredCiqual.length} résultat{filteredCiqual.length > 1 ? "s" : ""} {filteredCiqual.length === 50 && "(max 50)"}
          </div>
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
          {filteredCiqual.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>Aucun résultat</div>
          ) : (
            filteredCiqual.map(alim => (
              <div key={alim.n} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderBottom: `1px solid ${C.border}`, gap: 12
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.inkLight, marginBottom: 2 }}>{alim.n}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{alim.c}</div>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, marginTop: 4 }}>
                    <span style={{ color: "#e65100" }}>{Math.round(alim.e || 0)} kcal</span>
                    <span style={{ color: "#1d9e75" }}>{(alim.g || 0).toFixed(1)}g gluc.</span>
                    <span style={{ color: "#185FA5" }}>{(alim.p || 0).toFixed(1)}g prot.</span>
                    <span style={{ color: "#7F77DD" }}>{(alim.l || 0).toFixed(1)}g lip.</span>
                  </div>
                </div>
                <Btn size="sm" onClick={() => addFromCiqual(alim)}>＋</Btn>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal open={ingCiqualModal} onClose={() => setIngCiqualModal(false)} title="Ajouter ingrédient CIQUAL" width={800}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 12 }}>
            <input value={ingCiqualSearch} onChange={e => setIngCiqualSearch(e.target.value)}
              placeholder="Rechercher..." style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, width: "100%" }} />
            <select value={ingCiqualCat} onChange={e => setIngCiqualCat(e.target.value)}
              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${C.border}`, minWidth: 180 }}>
              <option value="Toutes">Toutes</option>
              {CIQUAL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
          {filteredIngCiqual.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>Aucun résultat</div>
          ) : (
            filteredIngCiqual.map(alim => (
              <div key={alim.n} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderBottom: `1px solid ${C.border}`, gap: 12
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.inkLight, marginBottom: 2 }}>{alim.n}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{alim.c}</div>
                </div>
                <Btn size="sm" onClick={() => addIngredientFromCiqual(alim)}>＋</Btn>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal open={ingMesProduitsModal} onClose={() => { setIngMesProduitsModal(false); setIngMesProduitsSearch(""); }} title="Mes produits" width={700}>
        <div style={{ marginBottom: 16 }}>
          <input value={ingMesProduitsSearch} onChange={e => setIngMesProduitsSearch(e.target.value)}
            placeholder="Rechercher un produit..." style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, width: "100%" }} />
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
          {(() => {
            const filtered = allProduitsForIngredients.filter(p => {
              const terms = ingMesProduitsSearch.toLowerCase().split(" ").filter(Boolean);
              return terms.every(t => (p.nom || "").toLowerCase().includes(t));
            });
            if (filtered.length === 0) return (
              <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>Aucun résultat</div>
            );
            return filtered.map(p => (
              <div key={p.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderBottom: `1px solid ${C.border}`, gap: 12
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.inkLight, marginBottom: 2 }}>
                    {p.nom}
                    {p.fromEntrainement && <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>(entraînement)</span>}
                  </div>
                  {p.categorie && <div style={{ fontSize: 11, color: C.muted }}>{p.categorie}</div>}
                </div>
                <Btn size="sm" onClick={() => { addIngredientFromProduit(p.id); setIngMesProduitsModal(false); setIngMesProduitsSearch(""); }}>＋ Ajouter</Btn>
              </div>
            ));
          })()}
        </div>
      </Modal>

      <Modal open={entrainementRecModal} onClose={() => setEntrainementRecModal(false)} title="Mes recettes entraînement" width={700}>
        {recettes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>Aucune recette</div>
        ) : (
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            {recettes.map(r => {
              const added = bibliotheque.recettes.some(br => br.nom === r.nom);
              return (
                <div key={r.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.inkLight }}>{r.nom}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{r.description || "—"}</div>
                  </div>
                  {added ? (
                    <span style={{ fontSize: 12, color: C.muted }}>✓ Ajoutée</span>
                  ) : (
                    <Btn size="sm" onClick={() => addFromEntrainementRecettes([r.id])}>＋</Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal open={entrainementProdModal} onClose={() => setEntrainementProdModal(false)} title="Mes produits entraînement" width={700}>
        {(() => {
          const produitsImportables = produits.filter(p => p.aEmporter !== false);
          if (produitsImportables.length === 0) {
            return <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>Aucun produit à emporter disponible</div>;
          }
          return (
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {produitsImportables.map(p => {
                const added = bibliotheque.produits.some(bp => bp.nom === p.nom);
                return (
                  <div key={p.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.inkLight }}>{p.nom}</div>
                      {p.categorie && <div style={{ fontSize: 11, color: C.muted }}>{p.categorie}</div>}
                    </div>
                    {added ? (
                      <span style={{ fontSize: 12, color: C.muted }}>✓ Ajouté</span>
                    ) : (
                      <Btn size="sm" onClick={() => addFromEntrainementProduits([p.id])}>＋</Btn>
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
        message={`Supprimer ${confirmType === "produit" ? "ce produit" : "cette recette"} ?`}
        onConfirm={() => confirmType === "produit" ? delProduit(confirmId) : delRecette(confirmId)}
        onCancel={() => { setConfirmId(null); setConfirmType(null); }}
      />
    </>
  );
}
