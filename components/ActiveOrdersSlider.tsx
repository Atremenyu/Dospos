import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, OrderStatus, PaymentMethod, User, UserRole, StoreSettings } from '../types';
import { Icons } from '../constants';
import { getQuickCashOptions } from '../utils/paymentUtils';
import { printThermalTicketHTML } from '../services/thermalPrinter';
import { generateTicketPDF } from '../services/pdfGenerator';

interface ActiveOrdersSliderProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onDeliver: (id: string) => void;
  onUpdateItemStatus: (orderId: string, itemIdx: number, status: OrderStatus) => void;
  onPay: (id: string, payment: PaymentMethod, tip?: number, amount?: number) => void;
  onCancel: (id: string) => void;
  users: User[];
  roles: UserRole[];
  settings?: StoreSettings;
}

const ActiveOrdersSlider: React.FC<ActiveOrdersSliderProps> = ({
  isOpen, onClose, orders, onDeliver, onUpdateItemStatus, onPay, onCancel, users, roles, settings
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'completed_today'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastPrintedOrderId, setLastPrintedOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [payingMethod, setPayingMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [authorizedBy, setAuthorizedBy] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toDateString(), []);

  const activeOrders = useMemo(() => {
    return orders.filter(o => !(o.isPaid && o.status === 'delivered') && o.status !== 'cancelled').sort((a,b) => {
      if (a.status === 'ready' && b.status !== 'ready') return -1;
      if (a.status !== 'ready' && b.status === 'ready') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [orders]);

  const completedTodayOrders = useMemo(() => {
    return orders.filter(o => {
      const isToday = new Date(o.date).toDateString() === todayStr;
      const isCompletedOrPaid = (o.isPaid && o.status === 'delivered') || o.status === 'delivered' || o.isPaid;
      return isToday && isCompletedOrPaid && o.status !== 'cancelled';
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, todayStr]);

  const filteredCompletedOrders = useMemo(() => {
    if (!searchQuery.trim()) return completedTodayOrders;
    const q = searchQuery.toLowerCase().trim();
    return completedTodayOrders.filter(o => 
      (o.client && o.client.toLowerCase().includes(q)) ||
      (o.orderNumber && o.orderNumber.toString().includes(q)) ||
      (o.id && o.id.toLowerCase().includes(q)) ||
      (o.table && o.table.toLowerCase().includes(q)) ||
      (o.items && o.items.some(i => i.name.toLowerCase().includes(q)))
    );
  }, [completedTodayOrders, searchQuery]);

  const handleClose = () => {
    setPayingOrderId(null);
    setPayingMethod(null);
    setCashReceived('');
    setAuthorizedBy(null);
    setShowPinModal(false);
    setEnteredPin('');
    setPinError(null);
    setSearchQuery('');
    setActiveTab('active');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showPinModal) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          if (enteredPin.length < 4) {
            const next = enteredPin + e.key;
            setEnteredPin(next);
            setPinError(null);
            if (next.length === 4) {
              const foundUser = users.find(u => u.pin === next);
              if (!foundUser) {
                setPinError('PIN Incorrecto');
                return;
              }
              const userRoleObj = roles.find(r => r.name === foundUser.role);
              const canAuth = userRoleObj?.allowCourtesy || foundUser.role === 'Admin';
              if (canAuth) {
                setAuthorizedBy(foundUser.name);
                setPayingMethod('Cortesía');
                setShowPinModal(false);
                setEnteredPin('');
                setPinError(null);
              } else {
                setPinError('No autorizado para cortesías');
              }
            }
          }
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          setEnteredPin(prev => prev.slice(0, -1));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowPinModal(false);
          setEnteredPin('');
          setPinError(null);
          setPayingOrderId(null);
          setPayingMethod(null);
        } else if (e.key.toLowerCase() === 'c' || e.key === 'Delete') {
          e.preventDefault();
          setEnteredPin('');
          setPinError(null);
        }
        return;
      }

      if (payingOrderId && payingMethod && payingMethod !== 'Efectivo') {
        if (e.key === 'Enter') {
          e.preventDefault();
          onPay(payingOrderId, payingMethod);
          setPayingOrderId(null);
          setPayingMethod(null);
          setCashReceived('');
          setAuthorizedBy(null);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setPayingOrderId(null);
          setPayingMethod(null);
          setCashReceived('');
          setAuthorizedBy(null);
        }
        return;
      }

      if (e.key === 'Escape') {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          (activeEl as HTMLElement).blur();
        } else {
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showPinModal, enteredPin, users, roles, payingOrderId, payingMethod, onPay]);

  const handlePrintTicket = (order: Order) => {
    printThermalTicketHTML(order, settings);
    setLastPrintedOrderId(order.id);
    setTimeout(() => {
      setLastPrintedOrderId(null);
    }, 2500);
  };
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed top-16 right-0 bottom-0 left-0 z-[70] flex justify-end overflow-hidden pointer-events-none">
          {/* Transparent backdrop that handles clicks but allows the drawer to be below header visually */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/10 backdrop-blur-[1px] pointer-events-auto"
          />
          
          <motion.div 
            drag="x"
            dragConstraints={{ left: 0, right: 450 }}
            dragElastic={0.05}
            onDragEnd={(_, info) => {
              if (info.offset.x > 80 || info.velocity.x > 400) {
                handleClose();
              }
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="relative w-full md:w-[450px] bg-white shadow-[-20px_0_50px_-10px_rgba(0,0,0,0.2)] h-full pointer-events-auto flex flex-col border-l border-slate-200"
          >
            {/* Drag Handle Indicator */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-slate-200 rounded-full md:flex hidden" />

            <div className="p-6 bg-slate-50 flex justify-between items-center border-b border-slate-200">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-red-600 shadow-lg rotate-3">
                  {activeTab === 'active' ? <Icons.History /> : <Icons.Printer />}
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-black leading-none">
                    {activeTab === 'active' ? 'Pedidos Activos' : 'Pedidos del Día'}
                  </h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">
                    {activeTab === 'active' ? 'Desliza para cerrar' : 'Reimpresión de tickets'}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                {activeTab === 'active' ? (
                  <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse shadow-lg shadow-red-100">
                    {activeOrders.length} EN VIVO
                  </span>
                ) : (
                  <span className="bg-black text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm">
                    {completedTodayOrders.length} HOY
                  </span>
                )}
              </div>
            </div>

            {/* Pestañas sutiles: Activos vs Pedidos Anteriores de Hoy */}
            <div className="px-4 py-2 bg-slate-100/90 border-b border-slate-200 flex space-x-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${
                  activeTab === 'active'
                    ? 'bg-white text-black shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>Pedidos Activos</span>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'active'
                    ? (activeOrders.length > 0 ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700')
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {activeOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('completed_today')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${
                  activeTab === 'completed_today'
                    ? 'bg-white text-black shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icons.Printer size={12} className={activeTab === 'completed_today' ? 'text-red-600' : 'text-slate-400'} />
                <span>Pedidos Anteriores</span>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'completed_today' ? 'bg-black text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {completedTodayOrders.length}
                </span>
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {activeTab === 'active' ? (
                <>
                  {activeOrders.map(order => {
                const isReady = order.status === 'ready';
                const isPreparing = order.status === 'preparing';
                
                return (
                  <motion.div 
                    key={order.id} 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col transition-all duration-500 ${
                      isReady 
                        ? 'border-green-500 ring-4 ring-green-100 shadow-green-100 scale-[1.02] z-10' 
                        : 'border-slate-100'
                    }`}
                  >
                    <div className={`p-4 flex justify-between items-start border-b ${isReady ? 'bg-green-50 border-green-100' : 'border-slate-50'}`}>
                      <div>
                        <div className="flex items-center space-x-2">
                           <span className={`text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full ${
                             isReady ? 'bg-green-600 text-white animate-bounce shadow-md' : (isPreparing ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-200 text-slate-600')
                           }`}>
                             {isReady ? 'LISTO PARA ENTREGAR' : order.status.toUpperCase()}
                           </span>
                           <span className="text-[8px] font-black uppercase text-slate-400">{order.type === 'dine-in' ? `MESA ${order.table}` : 'LLEVAR'}</span>
                           <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                             order.isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                           }`}>
                             {order.isPaid ? 'PAGADO ✓' : 'POR COBRAR'}
                           </span>
                        </div>
                        <p className="font-black text-sm uppercase tracking-tight mt-1">{order.client}</p>
                      </div>
                      <div className="text-right">
                        {isReady && (
                          <div className="text-green-600 mb-1 flex justify-end">
                            <Icons.CheckCircle />
                          </div>
                        )}
                        <p className="font-black text-sm text-slate-900">${order.total.toLocaleString()}</p>
                        <p className="text-[9px] text-slate-400">{new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-2">
                       {order.items.map((item, i) => {
                         const isDelivered = item.status === 'delivered';
                         return (
                           <div 
                             key={`${item.id}-${i}`}
                             onClick={() => onUpdateItemStatus(order.id, i, isDelivered ? 'ready' : 'delivered')}
                             className={`flex flex-col text-[10px] font-bold transition-all cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded-lg ${isDelivered ? 'text-slate-300' : 'text-slate-600'}`}
                           >
                             <div className="flex justify-between items-center">
                               <div className="flex items-center">
                                 <span className={`w-4 h-4 flex items-center justify-center rounded text-[8px] mr-2 transition-colors ${isDelivered ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                   {isDelivered ? <Icons.Check /> : item.quantity}
                                 </span>
                                 <span className={`uppercase ${isDelivered ? 'line-through' : ''}`}>{item.name} {item.isCombo && <span className="text-[8px] font-black bg-red-600 text-white px-1 rounded ml-1">COMBO</span>}</span>
                               </div>
                               <span>${(item.price * item.quantity).toLocaleString()}</span>
                             </div>
                             {item.note && (
                               <span className="mt-1 ml-6 text-[9px] italic font-bold text-red-600">
                                 &gt; {item.note}
                               </span>
                             )}
                             {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                               <div className="mt-1 ml-6 flex flex-wrap gap-1">
                                 {item.selectedModifiers.map((mod, midx) => {
                                   const isRemoval = (mod.modifierName || "").toLowerCase().includes('sin') || 
                                                     (mod.modifierName || "").toLowerCase().includes('quitar') || 
                                                     (mod.modifierName || "").toLowerCase().includes('remover') || 
                                                     (mod.modifierName || "").toLowerCase().includes('no ') || 
                                                     (mod.extraPrice || 0) <= 0;
                                   return (
                                     <span key={`${mod.modifierId || mod.modifierName}-${midx}`} className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-tighter border ${
                                       isRemoval ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                                     }`}>
                                       {isRemoval ? '' : '+ '}{mod.modifierName || "Extra"}
                                     </span>
                                   );
                                 })}
                               </div>
                             )}
                             {item.isCombo && item.selectedComboOptions && item.selectedComboOptions.map((opt, oidx) => (
                               <div key={`combo-${opt.id || opt.label}-${oidx}`} className="flex justify-between items-center text-[9px] font-bold text-red-700 ml-8 p-1 -mx-1">
                                 <span>+ {opt.label}</span>
                                 <span>+${opt.extraPrice.toLocaleString()}</span>
                               </div>
                             ))}
                           </div>
                         );
                       })}
                    </div>

                     {/* Pago al entregar - Solo para órdenes no pagadas */}
                     {!order.isPaid && (
                       <div className="px-4 pb-4 pt-3 bg-amber-50 border-t border-amber-100 space-y-3">
                         <div className="flex justify-between items-center">
                           <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 flex items-center">
                             <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
                             Pago al Entregar (Caja)
                           </span>
                           <span className="text-[11px] font-black text-amber-950 font-mono">
                             Pendiente: ${order.total.toLocaleString()}
                           </span>
                         </div>
                                                   {payingOrderId === order.id && payingMethod ? (
                            <div className="bg-white p-3 rounded-2xl border border-amber-200/60 space-y-3 shadow-sm col-span-3 w-full animate-in fade-in zoom-in-95 duration-150">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                <span className="text-[10px] font-black uppercase text-slate-800 flex items-center">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
                                  Cobro con {payingMethod.toUpperCase()}
                                </span>
                                <button 
                                  onClick={() => {
                                    setPayingOrderId(null);
                                    setPayingMethod(null);
                                    setCashReceived('');
                                  }}
                                  className="text-red-500 hover:text-red-700 text-[10px] font-bold uppercase tracking-wider"
                                >
                                  Cancelar
                                </button>
                              </div>

                              {payingMethod === 'Efectivo' ? (
                                <div className="space-y-2">
                                  <label className="block text-[9px] font-black uppercase text-slate-400">
                                    Monto Recibido
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                                    <input 
                                      type="number"
                                      value={cashReceived}
                                      onChange={(e) => setCashReceived(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const rec = parseFloat(cashReceived) || 0;
                                          if (rec >= order.total) {
                                            onPay(order.id, 'Efectivo');
                                            setPayingOrderId(null);
                                            setPayingMethod(null);
                                            setCashReceived('');
                                          }
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault();
                                          setPayingOrderId(null);
                                          setPayingMethod(null);
                                          setCashReceived('');
                                        }
                                      }}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-7 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 font-mono"
                                      placeholder="0"
                                      autoFocus
                                    />
                                  </div>
                                  
                                  {/* Quick cash shortcuts */}
                                  <div className="flex flex-wrap gap-1">
                                    {getQuickCashOptions(order.total)

                                      .map(val => (
                                        <button
                                          key={val}
                                          type="button"
                                          onClick={() => setCashReceived(val.toString())}
                                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[9px] font-bold text-slate-600 font-mono"
                                        >
                                          ${val.toLocaleString()}
                                        </button>
                                      ))
                                    }
                                  </div>

                                  {/* Change logic */}
                                  {(() => {
                                    const rec = parseFloat(cashReceived) || 0;
                                    const change = rec - order.total;
                                    if (rec >= order.total) {
                                      return (
                                        <div className="bg-green-50 border border-green-100 p-2 rounded-xl flex justify-between items-center text-green-800">
                                          <span className="text-[9px] font-black uppercase">Cambio:</span>
                                          <span className="text-xs font-black font-mono">${change.toLocaleString()}</span>
                                        </div>
                                      );
                                    } else if (rec > 0) {
                                      return (
                                        <div className="bg-red-50 border border-red-100 p-2 rounded-xl flex justify-between items-center text-red-800">
                                          <span className="text-[9px] font-black uppercase">Faltan:</span>
                                          <span className="text-xs font-black font-mono">${(order.total - rec).toLocaleString()}</span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}

                                  <button
                                    onClick={() => {
                                      const rec = parseFloat(cashReceived) || 0;
                                      if (rec < order.total) return;
                                      onPay(order.id, 'Efectivo');
                                      setPayingOrderId(null);
                                      setPayingMethod(null);
                                      setCashReceived('');
                                    }}
                                    disabled={(parseFloat(cashReceived) || 0) < order.total}
                                    className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center space-x-1"
                                  >
                                    <Icons.CheckCircle size={12} />
                                    <span>Confirmar Pago Recibido</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-[10px] font-bold text-slate-600">
                                    ¿Confirmar el cobro total de <span className="font-mono text-slate-900">${order.total.toLocaleString()}</span> usando <span className="font-black text-black uppercase">{payingMethod}</span>?
                                  </p>
                                  {payingMethod === 'Cortesía' && authorizedBy && (
                                    <div className="bg-green-50 border border-green-100 p-2 rounded-xl flex items-center justify-between text-green-800 text-[10px] font-bold">
                                      <span>AUTORIZADO POR:</span>
                                      <span className="font-black">{authorizedBy.toUpperCase()}</span>
                                    </div>
                                  )}
                                  <button
                                    onClick={() => {
                                      onPay(order.id, payingMethod);
                                      setPayingOrderId(null);
                                      setPayingMethod(null);
                                      setCashReceived('');
                                      setAuthorizedBy(null);
                                    }}
                                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center space-x-1"
                                  >
                                    <Icons.CheckCircle size={12} />
                                    <span>Sí, Confirmar</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" style={{ display: payingOrderId === order.id && payingMethod ? 'none' : 'grid' }}>
                            {(['Efectivo', 'Tarjeta', 'Transferencia', 'Cortesía'] as PaymentMethod[]).map(method => (
                              <button
                                key={method}
                                onClick={() => {
                                  setPayingOrderId(order.id);
                                  if (method === 'Cortesía') {
                                    if (!authorizedBy) {
                                      setShowPinModal(true);
                                    } else {
                                      setPayingMethod(method);
                                    }
                                  } else {
                                    setPayingMethod(method);
                                    if (method === 'Efectivo') {
                                      setCashReceived('');
                                    }
                                    setAuthorizedBy(null);
                                  }
                                }}
                                className="py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all bg-white hover:bg-amber-100/50 border border-amber-200 text-amber-900 shadow-sm active:scale-95 flex items-center justify-center space-x-1"
                              >
                                {method === 'Efectivo' && <Icons.DollarSign size={10} />}
                                {method === 'Tarjeta' && <Icons.CreditCard size={10} />}
                                {method === 'Transferencia' && <Icons.History size={10} />}
                                {method === 'Cortesía' && <Icons.Gift size={10} />}
                                <span>{method}</span>
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-3 gap-1.5" style={{ display: 'none' }}>
                           {false && (['Efectivo', 'Tarjeta', 'Transferencia'] as PaymentMethod[]).map(method => (
                             <button
                               key={method}
                               onClick={() => {
                                 if (method === 'Efectivo') {
                                   const receivedStr = prompt(`Registrar Pago en Efectivo\nTotal: $${order.total.toLocaleString()}\n¿Con cuánto paga el cliente?`, order.total.toString());
                                   if (receivedStr !== null) {
                                     const received = parseFloat(receivedStr);
                                     if (isNaN(received) || received < order.total) {
                                       alert(`Monto insuficiente. Se requiere al menos $${order.total.toLocaleString()}`);
                                       return;
                                     }
                                     const change = received - order.total;
                                     if (change > 0) {
                                       alert(`Cambio para el cliente: $${change.toLocaleString()}`);
                                     }
                                     onPay(order.id, 'Efectivo');
                                   }
                                 } else {
                                   if (confirm(`¿Registrar pago de $${order.total.toLocaleString()} con ${method}?`)) {
                                     onPay(order.id, method);
                                   }
                                 }
                               }}
                               className="py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all bg-white hover:bg-amber-100/50 border border-amber-200 text-amber-900 shadow-sm active:scale-95 flex items-center justify-center space-x-1"
                             >
                               {method === 'Efectivo' && <Icons.DollarSign size={10} />}
                               {method === 'Tarjeta' && <Icons.CreditCard size={10} />}
                               {method === 'Transferencia' && <Icons.History size={10} />}
                               <span>{method}</span>
                             </button>
                           ))}
                         </div>
                       </div>
                     )}

                    <div className="p-4 bg-slate-50 flex gap-2">
                       <button 
                        onClick={() => { onDeliver(order.id); }}
                        className={`flex-grow py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                          isReady 
                          ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg scale-105 active:scale-95' 
                          : 'bg-black text-white hover:bg-slate-800'
                        }`}
                       >
                         {isReady ? 'MARCAR ENTREGADO ✓' : 'MARCAR ENTREGADO'}
                       </button>
                       {false && order.type !== 'dine-in' && (
                         <button 
                          onClick={() => { 
                            const m = prompt('Método de pago (Efectivo, Tarjeta, Transferencia):', 'Efectivo'); 
                            if(m && ['Efectivo', 'Tarjeta', 'Transferencia'].includes(m)) onPay(order.id, m as any); 
                          }}
                          className="bg-white border-2 border-slate-200 px-4 py-3 rounded-xl hover:bg-slate-100 transition shadow-sm text-slate-400"
                         >
                            <Icons.CreditCard />
                         </button>
                       )}
                       <button 
                          onClick={() => { if(confirm('¿Anular pedido?')) onCancel(order.id); }}
                          className="text-slate-300 hover:text-red-500 transition px-2"
                        >
                          <Icons.Trash />
                        </button>
                    </div>
                  </motion.div>
                );
              })}
              {activeOrders.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 opacity-60">
                  <Icons.History />
                  <p className="text-[10px] font-black uppercase tracking-widest mt-4">Sin pedidos activos</p>
                </div>
              )}
            </>
          ) : (
            /* Vista de Pedidos Anteriores de Hoy para Reimpresión */
            <div className="space-y-3">
              {/* Buscador de pedidos anteriores */}
              {completedTodayOrders.length > 2 && (
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icons.Search size={14} />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar cliente, comanda # o mesa..."
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-red-600 shadow-xs"
                  />
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold w-5 h-5 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {filteredCompletedOrders.map(order => {
                const isPrinted = lastPrintedOrderId === order.id;
                const isExpanded = expandedOrderId === order.id;
                const totalItems = order.items.reduce((s, i) => s + (i.quantity || 1), 0);

                return (
                  <motion.div 
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3 hover:border-slate-300 transition"
                  >
                    {/* Cabecera del pedido completado */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="text-[10px] font-black bg-black text-white px-2 py-0.5 rounded font-mono">
                            {order.orderNumber ? `#${order.orderNumber}` : `#${order.id.slice(-4)}`}
                          </span>
                          <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {order.type === 'dine-in' ? `MESA ${order.table}` : (order.takeawayType === 'delivery' ? 'DOMICILIO' : 'LLEVAR')}
                          </span>
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                            PAGADO ✓
                          </span>
                        </div>
                        <h4 className="font-black text-sm uppercase text-slate-900 mt-1.5 tracking-tight">
                          {order.client || 'Cliente General'}
                        </h4>
                      </div>

                      <div className="text-right">
                        <p className="font-black text-base text-slate-900 tracking-tight font-mono">
                          ${order.total.toLocaleString()}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400">
                          {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Fila de pago y desglose */}
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <span className="flex items-center space-x-1.5">
                        <span className="text-slate-400 font-medium">Pago:</span>
                        <span className="font-black text-slate-800 uppercase">{order.payment || 'Efectivo'}</span>
                        {order.tip && order.tip > 0 ? (
                          <span className="text-blue-600 font-bold ml-1">(Prop: ${order.tip})</span>
                        ) : null}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="text-[9px] font-black text-red-600 hover:underline uppercase flex items-center space-x-1"
                      >
                        <span>{totalItems} {totalItems === 1 ? 'producto' : 'productos'}</span>
                        <span className="text-[8px]">{isExpanded ? '▲' : '▼'}</span>
                      </button>
                    </div>

                    {/* Detalle de productos desplegable */}
                    {isExpanded && (
                      <div className="space-y-1.5 pt-2 pb-1 border-t border-slate-100 text-[10px] text-slate-600">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-50 last:border-0">
                            <span>
                              <strong className="text-slate-900 mr-1.5">{item.quantity}x</strong>
                              {item.name}
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              ${(item.price * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {(order.discountAmount || 0) > 0 ? (
                          <div className="flex justify-between items-center text-emerald-600 font-bold pt-1">
                            <span>Descuento ({order.discountReason || 'Promo'})</span>
                            <span>-${(order.discountAmount || 0).toLocaleString()}</span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Botones de acción: Reimprimir Ticket Térmico / Descargar PDF */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintTicket(order)}
                        className={`flex-1 py-2.5 px-3 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-xs ${
                          isPrinted 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-black hover:bg-red-600 text-white active:scale-98'
                        }`}
                      >
                        {isPrinted ? (
                          <>
                            <Icons.Check size={13} />
                            <span>✓ Ticket Enviado</span>
                          </>
                        ) : (
                          <>
                            <Icons.Printer size={13} />
                            <span>Reimprimir Ticket</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => generateTicketPDF(order, settings || 'DOS POS')}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center justify-center"
                        title="Descargar Ticket en PDF"
                      >
                        <Icons.FileText size={15} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}

              {filteredCompletedOrders.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <Icons.Printer size={20} />
                  </div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-600">
                    {searchQuery ? 'No se encontraron pedidos' : 'Sin pedidos anteriores hoy'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 text-center max-w-[240px] mt-1">
                    {searchQuery 
                      ? 'Intenta buscar con otro nombre o comanda.' 
                      : 'Los pedidos pagados y completados de la jornada aparecerán aquí para reimpresión.'}
                  </p>
                </div>
              )}
            </div>
          )}
            </div>
          </motion.div>
        </div>
      )}
      {showPinModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-300 pointer-events-auto">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl border-2 border-red-600 overflow-hidden p-6 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <Icons.Lock size={24} />
              </div>
              <h3 className="text-xl font-black text-black uppercase tracking-tight">Autorizar Cortesía</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ingrese PIN de Administrador o Rol Autorizado</p>
            </div>

            {/* Input Display */}
            <div className="space-y-2">
              <div className="flex justify-center space-x-3">
                {[0, 1, 2, 3].map((idx) => {
                  const hasChar = enteredPin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all ${
                        hasChar ? 'border-red-600 bg-red-50 text-red-600 shadow-sm' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      {hasChar ? '●' : ''}
                    </div>
                  );
                })}
              </div>
              {pinError && (
                <p className="text-center text-red-600 text-[10px] font-black uppercase tracking-widest animate-pulse">{pinError}</p>
              )}
            </div>

            {/* Tactile Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    if (enteredPin.length < 4) {
                      const next = enteredPin + num;
                      setEnteredPin(next);
                      setPinError(null);
                      if (next.length === 4) {
                        const foundUser = users.find(u => u.pin === next);
                        if (!foundUser) {
                          setPinError('PIN Incorrecto');
                          return;
                        }
                        const userRoleObj = roles.find(r => r.name === foundUser.role);
                        const canAuth = userRoleObj?.allowCourtesy || foundUser.role === 'Admin';
                        if (canAuth) {
                          setAuthorizedBy(foundUser.name);
                          setPayingMethod('Cortesía');
                          setShowPinModal(false);
                          setEnteredPin('');
                          setPinError(null);
                        } else {
                          setPinError('No autorizado para cortesías');
                        }
                      }
                    }
                  }}
                  className="w-16 h-16 rounded-2xl bg-slate-50 hover:bg-slate-100 font-black text-lg text-slate-800 transition-all active:scale-95 shadow-sm border border-slate-100"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setEnteredPin('');
                  setPinError(null);
                }}
                className="w-16 h-16 rounded-2xl bg-red-50 hover:bg-red-100 font-black text-xs text-red-600 transition-all active:scale-95 border border-red-100 uppercase"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => {
                  if (enteredPin.length < 4) {
                    const next = enteredPin + '0';
                    setEnteredPin(next);
                    setPinError(null);
                    if (next.length === 4) {
                      const foundUser = users.find(u => u.pin === next);
                      if (!foundUser) {
                        setPinError('PIN Incorrecto');
                        return;
                      }
                      const userRoleObj = roles.find(r => r.name === foundUser.role);
                      const canAuth = userRoleObj?.allowCourtesy || foundUser.role === 'Admin';
                      if (canAuth) {
                        setAuthorizedBy(foundUser.name);
                        setPayingMethod('Cortesía');
                        setShowPinModal(false);
                        setEnteredPin('');
                        setPinError(null);
                      } else {
                        setPinError('No autorizado para cortesías');
                      }
                    }
                  }
                }}
                className="w-16 h-16 rounded-2xl bg-slate-50 hover:bg-slate-100 font-black text-lg text-slate-800 transition-all active:scale-95 shadow-sm border border-slate-100"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  setEnteredPin('');
                  setPinError(null);
                  setPayingOrderId(null);
                  setPayingMethod(null);
                }}
                className="w-16 h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black text-[10px] text-slate-500 transition-all active:scale-95 uppercase"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ActiveOrdersSlider;
