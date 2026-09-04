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
  const wsData = [
    ['', '', hospitalName],                             // Row 1: Hospital Name
    ['', '', location],                                 // Row 2: Location
    [],                                                 // Row 3: Blank
    ['', '', monthYearString],                          // Row 4: Month & Year Banner
    [],                                                 // Row 5: Blank
    ['SL', 'ID', 'Patient', 'Date', 'TIME', 'Remark'],  // Row 6: Column Headers
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

  // 3. Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 4. Force Patient ID column (column index 1 / 'B') to be explicit string cell type
  // This guarantees leading zeros like '001234' or '0250474' never get converted to numbers
  const startRowIndex = 6; // row index 6 in 0-based array is row 7 in Excel (first record)
  for (let i = 0; i < records.length; i++) {
    const rowNum = startRowIndex + i + 1; // 1-indexed for SheetJS cell reference
    const cellRef = `B${rowNum}`;
    const idVal = String(records[i].patientId || '');
    ws[cellRef] = {
      t: 's', // String type
      v: idVal,
      w: idVal,
    };
  }

  // 5. Merge header title rows across columns A through F for clean centering
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Row 1 (A1:F1) Hospital Name
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Row 2 (A2:F2) Location
    { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }, // Row 4 (A4:F4) Month & Year Banner
  ];

  // 6. Set professional column widths
  ws['!cols'] = [
    { wch: 8 },   // SL
    { wch: 14 },  // ID
    { wch: 26 },  // Patient Name
    { wch: 14 },  // Date (01.08.26)
    { wch: 14 },  // TIME (20.50PM)
    { wch: 10 },  // Remark (100)
  ];

  // 7. Create workbook and trigger download
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${monthName}-${year}`);

  const fileName = `${monthName}-${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
