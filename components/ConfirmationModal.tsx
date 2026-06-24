
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '../constants';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger'
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white max-w-sm w-full rounded-[2.5rem] shadow-2xl relative overflow-hidden"
        >
          <div className="p-8 space-y-6 text-center">
            <div className={`mx-auto w-16 h-16 rounded-3xl flex items-center justify-center mb-2 ${
              type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {type === 'danger' ? <Icons.Trash className="w-8 h-8" /> : <Icons.Settings className="w-8 h-8" />}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-black uppercase tracking-tighter">{title}</h3>
              <p className="text-xs font-bold text-slate-500 leading-relaxed italic">{message}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={onClose}
                className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition active:scale-95"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition active:scale-95 ${
                  type === 'danger' ? 'bg-red-600 hover:bg-black shadow-red-100' : 'bg-black hover:bg-slate-800'
                 }`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmationModal;
