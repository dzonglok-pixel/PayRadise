/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats an ISO date string into "DD.MM.YYYY в HH:mm"
 * e.g., "2024-05-24T15:30:00Z" -> "24.05.2024 в 15:30"
 */
export function formatReviewDate(dateInput: string | number | Date): string {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    return String(dateInput);
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}.${month}.${year} в ${hours}:${minutes}`;
}
