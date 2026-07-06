# 📖 Manual de Usuario Completo - Sistema de Gestión Gastronómica DosPos

Bienvenido al manual de uso definitivo de tu nuevo sistema de punto de venta (POS) y administración integral. Este sistema está diseñado para optimizar el flujo de trabajo en restaurantes, cafeterías y negocios gastronómicos, conectando de forma fluida la caja, el salón (mesas), la cocina y el área administrativa.

---

## 👥 1. Perfiles, Roles y Permisos del Personal

El sistema se adapta a la estructura de tu negocio mediante la asignación de perfiles específicos para cada tipo de colaborador:

*   **Cajero (Caja)**:
    *   Realiza la apertura y cierre de caja obligatorios por turno.
    *   Toma y procesa pedidos presenciales, para llevar o a domicilio.
    *   Gestiona los cobros en efectivo (con calculadora rápida de cambio), tarjeta o transferencia.
    *   Descarga e imprime tickets de venta en formato PDF optimizados para ticketeras de 80mm.
    *   Visualiza e interactúa con el slider superior de pedidos activos.
*   **Mesero (Salón)**:
    *   Visualiza el plano gráfico de mesas en tiempo real.
    *   Asigna nuevos clientes y comensales a mesas desocupadas.
    *   Levanta órdenes directamente desde la mesa a través de su dispositivo móvil o tablet.
    *   Agrega comentarios especiales, extras y modificadores a los platos solicitados.
    *   Consulta el estado de preparación de los pedidos de sus mesas.
    *   Solicita la precuenta (ticket previo) para entregar al cliente antes de procesar el pago.
*   **Personal de Cocina (Despacho)**:
    *   Visualiza instantáneamente las comandas entrantes ordenadas por hora de llegada.
    *   Cambia los estados de preparación de los platos de forma global o individual (platillo por platillo).
    *   Controla los tiempos de elaboración mediante el temporizador dinámico con alertas visuales de color.
    *   Ajusta los tiempos estimados de preparación según la demanda en cocina.
*   **Administrador (Panel de Control y Gestión)**:
    *   Acceso ilimitado a todos los módulos y pestañas de la aplicación.
    *   Monitoreo en tiempo real de los indicadores clave de rendimiento (KPIs) financieros y operativos en el Panel de Control.
    *   Gestión integral del menú: creación y edición de productos, categorías, modificadores (extras), ingredientes y combos promocionales.
    *   Administración del plano del restaurante: adición de nuevas mesas y edición de nombres.
    *   Gestión de personal: registro de usuarios, asignación de roles y turnos de trabajo.
    *   Auditoría de cortes de caja previos, historial completo de transacciones y anulación de ventas.
    *   Configuración general del negocio (Logo, teléfono, moneda, RFC/Tax) y herramientas de mantenimiento de bases de datos.

---

## 🚪 2. Acceso e Inicio de Operaciones (Gestión de Caja)

El control del flujo de dinero en efectivo es un pilar fundamental del sistema, por lo cual se rige bajo un estricto proceso de turnos:

### Paso 1: Inicio de Sesión
Accede a la plataforma ingresando tu usuario y contraseña asignados. Si eres administrador, podrás ver el panel general inmediatamente; si eres cajero, el sistema te dirigirá al flujo de operaciones de caja.

### Paso 2: Apertura de Turno (Fondo de Caja)
Antes de poder realizar cualquier venta en el sistema, es obligatorio registrar la apertura de la caja:
1.  El sistema desplegará automáticamente la ventana de **Apertura de Caja**.
2.  Ingresa el **Fondo Inicial de Caja** (el monto de dinero en efectivo disponible físicamente en el cajón para dar cambio al comenzar el turno).
3.  Agrega notas u observaciones de ser necesario (ej. *"Se abre con billetes de baja denominación"*).
4.  Haz clic en **"Abrir Caja"**. A partir de este momento, el módulo de ventas (POS) quedará completamente desbloqueado para transacciones.

### Paso 3: Monitoreo durante el Turno
A lo largo de la jornada, el sistema registra cada transacción especificando el método de pago (Efectivo, Tarjeta, Transferencia) para consolidar los montos esperados al final del día.

### Paso 4: Cierre de Turno y Corte de Caja
Al finalizar la jornada laboral o el turno del cajero:
1.  Ve a la sección **Administración / Cierres de Caja**.
2.  Presiona el botón de **"Cerrar Turno de Caja"**.
3.  Ingresa el **Monto de Efectivo Real** que contaste físicamente en el cajón de dinero.
4.  El sistema realizará una conciliación automática comparando el **Monto Esperado** (Fondo Inicial + Ventas registradas en efectivo) contra tu **Monto Real**.
5.  Se calculará instantáneamente la **Diferencia de Caja**:
    *   *Diferencia = $0*: Balance perfecto.
    *   *Diferencia negativa (-)*: Faltante de dinero en caja.
    *   *Diferencia positiva (+)*: Sobrante de dinero en caja.
