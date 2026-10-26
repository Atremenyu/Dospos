# DashboardView con Recharts & Auditoría Diaria de Productos

Implementación de un nuevo módulo de analíticas visuales en tiempo real (`DashboardView`) potenciado por **Recharts**, integrado como una nueva pestaña dedicada **"Analíticas"** en el panel de **Central / AdminCRM**. Incluye visualizaciones de tendencias de ingresos, distribución de métodos de pago, ranking de platos más vendidos y una herramienta especializada de control diario de ventas por producto con selector de fecha, búsqueda instantánea, filtros por categoría y exportación.

---

## Decisiones Críticas y Preferencias Confirmadas

> [!IMPORTANT]
> A partir de las preguntas aclaratorias, se han confirmado las siguientes decisiones de producto y diseño:

- **Ubicación en el Sistema**: Se creará una nueva pestaña dedicada llamada **"Analíticas"** en la barra lateral de **Central (AdminCRM)**, preservando el Dashboard ejecutivo (`overview`) existente e incorporando acceso directo entre ambos.
- **Auditoría Diaria de Productos**: Selector interactivo de fecha con tabla dinámica, buscador en tiempo real, filtro por categoría, métricas de participación y barras de volumen relativo.
- **Rango Temporal de Gráficos**: Predeterminado a los **Últimos 7 días**, con botones rápidos para conmutar a **Hoy (desglose horario)** y **Este Mes (vista acumulada)**.

---

## 1. Visión General del Módulo

### ¿Qué hace?
Proporciona a la gerencia y administración gastronómica una radiografía visual y analítica del negocio sin demoras:
1. **KPIs en Vivo**: Ventas netas, tickets emitidos, ticket promedio y volumen total de artículos despachados.
2. **Gráfico de Curva de Ventas (AreaChart / LineChart)**: Evolución cronológica de facturación diaria con comparador de volumen de pedidos.
3. **Distribución de Métodos de Pago (PieChart / Donut)**: Visualización porcentual de Efectivo, Tarjeta, Transferencia, Uber, DiDi y Cortesías.
4. **Ranking de Top Productos (BarChart)**: Gráfica de barras de los productos líderes en ventas.
5. **Control de Ventas por Producto Día por Día (Daily Product Inspector)**: Permite seleccionar cualquier día del calendario (o pulsar "Hoy" / "Ayer") para ver con precisión quirúrgica cuántas unidades se vendieron de cada producto, cuánto dinero generaron y su peso en la recaudación del día.

### Audiencia Objetivo
Administradores, cajeros supervisores y chefs ejecutivos que necesitan auditar el rendimiento del menú, planificar compras de insumos basadas en demanda real y contrastar turnos de venta.

---

## 2. Experiencia de Usuario y Diseño Visual

### Identidad Visual y Estilo
Siguiendo las directrices de `frontend-design` y la estética **Slate Dark Cosmic / Neobrutalista** de DosPOS:
- **Estructura y Jerarquía**: Tarjetas con bordes sutiles `border border-slate-100 dark:border-neutral-800`, fondos blancos limpios sobre lienzo `bg-slate-50`, sin pills estáticas innecesarias (metadatos limpios con separadores tipográficos `·`).
- **Números Tabulares**: Todas las cifras monetarias, cantidades y porcentajes utilizan `font-variant-numeric: tabular-nums` para evitar fluctuaciones visuales.
- **Paleta de Colores de Recharts**:
  - Ventas / Ingresos: Rojo vibrante `#DC2626` (identidad DosPOS) y Esmeralda `#16A34A`.
  - Métodos de Pago: Efectivo (Verde `#10B981`), Tarjeta (Azul `#3B82F6`), Transferencia (Púrpura `#8B5CF6`), Uber/Didi (Naranja `#F59E0B`), Cortesía (Gris `#64748B`).
- **Interactividad**: Tooltips personalizados con diseño oscuro nítido, microanimaciones de entrada fluidas y transiciones reactivas cuando se añade una nueva venta en tiempo real.

