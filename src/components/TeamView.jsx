import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { C, RUNNER_LEVELS, TERRAIN_TYPES, DEFAULT_EQUIPMENT, PREP_TIMELINE, EMPTY_SETTINGS, DEFAULT_FLAT_SPEED } from '../constants.js';
import { fmtTime, fmtPace, fmtHeure, isNight, calcNutrition, calcPassingTimes, exportRecap, exportGPXMontre, suggestSpeed, autoSegmentGPX, parseGarminCSV, buildElevationProfile, calcSlopeFromGPX, parseGPX, kcalDuStock, formatQuantiteStock } from '../utils.jsx';
import { getNutritionStrategy } from '../NutritionStrategyModal.jsx';
import { Btn, Card, KPI, PageTitle, Field, Modal, ConfirmDialog, Empty, Hr, CustomTooltip } from '../atoms.jsx';

// ─── VUE TEAM ────────────────────────────────────────────────────────────────
function wazeUrl(query) {
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
}

export default function TeamView({ race, setRace, segments, setSegments, settings, setSettings, produits = [], recettes = [], sharedMode, installPrompt, onInstall, onLoadStrategy, isMobile }) {
  const [realTimes, setRealTimes] = useState({});
  const [activeRavito, setActiveRavito] = useState(null);
  const [sosActive, setSosActive] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);


  const ravitos = [...(race.ravitos || [])].sort((a, b) => a.km - b.km);
  const { times: passingTimes } = calcPassingTimes(segments, settings.startTime);
  const flasqueMl = getNutritionStrategy(race)?.hydratation?.flasqueMl || 500;

  // Map segIndex → ravito pour retrouver les heures théoriques
  const ravitoSegs = segments
    .map((seg, i) => ({ seg, i }))
    .filter(({ seg }) => seg.type === "ravito");

  const getTheoSec = ravitoId => {
    const entry = ravitoSegs.find(({ seg }) => seg.ravitoId === ravitoId);
    return entry ? passingTimes[entry.i] : null;
  };

  // ── Recalibration vitesse Option B ──────────────────────────────────────────
  // On cherche les deux derniers ravitos avec heure réelle saisie
  // pour calculer un coefficient de vitesse réelle vs théorique
  const realEntries = ravitos.filter(rv => realTimes[rv.id]);

  // Coefficient vitesse : temps réel entre 2 ravitos / temps théo entre ces 2 ravitos
  // Si on n'a qu'un seul ravito réel → fallback décalage fixe
  const speedCoeff = (() => {
    if (realEntries.length >= 2) {
      const prev = realEntries[realEntries.length - 2];
      const last = realEntries[realEntries.length - 1];
      const prevTheo = getTheoSec(prev.id);
      const lastTheo = getTheoSec(last.id);
      if (!prevTheo || !lastTheo || lastTheo === prevTheo) return null;
      const prevParts = realTimes[prev.id].split(":").map(Number);
      const lastParts = realTimes[last.id].split(":").map(Number);
      const prevReal = prevParts[0] * 3600 + prevParts[1] * 60;
      const lastReal = lastParts[0] * 3600 + lastParts[1] * 60;
      const realDuration = lastReal - prevReal;
      const theoDuration = lastTheo - prevTheo;
      if (theoDuration <= 0 || realDuration <= 0) return null;
      return realDuration / theoDuration; // >1 = plus lent, <1 = plus rapide
    }
    return null; // pas assez de données pour recalibrer
  })();

  // Heure réelle au dernier ravito renseigné (point d'ancrage)
  const anchorRavito = realEntries[realEntries.length - 1] || null;
  const anchorSec = anchorRavito ? (() => {
    const parts = realTimes[anchorRavito.id].split(":").map(Number);
    return parts[0] * 3600 + parts[1] * 60;
  })() : null;
  const anchorTheo = anchorRavito ? getTheoSec(anchorRavito.id) : null;

  const getAdjustedSec = ravitoId => {
    const theo = getTheoSec(ravitoId);
    if (!theo) return null;
    if (!anchorRavito || !anchorSec || !anchorTheo) return theo;

    // Ce ravito est-il avant ou après l'ancre ?
    const anchorIdx = ravitos.findIndex(rv => rv.id === anchorRavito.id);
    const thisIdx   = ravitos.findIndex(rv => rv.id === ravitoId);

    if (thisIdx <= anchorIdx) {
      // Déjà passé — on renvoie l'heure réelle si disponible, sinon théo + delta fixe
      if (realTimes[ravitoId]) {
        const p = realTimes[ravitoId].split(":").map(Number);
        return p[0] * 3600 + p[1] * 60;
      }
      return theo + (anchorSec - anchorTheo);
    }

    // Ravito futur — recalibrer avec coefficient vitesse si disponible
    const timeFromAnchor = theo - anchorTheo; // durée théo depuis l'ancre
    if (speedCoeff !== null) {
      return anchorSec + timeFromAnchor * speedCoeff;
    }
    // Fallback : décalage fixe
    return theo + (anchorSec - anchorTheo);
  };

  // Heure d'arrivée recalibrée (dernier temps passingTimes + correction)
  const getAdjustedArrival = () => {
    const theoArrival = passingTimes[passingTimes.length - 1];
    if (!theoArrival) return null;
    if (!anchorRavito || !anchorSec || !anchorTheo) return theoArrival;
    const timeFromAnchor = theoArrival - anchorTheo;
    if (speedCoeff !== null) return anchorSec + timeFromAnchor * speedCoeff;
    return theoArrival + (anchorSec - anchorTheo);
  };

  const adjustedArrival = getAdjustedArrival();

  const getDelta = ravitoId => {
    const theo = getTheoSec(ravitoId);
    const adj  = getAdjustedSec(ravitoId);
    if (!theo || !adj) return 0;
    return adj - theo; // positif = retard, négatif = avance
  };

  const fmtDelta = sec => {
    if (Math.abs(sec) < 60) return "Dans les temps";
    const sign = sec > 0 ? "+" : "-";
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    return `${sign}${m} min`;
  };

  const deltaColor = sec => {
    if (Math.abs(sec) < 120) return C.green;
    if (sec > 0) return C.red;
    return C.blue;
  };

  // Prochain ravito non encore passé
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60;
  const nextRavito = ravitos.find(rv => {
    const t = getAdjustedSec(rv.id) || getTheoSec(rv.id);
    return t && t > nowSec;
  });

  const nextRavitoSec = nextRavito
    ? (getAdjustedSec(nextRavito.id) || getTheoSec(nextRavito.id))
    : null;
  const minutesToNext = nextRavitoSec
    ? Math.max(0, Math.round((nextRavitoSec - nowSec) / 60))
    : null;

  // Nutrition pour un ravito (segments entre le précédent et ce ravito)
  const getNutritionForRavito = rv => {
    const rvIdx = ravitos.indexOf(rv);
    const prevKm = rvIdx === 0 ? 0 : ravitos[rvIdx - 1].km;
    const segsZone = segments.filter(s =>
      s.type !== "ravito" && s.type !== "repos" &&
      s.startKm >= prevKm && s.endKm <= rv.km
    );
    return segsZone.reduce((acc, seg) => {
      const n = calcNutrition(seg, settings);
      const dH = (seg.endKm - seg.startKm) / seg.speedKmh;
      return { eau: acc.eau + Math.round(n.eauH * dH), glucides: acc.glucides + Math.round(n.glucidesH * dH), kcal: acc.kcal + n.kcal };
    }, { eau: 0, glucides: 0, kcal: 0 });
  };

  // SOS géoloc
  const handleSOS = () => {
    setSosActive(true);
    const share = (msg) => {
      if (navigator.share) {
        navigator.share({ title: "🆘 SOS Alex", text: msg }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(msg)
          .then(() => alert("Message SOS copié — colle-le dans ton appli de messagerie."))
          .catch(() => alert(msg));
      }
      setTimeout(() => setSosActive(false), 3000);
    };

    navigator.geolocation?.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsCoords({ lat: latitude, lon: longitude, acc: Math.round(accuracy) });
        const msg = `🆘 SOS — Position via l'appli Alex.\n\nJe suis localisé à cet endroit :\nhttps://maps.google.com/?q=${latitude},${longitude}\n(±${Math.round(accuracy)}m)\n\nCourse : ${settings.raceName || race.name || "?"}`;
        share(msg);
      },
      () => {
        const msg = `🆘 SOS — Besoin d'aide.\n\nCourse : ${settings.raceName || race.name || "?"}\nPosition GPS non disponible.`;
        share(msg);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const copyAddress = addr => {
    navigator.clipboard?.writeText(addr).catch(() => {});
  };

  if (!segments.length && !ravitos.length) {
    return (
      <div className="anim">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <PageTitle sub="Vue assistance — ravitos, horaires, préparation">Team</PageTitle>
          <label style={{ display: "flex", alignItems: "center", flexShrink: 0, cursor: "pointer", marginTop: 4 }}>
            <Btn variant="soft">📋 Charger stratégie</Btn>
            <input type="file" accept=".json" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  try {
                    const d = JSON.parse(ev.target.result);
                    onLoadStrategy(d);
                  } catch { alert("Fichier JSON invalide."); }
                };
                reader.readAsText(file);
                e.target.value = "";
              }} />
          </label>
        </div>
        <Empty icon="👥" title="Aucune stratégie définie"
          sub="Charge une stratégie via le bouton ci-dessus, ou définis des segments dans l'onglet Profil de course." />
      </div>
    );
  }

  return (
    <div className="anim">

      {/* Bannière installation pour l'assistant */}
      {sharedMode && !window.matchMedia("(display-mode: standalone)").matches && (
        <div style={{
          background: `linear-gradient(135deg, ${C.primary}18, ${C.primaryPale})`,
          border: `1px solid ${C.primary}40`, borderRadius: 16,
          padding: "16px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              📲 Installe Alex sur ton téléphone
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-c)", lineHeight: 1.5 }}>
              Accède à la stratégie hors-ligne en montagne et suis le coureur en temps réel.
            </div>
          </div>
          <button onClick={onInstall} style={{
            background: C.primary, color: "#fff", border: "none",
            borderRadius: 12, padding: "10px 18px", cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            flexShrink: 0,
          }}>
            Installer gratuitement
          </button>
        </div>
      )}

      {/* Header + SOS + Partage */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-start", gap: isMobile ? 10 : 0, marginBottom: 24 }}>
        <PageTitle sub={`${ravitos.length} ravito${ravitos.length > 1 ? "s" : ""} · départ ${settings.startTime || "07:00"}`}>
          {settings.raceName || race.name || "Team"}
        </PageTitle>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8, marginTop: isMobile ? 0 : 4, flexShrink: 0 }}>

          {/* Bouton charger stratégie — file picker JSON, toujours visible */}
          <label style={{ display: "flex", alignItems: "center", flexShrink: 0, cursor: "pointer" }}>
            <Btn variant="soft" style={{ width: isMobile ? "100%" : "auto" }}>📋 Charger stratégie</Btn>
            <input type="file" accept=".json" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  try {
                    const d = JSON.parse(ev.target.result);
                    onLoadStrategy(d);
                  } catch { alert("Fichier JSON invalide."); }
                };
                reader.readAsText(file);
                e.target.value = "";
              }} />
          </label>

          {/* Bouton partager — côté coureur uniquement, génère JSON + ouvre SMS */}
          {!sharedMode && (
            <button onClick={() => {
              const nom = settings.raceName || race.name || "ma-course";
              const filename = `alex-${nom.toLowerCase().replace(/\s+/g, "-")}.json`;
              const blob = new Blob([JSON.stringify({ race, segments, settings })], { type: "application/json" });
              const file = new File([blob], filename, { type: "application/json" });
              const appUrl = window.location.origin + window.location.pathname;

              const smsMsg = `Voici ma stratégie de course pour ${settings.raceName || race.name || "ma course"} 🏔️\n\n1- Télécharge le fichier JSON que je t'envoie\n2- Va sur Alex : ${appUrl}\n3- Onglet "Team"\n4- Clique sur "Charger stratégie" et sélectionne le fichier`;

              const doShare = () => {
                // Ouvrir le share sheet avec le message texte
                if (navigator.share) {
                  navigator.share({ title: `Stratégie Alex — ${nom}`, text: smsMsg })
                    .catch(() => {
                      // Fallback SMS
                      window.location.href = `sms:?body=${encodeURIComponent(smsMsg)}`;
                    });
                } else {
                  window.location.href = `sms:?body=${encodeURIComponent(smsMsg)}`;
                }
              };

              // D'abord télécharger le JSON, puis ouvrir le share
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                // Android moderne : partage direct avec fichier joint
                navigator.share({ title: `Stratégie Alex — ${nom}`, text: smsMsg, files: [file] })
                  .catch(() => {
                    // Fallback : télécharger + message séparé
                    const u = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = u; a.download = filename; a.click();
                    URL.revokeObjectURL(u);
                    setTimeout(doShare, 800);
                  });
              } else {
                // Télécharger le JSON puis ouvrir le message
                const u = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = u; a.download = filename; a.click();
                URL.revokeObjectURL(u);
                setTimeout(doShare, 800);
              }
            }} style={{
              background: C.green + "18", border: `1px solid ${C.green}50`,
              color: C.green, borderRadius: 10, padding: "7px 14px",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              width: isMobile ? "100%" : "auto",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              📤 Partager
            </button>
          )}
          <button onClick={handleSOS} style={{
            background: sosActive ? C.red + "cc" : C.red,
            color: "#fff", border: "none", borderRadius: 10, padding: "7px 14px",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: isMobile ? "100%" : "auto",
            boxShadow: `0 4px 16px ${C.red}50`, transition: "all 0.2s",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            🆘 SOS Position
          </button>
        </div>
      </div>

      {gpsCoords && (
        <div style={{ background: C.red + "18", border: `1px solid ${C.red}40`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          Position envoyée : <strong>{gpsCoords.lat.toFixed(5)}, {gpsCoords.lon.toFixed(5)}</strong> (±{gpsCoords.acc}m)
        </div>
      )}

      {/* Adresses départ / arrivée */}
      {(race.startAddress || race.endAddress) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {race.startAddress && (
            <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 12, borderLeft: `3px solid ${C.green}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.green, marginBottom: 4 }}>Départ</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{race.startAddress}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => copyAddress(race.startAddress)} style={{ background: "none", border: `1px solid var(--border-c)`, borderRadius: 8, padding: "3px 8px", fontSize: 11, cursor: "pointer", color: "var(--text-c)" }}>📋 Copier</button>
                <a href={wazeUrl(race.startAddress)} target="_blank" rel="noreferrer" style={{ background: "#05C8F7", color: "#fff", borderRadius: 8, padding: "3px 8px", fontSize: 11, textDecoration: "none", fontWeight: 600 }}>🚗 Waze</a>
              </div>
            </div>
          )}
          {(race.endAddress || race.sameAddress) && (
            <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 12, borderLeft: `3px solid ${C.primary}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.primary, marginBottom: 4 }}>Arrivée</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{race.sameAddress ? race.startAddress : race.endAddress}</div>
              {race.sameAddress && <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 2 }}>Même lieu que le départ</div>}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => copyAddress(race.sameAddress ? race.startAddress : race.endAddress)} style={{ background: "none", border: `1px solid var(--border-c)`, borderRadius: 8, padding: "3px 8px", fontSize: 11, cursor: "pointer", color: "var(--text-c)" }}>📋 Copier</button>
                <a href={wazeUrl(race.sameAddress ? race.startAddress : race.endAddress)} target="_blank" rel="noreferrer" style={{ background: "#05C8F7", color: "#fff", borderRadius: 8, padding: "3px 8px", fontSize: 11, textDecoration: "none", fontWeight: 600 }}>🚗 Waze</a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Statut global */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: anchorRavito ? 12 : 24 }}>
        <KPI label="Départ" value={settings.startTime || "07:00"} icon="🏁" />
        <KPI
          label="Arrivée estimée"
          value={fmtHeure(adjustedArrival || passingTimes[passingTimes.length - 1] || 0)}
          icon="🏆" color={C.primary}
          sub={adjustedArrival && adjustedArrival !== passingTimes[passingTimes.length - 1]
            ? `Théo. ${fmtHeure(passingTimes[passingTimes.length - 1] || 0)}`
            : undefined}
        />
        {nextRavito && minutesToNext !== null && (
          <KPI label={`Prochain : ${nextRavito.name}`} value={`~${minutesToNext} min`}
            icon="🥤" color={minutesToNext < 20 ? C.red : C.yellow}
            sub={`Arrivée théo. ${fmtHeure(getAdjustedSec(nextRavito.id) || getTheoSec(nextRavito.id) || 0)}`} />
        )}
        {anchorRavito && (() => {
          const d = getDelta(anchorRavito.id);
          return <KPI label="Écart actuel" value={fmtDelta(d)} icon={d > 120 ? "🐢" : d < -120 ? "⚡" : "✅"} color={deltaColor(d)} sub={`depuis ${anchorRavito.name}`} />;
        })()}
      </div>

      {/* Bandeau recalibration vitesse */}
      {speedCoeff !== null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
          padding: "10px 14px", borderRadius: 12,
          background: speedCoeff > 1.05 ? C.red + "15" : speedCoeff < 0.95 ? C.blue + "15" : C.green + "15",
          border: `1px solid ${speedCoeff > 1.05 ? C.red : speedCoeff < 0.95 ? C.blue : C.green}30`,
        }}>
          <span style={{ fontSize: 18 }}>{speedCoeff > 1.05 ? "🐢" : speedCoeff < 0.95 ? "⚡" : "✅"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: speedCoeff > 1.05 ? C.red : speedCoeff < 0.95 ? C.blue : C.green }}>
              {speedCoeff > 1.05
                ? `Allure −${Math.round((speedCoeff - 1) * 100)}% — prévisions ajustées`
                : speedCoeff < 0.95
                  ? `Allure +${Math.round((1 - speedCoeff) * 100)}% — prévisions ajustées`
                  : "Allure conforme — prévisions fiables"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-c)", marginTop: 1 }}>
              Basé sur {realEntries[realEntries.length-2]?.name} → {anchorRavito.name}
            </div>
          </div>
        </div>
      )}

      {/* Préparation départ */}
      {(() => {
        const departItems = race.depart?.produits || [];
        if (!departItems.length) return null;
        const allItems = [...produits, ...recettes];
        
        const totalKcal = departItems.reduce((acc, { id, quantite }) => {
          const p = allItems.find(x => x.id === id);
          if (!p) return acc;
          return acc + kcalDuStock(p, quantite, allItems);
        }, 0);
        
        return (
          <Card style={{ borderLeft: `4px solid ${C.green}`, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18 }}>
                🏁 Préparation départ
              </span>
              <span className="badge badge-sage" style={{ fontSize: 12 }}>{totalKcal} kcal</span>
            </div>
            <div style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>À préparer dans le sac avant le départ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {departItems.map(({ id, quantite }) => {
                  const p = allItems.find(x => x.id === id);
                  if (!p) return null;
                  return (
                    <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "var(--surface)", borderRadius: 8, fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{p.nom}</span>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ color: "var(--muted-c)", fontSize: 12 }}>{formatQuantiteStock(p, quantite, flasqueMl)}</span>
                        <span style={{ color: C.red, fontWeight: 600, fontSize: 12 }}>
                          {kcalDuStock(p, quantite, allItems)} kcal
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Ravitos */}
      {ravitos.length === 0 ? (
        <div style={{ background: C.yellowPale, border: `1px solid ${C.yellow}40`, borderRadius: 12, padding: "14px 18px", fontSize: 13, color: C.yellow, marginBottom: 20 }}>
          Aucun ravitaillement défini — ajoute-en dans l'onglet Profil de course.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {ravitos.map((rv, ri) => {
            const theoSec  = getTheoSec(rv.id);
            const adjSec   = getAdjustedSec(rv.id);
            const delta    = getDelta(rv.id);
            const isOpen   = activeRavito === rv.id;
            const realVal  = realTimes[rv.id] || "";
            const night    = theoSec ? isNight(adjSec || theoSec) : false;
            const isAutonome = rv.assistancePresente === false;

            return (
              <Card key={rv.id} style={{ borderLeft: `4px solid ${isOpen ? C.primary : C.green}`, opacity: isAutonome ? 0.6 : 1 }}>
                {/* En-tête ravito */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setActiveRavito(isOpen ? null : rv.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18 }}>
                        🥤 {rv.name}
                      </span>
                      <span className="badge badge-sage" style={{ fontSize: 12 }}>km {rv.km}</span>
                      {isAutonome && <span style={{fontSize:11,padding:"2px 8px",background:C.stone,borderRadius:6,color:C.muted,fontWeight:500}}>⚠️ Autonome</span>}
                      {night && <span style={{ fontSize: 12 }}>🌙</span>}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--muted-c)", flexWrap: "wrap" }}>
                      <span>Théo. <strong style={{ color: "var(--text-c)" }}>{theoSec ? fmtHeure(theoSec) : "--:--"}</strong></span>
                      {adjSec && adjSec !== theoSec && (
                        <span>Ajusté <strong style={{ color: deltaColor(delta) }}>{fmtHeure(adjSec)}</strong></span>
                      )}
                      {Math.abs(delta) >= 60 && (
                        <span style={{ color: deltaColor(delta), fontWeight: 600 }}>{fmtDelta(delta)}</span>
                      )}
                      <span>Arrêt {settings.ravitoTimeMin || 3} min</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 18, color: "var(--muted-c)", cursor: "pointer" }} onClick={() => setActiveRavito(isOpen ? null : rv.id)}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Heure réelle de passage */}
                    <div style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>Heure réelle de passage</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <input type="time" value={realVal}
                          onChange={e => setRealTimes(t => ({ ...t, [rv.id]: e.target.value }))}
                          style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Playfair Display', serif", padding: "8px 12px", borderRadius: 10, border: `2px solid ${realVal ? C.primary : "var(--border-c)"}`, background: "var(--surface)", color: "var(--text-c)", cursor: "pointer" }} />
                        {realVal && (
                          <div style={{ fontSize: 13 }}>
                            <span style={{ color: deltaColor(delta), fontWeight: 700, fontSize: 15 }}>{fmtDelta(delta)}</span>
                            <div style={{ color: "var(--muted-c)", fontSize: 12, marginTop: 2 }}>Heures suivantes recalculées</div>
                          </div>
                        )}
                        {realVal && (
                          <button onClick={() => setRealTimes(t => { const n = { ...t }; delete n[rv.id]; return n; })}
                            style={{ background: "none", border: "none", color: "var(--muted-c)", cursor: "pointer", fontSize: 18 }}>✕</button>
                        )}
                      </div>
                    </div>

                    {/* Adresse */}
                    {rv.address ? (
                      <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>Adresse</span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => copyAddress(rv.address)} style={{ background: "none", border: `1px solid var(--border-c)`, borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--text-c)" }}>
                              📋 Copier
                            </button>
                            <a href={wazeUrl(rv.address)} target="_blank" rel="noreferrer"
                              style={{ background: "#05C8F7", color: "#fff", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", textDecoration: "none", fontWeight: 600 }}>
                              🚗 Waze
                            </a>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--muted-c)" }}>{rv.address}</div>
                      </div>
                    ) : (
                      <div style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 13, color: "var(--muted-c)", fontStyle: "italic" }}>
                        Aucune adresse — modifie ce ravito dans l'onglet Profil pour en ajouter une.
                      </div>
                    )}

                    {/* Ravito à préparer */}
                    {isAutonome ? (
                      <div style={{ padding: "12px 16px", background: C.stone, borderRadius: 12, fontSize: 13, color: C.muted, fontStyle: "italic" }}>
                        ⚠️ Ravito autonome — Rien à préparer (tout transporter depuis le départ ou ravito précédent)
                      </div>
                    ) : (() => {
                      const items = rv.produits || [];
                      // La biblio est globale (produits + recettes props), plus race.bibliotheque
                      const allItems = [...produits, ...recettes];
                      
                      if (!items.length) return (
                        <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 12, fontSize: 13, color: "var(--muted-c)", fontStyle: "italic" }}>
                          Aucun produit planifié — configure le plan dans l'onglet Nutrition.
                        </div>
                      );
                      return (
                        <div style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>Ravito à préparer</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {items.map(({ id, quantite }) => {
                              const p = allItems.find(x => x.id === id);
                              if (!p) return null;
                              
                              const kcal = kcalDuStock(p, quantite, allItems);
                              
                              return (
                                <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "var(--surface)", borderRadius: 8, fontSize: 13 }}>
                                  <span style={{ fontWeight: 600 }}>{p.nom}</span>
                                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <span style={{ color: "var(--muted-c)", fontSize: 12 }}>{formatQuantiteStock(p, quantite, flasqueMl)}</span>
                                    <span style={{ color: C.red, fontWeight: 600, fontSize: 12 }}>
                                      {kcal} kcal
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Notes */}
                    {rv.notes && (
                      <div style={{ padding: "12px 16px", background: C.primaryPale, borderRadius: 12, fontSize: 13, borderLeft: `3px solid ${C.primary}` }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Notes</div>
                        <div style={{ color: "var(--muted-c)" }}>{rv.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Segments après dernier ravito */}
      {ravitos.length > 0 && (() => {
        const lastRv = ravitos[ravitos.length - 1];
        const segsAfter = segments.filter(s => s.type !== "ravito" && s.type !== "repos" && s.startKm >= lastRv.km);
        if (!segsAfter.length) return null;
        const theoArrival = passingTimes[passingTimes.length - 1];
        return (
          <Card style={{ marginTop: 16, borderLeft: `4px solid ${C.primary}` }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🏁 Dernier tronçon → Arrivée</div>
            <div style={{ fontSize: 13, color: "var(--muted-c)", marginTop: 4 }}>
              {(segsAfter[segsAfter.length-1]?.endKm - lastRv.km).toFixed(1)} km restants depuis {lastRv.name}
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
              {adjustedArrival && adjustedArrival !== theoArrival ? (
                <>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 2 }}>Arrivée ajustée</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 22, color: C.primary }}>
                      {fmtHeure(adjustedArrival)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 2 }}>Théorique</div>
                    <div style={{ fontSize: 16, color: "var(--muted-c)", fontWeight: 500, marginTop: 4 }}>
                      {fmtHeure(theoArrival)}
                    </div>
                  </div>
                </>
              ) : theoArrival ? (
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 2 }}>Arrivée estimée</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 22, color: C.primary }}>
                    {fmtHeure(theoArrival)}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}
