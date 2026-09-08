import PDFDocument from 'pdfkit';

/**
 * Generates a clean, simple, black-and-white print-friendly A4 PDF report.
 * Optimized specifically for monochrome / black & white printers (zero ink waste).
 * @param {Object} options
 * @param {Array} options.records - List of patient records
 * @param {string} options.staffName - Staff / Doctor name
 * @param {string} options.hospitalName - Hospital title
 * @param {string} options.location - Ward / Location
 * @param {number|string} options.month - Month number (1-12)
 * @param {number|string} options.year - Year
 * @param {number} options.totalAmount - Total revenue / remark sum
 * @returns {Promise<Buffer>} - Resolves to PDF Buffer
 */
export const generateMonthlyRecordsPDF = ({
  records = [],
  staffName = 'Staff Member',
  hospitalName = 'Ad-din Akij Medical College Hospital',
  location = 'Clinical Over Duty Ward',
  month = new Date().getMonth() + 1,
  year = new Date().getFullYear(),
  totalAmount = 0,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 36,
        size: 'A4',
        bufferPages: true,
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
      const monthLabel = month === 'all' || !month ? 'Full Year' : `${monthNames[Number(month) - 1] || 'Month ' + month}`;
      const uniquePatients = new Set(records.map((r) => String(r.patientId || '').trim()).filter(Boolean)).size;
      const computedTotal = totalAmount || records.reduce((sum, r) => {
        const val = parseFloat(String(r.remark || '0').replace(/[^0-9.-]+/g, '')) || 0;
        return sum + val;
      }, 0);

      // --- 1. CLEAN MINIMAL BLACK & WHITE HEADER ---
      doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold').text(
        hospitalName.toUpperCase(),
        36,
        36,
        { width: 523, align: 'center' }
      );

      doc.fontSize(10).font('Helvetica').text(
        location,
        36,
        56,
        { width: 523, align: 'center' }
      );

      doc.fontSize(10).font('Helvetica-Bold').text(
        `Over Duty Monthly Report: ${monthLabel} ${year}`,
        36,
        70,
        { width: 523, align: 'center' }
      );

      doc.fontSize(9).font('Helvetica').text(
        `Staff / Doctor: ${staffName}   |   Date: ${new Date().toLocaleDateString('en-GB')}`,
        36,
        84,
        { width: 523, align: 'center' }
      );

      // Top divider line
      doc.moveTo(36, 100).lineTo(559, 100).lineWidth(1).strokeColor('#000000').stroke();

      // --- 2. SUMMARY METRICS TEXT LINE (INLINE B&W) ---
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#000000');
      const summaryText = `Total Records: ${records.length}   |   Unique Patients: ${uniquePatients}   |   Total Remark / Amount: Tk. ${computedTotal.toLocaleString()}`;
      doc.text(summaryText, 36, 106, { width: 523, align: 'center' });

      // Bottom subheader divider line
      doc.moveTo(36, 122).lineTo(559, 122).lineWidth(1).strokeColor('#000000').stroke();

      // --- 3. CLEAN TABLE STRUCTURE ---
      let startTableY = 130;
      doc.y = startTableY;

      const drawTableHeader = (y) => {
        // Table header outline
        doc.rect(36, y, 523, 18).strokeColor('#000000').lineWidth(1).stroke();
        doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold');
        doc.text('SL', 40, y + 5, { width: 25, align: 'center' });
        doc.text('Patient ID', 70, y + 5, { width: 85 });
        doc.text('Patient Name', 160, y + 5, { width: 175 });
        doc.text('Date', 340, y + 5, { width: 65 });
        doc.text('Time', 410, y + 5, { width: 55 });
        doc.text('Remark (Tk)', 470, y + 5, { width: 82, align: 'right' });
      };

      drawTableHeader(startTableY);
      let currentY = startTableY + 18;

      records.forEach((r, idx) => {
        // Auto page-break if near bottom of page
        if (currentY > 770) {
          doc.addPage();
          currentY = 40;
          drawTableHeader(currentY);
          currentY += 18;
        }

        const dateStr = r.date ? new Date(r.date).toISOString().split('T')[0] : '';
        const timeStr = r.time || '';
        const remarkStr = String(r.remark || '100');

        doc.fillColor('#000000').fontSize(8).font('Helvetica');
        doc.text(String(r.sl || idx + 1), 40, currentY + 3.5, { width: 25, align: 'center' });
        doc.font('Helvetica-Bold').text(String(r.patientId || ''), 70, currentY + 3.5, { width: 85 });
        doc.font('Helvetica').text(String(r.patientName || 'PATIENT').substring(0, 32), 160, currentY + 3.5, { width: 175 });
        doc.text(dateStr, 340, currentY + 3.5, { width: 65 });
        doc.text(timeStr, 410, currentY + 3.5, { width: 55 });
        doc.font('Helvetica-Bold').text(remarkStr, 470, currentY + 3.5, { width: 82, align: 'right' });

        // Row bottom thin divider
        doc.moveTo(36, currentY + 15).lineTo(559, currentY + 15).lineWidth(0.5).strokeColor('#cccccc').stroke();
        currentY += 15.5;
      });

      // Total summary footer row
      if (currentY > 760) {
        doc.addPage();
        currentY = 40;
      }
      doc.rect(36, currentY + 2, 523, 18).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold');
      doc.text(`TOTAL ENTRIES: ${records.length}`, 44, currentY + 6, { width: 200 });
      doc.text(`GRAND TOTAL: Tk. ${computedTotal.toLocaleString()}`, 250, currentY + 6, { width: 300, align: 'right' });

      // Page numbers footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.moveTo(36, 804).lineTo(559, 804).lineWidth(0.5).strokeColor('#000000').stroke();
        doc.fillColor('#000000').fontSize(7.5).font('Helvetica');
        doc.text(
          `${hospitalName} • OverDuty Monthly Statement • Staff: ${staffName}`,
          36,
          810,
          { width: 400 }
        );
        doc.text(`Page ${i + 1} of ${pageCount}`, 450, 810, { width: 109, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
