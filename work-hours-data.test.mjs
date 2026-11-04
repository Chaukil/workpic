import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const code = readFileSync(new URL('./work-hours-data.js', import.meta.url), 'utf8');
const { convertWorkHoursRows: convert } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const row = { ETD: '2026-11-28', MSS: 'MSS1125', KIND: 'MOTION', LINE: 'M151', THU: 11.5, FRI: 11.5, SAT: 9.75, SUN: 8, MON: 11.5, TUE: 0, WED: 9.75 };
const station = { ...row, KIND: 'STATION', LINE: 'O100' };
const rows = convert([row, station, { ...station, LINE: 'O200' }]);
assert.equal(rows.length, 7);
assert.equal(rows[0].date, '2026-11-19');
assert.equal(rows[6].date, '2026-11-25');
assert.equal(rows[5].motion, 0);
assert.equal(rows[0].station, 11.5);
const next = convert([{ ...row, ETD: '2027-01-02', MSS: 'MSS1230' }]);
assert.equal(next[0].date, '2026-12-24');
assert.equal(next[6].date, '2026-12-30');
const jan = convert([{ ...row, ETD: '2027-01-09', MSS: 'MSS0106' }]);
assert.equal(jan[0].date, '2026-12-31');
const serial = (Date.UTC(2026, 10, 28) - Date.UTC(1899, 11, 30)) / 86400000;
assert.deepEqual(convert([{ ...row, ETD: serial }]), convert([row]));
assert.deepEqual(convert([station, { ...station, LINE: 'O200', THU: 8 }]), convert([station]));
assert.deepEqual(convert([{ ...station, LINE: 'O200', THU: 8 }, station]), convert([station]));
assert.deepEqual(convert([{ ...station, LINE: 'O200' }]), []);
assert.throws(() => convert([station, { ...station, THU: 8 }]), error =>
    error.message.includes('O100 · MSS1125 · THU = 11.5h') &&
    error.message.includes('O100 · MSS1125 · THU = 8h'));
assert.throws(() => convert([{ ...row, MSS: 'MSS1124' }]), /không khớp/);
assert.throws(() => convert([{ ...row, THU: null }]), /không hợp lệ/);
assert.deepEqual(convert([{ ...row, LINE: 'M251' }]), []);
console.log('Passed: MSS dates, year rollover, OLE date, zero hours, conflicting lines, invalid input.');
