import { createWorker } from 'tesseract.js';
import { formatHospitalTime } from '../utils/dateUtils';
import { recordsApi } from './recordsApi';

/**
 * Month names mapping for date extraction
 */
const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Sanitize and extract Patient/Lab ID:
 * Exclude first 4 digits (e.g. year-month prefix '2608') and keep strictly the following 6 digits
 * Example: '2608-260481' -> '260481'
 * Example: '2608260775' -> '260775'
 * Example: 'P-2608192521' -> '192521'
 */
export const sanitizeAndExtractPatientId = (rawIdStr) => {
  if (!rawIdStr) return '';

  // Clean common OCR letter-digit confusions in ID strings
  let normalized = String(rawIdStr)
    .replace(/[oO]/g, '0')
    .replace(/[iIlL]/g, '1')
    .replace(/[sS](?=\d)/g, '5')
    .replace(/[bB](?=\d)/g, '8')
    .replace(/[zZ](?=\d)/g, '2');

  // 1. Explicit format: 4 digits + hyphen/space + 6 digits (e.g. '2608-260481' or '2608 260775')
  const formattedMatch = normalized.match(/\b\d{4}[-\s\/\._](\d{6})\b/);
  if (formattedMatch && formattedMatch[1]) {
    return formattedMatch[1];
  }

  // 2. Extract only numbers
  const digitsOnly = normalized.replace(/\D/g, '');

  // 3. If 10 digits or more (e.g., 2608260481 or 2608192521):
  // Discard first 4 digits, extract the next 6 digits
  if (digitsOnly.length >= 10) {
    return digitsOnly.slice(4, 10);
  }

  // 4. If length between 7 and 9 (prefix present but short suffix)
  if (digitsOnly.length > 6) {
    return digitsOnly.slice(4);
  }

  // 5. If already 6 digits or fewer, return as-is
  return digitsOnly;
};

/**
 * Preprocess image on an offscreen HTML canvas to maximize OCR accuracy
 * Specially designed for:
 * 1. Dot-matrix printed receipts (pin dots connection filter)
 * 2. Weak/low-light mobile phone cameras (adaptive contrast & noise suppression)
 * 3. Red "Office Copy" watermark suppression
 */