### Flujo de Usuario: Control de Productos por Día
```text
┌────────────────────────────────────────────────────────────────────────┐
│ [📅 Seleccionar Día: 2026-10-25]  [Hoy] [Ayer]  [🔍 Buscar Producto..]  │
├────────────────────────────────────────────────────────────────────────┤
│ Resumen del Día:  342 Artículos  ·  $14,250.00 MXN  ·  28 Platos Únicos│
├────────────────────────────────────────────────────────────────────────┤
│ PRODUCTO               CATEGORÍA    CANT.    PARTICIPACIÓN   TOTAL ($) │
├────────────────────────────────────────────────────────────────────────┤
│ Burger BBQ Monster     Burgers       45 pzas   ███████ 28%   $5,400.00 │
│ Papas Rústicas         Guarnición    38 pzas   █████   18%   $2,280.00 │
│ Cerveza Artesanal      Bebidas       32 pzas   ████    15%   $2,560.00 │
│ ...                                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Decisiones de Producto y Arquitectura Técnica

### Decisión 1: Sincronización en Tiempo Real sin Recargas
- **Enfoque**: `DashboardView` se alimenta directamente del arreglo reactivo `orders` propagado por `App.tsx` y sincronizado vía WebSockets. Cada vez que se cierra una mesa o se confirma un pedido en mostrador, los gráficos y tablas se actualizan en milisegundos.
- **Filtro de Integridad**: Se descartan órdenes con estado `cancelled`, asegurando que métricas financieras e inventario no computen transacciones anuladas.

### Decisión 2: Desglose Atómico de Productos
- **Enfoque**: Al procesar pedidos, el cálculo itera sobre `order.items`, sumando las cantidades reales (`item.quantity`), considerando modificadores con precio extra y asociándolos a la fecha ISO de la orden (`order.date` o `order.closedAt`).
- **Beneficio**: Permite exactitud total incluso cuando una mesa agregó productos en múltiples rondas antes de liquidar.

---

## 4. Diagrama de Arquitectura y Mapeo de Componentes

```text
                        ┌──────────────────┐
                        │     App.tsx      │ (Root State & WebSocket Sync)
                        └────────┬─────────┘
                                 │ orders, products, categories, settings
                                 ▼
                        ┌──────────────────┐
                        │   AdminCRM.tsx   │ (Sidebar Navigation)
                        └────────┬─────────┘
                                 │
     ┌───────────────────────────┴───────────────────────────┐
     ▼                                                       ▼
┌──────────────────┐                                  ┌──────────────────┐
│  overview / etc. │                                  │  DashboardView   │ (NUEVA PESTAÑA: 'analytics')
└──────────────────┘                                  └────────┬─────────┘
                                                               │
                       ┌───────────────────────────────────────┴───────────────────────────────────────┐
                       ▼                                       ▼                                       ▼
             ┌──────────────────┐                    ┌──────────────────┐                    ┌──────────────────┐
             │ SalesTimeChart   │                    │ PaymentMixChart  │                    │ DailyProducts    │
             │  (Area / Bar)    │                    │  (Donut Recharts)│                    │  Table & Filter  │
             └──────────────────┘                    └──────────────────┘                    └──────────────────┘
```

### Plan de Cambios Específicos:
1. **`types.ts`**:
   - Ampliar `AdminTabType` para incluir `'analytics'`.
2. **`components/DashboardView.tsx` (Nuevo Archivo)**:
   - Encabezado con selector de rango temporal general (7 días, Hoy, Mes).
   - Fila de KPIs calculados dinámicamente con Recharts mini-trends.
   - Gráfico de Ventas e Ingresos en el tiempo (`ResponsiveContainer`, `AreaChart`, `XAxis`, `YAxis`, `Tooltip`, `Area`).
   - Gráfico de Métodos de Pago (`PieChart`, `Pie`, `Cell`, `Legend`, `Tooltip`).
   - Gráfico de Top Productos (`BarChart` horizontal con ranking).
   - **Módulo de Auditoría Diaria de Productos**:
     - Selector de fecha nativo con botones de acceso rápido ("Hoy", "Ayer").
     - Resumen métrico del día seleccionado.
     - Buscador de texto en vivo y selector de categoría.
     - Tabla ordenada por unidades o recaudación, con barra porcentual de volumen.
     - Botón de descarga de informe diario en formato CSV.
3. **`components/AdminCRM.tsx`**:
   - Agregar el botón de la pestaña `'analytics'` en la barra lateral con icono descriptivo.
   - Conectar el renderizado de `DashboardView` pasando `orders`, `products`, `categories` y `settings`.
4. **Verificación y Compilación**:
   - Ejecutar `compile_applet` para garantizar cero errores de TypeScript y empaquetado de producción exitoso.
