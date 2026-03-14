import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

// ─── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  bg:           "#F4F0EA",
  white:        "#FDFCFA",
  sand:         "#EDE8DF",
  sandDark:     "#DDD5C8",
  primary:      "#7C5C3E",
  primaryLight: "#9E7A58",
  primaryPale:  "#F0E8DC",
  primaryDeep:  "#4E3726",
  secondary:    "#5C7A5C",
  secondaryPale:"#E8F0E8",
  secondaryDark:"#3D5C3D",
  text:         "#2A2218",
  muted:        "#8C7B6A",
  border:       "#D8CEC0",
  green:        "#5C8C6A",  greenPale:  "#E6F2EA",
  yellow:       "#B8863A",  yellowPale: "#FBF3E2",
  red:          "#B84A3A",  redPale:    "#FBECEB",
  blue:         "#4A7A9B",  bluePale:   "#E8F2F8",
  dark:         "#1C1610",
  darkSurface:  "#2A211A",
  darkSurface2: "#362B22",
};

// ─── COMPOSANTS UI DE BASE ──────────────────────────────────────────────────
const Card = ({ children, style }) => (
  <div style={{
    background: "var(--surface)",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    border: "1px solid var(--border)",
    ...style
  }}>{children}</div>
);

const Btn = ({ children, onClick, variant="primary", style, icon }) => {
  const isSec = variant === "secondary";
  const isGhost = variant === "ghost";
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
      padding: "10px 18px", borderRadius: "10px", border: isGhost ? "none" : "1px solid transparent",
      cursor: "pointer", fontWeight: "600", fontSize: "0.95rem", transition: "all 0.2s ease",
      background: isSec ? "var(--secondary)" : isGhost ? "transparent" : "var(--primary)",
      color: isGhost ? "var(--primary)" : "#fff",
      ...style
    }}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};

