import { useState } from 'react';
import { C, DEFAULT_EQUIPMENT, PREP_TIMELINE } from '../constants.js';
import { Btn, Card, KPI, PageTitle, Modal } from '../atoms.jsx';

// ─── VUE PARAMÈTRES ──────────────────────────────────────────────────────────
export default function ParamètresView({ settings, setSettings, race, setRace, segments, isMobile }) {
  const upd = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const [newItem, setNewItem] = useState("");
  const [newCat, setNewCat]   = useState("Équipement");
  const [checklistModal, setChecklistModal] = useState(false);

  const equipment = settings.equipment || DEFAULT_EQUIPMENT;
  const cats = [...new Set(equipment.map(i => i.cat))];

  const toggleItem   = id => upd("equipment", equipment.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  const toggleActif  = id => upd("equipment", equipment.map(i => i.id === id ? { ...i, actif: !i.actif, checked: false } : i));
  const updEquipment = items => upd("equipment", items);
  const deleteItem   = id => upd("equipment", equipment.filter(i => i.id !== id));
  const addItem      = () => {
    if (!newItem.trim()) return;
    upd("equipment", [...equipment, { id: Date.now(), cat: newCat, label: newItem.trim(), checked: false, actif: true }]);
    setNewItem("");
  };
  const resetChecks  = () => upd("equipment", equipment.map(i => ({ ...i, checked: false })));

  const activeItems  = equipment.filter(i => i.actif !== false); // items sélectionnés pour la course
  const checkedCount = activeItems.filter(i => i.checked).length;

  const prepChecks = settings.prepChecks || {};
  const togglePrep = id => {
    const next = { ...prepChecks, [id]: !prepChecks[id] };
    upd("prepChecks", next);
  };
  const resetPrep  = () => upd("prepChecks", {});
  const [collapsedPhases, setCollapsedPhases] = useState({});
  const togglePhase = phase => setCollapsedPhases(p => ({ ...p, [phase]: !p[phase] }));

  // Poids dynamique équipement
  const poidsEquipG = activeItems.filter(i => i.emporte !== false).reduce((s, i) => s + (i.poidsG || 0), 0);
  const poidsCorporel = settings.weight || 70;
  const poidsPct = poidsEquipG > 0 ? Math.round(poidsEquipG / (poidsCorporel * 1000) * 100) : 0;
  const poidsColor = poidsPct >= 15 ? C.red : poidsPct >= 10 ? C.yellow : C.green;
  const fmtPoidsEquip = g => g >= 1000 ? `${(g/1000).toFixed(1)} kg` : `${g} g`;

  return (
    <div className="anim">
      <PageTitle sub="Checklist et équipement de course">Équipement</PageTitle>

        {/* Checklist pleine largeur */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Checklist équipement</div>
              <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>{checkedCount}/{activeItems.length} préparés</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {poidsEquipG > 0 && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: poidsColor }}>
                    {fmtPoidsEquip(poidsEquipG)}
                  </div>
                  <div style={{ fontSize: 11, color: poidsColor, fontWeight: 600 }}>
                    {poidsPct}% poids corporel {poidsPct >= 15 ? "🔴" : poidsPct >= 10 ? "⚠️" : "✅"}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <Btn size="sm" variant="ghost" onClick={resetChecks}>Tout décocher</Btn>
                <Btn size="sm" variant="soft" onClick={() => setChecklistModal(true)}>⚙️ Configurer</Btn>
              </div>
            </div>
          </div>

          {/* Barre de progression */}
          <div style={{ height: 5, background: "var(--surface-2)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3, transition: "width 0.3s",
              width: `${activeItems.length ? (checkedCount / activeItems.length) * 100 : 0}%`,
              background: checkedCount === activeItems.length && activeItems.length > 0 ? C.green : C.primary,
            }} />
          </div>

          {/* Items actifs groupés par catégorie */}
          {activeItems.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted-c)", fontSize: 13, padding: "16px 0" }}>
              Aucun item sélectionné.<br/>
              <span style={{ cursor: "pointer", color: C.primary, textDecoration: "underline" }} onClick={() => setChecklistModal(true)}>Configure ta liste</span>
            </div>
          ) : (
            <>
            {/* KPI poids emporté */}
            {(() => {
              const poidsEquip = activeItems.filter(i => i.emporte !== false).reduce((s, i) => s + (i.poidsG || 0), 0);
              return poidsEquip > 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: C.secondaryPale, borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                  <span style={{ color: "var(--muted-c)" }}>Poids équipement emporté estimé</span>
                  <span style={{ fontWeight: 700, fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.secondaryDark }}>
                    {poidsEquip >= 1000 ? `${(poidsEquip/1000).toFixed(1)} kg` : `${poidsEquip} g`}
                  </span>
                </div>
              ) : null;
            })()}
            {[...new Set(activeItems.map(i => i.cat))].map(cat => (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{cat}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {activeItems.filter(i => i.cat === cat).map(item => (
                    <div key={item.id} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                      borderRadius: 8, background: item.checked ? C.green + "14" : "var(--surface-2)",
                      transition: "background 0.15s",
                    }}>
                      {/* Checkbox coché */}
                      <div style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: "pointer",
                        border: `2px solid ${item.checked ? C.green : "var(--border-c)"}`,
                        background: item.checked ? C.green : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                      }} onClick={() => toggleItem(item.id)}>
                        {item.checked && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      {/* Label */}
                      <span style={{
                        fontSize: 13, flex: 1, cursor: "pointer",
                        color: item.checked ? "var(--muted-c)" : "var(--text-c)",
                        textDecoration: item.checked ? "line-through" : "none",
                        transition: "all 0.15s",
                      }} onClick={() => toggleItem(item.id)}>{item.label}</span>
                      {/* Toggle emporté + poids — masqués pour Ravitaillement */}
                      {item.cat !== "Ravitaillement" && (
                        <>
                          <div title={item.emporte !== false ? "Emporté sur la course" : "Laissé au drop / post-course"}
                            onClick={() => {
                              const updated = equipment.map(x => x.id === item.id ? { ...x, emporte: !(x.emporte !== false) } : x);
                              updEquipment(updated);
                            }}
                            style={{
                              fontSize: 11, cursor: "pointer", padding: "2px 7px", borderRadius: 5, userSelect: "none", flexShrink: 0,
                              background: item.emporte !== false ? C.primaryPale : "var(--surface-2)",
                              border: `1px solid ${item.emporte !== false ? C.primary + "40" : "var(--border-c)"}`,
                              color: item.emporte !== false ? C.primaryDeep : "var(--muted-c)",
                              fontWeight: 500,
                            }}>
                            {item.emporte !== false ? "Course" : "Drop"}
                          </div>
                          <input
                            type="number" min={0} max={5000} placeholder="g"
                            value={item.poidsG || ""}
                            onChange={e => {
                              const updated = equipment.map(x => x.id === item.id ? { ...x, poidsG: e.target.value === "" ? 0 : +e.target.value } : x);
                              updEquipment(updated);
                            }}
                            style={{ width: 52, fontSize: 11, textAlign: "right", padding: "3px 5px" }}
                            onClick={e => e.stopPropagation()}
                          />
                          <span style={{ fontSize: 10, color: "var(--muted-c)", flexShrink: 0 }}>g</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
          )}
        </Card>

        {/* ── CHECKLIST CHRONOLOGIQUE ── */}
        <Card style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Préparation chronologique</div>
              <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>
                {Object.values(prepChecks).filter(Boolean).length}/{PREP_TIMELINE.length} tâches accomplies
              </div>
            </div>
            <Btn size="sm" variant="ghost" onClick={resetPrep}>Tout réinitialiser</Btn>
          </div>

          {(() => {
            const phases = [...new Set(PREP_TIMELINE.map(i => i.phase))];
            const phaseColors = { "J−14": C.blue, "J−7": C.secondary, "H−48": C.yellow, "H−24": C.primary, "H−1": C.red };
            const catColors = { "Équipement": C.primary, "Nutrition": C.yellow, "Logistique": C.secondary, "Préparation": C.green };

            // Calcul du comptage par phase
            return phases.map(phase => {
              const items = PREP_TIMELINE.filter(i => i.phase === phase);
              const done  = items.filter(i => prepChecks[i.id]).length;
              const color = phaseColors[phase] || C.primary;
              const allDone = done === items.length;
              const isCollapsed = collapsedPhases[phase] !== undefined ? collapsedPhases[phase] : allDone;

              return (
                <div key={phase} style={{ marginBottom: 20 }}>
                  {/* En-tête phase — cliquable */}
                  <div onClick={() => togglePhase(phase)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isCollapsed ? 0 : 8, cursor: "pointer", userSelect: "none" }}>
                    <div style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: allDone ? C.greenPale : color + "20",
                      color: allDone ? C.green : color, flexShrink: 0,
                    }}>{phase}</div>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--surface-2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${items.length ? done/items.length*100 : 0}%`, background: allDone ? C.green : color, borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted-c)", flexShrink: 0 }}>{done}/{items.length}</span>
                    <span style={{ fontSize: 11, color: "var(--muted-c)", flexShrink: 0, transition: "transform 0.2s", display: "inline-block", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
                  </div>

                  {/* Items — masqués si replié */}
                  {!isCollapsed && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: isMobile ? 0 : 8 }}>
                      {items.map(item => {
                        const checked = !!prepChecks[item.id];
                        const catColor = catColors[item.cat] || C.muted;
                        return (
                          <div key={item.id} onClick={() => togglePrep(item.id)} style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                            borderRadius: 8, cursor: "pointer", transition: "background 0.15s",
                            background: checked ? C.greenPale : "var(--surface-2)",
                            border: `1px solid ${checked ? C.green + "40" : "var(--border-c)"}`,
                          }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                              border: `2px solid ${checked ? C.green : "var(--border-c)"}`,
                              background: checked ? C.green : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                            }}>
                              {checked && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{
                              fontSize: 13, flex: 1,
                              color: checked ? "var(--muted-c)" : "var(--text-c)",
                              textDecoration: checked ? "line-through" : "none",
                              transition: "all 0.15s",
                            }}>{item.label}</span>
                            <span style={{
                              fontSize: 10, padding: "2px 7px", borderRadius: 5, flexShrink: 0,
                              background: catColor + "20", color: catColor, fontWeight: 600,
                            }}>{item.cat}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </Card>

      {/* Modal checklist — configuration */}
      <Modal open={checklistModal} onClose={() => setChecklistModal(false)} title="Configurer ma checklist">
        <p style={{ fontSize: 13, color: "var(--muted-c)", marginBottom: 16 }}>
          Sélectionne les items que tu emportes. Seuls les items actifs apparaîtront dans ta checklist.
        </p>
        {cats.map(cat => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{cat}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {equipment.filter(i => i.cat === cat).map(item => {
                const isActif = item.actif !== false;
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    borderRadius: 9, background: isActif ? C.primaryPale : "var(--surface-2)",
                    border: `1px solid ${isActif ? C.primary + "40" : "var(--border-c)"}`,
                    cursor: "pointer", transition: "all 0.15s",
                  }} onClick={() => toggleActif(item.id)}>
                    {/* Toggle switch — distinct de la checkbox de la checklist */}
                    <div style={{
                      width: 32, height: 18, borderRadius: 9, flexShrink: 0,
                      background: isActif ? C.primary : "var(--border-c)",
                      position: "relative", transition: "background 0.2s",
                    }}>
                      <div style={{
                        position: "absolute", top: 2, left: isActif ? 14 : 2,
                        width: 14, height: 14, borderRadius: "50%", background: "#fff",
                        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                    <span style={{ fontSize: 13, flex: 1, fontWeight: isActif ? 500 : 400, color: isActif ? "var(--text-c)" : "var(--muted-c)" }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted-c)", opacity: 0.5, cursor: "pointer", padding: "0 4px" }}
                      onClick={e => { e.stopPropagation(); deleteItem(item.id); }}>✕</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border-c)", paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-c)", marginBottom: 8 }}>Ajouter un item</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={newCat} onChange={e => setNewCat(e.target.value)} style={{ flex: "0 0 auto", fontSize: 13 }}>
              {cats.map(c => <option key={c}>{c}</option>)}
              <option value="Autre">Autre</option>
            </select>
            <input value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              placeholder="Ex : Baume à lèvres..."
              style={{ flex: 1, minWidth: 120, fontSize: 13 }} />
            <Btn size="sm" onClick={addItem}>Ajouter</Btn>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn onClick={() => setChecklistModal(false)}>Fermer</Btn>
        </div>
      </Modal>
    </div>
  );
}
