// =============================================================================
// calculadoras.ts
// Funciones de cálculo centralizadas del sistema Mi Tiendita.
// Toda regla de negocio numérica vive aquí — no se duplica en componentes.
// Referencia: NF.1.6 — cálculos centralizados; D-03 — precio desde costo.
// =============================================================================

// -----------------------------------------------------------------------------
// Productos
// -----------------------------------------------------------------------------

/**
 * Calcula el precio de venta a partir del costo y el porcentaje de ganancia.
 * Fórmula: costo * (1 + pctGanancia / 100), redondeado a 2 decimales.
 * Referencia: D-03 — el precio SIEMPRE se deriva del costo, nunca se edita directo.
 */
export function calcularPrecioVenta(costo: number, pctGanancia: number): number {
  if (costo < 0 || pctGanancia < 0) return 0
  return Math.round(costo * (1 + pctGanancia / 100) * 100) / 100
}

/**
 * Calcula la ganancia estimada por unidad.
 * Fórmula: precio_venta - costo
 */
export function calcularGananciaUnitaria(costo: number, pctGanancia: number): number {
  return Math.round((calcularPrecioVenta(costo, pctGanancia) - costo) * 100) / 100
}

// -----------------------------------------------------------------------------
// Ventas
// -----------------------------------------------------------------------------

/**
 * Calcula el subtotal de una línea de venta.
 * Fórmula: precioUnitario * cantidad
 */
export function calcularSubtotal(precioUnitario: number, cantidad: number): number {
  if (cantidad <= 0 || precioUnitario < 0) return 0
  return Math.round(precioUnitario * cantidad * 100) / 100
}

/**
 * Calcula el total de una venta sumando todos los subtotales.
 * Acepta un arreglo de { precioUnitario, cantidad }.
 */
export function calcularTotalVenta(
  lineas: Array<{ precioUnitario: number; cantidad: number }>,
): number {
  return lineas.reduce((acc, l) => acc + calcularSubtotal(l.precioUnitario, l.cantidad), 0)
}

/**
 * Calcula el cambio a devolver al cliente.
 * Retorna null si el monto recibido es menor al total (cobro inválido).
 * Referencia: F.10, NF.2.2 — no permitir cobro insuficiente.
 */
export function calcularCambio(montoRecibido: number, total: number): number | null {
  if (montoRecibido < total) return null
  return Math.round((montoRecibido - total) * 100) / 100
}

/**
 * Valida que el monto recibido sea suficiente para cubrir el total.
 * Referencia: NF.2.2 — sin cobros con monto recibido < total.
 */
export function esCobradoValido(montoRecibido: number, total: number): boolean {
  return montoRecibido >= total
}

// -----------------------------------------------------------------------------
// Cortes de caja
// -----------------------------------------------------------------------------

/**
 * Calcula la diferencia entre el efectivo contado y el esperado.
 * Un valor positivo indica sobrante; negativo indica faltante.
 * Referencia: F.11, F.12.
 */
export function calcularDiferenciaCorte(
  efectivoContado: number,
  efectivoEsperado: number,
): number {
  return Math.round((efectivoContado - efectivoEsperado) * 100) / 100
}

// -----------------------------------------------------------------------------
// Formato de moneda
// -----------------------------------------------------------------------------

/**
 * Formatea un número como moneda en pesos mexicanos (MXN).
 * Ejemplo: 1234.5 → "$1,234.50"
 */
export function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(valor)
}

/**
 * Determina el estado visual de stock de un producto.
 * Referencia: F.3 — etiquetas de estado en la tabla del catálogo.
 */
export function obtenerEstadoStock(
  existencia: number,
  minimoExistencia: number,
): 'agotado' | 'advertencia' | 'con-existencias' {
  if (existencia <= 0) return 'agotado'
  if (existencia <= minimoExistencia) return 'advertencia'
  return 'con-existencias'
}
