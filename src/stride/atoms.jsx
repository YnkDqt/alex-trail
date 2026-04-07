import React, { useEffect } from "react";
import { CS as C } from "./constants.js";

export const Btn = ({ children, onClick, variant="primary", size="md", style={}, disabled=false }) => {
  const base = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
    border:"none", borderRadius:8, cursor:disabled?"not-allowed":"pointer", fontFamily:"inherit",
    fontWeight:500, transition:"all 0.12s", opacity:disabled?0.5:1, ...style };
  const sz = size==="sm" ? {fontSize:12,padding:"5px 11px"} : size==="lg" ? {fontSize:15,padding:"11px 22px"} : {fontSize:13,padding:"8px 16px"};
  const vars = {
    primary: {background:C.forest, color:"#fff"},
    ghost:   {background:"transparent", color:C.inkLight, border:`1px solid ${C.border}`},
    soft:    {background:C.forestPale, color:C.forest},
    danger:  {background:C.redPale, color:C.red, border:`1px solid ${C.red}22`},
    sage:    {background:C.stone, color:C.inkLight},
    summit:  {background:C.summit, color:"#fff"},
  };
  return <button style={{...base,...sz,...vars[variant]}} onClick={onClick} disabled={disabled}>{children}</button>;
};

export const Modal = ({ open, onClose, title, subtitle, children, width=560 }) => {
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(28,25,22,0.55)",backdropFilter:"blur(3px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:16,width:"100%",maxWidth:width,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{padding:"18px 22px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:500,color:C.inkLight}}>{title}</div>
            {subtitle && <div style={{fontSize:12,color:C.muted,marginTop:2}}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.stoneDeep,padding:"0 2px",lineHeight:1}}>×</button>
        </div>
        <div style={{padding:22,overflowY:"auto",flex:1}}>{children}</div>
      </div>
    </div>
  );
};

export const Field = ({ label, children, full, style={} }) => (
  <div style={{gridColumn:full?"1/-1":undefined,...style}}>
    <label style={{display:"block",fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.muted,marginBottom:5}}>{label}</label>
    {children}
  </div>
);

export const FormGrid = ({ children }) => (
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{children}</div>
);

export const ConfirmDialog = ({ open, message, onConfirm, onCancel, danger=true }) => {
  if (!open) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,25,22,0.6)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.white,borderRadius:14,padding:28,maxWidth:360,width:"100%",boxShadow:"0 16px 48px rgba(0,0,0,0.2)"}}>
        <div style={{fontSize:14,color:C.ink,marginBottom:22,lineHeight:1.6}}>{message}</div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn variant="ghost" onClick={onCancel}>Annuler</Btn>
          <Btn variant={danger?"danger":"primary"} onClick={onConfirm}>Confirmer</Btn>
        </div>
      </div>
    </div>
  );
};

export const statusBadge = (s) => {
  if (s==="Effectué") return <span className="badge badge-done">✓ Effectué</span>;
  if (s==="Annulé")   return <span className="badge badge-cancel">Annulé</span>;
  return <span className="badge badge-plan">Planifié</span>;
};

export const inlineInput = (w=80) => ({
  fontSize:12, padding:"3px 6px", borderRadius:5,
  border:`1px solid ${C.border}`, background:C.white,
  width:w, fontFamily:"'DM Mono',monospace", textAlign:"right",
});
