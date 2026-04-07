import React, { useState, useMemo, useRef } from "react";
import { CS as C, localDate, exportJSON, parseCSVSommeil, parseCSVVFC,
  emptyPoids, emptyVFC, emptySommeil } from "./constants.js";
import { Btn, Modal, Field, ConfirmDialog } from "./atoms.jsx";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts";

// ─── WRAPPERS FORME ──────────────────────────────────────────────────────────
// Le composant Forme gère déjà VFC/Sommeil/Poids — on le wrap avec tab forcé
function FormeVFC(props) {
  return <Forme {...props} initialTab="vfc"/>;
}
function FormeSommeil(props) {
  return <Forme {...props} initialTab="sommeil"/>;
}
function FormePoids(props) {
  return <Forme {...props} initialTab="poids"/>;
}

// ─── FORME ───────────────────────────────────────────────────────────────────
function Forme({ sommeil, setSommeil, vfcData, setVfcData, poids, setPoids, activites, initialTab, profil, setProfil }) {
  const [tab, setTab] = useState(initialTab||"vfc");
  const sommeilRef=useRef(); const vfcRef=useRef();
  const P = "24px 40px 80px"; // padding commun Forme

  // Import handlers
  const [vfcMsg, setVfcMsg] = useState("");
  const [somMsg, setSomMsg] = useState("");

  const handleImportSommeil = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=(ev)=>{
      const imp=parseCSVSommeil(ev.target.result);
      const ex=new Set(sommeil.map(s=>s.date));
      const news=imp.filter(s=>!ex.has(s.date));
      setSommeil(ss=>[...ss,...news]);
      setSomMsg(`✓ ${news.length} nouvelle(s) · ${imp.length-news.length} doublon(s)`);
      setTimeout(()=>setSomMsg(""),5000);
    }; r.readAsText(file,"utf-8"); e.target.value="";
  };

  const handleImportVFC = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=(ev)=>{
      const imp=parseCSVVFC(ev.target.result);
      const ex=new Set(vfcData.map(v=>v.date));
      const news=imp.filter(v=>!ex.has(v.date));
      // Mettre à jour les entrées existantes si vfc manquant
      const updates=imp.filter(v=>ex.has(v.date)&&!(vfcData.find(x=>x.date===v.date)?.vfc));
      setVfcData(vv=>{
        const merged=vv.map(x=>{const u=updates.find(u=>u.date===x.date);return u?{...x,...u,id:x.id}:x;});
        return [...merged,...news];
      });
      setVfcMsg(`✓ ${news.length} nouvelle(s) · ${updates.length} mise(s) à jour · ${imp.length-news.length-updates.length} doublon(s)`);
      setTimeout(()=>setVfcMsg(""),6000);
    }; r.readAsText(file,"utf-8"); e.target.value="";
  };

  // Computed
  const lastVFC     = useMemo(()=>[...vfcData].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[vfcData]);
  const lastSommeil = useMemo(()=>[...sommeil].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[sommeil]);
  const lastPoids   = useMemo(()=>[...poids].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null,[poids]);
  const vfcChart    = useMemo(()=>[...vfcData].sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-30).map(v=>({date:v.date.slice(5),vfc:parseInt(v.vfc)||0,moy:parseInt(v.moy7j)||0,chargeA:parseInt(v.chargeAigue)||0,chargeC:parseInt(v.chargeChronique)||0})),[vfcData]);
  const sommeilChart= useMemo(()=>[...sommeil].sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-21).map(s=>({date:s.date.slice(5),score:parseInt(s.score)||0,bb:parseInt(s.bodyBatteryMatin)||0})),[sommeil]);
  const poidsChart  = useMemo(()=>[...poids].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(p=>({date:p.date.slice(5),poids:parseFloat(p.poids)||0})),[poids]);

  // Navy BF calc — formule homme ou femme selon profil
  const calcBF = (p) => {
    const h = parseFloat(profil?.taille) || parseFloat(p.taille) || 180;
    const ab = parseFloat(p.ventre)||0;
    const neck = parseFloat(p.cou)||0;
    if(!ab||!neck||ab<=neck||h<=0) return null;
    const isFemme = (profil?.sexe||"Homme") === "Femme";
    if(isFemme) {
      const hip = parseFloat(p.hanche)||0;
      if(!hip) return null;
      return Math.round((495/(1.29579-0.35004*Math.log10(ab+hip-neck)+0.22100*Math.log10(h))-450)*10)/10;
    }
    return Math.round((495/(1.0324-0.19077*Math.log10(ab-neck)+0.15456*Math.log10(h))-450)*10)/10;
  };

  // Export Alex
  const exportAlex = () => {
    const lv=lastVFC; const ls=lastSommeil; const lp=lastPoids;
    const bf=calcBF(lp);
    const ratio=lv?.chargeAigue&&lv?.chargeChronique?Math.round(parseInt(lv.chargeAigue)/parseInt(lv.chargeChronique)*100)/100:null;
    const recent=activites.filter(a=>new Date(a.date)>=new Date(Date.now()-28*86400000)&&(a.z1||a.z2));
    const avgZ=(k)=>recent.length?Math.round(recent.reduce((s,a)=>s+(parseFloat(a[k])||0),0)/recent.length*100)/100:null;
    const zones=lv?{z1:[parseInt(lv.z1debut)||null,parseInt(lv.z1fin)||null],z2:[parseInt(lv.z2debut)||null,parseInt(lv.z2fin)||null],z3:[parseInt(lv.z3debut)||null,parseInt(lv.z3fin)||null],z4:[parseInt(lv.z4debut)||null,parseInt(lv.z4fin)||null],z5:[null,null],fcMax:parseInt(lv.fcMax)||null}:null;
    exportJSON({date:localDate(new Date()),vfc:lv?parseInt(lv.vfc)||null:null,vfcBaseline:lv?.baseline||null,vfcMoy7j:lv?parseInt(lv.moy7j)||null:null,sommeilScore:ls?parseInt(ls.score)||null:null,poids:lp?parseFloat(lp.poids)||null:null,pcMG:bf,vo2max:lv?parseInt(lv.vo2max)||null:null,ratioCharge:ratio,chargeAigue:lv?parseInt(lv.chargeAigue)||null:null,chargeChronique:lv?parseInt(lv.chargeChronique)||null:null,zonesFC:zones,tempsParZone:{z1:avgZ("z1")/100||null,z2:avgZ("z2")/100||null,z3:avgZ("z3")/100||null,z4:avgZ("z4")/100||null,z5:avgZ("z5")/100||null}},`stride-profil-${localDate(new Date())}.json`);
  };

  // Inline update helpers
  const updSommeil = (id,k,v) => setSommeil(ss=>ss.map(s=>s.id===id?{...s,[k]:v}:s));
  const updVFC     = (id,k,v) => setVfcData(vv=>vv.map(x=>x.id===id?{...x,[k]:v}:x));
  const updPoids   = (id,k,v) => setPoids(pp=>pp.map(p=>p.id===id?{...p,[k]:v}:p));
  const addSommeil = () => setSommeil(ss=>[{...emptySommeil()},...ss]);
  const addVFC     = () => setVfcData(vv=>[{...emptyVFC()},...vv]);
  const addPoids   = () => setPoids(pp=>[{...emptyPoids()},...pp]);
  const delSommeil = (id) => setSommeil(ss=>ss.filter(s=>s.id!==id));
  const delVFC     = (id) => setVfcData(vv=>vv.filter(v=>v.id!==id));
  const delPoids   = (id) => setPoids(pp=>pp.filter(p=>p.id!==id));

  const TABS=[{id:"vfc",label:"VFC & Charge"},{id:"sommeil",label:"Sommeil"},{id:"poids",label:"Suivi corporel"}];

  // Compact inline input style
  const inlineInput = (w=70) => ({fontSize:11,padding:"1px 5px",borderRadius:5,border:`1px solid ${C.border}`,width:w,background:C.bg,fontFamily:"'DM Mono',monospace",textAlign:"center"});

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight}}>Forme</h1>
          <p style={{fontSize:11,color:C.muted}}>VFC · Sommeil · Poids · Récupération</p>
        </div>
        <Btn variant="summit" size="sm" onClick={exportAlex}>→ Alex</Btn>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>
        {[
          {label:"VFC",value:lastVFC?.vfc?`${lastVFC.vfc}ms`:"—",sub:lastVFC?.baseline||"",color:parseInt(lastVFC?.vfc||0)>65?C.green:C.yellow},
          {label:"Sommeil",value:lastSommeil?.score?`${lastSommeil.score}/100`:"—",sub:lastSommeil?.qualite||"",color:parseInt(lastSommeil?.score||0)>=75?C.green:C.yellow},
          {label:"Body Bat.",value:lastSommeil?.bodyBatteryMatin?`${lastSommeil.bodyBatteryMatin}%`:"—",sub:"au lever",color:parseInt(lastSommeil?.bodyBatteryMatin||0)>=70?C.green:C.yellow},
          {label:"Poids",value:lastPoids?.poids?`${lastPoids.poids}kg`:"—",sub:lastPoids?fmtDate(lastPoids.date):"",color:C.sky},
          {label:"VO2max",value:lastVFC?.vo2max||"—",sub:"mL/kg/min",color:C.forest},
          {label:"Ratio",value:lastVFC?.chargeAigue&&lastVFC?.chargeChronique?Math.round(parseInt(lastVFC.chargeAigue)/parseInt(lastVFC.chargeChronique)*100)/100:"—",sub:"aigu/chronique",color:C.muted},
        ].map(k=>(
          <div key={k.label} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",color:C.muted,marginBottom:3}}>{k.label}</div>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:k.color,lineHeight:1}}>{k.value}</div>
            <div style={{fontSize:10,color:C.stoneDeep,marginTop:2}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs — masqués si appelé depuis un sous-onglet nav */}
      {!initialTab&&(
        <div style={{display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,marginBottom:14}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:tab===t.id?500:400,color:tab===t.id?C.forest:C.muted,borderBottom:tab===t.id?`2px solid ${C.forest}`:"2px solid transparent",marginBottom:-1,fontFamily:"inherit"}}>{t.label}</button>
          ))}
        </div>
      )}

      {/* ── VFC ─────────────────────────────────────────────────── */}
      {tab==="vfc" && (
        <div>
          <input ref={vfcRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleImportVFC}/>
          <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
            <Btn variant="sage" size="sm" onClick={()=>vfcRef.current?.click()}>⬆ Import CSV</Btn>
            <Btn size="sm" onClick={addVFC}>＋ Entrée</Btn>
            {vfcMsg&&<span style={{fontSize:11,color:C.green,fontWeight:500}}>{vfcMsg}</span>}
          </div>
          {vfcChart.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:500,color:C.muted,marginBottom:6}}>VFC nocturne 30j</div>
                <ResponsiveContainer width="100%" height={100}>
                  <ComposedChart data={vfcChart}>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} interval={6}/>
                    <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={28}/>
                    <RTooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}} formatter={(v,n)=>[v+" ms",n==="vfc"?"VFC":"Moy 7j"]}/>
                    <Area type="monotone" dataKey="vfc" fill={C.forestPale} stroke={C.forest} strokeWidth={1.5} dot={false}/>
                    <Line type="monotone" dataKey="moy" stroke={C.stoneDeep} strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:500,color:C.muted,marginBottom:6}}>Charges 30j</div>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={vfcChart}>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} interval={6}/>
                    <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={28}/>
                    <RTooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}/>
                    <Line type="monotone" dataKey="chargeA" stroke={C.summit} strokeWidth={1.5} dot={false} name="Aiguë"/>
                    <Line type="monotone" dataKey="chargeC" stroke={C.sky} strokeWidth={1.5} dot={false} name="Chronique"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"110px 80px 120px 90px 90px 100px 100px 70px 32px",padding:"8px 14px",background:C.stone,fontSize:10,fontWeight:600,color:C.muted,gap:8,textTransform:"uppercase",letterSpacing:"0.04em",minWidth:820}}>
                <span>Date</span><span>VFC</span><span>Baseline</span><span>Moy 7j</span><span>VO2max</span><span>Charge Aiguë</span><span>Charge Chron.</span><span style={{color:C.forest}}>Ratio</span><span></span>
              </div>
              <div style={{maxHeight:400,overflowY:"auto"}}>
                {[...vfcData].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(v=>{
                  const ratio = v.chargeAigue && v.chargeChronique
                    ? Math.round(parseFloat(v.chargeAigue)/parseFloat(v.chargeChronique)*100)/100
                    : null;
                  const ratioColor = ratio===null?C.muted:ratio>1.3?C.red:ratio>1.1?C.yellow:ratio>=0.8?C.green:C.sky;
                  return (
                    <div key={v.id} style={{display:"grid",gridTemplateColumns:"110px 80px 120px 90px 90px 100px 100px 70px 32px",padding:"6px 14px",borderTop:`1px solid ${C.border}`,alignItems:"center",gap:8,minWidth:820}}>
                      <input type="date" value={v.date} onChange={e=>updVFC(v.id,"date",e.target.value)} style={{...inlineInput(108),textAlign:"left"}}/>
                      <input value={v.vfc} onChange={e=>updVFC(v.id,"vfc",e.target.value)} placeholder="ms" style={inlineInput(76)}/>
                      <input value={v.baseline} onChange={e=>updVFC(v.id,"baseline",e.target.value)} placeholder="63-83ms" style={{...inlineInput(116),fontSize:11}}/>
                      <input value={v.moy7j} onChange={e=>updVFC(v.id,"moy7j",e.target.value)} placeholder="ms" style={inlineInput(86)}/>
                      <input value={v.vo2max} onChange={e=>updVFC(v.id,"vo2max",e.target.value)} placeholder="—" style={inlineInput(86)}/>
                      <input value={v.chargeAigue} onChange={e=>updVFC(v.id,"chargeAigue",e.target.value)} placeholder="—" style={inlineInput(96)}/>
                      <input value={v.chargeChronique} onChange={e=>updVFC(v.id,"chargeChronique",e.target.value)} placeholder="—" style={inlineInput(96)}/>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color:ratioColor,textAlign:"center"}}>
                        {ratio!==null ? ratio.toFixed(2) : "—"}
                      </span>
                      <button onClick={()=>delVFC(v.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SOMMEIL ──────────────────────────────────────────────── */}
      {tab==="sommeil" && (
        <div>
          <input ref={sommeilRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleImportSommeil}/>
          <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
            <Btn variant="sage" size="sm" onClick={()=>sommeilRef.current?.click()}>⬆ Import CSV</Btn>
            <Btn size="sm" onClick={addSommeil}>＋ Nuit</Btn>
            {somMsg&&<span style={{fontSize:11,color:C.green,fontWeight:500}}>{somMsg}</span>}
          </div>
          {sommeilChart.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:500,color:C.muted,marginBottom:6}}>Score 21j</div>
                <ResponsiveContainer width="100%" height={90}>
                  <AreaChart data={sommeilChart}>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} interval={4}/>
                    <YAxis domain={[40,100]} tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={24}/>
                    <RTooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}/>
                    <Area type="monotone" dataKey="score" fill={C.skyPale} stroke={C.sky} strokeWidth={1.5} dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:500,color:C.muted,marginBottom:6}}>Body Battery matin 21j</div>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={sommeilChart} barSize={5}>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} interval={4}/>
                    <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={24}/>
                    <ReferenceLine y={70} stroke={C.stoneDark} strokeDasharray="3 3"/>
                    <RTooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}/>
                    <Bar dataKey="bb" fill={C.forest} radius={[2,2,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"110px 60px 80px 80px 65px 65px 65px 70px 70px 80px 80px 30px",padding:"8px 14px",background:C.stone,fontSize:10,fontWeight:600,color:C.muted,gap:8,textTransform:"uppercase",letterSpacing:"0.04em",minWidth:880}}>
                <span>Date</span><span>Score</span><span>Qualité</span><span>Durée</span><span>FC ♥</span><span>BB nuit</span><span>BB mat.</span><span>SpO2</span><span>Resp.</span><span>Coucher</span><span>Lever</span><span></span>
              </div>
              <div style={{maxHeight:340,overflowY:"auto"}}>
                {[...sommeil].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(s=>(
                  <div key={s.id} style={{display:"grid",gridTemplateColumns:"110px 60px 80px 80px 65px 65px 65px 70px 70px 80px 80px 30px",padding:"7px 14px",borderTop:`1px solid ${C.border}`,alignItems:"center",gap:8,minWidth:880}}>
                    <input type="date" value={s.date} onChange={e=>updSommeil(s.id,"date",e.target.value)} style={{...inlineInput(108),textAlign:"left"}}/>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,textAlign:"center",color:parseInt(s.score)>=80?C.green:parseInt(s.score)>=60?C.yellow:C.red,fontWeight:500}}>{s.score||"—"}</span>
                    <select value={s.qualite||"Bon"} onChange={e=>updSommeil(s.id,"qualite",e.target.value)} style={{...inlineInput(58),padding:"1px 2px",fontSize:10}}>
                      {["Excellent","Bon","Passable","Mauvais"].map(q=><option key={q}>{q}</option>)}
                    </select>
                    <input value={s.duree} onChange={e=>updSommeil(s.id,"duree",e.target.value)} placeholder="7h30" style={{...inlineInput(58),fontSize:10}}/>
                    <input value={s.fcRepos||""} onChange={e=>updSommeil(s.id,"fcRepos",e.target.value)} placeholder="—" style={inlineInput(50)}/>
                    <input value={s.bodyBattery||""} onChange={e=>updSommeil(s.id,"bodyBattery",e.target.value)} placeholder="—" style={inlineInput(50)}/>
                    <input value={s.bodyBatteryMatin||""} onChange={e=>updSommeil(s.id,"bodyBatteryMatin",e.target.value)} placeholder="—" style={inlineInput(50)}/>
                    <input value={s.spo2||""} onChange={e=>updSommeil(s.id,"spo2",e.target.value)} placeholder="—" style={inlineInput(55)}/>
                    <input value={s.respiration||""} onChange={e=>updSommeil(s.id,"respiration",e.target.value)} placeholder="—" style={inlineInput(50)}/>
                    <input value={s.coucher||""} onChange={e=>updSommeil(s.id,"coucher",e.target.value)} placeholder="23:30" style={{...inlineInput(58),fontSize:10}}/>
                    <input value={s.lever||""} onChange={e=>updSommeil(s.id,"lever",e.target.value)} placeholder="06:30" style={{...inlineInput(58),fontSize:10}}/>
                    <button onClick={()=>delSommeil(s.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUIVI CORPOREL ───────────────────────────────────────── */}
      {tab==="poids" && (
        <div>
          {/* Bloc profil */}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,
            padding:"14px 18px",marginBottom:14,display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",
              letterSpacing:".06em",flexShrink:0}}>Profil personnel</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:12,color:C.muted}}>Sexe</span>
              <div style={{display:"flex",gap:4}}>
                {["Homme","Femme"].map(s=>(
                  <button key={s} onClick={()=>setProfil(p=>({...p,sexe:s}))}
                    style={{padding:"4px 14px",borderRadius:20,fontSize:12,fontWeight:500,
                      border:`0.5px solid ${(profil?.sexe||"Homme")===s?C.forest:C.border}`,
                      background:(profil?.sexe||"Homme")===s?C.forest:"transparent",
                      color:(profil?.sexe||"Homme")===s?C.white:C.muted,
                      cursor:"pointer",fontFamily:"inherit"}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:12,color:C.muted}}>Taille</span>
              <input type="number" min="140" max="220"
                value={profil?.taille||180}
                onChange={e=>setProfil(p=>({...p,taille:parseInt(e.target.value)||180}))}
                style={{width:64,fontSize:12,padding:"4px 8px",borderRadius:6,
                  border:`1px solid ${C.border}`,textAlign:"right",
                  fontFamily:"'DM Mono',monospace"}}/>
              <span style={{fontSize:12,color:C.muted}}>cm</span>
            </div>
            <div style={{fontSize:11,color:C.stoneDeep,marginLeft:"auto"}}>
              {(profil?.sexe||"Homme")==="Femme"
                ? "Formule Navy femme (ventre + hanche requis)"
                : "Formule Navy homme (ventre requis)"}
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <Btn size="sm" onClick={addPoids}>＋ Mesure</Btn>
          </div>
          {poidsChart.length>1&&(
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:500,color:C.muted,marginBottom:6}}>Évolution du poids</div>
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={poidsChart}>
                  <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={32} domain={["auto","auto"]}/>
                  <RTooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}} formatter={v=>[`${v}kg`,"Poids"]}/>
                  <Line type="monotone" dataKey="poids" stroke={C.summit} strokeWidth={2} dot={{fill:C.summit,r:2}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"110px 76px 56px 60px 60px 66px 60px 60px 66px 66px 60px 60px 64px 30px",padding:"8px 14px",background:C.stone,fontSize:10,fontWeight:600,color:C.muted,gap:8,textTransform:"uppercase",letterSpacing:"0.03em",minWidth:980}}>
                <span>Date</span><span>Poids</span><span>Var.</span><span>Cou</span><span>Épaules</span><span>Poitrine</span><span>Bras</span><span>Taille</span><span>Ventre</span><span>Hanche</span><span>Cuisse</span><span>Mollet</span><span>%MG*</span><span></span>
              </div>
              <div style={{maxHeight:340,overflowY:"auto"}}>
                {[...poids].sort((a,b)=>new Date(b.date)-new Date(a.date)).map((p,i,arr)=>{
                  const prev=arr[i+1]; const diff=prev&&p.poids&&prev.poids?(parseFloat(p.poids)-parseFloat(prev.poids)).toFixed(1):null;
                  const bf=calcBF(p);
                  const inp=(w=50)=>({...inlineInput(w),fontSize:10});
                  return (
                    <div key={p.id} style={{display:"grid",gridTemplateColumns:"110px 76px 56px 60px 60px 66px 60px 60px 66px 66px 60px 60px 64px 30px",padding:"7px 14px",borderTop:`1px solid ${C.border}`,alignItems:"center",gap:8,minWidth:980}}>
                      <input type="date" value={p.date} onChange={e=>updPoids(p.id,"date",e.target.value)} style={{...inp(108),textAlign:"left"}}/>
                      <div style={{display:"flex",alignItems:"center",gap:2}}>
                        <input value={p.poids} onChange={e=>updPoids(p.id,"poids",e.target.value)} placeholder="kg" style={{...inp(46),fontWeight:500,color:C.inkLight}}/>
                      </div>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,textAlign:"center",color:diff?parseFloat(diff)>0?C.red:C.green:C.stoneDeep}}>{diff?(parseFloat(diff)>0?"+":"")+diff:"—"}</span>
                      {["cou","epaules","poitrine","bras","taille_cm","ventre","hanche","cuisse","mollet"].map(k=>(
                        <input key={k} value={p[k]||""} onChange={e=>updPoids(p.id,k,e.target.value)} placeholder="—" style={inp(48)}/>
                      ))}
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,textAlign:"center",color:C.forest,fontWeight:500}}>{bf?`${bf}%`:"—"}</span>
                      <button onClick={()=>delPoids(p.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.stoneDark,fontSize:12,padding:0}}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{fontSize:10,color:C.stoneDeep,marginTop:8}}>* %MG formule Navy U.S. · Homme : cou + ventre · Femme : cou + ventre + hanche · Taille dans le profil ci-dessus</div>
        </div>
      )}
    </div>
  );
}

-e 
export { FormeVFC, FormeSommeil, FormePoids, Forme };
