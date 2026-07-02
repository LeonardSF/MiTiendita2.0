// =============================================================================
// PaginaCorteCaja.tsx — Corte de Caja (F.11) y Corte del Día (F.12)
// Diferencias clave:
//   Cajero → ventas solo del usuario actual, muestra correo, período de turno
//   Día    → todas las ventas del día, desglose por cajero, sin filtro de usuario
// Referencia SRS: F.11, F.12, IN.4, NF.7.2, NF.1.4, IN.6
// =============================================================================

import { useState, useCallback, useEffect } from 'react'
import {
  Scissors, CalendarDays, Clock, TrendingUp, Wallet,
  ShoppingCart, CheckCircle2, X, AlertCircle, User, Mail,
} from 'lucide-react'
import { supabase } from '@/shared/lib/clienteSupabase'
import { useAuth } from '@/features/auth/ContextoAuth'
import { useFooter } from '@/shared/hooks/useFooter'
import { formatearMoneda } from '@/shared/lib/calculadoras'
import { Boton } from '@/shared/components/Boton'

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------
type TipoCorte = 'cajero' | 'dia'

interface ResultadoCorte {
  total_ventas:      number
  numero_ventas:     number
  ganancia_estimada: number
  efectivo_esperado: number
}

interface ResumenCajero {
  cajero_id:   string
  nombre:      string
  email:       string
  num_ventas:  number
  total:       number
}

interface EstadoCorte {
  tipo:           TipoCorte
  calculado:      ResultadoCorte | null
  cajeros:        ResumenCajero[]   // solo corte de día
  horaInicio:     string
  horaFin:        string
  cargando:       boolean
  error:          string | null
  guardado:       boolean
}

function horaLocal()  { return new Date().toLocaleTimeString('en-GB') }
function fechaHoyISO(){ return new Date().toISOString().slice(0, 10) }

function formatearHora(h: string): string {
  if (!h) return '—'
  const p = h.split(':')
  return `${p[0]}:${p[1]} h`
}

