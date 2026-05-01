// Export récap (page web + image) pour la course
import { fmtTime, fmtHeure, isNight } from './time.js';
import { calcNutrition } from './nutrition.js';

export function exportRecap(race, segments, settings, profile, passingTimes) {
  const raceName    = settings.raceName || race.name || "Ma Course";
  const raceDate    = settings.raceDate || "";
  const startTime   = settings.startTime || "07:00";
  const segsNormaux = segments.filter(s => s.type !== "ravito" && s.type !== "repos");
  const ravitos     = [...(race.ravitos || [])].sort((a, b) => a.km - b.km);
  const totalSec    = segsNormaux.reduce((s, seg) => s + (seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh * 3600 : 0), 0);
  const ravitoSec   = ravitos.reduce((s, rv) => s + ((rv.dureeMin || settings.ravitoTimeMin || 3) * 60), 0);
  const totalWithRavitos = totalSec + ravitoSec;
  const nutriTotals = segsNormaux.reduce((acc, seg) => {
    const n = calcNutrition(seg, settings);
    const dH = seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh : 0;
    return { kcal: acc.kcal + n.kcal, eau: acc.eau + Math.round(n.eauH * dH), glucides: acc.glucides + Math.round(n.glucidesH * dH), sel: acc.sel + Math.round(n.selH * dH) };
  }, { kcal: 0, eau: 0, glucides: 0, sel: 0 });

  // ─── Profil altimétrique SVG ─────────────────────────────────────────────
  const svgProfile = (() => {
    if (!profile.length) return "<p style=\"color:#888;font-size:12px;\">Profil non disponible</p>";
    const W = 700, H = 100;
    const minE = Math.min(...profile.map(p => p.ele));
    const maxE = Math.max(...profile.map(p => p.ele));
    const maxD = profile[profile.length - 1].dist;
    const px = d => (d / maxD) * W;
    const py = e => H - ((e - minE) / (maxE - minE + 1)) * (H - 10) - 4;
    const pts = profile.map(p => `${px(p.dist).toFixed(1)},${py(p.ele).toFixed(1)}`).join(" ");
    const fill = profile.map(p => `${px(p.dist).toFixed(1)},${py(p.ele).toFixed(1)}`).join(" ")
      + ` ${px(maxD).toFixed(1)},${H} 0,${H}`;

    const ravitoLines = ravitos.map(rv => {
      const x = px(rv.km).toFixed(1);
      return `<line x1="${x}" y1="2" x2="${x}" y2="${H}" stroke="#2D7A4F" stroke-width="1" stroke-dasharray="3,2"/>
              <text x="${(+x + 3).toFixed(1)}" y="12" font-size="9" fill="#2D7A4F" font-family="sans-serif">${rv.name.charAt(0)}</text>`;
    }).join("");

    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;margin:8px 0;">
      <polygon points="${fill}" fill="#9A6B4B22"/>
      <polyline points="${pts}" fill="none" stroke="#9A6B4B" stroke-width="2"/>
      ${ravitoLines}
    </svg>`;
  })();

  // ─── Lignes du tableau segments ──────────────────────────────────────────
  const ravitoSegs = segments.map((seg, i) => ({ seg, i })).filter(({ seg }) => seg.type === "ravito");
  const getTheoSec = ravitoId => {
    const e = ravitoSegs.find(({ seg }) => seg.ravitoId === ravitoId);
    return e ? passingTimes[e.i] : null;
  };
  const fmtH = sec => {
    if (!sec) return "--:--";
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  };

  let segNum = 0;
  const tableRows = segments.map((seg, i) => {
    const t = passingTimes[i];
    if (seg.type === "ravito") {
      const produits = settings.produits || [];
      const plan = (settings.planNutrition || {})[seg.ravitoId] || {};
      const prodLines = Object.entries(plan)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => {
          const p = produits.find(p => String(p.id) === String(id));
          if (!p) return "";
          const kcal = p.par100g ? Math.round(p.kcal * p.poids * q / 100) : Math.round(p.kcal * q);
          return `<span style="margin-right:16px;font-size:11px;color:#555;">${p.nom} <strong>×${q}</strong> — ${kcal} kcal</span>`;
        }).filter(Boolean).join("");
      return `
        <tr style="background:#F1F8F4;">
          <td style="padding:8px;font-size:16px;text-align:center;">🥤</td>
          <td colspan="4" style="padding:8px;font-weight:600;color:#2D7A4F;">${seg.label} · km ${seg.startKm}</td>
          <td style="padding:8px;text-align:right;font-weight:600;color:#2D7A4F;">${fmtH(t)}</td>
        </tr>
        ${prodLines ? `<tr style="background:#F9FBF9;"><td></td><td colspan="5" style="padding:4px 8px 8px 16px;">${prodLines}</td></tr>` : ""}`;
    }
    if (seg.type === "repos") {
      return `<tr style="background:#F5F5F5;">
        <td style="padding:8px;font-size:16px;text-align:center;">💤</td>
        <td colspan="4" style="padding:8px;color:#666;">${seg.label} — ${seg.dureeMin} min</td>
        <td style="padding:8px;text-align:right;color:#666;">${fmtH(t)}</td>
      </tr>`;
    }
    segNum++;
    const dist = (seg.endKm - seg.startKm).toFixed(1);
    const dur = (() => { const s = (seg.endKm - seg.startKm) / seg.speedKmh * 3600; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return `${h > 0 ? h+"h" : ""}${String(m).padStart(2,"0")}min`; })();
    const slopeColor = seg.slopePct > 9 ? "#C0392B" : seg.slopePct < -10 ? "#1565C0" : "#2E7D52";
    const slopeBg = seg.slopePct > 9 ? "#FDEDEC" : seg.slopePct < -10 ? "#E3F2FD" : "#E8F5E9";
    return `<tr style="border-bottom:0.5px solid #E0E0E0;">
      <td style="padding:7px 8px;color:#888;">${segNum}</td>
      <td style="padding:7px 8px;">${seg.startKm} → ${seg.endKm} km</td>
      <td style="padding:7px 8px;">${dist} km</td>
      <td style="padding:7px 8px;"><span style="background:${slopeBg};color:${slopeColor};border-radius:4px;padding:1px 6px;font-size:11px;">${seg.slopePct > 0 ? "+" : ""}${seg.slopePct}%</span>${seg.slopePct > 10 ? ' <span style="font-size:10px;color:#888;">marche</span>' : ""}</td>
      <td style="padding:7px 8px;font-weight:600;">${seg.speedKmh} km/h</td>
      <td style="padding:7px 8px;text-align:right;font-weight:600;color:#7A5230;">${fmtH(t)}</td>
    </tr>`;
  }).join("");

  // ─── Météo ───────────────────────────────────────────────────────────────
  const meteoStr = [
    `${settings.tempC}°C`,
    settings.rain ? "Pluie" : null,
    settings.snow ? "Neige" : null,
    settings.wind ? "Vent fort" : null,
  ].filter(Boolean).join(" · ");

  const objectifLabels = { comfort: "Finisher", normal: "Chrono", perf: "Performance" };

  // ─── HTML ────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${raceName} — Récap Alex</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; color: #1A1A1A; background: #fff; font-size: 13px; }
  .page { max-width: 780px; margin: 0 auto; padding: 32px 40px; }
  h1 { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #3D2B1F; }
  .sub { color: #666; font-size: 12px; margin-top: 4px; }
  .section-label { font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 8px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 20px 0; }
  .kpi { background: #F7F5F2; border-radius: 8px; padding: 10px 12px; text-align: center; }
  .kpi-label { font-size: 10px; color: #888; margin-bottom: 3px; }
  .kpi-val { font-size: 15px; font-weight: 500; }
  .profile-box { border: 0.5px solid #E0E0E0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { font-size: 10px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 0.5px solid #E0E0E0; text-align: left; }
  thead th:last-child { text-align: right; }
  .nutri-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #F7F5F2; border-radius: 8px; padding: 14px 16px; margin: 20px 0; }
  .nutri-item { text-align: center; }
  .nutri-label { font-size: 10px; color: #888; margin-bottom: 2px; }
  .nutri-val { font-size: 16px; font-weight: 500; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-box { background: #F7F5F2; border-radius: 8px; padding: 12px 16px; }
  .footer { border-top: 0.5px solid #E0E0E0; padding-top: 12px; margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
    .page { padding: 20px; }
    @page { margin: 1cm; size: A4; }
  }
</style>
</head><body>
<div class="page">
  <div class="no-print" style="background:#F0EAE0;border-radius:8px;padding:10px 16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:13px;color:#5A3E2B;font-weight:500;">Récap de course — Alex Trail Strategy</span>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#7A5230;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:500;">🖨️ Imprimer / PDF</button>
      <button id="btn-img" onclick="saveImage()" style="background:#fff;color:#7A5230;border:1px solid #7A5230;border-radius:8px;padding:8px 18px;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:500;">🖼️ Enregistrer image</button>
    </div>
  </div>
  <div id="recap-content">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:0.5px solid #E0E0E0;margin-bottom:20px;">
    <div>
      <div class="section-label">Stratégie de course · Alex</div>
      <h1>${raceName}</h1>
      <div class="sub">${raceDate ? new Date(raceDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""} ${raceDate && startTime ? "·" : ""} Départ ${startTime}${race.startAddress ? " · " + race.startAddress : ""}</div>
    </div>
    <div style="text-align:right;flex-shrink:0;margin-left:20px;">
      <div style="font-size:10px;color:#888;margin-bottom:2px;">Arrivée estimée</div>
      <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#7A5230;">${fmtH(passingTimes[passingTimes.length - 1] || 0)}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Distance</div><div class="kpi-val">${race.totalDistance?.toFixed(1) || "?"} km</div></div>
    <div class="kpi"><div class="kpi-label">D+</div><div class="kpi-val" style="color:#B84A3A;">${Math.round(race.totalElevPos || 0)} m</div></div>
    <div class="kpi"><div class="kpi-label">Temps total</div><div class="kpi-val">${fmtTime(totalWithRavitos)}</div></div>
    <div class="kpi"><div class="kpi-label">Segments</div><div class="kpi-val">${segsNormaux.length}</div></div>
    <div class="kpi"><div class="kpi-label">Ravitos</div><div class="kpi-val">${ravitos.length}</div></div>
  </div>

  <div class="profile-box">
    <div class="section-label">Profil altimétrique</div>
    ${svgProfile}
  </div>

  <div class="section-label" style="margin-bottom:10px;">Segments & ravitaillements</div>
  <table style="margin-bottom:20px;">
    <thead><tr>
      <th style="width:32px;">#</th>
      <th>Tronçon</th>
      <th>Dist.</th>
      <th>Pente</th>
      <th>Vitesse</th>
      <th style="text-align:right;">Heure</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="section-label">Bilan nutrition</div>
  <div class="nutri-grid">
    <div class="nutri-item"><div class="nutri-label">Calories</div><div class="nutri-val" style="color:#B84A3A;">${nutriTotals.kcal} kcal</div></div>
    <div class="nutri-item"><div class="nutri-label">Glucides</div><div class="nutri-val" style="color:#8B6914;">${nutriTotals.glucides} g</div></div>
    <div class="nutri-item"><div class="nutri-label">Sodium</div><div class="nutri-val">${nutriTotals.sel} mg</div></div>
    <div class="nutri-item"><div class="nutri-label">Eau estimée</div><div class="nutri-val" style="color:#1565C0;">${(nutriTotals.eau / 1000).toFixed(1)} L</div></div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="section-label">Météo prévue</div>
      <div style="font-size:16px;font-weight:500;margin-top:4px;">${meteoStr || "Non définie"}</div>
    </div>
    <div class="info-box">
      <div class="section-label">Objectif & rythme</div>
      <div style="font-size:15px;font-weight:500;margin-top:4px;">${objectifLabels[settings.effortTarget] || "Chrono"}</div>
      <div style="font-size:11px;color:#666;margin-top:2px;">Niveau ${(settings.runnerLevel || "intermediaire")} · Garmin ×${settings.garminCoeff || 1}</div>
    </div>
  </div>

  </div>

  <div class="footer" style="margin-top:0;">
    <span>Généré par Alex — Trail Running Strategy</span>
    <span>alex-trail.vercel.app</span>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script>
export function saveImage() {
  const btn = document.getElementById('btn-img');
  btn.textContent = '⏳ Génération...';
  btn.disabled = true;
  const target = document.getElementById('recap-content');
  html2canvas(target, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  }).then(canvas => {
    const a = document.createElement('a');
    a.download = '${(raceName).replace(/\s+/g, "-").toLowerCase()}-recap.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    btn.textContent = '🖼️ Enregistrer image';
    btn.disabled = false;
  }).catch(() => {
    btn.textContent = '🖼️ Enregistrer image';
    btn.disabled = false;
    alert('Erreur lors de la génération de l\\'image.');
  });
}
</script>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
