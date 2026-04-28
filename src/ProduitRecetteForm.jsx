import { useState } from "react";
import { 
  C, 
  PRODUIT_TYPES, 
  PRODUIT_UNITES, 
  TEXTURES, 
  TOLERANCES, 
  SOURCES_GLUCIDES, 
  PHASES_COURSE,
  TYPES_BOISSON
} from "./constants.js";
import { Btn, Field } from "./atoms.jsx";

// ─── EMPTY STATES ────────────────────────────────────────────────────────────
export const emptyProduit = () => ({
  id: Date.now()+Math.random(),
  nom: "",
  type: "",
  categorie: "",
  kcal: "", glucides: "", proteines: "", lipides: "", sodium: "",
  potassium: "", magnesium: "", zinc: "", calcium: "",
  unite: "",
  grammesParUnite: "",
  volumeMlParUnite: "",
  texture: "",
  tolerance: "",
  sourceGlucides: "",
  phaseCourse: "",
  notes: "",
  boisson: false,
  source: "perso",
  aEmporter: true
});

export const emptyRecette = () => ({
  id: Date.now()+Math.random(),
  nom: "",
  type: "",
  description: "",
  portions: 1,
  grammesParPortion: "",
  ingredients: [],
  notes: "",
  boisson: false,
  volumeMlParPortion: "",
  texture: "",
  tolerance: "",
  phaseCourse: ""
});

// ─── MIGRATION LEGACY ────────────────────────────────────────────────────────
// Infère le type d'un produit existant qui n'a pas encore le champ `type`
export const inferType = (p) => {
  if (p.type) return p.type;
  if (p.boisson) {
    return (p.nom || "").toLowerCase().includes("eau") ? "Eau pure" : "Boisson énergétique";
  }
  return "";
};

// ─── STYLES COMMUNS ──────────────────────────────────────────────────────────
const inputStyle = { width: "100%" };
const smallLabel = { fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted };
const sectionHeaderStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px", background: C.stone, borderRadius: 8, cursor: "pointer",
  marginBottom: 12, userSelect: "none"
};
const sectionTitleStyle = { fontSize: 12, fontWeight: 600, color: C.inkLight, textTransform: "uppercase", letterSpacing: "0.05em" };
const optionalBadge = { fontSize: 10, color: C.muted, marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0 };

// ─── BLOC COLLAPSIBLE ────────────────────────────────────────────────────────
function Section({ title, optional, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={sectionHeaderStyle} onClick={() => setOpen(!open)}>
        <div style={sectionTitleStyle}>
          {title}
          {optional && <span style={optionalBadge}>(optionnel)</span>}
        </div>
        <span style={{ fontSize: 14, color: C.muted }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && <div style={{ padding: "0 4px" }}>{children}</div>}
    </div>
  );
}

