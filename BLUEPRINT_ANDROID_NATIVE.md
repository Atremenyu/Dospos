# 📱 Blueprint de Replicación: Sistema POS & Comandas Gastronómicas (Android Nativo)

Este documento sirve como manual de ingeniería y arquitectura técnica detallada para replicar el sistema de Punto de Venta (POS) y Gestión Gastronómica como una **aplicación nativa de Android** utilizando las mejores prácticas de la industria en desarrollo móvil.

---

## 🎯 1. Propósito General de la Aplicación

La aplicación es un **Punto de Venta (POS) y Sistema de Comandas para Restaurantes y Negocios Gastronómicos**. Su propósito primordial es digitalizar e integrar en tiempo real todo el ciclo operativo de un establecimiento culinario:
1. **Control de Accesos y Seguridad**: Logins rápidos mediante PIN asignados a roles con permisos restringidos.
2. **Atención al Cliente (POS / Mesas)**: Creación de comandas personalizadas para servicio en comedor (asociadas a mesas gráficas) o para llevar (incluyendo canales como Uber y DiDi).
3. **Flujo de Preparación (Cocina)**: Monitoreo interactivo de tiempos y estados de preparación (Cocina/Despacho) en pantallas dedicadas.
4. **Control Financiero**: Apertura, auditoría intermedia y cierres de turnos/cajas (Shifts y Cash Shifts) para evitar mermas financieras.
5. **Cadena de Suministros (Inventario)**: Descuento automático de existencias de ingredientes fundamentados en recetas vinculadas a productos y combos modificables.
6. **Análisis de Negocio**: Historiales exhaustivos de venta con cortes parciales diarios estructurados por métodos de pago y exportables.

---

## 🏗️ 2. Arquitectura de Android Nativa Recomendada

Para dotar a la aplicación de robustez offline-first (vital para restaurantes), escalabilidad y bajo consumo de batería, se define el siguiente estándar arquitectónico en **Kotlin**:

```
                       [ UI Layer (Jetpack Compose) ]
                                      │
                         [ Presentation (ViewModels) ]
                                      │
                    [ Domain (Use Cases / Models) ]
                                      │
                           [ Data (Repositories) ]
                                    ┌─┴─┐
              [ Local: Room DB ] ◄──┘   └──► [ Remote: Ktor API / WebSockets ]
```

### Tecnologías Clave de la Plataforma Android
* **UI**: **Jetpack Compose** (Declarativo, ideal para layouts fluidos, animaciones reactivas y bento grids).
* **Gestión de Estado**: `StateFlow` y `SharedFlow` para propagar el estado de la UI de forma asíncrona y estructurada.
* **Persistencia Local (Offline-First)**: **Room Database** con soporte para consultas reactivas (retornando `Flow<List<T>>`).
* **Inyección de Dependencias**: **Hilt** para desacoplar repositorios, DAOs y servicios.
* **Backend & Networking**: **Ktor Client** o **Retrofit** para peticiones REST; **OkHttp WebSockets** para comunicación bidireccional en tiempo real en red local (sincronizar Cocina con Caja).
* **Impresión Térmica**: Conectividad Bluetooth / Wi-Fi utilizando comandos de impresión estándar **ESC/POS** de 80mm.

---

## 📂 3. Secciones del Sistema: Propósito, Conexiones y Replicación Móvil

### A. Login & Selección de Turnos (Acceso Seguro)
* **Propósito**: Asegurar que solo usuarios con credenciales activas y roles idóneos puedan entrar a áreas administrativas del sistema.
* **Funcionalidad**: Control mediante PIN de 4 dígitos. Se manejan roles de usuario heredados de la base de datos local (`User` y `UserRole`). Ofrece flujos de `SetupWizard` cuando se detecta el primer inicio de la app.
* **Conectividad con otras secciones**:
  * Al ingresar un PIN correcto, redirige al menú de navegación principal (`TabNavigation`) cargando en el estado global el usuario logueado (`currentUser`).
  * Bloquea el POS en caso de que no haya un turno de caja (`CashShift`) abierto. Redirige al módulo de **Ajuste de Turnos**.
