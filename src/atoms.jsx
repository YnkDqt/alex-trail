import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { C } from "./constants.js";

// ─── BUTTONS ─────────────────────────────────────────────────────────────────
export const Btn = ({ children, onClick, variant="primary", size="md", style={}, disabled=false }) => {
  const base = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
    border:"none", borderRadius:10, cursor:disabled?"not-allowed":"pointer", fontFamily:"'DM Sans', sans-serif",
    fontWeight:500, transition:"all 0.15s", opacity:disabled?0.5:1, whiteSpace:"nowrap", ...style };
  const sz = size==="sm" ? {fontSize:13,padding:"6px 14px"} : size==="lg" ? {fontSize:15,padding:"11px 22px"} : {fontSize:14,padding:"9px 20px"};
  const vars = {
    primary: {background:C.primary, color:C.white},
    ghost:   {background:"transparent", color:"var(--text-c)", border:`1px solid var(--border-c)`},
    soft:    {background:"var(--surface-2)", color:"var(--text-c)", border:`1px solid var(--border-c)`},
    danger:  {background:C.redPale, color:C.red, border:`1px solid ${C.red}30`},
    sage:    {background:C.secondaryPale, color:C.secondaryDark},
    summit:  {background:C.summit, color:C.white},
    success: {background:C.greenPale, color:C.green},
  };
  return <button style={{...base,...sz,...vars[variant]}} onClick={onClick} disabled={disabled}>{children}</button>;
};

// ─── CARDS & CONTAINERS ──────────────────────────────────────────────────────
export const Card = ({ children, style, noPad }) => (
  <div style={{
    background:"var(--surface)", borderRadius:20, border:"1px solid var(--border-c)",
    padding:noPad?0:"24px", overflow:noPad?"hidden":undefined, ...style
  }}>{children}</div>
);

export const KPI = ({ label, value, sub, color, icon }) => {
  const col = color || C.primary;
  return (
    <div style={{background:"var(--surface)",borderRadius:14,border:"0.5px solid var(--border-c)",borderTop:`3px solid ${col}`,padding:"14px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <span style={{fontSize:9.5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.11em",color:"var(--muted-c)"}}>{label}</span>
        {icon && <span style={{fontSize:16}}>{icon}</span>}
      </div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:col,lineHeight:1.2,marginTop:7}}>{value}</div>
      {sub && <div style={{fontSize:11,color:"var(--muted-c)",marginTop:3}}>{sub}</div>}
    </div>
  );
};

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────────
export const PageTitle = ({ children, sub }) => (
  <div style={{marginBottom:24}}>
    <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:500,color:"var(--text-c)",lineHeight:1.2,letterSpacing:"-0.01em",margin:0}}>{children}</h1>
    {sub && <p style={{color:"var(--muted-c)",marginTop:4,fontSize:14,margin:"4px 0 0"}}>{sub}</p>}
  </div>
);

// ─── FORMS ───────────────────────────────────────────────────────────────────
export const Field = ({ label, children, full, style={} }) => (
  <div style={{gridColumn:full?"1/-1":undefined,...style}}>
    <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--muted-c)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>{label}</label>
    {children}
  </div>
);

export const FormGrid = ({ children }) => (
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{children}</div>
);

// ─── MODALS & DIALOGS ────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, subtitle, children, footer, width=560 }) => {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = e => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  
  if (!open) return null;
  
  return createPortal(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(28,25,22,0.55)",backdropFilter:"blur(3px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:16,width:"100%",maxWidth:width,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{padding:"18px 22px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:600,color:C.inkLight}}>{title}</div>
            {subtitle && <div style={{fontSize:13,color:C.muted,marginTop:3}}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.stoneDeep,padding:"0 4px",lineHeight:1}}>×</button>
        </div>
        <div style={{padding:22,overflowY:"auto",flex:1,minHeight:0}}>{children}</div>
        {footer && (
          <div style={{padding:"14px 22px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:10,flexShrink:0,background:C.white,borderBottomLeftRadius:16,borderBottomRightRadius:16}}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export const ConfirmDialog = ({ open, message, onConfirm, onCancel, danger=true }) => {
  if (!open) return null;
  return createPortal(
    <div onClick={onCancel} style={{position:"fixed",inset:0,background:"rgba(28,25,22,0.6)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:14,padding:28,maxWidth:360,width:"100%",boxShadow:"0 16px 48px rgba(0,0,0,0.2)"}}>
        <div style={{fontSize:32,marginBottom:12,textAlign:"center"}}>⚠️</div>
        <div style={{fontSize:14,color:C.ink,marginBottom:22,lineHeight:1.6}}>{message}</div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <Btn variant="ghost" onClick={onCancel}>Annuler</Btn>
          <Btn variant={danger?"danger":"primary"} onClick={onConfirm}>Confirmer</Btn>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── EMPTY STATES ────────────────────────────────────────────────────────────
export const Empty = ({ icon, title, sub, action }) => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"64px 24px",gap:12,textAlign:"center"}}>
    <span style={{fontSize:48}}>{icon}</span>
    <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:600}}>{title}</div>
    {sub && <p style={{color:"var(--muted-c)",maxWidth:340}}>{sub}</p>}
    {action && <div style={{marginTop:8}}>{action}</div>}
  </div>
);

// ─── UTILITIES ───────────────────────────────────────────────────────────────
export const Hr = () => <div style={{height:1,background:"var(--border-c)",margin:"20px 0"}}/>;

export const statusBadge = (s) => {
  if (s==="Effectué") return <span className="badge badge-done">✓ Effectué</span>;
  if (s==="Annulé")   return <span className="badge badge-cancel">Annulé</span>;
  return <span className="badge badge-plan">Planifié</span>;
};

export const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"var(--surface)",border:"1px solid var(--border-c)",borderRadius:10,padding:"10px 14px",fontSize:13,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
      <div style={{fontWeight:600,marginBottom:4}}>{label}</div>
      {payload.map((p,i) => <div key={i} style={{color:p.color}}>{p.name}: {p.value}</div>)}
    </div>
  );
};
