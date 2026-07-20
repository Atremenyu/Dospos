# 🚀 DosPOS - Sistema de Punto de Venta y Gestión Gastronómica en Tiempo Real

**DosPOS** es un sistema inteligente y robusto de **Punto de Venta (POS)** y **Monitor de Cocina (KDS)** diseñado especialmente para restaurantes, eventos gastronómicos, cafeterías y bares. El sistema destaca por una interfaz visualmente impecable, transiciones fluidas de alta calidad, y una arquitectura ultra-reactiva sincronizada en tiempo real mediante **WebSockets**.

---

## 🎨 Concepto y Filosofía de Diseño

El sistema está construido siguiendo los estándares más altos de diseño interactivo:
- **Tema Slate Moderno**: Interfaz oscura elegante con acentos vibrantes, diseñada para reducir la fatiga visual en entornos de alta velocidad como cocinas y barras de cobro.
- **Micro-interacciones Fluidas**: Animaciones con `motion` que guían la atención del usuario en transiciones de platos, cambios de estado y flujos de pantallas.
- **Honestidad Arquitectónica**: Sin métricas de relleno ni datos falsos. Toda la información en pantalla corresponde a transacciones y estados reales de la operación del local.

---

## ⚡ Características Destacadas

1. **Sincronización Bidireccional de Alto Rendimiento (WebSockets)**:
   - Cuando se añade un producto, se actualiza una mesa o se despacha un plato, el cambio se refleja de inmediato en todas las pantallas (POS de meseros, Caja y KDS de Cocina) sin necesidad de recargar la página.
2. **Motor de Reconciliación de Conflictos Avanzado (Conflict Reconciliation Engine)**:
   - En entornos multi-dispositivo con escrituras simultáneas, el sistema implementa una lógica de reconciliación basada en marcas de tiempo (`updatedAt` en formato ISO 8601). En caso de conflicto de red o desconexión temporal, el servidor resuelve de forma determinista la última escritura (*Last-Write-Wins*).
   - **Fusión Inteligente de Comandas**: Si las marcas de tiempo coinciden, se utiliza un algoritmo de priorización basado en el estado (los estados terminales como `delivered` o `cancelled` tienen prioridad sobre estados transitorios), presencia de pagos registrados y desglose de artículos de mayor volumen para asegurar que ningún pago o artículo se pierda.
   - **Integración Segura en Bloque (Bulk Sync)**: Al guardar o sincronizar en bloque, el servidor fusiona de manera selectiva cada entidad (ingredientes, productos, turnos, comandas) de forma atómica e inteligente por su ID en lugar de sobrescribir el estado completo.
3. **Mecanismo de Sondeo de Respaldo Redundante (Fallback Polling)**:
   - En redes inestables o entornos donde los WebSockets sufren interrupciones, el sistema activa automáticamente un sondeo silencioso cada 5 segundos. Este sondeo consulta de manera segura el servidor REST y actualiza el estado de forma progresiva, garantizando redundancia absoluta sin sobrecargar la red ni interrumpir la experiencia de usuario.
4. **Gestión Inteligente de Productos Extras**:
   - Al agregar productos a una mesa que ya está en preparación, la comanda **no regresa al estado pendiente de forma global** para no confundir al chef. En su lugar, el sistema resalta los nuevos items con etiquetas parpadeantes (`🚨 NUEVO / COLA`) permitiendo una preparación continua y sin fricciones.
5. **Control Individualizado de Platos**:
   - Cada artículo dentro de un pedido tiene su propio estado de preparación (`Pendiente`, `Preparando`, `Listo`, `Entregado`). Esto permite que la cocina despache las entradas, los platos fuertes y las bebidas a ritmos independientes.
6. **Resiliencia Desconectada (Dual-Sync Engine)**:
   - Los datos se guardan tanto en el almacenamiento local (`localStorage`) de manera inmediata como en el servidor. Al iniciar, el sistema es capaz de inicializarse automáticamente y autorrecuperarse en caso de caídas de red.

---

## 📂 Módulos y Secciones del Sistema

### 📊 1. Panel de Control (Dashboard)
La central de inteligencia del negocio, ideal para administradores y dueños.
- **Métricas de Rendimiento (KPIs)**: Ingresos totales de la jornada, ticket promedio por mesa, volumen total de órdenes y porcentaje de ocupación de salón en tiempo real.
- **Gráfico de Tendencias**: Histórico de ventas de los últimos 7 días impulsado por visualizaciones dinámicas de `recharts`.
- **Mix de Pagos**: Gráfico de pastel que ilustra la distribución porcentual de los cobros (Efectivo, Tarjeta, Transferencia, Pago Móvil).
- **Productos Estrella**: Ranking en tiempo real de los 5 platos más vendidos del restaurante con barras de progreso de popularidad.

### 🛒 2. Punto de Venta (POS)
La pantalla ágil donde los meseros o cajeros operan y capturan pedidos.
- **Tipo de Servicio**: Alternación rápida entre **Comedor (Dine-in)** y **Para Llevar (Takeaway)**.
- **Flujo de Carrito Dinámico**:
  - Ajuste de cantidades instantáneo con validación inteligente.
  - Gestión de modificadores o ingredientes extra para platos personalizados.