6.  Ingresa notas de cierre para justificar cualquier discrepancia y haz clic en **"Confirmar Cierre de Caja"**. Esto guardará un registro histórico inalterable para auditorías y cambiará el estado de la caja a "Cerrada", bloqueando nuevas ventas hasta un nuevo turno.

---

## 🛒 3. Módulo de Venta (POS): Cómo Generar y Cobrar un Pedido Paso a Paso

El área de caja o POS cuenta con una interfaz optimizada para crear órdenes en cuestión de segundos:

### Paso 1: Seleccionar el Tipo de Servicio
En la parte superior izquierda de la pantalla, define el tipo de servicio para el cliente actual:
*   **Comedor (Mesa)**: Se abrirá automáticamente el panel de selección de mesa para que enlaces el pedido. El número de mesa aparecerá en la comanda de cocina.
*   **Llevar**: El cliente pide en el mostrador para retirarse con su comida. El pedido se identifica con el nombre del cliente.
*   **Domicilio (Envío)**: Específicamente diseñado para entregas a casa. Al seleccionarlo, se desplegará de forma dinámica un **campo especial de Dirección de Envío** justo debajo del nombre del cliente. Escribe detalladamente la dirección de entrega aquí para que se incluya de forma automática en el ticket de despacho.
*   **Apps (Reparto Externo)**: Selecciona Uber Eats, DiDi Food u otras plataformas de entrega si la comanda proviene de estos canales, facilitando la sincronización.

### Paso 2: Armar el Pedido (Selección de Productos)
1.  Navega por las pestañas de categorías en la parte central o escribe en la barra de búsqueda en tiempo real para encontrar productos.
2.  Haz clic sobre un producto para agregarlo al carrito de la derecha.
3.  **Gestión de Modificadores (Extras/Ajustes)**: Si el producto tiene configurados modificadores, se abrirá un modal flotante. Selecciona las opciones deseadas (ej. *Con Queso Extra, Término Medio, Sin Cebolla*) y presiona *"Confirmar"*.
4.  **Gestión de Combos**: Al elegir un combo promocional, un asistente interactivo te guiará para seleccionar los componentes individuales del paquete (ej. *Elegir Hamburguesa Clásica + Papas Medianas + Refresco de Cola*).
5.  En el carrito lateral puedes presionar los botones de `+` y `-` para ajustar las cantidades, o hacer clic en el icono de lápiz/comentario de un producto para escribir instrucciones especiales de cocina únicamente para ese platillo.

### Paso 3: Flujo de Caja Continuo (Continuar al Pago)
Una vez que el carrito esté listo, haz clic en el botón rojo de **"Continuar"** en la parte inferior derecha:
*   **¡Mejora de Navegación!** Para evitar desorientaciones, el sistema reposiciona automáticamente el scroll de la columna derecha hacia el **inicio superior**.
*   Esto te permite rellenar de forma ordenada los datos clave antes de proceder al cobro:
    1.  Verifica o ajusta el **Tipo de Orden** (Mesa / Llevar / Domicilio).
    2.  Ingresa el **Nombre del Cliente** (ej. *"Juan Pérez"* o *"Mesa 4"*).
    3.  Si es **Domicilio**, escribe detalladamente la **Dirección de Envío** en el cuadro de texto que aparece automáticamente.
    4.  Desciende a la sección final para seleccionar el método de pago e importes.

### Paso 4: Métodos de Pago y Propinas
Selecciona el método de pago en los botones de selección:
*   **Tarjeta / Transferencia**: El sistema registrará el monto exacto de la cuenta bajo estos rubros.
*   **Efectivo y Efectivo Rápido (Quick Cash)**: Al seleccionar efectivo, se activará una cuadrícula con botones de montos automáticos calculados dinámicamente según el total del pedido (ej. si la cuenta es de $340, se habilitarán botones rápidos de $400, $500, $1000). Haz clic sobre el billete que te entrega el cliente y el sistema calculará al instante el **Cambio Exacto** a devolver.
*   **Agregar Propina**: Si el cliente desea añadir propina, ingresa el porcentaje (10%, 15%) o digita una cantidad fija de dinero en el casillero correspondiente.
*   **Pagar Después (Pay Later)**: Si estás levantando un pedido para Comedor y los clientes pagarán al terminar sus alimentos, puedes activar esta opción. El pedido se registrará como **"Pendiente"** de pago y se enviará de inmediato a preparación, permitiéndote cobrarlo después desde la sección de mesas.

