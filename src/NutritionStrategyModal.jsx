import { useState, useEffect } from "react";
import { C, PRIORITES_NUTRITION, STRATEGIES_AUTONOME, NUTRITION_STRATEGY_DEFAULTS } from "./constants.js";
import { Btn, Modal, Field } from "./atoms.jsx";

// ─── HELPER : merge avec défauts ─────────────────────────────────────────────
export const getNutritionStrategy = (race) => {
  const s = race.nutritionStrategy || {};
  return {
    transport: { ...NUTRITION_STRATEGY_DEFAULTS.transport, ...(s.transport || {}) },
    hydratation: { ...NUTRITION_STRATEGY_DEFAULTS.hydratation, ...(s.hydratation || {}) },
    priorite: s.priorite || NUTRITION_STRATEGY_DEFAULTS.priorite,
    ravitos: s.ravitos || {}
  };
};

// ─── STYLES COMMUNS ──────────────────────────────────────────────────────────
const sectionTitleStyle = { fontSize: 12, fontWeight: 600, color: C.inkLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 };
const subText = { fontSize: 11, color: C.muted, fontStyle: "italic", marginBottom: 10 };

// ─── BLOC HYDRATATION ────────────────────────────────────────────────────────
function BlocHydratation({ strategy, updateStrategy }) {
  const { eauPureMl, boissonEnergetiqueMl, flasqueMl } = strategy.hydratation;
  const total = eauPureMl + boissonEnergetiqueMl;

  const setEau = (v) => updateStrategy({ ...strategy, hydratation: { ...strategy.hydratation, eauPureMl: parseInt(v) || 0 } });
  const setBoisson = (v) => updateStrategy({ ...strategy, hydratation: { ...strategy.hydratation, boissonEnergetiqueMl: parseInt(v) || 0 } });
  const setFlasque = (v) => updateStrategy({ ...strategy, hydratation: { ...strategy.hydratation, flasqueMl: parseInt(v) || 500 } });

  // Presets rapides
  const presets = [
    { label: "Tout eau", eau: 1000, boisson: 0 },
    { label: "Équilibré", eau: 500, boisson: 500 },
    { label: "Tout boisson", eau: 0, boisson: 1000 }
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={sectionTitleStyle}>Hydratation (par zone)</div>
      <div style={subText}>
        Ces volumes sont appliqués à chaque zone (départ et entre ravitos). L'algo les respectera à l'autocomplétion.
      </div>

      {/* Presets */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {presets.map(p => {
          const active = eauPureMl === p.eau && boissonEnergetiqueMl === p.boisson;
          return (
            <button
              key={p.label}
              onClick={() => updateStrategy({ ...strategy, hydratation: { ...strategy.hydratation, eauPureMl: p.eau, boissonEnergetiqueMl: p.boisson } })}
              style={{
                padding: "5px 12px", fontSize: 11, borderRadius: 6,
                border: `1px solid ${active ? C.forest : C.border}`,
                background: active ? C.forestPale : C.white,
                color: active ? C.forest : C.muted,
                cursor: "pointer", fontWeight: active ? 600 : 400
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Volumes détaillés */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end", marginBottom: 12 }}>
        <Field label="💧 Eau pure (ml)">
          <input
            type="number" min="0" step="50"
            value={eauPureMl || ""}
            onChange={e => setEau(e.target.value)}
            style={{ width: "100%" }}
          />
        </Field>
        <Field label="🥤 Boisson énergétique (ml)">
          <input
            type="number" min="0" step="50"
            value={boissonEnergetiqueMl || ""}
            onChange={e => setBoisson(e.target.value)}
            style={{ width: "100%" }}
          />
        </Field>
        <div style={{ padding: "10px 12px", background: C.stone, borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Total / zone</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: C.inkLight }}>
            {total} ml
          </div>
        </div>
      </div>

      {/* Volume flasque d'eau */}
      <div style={{ padding: "10px 12px", background: C.bluePale, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>🧴</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.inkLight }}>Volume d'une flasque d'eau</div>
          <div style={{ fontSize: 10, color: C.muted }}>
            L'algo arrondit au multiple pour que tu remplisses tes flasques en entier (au lieu de 350ml bizarres).
          </div>
        </div>
        <input
          type="number" min="100" max="2000" step="50"
          value={flasqueMl || 500}
          onChange={e => setFlasque(e.target.value)}
          style={{ width: 80 }}
        />
        <span style={{ fontSize: 11, color: C.muted }}>ml</span>
      </div>
    </div>
  );
}

// ─── BLOC TRANSPORT ──────────────────────────────────────────────────────────
function BlocTransport({ strategy, updateStrategy }) {
  const { liquideMaxMl, solideMaxG } = strategy.transport;
  const setLiquide = (v) => updateStrategy({ ...strategy, transport: { ...strategy.transport, liquideMaxMl: parseInt(v) || 0 } });
  const setSolide = (v) => updateStrategy({ ...strategy, transport: { ...strategy.transport, solideMaxG: parseInt(v) || 0 } });

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={sectionTitleStyle}>Transport max</div>
      <div style={subText}>
        Capacité maximale transportable entre deux ravitos. L'algo alertera si tu dépasses.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Liquide (ml)">
          <input
            type="number" min="0" step="100"
            value={liquideMaxMl || ""}
            onChange={e => setLiquide(e.target.value)}
            placeholder="ex: 1500 (gilet + gourdes)"
            style={{ width: "100%" }}
          />
        </Field>
        <Field label="Solide (g)">
          <input
            type="number" min="0" step="50"
            value={solideMaxG || ""}
            onChange={e => setSolide(e.target.value)}
            placeholder="ex: 500 (poches + gilet)"
            style={{ width: "100%" }}
          />
        </Field>
      </div>
    </div>
  );
}

// ─── BLOC PRIORITÉ ───────────────────────────────────────────────────────────
function BlocPriorite({ strategy, updateStrategy, settings }) {
  const setPriorite = (p) => updateStrategy({ ...strategy, priorite: p });

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={sectionTitleStyle}>Priorité globale</div>
      <div style={subText}>
        Oriente l'algo vers ton objectif principal pour cette course.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {PRIORITES_NUTRITION.map(p => {
          const active = strategy.priorite === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPriorite(p.key)}
              style={{
                padding: "12px", borderRadius: 10,
                border: `1.5px solid ${active ? C.forest : C.border}`,
                background: active ? C.forestPale : C.white,
                cursor: "pointer", textAlign: "left", fontFamily: "inherit"
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: active ? C.forest : C.inkLight, marginBottom: 3 }}>
                {p.icon} {p.label}
              </div>
              <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4 }}>
                {p.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── BLOC GLUCIDES & SUBSTRATS (cascade profil → course) ─────────────────────
function BlocGlucides({ strategy, updateStrategy, settings }) {
  const capaciteProfil = settings?.glucidesTargetGh;  // valeur coureur depuis son profil
  const overrideCourse = strategy.glucidesTargetGh;   // override pour cette course (nullable)
  const valueEffective = overrideCourse != null ? overrideCourse : capaciteProfil;  // valeur appliquée
  const utiliseOverride = overrideCourse != null;

  // Calcul des substrats (pédagogique)
  const kcalH = 400;
  const glucidesH = valueEffective != null ? valueEffective : Math.round(kcalH * 0.55 / 4);
  const proteinesH = Math.round(kcalH * 0.10 / 4);
  const lipidesH = Math.max(0, Math.round((kcalH - glucidesH * 4 - proteinesH * 4) / 9));
  const totalCalc = glucidesH * 4 + lipidesH * 9 + proteinesH * 4;
  const pctGlu = totalCalc > 0 ? Math.round(glucidesH * 4 / totalCalc * 100) : 55;
  const pctLip = totalCalc > 0 ? Math.round(lipidesH * 9 / totalCalc * 100) : 35;
  const pctPro = 100 - pctGlu - pctLip;

  const setMode = (mode) => {
    if (mode === "profil") {
      // Utiliser la valeur profil : on retire l'override
      updateStrategy({ ...strategy, glucidesTargetGh: null });
    } else {
      // Override : on initialise avec la valeur profil (ou 75 par défaut)
      updateStrategy({ ...strategy, glucidesTargetGh: capaciteProfil || 75 });
    }
  };

  const setOverrideValue = (v) => {
    const parsed = v === "" ? null : Math.max(20, Math.min(150, +v));
    updateStrategy({ ...strategy, glucidesTargetGh: parsed });
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={sectionTitleStyle}>Glucides & substrats</div>
      <div style={subText}>
        Sur une course courte tu peux pousser le débit ; sur un ultra tu le modères. Par défaut on utilise ta capacité habituelle (profil coureur).
      </div>

      {/* Choix mode */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setMode("profil")}
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 8,
            border: `1.5px solid ${!utiliseOverride ? C.forest : C.border}`,
            background: !utiliseOverride ? C.forestPale : C.white,
            cursor: "pointer", fontFamily: "inherit", textAlign: "left"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: !utiliseOverride ? C.forest : C.inkLight, marginBottom: 3 }}>
            Utiliser ma capacité habituelle
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {capaciteProfil != null ? `${capaciteProfil} g/h (profil coureur)` : "Auto (55% des kcal)"}
          </div>
        </button>
        <button
          onClick={() => setMode("override")}
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 8,
            border: `1.5px solid ${utiliseOverride ? C.forest : C.border}`,
            background: utiliseOverride ? C.forestPale : C.white,
            cursor: "pointer", fontFamily: "inherit", textAlign: "left"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: utiliseOverride ? C.forest : C.inkLight, marginBottom: 3 }}>
            Personnaliser pour cette course
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Override uniquement pour cette course
          </div>
        </button>
      </div>

      {/* Input override si activé */}
      {utiliseOverride && (
        <div style={{ padding: "10px 12px", background: C.stone, borderRadius: 8, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <input type="number" min={20} max={150}
            value={overrideCourse ?? ""}
            onChange={e => setOverrideValue(e.target.value)}
            style={{ width: 80 }} />
          <span style={{ fontSize: 11, color: C.muted }}>g/h pour cette course</span>
          <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>
            {overrideCourse == null ? "—" : overrideCourse <= 60 ? "Conservateur" : overrideCourse <= 90 ? "Standard" : "Agressif"}
          </span>
        </div>
      )}

      {/* Aperçu substrats */}
      <div style={{ padding: "10px 12px", background: C.stone, borderRadius: 8, fontSize: 11 }}>
        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Répartition substrats à ~{kcalH} kcal/h
        </div>
        <div style={{ display: "flex", gap: 0, height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
          <div style={{ width: `${pctGlu}%`, background: C.yellow, transition: "width 0.3s" }} />
          <div style={{ width: `${pctLip}%`, background: C.primary, transition: "width 0.3s" }} />
          <div style={{ width: `${pctPro}%`, background: C.secondary, transition: "width 0.3s" }} />
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: C.yellow, fontWeight: 600 }}>G {pctGlu}% <span style={{ fontWeight: 400, color: C.muted }}>({glucidesH} g/h)</span></span>
          <span style={{ color: C.primary, fontWeight: 600 }}>L {pctLip}% <span style={{ fontWeight: 400, color: C.muted }}>({lipidesH} g/h)</span></span>
          <span style={{ color: C.secondary, fontWeight: 600 }}>P {pctPro}% <span style={{ fontWeight: 400, color: C.muted }}>({proteinesH} g/h)</span></span>
        </div>
      </div>
    </div>
  );
}

// ─── BLOC RAVITOS AUTONOMES ──────────────────────────────────────────────────
function BlocRavitosAutonomes({ strategy, updateStrategy, ravitos }) {
  // On identifie les "zones autonomes" : une zone est autonome si le ravito qui la PRÉCÈDE est sans assistance
  // (c'est-à-dire que pendant cette zone, le coureur ne peut pas compter sur son équipe)
  // Note : pour simplifier, on associe la stratégie à l'ID du ravito précédent
  const ravitosAutonomesPrecedents = ravitos.filter(rv => rv.assistancePresente === false);

  if (ravitosAutonomesPrecedents.length === 0) {
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={sectionTitleStyle}>Zones autonomes</div>
        <div style={{ padding: "10px 12px", background: C.stone, borderRadius: 8, fontSize: 12, color: C.muted }}>
          Aucun ravito autonome défini sur cette course. Tous les ravitos ont de l'assistance.
        </div>
      </div>
    );
  }

  const setStrategie = (ravitoId, strat) => {
    updateStrategy({
      ...strategy,
      ravitos: { ...strategy.ravitos, [ravitoId]: { strategieAutonome: strat } }
    });
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={sectionTitleStyle}>Zones autonomes</div>
      <div style={subText}>
        Pour chaque ravito sans assistance, choisis comment tu gères la zone qui suit.
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {ravitosAutonomesPrecedents.map(rv => {
          const currentStrat = strategy.ravitos[rv.id]?.strategieAutonome || "porter";
          return (
            <div key={rv.id} style={{ padding: "10px 12px", background: C.stone, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.inkLight, marginBottom: 8 }}>
                {rv.nom || `Ravito km ${rv.km}`} · km {rv.km}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {STRATEGIES_AUTONOME.map(s => {
                  const active = currentStrat === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setStrategie(rv.id, s.key)}
                      title={s.desc}
                      style={{
                        padding: "6px 10px", fontSize: 11, borderRadius: 6,
                        border: `1px solid ${active ? C.forest : C.border}`,
                        background: active ? C.forestPale : C.white,
                        color: active ? C.forest : C.muted,
                        cursor: "pointer", fontWeight: active ? 600 : 400,
                        fontFamily: "inherit"
                      }}
                    >
                      {s.icon} {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MODAL PRINCIPAL ─────────────────────────────────────────────────────────
export default function NutritionStrategyModal({ open, onClose, race, setRace, ravitos, settings }) {
  const [localStrategy, setLocalStrategy] = useState(() => getNutritionStrategy(race));

  // Re-sync à chaque ouverture (au cas où la course changerait entre 2 ouvertures)
  useEffect(() => {
    if (open) setLocalStrategy(getNutritionStrategy(race));
  }, [open, race]);

  const handleSave = () => {
    setRace(r => ({ ...r, nutritionStrategy: localStrategy }));
    onClose();
  };

  const handleReset = () => {
    setLocalStrategy({ ...NUTRITION_STRATEGY_DEFAULTS, ravitos: {} });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="⚙️ Stratégie nutrition"
      subtitle="Paramètres qui guideront l'algorithme d'autocomplétion"
      width={720}
      footer={<>
        <Btn variant="ghost" onClick={handleReset}>↺ Défauts</Btn>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
        <Btn onClick={handleSave}>Enregistrer</Btn>
      </>}
    >
      <BlocHydratation strategy={localStrategy} updateStrategy={setLocalStrategy} />
      <BlocTransport strategy={localStrategy} updateStrategy={setLocalStrategy} />
      <BlocGlucides strategy={localStrategy} updateStrategy={setLocalStrategy} settings={settings} />
      <BlocPriorite strategy={localStrategy} updateStrategy={setLocalStrategy} settings={settings} />
      <BlocRavitosAutonomes strategy={localStrategy} updateStrategy={setLocalStrategy} ravitos={ravitos} />
    </Modal>
  );
}