* **Replicación en Android Nativo**:
  * **UI**: Pantalla de bloqueo con teclado numérico gigante dibujado en un Grid de Compose. Diseñar un `Backdrop` con degradados y sombras suaves (estilo neobrutalista oscuro preferido en el POS web).
  * **Seguridad**: Guardar temporalmente el token o ID del usuario autenticado en un `SessionManager` inyectado mediante Hilt. El PIN no debe guardarse en texto plano, sino hasheado si es posible, o bien cifrado localmente en memoria.

---

### B. Módulo de Venta (POS)
* **Propósito**: Interfaz ágil e intuitiva para que los cajeros o meseros registren la comanda, interactúen con combos y modificadores de productos, y cobren las cuentas.
* **Funcionalidades Clave**:
  * Selección rápida de Productos organizada por pestañas deslizables de categorías.
  * Buscador rápido por caracteres.
  * **Modificadores y Combos**: Ventana emergente interactiva (`ModifierModal` / `ComboModal`) que altera dinámicamente el precio del ítem cargado al carrito (`CartItem`) y su estructura de receta.
  * Captura de notas específicas por plato (ej. *"Sin cebolla"*).
  * Procesamiento de pagos múltiples / parciales (`PaymentRecord`).
* **Conectividad con otras secciones**:
  * **Mesas**: Si el tipo de orden es comedor (`dine-in`), reserva y asocia la orden a una mesa en `TablesView`, cambiando el estado de la mesa seleccionada a "ocupada" (`occupied`).
  * **Cocina (Despacho)**: Al confirmar una orden, se inserta una nueva `Order` con estado `pending` en la base de datos, gatillando de inmediato una notificación vía WebSocket hacia las tablets de cocina.
  * **Turno de Caja (CashShift)**: Los montos cobrados se agregan directamente al total de dinero en efectivo u otros medios de pago esperados en el arqueo del cajero activo.
  * **Inventario**: Al generarse la comanda, se dispara en segundo plano el Use Case de **descuento de insumos**, restando el stock físico de los ingredientes requeridos en las recetas.
* **Replicación en Android Nativo**:
  * Usar un **Composite State** para el carrito, manejado mediante un `POSViewModel`.
  * La lista de categorías superior debe implementarse con un `ScrollableTabRow` y los productos en un `LazyVerticalGrid` de 3 o 4 columnas con tarjetas visuales refinadas.
  * Integrar gestos de deslizamiento (*Swipe-to-delete*) usando el componente `SwipeToDismissBox` de Compose para eliminar platos de la lista del carrito cómodamente.

---

### C. Despacho (Módulo de Cocina)
* **Propósito**: Sustituir las tradicionales comandas impresas de cocina por pantallas interactivas de despacho para los chefs.
* **Funcionalidades Clave**:
  * Visualización tipo tablero Kanban de las tarjetas de orden (`EN COLA` ➔ `PREPARANDO` ➔ `LISTO` ➔ `ENTREGADO`).
  * Cronómetros dinámicos que cambian visualmente la severidad de color indicando atrasos según el tiempo de preparación esperado de la orden (Verde, Amarillo, Rojo parpadeante).
  * Botones de ajuste manual de tiempo (`estimatedMinutes`) sumando o restando de 5 en 5 minutos directamente de la tarjeta de la orden.
* **Conectividad con otras secciones**:
  * **POS**: Recibe de forma inmediata las nuevas órdenes creadas.
  * **Historial**: Si una orden llega al estado terminal `delivered`, la etiqueta de la orden desaparece de la pantalla activa de cocina y se guarda firmemente como pagada y completada en los analíticos de venta.
  * **Mesas**: Libera de forma automática la mesa asociada una vez que la orden se marca como entregada en comedor.