### Paso 5: Finalización y Ticket PDF
Presiona el botón **"Confirmar Orden"**:
*   La comanda se transmite en tiempo real a la pantalla de cocina.
*   El carrito se limpia automáticamente.
*   Se genera de inmediato un **Ticket PDF** profesional optimizado para impresión térmica que detalla: nombre del restaurante, información de contacto, folio de orden, fecha y hora, nombre del cliente, dirección detallada (si fue pedido a Domicilio), desglose de productos y sus modificadores, subtotal, propinas, método de pago y cambio entregado.

---

## 🪑 4. Módulo de Gestión de Mesas (Salón)

El plano de mesas ofrece a los meseros y cajeros una representación gráfica del restaurante en tiempo real para agilizar la rotación de comensales:

### Estados Visuales de las Mesas:
*   **Mesa Blanca (Disponible)**: La mesa está desocupada.
    *   **Cómo usar**: Haz clic sobre ella. El sistema te redirigirá automáticamente al Módulo de Venta (POS) con la mesa ya seleccionada para que comiences a tomar el pedido.
*   **Mesa Roja/Negro (Ocupada)**: Hay una cuenta activa vinculada a esta mesa.
    *   **Cómo usar**: Haz clic sobre ella para abrir de inmediato el panel lateral de detalles de consumo de la mesa.

### Acciones Rápidas en Mesas Ocupadas:
Una vez abierta la mesa ocupada, podrás ver el total consumido hasta el momento y la lista detallada de platos ordenados. Tienes las siguientes opciones:
1.  **Modificar / Agregar Productos**: Si los comensales desean ordenar más bebidas o alimentos, haz clic en el botón de agregar. El sistema abrirá el menú para seleccionar los nuevos productos y enviará la comanda complementaria a cocina.
2.  **Imprimir Precuenta**: Genera un ticket en PDF sin procesar el cobro. Úsalo para que el mesero se lo entregue a los clientes para su revisión e indicarles el total a pagar.
3.  **Procesar Cobro Directo**: Cobra la cuenta de la mesa directamente desde esta pantalla usando efectivo con opciones rápidas de Quick Cash, tarjeta o transferencia. Al confirmarse el pago, la cuenta se archiva, el sistema genera el ticket de venta final y la mesa se libera regresando instantáneamente a color blanco (Disponible).

---

## 👨‍🍳 5. Módulo de Despacho (Cocina en Tiempo Real)

La pantalla de cocina actúa como un panel de control interactivo que elimina las comandas de papel tradicionales y coordina la preparación de manera precisa:

### Estructura de las Tarjetas de Comanda:
Cada pedido entrante se muestra como una tarjeta individual que incluye:
*   Folio del pedido y hora de creación.
*   Nombre del cliente y tipo de servicio (si es Domicilio, incluye la dirección de envío en un recuadro de color para alertar al repartidor).
*   Detalle exhaustivo de platillos, destacando en negrita los modificadores, extras o comentarios especiales de preparación.
*   Cronómetro de preparación dinámico.

### Flujo de Trabajo en Cocina:
1.  **Paso 1: Recepción (Comanda EN COLA)**: La tarjeta entra con un borde gris y estado "En Cola". Indica que el pedido ha sido registrado pero aún no ha entrado al fuego.
2.  **Paso 2: Iniciar Preparación (Comanda PREPARANDO)**: El chef o personal de cocina presiona el botón **"Preparar"** en la tarjeta. El estado cambia, la comanda se tiñe de color de proceso y se activa un cronómetro regresivo de tiempo estimado.
3.  **Paso 3: Seguimiento por Platillo**: Si el pedido contiene múltiples platillos de diferentes áreas (ej. una hamburguesa y una bebida), los cocineros pueden marcar de forma individual el checkbox de cada producto conforme se va terminando. Esto permite llevar un control exacto de lo que está listo en barra.
4.  **Paso 4: Marcar como Terminado (Comanda LISTO)**: Al concluir la preparación de todos los alimentos de la tarjeta, se presiona el botón **"Listo"**. El pedido se cataloga como completado en cocina, alertando visualmente al mesero o cajero.
5.  **Paso 5: Despacho y Entrega (Comanda ENTREGADO)**:
    *   **Para Comedor**: El mesero recoge los platos calientes de la barra, los lleva a la mesa del cliente y marca el botón **"Entregado"** en la pantalla.
    *   **Para Llevar o Domicilio**: El cajero empaca los alimentos junto con el ticket impreso, realiza la entrega física al cliente o al repartidor, y presiona **"Entregado"**.
    *   Al presionar *"Entregado"*, la tarjeta desaparece de la pantalla de cocina y la venta se traslada formalmente al Historial de Ventas Completadas.

