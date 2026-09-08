import ExcelJS from 'exceljs';

/**
 * Parse time string to minutes from midnight (0 to 1439) for chronological sorting
 */
export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const str = String(timeStr).trim().toUpperCase();
  const match = str.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10) || 0;
    const period = match[3] ? match[3].toUpperCase() : null;

    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    if (!period && hours > 23) hours = 23;

    return hours * 60 + minutes;
  }

  const parts = str.split(/[:.]/);
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10) || 0;
    let m = parseInt(parts[1], 10) || 0;
    if (str.includes('PM') && h < 12) h += 12;
    if (str.includes('AM') && h === 12) h = 0;
    return h * 60 + m;
  }

  return 0;
};

/**
 * Sorts records strictly in chronological order:
 * 1. Date ascending (1st of month to end of month)
 * 2. Time ascending (00:00 to 23:59, from midnight)
 * 3. Tiebreaker by original SL
 * Re-assigns clean sequential serial numbers (SL: 1, 2, 3...)
 */
export const sortRecordsChronologically = (records = []) => {
  return [...records]
    .sort((a, b) => {
      // 1. Compare Date
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      if (dateA !== dateB) {
        return dateA - dateB;
      }

      // 2. Compare Time (00:00 to 23:59)
      const timeA = parseTimeToMinutes(a.time);
      const timeB = parseTimeToMinutes(b.time);
      if (timeA !== timeB) {
        return timeA - timeB;
      }

      // 3. Tiebreaker by SL
      const slA = Number(a.sl) || 0;
      const slB = Number(b.sl) || 0;
      return slA - slB;
    })
    .map((rec, index) => ({
      ...rec,
      sl: index + 1, // Auto sequential serial numbering
    }));
};

/**
 * Generate a formatted Excel (.xlsx) buffer matching Ad-din Akij Medical College Hospital format
 * Row 1 (A1:F1): AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL (Merged, Bold 14pt, Centered, Thin Border)
 * Row 2 (A2:F2): One Call (Merged, Bold 12pt, Centered, Thin Border)
 * Row 3 (A3:F3): Month / Period (Merged, Bold 12pt, Centered, Thin Border)
 * Row 4 (A4:F4): Blank Gap (Merged, Thin Border)
 * Row 5: Column Headers: SL | Patient ID | Patient Name | Date | Time | Remark (Bold 11pt, Centered, Thin Border)
 * Rows 6+: Data rows with thin borders and leading-zero text preservation
 */
export const generateMonthlyRecordsExcelBuffer = async ({
  records = [],
  hospitalName = 'AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL',
  location = 'Boyra, Khulna',
  month = new Date().getMonth() + 1,
  year = new Date().getFullYear(),
}) => {
  // Sort all records strictly in chronological order (Date ascending, Time ascending from 1st of month 12:00 AM)
  const sortedRecords = sortRecordsChronologically(records);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ad-din Hospital System';
  workbook.created = new Date();

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
  const sheetName = (monthLabel.replace(/MONTH:\s*/i, '') || 'SEPTEMBER 2026')
    .substring(0, 31)
    .replace(/[:\\\/\?\*\[\]]/g, '_');

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  // Set column widths
  worksheet.columns = [
    { key: 'sl', width: 9 },          // Column A: SL
    { key: 'patientId', width: 18 },  // Column B: Patient ID
    { key: 'patientName', width: 28 },// Column C: Patient Name
    { key: 'date', width: 16 },       // Column D: Date
    { key: 'time', width: 15 },       // Column E: Time
    { key: 'remark', width: 15 },     // Column F: Remark
  ];

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const applyBorderToRow = (rowNumber) => {
    for (let c = 1; c <= 6; c++) {
      worksheet.getCell(rowNumber, c).border = thinBorder;
    }
  };

  // Row 1: Hospital Name (Bold & Large)
  worksheet.mergeCells('A1:F1');
  const r1 = worksheet.getCell('A1');
  r1.value = hName;
  r1.font = { name: 'Calibri', size: 13.5, bold: true };
  r1.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 24;
  applyBorderToRow(1);

  // Row 2: One Call (Bold & Large)
  worksheet.mergeCells('A2:F2');
  const r2 = worksheet.getCell('A2');
  r2.value = 'One Call';
  r2.font = { name: 'Calibri', size: 12, bold: true };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 20;
  applyBorderToRow(2);

  // Row 3: Month & Year (Bold & Large)
  worksheet.mergeCells('A3:F3');
  const r3 = worksheet.getCell('A3');
  r3.value = monthLabel;
  r3.font = { name: 'Calibri', size: 12, bold: true };
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(3).height = 20;
  applyBorderToRow(3);

  // Row 4: Blank gap with border
  worksheet.mergeCells('A4:F4');
  worksheet.getRow(4).height = 14;
  applyBorderToRow(4);

  // Row 5: Column Headers (Bold with full borders)
  const headers = ['SL', 'Patient ID', 'Patient Name', 'Date', 'Time', 'Remark'];
  const r5 = worksheet.getRow(5);
  r5.values = headers;
  r5.height = 21;
  r5.font = { name: 'Calibri', size: 11, bold: true };
  for (let c = 1; c <= 6; c++) {
    const cell = worksheet.getCell(5, c);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  }

  // Rows 6+: Data rows with borders
  let currentRow = 6;
  sortedRecords.forEach((rec, idx) => {
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

    const row = worksheet.getRow(currentRow);
    row.values = [sl, patientId, patientName, dateFormatted, timeFormatted, remark];
    row.height = 19;
    row.font = { name: 'Calibri', size: 11 };

    worksheet.getCell(currentRow, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Column B: Patient ID as explicit text string (preserves leading zeroes)
    const idCell = worksheet.getCell(currentRow, 2);
    idCell.numFmt = '@';
    idCell.value = patientId;
    idCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell(currentRow, 3).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell(currentRow, 4).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell(currentRow, 5).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell(currentRow, 6).alignment = { horizontal: 'center', vertical: 'middle' };

    applyBorderToRow(currentRow);
    currentRow++;
  });

  // If records are fewer than 24 rows, fill framed template rows up to row 24 (matching exact clinical template layout)
  const minRows = 24;
  while (currentRow <= minRows) {
    const row = worksheet.getRow(currentRow);
    row.height = 19;
    applyBorderToRow(currentRow);
    currentRow++;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

/**
 * Generate CSV representation of records for Excel without Month/Year columns
 */
export const generateRecordsCSV = (records = []) => {
  const sortedRecords = sortRecordsChronologically(records);
  const headers = ['SL', 'Patient ID', 'Patient Name', 'Date', 'Time', 'Remark'];
  const rows = sortedRecords.map((r, idx) => {
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
      `="${String(r.patientId || '')}"`,
      `"${String(r.patientName || '').replace(/"/g, '""')}"`,
      dateStr,
      `"${String(r.time || '').replace(/"/g, '""')}"`,
      `"${String(r.remark || '100').replace(/"/g, '""')}"`,
    ];
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
};
