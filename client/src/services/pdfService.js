import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateDotShort, formatHospitalTime, MONTHS } from '../utils/dateUtils';
import { formatSL } from '../utils/formatters';

/**
 * Generate and download a formatted monochrome black & white PDF report
 * Exactly matching Ad-din Akij Medical College Hospital "One Call" format.
 * High-density layout supporting 40-50 rows per page with fixed bottom signatures.
 */
export const exportMonthlyReportToPDF = ({
  records = [],
  month,
  year,
  hospitalName = 'AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL',
}) => {
  const monthObj = MONTHS.find((m) => m.value === Number(month));
  const monthName = monthObj ? monthObj.name : 'All Months';
  const monthYearString = `${monthName} ${year}`;

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
  doc.setFontSize(13.5);
  doc.setTextColor(0, 0, 0);
  doc.text(hospitalName.toUpperCase(), pageWidth / 2, 12, { align: 'center' });

  // 2. "One Call" Header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('One Call', pageWidth / 2, 17.5, { align: 'center' });

  // 3. Month & Year
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(monthYearString, pageWidth / 2, 23, { align: 'center' });

  // Divider Line 1
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(12, 25.5, pageWidth - 12, 25.5);

  // 4. One-line Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const summaryText = `Total Records: ${records.length}   |   Unique Patients: ${uniquePatients}   |   Total Remark / Amount: Tk. ${totalAmount.toLocaleString()}`;
  doc.text(summaryText, pageWidth / 2, 29.5, { align: 'center' });

  // Divider Line 2
  doc.line(12, 32, pageWidth - 12, 32);

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

  // 6. Render AutoTable (Compact high-density: fits 40-50 rows per page)
  autoTable(doc, {
    startY: 34.5,
    head: [['SL', 'Patient ID', 'Patient Name', 'Date', 'Time', 'Remark (Tk)']],
    body: tableData,
    foot: [
      [
        {
          content: `TOTAL ENTRIES: ${records.length}`,
          colSpan: 5,
          styles: { halign: 'left', fontStyle: 'bold', fontSize: 8 },
        },
        {
          content: `Tk. ${totalAmount.toLocaleString()}`,
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    theme: 'plain',
    headStyles: {
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 1.2,
      lineWidth: { top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 },
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      fontSize: 7.5,
      cellPadding: 0.9,
      lineWidth: { bottom: 0.15 },
      lineColor: [210, 210, 210],
    },
    footStyles: {
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 1.2,
      lineWidth: { top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 },
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 }, // SL
      1: { cellWidth: 26, fontStyle: 'bold' }, // Patient ID
      2: { cellWidth: 68 }, // Patient Name
      3: { cellWidth: 24, halign: 'center' }, // Date
      4: { cellWidth: 24, halign: 'center' }, // Time
      5: { cellWidth: 34, halign: 'right', fontStyle: 'bold' }, // Remark (Tk)
    },
    margin: { top: 34.5, left: 12, right: 12, bottom: 28 },
  });

  // 7. Signature Blocks (Anchored directly at the very bottom of the document)
  const pageCount = doc.internal.getNumberOfPages();
  doc.setPage(pageCount);

  const sigY = pageHeight - 20;

  // Left Signature: Roni Sarder / Medical Technology
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(18, sigY, 68, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Roni Sarder', 43, sigY + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Medical Technology', 43, sigY + 7.5, { align: 'center' });

  // Right Signature: Mizanur Rahman / Incharge
  doc.line(pageWidth - 68, sigY, pageWidth - 18, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Mizanur Rahman', pageWidth - 43, sigY + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Incharge', pageWidth - 43, sigY + 7.5, { align: 'center' });

  // 8. Save and Download PDF
  const fileName = `OverDuty_Report_${monthName}_${year}.pdf`;
  doc.save(fileName);
};
