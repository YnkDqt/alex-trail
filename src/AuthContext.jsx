import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email, password) => supabase.auth.signUp({ email, password })
  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()
  
  const deleteAccount = async () => {
    if (!user?.id) return { error: new Error('No user') }
    
    try {
      // Supprimer toutes les données utilisateur (RLS CASCADE les supprimera automatiquement)
      // Supabase auth.admin.deleteUser() nécessite service_role key côté serveur
      // Pour l'instant, on utilise signOut() - suppression complète via SQL trigger à ajouter
      await supabase.auth.signOut()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  return (
    <AuthContext.Provider value={{ user, signUp, signIn, signOut, deleteAccount, loading }}>
      {children}
    </AuthContext.Provider>
  )
}