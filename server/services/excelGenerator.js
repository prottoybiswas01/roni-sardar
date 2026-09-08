import * as XLSX from 'xlsx';

/**
 * Generate a formatted Excel (.xlsx) buffer matching Ad-din Akij Medical College Hospital format
 * Row 1 (A1:F1): AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL (Merged & Centered)
 * Row 2 (A2:F2): One Call (Merged & Centered)
 * Row 3 (A3:F3): Month / Period (Merged & Centered)
 * Row 4: Blank gap
 * Row 5: Column Headers: SL | Patient ID | Patient Name | Date | Time | Remark
 * Rows 6+: Data rows with leading-zero preservation
 *
 * @param {Object} options
 * @param {Array} options.records
 * @param {string} options.hospitalName
 * @param {string} options.location
 * @param {number|string} options.month
 * @param {number|string} options.year
 * @returns {Buffer} XLSX Buffer
 */
export const generateMonthlyRecordsExcelBuffer = ({
  records = [],
  hospitalName = 'AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL',
  location = 'Boyra, Khulna',
  month = new Date().getMonth() + 1,
  year = new Date().getFullYear(),
}) => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  let monthLabel = '';
  if (month === 'all' || !month) {
    monthLabel = `YEAR: ${year}`;
  } else {
    const mName = monthNames[Number(month) - 1] || `MONTH ${month}`;
    monthLabel = `MONTH: ${mName.toUpperCase()} ${year}`;
  }

  const hName = (hospitalName || 'AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL').toUpperCase();

  // 1. Build Worksheet Data
  const wsData = [
    [hName, '', '', '', '', ''],                       // Row 1 (A1:F1): Hospital Name
    ['One Call', '', '', '', '', ''],                  // Row 2 (A2:F2): Duty Subtitle
    [monthLabel, '', '', '', '', ''],                  // Row 3 (A3:F3): Month & Year Banner
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
  // Headers are on Row 5 (0-indexed 4), so data starts on Row 6 (0-indexed 5)
  const startRowIndex = 5;
  for (let i = 0; i < records.length; i++) {
    const rowNum = startRowIndex + i + 1; // 1-indexed Excel row
    const cellRef = `B${rowNum}`;
    const idVal = String(records[i].patientId || '');
    ws[cellRef] = {
      t: 's', // Explicit String type
      v: idVal,
      w: idVal,
    };
  }

  // 5. Merge header title rows across columns A through F (0 to 5)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Row 1 (A1:F1): Hospital Name
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Row 2 (A2:F2): One Call
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }, // Row 3 (A3:F3): Month & Year Banner
  ];

  // 6. Set professional column widths
  ws['!cols'] = [
    { wch: 8 },  // Column A: SL
    { wch: 16 }, // Column B: Patient ID
    { wch: 30 }, // Column C: Patient Name
    { wch: 15 }, // Column D: Date
    { wch: 15 }, // Column E: Time
    { wch: 15 }, // Column F: Remark
  ];

  // 7. Create workbook
  const wb = XLSX.utils.book_new();
  const safeSheetName = (monthLabel.replace(/MONTH:\s*/i, '') || 'Records')
    .substring(0, 31)
    .replace(/[:\\\/\?\*\[\]]/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  // 8. Generate binary XLSX buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
};

/**
 * Generate CSV representation of records for Excel without Month/Year columns
 */
export const generateRecordsCSV = (records = []) => {
  const headers = ['SL', 'Patient ID', 'Patient Name', 'Date', 'Time', 'Remark'];
  const rows = records.map((r, idx) => {
    let dateStr = '';
    if (r.date) {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const yr = d.getFullYear();
        dateStr = `${day}/${mo}/${yr}`;
      }
    }

    return [
      r.sl || idx + 1,
      `="${String(r.patientId || '')}"`, // force string format in Excel
      `"${String(r.patientName || '').replace(/"/g, '""')}"`,
      dateStr,
      `"${String(r.time || '').replace(/"/g, '""')}"`,
      `"${String(r.remark || '100').replace(/"/g, '""')}"`,
    ];
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
};
