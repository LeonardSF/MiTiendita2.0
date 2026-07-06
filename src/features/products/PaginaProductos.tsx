// =============================================================================
// PaginaProductos.tsx
// Módulo completo de gestión de productos.
// Diseño: tabs (Catálogo / Registrar / Modificar) inspirado en wireframe SRS.
// Referencia SRS: F.2, F.3, F.4, F.5, F.6, F.14, F.15, IN.2, IN.8,
//                 NF.1.3, NF.15.1, NF.15.2
// Vista móvil (F.15/IN.8): catálogo se muestra como tarjetas en lugar de tabla.
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { Search, Bell, X, Pencil, Package } from 'lucide-react'
import { useProductos, type EntradaProducto } from '@/shared/hooks/useProductos'
import { useAuth } from '@/features/auth/ContextoAuth'
import { useFooter } from '@/shared/hooks/useFooter'
import { supabase } from '@/shared/lib/clienteSupabase'
import {
  calcularPrecioVenta,
  calcularGananciaUnitaria,
  formatearMoneda,
  obtenerEstadoStock,
} from '@/shared/lib/calculadoras'
import { Boton } from '@/shared/components/Boton'
import { InsigniaStock } from '@/shared/components/Insignia'
import type { Producto, AlertaConProducto } from '@/shared/types/tipos'

// -----------------------------------------------------------------------------
// Tipos locales
// -----------------------------------------------------------------------------
type TabActiva = 'catalogo' | 'registrar' | 'modificar'

interface FormProducto {
  nombre: string
  descripcion: string
  costo: string
  pct_ganancia: string
  existencia: string
  minimo_existencia: string
}

const FORM_VACIO: FormProducto = {
  nombre: '',
  descripcion: '',
  costo: '',
  pct_ganancia: '',
  existencia: '',
  minimo_existencia: '',
}

// -----------------------------------------------------------------------------
// Validación del formulario (NF.2.2, F.2)
// -----------------------------------------------------------------------------
function validarForm(f: FormProducto): string | null {
  if (!f.nombre.trim())                        return 'El nombre del producto es obligatorio.'
  const costo = parseFloat(f.costo)
  if (isNaN(costo) || costo <= 0)             return 'El costo debe ser un número mayor a 0.'
  const pct = parseFloat(f.pct_ganancia)
  if (isNaN(pct) || pct <= 0)                return 'El porcentaje de ganancia debe ser mayor a 0.'
  const exist = parseInt(f.existencia, 10)
  if (isNaN(exist) || exist <= 0)            return 'La cantidad disponible debe ser mayor a 0.'
  const minimo = parseInt(f.minimo_existencia, 10)
  if (isNaN(minimo) || minimo < 0)           return 'El mínimo de existencia no puede ser negativo.'
  return null
}

