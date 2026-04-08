import React, { useState, useMemo, useRef } from "react";
import { CS as C, localDate, fmtDate, daysUntil, isRunning, actColor, actShort, actColorPale,
  exportJSON, ACTIVITY_TYPES, DEFAULT_PLANNING, emptySeance } from "../../constants.js";
import { Btn } from "../../atoms.jsx";
// ─── MON COACH IA ─────────────────────────────────────────────────────────────
function MonCoachIA({ seances, setSeances, activites, sommeil, vfcData, poids, objectifs,
  planningType, produits, recettes, journalNutri, activityTypes }) {

  const today      = localDate(new Date());
  const [copied,   setCopied]   = useState(null);
  const [impMsg,   setImpMsg]   = useState("");
  const progRef    = useRef();

  // Import programme JSON
  const handleProgramme = (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader();
    r.onload=(ev)=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data._stride_programme&&!data.seances){alert("Format non reconnu.");return;}
        const toImport=(data.seances||[]).map(s=>({...emptySeance(),...s,id:Date.now()+Math.random()}));
        const existingKeys=new Set(seances.map(s=>s.date+"|"+s.demiJournee));
        const news=toImport.filter(s=>!existingKeys.has(s.date+"|"+s.demiJournee));
        setSeances(ss=>{const u=ss.map(s=>{const m=toImport.find(u=>u.date===s.date&&u.demiJournee===s.demiJournee&&s.statut==="Planifié");return m?{...s,...m,id:s.id}:s;});return [...u,...news];});
        setImpMsg(`✓ ${news.length} séance(s) importée(s)`);
        setTimeout(()=>setImpMsg(""),5000);
      }catch{alert("Erreur JSON");}
    };
    r.readAsText(file); e.target.value="";
  };

  const IA_LINKS = [
    { id:"claude",     label:"Claude",     url:"https://claude.ai/new",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#D97757"/><path d="M8 16l4-8 4 8M9.5 13h5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg> },
    { id:"chatgpt",    label:"ChatGPT",    url:"https://chatgpt.com",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#10a37f"/><path d="M7 12a5 5 0 0 1 10 0v1a5 5 0 0 1-10 0v-1z" stroke="white" strokeWidth="1.5"/><path d="M12 7v10M7.5 9.5l9 5M7.5 14.5l9-5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/></svg> },
    { id:"gemini",     label:"Gemini",     url:"https://gemini.google.com",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#4285F4"/><path d="M12 5c0 3.87-3.13 7-7 7 3.87 0 7 3.13 7 7 0-3.87 3.13-7 7-7-3.87 0-7-3.13-7-7z" fill="white"/></svg> },
    { id:"mistral",    label:"Mistral",    url:"https://chat.mistral.ai",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#FA520F"/><rect x="7" y="8" width="4" height="4" rx="1" fill="white"/><rect x="13" y="8" width="4" height="4" rx="1" fill="white"/><rect x="7" y="14" width="4" height="4" rx="1" fill="white" opacity=".7"/><rect x="13" y="14" width="4" height="4" rx="1" fill="white" opacity=".7"/></svg> },
    { id:"perplexity", label:"Perplexity", url:"https://perplexity.ai",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#20808D"/><path d="M12 6v12M6 12h12M9 9l6 6M15 9l-6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity=".85"/></svg> },
    { id:"copilot",    label:"Copilot",    url:"https://copilot.microsoft.com",
      logo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#0078D4"/><path d="M8 8h8v8H8z" fill="none" stroke="white" strokeWidth="1.5"/><path d="M10 12h4M12 10v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  ];

  const copyPrompt = (key, text) => {
    navigator.clipboard.writeText(text).then(()=>{
      setCopied(key); setTimeout(()=>setCopied(null), 2500);
    }).catch(()=>{ setCopied(key); setTimeout(()=>setCopied(null), 2500); });
  };

  const daysAgo = (n) => localDate(new Date(new Date().getTime()-n*86400000));
  const daysAhead = (n) => localDate(new Date(new Date().getTime()+n*86400000));
  const lastVFC   = [...vfcData].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const lastPoids = [...poids].sort((a,b)=>b.date.localeCompare(a.date))[0];

  // ── PROMPT 1 : Configurer mon Coach IA (profil statique) ───────────────────
  const buildPromptConfig = () => {
    const objStr = objectifs.length>0
      ? objectifs.map(o=>`  - ${o.nom} le ${fmtDate(o.date)} · ${o.distance||"?"}km · ${o.dp||"?"}m D+`).join("\n")
      : "  - Aucun objectif défini";

    const planStr = Object.entries(planningType||DEFAULT_PLANNING)
      .map(([slot,type])=>`  ${slot}: ${type}`).join("\n");

    const zonesStr = lastVFC ? [
      lastVFC.z1debut&&lastVFC.z1fin?`  Z1 : ${lastVFC.z1debut}–${lastVFC.z1fin} bpm`:"",
      lastVFC.z2debut&&lastVFC.z2fin?`  Z2 : ${lastVFC.z2debut}–${lastVFC.z2fin} bpm`:"",
      lastVFC.z3debut&&lastVFC.z3fin?`  Z3 : ${lastVFC.z3debut}–${lastVFC.z3fin} bpm`:"",
      lastVFC.z4debut&&lastVFC.z4fin?`  Z4 : ${lastVFC.z4debut}–${lastVFC.z4fin} bpm`:"",
      lastVFC.fcMax?`  FC max : ${lastVFC.fcMax} bpm`:"",
      lastVFC.vo2max?`  VO2max : ${lastVFC.vo2max} mL/kg/min`:"",
    ].filter(Boolean).join("\n") : "  - Zones FC non renseignées";

    const poidsStr = lastPoids
      ? `  Poids : ${lastPoids.poids} kg · Taille : ${lastPoids.taille||180} cm`
      : "  - Données morpho non renseignées";

    return `Tu es mon coach trail running personnel. Voici mon profil complet pour paramétrer notre collaboration.

== PROFIL ATHLÈTE ==
${poidsStr}

== ZONES DE FRÉQUENCE CARDIAQUE ==
${zonesStr}

== COURSES OBJECTIFS ==
${objStr}

== SEMAINE TYPE D'ENTRAÎNEMENT ==
${planStr}

== TYPES D'ACTIVITÉS UTILISÉS ==
${ACTIVITY_TYPES.filter(t=>t).join(", ")}

== FORMAT JSON POUR GÉNÉRER UN PROGRAMME ==
Quand je te demande un programme, réponds UNIQUEMENT avec ce format JSON :
{
  "_stride_programme": "1.0",
  "seances": [
    {
      "date": "YYYY-MM-DD",
      "demiJournee": "Lundi AM",
      "activite": "Trail",
      "statut": "Planifié",
      "commentaire": "Description courte de la séance",
      "kmObj": "15",
      "dpObj": "400",
      "dureeObj": "1h30",
      "fcObj": "140"
    }
  ]
}

== INSTRUCTIONS ==
- Tu analyses mes données d'entraînement et de forme quand je te les transmets
- Tu adaptes tes conseils à mon niveau et mes objectifs de course
- Pour les programmes, tu respectes strictement le format JSON ci-dessus
- Tu es direct, factuel, et tu justifies tes recommandations
- Si tu es Claude : crée un Projet et colle ces instructions dans les instructions système du projet`;
  };

  // ── PROMPT 2 : Analyser ma semaine ─────────────────────────────────────────
  const buildPromptSemaine = () => {
    const since = daysAgo(7);
    const seancesW = seances.filter(s=>s.date>=since&&s.date<=today);
    const activW   = activites.filter(a=>a.dateHeure?.slice(0,10)>=since);
    const sommeilW = [...sommeil].filter(s=>s.date>=since).sort((a,b)=>a.date.localeCompare(b.date));
    const vfcW     = [...vfcData].filter(v=>v.date>=since).sort((a,b)=>a.date.localeCompare(b.date));

    const planN  = seancesW.filter(s=>s.activite!=="Repos").length;
    const doneN  = seancesW.filter(s=>s.statut==="Effectué"||s.statut==="Partiel").length;
    const kmPlan = seancesW.reduce((s,a)=>s+(parseFloat(a.kmObj)||0),0).toFixed(1);
    const kmReal = activW.filter(a=>["Trail","Course à pied","Marche à pied"].includes(a.type))
      .reduce((s,a)=>s+(parseFloat(a.distance)||0),0).toFixed(1);
    const dpReal = activW.reduce((s,a)=>s+(parseFloat(a.dp)||0),0);
    const avgSom = sommeilW.length ? Math.round(sommeilW.reduce((s,v)=>s+(parseInt(v.score)||0),0)/sommeilW.length) : null;
    const lastV  = vfcW[vfcW.length-1];

    const seancesDetail = seancesW
      .filter(s=>s.activite!=="Repos")
      .map(s=>`  ${fmtDate(s.date)} ${s.demiJournee.split(" ")[1]||""} · ${s.activite} · ${s.statut}${s.commentaire?` · ${s.commentaire}`:""}${s.kmGarmin?` · ${s.kmGarmin}km`:""}${s.dureeGarmin?` · ${s.dureeGarmin}`:""}`)
      .join("\n") || "  - Aucune séance cette semaine";

    return `Voici mon bilan de la semaine (${fmtDate(since)} → ${fmtDate(today)}).

== SÉANCES ==
Planifiées : ${planN} · Réalisées : ${doneN}
Km prévus : ${kmPlan}km · Km réalisés : ${kmReal}km · D+ réalisé : ${dpReal}m
Détail :
${seancesDetail}

== SOMMEIL ==
${sommeilW.length>0 ? `Score moyen : ${avgSom}/100
Détail : ${sommeilW.map(s=>`${fmtDate(s.date)} ${s.score}/100${s.bodyBatteryMatin?` BB:${s.bodyBatteryMatin}%`:""}`).join(" · ")}` : "- Pas de données cette semaine"}

== VFC & CHARGE ==
${lastV ? `Dernier relevé (${fmtDate(lastV.date)}) : VFC ${lastV.vfc||"—"}ms · Moy 7j : ${lastV.moy7j||"—"}ms
Charge aiguë : ${lastV.chargeAigue||"—"} · Charge chronique : ${lastV.chargeChronique||"—"}
Ratio : ${lastV.chargeAigue&&lastV.chargeChronique?Math.round(parseInt(lastV.chargeAigue)/parseInt(lastV.chargeChronique)*100)/100:"—"}` : "- Pas de données VFC"}

Qu'est-ce que tu en penses ? Que faut-il ajuster pour la semaine à venir ?`;
  };

  // ── PROMPT 3 : Générer mon programme ───────────────────────────────────────
  const buildPromptProgramme = () => {
    const objStr = objectifs.length>0
      ? objectifs.map(o=>`  - ${o.nom} le ${fmtDate(o.date)} · ${o.distance||"?"}km · ${o.dp||"?"}m D+`).join("\n")
      : "  - Aucun objectif défini";
    const planStr = Object.entries(planningType||DEFAULT_PLANNING)
      .map(([slot,type])=>`  ${slot}: ${type}`).join("\n");
    const lastV = [...vfcData].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const chargeStr = lastV
      ? `Charge aiguë : ${lastV.chargeAigue||"—"} · Charge chronique : ${lastV.chargeChronique||"—"} · Ratio : ${lastV.chargeAigue&&lastV.chargeChronique?Math.round(parseInt(lastV.chargeAigue)/parseInt(lastV.chargeChronique)*100)/100:"—"}`
      : "Données de charge non disponibles";

    return `Je veux que tu génères mon programme d'entraînement.

== MES COURSES OBJECTIFS ==
${objStr}

== MA SEMAINE TYPE ==
${planStr}

== ÉTAT DE FORME ACTUEL ==
${chargeStr}
${lastV?.vo2max?`VO2max : ${lastV.vo2max} mL/kg/min`:""}

== DEMANDE ==
Génère un programme pour les 4 prochaines semaines (du ${fmtDate(daysAhead(1))} au ${fmtDate(daysAhead(28))}).
Respecte strictement ma semaine type et le format JSON Stride défini dans tes instructions.
Adapte la charge progressive en fonction de mes objectifs.`;
  };

  // ── PROMPT 4 : Bilan de forme ───────────────────────────────────────────────
  const buildPromptForme = () => {
    const since = daysAgo(30);
    const vfc30   = [...vfcData].filter(v=>v.date>=since).sort((a,b)=>a.date.localeCompare(b.date));
    const som30   = [...sommeil].filter(s=>s.date>=since);
    const poids30 = [...poids].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
    const lastV   = vfc30[vfc30.length-1];
    const avgSom  = som30.length ? Math.round(som30.reduce((s,v)=>s+(parseInt(v.score)||0),0)/som30.length) : null;
    const avgBB   = som30.length ? Math.round(som30.reduce((s,v)=>s+(parseInt(v.bodyBatteryMatin)||0),0)/som30.length) : null;

    return `Voici mon bilan de forme des 30 derniers jours.

== VFC (${vfc30.length} relevés) ==
${lastV ? `Dernier : ${lastV.vfc||"—"}ms (${fmtDate(lastV.date)}) · Moy 7j : ${lastV.moy7j||"—"}ms
Charge aiguë : ${lastV.chargeAigue||"—"} · Charge chronique : ${lastV.chargeChronique||"—"}
Ratio : ${lastV.chargeAigue&&lastV.chargeChronique?Math.round(parseInt(lastV.chargeAigue)/parseInt(lastV.chargeChronique)*100)/100:"—"}
VO2max : ${lastV.vo2max||"—"} mL/kg/min` : "- Pas de données VFC"}

== SOMMEIL (${som30.length} nuits) ==
${avgSom!==null ? `Score moyen : ${avgSom}/100 · Body Battery moyen au lever : ${avgBB||"—"}%` : "- Pas de données sommeil"}

== POIDS ==
${poids30.length>0 ? poids30.map(p=>`  ${fmtDate(p.date)} : ${p.poids}kg`).join("\n") : "- Pas de données poids"}

Comment je me porte ? Y a-t-il des signaux d'alerte à surveiller ?`;
  };

  // ── PROMPT 5 : Bilan nutrition ──────────────────────────────────────────────
  const buildPromptNutri = () => {
    const since = daysAgo(30);
    const nutri30 = (journalNutri||[]).filter(j=>j.date>=since);
    const actRun  = activites.filter(a=>a.dateHeure?.slice(0,10)>=since&&["Trail","Course à pied","Marche à pied"].includes(a.type));
    const avg = (key) => nutri30.length ? Math.round(nutri30.reduce((s,j)=>s+(parseFloat(j[key])||0),0)/nutri30.length) : null;
    const totalKm = actRun.reduce((s,a)=>s+(parseFloat(a.distance)||0),0).toFixed(0);

    return `Voici mon bilan nutritionnel des 30 derniers jours.

== DONNÉES NUTRITIONNELLES (${nutri30.length} jours enregistrés sur 30) ==
Kcal consommées moy./jour : ${avg("kcalConso")||"—"} kcal
Kcal brûlées moy./jour : ${avg("kcalBrulees")||"—"} kcal
Delta moyen : ${avg("kcalConso")&&avg("kcalBrulees")?avg("kcalConso")-avg("kcalBrulees"):"—"} kcal
Protéines moy. : ${avg("proteines")||"—"} g/jour
Lipides moy. : ${avg("lipides")||"—"} g/jour
Glucides moy. : ${avg("glucides")||"—"} g/jour

== CHARGE D'ENTRAÎNEMENT SUR LA MÊME PÉRIODE ==
${actRun.length} sorties running · ${totalKm} km total

Est-ce que ma nutrition est cohérente avec ma charge d'entraînement ? Que recommandes-tu d'ajuster ?`;
  };

  // ── PROMPT 6 : Stratégie nutrition course ───────────────────────────────────
  const buildPromptNutriCourse = () => {
    const nextObj = [...objectifs].filter(o=>o.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
    const prodsStr = produits.length>0
      ? produits.map(p=>`  - ${p.nom} (${p.categorie||"—"}) : ${p.kcal||"?"}kcal · Gluc:${p.glucides||"?"}g · Prot:${p.proteines||"?"}g`).join("\n")
      : "  - Aucun produit enregistré";
    const recettesStr = recettes.length>0
      ? recettes.map(r=>`  - ${r.nom} : ${r.notes||""}`) .join("\n")
      : "  - Aucune recette enregistrée";

    return `Je prépare ma stratégie nutritionnelle pour ma prochaine course.

== COURSE OBJECTIF ==
${nextObj ? `${nextObj.nom} le ${fmtDate(nextObj.date)} · ${nextObj.distance||"?"}km · ${nextObj.dp||"?"}m D+` : "- Aucune course prochaine définie"}

== MES PRODUITS DISPONIBLES ==
${prodsStr}

== MES RECETTES ==
${recettesStr}

Aide-moi à construire ma stratégie de ravitaillement pour cette course : fréquence, quantités, répartition glucides/protéines/hydratation.`;
  };

  // ── Données export ──────────────────────────────────────────────────────────
  const exportGabarit = () => {
    const today = new Date();
    const d = (offset) => {
      const dt = new Date(today); dt.setDate(dt.getDate()+offset);
      return localDate(dt);
    };
    const gabarit = {
      "_stride_programme": "1.0",
      "_info": "Gabarit — remplace les valeurs par celles générées par ton Coach IA. Importe ce fichier dans Stride > Mon coach IA.",
      "seances": [
        { "date": d(1),  "demiJournee": "Lundi AM",    "activite": "Musculation",        "statut": "Planifié", "commentaire": "Full body / Upper", "dureeObj": "1h00", "kmObj": "",   "dpObj": "",    "fcObj": "" },
        { "date": d(1),  "demiJournee": "Lundi PM",    "activite": "Repos",              "statut": "Planifié", "commentaire": "",                  "dureeObj": "",     "kmObj": "",   "dpObj": "",    "fcObj": "" },
        { "date": d(2),  "demiJournee": "Mardi AM",    "activite": "Trail",              "statut": "Planifié", "commentaire": "EF Z1-Z2",          "dureeObj": "1h15", "kmObj": "12", "dpObj": "300", "fcObj": "135" },
        { "date": d(2),  "demiJournee": "Mardi PM",    "activite": "Repos",              "statut": "Planifié", "commentaire": "",                  "dureeObj": "",     "kmObj": "",   "dpObj": "",    "fcObj": "" },
        { "date": d(3),  "demiJournee": "Mercredi AM", "activite": "Trail",              "statut": "Planifié", "commentaire": "Seuil 3×8min Z4",   "dureeObj": "1h30", "kmObj": "15", "dpObj": "400", "fcObj": "155" },
        { "date": d(4),  "demiJournee": "Jeudi AM",    "activite": "Mobilité / Gainage", "statut": "Planifié", "commentaire": "Gainage + étirements","dureeObj": "0h45","kmObj": "",  "dpObj": "",    "fcObj": "" },
        { "date": d(5),  "demiJournee": "Vendredi AM", "activite": "Musculation",        "statut": "Planifié", "commentaire": "Lower body",        "dureeObj": "1h00", "kmObj": "",   "dpObj": "",    "fcObj": "" },
        { "date": d(6),  "demiJournee": "Samedi AM",   "activite": "Trail",              "statut": "Planifié", "commentaire": "Long run Z2",       "dureeObj": "2h30", "kmObj": "25", "dpObj": "700", "fcObj": "140" },
        { "date": d(7),  "demiJournee": "Dimanche AM", "activite": "Repos",              "statut": "Planifié", "commentaire": "Récupération active","dureeObj": "",    "kmObj": "",   "dpObj": "",    "fcObj": "" }
      ]
    };
    exportJSON(gabarit, "stride-gabarit-programme.json");
  };

  const exportLightFromCoach = () => {
    const daysAgo60 = daysAgo(60); const daysAgo30 = daysAgo(30); const days30 = daysAhead(30);
    const pick = (obj, keys) => Object.fromEntries(keys.filter(k=>k in obj).map(k=>[k,obj[k]]));
    const data = {
      _stride_export:"light", _date:today,
      activites: activites.filter(a=>a.dateHeure?.slice(0,10)>=daysAgo60).map(a=>pick(a,["date","dateHeure","type","titre","duree","distance","dp","fcMoy","fcMax","z1","z2","z3","z4","z5","tss","gapMoy","cal"])),
      sommeil: sommeil.filter(s=>s.date>=daysAgo60).map(s=>pick(s,["date","score","qualite","duree","bodyBatteryMatin","vfc","fcRepos"])),
      vfcData: vfcData.filter(v=>v.date>=daysAgo60).map(v=>pick(v,["date","vfc","moy7j","vo2max","chargeAigue","chargeChronique","z1fin","z2fin","z3fin","z4fin","fcMax"])),
      journalNutri: (journalNutri||[]).filter(j=>j.date>=daysAgo60).map(j=>pick(j,["date","kcalBrulees","kcalConso","proteines","lipides","glucides","notes"])),
      poids: poids.map(p=>pick(p,["date","poids","ventre","taille_cm","hanche","cuisse","bras"])),
      seances: seances.filter(s=>s.date>=daysAgo30&&s.date<=days30).map(s=>pick(s,["date","demiJournee","activite","statut","commentaire","dureeObj","kmObj","dpObj","fcObj","dureeGarmin","kmGarmin","fcMoy","fcMax","z2","z3"])),
    };
    exportJSON(data, `stride-coach-${today}.json`);
  };

  // ── Styles ───────────────────────────────────────────────────────────────────
  const cardStyle = {background:C.white,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:16,overflow:"hidden"};
  const rowStyle  = {display:"flex",alignItems:"center",gap:12,padding:"14px 18px"};
  const secLbl    = (t) => <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted,marginBottom:8,marginTop:4}}>{t}</div>;
  const BADGE_S   = {fontSize:10,padding:"1px 7px",borderRadius:10,fontWeight:500,background:"#E6F1FB",color:"#0C447C"};
  const BADGE_V   = {fontSize:10,padding:"1px 7px",borderRadius:10,fontWeight:500,background:"#FAEEDA",color:"#633806"};

  const PROMPTS = [
    { key:"config",    icon:"⚙",  title:"Configurer mon Coach IA",    badge:BADGE_S, badgeLabel:"Profil statique",  sub:"Profil · zones FC · objectifs · semaine type · instructions IA",    fn:buildPromptConfig },
    { key:"semaine",   icon:"📅", title:"Analyser ma semaine",         badge:BADGE_V, badgeLabel:"Données variables", sub:"7 derniers jours — séances, charge, sommeil, VFC",                  fn:buildPromptSemaine },
    { key:"programme", icon:"🏔", title:"Générer mon programme",       badge:BADGE_V, badgeLabel:"Données variables", sub:"Objectifs + forme actuelle → programme JSON prêt à importer",      fn:buildPromptProgramme },
    { key:"forme",     icon:"❤",  title:"Bilan de forme",              badge:BADGE_V, badgeLabel:"Données variables", sub:"VFC, sommeil, poids, ratio charge — 30 derniers jours",             fn:buildPromptForme },
    { key:"nutri",     icon:"⚡", title:"Bilan nutrition",             badge:BADGE_V, badgeLabel:"Données variables", sub:"Kcal, macros, delta — 30 jours vs charge d'entraînement",          fn:buildPromptNutri },
    { key:"nutricourse",icon:"🍽",title:"Stratégie nutrition course",  badge:BADGE_S, badgeLabel:"Profil statique",  sub:"Tes recettes et produits → plan de ravitaillement de course",       fn:buildPromptNutriCourse },
  ];

  return (
    <div className="anim" style={{padding:"24px 40px 80px"}}>
      <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:C.inkLight,marginBottom:4}}>Mon coach IA</h1>
      <p style={{fontSize:12,color:C.muted,marginBottom:24}}>Ouvre ton IA préférée · copie des prompts pré-remplis · importe le programme généré</p>

      {/* ── Ouvrir une IA ── */}
      <div style={{marginBottom:8,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted}}>Ouvrir une IA</div>
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",marginBottom:24}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
          {IA_LINKS.map(ai=>(
            <a key={ai.id} href={ai.url} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                padding:"12px 8px",borderRadius:10,border:`0.5px solid ${C.border}`,
                background:C.stone,cursor:"pointer",textDecoration:"none",
                transition:"border-color .15s"}}>
              {ai.logo}
              <span style={{fontSize:11,fontWeight:500,color:C.inkLight}}>{ai.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ── Layout 2 colonnes ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,alignItems:"start"}}>

        {/* Colonne gauche : Données + Programme */}
        <div>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted,marginBottom:8}}>Données & Programme</div>
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            {/* Export */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px"}}>
              <span style={{fontSize:20,width:26,textAlign:"center",flexShrink:0}}>📤</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>Export Coach</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>Fichier léger — 60j activités, séances ±30j</div>
              </div>
              <Btn variant="sage" size="sm" onClick={exportLightFromCoach}>⬇</Btn>
            </div>
            {/* Import programme */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderTop:`1px solid ${C.border}`}}>
              <span style={{fontSize:20,width:26,textAlign:"center",flexShrink:0}}>📥</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:C.inkLight}}>Importer un programme</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>JSON généré par ton Coach IA</div>
                {impMsg&&<div style={{fontSize:11,color:C.green,fontWeight:500,marginTop:3}}>{impMsg}</div>}
              </div>
              <input ref={progRef} type="file" accept=".json" style={{display:"none"}} onChange={handleProgramme}/>
              <Btn variant="soft" size="sm" onClick={()=>progRef.current?.click()}>⬆</Btn>
            </div>
          </div>

          {/* Légende badges */}
          <div style={{marginTop:20,marginBottom:8,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted}}>Légende</div>
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.muted}}>
              <span style={{...BADGE_S,flexShrink:0}}>Profil statique</span>
              <span>À coller dans les instructions système de ton projet IA — à faire une seule fois</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.muted}}>
              <span style={{...BADGE_V,flexShrink:0}}>Données variables</span>
              <span>À copier au début de chaque conversation — mis à jour avec tes données du moment</span>
            </div>
          </div>
        </div>

        {/* Colonne droite : Prompts */}
        <div>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",color:C.muted,marginBottom:8}}>Prompts prêts à copier</div>
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            {PROMPTS.map((p,i)=>(
              <div key={p.key} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",
                borderTop:i>0?`1px solid ${C.border}`:"none"}}>
                <span style={{fontSize:16,width:22,textAlign:"center",flexShrink:0}}>{p.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.inkLight,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                    {p.title}
                    <span style={p.badge}>{p.badgeLabel}</span>
                  </div>
                  <div style={{fontSize:10,color:C.muted,marginTop:1,lineHeight:1.3}}>{p.sub}</div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  {p.key==="programme"&&(
                    <button onClick={exportGabarit}
                      style={{padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:500,
                        cursor:"pointer",border:`0.5px solid ${C.border}`,
                        background:C.stone,color:C.stoneDeep,fontFamily:"inherit"}}
                      title="Télécharger un gabarit JSON à donner au Coach IA">
                      Gabarit
                    </button>
                  )}
                  <button onClick={()=>copyPrompt(p.key, p.fn())}
                    style={{padding:"4px 12px",borderRadius:8,fontSize:11,fontWeight:500,
                      cursor:"pointer",
                      border:`0.5px solid ${copied===p.key?C.forest:C.border}`,
                      background:copied===p.key?C.forestPale:"transparent",
                      color:copied===p.key?C.forest:C.muted,fontFamily:"inherit"}}>
                    {copied===p.key?"✓":"Copier"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}


export default MonCoachIA;
