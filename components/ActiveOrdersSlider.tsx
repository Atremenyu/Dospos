import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, OrderStatus, PaymentMethod } from '../types';
import { Icons } from '../constants';

interface ActiveOrdersSliderProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onDeliver: (id: string) => void;
  onUpdateItemStatus: (orderId: string, itemIdx: number, status: OrderStatus) => void;
  onPay: (id: string, payment: PaymentMethod, tip?: number, amount?: number) => void;
  onCancel: (id: string) => void;
}

const ActiveOrdersSlider: React.FC<ActiveOrdersSliderProps> = ({
  isOpen, onClose, orders, onDeliver, onUpdateItemStatus, onPay, onCancel
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed top-16 right-0 bottom-0 left-0 z-[70] flex justify-end overflow-hidden pointer-events-none">
          {/* Transparent backdrop that handles clicks but allows the drawer to be below header visually */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/10 backdrop-blur-[1px] pointer-events-auto"
          />
          
          <motion.div 
            drag="x"
            dragConstraints={{ left: 0, right: 450 }}
            dragElastic={0.05}
            onDragEnd={(_, info) => {
              if (info.offset.x > 80 || info.velocity.x > 400) {
                onClose();
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
                  <Icons.History />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-black leading-none">Pedidos Activos</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">Desliza para cerrar</p>
                </div>
              </div>
              <div className="flex items-center">
                <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse shadow-lg shadow-red-100">
                  {orders.filter(o => !(o.isPaid && o.status === 'delivered') && o.status !== 'cancelled').length} EN VIVO
                </span>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {orders.filter(o => !(o.isPaid && o.status === 'delivered') && o.status !== 'cancelled').sort((a,b) => {
                if (a.status === 'ready' && b.status !== 'ready') return -1;
                if (a.status !== 'ready' && b.status === 'ready') return 1;
                return new Date(b.date).getTime() - new Date(a.date).getTime();
              }).map(order => {
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
                             key={i} 
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
                             {item.isCombo && item.selectedComboOptions && item.selectedComboOptions.map((opt, oidx) => (
                               <div key={oidx} className="flex justify-between items-center text-[9px] font-bold text-red-700 ml-8 p-1 -mx-1">
                                 <span>+ {opt.label}</span>
                                 <span>+${opt.extraPrice.toLocaleString()}</span>
                               </div>
                             ))}
                           </div>
                         );
                       })}
                    </div>

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
                       {order.type !== 'dine-in' && (
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
              {orders.filter(o => !(o.isPaid && o.status === 'delivered') && o.status !== 'cancelled').length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 opacity-40">
                  <Icons.History />
                  <p className="text-[10px] font-black uppercase tracking-widest mt-4">Sin pedidos activos</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ActiveOrdersSlider;
