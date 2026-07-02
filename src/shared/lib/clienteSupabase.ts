// =============================================================================
// clienteSupabase.ts
// Inicialización y exportación del cliente de Supabase.
// Este archivo es el único punto de conexión con Supabase en todo el proyecto.
// Las credenciales se leen desde variables de entorno definidas en .env
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// URL del proyecto Supabase (se encuentra en: Proyecto → Settings → API)
const urlSupabase = import.meta.env.VITE_SUPABASE_URL as string

// Clave anónima pública (safe para exponer en el frontend)
// Las políticas RLS en Supabase son la segunda capa de seguridad real
const claveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Validación temprana: si faltan las variables el sistema no puede operar
if (!urlSupabase || !claveAnonima) {
  throw new Error(
    '[clienteSupabase] Faltan variables de entorno requeridas.\n' +
    'Asegúrate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env\n' +
    'Puedes copiar el archivo .env.example como punto de partida.',
  )
}

// Instancia única del cliente — se reutiliza en todo el proyecto mediante
// este import. No se debe crear otra instancia en ningún otro archivo.
export const supabase = createClient(urlSupabase, claveAnonima)
