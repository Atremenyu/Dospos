# Plan de Arquitectura e Implementación: Módulo de Cortesías y Consumo Interno de Staff (Opción 2)

## 1. Análisis y Evaluación Estructural

### 1.1 Validación de Arquitectura
* **Desacoplamiento Financiero**: Las cortesías al staff NO deben registrarse como órdenes (`Order`) con monto $0 en `dospos_ordenes`, porque contaminan directamente el *Ticket Promedio*, la *Venta Bruta* y la *Venta Neta* en `DashboardView.tsx`.
* **Entidad Autónoma**: Se define una nueva entidad `StaffConsumption` almacenada en `dospos_staff_consumptions` en `localStorage` y en la clave `staffConsumptions` en `db.json` del backend.
* **Impacto en Inventario**: El sistema actual de Dospos descuenta stock mediante ingredientes (`Ingredient.stock`) a través de recetas (`product.recipe`), y para productos directos de barra (ej. cervezas embotelladas, latas, refrescos) se añade soporte directo de stock/costo en `Product` (`cost`, `stock`), descontando tanto el insumo receta como el stock del producto si aplica.

### 1.2 Auditoría Financiera Dual (Costo y Precio Público)
* Cada artículo registrado en el consumo interno almacenará:
  * `unitPrice`: Precio público comercial para conocer el valor de mercado otorgado.
  * `unitCost`: Costo unitario real para registrar la merma contable real del negocio.
  * `totalRetailValue`: `quantity * unitPrice`
  * `totalCostValue`: `quantity * unitCost`
* Esto permite responder con exactitud: *"Se otorgaron $8,000 MXN en valor comercial a staff, lo cual representó un costo de merma real de $2,600 MXN para el evento."*

### 1.3 Mapeo y Trazabilidad con Turnos de Caja
* Cada registro de consumo incluye `cashShiftId: string | null` correspondiente al turno de caja abierto en ese momento.
* En `CashShiftView.tsx` y en el ticket de corte, se muestra una **sección informativa / auditoría** que desglosa el consumo interno del turno (unidades, valor costo y valor venta) **sin sumar ni restar un solo peso del saldo esperado en caja**.

---

## 2. Nuevas Capacidades y Mejoras Operativas

1. **Modal de Captura Rápida Individual**:
   * Selección rápida de productos de barra / cocina.
   * Identificación del beneficiario (empleado por lista desplegable o ingreso rápido de PIN de 4 dígitos).
   * Motivo tipificado: `Turno de trabajo`, `Cortesía administrativa`, `Evento especial`, `Merma de barra`, `Degustación`.
   * Opción de imprimir comanda a barra (sin formato fiscal/monetario) con botón térmico.

2. **Consolidación Masiva Post-Evento ("Cierre de Barra de Evento")**:
   * Modal de ajuste rápido masivo por producto para barra o catering (ej. descontar 48 cervezas corona, 12 aguas, 6 refrescos de golpe) tras el conteo físico de botellas vacías al finalizar la noche.

3. **Límites / Cuotas por Rol o Evento**:
   * Alarma visual cuando un miembro del personal supera su cuota diaria configurada (ej. máximo 2 bebidas por turno de staff).

4. **Visibilidad en Dashboard y Turnos**:
   * Indicador en `DashboardView.tsx`: Tarjeta KPI de "Consumo Staff / Merma" y desglose por motivo y personal.
   * Indicador en `CashShiftView.tsx`: Pestaña o bloque informativo con el total de cortesías del turno.

---

## 3. Plan de Implementación Paso a Paso

### Fase 1: Modelos de Datos (`types.ts`)
* Añadir tipos `StaffConsumption`, `StaffConsumptionItem`, `ConsumptionReason`.
* Enriquecer `Product` e `Ingredient` con soporte para `cost?: number`.

### Fase 2: Backend y Persistencia (`server.ts` y `storage.ts`)
* Añadir `staffConsumptions` en `server.ts` con persistencia en `db.json`, sincronización WebSocket y endpoints:
  * `GET /api/staff-consumptions`
  * `POST /api/staff-consumptions`
* Añadir métodos en `services/storage.ts` (`getStaffConsumptions`, `saveStaffConsumptions`).

### Fase 3: Componente de Usuario (`components/StaffConsumptionModal.tsx`)
* Modal interactivo con Tailwind CSS que soporte:
  * Pestaña 1: **Registro Individual / Por Empleado** (con PIN o lista de usuarios).
  * Pestaña 2: **Consolidación Masiva de Barra** (carga rápida en lote).
  * Impresión de Comanda a Barra térmica sin datos de venta.

### Fase 4: Integración en POS, Turnos y Dashboard
* En `POSView.tsx` o Navbar: Botón de acceso directo rápido con icono de gafete/staff.
* En `CashShiftView.tsx`: Desglose informativo del turno.
* En `DashboardView.tsx`: Métrica de costo de cortesías y volumen de staff.
* En `App.tsx`: Manejador de consumo que descuente inventario y guarde la traza.

### Fase 5: Verificación
* Compilación, linting y pruebas end-to-end de inventario y no distorsión de venta neta.
