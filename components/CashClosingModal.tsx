import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '../constants';

interface CashClosingModalProps {
  expectedAmount: number;
  initialFund: number;
  salesTotal: number;
  expectedCash: number;
  expectedTarjeta: number;
  expectedTransferencia: number;
  expectedOtros: number;
  expectedCourtesy: number;
  onConfirm: (actualCash: number, actualTarjeta: number, actualTransferencia: number, notes?: string) => void;
  onClose: () => void;
  openingTime?: string;
}

const CashClosingModal: React.FC<CashClosingModalProps> = ({ 
  expectedAmount, 
  initialFund,
  salesTotal,
  expectedCash,
  expectedTarjeta,
  expectedTransferencia,
  expectedOtros,
  expectedCourtesy,
  onConfirm, 
  onClose,
  openingTime
}) => {
  const [actualCash, setActualCash] = useState<string>('');
  const [actualTarjeta, setActualTarjeta] = useState<string>('');
  const [actualTransferencia, setActualTransferencia] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isCalculated, setIsCalculated] = useState(false);

  const realCash = parseFloat(actualCash) || 0;
  const realTarjeta = parseFloat(actualTarjeta) || 0;
  const realTransferencia = parseFloat(actualTransferencia) || 0;

  const diffCash = realCash - expectedCash;
  const diffTarjeta = realTarjeta - expectedTarjeta;
  const diffTransferencia = realTransferencia - expectedTransferencia;

  const totalActual = realCash + realTarjeta + realTransferencia;
  const totalDifference = totalActual - expectedAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCalculated) {
      setIsCalculated(true);
    } else {
      onConfirm(realCash, realTarjeta, realTransferencia, notes);
    }
  };

  const handleFillExpected = (type: 'cash' | 'tarjeta' | 'transferencia') => {
    if (type === 'cash') {
      setActualCash(expectedCash.toFixed(2));
    } else if (type === 'tarjeta') {
      setActualTarjeta(expectedTarjeta.toFixed(2));
    } else if (type === 'transferencia') {
      setActualTransferencia(expectedTransferencia.toFixed(2));
    }
  };

  const handleFillAll = () => {
    setActualCash(expectedCash.toFixed(2));
    setActualTarjeta(expectedTarjeta.toFixed(2));
    setActualTransferencia(expectedTransferencia.toFixed(2));
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
        className="bg-white rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-xl my-auto overflow-hidden shadow-2xl border border-slate-100"
      >
        <div className="p-6 sm:p-10">
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-lg">
              <Icons.History className="w-7 h-7" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1">Cierre de Caja</h2>
            {openingTime && (
              <p className="text-red-600 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider mb-2">
                Turno abierto desde: {new Date(openingTime).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
            <p className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest">Arqueo detallado por medio de pago</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {!isCalculated ? (
              <div className="space-y-5">
                <div className="flex justify-between items-center bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">¿Todo coincide?</span>
                  <button
                    type="button"
                    onClick={handleFillAll}
                    className="text-[9px] font-black uppercase tracking-widest bg-slate-200 text-slate-800 hover:bg-black hover:text-white px-3 py-1.5 rounded-lg transition-all"
                  >
                    Llenar todos los esperados
                  </button>
                </div>

                <div className="space-y-4">
                  {/* EFECTIVO */}
                  <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">
                        1. Efectivo Contado (Fondo + Ventas)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleFillExpected('cash')}
                        className="text-[9px] font-bold text-slate-400 hover:text-black transition flex items-center gap-1"
                      >
                        Esperado: <span className="font-black text-slate-600">${expectedCash.toFixed(2)}</span>
                        <Icons.Check className="w-3 h-3 text-green-500" />
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">$</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={actualCash}
                        onChange={e => setActualCash(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-white rounded-2xl border-2 border-slate-200/80 focus:border-black outline-none text-xl font-black tracking-tight transition-all"
                        placeholder="0.00"
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  {/* TARJETA */}
                  <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">
                        2. Comprobantes de Tarjeta
                      </label>
                      <button
                        type="button"
                        onClick={() => handleFillExpected('tarjeta')}
                        className="text-[9px] font-bold text-slate-400 hover:text-black transition flex items-center gap-1"
                      >
                        Esperado: <span className="font-black text-slate-600">${expectedTarjeta.toFixed(2)}</span>
                        <Icons.Check className="w-3 h-3 text-green-500" />
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">$</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={actualTarjeta}
                        onChange={e => setActualTarjeta(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-white rounded-2xl border-2 border-slate-200/80 focus:border-black outline-none text-xl font-black tracking-tight transition-all"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  {/* TRANSFERENCIA */}
                  <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">
                        3. Comprobantes de Transferencia
                      </label>
                      <button
                        type="button"
                        onClick={() => handleFillExpected('transferencia')}
                        className="text-[9px] font-bold text-slate-400 hover:text-black transition flex items-center gap-1"
                      >
                        Esperado: <span className="font-black text-slate-600">${expectedTransferencia.toFixed(2)}</span>
                        <Icons.Check className="w-3 h-3 text-green-500" />
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">$</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={actualTransferencia}
                        onChange={e => setActualTransferencia(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-white rounded-2xl border-2 border-slate-200/80 focus:border-black outline-none text-xl font-black tracking-tight transition-all"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                </div>

                {expectedOtros > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-[10px] font-medium flex items-center gap-2">
                    <Icons.AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Ventas en Apps (Uber/Didi): <strong>${expectedOtros.toFixed(2)}</strong>. No se cuentan físicamente aquí porque se depositan automáticamente.
                    </span>
                  </div>
                )}

                {expectedCourtesy > 0 && (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 text-[10px] font-medium flex items-center gap-2">
                    <Icons.Gift className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                      Cortesías Autorizadas: <strong>${expectedCourtesy.toFixed(2)}</strong>. Son órdenes de cortesía ($0.00 de ingreso real) y no se cuentan aquí.
                    </span>
                  </div>
                )}
                
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Notas del Turno (Opcional)</label>
                  <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-black outline-none text-xs font-medium transition-all"
                    placeholder="Observaciones sobre faltantes, sobrantes o incidentes..."
                    rows={2}
                  />
                </div>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-50 rounded-[2rem] p-5 sm:p-6 space-y-5 border border-slate-200"
              >
                {/* Desglose de resultados */}
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">Arqueo por Categoría</h3>
                <div className="space-y-3">
                  {/* EFECTIVO DETALLE */}
                  <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">1. Efectivo</p>
                      <p className="text-xs text-slate-600">Esp: ${expectedCash.toFixed(2)} | Real: ${realCash.toFixed(2)}</p>
                    </div>
                    <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                      Math.abs(diffCash) < 0.01 ? 'bg-slate-100 text-slate-500' : diffCash > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {Math.abs(diffCash) < 0.01 ? 'Cabal' : diffCash > 0 ? `+${diffCash.toFixed(2)}` : `${diffCash.toFixed(2)}`}
                    </span>
                  </div>

                  {/* TARJETA DETALLE */}
                  <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">2. Tarjeta</p>
                      <p className="text-xs text-slate-600">Esp: ${expectedTarjeta.toFixed(2)} | Real: ${realTarjeta.toFixed(2)}</p>
                    </div>
                    <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                      Math.abs(diffTarjeta) < 0.01 ? 'bg-slate-100 text-slate-500' : diffTarjeta > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {Math.abs(diffTarjeta) < 0.01 ? 'Cabal' : diffTarjeta > 0 ? `+${diffTarjeta.toFixed(2)}` : `${diffTarjeta.toFixed(2)}`}
                    </span>
                  </div>

                  {/* TRANSFERENCIA DETALLE */}
                  <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">3. Transferencia</p>
                      <p className="text-xs text-slate-600">Esp: ${expectedTransferencia.toFixed(2)} | Real: ${realTransferencia.toFixed(2)}</p>
                    </div>
                    <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                      Math.abs(diffTransferencia) < 0.01 ? 'bg-slate-100 text-slate-500' : diffTransferencia > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {Math.abs(diffTransferencia) < 0.01 ? 'Cabal' : diffTransferencia > 0 ? `+${diffTransferencia.toFixed(2)}` : `${diffTransferencia.toFixed(2)}`}
                    </span>
                  </div>
                </div>

                {/* TOTAL GENERAL */}
                <div className={`p-4 sm:p-5 rounded-2xl flex items-center justify-between ${
                  Math.abs(totalDifference) < 0.01 
                    ? 'bg-green-100 text-green-900 border border-green-200' 
                    : totalDifference > 0 
                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                      : 'bg-red-100 text-red-900 border border-red-200'
                }`}>
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-60">
                      {Math.abs(totalDifference) < 0.01 ? 'Diferencia General (Caja Cuadrada)' : totalDifference > 0 ? 'Diferencia General (Sobrante)' : 'Diferencia General (Faltante)'}
                    </p>
                    <h4 className="text-2xl sm:text-3xl font-black tracking-tighter">
                      {totalDifference >= 0 ? '+' : ''}{totalDifference.toFixed(2)}
                    </h4>
                    <p className="text-[10px] font-bold mt-1 opacity-70">
                      Fondo + Ventas Esp: ${expectedAmount.toFixed(2)} | Contado Total: ${totalActual.toFixed(2)}
                    </p>
                  </div>
                  <div className="opacity-40 shrink-0">
                    {Math.abs(totalDifference) < 0.01 ? <Icons.Check className="w-8 h-8" /> : <Icons.AlertCircle className="w-8 h-8" />}
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2 border-t border-slate-200 pt-3.5">
                   <div className="flex justify-between text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
                     <span>Fondo Inicial de Caja</span>
                     <span className="text-slate-600">${initialFund.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
                     <span>Ventas Registradas del Turno</span>
                     <span className="text-slate-600">${salesTotal.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
                     <span>Total Esperado en Caja (Fondo + Ventas)</span>
                     <span className="text-slate-600">${expectedAmount.toFixed(2)}</span>
                   </div>
                </div>

                <div className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest border-t border-slate-100 pt-3">
                  🖨️ Se imprimirá un comprobante térmico automáticamente
                </div>
              </motion.div>
            )}

            <div className="flex flex-col space-y-2 pt-2">
              <button 
                type="submit"
                className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-900 transition-all shadow-lg active:scale-95"
              >
                {!isCalculated ? 'Calcular Diferencias' : 'Cerrar Caja e Imprimir Ticket'}
              </button>
              <button 
                type="button"
                onClick={isCalculated ? () => setIsCalculated(false) : onClose}
                className="w-full py-3 text-slate-400 font-black uppercase tracking-widest text-[9px] hover:text-slate-600 transition"
              >
                {isCalculated ? 'Corregir Montos' : 'Cancelar'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default CashClosingModal;
