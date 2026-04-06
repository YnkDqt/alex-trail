import React, { useState, useMemo } from "react";

// ─── ProfilCompte ─────────────────────────────────────────────────────────────
// Page profil unifiée — lue par Stride ET Alex
// Props : profil, setProfil, onClose (optionnel, si ouvert en overlay)
// Champs : prénom, sexe, dateNaissance, taille, poids référence,
//          fcRepos, fcMax, zonesFC (auto-Karvonen), alluresZ2/Z3
// Stockage : dans le state parent (localStorage stride_v2 via lsWrite)
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:          "#F5F3EF",
  white:       "#FFFFFF",
  stone:       "#EAE6DF",
  stoneDark:   "#D4CEC4",
  stoneDeep:   "#9A9189",
  ink:         "#1C1916",
  inkLight:    "#3D3830",
  muted:       "#7A7268",
  border:      "#DDD9D1",
  forest:      "#2D5A3D",
  forestLight: "#4A8C5C",
  forestPale:  "#E8F2EC",
  summit:      "#C4521A",
  summitPale:  "#FAF0E8",
  green:       "#2D7A4A",
  greenPale:   "#E6F4EC",
  red:         "#B03A2A",
  redPale:     "#FAE9E7",
};

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
  const p = profil;

  const set = (k, v) => setProfil(prev => ({ ...prev, [k]: v }));

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
          <Field label="Taille" hint="Utilisée pour le calcul %MG (Navy)">
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <input type="number" min="140" max="220" value={p.taille||""} onChange={e=>set("taille",parseInt(e.target.value)||"")}
                placeholder="180" style={inp({width:90, textAlign:"right"})}/>
              <span style={{ fontSize:13, color:C.muted, flexShrink:0 }}>cm</span>
            </div>
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

        {/* Zones FC calculées */}
        {zones ? (
          <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10,
            overflow:"hidden", marginBottom:8 }}>
            <div style={{ padding:"10px 14px", background:C.stone, fontSize:11, fontWeight:600,
              textTransform:"uppercase", letterSpacing:"0.06em", color:C.muted }}>
              Zones FC calculées — méthode Karvonen
            </div>
            {zones.map(z => {
              const pct = Math.round(((z.lo + z.hi) / 2 - parseInt(p.fcRepos)) / (parseInt(p.fcMax) - parseInt(p.fcRepos)) * 100);
              return (
                <div key={z.z} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"8px 14px", borderTop:`1px solid ${C.stone}` }}>
                  <div style={{ width:24, height:24, borderRadius:6, background:z.color+"22",
                    border:`1px solid ${z.color}50`, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:10, fontWeight:700, color:z.color,
                    flexShrink:0 }}>{z.z}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:C.inkLight }}>{z.label}</div>
                    <div style={{ height:4, borderRadius:2, background:C.stone, marginTop:3 }}>
                      <div style={{ height:"100%", borderRadius:2, background:z.color,
                        width:`${pct}%`, transition:"width 0.3s" }}/>
                    </div>
                  </div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:500,
                    color:C.inkLight, flexShrink:0 }}>
                    {z.lo}–{z.hi} <span style={{ fontSize:11, color:C.muted }}>bpm</span>
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

        {/* Note bas de page */}
        <div style={{ marginTop:32, padding:"12px 14px", background:C.stone, borderRadius:10,
          fontSize:11, color:C.stoneDeep, lineHeight:1.6 }}>
          Ces données sont partagées entre Stride et Alex. Elles servent au calcul du %MG (Navy U.S.),
          aux zones FC (Karvonen), et à la calibration des allures dans la stratégie de course.
          Migration Supabase prévue — pour l'instant stockées localement.
        </div>

      </div>
    </div>
  );
}
