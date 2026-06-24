
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { Icons } from '../constants';

interface LoginViewProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, onLogin }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      
      if (newPin.length === 4) {
        if (selectedUser && newPin === selectedUser.pin) {
          onLogin(selectedUser);
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 1000);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[80vh]">
        
        {/* Left Side: User Selection */}
        <div className={`w-full md:w-1/2 p-8 border-r border-slate-100 flex flex-col ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">Sistema POS</h1>
            <p className="text-slate-500 font-medium tracking-tight">Selecciona tu usuario para ingresar</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-1 gap-3">
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(user);
                    setPin('');
                  }}
                  className={`flex items-center p-4 rounded-2xl transition-all duration-300 ${
                    selectedUser?.id === user.id 
                    ? 'bg-red-600 text-white shadow-xl scale-[1.02]' 
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
                    selectedUser?.id === user.id ? 'bg-white/20' : 'bg-slate-200'
                  }`}>
                    <Icons.User size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-black uppercase tracking-tight leading-none mb-1">{user.name}</p>
                    <p className={`text-xs font-bold uppercase tracking-widest ${
                      selectedUser?.id === user.id ? 'text-white/70' : 'text-slate-400'
                    }`}>{user.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: PIN Entry */}
        <div className={`w-full md:w-1/2 p-8 bg-slate-50 flex flex-col items-center justify-center relative ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
          {selectedUser && (
            <button 
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 left-4 md:hidden p-2 text-slate-400 flex items-center space-x-2"
            >
              <Icons.ArrowLeft size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Volver</span>
            </button>
          )}
          <AnimatePresence mode="wait">
            {!selectedUser ? (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Icons.CheckCircle size={40} />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-widest">Esperando selección</p>
              </motion.div>
            ) : (
              <motion.div 
                key="keypad"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-sm"
              >
                <div className="text-center mb-8">
                  <p className="text-slate-400 font-black uppercase tracking-widest text-xs mb-2">Ingresa tu PIN</p>
                  <div className="flex justify-center gap-4">
                    {[0, 1, 2, 3].map(i => (
                      <div 
                        key={i}
                        className={`w-4 h-4 rounded-full transition-all duration-200 ${
                          i < pin.length 
                          ? (error ? 'bg-red-500 scale-125' : 'bg-red-600 scale-125') 
                          : 'bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => handlePinInput(num.toString())}
                      className="h-16 rounded-2xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all text-xl font-black text-slate-700 hover:bg-red-600 hover:text-white"
                    >
                      {num}
                    </button>
                  ))}
                  <button 
                    onClick={() => setPin('')}
                    className="h-16 rounded-2xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all text-sm font-black text-slate-400 uppercase tracking-widest"
                  >
                    Borrar
                  </button>
                  <button
                    onClick={() => handlePinInput('0')}
                    className="h-16 rounded-2xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all text-xl font-black text-slate-700 hover:bg-red-600 hover:text-white"
                  >
                    0
                  </button>
                  <button
                    onClick={handleBackspace}
                    className="h-16 rounded-2xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center text-slate-400 hover:text-red-600"
                  >
                    <Icons.Minus size={24} />
                  </button>
                </div>
                
                {error && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-6 text-center text-red-500 font-black uppercase tracking-widest text-xs"
                  >
                    PIN INCORRECTO
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
};
