// =============================================================================
// Modal.tsx
// Alerta/modal genérico reutilizable.
// Aparece centrado sobre el contenido, con fondo semitransparente.
// =============================================================================

import { useEffect } from 'react'

interface PropiedadesModal {
  /** Controla si el modal está visible */
  abierto: boolean
  /** Título opcional en la cabecera */
  titulo?: string
  /** Contenido del cuerpo */
  children: React.ReactNode
  /** Callback al cerrar (botón o tecla Escape) */
  alCerrar: () => void
  /** Texto del botón de cierre. Por defecto: "Aceptar" */
  textoCerrar?: string
}

export function Modal({
  abierto,
  titulo,
  children,
  alCerrar,
  textoCerrar = 'Aceptar',
}: PropiedadesModal) {
  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return
    function manejarTeclado(e: KeyboardEvent) {
      if (e.key === 'Escape') alCerrar()
    }
    document.addEventListener('keydown', manejarTeclado)
    return () => document.removeEventListener('keydown', manejarTeclado)
  }, [abierto, alCerrar])

  if (!abierto) return null

  return (
    /* Fondo semitransparente */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titulo ? 'modal-titulo' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={alCerrar}
    >
      {/* Caja del modal — detener propagación para no cerrar al hacer clic dentro */}
      <div
        className="w-full max-w-sm rounded-2xl bg-white px-6 py-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {titulo && (
          <h2 id="modal-titulo" className="mb-3 text-base font-semibold text-gray-900">
            {titulo}
          </h2>
        )}

        <div className="text-sm text-gray-700">{children}</div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={alCerrar}
            className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white
                       transition-colors hover:bg-primary-700
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            {textoCerrar}
          </button>
        </div>
      </div>
    </div>
  )
}