const KPI = ({ label, value, unit, icon, color="var(--primary)" }) => (
  <div style={{ flex: 1, minWidth: "120px" }}>
    <div style={{ fontSize: "0.85rem", color: "var(--muted-c)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: "1.4rem", fontWeight: "800", color }}>
      {value}<span style={{ fontSize: "0.9rem", marginLeft: "2px", fontWeight: "500", opacity: 0.8 }}>{unit}</span>
    </div>
  </div>
);

// ─── HELPERS GPX ─────────────────────────────────────────────────────────────
function parseGPX(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const trkpts = Array.from(xml.querySelectorAll("trkpt"));
  
  let points = [];
  let totalDist = 0;
  let totalDPlus = 0;
  let totalDMinus = 0;

  const toRad = x => (x * Math.PI) / 180;
  const haversine = (p1, p2) => {
    const R = 6371e3;
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lon - p1.lon);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  trkpts.forEach((pt, i) => {
    const lat = parseFloat(pt.getAttribute("lat"));
    const lon = parseFloat(pt.getAttribute("lon"));
    const ele = parseFloat(pt.querySelector("ele")?.textContent || 0);
    
    if (i > 0) {
      const prev = points[i-1];
      totalDist += haversine(prev, {lat, lon});
      const diff = ele - prev.ele;
      if (diff > 0) totalDPlus += diff;
      else totalDMinus += Math.abs(diff);
    }
    points.push({ lat, lon, ele, dist: totalDist / 1000 });
  });

  return { points, totalDist: totalDist/1000, totalDPlus, totalDMinus };
}

// ─── VUE : PROFIL DE COURSE ──────────────────────────────────────────────────
const ProfilView = ({ race, setRace, segments, setSegments, settings }) => {
  const [dragActive, setDragActive] = useState(false);
  const [asInput, setAsInput] = useState({ name: "", km: "" });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = parseGPX(text);
    setRace({ ...race, ...data, gpxName: file.name });
    generateSegments(data.points);
  };

  const generateSegments = (pts) => {
    if (!pts || pts.length < 2) return;
    const step = 1.0; // 1km chunks
    let newSegs = [];
    let currentKm = 1;
    let lastIdx = 0;

    for (let i = 0; i < pts.length; i++) {
      if (pts[i].dist >= currentKm || i === pts.length - 1) {
        const slice = pts.slice(lastIdx, i + 1);
        const dPlus = slice.reduce((acc, p, j) => {
          if (j === 0) return acc;
          const diff = p.ele - slice[j-1].ele;
          return diff > 0 ? acc + diff : acc;
        }, 0);
        
        const dist = pts[i].dist - (pts[lastIdx]?.dist || 0);
        const slope = dist > 0 ? (dPlus / (dist * 1000)) * 100 : 0;

        newSegs.push({
          id: currentKm,
          label: `Km ${currentKm - 1} - ${Math.round(pts[i].dist)}`,
          dist,
          dPlus: Math.round(dPlus),
          slope,
          type: slope > 7 ? "walk" : "run"
        });
        lastIdx = i;
        currentKm++;
      }
    }
    setSegments(newSegs);
  };

  const addAidStation = () => {
    if (!asInput.name || !asInput.km) return;
    const newList = [...race.aidStations, { name: asInput.name, km: parseFloat(asInput.km) }]
      .sort((a,b) => a.km - b.km);
    setRace({ ...race, aidStations: newList });
    setAsInput({ name: "", km: "" });
  };

  const removeAidStation = (idx) => {
    const newList = race.aidStations.filter((_, i) => i !== idx);
    setRace({ ...race, aidStations: newList });
  };

  // Préparation des données pour Recharts
  const chartData = useMemo(() => {
    // On réduit la densité pour la perf si besoin
    return race.points.filter((_, i) => i % 10 === 0);
  }, [race.points]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header>
        <h1 style={{ fontSize: "1.8rem", fontWeight: "900", color: "var(--primary-deep)" }}>Profil de Course</h1>
        <p style={{ color: "var(--muted-c)" }}>Importez votre trace GPX et définissez vos points de ravitaillement.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        {/* IMPORT & STATS */}
        <Card>
          <div 
            onDragOver={(e)=>{e.preventDefault(); setDragActive(true)}}
            onDragLeave={()=>setDragActive(false)}
            onDrop={(e)=>{e.preventDefault(); setDragActive(false); onFile({target: {files: e.dataTransfer.files}})}}
            style={{
              border: `2px dashed ${dragActive ? "var(--primary)" : "var(--border)"}`,
              borderRadius: "12px", padding: "30px", textAlign: "center", cursor: "pointer",
              background: dragActive ? "var(--primary-pale)" : "transparent", transition: "all 0.2s"
            }}
            onClick={() => document.getElementById("gpx-up").click()}
          >
            <input id="gpx-up" type="file" accept=".gpx" hidden onChange={onFile} />
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>⛰️</div>
            <div style={{ fontWeight: "700", marginBottom: "4px" }}>
              {race.gpxName || "Cliquez ou glissez votre GPX"}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted-c)" }}>Format .gpx uniquement</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginTop: "24px" }}>
            <KPI label="Distance" value={race.totalDist.toFixed(1)} unit="km" icon="🏁" />
            <KPI label="Dénivelé +" value={Math.round(race.totalDPlus)} unit="m" icon="📈" color="var(--green)" />
            <KPI label="Dénivelé -" value={Math.round(race.totalDMinus)} unit="m" icon="📉" color="var(--red)" />
          </div>
        </Card>

        {/* RAVITAILLEMENTS */}
        <Card>
          <h3 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>🥤 Ravitaillements</h3>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <input 
              placeholder="Nom (ex: Arrivée)" 
              value={asInput.name} 
              onChange={e=>setAsInput({...asInput, name: e.target.value})}
              style={{ flex: 2, padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)" }}
            />
            <input 
              type="number" placeholder="km" 
              value={asInput.km} 
              onChange={e=>setAsInput({...asInput, km: e.target.value})}
              style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)" }}
            />
            <Btn onClick={addAidStation}>+</Btn>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {race.aidStations.length === 0 && <div style={{ textAlign: "center", padding: "20px", color: "var(--muted-c)", fontSize: "0.9rem", border: "1px dashed var(--border)", borderRadius: "8px" }}>Aucun ravitaillement ajouté</div>}
            {race.aidStations.map((as, idx) => (
              <div key={idx} style={{ 
                display: "flex", alignItems: "center", gap: "10px", background: "var(--sand)", 
                padding: "8px 12px", borderRadius: "8px",
                flexWrap: "wrap" // --- FIX : EMPÊCHE LE TEXTE D'ÊTRE COUPÉ ---
              }}>
                <div style={{ fontWeight: "700", color: "var(--primary-deep)", flex: "1 1 120px", wordBreak: "break-word" }}>{as.name}</div>
                <div style={{ fontSize: "0.85rem", background: "var(--white)", padding: "2px 8px", borderRadius: "4px" }}>km {as.km}</div>
                <button onClick={() => removeAidStation(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)" }}>✕</button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* --- GRAPHIQUE STICKY --- */}
      <Card style={{ padding: "0px", overflow: "visible" }}>
        <div style={{
          position: "sticky",
          top: "-10px",
          zIndex: 100,
          background: "var(--surface)",
          padding: "20px 20px 10px 20px",
          borderRadius: "16px 16px 0 0",
          borderBottom: "1px solid var(--border)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}>
          <h3 style={{ marginBottom: "12px" }}>Profil Altimétrique</h3>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="dist" hide />
                <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />
                <RTooltip 
                  contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}
                  formatter={(val) => [`${Math.round(val)}m`, "Altitude"]}
                  labelFormatter={(val) => `Dist: ${val.toFixed(1)} km`}
                />
                <Area type="monotone" dataKey="ele" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorEle)" />
                {race.aidStations.map((as, i) => (
                  <ReferenceLine key={i} x={as.km} stroke="var(--secondary)" strokeDasharray="3 3" label={{ value: as.name, position: 'top', fill: 'var(--secondary-dark)', fontSize: 10, fontWeight: 'bold' }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LISTE DES SEGMENTS */}
        <div style={{ padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            {segments.map((s, i) => (
              <div key={i} style={{
                padding: "12px", borderRadius: "10px", background: "var(--bg)", border: "1px solid var(--border)",
                display: "flex", flexDirection: "column", gap: "4px"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--muted-c)", textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: "800" }}>{s.dPlus} <span style={{ fontSize: "0.7rem" }}>mD+</span></div>
                  <div style={{ 
                    fontSize: "0.85rem", fontWeight: "700", 
                    color: s.slope > 10 ? "var(--red)" : s.slope > 5 ? "var(--yellow)" : "var(--green)"
                  }}>
                    {s.slope.toFixed(1)}%
                  </div>
                </div>
                <div style={{ 
                  marginTop: "4px", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "4px", width: "fit-content",
                  background: s.type === "walk" ? "var(--secondary-pale)" : "var(--primary-pale)",
                  color: s.type === "walk" ? "var(--secondary-dark)" : "var(--primary)"
                }}>
                  {s.type === "walk" ? "🚶 MARCHE" : "🏃 COURSE"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

// ─── VUE : STRATÉGIE ────────────────────────────────────────────────────────
const StrategieView = ({ race, segments, setSegments, settings, setSettings }) => {
  // Calcul du temps estimé total
  const totalMinutes = useMemo(() => {
    return segments.reduce((acc, s) => {
      const speed = s.type === "walk" ? settings.walkSpeed : settings.runSpeed;
      // Ajustement par pente (très simplifié) : -10% de vitesse par tranche de 5% de pente
      const penalty = Math.max(0, (s.slope / 5) * 0.1);
      const effectiveSpeed = speed * (1 - penalty);
      return acc + (s.dist / effectiveSpeed) * 60;
    }, 0);
  }, [segments, settings]);

  const formatTime = (totalMin) => {
    const h = Math.floor(totalMin / 60);
    const m = Math.round(totalMin % 60);
    return `${h}h${m.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header>
        <h1 style={{ fontSize: "1.8rem", fontWeight: "900", color: "var(--primary-deep)" }}>Stratégie d'effort</h1>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <Card>
            <h3 style={{ marginBottom: "20px" }}>Paramètres de vitesse</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "8px", fontWeight: "600" }}>Vitesse Course (plat) km/h</label>
                <input type="range" min="6" max="18" step="0.5" value={settings.runSpeed} onChange={e=>setSettings({...settings, runSpeed: parseFloat(e.target.value)})} style={{ width: "100%" }} />
                <div style={{ textAlign: "right", fontWeight: "700" }}>{settings.runSpeed} km/h</div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "8px", fontWeight: "600" }}>Vitesse Marche (pente) km/h</label>
                <input type="range" min="2" max="7" step="0.1" value={settings.walkSpeed} onChange={e=>setSettings({...settings, walkSpeed: parseFloat(e.target.value)})} style={{ width: "100%" }} />
                <div style={{ textAlign: "right", fontWeight: "700" }}>{settings.walkSpeed} km/h</div>
              </div>
            </div>
          </Card>

          <Card>
            <h3>Estimation du temps global</h3>
            <div style={{ fontSize: "3rem", fontWeight: "900", color: "var(--primary)", marginTop: "10px" }}>
              {formatTime(totalMinutes)}
            </div>
            <p style={{ color: "var(--muted-c)", fontSize: "0.9rem" }}>Basé sur vos allures et le profil GPX (pentes {">"} 7% en marche).</p>
          </Card>
        </div>

        <aside>
          <Card style={{ background: "var(--primary-deep)", color: "#fff" }}>
            <h4 style={{ marginBottom: "12px" }}>Conseil Coach</h4>
            <p style={{ fontSize: "0.9rem", opacity: 0.9, lineHeight: "1.5" }}>
              "N'oubliez pas que sur un ultra, la gestion de la chaleur peut réduire votre vitesse de 15% dès que la température dépasse 25°C."
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
};

// ─── VUE : NUTRITION ────────────────────────────────────────────────────────
const NutritionView = ({ segments, settings, race }) => {
  const needs = useMemo(() => {
    // Calcul arbitraire pour l'exemple
    const durationH = 10; // Devrait être lié à la stratégie
    return {
      kcal: durationH * 300,
      water: durationH * 0.6,
      carbs: durationH * 60
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header>
        <h1 style={{ fontSize: "1.8rem", fontWeight: "900", color: "var(--primary-deep)" }}>Plan Nutritionnel</h1>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
        <Card style={{ borderLeft: "5px solid var(--yellow)" }}>
          <KPI label="Total Calories" value={needs.kcal} unit="kcal" icon="🔋" color="var(--yellow)" />
        </Card>
        <Card style={{ borderLeft: "5px solid var(--blue)" }}>
          <KPI label="Eau Totale" value={needs.water.toFixed(1)} unit="L" icon="💧" color="var(--blue)" />
        </Card>
        <Card style={{ borderLeft: "5px solid var(--primary)" }}>
          <KPI label="Glucides" value={needs.carbs} unit="g" icon="🍞" color="var(--primary)" />
        </Card>
      </div>

      <Card>
        <h3>Répartition par ravitaillement</h3>
        <div style={{ marginTop: "16px" }}>
          {race.aidStations.map((as, i) => (
            <div key={i} style={{ padding: "12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "700" }}>{as.name} (km {as.km})</span>
              <span style={{ color: "var(--muted-c)" }}>Prévoir ~500ml eau + 1 barre</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── VUE : PARAMÈTRES ────────────────────────────────────────────────────────
const Paramètres = ({ settings, setSettings }) => (
  <Card>
    <h3>Réglages Profil</h3>
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
      <div>
        <label style={{ display: "block", marginBottom: "6px" }}>Poids du coureur (kg)</label>
        <input type="number" value={settings.weight} onChange={e=>setSettings({...settings, weight: e.target.value})} style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }} />
      </div>
    </div>
  </Card>
);

// ─── APP PRINCIPALE ──────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("profil");
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Données de l'app
  const [race, setRace] = useState({
    gpxName: "",
    points: [],
    totalDist: 0,
    totalDPlus: 0,
    totalDMinus: 0,
    aidStations: []
  });

  const [segments, setSegments] = useState([]);
  
  const [settings, setSettings] = useState({
    runSpeed: 10,
    walkSpeed: 4,
    weight: 70,
    temp: 20
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 850);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "24px 16px" }}>
      <div style={{ fontSize: "1.4rem", fontWeight: "900", color: "var(--primary)", marginBottom: "32px", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "2rem" }}>🏔️</span> TRAIL STRAT
      </div>
      
      {[
        { id: "profil", label: "Profil de course", icon: "⛰️" },
        { id: "preparation", label: "Stratégie", icon: "⚡" },
        { id: "nutrition", label: "Nutrition", icon: "🍕" },
        { id: "parametres", label: "Réglages", icon: "⚙️" },
      ].map(item => (
        <button 
          key={item.id}
          onClick={() => { setView(item.id); setDrawerOpen(false); }}
          style={{
            display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "12px",
            border: "none", cursor: "pointer", fontSize: "0.95rem", fontWeight: "600",
            transition: "all 0.2s",
            background: view === item.id ? "var(--primary-pale)" : "transparent",
            color: view === item.id ? "var(--primary-deep)" : "var(--muted-c)"
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ 
      display: "flex", height: "100vh", width: "100vw", overflow: "hidden", 
      background: "var(--bg)", color: "var(--text)", fontFamily: "'Inter', system-ui, sans-serif",
      "--primary": C.primary, "--primary-pale": C.primaryPale, "--primary-deep": C.primaryDeep,
      "--secondary": C.secondary, "--secondary-pale": C.secondaryPale, "--secondary-dark": C.secondaryDark,
      "--bg": C.bg, "--surface": C.white, "--border": C.border, "--muted-c": C.muted,
      "--red": C.red, "--green": C.green, "--yellow": C.yellow, "--blue": C.blue
    }}>
      {/* SIDEBAR DESKTOP */}
      {!isMobile && (
        <aside style={{ width: "280px", borderRight: "1px solid var(--border)", background: "var(--surface)" }}>
          <SidebarContent />
        </aside>
      )}

      {/* MOBILE HEADER */}
      {isMobile && (
        <div style={{ 
          position: "fixed", top: 0, left: 0, right: 0, height: "60px", background: "var(--surface)", 
          display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid var(--border)", zIndex: 1000 
        }}>
          <button onClick={() => setDrawerOpen(true)} style={{ background: "none", border: "none", fontSize: "1.5rem" }}>☰</button>
          <div style={{ marginLeft: "16px", fontWeight: "900", color: "var(--primary)" }}>TRAIL STRAT</div>
        </div>
      )}

      {/* DRAWER MOBILE */}
      {drawerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
          <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{
            position: "absolute", top: 0, left: 0, bottom: 0, width: 260,
            background: "var(--surface)", overflowY: "auto",
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
        {view === "profil"      && <ProfilView race={race} setRace={setRace} segments={segments} setSegments={setSegments} settings={settings} />}
        {view === "preparation" && <StrategieView race={race} segments={segments} setSegments={setSegments} settings={settings} setSettings={setSettings} />}
        {view === "nutrition"   && <NutritionView segments={segments} settings={settings} race={race} />}
        {view === "parametres"  && <Paramètres settings={settings} setSettings={setSettings} />}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        input:focus { outline: 2px solid var(--primary); outline-offset: 1px; }
      `}</style>
    </div>
  );
}