
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

  // Real-time WebSocket synchronization to keep all devices updated instantly
  useEffect(() => {
    if (!isLoaded) return;

    let reconnectTimeout: any = null;
    let isDisposed = false;

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
        console.error("Error de conexión en WebSocket:", err);
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

    return () => {
      isDisposed = true;
      storage.registerSocket(null);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
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
        payments
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
    let closedShift: CashShift | null = null;

    setCashShifts(prev => prev.map(s => {
      if (s.status === 'open') {
        const stats = getCashShiftStats(s);
        const actualAmount = actualCash + actualTarjeta + actualTransferencia;
        
        closedShift = {
          ...s,
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
          expectedOtros: stats.expectedOtros
        };
        return closedShift;
      }
      return s;
    }));

    setShowClosingModal(false);

    // Mandar a imprimir el ticket térmico del corte de caja si se generó
    setTimeout(() => {
      if (closedShift) {
        printCashShiftTicketHTML(closedShift, settings.name || 'DOSPOS');
      }
    }, 500);
  };

  const getCashShiftStats = (shift: CashShift) => {
    const shiftOrders = orders.filter(o => 
      o.status === 'delivered' && 
      o.isPaid && 
      new Date(o.date) > new Date(shift.openingTime)
    );
    const salesTotal = shiftOrders.reduce((acc, o) => acc + o.total, 0);

    const cashSales = shiftOrders.filter(o => o.payment === 'Efectivo').reduce((acc, o) => acc + o.total, 0);
    const cardSales = shiftOrders.filter(o => o.payment === 'Tarjeta').reduce((acc, o) => acc + o.total, 0);
    const transferSales = shiftOrders.filter(o => o.payment === 'Transferencia').reduce((acc, o) => acc + o.total, 0);
    const otherSales = shiftOrders.filter(o => o.payment !== 'Efectivo' && o.payment !== 'Tarjeta' && o.payment !== 'Transferencia').reduce((acc, o) => acc + o.total, 0);

    const expectedCash = shift.initialFund + cashSales;
    const expectedTarjeta = cardSales;
    const expectedTransferencia = transferSales;
    const expectedOtros = otherSales;

    const expectedAmount = expectedCash + expectedTarjeta + expectedTransferencia + expectedOtros;

    return { 
      salesTotal, 
      expectedAmount,
      expectedCash,
      expectedTarjeta,
      expectedTransferencia,
      expectedOtros,
      cashSales,
      cardSales,
      transferSales,
      otherSales
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
      setActiveNotification({
        id: Date.now().toString(),
        message: `SIN STOCK: ${outOfStock.join(', ')}`,
        type: 'warning'
      });
      return false;
    } else if (lowIngredients.length > 0) {
      setActiveNotification({
        id: Date.now().toString(),
        message: `STOCK BAJO: ${lowIngredients.join(', ')}`,
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
                stock: newIngredients[ingIndex].stock - (ri.quantity * item.quantity) 
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
                  stock: newIngredients[ingIndex].stock - (ri.quantity * item.quantity) 
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
      payments: newPayment
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

        return { ...o, items: newItems, status: newOrderStatus };
      }
      return o;
    }));
  };

  const deliverOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { 
        ...o, 
        status: 'delivered' as const,
        items: o.items.map(item => ({ ...item, status: 'delivered' as OrderStatus }))
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
        }))
      } : o
    ));
  };

  const updateOrderTime = (orderId: string, minutes: number) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, estimatedMinutes: minutes } : o
    ));
  };

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio notification failed', e);
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
        }))
      } : o
    ));

    const location = order.type === 'dine-in' ? `Mesa ${order.table}` : (order.takeawayType?.toUpperCase() || 'LLEVAR');
    const message = `ORDEN LISTA: ${location} (${order.client})`;
    
    playNotificationSound();
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
            }))
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
        o.id === orderId ? { ...o, status: 'cancelled' } : o
      );
    });
  };

  const transferOrder = (orderId: string, newTable: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, table: newTable } : o
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
            onConfirm={handleCloseCashShift}
            onClose={() => setShowClosingModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