* **Replicación en Android Nativo**:
  * **Reactividad Crítica**: Utilizar un despachador cíclico o corrutina que actualice el segundero de cocina cada `1.second` sin congestionar el hilo principal de la UI.
  * Usar animaciones fluidas (`AnimatedVisibility` de Compose o `Modifier.animateItemPlacement()`) para el movimiento orgánico de comandas cuando avanzan de columna.

---

### D. Mapa Gráfico de Mesas (Gestión de Planta)
* **Propósito**: Mapeo visual y control de ocupación física del restaurante.
* **Funcionalidades Clave**:
  * Visualización geométrica interactiva de mesas con códigos de colores muy marcados (Plomo/Blanco: disponible, Amarillo: reservada, Rojo/Negro: ocupada).
  * Evento de clic rápido: Al pulsar una mesa desocupada, se salta automáticamente al POS con dicha mesa preseleccionada para acortar pasos.
  * Si está ocupada, abre la comanda directamente con la opción de cobrar o añadir más insumos.
* **Conectividad con otras secciones**:
  * **POS**: El POS puede ligar o desasociar la mesa.
* **Replicación en Android Nativo**:
  * Crear un canvas inteligente en Compose (`BoxWithConstraints`) que permita renderizar las mesas en posiciones escaladas según la resolución de la pantalla. Para tabletas, idealmente usar coordenadas `(x, y)` almacenadas en la tabla `Table` de Room para posicionar mesas personalizadamente si el cliente quiere reorganizar el establecimiento.

---

### E. Módulo de Turnos y Auditoría de Caja (Shifts & Cash Audit)
* **Propósito**: Blindar el flujo monetario y dar certeza al administrador sobre las entradas/salidas de dinero del negocio.
* **Funcionalidades Clave**:
  * **Apertura deTurno**: Captura del fondo inicial de efectivo (`initialFund`).
  * **Transacciones de Turno**: Registro minucioso de retiros de efectivo (por pago a proveedores) o inyecciones de caja chica adicionales.
  * **Cierre de Turno**: Introducción manual del monto físico final existente en caja para calcular discrepancias y diferencias contra el dinero digital registrado por el POS.
* **Conectividad con otras secciones**:
  * **POS & Login**: Bloquea el inicio de cualquier venta si no hay una sesión activa.
* **Replicación en Android Nativo**:
  * Estructurar el almacenamiento en Room con un historico relacional de arqueos (`CashShiftEntity`). Para la UI de arqueo, guiar al cajero mediante inputs interactivos de billetes y monedas (ej. denominaciones de $20, $50, $100, $500), calculando la suma total automáticamente en tiempo de ejecución.

---

### F. Historial de Ventas, Resumen del Día & Analíticas
* **Propósito**: Centro administrativo para revisión retrospectiva, anulación de tickets y control estratégico.
* **Funcionalidades Clave**:
  * Filtro exhaustivo por rango de fechas y métodos de pago de todas las comandas de la base de datos.
  * **Corte Parcial del Día Actual**: Ubicado en la cabecera superior del historial. Muestra:
    1. **Total Facturado Hoy**: Suma neta de todas las comandas cobradas en la fecha corriente.
    2. **Distribución de Métodos de Pago**: Desglose con el dinero recaudado en Efectivo, Tarjeta, Transferencia, Uber y DiDi por separado.
  * Exportación del universo de datos de ventas en archivos CSV.
* **Conectividad con otras secciones**:
  * Permite consultar y realizar anulaciones/cancelaciones de órdenes las cuales, al ejecutarse, revierten en cascada las restas de stock física de los ingredientes afectados en la receta.
* **Replicación en Android Nativo**:
  * **Analíticas**: Reemplazar D3 y Recharts de React por una biblioteca de gráficos pura y nativa de Android, tales como **MPAndroidChart** o componentes vectoriales personalizados en Jetpack Compose.
  * **Exportación**: Generar el string en memoria formateado como CSV y escribir el archivo de forma segura en el almacenamiento externo/descargas a través del `Storage Access Framework (SAF)` de Android.

