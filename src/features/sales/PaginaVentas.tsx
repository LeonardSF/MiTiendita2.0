// =============================================================================
// PaginaVentas.tsx
// Módulo de registro de venta — diseño de una sola columna.
// Layout: buscador con lista compacta → tabla de venta → pie con total y cobro.
// Referencia SRS: F.4, F.7, F.8, F.9, F.10, IN.3, NF.1.3, NF.2.2
// =============================================================================

import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Minus, X } from 'lucide-react'
import { useVentas } from '@/shared/hooks/useVentas'
import { useAuth } from '@/features/auth/ContextoAuth'
import { useFooter } from '@/shared/hooks/useFooter'
import { supabase } from '@/shared/lib/clienteSupabase'
import {
  formatearMoneda,
  calcularCambio,
  esCobradoValido,
} from '@/shared/lib/calculadoras'
import { Boton } from '@/shared/components/Boton'
import type { Producto } from '@/shared/types/tipos'

// =============================================================================
// Modal de alerta — producto sin existencias (mismo patrón que PaginaProductos)
// =============================================================================
function ModalAlertaAgotado({ mensaje, onCerrar }: { mensaje: string; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
         onClick={onCerrar}>
      <div className="w-full max-w-sm rounded-2xl bg-white overflow-hidden shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="bg-red-600 px-6 py-4 text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">Alerta</h2>
        </div>
        <div className="px-8 py-6 flex flex-col items-center gap-4">
          <span className="text-5xl leading-none">⚠️</span>
          <p className="text-sm text-gray-700 text-center leading-relaxed">{mensaje}</p>
          <Boton variante="peligro" className="w-full" onClick={onCerrar}>Aceptar</Boton>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Modal de cobro (F.10)
// Encabezado azul (primary), total grande, campo monto recibido, cambio auto.
// =============================================================================
interface PropiedadesModalCobro {
  total: number
  cargando: boolean
  onCobrar: (monto: number) => void
  onCancelar: () => void
}

function ModalCobro({ total, cargando, onCobrar, onCancelar }: PropiedadesModalCobro) {
  const [monto, setMonto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const montoNum = parseFloat(monto) || 0
  const cambio   = calcularCambio(montoNum, total)
  const valido   = esCobradoValido(montoNum, total)

  function manejarCobrar(e: React.FormEvent) {
    e.preventDefault()
    if (!valido) {
      setError(`El monto recibido no puede ser menor al total (${formatearMoneda(total)}).`)
      return
    }
    onCobrar(montoNum)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
         onClick={onCancelar}>
      <div className="w-full max-w-sm rounded-2xl bg-white overflow-hidden shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        {/* Encabezado azul */}
        <div className="bg-blue-400 px-6 py-4 text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-black">Cobrar</h2>
        </div>

        <form onSubmit={manejarCobrar} className="p-6 space-y-5">
          {/* Total grande centrado */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Total a cobrar</p>
            <p className="text-4xl font-bold text-gray-900">{formatearMoneda(total)}</p>
          </div>

          {/* Campo monto recibido */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Monto recibido ($)
            </label>
            <input
              ref={inputRef}
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={monto}
              onChange={(e) => { setMonto(e.target.value); setError(null) }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Cambio calculado */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-gray-500">Cambio</span>
            <span className={`text-lg font-bold ${valido && montoNum > 0 ? 'text-primary-700' : 'text-gray-300'}`}>
              {valido && montoNum > 0 ? formatearMoneda(cambio ?? 0) : '—'}
            </span>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Boton type="button" variante="secundario" className="flex-1" onClick={onCancelar} disabled={cargando}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" className="flex-1" cargando={cargando} disabled={!valido || montoNum === 0}>
              Confirmar cobro
            </Boton>
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================================================
// Modal de resumen post-cobro — se cierra solo en 3s, sin botón
// =============================================================================
interface ResumenVenta {
  folio:     string
  total:     number
  monto:     number
  cambio:    number
  productos: number
  fecha:     string
  hora:      string
}

interface PropiedadesModalResumen {
  resumen: ResumenVenta
}

function ModalResumenVenta({ resumen }: PropiedadesModalResumen) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-overlay-in"
         style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <div className="w-full max-w-xs rounded-2xl bg-white overflow-hidden shadow-2xl animate-modal-in">

        {/* Barra de progreso — se vacía en 3s */}
        <div className="h-1 bg-green-100 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-green-500 animate-bar-shrink" />
        </div>

        <div className="px-6 pt-6 pb-7 flex flex-col items-center gap-5">

          {/* Círculo animado con check SVG */}
          <div className="animate-circle-pop flex h-20 w-20 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-200">
            <svg viewBox="0 0 36 36" className="h-10 w-10" fill="none">
              <polyline
                points="6,18 14,26 30,10"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="60"
                className="animate-check-draw"
              />
            </svg>
          </div>

          {/* Título + folio */}
          <div className="text-center animate-row-in" style={{ animationDelay: '0.3s' }}>
            <p className="text-lg font-bold text-gray-900">¡Venta completada!</p>
            <p className="text-xs font-mono text-gray-400 mt-0.5">{resumen.folio}</p>
          </div>

          {/* Cambio — dato más importante, grande y centrado */}
          <div className="animate-row-in w-full rounded-xl bg-green-50 border border-green-100 px-4 py-4 text-center"
               style={{ animationDelay: '0.4s' }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-1">Cambio</p>
            <p className="text-4xl font-bold text-green-700">{formatearMoneda(resumen.cambio)}</p>
          </div>

          {/* Datos secundarios */}
          <ul className="w-full space-y-0 rounded-xl border border-gray-100 overflow-hidden text-sm divide-y divide-gray-100">
            {[
              { label: 'Total cobrado',   valor: formatearMoneda(resumen.total),    delay: '0.5s', bold: true },
              { label: 'Monto recibido',  valor: formatearMoneda(resumen.monto),    delay: '0.6s', bold: false },
              { label: 'Productos',       valor: `${resumen.productos}`,            delay: '0.7s', bold: false },
              { label: 'Fecha',           valor: resumen.fecha,                     delay: '0.8s', bold: false },
              { label: 'Hora',            valor: resumen.hora,                      delay: '0.9s', bold: false },
            ].map(({ label, valor, delay, bold }) => (
              <li key={label}
                  className="flex justify-between items-center px-4 py-2.5 bg-gray-50 animate-row-in"
                  style={{ animationDelay: delay }}>
                <span className="text-gray-500">{label}</span>
                <span className={bold ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}>{valor}</span>
              </li>
            ))}
          </ul>

        </div>
      </div>
    </div>
  )
}
interface PropiedadesModalCancelar {
  cargando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

function ModalCancelarVenta({ cargando, onConfirmar, onCancelar }: PropiedadesModalCancelar) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
         onClick={onCancelar}>
      <div className="w-full max-w-xs rounded-2xl bg-white overflow-hidden shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="bg-red-600 px-6 py-4 text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">Cancelar venta</h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 text-center">
            ¿Confirmas que deseas cancelar la venta actual? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <Boton variante="secundario" className="flex-1" onClick={onCancelar} disabled={cargando}>
              No
            </Boton>
            <Boton variante="peligro" className="flex-1" cargando={cargando} onClick={onConfirmar}>
              Sí, cancelar
            </Boton>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Componente principal
// =============================================================================
export function PaginaVentas() {
  const { perfil } = useAuth()
  const { setInfoFooter } = useFooter()
  const {
    ventaActual, detalles, cargando, error,
    iniciarVenta, agregarProducto, actualizarCantidad,
    quitarProducto, cobrarVenta, cancelarVenta, limpiarError,
  } = useVentas(perfil?.id ?? '')

  // Búsqueda de productos
  const [busqueda, setBusqueda]       = useState('')
  const [resultados, setResultados]   = useState<Producto[]>([])
  const [buscando, setBuscando]       = useState(false)

  // Mapa código → producto para los items ya en el carrito
  // Se construye a medida que se agregan productos y persiste entre búsquedas
  const [mapaProductos, setMapaProductos] = useState<Record<string, Producto>>({})

  // Modales
  const [modalCobro, setModalCobro]       = useState(false)
  const [modalCancelar, setModalCancelar] = useState(false)

  // Alerta producto sin existencia
  const [alertaAgotado, setAlertaAgotado] = useState<string | null>(null)

  // Resumen post-cobro
  const [resumenVenta, setResumenVenta] = useState<ResumenVenta | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const ventaIniciadaRef = useRef(false)

  // Iniciar venta al montar — reanuda si ya hay una abierta hoy
  useEffect(() => {
    if (!ventaActual && perfil?.id && !ventaIniciadaRef.current) {
      ventaIniciadaRef.current = true
      iniciarVenta(perfil.id)
    }
  }, [perfil?.id])

  // Mantener foco en el buscador
  useEffect(() => { inputRef.current?.focus() }, [detalles.length])

  // Cuando se reanudan detalles desde BD (recarga), cargar existencias actuales
  // de los productos para que el control +/- tenga el tope correcto
  useEffect(() => {
    if (detalles.length === 0) return
    const idsACargar = detalles
      .map((d) => d.producto_id)
      .filter((id) => !mapaProductos[id])
    if (idsACargar.length === 0) return

    supabase
      .from('productos')
      .select('*')
      .in('id', idsACargar)
      .then(({ data }) => {
        if (!data) return
        setMapaProductos((prev) => {
          const nuevo = { ...prev }
          for (const p of data as Producto[]) nuevo[p.id] = p
          return nuevo
        })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalles.length])

  // Búsqueda con debounce 300ms
  useEffect(() => {
    if (!busqueda.trim()) { setResultados([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      const { data } = await supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .or(`nombre.ilike.%${busqueda.trim()}%,codigo.ilike.%${busqueda.trim()}%`)
        .limit(8)
      setResultados((data as Producto[]) ?? [])
      setBuscando(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busqueda])

  async function seleccionarProducto(p: Producto) {
    // Producto sin existencia — mostrar alerta y no agregar
    if (p.existencia <= 0) {
      setAlertaAgotado(`"${p.nombre}" no tiene existencias disponibles.`)
      inputRef.current?.focus()
      return
    }

    // Si la venta todavía no terminó de abrirse, espera a que exista antes de insertar.
    if (!ventaActual && perfil?.id) {
      const inicio = await iniciarVenta(perfil.id)
      if (!inicio.ok) {
        inputRef.current?.focus()
        return
      }
    }

    const agregado = await agregarProducto(p, 1)
    if (!agregado.ok) {
      inputRef.current?.focus()
      return
    }

    // Guardar en el mapa para poder mostrar el código en la tabla luego
    setMapaProductos((prev) => ({ ...prev, [p.id]: p }))
    setBusqueda('')
    setResultados([])
    inputRef.current?.focus()
  }

  async function manejarCobrar(monto: number) {
    // Capturar los datos del resumen ANTES de que cobrarVenta limpie el estado
    const folio    = ventaActual?.folio   ?? ''
    const total    = ventaActual?.total   ?? 0
    const cambio   = Math.round((monto - total) * 100) / 100
    const numProds = detalles.length
    const ahora    = new Date()
    const fechaRes = ahora.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    const horaRes  = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

    const res = await cobrarVenta(monto)
    if (!res.ok) return

    ventaIniciadaRef.current = false
    setModalCobro(false)

    // Mostrar modal con resumen — se cierra a los 3s o manualmente
    const resumen: ResumenVenta = { folio, total, monto, cambio, productos: numProds, fecha: fechaRes, hora: horaRes }
    setResumenVenta(resumen)
    setTimeout(() => {
      setResumenVenta(null)
      iniciarVenta(perfil?.id)
    }, 3000)
  }

  async function manejarCancelar() {
    const res = await cancelarVenta()
    if (!res.ok) return
    ventaIniciadaRef.current = false
    setModalCancelar(false)
    iniciarVenta(perfil?.id)
  }

  const total = ventaActual?.total ?? 0
  const hayProductos = detalles.length > 0

  // Publicar info al footer global
  useEffect(() => {
    const numProds = detalles.length
    if (numProds === 0) {
      setInfoFooter('Venta vacía — agrega productos para comenzar')
    } else {
      setInfoFooter(
        `Total: ${formatearMoneda(total)} · ${numProds} ${numProds === 1 ? 'producto' : 'productos'}`,
      )
    }
    return () => setInfoFooter(null)
  }, [total, detalles.length, setInfoFooter])

  return (
    <div className="mx-auto max-w-4xl space-y-4">

      {/* Modal resumen post-cobro */}
      {resumenVenta && (
        <ModalResumenVenta resumen={resumenVenta} />
      )}

      {/* Modales de venta */}
      {modalCobro && (
        <ModalCobro
          total={total}
          cargando={cargando}
          onCobrar={manejarCobrar}
          onCancelar={() => setModalCobro(false)}
        />
      )}
      {modalCancelar && (
        <ModalCancelarVenta
          cargando={cargando}
          onConfirmar={manejarCancelar}
          onCancelar={() => setModalCancelar(false)}
        />
      )}

      {/* Modal producto agotado */}
      {alertaAgotado && (
        <ModalAlertaAgotado
          mensaje={alertaAgotado}
          onCerrar={() => setAlertaAgotado(null)}
        />
      )}

      {/* Error global */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-3 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={limpiarError} className="ml-4 text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Tarjeta principal ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">

        {/* Encabezado — mismo estilo que /productos */}
        <div className="bg-primary-600 px-6 py-5 text-center">
          <h1 className="text-base font-bold uppercase tracking-widest text-white">
            Registro de venta

            {/* id de venta
            {ventaActual?.folio && (
              <span className="ml-3 font-mono text-xs font-normal text-primary-200 normal-case tracking-normal">
                {ventaActual.folio}
              </span>
            )}
              */}
          </h1>
        </div>

        {/* ── Sección superior: buscador + lista compacta de resultados ── */}
        <div className="border-b border-gray-200 p-5 space-y-3">
          {/* Input de búsqueda — ancho completo */}
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar por nombre o código…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Lista de resultados compacta */}
          {(resultados.length > 0 || (buscando && busqueda)) && (
            <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {/* Encabezado de columnas */}
              <div className="grid grid-cols-[7rem_1fr_6rem] gap-3 bg-gray-50 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Código</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Nombre</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">Precio</span>
              </div>
              {buscando ? (
                <p className="px-4 py-3 text-sm text-gray-400">Buscando…</p>
              ) : (
                resultados.map((p) => {
                  const agotado = p.existencia <= 0
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => seleccionarProducto(p)}
                      className={[
                        'grid grid-cols-[7rem_1fr_6rem] gap-3 w-full items-center px-4 py-2.5 text-left transition-colors group',
                        agotado
                          ? 'bg-gray-50 hover:bg-red-50 cursor-pointer'
                          : 'hover:bg-primary-50',
                      ].join(' ')}
                    >
                      <span className={[
                        'font-mono text-xs truncate',
                        agotado ? 'text-gray-300' : 'text-gray-400',
                      ].join(' ')}>{p.codigo}</span>
                      <span className={[
                        'text-sm font-medium truncate flex items-center gap-1.5',
                        agotado
                          ? 'text-gray-400 group-hover:text-red-600'
                          : 'text-gray-800 group-hover:text-primary-700',
                      ].join(' ')}>
                        {p.nombre}
                        {agotado && (
                          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-500 shrink-0">
                            Agotado
                          </span>
                        )}
                      </span>
                      <span className={[
                        'text-sm font-semibold text-right tabular-nums',
                        agotado ? 'text-gray-300' : 'text-primary-600',
                      ].join(' ')}>
                        {formatearMoneda(p.precio_venta)}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* ── Tabla de venta actual ── */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Código', 'Descripción', 'Cantidad', 'Precio', 'Subtotal', 'Acciones'].map((h) => (
                  <th key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* ── Indicador de carga ── */}
              {cargando && detalles.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center gap-3 py-14">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500" />
                      <p className="text-sm text-gray-400">Cargando venta…</p>
                    </div>
                  </td>
                </tr>
              ) : detalles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-sm text-gray-400">
                    Busca un producto para comenzar la venta.
                  </td>
                </tr>
              ) : (
                detalles.map((d) => (
                  <tr key={d.id}
                      className={[
                        'transition-colors',
                        cargando ? 'opacity-60 bg-gray-50/80' : 'hover:bg-gray-50/70',
                      ].join(' ')}>
                    {/* Código */}
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                      {mapaProductos[d.producto_id]?.codigo ?? '—'}
                    </td>
                    {/* Nombre */}
                    <td className="px-4 py-3 font-medium text-gray-800">{d.nombre_producto}</td>
                    {/* Cantidad con controles */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => actualizarCantidad(d.id, d.cantidad - 1, mapaProductos[d.producto_id]?.existencia ?? 0)}
                          disabled={cargando}
                          aria-label="Reducir cantidad"
                          className="rounded-md border border-gray-200 p-1 text-gray-400
                                     hover:bg-gray-100 hover:text-gray-700
                                     disabled:opacity-40 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold text-gray-800 tabular-nums">
                          {d.cantidad}
                        </span>
                        <button
                          onClick={() => actualizarCantidad(d.id, d.cantidad + 1, mapaProductos[d.producto_id]?.existencia ?? 0)}
                          disabled={cargando || d.cantidad >= (mapaProductos[d.producto_id]?.existencia ?? 0)}
                          aria-label="Aumentar cantidad"
                          className="rounded-md border border-gray-200 p-1 text-gray-400
                                     hover:bg-gray-100 hover:text-gray-700
                                     disabled:opacity-40 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    {/* Precio */}
                    <td className="px-4 py-3 text-gray-700">{formatearMoneda(d.precio_unitario)}</td>
                    {/* Subtotal */}
                    <td className="px-4 py-3 font-semibold text-gray-800">{formatearMoneda(d.subtotal)}</td>
                    {/* Eliminar */}
                    <td className="px-4 py-3">
                      {cargando ? (
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500" />
                          <span className="text-xs">Guardando…</span>
                        </div>
                      ) : (
                        <Boton
                          variante="peligro"
                          tamano="sm"
                          onClick={() => quitarProducto(d.id)}
                          disabled={cargando}
                        >
                          Eliminar
                        </Boton>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pie: fecha, total y botones ── */}
        <div className="border-t border-gray-200 px-5 py-4 space-y-3">
          {/* Total */}
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-gray-900">
              Total:{' '}
              <span className="text-primary-700">{formatearMoneda(total)}</span>
            </p>
            <span className="text-xs text-gray-400">
              {detalles.length} {detalles.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-3">
            <Boton
              variante="primario"
              disabled={!hayProductos || cargando}
              onClick={() => setModalCobro(true)}
            >
              Cobrar
            </Boton>
            <Boton
              variante="secundario"
              disabled={cargando}
              onClick={() => setModalCancelar(true)}
            >
              Cancelar venta
            </Boton>
          </div>
        </div>

      </div>
    </div>
  )
}