// ─── SELECT STYLE UNIFIÉ ─────────────────────────────────────────────────────
function Select({ value, onChange, options, placeholder = "—", full = true, error = false }) {
  return (
    <select value={value || ""} onChange={e => onChange(e.target.value)}
      style={{ width: full ? "100%" : undefined, borderColor: error ? C.red : undefined }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── FORMULAIRE PRODUIT ─────────────────────────────────────────────────────
// props :
//  - form, setForm : state du formulaire
//  - onModeChange : callback(mode) appelé à chaque changement de mode de saisie
//    Le parent doit stocker ce mode dans son state et le passer à normalizeProduit(form, mode) au save.
export function ProduitForm({ form, setForm, onModeChange, showTypeError = false }) {
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Mode de saisie : 100g ou unité (state local, non persisté)
  const [mode, setModeLocal] = useState("100g");
  const setMode = (m) => {
    setModeLocal(m);
    if (onModeChange) onModeChange(m);
  };

  // Poids unitaire (obligatoire si mode = unite)
  const poidsUnit = parseFloat(form.grammesParUnite) || 0;

  // Helpers conversion pour affichage dynamique
  const convertTo100g = (val) => {
    if (!poidsUnit || !val) return "";
    return Math.round((parseFloat(val) * 100 / poidsUnit) * 10) / 10;
  };

  // Détection type boisson pour afficher volumeMlParUnite
  // La synchro avec `form.boisson` se fait dans normalizeProduit au save
  const isBoisson = TYPES_BOISSON.includes(form.type);

  const macrosFields = [
    { k: "kcal", label: "Kcal", unit: "kcal", required: true },
    { k: "glucides", label: "Glucides", unit: "g", required: true },
    { k: "proteines", label: "Protéines", unit: "g" },
    { k: "lipides", label: "Lipides", unit: "g" },
    { k: "sodium", label: "Sodium", unit: "mg", required: true }
  ];

  const microsFields = [
    { k: "potassium", label: "Potassium", unit: "mg" },
    { k: "magnesium", label: "Magnésium", unit: "mg" },
    { k: "zinc", label: "Zinc", unit: "mg" },
    { k: "calcium", label: "Calcium", unit: "mg" }
  ];

  return (
    <div>
      {/* ── SECTION 1 : IDENTITÉ (toujours visible) ────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Nom *" full>
            <input value={form.nom} onChange={e => upd("nom", e.target.value)} placeholder="ex: Gel SIS Go" style={inputStyle} />
          </Field>
          <Field label="Type *">
            <Select value={form.type} onChange={v => upd("type", v)} options={PRODUIT_TYPES} placeholder="— Choisir —" error={showTypeError && !form.type} />
          </Field>
          <Field label="Catégorie">
            <input value={form.categorie} onChange={e => upd("categorie", e.target.value)} placeholder="ex: Gels / Barres / Maison" style={inputStyle} />
          </Field>
        </div>

        {/* Toggle : produit à emporter en course ou ingrédient uniquement */}
        <div style={{ marginTop: 12, padding: 12, background: C.stone, borderRadius: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.aEmporter !== false}
              onChange={e => upd("aEmporter", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.inkLight }}>Je mange ce produit tel quel en course</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                Décoche si ce n'est qu'un ingrédient pour tes recettes (ex: jus de citron, miel brut)
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* ── SECTION 2 : NUTRITION (toujours visible) ───────────────── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...sectionTitleStyle, marginBottom: 10 }}>Nutrition *</div>

        {/* Toggle mode de saisie */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.muted }}>Je renseigne pour :</span>
          <button
            onClick={() => setMode("100g")}
            style={{
              padding: "6px 12px", fontSize: 12, borderRadius: 6,
              border: `1px solid ${mode === "100g" ? C.forest : C.border}`,
              background: mode === "100g" ? C.forestPale : C.white,
              color: mode === "100g" ? C.forest : C.muted,
              cursor: "pointer", fontWeight: mode === "100g" ? 600 : 400
            }}
          >
            100 g / 100 ml
          </button>
          <button
            onClick={() => setMode("unite")}
            style={{
              padding: "6px 12px", fontSize: 12, borderRadius: 6,
              border: `1px solid ${mode === "unite" ? C.forest : C.border}`,
              background: mode === "unite" ? C.forestPale : C.white,
              color: mode === "unite" ? C.forest : C.muted,
              cursor: "pointer", fontWeight: mode === "unite" ? 600 : 400
            }}
          >
            1 unité
          </button>
        </div>

        {/* Poids unitaire (si mode unite) */}
        {mode === "unite" && (
          <div style={{ marginBottom: 12, padding: 10, background: C.forestPale, borderRadius: 6 }}>
            <Field label="Poids d'une unité (g) *" full>
              <input
                type="number" min="0" step="1"
                value={form.grammesParUnite || ""}
                onChange={e => upd("grammesParUnite", e.target.value)}
                placeholder="ex: 40 (1 gel = 40g)"
                style={inputStyle}
              />
            </Field>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
              Les valeurs ci-dessous seront converties automatiquement pour 100g en base.
            </div>
          </div>
        )}

        {/* Macros */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {macrosFields.map(({ k, label, unit, required }) => (
            <Field key={k} label={`${label}${required ? " *" : ""} (${unit})`}>
              <input
                type="number" min="0" step="0.1"
                value={form[k] || ""}
                onChange={e => upd(k, e.target.value)}
                style={inputStyle}
              />
              {mode === "unite" && form[k] && poidsUnit > 0 && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                  soit {convertTo100g(form[k])} {unit} / 100g
                </div>
              )}
            </Field>
          ))}
        </div>
      </div>

      {/* ── SECTION 3 : FORMAT UNITAIRE (repliable) ────────────────── */}
      <Section title="Format unitaire" optional defaultOpen={mode === "unite"}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
          Permet à l'algo de proposer "2 gels" au lieu de "80g de gel" en course.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Unité">
            <Select value={form.unite} onChange={v => upd("unite", v)} options={PRODUIT_UNITES} />
          </Field>
          <Field label="Poids / unité (g)">
            <input
              type="number" min="0" step="1"
              value={form.grammesParUnite || ""}
              onChange={e => upd("grammesParUnite", e.target.value)}
              style={inputStyle}
            />
          </Field>
          {isBoisson && (
            <Field label="Volume / unité (ml)">
              <input
                type="number" min="0" step="10"
                value={form.volumeMlParUnite || ""}
                onChange={e => upd("volumeMlParUnite", e.target.value)}
                style={inputStyle}
              />
            </Field>
          )}
        </div>
      </Section>

      {/* ── SECTION 4 : USAGE & TOLÉRANCE (repliable) ──────────────── */}
      <Section title="Usage & tolérance" optional>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Texture">
            <Select value={form.texture} onChange={v => upd("texture", v)} options={TEXTURES} />
          </Field>
          <Field label="Tolérance personnelle">
            <Select value={form.tolerance} onChange={v => upd("tolerance", v)} options={TOLERANCES} />
          </Field>
          <Field label="Source glucides">
            <Select value={form.sourceGlucides} onChange={v => upd("sourceGlucides", v)} options={SOURCES_GLUCIDES} />
          </Field>
          <Field label="Phase conseillée">
            <Select value={form.phaseCourse} onChange={v => upd("phaseCourse", v)} options={PHASES_COURSE} />
          </Field>
        </div>
      </Section>

      {/* ── SECTION 5 : MICRONUTRIMENTS (repliable) ────────────────── */}
      <Section title="Micronutriments" optional>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {microsFields.map(({ k, label, unit }) => (
            <Field key={k} label={`${label} (${unit})`}>
              <input
                type="number" min="0" step="0.1"
                value={form[k] || ""}
                onChange={e => upd(k, e.target.value)}
                style={inputStyle}
              />
              {mode === "unite" && form[k] && poidsUnit > 0 && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                  soit {convertTo100g(form[k])} {unit} / 100g
                </div>
              )}
            </Field>
          ))}
        </div>
      </Section>

      {/* ── SECTION 6 : NOTES (repliable) ──────────────────────────── */}
      <Section title="Notes" optional>
        <textarea
          value={form.notes || ""}
          onChange={e => upd("notes", e.target.value)}
          placeholder="Remarques, sensations, marque..."
          style={{ ...inputStyle, minHeight: 60 }}
        />
      </Section>
    </div>
  );
}

