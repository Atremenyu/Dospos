
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, PaymentMethod, Table } from '../types';
import { Icons } from '../constants';
import { generateTicketPDF } from '../services/pdfGenerator';
import { printThermalTicketHTML } from '../services/thermalPrinter';
import ConfirmationModal from './ConfirmationModal';

interface DispatchViewProps {
  orders: Order[];
  tables: Table[];
  onDeliver: (id: string) => void;
  onPay: (id: string, payment: PaymentMethod, tip?: number, amount?: number) => void;
  onCancel: (id: string) => void;
  onTransfer: (id: string, newTable: string) => void;
  onStartPreparing: (id: string, mins: number) => void;
  onMarkReady: (id: string) => void;
  onUpdateTime: (id: string, mins: number) => void;
  onUpdateItemStatus: (orderId: string, itemIdx: number, status: any) => void;
  restaurantName?: string;
}

const DispatchView: React.FC<DispatchViewProps> = ({ 
  orders, tables, onDeliver, onPay, onCancel, onTransfer, onStartPreparing, onMarkReady, onUpdateTime, onUpdateItemStatus, restaurantName 
}) => {
  const [selectedPayment, setSelectedPayment] = useState<Record<string, PaymentMethod>>({});
  const [cashReceived, setCashReceived] = useState<Record<string, string>>({});
  const [tipAmounts, setTipAmounts] = useState<Record<string, string>>({});
  const [transferingId, setTransferingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Confirmation state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ isOpen: true, title, message, onConfirm });
  };

  // Reactive timer update
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const groupedOrders = useMemo(() => {
    return {
      pending: orders.filter(o => o.status === 'pending'),
      preparing: orders.filter(o => o.status === 'preparing'),
      ready: orders.filter(o => o.status === 'ready')
    };
  }, [orders]);

  const getTimerData = (order: Order) => {
    if (!order.preparingAt || !order.estimatedMinutes) return null;
    const start = new Date(order.preparingAt).getTime();
    const now = currentTime.getTime();
    const elapsedSeconds = (now - start) / 1000;
    const totalSeconds = order.estimatedMinutes * 60;
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    
    // Color logic
    const percentageRemaining = (remainingSeconds / totalSeconds) * 100;
    let colorClass = 'text-green-600';
    let bgClass = 'bg-green-100';
    let dotClass = 'bg-green-500';
    
    if (percentageRemaining <= 0) {
      colorClass = 'text-white animate-pulse';
      bgClass = 'bg-red-600';
      dotClass = 'bg-white';
    } else if (percentageRemaining <= 25) {
      colorClass = 'text-red-600';
      bgClass = 'bg-red-50';
      dotClass = 'bg-red-500';
    } else if (percentageRemaining <= 50) {
      colorClass = 'text-amber-600';
      bgClass = 'bg-amber-100';
      dotClass = 'bg-amber-500';
    }

    const mins = Math.floor(remainingSeconds / 60);
    const secs = Math.floor(remainingSeconds % 60);

    return { 
      text: percentageRemaining <= 0 ? `ATRASADO ${mins}:${secs.toString().padStart(2, '0')}` : `${mins}:${secs.toString().padStart(2, '0')}`,
      colorClass,
      bgClass,
      dotClass
    };
  };

  const renderOrderCard = (order: Order) => {
    const isPending = order.status === 'pending';
    const isPreparing = order.status === 'preparing';
    const isReady = order.status === 'ready';
    const isDineIn = order.type === 'dine-in';
    const timerData = getTimerData(order);
    
    return (
      <div 
        key={order.id} 
        className={`bg-white rounded-[2rem] border shadow-xl overflow-hidden flex flex-col transition-all duration-300 relative ${
          isPreparing 
            ? 'border-amber-400 ring-4 ring-amber-50' 
            : isPending 
              ? 'border-slate-100' 
              : isReady
                ? 'border-green-500 transform scale-[1.02]'
                : 'border-slate-100'
        }`}
      >
        <div className={`p-5 flex justify-between items-start ${
          isPreparing ? 'bg-amber-50/30' : isReady ? 'bg-green-50/30' : 'bg-white'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className={`text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full shadow-sm ${
                isPending 
                  ? 'bg-slate-200 text-slate-600' 
                  : isPreparing 
                    ? 'bg-amber-500 text-white' 
                    : isReady 
                      ? 'bg-green-600 text-white'
                      : 'bg-black text-white'
              }`}>
                {isPending ? 'EN COLA' : isPreparing ? 'PREPARANDO' : isReady ? 'LISTO' : 'DESPACHADO'}
              </span>
              {isPreparing && timerData && (
                 <div className="flex items-center space-x-1.5">
                   <div className={`flex items-center px-2 py-0.5 rounded-full shadow-sm transition-colors ${timerData.bgClass} ${timerData.colorClass}`}>
                     <div className={`w-1 h-1 rounded-full mr-1 ${timerData.dotClass} ${timerData.colorClass === 'text-white' ? 'animate-ping' : ''}`}></div>
                     <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                       {timerData.text}
                     </span>
                   </div>
                   <button 
                     onClick={() => {
                       const extra = prompt('Ajustar minutos (ej: -5 para restar, 5 para sumar):', '5');
                       if (extra) {
                         const current = order.estimatedMinutes || 0;
                         onUpdateTime(order.id, current + parseInt(extra));
                       }
                     }}
                     className="w-4 h-4 flex items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-black hover:text-white transition-all shadow-sm"
                   >
                     <Icons.History />
                   </button>
                 </div>
              )}
            </div>
            <h3 className="text-lg font-black text-black tracking-tighter uppercase leading-none pt-1">
              {isDineIn ? `Mesa ${order.table}` : `${order.takeawayType?.toUpperCase() || 'MOSTRADOR'}`}
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {order.client} • {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            {order.address && (
              <div className="flex items-center space-x-1 mt-1 text-[9px] font-bold text-red-600 uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded-md w-max">
                <Icons.MapPin size={10} className="shrink-0" />
                <span className="truncate max-w-[150px]">{order.address}</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col space-y-2 items-end">
            <div className="flex space-x-1.5">
              <button 
                onClick={() => printThermalTicketHTML(order, restaurantName)}
                title="Imprimir Ticket Térmico"
                className="p-1 bg-slate-900 text-white rounded-lg hover:bg-black transition shadow-sm"
              >
                <Icons.Printer size={16} />
              </button>
              <button 
                onClick={() => generateTicketPDF(order, restaurantName)}
                title="Descargar PDF"
                className="p-1 bg-white text-slate-400 border border-slate-100 rounded-lg hover:text-red-600 hover:border-red-600 transition shadow-sm"
              >
                <Icons.FileText size={16} />
              </button>
            </div>
            <button 
              onClick={() => {
                triggerConfirm(
                  'Anular Orden',
                  `¿Estás seguro de anular la orden de ${order.client}? Esta acción eliminará el pedido de la cocina.`,
                  () => onCancel(order.id)
                );
              }}
              className="text-[8px] font-black text-slate-300 hover:text-red-500 uppercase tracking-widest transition"
            >
              Anular
            </button>
          </div>
        </div>

        <div className="px-5 py-4 flex-grow space-y-3">
          {order.items.map((item, idx) => {
            const itemIsDelivered = item.status === 'delivered';
            const status = item.status || 'pending';
            const isExtra = status === 'pending' && (order.status === 'preparing' || order.status === 'ready');

            return (
              <React.Fragment key={idx}>
                <div 
                  className={`flex items-start space-x-3 transition-all p-2 -mx-1 rounded-xl group/item ${
                    itemIsDelivered 
                      ? 'opacity-40 grayscale-[0.5]' 
                      : isExtra
                        ? 'bg-rose-50/70 border border-rose-100 shadow-sm'
                        : 'hover:bg-slate-50'
                  }`}
                >
                <span className={`w-6 h-6 flex-shrink-0 flex items-center justify-center font-black rounded-lg text-[10px] transition-colors ${
                  itemIsDelivered ? 'bg-slate-200 text-slate-400' : (status === 'preparing' ? 'bg-amber-500 text-white' : status === 'ready' ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-500')
                }`}>
                  {itemIsDelivered ? <Icons.Check /> : item.quantity}
                </span>
                <div className="flex-grow pt-0.5">
                  <div className="flex items-center justify-between">
                    <span className={`font-black uppercase text-xs tracking-tight block ${
                      itemIsDelivered ? 'text-slate-400 line-through' : (status === 'preparing' ? 'text-black font-extrabold' : 'text-slate-600')
                    }`}>
                      {item.name}
                    </span>
                    
                    <div className="flex items-center space-x-1.5">
                      {item.paidQuantity && item.paidQuantity > 0 && (
                        <span className="text-[8px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-1.5 py-0.5 rounded">
                          Pagado {item.paidQuantity}/{item.quantity}
                        </span>
                      )}

                      {/* Interactive Item Status Toggle */}
                      {(() => {
                        if (status === 'pending') {
                          return (
                            <button
                              onClick={() => onUpdateItemStatus(order.id, idx, 'preparing')}
                              className={`text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-tighter border transition-all duration-200 cursor-pointer ${
                                isExtra 
                                  ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse shadow-sm shadow-rose-200' 
                                  : 'bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-500 border-slate-200 hover:border-amber-600'
                              }`}
                              title={isExtra ? "Producto Extra - Haz clic para comenzar a preparar" : "Haz clic para comenzar a preparar"}
                            >
                              {isExtra ? "🚨 NUEVO / COLA" : "🍳 COMENZAR"}
                            </button>
                          );
                        }
                        if (status === 'preparing') {
                          return (
                            <button
                              onClick={() => onUpdateItemStatus(order.id, idx, 'ready')}
                              className="text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-tighter bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 transition-all duration-200 cursor-pointer shadow-sm shadow-amber-100"
                              title="Preparando - Haz clic para marcar como Listo"
                            >
                              🔥 LISTO
                            </button>
                          );
                        }
                        if (status === 'ready') {
                          return (
                            <button
                              onClick={() => onUpdateItemStatus(order.id, idx, 'delivered')}
                              className="text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-tighter bg-green-600 hover:bg-green-700 text-white border border-green-700 transition-all duration-200 cursor-pointer shadow-sm shadow-green-100"
                              title="Listo - Haz clic para marcar como Entregado"
                            >
                              ✅ ENTREGAR
                            </button>
                          );
                        }
                        return (
                          <span className="text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-tighter bg-slate-100 text-slate-400 border border-slate-200 select-none">
                            📦 ENTREGADO
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* Modifiers display */}
                  {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.selectedModifiers.map((mod, midx) => {
                        const isRemoval = mod.modifierName.toLowerCase().includes('sin') || 
                                          mod.modifierName.toLowerCase().includes('quitar') || 
                                          mod.modifierName.toLowerCase().includes('remover') || 
                                          mod.modifierName.toLowerCase().includes('no ') || 
                                          mod.extraPrice <= 0;
                        return (
                          <span key={midx} className={`text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-tighter border ${
                            isRemoval 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : (isPreparing ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200')
                          }`}>
                            {isRemoval ? '' : '+ '}{mod.modifierName}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {item.note && (
                    <div className={`mt-2 p-2 rounded-xl border-l-4 ${
                      itemIsDelivered 
                        ? 'bg-slate-50 border-slate-200 text-slate-400' 
                        : (isPreparing 
                            ? 'text-red-700 bg-red-50 border-red-500 shadow-sm animate-pulse' 
                            : 'text-slate-600 bg-slate-50 border-slate-300')
                    }`}>
                      <p className="text-[9px] font-black leading-tight uppercase tracking-tight">
                        📢 {item.note}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Simulated extra product row for Combo */}
              {item.isCombo && (
                <div className={`flex flex-col space-y-1 ml-9 mt-1 mb-2 ${itemIsDelivered ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                  {item.selectedComboOptions?.map((opt, oidx) => (
                    <div key={`combo-${oidx}`} className="flex items-start space-x-3 transition-all p-1 -mx-1 rounded-xl">
                      <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center font-black rounded-md text-[8px] transition-colors ${
                        itemIsDelivered ? 'bg-slate-200 text-slate-400' : (isPreparing ? 'bg-red-500 text-white' : 'bg-red-100 text-red-500')
                      }`}>
                        {itemIsDelivered ? <Icons.Check /> : '+'}
                      </span>
                      <div className="flex-grow flex items-center pt-0.5">
                        <span className={`font-black uppercase text-xs tracking-tight block ${
                          itemIsDelivered ? 'text-slate-400 line-through' : (isPreparing ? 'text-red-700' : 'text-red-600')
                        }`}>
                          (COMBO) {opt.label}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!item.selectedComboOptions || item.selectedComboOptions.length === 0) && (
                    <div className="flex items-start space-x-3 transition-all p-1 -mx-1 rounded-xl">
                      <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center font-black rounded-md text-[8px] transition-colors ${
                        itemIsDelivered ? 'bg-slate-200 text-slate-400' : (isPreparing ? 'bg-red-500 text-white' : 'bg-red-100 text-red-500')
                      }`}>
                        {itemIsDelivered ? <Icons.Check /> : '+'}
                      </span>
                      <div className="flex-grow flex items-center pt-0.5">
                        <span className={`font-black uppercase text-xs tracking-tight block ${
                          itemIsDelivered ? 'text-slate-400 line-through' : (isPreparing ? 'text-red-700' : 'text-red-600')
                        }`}>
                          COMBO
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

        <div className="p-5 pt-0">
          {isPending && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-1">
                {[10, 15, 20, 25].map(mins => (
                  <button 
                    key={mins}
                    onClick={() => onStartPreparing(order.id, mins)}
                    className="py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs font-black hover:bg-red-600 hover:text-white transition-all shadow-sm"
                  >
                    {mins}'
                  </button>
                ))}
              </div>
              <button 
                onClick={() => onStartPreparing(order.id, 15)}
                className="w-full bg-black text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition active:scale-95 space-x-2 flex items-center justify-center border-b-4 border-slate-700"
              >
                <Icons.ChefHat />
                <span>COMENZAR</span>
              </button>
            </div>
          )}

          {isPreparing && (
            <button 
              onClick={() => onMarkReady(order.id)}
              className="w-full bg-amber-500 text-white py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-amber-600 transition-all active:scale-95 flex items-center justify-center space-x-3 border-b-4 border-amber-700 animate-pulse"
            >
              <Icons.CheckCircle />
              <span>MARCAR LISTO</span>
            </button>
          )}

          {isReady && (
            <button 
              onClick={() => onDeliver(order.id)}
              className="w-full bg-green-600 text-white py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-green-700 transition-all active:scale-95 flex items-center justify-center space-x-3 border-b-4 border-green-800"
            >
              <Icons.MapPin />
              <span>ENTREGAR</span>
            </button>
          )}

          {/* No payment controls in kitchen comanda */}
          {false && !isDineIn && !order.isPaid && (
             <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {order.payments && order.payments.length > 0 ? 'Resta:' : 'Total:'}
                  </span>
                  <span className="text-lg font-black text-black tracking-tighter">
                    ${(order.total - (order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                   {(['Efectivo', 'Tarjeta', 'Transferencia'] as PaymentMethod[]).map(met => {
                     const isSelected = selectedPayment[order.id] === met;
                     const isCash = met === 'Efectivo';
                     const amountToPay = order.total - (order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0);
                     const tip = parseFloat(tipAmounts[order.id]) || 0;
                     const required = amountToPay + tip;

                     return (
                       <div key={met} className={isSelected && isCash ? 'col-span-3' : ''}>
                         <button 
                          onClick={() => {
                            setSelectedPayment(prev => ({ ...prev, [order.id]: met }));
                            setCashReceived(prev => ({ ...prev, [order.id]: '' }));
                          }}
                          className={`w-full py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                            isSelected 
                            ? 'border-red-600 bg-red-600 text-white shadow-md' 
                            : 'border-slate-100 bg-slate-50 text-slate-500'
                          }`}
                         >
                           {met}
                         </button>

                         {isSelected && isCash && (
                           <motion.div 
                             initial={{ opacity: 0, height: 0 }}
                             animate={{ opacity: 1, height: 'auto' }}
                             className="mt-2 p-2.5 bg-red-50 border border-red-100 rounded-xl space-y-2.5 overflow-hidden"
                           >
                             <div className="flex justify-between items-end">
                               <div className="space-y-0.5">
                                 <p className="text-[7px] font-black uppercase tracking-widest text-red-600">Recibido</p>
                                 <div className="relative">
                                   <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs font-black text-red-300">$</span>
                                   <input 
                                     type="text"
                                     inputMode="decimal"
                                     className="w-full bg-transparent border-none outline-none pl-4 text-sm font-black tracking-tighter text-black placeholder:text-red-100"
                                     placeholder="0.00"
                                     autoFocus
                                     value={cashReceived[order.id] || ''}
                                     onChange={(e) => {
                                       const val = e.target.value.replace(/,/g, '.');
                                       if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                         setCashReceived(prev => ({ ...prev, [order.id]: val }));
                                       }
                                     }}
                                   />
                                 </div>
                               </div>
                               {cashReceived[order.id] && parseFloat(cashReceived[order.id]) > 0 && (
                                 <div className="text-right">
                                   <p className="text-[7px] font-black uppercase tracking-widest text-green-600">Cambio</p>
                                   <p className="text-sm font-black text-green-600 tracking-tighter">
                                     ${Math.max(0, parseFloat(cashReceived[order.id]) - required).toLocaleString()}
                                   </p>
                                 </div>
                               )}
                             </div>
                             
                             <div className="flex flex-wrap gap-1 pt-1.5 border-t border-red-100">
                               {[500, 1000, 2000, 5000].map(amount => (
                                 <button 
                                   key={amount}
                                   onClick={() => setCashReceived(prev => ({ ...prev, [order.id]: amount.toString() }))}
                                   className="px-2 py-1 bg-white hover:bg-black hover:text-white rounded-md text-[7px] font-black transition-all border border-red-100 uppercase"
                                 >
                                   ${amount.toLocaleString()}
                                 </button>
                               ))}
                             </div>
                           </motion.div>
                         )}
                       </div>
                     );
                   })}
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Propina (Opcional)</label>
                  <div className="flex items-center space-x-1.5">
                    <div className="relative flex-grow">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">$</span>
                      <input 
                        type="number"
                        value={tipAmounts[order.id] || ''}
                        onChange={e => setTipAmounts(prev => ({ ...prev, [order.id]: e.target.value }))}
                        className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-[10px]"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-0.5">
                      {[0.10, 0.15, 0.20].map(pct => {
                        const amountToPay = order.total - (order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0);
                        return (
                          <button
                            key={pct}
                            onClick={() => setTipAmounts(prev => ({ ...prev, [order.id]: (amountToPay * pct).toFixed(2) }))}
                            className="px-2 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-[8px] font-black"
                          >
                            {pct * 100}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Summary Total for Billing */}
                <div className="p-4 bg-black text-white rounded-xl space-y-2 mb-2">
                   <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <span className="text-[7px] font-black uppercase tracking-widest opacity-60">Subtotal</span>
                      <span className="text-[10px] font-black">${(order.total - (order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)).toLocaleString()}</span>
                   </div>
                   {parseFloat(tipAmounts[order.id]) > 0 && (
                     <div className="flex justify-between items-center border-b border-white/10 pb-2 text-red-400">
                        <span className="text-[7px] font-black uppercase tracking-widest">Propina</span>
                        <span className="text-[10px] font-black">+ ${parseFloat(tipAmounts[order.id]).toLocaleString()}</span>
                     </div>
                   )}
                   <div className="flex justify-between items-center pt-1">
                      <span className="text-[7px] font-black uppercase tracking-widest opacity-60">Total a Cobrar</span>
                      <span className="text-xl font-black tracking-tighter">
                        ${((order.total - (order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)) + (parseFloat(tipAmounts[order.id]) || 0)).toLocaleString()}
                      </span>
                   </div>
                </div>

                <button 
                  onClick={() => {
                    const meth = selectedPayment[order.id];
                    if (meth) {
                      const amountToPay = order.total - (order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0);
                      const tip = parseFloat(tipAmounts[order.id]) || 0;
                      const required = amountToPay + tip;
                      
                      if (meth === 'Efectivo') {
                        const received = parseFloat(cashReceived[order.id]);
                        if (isNaN(received) || received < required) {
                          alert(`El cliente debe entregar al menos $${required.toLocaleString()} (Total + Propina)`);
                          return;
                        }
                      }
                      onPay(order.id, meth, tip);
                      setTipAmounts(prev => {
                        const next = { ...prev };
                        delete next[order.id];
                        return next;
                      });
                    }
                  }}
                  disabled={!selectedPayment[order.id]}
                  className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95 border-b-4 ${
                    selectedPayment[order.id] 
                    ? 'bg-black text-white border-slate-900' 
                    : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                  }`}
                >
                  <Icons.CreditCard />
                  <span>PAGAR</span>
                </button>
             </div>
          )}
        </div>
      </div>
    );
  };

  const allActiveCount = groupedOrders.pending.length + groupedOrders.preparing.length + groupedOrders.ready.length;

  if (allActiveCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <div className="mb-4 opacity-5">
          <Icons.ChefHat />
        </div>
        <p className="text-sm font-black uppercase tracking-widest">Sin Órdenes en Cocina</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full items-start overflow-x-auto pb-4">
        
        {/* PENDING COLUMN */}
        <div className="bg-slate-50/50 rounded-[2.5rem] p-4 border-2 border-dashed border-slate-200 min-h-[600px] flex flex-col min-w-[320px]">
          <div className="flex items-center justify-between mb-6 px-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-200 rounded-xl flex items-center justify-center text-slate-600">
                <Icons.History />
              </div>
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-500">Pendientes</h3>
            </div>
            <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-3 py-1 rounded-full">
              {groupedOrders.pending.length}
            </span>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-2 scrollbar-hide">
            {groupedOrders.pending.map(renderOrderCard)}
            {groupedOrders.pending.length === 0 && (
              <div className="text-center py-12 text-slate-300">
                <p className="text-[10px] font-black uppercase tracking-widest text-balance">No hay pedidos en cola</p>
              </div>
            )}
          </div>
        </div>

        {/* PREPARING COLUMN */}
        <div className="bg-amber-50/30 rounded-[2.5rem] p-4 border-2 border-dashed border-amber-200 min-h-[600px] flex flex-col min-w-[320px]">
          <div className="flex items-center justify-between mb-6 px-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg animate-pulse">
                <Icons.ChefHat />
              </div>
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-amber-600">Preparando</h3>
            </div>
            <span className="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-amber-200">
              {groupedOrders.preparing.length}
            </span>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-2 scrollbar-hide">
            {groupedOrders.preparing.map(renderOrderCard)}
            {groupedOrders.preparing.length === 0 && (
              <div className="text-center py-12 text-amber-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-balance">Cocina sin pedidos</p>
              </div>
            )}
          </div>
        </div>

        {/* READY COLUMN */}
        <div className="bg-green-50/30 rounded-[2.5rem] p-4 border-2 border-dashed border-green-200 min-h-[600px] flex flex-col min-w-[320px]">
          <div className="flex items-center justify-between mb-6 px-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Icons.CheckCircle />
              </div>
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-green-700">Listos</h3>
            </div>
            <span className="bg-green-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-green-200">
              {groupedOrders.ready.length}
            </span>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-2 scrollbar-hide">
            {groupedOrders.ready.map(renderOrderCard)}
            {groupedOrders.ready.length === 0 && (
              <div className="text-center py-12 text-green-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-balance">Esperando despacho</p>
              </div>
            )}
          </div>
        </div>

      </div>
      <ConfirmationModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type="danger"
      />
    </div>
  );
};

export default DispatchView;