export const preprocessImageForOCR = (imageSource) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Target high-definition scale for clear dot matrix reading
        const maxDim = 2200;
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
        } else if (width < 1200 && height < 1200) {
          // Upscale lower quality images to make dot-matrix pins legible
          const scale = Math.min(2.0, 1400 / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Step 1: Suppress Red Watermark & Convert to Grayscale
        // The red 'Office Copy' watermark has strong red channel compared to green/blue
        const grayData = new Uint8Array(width * height);
        let minGray = 255;
        let maxGray = 0;

        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Check if pixel is part of red watermark / red stamp
          if (r > 90 && (r > g + 25 || r > b + 25)) {
            // Fade red watermark to clean paper white
            grayData[j] = 255;
          } else {
            // Standard luminance
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            grayData[j] = gray;
            if (gray < minGray) minGray = gray;
            if (gray > maxGray) maxGray = gray;
          }
        }

        // Step 2: Auto-Level & High-Contrast Curve (Normalize weak camera exposure)
        const range = Math.max(1, maxGray - minGray);
        const contrastFactor = 1.45; // Enhanced contrast for faint dot-matrix ink

        for (let j = 0; j < grayData.length; j++) {
          let normalized = ((grayData[j] - minGray) / range) * 255;
          // Apply contrast curve
          let val = (normalized - 128) * contrastFactor + 128;
          // Slight threshold boost for crisp ink on paper
          if (val > 185) val = 255;
          else if (val < 90) val = Math.max(0, val * 0.7);

          grayData[j] = Math.max(0, Math.min(255, val));
        }

        // Step 3: 3x3 Sharpening Convolution to connect dot-matrix pin points
        // Kernel: [ 0, -0.5, 0, -0.5, 3.0, -0.5, 0, -0.5, 0 ]
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const top = (y - 1) * width + x;
            const bottom = (y + 1) * width + x;
            const left = y * width + (x - 1);
            const right = y * width + (x + 1);

            const centerVal = grayData[idx];
            const sharpVal =
              3.0 * centerVal -
              0.5 * (grayData[top] + grayData[bottom] + grayData[left] + grayData[right]);

            const finalPixel = Math.max(0, Math.min(255, sharpVal));
            const pIdx = idx * 4;
            data[pIdx] = finalPixel;
            data[pIdx + 1] = finalPixel;
            data[pIdx + 2] = finalPixel;
            data[pIdx + 3] = 255;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch (err) {
        console.warn('Canvas preprocessing fallback:', err);
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

  let rawPatientId = '';
  let patientName = '';
  let date = '';
  let time = '';
  let remark = '';

  let idConfidence = 'Low';
  let nameConfidence = 'Low';
  let dateConfidence = 'Low';
  let timeConfidence = 'Low';

  // 1. Patient ID / Lab ID Detection
  // Matches formats like:
  // 'Lab ID: 2608-260481' -> 260481
  // 'Lab ID: 2608-260775' -> 260775
  // 'Lab ID: 2608-260459' -> 260459
  // 'Lab ID: 2608-260504' -> 260504
  for (const line of lines) {
    // Specific 'Lab ID:' line check
    const labIdMatch = line.match(/(?:Lab\s*ID|LabID|Lab\s*No|ID\s*No)[\s:\.#-]*([A-Za-z0-9_\-\s]{4,20})/i);
    if (labIdMatch && labIdMatch[1]) {
      rawPatientId = labIdMatch[1].trim();
      idConfidence = 'High';
      break;
    }

    // Format '2608-260481' (4 digits - 6 digits)
    const formattedIdMatch = line.match(/\b([0-9]{4}[-\s][0-9]{5,8})\b/);
    if (formattedIdMatch && formattedIdMatch[1]) {
      rawPatientId = formattedIdMatch[1].trim();
      idConfidence = 'High';
      break;
    }

    // Patient ID in brackets e.g. '(P-2608192521)'
    const pIdMatch = line.match(/\b(?:P-|\(P-)([0-9]{6,12})\b/i);
    if (pIdMatch && pIdMatch[1]) {
      rawPatientId = pIdMatch[1].trim();
      idConfidence = 'High';
      break;
    }
  }

  // Fallback generic ID patterns if not matched yet
  if (!rawPatientId) {
    const genericIdPatterns = [
      /(?:Patient\s*ID|Pt\s*ID|Reg\s*No|MRN|Sl\s*No|File\s*No)[\s:\.#-]*([A-Za-z0-9_-]{3,15})/i,
      /\b([0-9]{10})\b/,
      /\b([0-9]{6})\b/,
    ];
    for (const line of lines) {
      for (const pattern of genericIdPatterns) {
        const match = line.match(pattern);
        if (match && match[1] && !rawPatientId) {
          rawPatientId = match[1].trim();
          idConfidence = overallConfidence > 75 ? 'High' : 'Medium';
          break;
        }
      }
      if (rawPatientId) break;
    }
  }

  // Extract strictly the 6-digit ID (excluding the first 4 prefix digits)
  const patientId = sanitizeAndExtractPatientId(rawPatientId);

  // 2. Patient Name Detection
  // Matches:
  // 'Name: BENODINI/THAKUR PODO(P-2608192521)' -> 'BENODINI/THAKUR PODO'
  // 'Name: PROHOLLAD KRMOKAR / SHONKAR KRMOKAR(P-2608192659)' -> 'PROHOLLAD KRMOKAR / SHONKAR KRMOKAR'
  // 'Name: REBA BEGUM / MD AKKAS ALI(P-2608190110)' -> 'REBA BEGUM / MD AKKAS ALI'
  // 'Name: SHAHANARA/ABDUL KHALEK MOROL(P-2512110627)' -> 'SHAHANARA/ABDUL KHALEK MOROL'
  for (const line of lines) {
    const nameMatch = line.match(/(?:Name|Patient\s*Name|Pt\s*Name|Patient)[\s:\.#-]*([A-Za-z0-9\s\/\.\,\'-]+?)(?=\s*\(|\s*P-|\s*Sex|\s*Age|\s*Ward|\s*Date|$)/i);
    if (nameMatch && nameMatch[1]) {
      let cleaned = nameMatch[1]
        .replace(/(Age|Sex|Gender|Date|Time|Bed|Ward|Female|Male).*$/i, '')
        .replace(/[0-9]+/g, '')
        .trim();

      // Clean multiple trailing/leading punctuation
      cleaned = cleaned.replace(/^[\/\-\.\s]+|[\/\-\.\s]+$/g, '');

      if (cleaned.length >= 2) {
        patientName = cleaned.toUpperCase();
        nameConfidence = 'High';
        break;
      }
    }
  }

  // Fallback title-based names (e.g. Mr. / Mrs. / Baby / MD. )
  if (!patientName) {
    for (const line of lines) {
      const titleMatch = line.match(/(?:Mr\.|Mrs\.|Ms\.|Dr\.|Master|Baby|MD\.)\s+([A-Za-z\s\/\.\'-]{3,40})/i);
      if (titleMatch && titleMatch[1]) {
        patientName = titleMatch[1].trim().toUpperCase();
        nameConfidence = 'Medium';
        break;
      }
    }
  }

  // 3. Date & Time Detection
  // Matches: '23-AUG-26 14:00', '24-AUG-26 08:46:53', '23 AUG 26 13:32', '23-AUG-26 14:28'
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

    // Check time in the same line or any line (e.g. 14:00, 08:46:53, 13:32, 14:28:00)
    const timeMatch = line.match(/\b((?:[01]?[0-9]|2[0-3])[:.][0-5][0-9](?:[:.][0-5][0-9])?(?:\s*[AaPp][Mm])?)\b/);
    if (timeMatch && !time) {
      const rawTime = timeMatch[1].trim();
      time = formatHospitalTime(rawTime);
      timeConfidence = 'High';
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
    let hrs = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, '0');
    const period = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12 || 12;
    time = `${String(hrs).padStart(2, '0')}.${mins}${period}`;
    timeConfidence = 'Low';
  }

  // 4. Remark / Investigation Test Detection
  // Matches:
  // '1 X-Ray-Chest P/A View 550'
  // '1 X-Ray-KUB Region 550'
  // '2 X-Ray-Dorsal Spine Both View (100%) 660'
  for (const line of lines) {
    if (/(?:X-Ray|USG|Ultrasonogram|ECG|CT|MRI|Chest|Spine|Lumber|Dorsal|KUB|Portable|View|Blood|Urine|Echo)/i.test(line)) {
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

  // Default standard hospital rating if no specific test note
  if (!remark) {
    remark = '100';
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
 * Execute OCR Recognition:
 * 1. Primary: Server-side Python Deep Learning + OpenCV Engine (Maximum Accuracy)
 * 2. Fallback: Client-side WebAssembly Tesseract.js (Offline Backup)
 */
export const runOCR = async (imageInput, onProgress = () => {}) => {
  // Try Primary Engine: Python Deep Learning + OpenCV Backend
  try {
    onProgress({
      status: 'পাইথন কম্পিউটার ভিশন ও ডিপ লার্নিং (OpenCV + ML) ইঞ্জিনে প্রসেস হচ্ছে...',
      progress: 0.35,
      engine: 'Python ML Engine',
    });

    const response = await recordsApi.scanOCR(imageInput);
    if (response && response.success && response.data) {
      onProgress({
        status: 'ল্যাব আইডি (৬ সংখ্যা), নাম ও তারিখ এক্সট্রাক্ট সম্পন্ন হয়েছে!',
        progress: 1.0,
        engine: 'Python ML Engine',
      });
      return response.data;
    }
  } catch (backendError) {
    console.warn('[Python OCR Backend Error / Offline fallback triggered]:', backendError);
  }

  // Fallback Engine: Client-Side Tesseract.js Worker
  let worker = null;
  try {
    onProgress({
      status: 'লোকাল ক্লায়েন্ট ইঞ্জিনে ছবি পরিষ্কার ও অপটিমাইজ করা হচ্ছে...',
      progress: 0.2,
      engine: 'Client Local Engine',
    });
    const processedImage = await preprocessImageForOCR(imageInput);

    onProgress({
      status: 'লোকাল OCR ইঞ্জিন চালু হচ্ছে...',
      progress: 0.45,
      engine: 'Client Local Engine',
    });
    worker = await createWorker('eng');

    // Configure Tesseract parameters for medical receipt dot-matrix parsing
    await worker.setParameters({
      tessedit_pageseg_mode: '3',
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/.:-() %,#\'+',
    });

    onProgress({
      status: 'রশিদ স্ক্যান ও তথ্য বিশ্লেষণ করা হচ্ছে...',
      progress: 0.75,
      engine: 'Client Local Engine',
    });
    const result = await worker.recognize(processedImage);

    onProgress({
      status: 'ল্যাব আইডি (৬ সংখ্যা), নাম ও তারিখ এক্সট্রাক্ট করা হচ্ছে...',
      progress: 0.95,
      engine: 'Client Local Engine',
    });
    const parsed = parseExtractedText(result.data.text, result.data.confidence);

    onProgress({
      status: 'সম্পন্ন হয়েছে!',
      progress: 1.0,
      engine: 'Client Local Engine',
    });
    return parsed;
  } catch (error) {
    console.error('OCR Fallback Error:', error);
    throw new Error(`OCR processing failed: ${error.message || 'Unable to recognize text'}`);
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
};
