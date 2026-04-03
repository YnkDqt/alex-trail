import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { C, RUNNER_LEVELS, TERRAIN_TYPES, DEFAULT_EQUIPMENT, PREP_TIMELINE, EMPTY_SETTINGS, DEFAULT_FLAT_SPEED } from '../constants.js';
import { fmtTime, fmtPace, fmtHeure, isNight, calcNutrition, calcPassingTimes, exportRecap, exportGPXMontre, suggestSpeed, autoSegmentGPX, parseGarminCSV, buildElevationProfile, calcSlopeFromGPX, parseGPX, enrichElevation } from '../utils.jsx';
import { Btn, Card, KPI, PageTitle, Field, Modal, ConfirmDialog, Empty, Hr, CustomTooltip } from '../atoms.jsx';

// ─── VUE PROFIL DE COURSE ────────────────────────────────────────────────────
export default function ProfilView({ race, setRace, segments, setSegments, settings, setSettings, onOpenRepos, isMobile, profilDetail = true }) {
  const [gpxError, setGpxError]       = useState(null);
  const [tooltipGlu, setTooltipGlu]   = useState(false);
  const [gpxStatus, setGpxStatus]     = useState(null);
  const [dragging, setDragging]       = useState(false);
  const [elevConflict, setElevConflict] = useState(null); // { pointsGPS, dPlusGPS, pointsAPI, dPlusAPI }
  const [hoveredSeg, setHoveredSeg]   = useState(null);
  const [ravitoModal, setRavitoModal] = useState(false);
  const [ravitoForm, setRavitoForm]   = useState({ km: "", name: "", address: "", notes: "", dureeMin: "", assistancePresente: true });
  const [editRavitoId, setEditRavitoId] = useState(null);
  const [confirmId, setConfirmId]     = useState(null);
  const [segModal, setSegModal]       = useState(false);
  const [editSegId, setEditSegId]     = useState(null);
  const [computing, setComputing]     = useState(false);
  const emptySegForm = { startKm: "", endKm: "", slopePct: 0, speedKmh: 9.5, terrain: "normal", notes: "" };
  const [segForm, setSegForm]         = useState(emptySegForm);
  const fileRef = useRef();

  const profile = useMemo(() => race.gpxPoints?.length ? buildElevationProfile(race.gpxPoints, 300) : [], [race.gpxPoints]);
  const updS = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  // Même logique que StrategieView — segments normaux + repos séparément, ravitos depuis race.ravitos
  const segsNormaux  = segments.filter(s => s.type !== "ravito" && s.type !== "repos");
  const segsRepos    = segments.filter(s => s.type === "repos");
  const totalTime    = segsNormaux.reduce((s, seg) => s + (seg.speedKmh > 0 ? ((seg.endKm - seg.startKm) / seg.speedKmh) * 3600 : 0), 0);
  const totalReposSec = segsRepos.reduce((s, seg) => s + (seg.dureeMin || 0) * 60, 0);
  const totalRavitoSec = (race.ravitos?.length || 0) * (settings.ravitoTimeMin || 3) * 60;
  const nutriTotals = useMemo(() => segments.reduce((acc, seg) => {
    if (seg.type === "ravito" || seg.type === "repos") return acc;
    const n = calcNutrition(seg, settings);
    const durationH = seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh : 0;
    return { kcal: acc.kcal + n.kcal, eau: acc.eau + Math.round(n.eauH * durationH), glucides: acc.glucides + Math.round(n.glucidesH * durationH), sel: acc.sel + Math.round(n.selH * durationH) };
  }, { kcal: 0, eau: 0, glucides: 0, sel: 0 }), [segments, settings]);

  const highlightData = useMemo(() => {
    if (!profile.length) return profile;
    if (!hoveredSeg) return profile.map(p => ({ ...p, eleHL: null }));
    return profile.map(p => ({
      ...p,
      eleHL: p.dist >= hoveredSeg.startKm && p.dist <= hoveredSeg.endKm ? p.ele : null,
    }));
  }, [hoveredSeg, profile]);

  const handleGPX = (file) => {
    if (!file) return;
    setGpxError(null);
    setGpxStatus(null);

    const reader = new FileReader();
    reader.onload = e => {
      const process = async () => {
        try {
          setGpxStatus("🗺️ Lecture du fichier GPX…");
          await new Promise(r => setTimeout(r, 50));

          const parsed = parseGPX(e.target.result);
          let { points, totalDistance, totalElevPos, totalElevNeg, trackName } = parsed;

          if (trackName && !settings.raceName) setSettings(s => ({ ...s, raceName: trackName }));

          if (parsed.needsElevation) {
            setGpxStatus("📡 Pas d'altitude dans le fichier — récupération en cours… (quelques secondes)");
            try {
              const result = await enrichElevation(points);
              points = result.enriched;
              totalElevPos = result.totalElevPos;
              totalElevNeg = result.totalElevNeg;
              setGpxStatus("🧮 Analyse du profil altimétrique…");
              await new Promise(r => setTimeout(r, 300));
              setGpxStatus("✅ Tracé prêt !");
              setTimeout(() => setGpxStatus(null), 3000);
            } catch (apiErr) {
              setGpxStatus(null);
              setGpxError(`⚠️ GPX sans altitude — récupération impossible (${apiErr.message}). Enrichis ton fichier sur gpx.studio puis recharge-le.`);
            }
          } else {
            setGpxStatus("📡 Vérification des altitudes… Alex réfléchit à la meilleure source pour ton tracé.");
            try {
              const result = await enrichElevation(points);
              const dPlusAPI = result.totalElevPos;
              const dPlusGPS = totalElevPos;
              const ecart = Math.abs(dPlusGPS - dPlusAPI) / Math.max(dPlusGPS, dPlusAPI, 1);
              if (ecart > 0.20) {
                setRace(r => ({ ...r, gpxPoints: points, totalDistance, totalElevPos, totalElevNeg }));
                if (trackName && !settings.raceName) setSettings(s => ({ ...s, raceName: trackName }));
                setElevConflict({
                  pointsGPS: points, dPlusGPS: Math.round(totalElevPos),
                  pointsAPI: result.enriched, dPlusAPI: Math.round(dPlusAPI),
                  dMinusGPS: Math.round(totalElevNeg), dMinusAPI: Math.round(result.totalElevNeg),
                  distance: totalDistance, trackName,
                });
                setGpxStatus(null);
                return;
              } else {
                setGpxStatus("🧮 Analyse du profil altimétrique…");
                await new Promise(r => setTimeout(r, 300));
                setGpxStatus("✅ Tracé prêt !");
                setTimeout(() => setGpxStatus(null), 3000);
              }
            } catch {
              setGpxStatus("🧮 Analyse du profil altimétrique…");
              await new Promise(r => setTimeout(r, 300));
              setGpxStatus("✅ Tracé prêt !");
              setTimeout(() => setGpxStatus(null), 3000);
            }
          }

          setRace(r => ({ ...r, gpxPoints: points, totalDistance, totalElevPos, totalElevNeg }));
        } catch (err) {
          setGpxError(err.message);
          setGpxStatus(null);
        }
      };
      process();
    };
    reader.readAsText(file);
  };
  const onDrop = e => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".gpx")) handleGPX(file);
    else setGpxError("Fichier GPX requis (.gpx)");
  };

  const saveRavito = () => {
    const km = parseFloat(ravitoForm.km);
    if (isNaN(km) || !ravitoForm.name) return;
    const dureeMin = ravitoForm.dureeMin !== "" ? Number(ravitoForm.dureeMin) : (settings.ravitoTimeMin || 3);
    if (editRavitoId) {
      setRace(r => ({ ...r, ravitos: r.ravitos.map(rv => rv.id === editRavitoId ? { ...ravitoForm, km, dureeMin, id: editRavitoId } : rv) }));
      setSegments(s => s.map(seg =>
        seg.type === "ravito" && seg.ravitoId === editRavitoId
          ? { ...seg, startKm: km, endKm: km, label: ravitoForm.name, dureeMin }
          : seg
      ).sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
    } else {
      const id = Date.now();
      setRace(r => ({ ...r, ravitos: [...(r.ravitos||[]), { ...ravitoForm, km, dureeMin, id }] }));
      setSegments(s => [...s, {
        id: id + 1, type: "ravito", ravitoId: id,
        label: ravitoForm.name, startKm: km, endKm: km,
        dureeMin,
        speedKmh: 0, slopePct: 0, terrain: "normal", notes: "",
      }].sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
    }
    setRavitoModal(false); setRavitoForm({ km: "", name: "", address: "", notes: "", dureeMin: "", assistancePresente: true }); setEditRavitoId(null);
  };
  const openEditRavito = rv => { setEditRavitoId(rv.id); setRavitoForm({ km: rv.km, name: rv.name, address: rv.address || "", notes: rv.notes || "", dureeMin: rv.dureeMin || "", assistancePresente: rv.assistancePresente !== false }); setRavitoModal(true); };
  const deleteRavito = id => {
    setRace(r => ({ ...r, ravitos: (r.ravitos||[]).filter(rv => rv.id !== id) }));
    setSegments(s => s.filter(seg => !(seg.type === "ravito" && seg.ravitoId === id)));
    setConfirmId(null);
  };

  const updSeg = (key, val) => {
    setSegForm(f => {
      const nf = { ...f, [key]: val };
      if (key === "startKm" || key === "endKm") {
        const slope = race.gpxPoints?.length ? calcSlopeFromGPX(race.gpxPoints, parseFloat(nf.startKm)||0, parseFloat(nf.endKm)||0) : nf.slopePct;
        nf.slopePct = slope; nf.speedKmh = suggestSpeed(slope, settings.garminCoeff, settings);
      }
      if (key === "slopePct") nf.speedKmh = suggestSpeed(val, settings.garminCoeff, settings);
      return nf;
    });
  };
  const openNewSeg  = ()  => { setEditSegId(null);   setSegForm(emptySegForm); setSegModal(true); };
  const openEditSeg = seg => { setEditSegId(seg.id); setSegForm(seg);          setSegModal(true); };
  const saveSeg = () => {
    const seg = { ...segForm, startKm: parseFloat(segForm.startKm)||0, endKm: parseFloat(segForm.endKm)||0 };
    if (seg.endKm <= seg.startKm) return;
    if (editSegId) setSegments(s => [...s.map(x => x.id === editSegId ? { ...seg, id: editSegId } : x)].sort((a,b) => a.startKm - b.startKm));
    else           setSegments(s => [...s, { ...seg, id: Date.now() }].sort((a,b) => a.startKm - b.startKm));
    setSegModal(false);
  };
  const deleteSeg = id => { setSegments(s => s.filter(x => x.id !== id)); setConfirmId(null); };
  const autoSegment = () => {
    if (!race.gpxPoints?.length) return;
    setComputing(true);
    setTimeout(() => {
      const newSegs = autoSegmentGPX(race.gpxPoints, settings.garminCoeff, settings);
      // Préserver ravitos et repos existants, remplacer uniquement les segments normaux
      const preserved = segments.filter(s => s.type === "ravito" || s.type === "repos");
      setSegments([...newSegs, ...preserved].sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
      setComputing(false);
    }, 50);
  };

  const minEle = profile.length ? Math.min(...profile.map(p => p.ele)) - 20 : 0;

  return (
    <div className="anim">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <PageTitle sub={race.gpxPoints?.length ? `${race.totalDistance?.toFixed(1)} km chargés` : "Importe ton tracé GPX pour commencer"}>
          {settings.raceName || race.name || "Profil de course"}
        </PageTitle>
      </div>

      {!race.gpxPoints?.length ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? C.primary : "var(--border-c)"}`,
            borderRadius: 20, padding: "60px 24px", textAlign: "center",
            cursor: "pointer", background: dragging ? C.primaryPale : "var(--surface)",
            transition: "all 0.2s",
          }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, marginBottom: 8 }}>Glisse ton fichier GPX ici</div>
          <p style={{ color: "var(--muted-c)" }}>ou clique pour sélectionner un fichier .gpx</p>
          {gpxError && <p style={{ color: C.red, marginTop: 12, fontSize: 13 }}>{gpxError}</p>}
          {gpxStatus && <p style={{ color: gpxStatus.startsWith("✅") ? C.green : C.primary, marginTop: 12, fontSize: 13 }}>{gpxStatus}</p>}
          <input ref={fileRef} type="file" accept=".gpx" style={{ display: "none" }} onChange={e => handleGPX(e.target.files[0])} />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(auto-fit, minmax(140px, 1fr))", gap: isMobile ? 8 : 14, marginBottom: 16 }}>
            <KPI label="Distance" value={`${race.totalDistance?.toFixed(1)} km`} icon="📏" />
            <KPI label="D+" value={`${Math.round(race.totalElevPos)} m`} color={C.red} icon="⛰️" />
            <KPI label="D−" value={`${Math.round(race.totalElevNeg)} m`} color={C.blue} icon="🏔️" />
            <KPI label="Segments" value={segments.filter(s => s.type !== "ravito" && s.type !== "repos").length} icon="✂️" />
            <KPI label="Temps estimé" value={fmtTime(totalTime + totalRavitoSec + totalReposSec)} color={C.secondary} icon="⏱️" sub="ravitos inclus" />
          </div>
          {gpxStatus && (
            <div style={{ padding: "8px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13, fontWeight: 500,
              background: gpxStatus.startsWith("✅") ? C.green + "15" : C.primary + "12",
              color: gpxStatus.startsWith("✅") ? C.green : C.primaryDeep,
            }}>
              {gpxStatus}
            </div>
          )}
          {gpxError && (
            <div style={{ padding: "8px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13, background: C.red + "12", color: C.red }}>
              {gpxError}
            </div>
          )}

          {/* Bandeau conflit altitudes GPS vs API */}
          {elevConflict && (
            <div style={{ padding: "18px 20px", borderRadius: 14, marginBottom: 16, background: C.yellowPale, border: `1px solid ${C.yellow}40` }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.yellow, marginBottom: 8 }}>
                ⚠️ Conflit d'altitudes détecté
              </div>
              <p style={{ fontSize: 13, color: C.text, marginBottom: 14, lineHeight: 1.6 }}>
                Les altitudes GPS de ta montre et le modèle de terrain (SRTM) donnent des dénivelés très différents. Choisis la source la plus fiable pour ta course.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: C.secondaryPale, border: `2px solid ${C.secondary}` }}>
                  <div style={{ fontWeight: 700, color: C.secondaryDark, marginBottom: 4 }}>📡 Altimètre GPS / montre</div>
                  <div style={{ fontSize: 13 }}>D+ <strong>{elevConflict.dPlusGPS} m</strong> · D− {elevConflict.dMinusGPS} m</div>
                  <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 4 }}>Recommandé si enregistrement Garmin avec altimètre barométrique</div>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: C.primaryPale, border: `2px solid ${C.primary}40` }}>
                  <div style={{ fontWeight: 700, color: C.primaryDeep, marginBottom: 4 }}>🌍 Modèle terrain SRTM</div>
                  <div style={{ fontSize: 13 }}>D+ <strong>{elevConflict.dPlusAPI} m</strong> · D− {elevConflict.dMinusAPI} m</div>
                  <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 4 }}>Recommandé pour les GPX de tracés officiels sans altitude</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn variant="sage" onClick={() => {
                  setRace(r => ({ ...r, gpxPoints: elevConflict.pointsGPS, totalDistance: elevConflict.distance, totalElevPos: elevConflict.dPlusGPS, totalElevNeg: elevConflict.dMinusGPS }));
                  if (elevConflict.trackName && !settings.raceName) setSettings(s => ({ ...s, raceName: elevConflict.trackName }));
                  setElevConflict(null);
                }}>📡 Utiliser GPS / montre</Btn>
                <Btn variant="ghost" onClick={() => {
                  setRace(r => ({ ...r, gpxPoints: elevConflict.pointsAPI, totalDistance: elevConflict.distance, totalElevPos: elevConflict.dPlusAPI, totalElevNeg: elevConflict.dMinusAPI }));
                  if (elevConflict.trackName && !settings.raceName) setSettings(s => ({ ...s, raceName: elevConflict.trackName }));
                  setElevConflict(null);
                }}>🌍 Utiliser SRTM</Btn>
              </div>
            </div>
          )}

          {/* Graphe sticky */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--surface)", paddingBottom: 6, marginBottom: 6 }}>
            <Card noPad>
              <div style={{ padding: "14px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 600 }}>Profil altimétrique</div>
                {hoveredSeg && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.yellow }}>
                    S{segments.indexOf(hoveredSeg)+1} — {hoveredSeg.startKm}→{hoveredSeg.endKm} km · {hoveredSeg.slopePct > 0 ? "+" : ""}{hoveredSeg.slopePct}%
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={highlightData} margin={{ top: 10, right: 20, bottom: 10, left: 40 }}>
                  <defs>
                    <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.primary} stopOpacity={hoveredSeg ? 0.12 : 0.35} />
                      <stop offset="95%" stopColor={C.primary} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="eleHover" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.yellow} stopOpacity={0.72} />
                      <stop offset="100%" stopColor={C.yellow} stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dist" type="number" domain={profile.length ? [0, profile[profile.length-1].dist] : ["auto","auto"]} tickFormatter={v => `${v.toFixed(0)}km`} tick={{ fontSize: 11, fill: C.muted }} />
                  <YAxis domain={[minEle, "auto"]} tick={{ fontSize: 11, fill: C.muted }} />
                  <RTooltip content={<CustomTooltip />} formatter={(v, n) => [n === "ele" ? `${v} m` : `${v} km`, n === "ele" ? "Altitude" : "Dist"]} />
                  {(race.ravitos||[]).map(rv => (
                    <ReferenceLine key={rv.id} x={rv.km} stroke={C.green} strokeWidth={1.5}
                      label={({ viewBox }) => {
                        const { x, y } = viewBox;
                        const words = rv.name.split(" ");
                        const lines = [];
                        let line = "";
                        words.forEach(w => {
                          if ((line + w).length > 12) { lines.push(line.trim()); line = w + " "; }
                          else line += w + " ";
                        });
                        if (line.trim()) lines.push(line.trim());
                        return (
                          <g>
                            {lines.map((l, i) => (
                              <text key={i} x={x + 4} y={y + 14 + i * 13}
                                fontSize={10} fill={C.green} fontWeight={600}
                                style={{ pointerEvents: "none" }}>{l}</text>
                            ))}
                          </g>
                        );
                      }}
                    />
                  ))}
                  {/* Surbrillance segment — remplissage dégradé plein, sans pointillés */}
                  <Area type="monotone" dataKey="ele" stroke={C.primary}
                    strokeWidth={hoveredSeg ? 1.5 : 2.5} strokeOpacity={hoveredSeg ? 0.3 : 1}
                    fill="url(#eleGrad)" dot={false} name="Altitude" />
                  <Area type="monotone" dataKey="eleHL"
                    stroke={C.yellow} strokeWidth={2.5} fill="url(#eleHover)"
                    dot={false} connectNulls={false} name="Segment" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Résumé de course — bloc orangé si segments, bandeau discret sinon */}
          {segments.filter(s => s.type !== "ravito" && s.type !== "repos").length > 0 ? (
            <div style={{
              background: "#A04010", borderRadius: 14, padding: "18px 24px",
              marginBottom: 20, display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#F5C080", marginBottom: 4 }}>
                  Résumé de course
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#FDF5EE", marginBottom: 2 }}>
                  {settings.raceName || race.name || "Course"}
                </div>
                <div style={{ fontSize: 11, color: "#D08860" }}>
                  Départ {settings.startTime || "07:00"} · {settings.tempC}°C
                  {settings.rain ? " · Pluie" : ""}{settings.snow ? " · Neige" : ""}{settings.wind ? " · Vent" : ""}
                  
                </div>
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {[
                  { label: "Temps total", val: fmtTime(totalTime + totalRavitoSec + totalReposSec) },
                  { label: "Segments", val: segments.filter(s => s.type !== "ravito" && s.type !== "repos").length },
                  { label: "Ravitos", val: race.ravitos?.length || 0 },
                  { label: "Calories", val: `${nutriTotals.kcal}`, accent: "#F5C080" },
                  { label: "Eau", val: `${(nutriTotals.eau/1000).toFixed(1)} L`, accent: "#90C4E8" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: s.accent || "#FDF5EE" }}>{s.val}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "#D08860", marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
              padding: "9px 16px", marginBottom: 20,
              background: "var(--surface-2)", borderRadius: 10,
              border: "1px solid var(--border-c)", fontSize: 13, color: "var(--muted-c)",
            }}>
              <span style={{ fontWeight: 600, color: "var(--text-c)" }}>Course</span>
              <span>Départ {settings.startTime || "07:00"}</span>
              <span>{settings.tempC}°C</span>
              {settings.rain && <span>Pluie</span>}
              {settings.snow && <span>Neige</span>}
              {settings.wind && <span>Vent</span>}
              <span style={{ marginLeft: "auto", fontSize: 12, color: C.primary }}>Modifier dans Stratégie →</span>
            </div>
          )}

          {/* ── BLOCS CONFIGURATION COURSE ── */}
          {(() => {
            const updS = (k, v) => setSettings(s => ({ ...s, [k]: v }));

            const fetchMeteo = async () => {
              const pt = race.gpxPoints?.[0];
              if (!pt) { alert("Charge d'abord un fichier GPX pour obtenir la météo automatique."); return; }
              if (settings.raceDate) {
                const daysAway = Math.round((new Date(settings.raceDate) - new Date()) / 86400000);
                if (daysAway > 14) {
                  alert(`Ta course est dans ${daysAway} jours.\n\nLes prévisions météo ne sont pas disponibles au-delà de 14 jours. Reviens à J-14 pour une météo indicative, ou J-7 pour une météo fiable.`);
                  return;
                }
              }
              updS("meteoLoading", true);
              try {
                const dateStr = settings.raceDate || new Date().toISOString().slice(0, 10);
                const [hh, mm] = (settings.startTime || "07:00").split(":").map(Number);
                const startDate = new Date(`${dateStr}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`);
                const totalSecsEst = segments.filter(s => s.type !== "ravito" && s.type !== "repos")
                  .reduce((acc, seg) => acc + (seg.endKm - seg.startKm) / seg.speedKmh * 3600, 0);
                const durationH = Math.max(2, Math.ceil(totalSecsEst / 3600) + 1);
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${pt.lat.toFixed(4)}&longitude=${pt.lon.toFixed(4)}&hourly=temperature_2m,precipitation,windspeed_10m,snowfall&timezone=auto&forecast_days=7`;
                const res = await fetch(url);
                if (!res.ok) throw new Error("API indisponible");
                const data = await res.json();
                const times = data.hourly.time;
                const startIso = startDate.toISOString().slice(0, 13);
                let startIdx = times.findIndex(t => t.startsWith(startIso));
                if (startIdx === -1) startIdx = 0;
                const endIdx = Math.min(startIdx + durationH, times.length);
                const slice = (arr) => arr.slice(startIdx, endIdx);
                const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
                const avgTemp = Math.round(avg(slice(data.hourly.temperature_2m)));
                const totalPrecip = slice(data.hourly.precipitation).reduce((a, b) => a + b, 0);
                const totalSnow = slice(data.hourly.snowfall).reduce((a, b) => a + b, 0);
                const maxWind = Math.max(...slice(data.hourly.windspeed_10m));
                updS("tempC", avgTemp);
                updS("rain", totalPrecip > 1 && totalSnow <= 0.5);
                updS("snow", totalSnow > 0.5);
                updS("wind", maxWind > 30);
                updS("meteoLoading", false);
                updS("meteoFetched", true);
                updS("meteoInfo", `${dateStr} · ${avgTemp}°C moy · précip ${totalPrecip.toFixed(1)}mm · vent max ${Math.round(maxWind)} km/h`);
              } catch (e) {
                updS("meteoLoading", false);
                alert("Impossible de récupérer la météo. Vérifie ta connexion et réessaie.");
              }
            };

            const handleGarmin = e => {
              const file = e.target.files[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => {
                const result = parseGarminCSV(ev.target.result);
                if (result) { updS("garminCoeff", result.coeff); updS("garminStats", result); if (result.kcalPerKmFlat) updS("kcalSource", "garmin"); }
                else alert("Fichier CSV Garmin non reconnu. Vérifie le format Activities.csv.");
              };
              reader.readAsText(file);
            };

            const EFFORT_OPTIONS_P = [
              { key: "comfort", label: "Finisher",    desc: "Terminer sans se cramer — vitesses −12%", color: C.green },
              { key: "normal",  label: "Chrono",      desc: "Objectif temps réaliste — vitesses normales", color: C.primary },
              { key: "perf",    label: "Performance", desc: "Repousser les limites — vitesses +8%", color: C.red },
            ];
            const PACE_LABELS_P = ["Très positif", "Positif", "Régulier", "Négatif", "Très négatif"];
            const paceIdx_P = (settings.paceStrategy || 0) + 2;
            const daysAway = settings.raceDate ? Math.round((new Date(settings.raceDate) - new Date()) / 86400000) : null;
            const meteoAutoDisabled = daysAway !== null && daysAway > 14;

            const SLabel = ({ children }) => (
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-c)", marginBottom: 12 }}>{children}</div>
            );

            return (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>

                {/* ── BLOC 1 : COURSE ── */}
                <Card>
                  <SLabel>Course</SLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Field label="Nom de la course">
                      <input value={settings.raceName || race.name || ""} onChange={e => updS("raceName", e.target.value)} placeholder="Ex : UTMB, TDS, Var Verdon Trail..." />
                    </Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <Field label="Date">
                        <input type="date" value={settings.raceDate || ""} onChange={e => { updS("raceDate", e.target.value); updS("meteoFetched", false); updS("meteoInfo", ""); }} />
                      </Field>
                      <Field label="Heure de départ">
                        <input type="time" value={settings.startTime || "07:00"} onChange={e => updS("startTime", e.target.value)} />
                      </Field>
                    </div>
                    {profilDetail && <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-c)" }}>Météo</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {daysAway !== null && (
                            <span style={{ fontSize: 11, color: "var(--muted-c)" }}>
                              {daysAway > 0 ? `J−${daysAway}` : daysAway === 0 ? "Aujourd'hui" : `J+${Math.abs(daysAway)}`}
                            </span>
                          )}
                          <button onClick={fetchMeteo} disabled={settings.meteoLoading || meteoAutoDisabled} style={{
                            background: meteoAutoDisabled ? "var(--surface-2)" : C.primaryPale,
                            border: `1px solid ${meteoAutoDisabled ? "var(--border-c)" : C.primary + "50"}`,
                            color: meteoAutoDisabled ? "var(--muted-c)" : C.primaryDeep,
                            borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                            cursor: meteoAutoDisabled ? "not-allowed" : "pointer",
                            fontFamily: "'DM Sans', sans-serif", opacity: settings.meteoLoading ? 0.7 : 1,
                          }} title={meteoAutoDisabled ? `Disponible à J−14 (dans ${daysAway - 14} jours)` : "Récupérer la météo automatiquement"}>
                            {settings.meteoLoading ? "⏳" : "⛅"} Météo auto
                          </button>
                        </div>
                      </div>
                      {settings.meteoFetched && settings.meteoInfo && (
                        <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 6, padding: "4px 8px", background: "var(--surface-2)", borderRadius: 6 }}>
                          {settings.meteoInfo}
                          {daysAway !== null && daysAway > 7 && <span style={{ color: C.yellow, marginLeft: 6 }}>⚠️ Indicatif</span>}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <input type="number" min={-30} max={45} value={settings.tempC ?? 15} onChange={e => updS("tempC", Number(e.target.value))} style={{ width: 54, fontSize: 13 }} />
                          <span style={{ fontSize: 12, color: "var(--muted-c)" }}>°C</span>
                        </div>
                        {[
                          { key: "rain", label: "🌧️ Pluie" },
                          { key: "snow", label: "❄️ Neige" },
                          { key: "wind", label: "💨 Vent" },
                        ].map(({ key, label }) => (
                          <label key={key} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12, padding: "3px 8px", borderRadius: 6, background: settings[key] ? C.primaryPale : "var(--surface-2)", border: `1px solid ${settings[key] ? C.primary + "40" : "var(--border-c)"}`, transition: "all 0.15s", userSelect: "none" }}>
                            <input type="checkbox" checked={!!settings[key]} onChange={e => updS(key, e.target.checked)} style={{ width: 13, height: 13 }} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>}
                  </div>
                </Card>

                {/* ── BLOC 2 : PARCOURS & RAVITAILLEMENTS ── */}
                <Card>
                  <SLabel>Parcours & ravitaillements</SLabel>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0, paddingTop: 2 }}>
                        <span style={{ fontSize: 14 }}>🏁</span>
                        <div style={{ width: 1, flex: 1, background: "var(--border-c)", marginTop: 4, minHeight: 12 }} />
                      </div>
                      <div style={{ flex: 1, paddingBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Départ</div>
                        <input value={race.startAddress || ""} onChange={e => setRace(r => ({ ...r, startAddress: e.target.value }))} placeholder="Adresse ou lieu de départ" style={{ fontSize: 12, width: "100%" }} />
                      </div>
                    </div>
                    {[...(race.ravitos||[])].sort((a,b) => a.km - b.km).map(rv => (
                      <div key={rv.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 4 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0, paddingTop: 2 }}>
                          <span style={{ fontSize: 13 }}>🥤</span>
                          <div style={{ width: 1, flex: 1, background: "var(--border-c)", marginTop: 4, minHeight: 12 }} />
                        </div>
                        <div style={{ flex: 1, paddingBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{rv.name}</span>
                              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600,
                                background: rv.assistancePresente !== false ? C.greenPale : "var(--surface-2)",
                                color: rv.assistancePresente !== false ? C.green : "var(--muted-c)",
                              }}>{rv.assistancePresente !== false ? "assistance" : "autonome"}</span>
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <Btn size="sm" variant="ghost" onClick={() => openEditRavito(rv)}>✏️</Btn>
                              <Btn size="sm" variant="danger" onClick={() => setConfirmId("rv-" + rv.id)}>✕</Btn>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted-c)" }}>km {rv.km} · {rv.dureeMin || settings.ravitoTimeMin || 3} min</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 20, flexShrink: 0, paddingTop: 2, textAlign: "center" }}>
                        <span style={{ fontSize: 14 }}>🏆</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Arrivée</div>
                        <input value={race.endAddress || ""} onChange={e => setRace(r => ({ ...r, endAddress: e.target.value }))} placeholder="Adresse ou lieu d'arrivée" style={{ fontSize: 12, width: "100%" }} disabled={race.sameAddress} />
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: "var(--muted-c)", marginTop: 5 }}>
                          <input type="checkbox" checked={!!race.sameAddress} onChange={e => setRace(r => ({ ...r, sameAddress: e.target.checked, endAddress: e.target.checked ? r.startAddress : r.endAddress }))} />
                          Même adresse que le départ (boucle)
                        </label>
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--border-c)", marginTop: 12, paddingTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                    <Btn size="sm" onClick={() => { setEditRavitoId(null); setRavitoForm({ km: "", name: "", address: "", notes: "", dureeMin: "", assistancePresente: true }); setRavitoModal(true); }}>+ Ravito</Btn>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--muted-c)" }}>Durée par défaut aux ravitos</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.primary }}>{settings.ravitoTimeMin || 3} min</span>
                      </div>
                      <input type="range" min={1} max={20} step={1} value={settings.ravitoTimeMin || 3} onChange={e => {
                        const val = Number(e.target.value);
                        updS("ravitoTimeMin", val);
                        setSegments(s => s.map(seg =>
                          seg.type === "ravito" && !(race.ravitos||[]).find(rv => rv.id === seg.ravitoId && rv.dureeMin)
                            ? { ...seg, dureeMin: val } : seg
                        ));
                      }} style={{ width: "100%" }} />
                    </div>
                  </div>
                </Card>

                {/* ── BLOC 3 : PERFORMANCE & OBJECTIF ── */}
                <Card style={!profilDetail ? { gridColumn: "1 / -1" } : {}}>
                  <SLabel>Performance & objectif</SLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 6 }}>Niveau coureur</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                        {RUNNER_LEVELS.map(lvl => {
                          const isActive = (settings.runnerLevel || "intermediaire") === lvl.key;
                          return (
                            <div key={lvl.key} onClick={() => updS("runnerLevel", lvl.key)} style={{
                              padding: "8px 6px", borderRadius: 9, cursor: "pointer", textAlign: "center",
                              border: `2px solid ${isActive ? C.primary : "var(--border-c)"}`,
                              background: isActive ? C.primaryPale : "var(--surface-2)", transition: "all 0.15s",
                            }}>
                              <div style={{ fontWeight: 600, fontSize: 12, color: isActive ? C.primaryDeep : "var(--text-c)" }}>{lvl.label}</div>
                            </div>
                          );
                        })}
                      </div>
                      {(() => { const lvl = RUNNER_LEVELS.find(l => l.key === (settings.runnerLevel || "intermediaire")); return <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 4 }}>{lvl?.desc} — coeff ×{lvl?.coeff}</div>; })()}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 6 }}>Objectif</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {EFFORT_OPTIONS_P.map(opt => (
                          <div key={opt.key} onClick={() => updS("effortTarget", opt.key)} style={{
                            padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                            border: `2px solid ${settings.effortTarget === opt.key ? opt.color : "var(--border-c)"}`,
                            background: settings.effortTarget === opt.key ? opt.color + "18" : "var(--surface-2)", transition: "all 0.15s",
                          }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: settings.effortTarget === opt.key ? opt.color : "var(--text-c)" }}>{opt.label}</div>
                            <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 2 }}>{opt.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {profilDetail && <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--muted-c)" }}>Répartition du rythme</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.primary }}>{PACE_LABELS_P[paceIdx_P]}</span>
                      </div>
                      <input type="range" min={-2} max={2} step={1} value={settings.paceStrategy || 0} onChange={e => updS("paceStrategy", Number(e.target.value))} style={{ width: "100%" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted-c)", marginTop: 2 }}>
                        <span>Partir vite</span><span>Partir lentement</span>
                      </div>
                    </div>}
                    {profilDetail && <div style={{ borderTop: "1px solid var(--border-c)", paddingTop: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

                        {/* Colonne gauche : Poids + FC */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <Field label="Poids (kg)">
                            <input type="number" min={40} max={150} value={settings.weight || 70}
                              onChange={e => updS("weight", e.target.value === "" ? "" : +e.target.value)}
                              onBlur={e => updS("weight", Math.max(40, Math.min(150, +e.target.value || 70)))} />
                          </Field>
                          <Field label="FC max (bpm)">
                            <input type="number" min={140} max={220} placeholder="Auto"
                              value={settings.fcMax || ""}
                              onChange={e => updS("fcMax", e.target.value === "" ? null : +e.target.value)}
                              onBlur={e => { if (e.target.value) updS("fcMax", Math.max(140, Math.min(220, +e.target.value))); }} />
                          </Field>
                          <Field label="FC Zone 2 max (bpm)">
                            <input type="number" min={100} max={200} placeholder="Auto"
                              value={settings.fcZone2Max || ""}
                              onChange={e => updS("fcZone2Max", e.target.value === "" ? null : +e.target.value)}
                              onBlur={e => { if (e.target.value) updS("fcZone2Max", Math.max(100, Math.min(200, +e.target.value))); }} />
                          </Field>
                          {/* Zones calculées */}
                          {(() => {
                            const fcMax = settings.fcMax || settings.garminStats?.fcMaxObs;
                            const z2max = settings.fcZone2Max;
                            if (!fcMax) return null;
                            const z1max = z2max ? Math.round(z2max * 0.86) : Math.round(fcMax * 0.60);
                            const z2lo  = z1max + 1;
                            const z2hi  = z2max || Math.round(fcMax * 0.70);
                            const z3hi  = Math.round(fcMax * 0.82);
                            const z4hi  = Math.round(fcMax * 0.92);
                            const gs = settings.garminStats;
                            return (
                              <div style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8, fontSize: 11 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: gs?.gapZone2Kmh ? 6 : 0 }}>
                                  {[
                                    { label: "Z1", range: `< ${z2lo}`, color: C.green },
                                    { label: "Z2", range: `${z2lo}–${z2hi}`, color: C.secondary },
                                    { label: "Z3", range: `${z2hi+1}–${z3hi}`, color: C.yellow },
                                    { label: "Z4", range: `${z3hi+1}–${z4hi}`, color: C.red },
                                    { label: "Z5", range: `> ${z4hi}`, color: "#9B4EA8" },
                                  ].map(z => (
                                    <div key={z.label} style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ fontWeight: 600, color: z.color }}>{z.label}</span>
                                      <span style={{ color: "var(--muted-c)" }}>{z.range} bpm</span>
                                    </div>
                                  ))}
                                </div>
                                {gs?.gapZone2Kmh && (
                                  <div style={{ borderTop: "1px solid var(--border-c)", paddingTop: 5, color: C.secondary, fontWeight: 600 }}>
                                    Z2 : {fmtPace(gs.gapZone2Kmh)}/km
                                    <span style={{ fontWeight: 400, color: "var(--muted-c)", marginLeft: 4 }}>({gs.z2Count} sorties)</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Colonne droite : Calibration Garmin */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 2 }}>
                            Calibration Garmin <span style={{ fontSize: 10 }}>(vitesses auto)</span>
                          </div>
                          <Btn variant="soft" size="sm" onClick={() => document.getElementById("garmin-input-profil").click()}>
                            Charger Activities.csv
                          </Btn>
                          <input id="garmin-input-profil" type="file" accept=".csv" style={{ display: "none" }} onChange={handleGarmin} />
                          <span style={{ color: "var(--muted-c)", fontSize: 11 }}>
                            Coeff. <strong>{settings.garminCoeff}</strong>
                            {settings.garminStats && ` · ${settings.garminStats.count} sorties`}
                          </span>
                          {settings.garminStats && (
                            <div style={{ padding: "6px 10px", background: "var(--surface-2)", borderRadius: 8, fontSize: 11, display: "flex", flexDirection: "column", gap: 3, color: "var(--muted-c)" }}>
                              <span>GAP moy. <strong style={{ color: "var(--text-c)" }}>{settings.garminStats.avgGapKmh} km/h</strong></span>
                              <span>Coeff. <strong style={{ color: C.primary }}>×{settings.garminStats.coeff}</strong></span>
                              {settings.garminStats.fcMaxObs && (
                                <span>FC max obs. <strong style={{ color: C.red }}>{settings.garminStats.fcMaxObs} bpm</strong></span>
                              )}
                              {settings.garminStats.gapZone2Kmh && (
                                <span>Allure Z2 <strong style={{ color: C.secondary }}>{fmtPace(settings.garminStats.gapZone2Kmh)}/km</strong></span>
                              )}
                            </div>
                          )}
                          {settings.garminCoeff !== 1 && (
                            <Btn variant="ghost" size="sm" onClick={() => { updS("garminCoeff", 1); updS("garminStats", null); updS("kcalSource", "minetti"); }}>
                              Réinitialiser (coeff = 1)
                            </Btn>
                          )}
                        </div>

                      </div>
                    </div>}
                  </div>
                </Card>

                {/* ── BLOC 4 : CALIBRATION ÉNERGÉTIQUE ── */}
                {profilDetail && <Card>
                  <SLabel>Calibration énergétique</SLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {(() => {
                      const w = settings.weight || 70;
                      const minettiFlatKcal = Math.round(3.6 * w * 1000 / 4184);
                      const i10 = 0.10;
                      const cr10 = 155.4*i10**5 - 30.4*i10**4 - 43.3*i10**3 + 46.3*i10**2 + 19.5*i10 + 3.6;
                      const minettiUpKcal = Math.round(cr10 * w * 1000 / 4184);
                      const gs = settings.garminStats;
                      const src = settings.kcalSource || "minetti";
                      const SourceCard = ({ id, label, sub, flatVal, upVal, unavailable }) => {
                        const active = src === id;
                        return (
                          <div onClick={() => !unavailable && updS("kcalSource", id)} style={{
                            flex: 1, minWidth: 0, borderRadius: 9, padding: "9px 10px", cursor: unavailable ? "default" : "pointer",
                            border: `2px solid ${active ? C.primary : "var(--border-c)"}`,
                            background: active ? C.primaryPale : "var(--surface-2)",
                            opacity: unavailable ? 0.45 : 1, transition: "all 0.15s",
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: active ? C.primaryDeep : "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 10, color: "var(--muted-c)", marginBottom: 4 }}>{sub}</div>
                            {!unavailable ? (
                              <div style={{ fontSize: 12, fontWeight: 700, color: active ? C.primaryDeep : "var(--text-c)", fontFamily: "'Playfair Display', serif" }}>
                                {flatVal} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--muted-c)" }}>kcal/km</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 10, color: "var(--muted-c)", fontStyle: "italic" }}>Import requis</div>
                            )}
                            {active && !unavailable && <div style={{ fontSize: 10, color: C.primary, fontWeight: 600, marginTop: 2 }}>✓ Actif</div>}
                          </div>
                        );
                      };
                      return (
                        <div>
                          <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 6 }}>Source dépense kcal</div>
                          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                            <SourceCard id="minetti" label="Minetti" sub="Formule scientifique" flatVal={minettiFlatKcal} upVal={minettiUpKcal} />
                            <SourceCard id="garmin" label="Garmin perso" sub={gs?.kcalActivityCount ? `${gs.kcalActivityCount} sorties` : "Import requis"} flatVal={gs?.kcalPerKmFlat} upVal={gs?.kcalPerKmUphill} unavailable={!gs?.kcalPerKmFlat} />
                            <SourceCard id="manual" label="Manuel" sub="Personnalisé" flatVal={settings.kcalPerKm} upVal={settings.kcalPerKmUphill} />
                          </div>
                          {src === "manual" && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "9px 10px", background: "var(--surface-2)", borderRadius: 8, border: `1px solid var(--border-c)`, marginBottom: 8 }}>
                              <div>
                                <div style={{ fontSize: 10, color: "var(--muted-c)", marginBottom: 3 }}>Plat (kcal/km)</div>
                                <input type="number" min={40} max={150} value={settings.kcalPerKm}
                                  onChange={e => updS("kcalPerKm", e.target.value === "" ? "" : +e.target.value)}
                                  onBlur={e => updS("kcalPerKm", Math.max(40, Math.min(150, +e.target.value || 65)))} style={{ width: "100%" }} />
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: "var(--muted-c)", marginBottom: 3 }}>Montée ≥5% (kcal/km)</div>
                                <input type="number" min={40} max={200} value={settings.kcalPerKmUphill}
                                  onChange={e => updS("kcalPerKmUphill", e.target.value === "" ? "" : +e.target.value)}
                                  onBlur={e => updS("kcalPerKmUphill", Math.max(40, Math.min(200, +e.target.value || 90)))} style={{ width: "100%" }} />
                              </div>
                            </div>
                          )}
                          {gs?.kcalPerKmFlat && (
                            <div style={{ padding: "7px 10px", background: C.secondaryPale, borderRadius: 8, fontSize: 11, color: "var(--text-c)" }}>
                              Historique : <strong>{gs.kcalPerKmFlat} kcal/km</strong> plat{gs.kcalPerKmUphill ? <> · <strong>{gs.kcalPerKmUphill}</strong> montée</> : null}
                              <span style={{ color: "var(--muted-c)", marginLeft: 6 }}>({gs.kcalActivityCount} sorties FC)</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {(() => {
                      const target = settings.glucidesTargetGh;
                      const kcalH = 400;
                      const glucidesH = target != null ? target : Math.round(kcalH * 0.55 / 4);
                      const proteinesH = Math.round(kcalH * 0.10 / 4);
                      const lipidesH = Math.max(0, Math.round((kcalH - glucidesH * 4 - proteinesH * 4) / 9));
                      const totalCalc = glucidesH * 4 + lipidesH * 9 + proteinesH * 4;
                      const pctGlu = totalCalc > 0 ? Math.round(glucidesH * 4 / totalCalc * 100) : 55;
                      const pctLip = totalCalc > 0 ? Math.round(lipidesH * 9 / totalCalc * 100) : 35;
                      const pctPro = 100 - pctGlu - pctLip;
                      return (
                        <div style={{ borderTop: "1px solid var(--border-c)", paddingTop: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <span style={{ fontSize: 11, color: "var(--muted-c)" }}>Glucides & substrats</span>
                            <span onClick={() => setTooltipGlu(t => !t)} style={{ cursor: "pointer", fontSize: 13, color: C.primary, lineHeight: 1, userSelect: "none" }}>ⓘ</span>
                          </div>
                          {tooltipGlu && (
                            <div style={{ background: "var(--surface-2)", border: `1px solid var(--border-c)`, borderRadius: 9, padding: "9px 12px", fontSize: 11, color: "var(--text-c)", marginBottom: 8, lineHeight: 1.7 }}>
                              <strong>Jeukendrup (2004, 2011)</strong> — absorption plafonnée à 60–90 g/h selon entraînement intestinal.<br/>
                              <strong>Brooks & Mercier (1994)</strong> — crossover : en dessous de ~65% VO₂max, les lipides dominent.
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 10, color: "var(--muted-c)", marginBottom: 3 }}>Glucides visés (g/h)</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input type="number" min={20} max={150} placeholder="Auto"
                                  value={target ?? ""}
                                  onChange={e => updS("glucidesTargetGh", e.target.value === "" ? null : +e.target.value)}
                                  onBlur={e => { if (e.target.value !== "") updS("glucidesTargetGh", Math.max(20, Math.min(150, +e.target.value))); }}
                                  style={{ width: 70 }} />
                                {target != null && (
                                  <button onClick={() => updS("glucidesTargetGh", null)} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: `1px solid var(--border-c)`, background: "var(--surface-2)", color: "var(--muted-c)", cursor: "pointer" }}>Auto</button>
                                )}
                                <span style={{ fontSize: 11, color: "var(--muted-c)" }}>{target == null ? "55% des kcal" : target <= 60 ? "Débutant" : target <= 90 ? "Entraîné" : "Gut training"}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8, fontSize: 11 }}>
                            <div style={{ display: "flex", gap: 0, height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                              <div style={{ width: `${pctGlu}%`, background: C.yellow, transition: "width 0.3s" }} />
                              <div style={{ width: `${pctLip}%`, background: C.primary, transition: "width 0.3s" }} />
                              <div style={{ width: `${pctPro}%`, background: C.secondary, transition: "width 0.3s" }} />
                            </div>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                              <span style={{ color: C.yellow, fontWeight: 600 }}>G {pctGlu}% <span style={{ fontWeight: 400, color: "var(--muted-c)" }}>({glucidesH} g/h)</span></span>
                              <span style={{ color: C.primary, fontWeight: 600 }}>L {pctLip}% <span style={{ fontWeight: 400, color: "var(--muted-c)" }}>({lipidesH} g/h)</span></span>
                              <span style={{ color: C.secondary, fontWeight: 600 }}>P {pctPro}% <span style={{ fontWeight: 400, color: "var(--muted-c)" }}>({proteinesH} g/h)</span></span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </Card>}

              </div>
            );
          })()}

          {/* Segments */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 24, alignItems: "start" }}>


            {/* Segments */}
            <Card noPad>
              <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>Segments</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {race.gpxPoints?.length > 0 && (
                    <>
                      <div style={{ display: "flex", border: `1px solid var(--border-c)`, borderRadius: 8, overflow: "hidden", fontSize: 12 }}>
                        {[
                          { key: "synthétique", label: "Synthétique" },
                          { key: "equilibre",   label: "Équilibré" },
                          { key: "detaille",    label: "Détaillé" },
                        ].map(opt => (
                          <div key={opt.key} onClick={() => updS("segmentDetail", opt.key)} style={{
                            padding: "4px 10px", cursor: "pointer", transition: "all 0.15s",
                            background: (settings.segmentDetail || "equilibre") === opt.key ? C.primary : "var(--surface-2)",
                            color: (settings.segmentDetail || "equilibre") === opt.key ? C.white : "var(--muted-c)",
                            fontWeight: (settings.segmentDetail || "equilibre") === opt.key ? 600 : 400,
                          }}>{opt.label}</div>
                        ))}
                      </div>
                      <Btn size="sm" variant="sage" onClick={autoSegment} disabled={computing}>
                        {computing ? "Calcul…" : "Découpage auto"}
                      </Btn>
                    </>
                  )}
                  <Btn size="sm" variant="ghost" onClick={onOpenRepos}>💤 Repos</Btn>
                  <Btn size="sm" onClick={openNewSeg}>+ Segment</Btn>
                </div>
              </div>
              {!segments.length ? (
                <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted-c)", fontSize: 13 }}>
                  Aucun segment — utilise le découpage auto ou ajoute-en un manuellement.
                </div>
              ) : (
                <div className="tbl-wrap" style={{ maxHeight: 520, overflowY: "auto" }}>
                  {(() => {
                    const { times: passingTimes, startSec } = calcPassingTimes(segments, settings.startTime);
                    return (
                  <table>
                    <thead><tr>
                      <th>#</th><th>Début</th><th>Fin</th><th>Pente moy.</th><th>Vitesse</th><th>Allure</th><th>Durée</th><th>Cum.</th><th></th>
                    </tr></thead>
                    <tbody>{(() => {
                      let segNum = 0;
                      return segments.map((seg, i) => {
                        const t = passingTimes[i];
                        // ── Ravito ──
                        if (seg.type === "ravito") {
                          return (
                            <tr key={seg.id} style={{ background: C.green + "10", cursor: "default" }}
                              onMouseEnter={() => setHoveredSeg(seg)} onMouseLeave={() => setHoveredSeg(null)}>
                              <td style={{ fontSize: 16 }}>🥤</td>
                              <td style={{ fontWeight: 600, color: C.green }} colSpan={3}>{seg.label} — km {seg.startKm}</td>
                              <td colSpan={2} style={{ color: "var(--muted-c)", fontSize: 12 }}>{seg.dureeMin} min</td>
                              <td></td>
                              <td style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: "var(--muted-c)" }}>{t ? fmtTime(t - startSec) : "—"}</td>
                              <td onClick={e => e.stopPropagation()}>
                                <Btn size="sm" variant="danger" onClick={() => setConfirmId("seg-" + seg.id)}>✕</Btn>
                              </td>
                            </tr>
                          );
                        }
                        // ── Repos ──
                        if (seg.type === "repos") {
                          return (
                            <tr key={seg.id} style={{ background: "var(--surface-2)", cursor: "default" }}
                              onMouseEnter={() => setHoveredSeg(seg)} onMouseLeave={() => setHoveredSeg(null)}>
                              <td style={{ fontSize: 16 }}>💤</td>
                              <td style={{ fontWeight: 600, color: C.blue }} colSpan={3}>{seg.label} — km {seg.startKm}</td>
                              <td colSpan={2} style={{ color: "var(--muted-c)", fontSize: 12 }}>{seg.dureeMin} min</td>
                              <td></td>
                              <td style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: "var(--muted-c)" }}>{t ? fmtTime(t - startSec) : "—"}</td>
                              <td onClick={e => e.stopPropagation()}>
                                <Btn size="sm" variant="danger" onClick={() => setConfirmId("seg-" + seg.id)}>✕</Btn>
                              </td>
                            </tr>
                          );
                        }
                        // ── Segment normal ──
                        segNum++;
                        const dur = fmtTime(((seg.endKm - seg.startKm) / seg.speedKmh) * 3600);
                        const isH = hoveredSeg?.id === seg.id;
                        const dist = seg.endKm - seg.startKm;
                        const prevSeg = segments.slice(0, i).reverse().find(s => s.type !== "ravito" && s.type !== "repos");
                        const nextSeg = segments.slice(i + 1).find(s => s.type !== "ravito" && s.type !== "repos");
                        const isSteep = seg.slopePct > 15;
                        const showBatons = isSteep && (
                          dist >= 1 ||
                          (prevSeg && prevSeg.slopePct > 15) ||
                          (nextSeg && nextSeg.slopePct > 15)
                        );
                        return (
                          <tr key={seg.id}
                            onMouseEnter={() => setHoveredSeg(seg)}
                            onMouseLeave={() => setHoveredSeg(null)}
                            onClick={() => openEditSeg(seg)}
                            style={{ background: isH ? C.yellowPale : undefined, cursor: "pointer" }}>
                            <td style={{ color: isH ? C.yellow : "var(--muted-c)", fontWeight: isH ? 700 : 400 }}>{segNum}</td>
                            <td style={{ fontWeight: isH ? 700 : 400 }}>{seg.startKm} km</td>
                            <td style={{ fontWeight: isH ? 700 : 400 }}>{seg.endKm} km</td>
                            <td>
                              <span className={`badge ${seg.slopePct > 9 ? "badge-red" : seg.slopePct < 0 ? "badge-blue" : "badge-sage"}`}>
                                {seg.slopePct > 0 ? "+" : ""}{seg.slopePct}%
                              </span>
                              {showBatons && <span style={{ marginLeft: 5, fontSize: 10, color: C.red }}>bâtons</span>}
                              {seg.slopePct > 8 && seg.slopePct <= 15 && <span style={{ marginLeft: 5, fontSize: 10, color: C.yellow }}>marche</span>}
                            </td>
                            <td style={{ fontWeight: isH ? 700 : 600 }}>{seg.speedKmh} km/h</td>
                            <td style={{ fontFamily: "'Playfair Display', serif", fontWeight: isH ? 700 : 400 }}>{fmtPace(seg.speedKmh)}/km</td>
                            <td style={{ fontWeight: isH ? 700 : 400 }}>{dur}</td>
                            <td style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, color: C.secondary }}>{t ? fmtTime(t - startSec) : "—"}</td>
                            <td onClick={e => e.stopPropagation()}>
                              <Btn size="sm" variant="danger" onClick={() => setConfirmId("seg-" + seg.id)}>✕</Btn>
                            </td>
                          </tr>
                        );
                      });
                    })()}</tbody>
                  </table>
                    );
                  })()}
                </div>
              )}
            </Card>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn variant="ghost" size="sm" onClick={() => { setRace(r => ({ ...r, gpxPoints: null, totalDistance: 0, totalElevPos: 0, totalElevNeg: 0 })); setSegments([]); }}>
              🔄 Recharger un autre GPX
            </Btn>
            {race.gpxPoints?.length > 0 && (
              <Btn variant="ghost" size="sm" onClick={() => {
                // Inverser = retourner l'ordre des points, puis recalculer les distances cumulées
                const orig = race.gpxPoints;
                const rev = [...orig].reverse();
                let cumDist = 0;
                const reversed = rev.map((p, i) => {
                  if (i > 0) {
                    const prev = rev[i - 1];
                    const dLat = (p.lat - prev.lat) * Math.PI / 180;
                    const dLon = (p.lon - prev.lon) * Math.PI / 180;
                    const a = Math.sin(dLat/2)**2 + Math.cos(prev.lat*Math.PI/180)*Math.cos(p.lat*Math.PI/180)*Math.sin(dLon/2)**2;
                    cumDist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  }
                  return { ...p, dist: +cumDist.toFixed(3) };
                });
                // Recalcul D+ et D-
                let elvPos = 0, elvNeg = 0;
                for (let i = 1; i < reversed.length; i++) {
                  const dE = reversed[i].ele - reversed[i-1].ele;
                  if (dE > 0) elvPos += dE; else elvNeg += Math.abs(dE);
                }
                setRace(r => ({ ...r, gpxPoints: reversed, totalElevPos: elvPos, totalElevNeg: elvNeg }));
                setSegments([]);
              }}>
                ↔️ Inverser le sens du parcours
              </Btn>
            )}
          </div>
        </>
      )}

      <Modal open={ravitoModal} onClose={() => setRavitoModal(false)} title={editRavitoId ? "Modifier ravito" : "Nouveau ravitaillement"}>
        <div className="form-grid">
          <Field label="Kilomètre"><input type="number" min={0} step={0.1} value={ravitoForm.km} onChange={e => setRavitoForm(f => ({ ...f, km: e.target.value }))} /></Field>
          <Field label="Nom du point" full><input value={ravitoForm.name} onChange={e => setRavitoForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Durée d'arrêt (min)">
            <input type="number" min={1} max={60} step={1}
              value={ravitoForm.dureeMin}
              onChange={e => setRavitoForm(f => ({ ...f, dureeMin: e.target.value }))}
              placeholder={`Défaut : ${settings.ravitoTimeMin || 3} min`} />
          </Field>
          <Field label="Adresse (pour l'assistance)" full>
            <input value={ravitoForm.address || ""} onChange={e => setRavitoForm(f => ({ ...f, address: e.target.value }))} placeholder="Ex : Col du Lautaret, D1091, 05480 Villar-d'Arêne" />
          </Field>
          <Field label="Notes pour l'assistance" full>
            <textarea value={ravitoForm.notes || ""} onChange={e => setRavitoForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Ex : Parking en contrebas, préparer les bâtons, changer les chaussettes" />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", borderRadius: 12,
              background: ravitoForm.assistancePresente ? C.secondaryPale : "var(--surface-2)",
              border: `1px solid ${ravitoForm.assistancePresente ? C.secondary + "50" : "var(--border-c)"}`,
              cursor: "pointer", transition: "all 0.15s",
            }} onClick={() => setRavitoForm(f => ({ ...f, assistancePresente: !f.assistancePresente }))}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: ravitoForm.assistancePresente ? C.secondaryDark : "var(--muted-c)" }}>
                  {ravitoForm.assistancePresente ? "Assistance équipe présente" : "Ravito autonome"}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>
                  {ravitoForm.assistancePresente
                    ? "Produits planifiables dans Nutrition · visible dans Team"
                    : "Tu emportes tout depuis le point précédent · invisible dans Team"}
                </div>
              </div>
              <div style={{
                width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                background: ravitoForm.assistancePresente ? C.secondary : "var(--border-c)",
                position: "relative", transition: "background 0.2s",
              }}>
                <div style={{
                  position: "absolute", top: 3,
                  left: ravitoForm.assistancePresente ? 21 : 3,
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setRavitoModal(false)}>Annuler</Btn>
          <Btn onClick={saveRavito}>Enregistrer</Btn>
        </div>
      </Modal>

      <Modal open={segModal} onClose={() => setSegModal(false)} title={editSegId ? "Modifier segment" : "Nouveau segment"}>
        <div className="form-grid">
          <Field label="Début (km)">
            <input type="number" min={0} step={0.1} value={segForm.startKm} onChange={e => updSeg("startKm", e.target.value)} />
          </Field>
          <Field label="Fin (km)">
            <input type="number" min={0} step={0.1} value={segForm.endKm} onChange={e => updSeg("endKm", e.target.value)} />
          </Field>
          <Field label="Pente (%)">
            <input type="range" min={-25} max={30} step={1} value={segForm.slopePct} onChange={e => updSeg("slopePct", Number(e.target.value))} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted-c)", marginTop: 4 }}>
              <span>-25%</span>
              <span style={{ fontWeight: 600, color: segForm.slopePct > 10 ? C.red : "var(--text-c)" }}>{segForm.slopePct > 0 ? "+" : ""}{segForm.slopePct}%</span>
              <span>+30%</span>
            </div>
          </Field>
          <Field label="Vitesse (km/h)">
            <input type="range" min={2} max={15} step={0.5} value={segForm.speedKmh} onChange={e => updSeg("speedKmh", Number(e.target.value))} />
            <div style={{ textAlign: "center", fontSize: 13, marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>{segForm.speedKmh} km/h</span>
              <span style={{ color: "var(--muted-c)", marginLeft: 8 }}>({fmtPace(segForm.speedKmh)}/km)</span>
            </div>
          </Field>
          <Field label="Terrain" full>
            <div style={{ display: "flex", gap: 8 }}>
              {TERRAIN_TYPES.map(t => {
                const terrainCoeff = t.coeff;
                const isActive = (segForm.terrain || "normal") === t.key;
                return (
                  <div key={t.key} onClick={() => {
                    const baseSpeed = suggestSpeed(segForm.slopePct, settings.garminCoeff, settings);
                    updSeg("terrain", t.key);
                    setSegForm(f => ({ ...f, terrain: t.key, speedKmh: Math.max(2, +(baseSpeed * terrainCoeff).toFixed(1)) }));
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
          <Field label="Notes" full><textarea value={segForm.notes} onChange={e => updSeg("notes", e.target.value)} rows={2} /></Field>
        </div>
        {segForm.slopePct > 10 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.yellowPale, borderRadius: 10, fontSize: 13, color: C.yellow }}>
            Marche conseillée — pente élevée ({segForm.slopePct}%)
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setSegModal(false)}>Annuler</Btn>
          <Btn onClick={saveSeg}>Enregistrer</Btn>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        message={confirmId?.startsWith("rv-") ? "Supprimer ce ravitaillement ?" : "Supprimer ce segment ?"}
        onConfirm={() => {
          if (confirmId?.startsWith("rv-")) deleteRavito(Number(confirmId.replace("rv-", "")));
          else deleteSeg(Number(confirmId.replace("seg-", "")));
        }}
        onCancel={() => setConfirmId(null)} />
    </div>
  );
}
