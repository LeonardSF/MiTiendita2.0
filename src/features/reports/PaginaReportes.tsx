// =============================================================================
// PaginaReportes.tsx
// Módulo de reportes básicos — día, semana, mes actual.
// Gráfica de pastel (Recharts): ventas vs ganancias.
// Referencia SRS: F.13, F.15, NF.1.1, NF.15.1, NF.15.2, NF.1.4, IN.5
// Vista móvil (F.15/IN.8): tarjetas apiladas, botones táctiles grandes.
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  ShoppingCart,
  TrendingUp,
  Hash,
  CalendarDays,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/shared/lib/clienteSupabase'
import { formatearMoneda } from '@/shared/lib/calculadoras'
import { useFooter } from '@/shared/hooks/useFooter'
import { Boton } from '@/shared/components/Boton'
import type { PeriodoReporte } from '@/shared/types/tipos'

// -----------------------------------------------------------------------------
// Tipos locales
// -----------------------------------------------------------------------------
interface DatosReporte {
  ventas_totales: number
  ganancias:      number
  numero_ventas:  number
}

// -----------------------------------------------------------------------------
// Rangos de fecha por período
// -----------------------------------------------------------------------------
function obtenerRango(periodo: PeriodoReporte): { desde: string; hasta: string } {
  const hoy   = new Date()
  const hasta = hoy.toISOString().slice(0, 10)

  if (periodo === 'dia') {
    return { desde: hasta, hasta }
  }

  if (periodo === 'semana') {
    const inicio = new Date(hoy)
    inicio.setDate(hoy.getDate() - 6)
    return { desde: inicio.toISOString().slice(0, 10), hasta }
  }

  // mes
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  return { desde: inicio.toISOString().slice(0, 10), hasta }
}

// -----------------------------------------------------------------------------
// Etiquetas y colores por período
// -----------------------------------------------------------------------------
const CONFIG_PERIODO: Record<PeriodoReporte, { label: string; descripcion: string }> = {
  dia:    { label: 'Hoy',           descripcion: 'Ventas del día actual' },
  semana: { label: 'Últimos 7 días', descripcion: 'Ventas de los últimos 7 días' },
  mes:    { label: 'Mes actual',     descripcion: 'Ventas del mes en curso' },
}

const COLORES_GRAFICA = {
  ventas:    '#2563eb', // primary-600
  ganancias: '#16a34a', // green-600
  resto:     '#e2e8f0', // gray-200
}

// =============================================================================
// Tooltip personalizado para la gráfica
// =============================================================================
function TooltipPersonalizado({
  active, payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { fill: string } }>
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800">{payload[0].name}</p>
      <p className="text-gray-600">{formatearMoneda(payload[0].value)}</p>
    </div>
  )
}

// =============================================================================
// Tarjeta de métrica
// =============================================================================
interface PropiedadesTarjeta {
  icono:    React.ReactNode
  etiqueta: string
  valor:    string
  subvalor?: string
  color:    'primary' | 'green' | 'gray'
}

