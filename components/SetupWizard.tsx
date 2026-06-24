
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User } from '../types';
import { Icons } from '../constants';

interface SetupWizardProps {
  onComplete: (adminUser: User) => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (name.length < 3) {
      setError('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    if (pin.length !== 4) {
      setError('El PIN debe ser de 4 dígitos.');
      return;
    }
    if (pin !== confirmPin) {
      setError('Los PINs no coinciden.');
      return;
    }

    const adminUser: User = {
      id: 'admin-1',
      name,
      pin,
      role: 'Admin'
    };

    onComplete(adminUser);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[3rem] shadow-2xl p-8 md:p-12 max-w-lg w-full border-2 border-black"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-black text-white rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
             <span className="text-red-500"><Icons.ChefHat size={40} /></span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-tight italic">
            Configuración <span className="text-red-600">Inicial</span>
          </h1>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-2 px-10">
            Bienvenido. Registra el perfil de administrador principal para comenzar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Nombre del Administrador</label>
            <input 
              type="text" 
              placeholder="Ej. Juan Pérez"
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-red-600 outline-none font-bold text-slate-800 transition-all shadow-inner"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Asignar PIN (4 Dígitos)</label>
              <input 
                type="password" 
                maxLength={4}
                placeholder="••••"
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-red-600 outline-none font-black text-center text-lg tracking-[0.5em] transition-all shadow-inner"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Confirmar PIN</label>
              <input 
                type="password" 
                maxLength={4}
                placeholder="••••"
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-red-600 outline-none font-black text-center text-lg tracking-[0.5em] transition-all shadow-inner"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border border-red-100 italic">
              {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-[0.3em] text-xs hover:bg-slate-800 transition shadow-2xl relative overflow-hidden group"
          >
            <span className="relative z-10">Completar Instalación</span>
            <div className="absolute inset-0 bg-red-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </button>
        </form>
        
        <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-ping"></div>
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Esperando configuración de base de datos</p>
        </div>
      </motion.div>
    </div>
  );
};
