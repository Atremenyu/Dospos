# Plan de Trabajo: Estabilización y Corrección Integral de DosPOS

Plan de arquitectura y ejecución técnica para corregir fallos críticos de cobro, validación de efectivo, persistencia de órdenes, sincronización en tiempo real y ciclo de vida de mesas en DosPOS.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones operativas y arquitectónicas acordadas y confirmadas:

- **Decisión 1 (Comandas a Cocina)**: Los pedidos de mesa y a domicilio pendientes de pago ("POR COBRAR") se envían **inmediatamente a cocina** al registrarse la comanda, sin esperar al momento del cobro.
- **Decisión 2 (Flujo de Navegación tras Cobro)**: Tras finalizar una venta o cobro, la aplicación **permanece en la pantalla de Venta POS** lista para tomar el siguiente pedido inmediatamente, evitando saltos molestos a Cocina o Mesas.
- **Decisión 3 (Sincronización en Tiempo Real)**: Se conecta al servidor Express interno mediante WebSocket con **reconexión inteligente y backoff exponencial** (3s hasta 60s, con fallback silencioso a HTTP), eliminando el bucle infinito a dominios externos estáticos como Netlify.
- **Decisión 4 (Ciclo de Vida de Mesas y Adición de Ítems)**: La entrega de comida a una mesa (`deliverOrder`) actualiza el estado de los platillos pero **NUNCA cierra la cuenta ni libera la mesa**. La cuenta de mesa se mantiene activa (`!closedAt`) hasta que el mesero o cajero la cierra explícitamente (`LIBERAR MESA Y FINALIZAR SERVICIO` o `COBRAR Y CERRAR`).
- **Decisión 5 (Cuentas Abiertas y Consumos Adicionales sin Cobro Anticipado)**: En modo Comedor / Mesas, el sistema opera por defecto como **Cuenta Abierta (Cobrar al Final)**. Cuando se agregan productos a una mesa nueva o a una mesa existente (aunque la ronda previa ya haya sido pagada), el sistema **NO exige método de pago ni efectivo recibido**. Los nuevos ítems se envían directamente a cocina y se acumulan al saldo de la mesa para liquidarse únicamente al momento de pedir la cuenta y cerrar la mesa.

---

### 1. Overview & Core Concept

- **Qué resuelve**: Elimina el fallo donde añadir productos a una mesa exigía un cobro inmediato o bloqueaba la acción por falta de efectivo recibido, permite rondas continuas de consumo en mesas activas o previamente pagadas, previene cobros en efectivo con $0 recibido, y optimiza la ergonomía en hora pico.
- **Usuario objetivo**: Cajeros, meseros, supervisores y personal de cocina en restaurantes y bares con alto flujo de tickets y comandas simultáneas.
- **Valor clave**: Cuentas abiertas naturales como en cualquier restaurante: se pide, se cocina, se disfruta, y se cobra solo el saldo restante al final.

---

### 2. User Experience & Visual Design

#### A. Ciclo de Vida de Cuentas de Mesa y Adición de Ítems
1. **Mesa Nueva (Cuenta Abierta por Defecto)**: Al seleccionar una mesa y agregar productos, el modo predeterminado es `Al Cerrar Mesa (Cuenta Abierta)`. El botón dice `ABRIR CUENTA MESA (ENVIAR A COCINA)`. No se pide método de pago ni se valida efectivo, la comanda va directo a cocina y la mesa queda ocupada.
2. **Adición de Nuevos Ítems a Mesa Existente / Previamente Pagada**: Al añadir items a una mesa que ya tiene comanda (haya o no pagado la primera ronda), el panel muestra el banner informativo: *"Mesa con Cuenta Abierta — Los nuevos items se enviarán a cocina de inmediato y se añadirán a la cuenta existente para liquidarse al cerrar la mesa."*
3. **Botón Directo a Cocina**: El botón dice `AÑADIR A MESA (ENVIAR A COCINA)`. No se solicita pago ni propina anticipada.
4. **Actualización de Saldo Pendiente**: Si la mesa pagó $500 al inicio y luego pide $100 en bebidas, la mesa muestra badge `Resta $100`. Al cerrar la mesa en `TablesView`, el cobro se realiza únicamente por los $100 restantes.

