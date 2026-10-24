import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const generateInvoicePdf = (invoice: any, institution: any) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text(institution.name, 14, 22);
  doc.setFontSize(11);
  doc.text('Commission Invoice', 14, 30);

  // Institution Details
  autoTable(doc, {
    body: [
      [{ content: 'Invoice To:', styles: { fontStyle: 'bold' } }, institution.name],
      [{ content: 'Address:', styles: { fontStyle: 'bold' } }, institution.physicalAddress],
      [{ content: 'Email:', styles: { fontStyle: 'bold' } }, institution.contactEmail],
    ],
    startY: 40,
    theme: 'plain',
    styles: { fontSize: 10 },
  });

  // Invoice Details
  autoTable(doc, {
    body: [
      [{ content: 'Invoice #:', styles: { fontStyle: 'bold' } }, invoice.id],
      [{ content: 'Billing Period:', styles: { fontStyle: 'bold' } }, format(new Date(invoice.period + '-02'), 'MMMM yyyy')],
      [{ content: 'Due Date:', styles: { fontStyle: 'bold' } }, format(invoice.dueDate.toDate(), 'PPP')],
    ],
    startY: (doc as any).lastAutoTable.finalY + 10,
    theme: 'plain',
    styles: { fontSize: 10 },
  });

  // Invoice Items
  autoTable(doc, {
    head: [['Description', 'Amount (MWK)']],
    body: [
      [`Platform commission for ${format(new Date(invoice.period + '-02'), 'MMMM yyyy')}`, invoice.amount.toLocaleString(undefined, {minimumFractionDigits: 2})],
    ],
    startY: (doc as any).lastAutoTable.finalY + 10,
  });

  // Totals
  autoTable(doc, {
    body: [
      [{ content: 'Total Amount Due:', styles: { fontStyle: 'bold', halign: 'right' } }, { content: `MWK ${invoice.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`, styles: { fontStyle: 'bold', halign: 'right' } }],
      [{ content: 'Amount Paid:', styles: { halign: 'right' } }, { content: `MWK ${invoice.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}`, styles: { halign: 'right' } }],
      [{ content: 'Balance Due:', styles: { fontStyle: 'bold', halign: 'right' } }, { content: `MWK ${(invoice.amount - invoice.amountPaid).toLocaleString(undefined, {minimumFractionDigits: 2})}`, styles: { fontStyle: 'bold', halign: 'right' } }],
    ],
    startY: (doc as any).lastAutoTable.finalY + 2,
    theme: 'plain',
  });

  doc.output('pdfobjectnewwindow');
};
