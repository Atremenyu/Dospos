
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewState, User, AdminTabType } from '../types';
import { Icons } from '../constants';

interface TabNavigationProps {
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
  adminView: AdminTabType;
  onAdminViewChange: (view: AdminTabType) => void;
  pendingCount: number;
  activeOrdersCount: number;
  onToggleOrders: () => void;
  permissions: ViewState[];
  currentUser: User;
  onLogout: () => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ 
  activeView, 
  onViewChange, 
  adminView,
  onAdminViewChange,
  pendingCount,
  activeOrdersCount,
  onToggleOrders,
  permissions,
  currentUser,
  onLogout
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const tabs = [
    { id: 'pos', icon: <Icons.Cart />, label: 'Venta' },
    { id: 'tables', icon: <Icons.Layout />, label: 'Mesas' },
    { id: 'dispatch', icon: <Icons.ChefHat />, label: 'Cocina', badge: pendingCount },
    { id: 'central', icon: <Icons.Activity />, label: 'Central' }
  ].filter(tab => permissions.includes(tab.id as ViewState));

  const handleTabClick = (id: string) => {
    onViewChange(id as ViewState);
    setIsSidebarOpen(false);
  };

  return (
    <>
      <div className="flex flex-1 justify-end lg:justify-center items-center space-x-2">
        {/* Desktop Navigation (Header) */}
        <nav className="hidden lg:flex items-center space-x-1 bg-slate-900/50 p-1 rounded-2xl border border-slate-800">
          {tabs.map((tab) => {
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id as ViewState)}
                aria-label={`Ver ${tab.label}`}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  group relative flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300
                  ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab-desktop"
                    className="absolute inset-0 bg-red-600 rounded-xl shadow-lg shadow-red-900/40"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{tab.icon}</span>
                <span className="relative z-10 text-xs font-black uppercase tracking-wider hidden xl:block">
                  {tab.label}
                </span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`
                    relative z-10 ml-2 text-[10px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-black 
                    ${isActive ? 'bg-white text-red-600' : 'bg-red-600 text-white animate-pulse'}
                  `}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Global Active Orders Button (Desktop) */}
        <button 
          onClick={onToggleOrders}
          className="hidden lg:flex items-center justify-center p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-500 hover:border-red-500/50 transition-all relative group"
          title="Pedidos Activos"
        >
          <Icons.History />
          {activeOrdersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-black flex items-center justify-center rounded-full ring-2 ring-black animate-pulse">
              {activeOrdersCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Menu Trigger (Hamburger) */}
      <button 
        onClick={() => setIsSidebarOpen(true)}
        className="lg:hidden p-2 text-white hover:text-red-500 transition-colors ml-4"
        aria-label="Abrir menú"
      >
        <Icons.Menu />
      </button>

      {/* Mobile Sidebar Navigation */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[160] lg:hidden"
            />
            
            {/* Drawer */}
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[280px] sm:w-[320px] bg-black border-l border-red-600/30 z-[170] lg:hidden shadow-2xl flex flex-col p-6 overflow-y-auto overflow-x-hidden custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center space-x-3">
                  <span className="text-red-600">
                    <Icons.ChefHat />
                  </span>
                  <span className="text-lg font-black tracking-tighter uppercase text-white">Menú</span>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 text-slate-400 hover:text-white"
                >
                  <Icons.X />
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4 mb-2">Vistas</div>
                {tabs.map((tab) => {
                  const isActive = activeView === tab.id;
                  return (
                    <React.Fragment key={tab.id}>
                      <button
                        onClick={() => handleTabClick(tab.id as ViewState)}
                        className={`
                          w-full flex items-center space-x-4 p-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest
                          ${isActive ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}
                        `}
                      >
                        <span className="opacity-70">{tab.icon}</span>
                        <span>{tab.label}</span>
                        {tab.badge !== undefined && tab.badge > 0 && (
                          <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                      
                      {isActive && tab.id === 'central' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pl-6 space-y-1 mt-1 mb-2"
                        >
                          {[
                            { id: 'overview', label: 'Dashboard', icon: <Icons.Activity size={14} /> },
                            { id: 'history', label: 'Ventas', icon: <Icons.TrendingUp size={14} /> },
                            { id: 'cash', label: 'Cierres de Caja', icon: <Icons.Lock size={14} /> },
                            { id: 'products', label: 'Productos', icon: <Icons.Package size={14} /> },
                            { id: 'categories', label: 'Categorías', icon: <Icons.Tag size={14} /> },
                            { id: 'tables', label: 'Mesas', icon: <Icons.Layers size={14} /> },
                            { id: 'users', label: 'Usuarios', icon: <Icons.Users size={14} /> },
                            { id: 'roles', label: 'Roles', icon: <Icons.Shield size={14} /> },
                            { id: 'shifts', label: 'Turnos', icon: <Icons.Clock size={14} /> },
                            { id: 'general', label: 'Configuración / Caja', icon: <Icons.Settings size={14} /> }
                          ].map(adminTab => (
                            <button
                              key={adminTab.id}
                              onClick={() => {
                                onAdminViewChange(adminTab.id as AdminTabType);
                                setIsSidebarOpen(false);
                              }}
                              className={`
                                w-full flex items-center space-x-3 p-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest
                                ${adminView === adminTab.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}
                              `}
                            >
                              <span className="opacity-70">{adminTab.icon}</span>
                              <span className="truncate">{adminTab.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="mt-8 pt-8 border-t border-slate-900 space-y-2">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4 mb-2">Seguimiento</div>
                <button
                  onClick={() => {
                    onToggleOrders();
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center space-x-4 p-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-900 hover:text-white"
                >
                  <Icons.History />
                  <span>Pedidos Activos</span>
                  {activeOrdersCount > 0 && (
                    <span className="ml-auto bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px]">
                      {activeOrdersCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-900 space-y-2">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4 mb-2">Usuario Actual</div>
                <div className="w-full flex items-center space-x-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white">
                    <Icons.User size={20} />
                  </div>
                  <div className="flex-grow overflow-hidden">
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-tighter truncate">{currentUser.role}</p>
                    <p className="text-xs font-black text-white uppercase tracking-tight truncate">{currentUser.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    // Use a timeout to ensure the sidebar closes before the confirm dialog pops up 
                    // which can sometimes cause input issues on mobile
                    setTimeout(() => onLogout(), 100);
                  }}
                  className="w-full flex items-center space-x-4 p-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest text-red-500 hover:bg-red-600 hover:text-white mt-2"
                >
                  <Icons.X size={18} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>

              <div className="mt-auto pt-8 border-t border-slate-900 text-center">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">
                  POS - Red & Black Edition
                </p>
                <p className="text-[7px] text-slate-700 font-bold uppercase tracking-widest">
                  Version 2.1.0
                </p>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default TabNavigation;

