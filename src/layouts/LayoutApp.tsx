// =============================================================================
// LayoutApp.tsx
// Layout principal de la aplicación.
//
// Especificaciones aplicadas del SRS:
//   F.1    — Navbar horizontal fija arriba, ícono + texto por botón,
//            módulo activo resaltado, botones según rol del usuario (D-01).
//   IN.1   — Barra superior ancho completo, área central con contenido activo,
//            zona inferior con fecha y hora.
//   IN.8   — En móvil, la navbar se muestra como barra horizontal scrollable.
//   F.15   — En móvil, el admin solo ve Productos y Reportes (consulta móvil).
//   D-06   — La vista móvil es el admin con pantalla responsiva, no un rol distinto.
// =============================================================================

import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingBag,
  ShoppingCart,
  Package,
  Scissors,
  BarChart2,
  LogOut,
  Clock,
} from 'lucide-react'
import { useAuth } from '@/features/auth/ContextoAuth'
import { ProveedorFooter, useFooter } from '@/shared/hooks/useFooter'
import type { RolUsuario } from '@/shared/types/tipos'

// -----------------------------------------------------------------------------
// Definición de elementos de navegación con control de acceso por rol
// -----------------------------------------------------------------------------
interface ElementoNav {
  ruta: string
  etiqueta: string
  Icono: React.ElementType
  rolesPermitidos: RolUsuario[]
  /** Si es true, este elemento NO aparece en el menú móvil del admin (F.15) */
  ocultarEnMovilAdmin?: boolean
}

const elementosNav: ElementoNav[] = [
  {
    ruta: '/ventas',
    etiqueta: 'Ventas',
    Icono: ShoppingCart,
    rolesPermitidos: ['admin', 'cajero'],
    ocultarEnMovilAdmin: true,
  },
  {
    ruta: '/productos',
    etiqueta: 'Productos',
    Icono: Package,
    rolesPermitidos: ['admin', 'cajero'],
  },
  {
    ruta: '/corte-caja',
    etiqueta: 'Corte',
    Icono: Scissors,
    rolesPermitidos: ['admin', 'cajero'],
    ocultarEnMovilAdmin: true,
  },
  {
    ruta: '/reportes',
    etiqueta: 'Reportes',
    Icono: BarChart2,
    rolesPermitidos: ['admin'],
  },
]

// -----------------------------------------------------------------------------
// Hook de reloj local — actualiza cada segundo
// -----------------------------------------------------------------------------
function useReloj() {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return ahora
}

// -----------------------------------------------------------------------------
// Footer interno — lee el reloj y la info contextual del proveedor
// -----------------------------------------------------------------------------
function FooterApp() {
  const ahora = useReloj()
  const { infoContextual } = useFooter()

  const fecha = ahora.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const hora = ahora.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <footer className="z-20 w-full shrink-0 border-t border-gray-200 bg-white">
      <div className="flex h-9 items-center justify-between px-4 gap-4">
        {/* Fecha — solo escritorio */}
        <p className="text-xs text-gray-400 capitalize truncate hidden sm:block">{fecha}</p>

        {/* Info contextual */}
        {infoContextual ? (
          <p className="text-xs font-medium text-primary-700 truncate flex-1 text-center sm:text-left">
            {infoContextual}
          </p>
        ) : (
          <span className="flex-1" />
        )}

        {/* Reloj */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />
          <p className="font-mono text-xs text-gray-500 tabular-nums">{hora}</p>
        </div>
      </div>
    </footer>
  )
}

// -----------------------------------------------------------------------------
// Layout principal (envuelto con ProveedorFooter)
// -----------------------------------------------------------------------------
export function LayoutApp() {
  return (
    <ProveedorFooter>
      <LayoutAppInner />
    </ProveedorFooter>
  )
}

function LayoutAppInner() {
  const { perfil, cerrarSesion } = useAuth()

  const esAdmin = perfil?.rol === 'admin'
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (isMobile && esAdmin) {
      const rutasProhibidas = ['/ventas', '/corte-caja']
      if (rutasProhibidas.includes(location.pathname)) {
        navigate('/productos', { replace: true })
      }
    }
  }, [isMobile, esAdmin, location.pathname, navigate])

  // Elementos visibles según rol
  const elementosVisibles = elementosNav.filter(
    (item) => !perfil || item.rolesPermitidos.includes(perfil.rol),
  )

  // En móvil el admin solo ve Productos y Reportes (F.15)
  const elementosMovil = esAdmin
    ? elementosVisibles.filter((item) => !item.ocultarEnMovilAdmin)
    : elementosVisibles

  // Clases de botón nav — escritorio
  const claseBotonNav = (activo: boolean) =>
    [
      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      activo
        ? 'bg-primary-50 text-primary-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    ].join(' ')

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 min-h-0">

      {/* ── Header ── */}
      <header className="z-30 w-full border-b border-gray-200 bg-white shadow-sm">

        {/* Fila 1: logo + perfil + cerrar sesión */}
        <div className="flex h-14 items-center justify-between px-4">

          {/* Logotipo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <span className="text-base font-bold text-gray-900">Mi Tiendita</span>
          </div>

          {/* Navegación — escritorio */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navegación principal">
            {elementosVisibles.map(({ ruta, etiqueta, Icono }) => (
              <NavLink
                key={ruta}
                to={ruta}
                className={({ isActive }) => claseBotonNav(isActive)}
              >
                <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
                {etiqueta}
              </NavLink>
            ))}
          </nav>

          {/* Zona derecha */}
          <div className="flex items-center gap-3">
            {/* Perfil — escritorio */}
            {perfil && (
              <div className="hidden md:block text-right">
                <p className="text-xs font-medium text-gray-700 leading-none">{perfil.nombre}</p>
                <p className="text-xs text-gray-400 capitalize leading-none mt-0.5">{perfil.rol}</p>
              </div>
            )}

            {/* Cerrar sesión — escritorio */}
            <button
              onClick={cerrarSesion}
              title="Cerrar sesión"
              className="hidden md:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm
                         text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar Sesión</span>
            </button>

            {/* Cerrar sesión — móvil (ícono solo) */}
            <button
              onClick={cerrarSesion}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex md:hidden items-center justify-center rounded-lg p-2
                         text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Fila 2: navegación horizontal scrollable — solo móvil (IN.8) */}
        <nav
          className="md:hidden flex items-stretch border-t border-gray-100"
          aria-label="Navegación móvil"
        >
          {elementosMovil.map(({ ruta, etiqueta, Icono }) => (
            <NavLink
              key={ruta}
              to={ruta}
              className={({ isActive }) =>
                [
                  'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50/60'
                    : 'text-gray-500 border-b-2 border-transparent hover:text-gray-800 hover:bg-gray-50',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icono className={['h-5 w-5 shrink-0', isActive ? 'text-primary-600' : 'text-gray-400'].join(' ')} aria-hidden="true" />
                  <span>{etiqueta}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* ── Contenido principal ── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <Outlet />
      </main>

      {/* ── Footer global ── */}
      <FooterApp />

    </div>
  )
}
