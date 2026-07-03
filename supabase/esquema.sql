-- =============================================================================
-- esquema.sql
-- Script completo de creación de la base de datos de Mi Tiendita.
-- Ejecutar en: Supabase → SQL Editor → New Query → pegar y ejecutar.
--
-- Orden de ejecución:
--   1. Tipos ENUM
--   2. Tablas
--   3. Índices
--   4. Funciones y triggers
--   5. Row Level Security (RLS)
--   6. Usuario administrador inicial
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. EXTENSIONES
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- para gen_random_uuid()


-- -----------------------------------------------------------------------------
-- 0b. PERMISOS DE SCHEMA
-- Requerido en Supabase con PostgreSQL 15+ donde el schema public
-- ya no otorga permisos públicos por defecto.
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;


-- =============================================================================
-- 1. TIPOS ENUM
-- =============================================================================

CREATE TYPE rol_usuario    AS ENUM ('admin', 'cajero');
CREATE TYPE estado_venta   AS ENUM ('abierta', 'cobrada', 'cancelada');
CREATE TYPE tipo_movimiento AS ENUM ('entrada', 'salida', 'ajuste');
CREATE TYPE tipo_corte     AS ENUM ('cajero', 'dia');
CREATE TYPE tipo_alerta    AS ENUM ('stock_bajo');


-- =============================================================================
-- 2. TABLAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 usuarios
-- Perfil público vinculado a auth.users de Supabase.
-- Las contraseñas las maneja exclusivamente Supabase Auth (decisión P-03).
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid()
                           REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     VARCHAR(120)  NOT NULL,
  email      VARCHAR(200)  NOT NULL UNIQUE,
  rol        rol_usuario   NOT NULL DEFAULT 'cajero',
  activo     BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  usuarios          IS 'Perfiles públicos de operadores del sistema.';
COMMENT ON COLUMN usuarios.id       IS 'UUID vinculado a auth.users de Supabase.';
COMMENT ON COLUMN usuarios.rol      IS 'admin = acceso total, cajero = acceso limitado.';
COMMENT ON COLUMN usuarios.activo   IS 'FALSE = usuario desactivado (soft-delete).';


