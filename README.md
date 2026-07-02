<div align="center">

<!-- Logo replicado desde LayoutApp.tsx: ShoppingBag sobre fondo primary-600 (#16a34a) -->
<img src="https://img.shields.io/badge/-Mi%20Tiendita-16a34a?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTYgMiAzIDZ2MTRhMiAyIDAgMCAwIDIgMmgxNGEyIDIgMCAwIDAgMi0yVjZsLTMtNFoiLz48cGF0aCBkPSJNMyA2aDE4Ii8+PHBhdGggZD0iTTE2IDEwYTQgNCAwIDAgMS04IDAiLz48L3N2Zz4=&logoColor=white&labelColor=16a34a&color=15803d" alt="Mi Tiendita" height="50"/>

<br/>

<h1>Mi Tiendita</h1>

<p>
  Sistema web de punto de venta e inventario para misceláneas y tiendas de abarrotes.<br/>
  Sin instalaciones. Desde cualquier navegador. Pensado para el mostrador del día a día.
</p>

<br/>

<img src="https://img.shields.io/badge/React_18-20232a?style=flat-square&logo=react&logoColor=61dafb" alt="React"/>
&nbsp;
<img src="https://img.shields.io/badge/TypeScript_5-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
&nbsp;
<img src="https://img.shields.io/badge/Vite_5-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite"/>
&nbsp;
<img src="https://img.shields.io/badge/Tailwind_CSS_3-0ea5e9?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind"/>
&nbsp;
<img src="https://img.shields.io/badge/Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white" alt="Supabase"/>
&nbsp;
<img src="https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
&nbsp;
<img src="https://img.shields.io/badge/pnpm-f69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm"/>

<br/><br/>

</div>

---

## Acerca del proyecto

El proyecto nació de una necesidad real: reemplazar el control manual de ventas e inventario de una tienda pequeña con una herramienta accesible, rápida en mostrador y consultable desde el celular por el administrador.

La lógica de negocio crítica vive directamente en la base de datos mediante **triggers y funciones PostgreSQL**: descuento de inventario, generación de folios, alertas de stock bajo y validación de cobro. Las reglas del negocio son independientes del cliente.

---

## Modulos

<table>
<tr>
<td width="50%" valign="top">

**Ventas**
- Busqueda en tiempo real por nombre o codigo de producto
- Cobro en efectivo con calculo automatico de cambio
- Venta editable hasta confirmar el cobro
- Inventario descontado solo al confirmar, nunca antes

**Catalogo de productos**
- Codigo auto-generado `PROD-00001` via trigger SQL
- Precio calculado desde costo y porcentaje de ganancia
- Estado visual del stock: disponible, minimo, agotado
- Alta, edicion y baja con confirmacion obligatoria

**Alertas de inventario**
- Generadas automaticamente por trigger en base de datos
- Modal con lista de productos afectados al ingresar
- Se resuelven solas al resurtir el producto

</td>
<td width="50%" valign="top">

**Corte de caja**
- Corte de turno por cajero: ventas, ganancias y efectivo esperado
- Corte del dia: resumen completo de todas las ventas de la jornada
- Prevencion de duplicados en el mismo dia

**Reportes**
- Filtros por dia, semana y mes
- Grafica de pastel con ventas y ganancias del periodo
- Exclusivo para el administrador

**Control de acceso**
- Autenticacion via Supabase Auth (email + password)
- Roles: `admin` y `cajero`
- Bloqueo visual de 5 min tras tres intentos fallidos
- Guards en React Router + politicas RLS en PostgreSQL
- Vista movil adaptada para el administrador

</td>
</tr>
</table>

---

## Stack

| Capa | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS 3 |
| Enrutamiento | React Router v6 |
| Estado global | Zustand |
| Graficas | Recharts |
| Iconos | Lucide React |
| Backend / BD | Supabase (PostgreSQL) |
| Autenticacion | Supabase Auth |
| Gestor de paquetes | pnpm 9 |

---

## Estructura del proyecto

```
src/
  features/
    auth/         Login, contexto de autenticacion y guard de rutas
    products/     Catalogo, alta, edicion y eliminacion de productos
    sales/        Modulo de ventas y cobro
    cash-cut/     Corte de cajero y corte del dia
    reports/      Reportes con graficas
    alerts/       Visualizacion de alertas de inventario
  shared/
    components/   Tabla, Modal, Boton, Insignia
    hooks/        useConexion, useProductos, useVentas, useFooter
    lib/          Cliente Supabase, calculadoras centralizadas
    types/        Tipos e interfaces TypeScript del dominio
  layouts/        LayoutApp: navbar horizontal + footer global
  enrutador.tsx   Rutas y guards por rol
supabase/
  esquema.sql     Script completo: tablas, triggers, funciones y RLS
```

---

## Instalacion y configuracion

### Requisitos previos

- Node.js 18 o superior
- pnpm &nbsp;`npm install -g pnpm`
- Cuenta en [Supabase](https://supabase.com) — el plan gratuito es suficiente para la primera version

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/mi-tiendita.git
cd mi-tiendita
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Variables de entorno

Crear un archivo `.env` en la raiz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

Ambas se encuentran en `Settings > API` dentro de tu proyecto de Supabase.

### 4. Crear el esquema de base de datos

En el SQL Editor de Supabase, ejecutar el contenido completo de `supabase/esquema.sql`.
El script crea todas las tablas, indices, triggers, funciones y politicas RLS.

### 5. Crear el primer administrador

En `Supabase > Authentication > Users` crear el usuario. Luego asignar el rol desde el SQL Editor:

```sql
UPDATE usuarios
SET rol = 'admin'
WHERE email = 'correo@dominio.com';
```

### 6. Levantar el servidor de desarrollo

```bash
pnpm dev
```

Disponible en `http://localhost:5173`

---

## Despliegue

Compatible con Vercel y cualquier servicio de hosting estatico con soporte para Vite.

```bash
pnpm build
```

Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables de entorno en el panel del servicio de hosting. La carpeta `dist` contiene todo lo necesario para produccion.

---

## Decisiones de diseno

| Decision | Descripcion |
|---|---|
| Precio siempre calculado | El administrador define costo y porcentaje de ganancia. El precio es de solo lectura, nunca editable de forma directa. |
| Bloqueo del lado del cliente | 5 minutos con contador visible tras tres intentos fallidos. Supabase maneja su propio rate limiting en servidor de forma independiente. |
| Sin rol de consulta movil | No existe un tercer rol. El administrador usa su cuenta normal desde movil y el sistema adapta la interfaz segun el ancho de pantalla. |
| Folio con contador global | `VTA-YYYYMMDD-NNNN` usa una secuencia PostgreSQL que nunca reinicia, garantizando unicidad sin condiciones de carrera. |
| Solo efectivo en v1 | El metodo de pago fue eliminado para simplificar el flujo de cobro en la primera version. |

---

<div align="center">
<sub>Proyecto personal — uso privado. No disponible para redistribucion sin autorizacion.</sub>
</div>