- **Pantalla de Cierre de Caja**: Flujo de cobro integrado donde se asocia el nombre del cliente, método de pago y procesamiento de facturación inmediato.

### 🪑 3. Plano de Salón y Mesas
Una representación gráfica y visual del estado del salón.
- **Estados de Ocupación**: Las mesas cambian de color (Blanco para disponibles, Rojo/Gris oscuro para ocupadas) e indican visualmente el tiempo que llevan activas.
- **Acceso Directo**: Al hacer clic sobre cualquier mesa vacía, el sistema redirecciona automáticamente al POS con dicha mesa pre-seleccionada para acelerar el servicio.

### 👨‍🍳 4. Monitor de Cocina (KDS - Kitchen Display System)
El corazón operativo de la preparación de alimentos.
- **Tarjetas de Comanda Dinámicas**: Cada pedido entrante se muestra en forma de tarjeta bento, agrupando los items por preparar.
- **SLA y Temporizadores de Alerta**:
  - El sistema calcula y muestra un cronómetro en tiempo real según el tiempo estimado de preparación.
  - Colores dinámicos de semáforo: **Verde** (en tiempo), **Naranja** (límite próximo) y **Rojo Parpadeante** (pedido demorado).
- **Ajuste de Tiempos**: Capacidad de añadir o restar minutos extra a una preparación en curso directamente desde la interfaz con un selector emergente de reloj.

### 📜 5. Historial de Ventas y Analíticas Avanzadas
Módulo de auditoría, control financiero y reportería.
- **Auditoría de Transacciones**: Historial completo de comandas pagadas, pendientes o anuladas.
- **Anulación Segura**: Permite reembolsar o cancelar órdenes restaurando el flujo correspondiente.
- **Exportación en un Clic**:
  - Descarga del registro completo en formato **CSV** compatible con Excel para contabilidad.
  - Generación de tickets/facturas de cobro en formato **PDF** profesionales listos para imprimir o enviar.

### ⚙️ 6. Configuración y CRUD de Catálogo
El centro de personalización del negocio.
- **Datos de Identidad**: Modificación del nombre del restaurante e identidad del negocio.
- **CRUD de Productos e Ingredientes**: Interfaz visual intuitiva para crear, editar, subir imágenes, asignar precios y categorizar todo el catálogo de platillos.

---

## 🔄 Flujo Operativo Estándar (Caso de Uso)

1. **Apertura de Turno**: El cajero inicia sesión y registra la base de efectivo inicial.
2. **Toma de Pedido**: El mesero selecciona la **Mesa 5** en el Plano de Mesas. Añade 2 Hamburguesas Especiales y 1 Refresco al carrito, asignando el cliente "Familia Gómez" y envía el pedido a cocina.
3. **Cocina en Acción (KDS)**: El monitor de cocina emite una alerta visual instantánea. El chef presiona **"COMENZAR"** en los items individuales para pasarlos a preparación.
4. **Adición Extra (El "Producto Extra")**: A mitad del servicio, la mesa solicita una ración de Papas Fritas Extra. El mesero las añade al carrito de la Mesa 5 y confirma.
   - *Comportamiento Inteligente*: En cocina, la comanda original sigue en preparación activa. Las nuevas papas aparecen al final de la lista con una etiqueta llamativa `🚨 NUEVO / COLA`, informando al cocinero de la adición sin reiniciar los tiempos de los platillos que ya están listos.
5. **Entrega de Platillos**: El cocinero marca las hamburguesas y papas como listos. El mesero las entrega en mesa y el estado cambia a `Entregado`.
6. **Cobro y Ticket (Caja)**: El cliente pide la cuenta. El cajero accede a la mesa, selecciona el método de pago (Tarjeta), finaliza la orden, el sistema libera la mesa en tiempo real y genera el ticket de venta en **PDF** para el cliente.

---

## 🛠️ Stack Tecnológico

El proyecto está construido con un enfoque de alto rendimiento, código limpio y tipo-seguro:

- **Frontend**:
  - `React 19` (Functional Components & Hooks).
  - `Vite` (Empaquetador ultra-rápido).
  - `Tailwind CSS v4` (Estilos utilitarios de última generación).
  - `Motion` (Animaciones interactivas premium).
  - `Recharts` y `d3` (Visualización interactiva de gráficos estadísticos).
  - `jspdf` (Generación de comprobantes y tickets PDF del lado del cliente).
- **Backend (Full-stack Server)**:
  - `Express 5` (Servicio de endpoints REST).
  - `ws` (WebSocket Server para conectividad persistente bidireccional).
  - `esbuild` (Compilador y bundler de backend de velocidad extrema para producción).
  - `tsx` (Ejecución de TypeScript en caliente para desarrollo).

---

## 🚀 Instrucciones de Inicio Rápido

### Requisitos Previos
Tener instalado Node.js (versión 18 o superior).

### Instalación de dependencias
```bash
npm install
```

### Ejecutar en Desarrollo
```bash
npm run dev
```
El servidor se iniciará en `http://localhost:3000` con sincronización WebSocket activa de inmediato.

### Compilar para Producción
```bash
npm run build
```

---

*Desarrollado con dedicación para ofrecer la mejor experiencia gastronómica, tanto para el comensal como para el equipo de trabajo en sala y cocina.*
