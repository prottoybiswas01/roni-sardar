import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateDotShort, formatHospitalTime, MONTHS } from '../utils/dateUtils';
import { formatSL } from '../utils/formatters';

/**
 * Generate and download a formatted monochrome black & white PDF report
 * Exactly matching Ad-din Akij Medical College Hospital "One Call" format with signatures.
 */
export const exportMonthlyReportToPDF = ({
  records = [],
  month,
  year,
  hospitalName = 'AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL',
}) => {
  const monthObj = MONTHS.find((m) => m.value === Number(month));
  const monthName = monthObj ? monthObj.name : 'All Months';
  const monthYearString = `${monthName.toUpperCase()} ${year}`;

  const uniquePatients = new Set(
    records.map((r) => String(r.patientId || '').trim()).filter(Boolean)
  ).size;

  const totalAmount = records.reduce((sum, r) => {
    const val = parseFloat(String(r.remark || '0').replace(/[^0-9.-]+/g, '')) || 0;
    return sum + val;
  }, 0);

  // Initialize jsPDF in portrait A4 (width: 210mm, height: 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Hospital Official Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(hospitalName.toUpperCase(), pageWidth / 2, 14, { align: 'center' });

  // 2. "One Call" Header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text('One Call', pageWidth / 2, 20, { align: 'center' });

  // 3. Month & Year
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(monthYearString, pageWidth / 2, 26, { align: 'center' });

  // Divider Line 1
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(14, 29, pageWidth - 14, 29);

  // 4. One-line Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const summaryText = `Total Records: ${records.length}   |   Unique Patients: ${uniquePatients}   |   Total Remark / Amount: Tk. ${totalAmount.toLocaleString()}`;
  doc.text(summaryText, pageWidth / 2, 33.5, { align: 'center' });

  // Divider Line 2
  doc.line(14, 36, pageWidth - 14, 36);

  // 5. Build Table Rows
  const tableData = records.map((rec, index) => {
    const slVal = formatSL(rec.sl || index + 1);
    const idVal = String(rec.patientId || '');
    const nameVal = String(rec.patientName || 'PATIENT').toUpperCase();
    const dateVal = formatDateDotShort(rec.date);
    const timeVal = formatHospitalTime(rec.time);
    const remarkVal = String(rec.remark || '100');

    return [slVal, idVal, nameVal, dateVal, timeVal, remarkVal];
  });

  // 6. Render AutoTable (Black & White, Print-friendly)
  autoTable(doc, {
    startY: 39,
    head: [['SL', 'Patient ID', 'Patient Name', 'Date', 'Time', 'Remark (Tk)']],
    body: tableData,
    foot: [[`TOTAL ENTRIES: ${records.length}`, '', '', '', '', `Tk. ${totalAmount.toLocaleString()}`]],
    theme: 'plain',
    headStyles: {
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 2,
      lineWidth: { top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 },
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      fontSize: 8,
      cellPadding: 1.8,
      lineWidth: { bottom: 0.15 },
      lineColor: [200, 200, 200],
    },
    footStyles: {
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2,
      lineWidth: { top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 },
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 }, // SL
      1: { cellWidth: 28, fontStyle: 'bold' }, // Patient ID
      2: { cellWidth: 62 }, // Patient Name
      3: { cellWidth: 24, halign: 'center' }, // Date
      4: { cellWidth: 24, halign: 'center' }, // Time
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }, // Remark (Tk)
    },
    margin: { top: 39, left: 14, right: 14, bottom: 35 },
  });

  // 7. Signature Blocks (at the bottom)
  let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 180;
  if (finalY + 30 > pageHeight - 15) {
    doc.addPage();
    finalY = 30;
  }

  const sigY = finalY + 22;

  // Left Signature: Roni Sarder / Medical Technology
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(20, sigY, 70, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Roni Sarder', 45, sigY + 4.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Medical Technology', 45, sigY + 8.5, { align: 'center' });

  // Right Signature: Mizanur Rahman / Incharge
  doc.line(pageWidth - 70, sigY, pageWidth - 20, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Mizanur Rahman', pageWidth - 45, sigY + 4.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Incharge', pageWidth - 45, sigY + 8.5, { align: 'center' });

  // 8. Save and Download PDF
  const fileName = `OverDuty_Report_${monthName}_${year}.pdf`;
  doc.save(fileName);
};
