#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
🔒 OVERDUTY PRO — PYTHON MACHINE LEARNING & COMPUTER VISION OCR ENGINE
==============================================================================
PROPRIETARY INTELLECTUAL PROPERTY OF PROTTOY KUMAR BISWAS
DEVELOPER & OWNER: Prottoy Kumar Biswas (prottoybiswas575358@gmail.com)
COPYRIGHT (C) 2026 PROTTOY KUMAR BISWAS. ALL RIGHTS RESERVED.
==============================================================================
High-Accuracy Deep Learning OCR Pipeline:
1. OpenCV Computer Vision Preprocessing (Watermark suppression, dot-matrix enhancement, contrast boosting)
2. RapidOCR (ONNX Deep Neural Network Text Detection & Recognition)
3. Medical Record Semantic Data Extractor (Lab ID, Patient Name, Date, Time, Test/Remark)
"""

import sys
import os
import io
import re
import json
import base64
from datetime import datetime
import numpy as np
import cv2
from PIL import Image

# Initialize RapidOCR engine lazily
_ocr_engine = None

def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _ocr_engine = RapidOCR()
        except Exception as e:
            sys.stderr.write(f"[OCR Engine Init Warning] RapidOCR: {e}\n")
            _ocr_engine = None
    return _ocr_engine

MONTH_MAP = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
}

def decode_image(image_input):
    """Decode image from base64 data URI, file path, or raw bytes."""
    if isinstance(image_input, str):
        if image_input.startswith('data:image'):
            # Base64 data URL
            header, base64_data = image_input.split(',', 1)
            image_bytes = base64.b64decode(base64_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        elif os.path.isfile(image_input):
            # File path
            img = cv2.imread(image_input, cv2.IMREAD_COLOR)
            return img
        else:
            # Raw base64 string
            image_bytes = base64.b64decode(image_input)
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
    elif isinstance(image_input, bytes):
        nparr = np.frombuffer(image_input, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    return None

def preprocess_image_for_ocr(img):
    """
    Advanced OpenCV Computer Vision Preprocessing:
    1. Red watermark & red stamp suppression ('Office Copy' filter)
    2. Adaptive contrast enhancement (CLAHE)
    3. Dot-matrix printer pin connection using unsharp masking
    4. Auto-scale optimization
    """
    if img is None:
        return None

    h, w = img.shape[:2]

    # Target high-definition resolution for clear dot-matrix reading
    max_dim = 2200
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    elif max(h, w) < 1200:
        scale = min(2.0, 1400.0 / float(max(h, w)))
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    h, w = img.shape[:2]

    # Step 1: Red Watermark / Red Stamp Suppression
    # Medical receipts often have a large red 'Office Copy' watermark
    b, g, r = cv2.split(img)
    # Identify pixels where red is significantly higher than green and blue
    red_mask = (r > 90) & (r > g.astype(np.int16) + 20) & (r > b.astype(np.int16) + 20)

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Whitewash the red watermark
    gray[red_mask] = 255

    # Step 2: Contrast Limited Adaptive Histogram Equalization (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Step 3: Dot-Matrix Pin Connection Filter
    # Dilate dark needle-points slightly to bridge gaps between ribbon dots
    _, thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    dilated = cv2.dilate(thresh, kernel, iterations=1)
    cleaned = cv2.bitwise_not(dilated)

    # Convert back to 3-channel for RapidOCR
    processed_bgr = cv2.cvtColor(cleaned, cv2.COLOR_GRAY2BGR)
    return processed_bgr

def normalize_year(yr_str):
    """Normalize 2-digit or 4-digit year into YYYY."""
    try:
        val = int(yr_str)
        if len(yr_str) == 2 or val < 100:
            return f"19{val:02d}" if val > 70 else f"20{val:02d}"
        return str(val)
    except:
        return str(datetime.now().year)

def sanitize_and_extract_patient_id(raw_id_str):
    """
    Sanitize and extract Patient/Lab ID:
    Exclude first 4 digits (e.g. year-month prefix '2608') and keep strictly the following 6 digits
    Example: '2608-260481' -> '260481'
    Example: '2608260775' -> '260775'
    Example: 'P-2608192521' -> '192521'
    """
    if not raw_id_str:
        return ''

    normalized = str(raw_id_str)
    # Common OCR character confusions
    normalized = normalized.replace('O', '0').replace('o', '0')
    normalized = normalized.replace('I', '1').replace('l', '1').replace('L', '1')
    normalized = normalized.replace('S', '5').replace('s', '5')
    normalized = normalized.replace('B', '8').replace('b', '8')
    normalized = normalized.replace('Z', '2').replace('z', '2')

    # 1. Format: 4 digits + hyphen/space + 6 digits (e.g. '2608-260481')
    m = re.search(r'\b\d{4}[-\s/\._](\d{6})\b', normalized)
    if m:
        return m.group(1)

    # 2. Extract digits only
    digits_only = re.sub(r'\D', '', normalized)

    # 3. 10 digits or more -> discard first 4 prefix digits, keep next 6
    if len(digits_only) >= 10:
        return digits_only[4:10]

    # 4. Between 7 and 9 digits -> discard first 4 prefix digits
    if len(digits_only) > 6:
        return digits_only[4:]

    # 5. 6 digits or fewer -> keep as is
    return digits_only

def format_hospital_time(time_str):
    """Format time string to HH.MM AM/PM standard format (e.g. 02.00PM)."""
    if not time_str:
        return ''

    # Clean string
    cleaned = time_str.strip().upper()

    # Match standard 24h or 12h time
    m = re.search(r'(\d{1,2})[:\.](\d{2})(?:[:\.]\d{2})?\s*([AP]M)?', cleaned)
    if not m:
        return cleaned

    hrs = int(m.group(1))
    mins = m.group(2)
    meridiem = m.group(3)

    if not meridiem:
        if hrs >= 12:
            meridiem = 'PM'
            if hrs > 12:
                hrs -= 12
        else:
            meridiem = 'AM'
            if hrs == 0:
                hrs = 12
    else:
        if hrs == 0:
            hrs = 12
        elif hrs > 12:
            hrs -= 12

    return f"{hrs:02d}.{mins}{meridiem}"

def parse_extracted_text(raw_text, overall_confidence=85):
    """Extract structured hospital fields from raw OCR text."""
    lines = [line.strip() for line in raw_text.split('\n') if line.strip()]

    raw_patient_id = ''
    patient_name = ''
    date = ''
    time = ''
    remark = ''

    id_confidence = 'Low'
    name_confidence = 'Low'
    date_confidence = 'Low'
    time_confidence = 'Low'

    # 1. Patient ID / Lab ID Detection
    for line in lines:
        # Match 'Lab ID: 2608-260481'
        lab_match = re.search(r'(?:Lab\s*ID|LabID|Lab\s*No|ID\s*No)[\s:\.#-]*([A-Za-z0-9_\-\s]{4,20})', line, re.IGNORECASE)
        if lab_match:
            raw_patient_id = lab_match.group(1).strip()
            id_confidence = 'High'
            break

        # Match '2608-260481'
        fmt_match = re.search(r'\b([0-9]{4}[-\s][0-9]{5,8})\b', line)
        if fmt_match:
            raw_patient_id = fmt_match.group(1).strip()
            id_confidence = 'High'
            break

        # Match '(P-2608192521)'
        p_match = re.search(r'\b(?:P-|\(P-)([0-9]{6,12})\b', line, re.IGNORECASE)
        if p_match:
            raw_patient_id = p_match.group(1).strip()
            id_confidence = 'High'
            break

    if not raw_patient_id:
        # Generic patterns
        for line in lines:
            generic_match = re.search(r'(?:Patient\s*ID|Pt\s*ID|Reg\s*No|MRN|Sl\s*No|File\s*No)[\s:\.#-]*([A-Za-z0-9_-]{3,15})', line, re.IGNORECASE)
            if generic_match:
                raw_patient_id = generic_match.group(1).strip()
                id_confidence = 'High' if overall_confidence > 75 else 'Medium'
                break
            
            ten_digit = re.search(r'\b([0-9]{10})\b', line)
            if ten_digit:
                raw_patient_id = ten_digit.group(1).strip()
                id_confidence = 'Medium'
                break

            six_digit = re.search(r'\b([0-9]{6})\b', line)
            if six_digit:
                raw_patient_id = six_digit.group(1).strip()
                id_confidence = 'Medium'
                break

    patient_id = sanitize_and_extract_patient_id(raw_patient_id)

    # 2. Patient Name Detection
    for line in lines:
        name_match = re.search(r'(?:Name|Patient\s*Name|Pt\s*Name|Patient)[\s:\.#-]*([A-Za-z0-9\s/\.\,\'-]+?)(?=\s*\(|\s*P-|\s*Sex|\s*Age|\s*Ward|\s*Date|$)', line, re.IGNORECASE)
        if name_match:
            cleaned = name_match.group(1)
            cleaned = re.sub(r'(Age|Sex|Gender|Date|Time|Bed|Ward|Female|Male).*$', '', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'[0-9]+', '', cleaned).strip()
            cleaned = re.sub(r'^[\/\-\.\s]+|[\/\-\.\s]+$', '', cleaned)
            if len(cleaned) >= 2:
                patient_name = cleaned.upper()
                name_confidence = 'High'
                break

    if not patient_name:
        for line in lines:
            title_match = re.search(r'(?:Mr\.|Mrs\.|Ms\.|Dr\.|Master|Baby|MD\.)\s+([A-Za-z\s/\.\'-]{3,40})', line, re.IGNORECASE)
            if title_match:
                patient_name = title_match.group(1).strip().upper()
                name_confidence = 'Medium'
                break

    # 3. Date & Time Detection
    # Alpha date: 23-AUG-26, 24-AUG-2026, 23 AUG 26
    alpha_date_regex = re.compile(r'\b(\d{1,2})[\s\-\/\.]([A-Za-z]{3})[a-z]*[\s\-\/\.](\d{2,4})\b', re.IGNORECASE)
    for line in lines:
        m = alpha_date_regex.search(line)
        if m and not date:
            day = f"{int(m.group(1)):02d}"
            month_key = m.group(2).lower()
            month = MONTH_MAP.get(month_key, '')
            year = normalize_year(m.group(3))
            if month and year:
                date = f"{year}-{month}-{day}"
                date_confidence = 'High'

        # Time pattern
        time_m = re.search(r'\b((?:[01]?[0-9]|2[0-3])[:.][0-5][0-9](?:[:.][0-5][0-9])?(?:\s*[AaPp][Mm])?)\b', line)
        if time_m and not time:
            raw_time = time_m.group(1).strip()
            time = format_hospital_time(raw_time)
            time_confidence = 'High'

    # Numeric date fallback (DD/MM/YYYY or YYYY-MM-DD)
    if not date:
        for line in lines:
            m_iso = re.search(r'\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b', line)
            if m_iso:
                y = m_iso.group(1)
                m = f"{int(m_iso.group(2)):02d}"
                d = f"{int(m_iso.group(3)):02d}"
                date = f"{y}-{m}-{d}"
                date_confidence = 'Medium'
                break

            m_dmy = re.search(r'\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b', line)
            if m_dmy:
                d = f"{int(m_dmy.group(1)):02d}"
                m = f"{int(m_dmy.group(2)):02d}"
                y = normalize_year(m_dmy.group(3))
                date = f"{y}-{m}-{d}"
                date_confidence = 'Medium'
                break

    if not date:
        now = datetime.now()
        date = now.strftime('%Y-%m-%d')
        date_confidence = 'Medium'

    if not time:
        now = datetime.now()
        hrs = now.hour
        mins = f"{now.minute:02d}"
        period = 'PM' if hrs >= 12 else 'AM'
        hrs_12 = hrs % 12 or 12
        time = f"{hrs_12:02d}.{mins}{period}"
        time_confidence = 'Low'

    # 4. Remark / Investigation Test Detection
    for line in lines:
        if re.search(r'(?:X-Ray|USG|Ultrasonogram|ECG|CT|MRI|Chest|Spine|Lumber|Dorsal|KUB|Portable|View|Blood|Urine|Echo)', line, re.IGNORECASE):
            cleaned_rem = re.sub(r'^\s*\d+[\s\.\-]+', '', line)
            cleaned_rem = re.sub(r'\s+\d{2,5}\s*$', '', cleaned_rem)
            cleaned_rem = re.sub(r'(?:Authorized\s*Signature|Office\s*Copy).*$', '', cleaned_rem, flags=re.IGNORECASE).strip()
            if len(cleaned_rem) >= 3 and not remark:
                remark = cleaned_rem
                break

    if not remark:
        remark = '100'

    return {
        'rawText': raw_text,
        'fields': {
            'patientId': patient_id,
            'patientName': patient_name,
            'date': date,
            'time': time,
            'remark': remark,
        },
        'confidence': {
            'patientId': id_confidence,
            'patientName': name_confidence,
            'date': date_confidence,
            'time': time_confidence,
            'overall': round(overall_confidence)
        },
        'engine': 'Python Deep Learning OCR (RapidOCR + OpenCV)'
    }

def run_ocr(image_input):
    """Execute complete Python Computer Vision + Deep Learning OCR."""
    img = decode_image(image_input)
    if img is None:
        raise ValueError("Failed to decode image input")

    # Step 1: Preprocess image with OpenCV
    processed_img = preprocess_image_for_ocr(img)

    # Step 2: Run RapidOCR
    engine = get_ocr_engine()
    raw_text = ""
    confidences = []

    if engine is not None:
        try:
            result, _ = engine(processed_img)
            if result:
                for item in result:
                    # item format: [box_coords, text, confidence]
                    box, text, conf = item
                    if text and text.strip():
                        raw_text += text.strip() + "\n"
                        confidences.append(float(conf))
        except Exception as e:
            sys.stderr.write(f"[RapidOCR Execution Warning]: {e}\n")

    # Fallback to pytesseract if RapidOCR produced nothing
    if not raw_text.strip():
        try:
            import pytesseract
            raw_text = pytesseract.image_to_string(processed_img, config='--psm 3')
            confidences = [0.8]
        except Exception as e:
            sys.stderr.write(f"[PyTesseract Fallback Warning]: {e}\n")

    avg_conf = (sum(confidences) / len(confidences) * 100) if confidences else 75.0

    return parse_extracted_text(raw_text, overall_confidence=avg_conf)

if __name__ == '__main__':
    # CLI entry point: accepts image path or base64 JSON payload from stdin
    try:
        if len(sys.argv) > 1:
            input_arg = sys.argv[1]
            if os.path.isfile(input_arg):
                res = run_ocr(input_arg)
                print(json.dumps(res, ensure_ascii=False, indent=2))
                sys.exit(0)
            elif input_arg.startswith('data:image') or len(input_arg) > 100:
                res = run_ocr(input_arg)
                print(json.dumps(res, ensure_ascii=False))
                sys.exit(0)

        # Stdin JSON mode
        input_data = sys.stdin.read().strip()
        if input_data:
            try:
                parsed_json = json.loads(input_data)
                img_data = parsed_json.get('image', input_data)
            except:
                img_data = input_data

            res = run_ocr(img_data)
            print(json.dumps(res, ensure_ascii=False))
            sys.exit(0)
        else:
            print(json.dumps({'error': 'No image input provided'}, ensure_ascii=False))
            sys.exit(1)
    except Exception as err:
        sys.stderr.write(f"[OCR Engine Error]: {str(err)}\n")
        print(json.dumps({'error': str(err)}, ensure_ascii=False))
        sys.exit(1)
