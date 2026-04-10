import { useState } from 'react'
import { useAuth } from './AuthContext'

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
    
    // Validation RGPD pour signup
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
      background: '#f8f9fa'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          {isSignUp ? 'Créer un compte' : 'Connexion'}
        </h1>
        
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ marginBottom: '1rem', width: '100%' }}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ marginBottom: '1rem', width: '100%' }}
          />
          
          {isSignUp && (
            <label style={{
              display: 'flex',
              alignItems: 'start',
              gap: '8px',
              fontSize: '13px',
              color: '#666',
              cursor: 'pointer',
              marginBottom: '1rem',
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
          
          {error && <p style={{ color: '#e74c3c', marginBottom: '1rem', fontSize: '13px' }}>{error}</p>}
          
          <button type="submit" disabled={loading} style={{ width: '100%', marginBottom: '1rem' }}>
            {loading ? 'Chargement...' : (isSignUp ? 'Créer' : 'Se connecter')}
          </button>
        </form>
        
        <button 
          onClick={() => {
            setIsSignUp(!isSignUp)
            setRgpdConsent(false)
            setError('')
          }}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#3498db',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {isSignUp ? 'Déjà un compte ?' : 'Créer un compte'}
        </button>
      </div>
    </div>
  )
}
