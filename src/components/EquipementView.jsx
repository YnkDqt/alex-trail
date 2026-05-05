import { useState, useMemo } from 'react';
import { C, DEFAULT_EQUIPMENT, PREP_TIMELINE } from '../constants.js';
import { Btn, Card, PageTitle, Modal } from '../atoms.jsx';

// ─── HELPERS MIGRATION ───────────────────────────────────────────────────
// Items historiques sans usage/type → inférence depuis cat (usage) et label (type).
// Aucune donnée perdue. Les nouveaux items utilisent les selects.
const inferUsage = item => {
  if (item.usage) return item.usage;
  const cat = (item.cat || "").toLowerCase();
  if (cat === "ravitaillement") return "ravito";
  if (cat === "préparation" || cat === "preparation") return "pre_course";
  return "course";
};
const inferType = item => {
  if (item.type) return item.type;
  const l = (item.label || "").toLowerCase();
  if (l.includes("bâton") || l.includes("baton")) return "batons";
  if (l.includes("veste") || l.includes("imper") || l.includes("k-way") || l.includes("goretex")) return "imper";
  return "autre";
};

const USAGES = [
  { key: "course",     label: "Course",         desc: "Sur le coureur pendant la course (compté dans le poids algo)" },
  { key: "ravito",     label: "Ravitaillement", desc: "Drop bags / chez l'équipe aux ravitos" },
  { key: "pre_course", label: "Pré-course",     desc: "À préparer avant (papiers, transport, logement)" },
];
const TYPES_ALGO = [
  { key: "autre",  label: "Autre",  desc: "Aucun effet algo spécifique" },
  { key: "batons", label: "Bâtons", desc: "+3% en montée ≥ 5%" },
  { key: "imper",  label: "Imper",  desc: "-10% si pluie active" },
];

// Calcule la phase actuelle depuis la date de course
function computePhaseFromRaceDate(raceDate) {
  if (!raceDate) return null;
  const now = new Date();
  const d = new Date(raceDate);
  if (isNaN(d.getTime())) return null;
  const diffH = (d - now) / (1000 * 60 * 60);
  const diffD = diffH / 24;
  if (diffH < 0)   return { phase: "course", label: "Course en cours ou passée" };
  if (diffH <= 1)  return { phase: "H−1",  label: "H-1" };
  if (diffH <= 24) return { phase: "H−24", label: `H-${Math.round(diffH)}` };
  if (diffH <= 48) return { phase: "H−48", label: `H-${Math.round(diffH)}` };
  if (diffD <= 7)  return { phase: "J−7",  label: `J-${Math.round(diffD)}` };
  if (diffD <= 14) return { phase: "J−14", label: `J-${Math.round(diffD)}` };
  return { phase: "J−30", label: `J-${Math.round(diffD)}` };
}

const PHASES_ORDER = ["J−30", "J−14", "J−7", "H−48", "H−24", "H−1", "course"];
const PHASES_LABELS = { "J−30": "J-30", "J−14": "J-14", "J−7": "J-7", "H−48": "H-48", "H−24": "H-24", "H−1": "H-1", "course": "Course" };

