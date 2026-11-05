import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReviewDate } from './formatDate.ts';

test('formatReviewDate formats valid Date objects into DD.MM.YYYY в HH:mm', () => {
  const d = new Date(2024, 4, 24, 15, 30); // 24 May 2024 15:30 local
  const result = formatReviewDate(d);
  assert.equal(result, '24.05.2024 в 15:30');
});

test('formatReviewDate handles leading zeros for days and months', () => {
  const d = new Date(2024, 0, 5, 9, 7); // 05 Jan 2024 09:07 local
  const result = formatReviewDate(d);
  assert.equal(result, '05.01.2024 в 09:07');
});

test('formatReviewDate handles empty or invalid inputs gracefully', () => {
  assert.equal(formatReviewDate(''), '');
  assert.equal(formatReviewDate(null as any), '');
  assert.equal(formatReviewDate('not-a-date'), 'not-a-date');
});