// =============================================================================
// Subcomponente: Modal de alerta de validación (F.2)
// =============================================================================
function ModalAlertaValidacion({ mensaje, onCerrar }: { mensaje: string; onCerrar: () => void }) {
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
// Subcomponente: Formulario de producto (F.2 / F.5)
// =============================================================================
interface PropiedadesFormProducto {
  titulo: string
  initialData?: FormProducto
  codigoPreview?: string
  cargando: boolean
  errorServidor: string | null
  onGuardar: (datos: FormProducto) => void
  onCancelar: () => void
}

function FormularioProducto({
  titulo,
  initialData = FORM_VACIO,
  codigoPreview,
  cargando,
  errorServidor,
  onGuardar,
  onCancelar,
}: PropiedadesFormProducto) {
  const [form, setForm] = useState<FormProducto>(initialData)
  const [modalError, setModalError] = useState<string | null>(null)
  const [codigoSiguiente, setCodigoSiguiente] = useState<string | null>(null)

  // Para "nuevo producto" (sin codigoPreview), obtener el siguiente código estimado
  useEffect(() => {
    if (codigoPreview) return
    supabase
      .from('productos')
      .select('codigo')
      .order('creado_en', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          // Extraer número y sumar 1: "PROD-00003" → "PROD-00004"
          const match = data[0].codigo.match(/(\d+)$/)
          if (match) {
            const siguiente = parseInt(match[1], 10) + 1
            setCodigoSiguiente(`PROD-${String(siguiente).padStart(5, '0')}`)
          }
        } else {
          setCodigoSiguiente('PROD-00001')
        }
      })
  }, [codigoPreview])

  const costo = parseFloat(form.costo) || 0
  const pct   = parseFloat(form.pct_ganancia) || 0
  const precioCalculado   = calcularPrecioVenta(costo, pct)
  const gananciaCalculada = calcularGananciaUnitaria(costo, pct)

  function cambiar(campo: keyof FormProducto, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  function manejarGuardar(e: React.FormEvent) {
    e.preventDefault()
    const err = validarForm(form) ?? errorServidor
    if (err) { setModalError(err); return }
    onGuardar(form)
  }

  const claseInput =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm ' +
    'transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
  const claseLabel = 'block text-sm text-gray-600 mb-1'
  const claseReadonly =
    'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold'

  return (
    <>
      {modalError && (
        <ModalAlertaValidacion mensaje={modalError} onCerrar={() => setModalError(null)} />
      )}

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="bg-primary-600 px-6 py-4 text-center">
          <h2 className="text-base font-bold uppercase tracking-widest text-white">{titulo}</h2>
        </div>

        <form onSubmit={manejarGuardar} className="p-6">
          {/* Fila 1: Nombre/Descripción | Costo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={claseLabel}>Nombre / Descripción <span className="text-red-500">*</span></label>
              <input className={claseInput} value={form.nombre}
                onChange={(e) => cambiar('nombre', e.target.value)} />
            </div>
            <div>
              <label className={claseLabel}>Costo <span className="text-red-500">*</span></label>
              <input type="number" min="0.01" step="0.01" className={claseInput}
                value={form.costo} onChange={(e) => cambiar('costo', e.target.value)} />
            </div>
          </div>

          {/* Fila 2: % Ganancia | Cantidad disponible */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className={claseLabel}>Porcentaje de ganancia <span className="text-red-500">*</span></label>
              <input type="number" min="0.01" step="0.01" className={claseInput}
                value={form.pct_ganancia} onChange={(e) => cambiar('pct_ganancia', e.target.value)} />
            </div>
            <div>
              <label className={claseLabel}>Cantidad disponible <span className="text-red-500">*</span></label>
              <input type="number" min="1" step="1" className={claseInput}
                value={form.existencia} onChange={(e) => cambiar('existencia', e.target.value)} />
            </div>
          </div>

          {/* Fila 3: Mínimo de existencia | Precio de Venta (readonly) */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className={claseLabel}>Mínimo de existencia <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="1" className={claseInput}
                value={form.minimo_existencia} onChange={(e) => cambiar('minimo_existencia', e.target.value)} />
            </div>
            <div>
              <label className={claseLabel}>Precio de Venta</label>
              <div className={claseReadonly + ' text-primary-700'}>
                {precioCalculado > 0 ? formatearMoneda(precioCalculado) : <span className="text-gray-300">—</span>}
              </div>
            </div>
          </div>

          {/* Fila 4: Código (grande, readonly) | Ganancia (readonly) */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className={claseLabel}>Código de identificación</label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center">
                <span className="text-2xl font-bold text-gray-400 tracking-widest font-mono">
                  {codigoPreview ?? codigoSiguiente ?? '…'}
                </span>
              </div>
            </div>
            <div>
              <label className={claseLabel}>Ganancia</label>
              <div className={claseReadonly + ' text-green-700'}>
                {gananciaCalculada > 0 ? formatearMoneda(gananciaCalculada) : <span className="text-gray-300">—</span>}
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <Boton type="submit" variante="primario" tamano="lg" cargando={cargando} className="w-full">
              Guardar producto
            </Boton>
            <Boton type="button" variante="secundario" tamano="lg" onClick={onCancelar} disabled={cargando} className="w-full">
              Cancelar
            </Boton>
          </div>
        </form>
      </div>
    </>
  )
}

// =============================================================================
// Subcomponente: Panel "Modificar" — busca el producto primero (F.5)
// =============================================================================
interface PropiedadesBuscadorModificar {
  onSeleccionar: (p: Producto) => void
  onCancelar: () => void
}

function BuscadorModificar({ onSeleccionar, onCancelar }: PropiedadesBuscadorModificar) {
  const [query, setQuery] = useState('')
  const [queryActiva, setQueryActiva] = useState('')
  const { productos, cargando } = useProductos(queryActiva)

  useEffect(() => {
    const t = setTimeout(() => setQueryActiva(query), 300)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="bg-primary-600 px-6 py-4 text-center">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white">Modificar producto</h2>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500">
          Escribe el nombre o código del producto que deseas editar.
        </p>

        {/* Campo de búsqueda */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            autoFocus
            placeholder="Nombre o código de identificación…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Resultados */}
        {queryActiva && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            {cargando ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Buscando…</p>
            ) : productos.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Sin resultados para "{queryActiva}".</p>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {productos.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => onSeleccionar(p)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left
                                 hover:bg-primary-50 transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-700">{p.nombre}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.codigo}</p>
                      </div>
                      <Pencil className="h-4 w-4 text-gray-300 group-hover:text-primary-500 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Boton variante="secundario" onClick={onCancelar}>Cancelar</Boton>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Subcomponente: Modal de confirmación de eliminación (F.6)
// =============================================================================
interface PropiedadesModalEliminar {
  producto: Producto | null
  cargando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

function ModalEliminarProducto({ producto, cargando, onConfirmar, onCancelar }: PropiedadesModalEliminar) {
  if (!producto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onCancelar}>
      <div className="w-full max-w-sm rounded-2xl bg-white overflow-hidden shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="bg-red-600 px-6 py-4 text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">Eliminar producto</h2>
        </div>
        <div className="p-6">
          <p className="mb-4 text-sm text-gray-500">¿Confirmas que deseas eliminar este producto?</p>
          <ul className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100 text-sm overflow-hidden">
            <li className="flex justify-between px-4 py-2.5">
              <span className="text-gray-500">Nombre</span>
              <span className="font-semibold text-gray-800">{producto.nombre}</span>
            </li>
            <li className="flex justify-between px-4 py-2.5">
              <span className="text-gray-500">Código</span>
              <span className="font-mono text-gray-700">{producto.codigo}</span>
            </li>
            <li className="flex justify-between px-4 py-2.5">
              <span className="text-gray-500">Existencia</span>
              <span className="font-semibold text-gray-800">{producto.existencia} unidades</span>
            </li>
          </ul>
          <div className="mt-6 flex justify-end gap-3">
            <Boton variante="secundario" onClick={onCancelar} disabled={cargando}>Cancelar</Boton>
            <Boton variante="peligro" cargando={cargando} onClick={onConfirmar}>Eliminar</Boton>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Subcomponente: Modal de alertas de inventario (F.14)
// =============================================================================
interface PropiedadesModalAlertas {
  alertas: AlertaConProducto[]
  cargando: boolean
  onCerrar: () => void
}

function ModalAlertasStock({ alertas, cargando, onCerrar }: PropiedadesModalAlertas) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-2xl bg-white overflow-hidden shadow-2xl"
           onClick={(e) => e.stopPropagation()}>

        {/* Encabezado */}
        <div className="flex items-center justify-between bg-red-600 px-6 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-white" aria-hidden="true" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              Alerta de inventario
            </h2>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar alertas"
            className="rounded-lg p-1 text-white/70 hover:text-white hover:bg-red-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="max-h-80 overflow-y-auto">
          {cargando ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-gray-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-red-500" />
              <p className="text-sm">Cargando alertas…</p>
            </div>
          ) : alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-gray-400">
              <Bell className="h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">Sin alertas pendientes</p>
              <p className="text-xs text-center text-gray-400">
                Todos los productos tienen stock por encima del mínimo.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 bg-white">
              {alertas.map((a) => (
                <li key={a.id} className="px-6 py-4 bg-white text-black text-sm space-y-1">
                  <div><span className="font-semibold text-black">Nombre:</span> <span className="text-black">{a.producto.nombre}</span></div>
                  <div><span className="font-semibold text-black">Código:</span> <span className="text-black">{a.producto.codigo}</span></div>
                  <div><span className="font-semibold text-black">Existencia actual:</span> <span className="text-black">{a.producto.existencia}</span></div>
                  <div><span className="font-semibold text-black">Cantidad mínima:</span> <span className="text-black">{a.producto.minimo_existencia}</span></div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pie */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-gray-50">
          {alertas.length > 0 && (
            <p className="text-xs text-gray-400">
              {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} pendiente{alertas.length !== 1 ? 's' : ''}
            </p>
          )}
          <Boton
            variante="peligro"
            onClick={onCerrar}
            className={alertas.length === 0 ? 'w-full' : ''}
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
export function PaginaProductos() {
  const { perfil } = useAuth()
  const { setInfoFooter } = useFooter()
  const esAdmin = perfil?.rol === 'admin'

  // ── Estado de tabs y flujos ──────────────────────────────────────────────
  const [tabActiva, setTabActiva]               = useState<TabActiva>('catalogo')
  const [productoEditar, setProductoEditar]     = useState<Producto | null>(null)
  const [productoEliminar, setProductoEliminar] = useState<Producto | null>(null)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [errorOp, setErrorOp]                   = useState<string | null>(null)
  const [opCargando, setOpCargando]             = useState(false)

  // Buscador del catálogo
  const [busqueda, setBusqueda]               = useState('')
  const [busquedaActiva, setBusquedaActiva]   = useState('')

  // Alertas de stock
  const [alertas, setAlertas]                         = useState<AlertaConProducto[]>([])
  const [modalAlertasAbierto, setModalAlertasAbierto] = useState(false)
  const [alertasCargando, setAlertasCargando]         = useState(false)

  const { productos, cargando, crearProducto, editarProducto, eliminarProducto } =
    useProductos(busquedaActiva)

  // ── Debounce búsqueda 300ms ──────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setBusquedaActiva(busqueda), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  // ── En móvil forzar siempre la tab catálogo (Registrar/Modificar no disponibles) ──
  useEffect(() => {
    function manejarResize() {
      if (window.innerWidth < 768 && tabActiva !== 'catalogo') {
        cambiarTab('catalogo')
      }
    }
    window.addEventListener('resize', manejarResize)
    manejarResize() // aplicar al montar por si ya es móvil
    return () => window.removeEventListener('resize', manejarResize)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva])

  // ── Publicar info al footer ──────────────────────────────────────────────
  useEffect(() => {
    if (cargando) return
    const etiquetas: Record<TabActiva, string> = {
      catalogo:   `Catálogo · ${productos.length} producto${productos.length !== 1 ? 's' : ''}`,
      registrar:  'Registrar nuevo producto',
      modificar:  'Modificar producto',
    }
    setInfoFooter(etiquetas[tabActiva])
    return () => setInfoFooter(null)
  }, [tabActiva, productos.length, cargando, setInfoFooter])

  // ── Cargar alertas al montar (F.14) ─────────────────────────────────────
  const cargarAlertas = useCallback(async () => {
    setAlertasCargando(true)
    const { data } = await supabase
      .from('alertas')
      .select(`*, producto:productos(codigo, nombre, existencia, minimo_existencia)`)
      .eq('resuelta', false)
      .eq('tipo', 'stock_bajo')
      .order('fecha_generada', { ascending: false })
    setAlertasCargando(false)

    const activas = ((data as AlertaConProducto[]) ?? []).filter(
      (a) => a.producto.minimo_existencia > 0 && a.producto.existencia <= a.producto.minimo_existencia,
    )
    setAlertas(activas)
    if (activas.length > 0) {
      setModalAlertasAbierto(true)
    }
  }, [])

  useEffect(() => { cargarAlertas() }, [cargarAlertas])

  // ── Cambio de tab — limpia estado residual ───────────────────────────────
  function cambiarTab(tab: TabActiva) {
    setTabActiva(tab)
    setErrorOp(null)
    if (tab !== 'modificar') setProductoEditar(null)
  }

  // ── CRUD handlers ────────────────────────────────────────────────────────
  async function manejarCrear(datos: FormProducto) {
    setOpCargando(true); setErrorOp(null)
    const entrada: EntradaProducto = {
      nombre:            datos.nombre,
      descripcion:       datos.descripcion || undefined,
      costo:             parseFloat(datos.costo),
      pct_ganancia:      parseFloat(datos.pct_ganancia),
      existencia:        parseInt(datos.existencia, 10),
      minimo_existencia: parseInt(datos.minimo_existencia, 10),
      creado_por:        perfil?.id,
    }
    const res = await crearProducto(entrada)
    setOpCargando(false)
    if (!res.ok) { setErrorOp(res.error ?? 'Error al guardar.'); return }
    cambiarTab('catalogo')
    await cargarAlertas()
  }

  async function manejarEditar(datos: FormProducto) {
    if (!productoEditar) return
    setOpCargando(true); setErrorOp(null)
    const res = await editarProducto(productoEditar.id, {
      nombre:            datos.nombre,
      descripcion:       datos.descripcion || undefined,
      costo:             parseFloat(datos.costo),
      pct_ganancia:      parseFloat(datos.pct_ganancia),
      existencia:        parseInt(datos.existencia, 10),
      minimo_existencia: parseInt(datos.minimo_existencia, 10),
    })
    setOpCargando(false)
    if (!res.ok) { setErrorOp(res.error ?? 'Error al actualizar.'); return }
    setProductoEditar(null)
    cambiarTab('catalogo')
    await cargarAlertas()
  }

  async function manejarEliminar() {
    if (!productoEliminar) return
    setOpCargando(true); setErrorOp(null)
    const res = await eliminarProducto(productoEliminar.id)
    setOpCargando(false)
    if (!res.ok) { setErrorOp(res.error ?? 'Error al eliminar.'); return }
    setProductoEliminar(null)
    setProductoSeleccionado(null)
  }

  function cerrarModalAlertas() {
    setModalAlertasAbierto(false)
  }

  // Selección desde el buscador de "Modificar"
  function seleccionarParaEditar(p: Producto) {
    setProductoEditar(p)
    setErrorOp(null)
  }

  // ── Tabs disponibles según rol ───────────────────────────────────────────
  type TabDef = { id: TabActiva; label: string }
  const tabs: TabDef[] = [
    { id: 'catalogo', label: 'Catálogo' },
    ...(esAdmin ? [
      { id: 'registrar' as TabActiva, label: 'Registrar' },
      { id: 'modificar' as TabActiva, label: 'Modificar' },
    ] : []),
  ]

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-0">

      {/* Modales globales */}
      {modalAlertasAbierto && (
        <ModalAlertasStock
          alertas={alertas}
          cargando={alertasCargando}
          onCerrar={cerrarModalAlertas}
        />
      )}
      <ModalEliminarProducto
        producto={productoEliminar}
        cargando={opCargando}
        onConfirmar={manejarEliminar}
        onCancelar={() => { setProductoEliminar(null); setErrorOp(null) }}
      />

      {/* ── Tarjeta principal ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">

        {/* Encabezado con título y tabs */}
        <div className="border-b border-gray-200">
          {/* Título — estilo wireframe: fondo amarillo → usamos primary-600 del proyecto */}
          <div className="bg-primary-600 px-6 py-5 text-center">
            <h1 className="text-base font-bold uppercase tracking-widest text-white">
              Catálogo de productos
            </h1>
          </div>

          {/* Tabs de navegación (Catálogo / Registrar / Modificar) — solo escritorio */}
          {esAdmin && (
            <div className="hidden md:flex border-b border-gray-200 bg-gray-50">
              {tabs.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => cambiarTab(id)}
                  className={[
                    'flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2',
                    tabActiva === id
                      ? 'border-primary-600 text-primary-700 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Contenido de la tab activa ── */}
        <div className="p-6">

          {/* TAB: CATÁLOGO */}
          {tabActiva === 'catalogo' && (
            <div className="space-y-4">
              {/* Buscador */}
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o código…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* ── VISTA MÓVIL: tarjetas (IN.8 / NF.15.1) ── */}
              <div className="md:hidden">
                {cargando ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500" />
                    <p className="text-sm">Cargando productos…</p>
                  </div>
                ) : productos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-12">
                    <Package className="h-8 w-8 text-gray-200" />
                    <p className="text-sm text-gray-500">
                      {busquedaActiva
                        ? `Sin resultados para "${busquedaActiva}".`
                        : 'No hay productos registrados aún.'}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {productos.map((p) => {
                      const estado = obtenerEstadoStock(p.existencia, p.minimo_existencia)
                      const seleccionada = productoSeleccionado?.id === p.id
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => esAdmin && setProductoSeleccionado(seleccionada ? null : p)}
                            className={[
                              'w-full rounded-xl border bg-white p-4 text-left transition-colors shadow-sm',
                              esAdmin ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default',
                              seleccionada
                                ? 'border-primary-300 ring-2 ring-primary-200 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300',
                            ].join(' ')}
                          >
                            {/* Fila 1: nombre + insignia */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-semibold text-gray-900 leading-tight">{p.nombre}</p>
                              <InsigniaStock estado={estado} />
                            </div>
                            {/* Código */}
                            <p className="text-xs font-mono text-gray-400 mb-3">{p.codigo}</p>
                            {/* Fila 2: datos clave */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                                <p className="text-xs text-gray-400">Precio</p>
                                <p className="text-sm font-bold text-primary-700">{formatearMoneda(p.precio_venta)}</p>
                              </div>
                              <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                                <p className="text-xs text-gray-400">Existencia</p>
                                <p className={[
                                  'text-sm font-bold',
                                  estado === 'agotado' ? 'text-red-600'
                                    : estado === 'advertencia' ? 'text-amber-600'
                                    : 'text-gray-800',
                                ].join(' ')}>{p.existencia}</p>
                              </div>
                              <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                                <p className="text-xs text-gray-400">Mínimo</p>
                                <p className="text-sm font-bold text-gray-600">{p.minimo_existencia}</p>
                              </div>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* ── VISTA ESCRITORIO: tabla (F.3) ── */}
              <div className="hidden md:block rounded-xl border border-gray-200 overflow-hidden">
                <div className="max-h-[491px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50">
                        {[
                          'Código de identificación',
                          'Descripción',
                          'Costo',
                          'Precio',
                          'Existencia',
                          'Inventario mínimo',
                          'Estado',
                        ].map((h, i) => (
                          <th
                            key={i}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap border-b border-gray-200"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cargando ? (
                        <tr>
                          <td colSpan={7}>
                            <div className="flex flex-col items-center justify-center gap-3 py-12">
                              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500" />
                              <p className="text-sm text-gray-400">Cargando productos…</p>
                            </div>
                          </td>
                        </tr>
                      ) : productos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                            {busquedaActiva
                              ? `Sin resultados para "${busquedaActiva}".`
                              : 'No hay productos registrados aún.'}
                          </td>
                        </tr>
                      ) : (
                        productos.map((p) => {
                          const estado = obtenerEstadoStock(p.existencia, p.minimo_existencia)
                          const seleccionada = productoSeleccionado?.id === p.id
                          return (
                            <tr
                              key={p.id}
                              onClick={() => esAdmin && setProductoSeleccionado(seleccionada ? null : p)}
                              className={[
                                'transition-colors',
                                esAdmin ? 'cursor-pointer' : '',
                                seleccionada
                                  ? 'bg-primary-50 ring-1 ring-inset ring-primary-200'
                                  : 'hover:bg-gray-50/70',
                              ].join(' ')}
                            >
                              <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.codigo}</td>
                              <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                              <td className="px-4 py-3 text-gray-600">{formatearMoneda(p.costo)}</td>
                              <td className="px-4 py-3 text-gray-700 font-medium">{formatearMoneda(p.precio_venta)}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{p.existencia}</td>
                              <td className="px-4 py-3 text-center text-gray-500">{p.minimo_existencia}</td>
                              <td className="px-4 py-3"><InsigniaStock estado={estado} /></td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pie: contador + botones Alertas / Eliminar */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
                <span className="text-xs text-gray-400">{productos.length} producto(s)</span>
                <div className="flex items-center gap-2">
                  <Boton
                    variante="peligro"
                    tamano="sm"
                    icono={<Bell className="h-3.5 w-3.5" />}
                    onClick={async () => {
                      setModalAlertasAbierto(true)
                      await cargarAlertas()
                    }}
                  >
                    Alertas
                  </Boton>
                  {esAdmin && (
                    <>
                      {/* Eliminar solo en escritorio — acción destructiva no táctil */}
                      <Boton
                        variante="secundario"
                        tamano="sm"
                        className="hidden md:inline-flex"
                        disabled={!productoSeleccionado}
                        onClick={() => {
                          if (productoSeleccionado) {
                            setProductoEliminar(productoSeleccionado)
                            setErrorOp(null)
                          }
                        }}
                      >
                        Eliminar
                      </Boton>
                      {/* Eliminar en móvil — solo aparece cuando hay selección */}
                      {productoSeleccionado && (
                        <Boton
                          variante="secundario"
                          tamano="sm"
                          className="md:hidden"
                          onClick={() => {
                            setProductoEliminar(productoSeleccionado)
                            setErrorOp(null)
                          }}
                        >
                          Eliminar
                        </Boton>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Error de operación en catálogo */}
              {errorOp && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorOp}
                </div>
              )}
            </div>
          )}

          {/* TAB: REGISTRAR */}
          {tabActiva === 'registrar' && (
            <FormularioProducto
              titulo="Nuevo producto"
              cargando={opCargando}
              errorServidor={errorOp}
              onGuardar={manejarCrear}
              onCancelar={() => cambiarTab('catalogo')}
            />          )}

          {/* TAB: MODIFICAR */}
          {tabActiva === 'modificar' && (
            productoEditar ? (
              <FormularioProducto
                titulo="Modificar producto"
                initialData={{
                  nombre:            productoEditar.nombre,
                  descripcion:       productoEditar.descripcion ?? '',
                  costo:             String(productoEditar.costo),
                  pct_ganancia:      String(productoEditar.pct_ganancia),
                  existencia:        String(productoEditar.existencia),
                  minimo_existencia: String(productoEditar.minimo_existencia),
                }}
                codigoPreview={productoEditar.codigo}
                cargando={opCargando}
                errorServidor={errorOp}
                onGuardar={manejarEditar}
                onCancelar={() => { setProductoEditar(null); setErrorOp(null) }}
              />
            ) : (
              <BuscadorModificar
                onSeleccionar={seleccionarParaEditar}
                onCancelar={() => cambiarTab('catalogo')}
              />
            )
          )}

        </div>
      </div>
    </div>
  )
}