// ─── NORMALISATION À LA SAUVEGARDE ───────────────────────────────────────────
// Convertit les valeurs unitaires en 100g pour stockage en base
// mode : "100g" (défaut) ou "unite" — passé explicitement depuis le formulaire
export function normalizeProduit(form, mode = "100g") {
  const poidsUnit = parseFloat(form.grammesParUnite) || 0;

  // Si mode unite et poids unitaire valide, convertir
  const factor = (mode === "unite" && poidsUnit > 0) ? (100 / poidsUnit) : 1;

  const numField = (k) => (parseFloat(form[k]) || 0) * factor;

  return {
    ...form,
    kcal: Math.round(numField("kcal") * 10) / 10,
    glucides: Math.round(numField("glucides") * 10) / 10,
    proteines: Math.round(numField("proteines") * 10) / 10,
    lipides: Math.round(numField("lipides") * 10) / 10,
    sodium: Math.round(numField("sodium") * 10) / 10,
    potassium: Math.round(numField("potassium") * 10) / 10,
    magnesium: Math.round(numField("magnesium") * 10) / 10,
    zinc: Math.round(numField("zinc") * 10) / 10,
    calcium: Math.round(numField("calcium") * 10) / 10,
    grammesParUnite: parseFloat(form.grammesParUnite) || 0,
    volumeMlParUnite: parseFloat(form.volumeMlParUnite) || 0,
    boisson: TYPES_BOISSON.includes(form.type)
  };
}

