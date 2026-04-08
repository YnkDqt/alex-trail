import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { C, RUNNER_LEVELS, TERRAIN_TYPES, DEFAULT_EQUIPMENT, PREP_TIMELINE, EMPTY_SETTINGS, DEFAULT_FLAT_SPEED } from '../constants.js';
import { fmtTime, fmtPace, fmtHeure, isNight, calcNutrition, calcPassingTimes, exportRecap, exportGPXMontre, suggestSpeed, autoSegmentGPX, parseGarminCSV, buildElevationProfile, calcSlopeFromGPX, parseGPX } from '../utils.jsx';
import { Btn, Card, KPI, PageTitle, Field, Modal, ConfirmDialog, Empty, Hr, CustomTooltip } from '../atoms.jsx';

// ─── VUE NUTRITION ───────────────────────────────────────────────────────────
export default function NutritionView({ segments, settings, setSettings, race, setRace, isMobile, onNavigate, profil, poids }) {
  const produits = settings.produits || [];
  const planNutrition = race.planNutrition || {};
  const ravitos = [...(race.ravitos || [])].sort((a, b) => a.km - b.km).filter(rv => rv.assistancePresente !== false);
  const updPlan = v => setRace(r => ({ ...r, planNutrition: v }));

  // Poids utilisateur : profil.poids en priorité, sinon dernier poids[], sinon 70
  const lastPoids = useMemo(() => [...(poids || [])].sort((a,b) => new Date(b.date) - new Date(a.date))[0]||null, [poids]);
  const userWeight = profil?.poids || lastPoids?.poids || 70;

  // ── État modaux ──
  const [prodModal, setProdModal] = useState(false);
  const [editProdId, setEditProdId] = useState(null);
  const [confirmProdId, setConfirmProdId] = useState(null);
  const emptyProd = { nom: "", par100g: true, poids: "", kcal: "", proteines: "", lipides: "", glucides: "", sodium: "", potassium: "", magnesium: "", zinc: "", calcium: "", boisson: false, volumeMl: "" };
  const [prodForm, setProdForm] = useState(emptyProd);
  const updP = (k, v) => setProdForm(f => ({ ...f, [k]: v }));

  const openNewProd  = ()  => { setEditProdId(null);  setProdForm(emptyProd); setProdModal(true); };
  const openEditProd = p   => { setEditProdId(p.id);  setProdForm({ ...emptyProd, ...p }); setProdModal(true); };
  const saveProd = () => {
    if (!prodForm.nom.trim()) return;
    const item = { ...prodForm, id: editProdId || Date.now(), poids: +prodForm.poids||0, kcal: +prodForm.kcal||0, proteines: +prodForm.proteines||0, lipides: +prodForm.lipides||0, glucides: +prodForm.glucides||0, sodium: +prodForm.sodium||0, potassium: +prodForm.potassium||0, magnesium: +prodForm.magnesium||0, zinc: +prodForm.zinc||0, calcium: +prodForm.calcium||0 };
    if (editProdId) updProduits(produits.map(p => p.id === editProdId ? item : p));
    else updProduits([...produits, item]);
    setProdModal(false);
  };

  // ── Helpers nutrition ──
  const nutriProduit = (prod, qte) => {
    const factor = prod.par100g ? (prod.poids * qte / 100) : qte;
    const eauMl = prod.boisson ? ((prod.par100g ? prod.volumeMl * qte / 100 : prod.volumeMl * qte) || 0) : 0;
    return { kcal: Math.round(prod.kcal * factor), glucides: Math.round(prod.glucides * factor), proteines: Math.round(prod.proteines * factor), sodium: Math.round(prod.sodium * factor), eauMl: Math.round(eauMl) };
  };

  const totalPoint = pointKey => {
    const items = planNutrition[pointKey] || [];
    return items.reduce((acc, { produitId, quantite }) => {
      const p = produits.find(x => x.id === produitId);
      if (!p) return acc;
      const n = nutriProduit(p, quantite);
      return { kcal: acc.kcal + n.kcal, glucides: acc.glucides + n.glucides, proteines: acc.proteines + n.proteines, sodium: acc.sodium + n.sodium, eauMl: acc.eauMl + n.eauMl };
    }, { kcal: 0, glucides: 0, proteines: 0, sodium: 0, eauMl: 0 });
  };

  const totalEmporte = ["depart", ...ravitos.map(r => String(r.id))].reduce((acc, key) => {
    const t = totalPoint(key);
    return { kcal: acc.kcal + t.kcal, glucides: acc.glucides + t.glucides, proteines: acc.proteines + t.proteines, sodium: acc.sodium + t.sodium, eauMl: acc.eauMl + t.eauMl };
  }, { kcal: 0, glucides: 0, proteines: 0, sodium: 0, eauMl: 0 });

  const setQte = (pointKey, produitId, qte) => {
    const current = planNutrition[pointKey] || [];
    let updated;
    if (qte <= 0) {
      updated = current.filter(x => x.produitId !== produitId);
    } else {
      const exists = current.find(x => x.produitId === produitId);
      updated = exists ? current.map(x => x.produitId === produitId ? { ...x, quantite: qte } : x) : [...current, { produitId, quantite: qte }];
    }
    updPlan({ ...planNutrition, [pointKey]: updated });
  };

  const getQte = (pointKey, produitId) => (planNutrition[pointKey] || []).find(x => x.produitId === produitId)?.quantite || 0;

  const updProduits = p => setSettings(s => ({ ...s, produits: p }));

  // ── Auto-complétion nutrition ─────────────────────────────────────────────
  const [autoCompletePreview, setAutoCompletePreview] = useState(null);

  const runAutoComplete = () => {
    if (!produits.length || !zones.length) return;

    // Trier les produits par priorité : boisson d'abord, puis kcal/g décroissant
    const produitsActifs = [...produits].sort((a, b) => {
      if (a.boisson && !b.boisson) return -1;
      if (!a.boisson && b.boisson) return 1;
      const kcalGa = a.par100g ? a.kcal / 100 : (a.poids > 0 ? a.kcal / a.poids : 0);
      const kcalGb = b.par100g ? b.kcal / 100 : (b.poids > 0 ? b.kcal / b.poids : 0);
      return kcalGb - kcalGa;
    });

    const poidsMax = userWeight * 1000 * 0.12; // 12% poids corporel
    const glucidesTarget = settings.glucidesTargetGh; // g/h cible si défini

    const newPlan = {};

    zones.forEach(zone => {
      const { pointKey, besoin } = zone;
      const existing = planNutrition[pointKey] || [];
      const items = [...existing]; // on part de ce qui existe déjà

      // Calcul des apports déjà en place
      const apportActuel = () => items.reduce((acc, { produitId, quantite }) => {
        const p = produits.find(x => x.id === produitId);
        if (!p) return acc;
        const n = nutriProduit(p, quantite);
        return { kcal: acc.kcal + n.kcal, glucides: acc.glucides + n.glucides, eauMl: acc.eauMl + n.eauMl };
      }, { kcal: 0, glucides: 0, eauMl: 0 });

      const dureeH = besoin.kcal > 0 && zone.from !== zone.to
        ? segments.filter(s => s.type !== "ravito" && s.type !== "repos" && s.startKm < zone.to && s.endKm > zone.from)
            .reduce((acc, seg) => {
              const overlap = Math.min(seg.endKm, zone.to) - Math.max(seg.startKm, zone.from);
              const ratio = overlap / (seg.endKm - seg.startKm || 1);
              return acc + (seg.endKm - seg.startKm) / seg.speedKmh * ratio;
            }, 0)
        : 1;

      // Cibles pour ce tronçon
      const cibleEauMl = besoin.eau;
      const cibleGlucides = glucidesTarget != null
        ? Math.round(glucidesTarget * dureeH)
        : besoin.glucides;
      const cibleKcal = besoin.kcal;

      // Étape 1 — Liquides (boissonss)
      const boissons = produitsActifs.filter(p => p.boisson);
      if (boissons.length && cibleEauMl > 0) {
        const apport = apportActuel();
        const manqueEau = cibleEauMl - apport.eauMl;
        if (manqueEau > 50) {
          const b = boissons[0];
          const eauParUnite = b.par100g ? (b.volumeMl || 0) * b.poids / 100 : (b.volumeMl || 0);
          if (eauParUnite > 0) {
            const qte = Math.ceil(manqueEau / eauParUnite);
            const idx = items.findIndex(x => x.produitId === b.id);
            if (idx >= 0) items[idx] = { ...items[idx], quantite: Math.max(items[idx].quantite, qte) };
            else items.push({ produitId: b.id, quantite: qte });
          }
        }
      }

      // Étape 2 — Glucides puis calories (solides) — round-robin pour la variété
      const solides = produitsActifs.filter(p => !p.boisson);
      if (solides.length === 0) { newPlan[pointKey] = items; return; }

      // Initialiser un compteur par produit pour équilibrer la répartition
      const compteurs = Object.fromEntries(solides.map(p => [p.id, 0]));
      let roundIdx = 0;
      let iterations = 0;

      while (iterations < 30) {
        iterations++;
        const apport = apportActuel();
        const manqueGlucides = cibleGlucides - apport.glucides;
        const manqueKcal = cibleKcal - apport.kcal;
        if (manqueGlucides <= 5 && manqueKcal <= 50) break;

        // Vérifier poids max avant d'ajouter quoi que ce soit
        const poidsActuel = items.reduce((s, { produitId, quantite }) => {
          const p = produits.find(x => x.id === produitId);
          if (!p) return s;
          return s + (p.par100g ? p.poids * quantite / 100 : (p.poids || 0) * quantite);
        }, 0);
        if (poidsActuel > poidsMax * 0.8) break;

        // Choisir le produit suivant en round-robin
        const candidat = solides[roundIdx % solides.length];
        roundIdx++;

        // Si le manque est surtout en glucides et ce produit en est pauvre → skipper
        // (sauf si on a fait le tour complet sans rien ajouter)
        const glucidesParUnite = candidat.par100g
          ? candidat.glucides * (candidat.poids || 100) / 100
          : candidat.glucides;
        if (manqueGlucides > 20 && glucidesParUnite < 5 && roundIdx % solides.length !== 0) continue;

        const idx = items.findIndex(x => x.produitId === candidat.id);
        const qteActuelle = idx >= 0 ? items[idx].quantite : 0;
        const qteAjout = candidat.par100g ? 100 : 1;
        compteurs[candidat.id] = (compteurs[candidat.id] || 0) + 1;

        if (idx >= 0) items[idx] = { ...items[idx], quantite: qteActuelle + qteAjout };
        else items.push({ produitId: candidat.id, quantite: qteAjout });
      }

      newPlan[pointKey] = items;
    });

    setAutoCompletePreview(newPlan);
  };

  const applyAutoComplete = () => {
    if (!autoCompletePreview) return;
    updPlan(autoCompletePreview);
    setAutoCompletePreview(null);
  };

  // ── Besoins calculés ──
  const nutriTotals = segments.reduce((acc, seg) => {
    if (seg.type === "ravito" || seg.type === "repos") return acc;
    const n = calcNutrition(seg, settings);
    const dH = seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh : 0;
    return { kcal: acc.kcal + n.kcal, eau: acc.eau + Math.round(n.eauH * dH), glucides: acc.glucides + Math.round(n.glucidesH * dH), sel: acc.sel + Math.round(n.selH * dH) };
  }, { kcal: 0, eau: 0, glucides: 0, sel: 0 });

  const totalTime = segments.reduce((s, seg) => (seg.type === "repos" || seg.type === "ravito") ? s + (seg.dureeMin||0)*60 : s + (seg.speedKmh > 0 ? ((seg.endKm - seg.startKm) / seg.speedKmh) * 3600 : 0), 0);
  const totalDist = segments.filter(s => s.type !== "ravito" && s.type !== "repos").reduce((s, seg) => Math.max(s, seg.endKm), 0);
  const isHot = settings.tempC > 25;
  const waterPerHour = 500 + (settings.wind ? 100 : 0) + (isHot ? 150 : 0);

  // Zones tronçons pour le plan
  const bornes = [0, ...ravitos.map(r => r.km), totalDist].filter((v, i, a) => v !== a[i-1]);
  const zones = bornes.slice(0, -1).map((from, i) => {
    const to = bornes[i + 1];
    const label = i === 0 ? "Départ" : (ravitos[i-1]?.name || `Ravito ${i}`);
    const toLbl = i === bornes.length - 2 ? "Arrivée" : (ravitos[i]?.name || `Ravito ${i+1}`);
    const pointKey = i === 0 ? "depart" : String(ravitos[i-1]?.id);
    // Autonome si le ravito suivant (destination de ce tronçon) est sans assistance
    const nextRavito = ravitos[i];
    const autonome = nextRavito?.assistancePresente === false;
    const segsZ = segments.filter(s => s.type !== "ravito" && s.type !== "repos" && s.startKm < to && s.endKm > from);
    const besoin = segsZ.reduce((acc, seg) => {
      const overlap = Math.min(seg.endKm, to) - Math.max(seg.startKm, from);
      const ratio = overlap / (seg.endKm - seg.startKm || 1);
      const n = calcNutrition(seg, settings);
      const dH = (seg.endKm - seg.startKm) / seg.speedKmh * ratio;
      return { kcal: acc.kcal + Math.round(n.kcalH * dH), eau: acc.eau + Math.round(n.eauH * dH), glucides: acc.glucides + Math.round(n.glucidesH * dH) };
    }, { kcal: 0, eau: 0, glucides: 0 });
    return { label, toLbl, from, to, pointKey, besoin, autonome };
  });

  const barData = segments.filter(s => s.type !== "ravito" && s.type !== "repos").map((s, i) => {
    const n = calcNutrition(s, settings);
    const dH = s.speedKmh > 0 ? (s.endKm - s.startKm) / s.speedKmh : 0;
    return { name: `S${i+1}`, eau: Math.round(n.eauH * dH), glucides: Math.round(n.glucidesH * dH) };
  });

  const gapColor = v => v >= 0 ? C.green : C.red;
  const gapLabel = (v, unit) => v >= 0 ? `+${Math.round(v)} ${unit} excédent` : `${Math.round(v)} ${unit} manque`;

  if (!segments.length) {
    return (
      <div className="anim">
        <PageTitle sub="Besoins, bibliothèque et plan de ravitaillement">Nutrition</PageTitle>
        <Empty icon="🍌" title="Aucun segment défini" sub="Définis des segments dans Stratégie de course pour calculer tes besoins nutritionnels." />
      </div>
    );
  }

  return (
    <div className="anim">
      <PageTitle sub="Besoins, bibliothèque et plan de ravitaillement">Nutrition</PageTitle>

      {/* Bandeau profil nutritionnel actif */}
      {(() => {
        const w = userWeight;
        const src = settings.kcalSource || "minetti";
        const gs = settings.garminStats;
        let flatRate;
        if (src === "garmin" && gs?.kcalPerKmFlat) flatRate = gs.kcalPerKmFlat;
        else if (src === "manual") flatRate = settings.kcalPerKm || 65;
        else flatRate = Math.round(3.6 * w * 1000 / 4184);
        const target = settings.glucidesTargetGh;
        const glucLabel = target != null ? `${target} g/h glucides` : "glucides auto";
        const srcLabel = src === "garmin" ? "Garmin perso" : src === "manual" ? "Manuel" : "Minetti";
        return (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
            padding: "10px 16px", background: C.primaryPale, borderRadius: 12, marginBottom: 20,
            border: `1px solid ${C.primary}30`, fontSize: 13,
          }}>
            <span style={{ color: C.primaryDeep }}>
              Profil actif : <strong>{flatRate} kcal/km</strong> ({srcLabel}) · <strong>{glucLabel}</strong>
            </span>
            <button onClick={() => onNavigate("parametres")} style={{
              background: "none", border: `1px solid ${C.primary}50`, borderRadius: 8,
              padding: "4px 12px", fontSize: 12, color: C.primary, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
            }}>
              🎒 Équipement
            </button>
          </div>
        );
      })()}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
        <KPI label="Calories estimées" value={`${nutriTotals.kcal} kcal`} icon="🔥" color={C.red} sub={`${Math.round(nutriTotals.kcal / (totalDist||1))} kcal/km`} />
        <KPI label="Eau estimée" value={`${(nutriTotals.eau/1000).toFixed(1)} L`} icon="💧" color={C.blue} sub={`${waterPerHour} mL/h visé`} />
        <KPI label="Glucides estimés" value={`${nutriTotals.glucides} g`} icon="🍌" color={C.yellow} sub={`${Math.round(nutriTotals.glucides/(totalTime/3600||1))} g/h`} />
        <KPI label="Sel estimé" value={`${nutriTotals.sel} mg`} icon="🧂" color={C.green} sub="sodium" />
      </div>

      {isHot && (
        <div style={{ background: C.yellowPale, border: `1px solid ${C.yellow}40`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: C.yellow }}>
          Forte chaleur — besoins en eau augmentés. Anticipe les ravitos.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <Card noPad>
          <div style={{ padding: "16px 20px 0", fontWeight: 600 }}>Eau & glucides par segment</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} />
              <RTooltip content={<CustomTooltip />} />
              <Bar dataKey="eau" name="Eau (mL)" fill={C.blue} radius={[3,3,0,0]} />
              <Bar dataKey="glucides" name="Glucides (g)" fill={C.yellow} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Recommandations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Hydratation", val: "Toutes les 15–20 min", detail: `${Math.round(waterPerHour/4)} mL par prise`, color: C.blue },
              { label: "Glucides", val: `${Math.round(nutriTotals.glucides/(totalTime/3600||1))} g/h`, detail: totalTime/3600 > 4 ? "Mix sucré + salé après 3h" : "Sucré seul suffisant", color: C.yellow },
              { label: "Sel", val: totalTime > 14400 ? "Indispensable" : "Recommandé", detail: totalTime > 14400 ? "Pastilles isotoniques" : "Pâtes de fruits salées", color: C.green },
              { label: "Caféine", val: totalTime > 18000 ? "Envisager" : "Optionnel", detail: totalTime > 18000 ? `Gel caféiné après km ${Math.round(totalDist*0.6)}` : "Cola aux ravitos", color: C.primary },
            ].map(r => (
              <div key={r.label} style={{ padding: "9px 12px", background: "var(--surface-2)", borderRadius: 10, borderLeft: `3px solid ${r.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--muted-c)" }}>{r.label}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: r.color }}>{r.val}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>{r.detail}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ══ SECTION 1 : BIBLIOTHÈQUE DE PRODUITS ══════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>Bibliothèque de produits</div>
          <div style={{ fontSize: 13, color: "var(--muted-c)", marginTop: 2 }}>Crée tes produits une fois, utilise-les partout</div>
        </div>
        <Btn onClick={openNewProd}>+ Produit</Btn>
      </div>

      {produits.length === 0 ? (
        <Card style={{ marginBottom: 24, textAlign: "center", color: "var(--muted-c)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏪</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Bibliothèque vide</div>
          <div style={{ fontSize: 13, marginBottom: 14 }}>Ajoute tes barres, gels et boissons pour construire ton plan.</div>
          <Btn onClick={openNewProd}>+ Ajouter un produit</Btn>
        </Card>
      ) : (
        <Card noPad style={{ marginBottom: 24 }}>
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th>Produit</th><th>Base</th><th>Poids</th><th>Kcal</th><th>Glucides</th><th>Protéines</th><th>Na (mg)</th><th></th>
              </tr></thead>
              <tbody>
                {produits.map(p => (
                  <tr key={p.id} onClick={() => openEditProd(p)} style={{ cursor: "pointer" }}>
                    <td style={{ fontWeight: 600 }}>{p.nom}</td>
                    <td style={{ color: "var(--muted-c)", fontSize: 12 }}>{p.par100g ? "/ 100g" : "/ unité"}</td>
                    <td>{p.poids > 0 ? `${p.poids} g` : "—"}</td>
                    <td style={{ color: C.red, fontWeight: 600 }}>{p.kcal} kcal</td>
                    <td style={{ color: C.yellow }}>{p.glucides} g</td>
                    <td style={{ color: "var(--muted-c)" }}>{p.proteines} g</td>
                    <td style={{ color: "var(--muted-c)" }}>{p.sodium} mg</td>
                    <td onClick={e => e.stopPropagation()}>
                      <Btn size="sm" variant="danger" onClick={() => setConfirmProdId(p.id)}>✕</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ══ SECTION 2 : PLAN DE RAVITAILLEMENT ════════════════════════════════ */}
      {produits.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>Plan de ravitaillement</div>
            <Btn variant="soft" onClick={runAutoComplete} style={{ gap: 6 }}>
              🪄 Auto-compléter
            </Btn>
          </div>
          <div style={{ fontSize: 13, color: "var(--muted-c)", marginBottom: 16 }}>Définis ce que tu emportes à chaque point</div>

          {/* Bandeau prévisualisation auto-complétion */}
          {autoCompletePreview && (
            <div style={{ background: C.primaryPale, border: `1px solid ${C.primary}40`, borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: C.primaryDeep, marginBottom: 8, fontSize: 15 }}>
                🪄 Proposition auto-complétion
              </div>
              <div style={{ fontSize: 13, color: C.primaryDeep, marginBottom: 12, lineHeight: 1.6 }}>
                L'algo a rempli ton plan en priorisant eau → glucides → calories, dans la limite de 12% de ton poids corporel ({Math.round(userWeight * 0.12 * 10) / 10} kg).
                {(() => {
                  const totalKcal = zones.reduce((acc, z) => {
                    const items = autoCompletePreview[z.pointKey] || [];
                    return acc + items.reduce((s, { produitId, quantite }) => {
                      const p = produits.find(x => x.id === produitId); if (!p) return s;
                      const n = nutriProduit(p, quantite);
                      return s + n.kcal;
                    }, 0);
                  }, 0);
                  const totalGlu = zones.reduce((acc, z) => {
                    const items = autoCompletePreview[z.pointKey] || [];
                    return acc + items.reduce((s, { produitId, quantite }) => {
                      const p = produits.find(x => x.id === produitId); if (!p) return s;
                      const n = nutriProduit(p, quantite);
                      return s + n.glucides;
                    }, 0);
                  }, 0);
                  const couverture = nutriTotals.kcal > 0 ? Math.round(totalKcal / nutriTotals.kcal * 100) : 0;
                  return (
                    <span style={{ display: "block", marginTop: 4, fontWeight: 600 }}>
                      Résultat : {totalKcal} kcal · {totalGlu} g glucides · couverture {couverture}%
                    </span>
                  );
                })()}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn onClick={applyAutoComplete}>✅ Valider</Btn>
                <Btn variant="ghost" onClick={() => setAutoCompletePreview(null)}>Annuler</Btn>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
            {zones.map(zone => {
              const ptTotal = totalPoint(zone.pointKey);
              const gapKcal = ptTotal.kcal - zone.besoin.kcal;
              const gapGlu  = ptTotal.glucides - zone.besoin.glucides;
              return (
                <Card key={zone.pointKey} style={{ borderLeft: `4px solid ${zone.autonome ? C.muted : zone.pointKey === "depart" ? C.primary : C.green}` }}>
                  {/* En-tête zone */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {zone.pointKey === "depart" ? "🏁" : "🥤"} {zone.label}
                        <span style={{ fontSize: 12, color: "var(--muted-c)", fontWeight: 400, marginLeft: 8 }}>→ {zone.toLbl} · {(zone.to - zone.from).toFixed(1)} km</span>
                        {zone.autonome && <span style={{ fontSize: 11, background: "var(--surface-2)", color: "var(--muted-c)", padding: "1px 7px", borderRadius: 6, fontWeight: 600, marginLeft: 8 }}>Autonome</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 3 }}>
                        {zone.autonome
                          ? "Tronçon sans assistance — ce que tu emportes depuis ce point"
                          : `Besoin : ${zone.besoin.kcal} kcal · ${zone.besoin.glucides} g glucides · ${zone.besoin.eau >= 1000 ? `${(zone.besoin.eau/1000).toFixed(1)} L` : `${zone.besoin.eau} mL`} eau`}
                      </div>
                    </div>
                    {ptTotal.kcal > 0 && (
                      <div style={{ textAlign: "right", fontSize: 12 }}>
                        <div style={{ fontWeight: 700, color: gapColor(gapKcal), fontSize: 13 }}>{gapLabel(gapKcal, "kcal")}</div>
                        <div style={{ color: gapColor(gapGlu) }}>{gapLabel(gapGlu, "g gluc.")}</div>
                      </div>
                    )}
                  </div>

                  {/* Sélection produits */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {produits.map(p => {
                      const qte = getQte(zone.pointKey, p.id);
                      const n = qte > 0 ? nutriProduit(p, qte) : null;
                      return (
                        <div key={p.id} style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                          borderRadius: 10, background: qte > 0 ? C.green + "14" : "var(--surface-2)",
                          border: `1px solid ${qte > 0 ? C.green + "40" : "var(--border-c)"}`,
                          transition: "all 0.15s",
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nom}</div>
                            <div style={{ fontSize: 11, color: "var(--muted-c)" }}>
                              {p.kcal} kcal · {p.glucides}g glucides{p.par100g ? ` / 100g` : ` / unité`}
                            </div>
                          </div>
                          {/* Quantité */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            {qte > 0 && (
                              <div style={{ fontSize: 11, color: C.green, fontWeight: 600, whiteSpace: "nowrap" }}>
                                → {n.kcal} kcal · {n.glucides}g
                              </div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <button onClick={() => setQte(zone.pointKey, p.id, Math.max(0, qte - 1))} style={{
                                width: 26, height: 26, border: "1px solid var(--border-c)", borderRadius: 6,
                                background: "var(--surface)", cursor: "pointer", fontWeight: 700, fontSize: 14,
                                color: "var(--text-c)", fontFamily: "inherit",
                              }}>−</button>
                              <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700, fontSize: 14 }}>{qte}</span>
                              <button onClick={() => setQte(zone.pointKey, p.id, qte + 1)} style={{
                                width: 26, height: 26, border: "1px solid var(--border-c)", borderRadius: 6,
                                background: qte > 0 ? C.green : "var(--surface)", cursor: "pointer", fontWeight: 700, fontSize: 14,
                                color: qte > 0 ? "#fff" : "var(--text-c)", fontFamily: "inherit", transition: "all 0.15s",
                              }}>+</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total zone */}
                  {ptTotal.kcal > 0 && (
                    <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8, display: "flex", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
                      <span>Total emporté :</span>
                      <span style={{ color: C.red, fontWeight: 600 }}>{ptTotal.kcal} kcal</span>
                      <span style={{ color: C.yellow, fontWeight: 600 }}>{ptTotal.glucides} g glucides</span>
                      <span style={{ color: C.primary, fontWeight: 600 }}>{ptTotal.proteines} g protéines</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Gap analysis global */}
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Bilan global</div>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              {[
                { label: "Calories", besoin: nutriTotals.kcal, emporte: totalEmporte.kcal, unit: "kcal", color: C.red, icon: "🔥" },
                { label: "Glucides", besoin: nutriTotals.glucides, emporte: totalEmporte.glucides, unit: "g", color: C.yellow, icon: "🍌" },
                { label: "Protéines", besoin: null, emporte: totalEmporte.proteines, unit: "g", color: C.primary, icon: "💪" },
                { label: "Sodium", besoin: nutriTotals.sel, emporte: totalEmporte.sodium, unit: "mg", color: C.green, icon: "🧂" },
                { label: "Eau (boissons)", besoin: nutriTotals.eau, emporte: totalEmporte.eauMl, unit: "mL", color: C.blue, icon: "💧" },
              ].map(item => {
                const gap = item.besoin !== null ? item.emporte - item.besoin : null;
                const pct = item.besoin ? Math.min((item.emporte / item.besoin) * 100, 150) : 100;
                const barColor = gap === null ? C.primary : gap >= 0 ? C.green : C.red;
                return (
                  <div key={item.label} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "var(--muted-c)" }}>{item.icon} {item.label}</span>
                      {gap !== null && <span style={{ fontSize: 12, fontWeight: 700, color: gapColor(gap) }}>{gapLabel(gap, item.unit)}</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--muted-c)" }}>Emporté</span>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: barColor }}>{item.emporte} {item.unit}</span>
                    </div>
                    {item.besoin !== null && (
                      <>
                        <div style={{ height: 6, background: "var(--surface)", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.4s" }} />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted-c)" }}>Besoin estimé : {item.besoin} {item.unit}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* Modal produit */}
      <Modal open={prodModal} onClose={() => setProdModal(false)} title={editProdId ? "Modifier le produit" : "Ajouter un produit"}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[{ v: true, l: "Valeurs pour 100g / 100mL" }, { v: false, l: "Valeurs à l'unité" }].map(o => (
            <div key={String(o.v)} onClick={() => updP("par100g", o.v)} style={{
              flex: 1, padding: "8px 12px", borderRadius: 10, cursor: "pointer", textAlign: "center",
              border: `2px solid ${prodForm.par100g === o.v ? C.primary : "var(--border-c)"}`,
              background: prodForm.par100g === o.v ? C.primaryPale : "var(--surface-2)",
              fontSize: 13, fontWeight: prodForm.par100g === o.v ? 600 : 400,
              color: prodForm.par100g === o.v ? C.primaryDeep : "var(--text-c)",
            }}>{o.l}</div>
          ))}
        </div>
        <div className="form-grid">
          <Field label="Nom du produit" full><input value={prodForm.nom} onChange={e => updP("nom", e.target.value)} placeholder="Ex : Barre Trail Power" autoFocus /></Field>
          <Field label={prodForm.par100g ? "Poids unitaire (g)" : "Poids (g)"}><input type="number" min={0} value={prodForm.poids} onChange={e => updP("poids", e.target.value)} /></Field>
          <Field label="Kcal"><input type="number" min={0} value={prodForm.kcal} onChange={e => updP("kcal", e.target.value)} /></Field>
          <Field label="Glucides (g)"><input type="number" min={0} value={prodForm.glucides} onChange={e => updP("glucides", e.target.value)} /></Field>
          <Field label="Protéines (g)"><input type="number" min={0} value={prodForm.proteines} onChange={e => updP("proteines", e.target.value)} /></Field>
          <Field label="Lipides (g)"><input type="number" min={0} value={prodForm.lipides} onChange={e => updP("lipides", e.target.value)} /></Field>
          <Field label="Sodium (mg)"><input type="number" min={0} value={prodForm.sodium} onChange={e => updP("sodium", e.target.value)} /></Field>
          <Field label="Potassium (mg)"><input type="number" min={0} value={prodForm.potassium} onChange={e => updP("potassium", e.target.value)} /></Field>
          <Field label="Magnésium (mg)"><input type="number" min={0} value={prodForm.magnesium} onChange={e => updP("magnesium", e.target.value)} /></Field>
          <Field label="Zinc (mg)"><input type="number" min={0} value={prodForm.zinc} onChange={e => updP("zinc", e.target.value)} /></Field>
          <Field label="Calcium (mg)"><input type="number" min={0} value={prodForm.calcium} onChange={e => updP("calcium", e.target.value)} /></Field>
          <Field label="C'est une boisson" full>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <div onClick={() => updP("boisson", !prodForm.boisson)} style={{
                width: 40, height: 22, borderRadius: 11, cursor: "pointer", transition: "background 0.2s", position: "relative",
                background: prodForm.boisson ? C.blue : "var(--border-c)", flexShrink: 0,
              }}>
                <div style={{ position: "absolute", top: 3, left: prodForm.boisson ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
              <span style={{ fontSize: 13, color: "var(--muted-c)" }}>Compte dans le total eau</span>
            </div>
          </Field>
          {prodForm.boisson && (
            <Field label={prodForm.par100g ? "Volume (mL / 100g)" : "Volume par unité (mL)"}>
              <input type="number" min={0} value={prodForm.volumeMl} onChange={e => updP("volumeMl", e.target.value)} placeholder="Ex : 500" />
            </Field>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setProdModal(false)}>Annuler</Btn>
          <Btn onClick={saveProd}>Enregistrer</Btn>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmProdId} message="Supprimer ce produit de la bibliothèque ?" onConfirm={() => { updProduits(produits.filter(p => p.id !== confirmProdId)); setConfirmProdId(null); }} onCancel={() => setConfirmProdId(null)} />
    </div>
  );
}
