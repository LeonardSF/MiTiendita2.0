// =============================================================================
// useProductos.ts
// Hook para gestionar el catálogo de productos contra Supabase.
// Cubre: listar, buscar, crear, editar y desactivar productos.
// Referencia: F.2, F.3, F.4, F.5, F.6, NF.7.2
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/clienteSupabase'
import type { Producto } from '@/shared/types/tipos'

// -----------------------------------------------------------------------------
// Tipos de entrada para crear / editar un producto
// El campo `codigo` y `precio_venta` son calculados — no los envía el frontend.
// -----------------------------------------------------------------------------
export interface EntradaProducto {
  nombre: string
  descripcion?: string
  costo: number
  pct_ganancia: number
  existencia: number
  minimo_existencia: number
  creado_por?: string   // UUID del admin que registra el producto
}

interface EstadoProductos {
  productos: Producto[]
  cargando: boolean
  error: string | null
}

// -----------------------------------------------------------------------------
// Hook principal
// -----------------------------------------------------------------------------
export function useProductos(terminoBusqueda = '') {
  const [estado, setEstado] = useState<EstadoProductos>({
    productos: [],
    cargando: true,
    error: null,
  })

  // ---------------------------------------------------------------------------
  // Cargar / buscar productos
  // Se re-ejecuta cuando cambia el término de búsqueda (F.4).
  // ---------------------------------------------------------------------------
  const cargar = useCallback(async () => {
    setEstado((prev) => ({ ...prev, cargando: true, error: null }))

    let consulta = supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('creado_en', { ascending: false })

    // Búsqueda por nombre o código (F.4)
    if (terminoBusqueda.trim()) {
      const termino = terminoBusqueda.trim()
      consulta = consulta.or(
        `nombre.ilike.%${termino}%,codigo.ilike.%${termino}%,descripcion.ilike.%${termino}%`,
      )
    }

    const { data, error } = await consulta

    if (error) {
      setEstado({ productos: [], cargando: false, error: error.message })
      return
    }

    setEstado({ productos: (data as Producto[]) ?? [], cargando: false, error: null })
  }, [terminoBusqueda])

  useEffect(() => {
    cargar()
  }, [cargar])

  // ---------------------------------------------------------------------------
  // Crear producto (F.2)
  // El codigo y precio_venta los genera el trigger en BD.
  // ---------------------------------------------------------------------------
  async function crearProducto(
    entrada: EntradaProducto,
  ): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('productos').insert([
      {
        nombre:           entrada.nombre.trim(),
        descripcion:      entrada.descripcion?.trim() ?? null,
        costo:            entrada.costo,
        pct_ganancia:     entrada.pct_ganancia,
        precio_venta:     0,   // el trigger lo sobreescribe
        existencia:       entrada.existencia,
        minimo_existencia: entrada.minimo_existencia,
        creado_por:       entrada.creado_por ?? null,
      },
    ])

    if (error) return { ok: false, error: error.message }
    await cargar()
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Editar producto (F.5)
  // Solo campos editables — codigo y precio_venta siguen siendo calculados.
  // ---------------------------------------------------------------------------
  async function editarProducto(
    id: string,
    cambios: Partial<EntradaProducto>,
  ): Promise<{ ok: boolean; error?: string }> {
    const payload: Record<string, unknown> = {}
    if (cambios.nombre       !== undefined) payload.nombre            = cambios.nombre.trim()
    if (cambios.descripcion  !== undefined) payload.descripcion       = cambios.descripcion?.trim() ?? null
    if (cambios.costo        !== undefined) payload.costo             = cambios.costo
    if (cambios.pct_ganancia !== undefined) payload.pct_ganancia      = cambios.pct_ganancia
    if (cambios.existencia   !== undefined) payload.existencia        = cambios.existencia
    if (cambios.minimo_existencia !== undefined) payload.minimo_existencia = cambios.minimo_existencia

    const { error } = await supabase
      .from('productos')
      .update(payload)
      .eq('id', id)

    if (error) return { ok: false, error: error.message }
    await cargar()
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Eliminar / desactivar producto (F.6)
  // Soft-delete: activo = false si tiene ventas históricas.
  // Eliminación real si nunca fue vendido.
  // ---------------------------------------------------------------------------
  async function eliminarProducto(id: string): Promise<{ ok: boolean; error?: string }> {
    // Verificar si el producto tiene ventas históricas
    const { count } = await supabase
      .from('detalle_ventas')
      .select('id', { count: 'exact', head: true })
      .eq('producto_id', id)

    if ((count ?? 0) > 0) {
      // Tiene historial — soft-delete
      const { error } = await supabase
        .from('productos')
        .update({ activo: false })
        .eq('id', id)
      if (error) return { ok: false, error: error.message }
    } else {
      // Sin historial — eliminación física
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', id)
      if (error) return { ok: false, error: error.message }
    }

    await cargar()
    return { ok: true }
  }

  return {
    productos: estado.productos,
    cargando:  estado.cargando,
    error:     estado.error,
    recargar:  cargar,
    crearProducto,
    editarProducto,
    eliminarProducto,
  }
}