// ─── CHARGEMENT POUR ÉDITION ─────────────────────────────────────────────────
// Reconstitue le form depuis un produit stocké (toujours en 100g en base)
// Le mode de saisie est toujours "100g" à l'ouverture — l'utilisateur peut basculer s'il veut
export function loadProduitForEdit(p) {
  return {
    ...emptyProduit(),
    ...p,
    type: p.type || inferType(p)
  };
}

// ─── FORMULAIRE RECETTE ─────────────────────────────────────────────────────
// props :
//  - form : state du formulaire
//  - setForm : setter
//  - allProduits : liste des produits disponibles pour ingrédients (biblio + CIQUAL résolu)
//  - onOpenCiqualIng : callback pour ouvrir la modal CIQUAL (ajout ingrédient)
//  - onOpenMesProduitsIng : callback pour ouvrir la modal Mes produits (ajout ingrédient)
export function RecetteForm({ form, setForm, allProduits = [], onOpenCiqualIng, onOpenMesProduitsIng, calcMacros, showTypeError = false, showPortionError = false }) {
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isBoisson = TYPES_BOISSON.includes(form.type);

  const removeIngredient = (idx) => {
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
  };
  const updateIngQte = (idx, qte) => {
    setForm(f => ({ ...f, ingredients: f.ingredients.map((ing, i) => i === idx ? { ...ing, quantite: parseFloat(qte) || 0 } : ing) }));
  };

  const macros = calcMacros ? calcMacros(form) : null;

  // Poids total des ingrédients (somme des quantités en g)
  const poidsTotal = (form.ingredients || []).reduce((sum, ing) => sum + (parseFloat(ing.quantite) || 0), 0);
  
  // Estimation du poids/volume par portion en se basant sur les ingrédients
  const portions = parseInt(form.portions) || 1;
  const estimParPortion = Math.round(poidsTotal / portions);

  return (
    <div>
      {/* ── SECTION 1 : IDENTITÉ ───────────────────────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Nom *" full>
            <input value={form.nom} onChange={e => upd("nom", e.target.value)} placeholder="ex: Energy balls maison" style={inputStyle} />
          </Field>
          <Field label="Type *">
            <Select value={form.type} onChange={v => upd("type", v)} options={PRODUIT_TYPES} placeholder="— Choisir —" error={showTypeError && !form.type} />
          </Field>
          <Field label="Portions">
            <input type="number" min="1" value={form.portions} onChange={e => upd("portions", e.target.value)} style={inputStyle} />
          </Field>
          <Field label={isBoisson ? "Volume / portion (ml) *" : "Poids / portion (g) *"}>
            <input 
              type="number" min="0" step={isBoisson ? "10" : "1"}
              value={isBoisson ? (form.volumeMlParPortion || "") : (form.grammesParPortion || "")}
              onChange={e => upd(isBoisson ? "volumeMlParPortion" : "grammesParPortion", e.target.value)}
              placeholder={isBoisson ? "ex: 500" : "ex: 40 (1 ball = 40g)"}
              style={{
                ...inputStyle,
                ...(showPortionError && !(parseFloat(isBoisson ? form.volumeMlParPortion : form.grammesParPortion) > 0)
                  ? { borderColor: C.red }
                  : {})
              }}
            />
            {poidsTotal > 0 && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                ≈ {estimParPortion}{isBoisson ? "ml" : "g"}/portion selon vos ingrédients
              </div>
            )}
          </Field>
          <Field label="Description" full>
            <textarea value={form.description || ""} onChange={e => upd("description", e.target.value)}
              placeholder="Courte description..." style={{ ...inputStyle, minHeight: 50 }} />
          </Field>
        </div>
      </div>

      {/* ── SECTION 2 : INGRÉDIENTS ────────────────────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={sectionTitleStyle}>Ingrédients</div>
          {poidsTotal > 0 && (
            <div style={{ fontSize: 12, color: C.muted }}>
              Total : <span style={{ fontWeight: 600, color: C.inkLight, fontFamily: "'DM Mono',monospace" }}>{poidsTotal}g</span>
            </div>
          )}
        </div>
        {form.ingredients.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, background: C.stone, borderRadius: 8, color: C.muted, fontSize: 13 }}>
            Aucun ingrédient ajouté
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {form.ingredients.map((ing, idx) => {
              // Chercher le nom : d'abord dans _ciqualData (ingrédient CIQUAL inline),
              // sinon dans la bibliothèque produits (ingrédient perso)
              const nom = ing._ciqualData?.nom || allProduits.find(p => p.id === ing.produitId)?.nom || "Produit inconnu";
              return (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", padding: 8, background: C.stone, borderRadius: 6 }}>
                  <span style={{ flex: 1, fontSize: 13, color: C.inkLight }}>{nom}</span>
                  <input type="number" min="0" step="1" value={ing.quantite} onChange={e => updateIngQte(idx, e.target.value)}
                    style={{ width: 80, padding: "4px 8px", fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}`, textAlign: "right" }} />
                  <span style={{ fontSize: 12, color: C.muted }}>g</span>
                  <button onClick={() => removeIngredient(idx)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: C.red }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {onOpenCiqualIng && <Btn variant="soft" onClick={onOpenCiqualIng}>🔍 Base CIQUAL</Btn>}
          {onOpenMesProduitsIng && <Btn variant="soft" onClick={onOpenMesProduitsIng}>🥕 Mes produits</Btn>}
        </div>
      </div>

      {/* ── SECTION 3 : TOTAL CALCULÉ (si ingrédients présents) ────── */}
      {form.ingredients.length > 0 && macros && (
        <div style={{ padding: 12, background: C.stone, borderRadius: 8, marginBottom: 18 }}>
          <div style={{ ...smallLabel, marginBottom: 6 }}>Total recette</div>
          <div style={{ display: "flex", gap: 12, fontSize: 13, flexWrap: "wrap" }}>
            <span style={{ color: "#e65100", fontWeight: 500 }}>{macros.kcal} kcal</span>
            <span style={{ color: "#1d9e75" }}>{macros.glucides}g gluc.</span>
            <span style={{ color: "#185FA5" }}>{macros.proteines}g prot.</span>
            <span style={{ color: "#7F77DD" }}>{macros.lipides}g lip.</span>
            {macros.sodium != null && <span style={{ color: "#BA7517" }}>{macros.sodium}mg Na</span>}
          </div>
        </div>
      )}

      {/* ── SECTION 5 : USAGE (repliable) ──────────────────────────── */}
      <Section title="Usage & tolérance" optional>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Texture">
            <Select value={form.texture} onChange={v => upd("texture", v)} options={TEXTURES} />
          </Field>
          <Field label="Tolérance personnelle">
            <Select value={form.tolerance} onChange={v => upd("tolerance", v)} options={TOLERANCES} />
          </Field>
          <Field label="Phase conseillée">
            <Select value={form.phaseCourse} onChange={v => upd("phaseCourse", v)} options={PHASES_COURSE} />
          </Field>
        </div>
      </Section>

      {/* ── SECTION 6 : NOTES (repliable) ──────────────────────────── */}
      <Section title="Notes" optional>
        <textarea value={form.notes || ""} onChange={e => upd("notes", e.target.value)}
          placeholder="Instructions, remarques..." style={{ ...inputStyle, minHeight: 60 }} />
      </Section>
    </div>
  );
}

// ─── NORMALISATION RECETTE ───────────────────────────────────────────────────
export function normalizeRecette(form) {
  return {
    ...form,
    portions: parseInt(form.portions) || 1,
    grammesParPortion: parseFloat(form.grammesParPortion) || 0,
    volumeMlParPortion: parseFloat(form.volumeMlParPortion) || 0,
    boisson: TYPES_BOISSON.includes(form.type)
  };
}

// ─── CHARGEMENT RECETTE POUR ÉDITION ─────────────────────────────────────────
export function loadRecetteForEdit(r) {
  return {
    ...emptyRecette(),
    ...r,
    type: r.type || (r.boisson ? "Boisson énergétique" : "")
  };
}

