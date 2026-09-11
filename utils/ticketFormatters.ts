import { Order, StoreSettings } from '../types';

/**
 * Formatea una fecha a DD/MM/YYYY (ej. 06/09/2026)
 */
export const formatReceiptDate = (isoOrDate?: string | Date): string => {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formatea una hora a formato de 12 horas con segundos y sufijo 'p. m.' / 'a. m.'
 * Ejemplo: 03:53:46 p. m.
 */
export const formatReceiptTime12 = (isoOrDate?: string | Date): string => {
  if (!isoOrDate) return '-';
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return '-';
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const isPM = hours >= 12;
  const ampm = isPM ? 'p. m.' : 'a. m.';
  
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = String(hours).padStart(2, '0');

  return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
};

/**
 * Formatea fecha y hora completa para el pie de impresión: DD/MM/YYYY HH:mm:ss
 * Ejemplo: 06/09/2026 15:55:57
 */
export const formatReceiptDateTime24 = (isoOrDate?: string | Date): string => {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

/**
 * Helper con objeto date, time y formatted
 */
export const formatDateTime = (isoOrDate?: string | Date) => {
  return {
    date: formatReceiptDate(isoOrDate),
    time: formatReceiptTime12(isoOrDate),
    formatted: formatReceiptDateTime24(isoOrDate)
  };
};

/**
 * Obtiene el número de movimiento/folio consistente
 */
export const getMovementNumber = (order: Order): string => {
  if (order.movementNumber) return String(order.movementNumber);
  const numericOnly = order.id.replace(/\D/g, '');
  if (numericOnly.length >= 4) {
    return numericOnly.slice(-4);
  }
  return String(Math.abs(order.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 1000)) % 9000 + 1000);
};

/**
 * Obtiene el número de orden corto (ej. 23)
 */
export const getOrderShortNumber = (order: Order): string => {
  if (order.orderNumber) return String(order.orderNumber);
  const numericOnly = order.id.replace(/\D/g, '');
  if (numericOnly.length >= 2) {
    const num = parseInt(numericOnly.slice(-2), 10);
    return String(num > 0 ? num : 23);
  }
  return order.id.slice(-3);
};

/**
 * Obtiene el nombre o número limpio de la mesa
 */
export const getCleanTableLabel = (order: Order): string => {
  if (order.type !== 'dine-in') {
    if (order.takeawayType === 'delivery') return 'Domicilio';
    if (order.takeawayType === 'uber') return 'Uber Eats';
    if (order.takeawayType === 'didi') return 'DiDi Food';
    return 'Mostrador';
  }
  if (!order.table) return '1';
  // Si viene como "Mesa 9", dejar solo "9" si es numérico o la mesa completa
  const cleaned = order.table.replace(/^mesa\s*/i, '').trim();
  return cleaned || order.table;
};

/**
 * Obtiene el subtítulo de servicio (ej. "Venta en Mesa")
 */
export const getServiceTitle = (order: Order): string => {
  if (order.type === 'dine-in') {
    return 'Venta en Mesa';
  }
  if (order.takeawayType === 'delivery') {
    return 'Servicio a Domicilio';
  }
  if (order.takeawayType === 'uber') {
    return 'Venta Uber Eats';
  }
  if (order.takeawayType === 'didi') {
    return 'Venta DiDi Food';
  }
  return 'Venta en Mostrador';
};

/**
 * Desglosa subtotal, IVA y gran total
 */
export const calculateTaxBreakdown = (
  total: number,
  taxRate: number = 16,
  includeTaxBreakdown: boolean = true
): { subtotal: number; iva: number; taxAmount: number; granTotal: number } => {
  const granTotal = total;
  if (!includeTaxBreakdown || taxRate <= 0) {
    return {
      subtotal: granTotal,
      iva: 0,
      taxAmount: 0,
      granTotal
    };
  }

  // En restaurantes el precio incluye IVA (Tasa en % ej. 16%)
  // Subtotal = Total / (1 + (taxRate / 100))
  const subtotal = Math.round((granTotal / (1 + taxRate / 100)) * 100) / 100;
  const iva = Math.round((granTotal - subtotal) * 100) / 100;

  return {
    subtotal,
    iva,
    taxAmount: iva,
    granTotal
  };
};

/**
 * Resuelve las formas de pago desglosadas con monto recibido, propina y cambio
 */
export interface PaymentSummaryRow {
  nombre: string;
  monto: number;
  propina: number;
  cambio: number;
}

export const getPaymentSummaryRows = (order: Order): PaymentSummaryRow[] => {
  if (order.payments && order.payments.length > 0) {
    return order.payments.map((p) => {
      const tip = p.tip || 0;
      const received = p.receivedAmount !== undefined && p.receivedAmount > 0 
        ? p.receivedAmount 
        : (order.receivedAmount && order.payments.length === 1 ? order.receivedAmount : p.amount + tip);
      
      const change = p.change !== undefined 
        ? p.change 
        : (order.changeAmount && order.payments.length === 1 ? order.changeAmount : Math.max(0, received - (p.amount + tip)));

      return {
        nombre: p.method || 'Efectivo',
        monto: received,
        propina: tip,
        cambio: change
      };
    });
  }

  // Fallback si la orden no tiene arreglo de payments
  const tip = order.tip || 0;
  const received = order.receivedAmount !== undefined && order.receivedAmount > 0 
    ? order.receivedAmount 
    : order.total + tip;
  const change = order.changeAmount !== undefined 
    ? order.changeAmount 
    : Math.max(0, received - (order.total + tip));

  return [
    {
      nombre: order.payment || (order.isPaid ? 'Efectivo' : 'Pendiente'),
      monto: received,
      propina: tip,
      cambio: change
    }
  ];
};
