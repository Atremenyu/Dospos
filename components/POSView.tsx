
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, CartItem, Category, PaymentMethod, Order, OrderType, TakeawayType, Table, SelectedModifier, ComboOption, User, UserRole } from '../types';
import { Icons } from '../constants';
import ModifierModal from './ModifierModal';
import ComboModal from './ComboModal';
import { getQuickCashOptions } from '../utils/paymentUtils';

interface POSViewProps {
  products: Product[];
  categories: Category[];
  cart: CartItem[];
  orders: Order[];
  tables: Table[];
  initialTableId?: string | null;
  onAddToCart: (p: Product, mods?: SelectedModifier[], note?: string, isCombo?: boolean, comboOpts?: ComboOption[]) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  onCheckout: (client: string, table: string, payment: PaymentMethod, type: OrderType, takeawayType?: TakeawayType, tip?: number, payLater?: boolean, address?: string) => void;
  onDeliver: (id: string) => void;
  onUpdateItemStatus: (orderId: string, itemIdx: number, status: any) => void;
  onPay: (id: string, payment: PaymentMethod, tip?: number, amount?: number) => void;
  onCancel: (id: string) => void;
  onToggleOrders: () => void;
  hasOpenCashShift: boolean;
  onOpenShift: () => void;
  onCloseShift: () => void;
  users: User[];
  roles: UserRole[];
}

