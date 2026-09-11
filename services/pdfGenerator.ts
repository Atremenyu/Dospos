import { jsPDF } from 'jspdf';
import { Order, StoreSettings } from '../types';
import { storage } from './storage';
import { numberToWordsSpanish } from '../utils/numberToWords';
import {
  formatReceiptDate,
  formatReceiptTime12,
  formatReceiptDateTime24,
  getMovementNumber,
  getOrderShortNumber,
  getCleanTableLabel,
  getServiceTitle,
  calculateTaxBreakdown,
  getPaymentSummaryRows
} from '../utils/ticketFormatters';

/**
 * Resuelve las configuraciones del negocio para el PDF
 */
const resolveSettings = (settingsOrName?: StoreSettings | string): StoreSettings => {
  const currentSettings = storage.getSettings();

  if (!settingsOrName) {
    return currentSettings;
  }

  if (typeof settingsOrName === 'string') {
    return {
      ...currentSettings,
      name: settingsOrName || currentSettings.name
    };
  }

  return {
    ...currentSettings,
    ...settingsOrName
  };
};

/**
 * Genera el archivo PDF del ticket con el formato exacto del perfil y la imagen física:
 * - Tipo de ticket (Ticket de Pagado / Preticket) y Tipo de Venta
 * - Nombre y dirección completa del negocio, teléfono y RFC
 * - Movimiento y Fecha de operación
 * - Orden, Mesa, Personas, Mesero, Horas (Entrada, Preticket, Cierre)
 * - Artículos con Cant., Descripción e Importe
 * - Conteo de artículos
 * - Desglose Subtotal, IVA y Gran Total
 * - Cantidad en letras en español
 * - Tabla de Formas de Pago (Nombre, Monto, Propina, Cambio)
 * - Terminal y Fecha de impresión
 */
