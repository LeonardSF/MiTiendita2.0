// =============================================================================
// RequiereAuth.tsx
// Guard de rutas. Protege cualquier ruta que requiera sesión activa y,
// opcionalmente, un rol específico.
//
// Comportamiento:
//   - Sin sesión → redirige a /login conservando la ruta de origen.
//   - Con sesión pero rol no permitido → redirige a /no-autorizado.
//   - Con sesión y rol correcto → renderiza la ruta hija (<Outlet />).
// =============================================================================

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './ContextoAuth'
import type { RolUsuario } from '@/shared/types/tipos'

interface PropiedadesRequiereAuth {
  // Si se omite, cualquier usuario autenticado puede acceder
  rolesPermitidos?: RolUsuario[]
}

export function RequiereAuth({ rolesPermitidos }: PropiedadesRequiereAuth) {
  const { sesion, perfil, cargando } = useAuth()
  const ubicacion = useLocation()

  // Mientras se verifica la sesión inicial, mostrar pantalla de espera
  // para evitar un destello de redirección incorrecta
  if (cargando) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Verificando sesión…</p>
      </div>
    )
  }

  // Sin sesión activa → ir a login, guardar la ruta de origen para volver después
  if (!sesion) {
    return (
      <Navigate
        to="/login"
        state={{ desde: ubicacion }}
        replace
      />
    )
  }

  // Con sesión pero sin el rol requerido → página de acceso no autorizado
  if (rolesPermitidos && perfil && !rolesPermitidos.includes(perfil.rol)) {
    return <Navigate to="/no-autorizado" replace />
  }

  // Todo correcto → renderizar la ruta hija
  return <Outlet />
}
