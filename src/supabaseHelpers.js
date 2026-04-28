import { supabase } from './supabaseClient'

// ─── HELPERS ──────────────────────────────────────────────────────────────────
// Convertir virgule → point, enlever points de milliers, string → number
const cleanNumber = (val) => {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return val
  
  let str = String(val).trim()
  const original = str
  
  // Si contient virgule ET point → point = milliers, virgule = décimal (ex: "1.234,56" format EU)
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.')
  }
  // Si contient seulement virgule
  else if (str.includes(',')) {
    // Si virgule suivie de 3 chiffres exactement → milliers (ex: "1,315" format US)
    if (/^\d+,\d{3}$/.test(str)) {
      str = str.replace(',', '')
    }
    // Sinon → décimal (ex: "12,64" format EU)
    else {
      str = str.replace(',', '.')
    }
  }
  // Si contient seulement point
  else if (str.includes('.')) {
    // Si point suivi de 3 chiffres exactement ET rien après → milliers (ex: "1.000" format EU)
    if (/^\d+\.\d{3}$/.test(str)) {
      str = str.replace('.', '')
    }
    // Sinon → décimal (ex: "12.64" format US)
    // On ne touche pas
  }
  
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

// Convertir number pour zones (préserver 0)
const cleanZone = (val) => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const num = parseFloat(String(val).replace(',', '.'))
  return isNaN(num) ? 0 : num
}

// Convertir string vide → null, gérer points de milliers
const cleanInt = (val) => {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Math.round(val)
  // Enlever points de milliers, remplacer virgule par point
  let str = String(val).replace(/\./g, '').replace(',', '.')
  const num = parseFloat(str)
  return isNaN(num) ? null : Math.round(num)
}

// Convertir HH:MM:SS → minutes
const convertDuration = (val) => {
  if (!val || val === '') return null
  if (typeof val === 'number') return val
  const str = String(val)
  // Format HH:MM:SS
  if (str.includes(':')) {
    const parts = str.split(':')
    const hours = parseInt(parts[0]) || 0
    const minutes = parseInt(parts[1]) || 0
    const seconds = parseInt(parts[2]) || 0
    return hours * 60 + minutes + Math.round(seconds / 60)
  }
  return cleanInt(val)
}

