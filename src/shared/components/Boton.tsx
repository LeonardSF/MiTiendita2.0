// =============================================================================
// Boton.tsx
// Componente de botón reutilizable con variantes y estados de carga.
// Referencia: NF.1.3 — botones con acción directa y texto claro.
// =============================================================================

import { type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma'
type TamanoBoton   = 'sm' | 'md' | 'lg'

interface PropiedadesBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton
  tamano?: TamanoBoton
  cargando?: boolean
  /** Ícono opcional a la izquierda del texto */
  icono?: React.ReactNode
}

const clasesVariante: Record<VarianteBoton, string> = {
  primario:   'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500',
  secundario: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus-visible:ring-gray-400',
  peligro:    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  fantasma:   'bg-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400',
}

const clasesTamano: Record<TamanoBoton, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
}

export function Boton({
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  icono,
  children,
  disabled,
  className = '',
  ...props
}: PropiedadesBoton) {
  const deshabilitado = disabled || cargando

  return (
    <button
      {...props}
      disabled={deshabilitado}
      className={[
        'inline-flex items-center justify-center rounded-lg font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        clasesVariante[variante],
        clasesTamano[tamano],
        className,
      ].join(' ')}
    >
      {cargando ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        icono && <span aria-hidden="true">{icono}</span>
      )}
      {children}
    </button>
  )
}
