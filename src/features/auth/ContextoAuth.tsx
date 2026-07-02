// =============================================================================
// ContextoAuth.tsx
// Contexto global de sesión. Provee el usuario autenticado, su perfil y
// las acciones de cierre de sesión a todo el árbol de componentes.
//
// Flujo:
//   1. Al montar, recupera la sesión activa desde Supabase Auth.
//   2. Si hay sesión, carga el perfil del usuario desde la tabla `usuarios`.
//   3. Escucha cambios de sesión (login / logout) y actualiza el estado.
// =============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/clienteSupabase'
import type { Usuario } from '@/shared/types/tipos'

// -----------------------------------------------------------------------------
// Forma del contexto
// -----------------------------------------------------------------------------
interface ValorContextoAuth {
  sesion: Session | null       // Sesión JWT de Supabase Auth
  usuario: User | null         // Usuario de Supabase Auth (contiene el UUID)
  perfil: Usuario | null       // Perfil público desde la tabla `usuarios`
  cargando: boolean            // true mientras se verifica la sesión inicial
  cerrarSesion: () => Promise<void>
}

const ContextoAuth = createContext<ValorContextoAuth | undefined>(undefined)

// -----------------------------------------------------------------------------
// Proveedor — debe envolver toda la aplicación en enrutador.tsx
// -----------------------------------------------------------------------------
export function ProveedorAuth({ children }: { children: React.ReactNode }) {
  const [sesion,   setSesion]   = useState<Session | null>(null)
  const [perfil,   setPerfil]   = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // onAuthStateChange emite tanto INITIAL_SESSION como SIGNED_IN al cargar.
    // Usamos un flag para cargar el perfil solo la primera vez que llegue
    // una sesión válida, evitando doble llamado y sus efectos secundarios.
    let perfilCargado = false

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s)
      if (s && !perfilCargado) {
        perfilCargado = true
        cargarPerfil(s.user.id)
      } else if (!s) {
        perfilCargado = false
        setPerfil(null)
        setCargando(false)
      }
    })

    return () => suscripcion.subscription.unsubscribe()
  }, [])

  // Carga el perfil público del usuario desde la tabla `usuarios`
  async function cargarPerfil(idUsuario: string) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', idUsuario)
      .single()

    if (error) {
      // El usuario existe en Auth pero no tiene perfil en la tabla `usuarios`
      console.error('[ContextoAuth] No se encontró perfil para el usuario:', error.message)
    }

    setPerfil(data ?? null)
    setCargando(false)
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
  }

  return (
    <ContextoAuth.Provider
      value={{
        sesion,
        usuario: sesion?.user ?? null,
        perfil,
        cargando,
        cerrarSesion,
      }}
    >
      {children}
    </ContextoAuth.Provider>
  )
}

// -----------------------------------------------------------------------------
// Hook para consumir el contexto en cualquier componente
// -----------------------------------------------------------------------------
export function useAuth(): ValorContextoAuth {
  const ctx = useContext(ContextoAuth)
  if (!ctx) {
    throw new Error('[useAuth] Debe usarse dentro de <ProveedorAuth>.')
  }
  return ctx
}
