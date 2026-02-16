/**
 * Date utility functions for converting between ISO and datetime-local formats
 */

/**
 * Converts a datetime-local string to ISO format
 * @param {string} datetimeLocalValue - datetime-local format "YYYY-MM-DDTHH:mm"
 * @returns {string|null} ISO string or null if invalid
 */
export function toIsoOrNull(datetimeLocalValue) {
  if (!datetimeLocalValue) return null;
  const d = new Date(datetimeLocalValue);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Converts an ISO date string to datetime-local format
 * @param {string} iso - ISO date string
 * @returns {string} datetime-local format "YYYY-MM-DDTHH:mm" or empty string if invalid
 */
export function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}
