-- =============================================================================
-- fix_corte_caja.sql
-- Corrige las funciones de corte de caja.
--
-- Problema raíz:
--   El filtro AND v.hora_inicio >= p_hora_inicio AND v.hora_inicio <= p_hora_fin
--   usa TIMETZ. Las ventas se guardan con hora UTC en la BD. Al comparar con
--   hora local del servidor (México UTC-6), las ventas cobradas a las 10 AM
--   local están guardadas como 16:00+00, fuera del rango '00:00:00'–'17:18:00'
--   comparado sin zona horaria → la consulta devuelve 0 ventas.
--
-- Solución:
--   Eliminar el filtro de hora_inicio. El corte del día ya acota por fecha
--   y cajero_id — no necesita rango de horas. El período mostrado en UI es
--   solo informativo.
--   Agregar SECURITY DEFINER para que la función bypasee RLS correctamente.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- fn_calcular_corte_cajero — corte de turno por cajero (F.11)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calcular_corte_cajero(
  p_cajero_id   UUID,
  p_fecha       DATE,
  p_hora_inicio TIMETZ,
  p_hora_fin    TIMETZ
)
RETURNS TABLE (
  total_ventas      NUMERIC,
  numero_ventas     INTEGER,
  ganancia_estimada NUMERIC,
  efectivo_esperado NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(
      (SELECT SUM(v.total)
       FROM ventas v
       WHERE v.cajero_id = p_cajero_id
         AND v.fecha     = p_fecha
         AND v.estado    = 'cobrada'),
      0
    ) AS total_ventas,

    COALESCE(
      (SELECT COUNT(v.id)::INTEGER
       FROM ventas v
       WHERE v.cajero_id = p_cajero_id
         AND v.fecha     = p_fecha
         AND v.estado    = 'cobrada'),
      0
    ) AS numero_ventas,

    COALESCE(
      (SELECT SUM(dv.subtotal - (dv.cantidad * p.costo))
       FROM ventas v
       JOIN detalle_ventas dv ON dv.venta_id = v.id
       JOIN productos p       ON p.id = dv.producto_id
       WHERE v.cajero_id = p_cajero_id
         AND v.fecha     = p_fecha
         AND v.estado    = 'cobrada'),
      0
    ) AS ganancia_estimada,

    COALESCE(
      (SELECT SUM(v.total)
       FROM ventas v
       WHERE v.cajero_id = p_cajero_id
         AND v.fecha     = p_fecha
         AND v.estado    = 'cobrada'),
      0
    ) AS efectivo_esperado;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_calcular_corte_cajero(UUID, DATE, TIMETZ, TIMETZ)
  TO authenticated;


-- -----------------------------------------------------------------------------
-- fn_calcular_corte_dia — corte del día completo (F.12)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calcular_corte_dia(p_fecha DATE)
RETURNS TABLE (
  total_ventas      NUMERIC,
  numero_ventas     INTEGER,
  ganancia_estimada NUMERIC,
  efectivo_esperado NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(
      (SELECT SUM(v.total)
       FROM ventas v
       WHERE v.fecha  = p_fecha
         AND v.estado = 'cobrada'),
      0
    ) AS total_ventas,

    COALESCE(
      (SELECT COUNT(v.id)::INTEGER
       FROM ventas v
       WHERE v.fecha  = p_fecha
         AND v.estado = 'cobrada'),
      0
    ) AS numero_ventas,

    COALESCE(
      (SELECT SUM(dv.subtotal - (dv.cantidad * p.costo))
       FROM ventas v
       JOIN detalle_ventas dv ON dv.venta_id = v.id
       JOIN productos p       ON p.id = dv.producto_id
       WHERE v.fecha  = p_fecha
         AND v.estado = 'cobrada'),
      0
    ) AS ganancia_estimada,

    COALESCE(
      (SELECT SUM(v.total)
       FROM ventas v
       WHERE v.fecha  = p_fecha
         AND v.estado = 'cobrada'),
      0
    ) AS efectivo_esperado;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_calcular_corte_dia(DATE)
  TO authenticated;
