import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { C } from './constants'

export default function Login() {
  const { signIn, signUp, sendPasswordReset, setNewPassword, isRecovery } = useAuth()

  // Modes : 'signin' | 'signup' | 'forgot' | 'reset'
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [rgpdConsent, setRgpdConsent] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // Détection du retour depuis un email de reset → bascule auto en mode 'reset'
  useEffect(() => {
    if (isRecovery) {
      setMode('reset')
      setError('')
      setSuccess('')
    }
  }, [isRecovery])

  const resetFormState = () => {
    setPassword(''); setPasswordConfirm('')
    setError(''); setSuccess('')
    setRgpdConsent(false)
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    resetFormState()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess('')

    // ─── MODE : demande de reset (envoi email) ─────────────────────────────
    if (mode === 'forgot') {
      if (!email) { setError("Entre ton adresse email"); return }
      setLoading(true)
      const { error } = await sendPasswordReset(email)
      setLoading(false)
      if (error) { setError(error.message); return }
      setSuccess("Si cette adresse est enregistrée, un email de réinitialisation vient d'être envoyé. Vérifie aussi tes spams.")
      return
    }

    // ─── MODE : définition du nouveau mdp (après clic sur lien email) ──────
    if (mode === 'reset') {
      if (!password || !passwordConfirm) { setError("Tous les champs sont requis"); return }
      if (password.length < 8) { setError("Le mot de passe doit faire au moins 8 caractères"); return }
      if (password !== passwordConfirm) { setError("Les deux mots de passe ne correspondent pas"); return }
      setLoading(true)
      const { error } = await setNewPassword(password)
      setLoading(false)
      if (error) { setError(error.message); return }
      setSuccess("Mot de passe mis à jour. Tu es maintenant connecté.")
      // L'utilisateur est déjà connecté via la session de recovery → App.jsx prend le relais
      return
    }

    // ─── MODE : inscription ─────────────────────────────────────────────────
    if (mode === 'signup') {
      if (!rgpdConsent) {
        setError("Vous devez accepter la politique de confidentialité")
        return
      }
      setLoading(true)
      const { error } = await signUp(email, password)
      setLoading(false)
      if (error) setError(error.message)
      return
    }

    // ─── MODE : connexion ───────────────────────────────────────────────────
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error.message)
  }

  // ── Textes dynamiques selon le mode ───────────────────────────────────────
  const titles = {
    signin: 'Connexion',
    signup: 'Créer un compte',
    forgot: 'Mot de passe oublié',
    reset:  'Nouveau mot de passe',
  }
  const subtitles = {
    signin: 'Entre tes identifiants pour te connecter',
    signup: 'Entre ton email pour créer ton compte',
    forgot: "Entre ton email, nous t'enverrons un lien pour réinitialiser ton mot de passe",
    reset:  'Choisis un nouveau mot de passe pour ton compte',
  }
  const submitLabels = {
    signin: 'Se connecter',
    signup: 'Créer mon compte',
    forgot: 'Envoyer le lien',
    reset:  'Enregistrer le nouveau mot de passe',
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: C.stone,
      padding: '1rem'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        width: '100%',
        maxWidth: '1100px',
        height: '580px',
        background: C.white,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
      }}>
        
        {/* Partie gauche - Brand */}
        <div style={{
          background: 'linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%)',
          padding: '3rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: 'white'
        }}>
          <div>
            <div style={{ fontSize: '32px', fontWeight: '500', marginBottom: '8px' }}>Alex</div>
            <div style={{ fontSize: '15px', opacity: 0.9 }}>Ton compagnon d'entraînement et de course trail</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Feature icon="📊" title="Suivi d'entraînement" desc="Programme, activités, forme physique" />
            <Feature icon="🏔️" title="Stratégie de course" desc="Analyse parcours, allures, nutrition" />
            <Feature icon="👥" title="Partage avec ton équipe" desc="Stratégies et ravitaillements collaboratifs" />
          </div>
          
          <div style={{ fontSize: '12px', opacity: 0.7 }}>
            Données stockées en Europe · RGPD compliant
          </div>
        </div>
        
        {/* Partie droite - Formulaire */}
        <div style={{
          padding: '3rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ maxWidth: '340px', margin: '0 auto', width: '100%' }}>
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: '500', 
              margin: '0 0 8px 0',
              color: C.ink
            }}>
              {titles[mode]}
            </h1>
            <p style={{ 
              color: C.muted, 
              fontSize: '14px', 
              margin: '0 0 32px 0',
              lineHeight: 1.5
            }}>
              {subtitles[mode]}
            </p>
            
            <form onSubmit={handleSubmit}>

              {/* Email : affiché sauf en mode reset */}
              {mode !== 'reset' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: C.muted }}>
                    Adresse email
                  </label>
                  <input
                    type="email"
                    placeholder="ton-email@exemple.fr"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Mot de passe : affiché sauf en mode forgot */}
              {mode !== 'forgot' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: C.muted }}>
                    {mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={mode === 'reset' || mode === 'signup' ? 8 : undefined}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Confirmation mdp : uniquement en mode reset */}
              {mode === 'reset' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: C.muted }}>
                    Confirmer le nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Lien "Mot de passe oublié" : uniquement en mode signin */}
              {mode === 'signin' && (
                <div style={{ marginBottom: '16px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    style={{
                      background: 'transparent', border: 'none', padding: 0,
                      color: '#1D9E75', fontSize: '12px', cursor: 'pointer',
                      textDecoration: 'underline', fontWeight: 500
                    }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              {/* Consentement RGPD : uniquement en mode signup */}
              {mode === 'signup' && (
                <label style={{
                  display: 'flex', alignItems: 'start', gap: '8px',
                  fontSize: '13px', color: C.muted, cursor: 'pointer',
                  marginBottom: '16px', lineHeight: '1.5'
                }}>
                  <input 
                    type="checkbox" 
                    checked={rgpdConsent} 
                    onChange={e => setRgpdConsent(e.target.checked)}
                    style={{ marginTop: '2px', cursor: 'pointer' }}
                  />
                  <span>
                    J'accepte la <a 
                      href="https://alex-trail.vercel.app/#confidentialite" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#1D9E75', textDecoration: 'underline' }}
                    >
                      politique de confidentialité
                    </a>
                  </span>
                </label>
              )}
              
              {error && (
                <p style={{ 
                  color: C.red, marginBottom: '16px', fontSize: '13px',
                  background: C.redPale, padding: '8px 12px', borderRadius: '6px'
                }}>
                  {error}
                </p>
              )}

              {success && (
                <p style={{ 
                  color: C.green, marginBottom: '16px', fontSize: '13px',
                  background: C.greenPale, padding: '10px 12px', borderRadius: '6px',
                  lineHeight: 1.5
                }}>
                  {success}
                </p>
              )}
              
              <button 
                type="submit" 
                disabled={loading} 
                style={{ 
                  width: '100%', marginBottom: '24px',
                  background: '#1D9E75', color: 'white', border: 'none',
                  height: '40px', borderRadius: '6px', fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Chargement…' : submitLabels[mode]}
              </button>
            </form>
            
            {/* Navigation entre modes en bas */}
            <div style={{ textAlign: 'center', fontSize: '13px', color: C.muted }}>
              {mode === 'signin' && (
                <>
                  Pas encore de compte ?{' '}
                  <LinkBtn onClick={() => switchMode('signup')}>Créer un compte</LinkBtn>
                </>
              )}
              {mode === 'signup' && (
                <>
                  Déjà un compte ?{' '}
                  <LinkBtn onClick={() => switchMode('signin')}>Se connecter</LinkBtn>
                </>
              )}
              {mode === 'forgot' && (
                <LinkBtn onClick={() => switchMode('signin')}>← Retour à la connexion</LinkBtn>
              )}
              {mode === 'reset' && (
                <span style={{ fontSize: '12px' }}>Après enregistrement, tu seras automatiquement connecté.</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Style mobile responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
            height: auto !important;
          }
          div[style*="gridTemplateColumns"] > div:first-child {
            display: none !important;
          }
          div[style*="gridTemplateColumns"] > div:last-child {
            padding: 2rem 1.5rem !important;
          }
        }
      `}</style>
    </div>
  )
}

// Bouton texte style "lien"
function LinkBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ 
        background: 'transparent', border: 'none',
        color: '#1D9E75', fontWeight: '500', cursor: 'pointer',
        textDecoration: 'none', fontSize: '13px', padding: 0
      }}
    >
      {children}
    </button>
  )
}

// Composant Feature pour la partie gauche
function Feature({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'start', gap: '16px' }}>
      <div style={{
        width: '40px', height: '40px',
        background: 'rgba(255,255,255,0.15)', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px', flexShrink: 0
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: '500', fontSize: '15px', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '13px', opacity: 0.85 }}>{desc}</div>
      </div>
    </div>
  )
}
