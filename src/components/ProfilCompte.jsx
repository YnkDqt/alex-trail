import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from '../AuthContext';
import { Modal, Btn } from '../atoms.jsx';
import {
  loadAthleteProfile, saveAthleteProfile,
  loadActivities, loadSeances, loadSommeil, loadVFC, loadPoids,
  loadObjectifs, loadNutrition, loadEntrainementSettings,
  loadCurrentRace, loadCourses,
} from '../supabaseHelpers';
import { C } from '../constants.js';

// ─── ProfilCompte ─────────────────────────────────────────────────────────────
// Page profil unifiée — lue par les sections Entraînement et Course
// Props : profil, setProfil, onClose (optionnel, si ouvert en overlay)
// Champs : prénom, sexe, dateNaissance, taille, poids référence,
//          fcRepos, fcMax, zonesFC (auto-Karvonen), alluresZ2/Z3
// Stockage : Supabase (table athlete_profile) via saveAthleteProfile
// ─────────────────────────────────────────────────────────────────────────────

// Karvonen : zone = fcRepos + (fcMax - fcRepos) * [lo, hi]
const KARVONEN_ZONES = [
  { z: "Z1", label: "Récupération",     lo: 0.50, hi: 0.60, color: "#4A82B0" },
  { z: "Z2", label: "Endurance de base",lo: 0.60, hi: 0.70, color: C.forestLight },
  { z: "Z3", label: "Tempo / Seuil bas",lo: 0.70, hi: 0.80, color: C.summit },
  { z: "Z4", label: "Seuil lactique",   lo: 0.80, hi: 0.90, color: "#C4521A" },
  { z: "Z5", label: "VO2max",           lo: 0.90, hi: 1.00, color: C.red },
];

function calcZones(fcRepos, fcMax) {
  const r = parseInt(fcRepos) || 0;
  const m = parseInt(fcMax)   || 0;
  if (!r || !m || m <= r) return null;
  const rr = m - r;
  return KARVONEN_ZONES.map(z => ({
    ...z,
    lo: Math.round(r + rr * z.lo),
    hi: Math.round(r + rr * z.hi),
  }));
}

function calcAge(dateNaissance) {
  if (!dateNaissance) return null;
  const diff = new Date() - new Date(dateNaissance);
  return Math.floor(diff / 31557600000);
}

// FC max théorique Tanaka (2001) = 208 - 0.7 × âge (meilleur que 220-âge)
function fcMaxTanaka(age) {
  if (!age) return null;
  return Math.round(208 - 0.7 * age);
}

const Field = ({ label, children, hint, full }) => (
  <div style={{ gridColumn: full ? "1/-1" : undefined }}>
    <label style={{ display:"block", fontSize:11, fontWeight:600, textTransform:"uppercase",
      letterSpacing:"0.06em", color:C.muted, marginBottom:5 }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize:11, color:C.stoneDeep, marginTop:4 }}>{hint}</div>}
  </div>
);

const inp = (extra={}) => ({
  fontFamily:"inherit", fontSize:14, color:C.ink,
  background:C.white, border:`1px solid ${C.border}`,
  borderRadius:8, padding:"8px 12px", width:"100%", outline:"none",
  ...extra,
});

const SectionTitle = ({ children }) => (
  <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.09em",
    color:C.muted, padding:"20px 0 10px", borderBottom:`1px solid ${C.stone}`, marginBottom:16 }}>
    {children}
  </div>
);

