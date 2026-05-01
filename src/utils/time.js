// Formatage temps : fmtTime, fmtPace, fmtHeure, isNight
export function fmtTime(seconds) {
  if (!seconds || seconds <= 0) return "--:--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
export function fmtPace(speedKmh) {
  if (!speedKmh || speedKmh <= 0) return "--:--";
  const minPerKm = 60 / speedKmh;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2,"0")}`;
}
export function fmtHeure(sec) {
  const total = ((sec % 86400) + 86400) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
export function isNight(sec) {
  const h = Math.floor(((sec % 86400) + 86400) % 86400 / 3600);
  return h >= 21 || h < 6;
}
// ─── EXPORT GPX MONTRE ───────────────────────────────────────────────────────
