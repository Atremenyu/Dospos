
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Order, ViewState, CartItem, PaymentMethod, Category, Table, OrderType, TakeawayType, OrderStatus, User, Shift, SelectedModifier, CashShift, UserRole, PaymentRecord, StoreSettings, AdminTabType, ComboOption, Ingredient, Promotion } from './types';
import { storage, generateSecureId } from './services/storage';
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
import { printCashShiftTicketHTML, computeShiftCategorySales } from './services/thermalPrinter';
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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
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
  
  const [settings, setSettings] = useState<StoreSettings>(() => {
    return storage.getSettings();
  });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeNotification, setActiveNotification] = useState<{ id: string, message: string, type: 'ready' | 'warning' } | null>(null);
  const [showOrdersSlider, setShowOrdersSlider] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [showShiftBlockModal, setShowShiftBlockModal] = useState(false);
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
      } catch (err: any) {
        console.warn("Conexión con servidor en espera, cargando datos locales:", err?.message || err);
      }

      const serverHasData = Object.keys(serverState).length > 0;

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
        promotions: 'dospos_promociones',
        restaurantName: 'dospos_restaurant_name',
        eventType: 'dospos_event_type',
      };

      const initializeKey = (key: string, localValue: any, fallbackValue: any) => {
        const lsKey = apiToLocalStorageMap[key];
        if (serverHasData && serverState[key] !== undefined) {
          const data = serverState[key];
          storage.setLastKnownServerState(key, data);
          
          if (lsKey) {
            if (typeof data === 'string') {
              localStorage.setItem(lsKey, data);
            } else {
              localStorage.setItem(lsKey, JSON.stringify(data));
            }
          }
          return data;
        } else {
          const hasStored = lsKey ? localStorage.getItem(lsKey) !== null : false;
          return hasStored ? localValue : fallbackValue;
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
      const savedPromotions = initializeKey('promotions', storage.getPromotions() || [], []);
      const savedSettings = initializeKey('settings', storage.getSettings(), null);

      const hasStoredProducts = (serverHasData && serverState['products'] !== undefined) || localStorage.getItem('dospos_productos') !== null;
      const rawProducts = hasStoredProducts ? savedProducts : INITIAL_PRODUCTS;
      const cleanedProducts = (rawProducts || []).map((p: any) => ({
        ...p,
        modifierGroups: p.modifierGroups?.filter((mg: any) => 
          !mg.name.toLowerCase().includes('término') && 
          !mg.name.toLowerCase().includes('meat')
        )
      }));
      setProducts(cleanedProducts);
      setIngredients(savedIngredients);
      const hasStoredCategories = (serverHasData && serverState['categories'] !== undefined) || localStorage.getItem('dospos_categorias') !== null;
      setCategories(hasStoredCategories ? savedCategories : INITIAL_CATEGORIES);
      const hasStoredTables = (serverHasData && serverState['tables'] !== undefined) || localStorage.getItem('dospos_tablas') !== null;
      setTables(hasStoredTables ? savedTables : INITIAL_TABLES);
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

      // Ensure active session has a tracked shift
      if (currentUser) {
        const activeUserShift = savedShifts.find((s: Shift) => s.userId === currentUser.id && !s.endTime);
        if (!activeUserShift) {
          const autoShift: Shift = {
            id: Date.now().toString(),
            userId: currentUser.id,
            userName: currentUser.name,
            startTime: new Date().toISOString()
          };
          savedShifts.unshift(autoShift);
          setCurrentShiftId(autoShift.id);
          localStorage.setItem("dospos_current_shift_id", autoShift.id);
        } else {
          setCurrentShiftId(activeUserShift.id);
          localStorage.setItem("dospos_current_shift_id", activeUserShift.id);
        }
      }

      setShifts(savedShifts);
      setCashShifts(savedCashShifts);
      setRoles(savedRoles.length > 0 ? savedRoles : ROLES);
      setPromotions(savedPromotions);
      
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

  useEffect(() => {
    if (isLoaded) storage.savePromotions(promotions);
  }, [promotions, isLoaded]);

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
    let isFetching = false;

    const fetchInitialState = async () => {
      if (isDisposed || isFetching) return;
      isFetching = true;
      try {
        const response = await fetch('/api/db');
        if (response.ok && !isDisposed) {
          const serverState = await response.json();
          if (serverState && Object.keys(serverState).length > 0) {
            Object.keys(serverState).forEach((key) => {
              applyServerUpdate(key, serverState[key]);
            });
          }
        }
      } catch (err: any) {
        console.warn("Sincronización HTTP en espera de conexión:", err?.message || err);
      } finally {
        isFetching = false;
      }
    };

    fetchInitialState();

    let reconnectAttempts = 0;

    const connectWebSocket = () => {
      if (isDisposed) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}`;
      if (reconnectAttempts === 0) {
        console.log("Conectando sincronización en tiempo real:", wsUrl);
      }

      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl);
      } catch (err) {
        // Fallback gracefully to polling if WebSocket constructor fails
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttempts = 0;
        console.log("¡Conexión de sincronización establecida con éxito!");
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
        } catch (err: any) {
          console.warn("Mensaje de sincronización no procesable:", err?.message || err);
        }
      };

      socket.onclose = () => {
        storage.registerSocket(null);
        if (!isDisposed) {
          reconnectAttempts++;
          // Intelligent backoff: 3s -> 4.5s -> 6.75s -> 10s ... capped at 30s
          const backoffDelay = Math.min(3000 * Math.pow(1.5, Math.min(reconnectAttempts, 6)), 30000);
          if (reconnectAttempts <= 2) {
            console.log(`Reintentando sincronización WebSocket en ${(backoffDelay / 1000).toFixed(1)}s...`);
          }
          reconnectTimeout = setTimeout(connectWebSocket, backoffDelay);
        }
      };

      socket.onerror = () => {
        // Quiet failure to prevent flooding console on static hosts like Netlify
        storage.registerSocket(null);
        try {
          socket.close();
        } catch {}
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
        if (Array.isArray(data)) {
          setOrders((prev) => {
            const orderMap = new Map<string, Order>();
            // Keep local pending orders that might not be on server yet
            prev.forEach((o: Order) => {
              if (o && o.id) orderMap.set(o.id, o);
            });
            // Overwrite with incoming server state where available
            data.forEach((o: Order) => {
              if (o && o.id) orderMap.set(o.id, o);
            });
            const merged = Array.from(orderMap.values()).sort((a, b) => 
              new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
            );
            localStorage.setItem("dospos_ordenes", JSON.stringify(merged));
            return merged;
          });
        }
      } else if (key === "users") {
        setUsers((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_usuarios", JSON.stringify(data));
      } else if (key === "shifts") {
        if (Array.isArray(data)) {
          setShifts((prev) => {
            const shiftMap = new Map<string, Shift>();
            prev.forEach(s => { if (s && s.id) shiftMap.set(s.id, s); });
            data.forEach((s: Shift) => { if (s && s.id) shiftMap.set(s.id, s); });
            const merged = Array.from(shiftMap.values()).sort((a, b) => 
              new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime()
            );
            localStorage.setItem("dospos_turnos", JSON.stringify(merged));
            return merged;
          });
        }
      } else if (key === "cashShifts") {
        if (Array.isArray(data)) {
          setCashShifts((prev) => {
            const shiftMap = new Map<string, CashShift>();
            prev.forEach(s => { if (s && s.id) shiftMap.set(s.id, s); });
            data.forEach((s: CashShift) => {
              if (s && s.id) {
                const existing = shiftMap.get(s.id);
                // If locally closed, never revert to open
                if (existing && existing.status === 'closed' && s.status === 'open') {
                  return;
                }
                shiftMap.set(s.id, s);
              }
            });
            const merged = Array.from(shiftMap.values()).sort((a, b) => 
              new Date(b.openingTime || 0).getTime() - new Date(a.openingTime || 0).getTime()
            );
            localStorage.setItem("dospos_turnos_caja", JSON.stringify(merged));
            return merged;
          });
        }
      } else if (key === "roles") {
        setRoles((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_roles", JSON.stringify(data));
      } else if (key === "promotions") {
        setPromotions((prev) => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        localStorage.setItem("dospos_promociones", JSON.stringify(data));
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
    if (data.promotions) storage.savePromotions(data.promotions);

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
    setPromotions(data.promotions || []);
    setSettings(data.settings || storage.getSettings());
    
    // 3. Limpiar carrito para evitar conflictos con productos viejos
    setCart([]);
    
    console.log("Base de datos restaurada correctamente en el estado global.");
  };

  const staleOpenCashShift = useMemo(() => {
    const open = cashShifts.find(s => s.status === 'open');
    if (!open) return null;
    const openingDate = new Date(open.openingTime);
    const today = new Date();
    // Identificar turnos abiertos en días de calendario anteriores
    const isPastCalendarDay = 
      openingDate.getFullYear() !== today.getFullYear() ||
      openingDate.getMonth() !== today.getMonth() ||
      openingDate.getDate() !== today.getDate();
    return isPastCalendarDay ? open : null;
  }, [cashShifts]);

  const hasOpenCashShift = useMemo(() => {
    // Si hay un turno del día anterior sin cerrar, no hay turno válido activo para hoy
    if (staleOpenCashShift) return false;
    return cashShifts.some(s => {
      if (s.status !== 'open') return false;
      const openingDate = new Date(s.openingTime);
      const today = new Date();
      return (
        openingDate.getFullYear() === today.getFullYear() &&
        openingDate.getMonth() === today.getMonth() &&
        openingDate.getDate() === today.getDate()
      );
    });
  }, [cashShifts, staleOpenCashShift]);

  const currentOpenCashShift = useMemo(() => {
    if (staleOpenCashShift) return null;
    return cashShifts.find(s => {
      if (s.status !== 'open') return false;
      const openingDate = new Date(s.openingTime);
      const today = new Date();
      return (
        openingDate.getFullYear() === today.getFullYear() &&
        openingDate.getMonth() === today.getMonth() &&
        openingDate.getDate() === today.getDate()
      );
    }) || null;
  }, [cashShifts, staleOpenCashShift]);

  const activeShiftForClosing = useMemo(() => {
    return staleOpenCashShift || currentOpenCashShift || cashShifts.find(s => s.status === 'open') || null;
  }, [staleOpenCashShift, currentOpenCashShift, cashShifts]);

  const isShiftOpenValidToday = useMemo(() => {
    if (staleOpenCashShift) return false;
    return hasOpenCashShift;
  }, [staleOpenCashShift, hasOpenCashShift]);

  const requireOpenShiftOrBlock = (): boolean => {
    if (!isShiftOpenValidToday) {
      setShowShiftBlockModal(true);
      return false;
    }
    return true;
  };

  const splitOrder = (orderId: string, splitQuantities: Record<number, number>, payment: PaymentMethod, tip: number = 0) => {
    if (!requireOpenShiftOrBlock()) {
      return;
    }

    const order = orders.find(o => o.id === orderId);
    if (!order) return;

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

    setOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      items: updatedItems,
      isPaid: allPaid,
      payment: allPaid ? payment : o.payment,
      tip: (o.tip || 0) + tip,
      payments,
      updatedAt: new Date().toISOString()
    } : o));
  };

  const currentUserRole = useMemo(() => 
    roles.find(r => r.name?.toLowerCase() === currentUser?.role?.toLowerCase()),
  [currentUser, roles]);

  const canAccessView = (v: ViewState) => {
    if (!currentUser) return false;
    if (currentUser.role?.toLowerCase() === 'admin') return true;
    if (!currentUserRole) return true;
    return currentUserRole.permissions.includes(v);
  };

  // Migrate old roles to new roles
  useEffect(() => {
    setRoles(prevRoles => {
      let needsMigration = false;
      const updatedRoles = prevRoles.map(role => {
        const perms = role.permissions as string[];
        if (perms.includes('history') || perms.includes('settings')) {
          needsMigration = true;
          return {
            ...role,
            permissions: Array.from(new Set(perms.filter(p => p !== 'history' && p !== 'settings').concat('central'))) as ViewState[]
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

    // Automatically check and prompt for box opening or previous day shift closing
    const staleShift = cashShifts.find(s => {
      if (s.status !== 'open') return false;
      const openingDate = new Date(s.openingTime);
      const today = new Date();
      return (
        openingDate.getFullYear() !== today.getFullYear() ||
        openingDate.getMonth() !== today.getMonth() ||
        openingDate.getDate() !== today.getDate()
      );
    });

    if (staleShift && (user.role === 'Admin' || user.role === 'Caja')) {
      setShowClosingModal(true);
    } else {
      const hasTodayShift = cashShifts.some(s => {
        if (s.status !== 'open') return false;
        const openingDate = new Date(s.openingTime);
        const today = new Date();
        return (
          openingDate.getFullYear() === today.getFullYear() &&
          openingDate.getMonth() === today.getMonth() &&
          openingDate.getDate() === today.getDate()
        );
      });
      if (!hasTodayShift && (user.role === 'Admin' || user.role === 'Caja')) {
        setShowOpeningModal(true);
      }
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

  const getCashShiftStats = (shift: CashShift, cutoffOverride?: number) => {
    let salesTotal = 0;
    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;
    let otherSales = 0;
    let courtesySales = 0;

    const shiftOpeningTime = new Date(shift.openingTime).getTime();
    
    // Si el turno está cerrado, usar su fecha de cierre.
    // Si está abierto pero es de un día previo, acotar el corte al fin de esa jornada para evitar empalmar ventas de días no usados.
    let shiftClosingTime: number;
    if (cutoffOverride) {
      shiftClosingTime = cutoffOverride;
    } else if (shift.closingTime) {
      shiftClosingTime = new Date(shift.closingTime).getTime();
    } else {
      const openingDate = new Date(shift.openingTime);
      const today = new Date();
      const isPastDay = openingDate.toDateString() !== today.toDateString();
      if (isPastDay) {
        const endOfOpeningDay = new Date(openingDate);
        endOfOpeningDay.setHours(23, 59, 59, 999);
        shiftClosingTime = Math.max(endOfOpeningDay.getTime(), shiftOpeningTime);
      } else {
        shiftClosingTime = Date.now();
      }
    }

    // Calcular inicio efectivo del turno:
    // Captura ventas del mismo día calendario anteriores a la apertura formal sin robar ventas de turnos cerrados previos
    const shiftDate = new Date(shift.openingTime);
    const startOfShiftDay = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 0, 0, 0, 0).getTime();
    
    const previousClosedShifts = cashShifts.filter(s => 
      s.id !== shift.id && 
      s.status === 'closed' && 
      new Date(s.closingTime || s.openingTime).getTime() <= shiftOpeningTime
    ).sort((a, b) => new Date(b.closingTime || b.openingTime).getTime() - new Date(a.closingTime || a.openingTime).getTime());
    
    const lastClosingTime = previousClosedShifts.length > 0 && previousClosedShifts[0].closingTime
      ? new Date(previousClosedShifts[0].closingTime).getTime()
      : 0;

    const effectiveStartTime = Math.min(shiftOpeningTime, Math.max(lastClosingTime, startOfShiftDay));

    orders.forEach(o => {
      // Excluir órdenes canceladas del corte de caja
      if (o.status === 'cancelled') return;

      if (o.payments && o.payments.length > 0) {
        // Si hay registros de pagos explícitos (pagos divididos o actualizados), procesar cada pago
        o.payments.forEach(p => {
          const paymentTime = new Date(p.timestamp).getTime();
          const inShift = paymentTime >= effectiveStartTime && paymentTime <= shiftClosingTime;
          
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
        const inShift = orderTime >= effectiveStartTime && orderTime <= shiftClosingTime;
        
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

  const handleOpenCashShift = (initialFund: number) => {
    if (!currentUser) return;
    if (staleOpenCashShift) {
      alert("Existe un turno anterior sin cerrar. Realiza el corte del turno anterior antes de abrir la caja hoy.");
      setShowClosingModal(true);
      return;
    }

    const existingOpenToday = cashShifts.find(s => {
      if (s.status !== 'open') return false;
      const openingDate = new Date(s.openingTime);
      const today = new Date();
      return (
        openingDate.getFullYear() === today.getFullYear() &&
        openingDate.getMonth() === today.getMonth() &&
        openingDate.getDate() === today.getDate()
      );
    });
    if (existingOpenToday) {
      console.warn("Ya existe un turno de caja abierto hoy:", existingOpenToday.id);
      setView('pos');
      return;
    }

    const newShift: CashShift = {
      id: generateSecureId('csh'),
      userId: currentUser.id,
      userName: currentUser.name,
      openingTime: new Date().toISOString(),
      initialFund,
      status: 'open',
      updatedAt: new Date().toISOString()
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
    const shiftToClose = activeShiftForClosing;
    if (!shiftToClose) {
      console.error("No se encontró ningún turno de caja abierto.");
      return;
    }

    const stats = getCashShiftStats(shiftToClose);
    const actualAmount = actualCash + actualTarjeta + actualTransferencia;
    
    // Si era un turno de un día previo, cerrar con fecha de corte de ese día para no contaminar días posteriores
    const openingDate = new Date(shiftToClose.openingTime);
    const today = new Date();
    const isPastDay = openingDate.toDateString() !== today.toDateString();
    const closingTime = isPastDay 
      ? new Date(new Date(openingDate).setHours(23, 59, 59, 999)).toISOString()
      : new Date().toISOString();

    // Calcular desglose de ventas por categoría
    const categoryData = computeShiftCategorySales(shiftToClose, orders, products, cashShifts);

    const closedShift: CashShift = {
      ...shiftToClose,
      closingTime,
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
      expectedCourtesy: stats.expectedCourtesy,
      categoryBreakdown: categoryData.categoryBreakdown,
      totalArticlesSold: categoryData.totalArticlesSold,
      updatedAt: new Date().toISOString()
    };

    // Auto-close any dine-in orders that were paid during this shift and free the tables
    setOrders(prevOrders => {
      let changed = false;
      const updated = prevOrders.map(o => {
        if (o.type === 'dine-in' && !o.closedAt && o.status !== 'cancelled') {
          const totalPaid = o.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
          if (totalPaid >= o.total || o.isPaid) {
            changed = true;
            return {
              ...o,
              closedAt: closingTime,
              status: (o.status === 'pending' || o.status === 'preparing') ? o.status : ('delivered' as const),
              updatedAt: new Date().toISOString()
            };
          }
        }
        return o;
      });
      if (changed) {
        storage.saveOrders(updated);
      }
      return updated;
    });

    // Free any tables that were occupied
    setTables(prevTables => prevTables.map(t => ({ ...t, isOccupied: false })));

    setCashShifts(prev => prev.map(s => s.id === shiftToClose.id ? closedShift : s));
    setShowClosingModal(false);

    // Mandar a imprimir el ticket térmico del corte de caja inmediatamente con el objeto calculado
    printCashShiftTicketHTML(closedShift, settings.name || 'DOSPOS');

    if (isPastDay) {
      // Iniciar de inmediato la apertura del turno de hoy para que no se opere sin fondo
      setTimeout(() => {
        setShowOpeningModal(true);
      }, 350);
    }
  };

  const pendingCount = useMemo(() => 
    orders.filter(o => o.status === 'pending' || o.status === 'preparing').length, 
  [orders]);

  const checkStockAndNotify = (product: Product, selectedModifiers: SelectedModifier[] | undefined, quantity: number = 1) => {
    const required: Record<string, number> = {};
    
    // Base recipe
    product.recipe?.forEach(ri => {
      required[ri.ingredientId] = (required[ri.ingredientId] || 0) + (ri.quantity * quantity);
    });

    // Modifiers recipe
    selectedModifiers?.forEach(sm => {
      const modifier = (product.modifierGroups || []).flatMap(g => g.modifiers || []).find(m => m && m.id === sm.modifierId);
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
    if (!requireOpenShiftOrBlock()) {
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
          const modifier = (originalProduct?.modifierGroups || []).flatMap(g => g.modifiers || []).find(m => m && m.id === sm.modifierId);
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
    address?: string,
    cashReceived?: number,
    discountAmount: number = 0,
    discountReason?: string,
    appliedPromotionId?: string
  ) => {
    if (cart.length === 0 || isSubmittingOrder) return;

    if (!requireOpenShiftOrBlock()) {
      return;
    }

    setIsSubmittingOrder(true);

    try {
      // Discount stock before clearing cart
      discountStock(cart);

      const finalClient = client.trim() === '' ? 'Mostrador' : client.trim();
      const finalTable = table.trim() === '' ? 'Mostrador' : table.trim();
      const finalTableLower = finalTable.toLowerCase();

      const itemsSubtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const effectiveDiscount = Math.min(itemsSubtotal, Math.max(0, discountAmount));
      const total = Math.max(0, itemsSubtotal - effectiveDiscount);
      
      // Check if it's a dine-in order and if there's already an open order for this table
      if (type === 'dine-in' && finalTableLower !== 'mostrador') {
        const existingOrder = orders.find(o => 
          o.table && o.table.trim().toLowerCase() === finalTableLower && 
          o.type === 'dine-in' && !o.closedAt && o.status !== 'cancelled'
        );
        if (existingOrder) {
          // Add items to existing order
          const isPaidImmediately = !payLater;
          const received = isPaidImmediately && cashReceived !== undefined ? cashReceived : total + tip;
          const change = isPaidImmediately && cashReceived !== undefined ? Math.max(0, cashReceived - (total + tip)) : 0;

          const newPayment: PaymentRecord[] = isPaidImmediately ? [{
            id: generateSecureId('pay'),
            method: payment,
            amount: total,
            tip: tip,
            receivedAmount: received,
            change: change,
            timestamp: new Date().toISOString()
          }] : [];

          const updatedOrders = orders.map(o => {
            if (o.id === existingOrder.id) {
              const updatedItems = [...o.items];
              cart.forEach(cartItem => {
                const newItem = { 
                  ...cartItem, 
                  status: 'pending' as OrderStatus,
                  paidQuantity: isPaidImmediately ? cartItem.quantity : 0 
                };
                updatedItems.push(newItem);
              });

              const allPayments = [...(o.payments || []), ...newPayment];
              const totalPaidSoFar = allPayments.reduce((acc, p) => acc + p.amount, 0);
              const newTotal = o.total + total;
              const isFullyPaid = totalPaidSoFar >= newTotal;

              return {
                ...o,
                items: updatedItems,
                total: newTotal,
                tip: (o.tip || 0) + (isPaidImmediately ? tip : 0),
                payments: allPayments,
                isPaid: isFullyPaid,
                payment: isFullyPaid ? (o.payment === 'Pendiente' ? payment : o.payment) : (allPayments.length > 0 ? o.payment : 'Pendiente'),
                status: resolveOrderStatus(updatedItems, o.status),
                updatedAt: new Date().toISOString()
              };
            }
            return o;
          });

          setOrders(updatedOrders);
          storage.saveOrders(updatedOrders);
          setCart([]);
          setSelectedTableId(null);
          setView('pos');
          return;
        }
      }

      const isPaidImmediately = !payLater;
      const received = isPaidImmediately && cashReceived !== undefined ? cashReceived : total + tip;
      const change = isPaidImmediately && cashReceived !== undefined ? Math.max(0, cashReceived - (total + tip)) : 0;
      
      const newPayment: PaymentRecord[] = isPaidImmediately ? [{
        id: generateSecureId('pay'),
        method: payment,
        amount: total,
        tip: tip,
        receivedAmount: received,
        change: change,
        timestamp: new Date().toISOString()
      }] : [];

      // Calculate sequential order number for today
      const todayStr = new Date().toDateString();
      const todayOrders = orders.filter(o => new Date(o.date).toDateString() === todayStr);
      const maxTodayNum = todayOrders.reduce((max, o) => Math.max(max, Number(o.orderNumber) || 0), 0);
      const nextOrderNumber = (maxTodayNum % 99) + 1;

      const newOrder: Order = {
        id: generateSecureId('ord'),
        orderNumber: nextOrderNumber,
        movementNumber: (orders.length + 1).toString(),
        date: new Date().toISOString(),
        client: finalClient,
        address: address?.trim() ? address.trim() : undefined,
        table: finalTable,
        diners: settings.defaultDiners || 1,
        waiter: currentUser?.name || 'ADMINISTRACION',
        payment: isPaidImmediately ? payment : 'Pendiente',
        status: 'pending',
        type,
        takeawayType,
        subtotalBeforeDiscount: effectiveDiscount > 0 ? itemsSubtotal : undefined,
        discountAmount: effectiveDiscount > 0 ? effectiveDiscount : undefined,
        discountReason: effectiveDiscount > 0 ? discountReason : undefined,
        appliedPromotionId: effectiveDiscount > 0 ? appliedPromotionId : undefined,
        total,
        tip: isPaidImmediately ? tip : 0,
        receivedAmount: isPaidImmediately ? received : undefined,
        changeAmount: isPaidImmediately ? change : undefined,
        closedAt: (type !== 'dine-in' && isPaidImmediately) ? new Date().toISOString() : undefined,
        items: cart.map(item => ({ 
          ...item, 
          status: 'pending' as OrderStatus,
          paidQuantity: isPaidImmediately ? item.quantity : 0 
        })),
        isPaid: isPaidImmediately,
        payments: newPayment,
        updatedAt: new Date().toISOString()
      };

      const updatedOrders = [newOrder, ...orders];
      setOrders(updatedOrders);
      storage.saveOrders(updatedOrders);
      setCart([]);
      setSelectedTableId(null);
      
      // Update table occupancy status
      if (type === 'dine-in' && finalTableLower !== 'mostrador') {
        setTables(prevTables => prevTables.map(t => 
          t.name.trim().toLowerCase() === finalTableLower ? { ...t, isOccupied: true } : t
        ));
      }

      // User preference: Stay on POS view for the next ticket
      setView('pos');
    } finally {
      setTimeout(() => {
        setIsSubmittingOrder(false);
      }, 500);
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

  const recordPayment = (orderId: string, amount: number, method: PaymentMethod, tip: number = 0, cashReceived?: number) => {
    const orderToPay = orders.find(o => o.id === orderId);
    if (!orderToPay) return;

    const received = cashReceived !== undefined ? cashReceived : amount + tip;
    const change = Math.max(0, received - (amount + tip));

    const newPayment: PaymentRecord = {
      id: Math.random().toString(36).substr(2, 9),
      amount,
      method,
      tip,
      receivedAmount: received,
      change,
      timestamp: new Date().toISOString()
    };

    const updatedPayments = [...(orderToPay.payments || []), newPayment];
    const totalPaid = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
    const allPaid = totalPaid >= orderToPay.total;

    // Do NOT free dine-in tables on payment alone; the waiter closes the table explicitly!
    if (allPaid && orderToPay.type !== 'dine-in' && orderToPay.table) {
      setTables(prevTables => prevTables.map(t => 
        t.name.trim().toLowerCase() === orderToPay.table!.trim().toLowerCase() ? { ...t, isOccupied: false } : t
      ));
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { 
          ...o, 
          isPaid: allPaid, 
          payment: allPaid ? method : o.payment, 
          status: (allPaid && o.type !== 'dine-in') ? 'delivered' : o.status,
          payments: updatedPayments,
          tip: (o.tip || 0) + tip,
          closedAt: (allPaid && o.type !== 'dine-in') ? new Date().toISOString() : o.closedAt,
          receivedAmount: received,
          changeAmount: change,
          items: o.items.map(item => ({ 
            ...item, 
            paidQuantity: allPaid ? item.quantity : (item.paidQuantity || 0) + (item.quantity * (amount / o.total))
          })),
          updatedAt: new Date().toISOString()
        };
      }
      return o;
    }));
  };

  const closeTable = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const now = new Date().toISOString();
    setOrders(prev => {
      const updated = prev.map(o => 
        o.id === orderId ? {
          ...o,
          closedAt: now,
          status: (o.status === 'pending' || o.status === 'preparing') ? o.status : ('delivered' as const),
          updatedAt: now
        } : o
      );
      storage.saveOrders(updated);
      return updated;
    });

    if (order.table) {
      const tableLower = order.table.trim().toLowerCase();
      setTables(prevTables => prevTables.map(t => 
        t.name.trim().toLowerCase() === tableLower ? { ...t, isOccupied: false } : t
      ));
    }
  };

  const payOrder = (orderId: string, payment: PaymentMethod, tip: number = 0, amount?: number, cashReceived?: number) => {
    if (!requireOpenShiftOrBlock()) {
      return;
    }

    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const alreadyPaid = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
    const remaining = Math.max(0, order.total - alreadyPaid);
    if (remaining <= 0) return; // Prevenir pagos dobles
    
    const amountToPay = amount !== undefined ? Math.min(amount, remaining) : remaining;
    
    recordPayment(orderId, amountToPay, payment, tip, cashReceived);
  };

  const reopenOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const updatedItems = o.items.map(item => ({
          ...item,
          status: 'preparing' as OrderStatus
        }));
        return {
          ...o,
          status: 'preparing',
          items: updatedItems,
          updatedAt: new Date().toISOString()
        };
      }
      return o;
    }));
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
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;
    const oldTableLower = targetOrder.table?.trim().toLowerCase();
    const newTableLower = newTable.trim().toLowerCase();

    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, table: newTable, updatedAt: new Date().toISOString() } : o
    ));

    if (oldTableLower && newTableLower) {
      setTables(prevTables => prevTables.map(t => {
        const tLower = t.name.trim().toLowerCase();
        if (tLower === oldTableLower) return { ...t, isOccupied: false };
        if (tLower === newTableLower) return { ...t, isOccupied: true };
        return t;
      }));
    }
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

      {staleOpenCashShift && (
        <div className="bg-amber-500 text-black px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-md text-xs font-black uppercase tracking-wider z-20">
          <div className="flex items-center space-x-2 text-center sm:text-left">
            <Icons.AlertTriangle size={18} className="shrink-0" />
            <span>
              Turno pendiente de jornada anterior ({new Date(staleOpenCashShift.openingTime).toLocaleDateString()} - {staleOpenCashShift.userName}). Cierra este turno para evitar que las ventas de hoy se empalmen con el corte anterior.
            </span>
          </div>
          <button 
            onClick={() => setShowClosingModal(true)}
            className="bg-black text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition shrink-0"
          >
            Cerrar Turno Anterior
          </button>
        </div>
      )}

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
              staleOpenCashShift={staleOpenCashShift}
              hasOpenCashShift={hasOpenCashShift}
              onOpenShift={() => setShowOpeningModal(true)}
              onCloseShift={() => setShowClosingModal(true)}
              onShowShiftBlockModal={() => setShowShiftBlockModal(true)}
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
              promotions={promotions}
              isSubmitting={isSubmittingOrder}
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
              promotions={promotions}
              onUpdatePromotions={setPromotions}
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
              onReopenOrder={reopenOrder}
              restaurantName={settings.name}
              settings={settings}
            />
          )}
          {view === 'tables' && canAccessView('tables') && (
            <TablesView 
              tables={tables} 
              orders={orders}
              onSelectTable={(tableId) => {
                if (!requireOpenShiftOrBlock()) {
                  return;
                }
                setSelectedTableId(tableId);
                setView('pos');
              }}
              onPay={payOrder}
              onSplitOrder={splitOrder}
              onCancel={cancelOrder}
              onDeliver={deliverOrder}
              onCloseTable={closeTable}
              restaurantName={settings.name}
              settings={settings}
              users={users}
              roles={roles}
            />
          )}
          {!['pos', 'central', 'dispatch', 'tables'].includes(view) && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-900 text-white min-h-[500px]">
              <Icons.AlertTriangle className="w-16 h-16 text-amber-400 mb-4" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">Vista no disponible ({view})</h3>
              <p className="text-sm text-slate-400 max-w-md mb-6">Regresando al Punto de Venta principal para continuar operando...</p>
              <button 
                onClick={() => setView('pos')} 
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-wider transition shadow-lg shadow-red-900/40"
              >
                Ir a Punto de Venta
              </button>
            </div>
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
        settings={settings}
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

        {showClosingModal && activeShiftForClosing && (
          <CashClosingModal 
            expectedAmount={getCashShiftStats(activeShiftForClosing).expectedAmount}
            initialFund={activeShiftForClosing.initialFund}
            salesTotal={getCashShiftStats(activeShiftForClosing).salesTotal}
            expectedCash={getCashShiftStats(activeShiftForClosing).expectedCash}
            expectedTarjeta={getCashShiftStats(activeShiftForClosing).expectedTarjeta}
            expectedTransferencia={getCashShiftStats(activeShiftForClosing).expectedTransferencia}
            expectedOtros={getCashShiftStats(activeShiftForClosing).expectedOtros}
            expectedCourtesy={getCashShiftStats(activeShiftForClosing).expectedCourtesy}
            onConfirm={handleCloseCashShift}
            onClose={() => setShowClosingModal(false)}
            openingTime={activeShiftForClosing.openingTime}
          />
        )}

        {/* Modal de Advertencia Bloqueante de Turno de Caja */}
        {showShiftBlockModal && (
          <div 
            onClick={() => setShowShiftBlockModal(false)}
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-slate-100 text-center overflow-hidden"
            >
              {staleOpenCashShift ? (
                <>
                  <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500 border border-amber-200">
                    <Icons.Clock size={36} />
                  </div>
                  <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
                    Turno Anterior Sin Cerrar
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">
                    Cierre de Caja Requerido
                  </h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed mb-6">
                    Existe un turno de caja abierto de una fecha previa (iniciado el{' '}
                    <strong className="text-slate-900">
                      {new Date(staleOpenCashShift.openingTime).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </strong>{' '}
                    por <strong className="text-slate-900">{staleOpenCashShift.userName}</strong>). 
                    Por seguridad contable y para evitar cruce de ventas, <strong className="text-red-600">está bloqueado registrar o añadir pedidos</strong> hasta realizar el corte del turno anterior.
                  </p>
                  <div className="space-y-2.5">
                    <button 
                      onClick={() => {
                        setShowShiftBlockModal(false);
                        setShowClosingModal(true);
                      }}
                      className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-black rounded-2xl font-black uppercase tracking-widest text-xs transition shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Icons.History size={16} />
                      <span>Hacer Corte y Cerrar Turno Anterior</span>
                    </button>
                    <button 
                      onClick={() => setShowShiftBlockModal(false)}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-xs transition"
                    >
                      Entendido / Regresar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 border border-red-200">
                    <Icons.Lock size={36} />
                  </div>
                  <span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
                    Operación Bloqueada
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">
                    Caja Cerrada Hoy
                  </h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed mb-6">
                    No existe un turno de caja abierto para el día de hoy. 
                    <strong className="text-red-600"> Está estrictamente bloqueado registrar órdenes nuevas o adiciones a mesas</strong> hasta que se aperture la caja con el fondo inicial correspondiente.
                  </p>
                  <div className="space-y-2.5">
                    {(currentUser?.role === 'Admin' || currentUser?.role === 'Caja') ? (
                      <button 
                        onClick={() => {
                          setShowShiftBlockModal(false);
                          setShowOpeningModal(true);
                        }}
                        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition shadow-lg shadow-red-600/25 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Icons.Cart size={16} />
                        <span>Realizar Apertura de Caja Ahora</span>
                      </button>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-2 text-[11px] text-amber-800 font-bold">
                        Solicita a un usuario Administrador o Encargado de Caja que realice la apertura para habilitar el registro de pedidos.
                      </div>
                    )}
                    <button 
                      onClick={() => setShowShiftBlockModal(false)}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-xs transition"
                    >
                      Entendido / Regresar
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