function TarjetaMetrica({ icono, etiqueta, valor, subvalor, color }: PropiedadesTarjeta) {
  const estilos = {
    primary: { contenedor: 'bg-primary-50 border-primary-100', texto: 'text-primary-700', icono: 'text-primary-500' },
    green:   { contenedor: 'bg-green-50  border-green-100',  texto: 'text-green-700',  icono: 'text-green-500' },
    gray:    { contenedor: 'bg-gray-50   border-gray-200',   texto: 'text-gray-700',   icono: 'text-gray-400' },
  }
  const e = estilos[color]

  return (
    <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${e.contenedor}`}>
      <span className={`shrink-0 ${e.icono}`}>{icono}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">
          {etiqueta}
        </p>
        <p className={`text-xl font-bold ${e.texto}`}>{valor}</p>
        {subvalor && <p className="text-xs text-gray-400 mt-0.5">{subvalor}</p>}
      </div>
    </div>
  )
}

// =============================================================================
// Componente principal
// =============================================================================
export function PaginaReportes() {
  const [periodo, setPeriodo]   = useState<PeriodoReporte>('dia')
  const [datos, setDatos]       = useState<DatosReporte | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const { setInfoFooter } = useFooter()

  // ---------------------------------------------------------------------------
  // Consulta de datos desde Supabase
  // Calcula ventas totales, ganancias y número de ventas en el rango.
  // ---------------------------------------------------------------------------
  const cargarReporte = useCallback(async (p: PeriodoReporte) => {
    setCargando(true)
    setError(null)

    const { desde, hasta } = obtenerRango(p)

    // 1. Sumar totales de ventas cobradas en el rango
    const { data: ventasData, error: errVentas } = await supabase
      .from('ventas')
      .select('id, total')
      .eq('estado', 'cobrada')
      .gte('fecha', desde)
      .lte('fecha', hasta)

    if (errVentas) {
      setError(errVentas.message)
      setCargando(false)
      return
    }

    const ventas        = ventasData ?? []
    const ventas_totales = ventas.reduce((acc, v) => acc + Number(v.total), 0)
    const numero_ventas  = ventas.length

    if (numero_ventas === 0) {
      setDatos({ ventas_totales: 0, ganancias: 0, numero_ventas: 0 })
      setCargando(false)
      return
    }

    // 2. Calcular ganancias: SUM(subtotal - costo*cantidad) de los detalles
    const ventaIds = ventas.map((v) => v.id)

    const { data: detallesData, error: errDetalles } = await supabase
      .from('detalle_ventas')
      .select('subtotal, cantidad, producto_id, productos(costo)')
      .in('venta_id', ventaIds)

    if (errDetalles) {
      setError(errDetalles.message)
      setCargando(false)
      return
    }

    const ganancias = (detallesData ?? []).reduce((acc, d) => {
      const prod = d.productos as unknown as { costo: number } | null
      const costo = Number(prod?.costo ?? 0)
      return acc + (Number(d.subtotal) - costo * Number(d.cantidad))
    }, 0)

    setDatos({
      ventas_totales: Math.round(ventas_totales * 100) / 100,
      ganancias:      Math.round(ganancias      * 100) / 100,
      numero_ventas,
    })
    setCargando(false)
  }, [])

  useEffect(() => { cargarReporte(periodo) }, [periodo, cargarReporte])

  // Publicar info al footer global
  useEffect(() => {
    const labels: Record<PeriodoReporte, string> = {
      dia:    'Reporte de hoy',
      semana: 'Reporte — últimos 7 días',
      mes:    'Reporte del mes actual',
    }
    if (datos && !cargando) {
      setInfoFooter(
        `${labels[periodo]} · ${formatearMoneda(datos.ventas_totales)} ventas · ${datos.numero_ventas} transacciones`,
      )
    } else {
      setInfoFooter(labels[periodo])
    }
    return () => setInfoFooter(null)
  }, [periodo, datos, cargando, setInfoFooter])

  // ---------------------------------------------------------------------------
  // Datos para la gráfica de pastel
  // Muestra: Ganancias | Costo (ventas − ganancias)
  // Si no hay datos muestra un sector gris de "Sin datos"
  // ---------------------------------------------------------------------------
  const datosGrafica = datos && datos.ventas_totales > 0
    ? [
        { name: 'Ganancias', value: Math.max(datos.ganancias, 0) },
        { name: 'Costos',    value: Math.max(datos.ventas_totales - datos.ganancias, 0) },
      ]
    : [{ name: 'Sin datos', value: 1 }]

  const coloresGrafica = datos && datos.ventas_totales > 0
    ? [COLORES_GRAFICA.ganancias, COLORES_GRAFICA.ventas]
    : [COLORES_GRAFICA.resto]

  const sinDatos = !datos || datos.numero_ventas === 0

  return (
    <div className="mx-auto max-w-4xl space-y-4">

      {/* ── Tarjeta principal ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">

        {/* Encabezado */}
        <div className="bg-primary-600 px-4 py-5 sm:px-6 text-center">
          <h1 className="text-base font-bold uppercase tracking-widest text-white">
            Reportes
          </h1>
        </div>

        {/* ── Selector de período ── */}
        <div className="border-b border-gray-100 px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-700">
              {CONFIG_PERIODO[periodo].descripcion}
            </p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <CalendarDays className="h-3 w-3" />
              {(() => {
                const { desde, hasta } = obtenerRango(periodo)
                if (desde === hasta) return desde
                return `${desde} → ${hasta}`
              })()}
            </p>
          </div>

          {/* Tabs de período — IN.5: filtros visibles; táctiles en móvil */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden self-start sm:self-auto w-full sm:w-auto">
            {(['dia', 'semana', 'mes'] as PeriodoReporte[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={[
                  'flex-1 sm:flex-none px-4 py-3 sm:py-2 text-sm font-medium transition-colors border-r last:border-r-0 border-gray-200',
                  periodo === p
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50',
                ].join(' ')}
              >
                {CONFIG_PERIODO[p].label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Contenido ── */}
        <div className="px-4 py-6 sm:px-6">

          {/* Cargando */}
          {cargando && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500" />
              <p className="text-sm text-gray-400">Calculando reporte…</p>
            </div>
          )}

          {/* Error */}
          {error && !cargando && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between">
              <p className="text-sm text-red-700">{error}</p>
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={() => cargarReporte(periodo)}
              >
                Reintentar
              </Boton>
            </div>
          )}

          {/* Resultados */}
          {!cargando && !error && datos && (
            <div className="space-y-6">

              {/* Tarjetas de métricas — 3 columnas simétricas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <TarjetaMetrica
                  icono={<ShoppingCart className="h-6 w-6" />}
                  etiqueta="Ventas totales"
                  valor={formatearMoneda(datos.ventas_totales)}
                  color="primary"
                />
                <TarjetaMetrica
                  icono={<TrendingUp className="h-6 w-6" />}
                  etiqueta="Ganancias"
                  valor={formatearMoneda(datos.ganancias)}
                  subvalor={datos.ventas_totales > 0
                    ? `${Math.round((datos.ganancias / datos.ventas_totales) * 100)}% del total`
                    : undefined}
                  color="green"
                />
                <TarjetaMetrica
                  icono={<Hash className="h-6 w-6" />}
                  etiqueta="Ventas realizadas"
                  valor={`${datos.numero_ventas}`}
                  subvalor="transacciones cobradas"
                  color="gray"
                />
              </div>

              {/* Gráfica de pastel — F.13 */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-4 sm:px-4 sm:py-6">
                {sinDatos ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-gray-400">
                    <ShoppingCart className="h-10 w-10 text-gray-200" />
                    <p className="text-sm font-medium text-gray-500">
                      Sin ventas en este período
                    </p>
                    <p className="text-xs text-gray-400 text-center max-w-xs">
                      No se registraron ventas cobradas{' '}
                      {periodo === 'dia' ? 'hoy' : periodo === 'semana' ? 'esta semana' : 'este mes'}.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 text-center mb-4">
                      Distribución de ingresos
                    </p>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={datosGrafica}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {datosGrafica.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={coloresGrafica[index % coloresGrafica.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<TooltipPersonalizado />} />
                        <Legend
                          formatter={(value) => (
                            <span className="text-xs text-gray-600">{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Leyenda detallada debajo de la gráfica */}
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-white border border-gray-100 px-4 py-3 text-center">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full mr-1.5"
                          style={{ backgroundColor: COLORES_GRAFICA.ganancias }}
                        />
                        <span className="text-xs text-gray-500">Ganancias</span>
                        <p className="text-base font-bold text-green-700 mt-1">
                          {formatearMoneda(datos.ganancias)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-100 px-4 py-3 text-center">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full mr-1.5"
                          style={{ backgroundColor: COLORES_GRAFICA.ventas }}
                        />
                        <span className="text-xs text-gray-500">Costos</span>
                        <p className="text-base font-bold text-primary-700 mt-1">
                          {formatearMoneda(Math.max(datos.ventas_totales - datos.ganancias, 0))}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
