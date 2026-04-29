import { C } from '../constants.js';

// Helpers de progression
const calcProgress = (planifie, estime) => estime > 0 ? Math.round((planifie / estime) * 100) : 0;
const progressColor = (pct) => pct >= 90 ? C.green : pct >= 70 ? C.yellow : C.red;

// Style label commun
const lbl = {fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted};

// Nutriments hiérarchisés par importance (Tier 1 = essentiel, Tier 3 = indicatif)
const nutrientsTier1 = [
  { key: 'eau',      label: 'Eau',      unit: 'L',    factor: 1000, icon: '💧', color: C.blue },
  { key: 'kcal',     label: 'Kcal',     unit: 'kcal', factor: 1,    icon: '🔥', color: C.red },
  { key: 'glucides', label: 'Glucides', unit: 'g',    factor: 1,    icon: '🍌', color: '#1d9e75' },
  { key: 'sodium',   label: 'Sodium',   unit: 'mg',   factor: 1,    icon: '🧂', color: '#BA7517' }
];
const nutrientsTier2 = [
  { key: 'proteines', label: 'Protéines', unit: 'g', factor: 1, icon: '🥩', color: '#185FA5' },
  { key: 'lipides',   label: 'Lipides',   unit: 'g', factor: 1, icon: '🥑', color: '#7F77DD' }
];
const nutrientsTier3 = [
  { key: 'potassium', label: 'Potassium', unit: 'mg', factor: 1, color: C.muted },
  { key: 'magnesium', label: 'Magnésium', unit: 'mg', factor: 1, color: C.muted }
];

// Carte nutriment avec besoin + planifié + progress bar
function NutrientCard({ n, size = "md", nutriEstimes, nutriPlanifies }) {
  const estime = nutriEstimes[n.key] || 0;
  const planifie = nutriPlanifies[n.key] || 0;
  const pct = calcProgress(planifie, estime);
  const col = progressColor(pct);
  const fmt = v => n.factor > 1 ? (v / n.factor).toFixed(1) : Math.round(v);

  const sizes = {
    lg: { padding: "14px 16px", labelFs: 10, valueFs: 22, subFs: 11, gap: 6 },
    md: { padding: "12px 14px", labelFs: 10, valueFs: 20, subFs: 11, gap: 5 }
  };
  const s = sizes[size] || sizes.md;

  return (
    <div style={{background:C.stone,borderRadius:10,padding:s.padding,border:`1.5px solid ${col}25`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:s.gap}}>
        <div style={{fontSize:s.labelFs,color:C.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em"}}>
          {n.icon && <span style={{marginRight:4}}>{n.icon}</span>}
          {n.label}
        </div>
        <div style={{fontSize:s.labelFs,fontWeight:600,color:col,fontFamily:"'DM Mono',monospace"}}>{pct}%</div>
      </div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:s.valueFs,fontWeight:500,color:n.color,lineHeight:1,marginBottom:s.gap}}>
        {fmt(planifie)}
        <span style={{fontSize:s.subFs,color:C.muted,fontWeight:400,marginLeft:3}}>/ {fmt(estime)} {n.unit}</span>
      </div>
      <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:col,transition:"width 0.3s"}}/>
      </div>
    </div>
  );
}

export default function NutritionKPIs({ nutriEstimes, nutriPlanifies }) {
  return (
    <>
      {/* ── TIER 1 : ESSENTIEL ── */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:10}}>
          <div style={{...lbl,color:C.inkLight,fontWeight:600}}>Tier 1 · Essentiel</div>
          <div style={{fontSize:11,color:C.muted}}>Les apports critiques pour la performance et la sécurité</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
          {nutrientsTier1.map(n => <NutrientCard key={n.key} n={n} size="lg" nutriEstimes={nutriEstimes} nutriPlanifies={nutriPlanifies} />)}
        </div>
      </div>

      {/* ── TIER 2 : IMPORTANT ── */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:10}}>
          <div style={{...lbl,color:C.inkLight,fontWeight:600}}>Tier 2 · Important</div>
          <div style={{fontSize:11,color:C.muted}}>Le confort et l'endurance sur longue durée</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
          {nutrientsTier2.map(n => <NutrientCard key={n.key} n={n} size="md" nutriEstimes={nutriEstimes} nutriPlanifies={nutriPlanifies} />)}
        </div>
      </div>

      {/* ── TIER 3 : INDICATIF ── */}
      <div style={{marginBottom:30}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:10}}>
          <div style={{...lbl,color:C.inkLight,fontWeight:600}}>Tier 3 · Indicatif</div>
          <div style={{fontSize:11,color:C.muted}}>Micronutriments — non optimisés par l'algo, informatifs</div>
        </div>
        <div style={{padding:"12px 14px",background:C.stone,borderRadius:10,opacity:0.85}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:16,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
            {nutrientsTier3.map(n => {
              const estime = nutriEstimes[n.key] || 0;
              const planifie = nutriPlanifies[n.key] || 0;
              const pct = calcProgress(planifie, estime);
              return (
                <div key={n.key} style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{color:C.muted,fontFamily:"inherit"}}>{n.label}</span>
                  <span style={{color:C.inkLight}}>{Math.round(planifie)}</span>
                  <span style={{color:C.muted}}>/ {Math.round(estime)} {n.unit}</span>
                  <span style={{color:C.muted,fontSize:11,opacity:0.7}}>({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
