import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pythonScriptPath = path.resolve(__dirname, '../python/ocr_engine.py');

/**
 * Execute Python OpenCV + Deep Learning OCR Engine on an image payload
 * @param {string} imageBase64 - Base64 Data URL or Raw Base64 string
 * @returns {Promise<Object>} Structured OCR Result
 */
export const executePythonOCR = (imageBase64) => {
  return new Promise((resolve, reject) => {
    if (!imageBase64) {
      return reject(new Error('No image payload provided'));
    }

    const pythonExecutable = process.env.PYTHON_PATH || 'python';
    const pyProcess = spawn(pythonExecutable, [pythonScriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdoutData = '';
    let stderrData = '';

    pyProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString('utf-8');
    });

    pyProcess.stderr.on('data', (chunk) => {
      stderrData += chunk.toString('utf-8');
    });

    pyProcess.on('error', (err) => {
      console.error('[Python OCR Process Error]:', err);
      reject(new Error(`Failed to start Python OCR process: ${err.message}`));
    });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('[Python OCR Stderr]:', stderrData);
        return reject(new Error(`Python OCR process exited with code ${code}: ${stderrData || 'Unknown error'}`));
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        if (parsed.error) {
          return reject(new Error(parsed.error));
        }
        resolve(parsed);
      } catch (parseErr) {
        console.error('[Python OCR JSON Parse Error]:', parseErr, 'Raw output:', stdoutData);
        reject(new Error(`Failed to parse OCR response: ${parseErr.message}`));
      }
    });

    // Send input image JSON to Python process stdin
    try {
      const payload = JSON.stringify({ image: imageBase64 });
      pyProcess.stdin.write(payload);
      pyProcess.stdin.end();
    } catch (writeErr) {
      reject(writeErr);
    }
  });
};
