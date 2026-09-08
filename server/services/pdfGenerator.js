import PDFDocument from 'pdfkit';

/**
 * Parse time string to minutes from midnight (0 to 1439) for chronological sorting
 */
const parseTimeToMinutes = (timeStr) => {
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
 * 2. Time ascending (00:00 to 23:59)
 * 3. Tiebreaker by original SL
 * Re-assigns clean sequential serial numbers (SL: 1, 2, 3...)
 */
const sortRecordsChronologically = (records = []) => {
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
 * Generates a clean, simple, black-and-white print-friendly A4 PDF report.
 * Specifically customized for Ad-din Akij Medical College Hospital "One Call" Over Duty reporting.
 * Optimized for 40-50 rows per page with fixed bottom signatures.
 *
 * @param {Object} options
 * @param {Array} options.records - List of patient records
 * @param {string} options.staffName - Staff / Doctor name (defaults to Roni Sarder)
 * @param {string} options.hospitalName - Hospital title
 * @param {number|string} options.month - Month number (1-12)
 * @param {number|string} options.year - Year
 * @param {number} options.totalAmount - Total revenue / remark sum
 * @returns {Promise<Buffer>} - Resolves to PDF Buffer
 */
export const generateMonthlyRecordsPDF = ({
  records = [],
  staffName = 'Roni Sarder',
  hospitalName = 'AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL',
  month = new Date().getMonth() + 1,
  year = new Date().getFullYear(),
  totalAmount = 0,
}) => {
  return new Promise((resolve, reject) => {
    try {
      // Sort all records chronologically from 1st of month at midnight
      const sortedRecords = sortRecordsChronologically(records);

      const doc = new PDFDocument({
        margin: 30,
        size: 'A4',
        autoFirstPage: true,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', (err) => reject(err));

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      const monthLabel =
        month === 'all' || !month
          ? `${year}`
          : `${monthNames[Number(month) - 1] || 'Month ' + month} ${year}`;

      const uniquePatients = new Set(
        sortedRecords.map((r) => String(r.patientId || '').trim()).filter(Boolean)
      ).size;

      const computedTotal =
        totalAmount ||
        sortedRecords.reduce((sum, r) => {
          const val = parseFloat(String(r.remark || '0').replace(/[^0-9.-]+/g, '')) || 0;
          return sum + val;
        }, 0);

      // --- 1. CLEAN COMPACT HEADER ---
      doc.fillColor('#000000').fontSize(15).font('Helvetica-Bold').text(
        hospitalName.toUpperCase(),
        30,
        28,
        { width: 535, align: 'center', lineBreak: false }
      );

      doc.fontSize(10).font('Helvetica').text(
        'One Call',
        30,
        48,
        { width: 535, align: 'center', lineBreak: false }
      );

      doc.fontSize(10.5).font('Helvetica-Bold').text(
        monthLabel,
        30,
        62,
        { width: 535, align: 'center', lineBreak: false }
      );

      // Top divider line
      doc.moveTo(30, 76).lineTo(565, 76).lineWidth(0.8).strokeColor('#000000').stroke();

      // --- 2. SUMMARY METRICS TEXT LINE ---
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      const summaryText = `Total Records: ${sortedRecords.length}   |   Unique Patients: ${uniquePatients}   |   Total Remark / Amount: Tk. ${computedTotal.toLocaleString()}`;
      doc.text(summaryText, 30, 82, { width: 535, align: 'center', lineBreak: false });

      // Bottom subheader divider line
      doc.moveTo(30, 96).lineTo(565, 96).lineWidth(0.8).strokeColor('#000000').stroke();

      // --- 3. CLEAN HIGH-DENSITY TABLE (FITS 40-50 ROWS PER PAGE) ---
      let startTableY = 104;
      let currentY = startTableY;

      const drawTableHeader = (y) => {
        doc.rect(30, y, 535, 15).strokeColor('#000000').lineWidth(0.8).stroke();
        doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
        doc.text('SL', 34, y + 4, { width: 22, align: 'center', lineBreak: false });
        doc.text('Patient ID', 60, y + 4, { width: 80, lineBreak: false });
        doc.text('Patient Name', 145, y + 4, { width: 180, lineBreak: false });
        doc.text('Date', 330, y + 4, { width: 65, lineBreak: false });
        doc.text('Time', 400, y + 4, { width: 55, lineBreak: false });
        doc.text('Remark (Tk)', 465, y + 4, { width: 95, align: 'right', lineBreak: false });
      };

      drawTableHeader(currentY);
      currentY += 15;

      sortedRecords.forEach((r, idx) => {
        // Auto page break: allow up to 740pt height (~45-50 rows) before breaking
        if (currentY > 740) {
          doc.addPage();
          currentY = 30;
          drawTableHeader(currentY);
          currentY += 15;
        }

        let dateStr = '';
        if (r.date) {
          const d = new Date(r.date);
          const day = String(d.getDate()).padStart(2, '0');
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          const yr = String(d.getFullYear()).slice(-2);
          dateStr = `${day}.${mo}.${yr}`;
        }
        const timeStr = r.time || '';
        const remarkStr = String(r.remark || '100');

        doc.fillColor('#000000').fontSize(7.5).font('Helvetica');
        doc.text(String(r.sl || idx + 1), 34, currentY + 2.5, { width: 22, align: 'center', lineBreak: false });
        doc.font('Helvetica-Bold').text(String(r.patientId || ''), 60, currentY + 2.5, { width: 80, lineBreak: false });
        doc.font('Helvetica').text(String(r.patientName || 'PATIENT').substring(0, 32), 145, currentY + 2.5, { width: 180, lineBreak: false });
        doc.text(dateStr, 330, currentY + 2.5, { width: 65, lineBreak: false });
        doc.text(timeStr, 400, currentY + 2.5, { width: 55, lineBreak: false });
        doc.font('Helvetica-Bold').text(remarkStr, 465, currentY + 2.5, { width: 95, align: 'right', lineBreak: false });

        doc.moveTo(30, currentY + 12).lineTo(565, currentY + 12).lineWidth(0.3).strokeColor('#dddddd').stroke();
        currentY += 12.5;
      });

      // Total summary row
      if (currentY > 735) {
        doc.addPage();
        currentY = 30;
      }
      doc.rect(30, currentY + 2, 535, 15).strokeColor('#000000').lineWidth(0.8).stroke();
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
      doc.text(`TOTAL ENTRIES: ${sortedRecords.length}`, 38, currentY + 5.5, { width: 200, lineBreak: false });
      doc.text(`GRAND TOTAL: Tk. ${computedTotal.toLocaleString()}`, 300, currentY + 5.5, { width: 260, align: 'right', lineBreak: false });

      // --- 4. SIGNATURE BLOCKS (FIXED DIRECTLY AT THE VERY BOTTOM OF THE DOCUMENT) ---
      const sigY = 780;

      // Left Signature: Roni Sarder / Medical Technology
      doc.moveTo(50, sigY).lineTo(190, sigY).lineWidth(0.8).strokeColor('#000000').stroke();
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000000').text('Roni Sarder', 50, sigY + 5, { width: 140, align: 'center', lineBreak: false });
      doc.fontSize(7.5).font('Helvetica').fillColor('#333333').text('Medical Technology', 50, sigY + 16, { width: 140, align: 'center', lineBreak: false });

      // Right Signature: Mizanur Rahman / Incharge
      doc.moveTo(375, sigY).lineTo(515, sigY).lineWidth(0.8).strokeColor('#000000').stroke();
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000000').text('Mizanur Rahman', 375, sigY + 5, { width: 140, align: 'center', lineBreak: false });
      doc.fontSize(7.5).font('Helvetica').fillColor('#333333').text('Incharge', 375, sigY + 16, { width: 140, align: 'center', lineBreak: false });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
