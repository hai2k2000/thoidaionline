import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mondayFirstWeek,
  buildOnlineWorkWeeks,
} from './onlineWorkCalendar.mjs';

test('mondayFirstWeek returns Monday through Sunday', () => {
  assert.deepEqual(mondayFirstWeek('2026-10-07'), [
    '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
    '2026-10-09', '2026-10-10', '2026-10-11',
  ]);
});

test('buildOnlineWorkWeeks preserves blank weekdays and masks weekends', () => {
  const weeks = buildOnlineWorkWeeks('2026-10-07', '2026-10-07', [
    { id: '1', work_date: '2026-10-07', staff: { username: 'Anh', full_name: 'A' } },
  ]);
  assert.equal(weeks.length, 1);
  assert.deepEqual(weeks[0].map((cell) => cell.date), [
    '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
    '2026-10-09', '2026-10-10', '2026-10-11',
  ]);
  assert.equal(weeks[0][0].assignments.length, 0);
  assert.equal(weeks[0][2].assignments.length, 1);
  assert.equal(weeks[0][5].weekendLabel, 'Tất cả ban ngoại ngữ');
  assert.equal(weeks[0][6].weekendLabel, 'Tất cả ban ngoại ngữ');
  assert.equal(weeks[0][5].assignments.length, 0);
});

test('month range is grouped into complete Monday-Sunday rows', () => {
  const weeks = buildOnlineWorkWeeks('2026-10-01', '2026-10-31', []);
  assert.equal(weeks[0][0].date, '2026-09-28');
  assert.equal(weeks.at(-1).at(-1).date, '2026-11-01');
  assert.equal(weeks.every((week) => week.length === 7), true);
});