---

## 💾 4. Base de Datos en Android (Room Schema en Kotlin)

A continuación, se detalla el diseño de las entidades SQLite requeridas en Room para replicar fidedignamente los modelos relacionales de TypeScript.

### Definición de Entidades

```kotlin
import androidx.room.*

// 1. Configuración del Restaurante
@Entity(tableName = "store_settings")
data class StoreSettingsEntity(
    @PrimaryKey val id: String = "SINGLETON_ID",
    val name: String,
    val eventType: String,
    val address: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val taxId: String? = null,
    val currency: String = "MXN",
    val taxRate: Double = 0.0,
    val receiptHeader: String? = null,
    val receiptFooter: String? = null
)

// 2. Usuarios del Sistema
@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val name: String,
    val pin: String, // Almacenar de forma segura
    val role: String // Administrador, Cajero, Mesero, Cocina
)

// 3. Mesas
@Entity(tableName = "restaurant_tables")
data class TableEntity(
    @PrimaryKey val id: String,
    val name: String,
    val status: String, // free, occupied, reserved
    val currentOrderId: String? = null
)

// 4. Ingredientes de Inventario
@Entity(tableName = "ingredients")
data class IngredientEntity(
    @PrimaryKey val id: String,
    val name: String,
    val stock: Double,
    val minStock: Double,
    val unit: String // g, ml, unit
)

// 5. Productos
@Entity(tableName = "products")
data class ProductEntity(
    @PrimaryKey val id: String,
    val name: String,
    val price: Double,
    val category: String,
    val hasCombo: Boolean = false
)

// 6. Receta de Producto (Relación muchos-a-muchos intermedia)
@Entity(
    tableName = "product_recipes",
    primaryKeys = ["productId", "ingredientId"]
)
data class RecipeItemEntity(
    val productId: String,
    val ingredientId: String,
    val quantity: Double
)

// 7. Modificadores
@Entity(tableName = "modifiers")
data class ModifierEntity(
    @PrimaryKey val id: String,
    val modifierGroupId: String,
    val name: String,
    val extraPrice: Double
)

// 8. Grupo de Modificadores
@Entity(tableName = "modifier_groups")
data class ModifierGroupEntity(
    @PrimaryKey val id: String,
    val productId: String,
    val name: String,
    val minSelection: Int,
    val maxSelection: Int,
    val isRequired: Boolean
)

// 9. Órdenes / Comandas
@Entity(tableName = "orders")
data class OrderEntity(
    @PrimaryKey val id: String,
    val date: String, // Formato ISO 8601
    val client: String,
    val table: String,
    val payment: String, // PaymentMethod
    val status: String, // OrderStatus: pending, preparing, ready, delivered, cancelled
    val type: String, // dine-in, takeaway
    val takeawayType: String?, // local, delivery, uber, didi
    val total: Double,
    val tip: Double,
    val isPaid: Boolean,
    val estimatedMinutes: Int? = 15,
    val preparingAt: String? = null,
    val readyAt: String? = null
)

// 10. Registros de Transacción de Pagos por Orden
@Entity(tableName = "payment_records")
data class PaymentRecordEntity(
    @PrimaryKey val id: String,
    val orderId: String,
    val amount: Double,
    val method: String,
    val tip: Double,
    val timestamp: String
)

// 11. Sesión de Turno de Turno / Caja
@Entity(tableName = "cash_shifts")
data class CashShiftEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val userName: String,
    val openingTime: String,
    val closingTime: String? = null,
    val initialFund: Double,
    val expectedAmount: Double? = 0.0,
    val actualAmount: Double? = 0.0,
    val difference: Double? = 0.0,
    val status: String, // open, closed
    val notes: String? = null
)
```

### Relaciones Complejas

Para recuperar la estructura completa de un producto con sus recetas e ingredientes y grupos de modificadores asociados, se estructurarán clases POJO / Clases de Datos con anotaciones `@Relation` en Room:

