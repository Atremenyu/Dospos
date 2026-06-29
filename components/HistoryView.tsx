
import React, { useMemo, useState } from 'react';
import { Order, Table, CashShift, StoreSettings } from '../types';
import { Icons } from '../constants';
import { generateTicketPDF } from '../services/pdfGenerator';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, AreaChart, Area 
} from 'recharts';

interface HistoryViewProps {
  orders: Order[];
  tables: Table[];
  cashShifts: CashShift[];
  restaurantName?: string;
  settings?: StoreSettings;
  hasOpenCashShift?: boolean;
  onCloseCashShift?: () => void;
  onOpenSettings?: () => void;
}

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#000000'];

const HistoryView: React.FC<HistoryViewProps> = ({ 
  orders, tables, cashShifts, restaurantName, settings, hasOpenCashShift, onCloseCashShift, onOpenSettings 
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: today, end: today });
  const [isFilterActive, setIsFilterActive] = useState(false);

  const todaySummary = useMemo(() => {
    const todayOrders = orders.filter(o => 
      new Date(o.date).toISOString().split('T')[0] === today && 
      o.status !== 'cancelled' && 
      o.isPaid
    );
    
    let total = 0;
    const methods: Record<string, number> = {};
    
    todayOrders.forEach(o => {
      if (o.payments && o.payments.length > 0) {
        o.payments.forEach(p => {
          total += p.amount;
          methods[p.method] = (methods[p.method] || 0) + p.amount;
        });
      } else {
        total += o.total;
        methods[o.payment] = (methods[o.payment] || 0) + o.total;
      }
    });

    return { total, methods };
  }, [orders, today]);

  const filteredOrders = useMemo(() => {
    if (!isFilterActive) return orders;
    
    return orders.filter(order => {
      const orderDate = new Date(order.date).toISOString().split('T')[0];
      return orderDate >= dateRange.start && orderDate <= dateRange.end;
    });
  }, [orders, dateRange, isFilterActive]);

  const paymentMethods = useMemo(() => {
    const methods = new Set<string>();
    filteredOrders.forEach(o => {
      if (o.payments && o.payments.length > 0) {
        o.payments.forEach(p => methods.add(p.method));
      } else {
        methods.add(o.payment);
      }
    });
    return Array.from(methods).filter(m => m !== 'Pendiente');
  }, [filteredOrders]);

  const analyticsData = useMemo(() => {
    const validOrders = filteredOrders.filter(o => o.status !== 'cancelled');
    
    // Revenue and Methods
    let totalRevenue = 0;
    let totalTips = 0;
    const dailyMap = new Map<string, number>();
    const hourlyMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourlyMap.set(i, 0);
    const methodsMap = new Map<string, number>();

    validOrders.forEach(o => {
      if (o.payments && o.payments.length > 0) {
        o.payments.forEach(p => {
          const day = new Date(p.timestamp).toLocaleDateString();
          const hour = new Date(p.timestamp).getHours();
          const amount = p.amount;

          totalRevenue += amount;
          totalTips += (p.tip || 0);
          dailyMap.set(day, (dailyMap.get(day) || 0) + amount);
          hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + amount);
          methodsMap.set(p.method, (methodsMap.get(p.method) || 0) + amount);
        });
      } else if (o.isPaid) {
        // Fallback for legacy data
        const day = new Date(o.date).toLocaleDateString();
        const hour = new Date(o.date).getHours();
        totalRevenue += o.total;
        totalTips += (o.tip || 0);
        dailyMap.set(day, (dailyMap.get(day) || 0) + o.total);
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + o.total);
        methodsMap.set(o.payment, (methodsMap.get(o.payment) || 0) + o.total);
      }
    });

    const daily = Array.from(dailyMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const hourly = Array.from(hourlyMap.entries()).map(([hour, total]) => ({
      hour: `${hour}:00`,
      total
    }));

    const methods = Array.from(methodsMap.entries()).map(([name, value]) => ({ name, value }));

    // Top Products
    const productMap = new Map<string, number>();
    validOrders.filter(o => o.isPaid).forEach(o => {
      o.items.forEach(item => {
        productMap.set(item.name, (productMap.get(item.name) || 0) + item.quantity);
      });
    });
    const products = Array.from(productMap.entries())
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8);

    const paidOrders = validOrders.filter(o => o.isPaid);
    const orderCount = paidOrders.length;
    const deliveredCount = paidOrders.filter(o => o.status === 'delivered').length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Occupancy
    const occupiedTables = tables.filter(t => t.isOccupied).length;
    const occupancyRate = tables.length > 0 ? (occupiedTables / tables.length) * 100 : 0;

    return { 
      daily, products, hourly, methods, totalRevenue, totalTips, orderCount, deliveredCount, 
      avgOrderValue, occupancyRate, occupiedTables 
    };
  }, [filteredOrders, tables]);

  const displayOrders = useMemo(() => {
    return filteredOrders
      .filter(o => {
        if (paymentFilter === 'all') return true;
        if (o.payments && o.payments.length > 0) {
          return o.payments.some(p => p.method === paymentFilter);
        }
        return o.payment === paymentFilter;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredOrders, paymentFilter]);

  const downloadCSV = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAnalyticsDaily = () => {
    const headers = ['Fecha', 'Total Ventas'];
    const rows = analyticsData.daily.map(d => [`"${d.date}"`, d.total].join(','));
    downloadCSV(`ventas_diarias_${new Date().toISOString().split('T')[0]}.csv`, [headers.join(','), ...rows].join('\n'));
  };

  const exportAnalyticsProducts = () => {
    const headers = ['Producto', 'Cantidad Vendida'];
    const rows = analyticsData.products.map(p => [`"${p.name}"`, p.sales].join(','));
    downloadCSV(`top_productos_${new Date().toISOString().split('T')[0]}.csv`, [headers.join(','), ...rows].join('\n'));
  };

  const exportAnalyticsHourly = () => {
    const headers = ['Horario', 'Total Ventas'];
    const rows = analyticsData.hourly.map(h => [`"${h.hour}"`, h.total].join(','));
    downloadCSV(`ventas_por_horario_${new Date().toISOString().split('T')[0]}.csv`, [headers.join(','), ...rows].join('\n'));
  };

  const exportAnalyticsMethods = () => {
    const headers = ['Metodo de Pago', 'Cantidad de Usos'];
    const rows = analyticsData.methods.map(m => [`"${m.name}"`, m.value].join(','));
    downloadCSV(`metodos_pago_${new Date().toISOString().split('T')[0]}.csv`, [headers.join(','), ...rows].join('\n'));
  };

  const exportToCSV = () => {
    const exportData = orders.filter(o => o.isPaid && o.status !== 'cancelled');
    if (exportData.length === 0) return;

    // CSV Headers
    const headers = ['ID', 'Fecha', 'Cliente', 'Tipo', 'Subtipo/Mesa', 'Metodo Pago', 'Total', 'Detalles'];
    
    // CSV Rows
    const rows = exportData.map(order => {
      const itemsDetail = order.items
        .map(item => `${item.quantity}x ${item.name}${item.note ? ` (${item.note})` : ''}`)
        .join('; ');
      
      return [
        `"${order.id}"`,
        `"${new Date(order.date).toLocaleString()}"`,
        `"${order.client.replace(/"/g, '""')}"`,
        `"${order.type === 'dine-in' ? 'MESA' : 'LLEVAR'}"`,
        `"${order.type === 'dine-in' ? order.table : (order.takeawayType || 'Mostrador')}"`,
        `"${order.payment}"`,
        order.total,
        `"${itemsDetail.replace(/"/g, '""')}"`
      ].join(',');
    });

    downloadCSV(`ventas_detalladas_${new Date().toISOString().split('T')[0]}.csv`, [headers.join(','), ...rows].join('\n'));
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-black text-black tracking-tighter uppercase leading-none">
            Administración
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3 flex items-center">
            <span className="w-2 h-2 bg-red-600 rounded-full mr-2 animate-pulse"></span>
            Métricas y Registros
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button 
              onClick={() => {
                const prev = new Date(dateRange.start);
                prev.setDate(prev.getDate() - 1);
                const prevStr = prev.toISOString().split('T')[0];
                setDateRange({ start: prevStr, end: prevStr });
                setIsFilterActive(true);
              }}
              className="p-2 text-slate-400 hover:text-black transition-colors"
              title="Día Anterior"
            >
              <Icons.ArrowLeft size={14} />
            </button>
            <div className="flex items-center px-1 space-x-2">
              <Icons.Calendar size={14} className="text-slate-400" />
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange(prev => ({ ...prev, start: e.target.value, end: e.target.value === prev.end ? e.target.value : prev.end }));
                  setIsFilterActive(true);
                }}
                className="bg-transparent border-none text-[10px] font-black uppercase tracking-tight focus:ring-0 cursor-pointer p-0"
              />
              {dateRange.start !== dateRange.end && (
                <>
                  <span className="text-slate-300 text-[10px] font-black">-</span>
                  <input 
                    type="date" 
                    value={dateRange.end}
                    onChange={(e) => {
                      setDateRange(prev => ({ ...prev, end: e.target.value }));
                      setIsFilterActive(true);
                    }}
                    className="bg-transparent border-none text-[10px] font-black uppercase tracking-tight focus:ring-0 cursor-pointer p-0"
                  />
                </>
              )}
            </div>
            <button 
              onClick={() => {
                const next = new Date(dateRange.start);
                next.setDate(next.getDate() + 1);
                const nextStr = next.toISOString().split('T')[0];
                setDateRange({ start: nextStr, end: nextStr });
                setIsFilterActive(true);
              }}
              className="p-2 text-slate-400 hover:text-black transition-colors"
              title="Día Siguiente"
            >
              <div className="rotate-180">
                <Icons.ArrowLeft size={14} />
              </div>
            </button>
            
            <div className="w-px h-4 bg-slate-200 mx-2"></div>

            <button 
              onClick={() => {
                setDateRange({ start: today, end: today });
                setIsFilterActive(true);
              }}
              className={`px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                isFilterActive && dateRange.start === today && dateRange.end === today
                ? 'bg-black text-white shadow-md'
                : 'text-slate-500 hover:text-black'
              }`}
            >
              Hoy
            </button>

            {isFilterActive && (
              <button 
                onClick={() => {
                  setIsFilterActive(false);
                  setDateRange({ start: today, end: today });
                }}
                className="px-3 py-2 text-slate-400 hover:text-red-600 transition-all font-black text-[9px] uppercase tracking-widest"
                title="Mostrar Todo el Historial"
              >
                Histórico
              </button>
            )}
          </div>

          {hasOpenCashShift && (
            <button 
              onClick={onCloseCashShift}
              className="w-full sm:w-auto px-8 py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-red-200 flex items-center justify-center space-x-2"
            >
              <Icons.Lock size={16} />
              <span>Realizar Corte</span>
            </button>
          )}
          <div className="flex w-full sm:w-auto overflow-x-auto custom-scrollbar bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setActiveTab('list')}
              className={`flex-shrink-0 px-4 sm:px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                activeTab === 'list' ? 'bg-black text-white shadow-xl scale-105' : 'text-slate-500 hover:text-black'
              }`}
            >
              Ventas
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`flex-shrink-0 px-4 sm:px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                activeTab === 'analytics' ? 'bg-black text-white shadow-xl scale-105' : 'text-slate-500 hover:text-black'
              }`}
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Resumen del Día Actual */}
      <div className="bg-black text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group border-b-8 border-red-600">
        <div className="absolute top-0 right-0 p-12 opacity-10 blur-sm group-hover:rotate-12 transition-transform duration-700">
          <Icons.DollarSign size={160} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-6">
             <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping"></div>
             <h3 className="text-xs font-black uppercase tracking-[0.4em]">Corte Parcial del Día ({new Date().toLocaleDateString()})</h3>
          </div>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
            <div className="space-y-1">
              <p className="text-6xl sm:text-7xl font-black tracking-tighter leading-none italic">
                ${todaySummary.total.toLocaleString()}
              </p>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Total Facturado Hoy</p>
            </div>
            
            <div className="flex flex-wrap gap-3 w-full lg:w-auto">
              {Object.entries(todaySummary.methods).length > 0 ? (
                Object.entries(todaySummary.methods).map(([method, amount]) => (
                  <div key={method} className="flex-1 min-w-[140px] bg-slate-900/50 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/5 hover:border-red-600/30 transition-colors shadow-inner">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center">
                       <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2"></span>
                       {method}
                    </p>
                    <p className="text-xl font-black tracking-tight leading-none">${amount.toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <div className="flex-1 text-[10px] font-black text-slate-600 uppercase tracking-widest italic border-2 border-dashed border-slate-900 p-6 rounded-3xl">
                  Sin ventas registradas hoy
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPIs (Always visible) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPIBox 
          label="Ventas Totales" 
          value={`$${analyticsData.totalRevenue.toLocaleString()}`} 
          subValue={`+ $${analyticsData.totalTips.toLocaleString()} Propina`}
          icon={<Icons.Chart />} 
          color="black"
        />
        <KPIBox 
          label="Caja Total" 
          value={`$${(analyticsData.totalRevenue + analyticsData.totalTips).toLocaleString()}`} 
          icon={<Icons.DollarSign />} 
          color="red"
        />
        <KPIBox 
          label="Ordenes Totales" 
          value={analyticsData.orderCount.toString()} 
          icon={<Icons.Cart />} 
          color="slate"
        />
        <KPIBox 
          label="Ocupación Sala" 
          value={`${Math.round(analyticsData.occupancyRate)}%`} 
          subValue={`${analyticsData.occupiedTables}/${tables.length} Mesas`}
          icon={<Icons.Layout />} 
          color={analyticsData.occupancyRate > 80 ? "red" : "green"}
        />
      </div>

      {activeTab === 'analytics' ? (
        <div className="space-y-6">
          {/* Charts Row 1: Daily Revenue */}
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-xl font-black text-black tracking-tighter uppercase">Ventas por Día</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Flujo de caja histórico</p>
               </div>
               <div className="flex items-center space-x-3">
                 <button 
                   onClick={exportAnalyticsDaily}
                   className="p-2 text-slate-400 hover:text-black transition-colors"
                   title="Exportar Ventas Diarias"
                 >
                   <Icons.Download />
                 </button>
                 <Icons.History />
               </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData.daily}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-black tracking-tighter uppercase">Top de Ventas</h3>
                <button 
                   onClick={exportAnalyticsProducts}
                   className="p-2 text-slate-400 hover:text-black transition-colors"
                   title="Exportar Top Productos"
                 >
                   <Icons.Download />
                 </button>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.products} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b', width: 100 }}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', shadow: 'none', fontWeight: 900, fontSize: '10px' }}
                    />
                    <Bar dataKey="sales" radius={[0, 10, 10, 0]} barSize={20}>
                      {analyticsData.products.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak Hours */}
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-black tracking-tighter uppercase">Horarios Pico</h3>
                <button 
                   onClick={exportAnalyticsHourly}
                   className="p-2 text-slate-400 hover:text-black transition-colors"
                   title="Exportar Horarios Pico"
                 >
                   <Icons.Download />
                 </button>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.hourly}>
                    <XAxis 
                       dataKey="hour" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b' }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: 900, fontSize: '10px' }}
                    />
                    <Bar dataKey="total" fill="#000" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-black tracking-tighter uppercase">Métodos de Pago</h3>
                <button 
                   onClick={exportAnalyticsMethods}
                   className="p-2 text-slate-400 hover:text-black transition-colors"
                   title="Exportar Métodos de Pago"
                 >
                   <Icons.Download />
                 </button>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.methods}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {analyticsData.methods.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: 900, fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {analyticsData.methods.map((entry, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-[10px] font-black uppercase text-slate-500">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* History List (Existing) */
        <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-8 border-b border-slate-200 bg-slate-50 font-black text-[10px] uppercase tracking-[0.2em] text-slate-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <span className="flex items-center">
              <div className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 shrink-0"></div>
              Registro de Ventas
            </span>
            
            <div className="flex flex-wrap items-center justify-start md:justify-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              <button
                onClick={() => setPaymentFilter('all')}
                className={`px-4 py-2 shrink-0 rounded-xl transition-all border-2 ${paymentFilter === 'all' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
              >
                Todos
              </button>
              {paymentMethods.map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentFilter(method)}
                  className={`px-4 py-2 shrink-0 rounded-xl transition-all border-2 ${paymentFilter === method ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                >
                  {method}
                </button>
              ))}
              <div className="w-px h-6 bg-slate-200 mx-2 hidden md:block"></div>
              <button 
                onClick={exportToCSV}
                className="flex items-center space-x-2 bg-red-600 text-white px-5 py-2.5 rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 text-[9px] uppercase font-black"
              >
                <Icons.Download />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {displayOrders.map(order => {
              const isDineIn = order.type === 'dine-in';
              const isCancelled = order.status === 'cancelled';
              
              return (
                <div key={order.id} className={`transition-colors border-b border-slate-50 hover:bg-slate-50/80 ${isCancelled ? 'bg-slate-100 opacity-60 grayscale' : (order.isPaid ? '' : 'bg-amber-50/30')}`}>
                  <div 
                    className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer gap-4 sm:gap-0"
                    onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  >
                    <div className="flex items-center space-x-4 sm:space-x-6 w-full sm:w-auto">
                      <div className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl border-2 transition-all ${isCancelled ? 'bg-slate-300 border-slate-300 text-slate-500' : (order.isPaid ? 'bg-black text-white border-black rotate-3 shadow-lg' : 'bg-white text-amber-600 border-amber-600 shadow-sm')}`}>
                        {isCancelled ? <Icons.Trash size={18} /> : (order.isPaid ? <Icons.CheckCircle size={18} /> : <Icons.ChefHat size={18} />)}
                      </div>
                      <div className="overflow-hidden min-w-0 flex-1">
                        <p className={`font-black uppercase tracking-tighter text-base sm:text-lg leading-none truncate ${isCancelled ? 'text-slate-500' : 'text-black'}`}>
                          {isDineIn ? `MESA: ${order.table}` : `${order.takeawayType?.toUpperCase() || 'LLEVAR'}`} 
                        </p>
                        <div className="flex items-center space-x-2 mt-1.5 font-black uppercase tracking-widest text-[9px] sm:text-[10px] flex-wrap gap-y-1">
                           <span className="text-slate-400">{new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                           <span className="w-1 h-1 bg-slate-200 rounded-full shrink-0"></span>
                           <span className="text-slate-400 truncate max-w-[80px] sm:max-w-none">{order.payment}</span>
                           {order.address && (
                             <>
                               <span className="w-1 h-1 bg-slate-200 rounded-full shrink-0"></span>
                               <span className="text-amber-600 truncate max-w-[150px] sm:max-w-none">{order.address}</span>
                             </>
                           )}
                           {order.client && order.client !== 'Mostrador' && (
                             <>
                               <span className="w-1 h-1 bg-slate-200 rounded-full shrink-0"></span>
                               <span className="text-red-600 truncate max-w-[100px] sm:max-w-none">{order.client}</span>
                             </>
                           )}
                           {isCancelled && (
                             <>
                               <span className="w-1 h-1 bg-slate-200 rounded-full shrink-0"></span>
                               <span className="text-slate-500 pl-1">CANCELADA</span>
                             </>
                           )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center justify-between sm:justify-end w-full sm:w-auto mt-2 sm:mt-0 pl-[56px] sm:pl-0 sm:space-x-8">
                      <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
                        <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end mb-1.5 sm:space-x-4">
                          <p className={`font-black text-xl sm:text-2xl tracking-tighter leading-none ${isCancelled ? 'text-slate-400 line-through' : 'text-black'}`}>
                            ${order.total.toLocaleString()}
                          </p>
                          <div className="flex space-x-1 ml-auto sm:ml-0">
                            <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                              isCancelled 
                                ? 'bg-slate-400 text-white' 
                                : order.status === 'delivered' 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-red-600 text-white animate-pulse'
                            }`}>
                              {isCancelled ? 'ANULADA' : order.status === 'delivered' ? 'RECIBIDO' : 'EN COCINA'}
                            </span>
                            {!order.isPaid && !isCancelled && (
                              <span className="text-[8px] font-black bg-amber-500 text-white px-3 py-1 rounded-full uppercase tracking-widest">
                                PAGAR
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`transition-transform duration-500 text-slate-300 ${expandedId === order.id ? 'rotate-180 text-red-600' : ''}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>

                  {expandedId === order.id && (
                    <div className="px-4 sm:px-24 pb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-4 sm:p-8 space-y-4 shadow-inner">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex flex-col border-b border-slate-200 last:border-0 pb-3">
                            <div className="flex justify-between text-xs font-black uppercase tracking-tight">
                              <span className="text-slate-600 flex items-center">
                                <span className="bg-white border border-slate-200 w-6 h-6 flex items-center justify-center rounded-lg text-[10px] mr-3">{item.quantity}</span>
                                {item.name}
                                {item.isCombo && (
                                     <span className="ml-2 text-[8px] font-black bg-red-100 text-red-700 px-1 py-0 rounded uppercase tracking-tighter">
                                         Combo
                                     </span>
                                )}
                                {item.paidQuantity && item.paidQuantity > 0 && (
                                  <span className="ml-2 text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">PAGADO: {item.paidQuantity}</span>
                                )}
                              </span>
                              <span className="text-black">${(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                            {item.isCombo && item.selectedComboOptions && (
                                <div className="text-[9px] font-bold text-slate-500 mb-2 ml-9 italic">
                                    {item.selectedComboOptions.map(o => o.label).join(', ')}
                                </div>
                            )}
                            {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                              <div className="mt-1 ml-9 flex flex-wrap gap-1 mb-2">
                                {item.selectedModifiers.map((mod, midx) => {
                                  const isRemoval = mod.modifierName.toLowerCase().includes('sin') || 
                                                    mod.modifierName.toLowerCase().includes('quitar') || 
                                                    mod.modifierName.toLowerCase().includes('remover') || 
                                                    mod.modifierName.toLowerCase().includes('no ') || 
                                                    mod.extraPrice <= 0;
                                  return (
                                    <span key={midx} className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-tighter border ${
                                      isRemoval ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}>
                                      {isRemoval ? '' : '+ '}{mod.modifierName}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {item.note && (
                              <span className="text-[9px] italic font-bold text-red-600 mt-2 ml-9">
                               &gt; {item.note}
                              </span>
                            )}
                          </div>
                        ))}

                        {order.payments && order.payments.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-dashed border-slate-300">
                             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Desglose de Pagos y Propinas</h4>
                             <div className="space-y-2">
                               {order.payments.map((p, i) => (
                                 <div key={i} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight">
                                   <div className="flex items-center space-x-2">
                                     <span className="text-slate-400">{new Date(p.timestamp).toLocaleDateString()}</span>
                                     <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                     <span className="text-black">{p.method}</span>
                                     {p.tip > 0 && <span className="bg-blue-50 text-blue-600 px-1 rounded-sm">Propina: ${p.tip}</span>}
                                   </div>
                                   <span className="text-green-600">${p.amount.toLocaleString()}</span>
                                 </div>
                               ))}
                             </div>
                             {order.tip > 0 && (
                               <div className="mt-2 flex justify-between text-[10px] font-black border-t border-slate-100 pt-2 uppercase">
                                 <span className="text-slate-500">Total Propina</span>
                                 <span className="text-blue-600">${order.tip.toLocaleString()}</span>
                               </div>
                             )}
                          </div>
                        )}
                        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end space-x-4">
                           <button 
                            onClick={(e) => { e.stopPropagation(); window.print(); }}
                            className="text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 px-6 py-3 bg-white border-2 border-slate-200 rounded-xl hover:bg-black hover:text-white hover:border-black transition-all"
                          >
                            <Icons.Printer /> <span>Imprimir</span>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); generateTicketPDF(order, restaurantName); }}
                            className="text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-xl shadow-red-100 transition-all active:scale-95"
                          >
                            <Icons.FileText /> <span>Bajar Ticket</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface KPIBoxProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  color: 'black' | 'red' | 'slate' | 'green';
}

const KPIBox: React.FC<KPIBoxProps> = ({ label, value, subValue, icon, color }) => {
  const colorStyles = {
    black: 'bg-black text-white border-black',
    red: 'bg-white text-black border-slate-200',
    slate: 'bg-slate-50 text-black border-slate-200',
    green: 'bg-white text-black border-slate-200'
  };

  return (
    <div className={`p-6 rounded-[2.5rem] shadow-sm border transition-transform hover:scale-105 duration-300 ${colorStyles[color]}`}>
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{label}</span>
        <div className={`w-10 h-10 flex items-center justify-center rounded-2xl ${color === 'black' ? 'bg-slate-800' : 'bg-slate-100 text-red-600'}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline space-x-2">
        <p className="text-3xl font-black tracking-tighter leading-none">{value}</p>
        {subValue && <span className="text-[10px] font-black opacity-40 uppercase ml-2">{subValue}</span>}
      </div>
    </div>
  );
};

export default HistoryView;
