import React, { useState, useMemo, useEffect, useRef } from "react";
import { CS as C, localDate, daysUntil, isRunning, actColor, actShort, actColorPale, fmtDate } from "../../stride/constants.js";
import { Btn } from "../../stride/atoms.jsx";
function Dashboard({ seances, objectifs, sommeil, vfcData, poids, activites, setView }) {
  const today   = localDate(new Date());
  const nowMkey = today.slice(0,7);

  const lastVFC     = useMemo(()=>[...vfcData].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[vfcData]);
  const lastSommeil = useMemo(()=>[...sommeil].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[sommeil]);

  // ── Forme du jour ──────────────────────────────────────────────
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
  const formeColor=formeScore>=5?C.green:formeScore>=3?C.yellow:C.red;
  const formePale =formeScore>=5?C.greenPale:formeScore>=3?C.yellowPale:C.redPale;
  const formeLabel=formeScore>=5?"Bonne forme":formeScore>=3?"Forme moyenne":"Récupération";
  const formeEmoji=formeScore>=5?"🟢":formeScore>=3?"🟡":"🔴";

  // ── Objectif & phase ────────────────────────────────────────────
  const nextObj = useMemo(()=>[...objectifs].filter(o=>o.date>=today).sort((a,b)=>new Date(a.date)-new Date(b.date))[0]||null,[objectifs,today]);
  const j=nextObj?daysUntil(nextObj.date):null;
  const phase=j===null?null:j>90?"Fondamental":j>42?"Spécifique":j>14?"Affûtage":j>0?"Tapering":"Terminé";
  const phaseColor=j===null?C.muted:j>90?C.sky:j>42?"#e65100":j>14?C.yellow:j>0?C.summit:C.muted;
  const phasePale=j===null?"transparent":j>90?C.skyPale:j>42?"#fff3e0":j>14?C.yellowPale:j>0?C.summitPale:"transparent";

  // Barre runway : % du chemin parcouru entre J-ref et course
  const runwayPct = useMemo(()=>{
    if(!nextObj) return 0;
    const totalDays = 180; // ~6 mois de prépa type
    const elapsed = Math.max(0, totalDays - (j||0));
    return Math.min(100, Math.round(elapsed/totalDays*100));
  },[j,nextObj]);

  // ── Ratio charge ────────────────────────────────────────────────
  const ratio=lastVFC?.chargeAigue&&lastVFC?.chargeChronique?Math.round(parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique)*100)/100:null;
  const ratioColor=ratio===null?C.muted:ratio>1.4?C.red:ratio>1.2?C.yellow:ratio<0.8?C.sky:C.green;

  // ── Semaine courante ────────────────────────────────────────────
  const weekDays=useMemo(()=>{
    const d=new Date(); const dow=(d.getDay()+6)%7;
    const mon=new Date(d); mon.setDate(d.getDate()-dow);
    return Array.from({length:7},(_,i)=>{
      const day=new Date(mon); day.setDate(mon.getDate()+i);
      const dateStr=localDate(day);
      const runSeances=seances.filter(s=>s.date===dateStr&&isRunning(s.activite));
      const kmDay=Math.round(runSeances.filter(s=>s.statut==="Effectué").reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0)*10)/10;
      const dpDay=Math.round(runSeances.filter(s=>s.statut==="Effectué").reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0));
      const hasDone=runSeances.some(s=>s.statut==="Effectué");
      const hasPlan=seances.some(s=>s.date===dateStr&&s.activite!=="Repos"&&s.statut==="Planifié");
      const allSeances=seances.filter(s=>s.date===dateStr&&s.activite!=="Repos");
      const types=[...new Set(allSeances.map(s=>s.activite))];
      return {label:["Lu","Ma","Me","Je","Ve","Sa","Di"][i],dateStr,hasDone,hasPlan,
        isTod:dateStr===today,isPast:dateStr<today,types,kmDay,dpDay};
    });
  },[seances,today]);
  const weekEff=weekDays.filter(d=>d.hasDone);
  const weekKm=Math.round(weekDays.reduce((s,d)=>s+d.kmDay,0)*10)/10;
  const weekDp=weekDays.reduce((s,d)=>s+d.dpDay,0);
  const weekPlan=weekDays.filter(d=>d.hasPlan).length;

  // ── 12 semaines glissantes ──────────────────────────────────────
  const twelveWeeks=useMemo(()=>{
    const result=[];
    const d=new Date();
    const dow=(d.getDay()+6)%7;
    const thisMon=new Date(d); thisMon.setDate(d.getDate()-dow);
    for(let w=11;w>=0;w--){
      const mon=new Date(thisMon); mon.setDate(thisMon.getDate()-w*7);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      const monStr=localDate(mon); const sunStr=localDate(sun);
      const wSeances=seances.filter(s=>s.date>=monStr&&s.date<=sunStr&&s.statut==="Effectué"&&isRunning(s.activite));
      const km=Math.round(wSeances.reduce((s,a)=>s+(parseFloat(a.kmGarmin)||0),0)*10)/10;
      const dp=Math.round(wSeances.reduce((s,a)=>s+(parseFloat(a.dpGarmin)||0),0));
      // VFC moy de la semaine
      const wVfc=vfcData.filter(v=>v.date>=monStr&&v.date<=sunStr);
      const vfcMoy=wVfc.length?Math.round(wVfc.reduce((s,v)=>s+(parseInt(v.vfc)||0),0)/wVfc.length):null;
      // Phase selon J restants au milieu de la semaine
      const midDate=new Date(mon); midDate.setDate(mon.getDate()+3);
      const jMid=nextObj?Math.round((new Date(nextObj.date)-midDate)/86400000):null;
      const ph=jMid===null?0:jMid>90?0:jMid>42?1:jMid>14?2:3;
      const label=w===0?"Cette sem.":`S-${w}`;
      result.push({label,km,dp,vfcMoy,phase:ph});
    }
    return result;
  },[seances,vfcData,nextObj]);

  // ── Données pour nuage D+ × VFC ─────────────────────────────────
  const scatterData=useMemo(()=>twelveWeeks.filter(w=>w.dp>0&&w.vfcMoy).map(w=>({x:w.dp,y:w.vfcMoy,label:w.label})),[twelveWeeks]);

  // ── Prévision course ────────────────────────────────────────────
  const prevision=useMemo(()=>{
    if(!nextObj) return null;
    const raceDp=parseFloat(nextObj.dp)||0;
    const raceKm=parseFloat(nextObj.distance)||0;
    const ratioCourse=raceKm>0?Math.round(raceDp/raceKm):0;
    // Long run max
    const longRunMax=Math.max(0,...seances.filter(s=>s.statut==="Effectué"&&isRunning(s.activite)).map(s=>parseFloat(s.kmGarmin)||0));
    // Sorties > 1000m D+
    const sortiesDP=seances.filter(s=>s.statut==="Effectué"&&isRunning(s.activite)&&(parseFloat(s.dpGarmin)||0)>=1000).length;
    const sortiesDPReq=raceDp>1500?2:raceDp>800?1:0;
    // D+ semaine moyen (8 dernières semaines)
    const last8=twelveWeeks.slice(-8);
    const dpMoySem=last8.length?Math.round(last8.reduce((s,w)=>s+w.dp,0)/last8.length):0;
    const dpCibleSem=Math.round(raceDp/8);
    // Charge chronique
    const chargeOk=lastVFC?.chargeChronique?parseInt(lastVFC.chargeChronique)>200:false;
    // VFC trend (3 dernières semaines vs 3 précédentes)
    const vfcLast3=vfcData.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,3);
    const vfcMoyLast3=vfcLast3.length?Math.round(vfcLast3.reduce((s,v)=>s+(parseInt(v.vfc)||0),0)/vfcLast3.length):0;
    // Score global
    let score=0;
    if(longRunMax>=raceKm*0.7)score+=2; else if(longRunMax>=raceKm*0.5)score+=1;
    if(sortiesDP>=sortiesDPReq)score+=2; else if(sortiesDP>0)score+=1;
    if(dpMoySem>=dpCibleSem*0.8)score+=2; else if(dpMoySem>=dpCibleSem*0.5)score+=1;
    if(chargeOk)score+=1;
    if(vfcMoyLast3>60)score+=1;
    const verdict=score>=7?"En bonne voie":score>=4?"Préparation à risque":"Préparation insuffisante";
    const verdictColor=score>=7?C.green:score>=4?C.yellow:C.red;
    const verdictPale=score>=7?C.greenPale:score>=4?C.yellowPale:C.redPale;
    // Recommandations
    const recs=[];
    if(longRunMax<raceKm*0.7)recs.push(`Long run max ${Math.round(longRunMax)}km — viser ${Math.round(raceKm*0.7)}km avant la course`);
    if(sortiesDP<sortiesDPReq)recs.push(`${sortiesDPReq-sortiesDP} sortie(s) > 1000m D+ manquante(s) pour préparer le dénivelé`);
    if(dpMoySem<dpCibleSem*0.8)recs.push(`D+ hebdo moyen ${dpMoySem}m vs ${dpCibleSem}m cible — augmenter progressivement`);
    if(ratio&&ratio>1.3)recs.push(`Ratio de charge ${ratio} — semaine allégée recommandée avant de reprendre`);
    if(recs.length===0)recs.push("Continue sur cette lancée — la préparation est solide");
    return {verdict,verdictColor,verdictPale,score,longRunMax,raceKm,sortiesDP,sortiesDPReq,dpMoySem,dpCibleSem,chargeOk,recs,ratioCourse};
  },[nextObj,seances,vfcData,lastVFC,twelveWeeks,ratio]);

  // ── Heatmap forme 4 semaines ────────────────────────────────────
  const heatmap4=useMemo(()=>{
    const result=[];
    const d=new Date(); const dow=(d.getDay()+6)%7;
    const thisMon=new Date(d); thisMon.setDate(d.getDate()-dow);
    for(let w=3;w>=0;w--){
      const mon=new Date(thisMon); mon.setDate(thisMon.getDate()-w*7);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      const monStr=localDate(mon); const sunStr=localDate(sun);
      const wVfc=vfcData.filter(v=>v.date>=monStr&&v.date<=sunStr);
      const wSom=sommeil.filter(s=>s.date>=monStr&&s.date<=sunStr);
      const vfcMoy=wVfc.length?wVfc.reduce((s,v)=>s+(parseInt(v.vfc)||0),0)/wVfc.length:0;
      const somMoy=wSom.length?wSom.reduce((s,v)=>s+(parseInt(v.score)||0),0)/wSom.length:0;
      const wRatio=lastVFC?.chargeAigue&&lastVFC?.chargeChronique?parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique):1;
      let sc=0;
      if(vfcMoy>70)sc+=2;else if(vfcMoy>60)sc+=1;
      if(somMoy>80)sc+=2;else if(somMoy>65)sc+=1;
      if(w===0&&wRatio<=1.2)sc+=1;
      const lbl=w===0?"Cette sem.":`S-${w}`;
      result.push({lbl,sc,vfcMoy:Math.round(vfcMoy),somMoy:Math.round(somMoy)});
    }
    return result;
  },[vfcData,sommeil,lastVFC]);

  // ── Manqués ─────────────────────────────────────────────────────
  const manques=useMemo(()=>{
    const since=localDate(new Date(Date.now()-7*86400000));
    return seances.filter(s=>s.date>=since&&s.date<today&&s.statut==="Planifié"&&s.activite!=="Repos");
  },[seances,today]);

  // ── Refs charts ─────────────────────────────────────────────────
  const chartRef12=useRef(null); const chartRefScatter=useRef(null);
  const chartRefCharge=useRef(null); const chartInst12=useRef(null);
  const chartInstScatter=useRef(null); const chartInstCharge=useRef(null);

  useEffect(()=>{
    const loadChart = () => {
      if(typeof Chart!=="undefined"){
        runCharts();
        return;
      }
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload=runCharts;
      document.head.appendChild(s);
    };
    const runCharts = () => {
    if(typeof Chart==="undefined") return;
    const isDark=window.matchMedia("(prefers-color-scheme:dark)").matches;
    const gc=isDark?"rgba(255,255,255,.07)":"rgba(0,0,0,.06)";
    const tc=isDark?"#9c9a92":"#73726c";
    const phaseColors=["#378ADD","#BA7517","#A32D2D","#7F77DD"];
    const phasePales=["#B5D4F4","#FAC775","#F09595","#EEEDFE"];

    // Graphique 12 semaines
    if(chartRef12.current&&twelveWeeks.length){
      if(chartInst12.current)chartInst12.current.destroy();
      chartInst12.current=new Chart(chartRef12.current,{
        type:"bar",
        data:{
          labels:twelveWeeks.map(w=>w.label),
          datasets:[
            {label:"km trail",data:twelveWeeks.map(w=>w.km),
              backgroundColor:twelveWeeks.map(w=>phasePales[w.phase]||phasePales[0]),
              borderColor:twelveWeeks.map(w=>phaseColors[w.phase]||phaseColors[0]),
              borderWidth:1,borderRadius:4,yAxisID:"y"},
            {label:"D+÷40",data:twelveWeeks.map(w=>w.dp>0?Math.round(w.dp/40):null),
              type:"line",borderColor:"#e6510099",backgroundColor:"transparent",
              pointBackgroundColor:"#e65100",pointRadius:3,tension:.4,
              borderWidth:1.5,borderDash:[4,3],yAxisID:"y"},
            {label:"VFC moy.",data:twelveWeeks.map(w=>w.vfcMoy),
              type:"line",borderColor:"#185FA5",backgroundColor:"transparent",
              pointBackgroundColor:"#185FA5",pointRadius:4,tension:.4,
              borderWidth:2,yAxisID:"y2"},
          ]
        },
        options:{
          responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{
            if(ctx.datasetIndex===0)return(ctx.parsed.y||0)+" km";
            if(ctx.datasetIndex===1)return twelveWeeks[ctx.dataIndex]?.dp+"m D+";
            return(ctx.parsed.y||"—")+" ms VFC";
          }}}},
          scales:{
            x:{grid:{color:gc},ticks:{color:tc,font:{size:10},maxRotation:0,autoSkip:false}},
            y:{grid:{color:gc},ticks:{color:tc,font:{size:10}},min:0,
               title:{display:true,text:"km",color:tc,font:{size:10}}},
            y2:{position:"right",grid:{display:false},min:55,max:90,
                ticks:{color:"#185FA5",font:{size:10}},
                title:{display:true,text:"VFC ms",color:"#185FA5",font:{size:10}}}
          }
        }
      });
    }

    // Nuage D+ × VFC
    if(chartRefScatter.current&&scatterData.length){
      if(chartInstScatter.current)chartInstScatter.current.destroy();
      chartInstScatter.current=new Chart(chartRefScatter.current,{
        type:"scatter",
        data:{datasets:[{
          label:"Semaine",data:scatterData.map(d=>({x:d.x,y:d.y})),
          backgroundColor:isDark?"#378ADDaa":"#185FA5aa",
          pointRadius:7,pointHoverRadius:9,
        }]},
        options:{
          responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{
            label:ctx=>`${scatterData[ctx.dataIndex]?.label} — ${ctx.parsed.x}m D+ · ${ctx.parsed.y}ms VFC`
          }}},
          scales:{
            x:{grid:{color:gc},ticks:{color:tc,font:{size:10}},
               title:{display:true,text:"D+/semaine (m)",color:tc,font:{size:10}},min:0},
            y:{grid:{color:gc},ticks:{color:tc,font:{size:10}},
               title:{display:true,text:"VFC moyen (ms)",color:tc,font:{size:10}},min:55,max:90}
          }
        }
      });
    }

    // Charge aiguë/chronique
    const chargeWeeks=twelveWeeks.map(w=>w.label);
    const chargeA=twelveWeeks.map((_,i)=>{
      const d=new Date(); const dow=(d.getDay()+6)%7;
      const thisMon=new Date(d); thisMon.setDate(d.getDate()-dow);
      const wk=11-i; const mon=new Date(thisMon); mon.setDate(thisMon.getDate()-wk*7);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      const monStr=localDate(mon); const sunStr=localDate(sun);
      const wvfc=vfcData.filter(v=>v.date>=monStr&&v.date<=sunStr&&v.chargeAigue);
      return wvfc.length?Math.round(parseInt(wvfc[wvfc.length-1].chargeAigue)):null;
    });
    const chargeC=twelveWeeks.map((_,i)=>{
      const d=new Date(); const dow=(d.getDay()+6)%7;
      const thisMon=new Date(d); thisMon.setDate(d.getDate()-dow);
      const wk=11-i; const mon=new Date(thisMon); mon.setDate(thisMon.getDate()-wk*7);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      const monStr=localDate(mon); const sunStr=localDate(sun);
      const wvfc=vfcData.filter(v=>v.date>=monStr&&v.date<=sunStr&&v.chargeChronique);
      return wvfc.length?Math.round(parseInt(wvfc[wvfc.length-1].chargeChronique)):null;
    });
    if(chartRefCharge.current){
      if(chartInstCharge.current)chartInstCharge.current.destroy();
      chartInstCharge.current=new Chart(chartRefCharge.current,{
        type:"line",
        data:{
          labels:chargeWeeks,
          datasets:[
            {label:"Charge aiguë",data:chargeA,borderColor:"#e65100",
             backgroundColor:"#e6510015",pointRadius:3,pointBackgroundColor:"#e65100",
             tension:.4,fill:true,borderWidth:2},
            {label:"Charge chronique",data:chargeC,borderColor:"#185FA5",
             backgroundColor:"transparent",pointRadius:3,pointBackgroundColor:"#185FA5",
             tension:.4,borderDash:[4,3],borderWidth:2}
          ]
        },
        options:{
          responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{
            label:ctx=>ctx.dataset.label+": "+(ctx.parsed.y||"—")
          }}},
          scales:{
            x:{grid:{color:gc},ticks:{color:tc,font:{size:10},maxRotation:0,autoSkip:false}},
            y:{grid:{color:gc},ticks:{color:tc,font:{size:10}},min:0}
          }
        }
      });
    }
    }; // fin runCharts
    loadChart();
  },[twelveWeeks,scatterData,vfcData]);

  // Styles communs
  const card=(extra={})=>({background:C.white,border:`1px solid ${C.border}`,borderRadius:12,...extra});
  const lbl={fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted,marginBottom:8};
  const heatScore=(sc)=>sc>=4?{bg:C.greenPale,col:C.green,txt:"Très bonne"}:sc>=3?{bg:C.forestPale,col:C.forest,txt:"Bonne"}:sc>=2?{bg:C.yellowPale,col:C.yellow,txt:"Moyenne"}:{bg:C.redPale,col:C.red,txt:"Fatigue"};

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>

      {/* ── FORME DU JOUR ── */}
      <div style={{...card(),background:formePale,border:`1.5px solid ${formeColor}33`,padding:"20px 28px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
        <div>
          <div style={{...lbl,color:formeColor,marginBottom:4}}>Forme du jour</div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:28,fontWeight:500,color:formeColor,lineHeight:1}}>{formeEmoji} {formeLabel}</div>
          <div style={{fontSize:11,color:formeColor,marginTop:4,opacity:.8}}>
            {formeScore>=5?"VFC et sommeil bons — tu peux pousser":formeScore>=3?"Forme correcte — reste à l'écoute":"Récupération conseillée — réduis l'intensité"}
          </div>
        </div>
        <div style={{display:"flex",gap:24}}>
          {[
            {k:"VFC",v:lastVFC?.vfc?`${lastVFC.vfc}ms`:"—",s:lastVFC?.baseline||""},
            {k:"Sommeil",v:lastSommeil?.score?`${lastSommeil.score}/100`:"—",s:lastSommeil?.qualite||""},
            {k:"Body Bat.",v:lastSommeil?.bodyBatteryMatin?`${lastSommeil.bodyBatteryMatin}%`:"—",s:"au lever"},
            {k:"Ratio",v:ratio?String(ratio):"—",s:ratio?ratio>1.4?"⚠ Surcharge":ratio>1.2?"Élevée":ratio<0.8?"Sous-charge":"Équilibré":""},
          ].map(({k,v,s})=>(
            <div key={k} style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:formeColor,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em"}}>{k}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:500,color:formeColor}}>{v}</div>
              <div style={{fontSize:9,color:formeColor,opacity:.7}}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── GRILLE PRINCIPALE : Runway + Prévision ── */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>

        {/* Runway progression */}
        <div style={{...card(),padding:"20px 24px"}}>
          {nextObj?(
            <>
              <div style={{...lbl}}>Progression vers la course</div>
              <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:4}}>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:32,fontWeight:500,color:phaseColor}}>J-{j}</span>
                <span style={{fontSize:13,fontWeight:500,color:C.inkLight}}>{nextObj.nom}</span>
                <span style={{fontSize:12,color:phaseColor,background:phasePale,padding:"2px 8px",borderRadius:10,marginLeft:4}}>{phase}</span>
              </div>
              <div style={{fontSize:11,color:C.muted,marginBottom:16}}>{nextObj.distance}km · {nextObj.dp}m D+ · ratio {prevision?.ratioCourse}m/km · {fmtDate(nextObj.date)}</div>

              {/* Barre runway */}
              <div style={{fontSize:10,color:C.muted,marginBottom:4,display:"flex",justifyContent:"space-between"}}>
                <span>Début prépa</span><span style={{color:phaseColor,fontWeight:500}}>Aujourd'hui ({runwayPct}%)</span><span>Race</span>
              </div>
              <div style={{height:8,borderRadius:4,background:C.stone,overflow:"hidden",marginBottom:8,position:"relative"}}>
                <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${runwayPct}%`,
                  background:`linear-gradient(90deg,${C.forest},${phaseColor})`,borderRadius:4}}/>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:20}}>
                {[{l:"Fondamental",c:C.sky},{l:"Spécifique",c:"#e65100"},{l:"Affûtage",c:C.yellow},{l:"Tapering",c:C.summit}].map(({l,c})=>(
                  <span key={l} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:c+"22",color:c,fontWeight:phase===l?600:400,border:phase===l?`1px solid ${c}44`:"none"}}>{l}</span>
                ))}
              </div>

              {/* Jalons */}
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {prevision&&[
                  {label:`Long run max: ${Math.round(prevision.longRunMax)}km`,target:`Cible: ${Math.round(prevision.raceKm*0.7)}km`,ok:prevision.longRunMax>=prevision.raceKm*0.7},
                  {label:`Sorties > 1000m D+: ${prevision.sortiesDP}`,target:`Requises: ${prevision.sortiesDPReq}`,ok:prevision.sortiesDP>=prevision.sortiesDPReq},
                  {label:`D+ moyen/sem: ${prevision.dpMoySem}m`,target:`Cible: ${prevision.dpCibleSem}m`,ok:prevision.dpMoySem>=prevision.dpCibleSem*0.8},
                  {label:`Charge chronique`,target:`${lastVFC?.chargeChronique||"—"}`,ok:prevision.chargeOk},
                ].map(({label,target,ok})=>(
                  <div key={label} style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:ok?C.green:C.red,flexShrink:0}}/>
                    <span style={{fontSize:12,color:C.inkLight,flex:1}}>{label}</span>
                    <div style={{flex:1,height:1,borderTop:`1px dashed ${C.border}`}}/>
                    <span style={{fontSize:11,color:ok?C.green:C.muted}}>{target}</span>
                  </div>
                ))}
              </div>
            </>
          ):(
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:14,color:C.muted,marginBottom:12}}>Aucune course objectif définie</div>
              <Btn variant="soft" onClick={()=>setView("objectifs")}>＋ Ajouter un objectif</Btn>
            </div>
          )}
        </div>

        {/* Prévision & recommandations */}
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{...lbl}}>Prévision course</div>
          {prevision?(
            <>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:20,
                background:prevision.verdictPale,marginBottom:16}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:prevision.verdictColor}}/>
                <span style={{fontSize:13,fontWeight:500,color:prevision.verdictColor}}>{prevision.verdict}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {prevision.recs.map((r,i)=>(
                  <div key={i} style={{fontSize:12,color:i===0&&prevision.score>=7?C.forest:C.inkLight,
                    background:C.stone,borderRadius:8,padding:"9px 12px",lineHeight:1.5,
                    borderLeft:`3px solid ${i===0&&prevision.score>=7?C.forest:prevision.score>=4?C.yellow:C.red}`}}>
                    {r}
                  </div>
                ))}
              </div>
            </>
          ):(
            <div style={{fontSize:12,color:C.muted}}>Ajouter un objectif pour voir la prévision</div>
          )}
        </div>
      </div>

      {/* ── GRILLE : Semaine + Heatmap + Manqués ── */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:16,marginBottom:16}}>

        {/* Semaine en cours avec km/jour */}
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{...lbl,marginBottom:0}}>Cette semaine</div>
            <div style={{display:"flex",gap:10,fontSize:12}}>
              {weekKm>0&&<span style={{fontFamily:"'DM Mono',monospace",color:C.forest,fontWeight:500}}>{weekKm}km</span>}
              {weekDp>0&&<span style={{fontFamily:"'DM Mono',monospace",color:C.muted}}>{weekDp}m↑</span>}
              <span style={{color:C.muted}}>{weekEff.length}/{weekEff.length+weekPlan} séances</span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
            {weekDays.map(({label,dateStr,hasDone,hasPlan,isTod,isPast,types,kmDay,dpDay})=>(
              <div key={dateStr} style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:isTod?C.forest:C.muted,fontWeight:isTod?600:400,marginBottom:3}}>{label}</div>
                <div style={{borderRadius:10,padding:"8px 4px 6px",
                  background:hasDone?C.forestPale:hasPlan?C.stone:isPast?C.redPale+"66":C.stone,
                  border:isTod?`1.5px solid ${C.forest}`:hasDone?`1px solid ${C.forest}44`:`1px solid ${C.border}`}}>
                  {kmDay>0?(
                    <>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500,color:C.forest}}>{kmDay}</div>
                      <div style={{fontSize:9,color:C.muted}}>km</div>
                      {dpDay>0&&<div style={{fontSize:9,color:C.muted}}>{dpDay}m↑</div>}
                    </>
                  ):hasPlan?(
                    <div style={{width:8,height:8,borderRadius:2,background:types[0]?actColor(types[0]):C.muted,opacity:.5,margin:"4px auto"}}/>
                  ):(
                    <div style={{fontSize:9,color:isPast?C.red:C.stoneDeep,padding:"4px 0"}}>{isPast?"—":"·"}</div>
                  )}
                </div>
                {isTod&&<div style={{fontSize:8,color:C.forest,marginTop:2}}>auj.</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap forme */}
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{...lbl}}>Forme · 4 semaines</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {heatmap4.map(({lbl:wl,sc,vfcMoy,somMoy})=>{
              const {bg,col,txt}=heatScore(sc);
              return (
                <div key={wl} style={{borderRadius:8,padding:"8px 10px",background:bg}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:500,color:col}}>{wl}</span>
                    <span style={{fontSize:10,color:col,fontWeight:500}}>{txt}</span>
                  </div>
                  <div style={{fontSize:10,color:col,opacity:.75,marginTop:2}}>
                    {vfcMoy>0?`VFC ${vfcMoy}ms`:""}{vfcMoy>0&&somMoy>0?" · ":""}{somMoy>0?`Som. ${somMoy}/100`:""}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:10,color:C.muted,marginTop:10}}>Score: VFC + sommeil + ratio charge</div>
        </div>

        {/* Manqués */}
        <div style={{...card(),background:manques.length>0?C.redPale:C.white,
          border:`1px solid ${manques.length>0?C.red+"33":C.border}`,padding:"20px 24px"}}>
          <div style={{...lbl,color:manques.length>0?C.red:C.muted}}>Manqué (7j)</div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:44,fontWeight:500,
            color:manques.length>0?C.red:C.green,lineHeight:1,marginBottom:8}}>{manques.length}</div>
          {manques.length===0?(
            <div style={{fontSize:12,color:C.green}}>Rien de manqué</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {manques.slice(0,3).map(s=>(
                <div key={s.id} style={{fontSize:11,color:C.red,background:C.white+"88",borderRadius:5,padding:"3px 7px"}}>
                  {s.demiJournee.split(" ")[0]} — {s.activite}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── GRAPHIQUES CROISÉS ── */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>

        {/* 12 semaines : km + D+ + VFC */}
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{...lbl,marginBottom:0}}>12 semaines · km trail · D+ · VFC</div>
            <div style={{display:"flex",gap:12,fontSize:11,color:C.muted}}>
              {[{c:"#378ADD",l:"Fondamental"},{c:"#e65100",l:"Spécifique"},{c:"#A32D2D",l:"Affûtage"}].map(({c,l})=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{width:10,height:10,borderRadius:2,background:c,display:"inline-block"}}/>
                  {l}
                </span>
              ))}
              <span style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:10,height:2,background:"#e65100",display:"inline-block",borderTop:"2px dashed #e65100"}}/> D+
              </span>
              <span style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:10,height:2,background:"#185FA5",display:"inline-block"}}/> VFC
              </span>
            </div>
          </div>
          <div style={{position:"relative",height:180}}>
            <canvas ref={chartRef12}/>
          </div>
        </div>

        {/* Charge aiguë/chronique */}
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{...lbl}}>Charge aiguë / chronique</div>
          <div style={{display:"flex",gap:12,fontSize:11,color:C.muted,marginBottom:8}}>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:2,background:"#e65100",display:"inline-block"}}/> Aiguë</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:2,background:"#185FA5",display:"inline-block",borderTop:"2px dashed #185FA5"}}/> Chronique</span>
          </div>
          <div style={{position:"relative",height:152}}>
            <canvas ref={chartRefCharge}/>
          </div>
          <div style={{fontSize:10,color:C.muted,marginTop:6}}>Zone optimale ratio : 0.8 – 1.3</div>
        </div>
      </div>

      {/* ── Nuage D+ × VFC ── */}
      {scatterData.length>=3&&(
        <div style={{...card(),padding:"20px 24px"}}>
          <div style={{...lbl}}>Corrélation D+/semaine × VFC moyen — 12 semaines</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:10}}>
            Si la VFC baisse quand le D+ monte, le dénivelé génère de la fatigue. Chaque point = 1 semaine.
          </div>
          <div style={{position:"relative",height:180}}>
            <canvas ref={chartRefScatter}/>
          </div>
        </div>
      )}
    </div>
  );
}

-e 
export default Dashboard;
