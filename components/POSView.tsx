
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, CartItem, Category, PaymentMethod, Order, OrderType, TakeawayType, Table, SelectedModifier, ComboOption, User, UserRole, Promotion, CashShift } from '../types';
import { Icons } from '../constants';
import ModifierModal from './ModifierModal';
import ComboModal from './ComboModal';
import { getQuickCashOptions } from '../utils/paymentUtils';
import { isPromotionActiveNow, calculateOrderPromotionDiscount, getProductActivePromo } from '../utils/promotionsEngine';

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
  onCheckout: (
    client: string, 
    table: string, 
    payment: PaymentMethod, 
    type: OrderType, 
    takeawayType?: TakeawayType, 
    tip?: number, 
    payLater?: boolean, 
    address?: string,
    cashReceived?: number,
    discountAmount?: number,
    discountReason?: string,
    appliedPromotionId?: string
  ) => void;
  onDeliver: (id: string) => void;
  onUpdateItemStatus: (orderId: string, itemIdx: number, status: any) => void;
  onPay: (id: string, payment: PaymentMethod, tip?: number, amount?: number) => void;
  onCancel: (id: string) => void;
  onToggleOrders: () => void;
  staleOpenCashShift?: CashShift | null;
  hasOpenCashShift: boolean;
  onOpenShift: () => void;
  onCloseShift: () => void;
  onShowShiftBlockModal?: () => void;
  users: User[];
  roles: UserRole[];
  promotions?: Promotion[];
  isSubmitting?: boolean;
}

