
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '../constants';

interface CashClosingModalProps {
  expectedAmount: number;
  initialFund: number;
  salesTotal: number;
  onConfirm: (actualAmount: number, notes?: string) => void;
  onClose: () => void;
}

const CashClosingModal: React.FC<CashClosingModalProps> = ({ 
  expectedAmount, 
  initialFund,
  salesTotal,
  onConfirm, 
  onClose 
}) => {
  const [actualAmount, setActualAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isCalculated, setIsCalculated] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCalculated) {
      setIsCalculated(true);
    } else {
      onConfirm(parseFloat(actualAmount) || 0, notes);
    }
  };

  const difference = (parseFloat(actualAmount) || 0) - expectedAmount;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-lg my-auto overflow-hidden shadow-2xl"
      >
        <div className="p-6 sm:p-10">
          <div className="text-center mb-4 sm:mb-8">
            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 border border-white/10 text-white">
              <Icons.History className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1 sm:mb-2">Cierre de Caja</h2>
            <p className="text-slate-500 font-bold text-[10px] sm:text-xs uppercase tracking-widest">Verificación de efectivo y arqueo</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {!isCalculated ? (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 sm:mb-2 ml-1 sm:ml-2">Monto Contado en Caja</label>
                  <div className="relative">
                    <span className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl sm:text-2xl">$</span>
                    <input 
                      type="number"
                      step="0.01"
                      value={actualAmount}
                      onChange={e => setActualAmount(e.target.value)}
                      className="w-full pl-10 sm:pl-12 pr-4 sm:pr-6 py-4 sm:py-6 bg-slate-50 rounded-2xl sm:rounded-3xl border-2 border-slate-100 focus:border-black outline-none text-2xl sm:text-4xl font-black tracking-tighter transition-all"
                      placeholder="0.00"
                      autoFocus
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 sm:mb-2 ml-1 sm:ml-2">Notas del Turno (Opcional)</label>
                  <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 rounded-xl sm:rounded-2xl border-2 border-slate-100 focus:border-black outline-none text-xs sm:text-sm font-medium transition-all"
                    placeholder="Observaciones sobre faltantes, sobrantes o incidentes..."
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-50 rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 space-y-4 sm:space-y-6 border border-slate-200"
              >
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-100">
                    <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Monto Esperado</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">${expectedAmount.toFixed(2)}</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-100">
                    <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Monto Real</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">${parseFloat(actualAmount).toFixed(2)}</p>
                  </div>
                </div>

                <div className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl flex items-center justify-between ${
                  Math.abs(difference) < 0.01 
                    ? 'bg-green-100 text-green-900 border border-green-200' 
                    : difference > 0 
                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                      : 'bg-red-100 text-red-900 border border-red-200'
                }`}>
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-60">
                      {Math.abs(difference) < 0.01 ? 'Caja Cuadrada' : difference > 0 ? 'Sobrante' : 'Faltante'}
                    </p>
                    <h4 className="text-2xl sm:text-3xl font-black tracking-tighter">
                      {difference >= 0 ? '+' : ''}{difference.toFixed(2)}
                    </h4>
                  </div>
                  <div className="opacity-40">
                    {Math.abs(difference) < 0.01 ? <Icons.Check className="w-6 h-6 sm:w-8 sm:h-8" /> : <Icons.AlertCircle className="w-6 h-6 sm:w-8 sm:h-8" />}
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2 border-t border-slate-200 pt-3 sm:pt-4">
                   <div className="flex justify-between text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 sm:px-2">
                     <span>Fondo Inicial</span>
                     <span className="text-slate-600">${initialFund.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 sm:px-2">
                     <span>Ventas del Turno</span>
                     <span className="text-slate-600">${salesTotal.toFixed(2)}</span>
                   </div>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col space-y-2 sm:space-y-3 pt-2 sm:pt-4">
              <button 
                type="submit"
                className="w-full py-4 sm:py-5 bg-black text-white rounded-2xl sm:rounded-[2rem] font-black uppercase tracking-widest text-xs sm:text-sm hover:bg-slate-900 transition shadow-xl shadow-slate-200"
              >
                {!isCalculated ? 'Calcular Arqueo' : 'Confirmar Cierre de Caja'}
              </button>
              <button 
                type="button"
                onClick={isCalculated ? () => setIsCalculated(false) : onClose}
                className="w-full py-2.5 sm:py-4 text-slate-400 font-black uppercase tracking-widest text-[9px] sm:text-[10px] hover:text-slate-600 transition"
              >
                {isCalculated ? 'Corregir Monto' : 'Cancelar'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default CashClosingModal;
