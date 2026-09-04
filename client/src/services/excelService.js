import * as XLSX from 'xlsx';
import { formatDateDisplay, MONTHS } from '../utils/dateUtils';

/**
 * Generate and download a formatted Excel report for the selected month/year
 * Guarantees leading zeros on Patient ID are preserved as string types
 */
export const exportMonthlyReportToExcel = ({
  records = [],
  month,
  year,
  hospitalName = 'GENERAL HOSPITAL & MEDICAL CENTER',
  location = 'DEPARTMENT OF OVER DUTY SERVICES',
}) => {
  const monthObj = MONTHS.find((m) => m.value === Number(month));
  const monthName = monthObj ? monthObj.name.toUpperCase() : 'ALL';
  const monthYearString = `MONTH: ${monthName}-${year}`;

  // 1. Build custom worksheet data structure
  const wsData = [
    [hospitalName],                                     // Row 1: Title
    [location],                                         // Row 2: Subtitle / Location
    [monthYearString],                                  // Row 3: Month/Year Banner
    [],                                                 // Row 4: Empty space
    ['SL', 'ID', 'Patient', 'Date', 'TIME', 'Remark'],  // Row 5: Column Headers
  ];

  // 2. Add records rows
  records.forEach((rec, idx) => {
    const sl = rec.sl || idx + 1;
    const patientId = String(rec.patientId || '');
    const patientName = String(rec.patientName || '');
    const dateFormatted = formatDateDisplay(rec.date);
    const time = String(rec.time || '');
    const remark = String(rec.remark || '');

    wsData.push([sl, patientId, patientName, dateFormatted, time, remark]);
  });

  // 3. Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 4. Force Patient ID column (column index 1 / 'B') to be explicit string cell type
  // This guarantees leading zeros like '001234' or '0250474' never get converted to numbers
  const startRowIndex = 5; // row index 5 in 0-based array is row 6 in Excel
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

  // 5. Merge header title rows across columns A through F
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Row 1 (A1:F1)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Row 2 (A2:F2)
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }, // Row 3 (A3:F3)
  ];

  // 6. Set professional column widths
  ws['!cols'] = [
    { wch: 8 },   // SL
    { wch: 16 },  // ID
    { wch: 28 },  // Patient Name
    { wch: 14 },  // Date
    { wch: 12 },  // Time
    { wch: 32 },  // Remark
  ];

  // 7. Create workbook and trigger download
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${monthName}_${year}`);

  const fileName = `OVER_DUTY_${monthName}_${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
