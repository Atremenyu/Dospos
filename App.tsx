
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Order, ViewState, CartItem, PaymentMethod, Category, Table, OrderType, TakeawayType, OrderStatus, User, Shift, SelectedModifier, CashShift, UserRole, PaymentRecord, StoreSettings, AdminTabType, ComboOption, Ingredient } from './types';
import { storage } from './services/storage';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_TABLES, INITIAL_USERS, ROLES, Icons } from './constants';
import POSView from './components/POSView';
import DispatchView from './components/DispatchView';
import HistoryView from './components/HistoryView';
import TablesView from './components/TablesView';
import TabNavigation from './components/TabNavigation';
import ActiveOrdersSlider from './components/ActiveOrdersSlider';
import { LoginView } from './components/LoginView';
import { SetupWizard } from './components/SetupWizard';
import CashOpeningModal from './components/CashOpeningModal';
import CashClosingModal from './components/CashClosingModal';
import { printCashShiftTicketHTML } from './services/thermalPrinter';
import AdminCRM from './components/AdminCRM';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [cashShifts, setCashShifts] = useState<CashShift[]>([]);
  const [roles, setRoles] = useState<UserRole[]>(ROLES);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("dospos_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(() => {
    return localStorage.getItem("dospos_current_shift_id") || null;
  });
  
  const [settings, setSettings] = useState<StoreSettings>({
    name: 'DosPOS',
    eventType: 'Restaurante',
    currency: 'MXN',
    taxRate: 0,
  });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeNotification, setActiveNotification] = useState<{ id: string, message: string, type: 'ready' | 'warning' } | null>(null);
  const [showOrdersSlider, setShowOrdersSlider] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [adminView, setAdminView] = useState<AdminTabType>('overview');
  const socketRef = useRef<WebSocket | null>(null);
  const prevOrdersRef = useRef<Order[]>([]);
  const isInitialLoadRef = useRef(true);

  // Notification state & utility methods
  const [notificationPermission, setNotificationPermission] = useState<string>('default');

  useEffect(() => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
    } else {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const triggerNativeNotification = (title: string, body: string, tag?: string) => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      try {
        const options: any = {
          body,
          tag,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          requireInteraction: false,
        };

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, options);
          }).catch(() => {
            new Notification(title, options);
          });
        } else {
          new Notification(title, options);
        }
      } catch (err) {
        console.error("Error displaying notification:", err);
      }
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return 'unsupported';
    
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        triggerNativeNotification('🔔 DosPOS', '¡Notificaciones de cocina y caja activadas con éxito!');
      }
      return permission;
    } catch (err) {
      console.error("Error requesting notification permission:", err);
    }
    return Notification.permission;
  };

  // Auto request notification permission on first interaction
  useEffect(() => {
    const handleFirstClick = () => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
          if (permission === 'granted') {
            triggerNativeNotification('🔔 DosPOS', '¡Notificaciones de cocina y caja activadas con éxito!');
          }
        }).catch(err => console.warn("Auto notification permission request failed:", err));
      }
      window.removeEventListener('click', handleFirstClick);
    };

    window.addEventListener('click', handleFirstClick);
    return () => window.removeEventListener('click', handleFirstClick);
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      let serverState: Record<string, any> = {};
      try {
        const response = await fetch('/api/db');
        if (response.ok) {
          serverState = await response.json();
          console.log("Estado inicial cargado desde el servidor:", serverState);
        }
      } catch (err) {
        console.error("No se pudo cargar el estado inicial desde el servidor:", err);
      }

      const serverHasData = Object.keys(serverState).length > 0;

      const initializeKey = (key: string, localValue: any, fallbackValue: any) => {
        if (serverHasData && serverState[key] !== undefined) {
          const data = serverState[key];
          storage.setLastKnownServerState(key, data);
          
          const apiToLocalStorageMap: Record<string, string> = {
            products: 'dospos_productos',
            orders: 'dospos_ordenes',
            categories: 'dospos_categorias',
            tables: 'dospos_tablas',
            settings: 'dospos_store_settings',
            users: 'dospos_usuarios',
            shifts: 'dospos_turnos',
            cashShifts: 'dospos_turnos_caja',
            roles: 'dospos_roles',
            ingredients: 'dospos_ingredientes',
            restaurantName: 'dospos_restaurant_name',
            eventType: 'dospos_event_type',
          };
          const lsKey = apiToLocalStorageMap[key];
          if (lsKey) {
            if (typeof data === 'string') {
              localStorage.setItem(lsKey, data);
            } else {
              localStorage.setItem(lsKey, JSON.stringify(data));
            }
          }
          return data;
        } else {
          return (localValue && (Array.isArray(localValue) ? localValue.length > 0 : true)) ? localValue : fallbackValue;
        }
      };

      const savedProducts = initializeKey('products', storage.getProducts(), INITIAL_PRODUCTS);
      const savedIngredients = initializeKey('ingredients', storage.getIngredients() || [], []);
      const savedCategories = initializeKey('categories', storage.getCategories(), INITIAL_CATEGORIES);
      const savedTables = initializeKey('tables', storage.getTables(), INITIAL_TABLES);
      const savedOrders = initializeKey('orders', storage.getOrders(), []);
      const savedUsers = initializeKey('users', storage.getUsers(), []);
      const savedShifts = initializeKey('shifts', storage.getShifts(), []);
      const savedCashShifts = initializeKey('cashShifts', storage.getCashShifts(), []);
      const savedRoles = initializeKey('roles', storage.getRoles(), ROLES);
      const savedSettings = initializeKey('settings', storage.getSettings(), null);

      const rawProducts = savedProducts.length > 0 ? savedProducts : INITIAL_PRODUCTS;
      const cleanedProducts = rawProducts.map((p: any) => ({
        ...p,
        modifierGroups: p.modifierGroups?.filter((mg: any) => 
          !mg.name.toLowerCase().includes('término') && 
          !mg.name.toLowerCase().includes('meat')
        )
      }));
      setProducts(cleanedProducts);
      setIngredients(savedIngredients);
      setCategories(savedCategories.length > 0 ? savedCategories : INITIAL_CATEGORIES);
      setTables(savedTables.length > 0 ? savedTables : INITIAL_TABLES);
      const migratedOrders = savedOrders.map((o: any) => ({
        ...o,
        payments: o.payments || o.partialPayments?.map((p: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          amount: p.amount,
          method: p.method,
          tip: 0,
          timestamp: p.date || o.date
        })) || [],
        tip: o.tip || 0
      }));
      setOrders(migratedOrders);
      setUsers(savedUsers);
      setShifts(savedShifts);
      setCashShifts(savedCashShifts);
      setRoles(savedRoles.length > 0 ? savedRoles : ROLES);
      
      if (savedSettings) {
        setSettings(savedSettings);
      } else {
        setSettings({
          name: initializeKey('restaurantName', storage.getRestaurantName(), 'DosPOS'),
          eventType: initializeKey('eventType', storage.getEventType(), 'Restaurante'),
          currency: 'MXN',
          taxRate: 0,
        });
      }

      setIsLoaded(true);
    };

    loadData();
  }, []);

  // Save on changes (individual effects)
  useEffect(() => {
    if (isLoaded) storage.saveProducts(products);
  }, [products, isLoaded]);

  useEffect(() => {
    if (isLoaded) storage.saveIngredients(ingredients);
  }, [ingredients, isLoaded]);

  useEffect(() => {
    if (isLoaded) storage.saveCategories(categories);
  }, [categories, isLoaded]);

  useEffect(() => {
    if (isLoaded) storage.saveTables(tables);
  }, [tables, isLoaded]);

  useEffect(() => {
    if (isLoaded) storage.saveOrders(orders);
  }, [orders, isLoaded]);

  useEffect(() => {
    if (isLoaded) storage.saveUsers(users);
  }, [users, isLoaded]);

  useEffect(() => {
    if (isLoaded) storage.saveShifts(shifts);
  }, [shifts, isLoaded]);

  useEffect(() => {
    if (isLoaded) storage.saveCashShifts(cashShifts);
  }, [cashShifts, isLoaded]);

  useEffect(() => {
    if (isLoaded) storage.saveRoles(roles);
  }, [roles, isLoaded]);

  // Set initial load to false after loading is complete and state has settled
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        isInitialLoadRef.current = false;
        prevOrdersRef.current = orders;
      }, 1500); // 1.5s delay to let WebSocket sync fully settle
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  // Listen for new orders to play the Kitchen Alarm and for ready orders to play the Ready Sound
  useEffect(() => {
    if (!isLoaded || isInitialLoadRef.current) return;

    let hasNewKitchenContent = false;

    // Check if any new orders were added
    const hasNewOrder = orders.some(o => !prevOrdersRef.current.some(prevO => prevO.id === o.id));
    if (hasNewOrder) {
      hasNewKitchenContent = true;
    } else {
      // Check if any existing order had new items/quantities added to it
      orders.forEach(order => {
        const prevOrder = prevOrdersRef.current.find(o => o.id === order.id);
        if (prevOrder) {
          const currentQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
          const prevQty = prevOrder.items.reduce((sum, item) => sum + item.quantity, 0);
          if (currentQty > prevQty) {
            hasNewKitchenContent = true;
          }
        }
      });
    }

    if (hasNewKitchenContent) {
      if (view === 'dispatch') {
        playKitchenAlarmSound();
      }
      triggerNativeNotification(
        '🚨 NUEVO PEDIDO / ACTUALIZACIÓN',
        'Hay comandas listas para preparar en cocina.'
      );
    }

    // Check if any existing order changed its status to 'ready'
    orders.forEach(order => {
      const prevOrder = prevOrdersRef.current.find(o => o.id === order.id);
      if (prevOrder) {
        if (prevOrder.status !== 'ready' && order.status === 'ready') {
          const location = order.type === 'dine-in' ? `Mesa ${order.table}` : (order.takeawayType?.toUpperCase() || 'LLEVAR');
          triggerNativeNotification(
            `🔔 ORDEN LISTA: ${location}`,
            `La orden de ${order.client} está lista para entregarse.`
          );
          if (view !== 'dispatch') {
            playReadyNotificationSound();
          }
        }
      }
    });

    prevOrdersRef.current = orders;
  }, [orders, isLoaded, view]);

  // Real-time WebSocket synchronization to keep all devices updated instantly
  useEffect(() => {
    if (!isLoaded) return;

    let reconnectTimeout: any = null;
    let isDisposed = false;

    const fetchInitialState = async () => {
      try {
        console.log("Fetching initial state via HTTP fallback...");
        const response = await fetch('/api/db');
        if (response.ok && !isDisposed) {
          const serverState = await response.json();
          if (serverState && Object.keys(serverState).length > 0) {
            console.log("HTTP fallback state loaded successfully!");
            Object.keys(serverState).forEach((key) => {
              applyServerUpdate(key, serverState[key]);
            });
          }
        }
      } catch (err) {
        console.error("HTTP fallback failed:", err);
      }
    };

    fetchInitialState();

    const connectWebSocket = () => {
      if (isDisposed) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}`;
      console.log("Intentando conectar a WebSocket:", wsUrl);

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("¡Conexión WebSocket establecida con éxito!");
        storage.registerSocket(socket);
      };

      socket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "INIT") {
            const serverState = message.state || {};
            
            // If the server has no state but client has local data, push local data to server
            if (Object.keys(serverState).length === 0) {
              const localData = {
                products: storage.getProducts(),
                ingredients: storage.getIngredients(),
                categories: storage.getCategories(),
                tables: storage.getTables(),
                orders: storage.getOrders(),
                users: storage.getUsers(),
                shifts: storage.getShifts(),
                cashShifts: storage.getCashShifts(),
                roles: storage.getRoles(),
                settings: storage.getSettings(),
                restaurantName: storage.getRestaurantName(),
                eventType: storage.getEventType()
              };

              if (localData.products.length > 0 || localData.orders.length > 0) {
                console.log("Servidor limpio detectado. Inicializando con datos de este dispositivo...");
                await storage.saveBulk(localData);
              }
              return;
            }

            // Sync initial state from server to client
            Object.keys(serverState).forEach((key) => {
              applyServerUpdate(key, serverState[key]);
            });
          } else if (message.type === "UPDATE") {
            applyServerUpdate(message.key, message.data);
          } else if (message.type === "UPDATE_BULK") {
            const serverState = message.state || {};
            Object.keys(serverState).forEach((key) => {
              applyServerUpdate(key, serverState[key]);
            });
          } else if (message.type === "RESET") {
            localStorage.clear();
            window.location.reload();
          }
        } catch (err) {
          console.error("Error procesando mensaje de WebSocket:", err);
        }
      };

      socket.onclose = () => {
        console.log("Conexión WebSocket cerrada. Reintentando en 3 segundos...");
        storage.registerSocket(null);
        if (!isDisposed) {
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        }
      };

      socket.onerror = (err) => {
        console.warn("Error de conexión en WebSocket:", err);
        storage.registerSocket(null);
        socket.close();
      };
    };

    const applyServerUpdate = (key: string, data: any) => {
      // Record server state to prevent sending duplicate save events back to server
      storage.setLastKnownServerState(key, data);

      if (key === "products") {
        setProducts((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_productos", JSON.stringify(data));
      } else if (key === "ingredients") {
        setIngredients((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_ingredientes", JSON.stringify(data));
      } else if (key === "categories") {
        setCategories((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_categorias", JSON.stringify(data));
      } else if (key === "tables") {
        setTables((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_tablas", JSON.stringify(data));
      } else if (key === "orders") {
        setOrders((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_ordenes", JSON.stringify(data));
      } else if (key === "users") {
        setUsers((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_usuarios", JSON.stringify(data));
      } else if (key === "shifts") {
        setShifts((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_turnos", JSON.stringify(data));
      } else if (key === "cashShifts") {
        setCashShifts((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_turnos_caja", JSON.stringify(data));
      } else if (key === "roles") {
        setRoles((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_roles", JSON.stringify(data));
      } else if (key === "settings") {
        setSettings((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_store_settings", JSON.stringify(data));
      } else if (key === "restaurantName") {
        localStorage.setItem("dospos_restaurant_name", data);
      } else if (key === "eventType") {
        localStorage.setItem("dospos_event_type", data);
      }
    };

    connectWebSocket();

    // Fallback polling to keep devices synced in environments with WebSocket restrictions
    const pollInterval = setInterval(() => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        fetchInitialState();
      }
    }, 5000);

    return () => {
      isDisposed = true;
      storage.registerSocket(null);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollInterval) clearInterval(pollInterval);
      if (socketRef.current) socketRef.current.close();
    };
  }, [isLoaded]);

  const restoreDatabase = (data: any) => {
    // 1. Persistencia inmediata y forzada para evitar fallos de renderizado
    if (data.products) storage.saveProducts(data.products);
    if (data.categories) storage.saveCategories(data.categories);
    if (data.tables) storage.saveTables(data.tables);
    if (data.orders) storage.saveOrders(data.orders);
    if (data.restaurantName) storage.saveRestaurantName(data.restaurantName);
    if (data.eventType) storage.saveEventType(data.eventType);
    if (data.users) storage.saveUsers(data.users);
    if (data.shifts) storage.saveShifts(data.shifts);
    if (data.cashShifts) storage.saveCashShifts(data.cashShifts);
    if (data.roles) storage.saveRoles(data.roles);

    // 2. Actualización de estado de React para reflejar en UI
    setProducts(data.products || []);
    setCategories(data.categories || []);
    setTables(data.tables || []);
    const migratedOrders = (data.orders || []).map((o: any) => ({
      ...o,
      payments: o.payments || o.partialPayments?.map((p: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        amount: p.amount,
        method: p.method,
        tip: 0,
        timestamp: p.date || o.date
      })) || [],
      tip: o.tip || 0
    }));
    setOrders(migratedOrders);
    setUsers(data.users || INITIAL_USERS);
    setShifts(data.shifts || []);
    setCashShifts(data.cashShifts || []);
    setRoles(data.roles || ROLES);
    setSettings(data.settings || storage.getSettings());
    
    // 3. Limpiar carrito para evitar conflictos con productos viejos
    setCart([]);
    
    console.log("Base de datos restaurada correctamente en el estado global.");
  };

  const splitOrder = (orderId: string, splitQuantities: Record<number, number>, payment: PaymentMethod, tip: number = 0) => {
    setOrders(prev => {
      const order = prev.find(o => o.id === orderId);
      if (!order) return prev;

      let currentPaidTotal = 0;
      const updatedItems = order.items.map((item, idx) => {
        const qtyToPay = splitQuantities[idx] || 0;
        const currentPaid = item.paidQuantity || 0;
        const newPaid = currentPaid + qtyToPay;
        currentPaidTotal += item.price * qtyToPay;
        return { ...item, paidQuantity: newPaid };
      });

      const newPayment: PaymentRecord = {
        id: Math.random().toString(36).substr(2, 9),
        method: payment,
        amount: currentPaidTotal,
        tip: tip,
        timestamp: new Date().toISOString()
      };

      const payments = [...(order.payments || []), newPayment];
      
      const allPaid = updatedItems.every(item => 
        (item.paidQuantity || 0) >= item.quantity
      );

      if (allPaid) {
        if (order.type === 'dine-in' && order.table) {
          setTables(prevTables => prevTables.map(t => 
            t.name === order.table ? { ...t, isOccupied: false } : t
          ));
        }
      }

      return prev.map(o => o.id === orderId ? {
        ...o,
        items: updatedItems,
        isPaid: allPaid,
        payment: allPaid ? payment : o.payment,
        status: allPaid ? 'delivered' : o.status,
        tip: (o.tip || 0) + tip,
        payments,
        updatedAt: new Date().toISOString()
      } : o);
    });
  };

  const currentUserRole = useMemo(() => 
    roles.find(r => r.name === currentUser?.role),
  [currentUser, roles]);

  const canAccessView = (v: ViewState) => {
    if (!currentUserRole) return false;
    return currentUserRole.permissions.includes(v);
  };

  // Migrate old roles to new roles
  useEffect(() => {
    setRoles(prevRoles => {
      let needsMigration = false;
      const updatedRoles = prevRoles.map(role => {
        if (role.permissions.includes('history') || role.permissions.includes('settings')) {
          needsMigration = true;
          return {
            ...role,
            permissions: Array.from(new Set(role.permissions.filter(p => p !== 'history' && p !== 'settings').concat('central' as ViewState)))
          };
        }
        return role;
      });
      return needsMigration ? updatedRoles : prevRoles;
    });
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("dospos_current_user", JSON.stringify(user));
    
    // Start shift
    const newShift: Shift = {
      id: Date.now().toString(),
      userId: user.id,
      userName: user.name,
      startTime: new Date().toISOString()
    };
    setShifts(prev => [newShift, ...prev]);
    setCurrentShiftId(newShift.id);
    localStorage.setItem("dospos_current_shift_id", newShift.id);

    // Set first available view
    const role = roles.find(r => r.name === user.role);
    if (role && role.permissions.length > 0) {
      setView(role.permissions[0]);
    }

    // Automatically check and prompt for box opening if it is closed and user is Admin or Caja
    const hasOpenShift = cashShifts.some(s => s.status === 'open');
    if (!hasOpenShift && (user.role === 'Admin' || user.role === 'Caja')) {
      setShowOpeningModal(true);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    // End shift
    if (currentShiftId) {
      setShifts(prev => prev.map(s => 
        s.id === currentShiftId ? { ...s, endTime: new Date().toISOString() } : s
      ));
    }

    setCurrentUser(null);
    setCurrentShiftId(null);
    localStorage.removeItem("dospos_current_user");
    localStorage.removeItem("dospos_current_shift_id");
    setView('login');
    setShowLogoutConfirm(false);
  };

  const handleOpenCashShift = (initialFund: number) => {
    if (!currentUser) return;
    const newShift: CashShift = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      openingTime: new Date().toISOString(),
      initialFund,
      status: 'open'
    };
    setCashShifts(prev => [...prev, newShift]);
    setView('pos');
  };

  const handleCloseCashShift = (
    actualCash: number, 
    actualTarjeta: number, 
    actualTransferencia: number, 
    notes?: string
  ) => {
    const openShift = cashShifts.find(s => s.status === 'open');
    if (!openShift) {
      console.error("No se encontró ningún turno de caja abierto.");
      return;
    }

    const stats = getCashShiftStats(openShift);
    const actualAmount = actualCash + actualTarjeta + actualTransferencia;
    
    const closedShift: CashShift = {
      ...openShift,
      closingTime: new Date().toISOString(),
      expectedAmount: stats.expectedAmount,
      actualAmount,
      difference: actualAmount - stats.expectedAmount,
      status: 'closed',
      notes,
      expectedCash: stats.expectedCash,
      actualCash,
      differenceCash: actualCash - stats.expectedCash,
      expectedTarjeta: stats.expectedTarjeta,
      actualTarjeta,
      differenceTarjeta: actualTarjeta - stats.expectedTarjeta,
      expectedTransferencia: stats.expectedTransferencia,
      actualTransferencia,
      differenceTransferencia: actualTransferencia - stats.expectedTransferencia,
      expectedOtros: stats.expectedOtros,
      expectedCourtesy: stats.expectedCourtesy
    };

    setCashShifts(prev => prev.map(s => s.id === openShift.id ? closedShift : s));
    setShowClosingModal(false);

    // Mandar a imprimir el ticket térmico del corte de caja inmediatamente con el objeto calculado
    printCashShiftTicketHTML(closedShift, settings.name || 'DOSPOS');
  };

  const getCashShiftStats = (shift: CashShift) => {
    let salesTotal = 0;
    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;
    let otherSales = 0;
    let courtesySales = 0;

    const shiftOpeningTime = new Date(shift.openingTime).getTime();
    const shiftClosingTime = shift.closingTime ? new Date(shift.closingTime).getTime() : null;

    orders.forEach(o => {
      // Excluir órdenes canceladas del corte de caja
      if (o.status === 'cancelled') return;

      if (o.payments && o.payments.length > 0) {
        // Si hay registros de pagos explícitos (pagos divididos o actualizados), procesar cada pago
        o.payments.forEach(p => {
          const paymentTime = new Date(p.timestamp).getTime();
          const inShift = paymentTime >= shiftOpeningTime && 
                          (!shiftClosingTime || paymentTime <= shiftClosingTime);
          
          if (inShift) {
            const amount = p.amount;
            const method = p.method;
            if (method !== 'Cortesía') {
              salesTotal += amount;
            }
            if (method === 'Efectivo') {
              cashSales += amount;
            } else if (method === 'Tarjeta') {
              cardSales += amount;
            } else if (method === 'Transferencia') {
              transferSales += amount;
            } else if (method === 'Uber' || method === 'Didi') {
              otherSales += amount;
            } else if (method === 'Cortesía') {
              courtesySales += amount;
            }
          }
        });
      } else if (o.isPaid) {
        // Si el pedido está pagado pero no tiene un arreglo de pagos explícito (pedidos anteriores o de legado)
        const orderTime = new Date(o.date).getTime();
        const inShift = orderTime >= shiftOpeningTime && 
                        (!shiftClosingTime || orderTime <= shiftClosingTime);
        
        if (inShift) {
          const amount = o.total;
          const method = o.payment;
          if (method !== 'Cortesía') {
            salesTotal += amount;
          }
          if (method === 'Efectivo') {
            cashSales += amount;
          } else if (method === 'Tarjeta') {
            cardSales += amount;
          } else if (method === 'Transferencia') {
            transferSales += amount;
          } else if (method === 'Uber' || method === 'Didi') {
            otherSales += amount;
          } else if (method === 'Cortesía') {
            courtesySales += amount;
          }
        }
      }
    });

    const expectedCash = shift.initialFund + cashSales;
    const expectedTarjeta = cardSales;
    const expectedTransferencia = transferSales;
    const expectedOtros = otherSales;
    const expectedCourtesy = courtesySales;

    // Expected amount of physical/electronic money in the cash drawer to reconcile (Cash + Cards + Bank Transfers)
    const expectedAmount = expectedCash + expectedTarjeta + expectedTransferencia;

    return { 
      salesTotal, 
      expectedAmount,
      expectedCash,
      expectedTarjeta,
      expectedTransferencia,
      expectedOtros,
      expectedCourtesy,
      cashSales,
      cardSales,
      transferSales,
      otherSales,
      courtesySales
    };
  };

  const pendingCount = useMemo(() => 
    orders.filter(o => o.status === 'pending' || o.status === 'preparing').length, 
  [orders]);

  const hasOpenCashShift = useMemo(() => {
    return cashShifts.some(s => s.status === 'open');
  }, [cashShifts]);

  const currentOpenCashShift = useMemo(() => {
    return cashShifts.find(s => s.status === 'open');
  }, [cashShifts]);

  const checkStockAndNotify = (product: Product, selectedModifiers: SelectedModifier[] | undefined, quantity: number = 1) => {
    const required: Record<string, number> = {};
    
    // Base recipe
    product.recipe?.forEach(ri => {
      required[ri.ingredientId] = (required[ri.ingredientId] || 0) + (ri.quantity * quantity);
    });

    // Modifiers recipe
    selectedModifiers?.forEach(sm => {
      const modifier = product.modifierGroups?.flatMap(g => g.modifiers).find(m => m.id === sm.modifierId);
      modifier?.recipe?.forEach(ri => {
        required[ri.ingredientId] = (required[ri.ingredientId] || 0) + (ri.quantity * quantity);
      });
    });

    // Check availability
    const lowIngredients: string[] = [];
    const outOfStock: string[] = [];

    Object.entries(required).forEach(([ingId, qty]) => {
      const ing = ingredients.find(i => i.id === ingId);
      if (ing) {
        if (ing.stock < qty) {
          outOfStock.push(ing.name);
        } else if (ing.stock - qty <= ing.minStock) {
          lowIngredients.push(ing.name);
        }
      }
    });

    if (outOfStock.length > 0) {
      const msg = `SIN STOCK: ${outOfStock.join(', ')}`;
      triggerNativeNotification('⚠️ Alerta de Inventario', msg);
      setActiveNotification({
        id: Date.now().toString(),
        message: msg,
        type: 'warning'
      });
      return false;
    } else if (lowIngredients.length > 0) {
      const msg = `STOCK BAJO: ${lowIngredients.join(', ')}`;
      triggerNativeNotification('⚠️ Alerta de Inventario', msg);
      setActiveNotification({
        id: Date.now().toString(),
        message: msg,
        type: 'warning'
      });
    }
    return true;
  };

  const addToCart = (product: Product, selectedModifiers?: SelectedModifier[], note?: string, isCombo?: boolean, selectedComboOptions?: ComboOption[]) => {
    if (!hasOpenCashShift && (currentUser?.role === 'Admin' || currentUser?.role === 'Caja')) {
      alert('Debes abrir la caja antes de tomar pedidos.');
      // Switch view to cash audit if possible or show modal
      setView('history');
      return;
    }
    
    checkStockAndNotify(product, selectedModifiers, 1);

    setCart(prev => {
      const modifierKey = selectedModifiers ? JSON.stringify(selectedModifiers) : '';
      const comboKey = JSON.stringify(selectedComboOptions || []);
      const existing = prev.find(item => 
        item.id === product.id && 
        JSON.stringify(item.selectedModifiers || []) === modifierKey &&
        (item.note || '') === (note || '') &&
        (item.isCombo || false) === (isCombo || false) &&
        JSON.stringify(item.selectedComboOptions || []) === comboKey
      );

      if (existing) {
        return prev.map(item => 
          (item.id === product.id && 
           JSON.stringify(item.selectedModifiers || []) === modifierKey &&
           (item.note || '') === (note || '') &&
           (item.isCombo || false) === (isCombo || false) &&
           JSON.stringify(item.selectedComboOptions || []) === comboKey)
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }

      // Calculate base price + modifiers + combo extra
      const extrasPrice = selectedModifiers?.reduce((acc, m) => acc + m.extraPrice, 0) || 0;
      const comboExtra = isCombo ? (selectedComboOptions?.reduce((acc, o) => acc + o.extraPrice, 0) || 0) : 0;
      const finalPrice = product.price + extrasPrice + comboExtra;

      return [...prev, { 
        ...product, 
        price: finalPrice, 
        quantity: 1, 
        note: note || '', 
        selectedModifiers,
        isCombo,
        selectedComboOptions
      }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        if (delta > 0) {
            checkStockAndNotify(item, item.selectedModifiers, 1);
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const updateCartNote = (id: string, note: string) => {
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, note } : item
    ));
  };

  const discountStock = (cartItems: CartItem[]) => {
    setIngredients(prev => {
      const newIngredients = [...prev];
      cartItems.forEach(item => {
        // Original product recipe
        const originalProduct = products.find(p => p.id === item.id);
        if (originalProduct?.recipe) {
          originalProduct.recipe.forEach(ri => {
            const ingIndex = newIngredients.findIndex(i => i.id === ri.ingredientId);
            if (ingIndex !== -1) {
              newIngredients[ingIndex] = { 
                ...newIngredients[ingIndex], 
                stock: newIngredients[ingIndex].stock - (ri.quantity * item.quantity),
                updatedAt: new Date().toISOString()
              };
            }
          });
        }

        // Selected modifiers recipes
        item.selectedModifiers?.forEach(sm => {
          const modifier = originalProduct?.modifierGroups?.flatMap(g => g.modifiers).find(m => m.id === sm.modifierId);
          if (modifier?.recipe) {
            modifier.recipe.forEach(ri => {
              const ingIndex = newIngredients.findIndex(i => i.id === ri.ingredientId);
              if (ingIndex !== -1) {
                newIngredients[ingIndex] = { 
                  ...newIngredients[ingIndex], 
                  stock: newIngredients[ingIndex].stock - (ri.quantity * item.quantity),
                  updatedAt: new Date().toISOString()
                };
              }
            });
          }
        });
      });
      return newIngredients;
    });
  };

  const resolveOrderStatus = (items: CartItem[], currentStatus: OrderStatus): OrderStatus => {
    if (items.length === 0) return currentStatus;

    const nonCancelledItems = items.filter(i => i.status !== 'cancelled');
    if (nonCancelledItems.length === 0) return 'cancelled';

    const allDelivered = nonCancelledItems.every(i => i.status === 'delivered');
    if (allDelivered) return 'delivered';

    const allReadyOrDelivered = nonCancelledItems.every(i => i.status === 'ready' || i.status === 'delivered');
    if (allReadyOrDelivered) return 'ready';

    // If there's at least one preparing, ready, or delivered item, the overall status is preparing
    const hasInFlightItems = nonCancelledItems.some(i => i.status === 'preparing' || i.status === 'ready' || i.status === 'delivered');
    if (hasInFlightItems) {
      return 'preparing';
    }

    // Otherwise, all items are pending
    return 'pending';
  };

  const createOrder = (
    client: string, 
    table: string, 
    payment: PaymentMethod, 
    type: OrderType, 
    takeawayType?: TakeawayType,
    tip: number = 0,
    payLater: boolean = false,
    address?: string
  ) => {
    if (cart.length === 0) return;

    // Discount stock before clearing cart
    discountStock(cart);

    const finalClient = client.trim() === '' ? 'Mostrador' : client;
    const finalTable = table.trim() === '' ? 'Mostrador' : table;

    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    // Check if it's a dine-in order and if there's already an open order for this table
    if (type === 'dine-in' && finalTable !== 'Mostrador') {
      const existingOrder = orders.find(o => o.table === finalTable && o.type === 'dine-in' && !o.isPaid && o.status !== 'cancelled');
      if (existingOrder) {
        // Add items to existing order
        setOrders(prev => prev.map(o => {
          if (o.id === existingOrder.id) {
            const updatedItems = [...o.items];
            cart.forEach(cartItem => {
              // New items are always 'pending'
              const newItem = { ...cartItem, status: 'pending' as OrderStatus };
              
              // We don't merge same products if statuses would be different, 
              // but for simplicity in kitchen view, we'll append unique item entries if they are new
              updatedItems.push(newItem);
            });
            return {
              ...o,
              items: updatedItems,
              total: o.total + total,
              status: resolveOrderStatus(updatedItems, o.status), // Smart resolution instead of hardcoded 'pending'
              updatedAt: new Date().toISOString()
            };
          }
          return o;
        }));
        setCart([]);
        setView('dispatch');
        return;
      }
    }

    const isPaidImmediately = type !== 'dine-in' && !payLater;
    const newPayment: PaymentRecord[] = isPaidImmediately ? [{
      id: Math.random().toString(36).substr(2, 9),
      method: payment,
      amount: total,
      tip: tip,
      timestamp: new Date().toISOString()
    }] : [];

    const newOrder: Order = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      client: finalClient,
      address: address?.trim() ? address.trim() : undefined,
      table: finalTable,
      payment: isPaidImmediately ? payment : 'Pendiente',
      status: 'pending',
      type,
      takeawayType,
      total,
      tip: isPaidImmediately ? tip : 0,
      items: cart.map(item => ({ 
        ...item, 
        status: 'pending' as OrderStatus,
        paidQuantity: isPaidImmediately ? item.quantity : 0 
      })),
      isPaid: isPaidImmediately,
      payments: newPayment,
      updatedAt: new Date().toISOString()
    };

    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    setSelectedTableId(null);
    
    // Check if can access dispatch before redirecting, otherwise go to first allowed view
    if (canAccessView('dispatch')) {
      setView('dispatch');
    } else {
      const firstAllowed = currentUserRole?.permissions[0] || 'login';
      setView(firstAllowed);
    }
  };

  const updateItemStatus = (orderId: string, itemIdx: number, status: OrderStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const newItems = [...o.items];
        newItems[itemIdx] = { ...newItems[itemIdx], status };
        
        // Auto-resolve overall order status based on individual item statuses
        const newOrderStatus = resolveOrderStatus(newItems, o.status);

        return { ...o, items: newItems, status: newOrderStatus, updatedAt: new Date().toISOString() };
      }
      return o;
    }));
  };

  const deliverOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { 
        ...o, 
        status: 'delivered' as const,
        items: o.items.map(item => ({ ...item, status: 'delivered' as OrderStatus })),
        updatedAt: new Date().toISOString()
      } : o
    ));
  };

  const startPreparingOrder = (orderId: string, minutes: number) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { 
        ...o, 
        status: 'preparing' as const, 
        estimatedMinutes: minutes,
        preparingAt: new Date().toISOString(),
        items: o.items.map(item => ({ 
          ...item, 
          status: (item.status === 'delivered' || item.status === 'ready') ? item.status : ('preparing' as OrderStatus) 
        })),
        updatedAt: new Date().toISOString()
      } : o
    ));
  };

  const updateOrderTime = (orderId: string, minutes: number) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, estimatedMinutes: minutes, updatedAt: new Date().toISOString() } : o
    ));
  };

  const playKitchenAlarmSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // We'll play alternating loud, piercing electronic siren-like beeps ("¡BEEP-BOOP BEEP-BOOP!")
      const playSirenBurst = (time: number, freq1: number, freq2: number, duration: number) => {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc1.type = 'sawtooth'; // Piercing sawtooth
        osc2.type = 'square';   // Buzzy square wave

        osc1.frequency.setValueAtTime(freq1, time);
        osc1.frequency.linearRampToValueAtTime(freq2, time + duration);

        osc2.frequency.setValueAtTime(freq1 * 1.5, time);
        osc2.frequency.linearRampToValueAtTime(freq2 * 1.5, time + duration);

        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.35, time + 0.04); // Fast attention-grabbing attack
        gainNode.gain.setValueAtTime(0.35, time + duration - 0.04);
        gainNode.gain.linearRampToValueAtTime(0, time + duration);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + duration);
        osc2.stop(time + duration);
      };

      // 4 quick piercing alternating sweeps for maximum urgency (buzzy alarm texture)
      playSirenBurst(now, 880, 1100, 0.22);
      playSirenBurst(now + 0.26, 1100, 880, 0.22);
      playSirenBurst(now + 0.52, 880, 1100, 0.22);
      playSirenBurst(now + 0.78, 1100, 880, 0.22);
    } catch (e) {
      console.warn('Audio kitchen alarm failed', e);
    }
  };

  const playReadyNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      const playBuzzBuzz = (time: number, duration: number) => {
        // High attention chime
        const chime = audioCtx.createOscillator();
        const chime2 = audioCtx.createOscillator();
        const chimeGain = audioCtx.createGain();

        chime.type = 'sine';
        chime.frequency.setValueAtTime(1320, time); // High E6 note
        chime2.type = 'sine';
        chime2.frequency.setValueAtTime(1584, time); // High G6 note

        chimeGain.gain.setValueAtTime(0, time);
        chimeGain.gain.linearRampToValueAtTime(0.2, time + 0.02);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        chime.connect(chimeGain);
        chime2.connect(chimeGain);
        chimeGain.connect(audioCtx.destination);

        // Low tactile vibrating buzzer
        const buzzer = audioCtx.createOscillator();
        const buzzGain = audioCtx.createGain();

        buzzer.type = 'square';
        buzzer.frequency.setValueAtTime(120, time); // Low buzzing freq

        // Rapid flutter modulation for distinct vibrating pager texture
        const buzzMod = audioCtx.createOscillator();
        const buzzModGain = audioCtx.createGain();
        buzzMod.type = 'sawtooth';
        buzzMod.frequency.setValueAtTime(75, time); // 75Hz rapid flutter
        buzzModGain.gain.setValueAtTime(0.12, time);

        buzzMod.connect(buzzModGain);
        buzzModGain.connect(buzzGain.gain);

        buzzGain.gain.setValueAtTime(0, time);
        buzzGain.gain.linearRampToValueAtTime(0.18, time + 0.01);
        buzzGain.gain.setValueAtTime(0.18, time + duration - 0.02);
        buzzGain.gain.linearRampToValueAtTime(0, time + duration);

        buzzer.connect(buzzGain);
        buzzGain.connect(audioCtx.destination);

        chime.start(time);
        chime2.start(time);
        buzzer.start(time);
        buzzMod.start(time);

        chime.stop(time + duration);
        chime2.stop(time + duration);
        buzzer.stop(time + duration);
        buzzMod.stop(time + duration);
      };

      // Two rapid, crisp tactile pager "buzz buzz" alarms with dual chimes
      playBuzzBuzz(now, 0.22);
      playBuzzBuzz(now + 0.28, 0.22);
    } catch (e) {
      console.warn('Audio ready notification failed', e);
    }
  };

  const markOrderReady = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setOrders(prev => prev.map(o => 
      o.id === orderId ? { 
        ...o, 
        status: 'ready' as const,
        readyAt: new Date().toISOString(),
        items: o.items.map(item => ({ 
          ...item, 
          status: item.status === 'delivered' ? 'delivered' : ('ready' as OrderStatus) 
        })),
        updatedAt: new Date().toISOString()
      } : o
    ));

    const location = order.type === 'dine-in' ? `Mesa ${order.table}` : (order.takeawayType?.toUpperCase() || 'LLEVAR');
    const message = `ORDEN LISTA: ${location} (${order.client})`;
    
    triggerNativeNotification(`🔔 ORDEN LISTA: ${location}`, `La orden de ${order.client} está lista para entregarse.`);
    playReadyNotificationSound();
    setActiveNotification({ id: orderId, message, type: 'ready' });
    
    // Auto hide notification after 10 seconds
    setTimeout(() => {
      setActiveNotification(prev => prev?.id === orderId ? null : prev);
    }, 10000);
  };

  const recordPayment = (orderId: string, amount: number, method: PaymentMethod, tip: number = 0) => {
    setOrders(prev => {
      const orderToPay = prev.find(o => o.id === orderId);
      if (!orderToPay) return prev;

      const newPayment: PaymentRecord = {
        id: Math.random().toString(36).substr(2, 9),
        amount,
        method,
        tip,
        timestamp: new Date().toISOString()
      };

      const updatedPayments = [...(orderToPay.payments || []), newPayment];
      const totalPaid = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
      const allPaid = totalPaid >= orderToPay.total;

      if (allPaid && orderToPay.type === 'dine-in' && orderToPay.table) {
        setTables(prevTables => prevTables.map(t => 
          t.name === orderToPay.table ? { ...t, isOccupied: false } : t
        ));
      }

      return prev.map(o => {
        if (o.id === orderId) {
          return { 
            ...o, 
            isPaid: allPaid, 
            payment: allPaid ? method : o.payment, 
            status: allPaid ? 'delivered' : o.status,
            payments: updatedPayments,
            tip: (o.tip || 0) + tip,
            items: o.items.map(item => ({ 
              ...item, 
              paidQuantity: allPaid ? item.quantity : (item.paidQuantity || 0) + (item.quantity * (amount / o.total))
            })),
            updatedAt: new Date().toISOString()
          };
        }
        return o;
      });
    });
  };

  const payOrder = (orderId: string, payment: PaymentMethod, tip: number = 0, amount?: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const alreadyPaid = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
    const remaining = Math.max(0, order.total - alreadyPaid);
    
    const amountToPay = amount !== undefined ? Math.min(amount, remaining) : remaining;
    
    recordPayment(orderId, amountToPay, payment, tip);
  };

  const cancelOrder = (orderId: string) => {
    setOrders(prev => {
      const order = prev.find(o => o.id === orderId);
      if (order && order.type === 'dine-in' && order.table) {
        setTables(prevTables => prevTables.map(t => 
          t.name === order.table ? { ...t, isOccupied: false } : t
        ));
      }
      return prev.map(o => 
        o.id === orderId ? { ...o, status: 'cancelled', updatedAt: new Date().toISOString() } : o
      );
    });
  };

  const transferOrder = (orderId: string, newTable: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, table: newTable, updatedAt: new Date().toISOString() } : o
    ));
  };

  const handleUpdateSettings = (newSettings: StoreSettings) => {
    setSettings(newSettings);
    storage.saveSettings(newSettings);
  };

  const handleFactoryReset = () => {
    // 1. Clear everything from localStorage
    localStorage.clear();
    
    // 2. Clear all React states to prevent them from re-saving via hooks
    setProducts([]);
    setCategories([]);
    setTables([]);
    setOrders([]);
    setUsers([]);
    setIngredients([]);
    setShifts([]);
    setCashShifts([]);
    setSettings({
      name: 'DosPOS',
      eventType: 'Restaurante',
      currency: 'MXN',
      taxRate: 0,
    });
    
    // 3. Immediately reload the page
    window.location.reload();
  };

  const handleSetupComplete = (adminUser: User) => {
    setUsers([adminUser]);
    setCurrentUser(adminUser);
    localStorage.setItem("dospos_current_user", JSON.stringify(adminUser));
    setView('central');
    setAdminView('overview');
  };

  const renderNotificationButton = () => {
    if (notificationPermission === 'unsupported') return null;

    let buttonClass = "";
    let iconColor = "";
    let titleText = "";
    let badge = null;

    if (notificationPermission === 'default') {
      buttonClass = "bg-amber-600/10 hover:bg-amber-600/20 border-amber-500/30 text-amber-500 animate-pulse";
      iconColor = "stroke-amber-500";
      titleText = "Habilitar Notificaciones de Sistema";
      badge = <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />;
    } else if (notificationPermission === 'granted') {
      buttonClass = "bg-green-600/10 hover:bg-green-600/20 border-green-500/30 text-green-500";
      iconColor = "stroke-green-500";
      titleText = "Notificaciones Activas (Click para probar)";
    } else {
      buttonClass = "bg-red-600/10 hover:bg-red-600/20 border-red-500/30 text-red-500 opacity-60";
      iconColor = "stroke-red-500";
      titleText = "Notificaciones Bloqueadas por el Navegador";
    }

    const handleClick = () => {
      if (notificationPermission === 'default') {
        requestNotificationPermission();
      } else if (notificationPermission === 'granted') {
        triggerNativeNotification('🔔 DosPOS', '¡Prueba de notificación del sistema exitosa!');
        playReadyNotificationSound();
      } else {
        alert("Las notificaciones están bloqueadas en la configuración de su navegador. Por favor, habilítelas manualmente.");
      }
    };

    return (
      <button
        onClick={handleClick}
        className={`p-2 rounded-xl border transition-all relative flex items-center justify-center ${buttonClass}`}
        title={titleText}
      >
        {notificationPermission === 'denied' ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconColor}>
            <path d="m13.73 21a1.9 1.9 0 0 1-3.46 0" />
            <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
            <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
            <path d="M18 8a6 6 0 0 0-9.33-5" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconColor}>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        )}
        {badge}
      </button>
    );
  };

  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin text-red-600"><Icons.Settings /></div>
          <p className="font-black uppercase tracking-widest text-xs">Iniciando Sistema...</p>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  if (!currentUser) {
    return <LoginView users={users} onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <header className="bg-black text-white shadow-md flex-shrink-0 z-[100] relative no-print border-b border-red-600">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-red-600">
              <Icons.ChefHat />
            </span>
            <div className="leading-tight">
              <h1 className="text-lg font-black tracking-tighter uppercase whitespace-nowrap">{settings.name}</h1>
              <div className="flex items-center space-x-2">
                <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">
                  {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <span className="w-1 h-1 bg-red-600/30 rounded-full"></span>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{settings.eventType}</p>
              </div>
            </div>
          </div>
          
          <TabNavigation 
            activeView={view} 
            onViewChange={(newView) => {
              setView(newView);
              setShowOrdersSlider(false);
            }} 
            adminView={adminView}
            onAdminViewChange={setAdminView}
            pendingCount={pendingCount} 
            activeOrdersCount={orders.filter(o => !(o.isPaid && o.status === 'delivered') && o.status !== 'cancelled').length}
            onToggleOrders={() => setShowOrdersSlider(true)}
            permissions={currentUserRole?.permissions || []}
            currentUser={currentUser}
            onLogout={handleLogout}
            hasOpenCashShift={hasOpenCashShift}
            onOpenCashShift={() => setShowOpeningModal(true)}
            onCloseCashShift={() => setShowClosingModal(true)}
          />

          <div className="hidden lg:flex items-center space-x-3">
             {renderNotificationButton()}
             <div className="flex flex-col items-end leading-none">
                <span className="text-[9px] font-black uppercase text-red-500 tracking-tighter">{currentUser.role}</span>
                <span className="text-sm font-black uppercase tracking-tight">{currentUser.name}</span>
             </div>
             <button 
               onClick={() => {
                 console.log("Logout triggered");
                 handleLogout();
               }}
               className="p-2 rounded-xl bg-slate-100/10 text-white/50 hover:bg-red-600 hover:text-white transition-all border border-white/10 hover:border-red-600"
               title="Cerrar Sesión"
             >
               <Icons.X size={18} />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-grow overflow-auto pb-24 md:pb-0">
        <div className="h-full">
          {view === 'pos' && canAccessView('pos') && (
            <POSView 
              products={products}
              categories={categories}
              cart={cart}
              orders={orders}
              tables={tables}
              initialTableId={selectedTableId}
              hasOpenCashShift={hasOpenCashShift}
              onOpenShift={() => setShowOpeningModal(true)}
              onCloseShift={() => setShowClosingModal(true)}
              onAddToCart={addToCart} 
              onUpdateQuantity={updateCartQuantity}
              onUpdateNote={updateCartNote}
              onCheckout={createOrder}
              onDeliver={deliverOrder}
              onUpdateItemStatus={updateItemStatus}
              onPay={payOrder}
              onCancel={cancelOrder}
              onToggleOrders={() => setShowOrdersSlider(true)}
              users={users}
              roles={roles}
            />
          )}
          {view === 'central' && canAccessView('central') && (
            <AdminCRM 
              activeTab={adminView}
              setActiveTab={setAdminView}
              products={products}
              categories={categories}
              tables={tables}
              orders={orders}
              cashShifts={cashShifts}
              users={users}
              roles={roles}
              shifts={shifts}
              settings={settings}
              hasOpenCashShift={hasOpenCashShift}
              onUpdateProducts={setProducts}
              onUpdateCategories={setCategories}
              onUpdateTables={setTables}
              onUpdateUsers={setUsers}
              onUpdateRoles={setRoles}
              onUpdateSettings={handleUpdateSettings}
              onRestoreDatabase={restoreDatabase}
              onFactoryReset={handleFactoryReset}
              onCloseCashShift={() => setShowClosingModal(true)}
              ingredients={ingredients}
              setIngredients={setIngredients}
            />
          )}
          {view === 'dispatch' && canAccessView('dispatch') && (
            <DispatchView 
              orders={orders} 
              tables={tables}
              onDeliver={deliverOrder}
              onPay={payOrder}
              onCancel={cancelOrder}
              onTransfer={transferOrder}
              onStartPreparing={startPreparingOrder}
              onMarkReady={markOrderReady}
              onUpdateTime={updateOrderTime}
              onUpdateItemStatus={updateItemStatus}
              restaurantName={settings.name}
            />
          )}
          {view === 'tables' && canAccessView('tables') && (
            <TablesView 
              tables={tables} 
              orders={orders}
              onSelectTable={(tableId) => {
                setSelectedTableId(tableId);
                setView('pos');
              }}
              onPay={payOrder}
              onSplitOrder={splitOrder}
              onCancel={cancelOrder}
              onDeliver={deliverOrder}
              restaurantName={settings.name}
              users={users}
              roles={roles}
            />
          )}
        </div>
      </main>
      
      <footer className="hidden md:block bg-black text-slate-500 border-t border-red-900 text-center py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] no-print safe-bottom">
        Sistema POS - Red & Black Edition - {new Date().getFullYear()}
      </footer>

      <ActiveOrdersSlider 
        isOpen={showOrdersSlider}
        onClose={() => setShowOrdersSlider(false)}
        orders={orders}
        onDeliver={deliverOrder}
        onUpdateItemStatus={updateItemStatus}
        onPay={payOrder}
        onCancel={cancelOrder}
        users={users}
        roles={roles}
      />

      {/* Global Notification */}
      <AnimatePresence mode="wait">
        {activeNotification && (
          <motion.div 
            key={activeNotification.id}
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-4"
          >
             <div className={`
               backdrop-blur-md p-4 rounded-2xl shadow-2xl flex items-center space-x-4 border
               ${activeNotification.type === 'ready' 
                 ? 'bg-black text-white border-green-500/50' 
                 : 'bg-red-600 text-white border-white/20'}
             `}>
                <div className={`p-2 rounded-lg ${activeNotification.type === 'ready' ? 'bg-green-600' : 'bg-white text-red-600'}`}>
                   {activeNotification.type === 'ready' ? <Icons.Check /> : <Icons.Activity />}
                </div>
                <div className="flex-grow">
                   <p className={`text-[9px] font-black uppercase tracking-widest ${activeNotification.type === 'ready' ? 'text-green-500' : 'text-red-100'}`}>
                     {activeNotification.type === 'ready' ? 'Pedido Listo' : 'Aviso de Inventario'}
                   </p>
                   <p className="text-xs font-black uppercase tracking-tight leading-tight">{activeNotification.message}</p>
                </div>
                <button 
                  onClick={() => setActiveNotification(null)}
                  className="text-white/50 hover:text-white transition p-1"
                >
                  <Icons.X size={16} />
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl relative z-[1001] text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                <Icons.X size={40} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Cerrar Sesión</h2>
              <p className="text-slate-500 font-medium tracking-tight mb-8">
                ¿Estás seguro que deseas salir? El turno actual se cerrará automáticamente.
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={confirmLogout}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition shadow-lg shadow-red-200"
                >
                  Sí, Cerrar Sesión
                </button>
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showOpeningModal && (
          <CashOpeningModal 
            onOpen={(fund) => {
              handleOpenCashShift(fund);
              setShowOpeningModal(false);
            }}
            onClose={() => setShowOpeningModal(false)}
          />
        )}

        {showClosingModal && currentOpenCashShift && (
          <CashClosingModal 
            expectedAmount={getCashShiftStats(currentOpenCashShift).expectedAmount}
            initialFund={currentOpenCashShift.initialFund}
            salesTotal={getCashShiftStats(currentOpenCashShift).salesTotal}
            expectedCash={getCashShiftStats(currentOpenCashShift).expectedCash}
            expectedTarjeta={getCashShiftStats(currentOpenCashShift).expectedTarjeta}
            expectedTransferencia={getCashShiftStats(currentOpenCashShift).expectedTransferencia}
            expectedOtros={getCashShiftStats(currentOpenCashShift).expectedOtros}
            expectedCourtesy={getCashShiftStats(currentOpenCashShift).expectedCourtesy}
            onConfirm={handleCloseCashShift}
            onClose={() => setShowClosingModal(false)}
            openingTime={currentOpenCashShift.openingTime}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