```kotlin
data class ProductWithDetails(
    @Embedded val product: ProductEntity,
    
    @Relation(
        parentColumn = "id",
        entityColumn = "productId",
        entity = RecipeItemEntity::class
    )
    val recipeItems: List<RecipeItemEntity>,

    @Relation(
        parentColumn = "id",
        entityColumn = "productId",
        entity = ModifierGroupEntity::class
    )
    val modifierGroups: List<ModifierGroupWithModifiers>
)

data class ModifierGroupWithModifiers(
    @Embedded val group: ModifierGroupEntity,
    @Relation(
        parentColumn = "id",
        entityColumn = "modifierGroupId"
    )
    val modifiers: List<ModifierEntity>
)
```

---

## ⚡ 5. Flujos Críticos de Negocio Explicados Código-a-Código

### Flujo 1: Descuento Dinámico de Existencias de Insumos

Cada receta vinculada a un plato tiene una cantidad exacta de ingredientes requeridos. Al guardarse una orden, se debe gatillar un Use Case que recorra cada ítem en el carrito de compras del usuario y disminuya de manera transaccional el almacén local en SQLite.

```kotlin
class ProcessOrderUseCase @Inject constructor(
    private val orderDao: OrderDao,
    private val ingredientDao: IngredientDao,
    private val productDao: ProductDao
) {
    @Transaction
    suspend fun execute(order: OrderWithItems): Boolean {
        // 1. Guardar la orden cabecera en SQLite
        orderDao.insertOrder(order.entity)
        
        // 2. Guardar registros del detalle de la comanda
        orderDao.insertCartItems(order.items)
        
        // 3. Evaluar cada plato para restar stock
        for (item in order.items) {
            val productDetails = productDao.getProductDetailsById(item.productId) ?: continue
            
            // Restar ingredientes de la receta base del producto
            for (recipeItem in productDetails.recipeItems) {
                val neededQuantity = recipeItem.quantity * item.quantity
                ingredientDao.decreaseStock(recipeItem.ingredientId, neededQuantity)
            }
            
            // Restar ingredientes que provengan de Modificadores o Salsas extras seleccionadas
            item.selectedModifiers?.forEach { selectedMod ->
                val modifierRecipe = productDao.getModifierRecipe(selectedMod.modifierId)
                modifierRecipe?.forEach { modRecipeItem ->
                    val neededModQuantity = modRecipeItem.quantity * item.quantity
                    ingredientDao.decreaseStock(modRecipeItem.ingredientId, neededModQuantity)
                }
            }
        }
        return true
    }
}
```

---

### Flujo 2: Imprimir Ticket de Reparto (Canales Uber / DiDi de Forma Gigante)

Cuando un pedido finaliza y se determina que es canal **Uber** o **DiDi**, el repartidor necesita visualizar inequívocamente su orden. La comanda térmica entregada debe modificar su plantilla tradicional para enfatizar y agrandar estos textos al final de la página.

#### Comando ESC/POS Estándar para Impresoras Térmicas Bluetooth

Para inyectar tamaños de texto variables, se utilizan constantes de comandos byte de control de impresión ESC/POS:

```kotlin
object EscPosPrinterCommands {
    val RESET_PRINTER = byteArrayOf(0x1B, 0x40) // ESC @
    val TEXT_ALIGN_CENTER = byteArrayOf(0x1B, 0x61, 0x01) // ESC a 1
    val TEXT_ALIGN_LEFT = byteArrayOf(0x1B, 0x61, 0x00) // ESC a  0
    
    // Tamaños de Fuente
    val FONT_SIZE_NORMAL = byteArrayOf(0x1D, 0x21, 0x00) // Normal
    val FONT_SIZE_LARGE = byteArrayOf(0x1D, 0x21, 0x11) // Alto y Ancho x2
    val FONT_SIZE_EXTRA_LARGE = byteArrayOf(0x1D, 0x21, 0x22) // Alto y Ancho x3 (Crucial para Uber/DiDi)
    
    val CUT_PAPER = byteArrayOf(0x1D, 0x56, 0x41, 0x03) // GS V 65
}
```

