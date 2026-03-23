import { useState, useEffect, useRef, useCallback } from 'react';
import { C, EMPTY_SETTINGS, DEFAULT_EQUIPMENT, PREP_TIMELINE } from './constants.js';
import { G } from './styles.jsx';
import { fmtTime, fmtPace, calcPassingTimes } from './utils.jsx';
import { Btn, Card, Hr, Modal, Field } from './atoms.jsx';
import ProfilView from './components/ProfilView.jsx';
import StrategieView from './components/StrategieView.jsx';
import EquipementView from './components/EquipementView.jsx';
import NutritionView from './components/NutritionView.jsx';
import TeamView from './components/TeamView.jsx';
import MesCoursesView from './components/MesCoursesView.jsx';
import AnalyseView from './components/AnalyseView.jsx';

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const NAVS = [
  { id: "profil",      label: "Profil de course",   icon: "🗺️", group: "Préparation" },
  { id: "preparation", label: "Stratégie de course", icon: "🎯", group: "Préparation" },
  { id: "nutrition",   label: "Nutrition",           icon: "🍌", group: "Préparation" },
  { id: "parametres",  label: "Équipement",          icon: "🎒", group: "Préparation" },
  { id: "analyse",     label: "Analyse",             icon: "📊", group: "Analyse" },
  { id: "team",        label: "Team",                icon: "👥", group: "Équipe" },
  { id: "courses",     label: "Mes courses",         icon: "📚", group: "Historique" },
];

// ─── PARTAGE STRATÉGIE ───────────────────────────────────────────────────────
function encodeStrategy(race, segments, settings) {
  // On exclut les points GPX (trop lourds) + équipement + garminStats (inutiles pour l'assistant)
  // On INCLUT produits car nécessaire pour afficher le plan nutrition côté Team
  const { gpxPoints, ...raceLight } = race;
  const { equipment, garminStats, ...settingsLight } = settings;
  const payload = { race: raceLight, segments, settings: settingsLight, v: 2, ts: Date.now() };
  try {
    const json    = JSON.stringify(payload);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return encoded;
  } catch { return null; }
}

