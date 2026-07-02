// =============================================================================
// useVentas.ts
// Hook para gestionar el ciclo de vida de una venta en Supabase.
// Cubre: crear venta, agregar/quitar productos, cobrar.
// Referencia: F.7, F.8, F.9, F.10, NF.7.2, NF.7.3
// =============================================================================

import { useState, useCallback } from 'react'
import { supabase } from '@/shared/lib/clienteSupabase'
import { calcularSubtotal, calcularTotalVenta } from '@/shared/lib/calculadoras'
import type { Venta, DetalleVenta, ItemCarrito, Producto } from '@/shared/types/tipos'

// -----------------------------------------------------------------------------
// Estado interno del hook
// -----------------------------------------------------------------------------
interface EstadoVenta {
  ventaActual: Venta | null
  detalles: DetalleVenta[]
  cargando: boolean
  error: string | null
}

// -----------------------------------------------------------------------------
// Hook principal
// -----------------------------------------------------------------------------
export function useVentas(cajeroId: string) {
  const [estado, setEstado] = useState<EstadoVenta>({
    ventaActual: null,
    detalles: [],
    cargando: false,
    error: null,
  })

  // ---------------------------------------------------------------------------
  // Reanudar venta abierta existente del día o crear una nueva (F.7)
  // Primero busca si ya hay una venta 'abierta' para este cajero hoy.
  // Solo crea una nueva si no existe ninguna — evita duplicados en recargas.
  // ---------------------------------------------------------------------------
  const iniciarVenta = useCallback(async (idCajero?: string): Promise<{ ok: boolean; error?: string }> => {
    const id = idCajero ?? cajeroId
    if (!id) return { ok: false, error: 'No hay usuario autenticado.' }

    setEstado((prev) => ({ ...prev, cargando: true, error: null }))

    // 1. Buscar venta abierta del día para este cajero
    const hoy = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const { data: existente } = await supabase
      .from('ventas')
      .select('*')
      .eq('cajero_id', id)
      .eq('estado', 'abierta')
      .eq('fecha', hoy)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existente) {
      // Reanudar — cargar también los detalles existentes
      const { data: detallesExistentes } = await supabase
        .from('detalle_ventas')
        .select('*')
        .eq('venta_id', existente.id)

      const detalles = (detallesExistentes as DetalleVenta[]) ?? []

      // Recalcular el total desde los detalles reales para corregir
      // posibles inconsistencias (ej: recarga con tabla vacía pero total ≠ 0)
      const totalReal = calcularTotalVenta(
        detalles.map((d) => ({ precioUnitario: d.precio_unitario, cantidad: d.cantidad })),
      )

      // Sincronizar en BD solo si el total guardado no coincide con la realidad
      if (existente.total !== totalReal) {
        await supabase
          .from('ventas')
          .update({ subtotal: totalReal, total: totalReal })
          .eq('id', existente.id)
      }

      setEstado({
        ventaActual: { ...(existente as Venta), subtotal: totalReal, total: totalReal },
        detalles,
        cargando: false,
        error: null,
      })
      return { ok: true }
    }

    // 2. No hay venta abierta — crear una nueva
    const { data, error } = await supabase
      .from('ventas')
      .insert([{ cajero_id: id, estado: 'abierta' }])
      .select()
      .single()

    if (error) {
      setEstado((prev) => ({ ...prev, cargando: false, error: error.message }))
      return { ok: false, error: error.message }
    }

    setEstado({ ventaActual: data as Venta, detalles: [], cargando: false, error: null })
    return { ok: true }
  }, [cajeroId])

  // ---------------------------------------------------------------------------
  // Agregar producto a la venta actual (F.8)
  // Valida stock en el trigger fn_validar_stock_detalle de BD.
  // Si el producto ya está, incrementa la cantidad.
  // ---------------------------------------------------------------------------
  async function agregarProducto(
    producto: Producto,
    cantidad = 1,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!estado.ventaActual) return { ok: false, error: 'No hay una venta activa.' }
    if (cantidad <= 0) return { ok: false, error: 'La cantidad debe ser mayor a cero.' }

    // Si el producto ya está en el detalle, actualizar cantidad
    const existente = estado.detalles.find((d) => d.producto_id === producto.id)

    if (existente) {
      return actualizarCantidad(existente.id, existente.cantidad + cantidad, producto.existencia)
    }

    // Nuevo detalle
    setEstado((prev) => ({ ...prev, cargando: true, error: null }))

    const subtotal = calcularSubtotal(producto.precio_venta, cantidad)

    const { data, error } = await supabase
      .from('detalle_ventas')
      .insert([
        {
          venta_id:        estado.ventaActual.id,
          producto_id:     producto.id,
          nombre_producto: producto.nombre,
          precio_unitario: producto.precio_venta,
          cantidad,
          subtotal,
        },
      ])
      .select()
      .single()

    if (error) {
      setEstado((prev) => ({ ...prev, cargando: false, error: error.message }))
      return { ok: false, error: error.message }
    }

    const nuevosDetalles = [...estado.detalles, data as DetalleVenta]
    await sincronizarTotales(nuevosDetalles)
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Actualizar cantidad de un producto en el detalle (F.8 — botón "+")
  // ---------------------------------------------------------------------------
  async function actualizarCantidad(
    detalleId: string,
    nuevaCantidad: number,
    stockDisponible: number,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!estado.ventaActual) return { ok: false, error: 'No hay una venta activa.' }
    if (nuevaCantidad <= 0) return quitarProducto(detalleId)

    if (nuevaCantidad > stockDisponible) {
      return {
        ok: false,
        error: `Solo hay ${stockDisponible} unidades disponibles.`,
      }
    }

    const detalle = estado.detalles.find((d) => d.id === detalleId)
    if (!detalle) return { ok: false, error: 'Detalle no encontrado.' }

    const nuevoSubtotal = calcularSubtotal(detalle.precio_unitario, nuevaCantidad)

    setEstado((prev) => ({ ...prev, cargando: true, error: null }))

    const { error } = await supabase
      .from('detalle_ventas')
      .update({ cantidad: nuevaCantidad, subtotal: nuevoSubtotal })
      .eq('id', detalleId)

    if (error) {
      setEstado((prev) => ({ ...prev, cargando: false, error: error.message }))
      return { ok: false, error: error.message }
    }

    const nuevosDetalles = estado.detalles.map((d) =>
      d.id === detalleId ? { ...d, cantidad: nuevaCantidad, subtotal: nuevoSubtotal } : d,
    )
    await sincronizarTotales(nuevosDetalles)
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Quitar producto de la venta (F.9)
  // Solo funciona con ventas en estado 'abierta'.
  // ---------------------------------------------------------------------------
  async function quitarProducto(detalleId: string): Promise<{ ok: boolean; error?: string }> {
    if (!estado.ventaActual) return { ok: false, error: 'No hay una venta activa.' }

    setEstado((prev) => ({ ...prev, cargando: true, error: null }))

    const { error } = await supabase
      .from('detalle_ventas')
      .delete()
      .eq('id', detalleId)

    if (error) {
      setEstado((prev) => ({ ...prev, cargando: false, error: error.message }))
      return { ok: false, error: error.message }
    }

    const nuevosDetalles = estado.detalles.filter((d) => d.id !== detalleId)
    await sincronizarTotales(nuevosDetalles)
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Cobrar venta (F.10, NF.7.2, NF.7.1, NF.7.3, IN.3, IN.6)
  // 1. Valida monto recibido >= total (NF.2.2) — también lo valida trg_cobro_1_validar en BD
  // 2. UPDATE ventas SET estado='cobrada', monto_recibido=X
  // 3. trg_cobro_1_validar calcula el cambio y valida en BD
  // 4. trg_cobro_2_descontar descuenta inventario y registra movimientos automáticamente
  // 5. Limpia el estado local para dejar listo el inicio de una nueva venta
  // ---------------------------------------------------------------------------
  async function cobrarVenta(montoRecibido: number): Promise<{ ok: boolean; error?: string }> {
    if (!estado.ventaActual) return { ok: false, error: 'No hay una venta activa.' }
    if (estado.detalles.length === 0) return { ok: false, error: 'La venta no tiene productos.' }

    const total = estado.ventaActual.total ?? 0
    if (montoRecibido < total) {
      return {
        ok: false,
        error: `El monto recibido ($${montoRecibido.toFixed(2)}) es menor al total ($${total.toFixed(2)}).`,
      }
    }

    setEstado((prev) => ({ ...prev, cargando: true, error: null }))

    const { error } = await supabase
      .from('ventas')
      .update({
        estado:          'cobrada',
        monto_recibido:  montoRecibido,
      })
      .eq('id', estado.ventaActual.id)
      .eq('estado', 'abierta') // seguridad extra: solo cobrar ventas abiertas

    if (error) {
      // Supabase devuelve el mensaje del RAISE EXCEPTION del trigger directamente
      setEstado((prev) => ({ ...prev, cargando: false, error: error.message }))
      return { ok: false, error: error.message }
    }

    // Limpiar estado — la UI iniciará una nueva venta después del cobro
    setEstado({ ventaActual: null, detalles: [], cargando: false, error: null })
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Cancelar venta abierta
  // ---------------------------------------------------------------------------
  async function cancelarVenta(): Promise<{ ok: boolean; error?: string }> {
    if (!estado.ventaActual) return { ok: false, error: 'No hay una venta activa.' }

    setEstado((prev) => ({ ...prev, cargando: true, error: null }))

    const { error } = await supabase
      .from('ventas')
      .update({ estado: 'cancelada' })
      .eq('id', estado.ventaActual.id)

    if (error) {
      setEstado((prev) => ({ ...prev, cargando: false, error: error.message }))
      return { ok: false, error: error.message }
    }

    setEstado({ ventaActual: null, detalles: [], cargando: false, error: null })
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Helpers internos
  // ---------------------------------------------------------------------------

  /**
   * Actualiza los totales de la venta en BD y en el estado local.
   * Se llama tras cada cambio en los detalles.
   * Recibe ventaId explícitamente para evitar leer estado stale del closure.
   */
  async function sincronizarTotales(detalles: DetalleVenta[], ventaId?: string) {
    const id = ventaId ?? estado.ventaActual?.id
    if (!id) return

    const total = calcularTotalVenta(
      detalles.map((d) => ({ precioUnitario: d.precio_unitario, cantidad: d.cantidad })),
    )

    await supabase
      .from('ventas')
      .update({ subtotal: total, total })
      .eq('id', id)

    setEstado((prev) => ({
      ...prev,
      detalles,
      cargando: false,
      ventaActual: prev.ventaActual
        ? { ...prev.ventaActual, subtotal: total, total }
        : null,
    }))
  }

  // Carrito derivado del estado de detalles (solo lectura, sin persistencia)
  const carrito: ItemCarrito[] = estado.detalles.map((d) => ({
    producto: {
      id:               d.producto_id,
      nombre:           d.nombre_producto,
      precio_venta:     d.precio_unitario,
    } as Producto,
    cantidad: d.cantidad,
  }))

  return {
    ventaActual:      estado.ventaActual,
    detalles:         estado.detalles,
    carrito,
    cargando:         estado.cargando,
    error:            estado.error,
    iniciarVenta,
    agregarProducto,
    actualizarCantidad,
    quitarProducto,
    cobrarVenta,
    cancelarVenta,
    limpiarError: () => setEstado((prev) => ({ ...prev, error: null })),
  }
}
