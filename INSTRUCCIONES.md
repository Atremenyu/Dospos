# 📖 Manual de Ingeniería y Usuario - Sistema POS Red & Black Edition

Este documento detalla todas las funcionalidades del sistema de gestión para restaurantes, cafeterías o eventos gastronómicos, abarcando tanto su **uso operativo funcional** como su **arquitectura técnica**.

---

## 🏗️ 1. Arquitectura de Software y Almacenamiento

El sistema está diseñado bajo un enfoque **Offline-First**, asegurando que la operación de un restaurante nunca se detenga ante fallas de internet.

*   **Tecnologías Base**: Desarrollado como una SPA (Single Page Application) utilizando **React 18** y **TypeScript**. La interfaz de usuario nativa de tipo "Neobrutalista / Dark Cosmic" está estructurada mediante **Tailwind CSS**.
*   **Persistencia de Datos**: Para garantizar velocidad e independencia, todas las transacciones, inventarios y configuraciones se guardan localmente en el navegador usando un motor reactivo sustentado en el estándar `localStorage`. 
*   **Aislamiento de Estado**: Utiliza flujos de estado principal distribuidos a través del componente raíz `App.tsx` para compartir entidades como `Orders`, `Products`, `Ingredients`, `Users` a todos los módulos dependientes, logrando una sincronización inmediata a lo largo de las vistas en la misma pantalla.

---

## 🔐 2. Autenticación y Control de Personal (Login & Shifts)

El sistema maneja un control de seguridad dual: Control de Asistencia y Restricción Funcional.

*   **Manejo de Roles (Role-Based Access Control)**: Cada usuario tiene asignado un rol específico (`Admin`, `Cajero`, `Mesero`, `Cocina`), lo que habilita o bloquea secciones de la app dictado por el sistema de pestañas (`TabNavigation`).
*   **PIN Hash Security**: Todo el personal accede a través de un teclado numérico PIN-pad en pantalla de 4 dígitos.
*   **Registro de Asistencia (Shifts)**: Tras un inicio de sesión exitoso o al presionar "Clock IN / OUT", el sistema genera un registro ISO 8601 de entrada y salida, calculando automáticamente las horas de trabajo.

---

## 💰 3. Auditoría y Operación de Caja (Cash Shifts)

El módulo para evitar mermas, robos o descuadres contables en la caja de cobro físico. Diferente del turno laboral (asistencia), este rige exclusivamente el dinero.

*   **Bloqueo Condicionado**: El POS se bloquea e impide operar ventas si no existe un `CashShift` (Turno de Caja) abierto.
*   **Apertura de Caja**: Captura el fondo inicial de morralla o billetes base con el que abre el cajero.
*   **Movimientos Intermedios (In / Out)**: Permite inyecciones de caja chica o retiros de dinero justificados y rastreables (e.g., pago a proveedores, compra de gas).
*   **Cierre Ciego y Arqueo**: Al cerrar su turno de caja, se le exige al empleado ingresar y sumar cuánto dinero físico hay en la gaveta real (`actualAmount`), confrontándolo automáticamente por parte del sistema con el (`expectedAmount`), registrando la **diferencia o descuadre de caja** con un resumen que evalúa cobros en efectivo e historial de propinas.

---

## 🛒 4. Punto de Venta (POS) y Gestión Culinaria

Es el corazón operativo del ciclo de ventas.

*   **Grilla Responsiva e Interactiva**: Utilización de *Bento-Grids* para categorías personalizables, permitiendo navegación superrápida enfocada en uso táctil para tabletas.
*   **Sistema de Modificadores (Upsell & Cross-sell)**:
    *   Soporte avanzado de sub-capas por producto. Un usuario puede solicitar combinaciones específicas regidas por restricciones (`minSelection`, `maxSelection`, `isRequired`) para garantizar que se cobren guarniciones, tamaños o extras precisos para cada platillo.
*   **Catálogo de Combos**: Creación de paquetes donde varios ingredientes o artículos se condensan en un solo elemento de venta, modificando inventarios al instante.
*   **Generación Múltiple de Órdenes**: 
    1.  **Dine-In (Mesa)**: Vinculación a mesas gráficas.
    2.  **Takeaway / Delivery**: Con clasificaciones preestablecidas: "Uber", "DiDi" y "Local". En pedidos de apps, prioriza recolección del cliente con soporte unificado.