### Control Inteligente de Tiempos:
El cronómetro integrado cambia de color para representar la urgencia de la orden:
*   🟢 **Verde**: Preparación dentro de los tiempos estipulados.
*   🟡 **Amarillo / Naranja**: Tiempo límite de espera aproximándose.
*   🔴 **Rojo Parpadeante**: Comanda con retraso considerable. ¡Requiere máxima prioridad!
*   **Ajuste manual del reloj**: Si un platillo complejo requiere tiempo extra, o si la cocina experimenta una sobrecarga temporal de pedidos, puedes hacer clic en el **Icono de Reloj** de la tarjeta para sumar o restar minutos al temporizador, reajustando la estimación en tiempo real.

---

## 📜 6. Historial de Ventas, Anulaciones y Reportes

Espacio para auditoría, consulta contable y exportación de información clave:

*   **Filtros de Búsqueda Avanzados**: Permite filtrar y localizar transacciones pasadas de forma veloz por:
    *   Fecha o rango de fechas.
    *   Método de pago utilizado (Efectivo, Tarjeta, Transferencia, etc.).
    *   Estado del pedido (Pagado, Pendiente, Anulado).
    *   Tipo de servicio (Mesa, Para Llevar, Domicilio, Apps).
*   **Detalle de Transacciones**: Al hacer clic en cualquier orden del historial, se desplegará el panel derecho con el recibo original, desglose exacto de productos consumidos, impuestos, propinas aplicadas, ID de la orden y datos del repartidor o mesa.
*   **Anulación de Pedidos**: En caso de errores de captura, cancelaciones de clientes de último minuto o devoluciones:
    1.  Ubica la orden en el historial.
    2.  Haz clic en el botón de **"Anular Orden"**.
    3.  Confirma la acción. El sistema cambiará el estado de la venta a "Anulado", liberará de inmediato la mesa si estaba asociada, y descontará los montos de tus gráficos financieros diarios para mantener tu contabilidad impecable y prevenir fraudes.
*   **Exportación CSV**: Descarga un reporte completo en formato CSV (compatible con Excel y Google Sheets) con un solo clic. Este reporte incluye folio, fecha, cajero, método de pago, propinas, totales e impuestos de cada venta para facilitar el trabajo administrativo y contable.

---

## ⚙️ 7. Administración y Ajustes del Negocio (Catálogo y CRM)

Este panel exclusivo para administradores controla las reglas operativas y los datos del negocio:

### 🍔 Gestión de Menú (Productos, Categorías y Combos)
*   **Categorías**: Crea o edita grupos para organizar tu menú de manera lógica (ej. *Hamburguesas, Bebidas, Postres*).
*   **Productos**:
    *   Crea productos asignando Nombre, Precio de Venta, Categoría y una Imagen descriptiva.
    *   **Inventario por Insumos**: Puedes vincular ingredientes y el stock de insumos a cada plato para llevar un control automático de tus existencias.
    *   **Configuración de Modificadores**: Diseña opciones de personalización (como salsas extras, tamaño de porción, términos de carne) con opción de añadir un costo adicional opcional al producto base.
    *   **Paquetes / Combos**: Configura paquetes especiales integrados por múltiples elementos a un precio preferencial, asignando los productos disponibles para selección del cliente en cada paso del combo.

### 🪑 Configuración de Sala (Plano de Mesas)
*   Crea nuevas mesas para tu comedor físico asignándoles un identificador o nombre (ej. *"Mesa Terraza 1"*, *"Barra 3"*).
*   Edita o elimina mesas obsoletas para mantener tu plano interactivo exactamente alineado a la distribución física del restaurante.

### 👥 Gestión de Personal (Usuarios, Roles y Turnos)
*   **Registro de Usuarios**: Crea credenciales únicas (nombre de usuario, contraseña) para cada uno de tus empleados.
*   **Asignación de Roles**: Define el nivel de acceso (Cajero, Mesero, Cocina, Administrador) de acuerdo a sus responsabilidades cotidianas, asegurando que solo el personal autorizado pueda ver reportes contables o modificar el catálogo.
*   **Asignación de Turnos**: Asigna horarios de trabajo en el sistema para monitorear la asistencia y registrar qué colaboradores abren o cierran caja en cada día.

### 🏪 Datos del Negocio e Infraestructura
*   **Ajustes Generales**: Configura la identidad del restaurante: Nombre Comercial, Teléfono de contacto, Dirección del establecimiento, Símbolo de Moneda y porcentaje de Impuestos aplicable. Estos datos se sincronizarán directamente en la cabecera de todos tus tickets PDF descargados.
*   **Mantenimiento y Seguridad**:
    *   *Restaurar Base de Datos*: Carga archivos de respaldos previos de manera segura para recuperar configuraciones o inventarios.
    *   *Reseteo de Fábrica*: Elimina de forma permanente las transacciones e historial de prueba para limpiar el sistema antes de iniciar la operación oficial con clientes reales del negocio.

---

*Nota: Todas las acciones e ingresos se registran de forma automática en el sistema centralizado de auditoría, permitiendo un control transparente de las finanzas de tu restaurante.*
