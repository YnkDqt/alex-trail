import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { C, RUNNER_LEVELS, TERRAIN_TYPES, DEFAULT_EQUIPMENT, PREP_TIMELINE, EMPTY_SETTINGS, DEFAULT_FLAT_SPEED } from '../constants.js';
import { fmtTime, fmtPace, fmtHeure, isNight, calcNutrition, calcPassingTimes, exportRecap, exportGPXMontre, suggestSpeed, autoSegmentGPX, parseGarminCSV, buildElevationProfile, calcSlopeFromGPX, parseGPX } from '../utils.jsx';
import { Btn, Card, KPI, PageTitle, Field, Modal, ConfirmDialog, Empty, Hr, CustomTooltip } from '../atoms.jsx';

// ─── VUE ANALYSE ─────────────────────────────────────────────────────────────
export default function AnalyseView({ race, segments, settings, produits = [], recettes = [], isMobile, onNavigate }) {
  // Hooks toujours en haut, avant tout early return (règles React)
  const [activeTab, setActiveTab] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const segsNormaux = segments.filter(s => s.type !== "ravito" && s.type !== "repos");
  const ravitos = [...(race.ravitos||[])].sort((a,b) => a.km - b.km).filter(rv => rv.assistancePresente !== false);
  const totalDistKm = race.totalDistance || segsNormaux.reduce((s,g) => s+g.endKm-g.startKm, 0);
  const totalDplus  = race.totalElevPos  || 0;
  const totalTime   = segsNormaux.reduce((s,seg) => s + (seg.speedKmh > 0 ? (seg.endKm-seg.startKm)/seg.speedKmh*3600 : 0), 0);
  const totalTimeH  = totalTime / 3600;
  const levelData   = RUNNER_LEVELS.find(l => l.key === (settings.runnerLevel||"intermediaire")) || RUNNER_LEVELS[1];
  const garminCoeff = settings.garminCoeff || 1;
  const gs          = settings.garminStats;
  const paceStrat   = settings.paceStrategy || 0;

  const hasData = segsNormaux.length > 0;

  // ── helpers ──────────────────────────────────────────────────────────────
  const statusIcon = { ok:"✅", warn:"⚠️", alert:"🔴", info:"ℹ️" };
  const statusBg   = { ok:C.greenPale, warn:C.yellowPale, alert:C.redPale, info:C.bluePale };
  const statusText = { ok:C.green, warn:C.yellow, alert:C.red, info:C.blue };
  const Point = ({ status, titre, valeur, explication }) => (
    <div style={{padding:"12px 16px",borderRadius:12,background:statusBg[status],border:`1px solid ${statusText[status]}30`}}>
      <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:3}}>
        <span style={{fontSize:14}}>{statusIcon[status]}</span>
        <span style={{fontWeight:600,fontSize:13,color:"var(--text-c)"}}>{titre}</span>
      </div>
      <div style={{fontSize:12,fontWeight:600,color:statusText[status],marginBottom:4,marginLeft:22}}>{valeur}</div>
      <div style={{fontSize:12,color:"var(--muted-c)",lineHeight:1.6,marginLeft:22}}>{explication}</div>
    </div>
  );
  const SectionTitle = ({ children }) => (
    <div style={{fontWeight:600,fontSize:15,color:"var(--text-c)",marginBottom:12,paddingBottom:8,borderBottom:`1px solid var(--border-c)`}}>{children}</div>
  );

  if (!hasData) return (
    <div className="anim">
      <PageTitle sub="Métriques et recommandations de préparation">Analyse</PageTitle>
      <Empty icon="📊" title="Aucune donnée à analyser" sub="Définis des segments dans Stratégie de course pour accéder à l'analyse." action={<Btn onClick={() => onNavigate("preparation")}>Aller à la stratégie</Btn>} />
    </div>
  );

  // ── 1. FATIGUE + COHÉRENCE STRATÉGIE ─────────────────────────────────────
  const totalEK = segsNormaux.reduce((s,seg) => {
    const dist=seg.endKm-seg.startKm, dp=seg.slopePct>0?(seg.slopePct/100)*dist*1000:0, dm=seg.slopePct<0?Math.abs(seg.slopePct/100)*dist*1000:0;
    return s+dist+dp/100+dm/200;
  },0)||1;
  let cumEK=0, sn=0;
  const fatigueData = segments.map(seg => {
    if (seg.type==="ravito") { const rec=Math.min((seg.dureeMin||3)*0.6*levelData.coeff*garminCoeff,4); cumEK=Math.max(0,cumEK-rec); return {label:seg.label||"Rv",type:"ravito",charge:Math.round(cumEK/totalEK*100),reserve:Math.max(0,Math.round(100-cumEK/totalEK*100))}; }
    if (seg.type==="repos")  { const rec=Math.min((seg.dureeMin||20)*0.4*levelData.coeff,8); cumEK=Math.max(0,cumEK-rec); return {label:seg.label||"Repos",type:"repos",charge:Math.round(cumEK/totalEK*100),reserve:Math.max(0,Math.round(100-cumEK/totalEK*100))}; }
    sn++;
    const dist=seg.endKm-seg.startKm, dp=seg.slopePct>0?(seg.slopePct/100)*dist*1000:0, dm=seg.slopePct<0?Math.abs(seg.slopePct/100)*dist*1000:0;
    const ek=dist+dp/100+dm/200, prog=sn/(segsNormaux.length||1);
    const pf=paceStrat<0?(1+prog*0.25):paceStrat>0?(1-prog*0.15+0.08):1;
    cumEK+=ek*pf/(levelData.coeff*garminCoeff);
    const cp=Math.min(100,Math.round(cumEK/totalEK*100));
    return {label:`S${sn}`,fullLabel:`${seg.startKm}→${seg.endKm} km`,type:"seg",charge:cp,reserve:Math.max(0,100-cp)};
  });
  const SEUIL=80;

  // GAP normalisé de la stratégie — convertit chaque segment en vitesse équivalente plat
  // via Minetti : Cr(pente) / Cr(0) donne le facteur de coût, donc vitesse_GAP = vitesse * Cr(i) / Cr(0)
  const gapEquivStrategie = (() => {
    const Cr0 = 3.6; // J/kg/m sur plat (Minetti 2002)
    const CrAt = (slopePct) => {
      const i = slopePct / 100;
      return 155.4*i**5 - 30.4*i**4 - 43.3*i**3 + 46.3*i**2 + 19.5*i + 3.6;
    };
    let totalDist = 0, totalGAPDist = 0;
    segsNormaux.forEach(seg => {
      const dist = seg.endKm - seg.startKm;
      const cr = CrAt(seg.slopePct);
      const gapSpeed = seg.speedKmh * (cr / Cr0); // vitesse équivalente plat
      totalDist += dist;
      totalGAPDist += gapSpeed * dist;
    });
    return totalDist > 0 ? totalGAPDist / totalDist : 0;
  })();

  const garminGapKmh = gs?.avgGapKmh;
  const allureEcart = garminGapKmh ? Math.round((gapEquivStrategie - garminGapKmh) / garminGapKmh * 100) : null;
  const dplusPerH = totalTimeH>0 ? Math.round(totalDplus/totalTimeH) : 0;
  const mid = totalDistKm/2;
  const hardSegsSecondHalf = segsNormaux.filter(s=>s.startKm>=mid&&s.slopePct>=12).length;
  const avgSlopeFirst  = segsNormaux.filter(s=>s.endKm<=mid).reduce((s,g)=>s+g.slopePct,0)/(segsNormaux.filter(s=>s.endKm<=mid).length||1);
  const avgSlopeSecond = segsNormaux.filter(s=>s.startKm>=mid).reduce((s,g)=>s+g.slopePct,0)/(segsNormaux.filter(s=>s.startKm>=mid).length||1);
  let maxGap=0, prevKm=0;
  ravitos.forEach(rv=>{maxGap=Math.max(maxGap,rv.km-prevKm);prevKm=rv.km;});
  maxGap=Math.max(maxGap,totalDistKm-prevKm);
  const itraRef={debutant:30,intermediaire:50,confirme:70,expert:100};
  const maxEK=itraRef[settings.runnerLevel||"intermediaire"]||50;
  const ekTotal=segsNormaux.reduce((s,seg)=>{const dist=seg.endKm-seg.startKm,dp=seg.slopePct>0?(seg.slopePct/100)*dist*1000:0,dm=seg.slopePct<0?Math.abs(seg.slopePct/100)*dist*1000:0;return s+dist+dp/100+dm/200;},0);
  const tempC=settings.tempC||15;
  const hasAdverseMeteo=settings.rain||settings.snow||settings.wind||tempC>28||tempC<0;

  const pointsStrategie = [];
  if (allureEcart!==null) {
    const s=allureEcart<=5?"ok":allureEcart<=15?"warn":"alert";
    pointsStrategie.push({status:s,
      titre:"Allure vs historique Garmin (normalisée en dénivelé)",
      valeur:`GAP stratégie estimé : ${fmtPace(gapEquivStrategie)}/km · GAP habituel Garmin : ${fmtPace(garminGapKmh)}/km · écart ${allureEcart>0?"+":""}${allureEcart}%`,
      explication: s==="ok"
        ? `L'allure de ta stratégie, convertie en équivalent plat (formule Minetti), est proche de ton GAP Garmin habituel. Stratégie cohérente avec ton niveau.`
        : s==="warn"
        ? `Ton GAP stratégie est ${allureEcart}% au-dessus de ton GAP habituel. Ambitieux — surveille les premiers segments pour ne pas partir trop vite.`
        : `Ton GAP stratégie est ${allureEcart}% au-dessus de ton niveau habituel. Risque de blow-up en 2e moitié. Envisage de réviser les vitesses à la baisse.`
    });
  } else {
    pointsStrategie.push({status:"info",
      titre:"Allure vs historique (normalisée en dénivelé)",
      valeur:"Données Garmin non disponibles",
      explication:"Charge ton Activities.csv dans Profil de course pour comparer ton allure GAP stratégie à ton niveau réel. La comparaison est normalisée en dénivelé via la formule Minetti."
    });
  }
  const dpS=dplusPerH>500?"alert":dplusPerH>300?"warn":"ok";
  pointsStrategie.push({status:dpS,titre:"Densité de dénivelé",valeur:`${dplusPerH} m D+/h · ${Math.round(totalDplus)} m D+ total`,
    explication:dpS==="ok"?"Densité modérée (< 300 m/h). Effort gérable sur la durée.":dpS==="warn"?`${dplusPerH} m D+/h est élevé. Au-delà de 300 m/h sur plusieurs heures, la fatigue s'accumule rapidement (Millet et al., 2011).`:`${dplusPerH} m D+/h est très élevé. Nécessite une expérience solide et une gestion très conservative au départ.`});
  const distS=hardSegsSecondHalf>=2?"warn":"ok";
  pointsStrategie.push({status:distS,titre:"Distribution de l'effort",valeur:`Pente moy. 1ère moitié : +${avgSlopeFirst.toFixed(1)}% · 2e moitié : +${avgSlopeSecond.toFixed(1)}%`,
    explication:distS==="ok"?"Les segments difficiles ne sont pas concentrés en fin de course. Bonne distribution.":`${hardSegsSecondHalf} segment${hardSegsSecondHalf>1?"s":""} à pente ≥ 12% en 2e moitié, quand la fatigue est maximale. Prévois une marge de sécurité.`});
  const rvS=maxGap>20?"alert":maxGap>15?"warn":"ok";
  pointsStrategie.push({status:rvS,titre:"Couverture ravitaillement",valeur:ravitos.length===0?"Aucun ravito défini":`${ravitos.length} ravito${ravitos.length>1?"s":""} · gap max ${maxGap.toFixed(1)} km`,
    explication:ravitos.length===0?"Ajoute des ravitos dans Profil de course pour planifier ta nutrition et ton assistance.":rvS==="ok"?"Bonne couverture : aucun tronçon > 15 km sans ravito.":rvS==="warn"?`Le plus long tronçon sans ravito fait ${maxGap.toFixed(1)} km. Assure-toi d'avoir assez d'autonomie hydrique.`:`Un tronçon de ${maxGap.toFixed(1)} km sans ravito. Envisage un ravito supplémentaire.`});
  const ekS=ekTotal>maxEK*1.3?"alert":ekTotal>maxEK?"warn":"ok";
  pointsStrategie.push({status:ekS,titre:"Effort ITRA global",valeur:`${ekTotal.toFixed(1)} EK · référence ${levelData.label} : ~${maxEK} EK`,
    explication:ekS==="ok"?`Effort cohérent avec ton niveau ${levelData.label}. Formule ITRA : EK = distance + D+/100 + D-/200.`:ekS==="warn"?`${ekTotal.toFixed(1)} EK dépasse légèrement la référence. Course ambitieuse — pars conservateur.`:`${ekTotal.toFixed(1)} EK est significativement au-dessus de la référence. Réévalue tes objectifs de temps.`});
  if (hasAdverseMeteo) {
    const det=[settings.rain?"pluie":null,settings.snow?"neige":null,settings.wind?"vent fort":null,tempC>28?`chaleur ${tempC}°C`:null,tempC<0?`froid ${tempC}°C`:null].filter(Boolean).join(", ");
    pointsStrategie.push({status:"warn",titre:"Impact météo",valeur:det.charAt(0).toUpperCase()+det.slice(1),
      explication:tempC>28?"Forte chaleur : augmente l'hydratation de 150-200 mL/h. Réduis les vitesses de 5-8% sur les montées exposées.":settings.snow?"Neige : vitesses réduites de 15-20%, équipement spécifique requis.":"Conditions dégradées. Adapte tes vitesses et augmente les marges de temps aux ravitos."});
  }

  // ── 2. COUVERTURE NUTRITIONNELLE ─────────────────────────────────────────
  // Source réelle : bibliothèque (produits + recettes) + plan stocké dans race.depart.produits et chaque rv.produits
  const allBibItems = [
    ...produits.map(p => ({ ...p, itemType: "produit" })),
    ...recettes.map(r => ({ ...r, itemType: "recette" }))
  ];

  // Helper interne : calcule les macros d'une recette (parcourt ingredients)
  const calcMacrosRecette = (rec) => {
    return (rec.ingredients || []).reduce((acc, ing) => {
      const data = ing._ciqualData || produits.find(p => p.id === ing.produitId);
      if (!data) return acc;
      const factor = parseFloat(ing.quantite) || 0;
      return {
        kcal:      acc.kcal      + (data.kcal      || 0) * factor / 100,
        glucides:  acc.glucides  + (data.glucides  || 0) * factor / 100,
        sodium:    acc.sodium    + (data.sodium    || 0) * factor / 100,
        potassium: acc.potassium + (data.potassium || 0) * factor / 100,
        magnesium: acc.magnesium + (data.magnesium || 0) * factor / 100,
      };
    }, { kcal: 0, glucides: 0, sodium: 0, potassium: 0, magnesium: 0 });
  };

  // Détection liquide simple (eau pure ou boisson)
  const isItemLiquide = (item) => {
    if (item.type === "Eau pure" || item.type === "Boisson énergétique") return true;
    if (item.boisson) return true;
    const nom = (item.nom || "").toLowerCase();
    if (nom.includes("eau") || nom.includes("boisson")) return true;
    return false;
  };

  // Calcule kcal/glucides/eauMl/micros pour un item × quantité
  // - Recette : quantite = nb portions
  // - Produit : quantite = grammes (ou ml pour boisson)
  const nutriItem = (item, quantite) => {
    if (!item || !quantite) return { kcal: 0, glucides: 0, eauMl: 0, sodium: 0, potassium: 0, magnesium: 0 };
    const liquide = isItemLiquide(item);
    if (item.itemType === "recette") {
      const macros = item.macros || calcMacrosRecette(item);
      const ratio = quantite / (item.portions || 1);
      const eauMl = liquide ? (item.volumeMlParPortion || 0) * ratio : 0;
      return {
        kcal:      Math.round(macros.kcal      * ratio),
        glucides:  Math.round(macros.glucides  * ratio),
        eauMl:     Math.round(eauMl),
        sodium:    Math.round((macros.sodium    || 0) * ratio),
        potassium: Math.round((macros.potassium || 0) * ratio),
        magnesium: Math.round((macros.magnesium || 0) * ratio),
      };
    }
    // Produit : ratio = grammes / 100
    const ratio = quantite / 100;
    const eauMl = liquide ? quantite : 0; // 1g liquide ≈ 1ml
    return {
      kcal:      Math.round((item.kcal      || 0) * ratio),
      glucides:  Math.round((item.glucides  || 0) * ratio),
      eauMl:     Math.round(eauMl),
      sodium:    Math.round((item.sodium    || 0) * ratio),
      potassium: Math.round((item.potassium || 0) * ratio),
      magnesium: Math.round((item.magnesium || 0) * ratio),
    };
  };

  // Récupère le plan d'un point (depart ou ravito) — array [{id, quantite}]
  const planAt = (key) => {
    if (key === "depart") return race.depart?.produits || [];
    const rv = ravitos.find(r => String(r.id) === key);
    return rv?.produits || [];
  };

  const nutriTotals = segsNormaux.reduce((acc, seg) => {
    const n = calcNutrition(seg, settings);
    const dH = seg.speedKmh > 0 ? (seg.endKm - seg.startKm) / seg.speedKmh : 0;
    return {
      kcal:     acc.kcal     + n.kcal,
      glucides: acc.glucides + Math.round(n.glucidesH * dH),
      eau:      acc.eau      + Math.round(n.eauH * dH),
    };
  }, { kcal: 0, glucides: 0, eau: 0 });

  // Total emporté sur tous les points (départ + ravitos)
  const allPlanKeys = ["depart", ...ravitos.map(r => String(r.id))];
  const totalEmporte = allPlanKeys.reduce((acc, key) => {
    return planAt(key).reduce((a, { id, quantite }) => {
      const item = allBibItems.find(x => x.id === id);
      if (!item) return a;
      const n = nutriItem(item, quantite);
      return {
        kcal:     a.kcal     + n.kcal,
        glucides: a.glucides + n.glucides,
        eauMl:    a.eauMl    + n.eauMl,
      };
    }, acc);
  }, { kcal: 0, glucides: 0, eauMl: 0 });

  // Micronutriments totaux emportés
  const microEmporte = allPlanKeys.reduce((acc, key) => {
    return planAt(key).reduce((a, { id, quantite }) => {
      const item = allBibItems.find(x => x.id === id);
      if (!item) return a;
      const n = nutriItem(item, quantite);
      return {
        sodium:    a.sodium    + n.sodium,
        potassium: a.potassium + n.potassium,
        magnesium: a.magnesium + n.magnesium,
      };
    }, acc);
  }, { sodium: 0, potassium: 0, magnesium: 0 });

  // Cibles micronutriments basées sur la durée de course (mg total)
  const microCibles = {
    sodium:    { min: 500*totalTimeH,  max: 1000*totalTimeH, label: "Sodium",    unit: "mg", risk_low: "Risque d'hyponatrémie", risk_high: "Soif excessive, rétention" },
    potassium: { min: 150*totalTimeH,  max: 300*totalTimeH,  label: "Potassium", unit: "mg", risk_low: "Crampes musculaires",   risk_high: "Peu de risque alimentaire" },
    magnesium: { min: 50*totalTimeH,   max: 100*totalTimeH,  label: "Magnésium", unit: "mg", risk_low: "Crampes, fatigue",      risk_high: "Troubles digestifs possibles" },
  };

  // Couverture par tronçon — logique ravito autonome :
  // Si le ravito de départ d'un tronçon est autonome, ses produits planifiés
  // sont emportés dans le sac, pas reçus sur place.
  // On regroupe les tronçons consécutifs en autonomie en un seul "bloc autonome"
  // et on compare la somme des calories emportées à la somme des besoins.
  const bornes=[0,...ravitos.map(r=>r.km),totalDistKm].filter((v,i,a)=>v!==a[i-1]);
  const zonesNutri=(() => {
    const raw = bornes.slice(0,-1).map((from,i) => {
      const to=bornes[i+1];
      const debutRavito = i===0 ? null : ravitos[i-1];
      const finRavito   = ravitos[i]; // ravito qui clôt ce tronçon
      const label=i===0?"Départ":(debutRavito?.name||`Ravito ${i}`);
      const toLbl=i===bornes.length-2?"Arrivée":(finRavito?.name||`Ravito ${i+1}`);
      const pointKey=i===0?"depart":String(debutRavito?.id);
      // Ce tronçon est "en autonomie" si le ravito qui le clôt n'a pas d'assistance
      const autonome = finRavito?.assistancePresente === false;
      const besoinKcal=segsNormaux.filter(s=>s.startKm<to&&s.endKm>from).reduce((acc,seg)=>{
        const overlap=Math.min(seg.endKm,to)-Math.max(seg.startKm,from);
        const ratio=overlap/(seg.endKm-seg.startKm||1);
        return acc+calcNutrition(seg,settings).kcal*ratio;
      },0);
      // Calories emportées depuis ce point (produits planifiés à ce ravito/départ)
      const items = planAt(pointKey);
      const emporteKcal = items.reduce((a, { id, quantite }) => {
        const item = allBibItems.find(x => x.id === id);
        if (!item) return a;
        return a + nutriItem(item, quantite).kcal;
      }, 0);
      return {label,toLbl,from,to,pointKey,besoinKcal:Math.round(besoinKcal),emporteKcal,autonome};
    });

    // Fusion des blocs autonomes consécutifs avec leur tronçon précédent
    // Logique : le stock d'un ravito autonome est emporté depuis le point précédent
    const merged = [];
    let carryStock = 0; // stock accumulé des ravitos autonomes précédents
    let carryBesoin = 0;
    let carryLabel = null;

    raw.forEach((z, i) => {
      const totalStock = z.emporteKcal + carryStock;
      const totalBesoin = z.besoinKcal + carryBesoin;

      if (z.autonome) {
        // Ce tronçon se termine à un ravito autonome — on accumule pour le suivant sans afficher
        carryStock = totalStock;
        carryBesoin = totalBesoin;
        if (!carryLabel) carryLabel = z.label;
      } else {
        // Tronçon normal — on intègre le carry éventuel
        const finalStock = totalStock;
        const finalBesoin = totalBesoin;
        const pct = finalBesoin > 0 ? Math.round(finalStock / finalBesoin * 100) : null;
        const displayLabel = carryLabel ? `${carryLabel} → ${z.toLbl}` : `${z.label} → ${z.toLbl}`;
        merged.push({ ...z, label: displayLabel, emporteKcal: finalStock, besoinKcal: Math.round(finalBesoin), pct });
        carryStock = 0;
        carryBesoin = 0;
        carryLabel = null;
      }
    });
    return merged;
  })();

  const glucidesTarget=settings.glucidesTargetGh;
  const glucidesActuelH=totalTimeH>0?Math.round(totalEmporte.glucides/totalTimeH):0;
  const glucidesStatus=glucidesTarget!=null?(glucidesActuelH>=glucidesTarget*0.85?"ok":glucidesActuelH>=glucidesTarget*0.6?"warn":"alert"):(totalEmporte.glucides>nutriTotals.glucides*0.8?"ok":"warn");
  const kcalStatus=totalEmporte.kcal>=nutriTotals.kcal*0.85?"ok":totalEmporte.kcal>=nutriTotals.kcal*0.6?"warn":"alert";
  const eauStatus=totalEmporte.eauMl>=nutriTotals.eau*0.8?"ok":totalEmporte.eauMl>0?"warn":"alert";

  // ── 3. PRÉPARATION GLOBALE ────────────────────────────────────────────────
  const equipment = settings.equipment || [];
  const activeItems = equipment.filter(i=>i.actif!==false);
  const checkedCount = activeItems.filter(i=>i.checked).length;
  const checklistPct = activeItems.length>0?Math.round(checkedCount/activeItems.length*100):0;

  // Poids équipement emporté (items actifs + emporte)
  const poidsEquipG = activeItems.filter(i=>i.emporte!==false).reduce((s,i)=>s+(i.poidsG||0),0);

  // Poids nutrition emportée au départ uniquement (pas les ravitos — reçus sur place)
  // - Produit : quantite est en grammes (ou ml pour liquide)
  // - Recette : quantite est en portions, poids = quantite × grammesParPortion (ou volumeMlParPortion si liquide)
  const poidsNutriG = (() => {
    const items = planAt("depart");
    return items.reduce((s, { id, quantite }) => {
      const item = allBibItems.find(x => x.id === id);
      if (!item) return s;
      if (item.itemType === "recette") {
        const portionG = parseFloat(item.grammesParPortion) || 0;
        const portionMl = parseFloat(item.volumeMlParPortion) || 0;
        const grammes = (portionG > 0 ? portionG : portionMl) * quantite;
        return s + Math.round(grammes);
      }
      // Produit : la quantite EST le poids (g ou ml ≈ g)
      return s + Math.round(quantite);
    }, 0);
  })();

  const poidsTotalG = poidsEquipG + poidsNutriG;

  const { times: passingTimes } = calcPassingTimes(segments, settings.startTime);
  const arrivalSec = passingTimes.length ? passingTimes[passingTimes.length-1] : 0;
  const isNightArrival = isNight(arrivalSec);
  const lampeItem = equipment.find(i=>/lampe/i.test(i.label));
  const lampeActive = lampeItem?.actif!==false;
  const lampeChecked = lampeItem?.checked;
  const batonsItem = equipment.find(i=>/b[âa]ton/i.test(i.label));
  const batonsActive = batonsItem?.actif!==false;
  const hasTechTerrain = segsNormaux.some(s=>s.terrain==="technique"||s.terrain==="trestech");
  const meteoVerifiee = settings.meteoFetched;
  const daysAway = settings.raceDate ? Math.round((new Date(settings.raceDate)-new Date())/86400000) : null;
  const meteoDispoMais = daysAway!==null&&daysAway<=7&&!meteoVerifiee;

  const pointsPrepa = [];
  const checklistS=checklistPct===100?"ok":checklistPct>=70?"warn":"alert";
  pointsPrepa.push({status:checklistS,titre:"Checklist équipement",valeur:`${checkedCount}/${activeItems.length} items cochés (${checklistPct}%)`,
    explication:checklistS==="ok"?"Tous les items sont préparés. Bonne préparation matérielle.":checklistS==="warn"?`${activeItems.length-checkedCount} item${activeItems.length-checkedCount>1?"s":""} non coché${activeItems.length-checkedCount>1?"s":""}. Passe en revue ta checklist dans Équipement avant le départ.`:`Plus de 30% des items non préparés. Accorde du temps à ta préparation matérielle.`});

  const fmtPoids = g => g >= 1000 ? `${(g/1000).toFixed(1)} kg` : `${g} g`;

  // Alerte 1 — Poids au départ
  if (poidsTotalG > 0) {
    const poidsTotalStatus = poidsTotalG > 8000 ? "alert" : poidsTotalG > 6000 ? "warn" : "ok";
    pointsPrepa.push({
      status: poidsTotalStatus,
      titre: "Poids estimé au départ",
      valeur: `${fmtPoids(poidsTotalG)} · équipement ${fmtPoids(poidsEquipG)} · nutrition ${fmtPoids(poidsNutriG)}`,
      explication: poidsTotalStatus==="ok"
        ? `Charge raisonnable au départ. Rappel : le poids de la nutrition diminuera au fil de la course.`
        : poidsTotalStatus==="warn"
        ? `${fmtPoids(poidsTotalG)} au départ, c'est élevé. Au-delà de 6 kg, chaque kilo supplémentaire ralentit l'allure et augmente la fatigue. Passe en revue ton équipement.`
        : `${fmtPoids(poidsTotalG)} au départ est très lourd pour un trail. Réduis la charge au maximum — le poids inutile coûte cher sur la durée.`
    });
  }

  // Alerte 2 — Autonomie jusqu'au premier ravito assisté
  {
    // Premier ravito avec assistance (ravitos est déjà filtré assistancePresente !== false)
    const premierRavitoAssiste = ravitos[0];
    const kmJusquaRavito = premierRavitoAssiste ? premierRavitoAssiste.km : totalDistKm;
    const labelCible = premierRavitoAssiste ? premierRavitoAssiste.name : "l'arrivée";

    // Besoin calorique sur ce tronçon
    const besoinTronconKcal = segsNormaux
      .filter(s => s.startKm < kmJusquaRavito)
      .reduce((acc, seg) => {
        const overlap = Math.min(seg.endKm, kmJusquaRavito) - seg.startKm;
        const ratio = overlap / (seg.endKm - seg.startKm || 1);
        return acc + calcNutrition(seg, settings).kcal * ratio;
      }, 0);

    // Calories emportées au départ
    const kcalDepart = planAt("depart").reduce((acc, { id, quantite }) => {
      const item = allBibItems.find(x => x.id === id);
      if (!item) return acc;
      return acc + nutriItem(item, quantite).kcal;
    }, 0);

    const dureeH = segsNormaux
      .filter(s => s.startKm < kmJusquaRavito)
      .reduce((acc, seg) => {
        const overlap = Math.min(seg.endKm, kmJusquaRavito) - seg.startKm;
        return acc + overlap / seg.speedKmh;
      }, 0);

    if (besoinTronconKcal > 0 && kcalDepart > 0) {
      const couverturePct = Math.round(kcalDepart / besoinTronconKcal * 100);
      const autoStatus = couverturePct >= 85 ? "ok" : couverturePct >= 60 ? "warn" : "alert";
      pointsPrepa.push({
        status: autoStatus,
        titre: `Autonomie jusqu'à ${labelCible}`,
        valeur: `${couverturePct}% des besoins couverts · ${Math.round(dureeH * 60)} min · ${kcalDepart} kcal emportés / ${Math.round(besoinTronconKcal)} kcal estimés`,
        explication: autoStatus === "ok"
          ? `Bonne autonomie jusqu'à ${labelCible}. Les calories emportées couvrent ${couverturePct}% du besoin estimé.`
          : autoStatus === "warn"
          ? `Les calories emportées ne couvrent que ${couverturePct}% du besoin jusqu'à ${labelCible}. Ajoute quelques produits supplémentaires dans ton plan de départ.`
          : `Déficit important jusqu'à ${labelCible} — seulement ${couverturePct}% des besoins couverts. Revois ton plan nutrition au départ.`
      });
    }
  }

  if (isNightArrival && lampeItem && !lampeActive) {
    pointsPrepa.push({status:"alert",titre:"Lampe frontale désactivée",valeur:`Arrivée estimée à ${fmtHeure(arrivalSec)} — course de nuit`,explication:"Ton arrivée est prévue après 21h. Active la lampe frontale dans ta checklist (Équipement) — obligatoire dans la plupart des règlements d'ultra."});
  } else if (isNightArrival && lampeItem && !lampeChecked) {
    pointsPrepa.push({status:"warn",titre:"Lampe frontale non cochée",valeur:`Arrivée estimée à ${fmtHeure(arrivalSec)} — course de nuit`,explication:"Course de nuit prévue. Pense à cocher la lampe frontale dans ta checklist avant de partir."});
  } else if (isNightArrival) {
    pointsPrepa.push({status:"ok",titre:"Lampe frontale",valeur:`Arrivée estimée à ${fmtHeure(arrivalSec)} — course de nuit`,explication:"Course de nuit : lampe frontale dans la liste. Vérifie les piles."});
  }

  if (meteoDispoMais) {
    pointsPrepa.push({status:"warn",titre:"Météo disponible mais non récupérée",valeur:`Course dans ${daysAway} jours — prévisions disponibles`,explication:"Clique sur \"Météo auto\" dans Profil de course pour récupérer les prévisions et adapter ta stratégie si besoin."});
  } else if (!meteoVerifiee && daysAway===null) {
    pointsPrepa.push({status:"info",titre:"Météo non vérifiée",valeur:"Date de course non renseignée",explication:"Renseigne la date de course dans Profil de course pour accéder à la météo automatique."});
  } else if (meteoVerifiee) {
    pointsPrepa.push({status:"ok",titre:"Météo récupérée",valeur:settings.meteoInfo||"Prévisions chargées",explication:"Les conditions météo sont prises en compte dans les calculs de nutrition et de vitesse."});
  }

  if (batonsActive && !hasTechTerrain) {
    pointsPrepa.push({status:"info",titre:"Bâtons prévus · terrain normal partout",valeur:"Aucun segment en terrain technique",explication:"Tous tes segments sont en terrain normal. Les bâtons sont optionnels — utiles sur les forts D+ mais peuvent ralentir en descente."});
  }

  // ── SOUS-SCORES (refonte 28/04) ──────────────────────────────────────────
  // Conversion status → score : ok=100, warn=70, alert=40, info=85
  const statusToPct = (s) => s === "ok" ? 100 : s === "warn" ? 70 : s === "alert" ? 40 : s === "info" ? 85 : 70;

  // Score Stratégie : moyenne des points stratégie (graph fatigue inclus via points)
  const scoreStrategie = pointsStrategie.length > 0
    ? Math.round(pointsStrategie.reduce((s, p) => s + statusToPct(p.status), 0) / pointsStrategie.length)
    : null;

  // Score Nutrition : pondération kcal (40) + glucides (40) + eau (20)
  const hasNutritionData = allBibItems.length > 0;
  const scoreNutrition = hasNutritionData
    ? Math.round(statusToPct(kcalStatus) * 0.4 + statusToPct(glucidesStatus) * 0.4 + statusToPct(eauStatus) * 0.2)
    : null;

  // Score Équipement : checklist (60%) + adaptation météo (40%)
  // Adaptation météo : items critiques selon les conditions doivent être checked + emporte
  const meteoChecks = [];
  const eqByLabel = (rgx) => equipment.find(i => rgx.test(i.label));
  const itemReady = (it) => it && it.actif && it.emporte && it.checked;
  if (settings.rain) {
    const veste = eqByLabel(/imper|veste|coupe[- ]?vent/i);
    meteoChecks.push({ key:"rain", label:"Pluie prévue → veste imperméable", ok: itemReady(veste) });
  }
  if (settings.snow || tempC < 5) {
    const chaud = eqByLabel(/veste|polaire|manches longues|chaud|imper/i);
    meteoChecks.push({ key:"cold", label:"Froid prévu → vêtement chaud", ok: itemReady(chaud) });
  }
  if (tempC > 25) {
    const casquette = eqByLabel(/casquette|buff|chapeau/i);
    meteoChecks.push({ key:"hot", label:"Chaleur prévue → casquette / buff", ok: itemReady(casquette) });
    const creme = eqByLabel(/cr[èe]me solaire|solaire/i);
    if (creme) meteoChecks.push({ key:"hot_cream", label:"Chaleur prévue → crème solaire", ok: itemReady(creme) });
  }
  if (isNightArrival && lampeActive) {
    const lampe = eqByLabel(/lampe|frontale/i);
    meteoChecks.push({ key:"night", label:"Course de nuit → lampe frontale", ok: itemReady(lampe) });
  }
  const meteoAdapted = meteoChecks.length > 0
    ? Math.round(meteoChecks.filter(c => c.ok).length / meteoChecks.length * 100)
    : 100;

  const scoreEquipement = activeItems.length > 0
    ? Math.round(checklistPct * 0.6 + meteoAdapted * 0.4)
    : null;

  // Score global : moyenne pondérée (Stratégie 30% + Nutrition 35% + Équipement 35%)
  // Entraînement et Forme à venir (algos à construire) — pondération à revoir quand ils arriveront.
  const scoresCalcules = [
    { val: scoreStrategie, w: 0.3 },
    { val: scoreNutrition, w: 0.35 },
    { val: scoreEquipement, w: 0.35 }
  ].filter(s => s.val != null);
  const totalWeights = scoresCalcules.reduce((s,x) => s+x.w, 0);
  const scoreGlobal = totalWeights > 0
    ? Math.round(scoresCalcules.reduce((s,x) => s + x.val*x.w, 0) / totalWeights)
    : null;

  // Comptage alertes / vigilances (pour le bandeau)
  const allPoints = [...pointsStrategie, ...pointsPrepa];
  const nbAlertes = allPoints.filter(p => p.status === "alert").length;
  const nbVigilances = allPoints.filter(p => p.status === "warn").length;

  // Helpers visuels
  const scoreColor = (v) => v == null ? C.muted : v >= 85 ? C.green : v >= 65 ? C.yellow : C.red;
  const ScoreBadge = ({ value, label, placeholder }) => (
    <div style={{
      background: placeholder ? "var(--surface-2)" : "var(--surface)",
      border: `1px solid var(--border-c)`,
      borderRadius: 10,
      padding: "10px 12px",
      textAlign: "center",
      opacity: placeholder ? 0.65 : 1
    }}>
      <div style={{fontSize:10,fontWeight:500,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>{label}</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:600,color:placeholder?C.muted:scoreColor(value),lineHeight:1}}>
        {value != null ? value : "—"}
      </div>
      <div style={{fontSize:10,color:C.muted,marginTop:2}}>{placeholder ? "à venir" : (value != null ? "/ 100" : "—")}</div>
    </div>
  );

  // Filtrage équipement par catégorie pour la colonne Équipement
  const eqByCat = activeItems.reduce((acc, it) => {
    (acc[it.cat] = acc[it.cat] || []).push(it);
    return acc;
  }, {});

  // Onglet par défaut au mount : la section qui a le plus d'alertes (si state pas encore initialisé)
  const computedDefaultTab = (() => {
    const counts = {
      strategie: pointsStrategie.filter(p => p.status === "alert").length,
      nutrition: [kcalStatus, glucidesStatus, eauStatus].filter(s => s === "alert").length,
      equipement: pointsPrepa.filter(p => p.status === "alert").length + meteoChecks.filter(c => !c.ok).length
    };
    const max = Math.max(counts.strategie, counts.nutrition, counts.equipement);
    if (max === 0) return "strategie";
    if (counts.strategie === max) return "strategie";
    if (counts.nutrition === max) return "nutrition";
    return "equipement";
  })();
  // Initialiser activeTab avec computedDefaultTab si pas encore défini par l'utilisateur
  const effectiveTab = activeTab || computedDefaultTab;

  return (
    <div className="anim">
      <PageTitle sub="Score de préparation et recommandations">Analyse</PageTitle>

      {/* ── BANDEAU SCORE GLOBAL + 5 SOUS-SCORES CLIQUABLES ─────────────── */}
      <Card style={{marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:20,alignItems:"center"}}>
          {/* Score global */}
          <div style={{textAlign:"center",paddingRight:20,borderRight:`1px solid var(--border-c)`}}>
            <div style={{fontSize:10,fontWeight:500,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Préparation globale</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:42,fontWeight:600,color:scoreColor(scoreGlobal),lineHeight:1}}>
              {scoreGlobal != null ? scoreGlobal : "—"}
            </div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>{scoreGlobal != null ? "/ 100" : "données insuffisantes"}</div>
          </div>
          {/* 5 sous-scores cliquables */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
            {[
              {key:"entrainement",label:"Entraînement",value:null,placeholder:true},
              {key:"forme",label:"Forme",value:null,placeholder:true},
              {key:"nutrition",label:"Nutrition",value:scoreNutrition,placeholder:false},
              {key:"strategie",label:"Stratégie",value:scoreStrategie,placeholder:false},
              {key:"equipement",label:"Équipement",value:scoreEquipement,placeholder:false},
            ].map(({key,label,value,placeholder})=>{
              const isActive = !showAll && effectiveTab===key && !placeholder;
              const clickable = !placeholder;
              return (
                <div key={key}
                  onClick={clickable?()=>{setActiveTab(key);setShowAll(false);}:undefined}
                  style={{
                    background:placeholder?"var(--surface-2)":"var(--surface)",
                    border:`${isActive?"2px":"1px"} solid ${isActive?scoreColor(value):"var(--border-c)"}`,
                    borderRadius:10,
                    padding:isActive?"9px 11px":"10px 12px",
                    textAlign:"center",
                    opacity:placeholder?0.65:1,
                    cursor:clickable?"pointer":"default",
                    transition:"all 0.15s"
                  }}
                  onMouseEnter={clickable?(e)=>{if(!isActive)e.currentTarget.style.background=C.stone+"60";}:undefined}
                  onMouseLeave={clickable?(e)=>{if(!isActive)e.currentTarget.style.background="var(--surface)";}:undefined}
                >
                  <div style={{fontSize:10,fontWeight:500,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>{label}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:600,color:placeholder?C.muted:scoreColor(value),lineHeight:1}}>
                    {value != null ? value : "—"}
                  </div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{placeholder ? "à venir" : (value != null ? "/ 100" : "—")}</div>
                </div>
              );
            })}
          </div>
          {/* Compteurs alertes / vigilances */}
          <div style={{display:"flex",flexDirection:"column",gap:6,paddingLeft:12,borderLeft:`1px solid var(--border-c)`}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",background:nbAlertes>0?C.redPale:"var(--surface-2)",borderRadius:14,fontSize:11,fontWeight:600,color:nbAlertes>0?C.red:C.muted}}>
              <span style={{fontSize:13}}>🔴</span>{nbAlertes} alerte{nbAlertes>1?"s":""}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",background:nbVigilances>0?C.yellowPale:"var(--surface-2)",borderRadius:14,fontSize:11,fontWeight:600,color:nbVigilances>0?C.yellow:C.muted}}>
              <span style={{fontSize:13}}>⚠️</span>{nbVigilances} vigilance{nbVigilances>1?"s":""}
            </div>
          </div>
        </div>
      </Card>

      {/* ── BARRE ACTIONS : tout afficher / tout replier ─────────────────── */}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
        <Btn variant="ghost" onClick={()=>setShowAll(s=>!s)} style={{fontSize:11}}>
          {showAll ? "↑ Réduire" : "↓ Tout afficher"}
        </Btn>
      </div>

      {/* ── ZONE DÉTAIL (1 ou tous les sous-scores) ──────────────────────── */}
      {(() => {
        // Sections détail (factorisées pour réutilisation : 1 affichage ou les 5 empilés)
        const SectionEntrainement = () => (
          <div>
            <SectionTitle>Entraînement</SectionTitle>
            <Card>
              <div style={{textAlign:"center",padding:"32px 16px"}}>
                <div style={{fontSize:40,marginBottom:10,opacity:0.4}}>🏃</div>
                <div style={{fontSize:14,fontWeight:600,color:C.muted,marginBottom:8}}>Bientôt disponible</div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.6,maxWidth:520,margin:"0 auto"}}>
                  Évaluation du volume hebdomadaire, de la sortie longue maximale, de la régularité des entraînements, du dénivelé spécifique et de la phase d'affûtage par rapport à l'objectif de course.
                </div>
              </div>
            </Card>
          </div>
        );
        const SectionForme = () => (
          <div>
            <SectionTitle>Forme</SectionTitle>
            <Card>
              <div style={{textAlign:"center",padding:"32px 16px"}}>
                <div style={{fontSize:40,marginBottom:10,opacity:0.4}}>💗</div>
                <div style={{fontSize:14,fontWeight:600,color:C.muted,marginBottom:8}}>Bientôt disponible</div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.6,maxWidth:520,margin:"0 auto"}}>
                  Score basé sur ta variabilité cardiaque (VFC), ton sommeil et ta charge d'entraînement récente. Indiquera si tu es prêt physiquement le jour J.
                </div>
              </div>
            </Card>
          </div>
        );
        const SectionNutrition = () => (
          <div>
            <SectionTitle>Couverture nutritionnelle</SectionTitle>
            <Card>
              {!hasNutritionData ? (
                <div style={{padding:"20px",borderRadius:8,background:C.bluePale,border:`1px solid ${C.blue}30`,fontSize:12,color:C.blue}}>
                  ℹ️ Ajoute des produits ou recettes dans Nutrition pour activer ce score.
                </div>
              ) : (
                <>
                  {/* 3 KPIs */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                    {[
                      {label:"Calories emportées",val:`${totalEmporte.kcal} kcal`,sub:`besoin ${nutriTotals.kcal} kcal`,status:kcalStatus},
                      {label:"Glucides / heure",val:`${glucidesActuelH} g/h`,sub:glucidesTarget?`cible ${glucidesTarget} g/h`:"55% des kcal",status:glucidesStatus},
                      {label:"Eau (boissons)",val:`${(totalEmporte.eauMl/1000).toFixed(1)} L`,sub:`besoin ${(nutriTotals.eau/1000).toFixed(1)} L`,status:eauStatus},
                    ].map(({label,val,sub,status})=>(
                      <div key={label} style={{background:"var(--surface)",border:`1px solid var(--border-c)`,borderLeft:`3px solid ${statusText[status]}`,borderRadius:8,padding:"10px 14px"}}>
                        <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{label}</div>
                        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600,color:statusText[status]}}>{val}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:2}}>{sub}</div>
                      </div>
                    ))}
                  </div>
                  {/* Couverture par tronçon */}
                  {zonesNutri.length > 0 && (
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>Couverture par tronçon</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8}}>
                        {zonesNutri.map((z,i)=>{
                          const pct=z.pct??0;
                          const barColor=pct>=85?C.green:pct>=60?C.yellow:C.red;
                          return (
                            <div key={i}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:11}}>
                                <span style={{color:"var(--text-c)",fontWeight:500}}>{z.label}</span>
                                <span style={{fontWeight:600,color:barColor}}>{z.pct!=null?`${pct}%`:"—"}</span>
                              </div>
                              <div style={{height:6,background:"var(--surface-2)",borderRadius:3,overflow:"hidden"}}>
                                <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:barColor,borderRadius:3}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Micros */}
                  {totalTimeH > 0 && Object.keys(microCibles).length > 0 && (
                    <details>
                      <summary style={{cursor:"pointer",fontSize:11,fontWeight:600,color:C.primary,padding:"6px 0"}}>
                        Micronutriments ({Object.keys(microCibles).length})
                      </summary>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:10}}>
                        {Object.entries(microCibles).map(([key,cible])=>{
                          const val = microEmporte[key];
                          const min = Math.round(cible.min);
                          const max = Math.round(cible.max);
                          let status, barPct;
                          if (val < min * 0.8) { status="alert"; barPct=Math.round(val/min*100); }
                          else if (val > max * 1.5) { status="warn"; barPct=100; }
                          else if (val > max) { status="warn"; barPct=100; }
                          else { status="ok"; barPct=Math.round((val-min)/(max-min)*100+80); }
                          const color = status==="ok"?C.green:status==="warn"?C.yellow:C.red;
                          return (
                            <div key={key}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:11}}>
                                <span style={{color:C.muted}}>{cible.label}</span>
                                <span style={{fontWeight:600,color}}>{val.toLocaleString()} {cible.unit}</span>
                              </div>
                              <div style={{height:5,background:"var(--surface-2)",borderRadius:2,overflow:"hidden"}}>
                                <div style={{height:"100%",width:`${Math.min(barPct,100)}%`,background:color}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </>
              )}
            </Card>
          </div>
        );
        const SectionStrategie = () => (
          <div>
            <SectionTitle>Stratégie de course</SectionTitle>
            <Card style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontWeight:600,fontSize:13}}>Fatigue cumulée</span>
                {fatigueData.some(d=>d.charge>=SEUIL)&&<span style={{fontSize:11,background:C.redPale,color:C.red,borderRadius:6,padding:"2px 8px",fontWeight:600}}>Zone critique atteinte</span>}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={fatigueData} margin={{top:8,right:12,bottom:8,left:0}}>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:C.muted}} interval="preserveStartEnd"/>
                  <YAxis domain={[0,100]} tick={{fontSize:10,fill:C.muted}} tickFormatter={v=>`${v}%`} width={32}/>
                  <RTooltip formatter={(v,n)=>[`${v}%`,n==="charge"?"Charge":"Réserve"]} labelFormatter={(l,p)=>{const d=p?.[0]?.payload;return d?.fullLabel?`${l} — ${d.fullLabel}`:l;}} contentStyle={{fontSize:11,borderRadius:8,border:`1px solid ${C.border}`}}/>
                  <ReferenceLine y={SEUIL} stroke={C.yellow} strokeDasharray="5 4" strokeWidth={1} label={{value:"Seuil critique",fontSize:9,fill:C.yellow,position:"insideTopRight"}}/>
                  <Bar dataKey="charge" radius={[3,3,0,0]}>{fatigueData.map((d,i)=><Cell key={i} fill={d.type==="ravito"?C.green+"99":d.type==="repos"?C.blue+"55":d.charge>=SEUIL?C.red+"cc":d.charge>=60?C.yellow+"cc":C.blue+"cc"}/>)}</Bar>
                  <Line type="monotone" dataKey="reserve" stroke={C.red} strokeWidth={2} dot={{r:2,fill:C.red}}/>
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>
                Niveau {levelData.label} · Garmin ×{garminCoeff}{paceStrat!==0&&<> · pace {paceStrat>0?"négatif":"positif"}</>}
              </div>
            </Card>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {pointsStrategie.map((p,i)=><Point key={i} {...p}/>)}
            </div>
          </div>
        );
        const SectionEquipement = () => (
          <div>
            <SectionTitle>Équipement & checklist</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12,marginBottom:12}}>
              {/* Poids */}
              {poidsTotalG > 0 && (
                <div style={{background:"var(--surface)",border:`1px solid var(--border-c)`,borderLeft:`3px solid ${poidsTotalG>8000?C.red:poidsTotalG>6000?C.yellow:C.green}`,borderRadius:8,padding:"12px 14px"}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:3}}>Poids estimé au départ</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:600,color:poidsTotalG>8000?C.red:poidsTotalG>6000?C.yellow:C.green}}>
                    {poidsTotalG >= 1000 ? `${(poidsTotalG/1000).toFixed(1)} kg` : `${poidsTotalG} g`}
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginTop:3}}>
                    équipement {poidsEquipG >= 1000 ? `${(poidsEquipG/1000).toFixed(1)} kg` : `${poidsEquipG} g`} · nutrition {poidsNutriG >= 1000 ? `${(poidsNutriG/1000).toFixed(1)} kg` : `${poidsNutriG} g`}
                  </div>
                </div>
              )}
              {/* Adaptation météo */}
              {meteoChecks.length > 0 && (
                <div style={{background:"var(--surface)",border:`1px solid var(--border-c)`,borderRadius:8,padding:"12px 14px"}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>Adaptation météo</div>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {meteoChecks.map(c=>(
                      <div key={c.key} style={{display:"flex",alignItems:"center",gap:8,fontSize:11,padding:"5px 9px",background:c.ok?C.greenPale:C.redPale,borderRadius:6,color:c.ok?C.green:C.red,fontWeight:500}}>
                        <span>{c.ok?"✓":"✕"}</span>
                        <span style={{flex:1}}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Checklist par catégorie */}
            {Object.keys(eqByCat).length > 0 && (
              <Card>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontWeight:600,fontSize:13}}>Checklist équipement</span>
                  <span style={{fontSize:12,color:checklistPct===100?C.green:checklistPct>=70?C.yellow:C.red,fontWeight:600}}>
                    {checkedCount}/{activeItems.length} ({checklistPct}%)
                  </span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
                  {Object.entries(eqByCat).map(([cat,items])=>{
                    const checkedInCat = items.filter(i=>i.checked).length;
                    return (
                      <div key={cat}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                          <span style={{color:"var(--text-c)",fontWeight:500}}>{cat}</span>
                          <span style={{fontWeight:600,color:checkedInCat===items.length?C.green:C.muted}}>{checkedInCat}/{items.length}</span>
                        </div>
                        <div style={{height:6,background:"var(--surface-2)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${items.length>0?(checkedInCat/items.length*100):0}%`,background:checkedInCat===items.length?C.green:C.yellow,borderRadius:3}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
            {/* Autres points préparation (température, fc, etc.) */}
            {pointsPrepa.length > 2 && (
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
                {pointsPrepa.slice(2).map((p,i)=><Point key={i} {...p}/>)}
              </div>
            )}
          </div>
        );

        if (showAll) {
          return (
            <div style={{display:"flex",flexDirection:"column",gap:24}}>
              <SectionEntrainement/>
              <SectionForme/>
              <SectionNutrition/>
              <SectionStrategie/>
              <SectionEquipement/>
            </div>
          );
        }
        if (effectiveTab==="entrainement") return <SectionEntrainement/>;
        if (effectiveTab==="forme") return <SectionForme/>;
        if (effectiveTab==="nutrition") return <SectionNutrition/>;
        if (effectiveTab==="strategie") return <SectionStrategie/>;
        return <SectionEquipement/>;
      })()}

      {/* ── SOURCES ── */}
      <div style={{fontSize:10,color:C.muted,marginTop:24,textAlign:"center"}}>
        Sources : ITRA Effort Score · Vernillo et al. (2017) · Millet et al. (2011) · données Garmin personnelles
      </div>
    </div>
  );
}

const NAVS = [
  { id: "profil",      label: "Profil de course",     icon: "🗺️", group: "Préparation" },
  { id: "preparation", label: "Stratégie de course",   icon: "🎯", group: "Préparation" },
  { id: "nutrition",   label: "Nutrition",             icon: "🍌", group: "Préparation" },
  { id: "parametres",  label: "Équipement",          icon: "🎒", group: "Préparation" },
  { id: "analyse",     label: "Analyse",               icon: "📊", group: "Analyse" },
  { id: "team",        label: "Team",                  icon: "👥", group: "Équipe" },
  { id: "courses",     label: "Mes courses",           icon: "📚", group: "Historique" },
];