const POSView: React.FC<POSViewProps> = ({ 
  products, categories, cart, orders, tables, initialTableId,
  onAddToCart, onUpdateQuantity, onUpdateNote, onCheckout, onDeliver, onUpdateItemStatus, onPay, onCancel,
  onToggleOrders, hasOpenCashShift, onOpenShift, onCloseShift, users, roles
}) => {
  const [activeCategory, setActiveCategory] = useState<Category | 'Todos'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [client, setClient] = useState('');
  const [address, setAddress] = useState('');
  const [table, setTable] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('Efectivo');
  const [orderType, setOrderType] = useState<OrderType>('dine-in');
  const [takeawayType, setTakeawayType] = useState<TakeawayType>('local');
  const [tipAmount, setTipAmount] = useState<string>('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [cartExpanded, setCartExpanded] = useState(false);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [payLater, setPayLater] = useState(false);
  const [authorizedBy, setAuthorizedBy] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingModifierProduct, setPendingModifierProduct] = useState<Product | null>(null);
  const [pendingComboProduct, setPendingComboProduct] = useState<Product | null>(null);
  const [selectedIsComboForModifier, setSelectedIsComboForModifier] = useState<boolean>(false);
  const [pendingComboOptionsForModifier, setPendingComboOptionsForModifier] = useState<ComboOption[]>([]);

  const checkoutContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCheckout && checkoutContainerRef.current) {
      checkoutContainerRef.current.scrollTop = 0;
    }
  }, [showCheckout]);

  const handleProductClick = (product: Product) => {
    if (product.hasCombo) {
      setPendingComboProduct(product);
    } else if (product.modifierGroups && product.modifierGroups.length > 0) {
      setPendingModifierProduct(product);
    } else {
      onAddToCart(product);
    }
  };

  const handleComboConfirm = (isCombo: boolean, selectedOptions: ComboOption[]) => {
    setPendingComboProduct(null);
    if (pendingComboProduct?.modifierGroups && pendingComboProduct.modifierGroups.length > 0) {
        setPendingModifierProduct(pendingComboProduct);
        setSelectedIsComboForModifier(isCombo);
        setPendingComboOptionsForModifier(selectedOptions);
    } else {
        onAddToCart(pendingComboProduct!, undefined, undefined, isCombo, selectedOptions);
    }
  }

  const handleModifierConfirm = (selectedModifiers: SelectedModifier[], note: string) => {
    if (pendingModifierProduct) {
      onAddToCart(pendingModifierProduct, selectedModifiers, note, selectedIsComboForModifier, pendingComboOptionsForModifier);
      setPendingModifierProduct(null);
      setSelectedIsComboForModifier(false);
      setPendingComboOptionsForModifier([]);
    }
  };

  // Sync with initialTableId from TablesView
  useEffect(() => {
    if (initialTableId) {
      const selectedTable = tables.find(t => t.id === initialTableId);
      if (selectedTable) {
        setTable(selectedTable.name);
        setOrderType('dine-in');
        setShowCheckout(false); 
      }
    }
  }, [initialTableId, tables]);

  // Handle automatic payment for delivery apps
  useEffect(() => {
    if (orderType === 'takeaway') {
      if (takeawayType === 'uber') setPayment('Uber');
      else if (takeawayType === 'didi') setPayment('Didi');
      else if (payment === 'Uber' || payment === 'Didi') setPayment('Efectivo');
    } else {
      if (payment === 'Uber' || payment === 'Didi') setPayment('Efectivo');
    }
  }, [takeawayType, orderType]);

  // Reset payLater if takeawayType is uber/didi
  useEffect(() => {
    if (takeawayType === 'uber' || takeawayType === 'didi') {
      setPayLater(false);
    }
  }, [takeawayType]);

  const displayCategories: (Category | 'Todos')[] = ['Todos', ...categories];

  const filteredProducts = useMemo(() => {
    let result = products;
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(term));
    }
    
    // Filter by category
    if (activeCategory !== 'Todos') {
      result = result.filter(p => p.category === activeCategory);
    }
    
    return result;
  }, [products, activeCategory, searchTerm]);

  const total = useMemo(() => 
    cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), 
  [cart]);

  const existingOrder = useMemo(() => {
    if (orderType !== 'dine-in' || !table.trim()) return null;
    return orders.find(o => o.table === table && o.type === 'dine-in' && !o.isPaid && o.status !== 'cancelled');
  }, [orders, table, orderType]);

  const handleCheckoutSubmit = () => {
    // Basic validation for cash payments in POSView
    const tip = parseFloat(tipAmount) || 0;
    if (payment === 'Efectivo' && orderType === 'takeaway' && takeawayType !== 'uber' && takeawayType !== 'didi' && !payLater) {
      const received = parseFloat(cashReceived);
      const required = total + tip;
      if (isNaN(received) || received < required) {
        const diff = required - (isNaN(received) ? 0 : received);
        alert(`Monto insuficiente. Faltan $${diff.toLocaleString()} para cubrir el total + propina de $${required.toLocaleString()}`);
        return;
      }
    }
    
    onCheckout(client, table, payment, orderType, orderType === 'takeaway' ? takeawayType : undefined, tip, payLater, orderType === 'takeaway' && takeawayType === 'delivery' ? address : undefined);
    setClient('');
    setAddress('');
    setTable('');
    setTipAmount('');
    setPayment('Efectivo');
    setOrderType('dine-in');
    setTakeawayType('local');
    setShowCheckout(false);
    setCashReceived('');
    setPayLater(false);
    setAuthorizedBy(null);
  };

  const hasReadyOrders = useMemo(() => orders.some(o => o.status === 'ready'), [orders]);

  return (
    <div className="flex flex-col lg:flex-row h-full relative overflow-hidden">
      {/* Product Catalog */}
      <div className={`flex-grow p-4 sm:p-6 overflow-y-auto transition-all ${showCheckout ? 'opacity-50 blur-[1px]' : ''}`}>
        <div className="mb-6 space-y-4">
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-slate-400">
              <Icons.Search />
            </span>
            <input 
              type="text" 
              placeholder="Buscar producto por nombre..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-600 outline-none transition-all shadow-sm font-medium text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-3 text-slate-300 hover:text-slate-500 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            )}
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide touch-pan-x -mx-4 px-4 sm:mx-0 sm:px-0">
            {displayCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-sm shrink-0 ${
                  activeCategory === cat 
                  ? 'bg-red-600 text-white shadow-red-200' 
                  : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-20 md:pb-0">
          {filteredProducts.map(product => (
            <button
              key={product.id}
              disabled={showCheckout}
              onClick={() => handleProductClick(product)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-red-600 transition-all text-left flex flex-col justify-between active:scale-95 group"
            >
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-black text-white mb-3 inline-block">
                  {product.category}
                </span>
                <h3 className="font-bold text-slate-900 leading-tight group-hover:text-red-600 transition-colors text-base">
                  {product.name}
                </h3>
              </div>
              <p className="mt-4 text-xl font-black text-black">
                ${product.price.toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Summary & Checkout Overlay */}
      <div 
        className={`
          fixed lg:static bottom-0 left-0 right-0 z-40 bg-white lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] lg:shadow-none
          transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
          ${(() => {
            if (showCheckout) return 'h-[92vh] lg:h-full rounded-t-[2.5rem] lg:rounded-none';
            if (cartExpanded) return 'h-[80vh] lg:h-full rounded-t-[2.5rem] lg:rounded-none';
            if (cart.length > 0) return 'h-20 lg:h-full';
            return 'h-0 lg:h-full overflow-hidden border-0';
          })()}
        `}
      >
        {/* Blocking Overlay if no shift */}
        {!hasOpenCashShift && (
          <div className="absolute inset-0 z-[60] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
            <div className="bg-red-600/20 p-6 rounded-full mb-6 border border-red-600/30">
              <Icons.Lock size={48} className="text-red-500" />
            </div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 leading-tight">
              Caja Cerrada
            </h3>
            <p className="text-slate-400 font-bold mb-8 max-w-xs uppercase text-xs tracking-widest leading-relaxed">
              Debes realizar la apertura de caja para comenzar a tomar pedidos.
            </p>
            <button 
              onClick={onOpenShift}
              className="px-10 py-5 bg-red-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-all shadow-2xl shadow-red-600/20 active:scale-95"
            >
              Realizar Apertura
            </button>
          </div>
        )}
        {/* Mobile Handle */}
        <div 
          className="lg:hidden flex justify-center pt-2 pb-1 bg-white rounded-t-[2.5rem] cursor-pointer"
          onClick={() => {
            if (window.innerWidth < 1024) {
              setCartExpanded(!cartExpanded);
            }
          }}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        <div 
          className="p-4 border-b border-slate-200 flex items-center justify-between bg-white cursor-pointer lg:cursor-default"
          onClick={() => {
            if (window.innerWidth < 1024) {
              setCartExpanded(!cartExpanded);
            }
          }}
        >
          <div className="flex items-center space-x-3 font-black text-black uppercase tracking-tighter">
            <div className={`p-2 rounded-lg transition-colors ${cartExpanded || showCheckout ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              <Icons.Cart />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] sm:text-xs leading-none">{showCheckout ? 'Confirmar' : 'Tu Pedido'}</span>
              {!showCheckout && cart.length > 0 && !cartExpanded && (
                <span className="text-[14px] leading-tight text-red-600">${total.toLocaleString()}</span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {hasOpenCashShift && !showCheckout && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseShift();
                }}
                className="p-2 text-slate-400 hover:text-red-600 transition"
                title="Cerrar Caja"
              >
                <Icons.Lock size={20} />
              </button>
            )}
            {!showCheckout && (
               <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleOrders();
                }}
                className="p-2 text-slate-400 hover:text-black transition relative"
                title="Ver Pedidos Activos"
              >
                <Icons.History />
                <AnimatePresence>
                  {orders.filter(o => !(o.isPaid && o.status === 'delivered') && o.status !== 'cancelled').length > 0 && (
                    <motion.span 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className={`absolute top-0 right-0 w-4 h-4 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-white shadow-sm ${
                        hasReadyOrders ? 'bg-green-500 animate-bounce' : 'bg-red-600 animate-pulse'
                      }`}
                    >
                      {orders.filter(o => !(o.isPaid && o.status === 'delivered') && o.status !== 'cancelled').length}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}

            {cart.length > 0 && !showCheckout && (
               <div className={`p-1 rounded-full transition-transform duration-300 ${cartExpanded ? 'rotate-180' : ''}`}>
                 <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7"></path>
                 </svg>
               </div>
            )}

            {showCheckout && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCheckout(false);
                }}
                className="text-slate-400 hover:text-red-600 p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            )}
          </div>
        </div>



        {cart.length === 0 && !showCheckout ? (
          <div className="flex-grow flex flex-col items-center justify-center text-slate-400 p-8">
            <div className="mb-4 opacity-10">
               <Icons.Cart />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest">Carrito Vacío</p>
          </div>
        ) : (
          <div className="flex-grow flex flex-col overflow-hidden bg-slate-50/50">
            {/* Quick Order Type Toggle - Always visible at top of cart when not in deep checkout */}
            {!showCheckout && (
              <div className="p-4 bg-white border-b border-slate-200 space-y-3">
                 <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button 
                      onClick={() => setOrderType('takeaway')}
                      className={`flex-grow py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2 ${orderType === 'takeaway' ? 'bg-black text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Icons.MapPin />
                      <span>Llevar</span>
                    </button>
                    <button 
                      onClick={() => {
                        setOrderType('dine-in');
                        if (table) setTable('');
                      }}
                      className={`flex-grow py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2 ${orderType === 'dine-in' ? 'bg-black text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Icons.Layout />
                      <span>Comedor</span>
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center space-x-2 text-slate-500">
                      {orderType === 'dine-in' ? (
                        <>
                          <Icons.Layout />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {table ? `Mesa: ${table}` : 'Sin Mesa Seleccionada'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Icons.MapPin />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            Para Llevar ({takeawayType.toUpperCase()})
                          </span>
                        </>
                      )}
                    </div>
                    <button 
                      onClick={() => setShowCheckout(true)}
                      className="text-[9px] font-black text-red-600 uppercase tracking-widest hover:underline"
                    >
                      {table || orderType === 'takeaway' ? 'Cambiar' : 'Elegir'}
                    </button>
                  </div>
              </div>
            )}

            {showCheckout ? (
              /* Integrated Checkout Form */
              <div 
                ref={checkoutContainerRef}
                className="flex-grow overflow-y-auto p-6 space-y-6 animate-in slide-in-from-right-4 duration-300"
              >
                <div className="space-y-4">
                  {/* Miniature Order Type Toggle in Checkout */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button 
                      onClick={() => setOrderType('takeaway')}
                      className={`flex-grow py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${orderType === 'takeaway' ? 'bg-black text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Llevar
                    </button>
                    <button 
                      onClick={() => setOrderType('dine-in')}
                      className={`flex-grow py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${orderType === 'dine-in' ? 'bg-black text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Mesa
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalles</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="relative">
                        <span className="absolute left-3 top-3.5 text-slate-400">
                          <Icons.User />
                        </span>
                        <input 
                          type="text" placeholder="Cliente (Opcional)" 
                          className="w-full text-sm pl-10 pr-4 py-3 rounded-xl border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-red-600 outline-none transition bg-slate-50 focus:bg-white"
                          value={client} onChange={e => setClient(e.target.value)}
                        />
                      </div>

                      {orderType === 'takeaway' && takeawayType === 'delivery' && (
                        <div className="relative">
                          <span className="absolute left-3 top-3.5 text-slate-400">
                            <Icons.MapPin />
                          </span>
                          <input 
                            type="text" placeholder="Dirección de Envío" 
                            className="w-full text-sm pl-10 pr-4 py-3 rounded-xl border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-red-600 outline-none transition bg-slate-50 focus:bg-white animate-fade-in"
                            value={address} onChange={e => setAddress(e.target.value)}
                          />
                        </div>
                      )}
                      
                      {orderType === 'dine-in' ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seleccionar Mesa</h4>
                            <span className="text-[8px] font-bold text-slate-300 uppercase italic">Mapa de Mesas</span>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2">
                            {tables.map(t => {
                              const isSelected = table === t.name;
                              const hasActiveOrder = orders.some(o => o.table === t.name && o.type === 'dine-in' && !o.isPaid);
                              
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => {
                                    setTable(t.name);
                                    setOrderType('dine-in');
                                    setShowCheckout(true);
                                  }}
                                  className={`py-2 px-1 rounded-xl border-2 text-[10px] font-black uppercase transition-all relative ${
                                    isSelected 
                                    ? 'border-red-600 bg-red-600 text-white shadow-lg' 
                                    : hasActiveOrder 
                                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                                      : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                                  }`}
                                >
                                  {t.name.split(' ').pop()}
                                  {hasActiveOrder && !isSelected && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border border-white"></span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <div className="relative pt-2">
                            <span className="absolute left-3 top-5.5 text-slate-400">
                              <Icons.MapPin />
                            </span>
                            <input 
                              type="text" placeholder="Número de Mesa u Otro" 
                              className="w-full text-sm pl-10 pr-4 py-3 rounded-xl border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-red-600 outline-none transition bg-slate-50 focus:bg-white"
                              value={table} onChange={e => {
                                setTable(e.target.value);
                                setOrderType('dine-in');
                              }}
                            />
                            {existingOrder && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                                <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight">
                                  <Icons.CheckCircle /> Mesa con cuenta abierta (${existingOrder.total.toLocaleString()})
                                </p>
                                <p className="text-[9px] text-red-400 font-medium tracking-tight">Los items se añadirán a la cuenta existente.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Servicio Para Llevar</p>
                          <div className="grid grid-cols-2 gap-2">
                            {(['local', 'delivery', 'uber', 'didi'] as TakeawayType[]).map(type => (
                              <button
                                key={type}
                                onClick={() => setTakeawayType(type)}
                                className={`py-2 rounded-lg border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                  takeawayType === type 
                                  ? 'border-red-600 bg-red-50 text-red-700' 
                                  : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                                }`}
                              >
                                {type === 'local' ? 'En Local' : type === 'delivery' ? 'Domicilio' : type}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {orderType === 'takeaway' && (takeawayType === 'uber' || takeawayType === 'didi') && (
                    <div className="bg-green-50 p-5 rounded-2xl border border-green-100 flex items-center space-x-3">
                      <div className="bg-green-600 text-white p-2 rounded-lg">
                        <Icons.CheckCircle />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-green-800 uppercase tracking-widest">Pago Automático</p>
                        <p className="text-xs font-bold text-green-600 uppercase">Procesado como {takeawayType.toUpperCase()}</p>
                      </div>
                    </div>
                  )}

                  {((orderType === 'dine-in') || (orderType === 'takeaway' && takeawayType !== 'uber' && takeawayType !== 'didi')) && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">¿Cuándo se Paga?</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPayLater(false)}
                          className={`py-3 px-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center space-y-1 ${
                            !payLater
                            ? 'border-red-600 bg-red-50 text-red-700'
                            : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                          }`}
                        >
                          <div className="p-1.5 rounded-lg bg-red-600 text-white">
                            <Icons.DollarSign size={14} />
                          </div>
                          <span>Pagar Ahora</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayLater(true)}
                          className={`py-3 px-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center space-y-1 ${
                            payLater
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                          }`}
                        >
                          <div className="p-1.5 rounded-lg bg-amber-500 text-white">
                            <Icons.Clock size={14} />
                          </div>
                          <span>Al Entregar</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {((orderType === 'dine-in') || (orderType === 'takeaway' && takeawayType !== 'uber' && takeawayType !== 'didi')) && !payLater && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Forma de Pago</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {(['Efectivo', 'Tarjeta', 'Transferencia', 'Cortesía'] as PaymentMethod[]).map(method => {
                          const isSelected = payment === method;
                          const isCash = method === 'Efectivo';
                          
                          return (
                            <div key={method} className="space-y-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (method === 'Cortesía' && !authorizedBy) {
                                    setShowPinModal(true);
                                  } else {
                                    setPayment(method);
                                    setCashReceived('');
                                    if (method !== 'Cortesía') {
                                      setAuthorizedBy(null);
                                    }
                                  }
                                }}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                  isSelected 
                                  ? 'border-red-600 bg-red-50 text-red-700' 
                                  : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    {method === 'Efectivo' && <Icons.DollarSign size={18} />}
                                    {method === 'Tarjeta' && <Icons.CreditCard size={18} />}
                                    {method === 'Transferencia' && <Icons.Smartphone size={18} />}
                                    {method === 'Cortesía' && <Icons.Gift size={18} />}
                                  </div>
                                  <div className="text-left">
                                    <span className="font-black text-xs uppercase tracking-tight block">{method}</span>
                                    {method === 'Cortesía' && authorizedBy && (
                                      <span className="text-[8px] font-bold text-green-600 uppercase tracking-tight block">Autorizado por: {authorizedBy}</span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="text-red-600">
                                    <Icons.CheckCircle size={20} />
                                  </div>
                                )}
                              </button>

                              {isSelected && isCash && !payLater && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl space-y-4 overflow-hidden"
                                >
                                  <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Recibido</p>
                                      <div className="relative">
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xl font-black text-red-300">$</span>
                                        <input 
                                          type="text"
                                          inputMode="decimal"
                                          className="w-full bg-transparent border-none outline-none pl-6 text-2xl font-black tracking-tighter text-black placeholder:text-red-100"
                                          placeholder="0.00"
                                          value={cashReceived}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/,/g, '.');
                                            // Only allow numbers and a single decimal point
                                            if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                              setCashReceived(val);
                                            }
                                          }}
                                        />
                                      </div>
                                    </div>
                                    {cashReceived && parseFloat(cashReceived) > 0 && (
                                      <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Cambio</p>
                                        <p className="text-2xl font-black text-green-600 tracking-tighter">
                                          ${Math.max(0, parseFloat(cashReceived) - (total + (parseFloat(tipAmount) || 0))).toLocaleString()}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-red-100">
                                    {getQuickCashOptions(total + (parseFloat(tipAmount) || 0)).map(amount => (
                                      <button 
                                        key={amount}
                                        onClick={() => setCashReceived(amount.toString())}
                                        className="py-1.5 bg-white hover:bg-black hover:text-white rounded-lg text-[9px] font-black transition-all border border-red-100 uppercase"
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
                      
                      <div className="pt-4 border-t border-slate-100">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Propina (Opcional)</label>
                        <div className="flex items-center space-x-2">
                          <div className="relative flex-grow">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <input 
                              type="number"
                              value={tipAmount}
                              onChange={e => setTipAmount(e.target.value)}
                              className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-red-600 outline-none font-bold text-sm"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {[0.10, 0.15, 0.20].map(pct => (
                              <button
                                key={pct}
                                onClick={() => setTipAmount((total * pct).toFixed(2))}
                                className="px-3 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-black"
                              >
                                {pct * 100}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-black text-white p-6 rounded-3xl shadow-2xl space-y-5 border-t-4 border-red-600">
                   <div className="flex justify-between items-center opacity-60 text-[10px] font-black uppercase tracking-widest">
                      <span>{orderType === 'dine-in' ? 'Cuenta Mesa' : 'Total Caja'}</span>
                      <span>{cart.length} items</span>
                   </div>
                    <div className="flex flex-col border-b border-slate-800 pb-4">
                       <div className="flex justify-between items-center text-[10px] font-black opacity-60 uppercase mb-1">
                          <span>{orderType === 'dine-in' ? 'Cuenta Mesa' : 'Items'}</span>
                          <span>${total.toLocaleString()}</span>
                       </div>
                       {parseFloat(tipAmount) > 0 && (
                         <div className="flex justify-between items-center text-[10px] font-black text-red-400 uppercase mb-2">
                           <span>Propina</span>
                           <span>+ ${parseFloat(tipAmount).toLocaleString()}</span>
                         </div>
                       )}
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Total a Pagar</span>
                          <div className="text-4xl font-black tracking-tighter">${(total + (parseFloat(tipAmount) || 0)).toLocaleString()}</div>
                       </div>
                    </div>
                   <button 
                    onClick={handleCheckoutSubmit}
                    disabled={orderType === 'dine-in' && !table.trim()}
                    className={`w-full py-4 rounded-xl font-black text-base uppercase tracking-widest transition shadow-lg active:scale-[0.98] ${
                      orderType === 'dine-in' && !table.trim() 
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-red-900/40'
                    }`}
                  >
                    {orderType === 'dine-in' 
                      ? (existingOrder ? 'AÑADIR A MESA' : 'ABRIR CUENTA MESA') 
                      : payLater 
                        ? 'ENVIAR PEDIDO (POR COBRAR)' 
                        : 'FINALIZAR COBRO'}
                  </button>
                </div>
              </div>
            ) : (
              /* Regular Cart List */
              <>
                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                      {cart.map((item, idx) => (
                          <div key={`${item.id}-${idx}`} className="flex flex-col space-y-2 group border-b border-slate-200 pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-grow">
                                <h4 className="font-bold text-sm text-slate-900 uppercase tracking-tight leading-none">{item.name}</h4>
                                {item.isCombo && (
                                  <div className="mt-1">
                                    <span className="text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                      Combo
                                    </span>
                                    {item.selectedComboOptions && item.selectedComboOptions.map((opt, oidx) => (
                                        <span key={oidx} className="text-[8px] font-bold text-slate-500 ml-1">
                                            + {opt.label}
                                        </span>
                                    ))}
                                  </div>
                                )}
                                {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {item.selectedModifiers.map((mod, midx) => {
                                      const isRemoval = mod.modifierName.toLowerCase().includes('sin') || 
                                                        mod.modifierName.toLowerCase().includes('quitar') || 
                                                        mod.modifierName.toLowerCase().includes('remover') || 
                                                        mod.modifierName.toLowerCase().includes('no ') || 
                                                        mod.extraPrice <= 0;
                                      return (
                                        <span key={midx} className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter border ${
                                          isRemoval 
                                            ? 'bg-rose-50 text-rose-700 border-rose-100' 
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                          {isRemoval ? '' : '+ '}{mod.modifierName}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                <p className="text-[10px] text-slate-500 font-bold mt-1">${item.price}</p>
                              </div>
                            <div className="flex items-center space-x-2 bg-white rounded border border-slate-300 p-0.5">
                              <button 
                                onClick={() => onUpdateQuantity(item.id, -1)}
                                className="text-red-600 hover:bg-red-50 p-1 rounded transition"
                              >
                                <Icons.Minus />
                              </button>
                              <span className="font-black text-xs w-6 text-center">{item.quantity}</span>
                              <button 
                                onClick={() => onUpdateQuantity(item.id, 1)}
                                className="text-red-600 hover:bg-red-50 p-1 rounded transition"
                              >
                                <Icons.Plus />
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="+ Nota especial"
                            className="text-[10px] font-medium w-full p-2 border border-slate-200 rounded bg-white focus:ring-1 focus:ring-red-600 outline-none transition"
                            value={item.note || ''}
                            onChange={(e) => onUpdateNote(item.id, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="p-4 bg-white border-t border-slate-300">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Monto:</span>
                          <span className="text-3xl font-black text-black tracking-tighter">${total.toLocaleString()}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setShowCheckout(true);
                          }}
                          className="w-full bg-black text-white py-4 rounded-xl font-black text-base uppercase tracking-widest hover:bg-slate-900 transition shadow-xl active:scale-[0.98] flex items-center justify-center space-x-2 border-b-4 border-red-600"
                        >
                          <Icons.CheckCircle />
                          <span>{orderType === 'dine-in' && !table ? 'SELECCIONAR MESA' : 'CONTINUAR'}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Modifiers Modal */}
            {pendingModifierProduct && (
              <ModifierModal 
                product={pendingModifierProduct}
                onClose={() => setPendingModifierProduct(null)}
                onConfirm={handleModifierConfirm}
              />
            )}
            
            {showPinModal && (
              <div 
                onClick={() => {
                  setShowPinModal(false);
                  setEnteredPin('');
                  setPinError(null);
                }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-300"
              >
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl border-2 border-red-600 overflow-hidden p-6 space-y-6 animate-in zoom-in-95 duration-200"
                >
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
                                setPayment('Cortesía');
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
                              setPayment('Cortesía');
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
                      }}
                      className="w-16 h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black text-[10px] text-slate-500 transition-all active:scale-95 uppercase"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {pendingComboProduct && (
              <ComboModal 
                product={pendingComboProduct}
                onClose={() => setPendingComboProduct(null)}
                onConfirm={handleComboConfirm}
              />
            )}
          </div>
        </div>
      );
};

export default POSView;
