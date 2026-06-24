import { Product, Order, Category, Table, User, Shift, CashShift, UserRole, StoreSettings, Ingredient } from '../types';

const KEYS = {
  PRODUCTS: 'dospos_productos',
  ORDERS: 'dospos_ordenes',
  CATEGORIES: 'dospos_categorias',
  TABLES: 'dospos_tablas',
  RESTAURANT_NAME: 'dospos_restaurant_name',
  EVENT_TYPE: 'dospos_event_type',
  SETTINGS: 'dospos_store_settings',
  USERS: 'dospos_usuarios',
  SHIFTS: 'dospos_turnos',
  CASH_SHIFTS: 'dospos_turnos_caja',
  ROLES: 'dospos_roles',
  INGREDIENTS: 'dospos_ingredientes',
};

const API_MAP: Record<string, string> = {
  [KEYS.PRODUCTS]: 'products',
  [KEYS.ORDERS]: 'orders',
  [KEYS.CATEGORIES]: 'categories',
  [KEYS.TABLES]: 'tables',
  [KEYS.SETTINGS]: 'settings',
  [KEYS.USERS]: 'users',
  [KEYS.SHIFTS]: 'shifts',
  [KEYS.CASH_SHIFTS]: 'cashShifts',
  [KEYS.ROLES]: 'roles',
  [KEYS.INGREDIENTS]: 'ingredients',
  [KEYS.RESTAURANT_NAME]: 'restaurantName',
  [KEYS.EVENT_TYPE]: 'eventType',
};

let lastWriteTime = 0;
const lastKnownServerState: Record<string, string> = {};
let activeSocket: any = null;

async function saveToServer(localStorageKey: string, data: any) {
  const apiKey = API_MAP[localStorageKey];
  if (!apiKey) return;
  
  const serialized = JSON.stringify(data);
  if (lastKnownServerState[apiKey] === serialized) {
    return;
  }
  
  lastKnownServerState[apiKey] = serialized;
  lastWriteTime = Date.now();

  // If there's an active, open WebSocket, send the update through WS for instant and resilient sync
  if (activeSocket && activeSocket.readyState === 1) { // 1 is WebSocket.OPEN
    try {
      activeSocket.send(JSON.stringify({ type: 'SAVE', key: apiKey, data }));
      return;
    } catch (wsErr) {
      console.warn('Failed to send save via WebSocket, falling back to HTTP:', wsErr);
    }
  }

  try {
    await fetch('/api/db/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: apiKey, data })
    });
  } catch (err) {
    console.error(`Failed to sync key ${apiKey} to server:`, err);
  }
}

