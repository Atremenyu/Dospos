import React, { useState } from 'react';
import { Promotion, PromotionType, Product, Category } from '../types';
import { Icons } from '../constants';
import ConfirmationModal from './ConfirmationModal';
import { isPromotionActiveNow } from '../utils/promotionsEngine';

interface PromotionsManagerProps {
  promotions: Promotion[];
  onUpdatePromotions: (promotions: Promotion[]) => void;
  products: Product[];
  categories: Category[];
}

const DAYS_OF_WEEK = [
  { day: 1, label: 'Lun', full: 'Lunes' },
  { day: 2, label: 'Mar', full: 'Martes' },
  { day: 3, label: 'Mié', full: 'Miércoles' },
  { day: 4, label: 'Jue', full: 'Jueves' },
  { day: 5, label: 'Vie', full: 'Viernes' },
  { day: 6, label: 'Sáb', full: 'Sábado' },
  { day: 0, label: 'Dom', full: 'Domingo' },
];

const PROMOTION_TYPE_LABELS: Record<PromotionType, { label: string; desc: string; icon: string }> = {
  two_for_one: { label: '2x1 (Lleva 2, paga 1)', desc: 'El segundo producto de menor valor es gratis', icon: '🍻' },
  three_for_two: { label: '3x2 (Lleva 3, paga 2)', desc: 'El tercer producto de menor valor es gratis', icon: '🍔' },
  percentage: { label: 'Porcentaje de Descuento (%)', desc: 'Descuento porcentual en productos o cuenta', icon: '🏷️' },
  fixed_amount: { label: 'Monto Fijo en Pesos ($)', desc: 'Descuento en dinero directo del total', icon: '💵' },
  special_price: { label: 'Precio Especial Fijo', desc: 'Fija el precio unitario a un monto promocional', icon: '⭐' },
};

const DEFAULT_TEMPLATES: Partial<Promotion>[] = [
  {
    name: '2x1 en Cervezas',
    description: 'Aplica los Jueves y Viernes en bebidas',
    type: 'two_for_one',
    discountValue: 100,
    daysOfWeek: [4, 5],
    startTime: '16:00',
    endTime: '22:00',
    isActive: true
  },
  {
    name: 'Happy Hour 20% OFF',
    description: '20% de descuento de 18:00 a 20:00 hrs',
    type: 'percentage',
    discountValue: 20,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '18:00',
    endTime: '20:00',
    isActive: true
  },
  {
    name: '$50 de Descuento en la Cuenta',
    description: 'En consumos mínimos de $350 los fines de semana',
    type: 'fixed_amount',
    discountValue: 50,
    minOrderAmount: 350,
    daysOfWeek: [5, 6, 0],
    isActive: true
  }
];