export const generateTicketPDF = (
  order: Order,
  settingsOrName?: StoreSettings | string,
  options?: { isPreticket?: boolean; waiterName?: string; terminalName?: string }
) => {
  const settings = resolveSettings(settingsOrName);
  const isPreticket = options?.isPreticket || (!order.isPaid && order.status !== 'delivered');

  const ticketMainTitle = isPreticket ? 'Preticket de Cuenta' : 'Ticket de Pagado';
  const serviceSubtitle = getServiceTitle(order);

  const movement = getMovementNumber(order);
  const operationDate = formatReceiptDate(order.date);
  const orderNum = getOrderShortNumber(order);
  const tableLabel = getCleanTableLabel(order);
  const diners = order.diners || settings.defaultDiners || 1;
  const waiter = options?.waiterName || order.waiter || 'ADMINISTRACION';

  const entryTime = formatReceiptTime12(order.date);
  const preticketTime = isPreticket 
    ? formatReceiptTime12(new Date()) 
    : (order.preticketPrintedAt ? formatReceiptTime12(order.preticketPrintedAt) : '-');
  const closeTime = isPreticket 
    ? '-' 
    : (order.closedAt ? formatReceiptTime12(order.closedAt) : (order.isPaid ? formatReceiptTime12(order.payments?.[0]?.timestamp || order.date) : '-'));

  const { subtotal, iva, granTotal } = calculateTaxBreakdown(
    order.total,
    settings.taxRate,
    settings.includeTaxBreakdown
  );

  const currencyName = settings.currencyText || (settings.currency === 'USD' ? 'DÓLARES' : 'PESOS');
  const currencySuffix = settings.currency === 'USD' ? 'USD' : 'M.N.';
  const amountInWords = numberToWordsSpanish(granTotal, currencyName, currencySuffix);

  const paymentRows = getPaymentSummaryRows(order);
  const terminalLabel = options?.terminalName || settings.terminalName || '1 -- SERVER1';
  const printTimestamp = formatReceiptDateTime24(new Date());

  const showAddress = settings.showTicketAddress !== false;
  const showPhone = settings.showTicketPhone !== false;
  const showTaxId = settings.showTicketTaxId !== false;
  const showHeaderMsg = settings.showTicketHeaderMsg !== false;
  const showDate = settings.showTicketDate !== false;
  const showOrderNum = settings.showTicketOrderNum !== false;
  const showTable = settings.showTicketTable !== false;
  const showWaiter = settings.showTicketWaiter !== false;
  const showTimes = settings.showTicketTimes !== false;
  const showDeliveryAddress = settings.showTicketDeliveryAddress !== false;
  const showTotalArticles = settings.showTicketTotalArticles !== false;
  const showSubtotal = settings.showTicketSubtotal !== false;
  const showTax = settings.showTicketTax !== false && (settings.includeTaxBreakdown !== false) && settings.taxRate > 0;
  const showAmountInWords = settings.showTicketAmountInWords !== false;
  const showPaymentDetails = settings.showTicketPaymentDetails !== false;
  const showTerminal = settings.showTicketTerminal !== false;
  const showFooterMsg = settings.showTicketFooterMsg !== false;

  // 1. Estimación previa de altura para el PDF dinámico
  let estimatedHeight = 45; // Encabezado, negocio y metadatos
  if (showDate) estimatedHeight += 8;
  if (showTimes) {
    estimatedHeight += 4;
    if (preticketTime !== '-') estimatedHeight += 3.5;
    if (!isPreticket && closeTime !== '-') estimatedHeight += 3.5;
  }
  if (showDeliveryAddress && order.address) estimatedHeight += 12;

  order.items.forEach((item) => {
    estimatedHeight += 4;
    if (item.selectedModifiers) estimatedHeight += item.selectedModifiers.length * 3.5;
    if (item.selectedComboOptions) estimatedHeight += item.selectedComboOptions.length * 3.5;
    if (item.note) estimatedHeight += 4;
  });

  if (showTotalArticles) estimatedHeight += 6;
  estimatedHeight += 18; // Totales base (Gran Total y márgenes)
  if (showSubtotal) estimatedHeight += 3.5;
  if (showTax) estimatedHeight += 3.5;
  if (showAmountInWords) estimatedHeight += 10;
  if (showPaymentDetails && !isPreticket && order.isPaid && paymentRows.length > 0) estimatedHeight += 14 + paymentRows.length * 4; // Formas de pago
  if (showTerminal) estimatedHeight += 14; // Terminal, fecha impresión y pie
  if (showFooterMsg && settings.receiptFooter) estimatedHeight += 8;

  const pdfWidth = 72; // Ancho térmico de 72mm
  const doc = new jsPDF({
    unit: 'mm',
    format: [pdfWidth, Math.max(120, estimatedHeight + 15)],
  });

  const marginX = 4;
  const contentWidth = pdfWidth - marginX * 2;
  const centerX = pdfWidth / 2;
  const rightX = pdfWidth - marginX;

  const drawDashedLine = (currY: number) => {
    doc.setDrawColor(80, 80, 80);
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.2);
    doc.line(marginX, currY, rightX, currY);
    doc.setLineDashPattern([], 0); // Reset
  };

  let y = 6;

  // Título Principal
  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.text(ticketMainTitle.toUpperCase(), centerX, y, { align: 'center' });
  y += 4;

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text(serviceSubtitle.toUpperCase(), centerX, y, { align: 'center' });
  y += 3.5;

  drawDashedLine(y);
  y += 4;

  // Perfil del negocio
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.text((settings.name || 'DOS RODRIGUEZ').toUpperCase(), centerX, y, { align: 'center' });
  y += 3.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  if (showAddress && settings.address) {
    doc.text(settings.address.toUpperCase(), centerX, y, { align: 'center' });
    y += 3.2;
  }
  if (showAddress && settings.addressLine2) {
    doc.text(settings.addressLine2.toUpperCase(), centerX, y, { align: 'center' });
    y += 3.2;
  }
  if (showPhone && settings.phone) {
    doc.text(`TEL: ${settings.phone}`, centerX, y, { align: 'center' });
    y += 3.2;
  }
  if (showTaxId && settings.taxId) {
    doc.text(`RFC: ${settings.taxId.toUpperCase()}`, centerX, y, { align: 'center' });
    y += 3.2;
  }
  if (showHeaderMsg && settings.receiptHeader) {
    doc.setFontSize(7.5);
    doc.text(settings.receiptHeader, centerX, y, { align: 'center' });
    y += 3.2;
  }

  // Metadatos de operación
  if (showDate) {
    drawDashedLine(y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    doc.text('Fecha operación:', marginX, y);
    doc.text(operationDate, rightX, y, { align: 'right' });
    y += 4.5;
  }

  // Orden, Mesa, Mesero y Horas
  if (showOrderNum || showTable || showWaiter || showTimes) {
    drawDashedLine(y);
    y += 4;
    doc.setFontSize(8);

    if (showOrderNum) {
      doc.setFont('courier', 'normal');
      doc.text('Orden:', marginX, y);
      doc.setFont('courier', 'bold');
      doc.text(orderNum, rightX, y, { align: 'right' });
      y += 3.5;
    }

    if (showTable) {
      doc.setFont('courier', 'normal');
      doc.text('Mesa:', marginX, y);
      doc.setFont('courier', 'bold');
      doc.text(tableLabel, rightX, y, { align: 'right' });
      y += 3.5;
    }

    if (showWaiter) {
      doc.setFont('courier', 'normal');
      doc.text('Mesero:', marginX, y);
      doc.setFont('courier', 'bold');
      doc.text(waiter.toUpperCase(), rightX, y, { align: 'right' });
      y += 3.5;
    }

    if (showTimes) {
      doc.setFont('courier', 'normal');
      doc.text('Hora Entrada:', marginX, y);
      doc.text(entryTime, rightX, y, { align: 'right' });
      y += 3.5;

      if (preticketTime !== '-') {
        doc.text('Hora Impresión:', marginX, y);
        doc.text(preticketTime, rightX, y, { align: 'right' });
        y += 3.5;
      }

      if (!isPreticket && closeTime !== '-') {
        doc.text('Hora Cierre:', marginX, y);
        doc.text(closeTime, rightX, y, { align: 'right' });
        y += 3.5;
      }
    }
  }

  if (showDeliveryAddress && order.address) {
    y += 1;
    doc.setFontSize(7.5);
    doc.setFont('courier', 'bold');
    doc.text('DIRECCIÓN ENTREGA:', marginX, y);
    y += 3;
    doc.setFont('courier', 'normal');
    const addrLines = doc.splitTextToSize(order.address.toUpperCase(), contentWidth);
    addrLines.forEach((line: string) => {
      doc.text(line, marginX, y);
      y += 3;
    });
    if (order.client) {
      doc.text(`Cliente: ${order.client.toUpperCase()}`, marginX, y);
      y += 3;
    }
  }

  drawDashedLine(y);
  y += 3.5;

  // Encabezado de artículos
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text('Cant.', marginX, y);
  doc.text('Descripción', marginX + 9, y);
  doc.text('Importe', rightX, y, { align: 'right' });
  y += 2.5;

  drawDashedLine(y);
  y += 3.5;

  // Lista de artículos
  let totalArticles = 0;
  order.items.forEach((item) => {
    totalArticles += item.quantity;
    const itemTotal = item.price * item.quantity;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(String(item.quantity), marginX, y);

    const maxChars = 24;
    const itemName = item.name.length > maxChars ? item.name.substring(0, maxChars - 1) + '…' : item.name;
    doc.text(itemName.toUpperCase(), marginX + 9, y);
    doc.text(`$${itemTotal.toFixed(2)}`, rightX, y, { align: 'right' });
    y += 3.2;

    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      doc.setFontSize(7);
      item.selectedModifiers.forEach((mod) => {
        const extraText = mod.extraPrice > 0 ? ` +$${mod.extraPrice.toFixed(2)}` : '';
        doc.text(`+ ${mod.modifierName}${extraText}`, marginX + 9, y);
        y += 2.8;
      });
    }

    if (item.selectedComboOptions && item.selectedComboOptions.length > 0) {
      doc.setFontSize(7);
      item.selectedComboOptions.forEach((opt) => {
        const extraText = opt.extraPrice > 0 ? ` +$${opt.extraPrice.toFixed(2)}` : '';
        doc.text(`• ${opt.label}${extraText}`, marginX + 9, y);
        y += 2.8;
      });
    }

    if (item.note) {
      doc.setFontSize(7);
      doc.setFont('courier', 'bold');
      doc.text(`* NOTA: ${item.note.toUpperCase()}`, marginX + 9, y);
      doc.setFont('courier', 'normal');
      y += 3;
    }
  });

  if (showTotalArticles) {
    drawDashedLine(y);
    y += 3.5;
    // Conteo de artículos
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.text(`Artículos: ${totalArticles}`, marginX, y);
    y += 2.5;
  }

  drawDashedLine(y);
  y += 4;

  // Totales Financieros
  doc.setFontSize(8);
  doc.setFont('courier', 'normal');

  if (order.discountAmount && order.discountAmount > 0 && order.subtotalBeforeDiscount) {
    doc.text('Subtotal:', rightX - 28, y, { align: 'right' });
    doc.text(`$${order.subtotalBeforeDiscount.toFixed(2)}`, rightX, y, { align: 'right' });
    y += 3.5;

    const discountLabel = order.discountReason ? `Desc (${order.discountReason.substring(0, 10)}):` : 'Descuento:';
    doc.text(discountLabel, rightX - 28, y, { align: 'right' });
    doc.text(`-$${order.discountAmount.toFixed(2)}`, rightX, y, { align: 'right' });
    y += 3.5;
  } else if (showSubtotal) {
    doc.text('Subtotal:', rightX - 28, y, { align: 'right' });
    doc.text(`$${subtotal.toFixed(2)}`, rightX, y, { align: 'right' });
    y += 3.5;
  }

  if (showTax) {
    doc.text(`IVA${settings.taxRate ? ` (${settings.taxRate}%)` : ''}:`, rightX - 28, y, { align: 'right' });
    doc.text(`$${iva.toFixed(2)}`, rightX, y, { align: 'right' });
    y += 3.5;
  }

  if (order.tip > 0) {
    doc.text('Propina:', rightX - 28, y, { align: 'right' });
    doc.text(`$${order.tip.toFixed(2)}`, rightX, y, { align: 'right' });
    y += 3.5;
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.text('Gran Total:', rightX - 28, y, { align: 'right' });
  doc.text(`$${(granTotal + (order.tip || 0)).toFixed(2)}`, rightX, y, { align: 'right' });
  y += 5;

  // Cantidad con letra
  if (showAmountInWords) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    const wordsLines = doc.splitTextToSize(amountInWords, contentWidth);
    wordsLines.forEach((wLine: string) => {
      doc.text(wLine, centerX, y, { align: 'center' });
      y += 3;
    });
  }

  // Formas de pago
  if (showPaymentDetails && !isPreticket && order.isPaid && paymentRows.length > 0) {
    drawDashedLine(y);
    y += 4;
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.text('FORMAS DE PAGO', centerX, y, { align: 'center' });
    y += 3.5;

    doc.setFontSize(7.5);
    doc.text('Nombre', marginX, y);
    doc.text('Monto', marginX + 28, y, { align: 'right' });
    doc.text('Propina', marginX + 44, y, { align: 'right' });
    doc.text('Cambio', rightX, y, { align: 'right' });
    y += 2;

    drawDashedLine(y);
    y += 3.5;

    doc.setFont('courier', 'normal');
    paymentRows.forEach((row) => {
      doc.text(row.nombre.toUpperCase(), marginX, y);
      doc.text(`$${row.monto.toFixed(2)}`, marginX + 28, y, { align: 'right' });
      doc.text(`$${row.propina.toFixed(2)}`, marginX + 44, y, { align: 'right' });
      doc.text(`$${row.cambio.toFixed(2)}`, rightX, y, { align: 'right' });
      y += 3.2;
    });
  }

  // Terminal y Fecha de impresión
  if (showTerminal) {
    drawDashedLine(y);
    y += 4;
    doc.setFontSize(7.5);
    doc.text('Terminal:', marginX, y);
    doc.text(terminalLabel, rightX, y, { align: 'right' });
    y += 3.2;

    doc.text('Fecha impresión:', marginX, y);
    doc.text(printTimestamp, rightX, y, { align: 'right' });
    y += 3.5;
  }

  if (showFooterMsg && settings.receiptFooter) {
    y += 2;
    doc.setFontSize(7);
    doc.text(settings.receiptFooter, centerX, y, { align: 'center' });
  }

  doc.save(`Ticket_${movement}_${order.id.slice(-6)}.pdf`);
};
