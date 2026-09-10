import { executePythonOCR } from './ocrPythonService.js';

/**
 * Clean & extract 6-digit Patient ID
 */
const sanitizeAndExtractPatientId = (rawId) => {
  if (!rawId) return '';
  let str = String(rawId).replace(/\D/g, '');
  if (str.length >= 10) return str.slice(4, 10);
  if (str.length > 6) return str.slice(4);
  return str;
};

/**
 * Master OCR Processor:
 * 1. Primary: Google Gemini Vision AI (if GEMINI_API_KEY is configured)
 * 2. Secondary: Python Deep Learning & OpenCV Engine (RapidOCR)
 */
export const processDocumentOCR = async (imageBase64) => {
  if (!imageBase64) {
    throw new Error('No image payload provided');
  }

  // 1. Check Gemini Vision AI if API key is provided
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim()) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Strip data URL header if present
      let mimeType = 'image/jpeg';
      let pureBase64 = imageBase64;
      if (imageBase64.includes(';base64,')) {
        const parts = imageBase64.split(';base64,');
        mimeType = parts[0].replace('data:', '') || 'image/jpeg';
        pureBase64 = parts[1];
      }

      const prompt = `You are a medical receipt document scanner for Ad-din Akij Medical College Hospital.
Analyze this hospital bill/receipt image carefully and extract the following fields in strict JSON format:
{
  "rawPatientId": "Extract the Lab ID (e.g. 2608-260459 or 2608260775)",
  "patientId": "Strictly the last 6 digits of the Lab ID excluding the first 4 prefix digits (e.g. 260459)",
  "patientName": "The patient name in uppercase, removing any trailing (P-XXXXX) ID numbers or Age/Sex",
  "date": "Date formatted as YYYY-MM-DD (e.g. 2026-08-23)",
  "time": "Time formatted as HH.MMAM/PM (e.g. 01.32PM or 08.46AM)",
  "remark": "The main investigation test name (e.g. X-Ray-KUB Region or X-Ray-Chest P/A View)"
}
Return ONLY pure JSON without markdown code fences or other text.`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: pureBase64,
            mimeType: mimeType,
          },
        },
      ]);

      const textResponse = result.response.text().trim();
      const cleanedJsonStr = textResponse.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsedJson = JSON.parse(cleanedJsonStr);

      const patientId = sanitizeAndExtractPatientId(parsedJson.patientId || parsedJson.rawPatientId);

      return {
        rawText: textResponse,
        fields: {
          patientId: patientId,
          patientName: (parsedJson.patientName || '').toUpperCase(),
          date: parsedJson.date || new Date().toISOString().split('T')[0],
          time: parsedJson.time || '12.00PM',
          remark: parsedJson.remark || '100',
        },
        confidence: {
          patientId: patientId ? 'High' : 'Medium',
          patientName: parsedJson.patientName ? 'High' : 'Medium',
          date: parsedJson.date ? 'High' : 'Medium',
          time: parsedJson.time ? 'High' : 'Medium',
          overall: 95,
        },
        engine: 'Gemini Vision AI Engine',
      };
    } catch (aiErr) {
      console.warn('[Gemini Vision AI Warning - Falling back to Python Engine]:', aiErr.message);
    }
  }

  // 2. Python Deep Learning & OpenCV Engine
  return await executePythonOCR(imageBase64);
};
