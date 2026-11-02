import { Order, CashShift, StoreSettings, CategorySalesSummary, CategoryProductSale, Product } from '../types';
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
 * Resuelve las configuraciones del negocio a utilizar en la impresión
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
 * Genera una impresión térmica directa basada en el formato estándar con:
 * - Tipo de ticket (Ticket de Pagado / Preticket) y Tipo de Venta (Venta en Mesa / Mostrador / Domicilio)
 * - Perfil completo del negocio: Nombre, Dirección 1, Dirección 2, Teléfono, RFC
 * - Movimiento y Fecha de operación
 * - Orden, Mesa, Personas, Mesero, Horas (Entrada, Preticket, Cierre)
 * - Detalle de artículos con cantidad, descripción e importe
 * - Conteo total de artículos
 * - Subtotal, IVA desglosado y Gran Total en negrita destacada
 * - Cantidad con letra en español (ej. DOSCIENTOS CUARENTA Y DOS PESOS 00/100 M.N.)
 * - Tabla de Formas de Pago con Nombre, Monto recibido, Propina y Cambio
 * - Terminal y Fecha/hora exacta de impresión
 */
export const printThermalTicketHTML = (
  order: Order,
  settingsOrName?: StoreSettings | string,
  options?: { isPreticket?: boolean; waiterName?: string; terminalName?: string }
) => {
  const settings = resolveSettings(settingsOrName);
  const isPreticket = options?.isPreticket || (!order.isPaid && order.status !== 'delivered');

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    console.error("No se pudo acceder al documento del iframe");
    return;
  }

  // Título del ticket
  const ticketMainTitle = isPreticket ? 'Preticket de Cuenta' : 'Ticket de Pagado';
  const serviceSubtitle = getServiceTitle(order);

  // Metadatos de la operación
  const movement = getMovementNumber(order);
  const operationDate = formatReceiptDate(order.date);
  const orderNum = getOrderShortNumber(order);
  const tableLabel = getCleanTableLabel(order);
  const diners = order.diners || settings.defaultDiners || 1;
  const waiter = options?.waiterName || order.waiter || 'ADMINISTRACION';

  // Horas
  const entryTime = formatReceiptTime12(order.date);
  const preticketTime = isPreticket 
    ? formatReceiptTime12(new Date()) 
    : (order.preticketPrintedAt ? formatReceiptTime12(order.preticketPrintedAt) : '-');
  const closeTime = isPreticket 
    ? '-' 
    : (order.closedAt ? formatReceiptTime12(order.closedAt) : (order.isPaid ? formatReceiptTime12(order.payments?.[0]?.timestamp || order.date) : '-'));

  // Desglose de ítems
  let totalArticles = 0;
  let itemsHtml = '';

  order.items.forEach((item) => {
    totalArticles += item.quantity;
    const itemTotal = item.price * item.quantity;

    itemsHtml += `
      <div style="margin-bottom: 3px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: normal; line-height: 1.25;">
          <span style="width: 26px; text-align: left; flex-shrink: 0;">${item.quantity}</span>
          <span style="flex-grow: 1; text-align: left; padding-right: 6px; text-transform: uppercase; word-break: break-word;">${item.name}</span>
          <span style="text-align: right; flex-shrink: 0;">$${itemTotal.toFixed(2)}</span>
        </div>
    `;

    // Modificadores seleccionados
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      item.selectedModifiers.forEach((mod) => {
        const hasExtra = mod.extraPrice > 0;
        itemsHtml += `
          <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #222; padding-left: 26px; font-style: italic;">
            <span>+ ${mod.modifierName}</span>
            <span>${hasExtra ? `+$${mod.extraPrice.toFixed(2)}` : ''}</span>
          </div>
        `;
      });
    }

    // Opciones combo
    if (item.selectedComboOptions && item.selectedComboOptions.length > 0) {
      item.selectedComboOptions.forEach((opt) => {
        const hasExtra = opt.extraPrice > 0;
        itemsHtml += `
          <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #222; padding-left: 26px; font-style: italic;">
            <span>• ${opt.label}</span>
            <span>${hasExtra ? `+$${opt.extraPrice.toFixed(2)}` : ''}</span>
          </div>
        `;
      });
    }

    // Nota
    if (item.note) {
      itemsHtml += `
        <div style="font-size: 9.5px; font-weight: bold; color: #000; padding-left: 26px; text-transform: uppercase;">
          * NOTA: ${item.note}
        </div>
      `;
    }

    itemsHtml += `</div>`;
  });

  // Totales financieros
  const { subtotal, iva, granTotal } = calculateTaxBreakdown(
    order.total,
    settings.taxRate,
    settings.includeTaxBreakdown
  );

  // Cantidad con letra en español
  const currencyName = settings.currencyText || (settings.currency === 'USD' ? 'DÓLARES' : 'PESOS');
  const currencySuffix = settings.currency === 'USD' ? 'USD' : 'M.N.';
  const amountInWords = numberToWordsSpanish(granTotal, currencyName, currencySuffix);

  // Formas de pago
  const paymentRows = getPaymentSummaryRows(order);
  let paymentsHtml = '';
  paymentRows.forEach((row) => {
    paymentsHtml += `
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
        <span style="flex: 2; text-align: left; text-transform: uppercase;">${row.nombre}</span>
        <span style="flex: 1.2; text-align: right;">$${row.monto.toFixed(2)}</span>
        <span style="flex: 1; text-align: right;">$${row.propina.toFixed(2)}</span>
        <span style="flex: 1.2; text-align: right;">$${row.cambio.toFixed(2)}</span>
      </div>
    `;
  });

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

  // Dirección de envío en caso de entrega a domicilio
  const deliveryAddressBlock = (order.address && showDeliveryAddress) ? `
    <div style="margin-top: 6px; padding: 4px; border: 1px dashed #000; font-size: 10px; text-align: left;">
      <div style="font-weight: bold;">DIRECCIÓN DE ENTREGA:</div>
      <div style="word-break: break-word; text-transform: uppercase;">${order.address}</div>
      ${order.client ? `<div style="margin-top: 2px;"><b>Cliente:</b> ${order.client.toUpperCase()}</div>` : ''}
    </div>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Ticket ${order.id.slice(-8)}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          width: 72mm;
          max-width: 100%;
          margin: 0 auto;
          padding: 2mm 3mm;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.3;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .divider {
          border-top: 1px dashed #000;
          margin: 5px 0;
          width: 100%;
          height: 0;
        }
        .bold { font-weight: bold; }
        .row-meta {
          display: flex;
          justify-content: space-between;
          font-size: 10.5px;
          line-height: 1.35;
        }
        .row-meta .label {
          text-align: left;
        }
        .row-meta .val {
          text-align: right;
          font-weight: normal;
        }
        @media print {
          body {
            width: 72mm;
            padding: 0 1.5mm;
            margin: 0 auto;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      <!-- TÍTULO SUPERIOR -->
      <div class="text-center" style="margin-bottom: 4px;">
        <div style="font-size: 12.5px; font-weight: bold; text-transform: uppercase;">${ticketMainTitle}</div>
        <div style="font-size: 11px; text-transform: uppercase; margin-top: 1px;">${serviceSubtitle}</div>
      </div>

      <div class="divider"></div>

      <!-- PERFIL DEL NEGOCIO -->
      <div class="text-center" style="margin-bottom: 4px;">
        <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${settings.name || 'DOS RODRIGUEZ'}</div>
        ${showAddress && settings.address ? `<div style="font-size: 10px; text-transform: uppercase; margin-top: 1px;">${settings.address}</div>` : ''}
        ${showAddress && settings.addressLine2 ? `<div style="font-size: 10px; text-transform: uppercase; margin-top: 1px;">${settings.addressLine2}</div>` : ''}
        ${showPhone && settings.phone ? `<div style="font-size: 10.5px; margin-top: 1px;">${settings.phone}</div>` : ''}
        ${showTaxId && settings.taxId ? `<div style="font-size: 9.5px; text-transform: uppercase; margin-top: 1px;">RFC: ${settings.taxId}</div>` : ''}
        ${showHeaderMsg && settings.receiptHeader ? `<div style="font-size: 9.5px; margin-top: 3px; font-style: italic;">${settings.receiptHeader}</div>` : ''}
      </div>

      ${showDate ? `
      <div class="divider"></div>
      <div style="margin: 3px 0;">
        <div class="row-meta">
          <span class="label">Fecha operación:</span>
          <span class="val">${operationDate}</span>
        </div>
      </div>
      ` : ''}

      <!-- DATOS DE LA ORDEN, MESA Y HORAS -->
      ${(showOrderNum || showTable || showWaiter || showTimes) ? `
      <div class="divider"></div>
      <div style="margin: 3px 0;">
        ${showOrderNum ? `
        <div class="row-meta">
          <span class="label">Orden:</span>
          <span class="val bold">${orderNum}</span>
        </div>` : ''}
        ${showTable ? `
        <div class="row-meta">
          <span class="label">Mesa:</span>
          <span class="val bold">${tableLabel}</span>
        </div>` : ''}
        ${showWaiter ? `
        <div class="row-meta">
          <span class="label">Mesero:</span>
          <span class="val bold text-right" style="text-transform: uppercase;">${waiter}</span>
        </div>` : ''}
        ${showTimes ? `
        <div class="row-meta">
          <span class="label">Hora Entrada:</span>
          <span class="val">${entryTime}</span>
        </div>
        ${preticketTime !== '-' ? `
        <div class="row-meta">
          <span class="label">Hora Impresión:</span>
          <span class="val">${preticketTime}</span>
        </div>` : ''}
        ${(!isPreticket && closeTime !== '-') ? `
        <div class="row-meta">
          <span class="label">Hora Cierre:</span>
          <span class="val">${closeTime}</span>
        </div>` : ''}` : ''}
      </div>
      ` : ''}

      ${deliveryAddressBlock}

      <div class="divider"></div>

      <!-- ENCABEZADO DE ARTÍCULOS -->
      <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: normal; margin-bottom: 2px;">
        <span style="width: 26px; text-align: left;">Cant.</span>
        <span style="flex-grow: 1; text-align: left;">Descripción</span>
        <span style="text-align: right;">Importe</span>
      </div>

      <div class="divider"></div>

      <!-- LISTA DE ARTÍCULOS -->
      <div style="margin: 2px 0;">
        ${itemsHtml}
      </div>

      ${showTotalArticles ? `
      <div class="divider"></div>
      <!-- CONTEO DE ARTÍCULOS -->
      <div style="font-size: 11px; margin: 2px 0;">
        <b>Artículos:</b> ${totalArticles}
      </div>
      ` : ''}

      <div class="divider"></div>

      <!-- TOTALES FINANCIEROS -->
      <div style="font-size: 11px; line-height: 1.4; margin: 4px 0;">
        ${(order.discountAmount && order.discountAmount > 0 && order.subtotalBeforeDiscount) ? `
        <div style="display: flex; justify-content: flex-end;">
          <span style="width: 120px; text-align: right; padding-right: 8px;">Subtotal:</span>
          <span style="width: 75px; text-align: right;">$${order.subtotalBeforeDiscount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: flex-end; color: #000; font-weight: bold;">
          <span style="width: 120px; text-align: right; padding-right: 8px;">Descuento${order.discountReason ? ` (${order.discountReason})` : ''}:</span>
          <span style="width: 75px; text-align: right;">-$${order.discountAmount.toFixed(2)}</span>
        </div>
        ` : (showSubtotal ? `
        <div style="display: flex; justify-content: flex-end;">
          <span style="width: 90px; text-align: right; padding-right: 8px;">Subtotal:</span>
          <span style="width: 75px; text-align: right;">$${subtotal.toFixed(2)}</span>
        </div>
        ` : '')}
        ${showTax ? `
        <div style="display: flex; justify-content: flex-end;">
          <span style="width: 90px; text-align: right; padding-right: 8px;">IVA${settings.taxRate ? ` (${settings.taxRate}%)` : ''}:</span>
          <span style="width: 75px; text-align: right;">$${iva.toFixed(2)}</span>
        </div>
        ` : ''}
        ${order.tip > 0 ? `
        <div style="display: flex; justify-content: flex-end;">
          <span style="width: 90px; text-align: right; padding-right: 8px;">Propina:</span>
          <span style="width: 75px; text-align: right;">$${order.tip.toFixed(2)}</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: flex-end; font-size: 14px; font-weight: bold; margin-top: 3px;">
          <span style="width: 110px; text-align: right; padding-right: 8px;">Gran Total:</span>
          <span style="width: 85px; text-align: right;">$${(granTotal + (order.tip || 0)).toFixed(2)}</span>
        </div>
      </div>

      <!-- CANTIDAD EN LETRAS -->
      ${showAmountInWords ? `
      <div class="text-center" style="font-size: 10px; font-weight: normal; margin: 6px 0 3px 0; line-height: 1.25; text-transform: uppercase;">
        ${amountInWords}
      </div>
      ` : ''}

      <!-- FORMAS DE PAGO -->
      ${(showPaymentDetails && !isPreticket && order.isPaid && paymentRows.length > 0) ? `
      <div class="divider"></div>
      <div class="text-center" style="font-size: 11px; font-weight: bold; margin-bottom: 3px;">
        FORMAS DE PAGO
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px;">
        <span style="flex: 2; text-align: left;">Nombre</span>
        <span style="flex: 1.2; text-align: right;">Monto</span>
        <span style="flex: 1; text-align: right;">Propina</span>
        <span style="flex: 1.2; text-align: right;">Cambio</span>
      </div>
      <div class="divider" style="margin: 2px 0 4px 0;"></div>
      <div>
        ${paymentsHtml}
      </div>
      ` : ''}

      <!-- PIE DE TICKET: TERMINAL Y FECHA IMPRESIÓN -->
      ${showTerminal ? `
      <div class="divider"></div>
      <div style="margin-top: 4px; font-size: 10px;">
        <div class="row-meta">
          <span class="label">Terminal:</span>
          <span class="val">${terminalLabel}</span>
        </div>
        <div class="row-meta">
          <span class="label">Fecha impresión:</span>
          <span class="val">${printTimestamp}</span>
        </div>
      </div>
      ` : ''}

      ${(showFooterMsg && settings.receiptFooter) ? `
        <div class="text-center" style="margin-top: 8px; font-size: 9.5px; font-style: italic;">
          ${settings.receiptFooter}
        </div>
      ` : ''}

      <div style="height: 12mm;"></div> <!-- Margen para corte físico de guillotina -->
    </body>
    </html>
  `;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Enviar comando a diálogo de impresión
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // Limpieza segura del elemento temporal
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 45000);
  }, 250);
};

/**
 * Calcula las ventas agrupadas y desglosadas por categoría para un turno de caja
 */
export const computeShiftCategorySales = (
  shift: CashShift,
  ordersList?: Order[],
  productsCatalog?: Product[],
  allShiftsList?: CashShift[]
): {
  categoryBreakdown: CategorySalesSummary[];
  totalArticlesSold: number;
  categorySalesTotal: number;
} => {
  const orders = ordersList || storage.getOrders() || [];
  const products = productsCatalog || storage.getProducts() || [];
  const allShifts = allShiftsList || storage.getCashShifts() || [];

  const shiftOpeningTime = new Date(shift.openingTime).getTime();
  let shiftClosingTime: number;
  if (shift.closingTime) {
    shiftClosingTime = new Date(shift.closingTime).getTime();
  } else {
    const openingDate = new Date(shift.openingTime);
    const today = new Date();
    const isPastDay = openingDate.toDateString() !== today.toDateString();
    if (isPastDay) {
      const endOfOpeningDay = new Date(openingDate);
      endOfOpeningDay.setHours(23, 59, 59, 999);
      shiftClosingTime = Math.max(endOfOpeningDay.getTime(), shiftOpeningTime);
    } else {
      shiftClosingTime = Date.now();
    }
  }

  const shiftDate = new Date(shift.openingTime);
  const startOfShiftDay = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 0, 0, 0, 0).getTime();
  
  const previousClosedShifts = allShifts.filter(s => 
    s.id !== shift.id && 
    s.status === 'closed' && 
    new Date(s.closingTime || s.openingTime).getTime() <= shiftOpeningTime
  ).sort((a, b) => new Date(b.closingTime || b.openingTime).getTime() - new Date(a.closingTime || a.openingTime).getTime());
  
  const lastClosingTime = previousClosedShifts.length > 0 && previousClosedShifts[0].closingTime
    ? new Date(previousClosedShifts[0].closingTime).getTime()
    : 0;

  const effectiveStartTime = Math.min(shiftOpeningTime, Math.max(lastClosingTime, startOfShiftDay));

  const categoryMap = new Map<string, {
    category: string;
    totalSales: number;
    totalQuantity: number;
    productsMap: Map<string, { name: string; quantity: number; total: number }>;
  }>();

  let totalArticlesSold = 0;
  let overallSalesTotal = 0;

  // Mapa de productos del catálogo para resolución de categoría si falta en el ítem
  const catalogMap = new Map<string, Product>();
  products.forEach(p => {
    if (p.id) catalogMap.set(p.id, p);
    if (p.name) catalogMap.set(p.name.trim().toLowerCase(), p);
  });

  orders.forEach(o => {
    if (o.status === 'cancelled') return;

    let inShift = false;
    if (o.payments && o.payments.length > 0) {
      inShift = o.payments.some(p => {
        const t = new Date(p.timestamp).getTime();
        return t >= effectiveStartTime && t <= shiftClosingTime;
      });
    } else if (o.isPaid) {
      const t = new Date(o.date).getTime();
      inShift = t >= effectiveStartTime && t <= shiftClosingTime;
    }

    if (!inShift) return;

    const items = o.items || [];
    items.forEach(item => {
      const qty = Number(item.quantity) || 1;
      let unitPrice = Number(item.price) || 0;
      if (item.selectedModifiers && Array.isArray(item.selectedModifiers)) {
        unitPrice += item.selectedModifiers.reduce((sum, m) => sum + (Number(m.extraPrice) || 0), 0);
      }
      if (item.selectedComboOptions && Array.isArray(item.selectedComboOptions)) {
        unitPrice += item.selectedComboOptions.reduce((sum, c) => sum + (Number(c.extraPrice) || 0), 0);
      }
      const itemTotal = unitPrice * qty;

      let categoryName = item.category ? item.category.trim() : '';
      if (!categoryName) {
        const prod = catalogMap.get(item.id) || catalogMap.get((item.name || '').trim().toLowerCase());
        if (prod && prod.category) categoryName = prod.category.trim();
      }
      if (!categoryName) {
        categoryName = 'General';
      }

      totalArticlesSold += qty;
      overallSalesTotal += itemTotal;

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          category: categoryName,
          totalSales: 0,
          totalQuantity: 0,
          productsMap: new Map()
        });
      }

      const catEntry = categoryMap.get(categoryName)!;
      catEntry.totalSales += itemTotal;
      catEntry.totalQuantity += qty;

      const prodName = item.name ? item.name.trim() : 'Artículo';
      if (!catEntry.productsMap.has(prodName)) {
        catEntry.productsMap.set(prodName, {
          name: prodName,
          quantity: 0,
          total: 0
        });
      }
      const prodEntry = catEntry.productsMap.get(prodName)!;
      prodEntry.quantity += qty;
      prodEntry.total += itemTotal;
    });
  });

  const categoryBreakdown: CategorySalesSummary[] = Array.from(categoryMap.values())
    .map(cat => {
      const productsList = Array.from(cat.productsMap.values()).sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return b.total - a.total;
      });

      const percentage = overallSalesTotal > 0 ? (cat.totalSales / overallSalesTotal) * 100 : 0;

      return {
        category: cat.category,
        totalSales: cat.totalSales,
        totalQuantity: cat.totalQuantity,
        percentage,
        products: productsList
      };
    })
    // Ordenar de mayor a menor venta para saber qué categoría vendió más
    .sort((a, b) => b.totalSales - a.totalSales);

  return {
    categoryBreakdown,
    totalArticlesSold,
    categorySalesTotal: overallSalesTotal
  };
};

/**
 * Imprime el ticket de corte de caja usando el perfil del negocio
 */
export const printCashShiftTicketHTML = (shift: CashShift, restaurantName: string = 'MI RESTAURANTE') => {
  const settings = resolveSettings(restaurantName);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    console.error("No se pudo acceder al documento del iframe");
    return;
  }

  const openingDateStr = new Date(shift.openingTime).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  
  const closingDateStr = shift.closingTime 
    ? new Date(shift.closingTime).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    : 'TURNO ACTIVO';

  const expectedTotal = shift.expectedAmount || 0;
  const actualTotal = shift.actualAmount || 0;
  const differenceTotal = shift.difference || 0;

  const expectedC = shift.expectedCash || 0;
  const actualC = shift.actualCash || 0;
  const differenceC = shift.differenceCash || 0;

  const expectedT = shift.expectedTarjeta || 0;
  const actualT = shift.actualTarjeta || 0;
  const differenceT = shift.differenceTarjeta || 0;

  const expectedTr = shift.expectedTransferencia || 0;
  const actualTr = shift.actualTransferencia || 0;
  const differenceTr = shift.differenceTransferencia || 0;

  const expectedO = shift.expectedOtros || 0;
  const terminalLabel = settings.terminalName || '1 -- SERVER1';
  const printTimestamp = formatReceiptDateTime24(new Date());

  // Desglose de ventas por categoría
  const categoryData = (shift.categoryBreakdown && shift.categoryBreakdown.length > 0)
    ? {
        categoryBreakdown: shift.categoryBreakdown,
        totalArticlesSold: shift.totalArticlesSold || shift.categoryBreakdown.reduce((s, c) => s + c.totalQuantity, 0),
        categorySalesTotal: shift.categoryBreakdown.reduce((s, c) => s + c.totalSales, 0)
      }
    : computeShiftCategorySales(shift);

  const categoriesHtml = categoryData.categoryBreakdown.length > 0
    ? categoryData.categoryBreakdown.map((cat, idx) => `
        <div style="margin: ${idx === 0 ? '2px 0 3px 0' : '5px 0 3px 0'};">
          <div class="row bold" style="font-size: 10.5px;">
            <span>• ${cat.category.toUpperCase()} (${cat.totalQuantity} arts)</span>
            <span>$${cat.totalSales.toFixed(2)}</span>
          </div>
          <div class="row" style="font-size: 8.5px; color: #555; margin-bottom: 2px;">
            <span>Participación:</span>
            <span>${cat.percentage.toFixed(1)}%</span>
          </div>
          <div style="padding-left: 5px; font-size: 9px; border-left: 1px dotted #888; margin-left: 2px;">
            ${cat.products.map(p => `
              <div class="row" style="margin: 1px 0;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 68%;">
                  ${p.quantity}x ${p.name}
                </span>
                <span>$${p.total.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')
    : `
      <div class="row" style="font-size: 9.5px; color: #666; font-style: italic; margin: 3px 0;">
        <span>Sin artículos vendidos en este turno</span>
      </div>
    `;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Corte de Caja</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          margin: 0 auto;
          padding: 2mm 3mm;
          width: 72mm;
          max-width: 100%;
          font-family: 'Courier New', Courier, monospace;
          font-size: 10.5px;
          line-height: 1.3;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .divider {
          border-top: 1px dashed #000;
          margin: 4px 0;
          height: 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin: 1.5px 0;
        }
        @media print {
          body {
            width: 72mm;
            padding: 0 1.5mm;
            margin: 0;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="text-center" style="margin-bottom: 4px;">
        <div style="font-size: 13px; font-weight: bold; text-transform: uppercase;">${settings.name}</div>
        ${settings.address ? `<div style="font-size: 9.5px; text-transform: uppercase;">${settings.address}</div>` : ''}
        ${settings.addressLine2 ? `<div style="font-size: 9.5px; text-transform: uppercase;">${settings.addressLine2}</div>` : ''}
        ${settings.phone ? `<div style="font-size: 10px;">TEL: ${settings.phone}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="text-center bold" style="font-size: 12px; margin: 3px 0;">
        CORTE DE TURNO DE CAJA
      </div>

      <div class="divider"></div>

      <div class="row"><span>Cajero:</span><span class="bold">${shift.userName}</span></div>
      <div class="row"><span>Apertura:</span><span>${openingDateStr}</span></div>
      <div class="row"><span>Cierre:</span><span>${closingDateStr}</span></div>
      <div class="row"><span>Fondo Inicial:</span><span>$${shift.initialFund.toFixed(2)}</span></div>

      <div class="divider"></div>

      <div class="bold" style="margin-bottom: 2px;">DESGLOSE POR MÉTODO</div>
      <div class="row"><span>Efectivo Sistema:</span><span>$${expectedC.toFixed(2)}</span></div>
      <div class="row"><span>Efectivo Real:</span><span>$${actualC.toFixed(2)}</span></div>
      <div class="row" style="color: ${differenceC < 0 ? '#b91c1c' : '#047857'};">
        <span>Dif. Efectivo:</span><span class="bold">$${differenceC.toFixed(2)}</span>
      </div>

      <div style="height: 3px;"></div>
      <div class="row"><span>Tarjetas Sistema:</span><span>$${expectedT.toFixed(2)}</span></div>
      <div class="row"><span>Tarjetas Real:</span><span>$${actualT.toFixed(2)}</span></div>
      <div class="row"><span>Dif. Tarjetas:</span><span>$${differenceT.toFixed(2)}</span></div>

      <div style="height: 3px;"></div>
      <div class="row"><span>Transferencias Sist:</span><span>$${expectedTr.toFixed(2)}</span></div>
      <div class="row"><span>Transferencias Real:</span><span>$${actualTr.toFixed(2)}</span></div>
      <div class="row"><span>Dif. Transf:</span><span>$${differenceTr.toFixed(2)}</span></div>

      ${expectedO > 0 ? `
      <div style="height: 3px;"></div>
      <div class="row"><span>Apps / Otros:</span><span>$${expectedO.toFixed(2)}</span></div>
      ` : ''}

      <div class="divider"></div>

      <div class="row bold" style="font-size: 12px; margin: 4px 0;">
        <span>TOTAL COBRADO:</span>
        <span>$${expectedTotal.toFixed(2)}</span>
      </div>
      <div class="row bold" style="font-size: 12px;">
        <span>TOTAL DECLARADO:</span>
        <span>$${actualTotal.toFixed(2)}</span>
      </div>
      <div class="row bold" style="font-size: 12px; color: ${differenceTotal < 0 ? '#b91c1c' : '#047857'}; margin-top: 2px;">
        <span>DIFERENCIA TOTAL:</span>
        <span>$${differenceTotal.toFixed(2)}</span>
      </div>

      <div class="divider"></div>

      <div class="text-center bold" style="font-size: 11px; margin: 4px 0 2px 0; letter-spacing: 0.5px;">
        VENTAS POR CATEGORÍA
      </div>
      <div class="text-center" style="font-size: 8px; color: #555; margin-bottom: 3px;">
        (Ordenado de mayor a menor venta)
      </div>

      <div class="divider"></div>

      ${categoriesHtml}

      <div class="divider"></div>

      <div class="row bold" style="font-size: 10.5px; margin: 2px 0;">
        <span>TOTAL ARTÍCULOS VENDIDOS:</span>
        <span>${categoryData.totalArticlesSold} arts</span>
      </div>

      ${shift.notes ? `
        <div class="divider"></div>
        <div style="font-size: 9.5px; margin-top: 3px;">
          <b>Observaciones:</b> ${shift.notes}
        </div>
      ` : ''}

      <div class="divider"></div>

      <div style="margin-top: 4px; font-size: 9.5px;">
        <div class="row"><span>Terminal:</span><span>${terminalLabel}</span></div>
        <div class="row"><span>Fecha impresión:</span><span>${printTimestamp}</span></div>
      </div>

      <div style="margin-top: 25px; text-align: center;">
        <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 3px auto;"></div>
        <div style="font-size: 9.5px;">Firma del Cajero</div>
      </div>

      <div style="height: 12mm;"></div>
    </body>
    </html>
  `;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 45000);
  }, 250);
};
