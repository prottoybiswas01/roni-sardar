import { createWorker } from 'tesseract.js';

/**
 * Month names mapping for date extraction
 */
const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Preprocess image on an offscreen HTML canvas to improve OCR accuracy
 * Tailored for hospital dot-matrix slips, low-light camera photos, and watermark filtering
 */
export const preprocessImageForOCR = (imageSource) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Scale down if image is huge to prevent UI freeze
        const maxDim = 2000;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Grayscale + contrast enhancement + red watermark suppression
        const contrast = 35; // contrast factor
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // If pixel has heavy red tint (like red 'Office Copy' watermark), brighten it to blend with background
          let gray;
          if (r > g + 40 && r > b + 40) {
            gray = 240; // fade out red watermark
          } else {
            gray = 0.299 * r + 0.587 * g + 0.114 * b;
          }

          // Apply contrast curve
          const adjusted = factor * (gray - 128) + 128;
          const clamped = Math.max(0, Math.min(255, adjusted));
          
          data[i] = clamped;
          data[i + 1] = clamped;
          data[i + 2] = clamped;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch (err) {
        // Fallback to raw source if canvas processing fails
        resolve(imageSource);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for OCR processing'));
    img.src = imageSource;
  });
};

/**
 * Format 2-digit or 4-digit year into YYYY
 */
const normalizeYear = (yr) => {
  const num = parseInt(yr, 10);
  if (yr.length === 2 || num < 100) {
    return num > 70 ? `19${String(num).padStart(2, '0')}` : `20${String(num).padStart(2, '0')}`;
  }
  return String(num);
};

/**
 * Extract structured hospital fields from raw OCR text
 * Specially optimized for Hospital Over Duty / Lab Receipts (e.g. Lab ID, Name, Date, Investigation)
 */
