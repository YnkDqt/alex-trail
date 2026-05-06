import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth } from './AuthContext';
import { loadAthleteProfile, saveAthleteProfile, loadActivities, saveActivities, loadSeances, saveSeances, loadSommeil, saveSommeil, loadVFC, saveVFC, loadPoids, savePoids, loadObjectifs, saveObjectifs, loadCurrentRace, saveCurrentRace, loadCourses, saveCourse, deleteCourse, loadNutrition, saveNutrition, loadJournalMoments, saveJournalMoments, loadEntrainementSettings, saveEntrainementSettings, getDataVersion, bumpDataVersion, clearUserData, hasSnapshotForCurrentPeriod, createSnapshot, listSnapshots, loadSnapshot, exportAllUserDataAsJSON } from './supabaseHelpers';
import Login from './Login';
import { C, COURSE_C, COURSE_NAVS, EMPTY_SETTINGS, DEFAULT_EQUIPMENT,
  ACTIVITY_TYPES, STATUT_OPTIONS, ACT_ICON,
  GARMIN_TO_ACTIVITE, TYPE_MIGRATION, DEFAULT_PLANNING,
  isRunning, exportJSON, localDate, fmtDate, daysUntil,
  actColor, actColorPale, actIcon, actShort,
  parseCSVActivities, parseCSVSommeil, parseCSVVFC,
  emptySeance, emptyObjectif, emptyPoids, emptyVFC, emptySommeil } from './constants.js';
import AppLayout from './components/AppLayout.jsx';