-- -----------------------------------------------------------------------------
-- 2.2 productos
-- Catálogo de artículos de la tienda.
-- El código se genera automáticamente (PROD-00001). Soft-delete con activo=false.
-- El precio_venta se calcula: costo * (1 + pct_ganancia / 100) (decisión D-03).
-- -----------------------------------------------------------------------------
CREATE TABLE productos (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo             VARCHAR(30)    NOT NULL UNIQUE,
  nombre             VARCHAR(200)   NOT NULL,
  descripcion        TEXT,
  costo              NUMERIC(10,2)  NOT NULL CHECK (costo >= 0),
  precio_venta       NUMERIC(10,2)  NOT NULL CHECK (precio_venta >= 0),
  pct_ganancia       NUMERIC(5,2)   NOT NULL DEFAULT 0,
  existencia         INTEGER        NOT NULL DEFAULT 0 CHECK (existencia >= 0),
  minimo_existencia  INTEGER        NOT NULL DEFAULT 1 CHECK (minimo_existencia >= 0),
  activo             BOOLEAN        NOT NULL DEFAULT TRUE,
  creado_por         UUID           REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  actualizado_en     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  productos                   IS 'Catálogo de productos de la miscelánea.';
COMMENT ON COLUMN productos.codigo            IS 'Código auto-generado formato PROD-00001.';
COMMENT ON COLUMN productos.precio_venta      IS 'Calculado: costo * (1 + pct_ganancia/100).';
COMMENT ON COLUMN productos.minimo_existencia IS 'Umbral para generar alerta de stock bajo.';
COMMENT ON COLUMN productos.activo            IS 'FALSE = desactivado cuando tiene ventas históricas.';


-- -----------------------------------------------------------------------------
-- 2.3 ventas
-- Transacciones de cobro. Solo efectivo en v1 (decisión P-04).
-- El folio se genera automáticamente: VTA-YYYYMMDD-NNNN con contador global (P-05).
-- -----------------------------------------------------------------------------
CREATE TABLE ventas (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  folio           VARCHAR(30)    NOT NULL UNIQUE,
  cajero_id       UUID           NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha           DATE           NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio     TIMETZ         NOT NULL DEFAULT NOW()::TIMETZ,
  hora_fin        TIMETZ,
  subtotal        NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total           NUMERIC(10,2)  NOT NULL DEFAULT 0,
  monto_recibido  NUMERIC(10,2),
  cambio          NUMERIC(10,2),
  estado          estado_venta   NOT NULL DEFAULT 'abierta',
  creado_en       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  ventas               IS 'Registro de ventas realizadas en la miscelánea.';
COMMENT ON COLUMN ventas.folio         IS 'Auto-generado: VTA-YYYYMMDD-NNNN, contador global.';
COMMENT ON COLUMN ventas.hora_fin      IS 'Se registra al momento del cobro.';
COMMENT ON COLUMN ventas.monto_recibido IS 'Dinero entregado por el cliente (solo efectivo, v1).';


-- -----------------------------------------------------------------------------
-- 2.4 detalle_ventas
-- Líneas de cada venta. Snapshot de nombre y precio al momento de la venta.
-- Se elimina en cascada si se borra la venta (solo borrado de ventas abiertas).
-- -----------------------------------------------------------------------------
CREATE TABLE detalle_ventas (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id         UUID           NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id      UUID           NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  nombre_producto  VARCHAR(200)   NOT NULL,  -- snapshot histórico
  precio_unitario  NUMERIC(10,2)  NOT NULL,  -- snapshot histórico
  cantidad         INTEGER        NOT NULL CHECK (cantidad > 0),
  subtotal         NUMERIC(10,2)  NOT NULL   -- precio_unitario * cantidad
);

COMMENT ON TABLE  detalle_ventas                  IS 'Líneas de detalle de cada venta.';
COMMENT ON COLUMN detalle_ventas.nombre_producto  IS 'Copia del nombre al momento de la venta.';
COMMENT ON COLUMN detalle_ventas.precio_unitario  IS 'Copia del precio al momento de la venta.';


-- -----------------------------------------------------------------------------
-- 2.5 movimientos_inventario
-- Trazabilidad de entradas, salidas y ajustes de stock.
-- Toda modificación de inventario queda registrada con usuario responsable.
-- -----------------------------------------------------------------------------
CREATE TABLE movimientos_inventario (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  UUID             NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  tipo         tipo_movimiento  NOT NULL,
  cantidad     INTEGER          NOT NULL,  -- positivo=entrada, negativo=salida
  motivo       TEXT,
  venta_id     UUID             REFERENCES ventas(id) ON DELETE SET NULL,
  usuario_id   UUID             NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  creado_en    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  movimientos_inventario IS 'Historial de movimientos de stock por producto.';
COMMENT ON COLUMN movimientos_inventario.venta_id IS 'Referencia a venta cuando es salida por cobro.';


-- -----------------------------------------------------------------------------
-- 2.6 cortes_caja
-- Cortes de cajero (por turno) y cortes del día.
-- cajero_id es NULL en cortes de tipo 'dia'.
-- -----------------------------------------------------------------------------
CREATE TABLE cortes_caja (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo               tipo_corte    NOT NULL,
  cajero_id          UUID          REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha              DATE          NOT NULL,
  hora_inicio        TIMETZ        NOT NULL,
  hora_fin           TIMETZ        NOT NULL,
  total_ventas       NUMERIC(10,2) NOT NULL DEFAULT 0,
  numero_ventas      INTEGER       NOT NULL DEFAULT 0,
  ganancia_estimada  NUMERIC(10,2) NOT NULL DEFAULT 0,
  efectivo_esperado  NUMERIC(10,2) NOT NULL DEFAULT 0,
  efectivo_contado   NUMERIC(10,2),
  diferencia         NUMERIC(10,2),  -- efectivo_contado - efectivo_esperado
  observaciones      TEXT,
  realizado_por      UUID          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  creado_en          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  cortes_caja           IS 'Cortes de turno (cajero) y cierre diario (dia).';
COMMENT ON COLUMN cortes_caja.cajero_id IS 'NULL cuando el tipo es dia.';
COMMENT ON COLUMN cortes_caja.diferencia IS 'efectivo_contado − efectivo_esperado.';


-- -----------------------------------------------------------------------------
-- 2.7 alertas
-- Generadas automáticamente por trigger cuando existencia <= minimo_existencia.
-- -----------------------------------------------------------------------------
CREATE TABLE alertas (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id     UUID         NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo            tipo_alerta  NOT NULL DEFAULT 'stock_bajo',
  mensaje         TEXT         NOT NULL,
  resuelta        BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha_generada  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  fecha_resuelta  TIMESTAMPTZ  -- se llena automáticamente al resurtir el producto
);

COMMENT ON TABLE  alertas          IS 'Alertas de inventario bajo generadas por trigger.';
COMMENT ON COLUMN alertas.resuelta IS 'TRUE = el producto fue resurtido y superó el mínimo.';


-- =============================================================================
-- 3. ÍNDICES
-- Optimizan las consultas más frecuentes del sistema.
-- =============================================================================

-- Búsqueda de productos por nombre o código (F.4)
CREATE INDEX idx_productos_nombre  ON productos (nombre);
CREATE INDEX idx_productos_codigo  ON productos (codigo);
CREATE INDEX idx_productos_activo  ON productos (activo);

-- Consulta de ventas por cajero y fecha (cortes / reportes)
CREATE INDEX idx_ventas_cajero_id  ON ventas (cajero_id);
CREATE INDEX idx_ventas_fecha      ON ventas (fecha);
CREATE INDEX idx_ventas_estado     ON ventas (estado);

-- Detalle por venta (carga de líneas al abrir una venta)
CREATE INDEX idx_detalle_venta_id  ON detalle_ventas (venta_id);

-- Movimientos por producto (historial de inventario)
CREATE INDEX idx_mov_producto_id   ON movimientos_inventario (producto_id);

-- Alertas no resueltas (popup al cargar el sistema)
CREATE INDEX idx_alertas_resuelta  ON alertas (resuelta);
CREATE INDEX idx_alertas_producto  ON alertas (producto_id);

-- Cortes por fecha y cajero
CREATE INDEX idx_cortes_fecha      ON cortes_caja (fecha);
CREATE INDEX idx_cortes_cajero     ON cortes_caja (cajero_id);


-- =============================================================================
-- 4. FUNCIONES Y TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1 fn_generar_codigo_producto
-- Genera el siguiente código PROD-NNNNN de forma auto-incremental y global.
-- Se invoca desde el trigger antes de insertar un producto sin código.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generar_codigo_producto()
RETURNS TRIGGER AS $$
DECLARE
  ultimo_numero INTEGER;
  nuevo_codigo  VARCHAR(30);
BEGIN
  -- Obtener el número más alto ya asignado
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(codigo FROM 6) AS INTEGER)), 0
  )
  INTO ultimo_numero
  FROM productos
  WHERE codigo ~ '^PROD-[0-9]+$';

  -- Construir el nuevo código con ceros a la izquierda (5 dígitos mínimo)
  nuevo_codigo := 'PROD-' || LPAD((ultimo_numero + 1)::TEXT, 5, '0');

  NEW.codigo := nuevo_codigo;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generar_codigo_producto
  BEFORE INSERT ON productos
  FOR EACH ROW
  WHEN (NEW.codigo IS NULL OR NEW.codigo = '')
  EXECUTE FUNCTION fn_generar_codigo_producto();


-- -----------------------------------------------------------------------------
-- 4.2 fn_generar_folio_venta
-- Genera el folio VTA-YYYYMMDD-NNNN con contador global que nunca reinicia (P-05).
-- Usa una secuencia PostgreSQL para garantizar unicidad sin condiciones de carrera.
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS seq_folio_venta START 1;

CREATE OR REPLACE FUNCTION fn_generar_folio_venta()
RETURNS TRIGGER AS $$
BEGIN
  NEW.folio := 'VTA-'
    || TO_CHAR(CURRENT_DATE, 'YYYYMMDD')
    || '-'
    || LPAD(nextval('seq_folio_venta')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generar_folio_venta
  BEFORE INSERT ON ventas
  FOR EACH ROW
  WHEN (NEW.folio IS NULL OR NEW.folio = '')
  EXECUTE FUNCTION fn_generar_folio_venta();


-- -----------------------------------------------------------------------------
-- 4.3 fn_actualizar_timestamp
-- Actualiza el campo actualizado_en automáticamente al modificar un producto.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_timestamp_producto
  BEFORE UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION fn_actualizar_timestamp();


-- -----------------------------------------------------------------------------
-- 4.3b fn_calcular_precio_venta
-- Recalcula precio_venta automáticamente cuando cambia costo o pct_ganancia.
-- Referencia: D-03 — el precio SIEMPRE se calcula desde costo * (1 + pct/100).
-- Se ejecuta BEFORE UPDATE para que el valor quede listo antes de guardar.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calcular_precio_venta()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcular solo si cambió costo o porcentaje de ganancia
  IF NEW.costo IS DISTINCT FROM OLD.costo
     OR NEW.pct_ganancia IS DISTINCT FROM OLD.pct_ganancia
  THEN
    NEW.precio_venta := ROUND(NEW.costo * (1 + NEW.pct_ganancia / 100.0), 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- También aplica en INSERT para garantizar consistencia al crear un producto
CREATE OR REPLACE FUNCTION fn_calcular_precio_venta_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.precio_venta := ROUND(NEW.costo * (1 + NEW.pct_ganancia / 100.0), 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calcular_precio_venta_update
  BEFORE UPDATE OF costo, pct_ganancia ON productos
  FOR EACH ROW
  EXECUTE FUNCTION fn_calcular_precio_venta();

CREATE TRIGGER trg_calcular_precio_venta_insert
  BEFORE INSERT ON productos
  FOR EACH ROW
  EXECUTE FUNCTION fn_calcular_precio_venta_insert();


-- -----------------------------------------------------------------------------
-- 4.4 fn_validar_stock_detalle
-- Valida que haya existencia suficiente ANTES de insertar una línea de venta.
-- Lanza error si cantidad > existencia disponible (NF.2.2, F.7).
-- Evita ventas de productos agotados o con stock insuficiente.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_stock_detalle()
RETURNS TRIGGER AS $$
DECLARE
  existencia_actual INTEGER;
  nombre_prod       VARCHAR(200);
BEGIN
  SELECT existencia, nombre
  INTO existencia_actual, nombre_prod
  FROM productos
  WHERE id = NEW.producto_id;

  IF existencia_actual < NEW.cantidad THEN
    RAISE EXCEPTION
      'Stock insuficiente para "%": disponible %, solicitado %.',
      nombre_prod, existencia_actual, NEW.cantidad
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_stock_detalle
  BEFORE INSERT ON detalle_ventas
  FOR EACH ROW
  EXECUTE FUNCTION fn_validar_stock_detalle();


-- -----------------------------------------------------------------------------
-- 4.5 fn_descontar_inventario
-- Descuenta productos.existencia cuando una venta pasa a estado 'cobrada'.
-- Se dispara en UPDATE de ventas (estado: abierta → cobrada), no en INSERT de
-- detalle_ventas, para respetar el flujo real del cobro (F.10, NF.7.2).
-- Registra cada salida en movimientos_inventario con el cajero responsable.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_descontar_inventario()
RETURNS TRIGGER AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Solo actuar cuando el estado cambia de 'abierta' a 'cobrada'
  IF OLD.estado = 'abierta' AND NEW.estado = 'cobrada' THEN

    FOR rec IN
      SELECT producto_id, cantidad
      FROM detalle_ventas
      WHERE venta_id = NEW.id
    LOOP
      -- Descontar existencia
      UPDATE productos
      SET existencia = existencia - rec.cantidad
      WHERE id = rec.producto_id;

      -- Registrar movimiento de salida
      INSERT INTO movimientos_inventario
        (producto_id, tipo, cantidad, motivo, venta_id, usuario_id)
      VALUES (
        rec.producto_id,
        'salida',
        -rec.cantidad,
        'Venta cobrada - folio ' || NEW.folio,
        NEW.id,
        NEW.cajero_id
      );
    END LOOP;

    -- Registrar hora de cierre de la venta
    NEW.hora_fin := NOW()::TIMETZ;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_cobro_2_descontar
  BEFORE UPDATE OF estado ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION fn_descontar_inventario();


-- -----------------------------------------------------------------------------
-- 4.6 fn_validar_cobro
-- Valida que monto_recibido >= total antes de marcar una venta como 'cobrada'.
-- Valida también que cambio = monto_recibido - total sea coherente (NF.2.2, F.10).
-- Impide cerrar ventas con pago insuficiente en efectivo.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_cobro()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo aplica cuando se intenta cobrar
  IF NEW.estado = 'cobrada' THEN

    -- monto_recibido es obligatorio al cobrar
    IF NEW.monto_recibido IS NULL THEN
      RAISE EXCEPTION
        'El monto recibido es obligatorio para registrar el cobro.'
        USING ERRCODE = 'P0002';
    END IF;

    -- No permitir cobro con monto insuficiente (NF.2.2)
    IF NEW.monto_recibido < NEW.total THEN
      RAISE EXCEPTION
        'El monto recibido (%) es menor al total de la venta (%).',
        NEW.monto_recibido, NEW.total
        USING ERRCODE = 'P0002';
    END IF;

    -- Calcular y guardar el cambio automáticamente
    NEW.cambio := ROUND(NEW.monto_recibido - NEW.total, 2);

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cobro_1_validar
  BEFORE UPDATE OF estado ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION fn_validar_cobro();


-- -----------------------------------------------------------------------------
-- 4.7 fn_generar_alerta_stock
-- Crea una alerta cuando existencia <= minimo_existencia al actualizar un producto.
-- Dispara en cualquier actualización donde el stock quede bajo el mínimo,
-- no solo al cruzar el umbral — cubre productos que ya venían con stock bajo.
-- Evita duplicar alertas activas (resuelta=FALSE) para el mismo producto.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generar_alerta_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Actuar siempre que el stock actual quede en o bajo el mínimo
  IF NEW.existencia <= NEW.minimo_existencia THEN
    -- Crear alerta solo si no hay una activa (no resuelta) para este producto
    IF NOT EXISTS (
      SELECT 1 FROM alertas
      WHERE producto_id = NEW.id
        AND tipo = 'stock_bajo'
        AND resuelta = FALSE
    ) THEN
      INSERT INTO alertas (producto_id, tipo, mensaje)
      VALUES (
        NEW.id,
        'stock_bajo',
        'El producto "' || NEW.nombre || '" tiene stock bajo: '
          || NEW.existencia || ' unidades (mínimo: ' || NEW.minimo_existencia || ').'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generar_alerta_stock
  AFTER INSERT OR UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION fn_generar_alerta_stock();


-- -----------------------------------------------------------------------------
-- 4.7b fn_resolver_alerta_stock
-- Marca automáticamente como resuelta la alerta de un producto
-- cuando su existencia vuelve a superar el mínimo (resurtido).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_resolver_alerta_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.existencia > NEW.minimo_existencia THEN
    UPDATE alertas
    SET resuelta = TRUE, fecha_resuelta = NOW()
    WHERE producto_id = NEW.id
      AND tipo = 'stock_bajo'
      AND resuelta = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resolver_alerta_stock
  AFTER INSERT OR UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION fn_resolver_alerta_stock();


-- -----------------------------------------------------------------------------
-- 4.8 fn_calcular_corte_cajero
-- Calcula totales de ventas para un cajero en un rango de tiempo.
-- Se separan los agregados de ventas y de detalles para evitar el producto
-- cartesiano que duplicaba total_ventas y numero_ventas al hacer JOIN con
-- detalle_ventas (una venta con N productos contaba N veces).
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
  -- Nota: el filtro por hora_inicio fue eliminado intencionalmente.
  -- hora_inicio es TIMETZ (UTC), compararlo con hora local del cliente
  -- sin conversión de zona horaria excluye ventas válidas del día.
  -- El acotamiento por fecha + cajero_id es suficiente para el corte de turno.
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
-- 4.9 fn_calcular_corte_dia
-- Calcula totales de todas las ventas cobradas de un día completo.
-- Se separan los agregados para evitar el producto cartesiano con detalle_ventas.
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
  -- Subconsultas escalares: garantizan SIEMPRE una fila de retorno con COALESCE.
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


-- -----------------------------------------------------------------------------
-- 4.10 fn_crear_perfil_usuario
-- Crea automáticamente un perfil en la tabla `usuarios` cuando se registra
-- un nuevo usuario en Supabase Auth.
-- SECURITY DEFINER + SET search_path para bypassear RLS durante la inserción.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_crear_perfil_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, nombre, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Sin nombre'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'rol')::rol_usuario, 'cajero')
  )
  ON CONFLICT (id) DO NOTHING;  -- evita error si ya existe el perfil
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_crear_perfil_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION fn_crear_perfil_usuario();


-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- Dos capas: frontend (guards) + backend (RLS). El RLS es la capa real.
-- Referencia: sección 1.5 Seguridad y Roles del SRS.
-- =============================================================================

-- Activar RLS en todas las tablas
ALTER TABLE usuarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_ventas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortes_caja           ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas               ENABLE ROW LEVEL SECURITY;

-- Helper: obtener el rol del usuario autenticado desde la tabla usuarios
CREATE OR REPLACE FUNCTION rol_actual()
RETURNS TEXT AS $$
  SELECT rol::TEXT FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: obtener el UUID del usuario autenticado
CREATE OR REPLACE FUNCTION uid_actual()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql STABLE;

-- ── usuarios ──────────────────────────────────────────────────────────────────
-- Cada usuario ve solo su propio perfil; admin ve todos
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT
  USING (id = uid_actual() OR rol_actual() = 'admin');

CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT
  WITH CHECK (rol_actual() = 'admin');

CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE
  USING (rol_actual() = 'admin');

CREATE POLICY "usuarios_delete" ON usuarios FOR DELETE
  USING (rol_actual() = 'admin');

-- ── productos ─────────────────────────────────────────────────────────────────
-- Admin y cajero pueden leer; solo admin puede escribir
CREATE POLICY "productos_select" ON productos FOR SELECT
  USING (rol_actual() IN ('admin', 'cajero'));

CREATE POLICY "productos_insert" ON productos FOR INSERT
  WITH CHECK (rol_actual() = 'admin');

CREATE POLICY "productos_update" ON productos FOR UPDATE
  USING (rol_actual() = 'admin');

CREATE POLICY "productos_delete" ON productos FOR DELETE
  USING (rol_actual() = 'admin');

-- ── ventas ────────────────────────────────────────────────────────────────────
-- Admin ve todas; cajero solo ve las propias
CREATE POLICY "ventas_select" ON ventas FOR SELECT
  USING (rol_actual() = 'admin' OR cajero_id = uid_actual());

CREATE POLICY "ventas_insert" ON ventas FOR INSERT
  WITH CHECK (rol_actual() IN ('admin', 'cajero'));

CREATE POLICY "ventas_update" ON ventas FOR UPDATE
  USING (rol_actual() IN ('admin', 'cajero') AND cajero_id = uid_actual()
    OR rol_actual() = 'admin');

-- ── detalle_ventas ────────────────────────────────────────────────────────────
-- Acceso ligado al acceso de la venta padre
CREATE POLICY "detalle_ventas_select" ON detalle_ventas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.id = venta_id
        AND (rol_actual() = 'admin' OR v.cajero_id = uid_actual())
    )
  );

CREATE POLICY "detalle_ventas_insert" ON detalle_ventas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.id = venta_id
        AND (rol_actual() IN ('admin', 'cajero'))
        AND v.estado = 'abierta'
    )
  );

