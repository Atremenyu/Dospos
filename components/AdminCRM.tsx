
import React, { useState } from 'react';
import { Icons } from '../constants';
import { Product, Table, Order, CashShift, User, UserRole, Shift, StoreSettings, AdminTabType, Ingredient } from '../types';
import ProductManagement from './ProductManagement';
import HistoryView from './HistoryView';
import CashShiftView from './CashShiftView';

interface AdminCRMProps {
  products: Product[];
  categories: string[];
  tables: Table[];
  orders: Order[];
  cashShifts: CashShift[];
  users: User[];
  roles: UserRole[];
  shifts: Shift[];
  settings: StoreSettings;
  hasOpenCashShift: boolean;
  activeTab: AdminTabType;
  setActiveTab: (tab: AdminTabType) => void;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateCategories: (categories: string[]) => void;
  onUpdateTables: (tables: Table[]) => void;
  onUpdateUsers: (users: User[]) => void;
  onUpdateRoles: (roles: UserRole[]) => void;
  onUpdateSettings: (settings: StoreSettings) => void;
  onRestoreDatabase: (data: any) => void;
  onFactoryReset: () => void;
  onCloseCashShift: () => void;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
}

const AdminCRM: React.FC<AdminCRMProps> = ({
  products,
  categories,
  tables,
  orders,
  cashShifts,
  users,
  roles,
  shifts,
  settings,
  hasOpenCashShift,
  activeTab,
  setActiveTab,
  onUpdateProducts,
  onUpdateCategories,
  onUpdateTables,
  onUpdateUsers,
  onUpdateRoles,
  onUpdateSettings,
  onRestoreDatabase,
  onFactoryReset,
  onCloseCashShift,
  ingredients,
  setIngredients
}) => {

  // Integrated ProductManagement wrapper or just pass the props
  // We'll use a simplified version of ProductManagement inside or just call it with specific tabs.
  
  const stats = {
    totalSales: orders.filter(o => o.isPaid && o.status !== 'cancelled').reduce((acc, o) => acc + o.total, 0),
    orderCount: orders.filter(o => o.status !== 'cancelled').length,
    productCount: products.length,
    activeTables: tables.filter(t => t.status === 'occupied').length,
    avgTicket: orders.filter(o => o.isPaid && o.status !== 'cancelled').length > 0 
      ? orders.filter(o => o.isPaid && o.status !== 'cancelled').reduce((acc, o) => acc + o.total, 0) / orders.filter(o => o.isPaid && o.status !== 'cancelled').length 
      : 0
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
               <div>
                  <h2 className="text-3xl font-black text-black tracking-tighter uppercase">Panel de Control</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen ejecutivo y operaciones críticas</p>
               </div>
               <div className="flex space-x-2">
                  <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Caja Actual</p>
                     <p className={`text-xs font-black uppercase ${hasOpenCashShift ? 'text-green-600' : 'text-red-700'}`}>
                        {hasOpenCashShift ? '🟢 Abierta' : '🔴 Cerrada'}
                     </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className="p-3 bg-black text-white rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center space-x-2"
                  >
                    <Icons.TrendingUp size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ver Ventas</span>
                  </button>
               </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Ventas Totales', value: `$${stats.totalSales.toLocaleString()}`, icon: <Icons.TrendingUp />, color: 'bg-green-500', desc: 'Ingresos confirmados' },
                { label: 'Pedidos', value: stats.orderCount, icon: <Icons.Clipboard />, color: 'bg-blue-500', desc: 'Volumen de órdenes' },
                { label: 'Ticket Promedio', value: `$${Math.round(stats.avgTicket).toLocaleString()}`, icon: <Icons.DollarSign />, color: 'bg-purple-500', desc: 'Valor por cliente' },
                { label: 'Ocupación Mesas', value: `${stats.activeTables}/${tables.length}`, icon: <Icons.Users />, color: 'bg-orange-500', desc: 'Capacidad actual' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className={`w-12 h-12 rounded-2xl ${stat.color} text-white flex items-center justify-center shadow-lg`}>
                      {stat.icon}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                      <p className="text-2xl font-black text-black tracking-tighter">{stat.value}</p>
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{stat.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
                    <h3 className="text-xl font-black text-black tracking-tighter uppercase flex items-center">
                      <Icons.History className="mr-2 text-red-600" /> Vales de Caja Recientes
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {cashShifts.slice(0, 5).map(shift => (
                      <div key={shift.id} className="group p-5 bg-slate-50 rounded-[2rem] flex justify-between items-center border border-slate-100 transition-all hover:bg-white hover:shadow-2xl hover:border-slate-200">
                        <div className="flex items-center space-x-4">
                           <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500">
                              <Icons.User size={18} />
                           </div>
                           <div>
                              <p className="text-xs font-black text-black uppercase tracking-tight">{shift.userName}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(shift.openingTime).toLocaleDateString()} {new Date(shift.openingTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-sm font-black text-black tracking-tighter">${shift.actualAmount?.toLocaleString() || shift.initialFund.toLocaleString()}</p>
                           <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${shift.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                             {shift.status === 'open' ? 'Abierta' : 'Cerrada'}
                           </span>
                        </div>
                      </div>
                    ))}
                    {cashShifts.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                         <Icons.History size={48} className="mb-4 opacity-20" />
                         <p className="text-xs font-black uppercase tracking-widest">No hay registros aún</p>
                      </div>
                    )}
                  </div>
               </div>

               <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100">
                  <h3 className="text-xl font-black text-black tracking-tighter uppercase mb-8 flex items-center">
                    <Icons.Layers className="mr-2 text-red-600" /> Estado de Mesa
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {tables.map(table => (
                      <div key={table.id} className={`aspect-square rounded-[1.5rem] flex flex-col items-center justify-center border-2 transition-all cursor-default ${table.status === 'occupied' ? 'bg-red-50 border-red-200 text-red-600 shadow-inner' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                        <span className="text-lg font-black">{table.name}</span>
                        <span className="text-[8px] font-black uppercase tracking-tighter text-center px-1 leading-tight">{table.status === 'occupied' ? 'En Uso' : 'Libre'}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                        <span className="text-slate-400">Tasa de Ocupación</span>
                        <span className="text-black">{Math.round((stats.activeTables/tables.length)*100)}%</span>
                     </div>
                     <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-red-600 transition-all duration-1000" style={{ width: `${(stats.activeTables/tables.length)*100}%` }}></div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        );
      case 'products':
      case 'categories':
      case 'inventory':
      case 'tables':
      case 'users':
      case 'roles':
      case 'shifts':
      case 'general':
        return (
          <div className="h-full animate-in fade-in slide-in-from-right-4 duration-500">
            <ProductManagement 
              products={products} 
              setProducts={onUpdateProducts as any}
              categories={categories} 
              setCategories={onUpdateCategories as any}
              tables={tables}
              setTables={onUpdateTables as any}
              orders={orders}
              setOrders={() => {}} 
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              onRestoreDatabase={onRestoreDatabase}
              onFactoryReset={onFactoryReset}
              users={users}
              setUsers={onUpdateUsers as any}
              shifts={shifts}
              roles={roles}
              setRoles={onUpdateRoles as any}
              ingredients={ingredients}
              setIngredients={setIngredients}
              activeTab={activeTab as any}
            />
          </div>
        );
      case 'history':
        return (
          <div className="h-full animate-in fade-in slide-in-from-right-4 duration-500">
            <HistoryView 
              orders={orders}
              tables={tables}
              cashShifts={cashShifts}
              restaurantName={settings.name}
              settings={settings}
              hasOpenCashShift={hasOpenCashShift}
              onCloseCashShift={onCloseCashShift}
              onOpenSettings={() => setActiveTab('general')}
            />
          </div>
        );
      case 'cash':
        return (
          <div className="h-full animate-in fade-in slide-in-from-right-4 duration-500">
            <CashShiftView 
              cashShifts={cashShifts}
              onOpenSettings={() => setActiveTab('general')}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row pb-24 lg:pb-0">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 lg:w-72 shrink-0 bg-black text-white p-4 lg:p-6 flex-col sticky top-0 md:h-screen z-40 overflow-y-auto">
        <div className="mb-6 lg:mb-10 px-4 py-2 bg-red-600 rounded-2xl shadow-xl text-center">
           <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase">Central</h1>
           <p className="text-[8px] font-bold uppercase tracking-[0.3em] opacity-80">Command Center</p>
        </div>

        <nav className="flex-1 flex lg:flex-col gap-2 lg:space-y-2 lg:gap-0 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 scrollbar-hide">
          {[
            { id: 'overview', label: 'Dashboard', icon: <Icons.Activity size={18} /> },
            { id: 'history', label: 'Ventas', icon: <Icons.TrendingUp size={18} /> },
            { id: 'cash', label: 'Cierres de Caja', icon: <Icons.Lock size={18} /> },
            { id: 'inventory', label: 'Inventario', icon: <Icons.Layers size={18} /> },
            { id: 'products', label: 'Productos', icon: <Icons.Package size={18} /> },
            { id: 'categories', label: 'Categorías', icon: <Icons.Tag size={18} /> },
            { id: 'tables', label: 'Mesas', icon: <Icons.Layers size={18} /> },
            { id: 'users', label: 'Usuarios', icon: <Icons.Users size={18} /> },
            { id: 'roles', label: 'Roles', icon: <Icons.Shield size={18} /> },
            { id: 'shifts', label: 'Turnos', icon: <Icons.Clock size={18} /> },
            { id: 'general', label: 'Configuración / Caja', icon: <Icons.Settings size={18} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 lg:space-x-4 p-3 lg:p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 lg:shrink lg:w-full ${
                activeTab === tab.id ? 'bg-white text-black shadow-2xl scale-105' : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto hidden lg:block p-4 lg:p-6 bg-white/5 rounded-[2rem] text-center border border-white/10">
           <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Negocio:</p>
           <p className="text-sm font-black tracking-tighter truncate">{settings.name}</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 md:p-8 lg:p-12 min-h-screen">
        <div className="max-w-7xl mx-auto h-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default AdminCRM;
