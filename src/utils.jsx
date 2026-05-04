// Barrel re-export — préserve la compatibilité des imports `from '../utils.jsx'`
// Les vrais modules sont dans ./utils/

export { fmtTime, fmtPace, fmtHeure, isNight } from './utils/time.js';
export { parseGarminCSV, computeStatsFromActivities } from './utils/csv.js';
export {
  parseGPX, enrichElevation, buildElevationProfile,
  suggestSpeed, calcSlopeFromGPX, autoSegmentGPX,
  exportGPXMontre, calcPassingTimes,
} from './utils/gpx.js';
export {
  calcNutrition, isRecette, calcKcalRecette,
  kcalDuStock, formatQuantiteStock,
} from './utils/nutrition.js';
export { exportRecap } from './utils/export.js';
