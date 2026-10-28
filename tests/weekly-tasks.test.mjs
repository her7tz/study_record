import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStartString, shiftDate, formatWeekRange, todayString } from '../lib/date.ts';
import { isValidWeeklyDate, validateWeeklyTask } from '../lib/weekly-task-model.ts';

test('weeks start on Monday, including Sunday and year boundaries', () => {
  assert.equal(weekStartString('2026-10-28'), '2026-10-26');
  assert.equal(weekStartString('2026-11-01'), '2026-10-26');
  assert.equal(weekStartString('2027-01-01'), '2026-12-28');
  assert.equal(weekStartString('2027-01-04'), '2027-01-04');
  assert.equal(shiftDate('2026-12-28', 7), '2027-01-04');
  assert.equal(shiftDate('2027-01-04', -7), '2026-12-28');
  assert.equal(formatWeekRange('2026-12-28'), '2026/12/28 – 2027/01/03');
});
test('the current week follows Shanghai calendar date at UTC midnight boundaries', () => {
  assert.equal(todayString(new Date('2026-11-01T16:01:00Z')), '2026-11-02');
  assert.equal(weekStartString(todayString(new Date('2026-11-01T16:01:00Z'))), '2026-11-02');
});
test('invalid dates, non-Mondays, blank titles and oversized notes are rejected', () => {
  const base = { week_start: '2026-10-26', title: '复习本周内容', note: '', status: 'todo' };
  assert.equal(validateWeeklyTask(base), null);
  for (const value of ['2026-02-30', '2025-02-29', '2026-13-01', 'foo', '0000-01-01']) assert.equal(isValidWeeklyDate(value), false);
  assert.equal(isValidWeeklyDate('2024-02-29'), true);
  assert.ok(validateWeeklyTask({ ...base, week_start: '2026-10-28' }));
  assert.ok(validateWeeklyTask({ ...base, title: '   ' }));
  assert.ok(validateWeeklyTask({ ...base, title: 'a'.repeat(121) }));
  assert.ok(validateWeeklyTask({ ...base, note: 'a'.repeat(2001) }));
  assert.equal(validateWeeklyTask({ ...base, title: 'a'.repeat(120), note: '中'.repeat(2000) }), null);
  assert.equal(validateWeeklyTask({ ...base, status: 'done' }), null);
  assert.equal(validateWeeklyTask({ ...base, status: 'crossed' }), null);
  assert.ok(validateWeeklyTask({ ...base, status: 'invalid' }));
});
