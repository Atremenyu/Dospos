# 📘 DOCUMENTACIÓN TÉCNICA Y OPERATIVA INTEGRAL - SISTEMA DOSPOS
> **Versión del Documento:** 2.0 (AI-Ready & Enterprise Standard)  
> **Propósito:** Guía exhaustiva de arquitectura, mapa de componentes, catálogo de controles/botones y manual operativo para inteligencias artificiales, desarrolladores y administradores.

---

## 📑 ÍNDICE GENERAL
1. [Visión General del Sistema y Arquitectura](#1-visión-general-del-sistema-y-arquitectura)
2. [Estructura del Proyecto y Árbol de Componentes](#2-estructura-del-proyecto-y-árbol-de-componentes)
3. [Diccionario de Datos y Modelos (TypeScript Entities)](#3-diccionario-de-datos-y-modelos-typescript-entities)
4. [Sincronización en Tiempo Real y Persistencia (WebSocket & Offline-First)](#4-sincronización-en-tiempo-real-y-persistencia-websocket--offline-first)
5. [Catálogo Completo de Componentes, Vistas y Herramientas](#5-catálogo-completo-de-componentes-vistas-y-herramientas)
   - 5.1. TabNavigation (Barra de Navegación Global)
   - 5.2. LoginView & Shifts (Control de Asistencia y PIN-Pad)
   - 5.3. ActiveOrdersSlider (Monitor Superior de Pedidos Activos)
   - 5.4. POSView (Punto de Venta y Carrito)
   - 5.5. TablesView (Plano Gráfico de Salón y Cobro de Mesas)
   - 5.6. DispatchView (KDS - Monitor de Cocina en Tiempo Real)
   - 5.7. AdminCRM & Submódulos (Panel de Control y Configuración)
   - 5.8. Modales del Sistema (Apertura, Cierre, Combos, Modificadores, Confirmaciones)
6. [Catálogo Funcional de Botones y Controles por Módulo](#6-catálogo-funcional-de-botones-y-controles-por-módulo)
7. [Guías Paso a Paso de Procesos Operativos Clave](#7-guías-paso-a-paso-de-procesos-operativos-clave)
   - 7.1. Cómo Realizar una Venta (Mesa, Para Llevar, Domicilio, Apps Uber/DiDi)
   - 7.2. Cómo Crear / Agregar un Nuevo Producto (con Modificadores, Combos y Receta)
   - 7.3. Cómo Cerrar una Cuenta de Mesa (Cobro Total y División de Cuenta)
   - 7.4. Cómo Despachar un Pedido Para Llevar o a Domicilio en Cocina
   - 7.5. Cómo Realizar la Apertura y el Cierre / Corte de Caja (Ticket Z)
8. [Motor de Promociones y Descuentos Automáticos](#8-motor-de-promociones-y-descuentos-automáticos)
9. [Motores de Impresión: Térmica 80mm Directa vs PDF](#9-motores-de-impresión-térmica-80mm-directa-vs-pdf)
10. [Seguridad, Auditoría y Roles (RBAC)](#10-seguridad-auditoría-y-roles-rbac)

---

## 1. VISIÓN GENERAL DEL SISTEMA Y ARQUITECTURA

**DosPOS** es una suite completa de Punto de Venta (POS), Monitor de Cocina (KDS), Administración de Salón (Mesas) y Control de Negocio (CRM/ERP gastronómico) diseñada bajo el paradigma **Offline-First & Multi-Device Hybrid**.

### Principios Fundamentales:
* **Frontend React 19 + TypeScript**: Interfaz rápida, tipada y reactiva montada sobre Vite.
* **Backend Express 5 + WebSocket (ws)**: Servidor monolítico liviano (`server.ts`) que expone API REST en `/api/db` y canal bidireccional WebSocket para eventos instantáneos en la red local o remota.
* **Persistencia Atómica Dual**: Todos los cambios se consolidan en el almacenamiento local del navegador (`localStorage`) y se transmiten inmediatamente al servidor donde se escriben en disco (`data/db.json`) mediante renombrado atómico (`renameSync`) y respaldo continuo (`db.json.bak`).
* **Resiliencia de Red**: Si el canal WebSocket se interrumpe, el cliente activa de inmediato un *Fallback Polling* cada 5 segundos mediante peticiones `GET /api/db`.
* **Motor Anticolisiones y Reconciliación**:
  * Resolución por marcas de tiempo ISO 8601 (`updatedAt`) con política determinista *Last-Write-Wins*.
  * Resolución jerárquica de comandas: los estados terminales (`delivered`, `cancelled`) tienen prioridad sobre estados provisionales (`pending`, `preparing`), resguardando los cobros e ítems despachados.
* **Control de Cocina Independiente**: Permite cambiar el estado de la comanda de forma global o platillo por platillo (`CartItem.status`), calculando automáticamente el estado maestro del pedido.

---

## 2. ESTRUCTURA DEL PROYECTO Y ÁRBOL DE COMPONENTES

```text
/
├── server.ts                       # Servidor Express, WebSocket Hub y persistencia en disco
├── App.tsx                         # Componente raíz, orquestador de estado global y sincronización
├── types.ts                        # Definición exhaustiva de interfaces y tipos de TypeScript
├── constants.tsx                   # Catálogo de iconos SVG, roles iniciales y datos semilla
├── services/
│   ├── storage.ts                  # Capa de abstracción de localStorage y comunicación API/WS
│   ├── thermalPrinter.ts           # Motor de generación e impresión térmica directa (80mm ESC/POS HTML)
│   └── pdfGenerator.ts             # Motor de generación de tickets y precuentas en formato PDF (jspdf)
├── utils/
│   ├── paymentUtils.ts             # Algoritmo de cálculo de billetes de cambio rápido (Quick Cash)
│   ├── ticketFormatters.ts         # Funciones de formateo de moneda, fecha, hora e impuestos
│   ├── numberToWords.ts            # Conversor de importes numéricos a texto formal (pesos/moneda)
│   └── promotionsEngine.ts         # Motor de validación de reglas temporales y aplicación de descuentos
├── components/
│   ├── TabNavigation.tsx           # Barra superior de navegación por pestañas y control de roles
│   ├── ActiveOrdersSlider.tsx      # Barra flotante superior tipo slider con comandas en curso
│   ├── LoginView.tsx               # Pantalla de acceso con PIN-Pad de 4 dígitos y Clock-In
│   ├── SetupWizard.tsx             # Asistente de configuración inicial para instalaciones limpias
│   ├── POSView.tsx                 # Módulo de venta, grilla de menú, búsqueda y cobro
│   ├── ModifierModal.tsx           # Modal interactivo para seleccionar modificadores e ingredientes
│   ├── ComboModal.tsx              # Asistente paso a paso para configurar paquetes/combos
│   ├── TablesView.tsx              # Plano de salón interactivo, cobro de mesas y división de cuentas
│   ├── DispatchView.tsx            # Monitor de cocina (KDS) con tarjetas Kanban, timers y semáforos
│   ├── HistoryView.tsx             # Historial de ventas, reimpresión, anulación y exportación CSV
│   ├── CashShiftView.tsx           # Módulo de auditoría y arqueo de turnos de caja
│   ├── CashOpeningModal.tsx        # Modal de apertura de turno con fondo inicial
│   ├── CashClosingModal.tsx        # Modal de cierre ciego de caja con conciliación de efectivo
│   ├── ConfirmationModal.tsx       # Modal de confirmación genérica para operaciones críticas
│   ├── AdminCRM.tsx                # Panel maestro de administración con barra lateral
│   ├── DashboardView.tsx           # Analíticas en tiempo real (Recharts) y control de ventas por producto por día
│   ├── ProductManagement.tsx       # CRUD de productos, categorías, inventario, mesas y ajustes
│   └── PromotionsManager.tsx       # Gestor y programador de reglas de promociones y descuentos
└── data/
    └── db.json                     # Archivo de base de datos persistente en disco
```

### Grafo de Conexiones de Estado:
```text
                          ┌─────────────┐
                          │  server.ts  │ (Express + WS + db.json)
                          └──────┬──────┘
                                 │ WebSockets / HTTP
                                 ▼
                          ┌─────────────┐
                          │   App.tsx   │ ── Master State (orders, products, tables,
                          └──────┬──────┘    cashShifts, users, ingredients, promotions)
                                 │
     ┌───────────────────────────┼───────────────────────────┬───────────────────────────┐
     ▼                           ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│  LoginView   │          │   POSView    │            │  TablesView  │            │ DispatchView │
└──────────────┘          └──────┬───────┘            └──────┬───────┘            └──────────────┘
                                 │                           │
                   ┌─────────────┴─────────────┐             ├──────────────────────────┐
                   ▼                           ▼             ▼                          ▼
            ┌──────────────┐            ┌──────────────┐┌──────────────┐         ┌──────────────┐
            │ModifierModal │            │  ComboModal  ││Preticket PDF/│         │Split Account │
            └──────────────┘            └──────────────┘│   Térmico    │         │  (División)  │
                                                        └──────────────┘         └──────────────┘
                                 │
     ┌───────────────────────────┴───────────────────────────┐
     ▼                                                       ▼
┌──────────────┐                                      ┌──────────────┐
│   AdminCRM   │                                      │ Cash Shifts  │
└──────┬───────┘                                      │(Open / Close)│
       │                                              └──────────────┘
       ├─► Overview (Dashboard KPIs)
       ├─► HistoryView (Auditoría de ventas)
       ├─► ProductManagement (Productos, Categorías, Recetas, Mesas, Roles, Usuarios, Respaldo)
       └─► PromotionsManager (Reglas comerciales)
```

---

## 3. DICCIONARIO DE DATOS Y MODELOS (TYPESCRIPT ENTITIES)

### `Product`
Representa un artículo del catálogo a la venta:
* `id` (`string`): Identificador único (ej. `prod_123456789`).
* `name` (`string`): Nombre comercial del producto.
* `price` (`number`): Precio base de venta.
* `category` (`string`): Categoría a la que pertenece (debe existir en `categories`).
* `modifierGroups` (`ModifierGroup[]`): Grupos de opciones de personalización (extras, aderezos, términos).
* `hasCombo` (`boolean`): Bandera que indica si el producto es un combo o paquete.
* `comboOptions` (`ComboOption[]`): Opciones seleccionables dentro del combo con cargos adicionales opcionales.
* `recipe` (`RecipeItem[]`): Receta base para descontar ingredientes de inventario al venderse.
* `updatedAt` (`string`): Marca de tiempo ISO para resolución de sincronización.

### `CartItem`
Extensión de `Product` utilizada en la cesta del POS y dentro de `Order.items`:
* Propiedades heredadas de `Product`.
* `quantity` (`number`): Cantidad de unidades ordenadas.
* `paidQuantity` (`number`): Cantidad de unidades liquidadas en cobros parciales o divididos.
* `note` (`string`): Comentario especial de cocina (ej. *"Sin cebolla, bien cocido"*).
* `status` (`OrderStatus`): Estado individual de preparación (`pending`, `preparing`, `ready`, `delivered`, `cancelled`).
* `selectedModifiers` (`SelectedModifier[]`): Lista de modificadores seleccionados por el cliente con su precio extra.
* `isCombo` (`boolean`): Si se ordenó bajo la modalidad de combo.
* `selectedComboOptions` (`ComboOption[]`): Opciones elegidas para los componentes del combo.

### `Order`
Registro central de cada comanda o venta:
* `id` (`string`): Identificador único (ej. `ord_1710920000000_abc123`).
* `orderNumber` (`number | string`): Número correlativo diario del 1 al 99 (se reinicia cada jornada).
* `movementNumber` (`string`): Folio histórico continuo de auditoría de ventas.
* `date` (`string`): Fecha y hora ISO de creación de la comanda.
* `client` (`string`): Nombre del cliente o etiqueta de la orden.
* `address` (`string | undefined`): Dirección de entrega (obligatoria para servicio a Domicilio).
* `table` (`string`): Nombre de la mesa asignada o *"Mostrador"*.
* `diners` (`number`): Número de comensales sentados en la mesa.
* `waiter` (`string`): Nombre del mesero o cajero que levantó el pedido.
* `payment` (`PaymentMethod`): Método principal de pago (`Efectivo`, `Tarjeta`, `Transferencia`, `Uber`, `Didi`, `Cortesía`, `Pendiente`).
* `status` (`OrderStatus`): Estado global de la comanda (`pending`, `preparing`, `ready`, `delivered`, `cancelled`).
* `type` (`OrderType`): Tipo de servicio (`dine-in` para Comedor/Salón, `takeaway` para Fuera de Salón).
* `takeawayType` (`TakeawayType | undefined`): Subclasificación (`local` para Llevar, `delivery` para Domicilio, `uber` para Uber Eats, `didi` para DiDi Food).
* `total` (`number`): Total neto cobrado o por cobrar.
* `tip` (`number`): Monto de propina agregada a la cuenta.
* `items` (`CartItem[]`): Colección de platillos incluidos en la orden.
* `isPaid` (`boolean`): Indica si la orden está totalmente liquidada.
* `payments` (`PaymentRecord[]`): Arreglo con el desglose de pagos registrados (soporta múltiples pagos divididos).
* `estimatedMinutes` (`number | undefined`): Tiempo pactado de elaboración en cocina.
* `preparingAt` (`string | undefined`): Timestamp en que la cocina pasó la orden a `preparing`.
* `readyAt` (`string | undefined`): Timestamp en que la orden pasó a `ready`.
* `preticketPrintedAt` (`string | undefined`): Timestamp en que se imprimió la precuenta.
* `closedAt` (`string | undefined`): Timestamp en que se procesó el cobro final.
* `receivedAmount` (`number | undefined`): Efectivo entregado por el cliente.
* `changeAmount` (`number | undefined`): Cambio devuelto al cliente.
* `discountAmount` (`number | undefined`): Descuento total aplicado por promociones.
* `discountReason` (`string | undefined`): Nombre de la promoción aplicada.
* `appliedPromotionId` (`string | undefined`): ID de la promoción configurada.
* `subtotalBeforeDiscount` (`number | undefined`): Subtotal original antes de la promoción.

### `CashShift`
Registro de auditoría y arqueo de caja por turno de trabajo:
* `id` (`string`): Identificador único del turno.
* `userId` (`string`), `userName` (`string`): Identidad del cajero responsable.
* `openingTime` (`string`): Fecha y hora ISO de apertura.
* `closingTime` (`string | undefined`): Fecha y hora ISO de corte.
* `initialFund` (`number`): Fondo inicial de caja (morralla de apertura).
* `expectedAmount` (`number`): Importe total esperado según el sistema (`initialFund` + Efectivo + Tarjeta + Transferencia).
* `actualAmount` (`number`): Importe total físico reportado en el arqueo.
* `difference` (`number`): Descuadre global (`actualAmount - expectedAmount`).
* `expectedCash`, `actualCash`, `differenceCash` (`number`): Conciliación específica de efectivo.
* `expectedTarjeta`, `actualTarjeta`, `differenceTarjeta` (`number`): Conciliación de terminal bancaria.
* `expectedTransferencia`, `actualTransferencia`, `differenceTransferencia` (`number`): Conciliación de transferencias.
* `expectedOtros` (`number`): Ventas de plataformas (Uber / DiDi).
* `expectedCourtesy` (`number`): Importe cubierto por cortesías del negocio.
* `categoryBreakdown` (`CategorySalesSummary[]`): Desglose contable de artículos y dinero vendido por cada categoría del menú durante el turno.
* `totalArticlesSold` (`number`): Suma total de unidades vendidas.
* `status` (`'open' | 'closed'`): Estado operativo de la caja.
* `notes` (`string | undefined`): Justificaciones u observaciones del cajero.

### `Ingredient`
Materia prima e insumos de cocina:
* `id` (`string`), `name` (`string`): Identificador y nombre del insumo.
* `stock` (`number`): Existencias físicas reales actuales.
* `minStock` (`number`): Umbral mínimo de existencias para emitir alertas preventivas.
* `unit` (`'g' | 'ml' | 'unit'`): Unidad de medida (gramos, mililitros o piezas).

### `Promotion`
Regla comercial para descuentos automáticos:
* `id` (`string`), `name` (`string`): Identificador y nombre de la oferta.
* `type` (`PromotionType`): Mecánica (`two_for_one`, `three_for_two`, `percentage`, `fixed_amount`, `special_price`).
* `discountValue` (`number`): Porcentaje o monto descontado.
* `applicableProductIds` (`string[]`): Productos específicos a los que aplica.
* `applicableCategories` (`string[]`): Categorías enteras donde aplica.
* `minOrderAmount` (`number | undefined`): Consumo mínimo requerido.
* `daysOfWeek` (`number[]`): Días permitidos (0=Domingo, 1=Lunes, ..., 6=Sábado). Vacío = todos los días.
* `startTime` (`string`), `endTime` (`string`): Rango horario (ej. `"18:00"` a `"22:00"`).
* `isActive` (`boolean`): Conmutador de activación.

---

## 4. SINCRONIZACIÓN EN TIEMPO REAL Y PERSISTENCIA (WEBSOCKET & OFFLINE-FIRST)

### Arquitectura de Red y Ciclo de Mensajes
1. **Conexión Inicial (`INIT`)**:
   * Al cargar la app, se realiza una petición HTTP a `GET /api/db`.
   * En paralelo, el cliente abre una conexión WebSocket hacia `ws://[host]:3000`.
   * El servidor responde enviando el mensaje `{ type: "INIT", state: dbState }`.
   * Si el servidor está completamente vacío y el cliente tiene datos locales en `localStorage`, el cliente los inyecta al servidor mediante `storage.saveBulk()`.
2. **Difusión en Tiempo Real (`UPDATE`)**:
   * Cualquier cambio (creación de comanda, pase a preparación en cocina, cobro en salón o ajuste de inventario) ejecuta `storage.save*()`.
   * `storage.ts` guarda en `localStorage` e inmediatamente envía un mensaje WebSocket:
     ```json
     {
       "type": "UPDATE",
       "key": "orders",
       "data": [ ...orders ]
     }
     ```
   * El servidor actualiza `dbState`, guarda a disco de forma segura y retransmite el mensaje a todos los demás clientes conectados (excluyendo o incluyendo al remitente).
3. **Manejo de Desconexión y Respaldo en Segundo Plano (Fallback Polling)**:
   * Si la conexión WebSocket se cae, se programa un intento de reconexión automático (`reconnectTimeout`).
   * Adicionalmente, el cliente activa una consulta HTTP recurrente cada 5 segundos contra `GET /api/db` para no perder ninguna comanda generada por otros terminales.
4. **Control de Concurrencia**:
   * Si dos meseros modifican simultáneamente la misma orden, la función del servidor `reconcileTwoOrders()` analiza las marcas de tiempo `updatedAt`.
   * Si una terminal envía una orden con estado `delivered` o `isPaid: true`, prevalece sobre estados anteriores para evitar que un cobro sea revertido por una comanda no actualizada.

---

## 5. CATÁLOGO COMPLETO DE COMPONENTES, VISTAS Y HERRAMIENTAS

### 5.1. `TabNavigation.tsx` (Barra Superior de Navegación)
Barra fija en la parte superior que ofrece cambio de módulos y control de estado:
* **Logo y Marca del Negocio**: Muestra el nombre comercial configurado en los ajustes.
* **Pestañas de Navegación**:
  * `POS` (Caja / Ventas): Acceso al punto de venta.
  * `Mesas` (Salón): Acceso al plano de mesas.
  * `Cocina` (Despacho / KDS): Acceso a la cola de preparación con contador dinámico de comandas pendientes (`pendingCount`).
  * `Central` (Administración / CRM): Acceso a la suite ejecutiva.
* **Badge de Caja**: Botón interactivo que indica `Caja: Abierta` (verde) o `Caja: Cerrada` (rojo). Al hacer clic permite realizar el corte de caja si está abierta, o redirige a la apertura si está cerrada.
* **Botón de Pedidos Activos**: Alterna la visualización del slider superior flotante (`ActiveOrdersSlider`).
* **Indicador de Usuario y Perfil**: Muestra el nombre del usuario logueado y su rol asignado.
* **Botón de Salir (Cerrar Sesión)**: Abre el modal de confirmación de salida, finalizando el turno laboral del usuario (`endTime`).

### 5.2. `LoginView.tsx` (Acceso Seguro con PIN-Pad)
Pantalla neobrutalista para control de acceso y registro de personal:
* **Lista de Empleados / Usuarios**: Selector visual de colaboradores registrados.
* **Teclado Numérico en Pantalla (PIN-Pad)**: Botones del 0 al 9, botón de borrado (`Borrar`) y botón de confirmación (`Entrar`).
* **Modo Clock-In / Clock-Out**: Registra la hora exacta de inicio de turno en `shifts`.
* **Detección Automática de Caja**: Si el usuario que ingresa tiene rol `Admin` o `Caja` y la caja está cerrada, se despliega automáticamente el modal `CashOpeningModal`.

### 5.3. `ActiveOrdersSlider.tsx` (Slider Superior de Pedidos)
Barra horizontal retráctil que muestra todas las comandas en preparación o listas:
* Tarjetas compactas con folio, mesa/cliente, tiempo transcurrido y botón de acción rápida para marcar `Listo` o `Entregado`.

### 5.4. `POSView.tsx` (Punto de Venta)
Módulo principal de captura de pedidos. Se divide en dos paneles:
* **Panel Izquierdo (Catálogo y Menú)**:
  * **Barra de Búsqueda**: Filtrado instantáneo por texto en tiempo real.
  * **Pestañas de Categorías**: Filtra los platos por categoría (`Todos`, `Hamburguesas`, `Bebidas`, etc.).
  * **Cuadrícula Bento de Productos**: Tarjetas con nombre, precio, indicador de combos y etiqueta de modificadores.
* **Panel Derecho (Carrito y Flujo de Cobro)**:
  * **Selector de Tipo de Servicio**: 
    * `Comedor (Mesa)`: Despliega el selector de mesas físicas.
    * `Llevar`: Venta para recoger en mostrador.
    * `Domicilio`: Activa el campo de texto obligatorio para capturar la **Dirección de Envío**.
    * `Uber / DiDi`: Setea automáticamente el canal de app y el método de pago externo.
  * **Listado del Carrito**: Permite modificar cantidades (`+` y `-`), eliminar productos, y presionar el botón de **Nota** para ingresar instrucciones de cocina.
  * **Desglose Económico**: Muestra Subtotal, Descuento por Promoción (si aplica), Propinas y Total General.
  * **Botón "Continuar"**: Lleva a la pantalla de liquidación y pago, posicionando el scroll en la cabecera para revisar los datos de cliente y entrega.
  * **Sección de Pago y Quick Cash**:
    * Botones de método: `Efectivo`, `Tarjeta`, `Transferencia`, `Cortesía` (requiere autorización PIN de administrador).
    * Botones de denominación rápida (Quick Cash): Calculan el cambio inmediato para billetes comunes ($100, $200, $500, etc.).
    * Botón `Pagar Después`: Guarda la orden como `Pendiente` para pagar al terminar en comedor.
    * Botón `Confirmar Orden`: Guarda la comanda, descuenta insumos de inventario, envía a cocina y abre la impresión del ticket.

### 5.5. `TablesView.tsx` (Gestión de Mesas y Salón)
Plano visual e interactivo de la distribución del restaurante:
* **Buscador de Mesas**: Localiza mesas por nombre o número.
* **Tarjetas de Mesa**:
  * **Blanca / Libre**: Mesa disponible. Al hacer clic redirige al POS con la mesa preseleccionada.
  * **Roja / Ocupada**: Mesa con comensales activos. Muestra el total acumulado y tiempo de consumo.
* **Panel Lateral de Mesa Ocupada**:
  * **Detalle de Consumo**: Lista de platillos ordenados con sus modificadores.
  * **Botón "Agregar Más Productos"**: Regresa al POS conservando la mesa para añadir rondas de comida/bebida.
  * **Botón "Precuenta Térmica"**: Imprime el ticket de precuenta de 80mm para el comensal.
  * **Botón "Precuenta PDF"**: Descarga el archivo PDF de la precuenta.
  * **Botón "Cobro Directo"**: Permite liquidar la mesa en su totalidad.
  * **Botón "Dividir Cuenta"**: Activa el asistente de cobro parcial por artículos o por partes iguales.
  * **Botón "Liberar / Cancelar Mesa"**: Anula la orden y libera la mesa (con confirmación).

### 5.6. `DispatchView.tsx` (Monitor de Cocina KDS)
Pantalla para el personal de cocina y despacho sin necesidad de comandas de papel:
* **Columnas de Flujo Kanban**:
  * `En Cola (Pendiente)`: Pedidos recién tomados en espera de entrar a fuego.
  * `Preparando`: Pedidos en elaboración activa con cronómetro regresivo visible.
  * `Listo`: Pedidos concluidos listos para servirse o empaquetarse.
* **Herramientas de Tarjeta de Comanda**:
  * **Temporizador Regresivo**: Muestra los minutos restantes con semáforo dinámico (Verde, Amarillo, Rojo).
  * **Botón de Ajuste de Minutos (`+5m / -5m`)**: Permite sumar o restar tiempo de preparación ante saturación.
  * **Checkboxes por Platillo**: Permite tachar platos individuales a medida que salen de la plancha/barra.
  * **Botón "Comenzar Preparación"**: Cambia el estado a `preparing` y activa el reloj.
  * **Botón "Marcar Listo"**: Pasa la orden a `ready` y emite una alerta sonora en barra y salón.
  * **Botón "Entregado"**: Marca la orden como despachada, archivándola fuera de la vista de cocina.
  * **Botón "Imprimir Térmico"**: Imprime la comanda física para pegarla en la bolsa de reparto.

### 5.7. `AdminCRM.tsx` & `ProductManagement.tsx` (Central de Control)
Panel administrativo integral con barra de navegación lateral:
* **1. Dashboard (Overview)**: Métricas ejecutivas en vivo (Ventas Totales, Pedidos, Ticket Promedio, Tasa de Ocupación de Mesas y últimos cierres de caja).
* **2. Analíticas en Tiempo Real (`DashboardView.tsx`)**:
  * **Curva de Ventas en Recharts (`AreaChart`)**: Seguimiento de facturación por horas (vista de hoy) o por días (últimos 7 días, 30 días o histórico).
  * **Mix de Métodos de Pago (`PieChart` Donut)**: Desglose porcentual y monetario de Efectivo, Tarjetas, Transferencias, Uber, DiDi y Cortesías.
  * **Top 10 Productos Más Vendidos (`BarChart` Horizontal)**: Ranking visual de platos más populares en el periodo.
  * **Control de Ventas por Producto Día por Día (Daily Product Inspector)**: Selector de fecha con acceso rápido ("Hoy", "Ayer", flechas anterior/siguiente o selector de calendario), búsqueda instantánea, filtro por categoría, métricas de recaudación y participación %, tabla detallada y exportación en CSV.
* **3. Ventas (HistoryView)**: Tabla histórica completa, filtros por fecha, método de pago y estado. Opciones de exportar a CSV y anular ventas erróneas.
* **4. Cierres de Caja (CashShiftView)**: Historial de arqueos de caja, diferencias de dinero y reimpresión de tickets Z.
* **5. Promociones (PromotionsManager)**: Creación de ofertas (2x1, 3x2, descuentos porcentuales, horarios felices).
* **6. Inventario**: Control de existencias físicas de materias primas por gramaje, mililitros o piezas con umbrales mínimos.
* **7. Productos**: Catálogo completo, altas, bajas, precios, asociación de recetas e importación/exportación en CSV.
* **8. Categorías**: Administrador de familias del menú con importación/exportación en CSV.
* **9. Mesas**: Administrador del plano de salón (alta y renombrado de mesas).
* **10. Usuarios**: Creación de cuentas y contraseñas numéricas (PIN).
* **11. Roles**: Definición de permisos de acceso por rol (`Admin`, `Caja`, `Mesero`, `Cocina`) y permiso especial para autorizar cortesías.
* **12. Turnos**: Registro de horas de entrada y salida del personal laboral.
* **13. Configuración General**:
  * Datos fiscales y de ticket (Nombre del negocio, Dirección Línea 1 y 2, Teléfono, RFC, Correo).
  * Parámetros de cobro (Moneda, Tasa de Impuestos IVA %, Desglose fiscal, Nombre de Terminal).
  * Switches de visibilidad en el ticket térmico (mostrar u ocultar campos específicos).
  * Herramientas de base de datos: Descarga de Respaldo JSON, Restauración de Base de Datos y Reseteo de Fábrica protegido con PIN maestro `9999`.

---

## 6. CATÁLOGO FUNCIONAL DE BOTONES Y CONTROLES POR MÓDULO

| Componente | Control / Botón | Tipo de Elemento | Acción y Efecto en el Sistema |
| :--- | :--- | :--- | :--- |
| **TabNavigation** | Botón Pestaña (`POS`, `Mesas`, etc.) | Botón | Cambia la vista activa del sistema si el rol tiene permiso. |
| **TabNavigation** | Badge `Caja: Abierta / Cerrada` | Botón interactivo | Si está abierta, abre el modal de cierre; si está cerrada, abre el de apertura. |
| **TabNavigation** | Icono Campana / Slider | Botón Toggle | Muestra u oculta la barra superior flotante de pedidos activos. |
| **TabNavigation** | Botón Salir / Logout | Botón | Despliega modal de confirmación y registra el `endTime` laboral del usuario. |
| **POSView** | Pestañas de Categoría | Botones horizontales | Filtran la visualización de platos según la categoría seleccionada. |
| **POSView** | Tarjeta de Producto | Card clicable | Si no tiene variantes, añade 1 unidad al carrito. Si tiene extras o combo, abre sus modales. |
| **POSView** | Botón `+` / `-` en Carrito | Botón de cantidad | Incrementa o decrementa la cantidad. Valida inventario en subida y elimina en 0. |
| **POSView** | Icono Lápiz en Carrito | Botón de texto | Abre un prompt para añadir instrucciones especiales de cocina al plato. |
| **POSView** | Botones de Servicio (`Comedor`, `Llevar`, `Domicilio`, `Apps`) | Selector de Modo | Define el destino de la orden. En Domicilio habilita el campo de dirección; en Apps setea el pago externo. |
| **POSView** | Campo "Dirección de Entrega" | Input de texto | Captura el destino del pedido a domicilio (se imprime destacado en tickets y comandas). |
| **POSView** | Botón "Continuar" | Botón rojo de acción | Avanza a la pantalla de cobro y posiciona automáticamente el scroll en la cabecera. |
| **POSView** | Botones Quick Cash ($100, $200, etc.) | Botones de valor | Fijan el efectivo recibido calculando en pantalla el cambio exacto a devolver. |
| **POSView** | Botón "Pagar Después" | Checkbox / Toggle | Marca la orden como no pagada inmediatamente (`isPaid: false`) para cobro en salón. |
| **POSView** | Botón "Confirmar Orden" | Botón principal de cobro | Valida el pedido, descuenta stock de ingredientes, genera el pedido y dispara el ticket. |
| **TablesView** | Tarjeta de Mesa Libre | Card blanca | Redirige al POS precargando dicha mesa para iniciar la comanda. |
| **TablesView** | Tarjeta de Mesa Ocupada | Card roja | Abre el panel lateral con el estado de cuenta y herramientas de cobro de la mesa. |
| **TablesView** | Botón "Precuenta Térmica" | Botón oscuro | Envía directamente el estado de cuenta a la impresora de tickets de 80mm. |
| **TablesView** | Botón "Precuenta PDF" | Botón de descarga | Descarga el comprobante previo en formato PDF para el cliente. |
| **TablesView** | Botón "Cobro Directo" | Botón de pago | Permite liquidar el 100% de la cuenta, libera la mesa y emite el ticket final. |
| **TablesView** | Botón "Dividir Cuenta" | Botón modal | Abre el asistente de separación de pagos (por platillos o en partes iguales). |
| **DispatchView** | Botón "Comenzar" | Botón ámbar | Cambia el estado de la comanda a `preparing` y activa el reloj SLA. |
| **DispatchView** | Icono Reloj (`+5m / -5m`) | Botón de ajuste | Suma o resta minutos al tiempo pactado de preparación de la comanda. |
| **DispatchView** | Checkbox de Platillo | Casilla individual | Marca como listo un plato individual sin alterar necesariamente los demás. |
| **DispatchView** | Botón "Marcar Listo" | Botón verde | Cambia el estado de la comanda a `ready`, dispara notificación y sonido acústico. |
| **DispatchView** | Botón "Entregado" | Botón negro | Marca la orden como despachada y la remueve de la pantalla de cocina. |
| **DispatchView** | Botón "Imprimir Térmico" | Botón de impresora | Imprime la comanda física para engrapar en la bolsa de despacho. |
| **CashOpeningModal** | Botón "Abrir Turno de Caja" | Botón primario | Valida que el fondo inicial sea >= 0, crea el `CashShift` abierto y desbloquea el POS. |
| **CashClosingModal** | Botón "Confirmar Cierre" | Botón primario | Compara los montos reportados vs esperados, calcula diferencias, cierra el turno e imprime el ticket Z. |

---

## 7. GUÍAS PASO A PASO DE PROCESOS OPERATIVOS CLAVE

### 7.1. CÓMO REALIZAR UNA VENTA
Este proceso cubre la toma de una orden completa desde el POS:

1. **Verificar Estado de Caja**:
   * Asegúrate de que el indicador en la barra superior indique `Caja: Abierta`. Si está cerrada, el sistema te solicitará ingresar el fondo de apertura antes de continuar.
2. **Seleccionar el Tipo de Servicio**:
   * En la columna derecha superior, selecciona una de las 4 opciones:
     * **Comedor**: Haz clic en el botón de mesa para asociar una mesa física del salón.
     * **Llevar**: Para clientes en mostrador que recogerán su pedido en persona.
     * **Domicilio**: Al hacer clic, aparecerá de forma inmediata el campo de texto obligatorio **"Dirección de Envío"**. Escribe calle, número, colonia y referencias.
     * **Apps (Uber / DiDi)**: Si el pedido proviene de plataformas digitales. Se ajustará el método de pago automáticamente.
3. **Seleccionar Productos del Menú**:
   * Haz clic sobre las pestañas de categorías o utiliza el buscador de texto.
   * Al hacer clic en un producto:
     * **Producto estándar**: Se suma directamente al carrito.
     * **Producto con Modificadores**: Se abre el modal `ModifierModal`. Selecciona los extras o especificaciones deseadas y presiona *"Confirmar"*.
     * **Producto tipo Combo**: Se abre el asistente interactivo `ComboModal`. Selecciona los elementos que componen el paquete y presiona *"Confirmar"*.
4. **Personalizar el Pedido (Opcional)**:
   * En el carrito, usa los botones `+` y `-` para modificar cantidades.
   * Haz clic en el icono de lápiz sobre un artículo para ingresar una nota especial de cocina (ej. *"Término medio, aderezo aparte"*).
5. **Continuar al Cobro**:
   * Presiona el botón rojo **"Continuar"** al pie del carrito. La pantalla se desplazará suavemente hacia el inicio superior del panel de cobro.
   * Ingresa el **Nombre del Cliente**.
   * Si es un pedido de Comedor y el cliente desea pagar al retirarse, activa la opción **"Pagar Después"** y presiona **"Confirmar Orden"** (la orden se enviará a cocina y quedará abierta en la mesa).
6. **Procesar el Pago Inmediato**:
   * Si se cobra de inmediato, selecciona el método de pago:
     * **Efectivo**: Haz clic en los botones de dinero rápido (**Quick Cash**) o digita el monto exacto recibido en el casillero de efectivo. El sistema indicará el cambio exacto a devolver en letras verdes.
     * **Tarjeta o Transferencia**: El sistema registrará el total exacto.
     * **Cortesía**: Solo si el rol tiene permiso o ingresando el PIN de administrador.
   * Si el cliente otorga propina, selecciónala en los botones de porcentaje (10%, 15%) o digita una cantidad fija.
7. **Finalizar y Emitir Ticket**:
   * Haz clic en el botón **"Confirmar Orden"**.
   * El sistema:
     1. Descuenta automáticamente los ingredientes de la receta del inventario.
     2. Dispara la comanda a la pantalla de cocina (`DispatchView`) vía WebSocket.
     3. Abre automáticamente la impresión del ticket térmico de 80mm y/o genera el comprobante PDF.
     4. Limpia el carrito para la siguiente transacción.

---

### 7.2. CÓMO CREAR / AGREGAR UN NUEVO PRODUCTO
Procedimiento para registrar un nuevo platillo con extras, combo y receta de inventario:

1. **Ingresar al Panel de Administración**:
   * Dirígete a la pestaña **Central** en la barra superior.
   * En el menú lateral izquierdo, haz clic en **Productos**.
2. **Abrir el Formulario de Nuevo Producto**:
   * En la esquina superior derecha, presiona el botón negro **"+ Nuevo Producto"**.
3. **Completar Datos Básicos**:
   * **Nombre**: Escribe el nombre comercial (ej. *"Hamburguesa BBQ Monster"*).
   * **Precio**: Digita el precio de venta al público en número (ej. `185`).
   * **Categoría**: Selecciona la categoría en la lista desplegable o escribe una nueva.
4. **Configurar Grupos de Modificadores (Opcional)**:
   * En la sección de Modificadores, presiona *"Añadir Grupo"* (ej. *"Elige tu Queso"* o *"Extras Premium"*).
   * Define la regla:
     * `Mínimo de selecciones`: `0` si es opcional, `1` si es obligatorio.
     * `Máximo de selecciones`: Máximo permitido (ej. `3`).
   * Agrega las opciones individuales:
     * Nombre: *"Tocineta Crujiente"*.
     * Precio Extra: `25.00` (o `0` si no tiene costo adicional).
5. **Configurar Paquete / Combo (Opcional)**:
   * Activa el interruptor **"Habilitar modo Combo"**.
   * Agrega las opciones seleccionables (ej. *"Papas Fritas Medianas"*, *"Aros de Cebolla (+$15)"*).
6. **Vincular Receta e Insumos de Inventario**:
   * En la sección *"Receta de Insumos"*, presiona *"Vincular Ingrediente"*.
   * Selecciona el ingrediente (ej. *"Pan de Hamburguesa"*, *"Carne de Res"*).
   * Escribe la cantidad requerida por porción (ej. `1` pieza o `180` gramos).
   * *Resultado*: Cada vez que este plato se venda en el POS, el sistema deducirá exactamente esta cantidad de la existencia física.
7. **Guardar el Producto**:
   * Presiona el botón verde **"Guardar Producto"**. El producto estará disponible de inmediato en todos los terminales POS sin recargar la página.

---

### 7.3. CÓMO CERRAR UNA CUENTA DE MESA (SALÓN)
Procedimiento para cobrar y desocupar una mesa activa:

1. **Acceder al Plano de Salón**:
   * Dirígete a la pestaña **Mesas**.
2. **Seleccionar la Mesa Ocupada**:
   * Ubica la mesa deseada (las mesas activas se muestran en color **Rojo** con el total de consumo y tiempo transcurrido).
   * Haz clic sobre ella para abrir el panel lateral de gestión de cuenta.
3. **Emitir Precuenta (Opcional)**:
   * Para entregarle la cuenta preliminar a los comensales antes del cobro, presiona el botón negro **"Pre-cuenta Térmica"** (para impresora de 80mm) o **"Pre-cuenta PDF"**. El ticket saldrá claramente identificado con el título *"Preticket de Cuenta"*.
4. **Opción A: Cobro Completo Directo**:
   * Si la mesa paga la totalidad en una sola exhibición:
     1. Haz clic en el botón verde **"Cobro Directo"**.
     2. Selecciona el método de pago (`Efectivo`, `Tarjeta` o `Transferencia`).
     3. Si es efectivo, indica la cantidad entregada para el cálculo de cambio.
     4. Agrega propina si corresponde.
     5. Presiona **"Confirmar Cobro"**.
     6. La mesa se liberará instantáneamente, regresando a color **Blanco (Libre)**, y se emitirá el ticket térmico final con el encabezado *"Ticket de Pagado"*.
5. **Opción B: Cobro Dividido (Split Bill)**:
   * Si los clientes desean pagar por separado:
     1. Presiona el botón **"Dividir Cuenta"**.
     2. **Modalidad por Artículos**: Usa los botones `+` y `-` en cada platillo para asignar los artículos específicos que pagará la primera persona.
     3. **Modalidad en Partes Iguales**: Selecciona el número de personas (ej. 3 personas) para dividir el monto total en partes equitativas.
     4. Selecciona el método de pago de esta fracción y presiona **"Cobrar Parte"**.
     5. El sistema registrará el pago parcial en `Order.payments`. Si quedan saldos pendientes, la mesa continuará ocupada reflejando el monto restante.
     6. Al liquidarse el último platillo o fracción, la cuenta se cerrará en su totalidad y la mesa quedará libre.

---

### 7.4. CÓMO DESPACHAR UN PEDIDO PARA LLEVAR O A DOMICILIO EN COCINA
Procedimiento para el personal de cocina, empaque y despacho:

1. **Recepción de la Comanda**:
   * Al confirmarse un pedido para llevar o a domicilio en caja, la pantalla de **Cocina** emitirá una alerta sonora de sirena (*Kitchen Alarm*) y una notificación emergente.
   * La tarjeta aparecerá en la columna izquierda con el estado **"EN COLA"**.
   * Si es un pedido a Domicilio, la tarjeta resaltará en un cuadro de color la **Dirección de Envío** y los datos de contacto.
2. **Iniciar la Elaboración**:
   * El cocinero presiona el botón **"Comenzar"** en la tarjeta.
   * El estado cambia a **"PREPARANDO"** (color ámbar).
   * Se inicia el temporizador regresivo dinámico calculado según los minutos estipulados.
3. **Ajuste de Tiempos (SLA Dinámico)**:
   * Si la cocina tiene sobrecarga de órdenes, haz clic en el icono del reloj sobre la tarjeta para sumar minutos (ej. `+5` o `+10`), lo que recalculará el semáforo visual.
4. **Chequeo Platillo por Platillo**:
   * A medida que los platillos van saliendo de la barra o freidora, el personal puede marcar la casilla de verificación individual de cada ítem.
5. **Marcar la Orden como Lista**:
   * Una vez listos todos los alimentos, el cocinero presiona el botón **"Listo"**.
   * La tarjeta pasa a color verde brillante con la etiqueta **"LISTO"**.
   * El sistema emite un sonido acústico de campanilla (*Ready Sound*) y envía una notificación al cajero/mesero indicando que el pedido de mostrador o reparto está completo.
6. **Empaque e Impresión de Comanda**:
   * Presiona el botón de **Impresión Térmica** en la tarjeta para emitir el ticket de 80mm de comanda. Engrápalo a la bolsa o contenedor de entrega.
7. **Despacho y Entrega Física**:
   * Cuando el cliente de mostrador o el repartidor a domicilio recoge la bolsa, el cajero o despachador presiona el botón **"Entregado"**.
   * La comanda desaparece del monitor de cocina y se traslada formalmente al archivo de ventas completadas en el historial.

---

### 7.5. CÓMO REALIZAR LA APERTURA Y EL CIERRE / CORTE DE CAJA (TICKET Z)

#### Apertura de Caja (Inicio de Turno):
1. Inicia sesión con un usuario con rol de `Caja` o `Admin`.
2. Si la caja no está abierta, se desplegará el modal **"Apertura de Turno de Caja"**.
3. Ingresa el **Fondo Inicial de Caja** (el importe físico de billetes y monedas con el que se inicia la jornada).
4. Escribe notas u observaciones si es necesario.
5. Haz clic en **"Abrir Caja"**. A partir de este instante, el POS queda habilitado para registrar transacciones y cobros.

#### Cierre y Arqueo de Caja (Fin de Turno / Corte Z):
1. Al terminar la jornada, ve a la pestaña **Central** > **Cierres de Caja**, o haz clic directamente sobre el badge verde `Caja: Abierta` en la barra superior y selecciona **"Cerrar Turno de Caja"**.
2. Aparecerá la ventana de **Arqueo Ciego de Caja**:
   * Ingresa el **Efectivo Físico Real** contado en el cajón de dinero.
   * Ingresa el total reportado en los vouchers de la **Terminal de Tarjetas**.
   * Ingresa el total verificado en la cuenta bancaria por **Transferencias**.
   * Escribe las notas de cierre para justificar cualquier eventualidad.
3. El sistema realizará la conciliación automática instantánea:
   * `Monto Esperado` = `Fondo Inicial` + Ventas en Efectivo + Ventas con Tarjeta + Transferencias.
   * `Diferencia` = `Monto Real Contado` - `Monto Esperado`.
   * Si la diferencia es `$0`, la caja está perfecta. Si es negativa, indica faltante; si es positiva, sobrante.
4. Presiona **"Confirmar Cierre de Caja"**.
5. **Emisión Inmediata del Ticket Z**:
   * El sistema envía automáticamente a la impresora térmica de 80mm el comprobante oficial de corte Z que contiene:
     * Nombre y datos fiscales del restaurante.
     * Nombre del cajero, hora de apertura y hora de cierre exactas.
     * Fondo inicial y desglose de ventas por método de pago.
     * Conciliación con las diferencias de caja de cada rubro.
     * **Desglose de Ventas por Categoría del Menú**: Total de artículos vendidos, importe en dinero y porcentaje de participación de cada categoría.
     * Firma de conformidad del cajero y del supervisor.

---

## 8. MOTOR DE PROMOCIONES Y DESCUENTOS AUTOMÁTICOS

El archivo `utils/promotionsEngine.ts` gobierna la lógica comercial del sistema:
* **Evaluación en Tiempo Real**: Al agregar productos al carrito, el motor evalúa si existe alguna promoción activa para el día de la semana actual (`daysOfWeek`) y la hora del sistema (`startTime` a `endTime`).
* **Tipos de Promoción Soportados**:
  1. `two_for_one` (2x1): Por cada 2 artículos aplicables, descuenta el importe de 1.
  2. `three_for_two` (3x2): Por cada 3 artículos aplicables, descuenta el valor de 1.
  3. `percentage` (% de Descuento): Aplica un descuento porcentual (ej. 15% de descuento) sobre los artículos de la categoría o sobre el total de la orden.
  4. `fixed_amount` ($ Descuento Fijo): Resta un monto directo en dinero (ej. -$50.00 pesos).
  5. `special_price` (Precio Especial): Fija un precio unitario promocional durante el horario de la oferta.
* **Transparencia en el Ticket**: Cuando se aplica un descuento, el ticket térmico y el comprobante PDF imprimen el Subtotal original, el monto exacto descontado, el nombre de la promoción y el Total final a pagar.

---

## 9. MOTORES DE IMPRESIÓN: TÉRMICA 80MM DIRECTA VS PDF

El sistema implementa dos motores de salida independientes para adaptarse a cualquier entorno operativo:

### 1. Impresión Térmica Directa (HTML ESC/POS Driver) - `services/thermalPrinter.ts`:
* **Tecnología**: Genera un documento HTML optimizado dentro de un iframe oculto en memoria y dispara `window.print()`.
* **Formato**: Diseñado con hoja de estilo `@media print` para rollo estándar de **80 milímetros (3 pulgadas)**.
* **Ventajas**:
  * Funciona de forma nativa sin drivers de red complejos en impresoras como **Epson TM-T88**, Star Micronics, Bixolon o genéricas USB.
  * Compatible con el modo de **Impresión Silenciosa (Kiosk Mode)** de Google Chrome (`--kiosk-printing`), permitiendo que el ticket salga en milisegundos sin diálogos de confirmación en pantalla.
  * Convierte automáticamente el importe total en texto oficial en español mediante `utils/numberToWords.ts` (ej. `SON: TRESCIENTOS VEINTE PESOS 00/100 M.N.`).
  * Respeta los switches de visibilidad configurables en la pestaña de Ajustes (mostrar u ocultar RFC, dirección, mesero, IVA desglosado, etc.).

### 2. Generador de Documentos PDF - `services/pdfGenerator.ts`:
* **Tecnología**: Compila documentos vectoriales mediante la librería cliente `jspdf`.
* **Formato**: Formato térmico angosto de 80mm de ancho con longitud dinámica proporcional a la cantidad de platillos ordenados.
* **Ventajas**: Permite guardar un duplicado digital, enviarlo por correo electrónico o mensajería al comensal, o archivarlo en el disco duro.

---

## 10. SEGURIDAD, AUDITORÍA Y ROLES (RBAC)

### Matriz de Roles y Permisos por Defecto

| Rol | Módulos Permitidos | Autorizar Cortesías | Acceso a Histórico y Ventas | Modificar Catálogo |
| :--- | :--- | :---: | :---: | :---: |
| **Administrador** | Todos (`pos`, `tables`, `dispatch`, `central`, `cash_audit`) | ✅ Sí | ✅ Sí | ✅ Sí |
| **Caja (Cajero)** | `pos`, `tables`, `cash_audit` | ❌ No (requiere PIN Admin) | ❌ Solo turno propio | ❌ No |
| **Mesero (Salón)** | `tables`, `pos` | ❌ No | ❌ No | ❌ No |
| **Cocina (Chef)** | `dispatch` (KDS) | ❌ No | ❌ No | ❌ No |

### PIN Hash y Protección de Operaciones Críticas:
* Todo el personal utiliza un código PIN numérico de 4 dígitos para acceder a sus funciones.
* Ciertas operaciones destructivas o de control de ingresos (como autorizar cuentas con método `Cortesía`, anular órdenes pagadas o realizar un reseteo de base de datos) exigen explícitamente ingresar el PIN de un usuario con permisos de administrador en un modal flotante.
* El reseteo de fábrica total de la base de datos (`onFactoryReset`) cuenta con doble verificación y exige la clave maestra de superusuario `9999`.

---

## 🏁 CONCLUSIÓN Y GUÍA DE REFERENCIA PARA AGENTES AI
Esta documentación condensa el 100% de la arquitectura, conexiones de componentes y flujos de negocio del proyecto DosPOS. Cualquier inteligencia artificial o desarrollador que necesite auditar, modificar, extender o depurar el sistema debe remitirse a las secciones correspondientes de este documento para mantener la coherencia de estado, los contratos de TypeScript y el motor de sincronización WebSocket en tiempo real.
