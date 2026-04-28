import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './AuthContext'
import App from './App.jsx'

// ─── ANTI-BOUCLE RELOAD ──────────────────────────────────────────────────────
// Garde-fou au cas où une cause externe de reload existerait (autre que
// l'utilisateur cliquant F5). Si on détecte plus de 3 reloads en moins de
// 30 secondes, on bloque l'exécution et on affiche un message clair.
// Ça évite que l'utilisateur perde des données dans une boucle silencieuse.
try {
  const KEY = 'alex-reload-counter';
  const now = Date.now();
  const raw = sessionStorage.getItem(KEY);
  const data = raw ? JSON.parse(raw) : { count: 0, firstAt: now };
  // Reset si plus de 30s écoulées depuis le 1er reload tracké
  if (now - data.firstAt > 30000) {
    data.count = 0;
    data.firstAt = now;
  }
  data.count += 1;
  sessionStorage.setItem(KEY, JSON.stringify(data));
  if (data.count >= 4) {
    console.error('[anti-loop] Plus de 3 reloads détectés en 30s — arrêt de l\'app pour éviter une perte de données.');
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5F3EF;padding:2rem;font-family:'DM Sans',sans-serif;">
        <div style="max-width:520px;background:#FFFFFF;padding:2rem;border-radius:12px;border:1px solid #DDD9D1;">
          <div style="font-size:22px;font-weight:700;color:#B5860A;margin-bottom:10px;">⚠ Boucle de rechargement détectée</div>
          <div style="font-size:14px;color:#3D3830;line-height:1.6;margin-bottom:20px;">
            L'application s'est rechargée plusieurs fois rapidement. Pour éviter toute perte de données, le chargement automatique est suspendu.
          </div>
          <div style="font-size:13px;color:#3D3830;line-height:1.6;margin-bottom:20px;">
            Clique sur le bouton ci-dessous pour relancer l'app. Si le problème persiste, signale-le au support.
          </div>
          <button onclick="sessionStorage.removeItem('alex-reload-counter');location.reload();"
            style="padding:11px 20px;background:#2D5A3D;color:#FFFFFF;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;width:100%;">
            🔄 Relancer manuellement
          </button>
        </div>
      </div>
    `;
    throw new Error('Boot bloqué par anti-loop');
  }
} catch (e) {
  // Ne pas bloquer le boot si sessionStorage est inaccessible (mode privé Safari, etc.)
  if (e.message !== 'Boot bloqué par anti-loop') {
    console.warn('[anti-loop] sessionStorage indisponible:', e);
  } else {
    throw e;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)