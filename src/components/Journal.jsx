import React, { useState, useMemo, useEffect } from "react";
import { C, fmtDate, localDate } from "../constants.js";
import { Btn, PageTitle, Modal, ConfirmDialog, Empty, Field } from "../atoms.jsx";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
// 10 états émotionnels : 5 lumineux, 5 sombres
const ETATS_LUMINEUX = ["fier", "déterminé", "libéré", "lumineux", "transformé"];
const ETATS_SOMBRES  = ["douteux", "frustré", "vide", "cassé", "bloqué"];
const ETATS_ALL = [...ETATS_LUMINEUX, ...ETATS_SOMBRES];
const isLumineux = (etat) => ETATS_LUMINEUX.includes(etat);

const INTENSITES = [
  { key: "anodin",   label: "Anodin",   sub: "Une note rapide" },
  { key: "marquant", label: "Marquant", sub: "À retenir" },
  { key: "pivot",    label: "Pivot",    sub: "Un avant / après" },
];

const CONTEXTES = [
  { key: "entrainement", label: "Entraînement", icon: "🏃" },
  { key: "course",       label: "Course",       icon: "🏁" },
  { key: "blessure",     label: "Blessure / récup", icon: "🤕" },
  { key: "mental",       label: "Mental",       icon: "🧠" },
  { key: "vie_perso",    label: "Vie perso",    icon: "🌱" },
];

// ID réservé pour la phase "Hors saison" (stocké dans la colonne objectifs[]).
const HORS_SAISON_ID = "hors_saison";

const intensiteBadge = (key) => {
  if (key === "pivot")    return { bg: C.green,    color: C.white };
  if (key === "marquant") return { bg: C.stoneDeep, color: C.white };
  return { bg: C.stone, color: C.stoneDark };
};

const moisLabel = (yyyymm) => {
  const [y, m] = yyyymm.split("-");
  const mois = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  return `${mois[parseInt(m,10)-1]} ${y}`;
};

