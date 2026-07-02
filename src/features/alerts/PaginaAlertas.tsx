// =============================================================================
// PaginaAlertas.tsx
// Módulo de alertas de inventario bajo.
// Referencia SRS: F.14, IN.2, NF.1.4
// Diseño: modal con encabezado rojo "ALERTA DE INVENTARIO", lista desplazable,
//         botón "Aceptar" rojo. Botón "Alertas" rojo en pie de tabla del catálogo.
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Package, AlertTriangle } from 'lucide-react'
import { supabase } from '@/shared/lib/clienteSupabase'
import { useFooter } from '@/shared/hooks/useFooter'
import { Boton } from '@/shared/components/Boton'
import { InsigniaStock } from '@/shared/components/Insignia'
import { obtenerEstadoStock } from '@/shared/lib/calculadoras'
import type { AlertaConProducto } from '@/shared/types/tipos'

// =============================================================================
// Modal de alerta de inventario — F.14
// Encabezado rojo, letras blancas, mayúsculas, lista desplazable, botón rojo.
// =============================================================================
interface PropiedadesModalAlerta {
  alertas:  AlertaConProducto[]
  onCerrar: () => void
}

function ModalAlertaInventario({ alertas, onCerrar }: PropiedadesModalAlerta) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Encabezado — F.14: rojo, letras blancas, MAYÚSCULAS */}
        <div className="bg-red-600 px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5 text-white" aria-hidden="true" />
            <h2 className="text-base font-bold uppercase tracking-widest text-white">
              Alerta de inventario
            </h2>
          </div>
        </div>

        {/* Lista desplazable — F.14: fondo blanco, letras negras, barra lateral */}
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
          {alertas.map((alerta) => (
            <div key={alerta.id} className="px-6 py-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {alerta.producto.nombre}
                    </p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">
                      {alerta.producto.codigo}
                    </p>
                  </div>
                  <InsigniaStock
                    estado={obtenerEstadoStock(
                      alerta.producto.existencia,
                      alerta.producto.minimo_existencia,
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-center">
                    <p className="text-xs text-gray-500">Existencia actual</p>
                    <p className="text-lg font-bold text-red-600">
                      {alerta.producto.existencia}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                    <p className="text-xs text-gray-500">Cantidad mínima</p>
                    <p className="text-lg font-bold text-gray-700">
                      {alerta.producto.minimo_existencia}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pie — F.14: botón Aceptar rojo, letras blancas, centrado */}
        <div className="border-t border-gray-100 px-6 py-4 flex justify-center">
          <Boton
            variante="peligro"
            tamano="lg"
            className="min-w-32"
            onClick={onCerrar}
          >
            Aceptar
          </Boton>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Componente principal
// =============================================================================
export function PaginaAlertas() {
  const [alertasPendientes, setAlertasPendientes] = useState<AlertaConProducto[]>([])
  const [alertasResueltas,  setAlertasResueltas]  = useState<AlertaConProducto[]>([])
  const [cargando,    setCargando]    = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [alertaDetalle, setAlertaDetalle] = useState<AlertaConProducto | null>(null)
  const { setInfoFooter } = useFooter()

  // ---------------------------------------------------------------------------
  // Cargar alertas no resueltas y últimas resueltas
  // Usa los campos reales del esquema: resuelta / fecha_resuelta
  // ---------------------------------------------------------------------------
  const cargarAlertas = useCallback(async () => {
    setCargando(true)

    const [{ data: pendientes }, { data: resueltas }] = await Promise.all([
      supabase
        .from('alertas')
        .select('*, producto:productos(codigo, nombre, existencia, minimo_existencia)')
        .eq('resuelta', false)
        .eq('tipo', 'stock_bajo')
        .order('fecha_generada', { ascending: false }),
      supabase
        .from('alertas')
        .select('*, producto:productos(codigo, nombre, existencia, minimo_existencia)')
        .eq('resuelta', true)
        .eq('tipo', 'stock_bajo')
        .order('fecha_resuelta', { ascending: false })
        .limit(15),
    ])

    const activas = ((pendientes as AlertaConProducto[]) ?? []).filter(
      (a) => a.producto.existencia <= a.producto.minimo_existencia,
    )

    setAlertasPendientes(activas)
    setAlertasResueltas((resueltas as AlertaConProducto[]) ?? [])

    // Mostrar modal automáticamente si hay pendientes (F.14)
    if (activas.length > 0) setModalAbierto(true)

    setCargando(false)
  }, [])

  useEffect(() => { cargarAlertas() }, [cargarAlertas])

  // Publicar info al footer global
  useEffect(() => {
    if (cargando) return
    const pendientes = alertasPendientes.length
    if (pendientes > 0) {
      setInfoFooter(`${pendientes} alerta${pendientes !== 1 ? 's' : ''} pendiente${pendientes !== 1 ? 's' : ''} de inventario`)
    } else {
      setInfoFooter('Sin alertas pendientes · Inventario en orden')
    }
    return () => setInfoFooter(null)
  }, [alertasPendientes.length, cargando, setInfoFooter])

  // ---------------------------------------------------------------------------
  // Cerrar modal
  // ---------------------------------------------------------------------------
  function cerrarModal() {
    setModalAbierto(false)
    setAlertaDetalle(null)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-4xl space-y-4">

      {/* Modal F.14 */}
      {modalAbierto && (
        <ModalAlertaInventario
          alertas={alertaDetalle ? [alertaDetalle] : alertasPendientes}
          onCerrar={cerrarModal}
        />
      )}

      {/* ── Tarjeta principal ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">

        {/* Encabezado */}
        <div className="bg-red-600 px-6 py-5 flex items-center justify-between">
          <h1 className="text-base font-bold uppercase tracking-widest text-white">
            Alertas de inventario
          </h1>
          {alertasPendientes.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">
              {alertasPendientes.length} pendiente{alertasPendientes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Alertas pendientes ── */}
        <div>
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">
              Pendientes
            </h2>
            {alertasPendientes.length > 0 && (
              <Boton
                variante="peligro"
                tamano="sm"
                icono={<Bell className="h-3.5 w-3.5" />}
                onClick={() => { setAlertaDetalle(null); setModalAbierto(true) }}
              >
                Ver alertas
              </Boton>
            )}
          </div>

          {cargando ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-red-500" />
              <p className="text-sm">Cargando alertas…</p>
            </div>
          ) : alertasPendientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <BellOff className="h-10 w-10 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Sin alertas pendientes</p>
              <p className="text-xs text-gray-400">El inventario está dentro de los mínimos configurados.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {alertasPendientes.map((alerta) => (
                <div
                  key={alerta.id}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-red-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100">
                      <Package className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {alerta.producto.nombre}
                      </p>
                      <p className="text-xs font-mono text-gray-400">{alerta.producto.codigo}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-center hidden sm:block">
                      <p className="text-xs text-gray-400">Existencia</p>
                      <p className="text-base font-bold text-red-600">
                        {alerta.producto.existencia}
                      </p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-xs text-gray-400">Mínimo</p>
                      <p className="text-base font-bold text-gray-600">
                        {alerta.producto.minimo_existencia}
                      </p>
                    </div>
                    <InsigniaStock
                      estado={obtenerEstadoStock(
                        alerta.producto.existencia,
                        alerta.producto.minimo_existencia,
                      )}
                    />
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      onClick={() => { setAlertaDetalle(alerta); setModalAbierto(true) }}
                    >
                      Ver
                    </Boton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Historial de alertas resueltas ── */}
      {alertasResueltas.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Resueltas recientemente — últimas {alertasResueltas.length}
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {alertasResueltas.map((alerta) => (
              <div
                key={alerta.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Package className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600 truncate">{alerta.producto.nombre}</p>
                    <p className="text-xs font-mono text-gray-300">{alerta.producto.codigo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-gray-400">
                  <span className="hidden sm:inline">{alerta.producto.existencia} uds.</span>
                  {alerta.fecha_resuelta && (
                    <span>
                      {new Date(alerta.fecha_resuelta).toLocaleDateString('es-MX', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                      })}
                    </span>
                  )}
                  <InsigniaStock
                    estado={obtenerEstadoStock(
                      alerta.producto.existencia,
                      alerta.producto.minimo_existencia,
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