export const PromotionsManager: React.FC<PromotionsManagerProps> = ({
  promotions,
  onUpdatePromotions,
  products,
  categories
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; promoId: string | null }>({
    isOpen: false,
    promoId: null
  });

  // Form states
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<PromotionType>('two_for_one');
  const [formDiscountValue, setFormDiscountValue] = useState<number>(10);
  const [formMinOrderAmount, setFormMinOrderAmount] = useState<number | undefined>(undefined);
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([]);
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formTargetType, setFormTargetType] = useState<'all' | 'categories' | 'products'>('all');
  const [formCategories, setFormCategories] = useState<string[]>([]);
  const [formProducts, setFormProducts] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);

  const openCreateModal = (template?: Partial<Promotion>) => {
    setEditingPromo(null);
    setFormName(template?.name || '');
    setFormDescription(template?.description || '');
    setFormType(template?.type || 'two_for_one');
    setFormDiscountValue(template?.discountValue || 10);
    setFormMinOrderAmount(template?.minOrderAmount || undefined);
    setFormDaysOfWeek(template?.daysOfWeek || []);
    setFormStartTime(template?.startTime || '');
    setFormEndTime(template?.endTime || '');
    setFormTargetType('all');
    setFormCategories(template?.applicableCategories || []);
    setFormProducts(template?.applicableProductIds || []);
    setFormIsActive(template?.isActive !== undefined ? template.isActive : true);
    setIsModalOpen(true);
  };

  const openEditModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormName(promo.name);
    setFormDescription(promo.description || '');
    setFormType(promo.type);
    setFormDiscountValue(promo.discountValue);
    setFormMinOrderAmount(promo.minOrderAmount);
    setFormDaysOfWeek(promo.daysOfWeek || []);
    setFormStartTime(promo.startTime || '');
    setFormEndTime(promo.endTime || '');
    if (promo.applicableProductIds && promo.applicableProductIds.length > 0) {
      setFormTargetType('products');
    } else if (promo.applicableCategories && promo.applicableCategories.length > 0) {
      setFormTargetType('categories');
    } else {
      setFormTargetType('all');
    }
    setFormCategories(promo.applicableCategories || []);
    setFormProducts(promo.applicableProductIds || []);
    setFormIsActive(promo.isActive);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      alert('El nombre de la promoción es obligatorio');
      return;
    }

    const newPromotion: Promotion = {
      id: editingPromo ? editingPromo.id : `promo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      type: formType,
      discountValue: Number(formDiscountValue) || 0,
      minOrderAmount: formMinOrderAmount ? Number(formMinOrderAmount) : undefined,
      daysOfWeek: formDaysOfWeek,
      startTime: formStartTime || undefined,
      endTime: formEndTime || undefined,
      applicableCategories: formTargetType === 'categories' ? formCategories : undefined,
      applicableProductIds: formTargetType === 'products' ? formProducts : undefined,
      isActive: formIsActive,
      updatedAt: new Date().toISOString()
    };

    if (editingPromo) {
      onUpdatePromotions(promotions.map(p => p.id === editingPromo.id ? newPromotion : p));
    } else {
      onUpdatePromotions([newPromotion, ...promotions]);
    }

    setIsModalOpen(false);
  };

  const togglePromoActive = (id: string, current: boolean) => {
    onUpdatePromotions(promotions.map(p => {
      if (p.id === id) {
        return { ...p, isActive: !current, updatedAt: new Date().toISOString() };
      }
      return p;
    }));
  };

  const handleDelete = () => {
    if (!deleteConfirm.promoId) return;
    onUpdatePromotions(promotions.filter(p => p.id !== deleteConfirm.promoId));
    setDeleteConfirm({ isOpen: false, promoId: null });
  };

  const toggleDay = (day: number) => {
    setFormDaysOfWeek(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleCategory = (cat: string) => {
    setFormCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleProduct = (prodId: string) => {
    setFormProducts(prev => 
      prev.includes(prodId) ? prev.filter(id => id !== prodId) : [...prev, prodId]
    );
  };

  const filteredPromotions = promotions.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🏷️</span>
            <h2 className="text-2xl font-black text-black uppercase tracking-tight">Promociones y Descuentos</h2>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
            Configura 2x1, 3x2, descuentos por día o Happy Hour aplicables en el punto de venta
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Buscar promoción..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black"
            />
            <span className="absolute left-3 top-3 text-slate-400">
              <Icons.Search size={14} />
            </span>
          </div>

          <button
            onClick={() => openCreateModal()}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center space-x-2 shrink-0"
          >
            <Icons.Plus size={16} />
            <span>Nueva Promoción</span>
          </button>
        </div>
      </div>

      {/* Quick Templates Bar */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Plantillas rápidas recomendadas:</p>
        <div className="flex flex-wrap gap-2.5">
          {DEFAULT_TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              onClick={() => openCreateModal(tmpl)}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 shadow-xs"
            >
              <span>+</span>
              <span>{tmpl.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Promotions Grid */}
      {filteredPromotions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-[2.5rem] border border-slate-200 p-8">
          <div className="text-4xl mb-3">🏷️</div>
          <h3 className="text-lg font-black uppercase tracking-tight text-slate-700">No hay promociones configuradas</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-6">
            Crea promociones para consentir a tus clientes con 2x1, descuentos por día o Happy Hour en horarios específicos.
          </p>
          <button
            onClick={() => openCreateModal()}
            className="px-6 py-3 bg-black text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition"
          >
            Crear Primera Promoción
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPromotions.map(promo => {
            const typeInfo = PROMOTION_TYPE_LABELS[promo.type] || { label: promo.type, desc: '', icon: '🏷️' };
            const isCurrentlyActive = promo.isActive && isPromotionActiveNow(promo);
            return (
              <div 
                key={promo.id}
                className={`bg-white rounded-[2rem] p-6 border transition-all shadow-sm flex flex-col justify-between ${
                  promo.isActive ? (isCurrentlyActive ? 'border-emerald-300 ring-2 ring-emerald-50' : 'border-slate-200 hover:border-slate-400') : 'border-slate-100 opacity-60 bg-slate-50/50'
                }`}
              >
                <div>
                  {/* Top Bar with Status Toggle */}
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-2xl">{typeInfo.icon}</span>
                    <div className="flex items-center space-x-1.5">
                      {promo.isActive && (
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          isCurrentlyActive 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {isCurrentlyActive ? '★ Activa Hoy' : '📅 Programada'}
                        </span>
                      )}
                      <button
                        onClick={() => togglePromoActive(promo.id, promo.isActive)}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition flex items-center space-x-1.5 ${
                          promo.isActive 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${promo.isActive ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                        <span>{promo.isActive ? 'Habilitada' : 'Inactiva'}</span>
                      </button>
                    </div>
                  </div>

                  <h4 className="text-base font-black text-black uppercase tracking-tight mb-1">{promo.name}</h4>
                  {promo.description && (
                    <p className="text-xs text-slate-500 font-medium mb-3">{promo.description}</p>
                  )}

                  {/* Type Badge */}
                  <div className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider mb-4 border border-slate-200">
                    {promo.type === 'percentage' && `${promo.discountValue}% de descuento`}
                    {promo.type === 'fixed_amount' && `$${promo.discountValue} pesos de descuento`}
                    {promo.type === 'two_for_one' && 'Promoción 2x1'}
                    {promo.type === 'three_for_two' && 'Promoción 3x2'}
                    {promo.type === 'special_price' && `Precio especial: $${promo.discountValue}`}
                  </div>

                  {/* Rules summary */}
                  <div className="space-y-2 text-[11px] font-bold text-slate-600 mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    {/* Days */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[9px] tracking-widest">Días:</span>
                      <div className="flex space-x-1">
                        {DAYS_OF_WEEK.map(d => {
                          const isDayActive = !promo.daysOfWeek || promo.daysOfWeek.length === 0 || promo.daysOfWeek.includes(d.day);
                          return (
                            <span 
                              key={d.day}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black ${
                                isDayActive ? 'bg-black text-white' : 'bg-slate-200 text-slate-400 opacity-40'
                              }`}
                              title={d.full}
                            >
                              {d.label[0]}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Schedule */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[9px] tracking-widest">Horario:</span>
                      <span className="font-mono text-[10px]">
                        {promo.startTime && promo.endTime ? `${promo.startTime} a ${promo.endTime} hrs` : 'Todo el día'}
                      </span>
                    </div>

                    {/* Minimum consumption */}
                    {promo.minOrderAmount && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 uppercase text-[9px] tracking-widest">Mínimo:</span>
                        <span>${promo.minOrderAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => openEditModal(promo)}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="Editar Promoción"
                  >
                    <Icons.Settings size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ isOpen: true, promoId: promo.id })}
                    className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                    title="Eliminar Promoción"
                  >
                    <Icons.Trash size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 my-8">
            <div className="p-6 md:p-8 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-black uppercase tracking-tight">
                  {editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Reglas de descuento y condiciones de aplicación
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-black hover:bg-slate-200 transition"
              >
                <Icons.X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Name & Description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Nombre de la Promoción *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Ej. 2x1 en Cervezas Nacionales"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Descripción o Leyenda (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder="Ej. Válido en cervezas seleccionadas los jueves"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              {/* Promotion Type */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Tipo de Promoción *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(PROMOTION_TYPE_LABELS) as PromotionType[]).map(typeKey => {
                    const info = PROMOTION_TYPE_LABELS[typeKey];
                    const isSelected = formType === typeKey;
                    return (
                      <button
                        type="button"
                        key={typeKey}
                        onClick={() => setFormType(typeKey)}
                        className={`p-3.5 rounded-xl border text-left transition ${
                          isSelected 
                            ? 'border-black bg-black text-white shadow-md' 
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="text-base mb-1">{info.icon}</div>
                        <div className="font-black text-xs uppercase tracking-tight">{info.label}</div>
                        <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {info.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Discount Value for % or fixed amount */}
              {(formType === 'percentage' || formType === 'fixed_amount' || formType === 'special_price') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      {formType === 'percentage' && 'Porcentaje de Descuento (%) *'}
                      {formType === 'fixed_amount' && 'Monto a Descontar ($) *'}
                      {formType === 'special_price' && 'Precio Promocional por Unidad ($) *'}
                    </label>
                    <input
                      type="number"
                      value={formDiscountValue}
                      onChange={e => setFormDiscountValue(parseFloat(e.target.value) || 0)}
                      min="1"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-black text-lg focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      Consumo Mínimo Requerido (Opcional)
                    </label>
                    <input
                      type="number"
                      value={formMinOrderAmount || ''}
                      onChange={e => setFormMinOrderAmount(e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Days of Week */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Días de la Semana Válidos
                  <span className="text-slate-400 font-normal ml-2">(Si ninguno está marcado, aplica todos los días)</span>
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_OF_WEEK.map(d => {
                    const isSelected = formDaysOfWeek.includes(d.day);
                    return (
                      <button
                        type="button"
                        key={d.day}
                        onClick={() => toggleDay(d.day)}
                        className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition border ${
                          isSelected 
                            ? 'bg-red-600 text-white border-red-600 shadow-sm' 
                            : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Schedule / Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Hora Inicio (Opcional)
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={e => setFormStartTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Hora Fin (Opcional)
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={e => setFormEndTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              {/* Scope / Target */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  ¿A qué productos aplica?
                </label>
                <div className="flex gap-2 mb-3">
                  {[
                    { id: 'all', label: 'Toda la Carta' },
                    { id: 'categories', label: 'Categorías Específicas' },
                    { id: 'products', label: 'Productos Específicos' }
                  ].map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setFormTargetType(t.id as any)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition border ${
                        formTargetType === t.id 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {formTargetType === 'categories' && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                    {categories.map(cat => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition border ${
                          formCategories.includes(cat) 
                            ? 'bg-red-600 text-white border-red-600' 
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {formTargetType === 'products' && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                    {products.map(prod => (
                      <button
                        type="button"
                        key={prod.id}
                        onClick={() => toggleProduct(prod.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition border ${
                          formProducts.includes(prod.id) 
                            ? 'bg-red-600 text-white border-red-600' 
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {prod.name} (${prod.price})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <p className="font-black text-xs uppercase tracking-tight">Habilitar Promoción Inmediatamente</p>
                  <p className="text-[10px] text-slate-500 font-medium">Estará disponible en el punto de venta</p>
                </div>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={e => setFormIsActive(e.target.checked)}
                  className="w-5 h-5 accent-black rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 md:p-8 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md"
              >
                {editingPromo ? 'Guardar Cambios' : 'Crear Promoción'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        title="Eliminar Promoción"
        message="¿Estás seguro de que deseas eliminar esta promoción? Esta acción no se puede deshacer."
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, promoId: null })}
      />
    </div>
  );
};

export default PromotionsManager;