#### Construcción de Plantilla de Ticket de Venta

A continuación, la lógica en Kotlin estructurada para formatear la cola de impresión de bytes de un ticket normal e inyectar el aviso de Uber/DiDi en grande:

```kotlin
class TicketPrinterService @Inject constructor(
    private val bluetoothConnectionManager: BluetoothConnectionManager
) {
    suspend fun printReceipt(order: OrderEntity, items: List<CartItemEntity>, restaurantName: String) {
        val outputStream = ByteArrayOutputStream()
        
        with(outputStream) {
            write(EscPosPrinterCommands.RESET_PRINTER)
            write(EscPosPrinterCommands.TEXT_ALIGN_CENTER)
            write(EscPosPrinterCommands.FONT_SIZE_LARGE)
            write("$restaurantName\n".toByteArray(Charset.forName("CP850")))
            write(EscPosPrinterCommands.FONT_SIZE_NORMAL)
            write("Ticket de Compra - ID: ${order.id.takeLast(8)}\n".toByteArray())
            write("--------------------------------\n".toByteArray())
            
            // Cuerpo del Ticket (Detalle de Productos)
            write(EscPosPrinterCommands.TEXT_ALIGN_LEFT)
            items.forEach { item ->
                val line = "${item.quantity}x ${item.name.padEnd(20)} $${item.price * item.quantity}\n"
                write(line.toByteArray(Charset.forName("CP850")))
                if (!item.note.isNullOrBlank()) {
                    write(" * Nota: ${item.note}\n".toByteArray(Charset.forName("CP850")))
                }
            }
            write("--------------------------------\n".toByteArray())
            write(EscPosPrinterCommands.TEXT_ALIGN_CENTER)
            write("Total: $${order.total}\n".toByteArray())
            write("¡Gracias por su Compra!\n\n".toByteArray())
            
            // 🚨 VALIDACIÓN ESPECIAL: Si es Uber o DiDi, imprimir abajo en gigante
            val takeaway = order.takeawayType?.lowercase()
            if (takeaway == "uber" || takeaway == "didi") {
                write("\n".toByteArray())
                write("================================\n".toByteArray())
                write(EscPosPrinterCommands.RESET_PRINTER)
                write(EscPosPrinterCommands.TEXT_ALIGN_CENTER)
                write(EscPosPrinterCommands.FONT_SIZE_EXTRA_LARGE) // Tamaño x3
                write("${takeaway.uppercase()}\n".toByteArray())
                
                write(EscPosPrinterCommands.RESET_PRINTER)
                write(EscPosPrinterCommands.TEXT_ALIGN_CENTER)
                write(EscPosPrinterCommands.FONT_SIZE_LARGE)
                write("CLIENTE: ${order.client.uppercase()}\n".toByteArray(Charset.forName("CP850")))
                write("================================\n".toByteArray())
                write("\n\n".toByteArray())
            }
            
            // Corte del papel
            write(EscPosPrinterCommands.CUT_PAPER)
        }
        
        // Enviar flujo de bytes estructurados a través del socket Bluetooth
        bluetoothConnectionManager.sendBytes(outputStream.toByteArray())
    }
}
```

---

### Flujo 3: Obtener Sincronización en Tiempo Real entre Tablets de Cocina y de Caja

Para evitar demoras de recarga o pérdidas de comandas entre el mesero tomando órdenes y la tablet de Cocina montada en la pared de preparación, se debe configurar una sincronización inmediata mediante **WebSockets** en una de dos topologías preferidas:

