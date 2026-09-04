import * as XLSX from 'xlsx';
import { formatDateDotShort, formatHospitalTime, MONTHS } from '../utils/dateUtils';

/**
 * Generate and download a formatted Excel report for the selected month/year
 * Matching Ad-din Akij Medical College Hospital format
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
  const monthYearString = `MONTH: ${monthName}-${year}`;

  // 1. Build custom worksheet data structure matching the exact reference layout
  // Note: For merged cells (A1:F1, A2:F2, A4:F4), Excel displays the top-left cell (Column A).
  const wsData = [
    [hospitalName, '', '', '', '', ''],                 // Row 1 (A1:F1): Hospital Name
    [location, '', '', '', '', ''],                     // Row 2 (A2:F2): Location
    [],                                                 // Row 3: Blank
    [monthYearString, '', '', '', '', ''],              // Row 4 (A4:F4): Month & Year Banner
    [],                                                 // Row 5: Blank
    ['SL', 'ID', 'Patient', 'Date', 'TIME', 'Remark'],  // Row 6 (A6:F6): Column Headers
  ];

  // 2. Add records rows
  records.forEach((rec, idx) => {
    const sl = rec.sl || idx + 1;
    const patientId = String(rec.patientId || '');
    const patientName = String(rec.patientName || '').toUpperCase();
    const dateFormatted = formatDateDotShort(rec.date);
    const timeFormatted = formatHospitalTime(rec.time);
    const remark = rec.remark || '100';

    wsData.push([sl, patientId, patientName, dateFormatted, timeFormatted, remark]);
  });

  // 3. Create worksheet from Array of Arrays
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 4. Set explicit cell types and preserve leading zeroes for Patient ID (column B)
  const startRowIndex = 6; // 0-indexed row 6 is Excel Row 7
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

  // 5. Merge header title rows across columns A through F
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Row 1 (A1:F1) Hospital Name
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Row 2 (A2:F2) Location
    { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }, // Row 4 (A4:F4) Month & Year Banner
  ];

  // 6. Set professional column widths
  ws['!cols'] = [
    { wch: 8 },   // SL
    { wch: 16 },  // ID
    { wch: 28 },  // Patient Name
    { wch: 14 },  // Date (04.09.26)
    { wch: 14 },  // TIME (19.28AM)
    { wch: 12 },  // Remark (100)
  ];

  // 7. Create workbook and trigger download
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${monthName}-${year}`);

  const fileName = `${monthName}-${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
