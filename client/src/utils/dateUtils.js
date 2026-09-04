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
 * Format standard time e.g., "14:30" or "02:30 PM"
 */
export const formatTimeDisplay = (timeStr) => {
  if (!timeStr) return '-';
  return timeStr.trim();
};