*   **Pagos Múltiples Expresivos**: Un usuario puede liquidar una cuenta de $1,000 en distintos splits (ej. $300 efectivo, $700 tarjeta), el carrito los agrega iterativamente como *PaymentRecords*.

---

## 🖨️ 5. Impresión Térmica y Recibos PDF (Dispatching / PDF)

*   **Ticket Rendering Service**: Transforma el JSON del carrito virtual a un documento en proporciones térmicas estandarizadas (80mm) con la librería `jspdf`.
*   **Sobrescritura UI (Canales Delivery)**: Una arquitectura técnica que intercepta el ciclo de render para evaluar órdenes Uber/DiDi; si se cumple la condición, imprime separadores extra-anchos al final del recibo identificando en gigante qué app generó el pedido (como bandera visual para repartidores prestando a la logística agilidad).

---

## 🍳 6. Panel Interactivo de Despacho (Cocina / Dispatch)

Reemplaza comandos de papel por pantallas dinámicas (KDS - Kitchen Display System).

*   **Control de Estados Kanban**: Tres pilares: `Pendiente`, `Preparando` y `Listo`.
*   **Temporizadores Dinámicos Reactivos**: Inyecta un temporizador decreciente (`estimatedMinutes`) a cada tarjeta. El fondo de las comandas cambia de color orgánicamente (de transparente a amarillo y de amarillo a parpadeo rojo estricto de alarma) informando cuellos de botella al Chef.
*   **Botones Increméntales (+5m / -5m)**: Permite ajustar el tiempo esperado del plato a nivel individual en tiempo real para calibrar el despacho manual.

---

## 🗺️ 7. Mapa de Planta y Mesas (Floor Plan)

Interfaz gráfica representacional del establecimiento.

*   **Colores y Estados Computados**: Libres (Plomo), Ocupadas (Rojo escarlata de neón).
*   **Asignación Rápida**: Si se clickea una mesa libre se navega directo al POS portando la mesa; si se clickea en una ocupada, se abren los detalles para revisión de saldo para cierre.

---

## 📊 8. Dashboard Histórico, Resumen y Analíticas (HistoryView)

La terminal del Administrador / Contabilidad.

*   **Corte Parcial del Día In-Line**: Una cabecera analítica de gran formato calcula automáticamente solo las ganancias y el corte neto de "Hoy", distribuyéndolas en los múltiples métodos de caja usados (ej. Efectivo, Amex, Transferencia, Didi), ofreciendo una radiografía financiera ágil e inmediata.
*   **Filtros Globales Multivariables**: Segmentación de historial en calendarios nativos.
*   **Baja e Invención de Comandas (Cancelaciones)**: Cancela pedidos con un botón para limpiar basura de pruebas e ingresos erróneos.
*   **Business Intelligence / CSV Exporter**: Posibilidad de exportar todas las tablas a un archivo `.csv`.

---

## 📦 9. Gestión de Inventarios Basada en Recetas Automáticas (Inventory/Recipes)

*   **Stock Físico Real y Control Crítico (`Ingredients`)**: Control por gramaje, piezas y mililitros con estipulación de `minStock`. Si el número baja de un umbral, en el futuro levantará alertas preventivas.
*   **Ligado a Nivel de Nodo a Productos (`RecipeItems`)**:
    Al generar una venta completada en el POS, existe un UseCase técnico subyacente de "descuento dinámico" que restaurreta las cantidades en el catálogo de Ingredientes a partir de:
    - Las recetas bases del propio Producto.
    - Las recetas accesorias y aditamentos del *Modificador* o *Extra* pagado.
*   La lógica a su vez hace un _Rollback_ de recursos si un gerente "Re-abre" o "Cancela" un ticket ya cobrado.

---

## ⚙️ 10. Configuración, Respaldos y Sostén Administrativo

*   **Personalización**: Edición total de variables corporativas (Tasa de de impuestos o `taxRate`, monedas, encabezado de recibos).
*   **Resguardo Seguro (Import / Export JSON)**: Herramientas de extracción en un clic para descargar una copia del payload completo del estado de la memoria local y re-inyecciones sin fricciones en instancias separadas.
*   **Restablecimiento de Fábrica Total (`onFactoryReset`)**: Rutinas destructivas protegidas con capas del DOM, las cuales exigen una validación estricta de pin super root `9999` para eliminar de cuajo transacciones corrompidas del LocalStorage del navegador y reanudar sistemas limpiando caché sin comprometer el software original.