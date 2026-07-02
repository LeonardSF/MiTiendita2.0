// =============================================================================
// Insignia.tsx
// Badge/etiqueta de estado para productos en el catálogo.
// Referencia: F.3 — identificar visualmente stock bajo, agotado, normal.
//             NF.15.2 — distinguir por texto Y color, no solo color.
// =============================================================================

type VarianteInsignia = 'exito' | 'advertencia' | 'peligro' | 'neutro'

interface PropiedadesInsignia {
  variante: VarianteInsignia
  texto: string
  className?: string
}

const clasesVariante: Record<VarianteInsignia, string> = {
  exito:      'bg-green-100 text-green-800',
  advertencia:'bg-yellow-100 text-yellow-800',
  peligro:    'bg-red-100 text-red-800',
  neutro:     'bg-gray-100 text-gray-600',
}

export function Insignia({ variante, texto, className = '' }: PropiedadesInsignia) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-0.5 py-0.5 text-xs font-medium',
        clasesVariante[variante],
        className,
      ].join(' ')}
    >
      {texto}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Variante específica para estado de stock (F.3)
// ---------------------------------------------------------------------------
type EstadoStock = 'agotado' | 'advertencia' | 'con-existencias'

const configuracionStock: Record<
  EstadoStock,
  { variante: VarianteInsignia; texto: string }
> = {
  'agotado':         { variante: 'peligro',     texto: 'Agotado' },
  'advertencia':     { variante: 'advertencia', texto: 'Advertencia' },
  'con-existencias': { variante: 'exito',        texto: 'Con Existencias' },
}

export function InsigniaStock({ estado }: { estado: EstadoStock }) {
  const { variante, texto } = configuracionStock[estado]
  return <Insignia variante={variante} texto={texto} />
}
