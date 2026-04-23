import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email, password) => supabase.auth.signUp({ email, password })
  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()

  // Changement de mot de passe avec re-vérification de l'actuel
  // + déconnexion de toutes les autres sessions en cas de succès (sécurité)
  const updatePassword = async (currentPassword, newPassword) => {
    if (!user?.email) return { error: new Error('No user') }

    // 1. Vérifier l'actuel via un signIn (sans changer la session active)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (signInError) {
      return { error: new Error('Mot de passe actuel incorrect') }
    }

    // 2. Mettre à jour le mot de passe
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      return { error: updateError }
    }

    // 3. Déconnecter les autres sessions (appareils/onglets autres que celui-ci)
    // Non bloquant : si ça échoue, le mdp est déjà changé, l'utilisateur est protégé
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await supabase.functions.invoke('sign-out-others', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      }
    } catch (err) {
      console.warn('Déconnexion autres sessions échouée (non bloquant):', err)
    }

    return { error: null }
  }

  // ── MFA (Multi-Factor Authentication) ───────────────────────────────────
  // Enrôlement d'un nouveau facteur TOTP (Google Authenticator, Authy, etc.)
  // Renvoie { id, qr_code, secret, uri } pour affichage du QR code
  const mfaEnroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Alex - ${new Date().toLocaleDateString('fr-FR')}`,
    })
    return { data, error }
  }

  // Vérification du code 6 chiffres entré par l'utilisateur après scan du QR
  // Challenge + verify en 2 étapes (plus fiable que challengeAndVerify d'après les retours)
  const mfaVerify = async (factorId, code) => {
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
    if (chErr) return { error: chErr }
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })
    return { data, error }
  }

  // Désenrôler un facteur (désactiver la 2FA)
  const mfaUnenroll = async (factorId) => {
    const { data, error } = await supabase.auth.mfa.unenroll({ factorId })
    return { data, error }
  }

  // Lister les facteurs actifs (pour savoir si la 2FA est activée)
  const mfaListFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    return { data, error }
  }

  // Niveau d'assurance actuel (aal1 = mdp seul, aal2 = mdp + 2FA vérifiée)
  const mfaGetAAL = async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    return { data, error }
  }

  // Vérifier un code TOTP sans contexte d'enrôlement (pour désactivation sécurisée)
  const mfaVerifyChallenge = async (factorId, code) => {
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
    if (chErr) return { error: chErr }
    const { data, error } = await supabase.auth.mfa.verify({
      factorId, challengeId: challenge.id, code,
    })
    return { data, error }
  }

  // Hasher un code de récupération (SHA-256, hex)
  const _hashCode = async (code) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
  }

  // Sauvegarder les codes de récupération hashés en base (remplace les anciens)
  const mfaSaveRecoveryCodes = async (codes) => {
    if (!user?.id) return { error: new Error('No user') }
    // Supprimer les anciens codes
    await supabase.from('mfa_recovery_codes').delete().eq('user_id', user.id)
    // Hasher et insérer les nouveaux
    const rows = await Promise.all(codes.map(async (code) => ({
      user_id: user.id,
      code_hash: await _hashCode(code),
    })))
    const { error } = await supabase.from('mfa_recovery_codes').insert(rows)
    return { error }
  }

  // Utiliser un code de récupération → désactive le facteur via Edge Function (admin, sans contrainte AAL)
  const mfaUseRecoveryCode = async (code, factorId) => {
    if (!user?.id) return { error: new Error('No user') }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return { error: new Error('No session') }
    const { data, error } = await supabase.functions.invoke('disable-mfa', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { recoveryCode: code, factorId },
    })
    if (error) return { error }
    if (data?.error) return { error: new Error(data.error) }
    return { error: null }
  }

  // Envoi d'un email de réinitialisation de mot de passe
  // Le lien renverra l'utilisateur vers l'app avec un token de recovery dans l'URL
  const sendPasswordReset = async (email) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    return { error }
  }

  // Définition du nouveau mot de passe après clic sur le lien de reset
  // (la session de recovery est déjà active à ce stade)
  const setNewPassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) setIsRecovery(false) // sortir du mode recovery → l'app prend le relais
    return { error }
  }

  // Permet à Login de sortir du mode recovery si l'utilisateur annule
  const clearRecovery = () => setIsRecovery(false)
  
  const deleteAccount = async () => {
    if (!user?.id) return { error: new Error('No user') }

    try {
      // Récupère le token JWT de l'utilisateur connecté
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        return { error: new Error('No active session') }
      }

      // Appelle l'Edge Function qui supprime le compte auth + données (via trigger SQL)
      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (error) return { error }
      if (data?.error) return { error: new Error(data.error) }

      // Déconnexion locale (le compte auth n'existe plus de toute façon)
      await supabase.auth.signOut()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  return (
    <AuthContext.Provider value={{ user, signUp, signIn, signOut, deleteAccount, updatePassword, sendPasswordReset, setNewPassword, isRecovery, clearRecovery, mfaEnroll, mfaVerify, mfaVerifyChallenge, mfaUnenroll, mfaListFactors, mfaGetAAL, mfaSaveRecoveryCodes, mfaUseRecoveryCode, loading }}>
      {children}
    </AuthContext.Provider>
  )
}