CREATE POLICY "detalle_ventas_delete" ON detalle_ventas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.id = venta_id
        AND v.estado = 'abierta'
        AND (rol_actual() = 'admin' OR v.cajero_id = uid_actual())
    )
  );

CREATE POLICY "detalle_ventas_update" ON detalle_ventas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.id = venta_id
        AND v.cajero_id = auth.uid()
        AND v.estado = 'abierta'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.id = venta_id
        AND v.cajero_id = auth.uid()
        AND v.estado = 'abierta'
    )
  );

-- ── movimientos_inventario ────────────────────────────────────────────────────
-- Solo admin puede leer y escribir movimientos
CREATE POLICY "movimientos_select" ON movimientos_inventario FOR SELECT
  USING (rol_actual() = 'admin');

CREATE POLICY "movimientos_insert" ON movimientos_inventario FOR INSERT
  WITH CHECK (rol_actual() IN ('admin', 'cajero'));

-- ── cortes_caja ───────────────────────────────────────────────────────────────
-- Admin ve todos; cajero solo ve los propios
CREATE POLICY "cortes_select" ON cortes_caja FOR SELECT
  USING (rol_actual() = 'admin' OR cajero_id = uid_actual());

CREATE POLICY "cortes_insert" ON cortes_caja FOR INSERT
  WITH CHECK (rol_actual() IN ('admin', 'cajero'));

-- ── alertas ───────────────────────────────────────────────────────────────────
-- Solo admin puede ver alertas; se resuelven automáticamente por trigger
CREATE POLICY "alertas_select" ON alertas FOR SELECT
  USING (rol_actual() = 'admin');


-- =============================================================================
-- 6. DATOS INICIALES — usuario administrador
-- =============================================================================
-- INSTRUCCIONES:
--   1. Crea el usuario en Supabase → Authentication → Users → Add user
--      con el correo y contraseña que desees.
--   2. Copia el UUID generado y reemplaza 'UUID-DEL-ADMIN-AQUI' abajo.
--   3. Ejecuta solo el INSERT de esta sección.
--
-- Este INSERT actualiza el rol a 'admin' para el usuario creado.
-- El trigger trg_crear_perfil_usuario ya habrá creado la fila con rol 'cajero';
-- aquí la promovemos a admin.

-- UPDATE usuarios
--   SET rol = 'admin', nombre = 'Administrador'
--   WHERE id = 'UUID-DEL-ADMIN-AQUI';
