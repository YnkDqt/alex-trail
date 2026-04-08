import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { C, RUNNER_LEVELS, TERRAIN_TYPES, DEFAULT_EQUIPMENT, PREP_TIMELINE, EMPTY_SETTINGS, DEFAULT_FLAT_SPEED } from '../constants.js';
import { fmtTime, fmtPace, fmtHeure, isNight, calcNutrition, calcPassingTimes, exportRecap, exportGPXMontre, suggestSpeed, autoSegmentGPX, parseGarminCSV, buildElevationProfile, calcSlopeFromGPX, parseGPX } from '../utils.jsx';
import { Btn, Card, KPI, PageTitle, Field, Modal, ConfirmDialog, Empty, Hr, CustomTooltip } from '../atoms.jsx';

// ─── VUE STRATÉGIE DE COURSE ─────────────────────────────────────────────────
export default function StrategieView({ race, segments, setSegments, settings, setSettings, onOpenRepos, isMobile, profil }) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [computing, setComputing] = useState(false);
  const emptyForm = { startKm: "", endKm: "", slopePct: 0, speedKmh: 9.5, terrain: "normal", notes: "" };
  const [form, setForm] = useState(emptyForm);

  // Zones FC Karvonen
  const zonesFC = useMemo(() => {
    const r = parseInt(profil?.fcRepos) || 0;
    const m = parseInt(profil?.fcMax) || 0;
    if (!r || !m || m <= r) return null;
    const rr = m - r;
    const ZONES = [
      { z: "Z1", label: "Récup",     lo: 0.50, hi: 0.60, color: "#4A82B0" },
      { z: "Z2", label: "Endurance",  lo: 0.60, hi: 0.70, color: C.green },
      { z: "Z3", label: "Tempo",      lo: 0.70, hi: 0.80, color: C.yellow },
      { z: "Z4", label: "Seuil",      lo: 0.80, hi: 0.90, color: "#C4521A" },
      { z: "Z5", label: "VO2max",     lo: 0.90, hi: 1.00, color: C.red },
    ];
    return ZONES.map(z => ({ ...z, lo: Math.round(r + rr * z.lo), hi: Math.round(r + rr * z.hi) }));
  }, [profil]);

  // Vitesses de référence depuis allures profil (Z2/Z3)
  const vitessesRef = useMemo(() => {
    const z2 = profil?.allureZ2; // min/km
    const z3 = profil?.allureZ3;
    if (!z2 && !z3) return null;
    return {
      z2: z2 ? (60 / z2).toFixed(1) : null, // km/h
      z3: z3 ? (60 / z3).toFixed(1) : null,
    };
  }, [profil]);

  const updS = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const openNew  = ()  => { setEditId(null);   setForm(emptyForm); setModal(true); };
  const openEdit = seg => { setEditId(seg.id); setForm(seg);       setModal(true); };
  const updForm = (key, val) => {
    setForm(f => {
      const nf = { ...f, [key]: val };
      if (key === "startKm" || key === "endKm") {
        const slope = race.gpxPoints?.length ? calcSlopeFromGPX(race.gpxPoints, parseFloat(nf.startKm)||0, parseFloat(nf.endKm)||0) : nf.slopePct;
        nf.slopePct = slope;
        nf.speedKmh = suggestSpeed(slope, settings.garminCoeff, settings);
      }
      if (key === "slopePct") nf.speedKmh = suggestSpeed(val, settings.garminCoeff, settings);
      return nf;
    });
  };
  const save = () => {
    const seg = { ...form, startKm: parseFloat(form.startKm)||0, endKm: parseFloat(form.endKm)||0 };
    if (seg.endKm <= seg.startKm) return;
    if (editId) setSegments(s => s.map(x => x.id === editId ? { ...seg, id: editId } : x));
    else setSegments(s => [...s, { ...seg, id: Date.now() }].sort((a,b) => a.startKm - b.startKm));
    setModal(false);
  };
  const autoSegment = () => {
    if (!race.gpxPoints?.length) return;
    setComputing(true);
    setTimeout(() => {
      const newSegs = autoSegmentGPX(race.gpxPoints, settings.garminCoeff, settings);
      const preserved = segments.filter(s => s.type === "ravito" || s.type === "repos");
      setSegments([...newSegs, ...preserved].sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
      setComputing(false);
    }, 50);
  };

  // Segments de course normaux vs segments de repos vs ravitos
  const segsNormaux = segments.filter(s => s.type !== "repos" && s.type !== "ravito");
  const segsRepos   = segments.filter(s => s.type === "repos");

  // Temps course = segments normaux seulement
  const totalTime = segsNormaux.reduce((s, seg) => s + (seg.speedKmh > 0 ? ((seg.endKm - seg.startKm) / seg.speedKmh) * 3600 : 0), 0);
  // Temps repos = somme des durées de repos
  const totalReposSec = segsRepos.reduce((s, seg) => s + (seg.dureeMin || 0) * 60, 0);
  const ravitoCount = race.ravitos?.length || 0;
  const totalRavitoSec = ravitoCount * (settings.ravitoTimeMin || 3) * 60;
  const totalWithRavitos = totalTime + totalRavitoSec + totalReposSec;

  const barData = segsNormaux.map((s, i) => ({ name: `S${i+1}`, vitesse: s.speedKmh, pente: s.slopePct }));

  // ── Heures de passage ──────────────────────────────────────────────────────
  const { times: passingTimes, startSec } = calcPassingTimes(segments, settings.startTime);
  const arrivalTime = passingTimes.length ? passingTimes[passingTimes.length - 1] : startSec;

  const EFFORT_OPTIONS = [
    { key: "comfort", label: "Finisher", desc: "Terminer sans se cramer — vitesses -12%", color: C.green },
    { key: "normal",  label: "Course normale", desc: "Equilibre selon ton profil Garmin", color: C.primary },
    { key: "perf",    label: "Chrono", desc: "Aller chercher le temps — vitesses +8%", color: C.red },
  ];
  const PACE_LABELS = ["Partir très vite", "Partir vite", "Régulier", "Partir lentement", "Très négatif"];

  const paceIdx = (settings.paceStrategy || 0) + 2;

  return (
    <div className="anim">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <PageTitle sub={segments.length ? `${segments.filter(s => s.type !== "ravito" && s.type !== "repos").length} segments · ${ravitoCount} ravito${ravitoCount>1?"s":""} — ${fmtTime(totalWithRavitos)}` : "Définis ta stratégie et génère tes segments"}>
          Stratégie de course
        </PageTitle>
        {segments.length > 0 && race.gpxPoints?.length > 0 && !isMobile && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0, marginTop: 4 }}>
            <Btn size="sm" variant="soft" onClick={() => {
              const profile = race.gpxPoints?.length ? buildElevationProfile(race.gpxPoints, 300) : [];
              exportRecap(race, segments, settings, profile, passingTimes);
            }}>📄 Récap course</Btn>
            <Btn size="sm" variant="soft" onClick={() => exportGPXMontre(race, segments, settings, passingTimes)}>📡 Export montre</Btn>
            <Btn size="sm" variant="soft" style={{ opacity: 0.55, cursor: "default" }}
              title="Export Garmin FIT avec alertes de pace — bientôt disponible"
              onClick={() => alert("🏅 Fonctionnalité Premium\n\nL'export Garmin FIT avec alertes de pace par segment arrive prochainement.\n\nUtilise « Export montre » pour un GPX compatible toutes montres.")}>
              🎯 Garmin FIT <span style={{ fontSize: 9, background: C.primary, color: "#fff", borderRadius: 4, padding: "1px 5px", marginLeft: 4, verticalAlign: "middle" }}>Premium</span>
            </Btn>
          </div>
        )}
      </div>
      {segments.length > 0 && race.gpxPoints?.length > 0 && isMobile && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <Btn size="sm" variant="soft" onClick={() => {
            const profile = race.gpxPoints?.length ? buildElevationProfile(race.gpxPoints, 300) : [];
            exportRecap(race, segments, settings, profile, passingTimes);
          }}>📄 Récap course</Btn>
          <Btn size="sm" variant="soft" onClick={() => exportGPXMontre(race, segments, settings, passingTimes)}>📡 Export montre</Btn>
          <Btn size="sm" variant="soft" style={{ opacity: 0.55, cursor: "default" }}
            title="Export Garmin FIT avec alertes de pace — bientôt disponible"
            onClick={() => alert("🏅 Fonctionnalité Premium\n\nL'export Garmin FIT avec alertes de pace par segment arrive prochainement.\n\nUtilise « Export montre » pour un GPX compatible toutes montres.")}>
            🎯 Garmin FIT <span style={{ fontSize: 9, background: C.primary, color: "#fff", borderRadius: 4, padding: "1px 5px", marginLeft: 4, verticalAlign: "middle" }}>Premium</span>
          </Btn>
        </div>
      )}

      <div style={{ background: C.primaryPale, border: `1px solid ${C.primary}40`, borderRadius: 12, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: C.primaryDeep }}>
        Configure ta course dans <strong>Profil de course</strong> — retrouve ici les heures de passage et les segments.
      </div>

      {/* Zones FC + Vitesses référence */}
      {(zonesFC || vitessesRef) && (
        <div style={{ display: "grid", gridTemplateColumns: zonesFC && vitessesRef ? "1fr 1fr" : "1fr", gap: 14, marginBottom: 20 }}>
          {zonesFC && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.muted, marginBottom: 8 }}>
                Zones FC · {profil?.fcRepos}-{profil?.fcMax} bpm
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {zonesFC.map(z => (
                  <div key={z.z} style={{ flex: 1, textAlign: "center", padding: "6px 2px", borderRadius: 6, background: z.color + "12", border: `1px solid ${z.color}30` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: z.color }}>{z.z}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.inkLight }}>{z.lo}-{z.hi}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {vitessesRef && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.muted, marginBottom: 8 }}>
                Vitesses référence
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                {vitessesRef.z2 && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: C.muted }}>Endurance Z2</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>{vitessesRef.z2} <span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>km/h</span></div>
                  </div>
                )}
                {vitessesRef.z3 && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: C.muted }}>Tempo Z3</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.yellow }}>{vitessesRef.z3} <span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>km/h</span></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RÉSULTATS ── */}
      {!segments.length ? (
        <Empty icon="✂️" title="Aucun segment défini" sub="Génère les segments depuis ta stratégie, ou ajoute-en un manuellement." action={<Btn onClick={openNew}>+ Ajouter un segment</Btn>} />
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(3, 1fr)", gap: isMobile ? 8 : 14, marginBottom: 20 }}>
            <KPI label="Temps course" value={fmtTime(totalTime)} color={C.secondary} icon="⏱️" sub="hors ravitos" />
            <KPI label="Temps total" value={fmtTime(totalWithRavitos)} icon="🏁" sub={`+${ravitoCount} ravito${ravitoCount>1?"s":""}`} />
            <KPI label="Arrivée estimée" value={fmtHeure(arrivalTime)} icon={isNight(arrivalTime) ? "🌙" : "☀️"} color={isNight(arrivalTime) ? C.blue : C.yellow} sub={`départ ${settings.startTime || "07:00"}`} />
          </div>

          {/* Graphique vitesses */}
          <Card noPad style={{ marginBottom: 20 }}>
            <div style={{ padding: "14px 20px 0", fontWeight: 600 }}>Vitesses par segment</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={barData} margin={{ top: 8, right: 20, bottom: 4, left: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} />
                <RTooltip content={<CustomTooltip />} />
                <Bar dataKey="vitesse" name="km/h" radius={[4,4,0,0]}>
                  {barData.map((d, i) => <Cell key={i} fill={d.pente > 9 ? C.red : d.pente < -12 ? C.blue : d.pente > 4 ? C.yellow : C.green} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Tableau segments */}
          <Card noPad>
            <div style={{ padding: "14px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Segments</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn size="sm" variant="ghost" onClick={onOpenRepos}>💤 Repos</Btn>
                <Btn size="sm" onClick={openNew}>+ Segment</Btn>
              </div>
            </div>
            <div className="tbl-wrap">
              <table style={{ fontSize: isMobile ? 11 : undefined }}>
                <thead><tr>
                  <th>#</th><th>De</th><th>À</th><th>Dist.</th><th>Pente</th><th>Terrain</th><th>Vitesse</th><th>Allure</th><th>Durée</th><th>Cum.</th><th>Heure</th><th>Nutrition/h</th><th></th>
                </tr></thead>
                <tbody>{(() => {
                  let segNum = 0;
                  return segments.map((seg, i) => {
                    if (seg.type === "ravito") {
                      const t = passingTimes[i]; const night = isNight(t);
                      return (
                        <tr key={seg.id} style={{ background: C.green + "10", cursor: "default" }}>
                          <td style={{ color: "var(--muted-c)", fontSize: 16 }}>🥤</td>
                          <td style={{ fontWeight: 600, color: C.green }}>{seg.label}</td>
                          <td style={{ color: "var(--muted-c)", fontSize: 12 }}>km {seg.startKm}</td>
                          <td colSpan={2} style={{ color: "var(--muted-c)", fontSize: 13 }}>{seg.dureeMin} min — {fmtTime(seg.dureeMin * 60)}</td>
                          <td colSpan={4} style={{ color: "var(--muted-c)", fontSize: 12, fontStyle: "italic" }}>Arrêt ravitaillement · pas de distance</td>
                          <td><span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: "var(--muted-c)" }}>{fmtTime(t - startSec)}</span></td>
                          <td><span style={{ fontWeight: 700, fontSize: 13, color: night ? C.blue : C.primary }}>{fmtHeure(t)}</span>{night && <span style={{ marginLeft: 4, fontSize: 11 }}>🌙</span>}</td>
                          <td></td>
                          <td><span style={{ fontSize: 11, color: "var(--muted-c)" }}>auto</span></td>
                        </tr>
                      );
                    }
                    if (seg.type === "repos") {
                      const t = passingTimes[i]; const night = isNight(t);
                      return (
                        <tr key={seg.id} style={{ background: "var(--surface-2)", cursor: "default" }}>
                          <td style={{ color: "var(--muted-c)", fontSize: 16 }}>💤</td>
                          <td style={{ fontWeight: 600, color: C.blue }}>{seg.label}</td>
                          <td style={{ color: "var(--muted-c)", fontSize: 12 }}>km {seg.startKm}</td>
                          <td colSpan={2} style={{ color: "var(--muted-c)", fontSize: 13 }}>{seg.dureeMin} min — {fmtTime(seg.dureeMin * 60)}</td>
                          <td colSpan={4} style={{ color: "var(--muted-c)", fontSize: 12, fontStyle: "italic" }}>Pas de distance · temps ajouté au total</td>
                          <td><span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: "var(--muted-c)" }}>{fmtTime(t - startSec)}</span></td>
                          <td><span style={{ fontWeight: 700, fontSize: 13, color: night ? C.blue : C.primary }}>{fmtHeure(t)}</span>{night && <span style={{ marginLeft: 4, fontSize: 11 }}>🌙</span>}</td>
                          <td></td>
                          <td onClick={e => e.stopPropagation()}><Btn size="sm" variant="danger" onClick={() => setConfirmId(seg.id)}>✕</Btn></td>
                        </tr>
                      );
                    }
                    segNum++;
                    const dist = seg.endKm - seg.startKm;
                    const dur  = fmtTime((dist / seg.speedKmh) * 3600);
                    const n    = calcNutrition(seg, settings);
                    const terrainLabel = TERRAIN_TYPES.find(t => t.key === (seg.terrain || "normal"))?.label || "Normal";
                    const terrainKey   = seg.terrain || "normal";
                    const t    = passingTimes[i]; const night = isNight(t);
                    return (
                      <tr key={seg.id} onClick={() => openEdit(seg)} style={{ cursor: "pointer" }}>
                        <td style={{ color: "var(--muted-c)" }}>{segNum}</td>
                        <td>{seg.startKm} km</td><td>{seg.endKm} km</td><td>{dist.toFixed(1)} km</td>
                        <td>
                          <span className={`badge ${seg.slopePct > 9 ? "badge-red" : seg.slopePct < -12 ? "badge-blue" : "badge-sage"}`}>{seg.slopePct > 0 ? "+" : ""}{seg.slopePct}%</span>
                          {seg.slopePct > 10 && <span style={{ marginLeft: 6, fontSize: 11, color: C.yellow }}>marche</span>}
                        </td>
                        <td>{terrainKey !== "normal" ? <span className="badge badge-yellow" style={{ fontSize: 11 }}>{terrainLabel}</span> : <span style={{ fontSize: 12, color: "var(--muted-c)" }}>—</span>}</td>
                        <td style={{ fontWeight: 600 }}>{seg.speedKmh} km/h</td>
                        <td style={{ fontFamily: "'Playfair Display', serif" }}>{fmtPace(seg.speedKmh)}/km</td>
                        <td>{dur}</td>
                        <td style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, color: C.secondary }}>{fmtTime(t - startSec)}</td>
                        <td><span style={{ fontWeight: 700, fontSize: 13, color: night ? C.blue : C.primary }}>{fmtHeure(t)}</span>{night && <span style={{ marginLeft: 4, fontSize: 11 }}>🌙</span>}</td>
                        <td style={{ fontSize: 12, color: "var(--muted-c)" }}>{n.eauH}mL · {n.glucidesH}g · {n.kcalH}kcal</td>
                        <td onClick={e => e.stopPropagation()}><Btn size="sm" variant="danger" onClick={() => setConfirmId(seg.id)}>✕</Btn></td>
                      </tr>
                    );
                  });
                })()}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "Modifier segment" : "Nouveau segment"}>
        <div className="form-grid">
          <Field label="Début (km)"><input type="number" min={0} step={0.1} value={form.startKm} onChange={e => updForm("startKm", e.target.value)} /></Field>
          <Field label="Fin (km)"><input type="number" min={0} step={0.1} value={form.endKm} onChange={e => updForm("endKm", e.target.value)} /></Field>
          <Field label="Pente (%)">
            <input type="range" min={-25} max={30} step={1} value={form.slopePct} onChange={e => updForm("slopePct", Number(e.target.value))} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted-c)", marginTop: 4 }}>
              <span>-25%</span>
              <span style={{ fontWeight: 600, color: form.slopePct > 10 ? C.red : "var(--text-c)" }}>{form.slopePct > 0 ? "+" : ""}{form.slopePct}%</span>
              <span>+30%</span>
            </div>
          </Field>
          <Field label="Vitesse (km/h)">
            <input type="range" min={2} max={15} step={0.5} value={form.speedKmh} onChange={e => updForm("speedKmh", Number(e.target.value))} />
            <div style={{ textAlign: "center", fontSize: 13, marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>{form.speedKmh} km/h</span>
              <span style={{ color: "var(--muted-c)", marginLeft: 8 }}>({fmtPace(form.speedKmh)}/km)</span>
            </div>
          </Field>
          <Field label="Terrain" full>
            <div style={{ display: "flex", gap: 8 }}>
              {TERRAIN_TYPES.map(t => {
                const terrainCoeff = t.coeff;
                const isActive = (form.terrain || "normal") === t.key;
                return (
                  <div key={t.key} onClick={() => {
                    const baseSpeed = suggestSpeed(form.slopePct, settings.garminCoeff, settings);
                    setForm(f => ({ ...f, terrain: t.key, speedKmh: Math.max(2, +(baseSpeed * terrainCoeff).toFixed(1)) }));
                  }} style={{
                    flex: 1, padding: "8px 6px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                    border: `2px solid ${isActive ? C.primary : "var(--border-c)"}`,
                    background: isActive ? C.primaryPale : "var(--surface-2)",
                    transition: "all 0.15s",
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? C.primaryDeep : "var(--text-c)" }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 2 }}>×{t.coeff}</div>
                  </div>
                );
              })}
            </div>
          </Field>
          <Field label="Notes" full><textarea value={form.notes} onChange={e => updForm("notes", e.target.value)} rows={2} /></Field>
        </div>
        {form.slopePct > 10 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.yellowPale, borderRadius: 10, fontSize: 13, color: C.yellow }}>
            Marche conseillée — pente élevée ({form.slopePct}%)
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setModal(false)}>Annuler</Btn>
          <Btn onClick={save}>Enregistrer</Btn>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmId} message="Supprimer ce segment ?" onConfirm={() => { setSegments(s => s.filter(x => x.id !== confirmId)); setConfirmId(null); }} onCancel={() => setConfirmId(null)} />
    </div>
  );
}
