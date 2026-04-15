import { useState } from 'react'
import { useAuth } from './AuthContext'
import { C } from './constants'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [rgpdConsent, setRgpdConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    
    if (isSignUp && !rgpdConsent) {
      setError("Vous devez accepter la politique de confidentialité")
      return
    }
    
    setLoading(true)
    const { error } = isSignUp 
      ? await signUp(email, password)
      : await signIn(email, password)
    
    if (error) setError(error.message)
    setLoading(false)
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
            <Feature 
              icon="📊" 
              title="Suivi d'entraînement" 
              desc="Programme, activités, forme physique" 
            />
            <Feature 
              icon="🏔️" 
              title="Stratégie de course" 
              desc="Analyse parcours, allures, nutrition" 
            />
            <Feature 
              icon="👥" 
              title="Partage avec ton équipe" 
              desc="Stratégies et ravitaillements collaboratifs" 
            />
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
              {isSignUp ? 'Créer un compte' : 'Connexion'}
            </h1>
            <p style={{ 
              color: C.muted, 
              fontSize: '14px', 
              margin: '0 0 32px 0' 
            }}>
              Entre ton email pour {isSignUp ? "créer ton compte" : "recevoir un lien de connexion"}
            </p>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '13px', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  color: C.muted 
                }}>
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
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '13px', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  color: C.muted 
                }}>
                  Mot de passe
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              
              {isSignUp && (
                <label style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: '8px',
                  fontSize: '13px',
                  color: C.muted,
                  cursor: 'pointer',
                  marginBottom: '16px',
                  lineHeight: '1.5'
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
                  color: C.red, 
                  marginBottom: '16px', 
                  fontSize: '13px',
                  background: C.redPale,
                  padding: '8px 12px',
                  borderRadius: '6px'
                }}>
                  {error}
                </p>
              )}
              
              <button 
                type="submit" 
                disabled={loading} 
                style={{ 
                  width: '100%', 
                  marginBottom: '24px',
                  background: '#1D9E75',
                  color: 'white',
                  border: 'none',
                  height: '40px',
                  borderRadius: '6px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Chargement...' : (isSignUp ? 'Créer mon compte' : 'Envoyer le lien magique')}
              </button>
            </form>
            
            <div style={{ 
              textAlign: 'center', 
              fontSize: '13px', 
              color: C.muted 
            }}>
              {isSignUp ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setRgpdConsent(false)
                  setError('')
                }}
                style={{ 
                  background: 'transparent',
                  border: 'none',
                  color: '#1D9E75',
                  fontWeight: '500',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontSize: '13px'
                }}
              >
                {isSignUp ? 'Se connecter' : 'Créer un compte'}
              </button>
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

// Composant Feature pour la partie gauche
function Feature({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'start', gap: '16px' }}>
      <div style={{
        width: '40px',
        height: '40px',
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        flexShrink: 0
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
