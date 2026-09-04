import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names safely
 */
export const cn = (...inputs) => {
  return twMerge(clsx(inputs));
};

/**
 * Format serial number SL with leading zeros if desired
 */
export const formatSL = (sl) => {
  if (sl === undefined || sl === null) return '-';
  return String(sl);
};

/**
 * Sanitize Patient ID ensuring it remains pure text
 */
export const cleanPatientId = (id) => {
  if (!id) return '';
  return String(id).trim();
};
