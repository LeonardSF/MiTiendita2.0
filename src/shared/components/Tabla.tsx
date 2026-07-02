// =============================================================================
// Tabla.tsx
// Componente de tabla reutilizable con paginación y estado vacío.
// Referencia: F.3 — máx 10 productos a la vez con scroll lateral.
//             NF.1.1 — paginar resultados para no sobrecargar.
//             IN.7 — componentes simples, tablas con búsqueda.
// =============================================================================

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------
export interface ColumnaTabla<T> {
  encabezado: string
  /** Clave del objeto o función que retorna el contenido de la celda */
  render: keyof T | ((fila: T) => React.ReactNode)
  className?: string
}

interface PropiedadesTabla<T> {
  columnas: ColumnaTabla<T>[]
  datos: T[]
  /** Clave única por fila */
  keyFila: keyof T
  /** Filas por página. Default: 10 (F.3) */
  filasPorPagina?: number
  /** Mensaje cuando no hay datos */
  mensajeVacio?: string
  cargando?: boolean
  /** Clase adicional para el contenedor externo */
  className?: string
}

// -----------------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------------
export function Tabla<T>({
  columnas,
  datos,
  keyFila,
  filasPorPagina = 10,
  mensajeVacio = 'No hay datos para mostrar.',
  cargando = false,
  className = '',
}: PropiedadesTabla<T>) {
  const [pagina, setPagina] = useState(1)

  const totalPaginas = Math.max(1, Math.ceil(datos.length / filasPorPagina))
  const inicio = (pagina - 1) * filasPorPagina
  const datosPagina = datos.slice(inicio, inicio + filasPorPagina)

  function retroceder() {
    setPagina((p) => Math.max(1, p - 1))
  }
  function avanzar() {
    setPagina((p) => Math.min(totalPaginas, p + 1))
  }

  return (
    <div className={['flex flex-col gap-2', className].join(' ')}>

      {/* Contenedor con scroll horizontal para tablas anchas (F.3, IN.7) */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columnas.map((col) => (
                <th
                  key={String(col.encabezado)}
                  className={[
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500',
                    col.className ?? '',
                  ].join(' ')}
                >
                  {col.encabezado}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr>
                <td colSpan={columnas.length} className="py-10 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : datosPagina.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} className="py-10 text-center text-gray-400">
                  {mensajeVacio}
                </td>
              </tr>
            ) : (
              datosPagina.map((fila) => (
                <tr
                  key={String(fila[keyFila])}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {columnas.map((col) => (
                    <td
                      key={String(col.encabezado)}
                      className={['px-4 py-3 text-gray-700', col.className ?? ''].join(' ')}
                    >
                      {typeof col.render === 'function'
                        ? col.render(fila)
                        : String(fila[col.render] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación — solo si hay más de una página */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between px-1 text-xs text-gray-500">
          <span>
            Mostrando {inicio + 1}–{Math.min(inicio + filasPorPagina, datos.length)} de{' '}
            {datos.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={retroceder}
              disabled={pagina === 1}
              aria-label="Página anterior"
              className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2">
              {pagina} / {totalPaginas}
            </span>
            <button
              onClick={avanzar}
              disabled={pagina === totalPaginas}
              aria-label="Página siguiente"
              className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
