import React, { useState } from "react";
import { C, DAY_NAMES, DEFAULT_PLANNING, ACTIVITY_TYPES, localDate, actIcon, emptySeance } from "../constants.js";
import { Btn, Field } from "../atoms.jsx";
// ─── SEMAINE TYPE (sous-onglet Entraînement) ─────────────────────────────────
function SemaineType({ planningType, setPlanningType, seances, setSeances, activityTypes }) {
  const [form,      setForm]      = useState({...DEFAULT_PLANNING,...planningType});
  const [saved,     setSaved]     = useState(false);
  const [generated, setGenerated] = useState(false);
  
  // Dates génération par défaut : aujourd'hui → fin année
  const today = new Date();
  const endOfYear = new Date(today.getFullYear(), 11, 31);
  const [dateDebut, setDateDebut] = useState(localDate(today));
  const [dateFin,   setDateFin]   = useState(localDate(endOfYear));

  const savePlanning = () => { setPlanningType({...form}); setSaved(true); setTimeout(()=>setSaved(false),2000); };
  
  const generateSeances = () => {
    if (!dateDebut || !dateFin) {
      alert("Merci de sélectionner une date de début et de fin");
      return;
    }
    
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    
    if (debut > fin) {
      alert("La date de début doit être avant la date de fin");
      return;
    }
    
    const existing = new Set(seances.map(s => s.date + "|" + s.demiJournee));
    const toCreate = [];
    
    for (let d = new Date(debut); d <= fin; d.setDate(d.getDate() + 1)) {
      const di = (d.getDay() + 6) % 7;
      const dayName = DAY_NAMES[di];
      const dateStr = localDate(d);
      
      for (const half of ["AM", "PM"]) {
        const slot = `${dayName} ${half}`;
        const type = form[slot];
        
        if (!existing.has(dateStr + "|" + slot) && type) {
          toCreate.push({
            ...emptySeance(),
            id: Date.now() + Math.random(),
            date: dateStr,
            demiJournee: slot,
            activite: type,
            statut: "Planifié"
          });
        }
      }
    }
    
    setSeances(ss => [...ss, ...toCreate]);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  };

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Semaine type</h1>
      <p style={{fontSize:12,color:C.muted,marginBottom:24}}>Planifiez votre semaine d'entraînement type. Les créneaux servent de base pour générer le programme annuel.</p>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:24}}>
        {DAY_NAMES.map(d=>(
          <div key={d} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:13,fontWeight:500,color:C.inkLight,marginBottom:12}}>{d}</div>
            {["AM","PM"].map(half=>{
              const slot=`${d} ${half}`; const val=form[slot]||"Repos";
              return (
                <div key={half} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:11,color:C.muted,width:24,flexShrink:0}}>{half}</span>
                  <div style={{position:"relative",flex:1}}>
                    {val&&val!=="Repos"&&<span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:13,zIndex:1,pointerEvents:"none"}}>{actIcon(val)}</span>}
                    <select value={val} onChange={e=>setForm(f=>({...f,[slot]:e.target.value}))}
                      style={{paddingLeft:val&&val!=="Repos"?26:10,width:"100%",fontSize:12}}>
                      {ACTIVITY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bloc génération avec dates */}
      <div style={{
        background:C.skyPale,
        border:`1px solid ${C.border}`,
        borderRadius:12,
        padding:"20px 24px",
        marginBottom:24
      }}>
        <div style={{fontSize:13,fontWeight:500,color:C.inkLight,marginBottom:12}}>📅 Générer le programme</div>
        <p style={{fontSize:12,color:C.muted,marginBottom:16,lineHeight:1.6}}>
          Sélectionnez la période sur laquelle générer les séances. Les créneaux déjà remplis ne seront pas écrasés.
        </p>
        
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:500,color:C.muted,marginBottom:6}}>Date de début</label>
            <input 
              type="date" 
              value={dateDebut} 
              onChange={e => setDateDebut(e.target.value)}
              style={{width:"100%"}}
            />
          </div>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:500,color:C.muted,marginBottom:6}}>Date de fin</label>
            <input 
              type="date" 
              value={dateFin} 
              onChange={e => setDateFin(e.target.value)}
              style={{width:"100%"}}
            />
          </div>
        </div>
        
        <Btn variant="sage" onClick={generateSeances}>
          {generated ? "✓ Séances créées !" : "Générer les séances"}
        </Btn>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <Btn variant="ghost" onClick={()=>setForm({...DEFAULT_PLANNING})}>Réinitialiser</Btn>
        <Btn onClick={savePlanning}>{saved?"✓ Enregistré !":"Enregistrer"}</Btn>
      </div>
    </div>
  );
}


export default SemaineType;