function fechaHoyLegible(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// =============================================================================
// Modal de confirmación
// =============================================================================
interface PropiedadesModalConfirmar {
  tipo: TipoCorte; resultado: ResultadoCorte
  horaInicio: string; horaFin: string
  cargando: boolean; onConfirmar: () => void; onCancelar: () => void
}

function ModalConfirmarCorte({ tipo, resultado, horaInicio, horaFin, cargando, onConfirmar, onCancelar }: PropiedadesModalConfirmar) {
  const esDia = tipo === 'dia'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onCancelar}>
      <div className="w-full max-w-sm rounded-2xl bg-white overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className={`px-6 py-4 text-center ${esDia ? 'bg-amber-500' : 'bg-primary-600'}`}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">
            Confirmar {esDia ? 'Corte del Día' : 'Corte de Caja'}
          </h2>
        </div>
        <div className="px-6 pt-5 pb-2 space-y-3">
          <p className="text-sm text-gray-500 text-center">¿Confirmas guardar este corte? Esta acción no se puede deshacer.</p>
          <ul className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100 overflow-hidden text-sm">
            <li className="flex justify-between px-4 py-2.5">
              <span className="text-gray-500">Tipo</span>
              <span className="font-semibold text-gray-800">{esDia ? 'Cierre del día' : 'Turno de cajero'}</span>
            </li>
            <li className="flex justify-between px-4 py-2.5">
              <span className="text-gray-500">Período</span>
              <span className="font-mono text-gray-700">{formatearHora(horaInicio)} → {formatearHora(horaFin)}</span>
            </li>
            <li className="flex justify-between px-4 py-2.5">
              <span className="text-gray-500">Ventas totales</span>
              <span className="font-bold text-primary-700">{formatearMoneda(resultado.total_ventas)}</span>
            </li>
            <li className="flex justify-between px-4 py-2.5">
              <span className="text-gray-500">Núm. ventas</span>
              <span className="font-semibold text-gray-800">{resultado.numero_ventas}</span>
            </li>
          </ul>
        </div>
        <div className="px-6 pb-6 flex gap-3 mt-2">
          <Boton variante="secundario" className="flex-1" onClick={onCancelar} disabled={cargando}>Cancelar</Boton>
          <Boton variante="primario"   className="flex-1" cargando={cargando} onClick={onConfirmar}>Guardar corte</Boton>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Tarjeta de métrica
// =============================================================================
interface PropiedadesTarjeta {
  icono: React.ReactNode; etiqueta: string; valor: string
  subvalor?: string; color?: 'primary' | 'green' | 'amber' | 'gray'
}

function TarjetaMetrica({ icono, etiqueta, valor, subvalor, color = 'primary' }: PropiedadesTarjeta) {
  const col = {
    primary: { c: 'bg-primary-50 border-primary-100', t: 'text-primary-700', i: 'text-primary-500' },
    green:   { c: 'bg-green-50  border-green-100',  t: 'text-green-700',  i: 'text-green-500' },
    amber:   { c: 'bg-amber-50  border-amber-100',  t: 'text-amber-700',  i: 'text-amber-500' },
    gray:    { c: 'bg-gray-50   border-gray-200',   t: 'text-gray-700',   i: 'text-gray-400' },
  }[color]
  return (
    <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${col.c}`}>
      <span className={`shrink-0 ${col.i}`}>{icono}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">{etiqueta}</p>
        <p className={`text-xl font-bold truncate ${col.t}`}>{valor}</p>
        {subvalor && <p className="text-xs text-gray-400 mt-0.5">{subvalor}</p>}
      </div>
    </div>
  )
}

// =============================================================================
// Componente principal
// =============================================================================
export function PaginaCorteCaja() {
  const { perfil } = useAuth()
  const { setInfoFooter } = useFooter()
  const esAdmin  = perfil?.rol === 'admin'
  const fechaHoy = fechaHoyISO()

  const [modoActivo, setModoActivo] = useState<TipoCorte>('cajero')
  const [estado, setEstado] = useState<EstadoCorte>({
    tipo: 'cajero', calculado: null, cajeros: [],
    horaInicio: '', horaFin: '', cargando: false, error: null, guardado: false,
  })
  const [modalConfirmar, setModalConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // ── Calcular corte ────────────────────────────────────────────────────────
  const calcularCorte = useCallback(async (tipo: TipoCorte) => {
    if (!perfil) return
    setModoActivo(tipo)
    setEstado({ tipo, calculado: null, cajeros: [], horaInicio: '', horaFin: '', cargando: true, error: null, guardado: false })

    const horaIni = '00:00:00'
    const horaFin = horaLocal()
    let resultado: ResultadoCorte | null = null
    let cajeros:   ResumenCajero[]       = []
    let errorMsg:  string | null         = null

    if (tipo === 'cajero') {
      // F.11 — solo ventas del cajero actual
      const { data, error } = await supabase.rpc('fn_calcular_corte_cajero', {
        p_cajero_id: perfil.id, p_fecha: fechaHoy,
        p_hora_inicio: horaIni, p_hora_fin: horaFin,
      })
      if (error) { errorMsg = error.message }
      else {
        const fila = Array.isArray(data) ? data[0] : data
        resultado = fila ?? { total_ventas: 0, numero_ventas: 0, ganancia_estimada: 0, efectivo_esperado: 0 }
      }
    } else {
      // F.12 — todas las ventas del día + desglose por cajero
      const [rpcRes, ventasRes] = await Promise.all([
        supabase.rpc('fn_calcular_corte_dia', { p_fecha: fechaHoy }),
        supabase
          .from('ventas')
          .select('cajero_id, total, usuarios(nombre, email)')
          .eq('fecha', fechaHoy)
          .eq('estado', 'cobrada'),
      ])
      if (rpcRes.error) { errorMsg = rpcRes.error.message }
      else {
        const fila = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data
        resultado = fila ?? { total_ventas: 0, numero_ventas: 0, ganancia_estimada: 0, efectivo_esperado: 0 }
      }
      // Agrupar por cajero para el desglose
      const mapa: Record<string, ResumenCajero> = {}
      for (const v of (ventasRes.data ?? []) as unknown as Array<{ cajero_id: string; total: number; usuarios: { nombre: string; email: string } | null }>) {
        if (!mapa[v.cajero_id]) {
          mapa[v.cajero_id] = {
            cajero_id: v.cajero_id,
            nombre:    v.usuarios?.nombre ?? 'Sin nombre',
            email:     v.usuarios?.email  ?? '—',
            num_ventas: 0,
            total: 0,
          }
        }
        mapa[v.cajero_id].num_ventas += 1
        mapa[v.cajero_id].total     += Number(v.total)
      }
      cajeros = Object.values(mapa).sort((a, b) => b.total - a.total)
    }

    setEstado({ tipo, calculado: resultado, cajeros, horaInicio: horaIni, horaFin: horaFin, cargando: false, error: errorMsg, guardado: false })
  }, [perfil, fechaHoy])

  // ── Guardar corte ─────────────────────────────────────────────────────────
  async function guardarCorte() {
    if (!perfil || !estado.calculado) return
    setGuardando(true)
    const { error } = await supabase.from('cortes_caja').insert([{
      tipo:              estado.tipo,
      cajero_id:         estado.tipo === 'cajero' ? perfil.id : null,
      fecha:             fechaHoy,
      hora_inicio:       estado.horaInicio,
      hora_fin:          estado.horaFin,
      total_ventas:      estado.calculado.total_ventas,
      numero_ventas:     estado.calculado.numero_ventas,
      ganancia_estimada: estado.calculado.ganancia_estimada,
      efectivo_esperado: estado.calculado.efectivo_esperado,
      realizado_por:     perfil.id,
    }])
    setGuardando(false)
    setModalConfirmar(false)
    if (error) { setEstado((prev) => ({ ...prev, error: error.message })); return }
    setEstado((prev) => ({ ...prev, guardado: true, error: null }))
  }

  const { calculado, cajeros, cargando, error, guardado, horaInicio, horaFin } = estado
  const sinVentas = calculado !== null && calculado.numero_ventas === 0
  const esDia     = modoActivo === 'dia'

  // Publicar info al footer global
  useEffect(() => {
    if (guardado && calculado) {
      setInfoFooter(
        `Corte guardado · ${esDia ? 'Día' : 'Cajero'} · ${formatearMoneda(calculado.total_ventas)} · ${calculado.numero_ventas} venta${calculado.numero_ventas !== 1 ? 's' : ''}`,
      )
    } else if (calculado && !cargando) {
      setInfoFooter(
        `${esDia ? 'Corte del día' : 'Corte de caja'} · ${formatearMoneda(calculado.total_ventas)} · ${calculado.numero_ventas} venta${calculado.numero_ventas !== 1 ? 's' : ''}`,
      )
    } else {
      setInfoFooter('Selecciona un tipo de corte para calcular')
    }
    return () => setInfoFooter(null)
  }, [calculado, guardado, cargando, esDia, setInfoFooter])

  return (
    <div className="mx-auto max-w-3xl space-y-4">

      {modalConfirmar && calculado && (
        <ModalConfirmarCorte tipo={modoActivo} resultado={calculado}
          horaInicio={horaInicio} horaFin={horaFin} cargando={guardando}
          onConfirmar={guardarCorte} onCancelar={() => setModalConfirmar(false)} />
      )}

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">

        {/* Encabezado — color diferente por tipo */}
        <div className={`px-6 py-5 text-center ${esDia && calculado ? 'bg-amber-500' : 'bg-primary-600'}`}>
          <h1 className="text-base font-bold uppercase tracking-widest text-white">
            {esDia && calculado ? 'Corte del Día' : 'Corte de Caja'}
          </h1>
        </div>

        {/* Selector de tipo + contexto del usuario */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1.5">
            {/* Cajero: muestra nombre + correo (F.11) */}
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <User className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="font-medium">{perfil?.nombre ?? '—'}</span>
              <span className="text-xs text-gray-400 capitalize">· {perfil?.rol}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Mail className="h-3.5 w-3.5 text-gray-300 shrink-0" />
              <span>{perfil?.email ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="capitalize">{fechaHoyLegible()}</span>
            </div>
          </div>
          <div className="flex gap-2 self-start">
            <Boton
              variante={modoActivo === 'cajero' && calculado !== null ? 'primario' : 'secundario'}
              icono={<Scissors className="h-4 w-4" />}
              onClick={() => calcularCorte('cajero')} disabled={cargando}
            >
              Corte de Caja
            </Boton>
            {esAdmin && (
              <Boton
                variante={modoActivo === 'dia' && calculado !== null ? 'primario' : 'secundario'}
                icono={<CalendarDays className="h-4 w-4" />}
                onClick={() => calcularCorte('dia')} disabled={cargando}
              >
                Corte del Día
              </Boton>
            )}
          </div>
        </div>

        {/* Área de resultados */}
        <div className="px-6 py-6">

          {/* Estado inicial */}
          {!cargando && !calculado && !error && (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-gray-400">
              <Scissors className="h-10 w-10 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Selecciona un tipo de corte para calcular</p>
              <p className="text-xs text-center text-gray-400 max-w-xs">
                <strong>Corte de Caja</strong> muestra tus ventas del turno.
                {esAdmin && <> <strong>Corte del Día</strong> consolida todas las ventas del día.</>}
              </p>
            </div>
          )}

          {cargando && (
            <div className="flex flex-col items-center justify-center gap-3 py-14">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500" />
              <p className="text-sm text-gray-400">Calculando corte…</p>
            </div>
          )}

          {error && !cargando && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Error al calcular el corte</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
              <button onClick={() => setEstado((prev) => ({ ...prev, error: null }))} className="ml-auto text-red-400 hover:text-red-600" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── COMPROBANTE POST-GUARDADO — reemplaza los resultados ── */}
          {guardado && calculado && !cargando && (
            <div className="space-y-5">
              {/* Banner de éxito */}
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-green-700">Corte guardado correctamente</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Registrado el {fechaHoyLegible()} — {formatearHora(horaInicio)} → {formatearHora(horaFin)}
                  </p>
                </div>
              </div>

              {/* Comprobante con los datos guardados */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className={`px-5 py-3 ${esDia ? 'bg-amber-50 border-b border-amber-100' : 'bg-primary-50 border-b border-primary-100'}`}>
                  <p className={`text-xs font-bold uppercase tracking-widest ${esDia ? 'text-amber-700' : 'text-primary-700'}`}>
                    Resumen del corte registrado
                  </p>
                </div>
                <ul className="divide-y divide-gray-100 text-sm">
                  <li className="flex justify-between px-5 py-3">
                    <span className="text-gray-500">Tipo de corte</span>
                    <span className="font-semibold text-gray-800">{esDia ? 'Cierre del día' : 'Turno de cajero'}</span>
                  </li>
                  {!esDia && (
                    <li className="flex justify-between px-5 py-3">
                      <span className="text-gray-500">Cajero</span>
                      <span className="font-semibold text-gray-800">{perfil?.nombre}</span>
                    </li>
                  )}
                  <li className="flex justify-between px-5 py-3">
                    <span className="text-gray-500">Período</span>
                    <span className="font-mono text-gray-700">{formatearHora(horaInicio)} → {formatearHora(horaFin)}</span>
                  </li>
                  <li className="flex justify-between px-5 py-3">
                    <span className="text-gray-500">{esDia ? 'Ventas totales del día' : 'Mis ventas del turno'}</span>
                    <span className="font-bold text-primary-700">{formatearMoneda(calculado.total_ventas)}</span>
                  </li>
                  <li className="flex justify-between px-5 py-3">
                    <span className="text-gray-500">{esDia ? 'Número de transacciones' : 'Ventas cobradas'}</span>
                    <span className="font-semibold text-gray-800">{calculado.numero_ventas}</span>
                  </li>
                  <li className="flex justify-between px-5 py-3">
                    <span className="text-gray-500">{esDia ? 'Ganancia total del día' : 'Mi ganancia estimada'}</span>
                    <span className="font-semibold text-green-700">{formatearMoneda(calculado.ganancia_estimada)}</span>
                  </li>
                  <li className="flex justify-between px-5 py-3">
                    <span className="text-gray-500">{esDia ? 'Efectivo esperado en caja' : 'Efectivo en mi caja'}</span>
                    <span className="font-semibold text-amber-700">{formatearMoneda(calculado.efectivo_esperado)}</span>
                  </li>
                  {esDia && cajeros.length > 0 && (
                    <li className="flex justify-between px-5 py-3">
                      <span className="text-gray-500">Cajeros con ventas</span>
                      <span className="font-semibold text-gray-800">{cajeros.length}</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Botones para hacer otro corte */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Boton variante="secundario" onClick={() => calcularCorte('cajero')}>
                  Nuevo Corte de Caja
                </Boton>
                {esAdmin && (
                  <Boton variante="secundario" onClick={() => calcularCorte('dia')}>
                    Nuevo corte del día
                  </Boton>
                )}
              </div>
            </div>
          )}

          {calculado && !cargando && !guardado && (
            <div className="space-y-5">

              {/* Período */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                <span>Período: <span className="font-mono text-gray-600">{formatearHora(horaInicio)} → {formatearHora(horaFin)}</span></span>
                <span className={`ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  esDia
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-primary-200 bg-primary-50 text-primary-700'
                }`}>
                  {esDia ? 'Día completo' : 'Turno de cajero'}
                </span>
              </div>

              {sinVentas ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 py-10">
                  <ShoppingCart className="h-8 w-8 text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">Sin ventas en este período</p>
                  <p className="text-xs text-gray-400">No se registraron ventas cobradas {esDia ? 'hoy' : 'en tu turno'}.</p>
                </div>
              ) : (
                <>
                  {/* ── Corte de Caja: F.11 ── tarjetas enfocadas en el turno personal */}
                  {!esDia && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TarjetaMetrica icono={<ShoppingCart className="h-6 w-6" />}
                        etiqueta="Mis ventas del turno" valor={formatearMoneda(calculado.total_ventas)}
                        subvalor={`${calculado.numero_ventas} venta${calculado.numero_ventas !== 1 ? 's' : ''} cobrada${calculado.numero_ventas !== 1 ? 's' : ''}`}
                        color="primary" />
                      <TarjetaMetrica icono={<TrendingUp className="h-6 w-6" />}
                        etiqueta="Mi ganancia estimada" valor={formatearMoneda(calculado.ganancia_estimada)}
                        subvalor="Estimado según costos de productos" color="green" />
                      <TarjetaMetrica icono={<Wallet className="h-6 w-6" />}
                        etiqueta="Efectivo en mi caja" valor={formatearMoneda(calculado.efectivo_esperado)}
                        subvalor="Suma de mis cobros del turno" color="amber" />
                      <TarjetaMetrica icono={<Clock className="h-6 w-6" />}
                        etiqueta="Duración del turno" valor={`${formatearHora(horaInicio)} → ${formatearHora(horaFin)}`}
                        subvalor="Hora de inicio / hora de corte" color="gray" />
                    </div>
                  )}

                  {/* ── CORTE DEL DÍA: F.12 ── tarjetas del total + desglose por cajero */}
                  {esDia && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <TarjetaMetrica icono={<ShoppingCart className="h-6 w-6" />}
                          etiqueta="Total del día" valor={formatearMoneda(calculado.total_ventas)}
                          subvalor={`${calculado.numero_ventas} venta${calculado.numero_ventas !== 1 ? 's' : ''} en total`}
                          color="primary" />
                        <TarjetaMetrica icono={<TrendingUp className="h-6 w-6" />}
                          etiqueta="Ganancia total del día" valor={formatearMoneda(calculado.ganancia_estimada)}
                          color="green" />
                        <TarjetaMetrica icono={<Wallet className="h-6 w-6" />}
                          etiqueta="Efectivo esperado en caja" valor={formatearMoneda(calculado.efectivo_esperado)}
                          subvalor="Suma de todos los cobros del día" color="amber" />
                      </div>

                      {/* Desglose por cajero */}
                      {cajeros.length > 0 && (
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Desglose por cajero</p>
                          </div>
                          <ul className="divide-y divide-gray-100">
                            {cajeros.map((c) => (
                              <li key={c.cajero_id} className="flex items-center justify-between gap-4 px-4 py-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                                    {c.nombre.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{c.nombre}</p>
                                    <p className="text-xs text-gray-400 truncate">{c.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6 shrink-0 text-right">
                                  <div>
                                    <p className="text-xs text-gray-400">Ventas</p>
                                    <p className="text-sm font-semibold text-gray-700">{c.num_ventas}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-400">Total</p>
                                    <p className="text-sm font-bold text-primary-700">{formatearMoneda(c.total)}</p>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Acciones */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Boton variante="primario" className="w-full sm:w-auto"
                  disabled={sinVentas} onClick={() => setModalConfirmar(true)}>
                  Guardar corte
                </Boton>
                <Boton variante="secundario" className="w-full sm:w-auto"
                  onClick={() => calcularCorte(modoActivo)}>
                  Recalcular
                </Boton>
                {sinVentas && <p className="text-xs text-gray-400">No hay ventas que guardar.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
