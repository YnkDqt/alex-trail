import { useState } from "react";
import { Btn, Modal, ConfirmDialog } from '../atoms.jsx';
import { C, COURSE_C, TEAL } from '../constants.js';
import {
  loadAthleteProfile, saveAthleteProfile,
  loadActivities, saveActivities, loadSeances, saveSeances,
  loadSommeil, saveSommeil, loadVFC, saveVFC, loadPoids, savePoids,
  loadObjectifs, saveObjectifs, loadCurrentRace, saveCurrentRace,
  loadCourses, saveCourse, deleteAllCourses, loadNutrition, saveNutrition,
  loadEntrainementSettings, saveEntrainementSettings,
  createSnapshot, listSnapshots, loadSnapshot,
  exportAllUserDataAsJSON,
} from '../supabaseHelpers';

// ─── DONNÉES & PARAMS VIEW ────────────────────────────────────────────────────
export default function DonneesParamsView({
  saveAllData, race, segments, settings,
  isStandalone, installDone,
  handleInstall, setView, setDrawerOpen,
  seances, setSeances, activites, setActivites, sommeil, setSommeil,
  vfcData, setVfcData, poids, setPoids, planningType, objectifs,
  allData, loadEntrainementData, resetAll, journalNutri, confirmReset, setConfirmReset,
  features, toggleFeature, FEATURE_LABELS,
  entrainementFeatures, toggleEntrainementFeature, ENTRAINEMENT_FEATURE_LABELS,
  user,
}) {
  const [tab, setTab] = useState("sauvegarde");
  
  // ── États snapshots ──
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [snapshotsList, setSnapshotsList] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [snapshotMsg, setSnapshotMsg] = useState("");
  
  const openSnapshots = async () => {
    if (!user?.id) return;
    setSnapshotsOpen(true);
    setSnapshotsLoading(true);
    try {
      const list = await listSnapshots(user.id);
      setSnapshotsList(list);
    } catch (err) {
      console.error('Erreur listSnapshots:', err);
      alert("Erreur lors du chargement des snapshots");
    } finally {
      setSnapshotsLoading(false);
    }
  };
  
  const handleCreateManualSnapshot = async () => {
    if (!user?.id || creatingSnapshot) return;
    setCreatingSnapshot(true);
    try {
      // Récupérer l'état actuel complet depuis Supabase pour le snapshot
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
      const snapshotData = { profile, activities, seances, sommeil, vfc, poids, objectifs, nutrition, settings, currentRace, courses };
      await createSnapshot(user.id, snapshotData);
      const list = await listSnapshots(user.id);
      setSnapshotsList(list);
      setSnapshotMsg("✓ Snapshot créé");
      setTimeout(() => setSnapshotMsg(""), 3000);
    } catch (err) {
      console.error('Erreur create snapshot:', err);
      alert("Erreur lors de la création du snapshot");
    } finally {
      setCreatingSnapshot(false);
    }
  };
  
  const handleRestore = async (snapshotId) => {
    if (!user?.id) return;
    try {
      const snap = await loadSnapshot(user.id, snapshotId);
      const data = snap.data || {};
      const nutr = data.nutrition || {};
      const stg  = data.settings  || {};
      // currentRace stocké soit en plat, soit imbriqué (selon source)
      const raceData = data.currentRace?.race?.race ? data.currentRace : (data.currentRace || {});
      
      // 1. Restaurer toutes les données principales en parallèle
      await Promise.all([
        data.profile && saveAthleteProfile(user.id, data.profile),
        Array.isArray(data.activities) && saveActivities(user.id, data.activities),
        Array.isArray(data.seances) && saveSeances(user.id, data.seances),
        Array.isArray(data.sommeil) && saveSommeil(user.id, data.sommeil),
        Array.isArray(data.vfc) && saveVFC(user.id, data.vfc),
        Array.isArray(data.poids) && savePoids(user.id, data.poids),
        Array.isArray(data.objectifs) && saveObjectifs(user.id, data.objectifs),
        nutr && saveNutrition(user.id, nutr.journalNutri || [], nutr.produits || [], nutr.recettes || []),
        stg && saveEntrainementSettings(user.id, stg.planningType, stg.activityTypes, stg.entrainementFeatures, stg.courseFeatures, stg.profilType),
        raceData?.race && saveCurrentRace(user.id, raceData.race || {}, raceData.segments || [], raceData.settings || {}),
      ].filter(Boolean));
      
      // 2. Restaurer l'historique des courses séquentiellement (saveCourse est par-course)
      if (Array.isArray(data.courses) && data.courses.length > 0) {
        // Récupérer la liste actuelle pour ne pas re-créer ce qui existe
        const existing = await loadCourses(user.id);
        const existingIds = new Set(existing.map(c => c.id));
        const toAdd = data.courses.filter(c => !existingIds.has(c.id));
        for (const course of toAdd) {
          try {
            await saveCourse(user.id, course);
          } catch (err) {
            console.warn('Erreur restore course:', course.id, err);
          }
        }
      }
      
      setSnapshotMsg("✓ Snapshot restauré — recharge la page pour voir les données");
      setTimeout(() => setSnapshotMsg(""), 8000);
      setSnapshotsOpen(false);
      setConfirmRestore(null);
    } catch (err) {
      console.error('Erreur restore:', err);
      alert("Erreur lors de la restauration : " + err.message);
    }
  };
  
  const fmtSnapshotPeriod = (period) => {
    const m = period?.match(/^(\d{4})-(\d{2})-(\d{2})-(AM|PM)$/);
    if (!m) return period;
    const months = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
    const day = parseInt(m[3]);
    const monthName = months[parseInt(m[2]) - 1];
    const tod = m[4] === "AM" ? "matin" : "après-midi";
    return `${day} ${monthName} (${tod})`;
  };
  
  const fmtBytes = (n) => {
    if (!n) return "?";
    if (n < 1024) return `${n} o`;
    if (n < 1024 * 1024) return `${(n/1024).toFixed(0)} Ko`;
    return `${(n/(1024*1024)).toFixed(1)} Mo`;
  };

  const TabBtn = ({id, label}) => (
    <button onClick={()=>setTab(id)}
      style={{padding:"8px 18px",border:"none",background:"none",cursor:"pointer",
        fontFamily:"inherit",fontSize:13,fontWeight:tab===id?600:400,
        color:tab===id?C.inkLight:C.muted,
        borderBottom:`2px solid ${tab===id?C.forest:"transparent"}`,
        transition:"all .15s",marginBottom:-1}}>
      {label}
    </button>
  );

  const ToggleRow = ({icon,label,desc,active,onToggle,color}) => {
    const col = color || C.forest;
    return (
      <div onClick={onToggle}
        style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",
          borderRadius:10,cursor:"pointer",transition:"all .15s",
          border:`1.5px solid ${active?col+"50":C.border}`,
          background:active?col+"0D":C.white}}>
        <span style={{fontSize:18,flexShrink:0,opacity:active?1:.5}}>{icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:500,fontSize:13,color:active?C.inkLight:C.muted}}>{label}</div>
          {desc&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{desc}</div>}
        </div>
        <div style={{width:34,height:19,borderRadius:10,flexShrink:0,position:"relative",
          background:active?col:C.stoneDark,transition:"background .2s"}}>
          <div style={{position:"absolute",top:2,left:active?17:2,width:15,height:15,
            borderRadius:"50%",background:"#fff",transition:"left .2s",
            boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
        </div>
      </div>
    );
  };

  const Section = ({title, children}) => (
    <div style={{marginBottom:28}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.09em",
        color:C.muted,marginBottom:14,paddingBottom:8,borderBottom:`1px solid ${C.stone}`}}>
        {title}
      </div>
      {children}
    </div>
  );

  const ActionBtn = ({onClick, icon, label, variant="ghost", disabled=false, badge=null}) => {
    const bg = variant==="primary"?C.forest:variant==="danger"?C.redPale:"transparent";
    const col = variant==="primary"?"#fff":variant==="danger"?C.red:C.inkLight;
    const border = variant==="ghost"?`1px solid ${C.border}`:variant==="danger"?`1px solid ${C.red}30`:"none";
    return (
      <button onClick={onClick} disabled={disabled}
        style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderRadius:10,
          border,background:bg,color:col,cursor:disabled?"not-allowed":"pointer",
          fontSize:13,fontWeight:500,width:"100%",fontFamily:"inherit",
          opacity:disabled?.5:1,transition:"all .15s"}}>
        <span style={{fontSize:16}}>{icon}</span>
        <span style={{flex:1,textAlign:"left"}}>{label}</span>
        {badge&&<span style={{fontSize:11,background:`${C.forest}20`,color:C.forest,
          padding:"2px 8px",borderRadius:20,fontWeight:600}}>{badge}</span>}
      </button>
    );
  };

  return (
    <div style={{maxWidth:680,margin:"0 auto",padding:"28px 32px 60px"}}>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,
          color:C.inkLight,letterSpacing:"-0.02em",marginBottom:4}}>
          Données & Params
        </h1>
        <p style={{fontSize:13,color:C.muted}}>Sauvegarde, import et personnalisation de l'app.</p>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,marginBottom:28}}>
        <TabBtn id="sauvegarde" label="Sauvegarde"/>
        <TabBtn id="modules"    label="Modules"/>
        <TabBtn id="compte"     label="Compte"/>
      </div>

      {/* ── SAUVEGARDE ── */}
      {tab==="sauvegarde"&&(
        <div>
          <Section title="Export / Import">
            <p style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.6}}>
              Un seul fichier JSON pour toutes tes données : profil, activités, forme, courses, nutrition. Pratique pour sauvegarder ou changer d'appareil.
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <ActionBtn onClick={async () => {
                if (!user?.id) return;
                try {
                  await exportAllUserDataAsJSON(user);
                } catch (err) {
                  console.error('Erreur export:', err);
                  alert('Erreur lors de l\'export');
                }
              }} icon="📥" label="Exporter toutes mes données" variant="primary"/>
              
              <label style={{display:"block"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",
                  borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",
                  color:C.inkLight,cursor:"pointer",fontSize:13,fontWeight:500}}>
                  <span style={{fontSize:16}}>📤</span>
                  <span>Importer mes données</span>
                </div>
                <input type="file" accept=".json" style={{display:"none"}}
                  onChange={async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const confirm = window.confirm(
                      "⚠️ ATTENTION\n\n" +
                      "L'import va ÉCRASER toutes tes données actuelles.\n\n" +
                      "Continue uniquement si tu veux restaurer une sauvegarde complète.\n\n" +
                      "Continuer ?"
                    );
                    if (!confirm) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      if (!data.format?.startsWith('alex-export')) {
                        alert('Format de fichier invalide');
                        return;
                      }
                      // Sémantique courses : demander seulement si le fichier en contient
                      const importedCourses = Array.isArray(data.courses) ? data.courses : [];
                      let coursesMode = null; // 'replace' | 'merge' | null (rien à faire)
                      if (importedCourses.length > 0) {
                        const choice = window.prompt(
                          `Le fichier contient ${importedCourses.length} course(s) dans l'historique.\n\n` +
                          "Comment veux-tu les importer ?\n\n" +
                          "  REPLACE → supprime tes courses actuelles et remplace par celles du fichier\n" +
                          "  MERGE   → ajoute uniquement celles qui n'existent pas déjà\n\n" +
                          "Tape REPLACE ou MERGE :",
                          "MERGE"
                        );
                        if (choice === null) return; // annulé
                        const c = choice.trim().toUpperCase();
                        if (c !== 'REPLACE' && c !== 'MERGE') {
                          alert('Choix invalide. Import annulé.');
                          return;
                        }
                        coursesMode = c.toLowerCase();
                      }
                      // Restaurer tout dans Supabase
                      const raceData = data.currentRace?.race?.race ? data.currentRace.race : data.currentRace;
                      const nutr = data.nutrition || {};
                      const stg  = data.settings  || {};
                      await Promise.all([
                        data.profile && saveAthleteProfile(user.id, data.profile),
                        data.activities && saveActivities(user.id, data.activities),
                        data.seances && saveSeances(user.id, data.seances),
                        data.sommeil && saveSommeil(user.id, data.sommeil),
                        data.vfc && saveVFC(user.id, data.vfc),
                        data.poids && savePoids(user.id, data.poids),
                        data.objectifs && saveObjectifs(user.id, data.objectifs),
                        data.nutrition && saveNutrition(user.id, nutr.journalNutri || [], nutr.produits || [], nutr.recettes || []),
                        data.settings && saveEntrainementSettings(user.id, stg.planningType, stg.activityTypes, stg.entrainementFeatures, stg.courseFeatures, stg.profilType),
                        raceData && saveCurrentRace(user.id, raceData.race, raceData.segments, raceData.settings),
                      ]);
                      // Courses : séquentiel après le reste, selon mode choisi
                      if (coursesMode === 'replace') {
                        await deleteAllCourses(user.id);
                        for (const course of importedCourses) {
                          try { await saveCourse(user.id, course); }
                          catch (err) { console.warn('Erreur import course:', course.id, err); }
                        }
                      } else if (coursesMode === 'merge') {
                        const existing = await loadCourses(user.id);
                        const existingIds = new Set(existing.map(c => c.id));
                        const toAdd = importedCourses.filter(c => !existingIds.has(c.id));
                        for (const course of toAdd) {
                          try { await saveCourse(user.id, course); }
                          catch (err) { console.warn('Erreur import course:', course.id, err); }
                        }
                      }
                      alert('✅ Import réussi ! Recharge la page.');
                      window.location.reload();
                    } catch (err) {
                      console.error('Erreur import:', err);
                      alert('Erreur lors de l\'import : ' + err.message);
                    }
                  }}/>
              </label>
            </div>
            <div style={{marginTop:14,padding:"10px 14px",background:C.stone,borderRadius:10,fontSize:12,color:C.muted,lineHeight:1.6}}>
              💡 L'import écrase toutes les données. Exporte d'abord si tu veux garder une copie de l'existant.
            </div>
          </Section>

          <Section title="Snapshots automatiques">
            <p style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.6}}>
              Sauvegarde de sécurité créée 2 fois par jour (matin/après-midi). Permet de restaurer une version antérieure en cas de bug ou d'erreur. 30 jours de rétention.
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <ActionBtn onClick={openSnapshots} icon="🕒" label="Voir et restaurer un snapshot"/>
            </div>
            {snapshotMsg && (
              <div style={{marginTop:10,padding:"10px 14px",background:`${C.green}15`,border:`1px solid ${C.green}40`,borderRadius:10,fontSize:12,color:C.green,fontWeight:500}}>
                {snapshotMsg}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ── MODULES ── */}
      {tab==="modules"&&(
        <div>
          <Section title="Général">
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {ENTRAINEMENT_FEATURE_LABELS.filter(f=>f.key==="objectifs"||f.key==="journal").map(({key,label,icon,desc})=>(
                <ToggleRow key={key} icon={icon} label={label} desc={desc}
                  active={entrainementFeatures[key]!==false}
                  onToggle={()=>toggleEntrainementFeature(key)}
                  color={TEAL}
                />
              ))}
            </div>
          </Section>

          <Section title="Entraînement">
            <ToggleRow icon="↑" label="Section Entraînement"
              desc="Masque entièrement la section dans la navigation"
              active={entrainementFeatures._section!==false}
              onToggle={()=>toggleEntrainementFeature("_section")}
              color={TEAL}
            />
            {entrainementFeatures._section!==false&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8,paddingLeft:16,borderLeft:`2px solid ${TEAL}30`}}>
                {ENTRAINEMENT_FEATURE_LABELS.filter(f=>f.key!=="objectifs"&&f.key!=="journal").map(({key,label,icon,desc})=>(
                  <ToggleRow key={key} icon={icon} label={label} desc={desc}
                    active={entrainementFeatures[key]!==false}
                    onToggle={()=>toggleEntrainementFeature(key)}
                    color={TEAL}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Course">
            <ToggleRow icon="🗺️" label="Section Course"
              desc="Masque entièrement la section dans la navigation"
              active={features._section!==false}
              onToggle={()=>toggleFeature("_section")}
              color={COURSE_C.primary}
            />
            {features._section!==false&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8,paddingLeft:16,borderLeft:`2px solid ${COURSE_C.primary}30`}}>
                {FEATURE_LABELS.map(({key,label,icon,desc})=>(
                  <ToggleRow key={key} icon={icon} label={label} desc={desc}
                    active={features[key]}
                    onToggle={()=>toggleFeature(key)}
                    color={COURSE_C.primary}
                  />
                ))}
              </div>
            )}
            <div style={{marginTop:14,padding:"10px 14px",background:C.stone,
              borderRadius:10,fontSize:12,color:C.muted,lineHeight:1.5}}>
              💡 Profil de course et Stratégie sont toujours visibles si la section est active.
            </div>
          </Section>
        </div>
      )}

      {/* ── COMPTE ── */}
      {tab==="compte"&&(
        <div>
          <Section title="Stockage des données">
            <div style={{background:C.stone,borderRadius:12,padding:"16px",fontSize:12,color:C.muted,lineHeight:1.6}}>
              <div style={{marginBottom:8,fontWeight:600,color:C.inkLight}}>✅ Stockage Supabase actif</div>
              <div>• Toutes tes données (profil, activités, forme, courses) sont synchronisées sur Supabase (EU - Paris)</div>
              <div>• Accès depuis n'importe quel appareil après connexion</div>
              <div>• Sauvegarde automatique en temps réel</div>
              <div style={{marginTop:8,color:C.stoneDeep}}>Tes données restent privées et sont conformes RGPD.</div>
            </div>
          </Section>
        </div>
      )}
      
      <Modal
        open={snapshotsOpen}
        onClose={() => setSnapshotsOpen(false)}
        title="Snapshots automatiques"
        subtitle="Sauvegardes du matin et de l'après-midi sur les 30 derniers jours"
        width={560}
        footer={
          <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center"}}>
            <Btn variant="soft" size="sm" onClick={handleCreateManualSnapshot} disabled={creatingSnapshot}>
              {creatingSnapshot ? "Création…" : "📸 Créer un snapshot maintenant"}
            </Btn>
            <Btn variant="ghost" onClick={() => setSnapshotsOpen(false)}>Fermer</Btn>
          </div>
        }
      >
        {snapshotsLoading ? (
          <div style={{padding:"30px",textAlign:"center",color:C.muted,fontSize:13}}>Chargement…</div>
        ) : snapshotsList.length === 0 ? (
          <div style={{padding:"30px",textAlign:"center",color:C.muted,fontSize:13}}>
            Aucun snapshot pour l'instant. Le premier sera créé au prochain login, ou clique sur "Créer un snapshot maintenant".
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:420,overflowY:"auto"}}>
            {snapshotsList.map(s => (
              <div key={s.id} style={{
                display:"flex",alignItems:"center",gap:12,
                padding:"10px 12px",background:C.stone,borderRadius:8,border:`1px solid ${C.border}`
              }}>
                <span style={{fontSize:16}}>🕒</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>
                    {fmtSnapshotPeriod(s.snapshot_period)}
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginTop:1}}>
                    {new Date(s.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                    {" · "}
                    {fmtBytes(s.data_size)}
                  </div>
                </div>
                <Btn variant="ghost" size="sm" onClick={() => setConfirmRestore(s)}>Restaurer</Btn>
              </div>
            ))}
          </div>
        )}
      </Modal>
      
      <ConfirmDialog
        open={!!confirmRestore}
        message={confirmRestore ? `Restaurer le snapshot du ${fmtSnapshotPeriod(confirmRestore.snapshot_period)} ? Tes données actuelles seront remplacées.` : ""}
        onConfirm={() => confirmRestore && handleRestore(confirmRestore.id)}
        onCancel={() => setConfirmRestore(null)}
      />
    </div>
  );
}
