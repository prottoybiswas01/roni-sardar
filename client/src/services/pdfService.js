import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateDotShort, formatHospitalTime, MONTHS } from '../utils/dateUtils';
import { formatSL } from '../utils/formatters';

/**
 * Generate and download a formatted PDF report for the selected month/year
 * Matching Ad-din Akij Medical College Hospital format
 */
export const exportMonthlyReportToPDF = ({
  records = [],
  month,
  year,
  hospitalName = 'Ad-din Akij Medical College Hospital',
  location = 'Boyra, Khulna',
}) => {
  const monthObj = MONTHS.find((m) => m.value === Number(month));
  const monthName = monthObj ? monthObj.name.toUpperCase() : 'ALL';
  const monthYearString = `MONTH: ${monthName}-${year}`;

  // Initialize jsPDF in portrait A4
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Hospital Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(hospitalName, pageWidth / 2, 16, { align: 'center' });

  // 2. Department / Location Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(location, pageWidth / 2, 22, { align: 'center' });

  // 3. Month & Year Banner Bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(monthYearString, pageWidth / 2, 29, { align: 'center' });

  // Subtle separator line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.line(14, 32, pageWidth - 14, 32);

  // Metadata summary (Total records)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Entries: ${records.length}`, 14, 37);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - 14, 37, { align: 'right' });

  // 4. Build Table Rows
  const tableData = records.map((rec, index) => {
    const slVal = formatSL(rec.sl || index + 1);
    const idVal = String(rec.patientId || '');
    const nameVal = String(rec.patientName || '').toUpperCase();
    const dateVal = formatDateDotShort(rec.date);
    const timeVal = formatHospitalTime(rec.time);
    const remarkVal = String(rec.remark || '100');

    return [slVal, idVal, nameVal, dateVal, timeVal, remarkVal];
  });

  // 5. Render AutoTable
  autoTable(doc, {
    startY: 40,
    head: [['SL', 'ID', 'Patient', 'Date', 'TIME', 'Remark']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: 2.5,
    },
    bodyStyles: {
      textColor: [30, 41, 59], // Slate 800
      fontSize: 8.5,
      cellPadding: 2.2,
      lineColor: [203, 213, 225], // Slate 300
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate 50
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14, fontStyle: 'bold' }, // SL
      1: { cellWidth: 26, fontStyle: 'bold', textColor: [15, 23, 42] }, // ID
      2: { cellWidth: 50 }, // Patient
      3: { cellWidth: 24, halign: 'center' }, // Date (01.08.26)
      4: { cellWidth: 24, halign: 'center' }, // TIME (20.50PM)
      5: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // Remark (100)
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      const footerStr = `Page ${data.pageNumber} of ${pageCount}`;
      doc.text(footerStr, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, {
        align: 'center',
      });
    },
    margin: { top: 40, left: 14, right: 14, bottom: 15 },
  });

  // 6. Save and Download
  const fileName = `${monthName}-${year}.pdf`;
  doc.save(fileName);
};
