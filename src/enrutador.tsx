// =============================================================================
// enrutador.tsx
// Definición centralizada de rutas y guards por rol.
//
// Estructura:
//   /login              → pública, sin layout
//   /no-autorizado      → pública, sin layout
//   /                   → protegida, con LayoutApp
//     /ventas           → admin + cajero
//     /productos        → admin + cajero (cajero solo lectura vía RLS)
//     /corte-caja       → admin + cajero
//     /reportes         → solo admin
//     /alertas          → solo admin
// =============================================================================

import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProveedorAuth }   from '@/features/auth/ContextoAuth'
import { RequiereAuth }    from '@/features/auth/RequiereAuth'
import { LayoutApp }       from '@/layouts/LayoutApp'
import { PaginaLogin }     from '@/features/auth/PaginaLogin'
import { PaginaProductos } from '@/features/products/PaginaProductos'
import { PaginaVentas }    from '@/features/sales/PaginaVentas'
import { PaginaCorteCaja } from '@/features/cash-cut/PaginaCorteCaja'
import { PaginaReportes }  from '@/features/reports/PaginaReportes'
import { PaginaAlertas }   from '@/features/alerts/PaginaAlertas'

export const enrutador = createBrowserRouter([
  // ── Rutas protegidas — con layout y autenticación ──────────────────────────
  {
    element: (
      <ProveedorAuth>
        <LayoutApp />
      </ProveedorAuth>
    ),
    children: [
      // Raíz → redirige al módulo de ventas
      {
        index: true,
        element: <Navigate to="/ventas" replace />,
      },

      // Rutas accesibles para admin y cajero
      {
        element: <RequiereAuth rolesPermitidos={['admin', 'cajero']} />,
        children: [
          { path: 'ventas',     element: <PaginaVentas /> },
          { path: 'productos',  element: <PaginaProductos /> },
          { path: 'corte-caja', element: <PaginaCorteCaja /> },
        ],
      },

      // Rutas exclusivas para el administrador
      {
        element: <RequiereAuth rolesPermitidos={['admin']} />,
        children: [
          { path: 'reportes', element: <PaginaReportes /> },
          { path: 'alertas',  element: <PaginaAlertas /> },
        ],
      },
    ],
  },

  // ── Ruta pública: inicio de sesión (sin layout) ────────────────────────────
  {
    path: 'login',
    element: (
      <ProveedorAuth>
        <PaginaLogin />
      </ProveedorAuth>
    ),
  },

  // ── Ruta pública: acceso no autorizado ────────────────────────────────────
  {
    path: 'no-autorizado',
    element: (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-50">
        <p className="text-xl font-semibold text-gray-700">Acceso no autorizado</p>
        <p className="text-sm text-gray-400">
          No tienes permiso para ver esta sección.
        </p>
        <a
          href="/ventas"
          className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium
                     text-white hover:bg-primary-700 transition-colors"
        >
          Volver al inicio
        </a>
      </div>
    ),
  },

  // ── Cualquier ruta no definida → login ────────────────────────────────────
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
])
