import ExcelJS from 'exceljs';
import { MONTHS } from '../utils/dateUtils';

/**
 * Generate and download a formatted Excel (.xlsx) report matching Ad-din Akij Medical College Hospital format
 * Row 1 (A1:F1): AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL (Merged, Bold 14pt, Centered, Thin Border)
 * Row 2 (A2:F2): One Call (Merged, Bold 12pt, Centered, Thin Border)
 * Row 3 (A3:F3): Month / Period (Merged, Bold 12pt, Centered, Thin Border)
 * Row 4 (A4:F4): Blank Gap (Merged, Thin Border)
 * Row 5: Column Headers: SL | Patient ID | Patient Name | Date | Time | Remark (Bold 11pt, Centered, Thin Border)
 * Rows 6+: Data rows with thin borders and leading-zero text preservation
 */
export const exportMonthlyReportToExcel = async ({
  records = [],
  month,
  year,
  hospitalName = 'Ad-din Akij Medical College Hospital',
  location = 'Boyra, Khulna',
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ad-din Hospital System';
  workbook.created = new Date();

  const monthObj = MONTHS.find((m) => m.value === Number(month));
  const monthName = monthObj ? monthObj.name.toUpperCase() : 'ALL';
  const monthYearString =
    month === 'all' || !month
      ? `YEAR: ${year}`
      : `MONTH: ${monthName} ${year}`;

  const hName = (hospitalName || 'AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL').toUpperCase();
  const sheetName = (monthName !== 'ALL' ? `${monthName} ${year}` : `${year}`)
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
  r3.value = monthYearString;
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

  // If records are fewer than 24 rows, fill framed template rows up to row 24
  const minRows = 24;
  while (currentRow <= minRows) {
    const row = worksheet.getRow(currentRow);
    row.height = 19;
    applyBorderToRow(currentRow);
    currentRow++;
  }

  // Trigger download in browser
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${monthName !== 'ALL' ? `${monthName}-${year}` : `${year}`}_OverDuty_Report.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};
