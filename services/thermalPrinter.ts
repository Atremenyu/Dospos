import { Order, CashShift } from '../types';

/**
 * Genera una impresión térmica directa usando el diálogo nativo de impresión del navegador.
 * Está optimizada para papel de 80mm y la serie Epson TM-T88.
 * Utiliza un iframe oculto para aplicar estilos de impresión limpios e inmediatos sin desordenar la pantalla principal.
 */
export const printThermalTicketHTML = (order: Order, restaurantName: string = 'MI RESTAURANTE') => {
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

  // Formatear fecha y hora
  const dateStr = new Date(order.date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = new Date(order.date).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Calcular subtotal
  const subtotal = order.total - order.tip;
  
  // Generar HTML de los ítems
  let itemsHtml = '';
  order.items.forEach(item => {
    itemsHtml += `
      <div style="margin-bottom: 4px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10px;">
          <span>${item.quantity}x ${item.name}</span>
          <span>$${(item.price * item.quantity).toLocaleString()}</span>
        </div>
    `;

    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      item.selectedModifiers.forEach(mod => {
        itemsHtml += `
          <div style="display: flex; justify-content: space-between; font-size: 9px; color: #333; padding-left: 6px; font-style: italic;">
            <span>+ ${mod.modifierName}</span>
            <span>${mod.extraPrice > 0 ? `+$${mod.extraPrice.toLocaleString()}` : ''}</span>
          </div>
        `;
      });
    }

    if (item.selectedComboOptions && item.selectedComboOptions.length > 0) {
      item.selectedComboOptions.forEach(opt => {
        itemsHtml += `
          <div style="display: flex; justify-content: space-between; font-size: 9px; color: #333; padding-left: 6px; font-style: italic;">
            <span>• Opción: ${opt.label}</span>
            <span>${opt.extraPrice > 0 ? `+$${opt.extraPrice.toLocaleString()}` : ''}</span>
          </div>
        `;
      });
    }

    if (item.note) {
      itemsHtml += `
        <div style="font-size: 11px; font-weight: bold; color: #000; padding-left: 4px; font-family: monospace; border: 1px solid #000; padding: 2px 4px; margin-top: 3px; border-radius: 2px; text-transform: uppercase;">
          ⚠️ NOTA: ${item.note}
        </div>
      `;
    }

    itemsHtml += `</div>`;
  });

  // Validaciones del tipo de servicio
  let serviceTypeHeader = '';
  const isDelivery = order.takeawayType === 'delivery';
  const isUberOrDidi = order.takeawayType === 'uber' || order.takeawayType === 'didi';

  if (order.type === 'dine-in') {
    serviceTypeHeader = `MESA: ${order.table || 'N/A'}`;
  } else {
    if (order.takeawayType === 'delivery') {
      serviceTypeHeader = `DOMICILIO`;
    } else if (order.takeawayType === 'local') {
      serviceTypeHeader = `PARA LLEVAR`;
    } else if (isUberOrDidi) {
      serviceTypeHeader = `REPARTO: ${(order.takeawayType || '').toUpperCase()}`;
    } else {
      serviceTypeHeader = `PARA LLEVAR`;
    }
  }

  // Bloque destacado para despacho según tipo de servicio
  let specialAlertBlock = '';
  if (isDelivery) {
    specialAlertBlock = `
      <div style="border: 1.5px solid #000; padding: 6px; margin-top: 10px; text-align: center; font-family: sans-serif;">
        <div style="font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">DOMICILIO</div>
        <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">${order.client.toUpperCase()}</div>
        ${order.address ? `<div style="font-size: 10px; font-weight: bold; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px; text-align: left; word-break: break-word;">DIRECCIÓN: ${order.address.toUpperCase()}</div>` : ''}
      </div>
    `;
  } else if (isUberOrDidi) {
    specialAlertBlock = `
      <div style="border: 1.5px solid #000; padding: 6px; margin-top: 10px; text-align: center; font-family: sans-serif;">
        <div style="font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">${(order.takeawayType || '').toUpperCase()}</div>
        <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">${order.client.toUpperCase()}</div>
      </div>
    `;
  } else if (order.type === 'dine-in') {
    specialAlertBlock = `
      <div style="border: 1px solid #000; padding: 4px; margin-top: 10px; text-align: center; font-family: sans-serif;">
        <div style="font-size: 10px; font-weight: bold; letter-spacing: 0.5px;">CONSUMO EN COMEDOR</div>
        <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">MESA: ${order.table || 'N/A'}</div>
      </div>
    `;
  } else {
    specialAlertBlock = `
      <div style="border: 1px solid #000; padding: 4px; margin-top: 10px; text-align: center; font-family: sans-serif;">
        <div style="font-size: 10px; font-weight: bold; letter-spacing: 0.5px;">PARA LLEVAR / MOSTRADOR</div>
        <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">CLIENTE: ${order.client.toUpperCase()}</div>
      </div>
    `;
  }

  const addressLineHtml = order.address 
    ? `<div style="margin-top: 4px; font-size: 9px; word-break: break-all;"><b>Dirección:</b> ${order.address}</div>`
    : '';

  // Detalle de transacciones / desglose de caja rápida si existe
  let paymentDetailsHtml = '';
  if (order.payments && order.payments.length > 0) {
    order.payments.forEach(p => {
      paymentDetailsHtml += `
        <div style="display: flex; justify-content: space-between; font-size: 9px; margin-top: 1px;">
          <span>Monto Recibido (${p.method}):</span>
          <span>$${p.amount.toLocaleString()}</span>
        </div>
      `;
    });
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ticket ${order.id.slice(-8)}</title>
      <style>
        * {
          box-sizing: border-box;
        }
        body {
          width: 49mm; /* Ajustado para papel térmico de 55mm para evitar cortes laterales */
          margin: 0 auto;
          padding: 0;
          font-family: 'Courier New', Courier, monospace;
          font-size: 10px;
          line-height: 1.3;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .divider {
          border-top: 1px dashed #000;
          margin: 4px 0;
          width: 100%;
          height: 0;
        }
        .bold { font-weight: bold; }
        .large { font-size: 11px; }
        .xlarge { font-size: 13px; }
        
        @media print {
          body {
            width: 55mm;
            margin: 0;
            padding: 0 2mm;
          }
          @page {
            size: 55mm auto;
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="bold xlarge" style="margin-bottom: 2px; font-family: Arial, sans-serif; letter-spacing: -0.5px;">${restaurantName.toUpperCase()}</div>
        <div style="font-size: 8px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 4px;">¡GRACIAS POR TU VISITA!</div>
      </div>

      <div class="divider"></div>

      <div style="font-size: 9px; margin-bottom: 2px;">
        <div style="display: flex; justify-content: space-between;">
          <span><b>Ticket:</b> #${order.id.slice(-6)}</span>
          <span><b>Fecha:</b> ${dateStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 2px;">
          <span><b>Servicio:</b> ${serviceTypeHeader}</span>
          <span><b>Hora:</b> ${timeStr}</span>
        </div>
        <div style="margin-top: 3px;"><b>Cliente:</b> ${order.client || 'Mostrador'}</div>
        ${addressLineHtml}
      </div>

      <div class="divider"></div>

      <div style="font-weight: bold; margin-bottom: 4px; font-size: 9.5px; display: flex; justify-content: space-between;">
        <span>CANT / PRODUCTO</span>
        <span>IMPORTE</span>
      </div>

      <div class="divider"></div>

      ${itemsHtml}

      <div class="divider"></div>

      <div style="font-size: 10px; line-height: 1.35;">
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal:</span>
          <span>$${subtotal.toLocaleString()}</span>
        </div>
        ${order.tip > 0 ? `
        <div style="display: flex; justify-content: space-between;">
          <span>Propina:</span>
          <span>$${order.tip.toLocaleString()}</span>
        </div>` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11.5px; margin-top: 4px; font-family: Arial, sans-serif;">
          <span>TOTAL:</span>
          <span>$${order.total.toLocaleString()}</span>
        </div>
      </div>

      <div class="divider"></div>

      <div style="font-size: 9px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Estado Pago:</span>
          <span class="bold">${order.isPaid ? 'PAGADO' : 'PENDIENTE'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 2px;">
          <span>Método Pago:</span>
          <span>${order.payment}</span>
        </div>
        ${paymentDetailsHtml}
      </div>

      ${specialAlertBlock}

      <div style="margin-top: 20px; text-align: center; font-size: 9px; font-family: Arial, sans-serif; color: #555;">
        <div>Punto de Venta DosPOS</div>
        <div>Corte de cuenta original</div>
      </div>
      <div style="height: 12mm;"></div> <!-- Margen para el corte de papel físico -->
    </body>
    </html>
  `;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Esperar un instante para asegurar la carga del iframe y lanzar diálogo
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    
    // Remover el elemento después de dar margen suficiente para la cola de impresión
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 45000); 
  }, 250);
};

export const printCashShiftTicketHTML = (shift: CashShift, restaurantName: string = 'MI RESTAURANTE') => {
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
    hour: '2-digit', minute: '2-digit'
  });
  
  const closingDateStr = shift.closingTime 
    ? new Date(shift.closingTime).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : 'NO CERRADO';

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

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @media print {
          body {
            margin: 0;
            padding: 0;
            width: 55mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 9.5px;
            line-height: 1.3;
            color: #000;
          }
          @page {
            size: 55mm auto;
            margin: 0;
          }
        }
        body {
          width: 49mm; /* Ajustado para papel térmico de 55mm para evitar cortes laterales */
          margin: 0 auto;
          padding: 4px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 9.5px;
          line-height: 1.3;
          background-color: #fff;
          color: #000;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .border-dashed { border-top: 1px dashed #000; margin: 6px 0; }
        .border-double { border-top: 3px double #000; margin: 6px 0; }
        .title { font-size: 13px; font-weight: bold; margin: 4px 0; text-transform: uppercase; }
        .subtitle { font-size: 10px; font-weight: bold; margin: 2px 0; }
        .flex { display: flex; justify-content: space-between; }
        .ml-2 { padding-left: 8px; }
        .section-title { font-weight: bold; text-decoration: underline; margin-top: 8px; margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="bold" style="font-size: 12px;">${restaurantName.toUpperCase()}</div>
        <div class="title">CORTE DE CAJA</div>
        <div class="subtitle">RESUMEN DE CIERRE</div>
      </div>

      <div class="border-dashed"></div>

      <div class="bold">DATOS DEL TURNO</div>
      <div class="flex"><span>ID Turno:</span><span class="bold">${shift.id}</span></div>
      <div class="flex"><span>Cajero/a:</span><span>${shift.userName}</span></div>
      <div class="flex"><span>Apertura:</span><span>${openingDateStr}</span></div>
      <div class="flex"><span>Cierre:</span><span>${closingDateStr}</span></div>
      <div class="flex"><span>Fondo Inicial:</span><span>$${shift.initialFund.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>

      <div class="border-dashed"></div>

      <div class="section-title">RESUMEN GLOBAL</div>
      <div class="flex"><span>Fondo + Ventas Esperado:</span><span class="bold">$${expectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      <div class="flex"><span>Total Contado Real:</span><span class="bold">$${actualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      
      <div class="flex" style="font-size: 12px; margin-top: 4px;">
        <span class="bold">Diferencia Total:</span>
        <span class="bold">${differenceTotal >= 0 ? '+' : ''}$${differenceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      <div class="border-dashed"></div>

      <div class="section-title">DETALLE POR MÉTODO DE PAGO</div>
      
      <div class="bold" style="margin-top: 6px;">1. EFECTIVO</div>
      <div class="flex ml-2"><span>Esperado en Caja:</span><span>$${expectedC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      <div class="flex ml-2"><span>Contado Físico:</span><span>$${actualC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      <div class="flex ml-2" style="font-style: italic;">
        <span>Diferencia Cash:</span>
        <span>${differenceC >= 0 ? '+' : ''}$${differenceC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      <div class="bold" style="margin-top: 6px;">2. TARJETA</div>
      <div class="flex ml-2"><span>Ventas Esperadas:</span><span>$${expectedT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      <div class="flex ml-2"><span>Ventas Contadas:</span><span>$${actualT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      <div class="flex ml-2" style="font-style: italic;">
        <span>Diferencia Tarjeta:</span>
        <span>${differenceT >= 0 ? '+' : ''}$${differenceT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      <div class="bold" style="margin-top: 6px;">3. TRANSFERENCIA</div>
      <div class="flex ml-2"><span>Ventas Esperadas:</span><span>$${expectedTr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      <div class="flex ml-2"><span>Ventas Contadas:</span><span>$${actualTr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      <div class="flex ml-2" style="font-style: italic;">
        <span>Diferencia Transf.:</span>
        <span>${differenceTr >= 0 ? '+' : ''}$${differenceTr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      ${expectedO > 0 ? `
      <div class="bold" style="margin-top: 6px;">4. OTROS / PLATAFORMAS (Uber/Didi)</div>
      <div class="flex ml-2"><span>Ventas Registradas:</span><span>$${expectedO.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      ` : ''}

      ${shift.expectedCourtesy && shift.expectedCourtesy > 0 ? `
      <div class="bold" style="margin-top: 6px;">5. CORTESÍAS</div>
      <div class="flex ml-2"><span>Monto Autorizado:</span><span>$${shift.expectedCourtesy.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      ` : ''}

      <div class="border-dashed"></div>

      ${shift.notes ? `
        <div class="bold">NOTAS / OBSERVACIONES:</div>
        <div style="font-style: italic; white-space: pre-wrap; margin-top: 4px; border: 1px solid #aaa; padding: 4px; font-family: monospace;">${shift.notes}</div>
        <div class="border-dashed"></div>
      ` : ''}

      <div style="margin-top: 35px; text-align: center;">
        <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 5px auto;"></div>
        <div style="font-size: 9px; font-weight: bold;">FIRMA DEL CAJERO</div>
        <div style="font-size: 10px;">${shift.userName}</div>
      </div>

      <div style="margin-top: 35px; text-align: center;">
        <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 5px auto;"></div>
        <div style="font-size: 9px; font-weight: bold;">FIRMA DEL SUPERVISOR</div>
      </div>

      <div style="margin-top: 25px; text-align: center; font-size: 8px; color: #555;">
        <div>Punto de Venta DosPOS</div>
        <div>Comprobante de arqueo impreso localmente</div>
      </div>
      <div style="height: 12mm;"></div> <!-- Margen para corte físico -->
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