#### Opción A: Topología de Red de Área Local (LAN) sin Dependencia de Internet (Óptimo para Restaurantes en México)
* La tableta-servidor principal de caja ejecuta un servidor HTTP integrado que tiene un puerto WebSockets activo (por ejemplo, biblioteca `ktor-server-cio` corriendo embebida en Android sobre puerto `8080`).
* Las tablets de cocina se conectan a la IP del servidor de caja de forma inalámbrica.

#### Opción B: Sincronización Cloud con Firebase Firestore / Database
* Se utiliza Firebase Firestore que incluye soporte nativo listo para funcionar fuera de línea (`persistenceEnabled = true`).
* Se acopla la consulta reactiva directamente al ciclo de vida del ViewModel en cocina.

#### Código de Implementación para monitorear órdenes en tiempo real con Firestore

```kotlin
class LiveOrdersRepository @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    fun streamKitchenOrders(): Flow<List<Order>> = callbackFlow {
        val subscription = firestore.collection("orders")
            .whereIn("status", listOf("pending", "preparing", "ready"))
            .orderBy("date", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                
                val ordersList = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Order::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                
                trySend(ordersList)
            }
        
        awaitClose { subscription.remove() }
    }
}
```

---

## 🎨 6. Consejos de Diseño de Interfaz de Usuario UI (Estilo "Dark Cosmic Slate")

Para replicar con maestría el diseño oscuro refinado, con tintes intensos de la aplicación comanda web anterior, toma en cuenta los siguientes estilos de Compose:

1. **Paleta de Colores**:
   * **Fondo Principal (`Background`)**: `Color(0xFF0C0A09)` (un negro antracita con ligeros tintes cálidos de piedra).
   * **Tarjetas y Superficies (`Surface`)**: `Color(0xFF1C1917)` (contraste sobrio que da sensación de capas flotantes).
   * **Color de Acento Primario (`Primary`)**: `Color(0xFFDC2626)` (el rojo vibrante para denotar alertas, timers críticos y el sello de eventos).
   * **Texto Principal**: `Color(0xFFFAFAF9)` (blanco hueso que disminuye la fatiga ocular a los cajeros que trabajan turnos completos).
   
2. **Tipografía Elegante**:
   * Utilizar **Space Grotesk** para encabezados visuales (KPIs numéricos del total facturado e indicadores prioritarios) dándole un toque moderno e industrial.
   * Utilizar **JetBrains Mono** para los textos técnicos: identificadores de órdenes (ID: `#9D4B`), cronómetros dinámicos en cocina (`01:24m`), cantidades en inventario e indicadores decimales.
   
3. **Formas Redondeadas Emocionales**:
   * En vez de las esquinas cuadradas aburridas de las apps antiguas de informática, utiliza tarjetas curvadas y fluidas. Los contenedores flotantes deben usar `RoundedCornerShape(24.dp)` o `RoundedCornerShape(32.dp)`, dando una superficie tipo burbuja que invita a ser tocada amigablemente por cajeros inexpertos.

---

## 📋 7. Checklist de Replicación para el Desarrollador Android

- [ ] Instalar plugins de Kotlin Coroutines, Room, Firebase Firestore y Hilt en `build.gradle.kts`.
- [ ] Construir la base de datos local SQLite con Room (`AppDatabase`) definiendo todas las entidades de datos para trabajar **Offline-First**.
- [ ] Codificar el Use Case transaccional que asegura que cada consumo de producto descuenta existencias del almacén en tiempo de ejecución.
- [ ] Diseñar las pantallas de Caja (POS) en dos columnas en Jetpack Compose para aprovechar las dimensiones en modo Paisaje de pantallas de Tabletas.
- [ ] Programar un ViewModel con temporizadores usando `kotlinx.coroutines.delay` para calcular con color gradientes los tiempos de preparación de la cocina.
- [ ] Implementar la librería de comunicación y de impresión Bluetooth (conectando sobre SSP UUID `00001101-0000-1000-8000-00805F9B34FB`) que inyecta código ESC/POS para expandir e imprimir marcas gigantes en el ticket si es asignado a Uber o DiDi.
