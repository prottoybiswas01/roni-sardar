import * as XLSX from 'xlsx';
import { MONTHS } from '../utils/dateUtils';

/**
 * Generate and download a formatted Excel (.xlsx) report matching Ad-din Akij Medical College Hospital format
 * Row 1 (A1:F1): AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL (Merged & Centered)
 * Row 2 (A2:F2): One Call (Merged & Centered)
 * Row 3 (A3:F3): Month / Period (Merged & Centered)
 * Row 4: Blank gap
 * Row 5: Column Headers: SL | Patient ID | Patient Name | Date | Time | Remark
 * Rows 6+: Data rows with leading-zero preservation
 */
export const exportMonthlyReportToExcel = ({
  records = [],
  month,
  year,
  hospitalName = 'Ad-din Akij Medical College Hospital',
  location = 'Boyra, Khulna',
}) => {
  const monthObj = MONTHS.find((m) => m.value === Number(month));
  const monthName = monthObj ? monthObj.name.toUpperCase() : 'ALL';
  const monthYearString =
    month === 'all' || !month
      ? `YEAR: ${year}`
      : `MONTH: ${monthName} ${year}`;

  const hName = (hospitalName || 'AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL').toUpperCase();

  // 1. Build custom worksheet data structure matching the exact reference layout
  const wsData = [
    [hName, '', '', '', '', ''],                       // Row 1 (A1:F1): Hospital Name
    ['One Call', '', '', '', '', ''],                  // Row 2 (A2:F2): Duty Title
    [monthYearString, '', '', '', '', ''],             // Row 3 (A3:F3): Month & Year Banner
    [],                                                // Row 4: Blank gap
    ['SL', 'Patient ID', 'Patient Name', 'Date', 'Time', 'Remark'], // Row 5: Column Headers
  ];

  // 2. Add records rows
  records.forEach((rec, idx) => {
    const sl = rec.sl || idx + 1;
    const patientId = String(rec.patientId || '');
    const patientName = String(rec.patientName || '').toUpperCase();
    
    let dateFormatted = '';
    if (rec.date) {
      const d = new Date(rec.date);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const yr = d.getFullYear();
        dateFormatted = `${day}/${mo}/${yr}`;
      }
    }

    const timeFormatted = String(rec.time || '');
    const remark = String(rec.remark || '100');

    wsData.push([sl, patientId, patientName, dateFormatted, timeFormatted, remark]);
  });

  // 3. Create worksheet from Array of Arrays
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 4. Set explicit cell types and preserve leading zeroes for Patient ID (column B)
  // Headers are on Row 5 (0-indexed row 4), so data rows start on Row 6 (0-indexed row 5)
  const startRowIndex = 5;
  for (let i = 0; i < records.length; i++) {
    const rowNum = startRowIndex + i + 1; // 1-indexed Excel row number
    const cellRef = `B${rowNum}`;
    const idVal = String(records[i].patientId || '');
    ws[cellRef] = {
      t: 's', // String type (guarantees leading zeros like '012555' or '001234')
      v: idVal,
      w: idVal,
    };
  }

  // 5. Merge header title rows across columns A through F (0 to 5)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Row 1 (A1:F1) Hospital Name
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Row 2 (A2:F2) One Call
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }, // Row 3 (A3:F3) Month & Year Banner
  ];

  // 6. Set professional column widths
  ws['!cols'] = [
    { wch: 8 },  // Column A: SL
    { wch: 16 }, // Column B: Patient ID
    { wch: 30 }, // Column C: Patient Name
    { wch: 15 }, // Column D: Date (DD/MM/YYYY)
    { wch: 15 }, // Column E: Time (02.03AM)
    { wch: 15 }, // Column F: Remark (100)
  ];

  // 7. Create workbook and trigger download
  const wb = XLSX.utils.book_new();
  const safeSheetName = (monthName !== 'ALL' ? `${monthName}-${year}` : `${year}`)
    .substring(0, 31)
    .replace(/[:\\\/\?\*\[\]]/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  const fileName = `${monthName !== 'ALL' ? `${monthName}-${year}` : `${year}`}_OverDuty_Report.xlsx`;
  XLSX.writeFile(wb, fileName);
};