#### B. Validación Estricta de Efectivo y Botones Rápidos Inteligentes
- **Validación Visual en Tiempo Real**: Si el método es "Efectivo" en pago inmediato, el campo `Recibido` es obligatorio. Si el monto recibido es menor al total requerido (total + propina), el botón de cobro muestra advertencia clara en rojo: *"Faltan $X.XX para completar el pago"*.
- **Billetes y Redondeos Naturales**: Generación de botones rápidos sin duplicados para denominaciones mexicanas ($20, $50, $100, $200, $500, $1000).

---

### 3. Fases Ejecutadas y Verificadas

- [x] **Fase 1: Corrección de Cobro Inmediato en Mesas y Manejo de Propina**
- [x] **Fase 2: Validación de Efectivo y Botones Rápidos**
- [x] **Fase 3: Persistencia Robusta y Sincronización WebSocket con Backoff**
- [x] **Fase 4: Formato KDS, Fechas Locales y Turnos**
- [x] **Fase 5: Ciclo de Vida de Mesas y Adición de Ítems Continuos**
- [x] **Fase 6: Flujo de Cuenta Abierta por Defecto y Adición de Ítems sin Cobro Forzado**
- [x] **Fase 7: Bloqueo Estricto de Turno Anterior Sin Cerrar y Continuidad de Ventas en Arqueo**
  - **Bloqueo de Pedidos sin Cerrar Turno Anterior**: Si existe un turno abierto de una jornada previa (`staleOpenCashShift`), el sistema bloquea de forma estricta la adición de productos al carrito y el checkout, mostrando un banner y un modal/overlay de bloqueo dedicado en el POS para forzar el corte de caja antes de iniciar operaciones.
  - **Reconciliación Exacta sin Ventas Huérfanas**: `getCashShiftStats` y `computeShiftCategorySales` ahora calculan un `effectiveStartTime` que absorbe las ventas del día calendario antes de la apertura formal sin restar del turno anterior ya cerrado, garantizando que el corte de hoy coincida peso por peso con el dinero físico y digital.
- [x] **Fase 8: Modal Bloqueante Centralizado en App para Operaciones sin Turno Válido**
  - **Lógica de Bloqueo Central (`requireOpenShiftOrBlock`)**: Implementada en `App.tsx` para interceptar de raíz cualquier intento de creación de comanda nueva, adición de platillos a mesas existentes, selección de mesas en `TablesView`, división de cuentas y registro de cobros si no existe un `cashShift` abierto válido para hoy (`isShiftOpenValidToday`).
  - **Modal de Advertencia Bloqueante**: Sustituye las alertas nativas y notificaciones temporales por un modal interactivo con backdrop de alto contraste que explica la causa del bloqueo (turno anterior sin cerrar o caja no abierta hoy) y proporciona las acciones directas de resolución según los permisos del usuario.
- [x] **Fase 9: Certificación de Deploy, Retención de Datos y Transmisión en Tiempo Real**
  - **Consistencia Docker & Lockfile**: Eliminado `bun.lock` conflictivo y regenerado `package-lock.json`. Validado con `npm ci` y `npm ci --omit=dev` para garantizar éxito total en pipelines de Docker y Railway.
  - **Resiliencia de Almacenamiento Local**: Agregado helper `safeParse` en `services/storage.ts` en todos los getters para evitar crashes por JSON corrupto en localStorage.
  - **Transmisión en Tiempo Real sin Memory Leaks**: Heartbeat ping-pong en `server.ts` a 25s, limpieza de listeners en desconexión, y preservación de turnos cerrados en eventos WebSocket de clientes simultáneos.
  - **Batería de Pruebas Exitosa**: 10 de 10 pruebas unitarias y de integración pasadas (corte de caja, inicio efectivo, atomicidad de disco, endpoints REST). Compilación limpia de producción (`npm run build` y `tsc --noEmit`).
