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
  // (Supabase updateUser se contente du JWT, on vérifie donc nous-mêmes)
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
    <AuthContext.Provider value={{ user, signUp, signIn, signOut, deleteAccount, updatePassword, sendPasswordReset, setNewPassword, isRecovery, clearRecovery, loading }}>
      {children}
    </AuthContext.Provider>
  )
}