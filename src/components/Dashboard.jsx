import React, { useMemo } from "react";
import { C, localDate, daysUntil, isRunning, actColor } from "../constants.js";

// Palette Course (pour le bloc "Stratégie en cours")
const COURSE_C = { 
  primary: "#7C5C3E", 
  primaryPale: "#F0E8DC", 
  primaryDeep: "#4E3726" 
};

function Dashboard({ setView, seances, vfcData, sommeil, poids, objectifs, race, settings, profilType, setProfilType }) {
  const today = localDate(new Date());
  const lastVFC     = useMemo(()=>[...vfcData].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[vfcData]);
  const lastSommeil = useMemo(()=>[...sommeil].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[sommeil]);
  const lastPoids   = useMemo(()=>[...poids].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[poids]);
  const nextObj     = useMemo(()=>[...objectifs].filter(o=>o.date>=today).sort((a,b)=>new Date(a.date)-new Date(b.date))[0]||null,[objectifs,today]);

  const formeScore = useMemo(()=>{
    const vfc=lastVFC?parseInt(lastVFC.vfc)||0:0;
    const base=lastVFC?.baseline?parseInt(lastVFC.baseline.match(/(\d+)ms/)?.[1]||70):70;
    const som=lastSommeil?parseInt(lastSommeil.score)||0:0;
    const bb=lastSommeil?parseInt(lastSommeil.bodyBatteryMatin)||0:0;
    const ratio=lastVFC?.chargeAigue&&lastVFC?.chargeChronique?parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique):1;
    let s=0;
    if(vfc>=base*0.9)s+=2;else if(vfc>=base*0.75)s+=1;
    if(som>=80)s+=2;else if(som>=65)s+=1;
    if(bb>=70)s+=2;else if(bb>=45)s+=1;
    if(ratio<=1.2)s+=1;else if(ratio>1.4)s-=1;
    return s;
  },[lastVFC,lastSommeil]);

  const formeColor = formeScore>=5?C.green:formeScore>=3?C.yellow:C.red;
  const formeLabel = formeScore>=5?"Bonne forme":formeScore>=3?"Forme moyenne":"Récupération";
  const j     = nextObj?daysUntil(nextObj.date):null;
  const phase = j===null?null:j>90?"Fondamental":j>42?"Spécifique":j>14?"Affûtage":j>0?"Tapering":"Course !";
  const phaseColor = j===null?C.muted:j>90?C.sky:j>42?"#e65100":j>14?C.yellow:j>0?C.summit:C.green;
  const ratio = lastVFC?.chargeAigue&&lastVFC?.chargeChronique
    ?Math.round(parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique)*100)/100:null;

  const weeklyKm = useMemo(()=>{
    const now=new Date(); const dow=(now.getDay()+6)%7;
    const thisMon=new Date(now); thisMon.setDate(now.getDate()-dow);
    return Array.from({length:12},(_,i)=>{
      const mon=new Date(thisMon); mon.setDate(thisMon.getDate()-(11-i)*7);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      const monStr=localDate(mon); const sunStr=localDate(sun);
      const ws=seances.filter(s=>s.date>=monStr&&s.date<=sunStr&&s.statut==="Effectué"&&isRunning(s.activite));
      return {
        label:i===11?"Sem.":i===5?"S-6":`S-${11-i}`,
        km:Math.round(ws.reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0)*10)/10,
        dp:Math.round(ws.reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0)),
      };
    });
  },[seances]);
  const maxKm=Math.max(...weeklyKm.map(w=>w.km),1);

  const prepScore = useMemo(()=>{
    if(!nextObj||j===null) return null;
    const raceKm=parseFloat(nextObj.distance)||0;
    const raceDp=parseFloat(nextObj.dp)||0;
    const longMax=Math.max(0,...seances.filter(s=>s.statut==="Effectué"&&isRunning(s.activite)).map(s=>parseFloat(s.kmGarmin)||0));
    const last8=weeklyKm.slice(-8);
    const dpMoy=last8.length?Math.round(last8.reduce((s,w)=>s+w.dp,0)/last8.length):0;
    const dpCible=raceDp>0?Math.round(raceDp/8):0;
    let score=0;
    if(raceKm>0) score+=(longMax>=raceKm*0.7?1:longMax>=raceKm*0.5?0.5:0);
    if(raceDp>0) score+=(dpMoy>=dpCible*0.8?1:dpMoy>=dpCible*0.5?0.5:0);
    score+=formeScore>=5?1:formeScore>=3?0.5:0;
    const pct=Math.round(score/3*100);
    return {pct,longMax,raceKm,dpMoy,dpCible,label:pct>=75?"En bonne voie":pct>=50?"À surveiller":"Insuffisant"};
  },[nextObj,j,seances,weeklyKm,formeScore]);

  const todaySeances=seances.filter(s=>s.date===today&&s.activite!=="Repos");
  const hasRaceGpx=!!(race?.gpxPoints?.length);
  const card={background:C.white,border:`1px solid ${C.border}`,borderRadius:14};
  const lbl={fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:C.muted,marginBottom:8,display:"block"};

  return (
    <div style={{maxWidth:1180,margin:"0 auto",padding:"28px 24px 60px"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Fraunces',serif",fontSize:26,fontWeight:500,color:C.inkLight,letterSpacing:"-0.02em",lineHeight:1.2}}>
          Tableau de bord
        </h1>
        {nextObj&&j!==null&&(
          <div style={{fontSize:13,color:C.muted,marginTop:4}}>
            <span style={{fontWeight:600,color:phaseColor}}>{phase}</span>
            {" · "}{nextObj.nom} dans{" "}
            <span style={{fontWeight:600,color:C.inkLight}}>{j} jour{j>1?"s":""}</span>
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:14}}>
        {/* Forme */}
        <div style={{...card,padding:"16px 18px",borderTop:`3px solid ${formeColor}`}}>
          <span style={lbl}>Forme du jour</span>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:formeColor,marginBottom:10}}>{formeLabel}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[{l:"VFC",v:lastVFC?.vfc,u:"ms"},{l:"Sommeil",v:lastSommeil?.score,u:"/100"},{l:"Charge",v:ratio,u:""},{l:"Poids",v:lastPoids?.poids,u:"kg"}].map(({l,v,u})=>(
              <div key={l} style={{background:C.bg,borderRadius:8,padding:"7px 10px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:2}}>{l}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,color:v?C.inkLight:C.stoneDark}}>
                  {v||"—"}{v&&u?<span style={{fontSize:10,color:C.muted}}> {u}</span>:""}
                </div>
              </div>
            ))}
          </div>
          {!lastVFC&&!lastSommeil&&(
            <div style={{marginTop:10,fontSize:12,color:C.muted}}>
              <span onClick={()=>setView("forme")} style={{color:C.forest,cursor:"pointer",fontWeight:500}}>Importer les données Garmin →</span>
            </div>
          )}
        </div>

        {/* Course countdown */}
        <div style={{...card,padding:"16px 18px",borderTop:`3px solid ${phaseColor}`}}>
          <span style={lbl}>Prochaine course</span>
          {nextObj?(
            <>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:500,color:C.inkLight,marginBottom:4}}>{nextObj.nom||"Course"}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:32,fontWeight:500,color:phaseColor,lineHeight:1,marginBottom:6}}>J-{j}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:10}}>
                {nextObj.distance&&`${nextObj.distance} km`}{nextObj.dp&&` · ${nextObj.dp} m D+`}
              </div>
              <div style={{display:"flex",gap:2,height:5,borderRadius:3,overflow:"hidden",marginBottom:4}}>
                {[{max:180,min:90,col:C.sky},{max:90,min:42,col:"#e65100"},{max:42,min:14,col:C.yellow},{max:14,min:0,col:C.summit}].map(({max,min,col})=>{
                  const active=j!==null&&j<=max&&j>min;
                  return <div key={min} style={{flex:max-min,background:active?col:col+"33",borderRadius:2}}/>;
                })}
              </div>
              <div style={{fontSize:10,color:phaseColor,fontWeight:600,marginBottom:10}}>{phase}</div>
              <button onClick={()=>setView("objectifs")}
                style={{fontSize:11,padding:"4px 10px",borderRadius:7,border:`1px solid ${C.border}`,
                  background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
                Gérer les objectifs →
              </button>
              {prepScore&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:4}}>
                    <span>Préparation</span><span style={{fontWeight:600,color:prepScore.pct>=75?C.green:prepScore.pct>=50?C.yellow:C.red}}>{prepScore.pct}%</span>
                  </div>
                  <div style={{height:5,borderRadius:3,background:C.stone}}>
                    <div style={{height:"100%",borderRadius:3,width:`${prepScore.pct}%`,
                      background:prepScore.pct>=75?C.green:prepScore.pct>=50?C.yellow:C.red,transition:"width .4s"}}/>
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>{prepScore.label}</div>
                </div>
              )}
            </>
          ):(
            <div>
              <div style={{fontSize:13,color:C.muted,fontStyle:"italic",marginBottom:12}}>Aucune course planifiée</div>
              <button onClick={()=>setView("objectifs")}
                style={{fontSize:12,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.border}`,
                  background:"transparent",color:C.inkLight,cursor:"pointer",fontFamily:"inherit"}}>
                Ajouter un objectif →
              </button>
            </div>
          )}
        </div>

        {/* Aujourd'hui */}
        <div style={{...card,padding:"16px 18px",borderTop:`3px solid ${C.forest}`}}>
          <span style={lbl}>Aujourd'hui</span>
          {todaySeances.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:10}}>
              {todaySeances.slice(0,3).map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,background:C.bg}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:actColor(s.activite),flexShrink:0}}/>
                  <div style={{flex:1,fontSize:12,fontWeight:500,color:C.inkLight,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.activite}</div>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:6,background:s.statut==="Effectué"?C.greenPale:C.stone,color:s.statut==="Effectué"?C.green:C.muted,fontWeight:500}}>{s.statut}</span>
                </div>
              ))}
              {todaySeances.length>3&&<div style={{fontSize:11,color:C.muted,textAlign:"center"}}>+{todaySeances.length-3} autres</div>}
            </div>
          ):(
            <div style={{fontSize:13,color:C.muted,fontStyle:"italic",marginBottom:12}}>Repos ou journée libre</div>
          )}
          <button onClick={()=>setView("entrainement")}
            style={{fontSize:12,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.border}`,
              background:"transparent",color:"#1D9E75",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>
            Voir le programme →
          </button>
        </div>
      </div>

      {/* Graphique km 12 semaines - FIX: height augmenté 80→120 */}
      <div style={{...card,padding:"16px 20px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{...lbl,marginBottom:0}}>Charge trail · 12 semaines</span>
          <div style={{display:"flex",gap:16,fontSize:11,color:C.muted}}>
            <span><b style={{color:C.inkLight}}>{weeklyKm.reduce((s,w)=>s+w.km,0).toFixed(0)} km</b> total</span>
            <span><b style={{color:C.inkLight}}>{weeklyKm.reduce((s,w)=>s+w.dp,0).toLocaleString()} m</b> D+</span>
          </div>
        </div>
        <div style={{display:"flex",gap:3,alignItems:"flex-end",height:140}}>
          {weeklyKm.map((w,i)=>{
            const h=Math.max(3,Math.round((w.km/maxKm)*130));
            const isLast=i===11;
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{fontSize:8,color:C.muted,fontFamily:"'DM Mono',monospace",opacity:w.km>0?1:0}}>
                  {w.km>0?w.km:""}
                </div>
                <div title={`${w.km} km · ${w.dp}m D+`}
                  style={{width:"100%",height:h,borderRadius:"3px 3px 0 0",
                    background:isLast?C.forest:w.km>0?C.forestPale:C.stone,
                    border:isLast?`1px solid ${C.forest}`:"none",
                    cursor:"default",transition:"height .3s"}}/>
                <div style={{fontSize:8,color:isLast?C.forest:C.stoneDeep,fontWeight:isLast?600:400,
                  minHeight:10,textAlign:"center",whiteSpace:"nowrap"}}>
                  {i===0||i===5||i===11?w.label:""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stratégie course active */}
      {hasRaceGpx&&(
        <div style={{...card,padding:"16px 20px",borderLeft:`3px solid ${COURSE_C.primary}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <span style={{...lbl,color:COURSE_C.primary}}>Stratégie en cours</span>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:500,color:C.inkLight}}>
              {settings?.raceName||race?.name||"Course sans nom"}
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              {race.totalDistance?.toFixed(1)} km · {Math.round(race.totalElevPos||0)} m D+
              {settings?.startTime&&` · Départ ${settings.startTime}`}
            </div>
          </div>
          <button onClick={()=>setView("profil_course")}
            style={{fontSize:13,padding:"8px 16px",borderRadius:10,border:`1px solid ${COURSE_C.primary}`,
              background:COURSE_C.primaryPale,color:COURSE_C.primaryDeep,cursor:"pointer",fontFamily:"inherit",fontWeight:500,whiteSpace:"nowrap"}}>
            Voir la stratégie →
          </button>
        </div>
      )}

      {/* Bloc sélection profil */}
      <div style={{...card,padding:"20px 24px",marginTop:14}}>
        <span style={lbl}>Choix du profil</span>
        <div style={{fontSize:13,color:C.muted,marginBottom:16,lineHeight:1.5}}>
          Personnalise l'affichage des onglets selon ton utilisation principale
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:12}}>
          {[
            {type:"full",icon:"📊",label:"Entraînement + Course",desc:"Tous les onglets visibles",color:C.forest},
            {type:"training_only",icon:"🏃",label:"Entraînement uniquement",desc:"Masque onglets Course",color:C.summit},
            {type:"course_prep",icon:"🏔️",label:"Préparer une course",desc:"Focus Course + essentiels",color:COURSE_C.primary},
            {type:"team",icon:"👥",label:"Suivre un coureur",desc:"Mode Team simplifié",color:C.sky}
          ].map(p=>(
            <div key={p.type} onClick={()=>setProfilType(p.type)}
              style={{
                padding:16,
                border:`2px solid ${profilType===p.type?p.color:C.border}`,
                borderRadius:12,
                cursor:"pointer",
                transition:"all .2s",
                background:profilType===p.type?`${p.color}08`:C.white
              }}
              onMouseEnter={e=>{if(profilType!==p.type){e.currentTarget.style.borderColor=p.color;e.currentTarget.style.background=C.stone}}}
              onMouseLeave={e=>{if(profilType!==p.type){e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.white}}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <span style={{fontSize:24}}>{p.icon}</span>
                <div style={{fontWeight:600,fontSize:14,color:profilType===p.type?p.color:C.inkLight}}>{p.label}</div>
              </div>
              <div style={{fontSize:12,color:C.muted,lineHeight:1.4}}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
