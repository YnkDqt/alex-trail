import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import { CS as C, localDate, fmtDate, daysUntil, isRunning, exportJSON, emptyObjectif } from "../../constants.js";
import { Btn, Modal, Field, FormGrid, ConfirmDialog } from "../../atoms.jsx";
// ─── OBJECTIFS ───────────────────────────────────────────────────────────────
function Objectifs({ objectifs, setObjectifs, seances, activites, vfcData, poids, profil, produits, recettes, allData }) {
  const [modalObj,     setModalObj]     = useState(false);
  const [formObj,      setFormObj]      = useState(emptyObjectif());
  const [editObjId,    setEditObjId]    = useState(null);
  const [confirmObjId, setConfirmObjId] = useState(null);
  const today = localDate(new Date());

  const updO = (k,v) => setFormObj(f=>({...f,[k]:v}));
  const saveObj = () => {
    if(editObjId) setObjectifs(oo=>oo.map(o=>o.id===editObjId?{...formObj,id:editObjId}:o));
    else setObjectifs(oo=>[...oo,{...formObj,id:Date.now()+Math.random()}]);
    setModalObj(false);
  };

  // ── Calcul jauge de préparation par course ──────────────────────────────────
  const calcPrep = (obj) => {
    if(!obj.date||!obj.distance) return null;
    const dist = parseFloat(obj.distance)||0;
    const dp   = parseFloat(obj.dp)||0;
    const j    = daysUntil(obj.date);
    if(j===null||j<0) return null;

    // Difficulté absolue de la course (score 0-1, pénalité croissante)
    // On distingue 3 niveaux : court (<30km), moyen (30-80km), ultra (>80km)
    const isUltra = dist > 80;
    const isLong  = dist > 30;

    // 1. Long run max 90j vs cible = 70% dist mais plafond strict selon catégorie
    const since90 = localDate(new Date(new Date().getTime()-90*86400000));
    const longRunMax = Math.max(0,...seances
      .filter(s=>s.date>=since90&&(s.statut==="Effectué"||s.statut==="Partiel")&&isRunning(s.activite))
      .map(s=>parseFloat(s.kmGarmin)||0));
    const longRunCible = dist*0.70;
    // Un ultra exige qu'on ait déjà fait au moins 50% de la distance en long run
    // sinon le score est plafonné durement
    const longRunRatio = longRunCible>0 ? longRunMax/longRunCible : 0;
    const longRunScore = isUltra
      ? (longRunMax < dist*0.40 ? longRunRatio*0.5 : Math.min(1, longRunRatio)) // pénalité doublée sous 40% dist
      : Math.min(1, longRunRatio);

    // 2. Volume D+ hebdo pour les courses à fort dénivelé
    const since28 = localDate(new Date(new Date().getTime()-28*86400000));
    const dpRecents = seances
      .filter(s=>s.date>=since28&&(s.statut==="Effectué"||s.statut==="Partiel")&&isRunning(s.activite))
      .reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0);
    const dpHebdoMoy = dpRecents/4;
    // Cible : 20% du D+ total par semaine (ex: 10000m → 2000m/sem)
    const dpCible = dp*0.20;
    const dpScore = dp>500 ? (dpCible>0 ? Math.min(1, dpHebdoMoy/dpCible) : 0) : 1; // ignoré si plat

    // 3. Volume km hebdo moyen vs cible
    const kmRecents = seances
      .filter(s=>s.date>=since28&&(s.statut==="Effectué"||s.statut==="Partiel")&&isRunning(s.activite))
      .reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0);
    const volHebdoMoy = kmRecents/4;
    const volCible = isUltra ? dist*0.20 : isLong ? dist*0.17 : dist*0.15;
    const volScore = volCible>0 ? Math.min(1, volHebdoMoy/volCible) : 0;

    // 4. VFC
    const lastV = [...vfcData].sort((a,b)=>b.date.localeCompare(a.date))[0];
    let vfcScore = 0.5;
    if(lastV?.vfc&&lastV?.moy7j) {
      const ratio = parseInt(lastV.vfc)/parseInt(lastV.moy7j);
      vfcScore = ratio>=0.97 ? 1 : ratio>=0.90 ? 0.7 : 0.3;
    }

    // 5. Charge (ratio aigu/chronique)
    let chargeScore = 0.5;
    if(lastV?.chargeAigue&&lastV?.chargeChronique) {
      const r = parseInt(lastV.chargeAigue)/parseInt(lastV.chargeChronique);
      chargeScore = r>=0.8&&r<=1.3 ? 1 : r>=0.6&&r<=1.5 ? 0.6 : 0.3;
    }

    // Pondération selon type de course
    let score;
    if(isUltra) {
      // Ultra : long run et D+ sont déterminants
      score = longRunScore*0.35 + dpScore*0.25 + volScore*0.20 + vfcScore*0.10 + chargeScore*0.10;
    } else if(isLong) {
      score = longRunScore*0.40 + dpScore*0.15 + volScore*0.25 + vfcScore*0.10 + chargeScore*0.10;
    } else {
      score = longRunScore*0.35 + volScore*0.35 + vfcScore*0.15 + chargeScore*0.15;
    }
    score = Math.round(score*100);

    const indicators = [
      { label:`Long run ${Math.round(longRunMax)}km / ${Math.round(longRunCible)}km cible`, ok: longRunScore>=0.7 },
      ...(dp>500 ? [{ label:`D+ hebdo ${Math.round(dpHebdoMoy)}m / ${Math.round(dpCible)}m cible`, ok: dpScore>=0.7 }] : []),
      { label:`Volume hebdo ${Math.round(volHebdoMoy)}km / ${Math.round(volCible)}km cible`, ok: volScore>=0.7 },
      { label:`VFC ${lastV?.vfc||"—"}ms`, ok: vfcScore>=0.7 },
    ];

    return { score, indicators, longRunMax, longRunCible, volHebdoMoy, dpHebdoMoy };
  };

  // ── Export Alex pour une course ─────────────────────────────────────────────
  const exportAlex = (obj) => {
    const lastV  = [...vfcData].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const lastS  = [...(allData.sommeil||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const lastP  = [...poids].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const bf     = lastP&&profil ? (()=>{
      const h=parseFloat(profil.taille)||180, ab=parseFloat(lastP.ventre)||0, neck=parseFloat(lastP.cou)||0;
      if(!ab||!neck||ab<=neck||h<=0) return null;
      if(profil.sexe==="Femme"){const hip=parseFloat(lastP.hanche)||0;if(!hip)return null;return Math.round((495/(1.29579-0.35004*Math.log10(ab+hip-neck)+0.22100*Math.log10(h))-450)*10)/10;}
      return Math.round((495/(1.0324-0.19077*Math.log10(ab-neck)+0.15456*Math.log10(h))-450)*10)/10;
    })() : null;

    // Allures Z2 depuis activités récentes
    const since60 = localDate(new Date(new Date().getTime()-60*86400000));
    const actZ2 = activites.filter(a=>a.dateHeure?.slice(0,10)>=since60&&["Trail","Course à pied"].includes(a.type)&&(parseFloat(a.z2)||0)>40);
    const z2Kmh = actZ2.length&&actZ2.some(a=>a.allure) ? Math.round(actZ2.filter(a=>a.allure).reduce((s,a)=>{const p=parseFloat(a.allure)||0;return s+(p>0?60/p:0);},0)/actZ2.filter(a=>a.allure).length*10)/10 : null;
    const z3Kmh = null; // non calculable directement

    const data = {
      _version: "stride-alex-1.0",
      _date: today,
      profil: {
        sexe: profil?.sexe||"Homme",
        taille: profil?.taille||180,
        dateNaissance: profil?.dateNaissance||null,
        age: profil?.dateNaissance ? Math.floor((new Date()-new Date(profil.dateNaissance))/31557600000) : null,
      },
      forme: {
        vfc: lastV?.vfc?parseInt(lastV.vfc):null,
        vfcBaseline: lastV?.baseline||null,
        vfcMoy7j: lastV?.moy7j?parseInt(lastV.moy7j):null,
        sommeilScore: lastS?.score?parseInt(lastS.score):null,
        poids: lastP?.poids?parseFloat(lastP.poids):null,
        pcMG: bf,
        vo2max: lastV?.vo2max?parseInt(lastV.vo2max):null,
        ratioCharge: lastV?.chargeAigue&&lastV?.chargeChronique?Math.round(parseInt(lastV.chargeAigue)/parseInt(lastV.chargeChronique)*100)/100:null,
        chargeAigue: lastV?.chargeAigue?parseInt(lastV.chargeAigue):null,
        chargeChronique: lastV?.chargeChronique?parseInt(lastV.chargeChronique):null,
      },
      zonesFC: lastV?{
        z1:[null,parseInt(lastV.z1fin)||null],
        z2:[parseInt(lastV.z2debut)||null,parseInt(lastV.z2fin)||null],
        z3:[parseInt(lastV.z3debut)||null,parseInt(lastV.z3fin)||null],
        z4:[parseInt(lastV.z4debut)||null,parseInt(lastV.z4fin)||null],
        z5:[parseInt(lastV.z5debut)||null,null],
        fcMax:parseInt(lastV.fcMax)||null,
      }:null,
      allures: { z2Kmh, z3Kmh },
      tempsParZone: actZ2.length ? (()=>{
        const avg=(k)=>Math.round(actZ2.reduce((s,a)=>(s+(parseFloat(a[k])||0)),0)/actZ2.length*100)/100;
        return {z1:avg("z1")/100,z2:avg("z2")/100,z3:avg("z3")/100,z4:avg("z4")/100,z5:avg("z5")/100};
      })() : null,
      objectifCourse: {
        nom: obj.nom,
        date: obj.date,
        distanceKm: parseFloat(obj.distance)||null,
        denivelPos: parseFloat(obj.dp)||null,
      },
      produits: (produits||[]).map(p=>({
        nom:p.nom, poids:parseFloat(p.poids)||null, par100g:!!p.par100g, boisson:!!p.boisson,
        volumeMl:p.volumeMl?parseFloat(p.volumeMl):null,
        kcal:parseFloat(p.kcal)||null, proteines:parseFloat(p.proteines)||null,
        lipides:parseFloat(p.lipides)||null, glucides:parseFloat(p.glucides)||null,
        sodium:parseFloat(p.sodium)||null, potassium:parseFloat(p.potassium)||null,
        magnesium:parseFloat(p.magnesium)||null, zinc:parseFloat(p.zinc)||null,
        calcium:parseFloat(p.calcium)||null,
      })),
      recettes: (recettes||[]).map(r=>{
        const portions = parseFloat(r.portions)||1;
        const macro=(k)=>r[k]?Math.round(parseFloat(r[k])/portions*10)/10:null;
        return {
          nom:r.nom, portions, poids:parseFloat(r.poids)||null, par100g:!!r.par100g,
          boisson:!!r.boisson, volumeMl:r.volumeMl?parseFloat(r.volumeMl):null,
          kcal:macro("kcal"), proteines:macro("proteines"), lipides:macro("lipides"),
          glucides:macro("glucides"), sodium:macro("sodium"), potassium:macro("potassium"),
          magnesium:macro("magnesium"), zinc:macro("zinc"), calcium:macro("calcium"),
          notes:r.notes||null,
        };
      }),
    };
    exportJSON(data, `stride-alex-${obj.nom.replace(/\s+/g,"-").toLowerCase()}-${today}.json`);
  };

  // ── Couleurs par priorité ────────────────────────────────────────────────────
  const prioStyle = (p) => ({
    A: { border:"#C4521A", bg:"#FAF0E8", head:"#993C1D", pill:"#E8F2EC", pillTxt:"#085041", countdown:"#F5C4B3", countdownTxt:"#712B13" },
    B: { border:"#BA7517", bg:"#FDF6E3", head:"#854F0B", pill:"#FAEEDA", pillTxt:"#633806", countdown:"#FAC775", countdownTxt:"#412402" },
    C: { border:"#888780", bg:"#F1EFE8", head:"#5F5E5A", pill:"#F1EFE8", pillTxt:"#444441", countdown:"#D3D1C7", countdownTxt:"#2C2C2A" },
  }[p||"A"]);

  const scoreColor = (s) => s>=70?C.green:s>=45?C.yellow:C.red;

  // ── Timeline ────────────────────────────────────────────────────────────────
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd   = new Date(year, 11, 31, 23, 59, 59).getTime();
  const yearSpan  = yearEnd - yearStart;
  const dateToPct = (dateStr) => {
    const [y,m,d] = (dateStr||"").split("-").map(Number);
    if(!y||!m||!d) return 0;
    const t = new Date(y, m-1, d).getTime();
    return Math.max(0, Math.min(100, (t - yearStart) / yearSpan * 100));
  };
  const todayPct = dateToPct(today);

  const sorted = [...objectifs].sort((a,b)=>new Date(a.date)-new Date(b.date));

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Objectifs</h1>
          <p style={{fontSize:12,color:C.muted}}>
            Saison {year}
            {sorted.length>0&&` · ${sorted.length} course${sorted.length>1?"s":""} · ${sorted.reduce((s,o)=>s+(parseFloat(o.distance)||0),0)}km cumulés`}
          </p>
        </div>
        <Btn onClick={()=>{setEditObjId(null);setFormObj(emptyObjectif());setModalObj(true);}}>＋ Ajouter une course</Btn>
      </div>

      {/* Timeline saison */}
      {sorted.length>0&&(
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 20px",marginBottom:20}}>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted,marginBottom:10}}>Saison {year}</div>
          <div style={{position:"relative",height:44}}>
            <div style={{position:"absolute",top:14,left:0,right:0,height:2,background:C.border,borderRadius:1}}/>
            {/* Mois */}
            {["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"].map((m,i)=>{
              const pct = dateToPct(`${year}-${String(i+1).padStart(2,"0")}-01`);
              const hasRace=sorted.some(o=>o.date&&new Date(o.date).getMonth()===i&&new Date(o.date).getFullYear()===year);
              return (
                <span key={m} style={{position:"absolute",top:0,left:`${pct}%`,transform:"translateX(-50%)",fontSize:9,color:hasRace?C.summit:C.muted,fontWeight:hasRace?600:400,userSelect:"none"}}>
                  {m}
                </span>
              );
            })}
            {/* Aujourd'hui */}
            <div style={{position:"absolute",top:6,left:`${todayPct}%`,width:2,height:18,background:C.forest,borderRadius:1}}/>
            {/* Courses */}
            {sorted.map(obj=>{
              if(!obj.date) return null;
              const d=new Date(obj.date);
              if(d.getFullYear()!==year) return null;
              const pct = dateToPct(obj.date);
              const ps = prioStyle(obj.priorite);
              return (
                <div key={obj.id} style={{position:"absolute",top:7,left:`${pct}%`,transform:"translateX(-50%)"}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:ps.border,border:`2px solid ${C.white}`}}/>
                  <div style={{position:"absolute",top:14,left:"50%",transform:"translateX(-50%)",fontSize:8,fontWeight:600,color:ps.head,whiteSpace:"nowrap"}}>{obj.nom?.split(" ")[0]}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cartes */}
      {sorted.length===0?(
        <div style={{textAlign:"center",padding:"80px 20px",color:C.muted}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:48,marginBottom:14}}>🏔</div>
          <div style={{fontSize:18,fontWeight:500,color:C.inkLight,marginBottom:6}}>Aucun objectif</div>
          <div style={{fontSize:13,marginBottom:20}}>Ajoute tes courses pour activer le suivi de préparation</div>
          <Btn onClick={()=>{setEditObjId(null);setFormObj(emptyObjectif());setModalObj(true);}}>＋ Ajouter une course</Btn>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))",gap:16,marginBottom:24}}>
          {sorted.map(obj=>{
            const j=daysUntil(obj.date);
            const prep=calcPrep(obj);
            const phase=j===null?"":j>90?"Fondamental":j>42?"Spécifique":j>14?"Affûtage":j>0?"Tapering":j===0?"Jour J":"Terminé";
            const ps=prioStyle(obj.priorite);
            const isPast=j!==null&&j<0;
            return (
              <div key={obj.id} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",borderLeft:`3px solid ${ps.border}`}}>

                {/* Header */}
                <div style={{background:ps.bg,padding:"16px 18px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:ps.pill,color:ps.pillTxt}}>Priorité {obj.priorite||"A"}</span>
                      {obj.statut&&<span style={{fontSize:10,color:ps.head}}>{obj.statut}</span>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      {j!==null&&j>=0&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600,color:ps.countdownTxt,background:ps.countdown,padding:"2px 8px",borderRadius:8}}>{j}j</span>}
                      {isPast&&<span style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>Terminé</span>}
                      <button onClick={e=>{e.stopPropagation();setEditObjId(obj.id);setFormObj({...emptyObjectif(),...obj});setModalObj(true);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:ps.head,fontSize:12,padding:0}}>✎</button>
                      <button onClick={e=>{e.stopPropagation();setConfirmObjId(obj.id);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                    </div>
                  </div>
                  <h2 style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:ps.head,marginBottom:2,lineHeight:1.2}}>{obj.nom}</h2>
                  <p style={{fontSize:12,color:ps.head,opacity:.8,display:"flex",alignItems:"center",gap:8}}>
                    {fmtDate(obj.date)}{obj.region?` · ${obj.region}`:""}{phase?` · ${phase}`:""}
                    {obj.lien&&<a href={obj.lien} target="_blank" rel="noopener noreferrer"
                      onClick={e=>e.stopPropagation()}
                      style={{fontSize:10,padding:"1px 7px",borderRadius:8,background:ps.countdown,
                        color:ps.countdownTxt,textDecoration:"none",fontWeight:500,flexShrink:0}}>
                      Site officiel ↗
                    </a>}
                  </p>
                </div>

                {/* Stats */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:`0.5px solid ${C.border}`}}>
                  {[
                    {l:"Distance",v:obj.distance?`${obj.distance} km`:"—"},
                    {l:"D+",v:obj.dp?`${obj.dp} m`:"—"},
                    {l:"Objectif",v:obj.temps||"Finisher"},
                  ].map(({l,v})=>(
                    <div key={l} style={{padding:"10px 14px",borderRight:`0.5px solid ${C.border}`}}>
                      <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".05em",color:C.muted,marginBottom:2}}>{l}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,color:C.inkLight}}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Jauge préparation */}
                {prep&&!isPast&&(
                  <div style={{padding:"12px 16px",borderBottom:`0.5px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:11,color:C.muted}}>Niveau de préparation</span>
                      <span style={{fontSize:13,fontWeight:500,color:scoreColor(prep.score)}}>{prep.score}%</span>
                    </div>
                    <div style={{height:5,background:C.stone,borderRadius:3,overflow:"hidden",marginBottom:8}}>
                      <div style={{width:`${prep.score}%`,height:"100%",background:scoreColor(prep.score),borderRadius:3,transition:"width .5s"}}/>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {prep.indicators.map((ind,i)=>(
                        <span key={i} style={{fontSize:10,color:ind.ok?C.green:C.yellow}}>
                          {ind.ok?"●":"○"} {ind.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section Alex */}
                <div style={{padding:"10px 16px",background:C.stone,display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:11,color:C.muted,flex:1}}>Stratégie de course avec Alex</span>
                  <a href="https://alex-trail.vercel.app" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
                    <Btn variant="summit" size="sm">Ouvrir Alex →</Btn>
                  </a>
                  <Btn variant="sage" size="sm" onClick={()=>exportAlex(obj)}>⬇ Export</Btn>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Bandeau Alex */}
      <div style={{background:C.white,border:`1px solid ${C.summitPale||"#FAF0E8"}`,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:36,height:36,borderRadius:8,background:"#FAF0E8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏔</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:500,color:C.inkLight,marginBottom:2}}>Préparer une course avec Alex</div>
          <div style={{fontSize:11,color:C.muted}}>Alex analyse ton GPX, calcule ta stratégie de pace et gère ta nutrition de course. Exporte tes données Stride pour qu'Alex personnalise ses recommandations.</div>
        </div>
        <a href="https://alex-trail.vercel.app" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",flexShrink:0}}>
          <Btn variant="summit">Ouvrir Alex →</Btn>
        </a>
      </div>

      <ConfirmDialog open={!!confirmObjId} message="Supprimer cet objectif ?" onConfirm={()=>{setObjectifs(oo=>oo.filter(o=>o.id!==confirmObjId));setConfirmObjId(null);}} onCancel={()=>setConfirmObjId(null)}/>

      <Modal open={modalObj} onClose={()=>setModalObj(false)} title={editObjId?"Modifier la course":"Nouvelle course objectif"} width={480}>
        <FormGrid>
          <Field label="Nom" full><input value={formObj.nom} onChange={e=>updO("nom",e.target.value)} placeholder="Verdon Canyon Challenge"/></Field>
          <Field label="Date"><input type="date" value={formObj.date} onChange={e=>updO("date",e.target.value)}/></Field>
          <Field label="Priorité">
            <select value={formObj.priorite||"A"} onChange={e=>updO("priorite",e.target.value)}>
              <option value="A">A — Principal</option><option value="B">B — Préparatoire</option><option value="C">C — Test</option>
            </select>
          </Field>
          <Field label="Statut">
            <select value={formObj.statut} onChange={e=>updO("statut",e.target.value)}>
              {["À venir","Inscrit","Terminé","Abandonné"].map(s=><option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Distance (km)"><input type="number" value={formObj.distance} onChange={e=>updO("distance",e.target.value)}/></Field>
          <Field label="D+ (m)"><input type="number" value={formObj.dp} onChange={e=>updO("dp",e.target.value)}/></Field>
          <Field label="Temps objectif"><input value={formObj.temps} onChange={e=>updO("temps",e.target.value)} placeholder="6h30"/></Field>
          <Field label="Région"><input value={formObj.region||""} onChange={e=>updO("region",e.target.value)} placeholder="Verdon, France"/></Field>
          <Field label="Lien officiel" full><input value={formObj.lien||""} onChange={e=>updO("lien",e.target.value)} placeholder="https://..."/></Field>
        </FormGrid>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setModalObj(false)}>Annuler</Btn>
          <Btn onClick={saveObj}>{editObjId?"Enregistrer":"Ajouter"}</Btn>
        </div>
      </Modal>
    </div>
  );
}


export default Objectifs;