export default function EquipementView({ settings, setSettings, race, setRace, segments, isMobile }) {
  const upd = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const updRace = (k, v) => setRace(r => ({ ...r, [k]: v }));
  const [gearModal, setGearModal] = useState(false);
  const [gearTab, setGearTab] = useState("course");
  const openGear = (tab = "course") => { setGearTab(tab); setGearModal(true); };
  const [newItem, setNewItem] = useState("");
  const [newUsage, setNewUsage] = useState("course");
  const [newType, setNewType] = useState("autre");
  const [newPoidsG, setNewPoidsG] = useState("");

  // Items normalisés (usage/type inférés si manquants)
  const equipment = (settings.equipment || DEFAULT_EQUIPMENT).map(it => ({
    ...it,
    usage: inferUsage(it),
    type: inferType(it),
  }));

  // Sélection par course (equipementEmportes = array d'IDs).
  // Migration douce : si l'array n'existe pas sur la race, on le pré-remplit
  // avec les items historiquement actifs ET emportés (ancienne logique).
  const equipementEmportes = useMemo(() => {
    if (Array.isArray(race?.equipementEmportes)) return race.equipementEmportes;
    return equipment.filter(e => e.actif !== false && e.emporte !== false).map(e => e.id);
  }, [race?.equipementEmportes, equipment]);
  const isEmported = id => equipementEmportes.includes(id);
  const toggleEmporte = id => {
    const next = isEmported(id) ? equipementEmportes.filter(x => x !== id) : [...equipementEmportes, id];
    updRace("equipementEmportes", next);
  };

  const toggleItem    = id => upd("equipment", equipment.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  const toggleActif   = id => {
    const item = equipment.find(i => i.id === id);
    const newActif = !(item?.actif !== false);
    upd("equipment", equipment.map(i => i.id === id ? { ...i, actif: newActif, checked: false } : i));
    // Si désactivé : retirer de la course. Si réactivé : ne pas auto-ajouter (l'utilisateur choisit).
    if (!newActif && isEmported(id)) updRace("equipementEmportes", equipementEmportes.filter(x => x !== id));
  };
  const updItemField  = (id, field, val) => upd("equipment", equipment.map(i => i.id === id ? { ...i, [field]: val } : i));
  const deleteItem    = id => {
    upd("equipment", equipment.filter(i => i.id !== id));
    if (isEmported(id)) updRace("equipementEmportes", equipementEmportes.filter(x => x !== id));
  };
  const addItem = () => {
    if (!newItem.trim()) return;
    const id = Date.now();
    upd("equipment", [...equipment, {
      id,
      label: newItem.trim(),
      usage: newUsage,
      type: newUsage === "course" ? newType : "autre",
      poidsG: parseInt(newPoidsG) || 0,
      checked: false, actif: true,
    }]);
    // Nouveau item ajouté → automatiquement emporté pour cette course
    updRace("equipementEmportes", [...equipementEmportes, id]);
    setNewItem(""); setNewPoidsG(""); setNewType("autre");
  };
  const resetChecks = () => upd("equipment", equipment.map(i => ({ ...i, checked: false })));

  // Items "à emporter" sur cette course = actifs ET dans equipementEmportes
  const activeItems = equipment.filter(i => i.actif !== false && isEmported(i.id));
  const checkedCount = activeItems.filter(i => i.checked).length;

  // Tâches timeline
  const prepChecks = settings.prepChecks || {};
  const togglePrep = id => upd("prepChecks", { ...prepChecks, [id]: !prepChecks[id] });
  const [collapsedPhases, setCollapsedPhases] = useState({});
  const togglePhase = phase => setCollapsedPhases(p => ({ ...p, [phase]: !p[phase] }));

  const phaseInfo = useMemo(() => computePhaseFromRaceDate(settings.raceDate), [settings.raceDate]);
  const currentPhaseKey = phaseInfo?.phase || null;

  // Poids embarqué (uniquement items usage="course" parmi ceux emportés)
  const itemsCourse = activeItems.filter(i => i.usage === "course");
  const poidsEquipG = itemsCourse.reduce((s, i) => s + (i.poidsG || 0), 0);
  const poidsCorporel = settings.weight || 70;
  const poidsPct = poidsEquipG > 0 ? Math.round(poidsEquipG / (poidsCorporel * 1000) * 100) : 0;
  const poidsColor = poidsPct >= 15 ? C.red : poidsPct >= 10 ? C.yellow : C.green;
  const fmtPoidsEquip = g => g >= 1000 ? `${(g/1000).toFixed(1)} kg` : `${g} g`;

  const prepTotal = activeItems.length + PREP_TIMELINE.length;
  const prepDone = checkedCount + PREP_TIMELINE.filter(t => prepChecks[t.id]).length;
  const prepPct = prepTotal > 0 ? Math.round(prepDone / prepTotal * 100) : 0;

  const tasksByPhase = useMemo(() => {
    const map = {};
    PHASES_ORDER.forEach(p => { map[p] = PREP_TIMELINE.filter(t => t.phase === p); });
    return map;
  }, []);

  const itemsByUsage = useMemo(() => {
    const map = { course: [], ravito: [], pre_course: [] };
    activeItems.forEach(i => { (map[i.usage] || map.course).push(i); });
    return map;
  }, [activeItems]);

  return (
    <div className="anim">
      <PageTitle sub="Compte à rebours et préparation">Équipement</PageTitle>

      {/* ─── HERO COMPTE À REBOURS ─────────────────────────────────────── */}
      <Card style={{ marginBottom: 16, padding: "24px 28px", background: `linear-gradient(135deg, ${C.primaryPale} 0%, ${C.summitPale} 100%)`, border: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: phaseInfo ? 24 : 0, gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.primaryDeep, textTransform: "uppercase", letterSpacing: "0.1em" }}>Prochaine course</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'Playfair Display', serif", color: C.ink, marginTop: 2 }}>
              {settings.raceName || race?.name || "Sans nom"}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-c)", marginTop: 2 }}>
              {settings.raceDate ? new Date(settings.raceDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date à définir"}
              {race?.totalDistance ? ` · ${race.totalDistance.toFixed(0)} km` : ""}
            </div>
          </div>
          {phaseInfo && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 52, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: C.primary, lineHeight: 1 }}>
                {phaseInfo.label}
              </div>
              {settings.raceDate && (
                <div style={{ fontSize: 11, color: C.primaryDeep, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {new Date(settings.raceDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  {settings.startTime ? ` · ${settings.startTime}` : ""}
                </div>
              )}
            </div>
          )}
        </div>

        {phaseInfo && (
          <div style={{ position: "relative", margin: "0 4px", paddingTop: 4 }}>
            <div style={{ position: "absolute", top: 12, left: 0, right: 0, height: 2, background: "var(--border-c)" }} />
            <div style={{
              position: "absolute", top: 12, left: 0, height: 2, background: C.primary,
              width: `${(PHASES_ORDER.indexOf(currentPhaseKey) / (PHASES_ORDER.length - 1)) * 100}%`,
            }} />
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
              {PHASES_ORDER.map(p => {
                const idx = PHASES_ORDER.indexOf(p);
                const curIdx = PHASES_ORDER.indexOf(currentPhaseKey);
                const passed = idx < curIdx;
                const current = idx === curIdx;
                const isCourse = p === "course";
                const dotBg = passed ? C.primary : "#FFF";
                const dotBorder = passed ? C.primary : (current ? C.primary : (isCourse ? C.green : "var(--border-c)"));
                return (
                  <div key={p} style={{ textAlign: "center", flex: 1 }}>
                    <div style={{
                      width: current || isCourse ? 22 : 18,
                      height: current || isCourse ? 22 : 18,
                      borderRadius: "50%",
                      background: dotBg,
                      border: `${current ? 3 : 2}px solid ${dotBorder}`,
                      margin: "0 auto",
                      boxShadow: current ? `0 0 0 4px ${C.primaryPale}` : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isCourse && !passed && !current && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: current ? C.primary : passed ? C.primaryDeep : (isCourse ? C.green : "var(--muted-c)"),
                      marginTop: 6,
                      fontWeight: current || isCourse ? 700 : 500,
                    }}>{PHASES_LABELS[p]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* ─── KPIS ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Poids embarqué</div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: poidsColor, marginTop: 4 }}>
            {fmtPoidsEquip(poidsEquipG)}
          </div>
          <div style={{ fontSize: 11, color: poidsColor, fontWeight: 600 }}>
            {poidsPct}% du poids corporel · {poidsPct >= 15 ? "lourd" : poidsPct >= 10 ? "modéré" : "léger"}
          </div>
          <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, poidsPct * 5)}%`, background: poidsColor, transition: "width 0.3s" }} />
          </div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Préparation globale</div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: prepPct >= 80 ? C.green : C.primary, marginTop: 4 }}>
            {prepPct}%
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-c)", fontWeight: 600 }}>
            {prepDone} / {prepTotal} actions faites
          </div>
          <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${prepPct}%`, background: prepPct >= 80 ? C.green : C.primary, transition: "width 0.3s" }} />
          </div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Phase courante</div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: C.primaryDeep, marginTop: 4 }}>
            {phaseInfo ? phaseInfo.label : "—"}
          </div>
          <div style={{ fontSize: 11, color: C.primaryDeep, fontWeight: 600 }}>
            {currentPhaseKey && tasksByPhase[currentPhaseKey] ? `${tasksByPhase[currentPhaseKey].filter(t => !prepChecks[t.id]).length} tâche(s) restantes` : "Définir la date de course"}
          </div>
          <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
            <div style={{
              height: "100%", background: C.primaryDeep, transition: "width 0.3s",
              width: currentPhaseKey ? `${((PHASES_ORDER.indexOf(currentPhaseKey) + 1) / PHASES_ORDER.length) * 100}%` : "0%",
            }} />
          </div>
        </Card>
      </div>

      {/* ─── DOUBLE COLONNE : À EMPORTER / À FAIRE ────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* COLONNE GAUCHE — À EMPORTER */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>À emporter</h3>
            <span style={{ fontSize: 12, color: "var(--muted-c)" }}>{checkedCount} / {activeItems.length} prêts</span>
          </div>
          <div style={{ height: 3, background: "var(--surface-2)", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${activeItems.length ? (checkedCount/activeItems.length)*100 : 0}%`, background: checkedCount === activeItems.length && activeItems.length > 0 ? C.green : C.primary, transition: "width 0.3s" }} />
          </div>

          {activeItems.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted-c)", fontSize: 13, padding: "20px 0" }}>
              Aucun item dans cette course.{" "}
              <span style={{ color: C.primary, cursor: "pointer", textDecoration: "underline" }} onClick={() => openGear("course")}>Ajouter depuis ma bibliothèque</span>.
            </div>
          ) : (
            USAGES.map(u => {
              const items = itemsByUsage[u.key] || [];
              if (!items.length) return null;
              return (
                <div key={u.key} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                    {u.label}
                    {u.key === "course" && <span style={{ color: C.primary, marginLeft: 6, textTransform: "none", letterSpacing: 0, fontSize: 10, fontWeight: 500 }}>· compté dans le poids algo</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {items.map(item => {
                      const showAlgo = u.key === "course" && (item.type === "batons" || item.type === "imper");
                      const showWeight = u.key === "course" && item.poidsG > 0;
                      return (
                        <div key={item.id} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                          borderRadius: 8, background: item.checked ? C.greenPale : "var(--surface-2)",
                          transition: "background 0.15s",
                        }}>
                          <div onClick={() => toggleItem(item.id)} style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: "pointer",
                            border: `2px solid ${item.checked ? C.green : "var(--border-c)"}`,
                            background: item.checked ? C.green : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                          }}>
                            {item.checked && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                          </div>
                          <span onClick={() => toggleItem(item.id)} style={{
                            fontSize: 13, flex: 1, cursor: "pointer",
                            color: item.checked ? "var(--muted-c)" : "var(--text-c)",
                            textDecoration: item.checked ? "line-through" : "none",
                          }}>{item.label}</span>
                          {showAlgo && (
                            <span style={{
                              fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700,
                              letterSpacing: "0.04em", textTransform: "uppercase",
                              background: item.type === "imper" ? C.summitPale : C.primaryPale,
                              color: item.type === "imper" ? C.summit : C.primaryDeep,
                            }}>{item.type === "batons" ? "bâtons" : "imper"}</span>
                          )}
                          {showWeight && <span style={{ fontSize: 11, color: "var(--muted-c)" }}>{item.poidsG} g</span>}
                          <span onClick={(e) => { e.stopPropagation(); toggleEmporte(item.id); }}
                            title="Retirer de cette course"
                            style={{ fontSize: 13, color: "var(--muted-c)", opacity: 0.4, cursor: "pointer", padding: "0 4px", marginLeft: 2 }}>×</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <Btn size="sm" variant="ghost" onClick={resetChecks} style={{ flex: "1 1 120px" }}>Tout décocher</Btn>
            <Btn size="sm" variant="soft" onClick={() => openGear("course")} style={{ flex: "1 1 160px" }}>Gérer mon équipement</Btn>
          </div>
        </Card>

        {/* COLONNE DROITE — À FAIRE */}
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>À faire</h3>

          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 9, top: 10, bottom: 10, width: 2, background: "var(--border-c)" }} />

            {PHASES_ORDER.filter(p => p !== "course").map(phase => {
              const items = tasksByPhase[phase] || [];
              const done = items.filter(i => prepChecks[i.id]).length;
              const allDone = items.length > 0 && done === items.length;
              const idx = PHASES_ORDER.indexOf(phase);
              const curIdx = PHASES_ORDER.indexOf(currentPhaseKey);
              const isCurrent = phase === currentPhaseKey;
              const isPassed = curIdx > -1 && idx < curIdx;
              const isCollapsed = collapsedPhases[phase] !== undefined ? collapsedPhases[phase] : (isPassed || (!isCurrent && curIdx > -1 && idx > curIdx));

              const dotColor = isPassed || allDone ? C.green : isCurrent ? C.primary : "var(--border-c)";
              const labelColor = isPassed || allDone ? C.green : isCurrent ? C.primary : "var(--muted-c)";

              return (
                <div key={phase} style={{ position: "relative", paddingLeft: 32, paddingBottom: 16 }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0,
                    width: 20, height: 20, borderRadius: "50%",
                    background: (isPassed || allDone) ? C.green : "#FFF",
                    border: `${isCurrent ? 3 : 2}px solid ${dotColor}`,
                    boxShadow: isCurrent ? `0 0 0 2px ${C.primaryPale}` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {(isPassed || allDone) && <span style={{ color: "#FFF", fontSize: 10, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div onClick={() => togglePhase(phase)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: isCollapsed ? 0 : 8 }}>
                    <span style={{ fontWeight: isCurrent ? 700 : 600, fontSize: 13, color: labelColor }}>
                      {PHASES_LABELS[phase]}{isCurrent ? " — phase courante" : isPassed && allDone ? " — terminé" : ""}
                    </span>
                    <span style={{ fontSize: 11, color: isCurrent ? C.primary : "var(--muted-c)", fontWeight: isCurrent ? 600 : 400 }}>
                      {done}/{items.length}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {items.map(item => {
                        const checked = !!prepChecks[item.id];
                        return (
                          <div key={item.id} onClick={() => togglePrep(item.id)} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                            borderRadius: 6, cursor: "pointer", transition: "background 0.15s",
                            background: checked ? C.greenPale : "var(--surface-2)",
                          }}>
                            <div style={{
                              width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                              border: `2px solid ${checked ? C.green : "var(--border-c)"}`,
                              background: checked ? C.green : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {checked && <span style={{ color: "#fff", fontSize: 9, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{
                              fontSize: 12, flex: 1,
                              color: checked ? "var(--muted-c)" : "var(--text-c)",
                              textDecoration: checked ? "line-through" : "none",
                            }}>{item.label}</span>
                            <span style={{
                              fontSize: 9, padding: "2px 5px", borderRadius: 3, fontWeight: 600,
                              background: "var(--surface-2)", color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.03em",
                            }}>{item.cat}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ position: "relative", paddingLeft: 32 }}>
              <div style={{
                position: "absolute", left: 0, top: 0,
                width: 20, height: 20, borderRadius: "50%",
                background: "#FFF",
                border: `2px solid ${C.green}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.green }}>Course</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── MODAL UNIFIÉE — GÉRER MON ÉQUIPEMENT ─────────────────── */}
      <Modal open={gearModal} onClose={() => setGearModal(false)} title="Gérer mon équipement">
        {/* Onglets */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: `1px solid var(--border-c)` }}>
          {[
            { key: "course", label: "Cette course" },
            { key: "biblio", label: "Ma bibliothèque" },
          ].map(t => {
            const active = gearTab === t.key;
            return (
              <div key={t.key} onClick={() => setGearTab(t.key)} style={{
                padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 500,
                color: active ? C.primary : "var(--muted-c)",
                borderBottom: `2px solid ${active ? C.primary : "transparent"}`,
                marginBottom: -1, transition: "all 0.15s",
              }}>{t.label}</div>
            );
          })}
        </div>

        {/* Intro contextuelle */}
        <p style={{ fontSize: 12, color: "var(--muted-c)", marginBottom: 14, lineHeight: 1.5 }}>
          {gearTab === "course"
            ? "Sélectionne ce que tu emportes pour cette course uniquement. Les changements ici n'affectent pas tes autres courses."
            : "Configure ton équipement à long terme : poids, type algo, items réutilisables sur toutes tes courses."}
        </p>

        {/* ── ONGLET CETTE COURSE ── */}
        {gearTab === "course" && (
          <>
            {USAGES.map(u => {
              const itemsActifs = equipment.filter(i => i.usage === u.key && i.actif !== false);
              if (!itemsActifs.length) return null;
              return (
                <div key={u.key} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                    {u.label}
                    {u.key === "course" && <span style={{ color: C.primary, marginLeft: 6, textTransform: "none", letterSpacing: 0, fontSize: 10, fontWeight: 500 }}>· compté dans le poids algo</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {itemsActifs.map(item => {
                      const cocheCourse = isEmported(item.id);
                      return (
                        <div key={item.id} onClick={() => toggleEmporte(item.id)} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                          borderRadius: 8, cursor: "pointer",
                          background: cocheCourse ? C.primaryPale : "var(--surface-2)",
                          border: `1px solid ${cocheCourse ? C.primary + "40" : "var(--border-c)"}`,
                          transition: "all 0.15s",
                        }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            border: `2px solid ${cocheCourse ? C.primary : "var(--border-c)"}`,
                            background: cocheCourse ? C.primary : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {cocheCourse && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 13, flex: 1, fontWeight: cocheCourse ? 500 : 400 }}>{item.label}</span>
                          {u.key === "course" && (item.type === "batons" || item.type === "imper") && (
                            <span style={{
                              fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700,
                              letterSpacing: "0.04em", textTransform: "uppercase",
                              background: item.type === "imper" ? C.summitPale : C.primaryPale,
                              color: item.type === "imper" ? C.summit : C.primaryDeep,
                            }}>{item.type === "batons" ? "bâtons" : "imper"}</span>
                          )}
                          {u.key === "course" && item.poidsG > 0 && (
                            <span style={{ fontSize: 11, color: "var(--muted-c)" }}>{item.poidsG} g</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {equipment.filter(i => i.actif !== false).length === 0 && (
              <div style={{ textAlign: "center", color: "var(--muted-c)", fontSize: 13, padding: "16px 0" }}>
                Aucun item actif dans ta bibliothèque. Va sur l'onglet « Ma bibliothèque » pour en ajouter.
              </div>
            )}
          </>
        )}

        {/* ── ONGLET BIBLIO ── */}
        {gearTab === "biblio" && (
          <>
            {USAGES.map(u => {
              const items = equipment.filter(i => i.usage === u.key);
              if (!items.length) return null;
              return (
                <div key={u.key} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{u.label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 8 }}>{u.desc}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {items.map(item => {
                      const isActif = item.actif !== false;
                      return (
                        <div key={item.id} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                          borderRadius: 9, background: isActif ? C.primaryPale : "var(--surface-2)",
                          border: `1px solid ${isActif ? C.primary + "40" : "var(--border-c)"}`,
                          opacity: isActif ? 1 : 0.6,
                          transition: "all 0.15s", flexWrap: "wrap",
                        }}>
                          <div onClick={() => toggleActif(item.id)} style={{
                            width: 32, height: 18, borderRadius: 9, flexShrink: 0, cursor: "pointer",
                            background: isActif ? C.primary : "var(--border-c)",
                            position: "relative", transition: "background 0.2s",
                          }}>
                            <div style={{
                              position: "absolute", top: 2, left: isActif ? 14 : 2,
                              width: 14, height: 14, borderRadius: "50%", background: "#fff",
                              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            }} />
                          </div>
                          <span style={{ fontSize: 13, flex: "1 1 140px", fontWeight: isActif ? 500 : 400, color: isActif ? "var(--text-c)" : "var(--muted-c)" }}>
                            {item.label}
                          </span>
                          {u.key === "course" && (
                            <>
                              <select value={item.type} onChange={e => updItemField(item.id, "type", e.target.value)} style={{ fontSize: 11, padding: "3px 5px" }}>
                                {TYPES_ALGO.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                              </select>
                              <input type="number" value={item.poidsG || ""} onChange={e => updItemField(item.id, "poidsG", parseInt(e.target.value) || 0)} placeholder="g" style={{ width: 60, fontSize: 11, padding: "3px 6px" }} />
                            </>
                          )}
                          <span style={{ fontSize: 14, color: "var(--muted-c)", opacity: 0.5, cursor: "pointer", padding: "0 4px" }}
                            onClick={() => deleteItem(item.id)}>✕</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{ borderTop: "1px solid var(--border-c)", paddingTop: 14, marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-c)", marginBottom: 8 }}>Ajouter un item</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <select value={newUsage} onChange={e => setNewUsage(e.target.value)} style={{ fontSize: 13 }}>
                  {USAGES.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
                </select>
                <input value={newItem} onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addItem()}
                  placeholder="Ex : Buff thermique..."
                  style={{ flex: 1, minWidth: 140, fontSize: 13 }} />
              </div>
              {newUsage === "course" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <select value={newType} onChange={e => setNewType(e.target.value)} style={{ fontSize: 13 }}>
                    {TYPES_ALGO.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                  <input type="number" value={newPoidsG} onChange={e => setNewPoidsG(e.target.value)}
                    placeholder="Poids (g)" style={{ width: 100, fontSize: 13 }} />
                </div>
              )}
              <Btn size="sm" onClick={addItem}>Ajouter</Btn>
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn onClick={() => setGearModal(false)}>Fermer</Btn>
        </div>
      </Modal>
    </div>
  );
}
