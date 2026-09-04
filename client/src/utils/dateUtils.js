export const MONTHS = [
  { value: 1, name: 'January' },
  { value: 2, name: 'February' },
  { value: 3, name: 'March' },
  { value: 4, name: 'April' },
  { value: 5, name: 'May' },
  { value: 6, name: 'June' },
  { value: 7, name: 'July' },
  { value: 8, name: 'August' },
  { value: 9, name: 'September' },
  { value: 10, name: 'October' },
  { value: 11, name: 'November' },
  { value: 12, name: 'December' },
];

/**
 * Generate a dynamic list of years around current year
 */
export const getAvailableYears = (spanPast = 3, spanFuture = 7) => {
  const currentYear = new Date().getFullYear();
  const start = currentYear - spanPast;
  const end = currentYear + spanFuture;
  const years = [];
  for (let y = start; y <= end; y++) {
    years.push(y);
  }
  return years;
};

/**
 * Format Month & Year into standard header format e.g. "SEPTEMBER-2026"
 */
export const formatMonthYearHeader = (monthNum, yearNum) => {
  const m = MONTHS.find((item) => item.value === Number(monthNum));
  const monthName = m ? m.name.toUpperCase() : 'UNKNOWN';
  return `MONTH: ${monthName}-${yearNum}`;
};

/**
 * Format date for table/report display (DD/MM/YYYY)
 */
export const formatDateDisplay = (dateInput) => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Format date for HTML <input type="date" /> (YYYY-MM-DD)
 */
export const formatDateForInput = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format date in dot short notation (DD.MM.YY) matching hospital records e.g. "01.08.26"
 */
export const formatDateDotShort = (dateInput) => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

/**
 * Format standard time e.g., "14:30" or "20.50PM"
 */
export const formatTimeDisplay = (timeStr) => {
  if (!timeStr) return '-';
  return timeStr.trim();
};

/**
 * Format 24h / 12h time into clean 12-hour Hospital format e.g. "07.31PM" or "12.35AM"
 */
export const formatHospitalTime = (timeStr) => {
  if (!timeStr) return '';
  const trimmed = timeStr.trim().toUpperCase();

  // If already formatted like 19.31PM, 07:31 PM, or 07.31PM, convert hours to 12-hr
  const ampmMatch = trimmed.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2];
    const p = ampmMatch[3] ? ampmMatch[3].toUpperCase() : (h >= 12 ? 'PM' : 'AM');
    if (h > 12) h = h % 12 || 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}.${m}${p}`;
  }

  // Parse 24-hr format (HH:MM or HH.MM)
  const parts = trimmed.split(/[:.]/);
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const mins = parts[1].slice(0, 2).padStart(2, '0');
    if (!isNaN(hours)) {
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12; // convert 19 -> 07, 0 -> 12
      return `${String(hours).padStart(2, '0')}.${mins}${period}`;
    }
  }

  return trimmed;
};

/**
 * Get current time formatted strictly in 12-hour hospital format (e.g. 07.35PM)
 */
export const getCurrentHospitalTime = () => {
  const now = new Date();
  let hours = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}.${mins}${period}`;
};
