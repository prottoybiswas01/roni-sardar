import PDFDocument from 'pdfkit';

/**
 * Generates a clean, simple, black-and-white print-friendly A4 PDF report.
 * Specifically customized for Ad-din Akij Medical College Hospital "One Call" Over Duty reporting.
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
        margin: 36,
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

      // --- 1. CLEAN HEADER ---
      doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold').text(
        hospitalName.toUpperCase(),
        36,
        36,
        { width: 523, align: 'center', lineBreak: false }
      );

      doc.fontSize(11).font('Helvetica').text(
        'One Call',
        36,
        58,
        { width: 523, align: 'center', lineBreak: false }
      );

      doc.fontSize(11).font('Helvetica-Bold').text(
        monthLabel,
        36,
        74,
        { width: 523, align: 'center', lineBreak: false }
      );

      // Top divider line
      doc.moveTo(36, 92).lineTo(559, 92).lineWidth(1).strokeColor('#000000').stroke();

      // --- 2. SUMMARY METRICS TEXT LINE ---
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#000000');
      const summaryText = `Total Records: ${records.length}   |   Unique Patients: ${uniquePatients}   |   Total Remark / Amount: Tk. ${computedTotal.toLocaleString()}`;
      doc.text(summaryText, 36, 98, { width: 523, align: 'center', lineBreak: false });

      // Bottom subheader divider line
      doc.moveTo(36, 114).lineTo(559, 114).lineWidth(1).strokeColor('#000000').stroke();

      // --- 3. CLEAN PATIENT RECORDS TABLE ---
      let startTableY = 124;
      let currentY = startTableY;

      const drawTableHeader = (y) => {
        doc.rect(36, y, 523, 18).strokeColor('#000000').lineWidth(1).stroke();
        doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold');
        doc.text('SL', 40, y + 5, { width: 25, align: 'center', lineBreak: false });
        doc.text('Patient ID', 70, y + 5, { width: 85, lineBreak: false });
        doc.text('Patient Name', 160, y + 5, { width: 175, lineBreak: false });
        doc.text('Date', 340, y + 5, { width: 65, lineBreak: false });
        doc.text('Time', 410, y + 5, { width: 55, lineBreak: false });
        doc.text('Remark (Tk)', 470, y + 5, { width: 82, align: 'right', lineBreak: false });
      };

      drawTableHeader(currentY);
      currentY += 18;

      records.forEach((r, idx) => {
        // Auto page break if table exceeds printable area
        if (currentY > 710) {
          doc.addPage();
          currentY = 40;
          drawTableHeader(currentY);
          currentY += 18;
        }

        const dateStr = r.date ? new Date(r.date).toISOString().split('T')[0] : '';
        const timeStr = r.time || '';
        const remarkStr = String(r.remark || '100');

        doc.fillColor('#000000').fontSize(8).font('Helvetica');
        doc.text(String(r.sl || idx + 1), 40, currentY + 3.5, { width: 25, align: 'center', lineBreak: false });
        doc.font('Helvetica-Bold').text(String(r.patientId || ''), 70, currentY + 3.5, { width: 85, lineBreak: false });
        doc.font('Helvetica').text(String(r.patientName || 'PATIENT').substring(0, 32), 160, currentY + 3.5, { width: 175, lineBreak: false });
        doc.text(dateStr, 340, currentY + 3.5, { width: 65, lineBreak: false });
        doc.text(timeStr, 410, currentY + 3.5, { width: 55, lineBreak: false });
        doc.font('Helvetica-Bold').text(remarkStr, 470, currentY + 3.5, { width: 82, align: 'right', lineBreak: false });

        doc.moveTo(36, currentY + 15).lineTo(559, currentY + 15).lineWidth(0.5).strokeColor('#cccccc').stroke();
        currentY += 15.5;
      });

      // Total summary row
      if (currentY > 700) {
        doc.addPage();
        currentY = 40;
      }
      doc.rect(36, currentY + 2, 523, 18).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold');
      doc.text(`TOTAL ENTRIES: ${records.length}`, 44, currentY + 6, { width: 200, lineBreak: false });
      doc.text(`GRAND TOTAL: Tk. ${computedTotal.toLocaleString()}`, 250, currentY + 6, { width: 300, align: 'right', lineBreak: false });

      // --- 4. SIGNATURE BLOCKS (BOTTOM OF DOCUMENT) ---
      let sigY = currentY + 60;
      if (sigY > 740) {
        doc.addPage();
        sigY = 100;
      }

      // Left Signature: Roni Sarder / Medical Technology
      const leftName = staffName && staffName.toLowerCase().includes('roni') ? 'Roni Sarder' : staffName || 'Roni Sarder';
      doc.moveTo(50, sigY).lineTo(210, sigY).lineWidth(0.8).strokeColor('#000000').stroke();
      doc.fillColor('#000000').fontSize(9.5).font('Helvetica-Bold').text(
        leftName,
        50,
        sigY + 6,
        { width: 160, align: 'center', lineBreak: false }
      );
      doc.fontSize(8.5).font('Helvetica').text(
        'Medical Technology',
        50,
        sigY + 19,
        { width: 160, align: 'center', lineBreak: false }
      );

      // Right Signature: Mizanur Rahman / Incharge
      doc.moveTo(385, sigY).lineTo(545, sigY).lineWidth(0.8).strokeColor('#000000').stroke();
      doc.fillColor('#000000').fontSize(9.5).font('Helvetica-Bold').text(
        'Mizanur Rahman',
        385,
        sigY + 6,
        { width: 160, align: 'center', lineBreak: false }
      );
      doc.fontSize(8.5).font('Helvetica').text(
        'Incharge',
        385,
        sigY + 19,
        { width: 160, align: 'center', lineBreak: false }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
