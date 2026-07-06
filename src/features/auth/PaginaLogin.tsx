// =============================================================================
// PaginaLogin.tsx
// Pantalla de inicio de sesión.
//
// Especificaciones aplicadas del SRS:
//   F.16    — Campos: correo y contraseña. Botones: Ingresar y Limpiar.
//             Sin logotipo (tachado en SRS, ver D-09).
//             Centrada en el área de trabajo.
//   NF.16.1 — Bloqueo visual 5 minutos tras 3 intentos fallidos (solo cliente, D-05).
//   NF.16.1 — Mensaje genérico "credenciales incorrectas" sin indicar qué campo falló.
//   NF.16.1 — Campo contraseña oculto con opción de mostrar/ocultar.
//   F.16    — Redirige al módulo principal según perfil al autenticar correctamente.
// =============================================================================

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/shared/lib/clienteSupabase'
import { Modal } from '@/shared/components/Modal'
import { Eye, EyeOff } from 'lucide-react'

// Detecta si el dispositivo es móvil o tablet
function esDispositivoMovil(): boolean {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  )
}

// Constantes del mecanismo de bloqueo (D-05 / NF.16.1)
const MAXIMO_INTENTOS = 3
const SEGUNDOS_BLOQUEO = 30  // 30 segundos

export function PaginaLogin() {
  const navegar = useNavigate()

  // Siempre dirigir a "Ventas" al iniciar sesión (CP-143)
  const destino = '/ventas'

  // ── Campos del formulario ──────────────────────────────────────────────────
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrarContrasena, setMostrarContrasena] = useState(false)

  // ── Estado de la petición ──────────────────────────────────────────────────
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)

  // ── Mecanismo de bloqueo por intentos fallidos (solo cliente, D-05) ────────
  const [intentosFallidos, setIntentosFallidos] = useState(0)
  const [bloqueado, setBloqueado] = useState(false)
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Inicia el contador regresivo de bloqueo
  function iniciarBloqueo() {
    setBloqueado(true)
    setSegundosRestantes(SEGUNDOS_BLOQUEO)

    intervaloRef.current = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          // Tiempo agotado — desbloquear y reiniciar intentos
          clearInterval(intervaloRef.current!)
          setBloqueado(false)
          setIntentosFallidos(0)
          setError(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Limpiar intervalo al desmontar el componente
  useEffect(() => {
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current)
    }
  }, [])

  // Formatea segundos como MM:SS para el contador visible
  function formatearTiempo(segundos: number): string {
    const m = Math.floor(segundos / 60)
    const s = segundos % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // ── Limpiar formulario ─────────────────────────────────────────────────────
  function limpiarFormulario() {
    setCorreo('')
    setContrasena('')
    setError(null)
  }

  // ── Envío del formulario ───────────────────────────────────────────────────
  async function manejarEnvio(e: React.FormEvent) {
    e.preventDefault()
    if (bloqueado || cargando) return

    // Validación: no permitir campos vacíos (F.16)
    if (!correo.trim() || !contrasena.trim()) {
      setError('Completa todos los campos para continuar.')
      return
    }

    setError(null)
    setCargando(true)

    const { error: errorAuth } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: contrasena,
    })

    setCargando(false)


    // Error de autenticación — manejar intentos fallidos y posibles bloqueos (D-05 / NF.16.1)
    if (errorAuth) {
      const nuevosIntentos = intentosFallidos + 1
      setIntentosFallidos(nuevosIntentos)

      if (nuevosIntentos >= MAXIMO_INTENTOS) {
        // Bloquear por 5 minutos (NF.16.1)
        iniciarBloqueo()
        setError(
          `Acceso bloqueado por demasiados intentos. Espera ${formatearTiempo(SEGUNDOS_BLOQUEO)}.`,
        )
      } else {
        // Mensaje genérico sin revelar qué campo falló (NF.16.1 / F.16)
        setError(
          `Credenciales incorrectas. Intento ${nuevosIntentos} de ${MAXIMO_INTENTOS}.`,
        )
      }
      setModalAbierto(true)
      return
    }

    // Autenticación exitosa — verificar si es cajero en móvil
    if (esDispositivoMovil()) {
      const { data: perfilData } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
        .single()

      if (perfilData?.rol === 'cajero') {
        // Cerrar sesión inmediatamente y bloquear el acceso
        await supabase.auth.signOut()
        setError('El acceso desde dispositivos móviles no está disponible para cajeros.')
        setModalAbierto(true)
        return
      }
    }

    // Navegar al destino
    navegar(destino, { replace: true })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">

      {/* Modal de error */}
      <Modal
        abierto={modalAbierto}
        titulo="Acceso no permitido"
        alCerrar={() => setModalAbierto(false)}
      >
        <p>{error}</p>
        {bloqueado && (
          <p className="mt-2 font-semibold text-red-500">
            Tiempo restante: {formatearTiempo(segundosRestantes)}
          </p>
        )}
      </Modal>

      {/* Tarjeta centrada (F.16 — centrada en el área de trabajo) */}
      <div className="w-full max-w-sm rounded-2xl bg-white px-8 py-10 shadow-md">

        {/* Encabezado — con logo centrado */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex items-center gap-2 shrink-0 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shopping-bag h-4 w-4"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            </div>
            <span className="text-base font-bold text-gray-900">Mi Tiendita</span>
          </div>
          <p className="text-sm text-gray-500">Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={manejarEnvio} noValidate className="flex flex-col gap-5">

          {/* Campo: correo electrónico */}
          <div>
            <label
              htmlFor="correo"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Correo electrónico
            </label>
            <input
              id="correo"
              type="email"
              autoComplete="email"
              required
              disabled={bloqueado || cargando}
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                         placeholder-gray-400 transition-colors
                         focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200
                         disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>





          {/* Campo: contraseña de visibilidad (NF.16.1) */}
          <div>
            <label
              htmlFor="contrasena"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="contrasena"
                type={mostrarContrasena ? 'text' : 'password'}
                autoComplete="current-password"
                required
                disabled={bloqueado || cargando}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm
                           placeholder-gray-400 transition-colors
                           focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="button"
                onClick={() => setMostrarContrasena((v) => !v)}
                disabled={bloqueado || cargando}
                aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                           hover:text-gray-600 disabled:cursor-not-allowed"
              >
                {mostrarContrasena ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>




          

          {/* Contador regresivo durante el bloqueo */}
          {bloqueado && (
            <p className="text-center text-sm font-semibold text-red-500">
              Tiempo restante: {formatearTiempo(segundosRestantes)}
            </p>
          )}

          {/* Botones: Ingresar (primario) y Limpiar (secundario) — F.16 */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={bloqueado || cargando}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium
                         text-white transition-colors hover:bg-primary-700
                         focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-primary-500 focus-visible:ring-offset-2
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cargando ? 'Verificando…' : 'Ingresar'}
            </button>

            <button
              type="button"
              onClick={limpiarFormulario}
              disabled={bloqueado || cargando}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5
                         text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50
                         focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-gray-400 focus-visible:ring-offset-2
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpiar
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
