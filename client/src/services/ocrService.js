import { createWorker } from 'tesseract.js';

/**
 * Preprocess image on an offscreen HTML canvas to improve OCR accuracy
 * (Converts to grayscale and enhances contrast)
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
        const maxDim = 1800;
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

        // Grayscale + contrast enhancement
        const contrast = 25; // contrast factor
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const adjusted = factor * (gray - 128) + 128;
          const clamped = Math.max(0, Math.min(255, adjusted));
          data[i] = clamped;
          data[i + 1] = clamped;
          data[i + 2] = clamped;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        // If canvas manipulation fails, fallback to raw source
        resolve(imageSource);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for OCR processing'));
    img.src = imageSource;
  });
};

/**
 * Extract structured hospital fields from raw OCR text
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

  // 1. Patient ID Detection (e.g. ID: 001234, Pt ID: 0250474, Reg: 000567, or standalone numeric tokens)
  const idPatterns = [
    /(?:ID|Patient\s*ID|Pt\s*ID|Reg\s*No|MRN|Sl\s*No|File\s*No)[\s:\.#-]*([A-Za-z0-9_-]{3,15})/i,
    /\b([0-9]{4,10})\b/,
  ];

  for (const line of lines) {
    for (const pattern of idPatterns) {
      const match = line.match(pattern);
      if (match && match[1] && !patientId) {
        patientId = match[1].trim();
        idConfidence = overallConfidence > 75 ? 'High' : 'Medium';
        break;
      }
    }
    if (patientId) break;
  }

  // 2. Patient Name Detection (e.g. Name: John Doe, Pt Name: ..., or capital names)
  const namePatterns = [
    /(?:Name|Patient\s*Name|Pt\s*Name|Patient)[\s:\.#-]*([A-Za-z\s\.\,\'-]{3,35})/i,
    /(?:Mr\.|Mrs\.|Ms\.|Dr\.|Master|Baby)\s+([A-Za-z\s\.\'-]{3,30})/i,
  ];

  for (const line of lines) {
    for (const pattern of namePatterns) {
      const match = line.match(pattern);
      if (match && match[1] && !patientName) {
        // Clean trailing punctuation or unwanted words
        const cleaned = match[1].replace(/(Age|Sex|Gender|Date|Time|Bed|Ward).*$/i, '').trim();
        if (cleaned.length >= 2) {
          patientName = cleaned;
          nameConfidence = overallConfidence > 70 ? 'High' : 'Medium';
          break;
        }
      }
    }
    if (patientName) break;
  }

  // 3. Date Detection (DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY)
  const datePatterns = [
    /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b/,
    /\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/,
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i,
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match && match[1] && !date) {
        const rawDateStr = match[1].replace(/\./g, '/');
        const parsed = new Date(rawDateStr);
        if (!isNaN(parsed.getTime())) {
          // Format as YYYY-MM-DD for standard date input
          const y = parsed.getFullYear();
          const m = String(parsed.getMonth() + 1).padStart(2, '0');
          const d = String(parsed.getDate()).padStart(2, '0');
          date = `${y}-${m}-${d}`;
          dateConfidence = 'High';
          break;
        }
      }
    }
    if (date) break;
  }

  // If no date found, fallback to today's date
  if (!date) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    date = `${y}-${m}-${d}`;
    dateConfidence = 'Medium';
  }

  // 4. Time Detection (HH:MM or HH:MM AM/PM)
  const timePatterns = [
    /\b((?:0?[1-9]|1[0-2]):[0-5][0-9]\s*[AaPp][Mm])\b/,
    /\b((?:[01]?[0-9]|2[0-3]):[0-5][0-9])\b/,
  ];

  for (const line of lines) {
    for (const pattern of timePatterns) {
      const match = line.match(pattern);
      if (match && match[1] && !time) {
        time = match[1].trim();
        timeConfidence = 'High';
        break;
      }
    }
    if (time) break;
  }

  // If no time found, default to current local time in HH:MM
  if (!time) {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    time = `${hrs}:${mins}`;
    timeConfidence = 'Low';
  }

  // 5. Remark Detection (Diagnosis, Over duty reason, Ward, Doctor)
  const remarkPatterns = [
    /(?:Remark|Remarks|Diagnosis|Duty|Over\s*Duty|Note|Notes|Reason|Ward|Dept)[\s:\.#-]*([^\n]+)/i,
  ];

  for (const line of lines) {
    for (const pattern of remarkPatterns) {
      const match = line.match(pattern);
      if (match && match[1] && !remark) {
        remark = match[1].trim();
        break;
      }
    }
    if (remark) break;
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
    onProgress({ status: 'Preprocessing image for clarity...', progress: 0.1 });
    const processedImage = await preprocessImageForOCR(imageInput);

    onProgress({ status: 'Initializing OCR recognition engine...', progress: 0.25 });
    worker = await createWorker('eng');

    onProgress({ status: 'Scanning and reading text...', progress: 0.5 });
    const result = await worker.recognize(processedImage);

    onProgress({ status: 'Parsing detected fields...', progress: 0.95 });
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