export const parseExtractedText = (rawText, overallConfidence = 70) => {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let patientId = '';
  let patientName = '';
  let date = '';
  let time = '';
  let remark = '';

  let idConfidence = 'Low';
  let nameConfidence = 'Low';
  let dateConfidence = 'Low';
  let timeConfidence = 'Low';

  // 1. Patient ID / Lab ID Detection
  // Matches formats like: 'Lab ID: 2609-267048', 'Lab ID 2609-267056', '(P-2609197183)', 'ID: 001234'
  for (const line of lines) {
    // Check specific 'Lab ID:' first
    const labIdMatch = line.match(/(?:Lab\s*ID|LabID|Lab\s*No)[\s:\.#-]*([A-Za-z0-9_-]{4,20})/i);
    if (labIdMatch && labIdMatch[1]) {
      patientId = labIdMatch[1].trim();
      idConfidence = 'High';
      break;
    }

    // Check format '2609-267048' (4 digits - 6 digits)
    const formattedIdMatch = line.match(/\b([0-9]{4}-[0-9]{5,8})\b/);
    if (formattedIdMatch && formattedIdMatch[1]) {
      patientId = formattedIdMatch[1].trim();
      idConfidence = 'High';
      break;
    }

    // Check format 'P-2609197183'
    const pIdMatch = line.match(/\b(P-[0-9]{6,12})\b/i);
    if (pIdMatch && pIdMatch[1]) {
      patientId = pIdMatch[1].trim();
      idConfidence = 'High';
      break;
    }
  }

  // Fallback generic ID patterns
  if (!patientId) {
    const genericIdPatterns = [
      /(?:ID|Patient\s*ID|Pt\s*ID|Reg\s*No|MRN|Sl\s*No|File\s*No)[\s:\.#-]*([A-Za-z0-9_-]{3,15})/i,
      /\b([0-9]{4,10})\b/,
    ];
    for (const line of lines) {
      for (const pattern of genericIdPatterns) {
        const match = line.match(pattern);
        if (match && match[1] && !patientId) {
          patientId = match[1].trim();
          idConfidence = overallConfidence > 75 ? 'High' : 'Medium';
          break;
        }
      }
      if (patientId) break;
    }
  }

  // 2. Patient Name Detection
  // Matches: 'Name: SUMA KHATUN(P-2609197183)01000000000', 'Name: TUBA / GOLAM MUSTOFA', etc.
  for (const line of lines) {
    const nameMatch = line.match(/(?:Name|Patient\s*Name|Pt\s*Name|Patient)[\s:\.#-]*([A-Za-z\s\/\.\,\'-]+?)(?=\s*\(|\s*\d{6,}|\s*Sex|\s*Age|\s*Ward|$)/i);
    if (nameMatch && nameMatch[1]) {
      let cleaned = nameMatch[1]
        .replace(/(Age|Sex|Gender|Date|Time|Bed|Ward|Female|Male).*$/i, '')
        .replace(/[0-9]+/g, '')
        .trim();
      
      if (cleaned.length >= 2) {
        patientName = cleaned;
        nameConfidence = 'High';
        break;
      }
    }
  }

  // Fallback title-based names (e.g. Mr. / Mrs. / Baby)
  if (!patientName) {
    for (const line of lines) {
      const titleMatch = line.match(/(?:Mr\.|Mrs\.|Ms\.|Dr\.|Master|Baby)\s+([A-Za-z\s\.\'-]{3,30})/i);
      if (titleMatch && titleMatch[1]) {
        patientName = titleMatch[1].trim();
        nameConfidence = 'Medium';
        break;
      }
    }
  }

  // 3. Date & Time Detection
  // Matches: '04-SEP-26 12:27:15', '04 SEP 26 12:40:36', '03 SEP 26 22:36:45', '04/09/2026', '2026-09-04'
  const alphaDateRegex = /\b(\d{1,2})[\s\-\/\.]([A-Za-z]{3})[a-z]*[\s\-\/\.](\d{2,4})\b/i;
  
  for (const line of lines) {
    const match = line.match(alphaDateRegex);
    if (match && !date) {
      const day = String(parseInt(match[1], 10)).padStart(2, '0');
      const monthStr = match[2].toLowerCase();
      const month = MONTH_MAP[monthStr];
      const year = normalizeYear(match[3]);

      if (month && year) {
        date = `${year}-${month}-${day}`;
        dateConfidence = 'High';
      }
    }

    // Check time in the same line or any line
    const timeMatch = line.match(/\b((?:[01]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?(?:\s*[AaPp][Mm])?)\b/);
    if (timeMatch && !time) {
      // Clean up to HH:MM format
      let rawTime = timeMatch[1].trim();
      const parts = rawTime.split(':');
      if (parts.length >= 2) {
        const hh = String(parseInt(parts[0], 10)).padStart(2, '0');
        const mm = parts[1].slice(0, 2);
        const ampm = rawTime.match(/[AaPp][Mm]/) ? ` ${rawTime.match(/[AaPp][Mm]/)[0].toUpperCase()}` : '';
        time = `${hh}:${mm}${ampm}`;
        timeConfidence = 'High';
      }
    }
  }

  // Generic Date Fallback (DD/MM/YYYY or YYYY-MM-DD)
  if (!date) {
    const numDatePatterns = [
      /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/,
      /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/,
    ];
    for (const line of lines) {
      for (const pattern of numDatePatterns) {
        const match = line.match(pattern);
        if (match && !date) {
          if (match[1].length === 4) {
            // YYYY-MM-DD
            const y = match[1];
            const m = String(parseInt(match[2], 10)).padStart(2, '0');
            const d = String(parseInt(match[3], 10)).padStart(2, '0');
            date = `${y}-${m}-${d}`;
          } else {
            // DD-MM-YYYY or DD-MM-YY
            const d = String(parseInt(match[1], 10)).padStart(2, '0');
            const m = String(parseInt(match[2], 10)).padStart(2, '0');
            const y = normalizeYear(match[3]);
            date = `${y}-${m}-${d}`;
          }
          dateConfidence = 'Medium';
          break;
        }
      }
      if (date) break;
    }
  }

  // Fallback today's date if completely missing
  if (!date) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    date = `${y}-${m}-${d}`;
    dateConfidence = 'Medium';
  }

  // Fallback current time if completely missing
  if (!time) {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    time = `${hrs}:${mins}`;
    timeConfidence = 'Low';
  }

  // 4. Remark / Investigation Test Detection
  // Matches: '1 X-Ray-Lumber Spine Both View (100%) 660', '1 X-Ray-Chest A/P View 550', '1 X-Ray-Chest Portable 700'
  for (const line of lines) {
    // Check for clinical investigations
    if (/(?:X-Ray|USG|Ultrasonogram|ECG|CT|MRI|Chest|Spine|Lumber|Portable|View|Blood|Urine|Echo)/i.test(line)) {
      // Remove leading serial numbers (e.g. '1 ') and trailing price (e.g. ' 660', ' 550', ' 700')
      let cleanedRemark = line
        .replace(/^\s*\d+[\s\.\-]+/, '')
        .replace(/\s+\d{2,5}\s*$/, '')
        .replace(/(?:Authorized\s*Signature|Office\s*Copy).*$/i, '')
        .trim();

      if (cleanedRemark.length >= 3 && !remark) {
        remark = cleanedRemark;
        break;
      }
    }
  }

  // Generic remark pattern fallback
  if (!remark) {
    for (const line of lines) {
      const remarkMatch = line.match(/(?:Remark|Remarks|Diagnosis|Duty|Over\s*Duty|Note|Notes|Reason|Ward|Dept)[\s:\.#-]*([^\n]+)/i);
      if (remarkMatch && remarkMatch[1]) {
        remark = remarkMatch[1].trim();
        break;
      }
    }
  }

  return {
    rawText,
    fields: {
      patientId,
      patientName,
      date,
      time,
      remark,
    },
    confidence: {
      patientId: idConfidence,
      patientName: nameConfidence,
      date: dateConfidence,
      time: timeConfidence,
      overall: Math.round(overallConfidence),
    },
  };
};

/**
 * Execute OCR Recognition using Tesseract.js worker
 */
export const runOCR = async (imageInput, onProgress = () => {}) => {
  let worker = null;
  try {
    onProgress({ status: 'Preprocessing receipt image for clarity...', progress: 0.1 });
    const processedImage = await preprocessImageForOCR(imageInput);

    onProgress({ status: 'Initializing OCR recognition engine...', progress: 0.25 });
    worker = await createWorker('eng');

    onProgress({ status: 'Scanning hospital slip & text...', progress: 0.5 });
    const result = await worker.recognize(processedImage);

    onProgress({ status: 'Extracting Lab ID, Patient Name, Date & Test...', progress: 0.95 });
    const parsed = parseExtractedText(result.data.text, result.data.confidence);

    onProgress({ status: 'Complete', progress: 1.0 });
    return parsed;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error(`OCR processing failed: ${error.message || 'Unable to recognize text'}`);
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
};
