import { jsPDF } from 'jspdf';
import { Order } from '../types';

export const generateTicketPDF = (order: Order, restaurantName: string = 'MI RESTAURANTE') => {
  // Calculate height needed: base + items + notes + modifiers + combo options
  let extraLines = 0;
  order.items.forEach(item => {
    if (item.note) extraLines += 1;
    if (item.selectedComboOptions) extraLines += item.selectedComboOptions.length;
    if (item.selectedModifiers) extraLines += item.selectedModifiers.length;
  });

  if (order.address) {
    // Approx 1 line per 40 characters
    extraLines += Math.max(1, Math.ceil(order.address.length / 40));
  }

  let dynamicHeight = 150 + (order.items.length * 7) + (extraLines * 4.5);
  
  const isDeliveryApp = order.takeawayType === 'uber' || order.takeawayType === 'didi';
  const isDomicilio = order.takeawayType === 'delivery';

  if (isDeliveryApp) {
    dynamicHeight += 30; // Extra room for large text at bottom
  } else if (isDomicilio) {
    dynamicHeight += 35; // Extra room for large text and address at bottom
    if (order.address) {
      dynamicHeight += Math.max(1, Math.ceil(order.address.length / 30)) * 5;
    }
  }

  // Create 80mm wide PDF
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, dynamicHeight], 
  });

  const centerX = 40;
  let y = 10;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(restaurantName.toUpperCase(), centerX, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.text('TICKET DE VENTA', centerX, y, { align: 'center' });
  y += 10;

  // Info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`ID: ${order.id.slice(-8)}`, 5, y);
  y += 4;
  doc.text(`Fecha: ${new Date(order.date).toLocaleString()}`, 5, y);
  y += 4;
  doc.text(`Cliente: ${order.client || 'Mostrador'}`, 5, y);
  y += 4;

  if (order.address) {
    const splitAddress = doc.splitTextToSize(`Dir: ${order.address}`, 70);
    splitAddress.forEach((line: string) => {
      doc.text(line, 5, y);
      y += 4;
    });
  }

  if (order.type === 'dine-in') {
    doc.text(`Mesa: ${order.table || 'N/A'}`, 5, y);
  } else {
    doc.text(`Tipo: PARA LLEVAR (${order.takeawayType?.toUpperCase() || 'MOSTRADOR'})`, 5, y);
  }
  y += 6;

  // Table header
  doc.setLineWidth(0.2);
  doc.line(5, y, 75, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Item', 5, y);
  doc.text('Cant', 55, y);
  doc.text('Total', 65, y);
  y += 3;
  doc.line(5, y, 75, y);
  y += 5;

  // Items
  doc.setFont('helvetica', 'normal');
  order.items.forEach((item) => {
    doc.setFontSize(8);
    const name = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
    doc.text(name, 5, y);
    doc.text(item.quantity.toString(), 57, y);
    doc.text(`$${(item.price * item.quantity).toFixed(0)}`, 65, y);
    y += 5;

    if (item.selectedComboOptions && item.selectedComboOptions.length > 0) {
      item.selectedComboOptions.forEach((opt) => {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text(`+ ${opt.label}`, 7, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
      });
    }

    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      item.selectedModifiers.forEach((mod) => {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        const isRemoval = mod.modifierName.toLowerCase().includes('sin') || 
                          mod.modifierName.toLowerCase().includes('quitar') || 
                          mod.modifierName.toLowerCase().includes('remover') || 
                          mod.modifierName.toLowerCase().includes('no ') || 
                          mod.extraPrice <= 0;
        doc.text(`${isRemoval ? '' : '+ '}${mod.modifierName}`, 7, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
      });
    }

    if (item.note) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text(`>> ${item.note}`, 7, y);
      doc.setFont('helvetica', 'normal');
      y += 4;
    }
  });

  y += 2;
  doc.line(5, y, 75, y);
  y += 6;

  // Totals
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 5, y);
  doc.text(`$${order.total.toFixed(0)}`, 65, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Metodo Pago: ${order.payment}`, 5, y);

  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('¡GRACIAS POR SU COMPRA!', centerX, y, { align: 'center' });

  if (isDeliveryApp) {
    y += 15;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(5, y - 8, 75, y - 8);
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(order.takeawayType!.toUpperCase(), centerX, y, { align: 'center' });
    
    y += 10;
    doc.setFontSize(14);
    doc.text(order.client.toUpperCase(), centerX, y, { align: 'center' });
    
    doc.line(5, y + 4, 75, y + 4);
  } else if (isDomicilio) {
    y += 15;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(5, y - 8, 75, y - 8);
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DOMICILIO', centerX, y, { align: 'center' });
    
    y += 8;
    doc.setFontSize(14);
    doc.text(order.client.toUpperCase(), centerX, y, { align: 'center' });
    
    if (order.address) {
      y += 6;
      doc.setFontSize(10);
      const splitAddressBottom = doc.splitTextToSize(order.address.toUpperCase(), 70);
      splitAddressBottom.forEach((line: string) => {
        doc.text(line, centerX, y, { align: 'center' });
        y += 5;
      });
    }
    
    doc.line(5, y + 2, 75, y + 2);
  }

  doc.save(`ticket_${order.id.slice(-8)}.pdf`);
};
