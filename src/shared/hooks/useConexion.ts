// =============================================================================
// useConexion.ts
// Monitorea el estado de conexión a internet y a Supabase.
// Referencia: NF.7.3 — informar al usuario sin cerrar el sistema ante fallos.
// =============================================================================

import { useState, useEffect } from 'react'
import { supabase } from '@/shared/lib/clienteSupabase'

export type EstadoConexion = 'conectado' | 'sin-internet' | 'error-servidor'

export function useConexion() {
  const [estado, setEstado] = useState<EstadoConexion>('conectado')

  useEffect(() => {
    // Escuchar cambios de conectividad del navegador
    function alConectar() {
      setEstado('conectado')
    }
    function alDesconectar() {
      setEstado('sin-internet')
    }

    window.addEventListener('online',  alConectar)
    window.addEventListener('offline', alDesconectar)

    // Estado inicial
    if (!navigator.onLine) setEstado('sin-internet')

    return () => {
      window.removeEventListener('online',  alConectar)
      window.removeEventListener('offline', alDesconectar)
    }
  }, [])

  // Verificación activa contra Supabase (cada 30 segundos si hay internet)
  useEffect(() => {
    if (estado === 'sin-internet') return

    async function verificarServidor() {
      try {
        const { error } = await supabase
          .from('usuarios')
          .select('id', { count: 'exact', head: true })

        if (error) {
          setEstado('error-servidor')
        } else if (estado === 'error-servidor') {
          setEstado('conectado')
        }
      } catch {
        setEstado('error-servidor')
      }
    }

    verificarServidor()
    const intervalo = setInterval(verificarServidor, 30_000)
    return () => clearInterval(intervalo)
  }, [estado])

  const mensajes: Record<EstadoConexion, string> = {
    'conectado':       '',
    'sin-internet':    'Sin conexión a internet. Verifica tu red.',
    'error-servidor':  'No se puede conectar al servidor. Reintentando…',
  }

  return {
    estado,
    hayConexion:   estado === 'conectado',
    mensaje:       mensajes[estado],
  }
}