const emptyMoment = () => ({
  id: null,
  date: localDate(new Date()),
  titre: "",
  texte: "",
  etats: [],
  intensite: "",
  contexte: "",
  objectifs: []
});

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
export default function Journal({ journalMoments, setJournalMoments, objectifs, race, isMobile, openNewSignal, clearOpenNewSignal }) {
  const [search, setSearch]       = useState("");
  const [fEtat, setFEtat]         = useState("");
  const [fIntensite, setFInt]     = useState("");
  const [fContexte, setFCtx]      = useState("");
  const [fObjectif, setFObjectif] = useState("");
  const [view, setView]           = useState("phases"); // "phases" | "chrono"

  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(emptyMoment());
  const [confirmDel, setConfirmDel] = useState(null);

  const openNew  = () => { setForm(emptyMoment()); setModal(true); };
  const openEdit = (m) => { setForm({...m}); setModal(true); };

  // Si Dashboard a demandé l'ouverture directe en création
  useEffect(()=>{
    if (openNewSignal) {
      openNew();
      clearOpenNewSignal && clearOpenNewSignal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[openNewSignal]);

  const save = () => {
    if (!form.titre.trim()) return alert("Le titre est requis");
    if (form.id) {
      setJournalMoments(ms => ms.map(m => m.id === form.id ? {...form} : m));
    } else {
      const newM = { ...form, id: Date.now() + Math.random() };
      setJournalMoments(ms => [newM, ...ms]);
    }
    setModal(false);
  };

  const del = () => {
    setJournalMoments(ms => ms.filter(m => m.id !== confirmDel));
    setConfirmDel(null);
  };

  // Filtrage
  const filtered = useMemo(() => {
    let list = [...journalMoments];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        (m.titre||"").toLowerCase().includes(q) ||
        (m.texte||"").toLowerCase().includes(q)
      );
    }
    if (fEtat)      list = list.filter(m => (m.etats||[]).includes(fEtat));
    if (fIntensite) list = list.filter(m => m.intensite === fIntensite);
    if (fContexte)  list = list.filter(m => m.contexte === fContexte);
    if (fObjectif) {
      // Cas spécial Hors saison : filtrage manuel uniquement, pas de fallback dates.
      if (fObjectif === HORS_SAISON_ID) {
        list = list.filter(m => (m.objectifs||[]).map(String).includes(HORS_SAISON_ID));
      } else {
        const obj = (objectifs||[]).find(o => String(o.id) === String(fObjectif));
        if (obj) {
          // Manuel prioritaire : tout Moment lié explicitement à l'objectif est inclus.
          // Fallback fenêtre : Moment non lié dont la date tombe dans [date - 90j, date + 7j].
          let min = null, max = null;
          if (obj.date) {
            min = new Date(obj.date); min.setDate(min.getDate() - 90);
            max = new Date(obj.date); max.setDate(max.getDate() + 7);
          }
          list = list.filter(m => {
            const lieManuel = (m.objectifs||[]).map(String).includes(String(obj.id));
            if (lieManuel) return true;
            if (!min || !max) return false;
            const d = new Date(m.date);
            return d >= min && d <= max;
          });
        }
      }
    }
    list.sort((a,b) => (a.date < b.date ? 1 : -1));
    return list;
  }, [journalMoments, search, fEtat, fIntensite, fContexte, fObjectif, objectifs]);

  // Groupement par mois (vue Phases)
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(m => {
      const key = (m.date || "").slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    });
    return Array.from(map.entries()); // [[yyyy-mm, [moments]], ...]
  }, [filtered]);

  return (
    <div className="anim" style={{padding:"24px 32px 80px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <PageTitle sub={`${journalMoments.length} moment(s) · Capter ce qui mérite d'être retenu`}>Journal</PageTitle>
        <Btn variant="primary" size="sm" onClick={openNew}>+ Nouveau moment</Btn>
      </div>

      {/* Filtres */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Rechercher dans titres et textes..."
          style={{flex:"1 1 240px",minWidth:200,padding:"7px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.bg}}/>
        <select value={fObjectif} onChange={e=>setFObjectif(e.target.value)}
          style={selStyle}>
          <option value="">Tous les objectifs</option>
          <option value={HORS_SAISON_ID}>🍂 Hors saison</option>
          {[...(objectifs||[])].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(o => (
            <option key={o.id} value={o.id}>{o.nom}{o.date?` · ${fmtDate(o.date)}`:""}</option>
          ))}
        </select>
        <select value={fEtat} onChange={e=>setFEtat(e.target.value)} style={selStyle}>
          <option value="">Tous les états</option>
          <optgroup label="Lumineux">
            {ETATS_LUMINEUX.map(e => <option key={e} value={e}>{e}</option>)}
          </optgroup>
          <optgroup label="Sombres">
            {ETATS_SOMBRES.map(e => <option key={e} value={e}>{e}</option>)}
          </optgroup>
        </select>
        <select value={fIntensite} onChange={e=>setFInt(e.target.value)} style={selStyle}>
          <option value="">Toutes intensités</option>
          {INTENSITES.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
        </select>
        <select value={fContexte} onChange={e=>setFCtx(e.target.value)} style={selStyle}>
          <option value="">Tous contextes</option>
          {CONTEXTES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <div style={{display:"flex",border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
          <button onClick={()=>setView("phases")}
            style={{padding:"6px 12px",fontSize:11,background:view==="phases"?C.forest:C.white,color:view==="phases"?C.white:C.muted,border:"none",cursor:"pointer",fontFamily:"inherit"}}>Phases</button>
          <button onClick={()=>setView("chrono")}
            style={{padding:"6px 12px",fontSize:11,background:view==="chrono"?C.forest:C.white,color:view==="chrono"?C.white:C.muted,border:"none",cursor:"pointer",fontFamily:"inherit"}}>Chronologique</button>
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        journalMoments.length === 0 ? (
          <Empty icon="✎" title="Aucun moment encore"
            sub="Le Journal est l'endroit où capter ce qui mérite d'être retenu : un déclic, un doute, une prise de conscience. Pas un tracker quotidien — quelque chose de plus précieux."
            action={<Btn variant="primary" onClick={openNew}>+ Mon premier moment</Btn>}/>
        ) : (
          <Empty icon="·" title="Aucun moment ne correspond" sub="Essaie de relâcher un filtre."/>
        )
      ) : view === "phases" ? (
        <div>
          {grouped.map(([yyyymm, moments]) => {
            const lum = moments.filter(m => (m.etats||[]).some(isLumineux)).length;
            const som = moments.filter(m => (m.etats||[]).some(e => !isLumineux(e))).length;
            const summary = [];
            if (lum) summary.push(`${lum} lumineux`);
            if (som) summary.push(`${som} sombre${som>1?"s":""}`);
            return (
              <div key={yyyymm} style={{marginBottom:28}}>
                <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:17,fontWeight:500,color:C.inkLight}}>{moisLabel(yyyymm)}</div>
                  <div style={{fontSize:11,color:C.muted}}>{moments.length} moment{moments.length>1?"s":""}{summary.length?` · ${summary.join(", ")}`:""}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {moments.map(m => <MomentCard key={m.id} moment={m} objectifs={objectifs} onEdit={()=>openEdit(m)} onDelete={()=>setConfirmDel(m.id)}/>)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(m => <MomentCard key={m.id} moment={m} objectifs={objectifs} onEdit={()=>openEdit(m)} onDelete={()=>setConfirmDel(m.id)}/>)}
        </div>
      )}

      {/* Modal de saisie */}
      <MomentModal open={modal} form={form} setForm={setForm} objectifs={objectifs}
        onClose={()=>setModal(false)} onSave={save}
        onDelete={form.id ? () => { setModal(false); setConfirmDel(form.id); } : null}/>

      <ConfirmDialog open={!!confirmDel} message="Supprimer ce moment ? Cette action est irréversible."
        onConfirm={del} onCancel={()=>setConfirmDel(null)}/>
    </div>
  );
}

const selStyle = {padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.white,cursor:"pointer",fontFamily:"inherit"};

// ─── CARTE MOMENT ─────────────────────────────────────────────────────────────
function MomentCard({ moment, objectifs, onEdit, onDelete }) {
  const intensite = INTENSITES.find(i => i.key === moment.intensite);
  const contexte = CONTEXTES.find(c => c.key === moment.contexte);
  const badge = moment.intensite ? intensiteBadge(moment.intensite) : null;
  const linkedIds = (moment.objectifs||[]).map(String);
  const hasHorsSaison = linkedIds.includes(HORS_SAISON_ID);
  const linkedObjs = linkedIds
    .filter(id => id !== HORS_SAISON_ID)
    .map(oid => (objectifs||[]).find(o => String(o.id) === String(oid)))
    .filter(Boolean);

  return (
    <div onClick={onEdit} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",cursor:"pointer",transition:"background .15s"}}
      onMouseEnter={e=>e.currentTarget.style.background=C.stone+"40"}
      onMouseLeave={e=>e.currentTarget.style.background=C.bg}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted}}>{fmtDate(moment.date)}</span>
            {contexte && <span style={{fontSize:10,color:C.muted}}>· {contexte.icon} {contexte.label}</span>}
            {hasHorsSaison && (
              <span style={{background:C.yellowPale,color:C.yellow,fontSize:10,padding:"2px 7px",borderRadius:4,fontWeight:500}}>
                🍂 Hors saison
              </span>
            )}
            {linkedObjs.map(o => (
              <span key={o.id} style={{background:C.summitPale,color:C.summit,fontSize:10,padding:"2px 7px",borderRadius:4,fontWeight:500}}>
                🏔 {o.nom}
              </span>
            ))}
            {intensite && badge && (
              <span style={{background:badge.bg,color:badge.color,fontSize:9,fontWeight:600,padding:"2px 7px",borderRadius:10,textTransform:"uppercase",letterSpacing:0.4}}>
                {intensite.label}
              </span>
            )}
          </div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:moment.texte?6:0}}>
            {moment.titre}
          </div>
          {moment.texte && (
            <div style={{fontSize:12,color:C.stoneDark,lineHeight:1.5,marginBottom:10,
              display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
              {moment.texte}
            </div>
          )}
          {moment.etats?.length > 0 && (
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
              {moment.etats.map(etat => {
                const lum = isLumineux(etat);
                return (
                  <span key={etat} style={{
                    background: lum ? C.greenPale : C.redPale,
                    color: lum ? C.green : C.red,
                    fontSize:10,padding:"3px 8px",borderRadius:4,fontWeight:500
                  }}>{etat}</span>
                );
              })}
            </div>
          )}
        </div>
        <button onClick={(e)=>{e.stopPropagation(); onDelete();}}
          style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:14,padding:"4px 8px",flexShrink:0}}
          title="Supprimer">✕</button>
      </div>
    </div>
  );
}

// ─── MODAL CRÉATION / ÉDITION ─────────────────────────────────────────────────
function MomentModal({ open, form, setForm, objectifs, onClose, onSave, onDelete }) {
  const upd = (k, v) => setForm(f => ({...f, [k]: v}));
  const toggleEtat = (etat) => {
    setForm(f => {
      const has = f.etats.includes(etat);
      if (has) return {...f, etats: f.etats.filter(e => e !== etat)};
      if (f.etats.length >= 3) return f; // max 3
      return {...f, etats: [...f.etats, etat]};
    });
  };
  const toggleObjectif = (oid) => {
    setForm(f => {
      const ids = (f.objectifs||[]).map(String);
      const sid = String(oid);
      return {...f, objectifs: ids.includes(sid) ? ids.filter(x => x !== sid) : [...ids, sid]};
    });
  };
  const sortedObjs = [...(objectifs||[])].sort((a,b)=>(a.date||"").localeCompare(b.date||""));

  const footer = (
    <>
      {onDelete && <button onClick={onDelete}
        style={{background:"none",border:"none",color:C.red,fontSize:12,cursor:"pointer",padding:0,textDecoration:"underline",marginRight:"auto"}}>
        Supprimer
      </button>}
      <Btn variant="ghost" size="sm" onClick={onClose}>Annuler</Btn>
      <Btn variant="primary" size="sm" onClick={onSave}>Enregistrer</Btn>
    </>
  );

  return (
    <Modal open={open} onClose={onClose}
      title={form.id ? "Modifier le moment" : "Nouveau moment"}
      subtitle="Capture ce qui mérite d'être retenu"
      footer={footer} width={560}>

      <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{flex:"0 0 140px"}}>
          <Field label="Date">
            <input type="date" value={form.date} onChange={e=>upd("date",e.target.value)}
              style={inpStyle}/>
          </Field>
        </div>
        <div style={{flex:1,minWidth:200}}>
          <Field label="Titre">
            <input value={form.titre} onChange={e=>upd("titre",e.target.value)}
              placeholder="Quelques mots qui résument..." maxLength={100}
              style={inpStyle}/>
          </Field>
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <Field label="Texte (optionnel)">
          <textarea value={form.texte} onChange={e=>upd("texte",e.target.value)}
            placeholder="Raconte ce que tu vis, ce que tu ressens, ce que tu veux retenir..."
            maxLength={2000}
            style={{...inpStyle,minHeight:110,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}/>
        </Field>
      </div>

      <div style={{marginBottom:14}}>
        <Field label="Contexte (optionnel)">
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {CONTEXTES.map(c => {
              const sel = form.contexte === c.key;
              return (
                <button key={c.key} onClick={()=>upd("contexte", sel ? "" : c.key)}
                  style={{...chipStyle, background:sel?C.skyPale:C.white, borderColor:sel?C.sky:C.border, color:sel?C.sky:C.muted, fontWeight:sel?500:400}}>
                  <span style={{marginRight:4}}>{c.icon}</span>{c.label}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div style={{marginBottom:14}}>
        <Field label="Lié à un objectif (optionnel, multi-sélection)">
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {(() => {
              const sel = (form.objectifs||[]).map(String).includes(HORS_SAISON_ID);
              return (
                <button key={HORS_SAISON_ID} onClick={()=>toggleObjectif(HORS_SAISON_ID)}
                  style={{...chipStyle, background:sel?C.yellowPale:C.white, borderColor:sel?C.yellow:C.border, color:sel?C.yellow:C.muted, fontWeight:sel?500:400}}>
                  🍂 Hors saison
                </button>
              );
            })()}
            {sortedObjs.map(o => {
              const sel = (form.objectifs||[]).map(String).includes(String(o.id));
              return (
                <button key={o.id} onClick={()=>toggleObjectif(o.id)}
                  style={{...chipStyle, background:sel?C.summitPale:C.white, borderColor:sel?C.summit:C.border, color:sel?C.summit:C.muted, fontWeight:sel?500:400}}>
                  🏔 {o.nom}{o.date?` · ${fmtDate(o.date)}`:""}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
          <label style={{fontSize:12,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>État émotionnel</label>
          <span style={{fontSize:10,color:C.muted}}>{form.etats.length} / 3 max</span>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {ETATS_ALL.map(e => {
            const sel = form.etats.includes(e);
            const lum = isLumineux(e);
            const palette = lum ? {bg:C.greenPale, border:C.green, color:C.green} : {bg:C.redPale, border:C.red, color:C.red};
            return (
              <button key={e} onClick={()=>toggleEtat(e)}
                style={{...chipStyle,
                  background: sel ? palette.bg : C.white,
                  borderColor: sel ? palette.border : C.border,
                  color: sel ? palette.color : C.muted,
                  fontWeight: sel ? 500 : 400}}>
                {e}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{marginBottom:6}}>
        <Field label="Intensité du moment (optionnel)">
          <div style={{display:"flex",gap:8}}>
            {INTENSITES.map(i => {
              const sel = form.intensite === i.key;
              return (
                <button key={i.key} onClick={()=>upd("intensite", sel ? "" : i.key)}
                  style={{flex:1,padding:"10px 8px",border:`1px solid ${sel?C.forest:C.border}`,
                    borderRadius:8,background:sel?C.forestPale:C.white,cursor:"pointer",
                    fontFamily:"inherit",textAlign:"center"}}>
                  <div style={{fontWeight:sel?600:500,fontSize:12,color:sel?C.forest:C.inkLight,marginBottom:2}}>{i.label}</div>
                  <div style={{fontSize:10,color:sel?C.forest:C.muted,opacity:sel?0.8:1}}>{i.sub}</div>
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

const inpStyle = {width:"100%",padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,background:C.bg,fontFamily:"inherit"};
const chipStyle = {fontSize:11,padding:"5px 10px",borderRadius:6,border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit",background:C.white,color:C.muted,transition:"all .15s"};
