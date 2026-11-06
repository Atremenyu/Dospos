import React, { useState, useMemo } from 'react';
import { Product, Category, User, StoreSettings, StaffConsumption, StaffConsumptionItem, ConsumptionReason } from '../types';
import { Icons } from '../constants';
import { printStaffConsumptionTicketHTML } from '../services/thermalPrinter';

interface StaffConsumptionViewProps {
  products: Product[];
  categories: Category[];
  users: User[];
  currentUser: User;
  activeCashShiftId?: string;
  settings: StoreSettings;
  staffConsumptions: StaffConsumption[];
  onSaveConsumption: (consumptionData: Omit<StaffConsumption, 'id' | 'date'>) => Promise<StaffConsumption>;
  onNavigateToAdmin?: () => void;
}

type HistoryDatePreset = 'today' | 'yesterday' | '7days' | 'month' | 'custom' | 'all';

export const StaffConsumptionView: React.FC<StaffConsumptionViewProps> = ({
  products,
  categories,
  users,
  currentUser,
  activeCashShiftId,
  settings,
  staffConsumptions,
  onSaveConsumption,
  onNavigateToAdmin
}) => {
  // Main view navigation: 'pos' (Despacho Rápido) vs 'history' (Historial y Control)
  const [activeSection, setActiveSection] = useState<'pos' | 'history'>('pos');

  // POS section states
  const [activeCategory, setActiveCategory] = useState<Category | 'Todos'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected beneficiary user for POS
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    return users.length > 0 ? users[0].id : '';
  });
  
  // Fast delivery tray
  const [trayItems, setTrayItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [reason, setReason] = useState<ConsumptionReason>('Turno de trabajo');
  const [printChit, setPrintChit] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Today ISO string (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // History section filter states
  const [historyPreset, setHistoryPreset] = useState<HistoryDatePreset>('today');
  const [historyStartDate, setHistoryStartDate] = useState<string>(todayStr);
  const [historyEndDate, setHistoryEndDate] = useState<string>(todayStr);
  const [historyUserFilter, setHistoryUserFilter] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [expandedUserHistoryId, setExpandedUserHistoryId] = useState<string | null>(null);

  // Search filter for staff grid
  const [staffGridSearch, setStaffGridSearch] = useState('');

  // Consumptions registered today
  const todayConsumptions = useMemo(() => {
    return staffConsumptions.filter(c => {
      try {
        return new Date(c.date).toISOString().slice(0, 10) === todayStr;
      } catch {
        return false;
      }
    });
  }, [staffConsumptions, todayStr]);

  // Calculate unit cost
  const calculateItemCost = (product: Product): number => {
    if (typeof product.cost === 'number' && product.cost > 0) return product.cost;
    return Math.round(product.price * 0.35);
  };

  // Top consumed product in staff history or fallback drink
  const globalTopProduct = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    staffConsumptions.forEach(c => {
      c.items.forEach(it => {
        const p = products.find(prod => String(prod.id) === String(it.productId)) ||
                  products.find(prod => prod.name.trim().toLowerCase() === it.productName.trim().toLowerCase());
        const key = p ? p.id : (it.productId || it.productName);
        const name = p ? p.name : it.productName;
        const curr = counts.get(key) || { id: p ? p.id : it.productId || '', name, count: 0 };
        curr.count += it.quantity;
        counts.set(key, curr);
      });
    });
    const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count);
    if (sorted.length > 0) {
      return sorted[0];
    }
    // Fallback: look for a beer or first drink
    const beerOrDrink = products.find(p => 
      p.category?.toLowerCase().includes('bebida') || 
      p.category?.toLowerCase().includes('cerveza') ||
      p.name.toLowerCase().includes('corona') ||
      p.name.toLowerCase().includes('cerveza')
    ) || products[0];

    return beerOrDrink ? { id: beerOrDrink.id, name: beerOrDrink.name, count: 0 } : null;
  }, [staffConsumptions, products]);

  // Per-user statistics for today & frequent product identification
  const staffActivityMap = useMemo(() => {
    const map = new Map<string, {
      user: User;
      totalItemsToday: number;
      productSummary: { productId: string; productName: string; quantity: number }[];
      lastProductName?: string;
      lastProductId?: string;
      frequentProduct?: { productId: string; productName: string; quantity: number };
      secondaryFrequentProduct?: { productId: string; productName: string; quantity: number };
    }>();

    // Initialize all registered users
    users.forEach(u => {
      map.set(u.id, {
        user: u,
        totalItemsToday: 0,
        productSummary: []
      });
    });

    // Populate with today's consumptions
    todayConsumptions.forEach(c => {
      const uKey = c.beneficiaryUserId || users.find(u => u.name.toLowerCase() === c.beneficiaryName.toLowerCase())?.id;
      if (uKey && map.has(uKey)) {
        const entry = map.get(uKey)!;
        entry.totalItemsToday += (c.totalItemsCount || 0);

        c.items.forEach(item => {
          // Robust match by ID or by Name
          const existing = entry.productSummary.find(
            p => (item.productId && p.productId === item.productId) || 
                 p.productName.trim().toLowerCase() === item.productName.trim().toLowerCase()
          );

          if (existing) {
            existing.quantity += item.quantity;
            if (!existing.productId && item.productId) {
              existing.productId = item.productId;
            }
          } else {
            const resolved = products.find(p => String(p.id) === String(item.productId)) ||
              products.find(p => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase());

            entry.productSummary.push({
              productId: resolved ? resolved.id : (item.productId || ''),
              productName: item.productName,
              quantity: item.quantity
            });
          }
          entry.lastProductName = item.productName;
          entry.lastProductId = item.productId;
        });
      }
    });

    // Calculate frequent products for each user (today's top first, then historical, then global default)
    users.forEach(u => {
      const entry = map.get(u.id);
      if (!entry) return;

      // 1. Check today's items
      const todaySorted = [...entry.productSummary].sort((a, b) => b.quantity - a.quantity);
      if (todaySorted.length > 0) {
        entry.frequentProduct = todaySorted[0];
        if (todaySorted.length > 1) {
          entry.secondaryFrequentProduct = todaySorted[1];
        }
      }

      // 2. If no frequent product from today, check all-time history for this user
      if (!entry.frequentProduct) {
        const historicalMap = new Map<string, { productId: string; productName: string; quantity: number }>();
        staffConsumptions.forEach(c => {
          const matchUser = c.beneficiaryUserId === u.id || c.beneficiaryName.toLowerCase() === u.name.toLowerCase();
          if (matchUser) {
            c.items.forEach(it => {
              const p = products.find(prod => String(prod.id) === String(it.productId)) ||
                        products.find(prod => prod.name.trim().toLowerCase() === it.productName.trim().toLowerCase());
              const pId = p ? p.id : (it.productId || '');
              const pName = p ? p.name : it.productName;
              const key = pId || pName;
              const prev = historicalMap.get(key) || { productId: pId, productName: pName, quantity: 0 };
              prev.quantity += it.quantity;
              historicalMap.set(key, prev);
            });
          }
        });
        const historicalSorted = Array.from(historicalMap.values()).sort((a, b) => b.quantity - a.quantity);
        if (historicalSorted.length > 0) {
          entry.frequentProduct = historicalSorted[0];
          if (historicalSorted.length > 1) {
            entry.secondaryFrequentProduct = historicalSorted[1];
          }
        }
      }

      // 3. Fallback to global top product if user has no consumption record yet
      if (!entry.frequentProduct && globalTopProduct) {
        entry.frequentProduct = {
          productId: globalTopProduct.id,
          productName: globalTopProduct.name,
          quantity: 0
        };
      }
    });

    return map;
  }, [users, todayConsumptions, staffConsumptions, products, globalTopProduct]);

  // Sorted user cards: users with active consumptions today appear first
  const staffCardsList = useMemo(() => {
    let list = Array.from(staffActivityMap.values());
    if (staffGridSearch.trim()) {
      const q = staffGridSearch.trim().toLowerCase();
      list = list.filter(item => 
        item.user.name.toLowerCase().includes(q) || 
        item.user.role.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      if (b.totalItemsToday !== a.totalItemsToday) {
        return b.totalItemsToday - a.totalItemsToday;
      }
      return a.user.name.localeCompare(b.user.name);
    });
  }, [staffActivityMap, staffGridSearch]);

  // Currently selected beneficiary
  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || users[0];
  }, [users, selectedUserId]);

  const selectedUserData = useMemo(() => {
    return selectedUser ? staffActivityMap.get(selectedUser.id) : null;
  }, [selectedUser, staffActivityMap]);

  // Overall today totals
  const totalDrinksToday = useMemo(() => {
    return todayConsumptions.reduce((sum, c) => sum + (c.totalItemsCount || 0), 0);
  }, [todayConsumptions]);

  const activeStaffCount = useMemo(() => {
    return staffCardsList.filter(s => s.totalItemsToday > 0).length;
  }, [staffCardsList]);

  // Filter products by category & search
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = activeCategory === 'Todos' || p.category === activeCategory;
      const matchSearch = searchTerm.trim() === '' || 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, searchTerm]);

  // Add product to delivery tray
  const handleAddProduct = (product: Product, quantityToAdd: number = 1) => {
    setTrayItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + quantityToAdd } : item
        );
      }
      return [...prev, { product, quantity: quantityToAdd }];
    });
  };

  const handleAddConsumedProductToTray = (productId?: string, productNameFallback?: string, quantity: number = 1) => {
    const product = products.find(p => String(p.id) === String(productId)) || 
      (productNameFallback ? products.find(p => p.name.trim().toLowerCase() === productNameFallback.trim().toLowerCase()) : undefined);
    
    if (!product) {
      alert('Producto no encontrado en el catálogo.');
      return;
    }

    handleAddProduct(product, quantity);
    setFeedbackToast({
      message: `+${quantity} ${product.name} agregado a la bandeja`,
      type: 'info'
    });
    setTimeout(() => setFeedbackToast(null), 2000);
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setTrayItems(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as { product: Product; quantity: number }[];
    });
  };

  const handleRemoveItem = (productId: string) => {
    setTrayItems(prev => prev.filter(item => item.product.id !== productId));
  };

  // Quick repeat of a previously consumed product for the active user
  const handleQuickRepeatProduct = async (
    productId: string,
    productNameFallback?: string,
    quantityToAdd: number = 1,
    customRecipientId?: string
  ) => {
    const targetUserId = customRecipientId || selectedUserId;
    const targetUser = users.find(u => u.id === targetUserId);
    
    const product = products.find(p => String(p.id) === String(productId)) || 
      (productNameFallback ? products.find(p => p.name.trim().toLowerCase() === productNameFallback.trim().toLowerCase()) : undefined);
    
    if (!targetUser) {
      alert('Colaborador no encontrado.');
      return;
    }
    if (!product) {
      alert(`No se encontró el producto "${productNameFallback || productId}" en el catálogo actual.`);
      return;
    }

    const itemKey = `${targetUserId}_${product.id}_${product.name}`;
    setSubmittingKey(itemKey);

    const unitCost = calculateItemCost(product);
    const item: StaffConsumptionItem = {
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity: quantityToAdd,
      unitPrice: product.price,
      unitCost,
      totalRetailValue: product.price * quantityToAdd,
      totalCostValue: unitCost * quantityToAdd
    };

    try {
      const saved = await onSaveConsumption({
        cashShiftId: activeCashShiftId,
        beneficiaryName: targetUser.name,
        beneficiaryUserId: targetUser.id,
        authorizedBy: currentUser?.name || 'Administración',
        reason: 'Turno de trabajo',
        mode: 'individual',
        items: [item],
        totalRetailValue: product.price * quantityToAdd,
        totalCostValue: unitCost * quantityToAdd,
        totalItemsCount: quantityToAdd
      });

      if (printChit && saved) {
        try {
          printStaffConsumptionTicketHTML(saved, settings);
        } catch (e) {
          console.warn('Error al imprimir vale:', e);
        }
      }

      setFeedbackToast({
        message: `+${quantityToAdd} ${product.name} entregado a ${targetUser.name}`,
        type: 'success'
      });
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err: any) {
      alert('Error al registrar consumo: ' + (err?.message || err));
    } finally {
      setSubmittingKey(null);
    }
  };

  // Confirm delivery of current tray
  const handleConfirmDelivery = async () => {
    if (!selectedUser) {
      alert('Selecciona un colaborador para la entrega.');
      return;
    }
    if (trayItems.length === 0) {
      alert('Agrega al menos un producto tocando el catálogo.');
      return;
    }

    const items: StaffConsumptionItem[] = trayItems.map(({ product, quantity }) => {
      const unitCost = calculateItemCost(product);
      return {
        productId: product.id,
        productName: product.name,
        category: product.category,
        quantity,
        unitPrice: product.price,
        unitCost,
        totalRetailValue: product.price * quantity,
        totalCostValue: unitCost * quantity
      };
    });

    const totalRetail = items.reduce((sum, i) => sum + i.totalRetailValue, 0);
    const totalCost = items.reduce((sum, i) => sum + i.totalCostValue, 0);
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

    setIsSubmitting(true);
    try {
      const saved = await onSaveConsumption({
        cashShiftId: activeCashShiftId,
        beneficiaryName: selectedUser.name,
        beneficiaryUserId: selectedUser.id,
        authorizedBy: currentUser?.name || 'Administración',
        reason,
        mode: 'individual',
        items,
        totalRetailValue: totalRetail,
        totalCostValue: totalCost,
        totalItemsCount: totalItems
      });

      if (printChit && saved) {
        try {
          printStaffConsumptionTicketHTML(saved, settings);
        } catch (e) {
          console.warn('Error al imprimir vale:', e);
        }
      }

      setFeedbackToast({
        message: `Entrega de ${totalItems} artículo(s) registrada para ${selectedUser.name}`,
        type: 'success'
      });
      setTrayItems([]);
      setTimeout(() => setFeedbackToast(null), 3500);
    } catch (err: any) {
      alert('Error al registrar entrega: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tray totals
  const trayTotals = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    trayItems.forEach(({ product, quantity }) => {
      totalItems += quantity;
      totalCost += calculateItemCost(product) * quantity;
    });
    return { totalItems, totalCost };
  }, [trayItems]);

  // =========================================================================
  // HISTORY & CONTROL SECTION DATA PROCESSING
  // =========================================================================
  const filteredHistoryConsumptions = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);

    return staffConsumptions.filter(c => {
      const cDateStr = c.date ? c.date.slice(0, 10) : '';

      // Date filtering
      if (historyPreset === 'today') {
        if (cDateStr !== today) return false;
      } else if (historyPreset === 'yesterday') {
        if (cDateStr !== yesterdayStr) return false;
      } else if (historyPreset === '7days') {
        if (cDateStr < sevenDaysAgoStr) return false;
      } else if (historyPreset === 'month') {
        if (cDateStr < startOfMonthStr) return false;
      } else if (historyPreset === 'custom') {
        if (historyStartDate && cDateStr < historyStartDate) return false;
        if (historyEndDate && cDateStr > historyEndDate) return false;
      }

      // User filtering
      if (historyUserFilter !== 'all') {
        const matchesId = c.beneficiaryUserId === historyUserFilter;
        const matchesName = c.beneficiaryName.trim().toLowerCase() === users.find(u => u.id === historyUserFilter)?.name.trim().toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // Search query (product, reason, notes)
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.trim().toLowerCase();
        const matchBeneficiary = c.beneficiaryName.toLowerCase().includes(q);
        const matchReason = c.reason.toLowerCase().includes(q);
        const matchNotes = c.notes?.toLowerCase().includes(q) || false;
        const matchItems = c.items.some(i => i.productName.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
        if (!matchBeneficiary && !matchReason && !matchNotes && !matchItems) return false;
      }

      return true;
    });
  }, [staffConsumptions, historyPreset, historyStartDate, historyEndDate, historyUserFilter, historySearchQuery, users]);

  // SIMPLIFIED CONSUMPTION TABLE PER PERSON (Agrupación simplificada por persona)
  const simplifiedPersonTable = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      userName: string;
      userRole: string;
      totalItems: number;
      totalCost: number;
      totalRetail: number;
      lastDate: string;
      productBreakdown: { productName: string; quantity: number }[];
      tickets: StaffConsumption[];
    }>();

    filteredHistoryConsumptions.forEach(c => {
      const uKey = c.beneficiaryUserId || c.beneficiaryName.trim().toLowerCase();
      const matchedUser = users.find(u => u.id === c.beneficiaryUserId || u.name.trim().toLowerCase() === c.beneficiaryName.trim().toLowerCase());
      const roleName = matchedUser?.role || 'Staff';

      if (!map.has(uKey)) {
        map.set(uKey, {
          userId: uKey,
          userName: c.beneficiaryName,
          userRole: roleName,
          totalItems: 0,
          totalCost: 0,
          totalRetail: 0,
          lastDate: c.date,
          productBreakdown: [],
          tickets: []
        });
      }

      const entry = map.get(uKey)!;
      entry.totalItems += (c.totalItemsCount || 0);
      entry.totalCost += (c.totalCostValue || 0);
      entry.totalRetail += (c.totalRetailValue || 0);
      if (new Date(c.date) > new Date(entry.lastDate)) {
        entry.lastDate = c.date;
      }
      entry.tickets.push(c);

      c.items.forEach(item => {
        const existing = entry.productBreakdown.find(p => p.productName.trim().toLowerCase() === item.productName.trim().toLowerCase());
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          entry.productBreakdown.push({
            productName: item.productName,
            quantity: item.quantity
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalItems - a.totalItems);
  }, [filteredHistoryConsumptions, users]);

  // Overall KPIs for History
  const historyKpis = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let totalRetail = 0;
    simplifiedPersonTable.forEach(p => {
      totalItems += p.totalItems;
      totalCost += p.totalCost;
      totalRetail += p.totalRetail;
    });
    return {
      totalItems,
      totalCost,
      totalRetail,
      personsCount: simplifiedPersonTable.length,
      vouchersCount: filteredHistoryConsumptions.length
    };
  }, [simplifiedPersonTable, filteredHistoryConsumptions]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center space-x-2 text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-200">
          <Icons.Check size={16} />
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* SECTION 1: HEADER & VIEW MODE SWITCHER */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 p-4 shrink-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center space-x-2">
              <Icons.Coffee size={20} className="text-amber-400" />
              <span>Consumo de Personal</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {activeStaffCount} colaboradores activos hoy <span aria-hidden="true">·</span> {totalDrinksToday} consumos registrados en turno
            </p>
          </div>

          {/* Section Navigation Tabs & Action Controls */}
          <div className="flex items-center space-x-3">
            {/* View switcher: Despacho Rápido vs Historial y Control */}
            <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
              <button
                type="button"
                onClick={() => setActiveSection('pos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSection === 'pos'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icons.Cart size={13} />
                <span>Despacho Rápido</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSection === 'history'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icons.History size={13} />
                <span>Historial y Control</span>
              </button>
            </div>

            {onNavigateToAdmin && (
              <button
                onClick={onNavigateToAdmin}
                className="hidden sm:flex px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 hover:text-white transition-colors items-center space-x-1.5 shadow-sm cursor-pointer"
                title="Ver auditoría completa en Administración"
              >
                <Icons.Chart size={14} className="text-amber-400" />
                <span>Auditoría en Admin</span>
              </button>
            )}

            {activeSection === 'pos' && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium hidden md:inline">Colaborador:</span>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* REJILLA DE USUARIOS ACTIVOS Y DESPACHO RÁPIDO DE PRODUCTO FRECUENTE */}
        {activeSection === 'pos' && (
          <div className="space-y-2 pt-1">
            {/* Header of Grid & Quick Filter */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Personal en Turno ({staffCardsList.length})</span>
                </span>
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  <span aria-hidden="true">·</span> 1 clic en el botón rojo despacha su producto frecuente al instante
                </span>
              </div>

              {/* Quick search filter for staff */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filtrar staff..."
                    value={staffGridSearch}
                    onChange={e => setStaffGridSearch(e.target.value)}
                    className="w-32 sm:w-44 pl-7 pr-6 py-1 bg-slate-800/90 border border-slate-700/80 rounded-lg text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500">
                    <Icons.Search size={11} />
                  </span>
                  {staffGridSearch && (
                    <button
                      type="button"
                      onClick={() => setStaffGridSearch('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <Icons.X size={10} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Responsive User Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 max-h-56 sm:max-h-64 overflow-y-auto pr-1 scrollbar-thin">
              {staffCardsList.map(item => {
                const isSelected = selectedUserId === item.user.id;
                const hasConsumed = item.totalItemsToday > 0;
                const frequent = item.frequentProduct;
                const secondary = item.secondaryFrequentProduct;
                const isFrequentSubmitting = frequent && submittingKey === `${item.user.id}_${frequent.productId}_${frequent.productName}`;
                const isSecondarySubmitting = secondary && submittingKey === `${item.user.id}_${secondary.productId}_${secondary.productName}`;

                return (
                  <div
                    key={item.user.id}
                    onClick={() => setSelectedUserId(item.user.id)}
                    className={`relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                      isSelected
                        ? 'bg-slate-800/95 border-red-500 shadow-md shadow-red-950/40 ring-2 ring-red-500/60'
                        : hasConsumed
                        ? 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800/60'
                        : 'bg-slate-900/50 border-slate-800/70 hover:border-slate-700 hover:bg-slate-800/40 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Top Row: User Avatar & Name & Count Badge */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-red-600 text-white'
                              : hasConsumed
                              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {item.user.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate leading-tight" title={item.user.name}>
                            {item.user.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">
                            {item.user.role}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                            item.totalItemsToday >= 4
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : item.totalItemsToday > 0
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                              : 'bg-slate-800/80 text-slate-500'
                          }`}
                          title={`${item.totalItemsToday} artículos entregados hoy`}
                        >
                          {item.totalItemsToday} art.
                        </span>
                      </div>

                      {/* Middle: Brief summary of what they drank today */}
                      <div className="mt-1.5 min-h-[16px] text-[10px]">
                        {hasConsumed ? (
                          <p className="text-slate-300 truncate font-medium">
                            {item.productSummary.slice(0, 2).map(p => `${p.quantity}x ${p.productName}`).join(', ')}
                          </p>
                        ) : (
                          <p className="text-slate-500 italic truncate">
                            Sin consumo hoy
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom: 1-Click Frequent Product Dispensing Button */}
                    <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-1">
                      {frequent ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickRepeatProduct(frequent.productId, frequent.productName, 1, item.user.id);
                          }}
                          disabled={Boolean(isFrequentSubmitting || isSecondarySubmitting)}
                          className="w-full py-1.5 px-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center justify-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                          title={`1 clic: despachar +1 ${frequent.productName} a ${item.user.name}`}
                        >
                          {isFrequentSubmitting ? (
                            <span className="flex items-center space-x-1">
                              <span className="animate-spin text-xs">⟳</span>
                              <span>Despachando...</span>
                            </span>
                          ) : (
                            <>
                              <Icons.Plus size={11} className="stroke-[3]" />
                              <span className="truncate">1 {frequent.productName}</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="text-[10px] text-slate-500 text-center py-1">
                          Elige del catálogo abajo
                        </div>
                      )}

                      {/* Optional Secondary frequent product if available */}
                      {secondary && secondary.productName !== frequent?.productName && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickRepeatProduct(secondary.productId, secondary.productName, 1, item.user.id);
                          }}
                          disabled={Boolean(isFrequentSubmitting || isSecondarySubmitting)}
                          className="w-full py-1 px-1.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-300 hover:text-white text-[10px] font-semibold rounded-md border border-slate-700/60 flex items-center justify-center space-x-1 transition-colors cursor-pointer disabled:opacity-50 truncate"
                          title={`1 clic: despachar +1 ${secondary.productName} a ${item.user.name}`}
                        >
                          {isSecondarySubmitting ? (
                            <span>Despachando...</span>
                          ) : (
                            <>
                              <Icons.Plus size={9} />
                              <span className="truncate">1 {secondary.productName}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2A: POS DESPACHO RAPIDO (CATALOG + TRAY) */}
      {/* ========================================================================= */}
      {activeSection === 'pos' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: POS-STYLE PRODUCT CATALOG */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-900/30">
            {/* Filter Bar: Categories + Search */}
            <div className="p-3 border-b border-slate-800/80 bg-slate-900/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  onClick={() => setActiveCategory('Todos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                    activeCategory === 'Todos'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Todos ({products.length})
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                      activeCategory === cat
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64 shrink-0">
                <input
                  type="text"
                  placeholder="Buscar bebida o alimento..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Icons.Search size={14} />
                </span>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <Icons.X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 p-3 md:p-4 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <Icons.Package size={36} className="mb-2 opacity-30" />
                  <p className="text-xs font-medium">No se encontraron productos coincidentes</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                  {filteredProducts.map(product => {
                    const inTray = trayItems.find(item => item.product.id === product.id);
                    const unitCost = calculateItemCost(product);

                    return (
                      <button
                        key={product.id}
                        onClick={() => handleAddProduct(product, 1)}
                        className={`group relative text-left p-3 rounded-2xl border transition-all duration-150 flex flex-col justify-between hover:border-slate-600 active:scale-[0.98] cursor-pointer ${
                          inTray
                            ? 'bg-slate-800/90 border-red-500 shadow-md ring-1 ring-red-500/50'
                            : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/70'
                        }`}
                      >
                        {inTray && (
                          <div className="absolute top-2 right-2 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md">
                            {inTray.quantity}
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] font-medium text-slate-400 block mb-1">
                            {product.category}
                          </span>
                          <h3 className="font-bold text-white text-xs sm:text-sm leading-snug group-hover:text-red-400 transition-colors line-clamp-2">
                            {product.name}
                          </h3>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800 flex items-baseline justify-between text-xs">
                          <span className="font-bold text-slate-300">
                            ${product.price.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-medium text-slate-500">
                            Costo: ${unitCost.toLocaleString()}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: FAST DELIVERY TRAY */}
          <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0">
            {/* Header: Selected Recipient Banner */}
            <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedUser?.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {selectedUser?.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {selectedUser?.role} <span aria-hidden="true">·</span> {selectedUserData?.totalItemsToday || 0} art. hoy
                  </p>
                </div>
              </div>

              {trayItems.length > 0 && (
                <button
                  onClick={() => setTrayItems([])}
                  className="text-[11px] font-semibold text-slate-400 hover:text-red-400 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Quick Repeat List: Products this user already consumed today */}
            {selectedUserData && selectedUserData.productSummary.length > 0 && (
              <div className="p-3 border-b border-slate-800 bg-slate-950/60">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Consumido hoy por {selectedUser.name.split(' ')[0]}:
                  </p>
                  <span className="text-[10px] text-amber-400 font-bold tabular-nums">
                    {selectedUserData.totalItemsToday} artículos hoy
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {selectedUserData.productSummary.map((item, idx) => {
                    const resolvedProduct = products.find(p => String(p.id) === String(item.productId)) ||
                      products.find(p => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase());
                    const itemKey = `${selectedUser.id}_${item.productId || item.productName}`;
                    const isThisSubmitting = submittingKey === itemKey;

                    return (
                      <div
                        key={`${item.productId || item.productName}-${idx}`}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white text-xs font-bold truncate">
                            {item.quantity}x {item.productName}
                          </span>
                          {resolvedProduct && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              ${resolvedProduct.price.toLocaleString()} c/u
                            </span>
                          )}
                        </div>

                        {/* Repetir rápido actions */}
                        <div className="flex items-center space-x-1.5 pt-1 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleQuickRepeatProduct(item.productId, item.productName, 1)}
                            disabled={isThisSubmitting}
                            className="flex-1 py-1 px-2 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center space-x-1 active:scale-95 disabled:opacity-50 cursor-pointer"
                            title="Despachar 1 unidad inmediatamente"
                          >
                            <span>{isThisSubmitting ? '...' : '+1 Rápido'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickRepeatProduct(item.productId, item.productName, 2)}
                            disabled={isThisSubmitting}
                            className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
                            title="Despachar ronda de 2 unidades inmediatamente"
                          >
                            <span>+2</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddConsumedProductToTray(item.productId, item.productName, 1)}
                            className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-[11px] font-bold rounded-lg transition-colors active:scale-95 cursor-pointer"
                            title="Sumar a la bandeja de entrega actual para enviar varios productos juntos"
                          >
                            <span>+ A Bandeja</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Current Tray Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Nueva Entrega:
              </p>

              {trayItems.length === 0 ? (
                <div className="h-28 flex flex-col items-center justify-center text-center p-3 text-slate-500">
                  <Icons.Cart size={22} className="mb-1 opacity-30" />
                  <p className="text-xs font-medium">Bandeja vacía</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Toca productos a la izquierda o usa "+ A Bandeja".
                  </p>
                </div>
              ) : (
                trayItems.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate leading-tight">
                        {product.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        ${product.price.toLocaleString()} c/u
                      </p>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        onClick={() => handleUpdateQuantity(product.id, -1)}
                        className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-bold text-white text-xs">
                        {quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(product.id, 1)}
                        className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleRemoveItem(product.id)}
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors ml-0.5 cursor-pointer"
                      >
                        <Icons.Trash size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Action Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400 font-medium shrink-0">Motivo:</span>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value as ConsumptionReason)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="Turno de trabajo">Turno de trabajo</option>
                  <option value="Cortesía administrativa">Cortesía administrativa</option>
                  <option value="Evento especial">Evento especial</option>
                  <option value="Merma de barra">Merma de barra</option>
                  <option value="Degustación">Degustación</option>
                </select>
              </div>

              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={printChit}
                  onChange={e => setPrintChit(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-red-600 focus:ring-0 h-3.5 w-3.5"
                />
                <span>Imprimir vale térmico</span>
              </label>

              <button
                onClick={handleConfirmDelivery}
                disabled={isSubmitting || trayItems.length === 0 || !selectedUser}
                className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${
                  trayItems.length > 0 && selectedUser && !isSubmitting
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 active:scale-[0.99] cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Icons.Check size={16} />
                <span>
                  {isSubmitting
                    ? 'Entregando...'
                    : trayItems.length > 0
                    ? `Entregar a ${selectedUser.name.split(' ')[0]} (${trayTotals.totalItems} art.)`
                    : 'Selecciona Productos'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2B: HISTORIAL Y CONTROL (FILTROS Y TABLA SIMPLIFICADA POR PERSONA) */}
      {/* ========================================================================= */}
      {activeSection === 'history' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 bg-slate-950">
          {/* Top Filter Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Date Presets */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'today', label: 'Hoy' },
                  { id: 'yesterday', label: 'Ayer' },
                  { id: '7days', label: 'Últimos 7 días' },
                  { id: 'month', label: 'Este Mes' },
                  { id: 'all', label: 'Todo el Historial' },
                  { id: 'custom', label: 'Rango Manual' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setHistoryPreset(p.id as HistoryDatePreset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      historyPreset === p.id
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Print / Export Report Button */}
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Icons.Printer size={14} />
                <span>Imprimir Resumen</span>
              </button>
            </div>

            {/* Sub-Filters: Date Range, User Filter, and Search */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
              {/* Start Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Desde (Fecha):
                </label>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={e => {
                    setHistoryStartDate(e.target.value);
                    setHistoryPreset('custom');
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Hasta (Fecha):
                </label>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={e => {
                    setHistoryEndDate(e.target.value);
                    setHistoryPreset('custom');
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {/* User Dropdown Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Filtrar por Colaborador:
                </label>
                <select
                  value={historyUserFilter}
                  onChange={e => setHistoryUserFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="all">-- Todo el Personal --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Query */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Buscar Producto o Motivo:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ej: Cerveza, Turno..."
                    value={historySearchQuery}
                    onChange={e => setHistorySearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <Icons.Search size={13} />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Summary KPI Cards Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Artículos Totales
              </span>
              <p className="text-xl font-black text-white tabular-nums mt-1">
                {historyKpis.totalItems} <span className="text-xs font-semibold text-slate-400">uds</span>
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5">
                En {historyKpis.vouchersCount} vales emitidos
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Personal Beneficiado
              </span>
              <p className="text-xl font-black text-white tabular-nums mt-1">
                {historyKpis.personsCount} <span className="text-xs font-semibold text-slate-400">personas</span>
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5">
                Con salidas registradas
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Costo Real (Merma)
              </span>
              <p className="text-xl font-black text-emerald-400 tabular-nums mt-1">
                ${historyKpis.totalCost.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5">
                Gasto de insumos e inventario
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Valor Comercial Carta
              </span>
              <p className="text-xl font-black text-slate-300 tabular-nums mt-1 line-through opacity-85">
                ${historyKpis.totalRetail.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5">
                Equivalente precio público
              </span>
            </div>
          </div>

          {/* SIMPLIFIED TABLE: CONSUMPTIONS BY PERSON */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Tabla de Control de Consumos por Persona
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Resumen consolidado por colaborador en el rango seleccionado
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                {simplifiedPersonTable.length} personas con consumo
              </span>
            </div>

            {simplifiedPersonTable.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <Icons.Coffee size={32} className="mx-auto opacity-30" />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  No hay registros de consumo para este periodo o filtro
                </p>
                <p className="text-[11px] text-slate-500">
                  Ajusta las fechas o selecciona "Todo el Historial" para consultar salidas previas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">Colaborador</th>
                      <th className="p-3.5 text-center">Artículos</th>
                      <th className="p-3.5">Productos Consumidos (Resumen)</th>
                      <th className="p-3.5 text-right">Costo Real (Merma)</th>
                      <th className="p-3.5 text-right hidden md:table-cell">Valor Carta</th>
                      <th className="p-3.5 hidden lg:table-cell">Última Salida</th>
                      <th className="p-3.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {simplifiedPersonTable.map(person => {
                      const isExpanded = expandedUserHistoryId === person.userId;

                      return (
                        <React.Fragment key={person.userId}>
                          <tr className="hover:bg-slate-800/50 transition-colors">
                            {/* Colaborador */}
                            <td className="p-3.5">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                  {person.userName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-white text-xs truncate">
                                    {person.userName}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    {person.userRole}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Total Artículos */}
                            <td className="p-3.5 text-center">
                              <span className="font-black text-sm text-white tabular-nums px-2 py-0.5 rounded-lg bg-slate-800">
                                {person.totalItems}
                              </span>
                            </td>

                            {/* Productos Consumidos */}
                            <td className="p-3.5">
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {person.productBreakdown.map(prod => (
                                  <span
                                    key={prod.productName}
                                    className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium"
                                  >
                                    <strong className="text-white">{prod.quantity}x</strong> {prod.productName}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Costo Real */}
                            <td className="p-3.5 text-right font-bold text-emerald-400 tabular-nums">
                              ${person.totalCost.toLocaleString()}
                            </td>

                            {/* Valor Carta */}
                            <td className="p-3.5 text-right font-medium text-slate-400 tabular-nums hidden md:table-cell line-through">
                              ${person.totalRetail.toLocaleString()}
                            </td>

                            {/* Última Salida */}
                            <td className="p-3.5 text-slate-400 text-[11px] font-medium hidden lg:table-cell">
                              {new Date(person.lastDate).toLocaleDateString()} {new Date(person.lastDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            {/* Acciones */}
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => setExpandedUserHistoryId(isExpanded ? null : person.userId)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                  isExpanded
                                    ? 'bg-red-600 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                }`}
                              >
                                {isExpanded ? 'Ocultar' : `Ver Vales (${person.tickets.length})`}
                              </button>
                            </td>
                          </tr>

                          {/* EXPANDABLE ROW: INDIVIDUAL TICKETS */}
                          {isExpanded && (
                            <tr className="bg-slate-950/90">
                              <td colSpan={7} className="p-4 border-t border-b border-slate-800">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                      Vales individuales emitidos a {person.userName} ({person.tickets.length}):
                                    </p>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      Registro cronológico
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {person.tickets.map(ticket => (
                                      <div
                                        key={ticket.id}
                                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                                      >
                                        <div className="space-y-0.5 min-w-0">
                                          <div className="flex items-center space-x-2 text-[11px]">
                                            <span className="font-bold text-white">
                                              {new Date(ticket.date).toLocaleDateString()} {new Date(ticket.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="text-slate-400">·</span>
                                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                                              {ticket.reason}
                                            </span>
                                          </div>
                                          <p className="text-slate-300 font-medium truncate">
                                            {ticket.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                                          </p>
                                          <p className="text-[10px] text-slate-500">
                                            Autorizó: {ticket.authorizedBy} {ticket.notes ? `• ${ticket.notes}` : ''}
                                          </p>
                                        </div>

                                        <div className="flex items-center space-x-2 shrink-0">
                                          <span className="text-emerald-400 font-bold tabular-nums text-xs">
                                            ${ticket.totalCostValue.toLocaleString()}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              try {
                                                printStaffConsumptionTicketHTML(ticket, settings);
                                              } catch (e) {
                                                alert('Error al imprimir vale: ' + e);
                                              }
                                            }}
                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                            title="Reimprimir vale térmico"
                                          >
                                            <Icons.Printer size={13} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
