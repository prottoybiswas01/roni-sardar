import PDFDocument from 'pdfkit';

/**
 * Generates a clean, professional A4 PDF report for a user's monthly records.
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

      // --- 1. HEADER SECTION ---
      doc.rect(36, 36, 523, 60).fill('#0284c7');

      doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold').text(
        hospitalName.toUpperCase(),
        46,
        48,
        { width: 503, align: 'center' }
      );

      doc.fontSize(9).font('Helvetica').text(
        `${location} • OFFICIAL MONTHLY OVER DUTY CLOSING STATEMENT`,
        46,
        68,
        { width: 503, align: 'center' }
      );

      doc.fontSize(8).fillColor('#e0f2fe').text(
        `Period: ${monthLabel} ${year} | Staff: ${staffName} | Generated: ${new Date().toLocaleDateString('en-GB')}`,
        46,
        82,
        { width: 503, align: 'center' }
      );

      doc.y = 108;

      // --- 2. SUMMARY KPI STATS CARDS ---
      const cardY = 106;
      const cardWidth = 120;
      const cardHeight = 44;
      const cardGap = 14;

      const stats = [
        { label: 'TOTAL ENTRIES', val: `${records.length}`, color: '#0f172a', bg: '#f1f5f9' },
        { label: 'UNIQUE PATIENTS', val: `${uniquePatients}`, color: '#0284c7', bg: '#e0f2fe' },
        { label: 'TOTAL REMARK / EARNED', val: `Tk. ${computedTotal.toLocaleString()}`, color: '#16a34a', bg: '#dcfce7' },
        { label: 'AVG / ENTRY', val: `Tk. ${records.length ? Math.round(computedTotal / records.length) : 0}`, color: '#7c3aed', bg: '#f3e8ff' },
      ];

      stats.forEach((st, idx) => {
        const x = 36 + idx * (cardWidth + cardGap);
        doc.rect(x, cardY, cardWidth, cardHeight).fill(st.bg);
        doc.rect(x, cardY, cardWidth, cardHeight).strokeColor('#cbd5e1').lineWidth(0.5).stroke();

        doc.fillColor('#64748b').fontSize(7).font('Helvetica-Bold').text(st.label, x + 6, cardY + 8, { width: cardWidth - 12 });
        doc.fillColor(st.color).fontSize(11).font('Helvetica-Bold').text(st.val, x + 6, cardY + 22, { width: cardWidth - 12 });
      });

      // --- 3. PATIENT RECORDS TABLE ---
      let startTableY = 160;
      doc.y = startTableY;

      const drawTableHeader = (y) => {
        doc.rect(36, y, 523, 18).fill('#334155');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('SL', 42, y + 5, { width: 25, align: 'center' });
        doc.text('PATIENT ID', 72, y + 5, { width: 80 });
        doc.text('PATIENT NAME', 158, y + 5, { width: 170 });
        doc.text('DATE', 332, y + 5, { width: 65 });
        doc.text('TIME', 402, y + 5, { width: 55 });
        doc.text('REMARK (TK)', 462, y + 5, { width: 90, align: 'right' });
      };

      drawTableHeader(startTableY);
      let currentY = startTableY + 18;

      records.forEach((r, idx) => {
        // Auto-break page if close to bottom
        if (currentY > 760) {
          doc.addPage();
          currentY = 40;
          drawTableHeader(currentY);
          currentY += 18;
        }

        const isEven = idx % 2 === 0;
        if (isEven) {
          doc.rect(36, currentY, 523, 15).fill('#f8fafc');
        }

        const dateStr = r.date ? new Date(r.date).toISOString().split('T')[0] : '';
        const timeStr = r.time || '';
        const remarkStr = String(r.remark || '100');

        doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
        doc.text(String(r.sl || idx + 1), 42, currentY + 3.5, { width: 25, align: 'center' });
        doc.font('Helvetica-Bold').text(String(r.patientId || ''), 72, currentY + 3.5, { width: 80 });
        doc.font('Helvetica').text(String(r.patientName || 'PATIENT').substring(0, 32), 158, currentY + 3.5, { width: 170 });
        doc.text(dateStr, 332, currentY + 3.5, { width: 65 });
        doc.text(timeStr, 402, currentY + 3.5, { width: 55 });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(remarkStr, 462, currentY + 3.5, { width: 90, align: 'right' });

        // Bottom light divider
        doc.rect(36, currentY + 15, 523, 0.5).fill('#e2e8f0');
        currentY += 15.5;
      });

      // Total summary row at end
      if (currentY > 750) {
        doc.addPage();
        currentY = 40;
      }
      doc.rect(36, currentY + 4, 523, 20).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      doc.text(`TOTAL SUMMARY: ${records.length} PATIENTS`, 46, currentY + 9, { width: 250 });
      doc.text(`GRAND TOTAL: Tk. ${computedTotal.toLocaleString()}`, 300, currentY + 9, { width: 250, align: 'right' });

      // Add Footer & Page Numbers to all pages
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.rect(36, 800, 523, 0.5).fill('#cbd5e1');
        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica');
        doc.text(
          `OverDuty Hospital Record System © ${year} | Authorized Report for ${staffName} | Generated: ${new Date().toLocaleString()}`,
          36,
          806,
          { width: 380 }
        );
        doc.text(`Page ${i + 1} of ${pageCount}`, 430, 806, { width: 129, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
