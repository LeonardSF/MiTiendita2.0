// =============================================================================
// tipos.ts
// Tipos TypeScript globales del sistema Mi Tiendita.
// Reflejan exactamente el modelo de datos definido en el SRS.
// =============================================================================

// -----------------------------------------------------------------------------
// Roles de usuario
// Solo existen dos roles en la BD. La vista móvil es el admin con pantalla
// responsiva, no un rol independiente (ver decisión D-06).
// -----------------------------------------------------------------------------
export type RolUsuario = 'admin' | 'cajero'

// -----------------------------------------------------------------------------
// Usuario
// Perfil público del operador. Las credenciales (contraseña) las maneja
// exclusivamente Supabase Auth — no se almacenan aquí (ver decisión P-03).
// -----------------------------------------------------------------------------
export interface Usuario {
  id: string               // UUID — vinculado a auth.users de Supabase
  nombre: string           // Nombre completo del operador
  email: string            // Correo de acceso, único en BD
  rol: RolUsuario          // Determina permisos y políticas RLS
  activo: boolean          // false = desactivado (soft-delete)
  creado_en: string        // TIMESTAMPTZ — fecha de creación del registro
}

// -----------------------------------------------------------------------------
// Producto
// Representa un artículo del catálogo de la tienda.
// El precio_venta siempre se calcula: costo * (1 + pct_ganancia / 100).
// El código se genera automáticamente en BD con formato PROD-00001 (D-02).
// Si tiene ventas históricas, se desactiva en lugar de eliminarse (soft-delete).
// -----------------------------------------------------------------------------
export interface Producto {
  id: string               // UUID
  codigo: string           // Auto-generado: PROD-00001 (solo lectura en UI)
  nombre: string           // Nombre o descripción del producto
  descripcion?: string     // Descripción extendida (opcional)
  costo: number            // Precio de costo, >= 0
  precio_venta: number     // Calculado: costo * (1 + pct_ganancia / 100)
  pct_ganancia: number     // Porcentaje de ganancia definido por el admin
  existencia: number       // Stock actual disponible, >= 0
  minimo_existencia: number // Umbral para activar alerta de stock bajo
  activo: boolean          // false = producto desactivado
  creado_por: string       // UUID del admin que registró el producto
  creado_en: string        // TIMESTAMPTZ
  actualizado_en: string   // TIMESTAMPTZ — fecha de última modificación
}

// -----------------------------------------------------------------------------
// Estado visual de stock — usado en la tabla del catálogo (F.3)
// -----------------------------------------------------------------------------
export type EstadoStock = 'con-existencias' | 'advertencia' | 'agotado'

// -----------------------------------------------------------------------------
// Detalle de venta
// Línea individual dentro de una venta. El nombre y precio se guardan como
// snapshot del momento de la venta, independientemente de cambios futuros
// al producto (ver decisión del modelo de datos).
// -----------------------------------------------------------------------------
export interface DetalleVenta {
  id: string               // UUID
  venta_id: string         // UUID — venta a la que pertenece
  producto_id: string      // UUID — producto vendido
  nombre_producto: string  // Snapshot del nombre al momento de la venta
  precio_unitario: number  // Snapshot del precio al momento de la venta
  cantidad: number         // Unidades vendidas, > 0
  subtotal: number         // precio_unitario × cantidad
}

// -----------------------------------------------------------------------------
// Venta
// Representa una transacción de cobro. Solo existe el método de pago efectivo
// en esta versión (ver decisión P-04).
// El folio se genera automáticamente en BD: VTA-YYYYMMDD-NNNN con contador
// global que nunca reinicia (ver decisión P-05).
// -----------------------------------------------------------------------------
export type EstadoVenta = 'abierta' | 'cobrada' | 'cancelada'

export interface Venta {
  id: string               // UUID
  folio: string            // Auto-generado: VTA-20260609-0001
  cajero_id: string        // UUID del cajero que realizó la venta
  fecha: string            // DATE — fecha de la venta
  hora_inicio: string      // TIMETZ — hora de apertura
  hora_fin?: string        // TIMETZ — hora de cobro (null mientras está abierta)
  subtotal: number         // Suma de líneas de detalle
  total: number            // Total final a cobrar
  monto_recibido?: number  // Dinero entregado por el cliente (null hasta cobrar)
  cambio?: number          // Cambio devuelto (null hasta cobrar)
  estado: EstadoVenta      // Estado actual de la venta
  creado_en: string        // TIMESTAMPTZ
}