export const storage = {
  getLastWriteTime: () => lastWriteTime,
  setLastWriteTime: (t: number) => { lastWriteTime = t; },
  registerSocket: (socket: any) => {
    activeSocket = socket;
  },
  setLastKnownServerState: (key: string, data: any) => {
    lastKnownServerState[key] = JSON.stringify(data);
  },
  getSettings: (): StoreSettings => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    if (data) {
      return JSON.parse(data);
    }
    // Fallback for backwards compatibility
    return {
      name: localStorage.getItem(KEYS.RESTAURANT_NAME) || 'DosPOS',
      eventType: localStorage.getItem(KEYS.EVENT_TYPE) || 'Restaurante',
      currency: 'MXN',
      taxRate: 0,
    };
  },
  saveSettings: (settings: StoreSettings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    localStorage.setItem(KEYS.RESTAURANT_NAME, settings.name);
    localStorage.setItem(KEYS.EVENT_TYPE, settings.eventType);
    saveToServer(KEYS.SETTINGS, settings);
    saveToServer(KEYS.RESTAURANT_NAME, settings.name);
    saveToServer(KEYS.EVENT_TYPE, settings.eventType);
  },
  getRoles: (): UserRole[] => {
    const data = localStorage.getItem(KEYS.ROLES);
    return data ? JSON.parse(data) : [];
  },
  saveRoles: (roles: UserRole[]) => {
    localStorage.setItem(KEYS.ROLES, JSON.stringify(roles));
    saveToServer(KEYS.ROLES, roles);
  },
  getProducts: (): Product[] => {
    const data = localStorage.getItem(KEYS.PRODUCTS);
    return data ? JSON.parse(data) : [];
  },
  saveProducts: (products: Product[]) => {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
    saveToServer(KEYS.PRODUCTS, products);
  },
  getOrders: (): Order[] => {
    const data = localStorage.getItem(KEYS.ORDERS);
    return data ? JSON.parse(data) : [];
  },
  saveOrders: (orders: Order[]) => {
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    saveToServer(KEYS.ORDERS, orders);
  },
  getCategories: (): Category[] => {
    const data = localStorage.getItem(KEYS.CATEGORIES);
    return data ? JSON.parse(data) : [];
  },
  saveCategories: (categories: Category[]) => {
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
    saveToServer(KEYS.CATEGORIES, categories);
  },
  getTables: (): Table[] => {
    const data = localStorage.getItem(KEYS.TABLES);
    return data ? JSON.parse(data) : [];
  },
  saveTables: (tables: Table[]) => {
    localStorage.setItem(KEYS.TABLES, JSON.stringify(tables));
    saveToServer(KEYS.TABLES, tables);
  },
  getUsers: (): User[] => {
    const data = localStorage.getItem(KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },
  saveUsers: (users: User[]) => {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    saveToServer(KEYS.USERS, users);
  },
  getShifts: (): Shift[] => {
    const data = localStorage.getItem(KEYS.SHIFTS);
    return data ? JSON.parse(data) : [];
  },
  saveShifts: (shifts: Shift[]) => {
    localStorage.setItem(KEYS.SHIFTS, JSON.stringify(shifts));
    saveToServer(KEYS.SHIFTS, shifts);
  },
  getCashShifts: (): CashShift[] => {
    const data = localStorage.getItem(KEYS.CASH_SHIFTS);
    return data ? JSON.parse(data) : [];
  },
  saveCashShifts: (shifts: CashShift[]) => {
    localStorage.setItem(KEYS.CASH_SHIFTS, JSON.stringify(shifts));
    saveToServer(KEYS.CASH_SHIFTS, shifts);
  },
  getRestaurantName: (): string => {
    return localStorage.getItem(KEYS.RESTAURANT_NAME) || 'DosPOS';
  },
  saveRestaurantName: (name: string) => {
    localStorage.setItem(KEYS.RESTAURANT_NAME, name);
    saveToServer(KEYS.RESTAURANT_NAME, name);
  },
  getEventType: (): string => {
    return localStorage.getItem(KEYS.EVENT_TYPE) || 'Restaurante';
  },
  saveEventType: (type: string) => {
    localStorage.setItem(KEYS.EVENT_TYPE, type);
    saveToServer(KEYS.EVENT_TYPE, type);
  },
  getIngredients: (): Ingredient[] => {
    const data = localStorage.getItem(KEYS.INGREDIENTS);
    return data ? JSON.parse(data) : [];
  },
  saveIngredients: (ingredients: Ingredient[]) => {
    localStorage.setItem(KEYS.INGREDIENTS, JSON.stringify(ingredients));
    saveToServer(KEYS.INGREDIENTS, ingredients);
  },
  saveBulk: async (data: Record<string, any>) => {
    lastWriteTime = Date.now();

    // Map properties from local KEYS structure to API structure
    const payload: Record<string, any> = {};
    Object.keys(data).forEach((key) => {
      payload[key] = data[key];
    });

    if (activeSocket && activeSocket.readyState === 1) {
      try {
        activeSocket.send(JSON.stringify({ type: 'SAVE_BULK', data: payload }));
        return;
      } catch (wsErr) {
        console.warn('Failed to send saveBulk via WebSocket, falling back to HTTP:', wsErr);
      }
    }

    try {
      await fetch('/api/db/save-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Failed to save bulk data to server:', err);
    }
  }
};