// Dédup défensive côté load : garde la ligne la plus récente par clé.
// Filet de sécurité au cas où des doublons subsistent en BDD malgré safeReplace.
// Tri par updated_at desc (fallback sur id desc) puis on garde le 1er occurrence par clé.
const dedupBy = (rows, keyFn) => {
  const sorted = [...rows].sort((a, b) => {
    const ua = a.updated_at ? new Date(a.updated_at).getTime() : 0
    const ub = b.updated_at ? new Date(b.updated_at).getTime() : 0
    if (ua !== ub) return ub - ua
    return (b.id || 0) - (a.id || 0)
  })
  const seen = new Set()
  const out = []
  for (const row of sorted) {
    const key = keyFn(row)
    if (key == null || seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

// ─── SAFE REPLACE : pattern DELETE-puis-INSERT, atomique côté UX ─────────────
// Pattern utilisé pour les tables time-series où on remplace tout le set d'un user.
//
// Pourquoi DELETE-puis-INSERT et pas l'inverse :
//  - L'ancien pattern (INSERT-batch-puis-DELETE-anciens) laissait des doublons en BDD
//    si le DELETE échouait silencieusement (RLS, timeout, OR mal résolu).
//  - À chaque session, le `load` lisait ancien+nouveau → l'utilisateur voyait ses
//    données dupliquées. Au save suivant, les doublons étaient ré-insérés → cumul.
//  - DELETE-puis-INSERT est plus simple : si INSERT plante, on a perdu la session
//    courante mais le load suivant retournera 0 ligne (état cohérent, pas de pollution).
//
// Sécurité :
//  1. Garde-fou : refuse si rows vide (sauf allowEmpty=true)
//  2. DELETE de toutes les lignes du user
//  3. INSERT du nouveau set
//  4. Si INSERT plante après DELETE : on log, l'utilisateur peut re-tenter au save suivant
async function safeReplace(table, userId, rows, { allowEmpty = false } = {}) {
  if (!userId) throw new Error(`safeReplace[${table}] : userId manquant`)
  
  // Couche 1 : garde-fou anti-zéro
  if (!Array.isArray(rows)) {
    console.warn(`[safeReplace ${table}] rows n'est pas un array, abort`)
    return
  }
  if (rows.length === 0) {
    if (allowEmpty) {
      return clearTable(table, userId)
    }
    console.warn(`[safeReplace ${table}] rows vide sans allowEmpty → abort (protection)`)
    return
  }
  
  // Couche 2 : DELETE de tout le set existant du user
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq('user_id', userId)
  
  if (deleteError) {
    console.error(`[safeReplace ${table}] DELETE échec, abort INSERT:`, deleteError)
    throw deleteError
  }
  
  // Couche 3 : INSERT du nouveau set
  const { error: insertError } = await supabase.from(table).insert(rows)
  if (insertError) {
    console.error(`[safeReplace ${table}] INSERT échec après DELETE, données perdues pour cette session:`, insertError)
    throw insertError
  }
}

// Reset explicite d'une table pour un user (à utiliser uniquement par resetAll / clearUserData)
async function clearTable(table, userId) {
  const { error } = await supabase.from(table).delete().eq('user_id', userId)
  if (error) throw error
}

// Reset explicite multi-tables — utilisée par resetAll côté UI
export async function clearUserData(userId, tables) {
  if (!userId) throw new Error('clearUserData : userId manquant')
  if (!Array.isArray(tables) || tables.length === 0) return
  
  // Reset séquentiel pour avoir des erreurs lisibles
  for (const t of tables) {
    try {
      await clearTable(t, userId)
    } catch (err) {
      console.error(`[clearUserData] échec reset ${t}:`, err)
      throw err
    }
  }
}

// ─── ATHLETE PROFILE ──────────────────────────────────────────────────────────
export async function loadAthleteProfile(userId) {
  const { data, error } = await supabase
    .from('athlete_profile')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  
  if (data) {
    return {
      prenom: data.name,
      dateNaissance: data.birth_date,
      poids: data.weight,
      sexe: data.gender,
      taille: data.taille,
      vma: data.vma,
      fcMax: data.fc_max,
      fcRepos: data.fc_repos,
      zonesFC: data.zones_fc,
      allureZ2: data.allure_z2,
      allureZ3: data.allure_z3,
      // Nutrition profil (par défaut, surchargeable par course)
      kcalSource: data.kcal_source,
      kcalPerKm: data.kcal_per_km,
      kcalPerKmUphill: data.kcal_per_km_uphill,
      glucidesTargetGh: data.glucides_target_gh
    }
  }
  
  return { sexe: 'Homme', taille: 180 }
}

export async function saveAthleteProfile(userId, profil) {
  const { error } = await supabase
    .from('athlete_profile')
    .upsert({ 
      user_id: userId, 
      name: profil.prenom,
      birth_date: profil.dateNaissance,
      weight: cleanNumber(profil.poids),
      gender: profil.sexe,
      taille: cleanInt(profil.taille),
      vma: cleanNumber(profil.vma),
      fc_max: cleanInt(profil.fcMax),
      fc_repos: cleanInt(profil.fcRepos),
      zones_fc: profil.zonesFC || null,
      allure_z2: cleanNumber(profil.allureZ2),
      allure_z3: cleanNumber(profil.allureZ3),
      kcal_source: profil.kcalSource || null,
      kcal_per_km: cleanNumber(profil.kcalPerKm),
      kcal_per_km_uphill: cleanNumber(profil.kcalPerKmUphill),
      glucides_target_gh: cleanNumber(profil.glucidesTargetGh),
      updated_at: new Date().toISOString()
    }, { 
      onConflict: 'user_id'
    })
  
  if (error) throw error
}

// ─── SEANCES ──────────────────────────────────────────────────────────────────
export async function loadSeances(userId) {
  const { data, error } = await supabase
    .from('seances')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  
  if (error) throw error
  
  return (data || []).map(s => ({
    id: s.id,
    date: s.date,
    demiJournee: s.demi_journee,
    activite: s.activite,
    statut: s.statut,
    commentaire: s.notes,
    dureeObj: s.duree_obj,
    kmObj: s.distance_obj,
    dpObj: s.dp_obj,
    ...(s.data || {})
  }))
}

export async function saveSeances(userId, seances) {
  if (!Array.isArray(seances)) return
  const rows = seances.map(s => ({
    user_id: userId,
    date: s.date,
    demi_journee: s.demiJournee,
    activite: s.activite,
    statut: s.statut,
    notes: s.commentaire || s.notes,
    duree_obj: s.dureeObj,
    distance_obj: cleanNumber(s.kmObj),
    dp_obj: cleanNumber(s.dpObj),
    data: s,
    updated_at: new Date().toISOString()
  }))
  await safeReplace('seances', userId, rows)
}

// ─── ACTIVITIES ───────────────────────────────────────────────────────────────
export async function loadActivities(userId) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  
  if (error) throw error
  
  return (data || []).map(a => ({
    id: a.id,
    date: a.date,
    dateHeure: a.date_heure || a.id_garmin,
    type: a.type,
    statut: a.statut,
    titre: a.titre,
    distance: a.distance,
    duree: a.duration_str,
    dureeMin: a.duration,
    dp: a.elevation,
    fcMoy: a.fc_moy,
    fcMax: a.fc_max,
    calories: a.calories,
    allure: a.allure,
    gapMoy: a.gap_moy,
    cadence: a.cadence,
    bodyBattery: a.body_battery,
    tss: a.tss,
    teAero: a.te_aero,
    z0: a.z0 != null ? a.z0 : 0,
    z1: a.z1 != null ? a.z1 : 0,
    z2: a.z2 != null ? a.z2 : 0,
    z3: a.z3 != null ? a.z3 : 0,
    z4: a.z4 != null ? a.z4 : 0,
    z5: a.z5 != null ? a.z5 : 0,
    notes: a.notes,
    gpxData: a.gpx_data,
    // Alias pour compatibilité
    kmGarmin: a.distance,
    dpGarmin: a.elevation,
    idGarmin: a.date_heure || a.id_garmin
  }))
}

export async function saveActivities(userId, activities) {
  if (!Array.isArray(activities)) return
  const rows = activities.map(a => ({
    user_id: userId,
    date: a.date,
    date_heure: a.dateHeure || a.idGarmin || a._garminId,
    type: a.type || a.activite,
    statut: a.statut,
    id_garmin: a.dateHeure || a.idGarmin || a._garminId,
    titre: a.titre || a.garminTitre,
    distance: cleanNumber(a.distance || a.kmGarmin),
    duration: convertDuration(a.duree || a.dureeGarmin || a.dureeMin || a.duration),
    duration_str: a.duree || a.dureeGarmin,
    fc_moy: cleanInt(a.fcMoy),
    fc_max: cleanInt(a.fcMax),
    elevation: cleanNumber(a.dp || a.dpGarmin || a.elevation),
    calories: cleanInt(a.calories || a.cal),
    allure: a.allure,
    gap_moy: a.gapMoy,
    cadence: cleanInt(a.cadence),
    body_battery: a.bodyBattery,
    tss: a.tss,
    te_aero: a.teAero,
    z0: cleanZone(a.z0),
    z1: cleanZone(a.z1),
    z2: cleanZone(a.z2),
    z3: cleanZone(a.z3),
    z4: cleanZone(a.z4),
    z5: cleanZone(a.z5),
    notes: a.notes || a.commentaire,
    gpx_data: a.gpxData || null,
    updated_at: new Date().toISOString()
  }))
  await safeReplace('activities', userId, rows)
}

// ─── SOMMEIL ──────────────────────────────────────────────────────────────────
// Convertir "6h 58min" → "06:58"
const convertDureeSommeil = (str) => {
  if (!str) return ""
  const match = str.match(/(\d+)h\s*(\d+)min/)
  if (!match) return str
  const h = match[1].padStart(2, '0')
  const m = match[2].padStart(2, '0')
  return `${h}:${m}`
}

export async function loadSommeil(userId) {
  const { data, error } = await supabase
    .from('sommeil')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  
  if (error) throw error
  
  const deduped = dedupBy(data || [], r => r.date)
  return deduped.map(s => {
    const loaded = {
      id: s.id,
      date: s.date,
      score: s.score,
      qualite: s.qualite,
      dureeMin: s.duree_min,
      fcMoy: s.fc_moy,
      bodyBatteryNuit: s.bb_nuit,
      bodyBatteryMatin: s.body_battery,
      spo2: s.spo2,
      resp: s.resp,
      coucher: s.coucher,
      lever: s.lever,
      ...(s.data || {})
    }
    // Convertir durée si format texte
    if (loaded.duree && typeof loaded.duree === 'string' && loaded.duree.includes('h')) {
      loaded.duree = convertDureeSommeil(loaded.duree)
    }
    return loaded
  })
}

export async function saveSommeil(userId, sommeil) {
  if (!Array.isArray(sommeil)) return
  const rows = sommeil.map(s => ({
    user_id: userId,
    date: s.date,
    score: cleanInt(s.score),
    qualite: s.qualite,
    duree_min: cleanInt(s.dureeMin),
    fc_moy: cleanInt(s.fcMoy),
    bb_nuit: cleanInt(s.bodyBatteryNuit),
    body_battery: cleanInt(s.bodyBatteryMatin),
    spo2: cleanInt(s.spo2),
    resp: cleanNumber(s.resp),
    coucher: s.coucher,
    lever: s.lever,
    data: s,
    updated_at: new Date().toISOString()
  }))
  await safeReplace('sommeil', userId, rows)
}

// ─── VFC ──────────────────────────────────────────────────────────────────────
export async function loadVFC(userId) {
  const { data, error } = await supabase
    .from('vfc')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  
  if (error) throw error
  
  const deduped = dedupBy(data || [], r => r.date)
  return deduped.map(v => ({
    id: v.id,
    date: v.date,
    vfc: v.vfc,
    baseline: v.baseline,
    chargeAigue: v.charge_aigue,
    chargeChronique: v.charge_chronique,
    ...(v.data || {})
  }))
}

export async function saveVFC(userId, vfcData) {
  if (!Array.isArray(vfcData)) return
  const rows = vfcData.map(v => ({
    user_id: userId,
    date: v.date,
    vfc: cleanInt(v.vfc),
    baseline: v.baseline,
    charge_aigue: cleanInt(v.chargeAigue),
    charge_chronique: cleanInt(v.chargeChronique),
    data: v,
    updated_at: new Date().toISOString()
  }))
  await safeReplace('vfc', userId, rows)
}

// ─── POIDS ────────────────────────────────────────────────────────────────────
export async function loadPoids(userId) {
  const { data, error } = await supabase
    .from('poids')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  
  if (error) throw error
  
  const deduped = dedupBy(data || [], r => r.date)
  return deduped.map(p => ({
    id: p.id,
    date: p.date,
    poids: p.poids,
    taille_cm: p.taille_cm,
    cou: p.cou,
    epaules: p.epaules,
    poitrine: p.poitrine,
    bras: p.bras,
    ventre: p.ventre,
    hanche: p.hanche,
    cuisse: p.cuisse,
    mollet: p.mollet
  }))
}

export async function savePoids(userId, poids) {
  if (!Array.isArray(poids)) return
  const rows = poids.map(p => ({
    user_id: userId,
    date: p.date,
    poids: cleanNumber(p.poids),
    taille: cleanInt(p.taille),
    cou: cleanNumber(p.cou),
    epaules: cleanNumber(p.epaules),
    poitrine: cleanNumber(p.poitrine),
    bras: cleanNumber(p.bras),
    taille_cm: cleanNumber(p.taille_cm || p.tailleCm),
    ventre: cleanNumber(p.ventre),
    hanche: cleanNumber(p.hanche),
    cuisse: cleanNumber(p.cuisse),
    mollet: cleanNumber(p.mollet),
    updated_at: new Date().toISOString()
  }))
  await safeReplace('poids', userId, rows)
}

// ─── OBJECTIFS ────────────────────────────────────────────────────────────────
export async function loadObjectifs(userId) {
  const { data, error } = await supabase
    .from('objectifs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  
  if (error) throw error
  
  const deduped = dedupBy(data || [], r => `${r.date}|${r.nom || ''}`)
  return deduped.map(o => ({
    id: o.id,
    date: o.date,
    nom: o.nom,
    distance: o.distance,
    dp: o.dp,
    type: o.type,
    statut: o.statut,
    ...(o.data || {})
  }))
}

export async function saveObjectifs(userId, objectifs) {
  if (!Array.isArray(objectifs)) return
  const rows = objectifs.map(o => ({
    user_id: userId,
    date: o.date,
    nom: o.nom,
    distance: cleanNumber(o.distance),
    dp: cleanNumber(o.dp),
    type: o.type,
    statut: o.statut,
    data: o,
    updated_at: new Date().toISOString()
  }))
  await safeReplace('objectifs', userId, rows)
}

// ─── NUTRITION ────────────────────────────────────────────────────────────────
export async function loadNutrition(userId) {
  const { data, error } = await supabase
    .from('nutrition_data')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  
  return {
    journalNutri: data?.journal || [],
    produits: data?.produits || [],
    recettes: data?.recettes || []
  }
}

export async function saveNutrition(userId, journalNutri, produits, recettes) {
  const { error } = await supabase
    .from('nutrition_data')
    .upsert({
      user_id: userId,
      journal: journalNutri,
      produits: produits,
      recettes: recettes,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })
  
  if (error) throw error
}

// ─── ENTRAINEMENT SETTINGS ────────────────────────────────────────────────────
export async function loadEntrainementSettings(userId) {
  const { data, error } = await supabase
    .from('entrainement_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  
  const ENTRAINEMENT_FEATURES_DEFAULT = {programme:true,activites:true,forme:true,objectifs:true,coach:true}
  const COURSE_FEATURES_DEFAULT = {nutrition:true,equipement:true,analyse:true,team:true,courses:true,profilDetail:true}
  
  return {
    planningType: data?.planning_type || null,
    activityTypes: data?.activity_types || [],
    entrainementFeatures: data?.entrainement_features || ENTRAINEMENT_FEATURES_DEFAULT,
    courseFeatures: data?.course_features || COURSE_FEATURES_DEFAULT,
    profilType: data?.profil_type !== undefined ? data.profil_type : null
  }
}

export async function saveEntrainementSettings(userId, planningType, activityTypes, entrainementFeatures, courseFeatures, profilType) {
  const { error } = await supabase
    .from('entrainement_settings')
    .upsert({
      user_id: userId,
      planning_type: planningType,
      activity_types: activityTypes,
      entrainement_features: entrainementFeatures,
      course_features: courseFeatures,
      profil_type: profilType,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })
  
  if (error) throw error
}

// ─── COURSES ──────────────────────────────────────────────────────────────────
export async function loadCourses(userId) {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  
  return (data || []).map(c => ({
    id: c.id,
    savedAt: new Date(c.updated_at).getTime(),
    name: c.name,
    distance: c.distance,
    elevPos: c.elevation,
    date: c.date,
    race: c.strategy_data?.race || {},
    segments: c.strategy_data?.segments || [],
    settings: c.nutrition_data || {}
  }))
}

export async function saveCourse(userId, course) {
  const { error } = await supabase
    .from('courses')
    .upsert({
      id: course.id,
      user_id: userId,
      name: course.name,
      distance: course.distance,
      elevation: course.elevPos,
      date: course.date,
      strategy_data: { race: course.race, segments: course.segments },
      nutrition_data: course.settings,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id'
    })
  
  if (error) throw error
}

export async function deleteCourse(userId, courseId) {
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId)
    .eq('user_id', userId)
  
  if (error) throw error
}

// ─── CURRENT RACE (race/segments/settings en cours) ───────────────────────────
export async function loadCurrentRace(userId) {
  const { data, error } = await supabase
    .from('current_race')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  
  return {
    race: data?.race || {},
    segments: data?.segments || [],
    settings: data?.settings || {}
  }
}

export async function saveCurrentRace(userId, race, segments, settings) {
  const { error } = await supabase
    .from('current_race')
    .upsert({
      user_id: userId,
      race: race,
      segments: segments,
      settings: settings,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })
  
  if (error) throw error
}

// ─── BULK LOAD ────────────────────────────────────────────────────────────────
export async function loadAllUserData(userId) {
  const [
    profil,
    seances,
    activites,
    sommeil,
    vfcData,
    poids,
    objectifs,
    nutrition,
    entrainementSettings,
    courses,
    currentRace
  ] = await Promise.all([
    loadAthleteProfile(userId),
    loadSeances(userId),
    loadActivities(userId),
    loadSommeil(userId),
    loadVFC(userId),
    loadPoids(userId),
    loadObjectifs(userId),
    loadNutrition(userId),
    loadEntrainementSettings(userId),
    loadCourses(userId),
    loadCurrentRace(userId)
  ])
  
  return {
    profil,
    seances,
    activites,
    sommeil,
    vfcData,
    poids,
    objectifs,
    ...nutrition,
    ...entrainementSettings,
    courses,
    currentRace
  }
}

// ─── VERSIONING & CONFLICT DETECTION ─────────────────────────────────────────
// Le timestamp data_version est incrémenté côté serveur à chaque save. Les
// sessions clientes le mémorisent et le comparent avant chaque écriture pour
// détecter qu'une autre session a modifié des données entre temps.

export async function getDataVersion(userId) {
  const { data, error } = await supabase
    .from('entrainement_settings')
    .select('data_version')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.data_version || null
}

export async function bumpDataVersion(userId) {
  const { data, error } = await supabase.rpc('bump_data_version', { p_user_id: userId })
  if (error) throw error
  return data // nouveau timestamp
}

// ─── SNAPSHOTS : sauvegardes journalières automatiques ───────────────────────
// Pattern : 2 snapshots par jour max (matin/après-midi), 30 jours de rétention.
// Permet de restaurer une version antérieure en cas de bug ou perte de données.

// Période courante : "YYYY-MM-DD-AM" (avant midi) ou "YYYY-MM-DD-PM" (après midi)
function currentSnapshotPeriod(date = new Date()) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const ampm = date.getHours() < 12 ? 'AM' : 'PM'
  return `${yyyy}-${mm}-${dd}-${ampm}`
}

// Vérifie si un snapshot existe pour la période actuelle
export async function hasSnapshotForCurrentPeriod(userId) {
  if (!userId) return false
  const period = currentSnapshotPeriod()
  const { data, error } = await supabase
    .from('data_snapshots')
    .select('id')
    .eq('user_id', userId)
    .eq('snapshot_period', period)
    .maybeSingle()
  
  if (error) {
    console.error('[snapshots] erreur check:', error)
    return false
  }
  return !!data
}

// Crée un snapshot pour la période actuelle (upsert : remplace si existe déjà)
export async function createSnapshot(userId, snapshotData) {
  if (!userId) throw new Error('createSnapshot : userId manquant')
  if (!snapshotData || typeof snapshotData !== 'object') {
    throw new Error('createSnapshot : données invalides')
  }
  
  const period = currentSnapshotPeriod()
  const dataStr = JSON.stringify(snapshotData)
  const dataSize = new Blob([dataStr]).size
  
  // Upsert : insère ou remplace si existe (key = user_id + snapshot_period)
  const { error } = await supabase
    .from('data_snapshots')
    .upsert({
      user_id: userId,
      snapshot_period: period,
      data: snapshotData,
      data_size: dataSize,
      created_at: new Date().toISOString()
    }, { onConflict: 'user_id,snapshot_period' })
  
  if (error) throw error
  
  // Auto-cleanup : supprime les snapshots > 30 jours
  cleanOldSnapshots(userId).catch(err => {
    console.warn('[snapshots] cleanup échoué (non bloquant):', err)
  })
  
  return { period, dataSize }
}

// Liste les snapshots d'un user (du plus récent au plus ancien)
export async function listSnapshots(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('data_snapshots')
    .select('id, snapshot_period, data_size, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60)  // 30 jours × 2 = 60 max
  
  if (error) throw error
  return data || []
}

// Récupère le contenu complet d'un snapshot
export async function loadSnapshot(userId, snapshotId) {
  if (!userId || !snapshotId) throw new Error('loadSnapshot : paramètres manquants')
  const { data, error } = await supabase
    .from('data_snapshots')
    .select('id, snapshot_period, data, created_at')
    .eq('user_id', userId)
    .eq('id', snapshotId)
    .single()
  
  if (error) throw error
  return data
}

// Cleanup : supprime les snapshots > 30 jours pour un user
export async function cleanOldSnapshots(userId) {
  if (!userId) return
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  
  const { error } = await supabase
    .from('data_snapshots')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', cutoff.toISOString())
  
  if (error) throw error
}