// ─── PARTAGE STRATÉGIE ────────────────────────────────────────────────────────
function encodeStrategy(race, segments, settings) {
  const { gpxPoints, ...raceLight } = race;
  const { equipment, garminStats, ...settingsLight } = settings;
  const payload = { race: raceLight, segments, settings: settingsLight, v: 2, ts: Date.now() };
  try {
    const json = JSON.stringify(payload);
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

// Construit un snapshot des items biblio référencés par une course.
// Permet aux courses passées de rester lisibles même si l'item est ensuite
// supprimé/modifié dans la bibliothèque.
function buildItemsSnapshot(race, produits, recettes) {
  const ids = new Set();
  (race?.depart?.produits || []).forEach(p => p?.id != null && ids.add(p.id));
  (race?.ravitos || []).forEach(rv => (rv?.produits || []).forEach(p => p?.id != null && ids.add(p.id)));
  const all = [...(produits || []), ...(recettes || [])];
  return all.filter(it => ids.has(it.id));
}



// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, signOut, isRecovery, mfaGetAAL, mfaListFactors, mfaVerify, mfaUseRecoveryCode } = useAuth();
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<=768); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);

  // ── Entrainement state ────────────────────────────────────────────────────
  const migrateSeances = ss=>ss.map(s=>({...s,
    activite:TYPE_MIGRATION[s.activite]||s.activite,
    statut:s.statut==="Planifié"?"Planifié":s.statut==="Effectué"?"Effectué":s.statut==="Annulé"?"Annulé":s.statut||"Planifié",
  }));
  const migrateActivites = aa=>aa.map(a=>({...a,type:GARMIN_TO_ACTIVITE[a.type]||TYPE_MIGRATION[a.type]||a.type}));

  // ── Entrainement states (chargés depuis Supabase) ─────────────────────────
  const [seances,       setSeances]      = useState([]);
  const [activites,     setActivites]    = useState([]);
  const [sommeil,       setSommeil]      = useState([]);
  const [vfcData,       setVfcData]      = useState([]);
  const [poids,         setPoids]        = useState([]);
  const [objectifs,     setObjectifs]    = useState([]);
  const [planningType,  setPlanningType] = useState(DEFAULT_PLANNING);
  const [activityTypes, setActivityTypes]= useState(ACTIVITY_TYPES.filter(t=>t));
  const [journalNutri,  setJournalNutri] = useState([]);
  const [journalMoments, setJournalMoments] = useState([]);
  const [produits,      setProduits]     = useState([]);
  const [recettes,      setRecettes]     = useState([]);
  const [profil,        setProfil]       = useState({sexe:"Homme",taille:180});
  const [profilType,    setProfilType]   = useState(null); // null = premier lancement
  
  // ── Feature toggles (chargés depuis Supabase) ──────────────────────────────
  const ENTRAINEMENT_FEATURES_DEFAULT = {programme:true,activites:true,forme:true,gut_training:true,objectifs:true,journal:true,coach:true};
  const COURSE_FEATURES_DEFAULT = {nutrition:true,equipement:true,analyse:true,team:true,courses:true,profilDetail:true};
  const [entrainementFeatures, setEntrainementFeatures] = useState(ENTRAINEMENT_FEATURES_DEFAULT);
  const [courseFeatures, setCourseFeatures] = useState(COURSE_FEATURES_DEFAULT);
  
  const [confirmReset,  setConfirmReset] = useState(false);
  const [dataLoaded,    setDataLoaded]   = useState(false);
  const [loadError,     setLoadError]    = useState(false);
  const [loadAttempt,   setLoadAttempt]  = useState(0);

  // ── Détection de conflit multi-sessions ─────────────────────────────────
  // serverVersionRef : timestamp de la dernière version connue côté serveur
  // (initialisée au load, mise à jour après chaque save réussi)
  // Si avant un save on détecte que le serveur a une version plus récente
  // → une autre session a modifié entre temps → on bloque tout.
  const serverVersionRef = useRef(null);
  const [conflictDetected, setConflictDetected] = useState(false);

  // ── Challenge 2FA après login ────────────────────────────────────────────
  // Si l'utilisateur a enrôlé un facteur TOTP, Supabase le met en aal1 après
  // le login par mdp. Il faut qu'il saisisse un code 6 chiffres pour passer
  // en aal2 avant d'accéder à l'app.
  const [mfaCheckDone, setMfaCheckDone] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaChallengeCode, setMfaChallengeCode] = useState("");
  const [mfaChallengeError, setMfaChallengeError] = useState("");
  const [mfaChallengeLoading, setMfaChallengeLoading] = useState(false);
  const [mfaUseRecovery, setMfaUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryError, setRecoveryError] = useState("");

  useEffect(() => {
    if (!user?.id) { setMfaCheckDone(false); setMfaRequired(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await mfaGetAAL();
        if (cancelled) return;
        // aal1 avec nextLevel aal2 = l'utilisateur doit compléter la 2FA
        const needs = data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2';
        setMfaRequired(needs);
      } catch (err) {
        console.error('Erreur mfaGetAAL:', err);
      } finally {
        if (!cancelled) setMfaCheckDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitMfaChallenge = async () => {
    if (!mfaChallengeCode || mfaChallengeCode.length !== 6) {
      setMfaChallengeError("Entre les 6 chiffres affichés dans ton application"); return;
    }
    setMfaChallengeError(""); setMfaChallengeLoading(true);
    try {
      const { data: factors } = await mfaListFactors();
      const totp = factors?.totp?.[0];
      if (!totp) { setMfaChallengeError("Aucun facteur TOTP actif"); setMfaChallengeLoading(false); return; }
      const { error } = await mfaVerify(totp.id, mfaChallengeCode.trim());
      if (error) {
        setMfaChallengeError("Code incorrect. Vérifie l'heure de ton téléphone et réessaie.");
        setMfaChallengeLoading(false);
        return;
      }
      setMfaRequired(false);
      setMfaChallengeCode("");
      setMfaChallengeLoading(false);
    } catch (err) {
      console.error('Erreur submit MFA:', err);
      setMfaChallengeError("Une erreur est survenue.");
      setMfaChallengeLoading(false);
    }
  };

  const submitRecoveryCode = async () => {
    const code = recoveryCode.trim().toUpperCase();
    if (!code) { setRecoveryError("Entre ton code de récupération"); return; }
    setRecoveryError(""); setMfaChallengeLoading(true);
    try {
      // factorId résolu côté Edge Function (listFactors indisponible en aal1)
      const { error } = await mfaUseRecoveryCode(code, null);
      if (error) {
        setRecoveryError(error.message || "Code invalide ou déjà utilisé.");
        setMfaChallengeLoading(false);
        return;
      }
      setMfaRequired(false);
      setRecoveryCode("");
      setMfaChallengeLoading(false);
    } catch (err) {
      setRecoveryError("Une erreur est survenue.");
      setMfaChallengeLoading(false);
    }
  };
  useEffect(() => {
    if (!user?.id || dataLoaded) return;

    let cancelled = false;

    // Timeout wrapper : rejette si la promesse ne résout pas en `ms` ms
    const withTimeout = (promise, ms, label) => Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout ${label} (${ms}ms)`)), ms)),
    ]);

    // Retry wrapper : jusqu'à `maxAttempts` tentatives avec backoff exponentiel
    const loadWithRetry = async () => {
      const maxAttempts = 3;
      const timeoutMs = 10000;
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const results = await withTimeout(
            Promise.all([
              loadAthleteProfile(user.id),
              loadActivities(user.id),
              loadSeances(user.id),
              loadSommeil(user.id),
              loadVFC(user.id),
              loadPoids(user.id),
              loadObjectifs(user.id),
              loadNutrition(user.id),
              loadJournalMoments(user.id),
              loadEntrainementSettings(user.id),
              getDataVersion(user.id),
            ]),
            timeoutMs,
            `tentative ${attempt}`
          );
          return results;
        } catch (err) {
          lastError = err;
          console.warn(`Chargement échoué (tentative ${attempt}/${maxAttempts}):`, err.message);
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
          }
        }
      }
      throw lastError;
    };

    loadWithRetry().then((results) => {
      if (cancelled) return;
      const [profile, acts, seances, som, vfc, pds, objs, nutr, jrnMoments, settings, dataVersion] = results;
      serverVersionRef.current = dataVersion;
      if (profile) setProfil(profile);
      if (acts?.length) setActivites(migrateActivites(acts));
      if (seances?.length) setSeances(migrateSeances(seances));
      if (som?.length) setSommeil(som);
      if (vfc?.length) setVfcData(vfc);
      if (pds?.length) setPoids(pds);
      if (objs?.length) setObjectifs(objs);
      if (jrnMoments?.length) setJournalMoments(jrnMoments);
      if (nutr) {
        if (nutr.journalNutri?.length) setJournalNutri(nutr.journalNutri);
        // Dédoublonnage par nom (garde le plus récent = id le plus grand) au load
        const dedupByName = (items) => {
          const byName = new Map();
          items.forEach(it => {
            const key = (it.nom || '').trim().toLowerCase();
            if (!key) return;
            const existing = byName.get(key);
            if (!existing || (Number(it.id) || 0) > (Number(existing.id) || 0)) {
              byName.set(key, it);
            }
          });
          return Array.from(byName.values());
        };
        let cleanedProduits = null;
        let cleanedRecettes = null;
        if (nutr.produits?.length) {
          const original = nutr.produits;
          const cleaned = dedupByName(original).map(p => ({ ...p, type: p.type || 'produit' }));
          setProduits(cleaned);
          if (cleaned.length !== original.length) cleanedProduits = cleaned;
        }
        if (nutr.recettes?.length) {
          const original = nutr.recettes;
          const cleaned = dedupByName(original).map(r => ({ ...r, type: r.type || 'recette' }));
          setRecettes(cleaned);
          if (cleaned.length !== original.length) cleanedRecettes = cleaned;
        }
        // Si on a effectivement supprimé des doublons, persiste le nettoyage
        if (cleanedProduits || cleanedRecettes) {
          saveNutrition(
            user.id,
            nutr.journalNutri || [],
            cleanedProduits || nutr.produits || [],
            cleanedRecettes || nutr.recettes || []
          ).catch(err => console.error('Erreur save dedoublonnage:', err));
        }
      }
      if (settings) {
        if (settings.planningType && Object.keys(settings.planningType).length > 0) {
          setPlanningType(settings.planningType);
        }
        if (settings.activityTypes?.length) setActivityTypes(settings.activityTypes);
        if (settings.entrainementFeatures) setEntrainementFeatures(settings.entrainementFeatures);
        if (settings.courseFeatures) setCourseFeatures(settings.courseFeatures);
        if (settings.profilType !== undefined) setProfilType(settings.profilType);
      }
      setLoadError(false);
      setDataLoaded(true);
      
      // ── SNAPSHOT : sauvegarde de la période courante si pas déjà existante ──
      // Non bloquant. Utilise les données fraîchement loadées (pas le state).
      // Format ALIGNÉ sur l'export JSON pour interchangeabilité (cf. handleRestore).
      hasSnapshotForCurrentPeriod(user.id).then(exists => {
        if (exists) return;
        // Charger aussi currentRace et courses (pas dans le bloc principal load)
        return Promise.all([
          loadCurrentRace(user.id).catch(() => null),
          loadCourses(user.id).catch(() => [])
        ]).then(([currentRace, coursesList]) => {
          const snapshotData = {
            // Mêmes clés que l'export JSON (cf. ligne export "alex-export-1.0")
            profile: profile || null,
            activities: acts || [],
            seances: seances || [],
            sommeil: som || [],
            vfc: vfc || [],
            poids: pds || [],
            objectifs: objs || [],
            nutrition: nutr || null,
            settings: settings || null,
            currentRace: currentRace || null,
            courses: coursesList || []
          };
          return createSnapshot(user.id, snapshotData);
        });
      }).catch(err => {
        console.warn('[snapshot] échec création (non bloquant):', err);
      });
    }).catch(err => {
      if (cancelled) return;
      console.error('Erreur chargement données (toutes tentatives échouées):', err);
      setLoadError(true);
      // IMPORTANT : on NE passe PAS dataLoaded à true → aucune écriture ne pourra partir
    });

    return () => { cancelled = true; };
  }, [user?.id, dataLoaded, loadAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flush pending saves au beforeunload ──────────────────────────────────
  // Chaque auto-save enregistre sa fonction de flush ici. Si l'utilisateur
  // quitte la page pendant la fenêtre de debounce (2s), on déclenche toutes
  // les saves pending immédiatement au lieu de les perdre.
  const pendingSavesRef = useRef({});
  // Flag pour éviter qu'un conflit ne soit traité plusieurs fois par les auto-saves parallèles
  const conflictHandlingRef = useRef(false);
  // Mutex : ne laisser qu'un seul safeSave en cours pour éviter les races sur serverVersionRef
  // (sinon plusieurs autosaves en parallèle peuvent désynchroniser la version locale).
  const safeSaveQueueRef = useRef(Promise.resolve());

  // ── Save sécurisé avec détection de conflit ────────────────────────────
  // Avant chaque écriture, on relit la data_version côté serveur.
  // - Si identique à notre référence locale → l'écriture est sûre, on bump
  //   la version serveur et on mémorise le nouveau timestamp.
  // - Si différente → une autre session/onglet a modifié entre temps. On bloque
  //   tout via setConflictDetected(true) pour éviter l'écrasement (écran explicite).
  //
  // Sérialisation : tous les safeSave passent par une queue (mutex). Garantit
  // qu'aucun bumpDataVersion ne peut s'intercaler entre le getDataVersion et
  // le bumpDataVersion d'un autre save → plus de fausse détection de conflit.
  const safeSave = useCallback(async (saveFn) => {
    if (!user?.id) return;
    if (conflictDetected) return;
    if (conflictHandlingRef.current) return;

    // On chaîne sur la queue : chaque save attend que le précédent finisse
    const previous = safeSaveQueueRef.current;
    let release;
    safeSaveQueueRef.current = new Promise(resolve => { release = resolve; });

    try {
      await previous; // attendre que le précédent finisse (succès ou échec)
      // Re-checks après attente (état peut avoir changé pendant qu'on attendait)
      if (conflictDetected) return;
      if (conflictHandlingRef.current) return;

      const currentServerVersion = await getDataVersion(user.id);
      // Cas particulier : première écriture (aucune version stockée) → on passe
      if (serverVersionRef.current && currentServerVersion && currentServerVersion !== serverVersionRef.current) {
        conflictHandlingRef.current = true;
        console.warn('[conflict] version serveur a changé', { local: serverVersionRef.current, server: currentServerVersion });
        // Toujours afficher l'écran bloquant : l'utilisateur garde la main.
        // Un reload silencieux peut produire une boucle si la cause est interne.
        setConflictDetected(true);
        return;
      }
      await saveFn();
      const newVersion = await bumpDataVersion(user.id);
      // Garder la version la plus récente (filet anti-désordre des promesses)
      if (!serverVersionRef.current || (newVersion && newVersion > serverVersionRef.current)) {
        serverVersionRef.current = newVersion;
      }
    } catch (err) {
      console.error('[safeSave] erreur:', err);
      // Erreur réseau ponctuelle : on laisse le prochain save retenter.
    } finally {
      release(); // libère la queue pour le suivant
    }
  }, [user?.id, conflictDetected]);

  useEffect(() => {
    const handler = () => {
      if (conflictDetected) return; // ne pas flusher si on sait qu'on écraserait
      const pending = pendingSavesRef.current;
      Object.keys(pending).forEach(key => {
        try { pending[key](); } catch (e) { /* fire-and-forget */ }
      });
    };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler); // fiabilité mobile (Safari iOS)
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, []);

  // Auto-save activités vers Supabase (debounced 2s, protection conflit via safeSave)
  useEffect(()=>{
    if (!user?.id || !dataLoaded || conflictDetected) return;
    pendingSavesRef.current.activites = () => safeSave(() => saveActivities(user.id, activites));
    const timer = setTimeout(() => {
      safeSave(() => saveActivities(user.id, activites));
      delete pendingSavesRef.current.activites;
    }, 2000);
    return () => clearTimeout(timer);
  }, [activites, user?.id, dataLoaded, conflictDetected, safeSave]);

  // Auto-save séances
  useEffect(()=>{
    if (!user?.id || !dataLoaded || conflictDetected) return;
    pendingSavesRef.current.seances = () => safeSave(() => saveSeances(user.id, seances));
    const timer = setTimeout(() => {
      safeSave(() => saveSeances(user.id, seances));
      delete pendingSavesRef.current.seances;
    }, 2000);
    return () => clearTimeout(timer);
  }, [seances, user?.id, dataLoaded, conflictDetected, safeSave]);

  // Auto-save sommeil
  useEffect(()=>{
    if (!user?.id || !dataLoaded || conflictDetected) return;
    pendingSavesRef.current.sommeil = () => safeSave(() => saveSommeil(user.id, sommeil));
    const timer = setTimeout(() => {
      safeSave(() => saveSommeil(user.id, sommeil));
      delete pendingSavesRef.current.sommeil;
    }, 2000);
    return () => clearTimeout(timer);
  }, [sommeil, user?.id, dataLoaded, conflictDetected, safeSave]);

  // Auto-save VFC
  useEffect(()=>{
    if (!user?.id || !dataLoaded || conflictDetected) return;
    pendingSavesRef.current.vfc = () => safeSave(() => saveVFC(user.id, vfcData));
    const timer = setTimeout(() => {
      safeSave(() => saveVFC(user.id, vfcData));
      delete pendingSavesRef.current.vfc;
    }, 2000);
    return () => clearTimeout(timer);
  }, [vfcData, user?.id, dataLoaded, conflictDetected, safeSave]);

  // Auto-save poids
  useEffect(()=>{
    if (!user?.id || !dataLoaded || conflictDetected) return;
    pendingSavesRef.current.poids = () => safeSave(() => savePoids(user.id, poids));
    const timer = setTimeout(() => {
      safeSave(() => savePoids(user.id, poids));
      delete pendingSavesRef.current.poids;
    }, 2000);
    return () => clearTimeout(timer);
  }, [poids, user?.id, dataLoaded, conflictDetected, safeSave]);

  // Auto-save objectifs
  useEffect(()=>{
    if (!user?.id || !dataLoaded || conflictDetected) return;
    pendingSavesRef.current.objectifs = () => safeSave(() => saveObjectifs(user.id, objectifs));
    const timer = setTimeout(() => {
      safeSave(() => saveObjectifs(user.id, objectifs));
      delete pendingSavesRef.current.objectifs;
    }, 2000);
    return () => clearTimeout(timer);
  }, [objectifs, user?.id, dataLoaded, conflictDetected, safeSave]);

  // Auto-save nutrition
  useEffect(()=>{
    if (!user?.id || !dataLoaded || conflictDetected) return;
    pendingSavesRef.current.nutrition = () => safeSave(() => saveNutrition(user.id, journalNutri, produits, recettes));
    const timer = setTimeout(() => {
      safeSave(() => saveNutrition(user.id, journalNutri, produits, recettes));
      delete pendingSavesRef.current.nutrition;
    }, 2000);
    return () => clearTimeout(timer);
  }, [journalNutri, produits, recettes, user?.id, dataLoaded, conflictDetected, safeSave]);

  // Auto-save journal moments
  useEffect(()=>{
    if (!user?.id || !dataLoaded || conflictDetected) return;
    pendingSavesRef.current.journalMoments = () => safeSave(() => saveJournalMoments(user.id, journalMoments));
    const timer = setTimeout(() => {
      safeSave(() => saveJournalMoments(user.id, journalMoments));
      delete pendingSavesRef.current.journalMoments;
    }, 2000);
    return () => clearTimeout(timer);
  }, [journalMoments, user?.id, dataLoaded, conflictDetected, safeSave]);

  // Auto-save entrainement settings + features
  useEffect(()=>{
    if (!user?.id || !dataLoaded || conflictDetected) return;
    pendingSavesRef.current.entrainementSettings = () => safeSave(() => saveEntrainementSettings(user.id, planningType, activityTypes, entrainementFeatures, courseFeatures, profilType));
    const timer = setTimeout(() => {
      safeSave(() => saveEntrainementSettings(user.id, planningType, activityTypes, entrainementFeatures, courseFeatures, profilType));
      delete pendingSavesRef.current.entrainementSettings;
    }, 2000);
    return () => clearTimeout(timer);
  }, [planningType, activityTypes, entrainementFeatures, courseFeatures, profilType, user?.id, dataLoaded, conflictDetected, safeSave]);

  // Auto-save profil athlète (BPM, FC zones, glucides cible, taille, sexe, etc.)
  // Garde anti-écrasement : on ne sauvegarde que si le profil a au moins un champ utilisateur
  // (prenom ou dateNaissance). Sinon on est probablement dans un état initial/transitoire,
  // sauvegarder écraserait la DB avec un profil vide.
  useEffect(()=>{
    if (!user?.id || !dataLoaded || conflictDetected) return;
    if (!profil?.prenom && !profil?.dateNaissance) return;
    pendingSavesRef.current.profil = () => safeSave(() => saveAthleteProfile(user.id, profil));
    const timer = setTimeout(() => {
      safeSave(() => saveAthleteProfile(user.id, profil));
      delete pendingSavesRef.current.profil;
    }, 2000);
    return () => clearTimeout(timer);
  }, [profil, user?.id, dataLoaded, conflictDetected, safeSave]);

  // Init profil.taille depuis dernier poids si vide (mount uniquement)
  useEffect(()=>{
    if(!profil.taille && poids.length){
      const last = [...poids].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
      if(last.taille) setProfil(p=>({...p, taille:last.taille}));
    }
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const allData = {seances,activites,sommeil,vfcData,poids,objectifs,planningType,activityTypes,journalNutri,journalMoments,produits,recettes,profil};
  const loadEntrainementData = data => {
    if(data.seances)       setSeances(data.seances);
    if(data.activites)     setActivites(data.activites);
    if(data.sommeil)       setSommeil(data.sommeil);
    if(data.vfcData)       setVfcData(data.vfcData);
    if(data.poids)         setPoids(data.poids);
    if(data.objectifs)     setObjectifs(data.objectifs);
    if(data.planningType)  setPlanningType(data.planningType);
    if(data.activityTypes) setActivityTypes(data.activityTypes);
    if(data.journalNutri)  setJournalNutri(data.journalNutri);
    if(data.journalMoments)setJournalMoments(data.journalMoments);
    if(data.produits)      setProduits(data.produits);
    if(data.recettes)      setRecettes(data.recettes);
    if(data.profil)        setProfil(data.profil);
  };
  const resetAll = async ()=>{
    // 1. Vider côté serveur EXPLICITEMENT (couche 3 : action consciente)
    if (user?.id) {
      try {
        await clearUserData(user.id, ['seances','activities','sommeil','vfc','poids','objectifs']);
      } catch (err) {
        console.error('Erreur resetAll serveur:', err);
        alert('Erreur lors de la suppression côté serveur. Tes données locales restent intactes.');
        return;
      }
    }
    // 2. Vider côté local (l'auto-save garde-fou refusera de propager [], donc on est safe)
    setSeances([]); setActivites([]); setSommeil([]); setVfcData([]); setPoids([]); setObjectifs([]);
  };

  // ── Course state (ex-CourseLayout) ────────────────────────────────────────
  const [view,         setView]         = useState("accueil");
  const [raceRaw,      setRaceRaw]      = useState({});
  const [segmentsRaw,  setSegmentsRaw]  = useState([]);
  const [settingsRaw,  setSettingsRaw]  = useState({...EMPTY_SETTINGS});
  const [hasUnsaved,   setHasUnsaved]   = useState(false);
  const [autoSaved,    setAutoSaved]    = useState(false);
  const [courses,      setCourses]      = useState([]);
  const [sharedMode,   setSharedMode]   = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [reposModal,   setReposModal]   = useState(false);
  const [reposForm,    setReposForm]    = useState({label:"",startKm:"",dureeMin:20});
  const [installPrompt,setInstallPrompt]= useState(null);
  const [installDone,  setInstallDone]  = useState(false);

  // Features labels (Entrainement)
  const ENTRAINEMENT_FEATURE_LABELS=[
    {key:"programme",label:"Programme",icon:"↑",desc:"Planification des séances, suivi hebdomadaire"},
    {key:"activites",label:"Activités",icon:"▣",desc:"Historique activités Garmin importées"},
    {key:"forme",label:"Forme",icon:"♡",desc:"VFC, sommeil, poids, journal nutritionnel"},
    {key:"gut_training",label:"Gut Training",icon:"🍽️",desc:"Nutrition entraînement : produits, recettes, historique"},
    {key:"objectifs",label:"Objectifs",icon:"🏔",desc:"Courses cibles, planification compétitions"},
    {key:"journal",label:"Journal",icon:"✎",desc:"Mémoire émotionnelle : moments marquants, déclics, doutes"},
    {key:"coach",label:"Coach IA",icon:"✦",desc:"Conseils personnalisés basés sur tes données"},
  ];
  
  // Toggle Entrainement features → auto-save vers Supabase
  const toggleEntrainementFeature=key=>{
    setEntrainementFeatures(prev=>{
      const next={...prev,[key]:!prev[key]};
      if (user?.id) {
        saveEntrainementSettings(user.id, planningType, activityTypes, next, courseFeatures, profilType)
          .catch(err => console.error('Erreur save entrainement features:', err));
      }
      return next;
    });
  };
  
  // Features labels (Course)
  const FEATURE_LABELS=[
    {key:"profilDetail",label:"Profil détaillé",icon:"🗺️",desc:"Répartition rythme, calibration Garmin, FC"},
    {key:"nutrition",label:"Nutrition",icon:"🍌",desc:"Plan nutritionnel par ravito, bibliothèque produits"},
    {key:"equipement",label:"Équipement",icon:"🎒",desc:"Checklist, poids, préparation chronologique"},
    {key:"analyse",label:"Analyse",icon:"📊",desc:"Cohérence stratégie, autonomie nutritionnelle"},
    {key:"team",label:"Team",icon:"👥",desc:"Partage avec l'équipe d'assistance"},
    {key:"courses",label:"Mes courses",icon:"📚",desc:"Historique et sauvegarde des stratégies"},
  ];
  
  // Toggle Course features → auto-save vers Supabase
  const toggleFeature=key=>{
    setCourseFeatures(prev=>{
      const next={...prev,[key]:!prev[key]};
      if (user?.id) {
        saveEntrainementSettings(user.id, planningType, activityTypes, entrainementFeatures, next, profilType)
          .catch(err => console.error('Erreur save course features:', err));
      }
      return next;
    });
  };
  
  // Navigation Course filtrée selon features actives
  const NAVS_ACTIVE=COURSE_NAVS.filter(n=>{
    if(n.id==="nutrition")return courseFeatures.nutrition;
    if(n.id==="parametres")return courseFeatures.equipement;
    if(n.id==="analyse")return courseFeatures.analyse;
    if(n.id==="team")return courseFeatures.team;
    if(n.id==="courses")return courseFeatures.courses;
    return true;
  });

  const race=raceRaw; const segments=segmentsRaw; const settings=settingsRaw;
  const setRace=useCallback(upd=>{setRaceRaw(upd);setHasUnsaved(true);},[]);
  const setSegments=useCallback(upd=>{setSegmentsRaw(upd);setHasUnsaved(true);},[]);
  const setSettings=useCallback(upd=>{setSettingsRaw(upd);setHasUnsaved(true);},[]);

  const ua=navigator.userAgent;
  const isStandalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone;

  useEffect(()=>{
    const handler=e=>{e.preventDefault();setInstallPrompt(e);};
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  const handleInstall=async()=>{
    if(!installPrompt)return;
    installPrompt.prompt();
    const{outcome}=await installPrompt.userChoice;
    if(outcome==="accepted"){setInstallDone(true);setInstallPrompt(null);}
  };

  // Chargement initial
  useEffect(()=>{
    const urlParams=new URLSearchParams(window.location.search);
    let shared=urlParams.get("s");
    if(!shared&&window.location.hash.startsWith("#s="))shared=window.location.hash.slice(3);
    if(shared){
      const data=decodeStrategy(shared);
      if(data){
        if(data.race)setRaceRaw(data.race);
        if(data.segments)setSegmentsRaw(data.segments);
        if(data.settings)setSettingsRaw({...EMPTY_SETTINGS,...data.settings});
        setSharedMode(true);setView("team");
        if (user?.id) {
          saveCurrentRace(user.id, data.race, data.segments, {...EMPTY_SETTINGS,...data.settings})
            .catch(err => console.error('Erreur save stratégie partagée:', err));
        }
        window.history.replaceState({},"",window.location.pathname);
        return;
      }
    }
    if (user?.id) {
      loadCurrentRace(user.id).then(d=>{
        let migratedRace = null;
        if(d?.race && Object.keys(d.race).length > 0) {
          // MIGRATION : fusionner ancienne race.bibliotheque + dédoublonnage par nom (garde le plus récent)
          const oldBib = d.race.bibliotheque;
          const dedupByName = (items) => {
            const byName = new Map();
            items.forEach(it => {
              const key = (it.nom || '').trim().toLowerCase();
              if (!key) return;
              const existing = byName.get(key);
              // L'id étant un Date.now(), le plus grand = le plus récent
              if (!existing || (Number(it.id) || 0) > (Number(existing.id) || 0)) {
                byName.set(key, it);
              }
            });
            return Array.from(byName.values());
          };
          const needsBibMigration = oldBib && (oldBib.produits?.length || oldBib.recettes?.length);
          if (needsBibMigration) {
            // On capture les valeurs dédoublonnées dans des refs locaux pour un save unique
            let cleanedProduits = null;
            let cleanedRecettes = null;
            setProduits(prev => {
              const merged = [...prev, ...(oldBib.produits || []).filter(p => p.source !== 'default')];
              cleanedProduits = dedupByName(merged).map(p => ({ ...p, type: p.type || 'produit' }));
              return cleanedProduits;
            });
            setRecettes(prev => {
              const merged = [...prev, ...(oldBib.recettes || [])];
              cleanedRecettes = dedupByName(merged).map(r => ({ ...r, type: r.type || 'recette' }));
              return cleanedRecettes;
            });
            // Save unique pour persister la fusion dédoublonnée
            // setTimeout pour laisser React appliquer les setStates
            setTimeout(() => {
              if (cleanedProduits || cleanedRecettes) {
                saveNutrition(user.id, [], cleanedProduits || [], cleanedRecettes || [])
                  .catch(err => console.error('Erreur save nutrition migration:', err));
              }
            }, 0);
          }
          // On retire bibliotheque de race (la source de vérité = nutrition_data)
          const { bibliotheque, ...raceClean } = d.race;
          migratedRace = raceClean;
          setRaceRaw(raceClean);
        }
        if(d?.segments && d.segments.length > 0) setSegmentsRaw(d.segments);
        let migratedSettings = null;
        if(d?.settings && Object.keys(d.settings).length > 0) {
          const s = d.settings;
          const nutritionFields = ['kcalSource', 'kcalPerKm', 'kcalPerKmUphill', 'glucidesTargetGh'];
          setProfil(prev => {
            const updates = {};
            nutritionFields.forEach(k => {
              if (prev?.[k] == null && s[k] != null) updates[k] = s[k];
            });
            if (Object.keys(updates).length === 0) return prev;
            const merged = { ...prev, ...updates };
            saveAthleteProfile(user.id, merged).catch(err => console.error('Erreur migration profil:', err));
            return merged;
          });
          const { kcalSource, kcalPerKm, kcalPerKmUphill, glucidesTargetGh, ...settingsClean } = s;
          migratedSettings = { ...EMPTY_SETTINGS, ...settingsClean };
          setSettingsRaw(migratedSettings);
        }
        // Persiste current_race nettoyé (sans bibliotheque + sans champs nutrition profil)
        if (migratedRace || migratedSettings) {
          saveCurrentRace(user.id, migratedRace || d?.race || {}, d?.segments || [], migratedSettings || d?.settings || {})
            .catch(err => console.error('Erreur save current_race nettoyé:', err));
        }
      }).catch(err => console.error('Erreur load current race:', err));
      
      loadCourses(user.id).then(list=>setCourses(list.sort((a,b)=>b.savedAt-a.savedAt)))
        .catch(err => console.error('Erreur load courses:', err));
    }
  },[user?.id]);

  useEffect(()=>{
    if(!user?.id) return;
    if(!race && !segments.length) return;
    const timer=setTimeout(()=>{
      saveCurrentRace(user.id, race, segments, settings)
        .then(() => {setAutoSaved(true); setTimeout(()=>setAutoSaved(false),2000);})
        .catch(err => console.error('Erreur save current race:', err));
    },800);
    return()=>clearTimeout(timer);
  },[race,segments,settings,user?.id]);

  useEffect(()=>{
    if(settings.darkMode)document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  },[settings.darkMode]);

  const addRepos=()=>{
    if(!reposForm.label.trim()||!reposForm.dureeMin)return;
    const startKm=parseFloat(reposForm.startKm)||0;
    setSegments(s=>[...s,{id:Date.now(),type:"repos",label:reposForm.label,startKm,dureeMin:Number(reposForm.dureeMin),endKm:startKm,speedKmh:0,slopePct:0,terrain:"normal",notes:""}].sort((a,b)=>(a.startKm??0)-(b.startKm??0)));
    setReposModal(false);setReposForm({label:"",startKm:"",dureeMin:20});
  };

  const saveAllData=()=>{
    const payload={
      _version:"1.0", _date:new Date().toISOString(),
      // Entrainement
      seances, activites, sommeil, vfcData, poids, objectifs,
      planningType, activityTypes, journalNutri, produits, recettes, profil,
      // Course
      race, segments,
      settings:{...settings, equipment:undefined, garminStats:undefined},
    };
    const json=JSON.stringify(payload,null,2);
    const blob=new Blob([json],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`alex-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const loadData=file=>{
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const d=JSON.parse(e.target.result);
        if(d.race)setRaceRaw(d.race);
        if(d.segments)setSegmentsRaw(d.segments);
        if(d.settings){
          const merged={...EMPTY_SETTINGS,...d.settings};
          if(d.settings.equipment){
            const existingIds=new Set(d.settings.equipment.map(i=>i.id));
            const newItems=DEFAULT_EQUIPMENT.filter(i=>!existingIds.has(i.id));
            const upgraded=d.settings.equipment.map(i=>{const def=DEFAULT_EQUIPMENT.find(x=>x.id===i.id);return{...i,emporte:i.emporte!==undefined?i.emporte:(def?.emporte??true),poidsG:i.poidsG!==undefined?i.poidsG:(def?.poidsG??0)};});
            merged.equipment=[...upgraded,...newItems];
          }
          setSettingsRaw(merged);
        }
        setHasUnsaved(false);setView("profil_course");setDrawerOpen(false);
      }catch{alert("Fichier JSON invalide.");}
    };
    reader.readAsText(file);
  };

  const saveCourseFn=()=>{
    const id=crypto.randomUUID();
    const savedAt=Date.now();
    const segsCourse=segments.filter(s=>s.type!=="ravito"&&s.type!=="repos");
    const totalCourse=segsCourse.reduce((s,seg)=>s+(seg.endKm-seg.startKm)/seg.speedKmh*3600,0);
    const totalReposSec=segments.filter(s=>s.type==="repos").reduce((s,seg)=>s+(seg.dureeMin||0)*60,0);
    const totalRavitoSec=(race.ravitos?.length||0)*(settings.ravitoTimeMin||3)*60;
    const raceWithSnapshot={...race,depart:{...(race.depart||{}),produitsSnapshot:buildItemsSnapshot(race,produits,recettes)}};
    const entry={id,savedAt,name:settings.raceName||race.name||"Course sans nom",distance:race.totalDistance||0,elevPos:race.totalElevPos||0,segCount:segsCourse.length,startTime:settings.startTime||"07:00",totalTime:totalCourse+totalReposSec+totalRavitoSec,race:raceWithSnapshot,segments,settings};
    if (user?.id) {
      saveCourse(user.id, entry).catch(err => console.error('Erreur save course:', err));
    }
    setCourses(prev=>[entry,...prev]);
    return entry;
  };
  const loadCourseFn=entry=>{
    const ms={...EMPTY_SETTINGS,...(entry.settings||{}),produits:settings.produits||[],equipment:settings.equipment||DEFAULT_EQUIPMENT};
    setRaceRaw(entry.race||{});setSegmentsRaw(entry.segments||[]);setSettingsRaw(ms);
    if (user?.id) {
      saveCurrentRace(user.id, entry.race, entry.segments, ms).catch(err => console.error('Erreur save current race:', err));
    }
    setHasUnsaved(false);setView("profil_course");setDrawerOpen(false);
  };
  const deleteCourseFn=id=>{
    if (user?.id) {
      deleteCourse(user.id, id).catch(err => console.error('Erreur delete course:', err));
    }
    setCourses(prev=>prev.filter(c=>c.id!==id));
  };
  const updateCourseFn=(id,patch)=>setCourses(prev=>prev.map(c=>{
    if(c.id!==id)return c;
    const u={...c,...patch};
    if (user?.id) {
      saveCourse(user.id, u).catch(err => console.error('Erreur update course:', err));
    }
    return u;
  }));
  const overwriteCourseFn=id=>{
    const totalTime=segments.filter(s=>s.type!=="ravito"&&s.type!=="repos").reduce((s,seg)=>s+(seg.endKm-seg.startKm)/seg.speedKmh*3600,0);
    const raceWithSnapshot={...race,depart:{...(race.depart||{}),produitsSnapshot:buildItemsSnapshot(race,produits,recettes)}};
    setCourses(prev=>prev.map(c=>{
      if(c.id!==id)return c;
      const u={...c,name:settings.raceName||race.name||c.name,distance:race.totalDistance||0,elevPos:race.totalElevPos||0,segCount:segments.filter(s=>s.type!=="ravito"&&s.type!=="repos").length,startTime:settings.startTime||"07:00",totalTime,race:raceWithSnapshot,segments,settings,updatedAt:Date.now()};
      if (user?.id) {
        saveCourse(user.id, u).catch(err => console.error('Erreur overwrite course:', err));
      }
      return u;
    }));
  };

  const navigate=id=>{setView(id);setDrawerOpen(false);};
  const hasRace=!!race.gpxPoints?.length;

  // Auth guard
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>Chargement...</div>;
  // Afficher Login si pas connecté OU si on revient depuis un lien de réinitialisation
  // (dans ce cas, user existe via la session de recovery, mais on veut montrer le formulaire "nouveau mdp")
  if (!user || isRecovery) return <Login />;

  // Challenge 2FA : si l'utilisateur a enrôlé un facteur TOTP, il doit
  // saisir un code avant d'accéder à l'app (aal1 → aal2)
  if (!mfaCheckDone) {
    return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>Vérification…</div>;
  }
  if (mfaRequired) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F5F3EF', padding:'2rem', fontFamily:'DM Sans, sans-serif' }}>
        <div style={{ maxWidth:400, width:'100%', background:'#FFFFFF', padding:'2rem', borderRadius:12, border:'1px solid #DDD9D1' }}>
          {!mfaUseRecovery ? (
            <>
              <div style={{ fontSize:22, fontWeight:600, color:'#1C1916', marginBottom:8, fontFamily:"'Fraunces',serif" }}>Vérification en deux étapes</div>
              <div style={{ fontSize:13, color:'#7A7268', lineHeight:1.6, marginBottom:20 }}>
                Entre le code à 6 chiffres affiché dans ton application d'authentification.
              </div>
              <input
                type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus
                value={mfaChallengeCode}
                onChange={e => { setMfaChallengeCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setMfaChallengeError(""); }}
                onKeyDown={e => { if (e.key === "Enter" && !mfaChallengeLoading) submitMfaChallenge(); }}
                disabled={mfaChallengeLoading}
                placeholder="000000"
                style={{ width:'100%', padding:'12px 14px', borderRadius:8,
                  border:`1px solid ${mfaChallengeError ? '#B03A2A' : '#DDD9D1'}`, fontFamily:'monospace',
                  fontSize:22, letterSpacing:'0.3em', textAlign:'center', outline:'none', marginBottom:12, boxSizing:'border-box' }}
              />
              {mfaChallengeError && (
                <div style={{ fontSize:12, color:'#B03A2A', marginBottom:14, padding:'8px 12px', background:'#FAE9E7', borderRadius:8 }}>
                  {mfaChallengeError}
                </div>
              )}
              <button onClick={submitMfaChallenge} disabled={mfaChallengeLoading || mfaChallengeCode.length !== 6}
                style={{ width:'100%', padding:'11px 20px', background:'#2D5A3D', color:'#FFFFFF',
                  border:'none', borderRadius:8, fontSize:14, fontWeight:600,
                  cursor: (mfaChallengeLoading || mfaChallengeCode.length !== 6) ? 'not-allowed' : 'pointer',
                  opacity: (mfaChallengeLoading || mfaChallengeCode.length !== 6) ? 0.6 : 1,
                  fontFamily:'inherit', marginBottom:12 }}>
                {mfaChallengeLoading ? 'Vérification…' : 'Valider'}
              </button>
              <div style={{ textAlign:'center' }}>
                <button onClick={() => { setMfaUseRecovery(true); setMfaChallengeError(""); setMfaChallengeCode(""); }}
                  style={{ background:'transparent', border:'none', color:'#7A7268', fontSize:12,
                    cursor:'pointer', fontFamily:'inherit', textDecoration:'underline', marginBottom:8, display:'block', width:'100%' }}>
                  Je n'ai plus accès à mon application — utiliser un code de récupération
                </button>
                <button onClick={() => signOut()}
                  style={{ background:'transparent', border:'none', color:'#7A7268', fontSize:12,
                    cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>
                  Se déconnecter
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize:22, fontWeight:600, color:'#1C1916', marginBottom:8, fontFamily:"'Fraunces',serif" }}>Code de récupération</div>
              <div style={{ fontSize:13, color:'#7A7268', lineHeight:1.6, marginBottom:20 }}>
                Entre l'un de tes codes de récupération (format <span style={{ fontFamily:'monospace' }}>XXXX-XXXX</span>). La 2FA sera désactivée après utilisation.
              </div>
              <input
                type="text" autoFocus autoComplete="off" spellCheck={false}
                value={recoveryCode}
                onChange={e => { setRecoveryCode(e.target.value.toUpperCase()); setRecoveryError(""); }}
                onKeyDown={e => { if (e.key === "Enter" && !mfaChallengeLoading) submitRecoveryCode(); }}
                disabled={mfaChallengeLoading}
                placeholder="XXXX-XXXX"
                style={{ width:'100%', padding:'12px 14px', borderRadius:8,
                  border:`1px solid ${recoveryError ? '#B03A2A' : '#DDD9D1'}`, fontFamily:'monospace',
                  fontSize:18, letterSpacing:'0.15em', textAlign:'center', outline:'none', marginBottom:12, boxSizing:'border-box' }}
              />
              {recoveryError && (
                <div style={{ fontSize:12, color:'#B03A2A', marginBottom:14, padding:'8px 12px', background:'#FAE9E7', borderRadius:8 }}>
                  {recoveryError}
                </div>
              )}
              <button onClick={submitRecoveryCode} disabled={mfaChallengeLoading || !recoveryCode.trim()}
                style={{ width:'100%', padding:'11px 20px', background:'#2D5A3D', color:'#FFFFFF',
                  border:'none', borderRadius:8, fontSize:14, fontWeight:600,
                  cursor: (mfaChallengeLoading || !recoveryCode.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (mfaChallengeLoading || !recoveryCode.trim()) ? 0.6 : 1,
                  fontFamily:'inherit', marginBottom:12 }}>
                {mfaChallengeLoading ? 'Vérification…' : 'Accéder à mon compte'}
              </button>
              <div style={{ textAlign:'center' }}>
                <button onClick={() => { setMfaUseRecovery(false); setRecoveryError(""); setRecoveryCode(""); }}
                  style={{ background:'transparent', border:'none', color:'#7A7268', fontSize:12,
                    cursor:'pointer', fontFamily:'inherit', textDecoration:'underline', marginBottom:8, display:'block', width:'100%' }}>
                  Retour — utiliser mon application d'authentification
                </button>
                <button onClick={() => signOut()}
                  style={{ background:'transparent', border:'none', color:'#7A7268', fontSize:12,
                    cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>
                  Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Data load guard — bloque l'app tant que les données ne sont pas chargées
  // Si le chargement a échoué : écran d'erreur avec bouton Réessayer (empêche tout écrasement)
  if (loadError) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F5F3EF', padding:'2rem', fontFamily:'DM Sans, sans-serif' }}>
        <div style={{ maxWidth:480, textAlign:'center', background:'#FFFFFF', padding:'2rem', borderRadius:12, border:'1px solid #DDD9D1' }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#1C1916', marginBottom:12 }}>Impossible de charger tes données</div>
          <div style={{ fontSize:14, color:'#7A7268', lineHeight:1.5, marginBottom:20 }}>
            La connexion à la base de données a échoué. Tes données sont en sécurité — l'app est bloquée en écriture pour ne rien écraser. Vérifie ta connexion internet et réessaie.
          </div>
          <button
            onClick={() => { setLoadError(false); setLoadAttempt(a => a + 1); }}
            style={{ padding:'10px 20px', background:'#2D5A3D', color:'#FFFFFF', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
          >
            Réessayer
          </button>
          <div style={{ marginTop:16 }}>
            <button
              onClick={() => signOut()}
              style={{ padding:'6px 12px', background:'transparent', color:'#7A7268', border:'none', fontSize:12, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!dataLoaded) {
    return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>Chargement de tes données...</div>;
  }

  // ── Écran bloquant : conflit multi-sessions détecté ───────────────────────
  // Une autre session a modifié des données entre temps. On propose de
  // télécharger l'état local actuel (pour éviter de perdre les changements
  // non sauvegardés) avant de recharger la page.
  if (conflictDetected) {
    const downloadLocalSnapshot = () => {
      const snapshot = {
        format: "alex-conflict-snapshot-1.0",
        exportDate: new Date().toISOString(),
        userId: user.id,
        userEmail: user.email,
        note: "Snapshot local créé suite à un conflit multi-sessions. À réimporter manuellement après avoir fusionné avec les données de l'autre session.",
        profile: profil,
        activities: activites,
        seances,
        sommeil,
        vfc: vfcData,
        poids,
        objectifs,
        nutrition: { journalNutri, produits, recettes },
        settings: { planningType, activityTypes, entrainementFeatures, courseFeatures, profilType },
        currentRace: { race, segments, settings: settingsRaw },
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alex-conflict-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F5F3EF', padding:'2rem', fontFamily:'DM Sans, sans-serif' }}>
        <div style={{ maxWidth:520, background:'#FFFFFF', padding:'2rem', borderRadius:12, border:'1px solid #DDD9D1' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#B5860A', marginBottom:10 }}>⚠ Données modifiées ailleurs</div>
          <div style={{ fontSize:14, color:'#3D3830', lineHeight:1.6, marginBottom:20 }}>
            Tes données ont été modifiées depuis une autre session (un autre onglet, un autre appareil, ou une PWA). Pour éviter d'écraser des changements récents, l'enregistrement automatique est suspendu.
          </div>
          <div style={{ padding:'12px 14px', background:'#FDF6E3', border:'1px solid #B5860A40', borderRadius:10, marginBottom:20, fontSize:13, color:'#3D3830', lineHeight:1.6 }}>
            <strong>Avant de recharger :</strong> si tu as fait des modifications dans cette session que tu veux conserver, télécharge-les d'abord. Tu pourras les réimporter ensuite depuis <em>Données & Params → Import/Export</em>.
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button onClick={downloadLocalSnapshot}
              style={{ padding:'11px 20px', background:'#FFFFFF', color:'#7C5C3E', border:'1px solid #7C5C3E', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              💾 Télécharger cette session locale
            </button>
            <button onClick={() => window.location.reload()}
              style={{ padding:'11px 20px', background:'#2D5A3D', color:'#FFFFFF', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              🔄 Recharger et récupérer la version à jour
            </button>
          </div>
          <div style={{ marginTop:16, fontSize:11, color:'#7A7268', textAlign:'center' }}>
            Pourquoi cet écran ? Alex refuse d'écraser des données d'une session plus récente — c'est ce qui garantit qu'aucune donnée ne peut disparaître silencieusement.
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      seances={seances} setSeances={setSeances} activites={activites} setActivites={setActivites}
      sommeil={sommeil} setSommeil={setSommeil} vfcData={vfcData} setVfcData={setVfcData}
      poids={poids} setPoids={setPoids} objectifs={objectifs} setObjectifs={setObjectifs}
      planningType={planningType} setPlanningType={setPlanningType}
      activityTypes={activityTypes} setActivityTypes={setActivityTypes}
      journalNutri={journalNutri} setJournalNutri={setJournalNutri}
      journalMoments={journalMoments} setJournalMoments={setJournalMoments}
      produits={produits} setProduits={setProduits} recettes={recettes} setRecettes={setRecettes}
      allData={allData} loadEntrainementData={loadEntrainementData} resetAll={resetAll}
      profil={profil} setProfil={setProfil} confirmReset={confirmReset} setConfirmReset={setConfirmReset}
      isMobile={isMobile}
      view={view} setView={setView}
      race={race} setRace={setRace} segments={segments} setSegments={setSegments}
      settings={settings} setSettings={setSettings}
      hasUnsaved={hasUnsaved} autoSaved={autoSaved} courses={courses}
      drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}
      reposModal={reposModal} setReposModal={setReposModal}
      reposForm={reposForm} setReposForm={setReposForm} addRepos={addRepos}
      loadData={loadData}
      onSaveCourse={saveCourseFn} loadCourse={loadCourseFn}
      deleteCourse={deleteCourseFn} updateCourse={updateCourseFn} overwriteCourse={overwriteCourseFn}
      navigate={navigate} hasRace={hasRace}
      isStandalone={isStandalone} installDone={installDone}
      handleInstall={handleInstall}
      features={courseFeatures} toggleFeature={toggleFeature} FEATURE_LABELS={FEATURE_LABELS} NAVS_ACTIVE={NAVS_ACTIVE}
      entrainementFeatures={entrainementFeatures} toggleEntrainementFeature={toggleEntrainementFeature} ENTRAINEMENT_FEATURE_LABELS={ENTRAINEMENT_FEATURE_LABELS}
      profilType={profilType} setProfilType={setProfilType}
      saveAllData={saveAllData}
      sharedMode={sharedMode} installPrompt={installPrompt}
      signOut={signOut}
      user={user}
    />
  );
}
