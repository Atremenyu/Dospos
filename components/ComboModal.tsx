import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Product, ComboOption } from '../types';

interface ComboModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: (isCombo: boolean, selectedOptions: ComboOption[]) => void;
}

const ComboModal: React.FC<ComboModalProps> = ({ product, onClose, onConfirm }) => {
  const [isCombo, setIsCombo] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<ComboOption[]>([]);

  const [selectedOption, setSelectedOption] = useState<ComboOption | null>(null);

  const totalExtra = selectedOption ? selectedOption.extraPrice : 0;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl"
      >
        <div className="p-8">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2 text-center">{product.name}</h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-8 text-center">¿Cómo lo deseas?</p>

            {!isCombo ? (
                <div className="space-y-4">
                    <button
                        onClick={() => onConfirm(false, [])}
                        className="w-full flex items-center justify-between p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-black transition-all"
                    >
                        <span className="font-black uppercase tracking-widest text-sm">Sencilla</span>
                        <span className="font-black text-black">${product.price.toLocaleString()}</span>
                    </button>
                    <button
                        onClick={() => setIsCombo(true)}
                        className="w-full flex items-center justify-between p-6 bg-red-50 rounded-2xl border-2 border-red-600 hover:bg-red-100 transition-all"
                    >
                        <span className="font-black uppercase tracking-widest text-sm text-red-700">Combo</span>
                        <span className="font-black text-red-700">Seleccionar</span>
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-4">Selecciona el combo:</h3>
                    <div className="space-y-2">
                        {product.comboOptions?.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setSelectedOption(opt)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                    selectedOption?.id === opt.id
                                    ? 'border-red-600 bg-red-50'
                                    : 'border-slate-100'
                                }`}
                            >
                                <span className={`font-bold text-xs ${selectedOption?.id === opt.id ? 'text-red-700' : ''}`}>{opt.label}</span>
                                <span className="font-black text-xs">${opt.extraPrice.toLocaleString()}</span>
                            </button>
                        ))}
                    </div>
                    <button
                        disabled={!selectedOption}
                        onClick={() => onConfirm(true, selectedOption ? [selectedOption] : [])}
                        className="w-full mt-6 p-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl disabled:bg-slate-300"
                    >
                        Confirmar Combo (${(product.price + totalExtra).toLocaleString()})
                    </button>
                </div>
            )}
        </div>
      </motion.div>
    </div>
  );
};
export default ComboModal;
