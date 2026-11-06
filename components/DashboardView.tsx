import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { Order, Product, StoreSettings, PaymentMethod, StaffConsumption } from '../types';
import { Icons } from '../constants';

interface DashboardViewProps {
  orders: Order[];
  products: Product[];
  categories: string[];
  settings: StoreSettings;
  staffConsumptions?: StaffConsumption[];
  onNavigateToHistory?: () => void;
  onNavigateToStaffConsumptions?: () => void;
}

type TimeRangePreset = '7days' | 'today' | 'month' | 'all';
type SortField = 'quantity' | 'revenue' | 'name';

const PAYMENT_COLORS: Record<string, string> = {
  'Efectivo': '#10B981',       // Emerald
  'Tarjeta': '#3B82F6',        // Blue
  'Transferencia': '#8B5CF6',  // Purple
  'Uber': '#06B6D4',           // Cyan
  'Didi': '#F97316',           // Orange
  'Cortesía': '#64748B',       // Slate
  'Pendiente': '#EF4444',      // Red
  'Otros': '#94A3B8'
};

const BAR_GRADIENT_COLORS = [
  '#DC2626', '#EA580C', '#D97706', '#CA8A04', 
  '#65A30D', '#16A34A', '#059669', '#0891B2', 
  '#2563EB', '#7C3AED'
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  products,
  categories,
  settings,
  staffConsumptions = [],
  onNavigateToHistory,
  onNavigateToStaffConsumptions
}) => {
  // Global Time Range state for charts
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('7days');

  // Daily Product Breakdown state
  const getTodayISOString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDay, setSelectedDay] = useState<string>(getTodayISOString());
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [sortField, setSortField] = useState<SortField>('quantity');
  const [sortAscending, setSortAscending] = useState<boolean>(false);

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: settings.currency || 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Filter valid, non-cancelled orders
  const validOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'cancelled');
  }, [orders]);

  // Range-filtered orders for the top analytics charts
  const filteredOrders = useMemo(() => {
    const now = new Date();
    
    if (timeRange === 'today') {
      const todayStr = getTodayISOString();
      return validOrders.filter(o => {
        const orderDateStr = o.date ? o.date.split('T')[0] : '';
        return orderDateStr === todayStr;
      });
    }

    if (timeRange === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return validOrders.filter(o => {
        const orderTime = new Date(o.date).getTime();
        return orderTime >= sevenDaysAgo.getTime();
      });
    }

    if (timeRange === 'month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 29);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return validOrders.filter(o => {
        const orderTime = new Date(o.date).getTime();
        return orderTime >= thirtyDaysAgo.getTime();
      });
    }

    return validOrders;
  }, [validOrders, timeRange]);

  // Top KPI Metrics for selected range
  const rangeKpis = useMemo(() => {
    const totalSales = filteredOrders
      .filter(o => o.isPaid)
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const paidOrdersCount = filteredOrders.filter(o => o.isPaid).length;
    const avgTicket = paidOrdersCount > 0 ? totalSales / paidOrdersCount : 0;
    
    const totalArticlesSold = filteredOrders.reduce((sum, o) => {
      const itemsCount = o.items ? o.items.reduce((iSum, item) => iSum + (item.quantity || 1), 0) : 0;
      return sum + itemsCount;
    }, 0);

    return {
      totalSales,
      ordersCount: filteredOrders.length,
      paidOrdersCount,
      avgTicket,
      totalArticlesSold
    };
  }, [filteredOrders]);

  // Chart 1 Data: Timeline of Sales (Daily or Hourly if today)
  const salesTimelineData = useMemo(() => {
    if (timeRange === 'today') {
      // Group by Hour (00:00 to 23:00)
      const hourlyMap: Record<number, { hour: string; ventas: number; pedidos: number }> = {};
      for (let h = 0; h < 24; h++) {
        const hourLabel = `${String(h).padStart(2, '0')}:00`;
        hourlyMap[h] = { hour: hourLabel, ventas: 0, pedidos: 0 };
      }

      filteredOrders.forEach(o => {
        const d = new Date(o.date);
        const h = d.getHours();
        if (hourlyMap[h]) {
          hourlyMap[h].pedidos += 1;
          if (o.isPaid) {
            hourlyMap[h].ventas += (o.total || 0);
          }
        }
      });

      return Object.values(hourlyMap);
    }

    // Group by Date
    const dateMap: Record<string, { date: string; displayDate: string; ventas: number; pedidos: number; timestamp: number }> = {};
    
    // Seed days if 7days or month so chart lines are continuous
    const daysToSeed = timeRange === '7days' ? 7 : timeRange === 'month' ? 30 : 0;
    if (daysToSeed > 0) {
      const now = new Date();
      for (let i = daysToSeed - 1; i >= 0; i--) {
        const target = new Date();
        target.setDate(now.getDate() - i);
        const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
        const display = target.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        dateMap[key] = {
          date: key,
          displayDate: display,
          ventas: 0,
          pedidos: 0,
          timestamp: target.getTime()
        };
      }
    }

    filteredOrders.forEach(o => {
      const d = new Date(o.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dateMap[key]) {
        const display = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        dateMap[key] = {
          date: key,
          displayDate: display,
          ventas: 0,
          pedidos: 0,
          timestamp: d.getTime()
        };
      }
      dateMap[key].pedidos += 1;
      if (o.isPaid) {
        dateMap[key].ventas += (o.total || 0);
      }
    });

    return Object.values(dateMap).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredOrders, timeRange]);

  // Chart 2 Data: Payment Methods Distribution
  const paymentMethodsData = useMemo(() => {
    const methodTotals: Record<string, { name: string; amount: number; count: number }> = {};

    filteredOrders.forEach(o => {
      if (o.payments && o.payments.length > 0) {
        o.payments.forEach(p => {
          const m = p.method || 'Otros';
          if (!methodTotals[m]) {
            methodTotals[m] = { name: m, amount: 0, count: 0 };
          }
          methodTotals[m].amount += (p.amount || 0);
          methodTotals[m].count += 1;
        });
      } else if (o.isPaid) {
        const m = o.payment || 'Otros';
        if (!methodTotals[m]) {
          methodTotals[m] = { name: m, amount: 0, count: 0 };
        }
        methodTotals[m].amount += (o.total || 0);
        methodTotals[m].count += 1;
      }
    });

    return Object.values(methodTotals)
      .filter(item => item.amount > 0 || item.count > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [filteredOrders]);

  // Chart 3 Data: Top 10 Best-Selling Products in Range
  const topProductsRangeData = useMemo(() => {
    const productStats: Record<string, { id: string; name: string; quantity: number; revenue: number; category: string }> = {};

    filteredOrders.forEach(o => {
      if (!o.items) return;
      o.items.forEach(item => {
        const prodId = item.id || item.name;
        if (!productStats[prodId]) {
          productStats[prodId] = {
            id: prodId,
            name: item.name,
            quantity: 0,
            revenue: 0,
            category: item.category || 'General'
          };
        }
        const qty = item.quantity || 1;
        productStats[prodId].quantity += qty;
        productStats[prodId].revenue += (item.price * qty);
      });
    });

    return Object.values(productStats)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [filteredOrders]);

  // =========================================================================
  // CRITICAL FEATURE: Daily Products Sold Breakdown ("Por Día")
  // =========================================================================

  // Orders specifically for the selected date
  const dayOrders = useMemo(() => {
    return validOrders.filter(o => {
      const orderDateStr = o.date ? o.date.split('T')[0] : '';
      return orderDateStr === selectedDay;
    });
  }, [validOrders, selectedDay]);

  // Comprehensive Product breakdown for the chosen day
  const dailyProductStats = useMemo(() => {
    const map: Record<string, {
      id: string;
      name: string;
      category: string;
      unitPrice: number;
      quantity: number;
      revenue: number;
      orderCount: number;
    }> = {};

    let totalDayArticles = 0;
    let totalDayRevenue = 0;

    dayOrders.forEach(order => {
      if (!order.items) return;
      order.items.forEach(item => {
        const prodId = item.id || item.name;
        const qty = item.quantity || 1;
        const itemRevenue = (item.price || 0) * qty;

        totalDayArticles += qty;
        totalDayRevenue += itemRevenue;

        if (!map[prodId]) {
          map[prodId] = {
            id: prodId,
            name: item.name,
            category: item.category || 'General',
            unitPrice: item.price || 0,
            quantity: 0,
            revenue: 0,
            orderCount: 0
          };
        }

        map[prodId].quantity += qty;
        map[prodId].revenue += itemRevenue;
        map[prodId].orderCount += 1;
      });
    });

    const list = Object.values(map);

    // Compute share percentages and relative strength against the #1 top seller
    const maxQty = list.reduce((max, item) => Math.max(max, item.quantity), 0);

    const enrichedList = list.map(item => ({
      ...item,
      sharePercentage: totalDayArticles > 0 ? (item.quantity / totalDayArticles) * 100 : 0,
      relativeBarWidth: maxQty > 0 ? (item.quantity / maxQty) * 100 : 0
    }));

    return {
      items: enrichedList,
      totalArticles: totalDayArticles,
      totalRevenue: totalDayRevenue,
      uniqueProductsCount: list.length
    };
  }, [dayOrders]);

  // Filtered and sorted daily items based on search, category and sort field
  const filteredDailyProducts = useMemo(() => {
    let result = dailyProductStats.items;

    // Filter by category
    if (selectedCategory !== 'Todas') {
      result = result.filter(item => item.category === selectedCategory);
    }

    // Filter by search query
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.category.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'quantity') {
        comparison = b.quantity - a.quantity;
      } else if (sortField === 'revenue') {
        comparison = b.revenue - a.revenue;
      } else if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      }

      return sortAscending ? -comparison : comparison;
    });

    return result;
  }, [dailyProductStats.items, selectedCategory, productSearch, sortField, sortAscending]);

  // Quick Date Navigation buttons
  const handleQuickDateChange = (preset: 'today' | 'yesterday' | 'prev' | 'next') => {
    const current = new Date(`${selectedDay}T12:00:00`);
    if (preset === 'today') {
      setSelectedDay(getTodayISOString());
    } else if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      setSelectedDay(yStr);
    } else if (preset === 'prev') {
      current.setDate(current.getDate() - 1);
      const prevStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      setSelectedDay(prevStr);
    } else if (preset === 'next') {
      current.setDate(current.getDate() + 1);
      const nextStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      setSelectedDay(nextStr);
    }
  };

  // CSV Exporter for the chosen day
  const exportDailyReportCSV = () => {
    if (dailyProductStats.items.length === 0) {
      alert('No hay productos vendidos en este día para exportar.');
      return;
    }

    const headers = 'Producto,Categoría,Cantidad Vendida,Precio Unitario,Total Recaudado,Participación %\n';
    const rows = dailyProductStats.items.map(p => 
      `"${p.name.replace(/"/g, '""')}","${p.category.replace(/"/g, '""')}",${p.quantity},${p.unitPrice.toFixed(2)},${p.revenue.toFixed(2)},${p.sharePercentage.toFixed(1)}%`
    ).join('\n');

    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_productos_${selectedDay}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format date display (ej: "Lunes, 25 de Octubre de 2026")
  const formattedDayTitle = useMemo(() => {
    const [y, m, d] = selectedDay.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [selectedDay]);

  // Filtered Staff Consumptions for the active range
  const rangeStaffStats = useMemo(() => {
    const now = new Date();
    const todayStr = getTodayISOString();

    const filtered = staffConsumptions.filter(c => {
      const cDateStr = c.date ? c.date.split('T')[0] : '';
      if (timeRange === 'today') {
        return cDateStr === todayStr;
      }
      if (timeRange === '7days') {
        const d = new Date(c.date).getTime();
        return (now.getTime() - d) <= (7 * 24 * 60 * 60 * 1000);
      }
      if (timeRange === 'month') {
        const d = new Date(c.date).getTime();
        return (now.getTime() - d) <= (30 * 24 * 60 * 60 * 1000);
      }
      return true;
    });

    const totalCost = filtered.reduce((s, c) => s + c.totalCostValue, 0);
    const totalRetail = filtered.reduce((s, c) => s + c.totalRetailValue, 0);
    const totalItems = filtered.reduce((s, c) => s + c.totalItemsCount, 0);

    return { filtered, totalCost, totalRetail, totalItems, count: filtered.length };
  }, [staffConsumptions, timeRange]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-16">
      {/* Top Header & Range Switcher */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg">
              <Icons.Chart size={20} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-black tracking-tighter uppercase">
                Panel de Analíticas y Control
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Monitoreo comercial en tiempo real · Métodos de pago · Desglose diario
              </p>
            </div>
          </div>
        </div>

        {/* Global Time Range Selector for Main Charts */}
        <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          {[
            { id: '7days', label: 'Últimos 7 días' },
            { id: 'today', label: 'Hoy (Horas)' },
            { id: 'month', label: '30 Días' },
            { id: 'all', label: 'Todo' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id as TimeRangePreset)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                timeRange === tab.id
                  ? 'bg-black text-white shadow-md'
                  : 'text-slate-500 hover:text-black hover:bg-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Primary KPI Row (5 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
              <Icons.DollarSign size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                Ventas Totales
              </p>
              <p className="text-2xl font-black text-black tracking-tighter tabular-nums">
                {formatCurrency(rangeKpis.totalSales)}
              </p>
            </div>
          </div>
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center space-x-1">
            <span>● Órdenes liquidadas: {rangeKpis.paidOrdersCount}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-md">
              <Icons.Clipboard size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                Volumen de Pedidos
              </p>
              <p className="text-2xl font-black text-black tracking-tighter tabular-nums">
                {rangeKpis.ordersCount} <span className="text-xs font-bold text-slate-400">órdenes</span>
              </p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            En periodo seleccionado
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500 text-white flex items-center justify-center shadow-md">
              <Icons.TrendingUp size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                Ticket Promedio
              </p>
              <p className="text-2xl font-black text-black tracking-tighter tabular-nums">
                {formatCurrency(rangeKpis.avgTicket)}
              </p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Gasto medio por cuenta
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md">
              <Icons.Package size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                Artículos Despachados
              </p>
              <p className="text-2xl font-black text-black tracking-tighter tabular-nums">
                {rangeKpis.totalArticlesSold} <span className="text-xs font-bold text-slate-400">unidades</span>
              </p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Platos y bebidas comerciales
          </p>
        </div>

        <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
              <Icons.Coffee size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                Consumo Staff / Merma
              </p>
              <p className="text-2xl font-black text-amber-400 tracking-tighter tabular-nums">
                {formatCurrency(rangeStaffStats.totalCost)}
              </p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {rangeStaffStats.totalItems} arts • {rangeStaffStats.count} vales (Valor {formatCurrency(rangeStaffStats.totalRetail)})
          </p>
          {onNavigateToStaffConsumptions && (
            <button
              onClick={onNavigateToStaffConsumptions}
              className="mt-3 text-[10px] font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors self-start cursor-pointer"
            >
              <span>Ver Detalle y Auditoría de Personal ➔</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Charts Row: Sales Curve + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart 1: Sales Curve over Time */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-4 border-b border-slate-100 gap-2">
            <div>
              <h3 className="text-xl font-black text-black tracking-tighter uppercase flex items-center">
                <Icons.TrendingUp className="mr-2 text-red-600" size={20} />
                Tendencia de Ventas en Tiempo Real
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Ingresos netos ($) y flujo de pedidos
              </p>
            </div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {timeRange === 'today' ? 'Vista por Horas' : 'Vista Diaria'}
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            {salesTimelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTimelineData as any[]} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DC2626" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey={timeRange === 'today' ? 'hour' : 'displayDate'} 
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `$${val.toLocaleString()}`}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-black text-white p-3 rounded-2xl shadow-2xl border border-white/20 text-xs font-bold">
                            <p className="text-[10px] uppercase text-slate-400 tracking-widest mb-1">
                              {timeRange === 'today' ? `Hora: ${data.hour}` : data.date}
                            </p>
                            <p className="text-sm font-black text-red-400">
                              Ventas: {formatCurrency(data.ventas)}
                            </p>
                            <p className="text-slate-300">
                              Pedidos: {data.pedidos}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ventas" 
                    stroke="#DC2626" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#salesGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                No hay ventas registradas en este periodo
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Payment Methods Mix */}
        <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100 flex flex-col">
          <div className="pb-6 mb-4 border-b border-slate-100">
            <h3 className="text-xl font-black text-black tracking-tighter uppercase flex items-center">
              <Icons.CreditCard className="mr-2 text-blue-600" size={20} />
              Métodos de Pago
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Distribución de ingresos por canal
            </p>
          </div>

          <div className="h-56 w-full relative">
            {paymentMethodsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodsData}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {paymentMethodsData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={PAYMENT_COLORS[entry.name] || BAR_GRADIENT_COLORS[index % BAR_GRADIENT_COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-black text-white p-3 rounded-2xl shadow-2xl border border-white/20 text-xs font-bold">
                            <p className="text-[10px] uppercase text-slate-400 tracking-widest mb-1">{data.name}</p>
                            <p className="text-sm font-black text-emerald-400">{formatCurrency(data.amount)}</p>
                            <p className="text-slate-300">{data.count} transacciones</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                Sin pagos en este periodo
              </div>
            )}
          </div>

          {/* Custom Clean Legend */}
          <div className="mt-auto pt-4 space-y-2">
            {paymentMethodsData.slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: PAYMENT_COLORS[item.name] || '#94A3B8' }}
                  />
                  <span className="text-slate-700">{item.name}</span>
                </div>
                <span className="text-black font-black tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 3: Top Selling Products in Period */}
      <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-xl font-black text-black tracking-tighter uppercase flex items-center">
              <Icons.Package className="mr-2 text-amber-500" size={20} />
              Top 10 Productos Más Vendidos
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Volumen acumulado de piezas vendidas en el periodo
            </p>
          </div>
        </div>

        <div className="h-72 w-full">
          {topProductsRangeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={topProductsRangeData} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#1E293B' }} 
                  width={140}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-black text-white p-3 rounded-2xl shadow-2xl border border-white/20 text-xs font-bold">
                          <p className="text-sm font-black text-white mb-1">{data.name}</p>
                          <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">Categoría: {data.category}</p>
                          <p className="text-emerald-400 font-black">{data.quantity} piezas vendidas</p>
                          <p className="text-slate-300">Recaudación: {formatCurrency(data.revenue)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="quantity" radius={[0, 10, 10, 0]}>
                  {topProductsRangeData.map((_, index) => (
                    <Cell key={`bar-${index}`} fill={BAR_GRADIENT_COLORS[index % BAR_GRADIENT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
              No hay productos vendidos en este periodo
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: CONTROL Y DESGLOSE DETALLADO DE PRODUCTOS POR DÍA              */}
      {/* ========================================================================= */}
      <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-8">
        {/* Section Header with Day Selector and Quick Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
              <h3 className="text-2xl font-black text-black tracking-tighter uppercase">
                Control de Ventas por Producto (Por Día)
              </h3>
            </div>
            <p className="text-xs font-bold text-slate-500 capitalize mt-1">
              📅 {formattedDayTitle}
            </p>
          </div>

          {/* Interactive Date Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Day Presets */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-2xl">
              <button
                onClick={() => handleQuickDateChange('prev')}
                className="p-2 hover:bg-white text-slate-600 hover:text-black rounded-xl transition-all"
                title="Día anterior"
              >
                <Icons.ArrowLeft size={16} />
              </button>
              <button
                onClick={() => handleQuickDateChange('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  selectedDay === getTodayISOString()
                    ? 'bg-black text-white shadow-sm'
                    : 'text-slate-600 hover:text-black hover:bg-white'
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => handleQuickDateChange('yesterday')}
                className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 hover:text-black hover:bg-white transition-all"
              >
                Ayer
              </button>
              <button
                onClick={() => handleQuickDateChange('next')}
                className="p-2 hover:bg-white text-slate-600 hover:text-black rounded-xl transition-all"
                title="Día siguiente"
              >
                <div className="rotate-180">
                  <Icons.ArrowLeft size={16} />
                </div>
              </button>
            </div>

            {/* Native Date Picker */}
            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-black rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-red-600 transition-all cursor-pointer"
              />
            </div>

            {/* CSV Export Button for the day */}
            <button
              onClick={exportDailyReportCSV}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95"
            >
              <Icons.Download size={16} />
              <span>Exportar Día (.CSV)</span>
            </button>
          </div>
        </div>

        {/* Day Metric Summary Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Artículos del Día</p>
              <p className="text-2xl font-black text-black tabular-nums">{dailyProductStats.totalArticles} <span className="text-xs font-bold text-slate-400">pzas</span></p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Icons.Package size={20} />
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recaudación en Productos</p>
              <p className="text-2xl font-black text-emerald-600 tabular-nums">{formatCurrency(dailyProductStats.totalRevenue)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Icons.DollarSign size={20} />
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Platos Distintos Vendidos</p>
              <p className="text-2xl font-black text-blue-600 tabular-nums">{dailyProductStats.uniqueProductsCount} <span className="text-xs font-bold text-slate-400">variedades</span></p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Icons.ChefHat size={20} />
            </div>
          </div>
        </div>

        {/* Filter Controls: Search Input + Category Selector + Sorting */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Live Search */}
          <div className="relative w-full md:w-80">
            <span className="absolute left-3.5 top-3 text-slate-400">
              <Icons.Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Buscar producto de este día..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-black placeholder-slate-400 outline-none focus:ring-2 focus:ring-red-600 transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
              Categoría:
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-black text-xs font-bold rounded-2xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-red-600 transition-all cursor-pointer"
            >
              <option value="Todas">Todas las categorías</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Sort Toggle */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl">
              <button
                onClick={() => {
                  if (sortField === 'quantity') setSortAscending(!sortAscending);
                  else { setSortField('quantity'); setSortAscending(false); }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  sortField === 'quantity' ? 'bg-black text-white' : 'text-slate-600 hover:bg-white'
                }`}
              >
                Por Cantidad {sortField === 'quantity' && (sortAscending ? '↑' : '↓')}
              </button>
              <button
                onClick={() => {
                  if (sortField === 'revenue') setSortAscending(!sortAscending);
                  else { setSortField('revenue'); setSortAscending(false); }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  sortField === 'revenue' ? 'bg-black text-white' : 'text-slate-600 hover:bg-white'
                }`}
              >
                Por Ingresos {sortField === 'revenue' && (sortAscending ? '↑' : '↓')}
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Product Table */}
        <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-sm">
          {filteredDailyProducts.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6 w-12 text-center">#</th>
                  <th className="py-4 px-6">Producto</th>
                  <th className="py-4 px-6">Categoría</th>
                  <th className="py-4 px-6 text-right">Cant. Vendida</th>
                  <th className="py-4 px-6 w-48">Participación del Día</th>
                  <th className="py-4 px-6 text-right">P. Unitario</th>
                  <th className="py-4 px-6 text-right">Total ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDailyProducts.map((item, idx) => (
                  <tr 
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-4 px-6 text-center text-xs font-black text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm font-black text-black tracking-tight group-hover:text-red-600 transition-colors">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        En {item.orderCount} {item.orderCount === 1 ? 'comanda' : 'comandas'}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-bold text-slate-600">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="inline-flex items-center px-3 py-1 bg-red-50 text-red-700 rounded-xl font-black text-sm tabular-nums">
                        {item.quantity} <span className="text-[10px] ml-1 font-bold">pzas</span>
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-600 rounded-full transition-all duration-500"
                            style={{ width: `${item.relativeBarWidth}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-500 tabular-nums w-10 text-right">
                          {item.sharePercentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-slate-600 text-xs tabular-nums">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-4 px-6 text-right font-black text-black text-sm tabular-nums">
                      {formatCurrency(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 text-slate-300 flex items-center justify-center">
                <Icons.Package size={32} />
              </div>
              <div>
                <p className="text-base font-black text-black uppercase tracking-tight">
                  No hay ventas de productos registradas para este día
                </p>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  Fecha seleccionada: {selectedDay}
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setSelectedDay(getTodayISOString())}
                  className="px-5 py-2.5 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md hover:bg-slate-800 transition-all"
                >
                  Volver al Día de Hoy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
