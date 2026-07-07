import React, { useMemo, useState } from 'react';
import { CashShift } from '../types';
import { Icons } from '../constants';
import { printCashShiftTicketHTML } from '../services/thermalPrinter';

interface CashShiftViewProps {
  cashShifts: CashShift[];
  onOpenSettings: () => void;
  restaurantName?: string;
}

const CashShiftView: React.FC<CashShiftViewProps> = ({ cashShifts, onOpenSettings, restaurantName }) => {
  const [cashSearch, setCashSearch] = useState('');
  const [cashSort, setCashSort] = useState<{ field: keyof CashShift | 'date'; order: 'asc' | 'desc' }>({ field: 'date', order: 'desc' });
  const [expandedCashId, setExpandedCashId] = useState<string | null>(null);

  const processedCashShifts = useMemo(() => {
    let list = [...cashShifts];

    if (cashSearch.trim()) {
      const q = cashSearch.toLowerCase();
      list = list.filter(s => 
        s.userName.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q)) ||
        (s.status === 'open' ? 'abierta' : 'cerrada').includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: any = a[cashSort.field as keyof CashShift];
      let valB: any = b[cashSort.field as keyof CashShift];

      if (cashSort.field === 'date') {
        valA = new Date(a.openingTime).getTime();
        valB = new Date(b.openingTime).getTime();
      } else if (cashSort.field === 'difference') {
        valA = a.difference || 0;
        valB = b.difference || 0;
      }

      if (valA < valB) return cashSort.order === 'asc' ? -1 : 1;
      if (valA > valB) return cashSort.order === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [cashShifts, cashSearch, cashSort]);

  const handleCashSort = (field: keyof CashShift | 'date') => {
    setCashSort(prev => ({
      field,
      order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden">
      <div className="p-6 md:p-8 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-black text-black tracking-tighter uppercase">Cierres de Caja</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historial de aperturas y cortes</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:w-72 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icons.Search size={14} />
            </div>
            <input
              type="text"
              placeholder="Buscar usuario o notas..."
              value={cashSearch}
              onChange={e => setCashSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-xs font-bold transition-all"
            />
          </div>
          <button
            onClick={onOpenSettings}
            className="w-full sm:w-auto px-4 py-3 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Icons.Settings size={14} />
            <span>Ajustes</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 cursor-pointer">
              <th className="px-8 py-6 hover:bg-slate-100 transition" onClick={() => handleCashSort('status')}>
                Estado {cashSort.field === 'status' && (cashSort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-8 py-6 hover:bg-slate-100 transition" onClick={() => handleCashSort('userName')}>
                Usuario {cashSort.field === 'userName' && (cashSort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-8 py-6 hover:bg-slate-100 transition" onClick={() => handleCashSort('date')}>
                Apertura {cashSort.field === 'date' && (cashSort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-8 py-6">Cierre</th>
              <th className="px-8 py-6 text-right hover:bg-slate-100 transition" onClick={() => handleCashSort('initialFund')}>
                Fondo Inicial {cashSort.field === 'initialFund' && (cashSort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-8 py-6 text-right hover:bg-slate-100 transition" onClick={() => handleCashSort('expectedAmount')}>
                Esperado {cashSort.field === 'expectedAmount' && (cashSort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-8 py-6 text-right hover:bg-slate-100 transition" onClick={() => handleCashSort('actualAmount')}>
                Real {cashSort.field === 'actualAmount' && (cashSort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-8 py-6 text-right hover:bg-slate-100 transition" onClick={() => handleCashSort('difference')}>
                Diferencia {cashSort.field === 'difference' && (cashSort.order === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {processedCashShifts.map(shift => {
              const hasDifference = shift.difference !== undefined && shift.difference !== 0;
              const isPositive = shift.difference && shift.difference > 0;
              const isExpanded = expandedCashId === shift.id;
              
              return (
                <React.Fragment key={shift.id}>
                  <tr 
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedCashId(isExpanded ? null : shift.id)}
                  >
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        shift.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {shift.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs font-black uppercase tracking-tight text-black">{shift.userName}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-[10px] font-bold text-slate-400">{new Date(shift.openingTime).toLocaleDateString()}</p>
                      <p className="text-[10px] font-black text-black">{new Date(shift.openingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-8 py-6">
                      {shift.closingTime ? (
                        <>
                          <p className="text-[10px] font-bold text-slate-400">{new Date(shift.closingTime).toLocaleDateString()}</p>
                          <p className="text-[10px] font-black text-black">{new Date(shift.closingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </>
                      ) : (
                        <span className="text-[10px] font-black text-slate-300 italic">En curso...</span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-xs font-black text-black">${shift.initialFund.toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-xs font-black text-black">${shift.expectedAmount !== undefined ? shift.expectedAmount.toLocaleString() : '-'}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-xs font-black text-black">${shift.actualAmount !== undefined ? shift.actualAmount.toLocaleString() : '-'}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {shift.difference !== undefined ? (
                        <div className="flex justify-end items-center gap-2">
                          <p className={`text-xs font-black ${hasDifference ? (isPositive ? 'text-green-600' : 'text-red-600') : 'text-slate-400'}`}>
                            {isPositive ? '+' : ''}${shift.difference.toLocaleString()}
                          </p>
                          <span className="text-slate-400 ml-2">
                            {isExpanded ? <Icons.ChevronUp size={14} /> : <Icons.ChevronDown size={14} />}
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-end items-center gap-2">
                          <span className="text-xs font-black text-slate-300">-</span>
                          <span className="text-slate-400 ml-2">
                            {isExpanded ? <Icons.ChevronUp size={14} /> : <Icons.ChevronDown size={14} />}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-50 border-b border-t border-slate-100">
                      <td colSpan={8} className="px-8 py-6">
                        <div className="space-y-6">
                          <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-1 space-y-4">
                              <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Información Adicional</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1">ID Turno</p>
                                  <p className="text-xs font-mono text-slate-600 truncate">{shift.id}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1">Usuario ID</p>
                                  <p className="text-xs font-mono text-slate-600 truncate">{shift.userId}</p>
                                </div>
                              </div>
                              <div className="pt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    printCashShiftTicketHTML(shift, restaurantName || 'DOSPOS');
                                  }}
                                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 shadow active:scale-95"
                                >
                                  <Icons.Printer size={12} />
                                  <span>{shift.status === 'open' ? 'Imprimir Estado de Turno' : 'Reimprimir Corte (Ticket)'}</span>
                                </button>
                              </div>
                            </div>
                            {shift.notes && (
                              <div className="flex-1 space-y-4">
                                <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Notas</h4>
                                <div className="bg-white p-4 rounded-xl border border-slate-200">
                                  <p className="text-xs font-medium text-slate-700 whitespace-pre-line leading-relaxed">{shift.notes}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {shift.status === 'closed' && shift.expectedCash !== undefined && (
                            <div className="pt-4 border-t border-slate-200/60">
                              <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3">Arqueo Detallado por Medio de Pago</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">1. Efectivo (Fondo + Ventas)</p>
                                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                                    <span>Esperado:</span>
                                    <span className="font-bold">${(shift.expectedCash || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                                    <span>Contado Real:</span>
                                    <span className="font-bold">${(shift.actualCash || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs pt-1 border-t border-slate-100 font-black">
                                    <span>Diferencia:</span>
                                    <span className={shift.differenceCash && shift.differenceCash < 0 ? 'text-red-600' : 'text-green-600'}>
                                      {shift.differenceCash && shift.differenceCash >= 0 ? '+' : ''}${(shift.differenceCash || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">2. Tarjeta</p>
                                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                                    <span>Esperado:</span>
                                    <span className="font-bold">${(shift.expectedTarjeta || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                                    <span>Contado Real:</span>
                                    <span className="font-bold">${(shift.actualTarjeta || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs pt-1 border-t border-slate-100 font-black">
                                    <span>Diferencia:</span>
                                    <span className={shift.differenceTarjeta && shift.differenceTarjeta < 0 ? 'text-red-600' : 'text-green-600'}>
                                      {shift.differenceTarjeta && shift.differenceTarjeta >= 0 ? '+' : ''}${(shift.differenceTarjeta || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">3. Transferencia Bancaria</p>
                                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                                    <span>Esperado:</span>
                                    <span className="font-bold">${(shift.expectedTransferencia || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                                    <span>Contado Real:</span>
                                    <span className="font-bold">${(shift.actualTransferencia || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs pt-1 border-t border-slate-100 font-black">
                                    <span>Diferencia:</span>
                                    <span className={shift.differenceTransferencia && shift.differenceTransferencia < 0 ? 'text-red-600' : 'text-green-600'}>
                                      {shift.differenceTransferencia && shift.differenceTransferencia >= 0 ? '+' : ''}${(shift.differenceTransferencia || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {processedCashShifts.length === 0 && (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Icons.History size={32} />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No hay registros de caja para tu búsqueda</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashShiftView;
