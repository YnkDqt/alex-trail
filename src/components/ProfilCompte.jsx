import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from '../AuthContext';
import {
  loadAthleteProfile, saveAthleteProfile,
  loadActivities, loadSeances, loadSommeil, loadVFC, loadPoids,
  loadObjectifs, loadNutrition, loadStrideSettings,
  loadCurrentRace, loadCourses,
} from '../supabaseHelpers';
import { C } from '../constants.js';

// ─── ProfilCompte ─────────────────────────────────────────────────────────────
// Page profil unifiée — lue par Stride ET Alex
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

export default function ProfilCompte({ profil = {}, setProfil, onClose }) {
  const { user, deleteAccount } = useAuth();
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
              loadStrideSettings(user.id),
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
        <button onClick={async () => {
          const confirm = window.confirm(
            "⚠️ ATTENTION\n\n" +
            "Cette action est IRRÉVERSIBLE.\n\n" +
            "Toutes tes données seront définitivement supprimées :\n" +
            "• Profil athlète\n" +
            "• Activités et séances\n" +
            "• Données de forme (VFC, sommeil, poids)\n" +
            "• Courses et stratégies\n" +
            "• Nutrition\n\n" +
            "Veux-tu vraiment supprimer ton compte ?"
          );
          
          if (!confirm) return;
          
          const doubleConfirm = window.prompt(
            "Pour confirmer, tape ton email :"
          );
          
          if (doubleConfirm !== user?.email) {
            alert("Email incorrect. Suppression annulée.");
            return;
          }

          try {
            const { error } = await deleteAccount();
            if (error) {
              console.error('Erreur suppression:', error);
              alert(`Erreur lors de la suppression : ${error.message || 'erreur inconnue'}`);
              return;
            }
            alert("Compte et données supprimés définitivement. Tu vas être déconnecté.");
          } catch (err) {
            console.error('Erreur suppression:', err);
            alert('Erreur lors de la suppression');
          }
        }}
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
    </div>
  );
}
