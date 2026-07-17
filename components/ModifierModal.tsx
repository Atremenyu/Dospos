
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, ModifierGroup, SelectedModifier, Modifier } from '../types';
import { Icons } from '../constants';

interface ModifierModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: (selectedModifiers: SelectedModifier[], note: string) => void;
}

const ModifierModal: React.FC<ModifierModalProps> = ({ product, onClose, onConfirm }) => {
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    product.modifierGroups?.forEach(group => {
      initial[group.id] = [];
    });
    return initial;
  });
  const [activeGroups, setActiveGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    product.modifierGroups?.forEach(group => {
      // Obligatory groups are active by default, optional ones start collapsed
      initial[group.id] = group.isRequired;
    });
    return initial;
  });
  const [note, setNote] = useState('');

  const calculateTotalExtras = useMemo(() => {
    let total = 0;
    product.modifierGroups?.forEach(group => {
      if (!activeGroups[group.id]) return;
      const selectedIds = selections[group.id] || [];
      selectedIds.forEach(modId => {
        const modifier = group.modifiers.find(m => m.id === modId);
        if (modifier) total += modifier.extraPrice;
      });
    });
    return total;
  }, [product, selections, activeGroups]);

  const toggleModifier = (groupId: string, modifier: Modifier, isRequired: boolean, maxSelection: number) => {
    setSelections(prev => {
      const currentGroupSelections = prev[groupId] || [];
      
      // If maxSelection is 1, it's a radio-like behavior
      if (maxSelection === 1) {
        if (currentGroupSelections.includes(modifier.id)) {
          // Can only deselect if not required
          return isRequired ? prev : { ...prev, [groupId]: [] };
        }
        return { ...prev, [groupId]: [modifier.id] };
      }

      // Multiple selection behavior
      if (currentGroupSelections.includes(modifier.id)) {
        return { ...prev, [groupId]: currentGroupSelections.filter(id => id !== modifier.id) };
      }

      if (currentGroupSelections.length < maxSelection) {
        return { ...prev, [groupId]: [...currentGroupSelections, modifier.id] };
      }

      return prev;
    });
  };

  const handleConfirm = () => {
    // Validate required groups
    const missingRequired = product.modifierGroups?.some(group => {
      return group.isRequired && (!selections[group.id] || selections[group.id].length < group.minSelection);
    });

    if (missingRequired) {
      alert('Por favor completa las selecciones obligatorias');
      return;
    }

    const finalModifiers: SelectedModifier[] = [];
    product.modifierGroups?.forEach(group => {
      if (!activeGroups[group.id]) return;
      const selectedIds = selections[group.id] || [];
      selectedIds.forEach(modId => {
        const modifier = group.modifiers.find(m => m.id === modId);
        if (modifier) {
          finalModifiers.push({
            modifierId: modifier.id,
            modifierName: modifier.name,
            extraPrice: modifier.extraPrice
          });
        }
      });
    });

    onConfirm(finalModifiers, note);
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-red-500/10"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">
              {product.name}
            </h2>
            <p className="text-slate-500 font-medium">${product.price.toFixed(2)} Base</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
            <Icons.X size={28} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {product.modifierGroups?.map(group => (
            <div key={group.id} className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg">{group.name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {group.isRequired ? 'Obligatorio' : 'Opcional'} • 
                    {group.maxSelection === 1 ? ' Elige uno' : ` Máx. ${group.maxSelection}`}
                  </p>
                </div>
                {group.isRequired ? (
                  (selections[group.id]?.length || 0) >= group.minSelection && (
                    <div className="bg-green-100 text-green-600 p-1.5 rounded-lg">
                      <Icons.Check size={20} />
                    </div>
                  )
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] font-black uppercase text-slate-400">
                      {activeGroups[group.id] ? 'Activo' : 'Inactivo'}
                    </span>
                    <button
                      onClick={() => {
                        const nextActive = !activeGroups[group.id];
                        setActiveGroups(prev => ({ ...prev, [group.id]: nextActive }));
                        if (!nextActive) {
                          setSelections(prev => ({ ...prev, [group.id]: [] }));
                        }
                      }}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                        activeGroups[group.id] ? 'bg-red-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          activeGroups[group.id] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>

              <AnimatePresence initial={false}>
                {activeGroups[group.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {group.modifiers.map(modifier => {
                        const isSelected = selections[group.id]?.includes(modifier.id);
                        return (
                          <button
                            key={modifier.id}
                            onClick={() => toggleModifier(group.id, modifier, group.isRequired, group.maxSelection)}
                            className={`
                              flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left
                              ${isSelected 
                                ? 'border-red-600 bg-red-50 ring-4 ring-red-600/5' 
                                : 'border-slate-100 bg-white hover:border-slate-300'}
                            `}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`
                                w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                ${isSelected ? 'bg-red-600 border-red-600' : 'border-slate-300'}
                              `}>
                                {isSelected && <Icons.Check size={14} className="text-white" />}
                              </div>
                              <span className={`font-black uppercase text-xs tracking-tight ${isSelected ? 'text-red-700' : 'text-slate-600'}`}>
                                {modifier.name}
                              </span>
                            </div>
                            {modifier.extraPrice > 0 && (
                              <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                                +${modifier.extraPrice}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {/* Notes Section */}
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
               <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg">Notas Especiales</h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mt-1">Indicaciones extras para cocina</p>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Extra salsa, sin cebolla, etc..."
              className="w-full h-32 p-4 rounded-3xl border-2 border-slate-100 focus:border-red-600 focus:ring-0 transition-all font-medium text-slate-600 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-6 px-2">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen de Cargo</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-sm font-bold text-slate-500">${product.price.toFixed(2)}</span>
                <span className="text-xs text-slate-400">+</span>
                <span className="text-sm font-bold text-green-600">${calculateTotalExtras.toFixed(2)} extras</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total del Item</p>
              <p className="text-3xl font-black text-slate-900 tracking-tighter">
                ${(product.price + calculateTotalExtras).toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={handleConfirm}
            className="w-full py-5 bg-red-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm hover:bg-red-700 transition shadow-xl shadow-red-200 active:scale-[0.98]"
          >
            Agregar al Carrito
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ModifierModal;
