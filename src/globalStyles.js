import { C, COURSE_C } from './constants.js';

// CSS global injecté dans <style> au niveau de l'app.
// G : styles Entraînement (root). COURSE_G : styles section Course (scoped).
export const G = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,300&family=DM+Sans:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: ${C.bg}; }
  #root { height: 100%; display: flex; flex-direction: column; }
  body { font-family: 'DM Sans', sans-serif; color: ${C.ink}; font-size: 14px; line-height: 1.5; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${C.stoneDark}; border-radius: 2px; }

  input, select, textarea {
    font-family: inherit; font-size: 14px; color: ${C.ink};
    background: ${C.white}; border: 1px solid ${C.border};
    border-radius: 8px; padding: 8px 12px; width: 100%; outline: none;
    transition: border-color 0.15s;
  }
  input:focus, select:focus, textarea:focus { border-color: ${C.forest}; }
  textarea { resize: vertical; min-height: 72px; }

  .anim { animation: fadeUp 0.18s ease both; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }

  .badge { display:inline-flex; align-items:center; font-size:11px; font-weight:500; padding:2px 7px; border-radius:20px; white-space:nowrap; }
  .badge-plan { background:${C.skyPale}; color:${C.sky}; }
  .badge-done { background:${C.greenPale}; color:${C.green}; }
  .badge-cancel { background:${C.stone}; color:${C.muted}; }
  .badge-race { background:${C.summitPale}; color:${C.summit}; }
  .badge-warn { background:${C.yellowPale}; color:${C.yellow}; }

  @media (max-width: 640px) {
    .hide-mobile { display: none !important; }
  }
  @media (min-width: 641px) {
    .hide-desktop { display: none !important; }
  }
`;

export const COURSE_G = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
  .course-scope *, .course-scope *::before, .course-scope *::after { box-sizing: border-box; }
  .course-scope { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text-c); font-size: 14px; line-height: 1.5; }
  :root {
    --bg: ${COURSE_C.bg};
    --surface: ${COURSE_C.white};
    --surface-2: ${COURSE_C.sand};
    --surface-3: ${COURSE_C.sandDark};
    --border-c: ${COURSE_C.border};
    --text-c: ${COURSE_C.text};
    --muted-c: ${COURSE_C.muted};
    --primary: ${COURSE_C.primary};
  }
  :root.dark {
    --bg: #14100C;
    --surface: #1E1810;
    --surface-2: #26201A;
    --surface-3: #302820;
    --border-c: #3C3028;
    --text-c: #F0EAE0;
    --muted-c: #9A8870;
    --primary: ${COURSE_C.primaryLight};
  }
  .course-scope input, .course-scope select, .course-scope textarea {
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    background: var(--surface-2); color: var(--text-c);
    border: 1px solid var(--border-c); border-radius: 10px;
    padding: 9px 12px; width: 100%; outline: none;
    transition: border 0.2s, box-shadow 0.2s;
  }
  .course-scope input:focus, .course-scope select:focus, .course-scope textarea:focus {
    border-color: ${COURSE_C.primary};
    box-shadow: 0 0 0 3px ${COURSE_C.primaryPale};
  }
  .course-scope input[type="range"] { background: transparent; border: none; padding: 0; box-shadow: none; accent-color: ${COURSE_C.primary}; }
  .course-scope table { border-collapse: collapse; width: 100%; }
  .course-scope thead th { font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted-c); background: var(--surface-2); padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--border-c); }
  .course-scope tbody tr { border-bottom: 1px solid var(--border-c); transition: background 0.15s; cursor: pointer; }
  .course-scope tbody tr:hover { background: var(--surface-2); }
  .course-scope tbody td { padding: 10px 14px; }
  .course-scope .tbl-wrap { overflow-x: auto; border-radius: 16px; border: 1px solid var(--border-c); }
  .course-scope .anim { animation: courseFadeUp 0.35s ease both; }
  @keyframes courseFadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .course-scope .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .course-scope .form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .course-scope .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .course-scope .badge-green  { background: ${COURSE_C.greenPale};      color: ${COURSE_C.green}; }
  .course-scope .badge-yellow { background: ${COURSE_C.yellowPale};     color: ${COURSE_C.yellow}; }
  .course-scope .badge-red    { background: ${COURSE_C.redPale};        color: ${COURSE_C.red}; }
  .course-scope .badge-blue   { background: ${COURSE_C.bluePale};       color: ${COURSE_C.blue}; }
  .course-scope .badge-brown  { background: ${COURSE_C.primaryPale};    color: ${COURSE_C.primaryDeep}; }
  .course-scope .badge-sage   { background: ${COURSE_C.secondaryPale};  color: ${COURSE_C.secondaryDark}; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: center; justify-content: center; }
  .modal-box { background: var(--surface); border-radius: 20px; border: 1px solid var(--border-c); max-width: 680px; width: 94vw; max-height: 88vh; overflow-y: auto; padding: 32px; box-shadow: 0 24px 60px rgba(0,0,0,0.18); }
  .confirm-box { background: var(--surface); border-radius: 16px; border: 1px solid var(--border-c); max-width: 400px; width: 90vw; padding: 28px; text-align: center; box-shadow: 0 16px 40px rgba(0,0,0,0.15); }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; cursor: pointer; transition: background 0.15s, color 0.15s; font-weight: 500; color: var(--muted-c); font-size: 14px; user-select: none; }
  .nav-item:hover { background: var(--surface-2); color: var(--text-c); }
  .nav-item.active { background: ${COURSE_C.primaryPale}; color: ${COURSE_C.primaryDeep}; }
  :root.dark .nav-item.active { background: #3A2C1E; color: ${COURSE_C.primaryLight}; }
  @media (max-width: 768px) {
    .course-scope .grid-2col { grid-template-columns: 1fr; }
    .course-scope .form-grid { grid-template-columns: repeat(2, 1fr); }
    .modal-overlay { align-items: flex-end; }
    .modal-box { border-radius: 20px 20px 0 0; max-height: 90vh; width: 100vw; padding: 24px; }
  }
  /* Dark mode Entraînement — override couleurs inline */
  :root.dark .entrainement-scope { background: #1a1714 !important; color: #e8e4de !important; }
  :root.dark .entrainement-scope .card-white { background: #242018 !important; border-color: #3a342c !important; }
  :root.dark .entrainement-scope input,
  :root.dark .entrainement-scope select,
  :root.dark .entrainement-scope textarea { background: #2a231c !important; color: #e8e4de !important; border-color: #3a342c !important; }
`;