const POSView: React.FC<POSViewProps> = ({ 
  products, categories, cart, orders, tables, initialTableId,
  onAddToCart, onUpdateQuantity, onUpdateNote, onCheckout, onDeliver, onUpdateItemStatus, onPay, onCancel,
  onToggleOrders, staleOpenCashShift, hasOpenCashShift, onOpenShift, onCloseShift, onShowShiftBlockModal, users, roles,
  promotions = [], isSubmitting = false
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
  const [payLater, setPayLater] = useState(true);
  const [authorizedBy, setAuthorizedBy] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingModifierProduct, setPendingModifierProduct] = useState<Product | null>(null);
  const [pendingComboProduct, setPendingComboProduct] = useState<Product | null>(null);
  const [selectedIsComboForModifier, setSelectedIsComboForModifier] = useState<boolean>(false);
  const [pendingComboOptionsForModifier, setPendingComboOptionsForModifier] = useState<ComboOption[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null | 'none'>(null);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState<boolean>(false);

  const checkoutContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCheckout && checkoutContainerRef.current) {
      checkoutContainerRef.current.scrollTop = 0;
    }
  }, [showCheckout]);

  const handleProductClick = (product: Product) => {
    if (staleOpenCashShift || !hasOpenCashShift) {
      if (onShowShiftBlockModal) onShowShiftBlockModal();
      else if (staleOpenCashShift) onCloseShift();
      else onOpenShift();
      return;
    }
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
    if (staleOpenCashShift || !hasOpenCashShift) {
      if (onShowShiftBlockModal) onShowShiftBlockModal();
      else if (staleOpenCashShift) onCloseShift();
      else onOpenShift();
      return;
    }
    if (pendingComboProduct?.modifierGroups && pendingComboProduct.modifierGroups.length > 0) {
        setPendingModifierProduct(pendingComboProduct);
        setSelectedIsComboForModifier(isCombo);
        setPendingComboOptionsForModifier(selectedOptions);
    } else {
        onAddToCart(pendingComboProduct!, undefined, undefined, isCombo, selectedOptions);
    }
  };

  const handleModifierConfirm = (selectedModifiers: SelectedModifier[], note: string) => {
    if (pendingModifierProduct) {
      if (staleOpenCashShift || !hasOpenCashShift) {
        if (onShowShiftBlockModal) onShowShiftBlockModal();
        else if (staleOpenCashShift) onCloseShift();
        else onOpenShift();
        setPendingModifierProduct(null);
        return;
      }
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
        setPayLater(true);
        setShowCheckout(false); 
      }
    }
  }, [initialTableId, tables]);

  // Handle automatic payment for delivery apps and payLater default by orderType
  useEffect(() => {
    if (orderType === 'takeaway') {
      if (takeawayType === 'uber') setPayment('Uber');
      else if (takeawayType === 'didi') setPayment('Didi');
      else if (payment === 'Uber' || payment === 'Didi') setPayment('Efectivo');
      setPayLater(false);
    } else {
      if (payment === 'Uber' || payment === 'Didi') setPayment('Efectivo');
      setPayLater(true);
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

  const activePromotions = useMemo(() => {
    if (!promotions || promotions.length === 0) return [];
    return promotions.filter(p => isPromotionActiveNow(p));
  }, [promotions]);

  // Find promotion that gives the highest discount automatically for the current cart
  const bestAutoPromo = useMemo(() => {
    if (cart.length === 0 || activePromotions.length === 0) return null;
    let best: Promotion | null = null;
    let maxDiscount = 0;

    for (const p of activePromotions) {
      const calc = calculateOrderPromotionDiscount(cart, p);
      if (calc.eligible && calc.discountAmount > maxDiscount) {
        maxDiscount = calc.discountAmount;
        best = p;
      }
    }
    return best;
  }, [cart, activePromotions]);

  // Active promotion to apply: manual choice, explicit 'none', or best auto promo
  const currentPromotion = useMemo(() => {
    if (selectedPromoId === 'none') return null;
    if (selectedPromoId) {
      return promotions.find(p => p.id === selectedPromoId) || null;
    }
    return bestAutoPromo;
  }, [selectedPromoId, promotions, bestAutoPromo]);

  const promoCalcResult = useMemo(() => {
    if (!currentPromotion || cart.length === 0) {
      return { discountAmount: 0, description: '', eligible: false, message: '' };
    }
    return calculateOrderPromotionDiscount(cart, currentPromotion);
  }, [cart, currentPromotion]);

  const rawSubtotal = useMemo(() => 
    cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), 
  [cart]);

  const effectiveDiscount = promoCalcResult.eligible 
    ? Math.min(rawSubtotal, promoCalcResult.discountAmount) 
    : 0;
  const total = Math.max(0, rawSubtotal - effectiveDiscount);

  const existingOrder = useMemo(() => {
    if (orderType !== 'dine-in' || !table.trim()) return null;
    const tableLower = table.trim().toLowerCase();
    return orders.find(o => o.table && o.table.trim().toLowerCase() === tableLower && o.type === 'dine-in' && !o.closedAt && o.status !== 'cancelled');
  }, [orders, table, orderType]);

  const isAddingToExistingTable = orderType === 'dine-in' && Boolean(existingOrder);
  const effectivePayLater = isAddingToExistingTable ? true : payLater;

  const handleCheckoutSubmit = () => {
    if (isSubmitting || isSubmittingLocal) return;

    if (staleOpenCashShift || !hasOpenCashShift) {
      if (onShowShiftBlockModal) onShowShiftBlockModal();
      else if (staleOpenCashShift) onCloseShift();
      else onOpenShift();
      return;
    }

    if (orderType === 'dine-in' && !table.trim()) {
      alert('Por favor ingrese el número o nombre de la mesa.');
      return;
    }

    // Strict validation for cash payments only when paying immediately (not for open tabs or delivery apps)
    const tip = parseFloat(tipAmount) || 0;
    const isAutoPlatform = orderType === 'takeaway' && (takeawayType === 'uber' || takeawayType === 'didi');
    if (!effectivePayLater && !isAutoPlatform && payment === 'Efectivo') {
      const received = parseFloat(cashReceived);
      const required = total + tip;
      if (isNaN(received) || received < required) {
        const diff = required - (isNaN(received) ? 0 : received);
        alert(`Monto en efectivo insuficiente. Ingrese el monto entregado por el cliente (mínimo $${required.toLocaleString()}${diff > 0 && !isNaN(received) ? `, faltan $${diff.toLocaleString()}` : ''}).`);
        return;
      }
    }
    
    setIsSubmittingLocal(true);

    try {
      const parsedCashReceived = (!effectivePayLater && payment === 'Efectivo' && cashReceived) ? parseFloat(cashReceived) : undefined;
      onCheckout(
        client, 
        table, 
        isAddingToExistingTable ? 'Pendiente' : (effectivePayLater ? 'Pendiente' : payment), 
        orderType, 
        orderType === 'takeaway' ? takeawayType : undefined, 
        (isAddingToExistingTable || effectivePayLater) ? 0 : tip, 
        effectivePayLater, 
        orderType === 'takeaway' && takeawayType === 'delivery' ? address : undefined,
        parsedCashReceived,
        effectiveDiscount > 0 ? effectiveDiscount : undefined,
        effectiveDiscount > 0 && currentPromotion ? currentPromotion.name : undefined,
        effectiveDiscount > 0 && currentPromotion ? currentPromotion.id : undefined
      );

      setClient('');
      setAddress('');
      setTable('');
      setTipAmount('');
      setPayment('Efectivo');
      setOrderType('dine-in');
      setTakeawayType('local');
      setShowCheckout(false);
      setCashReceived('');
      setPayLater(true);
      setAuthorizedBy(null);
      setSelectedPromoId(null);
    } finally {
      setTimeout(() => {
        setIsSubmittingLocal(false);
      }, 800);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. PIN modal for courtesy authorization
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
                setPayment('Cortesía');
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
        } else if (e.key.toLowerCase() === 'c' || e.key === 'Delete') {
          e.preventDefault();
          setEnteredPin('');
          setPinError(null);
        }
        return;
      }

      // Do not conflict if ComboModal or ModifierModal are open
      if (pendingComboProduct || pendingModifierProduct) {
        return;
      }

      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      const isTextArea = activeEl && activeEl.tagName === 'TEXTAREA';

      // 2. In Checkout View
      if (showCheckout) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowCheckout(false);
          return;
        }

        // Enter submits the order if not in a multi-line textarea
        if (e.key === 'Enter' && !isTextArea) {
          e.preventDefault();
          const canSubmit = !((orderType === 'dine-in' && !table.trim()) || isSubmitting || isSubmittingLocal);
          if (canSubmit) {
            handleCheckoutSubmit();
          }
          return;
        }

        // Numeric / Function shortcuts when not typing in text fields
        if (!isInputActive) {
          if (e.key === '1' || e.key === 'F1' || (e.altKey && e.key === '1')) {
            e.preventDefault();
            setPayment('Efectivo');
          } else if (e.key === '2' || e.key === 'F2' || (e.altKey && e.key === '2')) {
            e.preventDefault();
            setPayment('Tarjeta');
          } else if (e.key === '3' || e.key === 'F3' || (e.altKey && e.key === '3')) {
            e.preventDefault();
            setPayment('Transferencia');
          } else if (e.key === '4' || e.key === 'F4' || (e.altKey && e.key === '4')) {
            e.preventDefault();
            setShowPinModal(true);
          } else if (e.key === 'F8' || (e.altKey && e.key.toLowerCase() === 'd')) {
            e.preventDefault();
            setPayLater(prev => !prev);
          } else if (e.altKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            setOrderType('dine-in');
          } else if (e.altKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            setOrderType('takeaway');
          }
        }
        return;
      }

      // 3. Regular POS Catalog & Cart view
      // Toggle Active Orders slider: F10 or Alt+P
      if (e.key === 'F10' || (e.altKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        onToggleOrders();
        return;
      }

      // Open checkout when cart has items: F9 or Enter (if not focused on an input)
      if (cart.length > 0) {
        if (e.key === 'F9' || (e.key === 'Enter' && !isInputActive)) {
          e.preventDefault();
          setShowCheckout(true);
          return;
        }
      }

      // Clear search with Escape
      if (e.key === 'Escape' && searchTerm) {
        e.preventDefault();
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showPinModal, enteredPin, users, roles, pendingComboProduct, pendingModifierProduct,
    showCheckout, orderType, table, isSubmitting, isSubmittingLocal, cart.length,
    searchTerm, handleCheckoutSubmit, onToggleOrders
  ]);

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
          {filteredProducts.map(product => {
            const promoInfo = getProductActivePromo(product, activePromotions);
            return (
              <button
                key={product.id}
                disabled={showCheckout}
                onClick={() => handleProductClick(product)}
                className={`bg-white p-5 rounded-2xl border transition-all text-left flex flex-col justify-between active:scale-95 group relative overflow-hidden ${
                  promoInfo 
                    ? 'border-red-400 ring-2 ring-red-500/20 shadow-md hover:border-red-600 bg-gradient-to-b from-red-50/20 to-white' 
                    : 'border-slate-200 shadow-sm hover:shadow-xl hover:border-red-600'
                }`}
              >
                {promoInfo && (
                  <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-bl-xl shadow-sm flex items-center space-x-1">
                    <Icons.Tag size={10} />
                    <span>{promoInfo.discountLabel}</span>
                  </div>
                )}
                <div>
                  <div className="flex items-center space-x-1.5 mb-2.5">
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-black text-white inline-block">
                      {product.category}
                    </span>
                    {promoInfo && (
                      <span className="text-[8px] font-black uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        ★ Promo Hoy
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 leading-tight group-hover:text-red-600 transition-colors text-base">
                    {product.name}
                  </h3>
                  {promoInfo && (
                    <p className="text-[10px] font-bold text-red-600 mt-1 line-clamp-1">
                      {promoInfo.promo.name}
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  {promoInfo && promoInfo.promoPrice !== null ? (
                    <div className="flex items-baseline space-x-2">
                      <span className="text-xl font-black text-red-600">
                        ${promoInfo.promoPrice.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-slate-400 line-through">
                        ${product.price.toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xl font-black text-black">
                      ${product.price.toLocaleString()}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
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
        {/* Blocking Overlay if stale previous day shift is unclosed */}
        {staleOpenCashShift && (
          <div className="absolute inset-0 z-[70] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
            <div className="bg-amber-500/20 p-6 rounded-full mb-6 border border-amber-500/30">
              <Icons.Clock size={48} className="text-amber-500" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter mb-4 leading-tight">
              Turno Anterior Sin Cerrar
            </h3>
            <p className="text-slate-300 font-bold mb-3 max-w-sm uppercase text-xs tracking-wider leading-relaxed">
              Existe un turno abierto del día {new Date(staleOpenCashShift.openingTime).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} a cargo de {staleOpenCashShift.userName}.
            </p>
            <p className="text-amber-400 font-semibold mb-8 max-w-xs text-[11px] leading-relaxed">
              Para garantizar que el corte de hoy sea exacto y no se empalmen ventas, debes cerrar el turno anterior antes de iniciar operaciones.
            </p>
            <button 
              onClick={onShowShiftBlockModal || onCloseShift}
              className="px-8 py-4 bg-amber-500 text-black rounded-[2rem] font-black uppercase tracking-widest text-sm hover:bg-amber-400 transition-all shadow-2xl shadow-amber-500/20 active:scale-95"
            >
              Hacer Corte y Cerrar Turno Anterior
            </button>
          </div>
        )}

        {/* Blocking Overlay if no shift */}
        {!staleOpenCashShift && !hasOpenCashShift && (
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
              onClick={onShowShiftBlockModal || onOpenShift}
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
            {(hasOpenCashShift || staleOpenCashShift) && !showCheckout && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseShift();
                }}
                className={`p-2 transition ${staleOpenCashShift ? 'text-amber-500 hover:text-amber-400 animate-pulse' : 'text-slate-400 hover:text-red-600'}`}
                title={staleOpenCashShift ? "Cerrar Turno Anterior" : "Cerrar Caja"}
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
                className="text-slate-400 hover:text-red-600 p-1 transition flex items-center space-x-1"
                title="Volver al carrito (Esc)"
              >
                <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Esc</span>
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
                              const hasActiveOrder = orders.some(o => o.table?.trim().toLowerCase() === t.name.trim().toLowerCase() && o.type === 'dine-in' && !o.closedAt && o.status !== 'cancelled');
                              
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

                  {isAddingToExistingTable ? (
                    <div className="bg-amber-50 border-2 border-amber-200 p-5 rounded-2xl space-y-2">
                      <div className="flex items-center space-x-2 text-amber-900">
                        <Icons.Clock size={18} />
                        <span className="text-xs font-black uppercase tracking-tight">Mesa con Cuenta Abierta ({table})</span>
                      </div>
                      <p className="text-[11px] font-bold text-amber-800 leading-tight">
                        Los nuevos items se enviarán a cocina de inmediato y se añadirán a la cuenta existente para liquidarse al cerrar la mesa.
                      </p>
                      {existingOrder && (
                        <div className="pt-2 border-t border-amber-200/60 space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-amber-800 uppercase">
                            <span>Consumo acumulado previo:</span>
                            <span>${existingOrder.total.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs font-black text-amber-950 uppercase">
                            <span>Nuevos items por agregar:</span>
                            <span>+${total.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {((orderType === 'dine-in') || (orderType === 'takeaway' && takeawayType !== 'uber' && takeawayType !== 'didi')) && (
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">¿Cuándo se Paga?</h4>
                          <div className="grid grid-cols-2 gap-2">
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
                              <span>{orderType === 'dine-in' ? 'Al Cerrar Mesa' : 'Al Entregar'}</span>
                            </button>
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
                          </div>
                        </div>
                      )}

                      {((orderType === 'dine-in') || (orderType === 'takeaway' && takeawayType !== 'uber' && takeawayType !== 'didi')) && !payLater && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Forma de Pago</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {(['Efectivo', 'Tarjeta', 'Transferencia', 'Cortesía'] as PaymentMethod[]).map((method, mIdx) => {
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
                                    <div className="flex items-center space-x-2">
                                      <span className="font-black text-xs uppercase tracking-tight block">{method}</span>
                                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                        isSelected ? 'bg-red-200 text-red-800' : 'bg-slate-100 text-slate-400'
                                      }`}>
                                        [{mIdx + 1}]
                                      </span>
                                    </div>
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
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleCheckoutSubmit();
                                            } else if (e.key === 'Escape') {
                                              e.preventDefault();
                                              setShowCheckout(false);
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
                      
                      {/* Selector de Promoción o Descuento */}
                      <div className="pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center space-x-1.5">
                            <Icons.Tag className="text-red-600" />
                            <span>Promoción / Cupón</span>
                          </label>
                          {currentPromotion && (
                            <button
                              type="button"
                              onClick={() => setSelectedPromoId('none')}
                              className="text-[9px] font-black text-red-600 hover:underline uppercase tracking-tight"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                        {promotions.length === 0 ? (
                          <p className="text-[10px] text-slate-400 font-medium">No hay promociones configuradas en el sistema.</p>
                        ) : (
                          <div className="space-y-1.5">
                            <select
                              value={selectedPromoId === 'none' ? 'none' : (currentPromotion?.id || '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'none') {
                                  setSelectedPromoId('none');
                                } else if (val === '') {
                                  setSelectedPromoId(null);
                                } else {
                                  setSelectedPromoId(val);
                                }
                              }}
                              className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-red-600 outline-none font-bold text-xs uppercase"
                            >
                              <option value="">⚡ Automático (Mejor Promoción)</option>
                              <option value="none">-- Sin Promoción --</option>
                              {activePromotions.length > 0 && (
                                <optgroup label="★ Promociones Activas Hoy">
                                  {activePromotions.map(promo => (
                                    <option key={promo.id} value={promo.id}>
                                      {promo.name} ({promo.type === 'special_price' ? `Precio Especial $${promo.discountValue}` : promo.type === 'percentage' ? `${promo.discountValue}% OFF` : promo.type === 'two_for_one' ? '2x1' : promo.type === 'three_for_two' ? '3x2' : `-$${promo.discountValue}`})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {promotions.filter(p => !isPromotionActiveNow(p)).length > 0 && (
                                <optgroup label="Otras Promociones Programadas">
                                  {promotions.filter(p => !isPromotionActiveNow(p)).map(promo => (
                                    <option key={promo.id} value={promo.id}>
                                      {promo.name} (Programada)
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>

                            {currentPromotion && (
                              <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                                effectiveDiscount > 0 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                                  : 'bg-amber-50 border-amber-200 text-amber-900'
                              }`}>
                                <div className="text-[10px] font-black uppercase">
                                  <span>{currentPromotion.name}</span>
                                  {promoCalcResult.message ? (
                                    <p className="text-[9px] font-bold normal-case mt-0.5 opacity-90">{promoCalcResult.message}</p>
                                  ) : currentPromotion.description ? (
                                    <p className="text-[9px] font-medium normal-case mt-0.5 opacity-80">{currentPromotion.description}</p>
                                  ) : null}
                                </div>
                                <span className="text-sm font-black tracking-tight shrink-0 ml-2">
                                  {effectiveDiscount > 0 ? `-$${effectiveDiscount.toLocaleString()}` : 'No aplicable'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
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
                  </>
                )}
                </div>

                <div className="bg-black text-white p-6 rounded-3xl shadow-2xl space-y-5 border-t-4 border-red-600">
                   <div className="flex justify-between items-center opacity-60 text-[10px] font-black uppercase tracking-widest">
                      <span>{orderType === 'dine-in' ? 'Cuenta Mesa' : 'Total Caja'}</span>
                      <span>{cart.length} items</span>
                   </div>
                    <div className="flex flex-col border-b border-slate-800 pb-4">
                       <div className="flex justify-between items-center text-[10px] font-black opacity-60 uppercase mb-1">
                          <span>Subtotal</span>
                          <span>${rawSubtotal.toLocaleString()}</span>
                       </div>
                       {effectiveDiscount > 0 && (
                         <div className="flex justify-between items-center text-[10px] font-black text-green-400 uppercase mb-1">
                           <span>Descuento ({currentPromotion?.name || 'Promo'})</span>
                           <span>-${effectiveDiscount.toLocaleString()}</span>
                         </div>
                       )}
                       {!effectivePayLater && parseFloat(tipAmount) > 0 && (
                         <div className="flex justify-between items-center text-[10px] font-black text-red-400 uppercase mb-2">
                           <span>Propina</span>
                           <span>+ ${parseFloat(tipAmount).toLocaleString()}</span>
                         </div>
                       )}
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                            {effectivePayLater ? 'Total a Cargar en Cuenta' : 'Total a Pagar'}
                          </span>
                          <div className="text-4xl font-black tracking-tighter">
                            ${(total + (!effectivePayLater ? (parseFloat(tipAmount) || 0) : 0)).toLocaleString()}
                          </div>
                       </div>
                    </div>
                   <button 
                    onClick={handleCheckoutSubmit}
                    disabled={(orderType === 'dine-in' && !table.trim()) || isSubmitting || isSubmittingLocal}
                    className={`w-full py-4 rounded-xl font-black text-base uppercase tracking-widest transition shadow-lg active:scale-[0.98] flex items-center justify-center space-x-2 ${
                      (orderType === 'dine-in' && !table.trim()) || isSubmitting || isSubmittingLocal
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-red-900/40'
                    }`}
                  >
                    {(isSubmitting || isSubmittingLocal) ? (
                      <span>PROCESANDO...</span>
                    ) : (
                      <span>
                        {orderType === 'dine-in' 
                          ? (existingOrder 
                              ? 'AÑADIR A MESA (ENVIAR A COCINA)' 
                              : effectivePayLater 
                                ? 'ABRIR CUENTA MESA (ENVIAR A COCINA)' 
                                : 'PAGAR AHORA Y ENVIAR') 
                          : effectivePayLater 
                            ? 'ENVIAR PEDIDO (POR COBRAR)' 
                            : 'FINALIZAR COBRO'}
                      </span>
                    )}
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
                                      const modName = mod.modifierName || '';
                                      const isRemoval = modName.toLowerCase().includes('sin') || 
                                                        modName.toLowerCase().includes('quitar') || 
                                                        modName.toLowerCase().includes('remover') || 
                                                        modName.toLowerCase().includes('no ') || 
                                                        (mod.extraPrice || 0) <= 0;
                                      return (
                                        <span key={midx} className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter border ${
                                          isRemoval 
                                            ? 'bg-rose-50 text-rose-700 border-rose-100' 
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                          {isRemoval ? '' : '+ '}{modName || 'Extra'}
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
                      <div className="space-y-3">
                        {/* Chip informativo de promoción activa aplicada */}
                        {currentPromotion && effectiveDiscount > 0 && (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-900">
                            <div className="flex items-center space-x-2">
                              <Icons.Tag size={15} className="text-emerald-600 shrink-0" />
                              <div>
                                <p className="text-[10px] font-black uppercase leading-tight">{currentPromotion.name}</p>
                                <p className="text-[9px] text-emerald-700 font-bold">Ahorras -${effectiveDiscount.toLocaleString()}</p>
                              </div>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setSelectedPromoId('none')}
                              className="text-[9px] font-black text-slate-400 hover:text-red-600 uppercase tracking-wider px-1.5 py-0.5 rounded hover:bg-white"
                              title="Quitar promoción"
                            >
                              Quitar
                            </button>
                          </div>
                        )}

                        {selectedPromoId === 'none' && bestAutoPromo && (
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-slate-600">
                            <span className="text-[9px] font-bold">Promo desactivada ({bestAutoPromo.name})</span>
                            <button 
                              type="button" 
                              onClick={() => setSelectedPromoId(null)}
                              className="text-[9px] font-black text-red-600 uppercase hover:underline"
                            >
                              Reactivar
                            </button>
                          </div>
                        )}

                        <div className="space-y-1">
                          {effectiveDiscount > 0 && (
                            <div className="flex justify-between items-center px-1 text-xs font-bold text-slate-400">
                              <span>Subtotal:</span>
                              <span className="line-through">${rawSubtotal.toLocaleString()}</span>
                            </div>
                          )}
                          {effectiveDiscount > 0 && (
                            <div className="flex justify-between items-center px-1 text-xs font-black text-emerald-600">
                              <span>Descuento ({currentPromotion?.name}):</span>
                              <span>-${effectiveDiscount.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center px-1">
                            <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Monto:</span>
                            <span className="text-3xl font-black text-black tracking-tighter">${total.toLocaleString()}</span>
                          </div>
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
                  <p className="text-[10px] text-slate-400 font-mono text-center pt-2">
                    Teclado: [0-9] PIN • [C] Limpiar • [Esc] Volver
                  </p>
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
