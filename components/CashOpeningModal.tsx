
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Icons } from '../constants';

interface CashShiftModalProps {
  onOpen: (fund: number) => void;
  onClose: () => void;
}

const CashShiftModal: React.FC<CashShiftModalProps> = ({ onOpen, onClose }) => {
  const [fund, setFund] = useState<string>('0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpen(parseFloat(fund) || 0);
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md overflow-y-auto"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-md my-auto overflow-hidden shadow-2xl"
      >
        <div className="p-6 sm:p-10 text-center">
          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 border border-red-100">
            <Icons.DollarSign className="text-red-600 w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1 sm:mb-2">Apertura de Caja</h2>
          <p className="text-slate-500 font-bold text-[10px] sm:text-xs uppercase tracking-widest mb-4 sm:mb-8">Ingresa el fondo inicial (morralla)</p>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="relative">
              <span className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl sm:text-2xl">$</span>
              <input 
                type="number"
                value={fund}
                onChange={e => setFund(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-4 sm:pr-6 py-4 sm:py-6 bg-slate-50 rounded-2xl sm:rounded-3xl border-2 border-slate-100 focus:border-red-600 outline-none text-2xl sm:text-4xl font-black tracking-tighter transition-all"
                placeholder="0.00"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[100, 200, 500].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFund(val.toString())}
                  className="py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-600 transition-colors"
                >
                  ${val}
                </button>
              ))}
            </div>

            <div className="flex flex-col space-y-2 sm:space-y-3 pt-2 sm:pt-4">
              <button 
                type="submit"
                className="w-full py-4 sm:py-5 bg-red-600 text-white rounded-2xl sm:rounded-[2rem] font-black uppercase tracking-widest text-xs sm:text-sm hover:bg-red-700 transition shadow-xl shadow-red-200"
              >
                Abrir Turno de Caja
              </button>
              <button 
                type="button"
                onClick={onClose}
                className="w-full py-2.5 sm:py-4 text-slate-400 font-black uppercase tracking-widest text-[9px] sm:text-[10px] hover:text-slate-600 transition"
              >
                Más Tarde
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default CashShiftModal;