function decodeStrategy(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch { return null; }
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("profil");
  const [race, setRaceRaw] = useState({});
  const [segments, setSegmentsRaw] = useState([]);
  const [settings, setSettingsRaw] = useState(EMPTY_SETTINGS);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [onboarding, setOnboarding] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installDone, setInstallDone] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [sharedMode, setSharedMode] = useState(false);
  const [courses, setCourses] = useState([]); // galerie des stratégies sauvegardées
  const [reposModal, setReposModal] = useState(false);
  const [reposForm, setReposForm]   = useState({ label: "", startKm: "", dureeMin: 20 });
  const addRepos = () => {
    if (!reposForm.label.trim() || !reposForm.dureeMin) return;
    const startKm = parseFloat(reposForm.startKm) || 0;
    setSegments(s => [...s, { id: Date.now(), type: "repos", label: reposForm.label, startKm, dureeMin: Number(reposForm.dureeMin), endKm: startKm, speedKmh: 0, slopePct: 0, terrain: "normal", notes: "" }]
      .sort((a, b) => (a.startKm ?? 0) - (b.startKm ?? 0)));
    setReposModal(false);
    setReposForm({ label: "", startKm: "", dureeMin: 20 });
  };

  // Détection navigateur/OS
  const ua = navigator.userAgent;
  const isIOS     = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari  = /^((?!chrome|android).)*safari/i.test(ua);
  const isChrome  = /chrome/i.test(ua) && /google/i.test(navigator.vendor);
  const isOpera   = /opr\//i.test(ua);
  const isFirefox = /firefox/i.test(ua);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  // Capturer l'événement beforeinstallprompt (Chrome, Edge, Opera)
  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      // Chrome / Edge / Opera — prompt natif
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") { setInstallDone(true); setInstallPrompt(null); }
    } else {
      // Autres navigateurs — guide manuel
      setShowInstallGuide(true);
    }
  };

  // ── IndexedDB helpers ────────────────────────────────────────────────────
  const IDB_NAME = "alex-trail", IDB_STORE = "state", IDB_COURSES = "courses", IDB_KEY = "current";
  const openDB = () => new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE))   db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains(IDB_COURSES)) db.createObjectStore(IDB_COURSES, { keyPath: "id" });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
  const idbSave = async data => {
    try {
      const db = await openDB();
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(data, IDB_KEY);
    } catch {}
  };
  const idbLoad = async () => {
    try {
      const db = await openDB();
      return new Promise(res => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => res(null);
      });
    } catch { return null; }
  };
  const idbSaveCourse = async (id, data) => {
    try {
      const db = await openDB();
      const tx = db.transaction(IDB_COURSES, "readwrite");
      tx.objectStore(IDB_COURSES).put({ id, ...data });
    } catch {}
  };
  const idbLoadCourses = async () => {
    try {
      const db = await openDB();
      return new Promise(res => {
        const tx = db.transaction(IDB_COURSES, "readonly");
        const req = tx.objectStore(IDB_COURSES).getAll();
        req.onsuccess = e => res(e.target.result || []);
        req.onerror = () => res([]);
      });
    } catch { return []; }
  };
  const idbDeleteCourse = async id => {
    try {
      const db = await openDB();
      const tx = db.transaction(IDB_COURSES, "readwrite");
      tx.objectStore(IDB_COURSES).delete(id);
    } catch {}
  };

  // ── Chargement au démarrage ──────────────────────────────────────────────
  useEffect(() => {
    // Priorité 1 : lien partagé ?s=... dans l'URL (ou #s=... en fallback)
    const urlParams = new URLSearchParams(window.location.search);
    let shared = urlParams.get("s");

    // Fallback : certains navigateurs iOS préservent mieux le hash que les query params
    if (!shared && window.location.hash.startsWith("#s=")) {
      shared = window.location.hash.slice(3);
    }

    if (shared) {
      const data = decodeStrategy(shared);
      if (data) {
        if (data.race)     setRaceRaw(data.race);
        if (data.segments) setSegmentsRaw(data.segments);
        if (data.settings) setSettingsRaw({ ...EMPTY_SETTINGS, ...data.settings });
        setSharedMode(true);
        setOnboarding(false);
        setView("team");
        idbSave({ race: data.race, segments: data.segments, settings: { ...EMPTY_SETTINGS, ...data.settings } });
        window.history.replaceState({}, "", window.location.pathname);
        return;
      } else {
        // Le lien existe mais est corrompu/tronqué
        console.warn("[Alex] Lien partagé détecté mais invalide. Longueur du code :", shared.length);
        // On continue vers IndexedDB
      }
    }
    // Priorité 2 : données IndexedDB locales
    idbLoad().then(d => {
      if (d?.race) { setRaceRaw(d.race); setOnboarding(false); }
      if (d?.segments) setSegmentsRaw(d.segments);
      if (d?.settings) setSettingsRaw({ ...EMPTY_SETTINGS, ...d.settings });
    });
    // Charger la galerie des courses sauvegardées
    idbLoadCourses().then(list => setCourses(list.sort((a, b) => b.savedAt - a.savedAt)));
  }, []);

  // ── Sauvegarde auto dans IndexedDB à chaque changement ───────────────────
  useEffect(() => {
    if (!race && !segments.length) return;
    const timer = setTimeout(() => {
      idbSave({ race, segments, settings });
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 800); // debounce 800ms
    return () => clearTimeout(timer);
  }, [race, segments, settings]);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [settings.darkMode]);

  const setRace = useCallback(upd => { setRaceRaw(upd); setHasUnsaved(true); }, []);
  const setSegments = useCallback(upd => { setSegmentsRaw(upd); setHasUnsaved(true); }, []);
  const setSettings = useCallback(upd => { setSettingsRaw(upd); setHasUnsaved(true); }, []);

  const saveData = () => {
    const json = JSON.stringify({ race, segments, settings }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "alex-data.json"; a.click();
    URL.revokeObjectURL(url);
    setHasUnsaved(false);
  };
  const loadData = (file) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d.race) setRaceRaw(d.race);
        if (d.segments) setSegmentsRaw(d.segments);
        if (d.settings) {
          const merged = { ...EMPTY_SETTINGS, ...d.settings };
          // Fusion équipement : on ajoute les items manquants (nouveaux ids) sans écraser les existants
          if (d.settings.equipment) {
            const existingIds = new Set(d.settings.equipment.map(i => i.id));
            const newItems = DEFAULT_EQUIPMENT.filter(i => !existingIds.has(i.id));
            // Fusionner aussi emporte/poidsG sur les items existants qui n'ont pas ces champs
            const upgraded = d.settings.equipment.map(i => {
              const def = DEFAULT_EQUIPMENT.find(x => x.id === i.id);
              return {
                ...i,
                emporte: i.emporte !== undefined ? i.emporte : (def?.emporte ?? true),
                poidsG:  i.poidsG  !== undefined ? i.poidsG  : (def?.poidsG  ?? 0),
              };
            });
            merged.equipment = [...upgraded, ...newItems];
          }
          setSettingsRaw(merged);
        }
        setHasUnsaved(false); setOnboarding(false);
      } catch { alert("Fichier JSON invalide"); }
    };
    reader.readAsText(file);
  };

  const navigate = id => { setView(id); setDrawerOpen(false); };

  const saveCourse = () => {
    const id = Date.now();
    const segsNormaux   = segments.filter(s => s.type !== "ravito" && s.type !== "repos");
    const segsRepos     = segments.filter(s => s.type === "repos");
    const totalCourse   = segsNormaux.reduce((s, seg) => s + (seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh * 3600 : 0), 0);
    const totalReposSec = segsRepos.reduce((s, seg) => s + (seg.dureeMin || 0) * 60, 0);
    const totalRavitoSec = (race.ravitos?.length || 0) * (settings.ravitoTimeMin || 3) * 60;
    const totalTime = totalCourse + totalReposSec + totalRavitoSec;
    const entry = {
      id,
      savedAt: id,
      name: settings.raceName || race.name || "Course sans nom",
      distance: race.totalDistance || 0,
      elevPos: race.totalElevPos || 0,
      segCount: segments.filter(s => s.type !== "ravito" && s.type !== "repos").length,
      startTime: settings.startTime || "07:00",
      totalTime,
      race, segments, settings,
    };
    idbSaveCourse(id, entry);
    setCourses(prev => [entry, ...prev]);
    return entry;
  };

  const loadCourse = entry => {
    // Préserver produits et equipment du profil courant — ils ne sont pas liés à une course spécifique
    const mergedSettings = { ...EMPTY_SETTINGS, ...(entry.settings || {}), produits: settings.produits || [], equipment: settings.equipment || DEFAULT_EQUIPMENT };
    setRaceRaw(entry.race || {});
    setSegmentsRaw(entry.segments || []);
    setSettingsRaw(mergedSettings);
    idbSave({ race: entry.race, segments: entry.segments, settings: mergedSettings });
    setHasUnsaved(false);
    setView("profil");
    setDrawerOpen(false);
  };

  const deleteCourse = id => {
    idbDeleteCourse(id);
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  const updateCourse = (id, patch) => {
    setCourses(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, ...patch };
      idbSaveCourse(id, updated);
      return updated;
    }));
  };

  const overwriteCourse = id => {
    const totalTime = segments
      .filter(s => s.type !== "ravito" && s.type !== "repos")
      .reduce((s, seg) => s + (seg.endKm - seg.startKm) / seg.speedKmh * 3600, 0);
    setCourses(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = {
        ...c,
        name: settings.raceName || race.name || c.name,
        distance: race.totalDistance || 0,
        elevPos: race.totalElevPos || 0,
        segCount: segments.filter(s => s.type !== "ravito" && s.type !== "repos").length,
        startTime: settings.startTime || "07:00",
        totalTime,
        race, segments, settings,
        updatedAt: Date.now(),
      };
      idbSaveCourse(id, updated);
      return updated;
    }));
  };
  const hasRace = !!race.gpxPoints?.length;

  // ── Features toggles (localStorage) ─────────────────────────────────────────
  const FEATURES_DEFAULT = {
    nutrition: true,
    equipement: true,
    analyse: true,
    team: true,
    courses: true,
    profilDetail: true,
  };
  const [features, setFeatures] = useState(() => {
    try {
      const saved = localStorage.getItem("alex-features");
      return saved ? { ...FEATURES_DEFAULT, ...JSON.parse(saved) } : FEATURES_DEFAULT;
    } catch { return FEATURES_DEFAULT; }
  });
  const [featuresModal, setFeaturesModal] = useState(false);

  const toggleFeature = key => {
    setFeatures(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("alex-features", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const FEATURE_LABELS = [
    { key: "profilDetail", label: "Profil détaillé",   icon: "🗺️", desc: "Répartition rythme, calibration Garmin, FC, calibration énergétique" },
    { key: "nutrition",    label: "Nutrition",         icon: "🍌", desc: "Plan nutritionnel par ravito, bibliothèque de produits" },
    { key: "equipement",   label: "Équipement",        icon: "🎒", desc: "Checklist équipement, poids, préparation chronologique" },
    { key: "analyse",      label: "Analyse",           icon: "📊", desc: "Cohérence stratégie, poids, autonomie nutritionnelle" },
    { key: "team",         label: "Team",              icon: "👥", desc: "Partage avec l'équipe d'assistance, suivi en direct" },
    { key: "courses",      label: "Mes courses",       icon: "📚", desc: "Historique et sauvegarde de tes stratégies" },
  ];

  // Nav filtrée selon features actives
  const NAVS_ACTIVE = NAVS.filter(n => {
    if (n.id === "nutrition")  return features.nutrition;
    if (n.id === "parametres") return features.equipement;
    if (n.id === "analyse")    return features.analyse;
    if (n.id === "team")       return features.team;
    if (n.id === "courses")    return features.courses;
    return true;
  });

  // Rediriger si la vue active est désactivée
  useEffect(() => {
    const featureMap = { nutrition: "nutrition", parametres: "equipement", analyse: "analyse", team: "team", courses: "courses" };
    const featureKey = featureMap[view];
    if (featureKey && !features[featureKey]) setView("profil");
  }, [features]);

  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: C.primary }}>Alex</div>
          {typeof window !== "undefined" && window.location.hostname !== "alex-trail.vercel.app" && !window.location.hostname.includes("localhost") && (
            <span style={{ fontSize: 10, fontWeight: 700, background: C.yellow + "30", color: C.yellow, border: `1px solid ${C.yellow}60`, borderRadius: 5, padding: "2px 7px", letterSpacing: "0.05em" }}>DEV</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>Trail Running Strategy</div>
      </div>
      <Hr />

      {/* Nav — prend tout l'espace disponible */}
      <nav style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {(() => {
          const groups = [...new Set(NAVS_ACTIVE.map(n => n.group))];
          return groups.map(group => (
            <div key={group}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-c)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 10px 4px", opacity: 0.7 }}>{group}</div>
              {NAVS_ACTIVE.filter(n => n.group === group).map(n => (
                <div key={n.id} className={`nav-item${view === n.id ? " active" : ""}`} onClick={() => navigate(n.id)}>
                  <span>{n.icon}</span>
                  <span>{n.label}</span>
                </div>
              ))}
            </div>
          ));
        })()}
        {hasRace && (
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px", fontSize: 13, marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{settings.raceName || race.name || "Course sans nom"}</div>
            <div style={{ color: "var(--muted-c)", fontSize: 12 }}>
              {race.totalDistance?.toFixed(1)} km · {Math.round(race.totalElevPos)} m D+
            </div>
            <div style={{ color: "var(--muted-c)", fontSize: 12 }}>{segments.filter(s => s.type !== "ravito" && s.type !== "repos").length} segments · {race.ravitos?.length || 0} ravitos</div>
          </div>
        )}

        {/* Bouton Mon expérience */}
        <div onClick={() => setFeaturesModal(true)} className="nav-item" style={{ marginTop: 8, borderTop: "1px solid var(--border-c)", paddingTop: 12 }}>
          <span>⚙️</span>
          <span>Mon expérience</span>
          <span style={{ marginLeft: "auto", fontSize: 10, background: C.primaryPale, color: C.primaryDeep, borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>
            {Object.values(features).filter(Boolean).length}/{Object.keys(features).length}
          </span>
        </div>
      </nav>

      {/* Bas de sidebar — dark mode + boutons données */}
      <Hr />
      <div style={{ padding: "12px 16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Indicateur sauvegarde auto */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "4px 0", height: 20 }}>
          {autoSaved && (
            <span style={{ fontSize: 11, color: C.green, fontWeight: 500, animation: "fadeUp 0.3s ease" }}>
              ✓ Sauvegarde auto
            </span>
          )}
        </div>

        {/* Toggle dark mode */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderRadius: 12, background: "var(--surface-2)",
        }}>
          <span style={{ fontSize: 13, color: "var(--muted-c)", fontWeight: 500 }}>
            {settings.darkMode ? "🌙 Mode sombre" : "☀️ Mode clair"}
          </span>
          <div
            onClick={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))}
            style={{
              width: 40, height: 22, borderRadius: 11, cursor: "pointer", transition: "background 0.2s", position: "relative",
              background: settings.darkMode ? C.primary : "var(--border-c)",
            }}>
            <div style={{
              position: "absolute", top: 3, left: settings.darkMode ? 21 : 3,
              width: 16, height: 16, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
        </div>

        {/* Bouton installation PWA */}
        {!isStandalone && !installDone && (
          <button onClick={handleInstall} style={{
            background: C.primaryPale, border: `1px solid ${C.primary}40`,
            borderRadius: 12, padding: "10px 14px", cursor: "pointer",
            fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8, color: C.primaryDeep,
            width: "100%", transition: "all 0.2s",
          }}>
            📲 Installer l'app
          </button>
        )}
        {isStandalone && (
          <div style={{ fontSize: 11, color: C.green, textAlign: "center", padding: "4px 0" }}>
            ✓ App installée
          </div>
        )}

        <button
          onClick={saveData}
          style={{
            background: hasUnsaved ? C.primary : "var(--surface-2)",
            color: hasUnsaved ? C.white : "var(--text-c)",
            border: "none", borderRadius: 12, padding: "10px 14px", cursor: "pointer",
            fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8, transition: "all 0.2s", width: "100%",
          }}>
          💾 Télécharger la stratégie
          {hasUnsaved && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.yellowPale, display: "inline-block", marginLeft: "auto" }} />}
        </button>

        {/* Charger une stratégie */}
        <label style={{ display: "block" }}>
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border-c)",
            borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontSize: 13,
            fontWeight: 500, color: "var(--text-c)",
            display: "flex", alignItems: "center", gap: 8,
          }}>📂 Charger une stratégie</div>
          <input type="file" accept=".json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) loadData(e.target.files[0]); }} />
        </label>

        {/* Nouvelle course (reset) */}
        <button onClick={() => {
          const hasData = (race.gpxPoints?.length > 0 || segments.length > 0);
          if (hasData) {
            const choice = window.confirm(
              `Démarrer une nouvelle course ?\n\nClique OK pour sauvegarder "${settings.raceName || race.name || "la course actuelle"}" dans Mes courses avant de continuer.\nClique Annuler pour tout effacer sans sauvegarder.`
            );
            if (choice) saveCourse();
          }
          // Préserver produits et equipment — ils appartiennent au profil coureur, pas à la course
          const newSettings = { ...EMPTY_SETTINGS, produits: settings.produits || [], equipment: settings.equipment || DEFAULT_EQUIPMENT, darkMode: settings.darkMode };
          setRaceRaw({});
          setSegmentsRaw([]);
          setSettingsRaw(newSettings);
          setHasUnsaved(false);
          setView("profil");
          setDrawerOpen(false);
          idbSave({ race: {}, segments: [], settings: newSettings });
        }} style={{
          background: "none", border: `1px solid var(--border-c)`, borderRadius: 12,
          padding: "10px 14px", cursor: "pointer", fontSize: 13, width: "100%",
          fontWeight: 500, color: "var(--muted-c)",
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "'DM Sans', sans-serif", transition: "color 0.2s",
        }}>
          🔄 Nouvelle course
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{G}</style>

      {/* MODAL REPOS */}
      <Modal open={reposModal} onClose={() => setReposModal(false)} title="Ajouter un segment de repos">
        <div className="form-grid">
          <Field label="Description" full>
            <input value={reposForm.label} onChange={e => setReposForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Ex : Bivouac, Sieste ravito, Base vie..." autoFocus />
          </Field>
          <Field label="Kilomètre de départ">
            <input type="number" min={0} step={0.1} value={reposForm.startKm}
              onChange={e => setReposForm(f => ({ ...f, startKm: e.target.value }))}
              placeholder="Ex : 60" />
          </Field>
          <Field label="Durée (minutes)">
            <div>
              <input type="range" min={5} max={480} step={5} value={reposForm.dureeMin}
                onChange={e => setReposForm(f => ({ ...f, dureeMin: Number(e.target.value) }))} />
              <div style={{ textAlign: "center", fontSize: 13, marginTop: 6 }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>{reposForm.dureeMin} min</span>
                <span style={{ color: "var(--muted-c)", marginLeft: 8 }}>({fmtTime(reposForm.dureeMin * 60)})</span>
              </div>
            </div>
          </Field>
        </div>
        <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 13, color: "var(--muted-c)" }}>
          Pas de distance associée — ajoute uniquement du temps au total de course.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setReposModal(false)}>Annuler</Btn>
          <Btn onClick={addRepos}>Ajouter</Btn>
        </div>
      </Modal>

      {/* GUIDE INSTALLATION PWA */}
      {showInstallGuide && (
        <div className="modal-overlay" onClick={() => setShowInstallGuide(false)}>
          <div className="confirm-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: C.primary, marginBottom: 16 }}>
              📲 Installer Alex
            </div>
            {isIOS ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "var(--muted-c)", fontSize: 14, lineHeight: 1.6 }}>
                  Sur iPhone/iPad, l'installation se fait depuis <strong>Safari</strong> uniquement :
                </p>
                {[
                  { step: "1", text: "Ouvre alex-trail.vercel.app dans Safari" },
                  { step: "2", text: "Appuie sur l'icône Partage □↑ en bas de l'écran" },
                  { step: "3", text: "Fais défiler et appuie sur « Sur l'écran d'accueil »" },
                  { step: "4", text: "Appuie sur « Ajouter » en haut à droite" },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.primary, color: "#fff", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.step}</div>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{s.text}</span>
                  </div>
                ))}
              </div>
            ) : isFirefox ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "var(--muted-c)", fontSize: 14, lineHeight: 1.6 }}>
                  Sur Firefox Android :
                </p>
                {[
                  { step: "1", text: "Appuie sur le menu ⋮ en haut à droite" },
                  { step: "2", text: "Sélectionne « Installer »" },
                  { step: "3", text: "Confirme l'installation" },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.primary, color: "#fff", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.step}</div>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{s.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "var(--muted-c)", fontSize: 14, lineHeight: 1.6 }}>
                  Sur ce navigateur, cherche l'option d'installation dans le menu :
                </p>
                {[
                  { step: "1", text: "Ouvre le menu du navigateur (⋮ ou ···)" },
                  { step: "2", text: "Cherche « Ajouter à l'écran d'accueil » ou « Installer »" },
                  { step: "3", text: "Confirme l'installation" },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.primary, color: "#fff", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.step}</div>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{s.text}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowInstallGuide(false)} style={{
                background: C.primary, color: "#fff", border: "none", borderRadius: 10,
                padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}>Compris</button>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING */}
      {onboarding && (
        <div className="modal-overlay">
          <div className="confirm-box" style={{ maxWidth: 440, textAlign: "left" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: C.primary, marginBottom: 8 }}>Alex 🏔️</div>
            <p style={{ color: "var(--muted-c)", marginBottom: 20, lineHeight: 1.6 }}>
              Ton outil de stratégie trail. Charge un GPX, définis ta stratégie par segment, génère ton récap de course.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Btn onClick={() => { setOnboarding(false); setView("profil"); }}>🚀 Commencer</Btn>
              <label style={{ display: "block", cursor: "pointer" }}>
                <div style={{
                  background: C.sand, border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: "11px 16px", textAlign: "center", fontSize: 14, fontWeight: 500,
                  color: C.text, fontFamily: "'DM Sans', sans-serif",
                }}>
                  📂 Charger une stratégie
                </div>
                <input type="file" accept=".json" style={{ display: "none" }}
                  onChange={e => { if (e.target.files[0]) { loadData(e.target.files[0]); setOnboarding(false); } }} />
              </label>
              <Btn variant="soft" onClick={() => { setOnboarding(false); setView("team"); }}>🔗 J'ai un lien de stratégie</Btn>
              <Btn variant="ghost" onClick={() => { setOnboarding(false); setView("parametres"); }}>⚙️ Configurer d'abord</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* SIDEBAR DESKTOP */}
        {!isMobile && (
          <div style={{
            width: 240, flexShrink: 0, background: "var(--surface)", borderRight: "1px solid var(--border-c)",
            overflowY: "auto", display: "flex", flexDirection: "column", height: "100vh",
          }}>
            <SidebarContent />
          </div>
        )}

        {/* MOBILE TOPBAR */}
        {isMobile && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 100,
            background: "var(--surface)", borderBottom: "1px solid var(--border-c)",
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px",
          }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: C.primary }}>Alex</div>
            <div style={{ fontSize: 13, color: "var(--muted-c)" }}>{NAVS_ACTIVE.find(n => n.id === view)?.label}</div>
            <button onClick={() => setDrawerOpen(true)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-c)" }}>☰</button>
          </div>
        )}

        {/* MOBILE DRAWER */}
        {isMobile && drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
            <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: 260,
              background: "var(--surface)", overflowY: "auto",
              animation: "slideInLeft 0.25s ease",
              display: "flex", flexDirection: "column",
            }}>
              <button onClick={() => setDrawerOpen(false)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted-c)" }}>✕</button>
              <SidebarContent />
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <main style={{
          flex: 1, overflowY: "auto",
          padding: isMobile ? "76px 16px 32px" : "44px 52px",
        }}>
          {view === "profil"      && <ProfilView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} onOpenRepos={() => setReposModal(true)} isMobile={isMobile} profilDetail={features.profilDetail} />}
          {view === "preparation" && <StrategieView race={race} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} onOpenRepos={() => setReposModal(true)} isMobile={isMobile} />}
          {view === "nutrition"   && <NutritionView segments={segments} settings={settings} setSettings={setSettings} race={race} setRace={setRace} isMobile={isMobile} onNavigate={navigate} />}
          {view === "analyse"     && <AnalyseView race={race} segments={segments} settings={settings} isMobile={isMobile} onNavigate={navigate} />}
          {view === "team"        && <TeamView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} sharedMode={sharedMode} installPrompt={installPrompt} onInstall={handleInstall} isMobile={isMobile} onLoadStrategy={data => {
            if (data.race)     setRaceRaw(data.race);
            if (data.segments) setSegmentsRaw(data.segments);
            if (data.settings) setSettingsRaw({ ...EMPTY_SETTINGS, ...data.settings });
            idbSave({ race: data.race, segments: data.segments, settings: { ...EMPTY_SETTINGS, ...data.settings } });
          }} />}
          {view === "courses"     && <MesCoursesView courses={courses} onLoad={loadCourse} onDelete={deleteCourse} onUpdate={updateCourse} onOverwrite={overwriteCourse} onSaveCurrent={() => { saveCourse(); alert("✅ Stratégie sauvegardée dans Mes courses !"); }} race={race} segments={segments} settings={settings} />}
          {view === "parametres"  && <EquipementView settings={settings} setSettings={setSettings} race={race} setRace={setRace} segments={segments} isMobile={isMobile} />}
        </main>
      </div>

      {/* ── MODAL MON EXPÉRIENCE ── */}
      <Modal open={featuresModal} onClose={() => setFeaturesModal(false)} title="Mon expérience">
        <p style={{ fontSize: 13, color: "var(--muted-c)", marginBottom: 20, lineHeight: 1.6 }}>
          Active uniquement les fonctionnalités dont tu as besoin. Les onglets désactivés disparaissent de la navigation. Tu peux changer d'avis à tout moment.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FEATURE_LABELS.map(({ key, label, icon, desc }) => {
            const active = features[key];
            return (
              <div key={key} onClick={() => toggleFeature(key)} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                borderRadius: 12, cursor: "pointer", transition: "all 0.15s",
                border: `2px solid ${active ? C.primary + "60" : "var(--border-c)"}`,
                background: active ? C.primaryPale : "var(--surface-2)",
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: active ? C.primaryDeep : "var(--text-c)" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-c)", marginTop: 2 }}>{desc}</div>
                </div>
                <div style={{
                  width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                  background: active ? C.primary : "var(--border-c)",
                  position: "relative", transition: "background 0.2s",
                }}>
                  <div style={{
                    position: "absolute", top: 3, left: active ? 21 : 3,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 20, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 12, color: "var(--muted-c)" }}>
          💡 Les onglets Profil de course et Stratégie sont toujours visibles — ils constituent le cœur d'Alex.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn onClick={() => setFeaturesModal(false)}>Fermer</Btn>
        </div>
      </Modal>
    </>
  );
}
