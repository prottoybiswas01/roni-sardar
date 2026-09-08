import PDFDocument from 'pdfkit';

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
        records.map((r) => String(r.patientId || '').trim()).filter(Boolean)
      ).size;

      const computedTotal =
        totalAmount ||
        records.reduce((sum, r) => {
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
      const summaryText = `Total Records: ${records.length}   |   Unique Patients: ${uniquePatients}   |   Total Remark / Amount: Tk. ${computedTotal.toLocaleString()}`;
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

      records.forEach((r, idx) => {
        // Auto page break: allow up to 740pt height (~45-50 rows) before breaking
        if (currentY > 740) {
          doc.addPage();
          currentY = 30;
          drawTableHeader(currentY);
          currentY += 15;
        }

        const dateStr = r.date ? new Date(r.date).toISOString().split('T')[0] : '';
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
      doc.text(`TOTAL ENTRIES: ${records.length}`, 38, currentY + 5.5, { width: 200, lineBreak: false });
      doc.text(`GRAND TOTAL: Tk. ${computedTotal.toLocaleString()}`, 300, currentY + 5.5, { width: 260, align: 'right', lineBreak: false });

      // --- 4. SIGNATURE BLOCKS (FIXED DIRECTLY AT THE VERY BOTTOM OF THE DOCUMENT) ---
      const sigY = 780;

      // Left Signature: Roni Sarder / Medical Technology
      const leftName = staffName && staffName.toLowerCase().includes('roni') ? 'Roni Sarder' : staffName || 'Roni Sarder';
      doc.moveTo(45, sigY).lineTo(200, sigY).lineWidth(0.8).strokeColor('#000000').stroke();
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold').text(
        leftName,
        45,
        sigY + 4.5,
        { width: 155, align: 'center', lineBreak: false }
      );
      doc.fontSize(7.5).font('Helvetica').text(
        'Medical Technology',
        45,
        sigY + 15,
        { width: 155, align: 'center', lineBreak: false }
      );

      // Right Signature: Mizanur Rahman / Incharge
      doc.moveTo(395, sigY).lineTo(550, sigY).lineWidth(0.8).strokeColor('#000000').stroke();
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold').text(
        'Mizanur Rahman',
        395,
        sigY + 4.5,
        { width: 155, align: 'center', lineBreak: false }
      );
      doc.fontSize(7.5).font('Helvetica').text(
        'Incharge',
        395,
        sigY + 15,
        { width: 155, align: 'center', lineBreak: false }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