// -----------------------------------------------------------------------------
// Venta con sus líneas de detalle incluidas
// Versión extendida para mostrar en pantalla de ventas o tickets.
// -----------------------------------------------------------------------------
export interface VentaConDetalle extends Venta {
  detalles: DetalleVenta[]
}

// -----------------------------------------------------------------------------
// Movimiento de inventario
// Registra entradas, salidas y ajustes de stock. Toda modificación de
// inventario queda trazada con el usuario responsable.
// -----------------------------------------------------------------------------
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste'

export interface MovimientoInventario {
  id: string               // UUID
  producto_id: string      // UUID del producto afectado
  tipo: TipoMovimiento     // Naturaleza del movimiento
  cantidad: number         // Unidades (positivo = entrada, negativo = salida)
  motivo?: string          // Razón del movimiento (opcional)
  venta_id?: string        // UUID de la venta asociada (solo en salidas por cobro)
  usuario_id: string       // UUID del responsable del movimiento
  creado_en: string        // TIMESTAMPTZ
}

// -----------------------------------------------------------------------------
// Corte de caja
// Puede ser de tipo 'cajero' (por turno) o 'dia' (cierre total diario).
// En cortes de día, cajero_id es null.
// -----------------------------------------------------------------------------
export type TipoCorte = 'cajero' | 'dia'

export interface CorteCaja {
  id: string               // UUID
  tipo: TipoCorte          // Cajero = turno, dia = cierre total
  cajero_id?: string       // UUID del cajero (null en corte del día)
  fecha: string            // DATE del período
  hora_inicio: string      // TIMETZ — inicio del período
  hora_fin: string         // TIMETZ — fin del período
  total_ventas: number     // Suma de ventas cobradas en el período
  numero_ventas: number    // Cantidad de ventas realizadas
  ganancia_estimada: number // Ganancia calculada en el período
  efectivo_esperado: number // Efectivo calculado por el sistema
  efectivo_contado?: number // Efectivo físico contado por el operador
  diferencia?: number      // efectivo_contado − efectivo_esperado
  observaciones?: string   // Notas del operador
  realizado_por: string    // UUID del usuario que generó el corte
  creado_en: string        // TIMESTAMPTZ
}

// -----------------------------------------------------------------------------
// Alerta de inventario
// Se genera automáticamente por trigger en BD cuando
// existencia <= minimo_existencia (ver trg_generar_alerta_stock).
// -----------------------------------------------------------------------------
export type TipoAlerta = 'stock_bajo'

export interface Alerta {
  id: string               // UUID
  producto_id: string      // UUID del producto con stock bajo
  tipo: TipoAlerta         // Por ahora solo 'stock_bajo'
  mensaje: string          // Descripción legible de la alerta
  resuelta: boolean        // true = producto fue resurtido y superó el mínimo
  fecha_generada: string   // TIMESTAMPTZ — cuándo se generó
  fecha_resuelta?: string  // TIMESTAMPTZ — cuándo se resurtió el producto
}

// -----------------------------------------------------------------------------
// Alerta enriquecida con datos del producto
// Versión para mostrar en el popup modal de alertas (F.14).
// -----------------------------------------------------------------------------
export interface AlertaConProducto extends Alerta {
  producto: Pick<Producto, 'codigo' | 'nombre' | 'existencia' | 'minimo_existencia'>
}

// -----------------------------------------------------------------------------
// Reporte
// Calculado a partir de ventas cobradas y sus detalles.
// -----------------------------------------------------------------------------
export type PeriodoReporte = 'dia' | 'semana' | 'mes'

export interface Reporte {
  periodo: PeriodoReporte
  ventas_totales: number   // Total vendido en el período
  ganancias: number        // Ganancia estimada en el período
  numero_ventas: number    // Cantidad de ventas realizadas
}

// -----------------------------------------------------------------------------
// Producto con mayor movimiento — usado en reportes (F.13)
// -----------------------------------------------------------------------------
export interface ProductoDestacado {
  producto_id: string
  nombre_producto: string
  total_vendido: number    // Unidades totales vendidas en el período
}

// -----------------------------------------------------------------------------
// Carrito de venta (estado local, nunca persiste directamente en BD)
// Se usa en el módulo de ventas para construir la venta antes de cobrar.
// -----------------------------------------------------------------------------
export interface ItemCarrito {
  producto: Producto       // Referencia completa al producto
  cantidad: number         // Cantidad agregada al carrito
}
