import React, { useState, useMemo } from 'react';
import { StaffConsumption, User, StoreSettings } from '../types';
import { Icons } from '../constants';
import { printStaffConsumptionTicketHTML } from '../services/thermalPrinter';

interface AdminStaffConsumptionsViewProps {
  staffConsumptions: StaffConsumption[];
  users: User[];
  settings: StoreSettings;
}

type DateRangePreset = 'today' | 'yesterday' | '7days' | 'month' | 'custom' | 'all';

export const AdminStaffConsumptionsView: React.FC<AdminStaffConsumptionsViewProps> = ({
  staffConsumptions = [],
  users = [],
  settings
}) => {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});

  // Filter consumptions by date range
  const filteredConsumptions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return staffConsumptions.filter(c => {
      const itemDate = new Date(c.date);
      const itemDateStr = itemDate.toISOString().slice(0, 10);

      // Date filter
      if (datePreset === 'today') {
        if (itemDateStr !== todayStr) return false;
      } else if (datePreset === 'yesterday') {
        if (itemDateStr !== yesterdayStr) return false;
      } else if (datePreset === '7days') {
        if (itemDate < sevenDaysAgo) return false;
      } else if (datePreset === 'month') {
        if (itemDate < startOfMonth) return false;
      } else if (datePreset === 'custom') {
        if (itemDateStr !== customDate) return false;
      }

      // User filter
      if (selectedUserId !== 'all') {
        const matchesId = c.beneficiaryUserId === selectedUserId;
        const matchesName = c.beneficiaryName.toLowerCase() === users.find(u => u.id === selectedUserId)?.name.toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // Search query (product, beneficiary, reason, notes)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesBeneficiary = c.beneficiaryName.toLowerCase().includes(q);
        const matchesReason = c.reason.toLowerCase().includes(q);
        const matchesNotes = c.notes?.toLowerCase().includes(q) || false;
        const matchesProduct = c.items.some(i => i.productName.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
        if (!matchesBeneficiary && !matchesReason && !matchesNotes && !matchesProduct) return false;
      }

      return true;
    });
  }, [staffConsumptions, datePreset, customDate, selectedUserId, searchQuery, users]);

  // Overall KPIs
  const kpiStats = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let totalRetail = 0;
    const uniqueUsers = new Set<string>();

    filteredConsumptions.forEach(c => {
      totalItems += c.totalItemsCount || 0;
      totalCost += c.totalCostValue || 0;
      totalRetail += c.totalRetailValue || 0;
      uniqueUsers.add(c.beneficiaryUserId || c.beneficiaryName);
    });

    return {
      totalItems,
      totalCost,
      totalRetail,
      beneficiariesCount: uniqueUsers.size,
      vouchersCount: filteredConsumptions.length
    };
  }, [filteredConsumptions]);

  // Group consumptions by user, and then by day
  const groupedByUser = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      userName: string;
      userRole: string;
      totalItems: number;
      totalCost: number;
      totalRetail: number;
      days: Map<string, {
        dateStr: string;
        dateDisplay: string;
        dayItems: number;
        dayCost: number;
        dayRetail: number;
        productSummary: Record<string, { quantity: number; cost: number; retail: number }>;
        tickets: StaffConsumption[];
      }>;
    }>();

    filteredConsumptions.forEach(c => {
      const uKey = c.beneficiaryUserId || c.beneficiaryName;
      const matchedUser = users.find(u => u.id === c.beneficiaryUserId || u.name.toLowerCase() === c.beneficiaryName.toLowerCase());
      const roleName = matchedUser?.role || 'Staff';

      if (!map.has(uKey)) {
        map.set(uKey, {
          userId: uKey,
          userName: c.beneficiaryName,
          userRole: roleName,
          totalItems: 0,
          totalCost: 0,
          totalRetail: 0,
          days: new Map()
        });
      }

      const userEntry = map.get(uKey)!;
      userEntry.totalItems += c.totalItemsCount || 0;
      userEntry.totalCost += c.totalCostValue || 0;
      userEntry.totalRetail += c.totalRetailValue || 0;

      // Day grouping
      const itemDate = new Date(c.date);
      const dateKey = itemDate.toISOString().slice(0, 10);
      const dateDisplay = itemDate.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      if (!userEntry.days.has(dateKey)) {
        userEntry.days.set(dateKey, {
          dateStr: dateKey,
          dateDisplay,
          dayItems: 0,
          dayCost: 0,
          dayRetail: 0,
          productSummary: {},
          tickets: []
        });
      }

      const dayEntry = userEntry.days.get(dateKey)!;
      dayEntry.dayItems += c.totalItemsCount || 0;
      dayEntry.dayCost += c.totalCostValue || 0;
      dayEntry.dayRetail += c.totalRetailValue || 0;
      dayEntry.tickets.push(c);

      // Consolidate product counts for the day
      c.items.forEach(item => {
        if (!dayEntry.productSummary[item.productName]) {
          dayEntry.productSummary[item.productName] = { quantity: 0, cost: 0, retail: 0 };
        }
        dayEntry.productSummary[item.productName].quantity += item.quantity;
        dayEntry.productSummary[item.productName].cost += item.totalCostValue;
        dayEntry.productSummary[item.productName].retail += item.totalRetailValue;
      });
    });

    // Convert map to sorted array (users with highest items first)
    return Array.from(map.values()).sort((a, b) => b.totalItems - a.totalItems);
  }, [filteredConsumptions, users]);

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Header Card */}
      <header className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Icons.Coffee size={22} />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-black tracking-tighter uppercase">
                Consumos de Personal por Usuario
              </h2>
              <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">
                Bitácora de auditoría • Control diario por colaborador • Mermas y costo real
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handlePrintReport}
          className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 shadow-lg self-start md:self-auto"
        >
          <Icons.Printer size={16} />
          <span>Imprimir Informe</span>
        </button>
      </header>

      {/* Filter Toolbar */}
      <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Date Presets */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'yesterday', label: 'Ayer' },
              { id: '7days', label: 'Últimos 7 días' },
              { id: 'month', label: 'Este Mes' },
              { id: 'all', label: 'Todo' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as DateRangePreset)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
                  datePreset === p.id
                    ? 'bg-red-600 text-white shadow-md shadow-red-900/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Specific Date Picker */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Día Específico:
            </span>
            <input
              type="date"
              value={customDate}
              onChange={e => {
                setCustomDate(e.target.value);
                setDatePreset('custom');
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>
        </div>

        {/* User filter & search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Filtrar por Colaborador
            </label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="all">-- Todos los colaboradores --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Buscar Producto o Motivo
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ej: Cerveza, Hamburguesa, Turno..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Icons.Search size={14} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Icons.Coffee size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Artículos Consumidos
              </p>
              <p className="text-2xl font-black text-black tracking-tight">
                {kpiStats.totalItems} uds
              </p>
            </div>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            En {kpiStats.vouchersCount} vales emitidos
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Icons.DollarSign size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Costo Real (Merma)
              </p>
              <p className="text-2xl font-black text-emerald-700 tracking-tight">
                ${kpiStats.totalCost.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            Gasto neto de insumos
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Icons.Tag size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Valor Comercial Carta
              </p>
              <p className="text-2xl font-black text-slate-800 tracking-tight">
                ${kpiStats.totalRetail.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            Equivalente en precios de venta
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Icons.Users size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Colaboradores
              </p>
              <p className="text-2xl font-black text-black tracking-tight">
                {kpiStats.beneficiariesCount}
              </p>
            </div>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            Personal con salidas registradas
          </p>
        </div>
      </div>

      {/* Main Grouped By User Section */}
      <div className="space-y-4">
        {groupedByUser.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-100 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Icons.Coffee size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">
              Sin consumos registrados en este periodo
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No se encontraron salidas de cortesía o consumo interno de staff para el filtro de fecha y colaborador seleccionado.
            </p>
          </div>
        ) : (
          groupedByUser.map(userGroup => {
            const isExpanded = expandedUsers[userGroup.userId] !== false; // expanded by default

            return (
              <div
                key={userGroup.userId}
                className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden transition-all"
              >
                {/* User Accordion Header */}
                <div
                  onClick={() => toggleUserExpanded(userGroup.userId)}
                  className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-red-900/30 shrink-0">
                      {userGroup.userName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">
                          {userGroup.userName}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black text-white">
                          {userGroup.userRole}
                        </span>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                        {userGroup.days.size} día(s) con actividad en el periodo
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 self-end md:self-center">
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Total Artículos
                      </p>
                      <p className="text-base font-black text-slate-900">
                        {userGroup.totalItems} uds
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
                        Costo Real
                      </p>
                      <p className="text-base font-black text-emerald-700">
                        ${userGroup.totalCost.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Valor Carta
                      </p>
                      <p className="text-xs font-bold text-slate-400 line-through">
                        ${userGroup.totalRetail.toLocaleString()}
                      </p>
                    </div>

                    <div className="text-slate-400 p-2">
                      <svg
                        className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Days Breakdown */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-6 md:p-8 space-y-6">
                    {Array.from(userGroup.days.values()).map(dayEntry => (
                      <div
                        key={dayEntry.dateStr}
                        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4"
                      >
                        {/* Day Title & Day Subtotal */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                            <h4 className="font-black text-xs md:text-sm text-slate-900 uppercase tracking-tight">
                              {dayEntry.dateDisplay}
                            </h4>
                          </div>
                          <div className="flex items-center space-x-4 text-xs">
                            <span className="font-bold text-slate-500">
                              {dayEntry.dayItems} artículos
                            </span>
                            <span className="font-black text-emerald-700">
                              Costo: ${dayEntry.dayCost.toLocaleString()}
                            </span>
                            <span className="font-medium text-slate-400 line-through">
                              Carta: ${dayEntry.dayRetail.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Consolidated Products for this Day */}
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                            Resumen de Productos Consumidos en el Día:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {Object.entries(dayEntry.productSummary).map(([prodName, data]) => (
                              <div
                                key={prodName}
                                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                              >
                                <span className="font-black text-slate-800 truncate mr-2">
                                  {data.quantity}x {prodName}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                                  ${data.cost.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* List of Vouchers / Tickets for this Day */}
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                            Vales Individuales Emitidos ({dayEntry.tickets.length}):
                          </p>
                          <div className="space-y-2">
                            {dayEntry.tickets.map(ticket => (
                              <div
                                key={ticket.id}
                                className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-slate-900">
                                      {new Date(ticket.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="px-2 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-200 text-slate-700">
                                      {ticket.reason}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      Aut: {ticket.authorizedBy}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 font-medium">
                                    {ticket.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                                  </p>
                                  {ticket.notes && (
                                    <p className="text-[10px] text-slate-400 italic">
                                      Nota: {ticket.notes}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
                                  <div className="text-right">
                                    <span className="text-xs font-black text-emerald-700">
                                      ${ticket.totalCostValue.toLocaleString()}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      try {
                                        printStaffConsumptionTicketHTML(ticket, settings);
                                      } catch (e) {
                                        alert('Error al imprimir vale: ' + e);
                                      }
                                    }}
                                    className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition"
                                    title="Reimprimir vale térmico"
                                  >
                                    <Icons.Printer size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
