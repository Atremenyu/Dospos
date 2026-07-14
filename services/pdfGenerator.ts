import { jsPDF } from 'jspdf';
import { Order } from '../types';

export const generateTicketPDF = (order: Order, restaurantName: string = 'MI RESTAURANTE') => {
  const isDeliveryApp = order.takeawayType === 'uber' || order.takeawayType === 'didi';
  const isDomicilio = order.takeawayType === 'delivery';

  // Calculate precise height needed dynamically by summing the exact y advances
  let calculatedY = 10; // Initial margin-top
  
  // Header
  calculatedY += 6; // Restaurant name
  calculatedY += 8; // TICKET DE VENTA
  
  // Info
  calculatedY += 4; // ID
  calculatedY += 4; // Fecha
  calculatedY += 4; // Cliente
  
  if (order.address) {
    const docTemp = new jsPDF();
    const splitAddress = docTemp.splitTextToSize(`Dir: ${order.address}`, 47);
    calculatedY += splitAddress.length * 4;
  }
  
  // Mesa or Tipo
  calculatedY += 5;
  
  // Table header
  calculatedY += 4; // Line 1
  calculatedY += 3; // Header columns text
  calculatedY += 4; // Line 2
  
  // Items
  order.items.forEach((item) => {
    calculatedY += 4; // Base item row
    
    if (item.selectedComboOptions && item.selectedComboOptions.length > 0) {
      calculatedY += item.selectedComboOptions.length * 3.5;
    }
    
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      calculatedY += item.selectedModifiers.length * 3.5;
    }
    
    if (item.note) {
      calculatedY += 4.5; // Updated note height increment
    }
  });
  
  calculatedY += 2; // Before total line
  calculatedY += 5; // Total line
  calculatedY += 5; // Total text row
  calculatedY += 8; // Payment method
  
  // Gracias por su compra
  calculatedY += 8; // Margin before "¡GRACIAS POR SU COMPRA!"
  
  if (isDeliveryApp) {
    calculatedY += 12; // Border offset
    calculatedY += 8; // App name
    calculatedY += 4; // Client and bottom border spacing
  } else if (isDomicilio) {
    calculatedY += 12; // Border offset
    calculatedY += 7; // DOMICILIO heading
    if (order.address) {
      calculatedY += 5; // Client name
      const docTemp = new jsPDF();
      const splitAddressBottom = docTemp.splitTextToSize(order.address.toUpperCase(), 47);
      calculatedY += splitAddressBottom.length * 4;
    }
    calculatedY += 2; // Final border spacing
  }
  
  // Add a small safety padding at the bottom (10mm)
  const dynamicHeight = calculatedY + 10;

  // Create 55mm wide PDF
  const doc = new jsPDF({
    unit: 'mm',
    format: [55, dynamicHeight], 
  });

  const centerX = 27.5;
  let y = 10;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(restaurantName.toUpperCase(), centerX, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.text('TICKET DE VENTA', centerX, y, { align: 'center' });
  y += 8;

  // Info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`ID: ${order.id.slice(-8)}`, 4, y);
  y += 4;
  doc.text(`Fecha: ${new Date(order.date).toLocaleString()}`, 4, y);
  y += 4;
  doc.text(`Cliente: ${order.client || 'Mostrador'}`, 4, y);
  y += 4;

  if (order.address) {
    const splitAddress = doc.splitTextToSize(`Dir: ${order.address}`, 47);
    splitAddress.forEach((line: string) => {
      doc.text(line, 4, y);
      y += 4;
    });
  }

  if (order.type === 'dine-in') {
    doc.text(`Mesa: ${order.table || 'N/A'}`, 4, y);
  } else {
    doc.text(`Tipo: PARA LLEVAR (${order.takeawayType?.toUpperCase() || 'MOSTRADOR'})`, 4, y);
  }
  y += 5;

  // Table header
  doc.setLineWidth(0.2);
  doc.line(4, y, 51, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Item', 4, y);
  doc.text('Cant', 36, y);
  doc.text('Total', 44, y);
  y += 3;
  doc.line(4, y, 51, y);
  y += 4;

  // Items
  doc.setFont('helvetica', 'normal');
  order.items.forEach((item) => {
    doc.setFontSize(7.5);
    const name = item.name.length > 20 ? item.name.substring(0, 17) + '...' : item.name;
    doc.text(name, 4, y);
    doc.text(item.quantity.toString(), 37, y);
    doc.text(`$${(item.price * item.quantity).toFixed(0)}`, 44, y);
    y += 4;

    if (item.selectedComboOptions && item.selectedComboOptions.length > 0) {
      item.selectedComboOptions.forEach((opt) => {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'italic');
        doc.text(`+ ${opt.label}`, 6, y);
        doc.setFont('helvetica', 'normal');
        y += 3.5;
      });
    }

    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      item.selectedModifiers.forEach((mod) => {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'italic');
        const isRemoval = mod.modifierName.toLowerCase().includes('sin') || 
                          mod.modifierName.toLowerCase().includes('quitar') || 
                          mod.modifierName.toLowerCase().includes('remover') || 
                          mod.modifierName.toLowerCase().includes('no ') || 
                          mod.extraPrice <= 0;
        doc.text(`${isRemoval ? '' : '+ '}${mod.modifierName}`, 6, y);
        doc.setFont('helvetica', 'normal');
        y += 3.5;
      });
    }

    if (item.note) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`* NOTA: ${item.note.toUpperCase()} *`, 6, y);
      doc.setFont('helvetica', 'normal');
      y += 4.5;
    }
  });

  y += 2;
  doc.line(4, y, 51, y);
  y += 5;

  // Totals
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 4, y);
  doc.text(`$${order.total.toFixed(0)}`, 44, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Metodo Pago: ${order.payment}`, 4, y);

  y += 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('¡GRACIAS POR SU COMPRA!', centerX, y, { align: 'center' });

  if (isDeliveryApp) {
    y += 12;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(4, y - 6, 51, y - 6);
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(order.takeawayType!.toUpperCase(), centerX, y, { align: 'center' });
    
    y += 8;
    doc.setFontSize(12);
    doc.text(order.client.toUpperCase(), centerX, y, { align: 'center' });
    
    doc.line(4, y + 4, 51, y + 4);
  } else if (isDomicilio) {
    y += 12;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(4, y - 6, 51, y - 6);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DOMICILIO', centerX, y, { align: 'center' });
    
    y += 7;
    doc.setFontSize(12);
    doc.text(order.client.toUpperCase(), centerX, y, { align: 'center' });
    
    if (order.address) {
      y += 5;
      doc.setFontSize(8.5);
      const splitAddressBottom = doc.splitTextToSize(order.address.toUpperCase(), 47);
      splitAddressBottom.forEach((line: string) => {
        doc.text(line, centerX, y, { align: 'center' });
        y += 4;
      });
    }
    
    doc.line(4, y + 2, 51, y + 2);
  }

  doc.save(`ticket_${order.id.slice(-8)}.pdf`);
};