export default function ProfilCompte({ profil = {}, setProfil, settings = {}, setSettings, onClose }) {
  const { user, deleteAccount, updatePassword, mfaEnroll, mfaVerify, mfaVerifyChallenge, mfaUnenroll, mfaListFactors, mfaSaveRecoveryCodes, mfaUseRecoveryCode } = useAuth();
  const p = profil;

  // Load profil from Supabase on mount
  useEffect(() => {
    if (!user?.id) return;
    loadAthleteProfile(user.id).then(data => {
      if (data && Object.keys(data).length > 2) {
        setProfil(prev => ({ ...prev, ...data }));
      }
    }).catch(err => console.error('Erreur load profil:', err));
  }, [user?.id, setProfil]);

  const set = (k, v) => {
    const updated = { ...p, [k]: v };
    setProfil(prev => ({ ...prev, [k]: v }));

    // Auto-save to Supabase
    if (user?.id) {
      saveAthleteProfile(user.id, updated)
        .catch(err => console.error('Erreur save profil:', err));
    }
  };

  // Helper pour les settings (calibration nutritionnelle)
  const updS = (k, v) => setSettings && setSettings(s => ({ ...s, [k]: v }));

  const age  = useMemo(() => calcAge(p.dateNaissance), [p.dateNaissance]);
  const zones = useMemo(() => calcZones(p.fcRepos, p.fcMax), [p.fcRepos, p.fcMax]);
  const fcMaxSuggest = useMemo(() => fcMaxTanaka(age), [age]);

  // Pace helpers
  const paceToStr = (decMin) => {
    if (!decMin) return "";
    const m = Math.floor(decMin);
    const s = Math.round((decMin - m) * 60);
    return `${m}:${s.toString().padStart(2,"0")}`;
  };
  const strToPace = (str) => {
    const parts = str.split(":");
    if (parts.length !== 2) return null;
    const m = parseInt(parts[0]); const s = parseInt(parts[1]);
    if (isNaN(m) || isNaN(s)) return null;
    return m + s / 60;
  };

  const [z2Str, setZ2Str] = useState(paceToStr(p.allureZ2));
  const [z3Str, setZ3Str] = useState(paceToStr(p.allureZ3));

  // États de la modal de suppression de compte (RGPD)
  const [deleteStep, setDeleteStep] = useState(0); // 0=fermé, 1=avertissement, 2=confirmation email
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openDeleteFlow = () => { setDeleteStep(1); setDeleteEmail(""); setDeleteError(""); };
  const closeDeleteFlow = () => { if (deleteLoading) return; setDeleteStep(0); setDeleteEmail(""); setDeleteError(""); };

  const confirmDelete = async () => {
    if (deleteEmail.trim().toLowerCase() !== (user?.email || "").trim().toLowerCase()) {
      setDeleteError("Email incorrect.");
      return;
    }
    setDeleteError("");
    setDeleteLoading(true);
    try {
      const { error } = await deleteAccount();
      if (error) {
        setDeleteError(`Erreur : ${error.message || 'erreur inconnue'}`);
        setDeleteLoading(false);
        return;
      }
      // Succès : la déconnexion va déclencher un unmount, pas besoin de reset le state
    } catch (err) {
      console.error('Erreur suppression:', err);
      setDeleteError('Une erreur est survenue. Réessaie.');
      setDeleteLoading(false);
    }
  };

  // États de la modal de changement de mot de passe
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  // ── 2FA (MFA TOTP) ────────────────────────────────────────────────────────
  const [mfaFactors, setMfaFactors] = useState([]);    // facteurs vérifiés actifs
  const [mfaEnrollOpen, setMfaEnrollOpen] = useState(false);
  const [mfaStep, setMfaStep] = useState(1);           // 1 = QR, 2 = saisie code
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaQr, setMfaQr] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaConfirmUnenroll, setMfaConfirmUnenroll] = useState(null); // id du facteur à supprimer
  // Codes de récupération (affichage one-shot après enrôlement)
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [recoveryCodesOpen, setRecoveryCodesOpen] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  // Désactivation sécurisée : saisie code TOTP
  const [unenrollTotpCode, setUnenrollTotpCode] = useState("");
  const [unenrollTotpError, setUnenrollTotpError] = useState("");

  // Charger la liste des facteurs MFA au montage
  useEffect(() => {
    if (!user?.id) return;
    mfaListFactors().then(({ data }) => {
      if (data?.totp) setMfaFactors(data.totp);
    }).catch(err => console.error('Erreur listFactors:', err));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshFactors = async () => {
    const { data } = await mfaListFactors();
    setMfaFactors(data?.totp || []);
  };

  // Démarrer l'enrôlement : récupère QR code + secret
  const startMfaEnroll = async () => {
    setMfaError(""); setMfaCode(""); setMfaStep(1); setMfaEnrollOpen(true); setMfaLoading(true);
    const { data, error } = await mfaEnroll();
    setMfaLoading(false);
    if (error) {
      setMfaError(error.message || "Erreur lors de l'initialisation de la 2FA");
      return;
    }
    setMfaFactorId(data.id);
    setMfaQr(data.totp.qr_code);
    setMfaSecret(data.totp.secret);
    setMfaStep(1);
  };

  const cancelMfaEnroll = async () => {
    if (mfaLoading) return;
    // Si un facteur non vérifié a été créé, le nettoyer
    if (mfaFactorId) {
      try { await mfaUnenroll(mfaFactorId); } catch (e) { /* best-effort */ }
    }
    setMfaEnrollOpen(false);
    setMfaFactorId(""); setMfaQr(""); setMfaSecret(""); setMfaCode(""); setMfaError("");
  };

  const verifyMfaEnroll = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      setMfaError("Entre les 6 chiffres affichés dans ton application");
      return;
    }
    setMfaError(""); setMfaLoading(true);
    const { error } = await mfaVerify(mfaFactorId, mfaCode.trim());
    setMfaLoading(false);
    if (error) {
      setMfaError("Code incorrect. Vérifie l'heure de ton téléphone et réessaie.");
      return;
    }
    // Générer 3 codes de récupération
    const codes = Array.from({ length: 3 }, () => {
      const part = () => Math.random().toString(36).substring(2, 6).toUpperCase();
      return `${part()}-${part()}`;
    });
    // Sauvegarder les hash en base (non bloquant sur l'UI)
    mfaSaveRecoveryCodes(codes).catch(err => console.warn('Recovery codes save error:', err));
    // Afficher les codes (one-shot)
    setRecoveryCodes(codes);
    setRecoveryCodesOpen(true);
    // Fermer la modal d'enrôlement
    await refreshFactors();
    setMfaEnrollOpen(false);
    setMfaFactorId(""); setMfaQr(""); setMfaSecret(""); setMfaCode("");
  };

  const confirmMfaUnenroll = async () => {
    if (!mfaConfirmUnenroll) return;
    if (!unenrollTotpCode || unenrollTotpCode.length !== 6) {
      setUnenrollTotpError("Entre les 6 chiffres de ton application d'authentification");
      return;
    }
    setUnenrollTotpError(""); setMfaLoading(true);
    // Vérifier le code TOTP avant de désactiver
    const { error: verifyError } = await mfaVerifyChallenge(mfaConfirmUnenroll, unenrollTotpCode.trim());
    if (verifyError) {
      setMfaLoading(false);
      setUnenrollTotpError("Code incorrect. Réessaie.");
      return;
    }
    const { error } = await mfaUnenroll(mfaConfirmUnenroll);
    setMfaLoading(false);
    if (error) {
      setUnenrollTotpError("Erreur lors de la désactivation : " + error.message);
      return;
    }
    await refreshFactors();
    setMfaConfirmUnenroll(null);
    setUnenrollTotpCode(""); setUnenrollTotpError("");
  };

  const openPwdFlow = () => {
    setPwdOpen(true);
    setPwdCurrent(""); setPwdNew(""); setPwdConfirm("");
    setPwdError(""); setPwdSuccess(false);
  };
  const closePwdFlow = () => { if (pwdLoading) return; setPwdOpen(false); };

  const confirmPwdChange = async () => {
    if (!pwdCurrent || !pwdNew || !pwdConfirm) {
      setPwdError("Tous les champs sont requis."); return;
    }
    if (pwdNew.length < 8) {
      setPwdError("Le nouveau mot de passe doit faire au moins 8 caractères."); return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdError("Les deux mots de passe ne correspondent pas."); return;
    }
    if (pwdNew === pwdCurrent) {
      setPwdError("Le nouveau mot de passe doit être différent de l'actuel."); return;
    }
    setPwdError("");
    setPwdLoading(true);
    try {
      const { error } = await updatePassword(pwdCurrent, pwdNew);
      if (error) {
        setPwdError(error.message || "Erreur inconnue.");
        setPwdLoading(false);
        return;
      }
      setPwdSuccess(true);
      setPwdLoading(false);
      setPwdCurrent(""); setPwdNew(""); setPwdConfirm("");
    } catch (err) {
      console.error('Erreur updatePassword:', err);
      setPwdError("Une erreur est survenue. Réessaie.");
      setPwdLoading(false);
    }
  };

  const handlePaceBlur = (z, str, setStr) => {
    const val = strToPace(str);
    if (val !== null) {
      set(z === 2 ? "allureZ2" : "allureZ3", val);
      setStr(paceToStr(val));
    } else {
      setStr(paceToStr(p[z === 2 ? "allureZ2" : "allureZ3"]));
    }
  };

  const initials = p.prenom ? p.prenom.slice(0,2).toUpperCase() : "?";

  return (
    <div style={{ height:"100%", overflowY:"auto", background:C.bg }}>
      <div style={{ maxWidth:620, margin:"0 auto", padding:"32px 24px 60px" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:"50%", background:C.forest,
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontSize:18, fontWeight:700, flexShrink:0 }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:500,
              color:C.inkLight, margin:0, lineHeight:1.2 }}>
              {p.prenom || "Mon profil"}
            </h1>
            {age && <div style={{ fontSize:13, color:C.muted, marginTop:3 }}>{age} ans</div>}
          </div>
          {onClose && (
            <button onClick={onClose}
              style={{ marginLeft:"auto", background:"none", border:"none",
                cursor:"pointer", fontSize:22, color:C.stoneDeep, lineHeight:1 }}>×</button>
          )}
        </div>

        {/* ── Identité ─────────────────────────────────────── */}
        <SectionTitle>Identité</SectionTitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:8 }}>
          <Field label="Prénom" full>
            <input value={p.prenom||""} onChange={e=>set("prenom",e.target.value)}
              placeholder="Ton prénom" style={inp()}/>
          </Field>
          <Field label="Sexe">
            <div style={{ display:"flex", gap:6 }}>
              {["Homme","Femme"].map(s => (
                <button key={s} onClick={() => set("sexe", s)}
                  style={{ flex:1, padding:"8px 0", borderRadius:8, fontSize:13, fontWeight:500,
                    border:`1px solid ${(p.sexe||"Homme")===s ? C.forest : C.border}`,
                    background:(p.sexe||"Homme")===s ? C.forest : C.white,
                    color:(p.sexe||"Homme")===s ? "#fff" : C.muted,
                    cursor:"pointer", fontFamily:"inherit" }}>
                  {s}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Date de naissance" hint={age ? `${age} ans` : undefined}>
            <input type="date" value={p.dateNaissance||""} onChange={e=>set("dateNaissance",e.target.value)} style={inp()}/>
          </Field>
        </div>

        {/* ── Cardiaque ─────────────────────────────────────── */}
        <SectionTitle>Fréquence cardiaque</SectionTitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:8 }}>
          <Field label="FC repos" hint="Mesurée au réveil, au calme">
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <input type="number" min="30" max="100" value={p.fcRepos||""} onChange={e=>set("fcRepos",e.target.value)}
                placeholder="50" style={inp({width:90, textAlign:"right"})}/>
              <span style={{ fontSize:13, color:C.muted, flexShrink:0 }}>bpm</span>
            </div>
          </Field>
          <Field label="FC max"
            hint={fcMaxSuggest ? `Tanaka (2001) : ${fcMaxSuggest} bpm estimée` : "Formule Tanaka : 208 − 0.7 × âge"}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <input type="number" min="120" max="230" value={p.fcMax||""} onChange={e=>set("fcMax",e.target.value)}
                placeholder={fcMaxSuggest||"185"} style={inp({width:90, textAlign:"right"})}/>
              <span style={{ fontSize:13, color:C.muted, flexShrink:0 }}>bpm</span>
              {fcMaxSuggest && !p.fcMax && (
                <button onClick={() => set("fcMax", fcMaxSuggest)}
                  style={{ fontSize:11, padding:"4px 8px", borderRadius:6, background:C.forestPale,
                    color:C.forest, border:`1px solid ${C.forest}30`, cursor:"pointer",
                    fontFamily:"inherit", fontWeight:500, flexShrink:0 }}>
                  Utiliser
                </button>
              )}
            </div>
          </Field>
        </div>

        {/* Zones FC calculées → éditables */}
        {zones ? (
          <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10,
            overflow:"hidden", marginBottom:8 }}>
            <div style={{ padding:"10px 14px", background:C.stone, fontSize:11, fontWeight:600,
              textTransform:"uppercase", letterSpacing:"0.06em", color:C.muted }}>
              Zones FC — méthode Karvonen · modifiable manuellement
            </div>
            {zones.map(z => {
              const override = p.zonesFC?.find(zz => zz.z === z.z);
              const loVal = override?.lo ?? z.lo;
              const hiVal = override?.hi ?? z.hi;
              const updZone = (field, val) => {
                const current = p.zonesFC || zones.map(zz => ({ z: zz.z, lo: zz.lo, hi: zz.hi }));
                const updated = current.map(zz => zz.z === z.z ? { ...zz, [field]: parseInt(val) || zz[field] } : zz);
                set("zonesFC", updated);
              };
              return (
                <div key={z.z} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"8px 14px", borderTop:`1px solid ${C.stone}` }}>
                  <div style={{ width:24, height:24, borderRadius:6, background:z.color+"22",
                    border:`1px solid ${z.color}50`, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:10, fontWeight:700, color:z.color,
                    flexShrink:0 }}>{z.z}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:C.inkLight }}>{z.label}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <input type="number" min="30" max="230" value={loVal}
                      onChange={e => updZone("lo", e.target.value)}
                      style={{ width:50, fontSize:12, padding:"4px 6px", borderRadius:6,
                        border:`1px solid ${C.border}`, textAlign:"center",
                        fontFamily:"'DM Mono',monospace", fontWeight:500, color:C.inkLight }}/>
                    <span style={{ fontSize:11, color:C.muted }}>–</span>
                    <input type="number" min="30" max="230" value={hiVal}
                      onChange={e => updZone("hi", e.target.value)}
                      style={{ width:50, fontSize:12, padding:"4px 6px", borderRadius:6,
                        border:`1px solid ${C.border}`, textAlign:"center",
                        fontFamily:"'DM Mono',monospace", fontWeight:500, color:C.inkLight }}/>
                    <span style={{ fontSize:11, color:C.muted }}>bpm</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding:"12px 14px", background:C.stone, borderRadius:10,
            fontSize:13, color:C.stoneDeep, marginBottom:8 }}>
            Renseigne FC repos et FC max pour voir tes zones automatiquement.
          </div>
        )}

        {/* ── Allures ──────────────────────────────────────── */}
        <SectionTitle>Allures de référence</SectionTitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:8 }}>
          <Field label="Allure Z2" hint="Endurance — format MM:SS">
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <input value={z2Str} onChange={e=>setZ2Str(e.target.value)}
                onBlur={()=>handlePaceBlur(2, z2Str, setZ2Str)}
                placeholder="6:00" style={inp({width:90, textAlign:"right", fontFamily:"'DM Mono',monospace"})}/>
              <span style={{ fontSize:13, color:C.muted, flexShrink:0 }}>/km</span>
            </div>
          </Field>
          <Field label="Allure Z3" hint="Tempo / seuil bas — format MM:SS">
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <input value={z3Str} onChange={e=>setZ3Str(e.target.value)}
                onBlur={()=>handlePaceBlur(3, z3Str, setZ3Str)}
                placeholder="5:00" style={inp({width:90, textAlign:"right", fontFamily:"'DM Mono',monospace"})}/>
              <span style={{ fontSize:13, color:C.muted, flexShrink:0 }}>/km</span>
            </div>
          </Field>
        </div>
        {p.allureZ2 && p.allureZ3 && (
          <div style={{ padding:"10px 14px", background:C.forestPale, border:`1px solid ${C.forest}30`,
            borderRadius:10, fontSize:12, color:C.forest, marginBottom:8 }}>
            Z2 {paceToStr(p.allureZ2)} /km · Z3 {paceToStr(p.allureZ3)} /km
            {p.allureZ2 && p.allureZ3 && (
              <> · Vitesse Z2 ≈ {(60/p.allureZ2).toFixed(1)} km/h · Z3 ≈ {(60/p.allureZ3).toFixed(1)} km/h</>
            )}
          </div>
        )}

        {/* Calibration nutritionnelle */}
        <SectionTitle>Calibration nutritionnelle</SectionTitle>
        <div style={{ fontSize:12, color:C.muted, marginBottom:12, lineHeight:1.5 }}>
          Ces paramètres décrivent ta physiologie : dépense énergétique et capacité intestinale.
          Ils servent de base aux calculs de toutes tes courses. La stratégie course par course (hydratation, transport…) se règle dans Nutrition course.
        </div>

        {/* Source dépense kcal */}
        {(() => {
          const w = settings.weight || p.poids || 70;
          const minettiFlatKcal = Math.round(3.6 * w * 1000 / 4184);
          const gs = settings.garminStats;
          const src = p.kcalSource || "minetti";
          const SourceCard = ({ id, label, sub, flatVal, unavailable }) => {
            const active = src === id;
            return (
              <div onClick={() => !unavailable && set("kcalSource", id)} style={{
                flex: 1, minWidth: 0, borderRadius: 9, padding: "9px 10px",
                cursor: unavailable ? "default" : "pointer",
                border: `2px solid ${active ? C.forest : C.border}`,
                background: active ? C.forestPale : C.stone,
                opacity: unavailable ? 0.45 : 1, transition: "all 0.15s",
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: active ? C.forest : C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{sub}</div>
                {!unavailable ? (
                  <div style={{ fontSize: 12, fontWeight: 700, color: active ? C.forest : C.inkLight, fontFamily: "'Playfair Display', serif" }}>
                    {flatVal} <span style={{ fontSize: 10, fontWeight: 400, color: C.muted }}>kcal/km</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>Import requis</div>
                )}
                {active && !unavailable && <div style={{ fontSize: 10, color: C.forest, fontWeight: 600, marginTop: 2 }}>✓ Actif</div>}
              </div>
            );
          };
          return (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Source dépense kcal</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <SourceCard id="minetti" label="Minetti" sub="Formule scientifique" flatVal={minettiFlatKcal} />
                <SourceCard id="garmin" label="Garmin perso" sub={gs?.kcalActivityCount ? `${gs.kcalActivityCount} sorties` : "Import requis"} flatVal={gs?.kcalPerKmFlat} unavailable={!gs?.kcalPerKmFlat} />
                <SourceCard id="manual" label="Manuel" sub="Personnalisé" flatVal={p.kcalPerKm} />
              </div>
              {src === "manual" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "9px 10px", background: C.stone, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Plat (kcal/km)</div>
                    <input type="number" min={40} max={150} value={p.kcalPerKm || ""}
                      onChange={e => set("kcalPerKm", e.target.value === "" ? "" : +e.target.value)}
                      onBlur={e => set("kcalPerKm", Math.max(40, Math.min(150, +e.target.value || 65)))}
                      style={{ width: "100%" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Montée ≥5% (kcal/km)</div>
                    <input type="number" min={40} max={200} value={p.kcalPerKmUphill || ""}
                      onChange={e => set("kcalPerKmUphill", e.target.value === "" ? "" : +e.target.value)}
                      onBlur={e => set("kcalPerKmUphill", Math.max(40, Math.min(200, +e.target.value || 90)))}
                      style={{ width: "100%" }} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Capacité intestinale (glucides/h habituels) */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Capacité intestinale (glucides g/h)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.stone, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <input type="number" min={20} max={150} placeholder="Auto"
              value={p.glucidesTargetGh ?? ""}
              onChange={e => set("glucidesTargetGh", e.target.value === "" ? null : +e.target.value)}
              onBlur={e => { if (e.target.value !== "") set("glucidesTargetGh", Math.max(20, Math.min(150, +e.target.value))); }}
              style={{ width: 80 }} />
            <span style={{ fontSize: 11, color: C.muted }}>
              {p.glucidesTargetGh == null
                ? "Auto (55% des kcal)"
                : p.glucidesTargetGh <= 60 ? "Débutant"
                : p.glucidesTargetGh <= 90 ? "Entraîné"
                : "Gut training avancé"}
            </span>
            {p.glucidesTargetGh != null && (
              <button onClick={() => set("glucidesTargetGh", null)}
                style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, color: C.muted, cursor: "pointer", marginLeft: "auto" }}>
                Auto
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
            Ta capacité habituelle à absorber les glucides en course. Peut être ajustée course par course dans la stratégie nutrition.
            <br/><strong>Jeukendrup :</strong> absorption plafonnée à 60–90 g/h selon entraînement intestinal.
          </div>
        </div>

        {/* Sécurité */}
        <SectionTitle>Sécurité</SectionTitle>
        <button onClick={openPwdFlow}
          style={{ width:"100%", padding:"12px 20px", borderRadius:10, border:`1px solid ${C.border}`,
            background:C.white, color:C.inkLight, cursor:"pointer", fontFamily:"inherit",
            fontSize:14, fontWeight:500, marginBottom:8 }}>
          🔐 Changer mon mot de passe
        </button>
        <div style={{ fontSize:12, color:C.muted, marginBottom:20, lineHeight:1.6 }}>
          Minimum 8 caractères. Déconnecte tes autres appareils après modification.
        </div>

        {/* 2FA */}
        <div style={{ padding:"14px 16px", background:C.stone, borderRadius:10, marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:mfaFactors.length ? 10 : 0 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:C.inkLight, marginBottom:2 }}>
                🛡 Authentification à deux facteurs
                {mfaFactors.length > 0 && (
                  <span style={{ marginLeft:8, fontSize:11, background:C.greenPale, color:C.green,
                    padding:"2px 8px", borderRadius:10, fontWeight:600 }}>Activée</span>
                )}
              </div>
              <div style={{ fontSize:12, color:C.muted }}>
                {mfaFactors.length > 0
                  ? "Un code est demandé à chaque connexion"
                  : "Protection supplémentaire via une app comme Google Authenticator ou Authy"}
              </div>
            </div>
            {mfaFactors.length === 0 && (
              <button onClick={startMfaEnroll}
                style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${C.forest}`,
                  background:C.white, color:C.forest, cursor:"pointer", fontFamily:"inherit",
                  fontSize:12, fontWeight:600, whiteSpace:"nowrap" }}>
                Activer
              </button>
            )}
          </div>
          {mfaFactors.map(f => (
            <div key={f.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"8px 0", borderTop:`1px solid ${C.border}`, fontSize:12 }}>
              <div>
                <div style={{ color:C.inkLight, fontWeight:500 }}>{f.friendly_name || "Application authenticator"}</div>
                <div style={{ color:C.muted, fontSize:11 }}>Ajoutée le {new Date(f.created_at).toLocaleDateString('fr-FR')}</div>
              </div>
              <button onClick={() => setMfaConfirmUnenroll(f.id)}
                style={{ padding:"5px 10px", borderRadius:6, border:`1px solid ${C.red}40`,
                  background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit",
                  fontSize:11, fontWeight:500 }}>
                Désactiver
              </button>
            </div>
          ))}
        </div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:32, lineHeight:1.6 }}>
          Si tu perds accès à ton application authenticator, contacte le support pour réinitialiser ton compte.
        </div>

        {/* Export données RGPD */}
        <SectionTitle>Mes données</SectionTitle>
        <button onClick={async () => {
          if (!user?.id) return;
          try {
            // Charger toutes les données depuis Supabase
            const [profile, activities, seances, sommeil, vfc, poids, objectifs, nutrition, settings, currentRace, courses] = await Promise.all([
              loadAthleteProfile(user.id),
              loadActivities(user.id),
              loadSeances(user.id),
              loadSommeil(user.id),
              loadVFC(user.id),
              loadPoids(user.id),
              loadObjectifs(user.id),
              loadNutrition(user.id),
              loadEntrainementSettings(user.id),
              loadCurrentRace(user.id),
              loadCourses(user.id),
            ]);

            const exportData = {
              format: "alex-export-rgpd-1.0",
              exportDate: new Date().toISOString(),
              userId: user.id,
              userEmail: user.email,
              profile,
              activities,
              seances,
              sommeil,
              vfc,
              poids,
              objectifs,
              nutrition,
              settings,
              currentRace,
              courses,
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `alex-export-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          } catch (err) {
            console.error('Erreur export:', err);
            alert('Erreur lors de l\'export');
          }
        }}
          style={{ width:"100%", padding:"12px 20px", borderRadius:10, border:`1px solid ${C.forest}`,
            background:C.forestPale, color:C.forest, cursor:"pointer", fontFamily:"inherit",
            fontSize:14, fontWeight:500, marginBottom:16 }}>
          📥 Exporter toutes mes données
        </button>
        <div style={{ fontSize:12, color:C.muted, marginBottom:32, lineHeight:1.6 }}>
          Télécharge un fichier JSON contenant l'intégralité de tes données (profil, activités, courses, nutrition, etc.). Conforme RGPD.
        </div>

        {/* Suppression compte */}
        <button onClick={openDeleteFlow}
          style={{ width:"100%", padding:"12px 20px", borderRadius:10, border:`1px solid ${C.red}`,
            background:C.redPale, color:C.red, cursor:"pointer", fontFamily:"inherit",
            fontSize:14, fontWeight:500, marginBottom:8 }}>
          🗑️ Supprimer mon compte
        </button>
        <div style={{ fontSize:11, color:C.red, marginBottom:32, lineHeight:1.6 }}>
          Action irréversible. Toutes tes données seront définitivement effacées.
        </div>

        {/* Note bas de page */}
        <div style={{ marginTop:32, padding:"12px 14px", background:C.stone, borderRadius:10,
          fontSize:11, color:C.stoneDeep, lineHeight:1.6 }}>
          <strong>Poids et taille</strong> sont gérés dans <strong>Suivi corporel</strong> (Entraînement → Forme).<br/>
          Zones FC modifiables manuellement pour s'adapter à tes données Garmin/montre.<br/>
          Données stockées sur Supabase (région UE — Paris), chiffrées au repos et en transit.
        </div>

      </div>

      {/* Modal suppression compte (RGPD) */}
      <Modal
        open={deleteStep > 0}
        onClose={closeDeleteFlow}
        title={deleteStep === 1 ? "Supprimer ton compte" : "Confirmer la suppression"}
        subtitle={deleteStep === 1 ? "Action irréversible" : "Dernière étape avant suppression"}
        width={440}
      >
        {deleteStep === 1 && (
          <div>
            <div style={{ padding:14, background:C.redPale, border:`1px solid ${C.red}30`, borderRadius:10, marginBottom:16 }}>
              <div style={{ fontSize:13, color:C.red, fontWeight:600, marginBottom:8 }}>⚠️ Cette action est irréversible</div>
              <div style={{ fontSize:13, color:C.inkLight, lineHeight:1.6 }}>
                Toutes tes données seront définitivement supprimées de nos serveurs :
              </div>
            </div>
            <ul style={{ fontSize:13, color:C.inkLight, lineHeight:1.9, paddingLeft:18, marginBottom:20 }}>
              <li>Profil athlète et zones FC</li>
              <li>Activités, séances, programme d'entraînement</li>
              <li>Données de forme (VFC, sommeil, poids)</li>
              <li>Courses, stratégies et profils GPX</li>
              <li>Nutrition (produits, recettes, journal)</li>
            </ul>
            <div style={{ fontSize:12, color:C.muted, marginBottom:20, lineHeight:1.6 }}>
              Tu peux d'abord exporter tes données via le bouton « Exporter toutes mes données » si tu souhaites en garder une copie.
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={closeDeleteFlow}>Annuler</Btn>
              <Btn variant="danger" onClick={() => setDeleteStep(2)}>Continuer</Btn>
            </div>
          </div>
        )}

        {deleteStep === 2 && (
          <div>
            <div style={{ fontSize:13, color:C.inkLight, lineHeight:1.6, marginBottom:14 }}>
              Pour confirmer, tape ton adresse email :
            </div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:10, fontFamily:"monospace" }}>
              {user?.email || "—"}
            </div>
            <input
              type="email"
              autoFocus
              value={deleteEmail}
              onChange={e => { setDeleteEmail(e.target.value); setDeleteError(""); }}
              onKeyDown={e => { if (e.key === "Enter" && !deleteLoading) confirmDelete(); }}
              placeholder="ton@email.com"
              disabled={deleteLoading}
              style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                border:`1px solid ${deleteError ? C.red : C.border}`, fontFamily:"inherit",
                fontSize:14, marginBottom:deleteError ? 6 : 20, outline:"none" }}
            />
            {deleteError && (
              <div style={{ fontSize:12, color:C.red, marginBottom:14 }}>{deleteError}</div>
            )}
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={closeDeleteFlow} disabled={deleteLoading}>Annuler</Btn>
              <Btn variant="danger" onClick={confirmDelete} disabled={deleteLoading || !deleteEmail}>
                {deleteLoading ? "Suppression…" : "Supprimer définitivement"}
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal changement mot de passe */}
      <Modal
        open={pwdOpen}
        onClose={closePwdFlow}
        title={pwdSuccess ? "Mot de passe modifié" : "Changer mon mot de passe"}
        subtitle={pwdSuccess ? "C'est fait" : "Protège ton compte"}
        width={420}
      >
        {pwdSuccess ? (
          <div>
            <div style={{ padding:14, background:C.greenPale, border:`1px solid ${C.green}30`, borderRadius:10, marginBottom:20 }}>
              <div style={{ fontSize:13, color:C.green, fontWeight:600, marginBottom:6 }}>✓ Mot de passe mis à jour</div>
              <div style={{ fontSize:13, color:C.inkLight, lineHeight:1.6 }}>
                Utilise ton nouveau mot de passe lors de ta prochaine connexion.
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <Btn variant="primary" onClick={closePwdFlow}>Fermer</Btn>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
              <div>
                <label style={{ display:"block", fontSize:12, color:C.muted, marginBottom:6, fontWeight:500 }}>
                  Mot de passe actuel
                </label>
                <input
                  type="password"
                  autoFocus
                  value={pwdCurrent}
                  onChange={e => { setPwdCurrent(e.target.value); setPwdError(""); }}
                  disabled={pwdLoading}
                  style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                    border:`1px solid ${C.border}`, fontFamily:"inherit", fontSize:14, outline:"none" }}
                />
              </div>
              <div>
                <label style={{ display:"block", fontSize:12, color:C.muted, marginBottom:6, fontWeight:500 }}>
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={pwdNew}
                  onChange={e => { setPwdNew(e.target.value); setPwdError(""); }}
                  disabled={pwdLoading}
                  style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                    border:`1px solid ${C.border}`, fontFamily:"inherit", fontSize:14, outline:"none" }}
                />
              </div>
              <div>
                <label style={{ display:"block", fontSize:12, color:C.muted, marginBottom:6, fontWeight:500 }}>
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={pwdConfirm}
                  onChange={e => { setPwdConfirm(e.target.value); setPwdError(""); }}
                  onKeyDown={e => { if (e.key === "Enter" && !pwdLoading) confirmPwdChange(); }}
                  disabled={pwdLoading}
                  style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                    border:`1px solid ${C.border}`, fontFamily:"inherit", fontSize:14, outline:"none" }}
                />
              </div>
            </div>
            {pwdError && (
              <div style={{ fontSize:12, color:C.red, marginBottom:14, padding:"8px 12px",
                background:C.redPale, borderRadius:8 }}>
                {pwdError}
              </div>
            )}
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={closePwdFlow} disabled={pwdLoading}>Annuler</Btn>
              <Btn variant="primary" onClick={confirmPwdChange} disabled={pwdLoading || !pwdCurrent || !pwdNew || !pwdConfirm}>
                {pwdLoading ? "Enregistrement…" : "Valider"}
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal enrôlement 2FA */}
      <Modal
        open={mfaEnrollOpen}
        onClose={cancelMfaEnroll}
        title="Activer la 2FA"
        subtitle={mfaStep === 1 ? "Étape 1 sur 2 — Scanner le QR code" : "Étape 2 sur 2 — Vérification"}
        width={440}
      >
        {mfaLoading && !mfaQr ? (
          <div style={{ padding:40, textAlign:"center", color:C.muted }}>Chargement…</div>
        ) : (
          <div>
            <div style={{ fontSize:13, color:C.inkLight, lineHeight:1.6, marginBottom:16 }}>
              Utilise une application d'authentification comme <strong>Google Authenticator</strong>, <strong>Authy</strong> ou <strong>1Password</strong>.
            </div>

            {mfaQr && (
              <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10,
                padding:16, display:"flex", justifyContent:"center", marginBottom:14 }}>
                <img src={mfaQr} alt="QR code 2FA" style={{ width:200, height:200 }} />
              </div>
            )}

            {mfaSecret && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>
                  Ou saisis manuellement ce code dans ton app :
                </div>
                <div style={{ fontFamily:"monospace", fontSize:13, background:C.stone,
                  padding:"8px 12px", borderRadius:8, wordBreak:"break-all", color:C.inkLight }}>
                  {mfaSecret}
                </div>
              </div>
            )}

            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, color:C.muted, marginBottom:6, fontWeight:500 }}>
                Code à 6 chiffres affiché dans ton application
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={e => { setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setMfaError(""); }}
                onKeyDown={e => { if (e.key === "Enter" && !mfaLoading) verifyMfaEnroll(); }}
                disabled={mfaLoading}
                placeholder="000000"
                style={{ width:"100%", padding:"12px 14px", borderRadius:8,
                  border:`1px solid ${mfaError ? C.red : C.border}`, fontFamily:"monospace",
                  fontSize:20, letterSpacing:"0.3em", textAlign:"center", outline:"none" }}
              />
            </div>

            {mfaError && (
              <div style={{ fontSize:12, color:C.red, marginBottom:14, padding:"8px 12px",
                background:C.redPale, borderRadius:8 }}>
                {mfaError}
              </div>
            )}

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={cancelMfaEnroll} disabled={mfaLoading}>Annuler</Btn>
              <Btn variant="primary" onClick={verifyMfaEnroll} disabled={mfaLoading || mfaCode.length !== 6}>
                {mfaLoading ? "Vérification…" : "Activer"}
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal confirmation désactivation 2FA — sécurisée par code TOTP */}
      <Modal
        open={!!mfaConfirmUnenroll}
        onClose={() => { if (!mfaLoading) { setMfaConfirmUnenroll(null); setUnenrollTotpCode(""); setUnenrollTotpError(""); } }}
        title="Désactiver la 2FA ?"
        subtitle="Confirmation par code requis"
        width={420}
      >
        <div>
          <div style={{ padding:14, background:C.yellowPale, border:`1px solid ${C.yellow}40`,
            borderRadius:10, marginBottom:20, fontSize:13, color:C.inkLight, lineHeight:1.6 }}>
            ⚠ Pour confirmer la désactivation, entre le code à 6 chiffres de ton application d'authentification.
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"var(--muted-c)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Code de vérification</div>
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code"
              value={unenrollTotpCode}
              onChange={e => { setUnenrollTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setUnenrollTotpError(""); }}
              onKeyDown={e => { if (e.key === "Enter" && !mfaLoading) confirmMfaUnenroll(); }}
              placeholder="000000"
              disabled={mfaLoading}
              style={{ width:"100%", padding:"12px 14px", borderRadius:8,
                border:`1px solid ${unenrollTotpError ? C.red : C.border}`, fontFamily:"monospace",
                fontSize:20, letterSpacing:"0.3em", textAlign:"center", outline:"none", boxSizing:"border-box" }}
            />
            {unenrollTotpError && (
              <div style={{ fontSize:12, color:C.red, marginTop:8, padding:"8px 12px",
                background:C.redPale, borderRadius:8 }}>
                {unenrollTotpError}
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="ghost" onClick={() => { setMfaConfirmUnenroll(null); setUnenrollTotpCode(""); setUnenrollTotpError(""); }} disabled={mfaLoading}>Annuler</Btn>
            <Btn variant="danger" onClick={confirmMfaUnenroll} disabled={mfaLoading || unenrollTotpCode.length !== 6}>
              {mfaLoading ? "Vérification…" : "Désactiver"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal codes de récupération — one-shot après enrôlement 2FA */}
      <Modal
        open={recoveryCodesOpen}
        onClose={() => {}} // non fermable sans action explicite
        title="Codes de récupération"
        subtitle="À sauvegarder maintenant — ne seront plus affichés"
        width={480}
      >
        <div>
          <div style={{ padding:14, background:C.redPale, border:`1px solid ${C.red}40`,
            borderRadius:10, marginBottom:20, fontSize:13, color:C.red, lineHeight:1.6 }}>
            Ces codes te permettent d'accéder à ton compte si tu perds ton téléphone. Chaque code ne peut être utilisé qu'une seule fois. <strong>Copie-les maintenant</strong> — ils ne seront plus affichés.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:8, marginBottom:20 }}>
            {recoveryCodes.map((code, i) => (
              <div key={i} style={{
                padding:"8px 14px", background:"var(--surface-2)", borderRadius:8,
                fontFamily:"monospace", fontSize:15, letterSpacing:"0.1em",
                textAlign:"center", border:"1px solid var(--border-c)", color:"var(--text-c)"
              }}>
                {code}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="ghost" onClick={() => {
              const text = recoveryCodes.join("\n");
              const blob = new Blob([`Codes de récupération 2FA — Alex Trail\nGénérés le ${new Date().toLocaleDateString("fr-FR")}\n\n${text}\n\nChaque code est utilisable une seule fois.`], { type: "text/plain" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
              a.download = "alex-trail-recovery-codes.txt"; a.click();
            }}>Télécharger .txt</Btn>
            <Btn onClick={() => {
              navigator.clipboard.writeText(recoveryCodes.join("\n")).then(() => {
                setRecoveryCopied(true); setTimeout(() => setRecoveryCopied(false), 2000);
              });
            }}>{recoveryCopied ? "Copié !" : "Copier"}</Btn>
            <Btn variant="primary" onClick={() => { setRecoveryCodesOpen(false); setRecoveryCodes([]); }}>
              J'ai sauvegardé mes codes
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
