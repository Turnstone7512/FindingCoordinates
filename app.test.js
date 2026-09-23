const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CITIES, parseWallTime, parseTaipeiInput, findMatches } = require('./app');
const city = name => CITIES.filter(c => c.name === name);
const query = (a, b, name) => findMatches(parseWallTime(a), parseTaipeiInput(b), name ? city(name) : CITIES);
test('user example: Shibuya and Tokyo in seven minutes, Taipei excluded', () => {
  const rows = query('20260923 11:00', '20260923 09:53');
  assert.deepEqual(rows.map(r => r.city.name), ['東京', '涉谷']);
  assert.ok(rows.every(r => r.waitMinutes === 7));
});
test('inclusive 0 and 60 minute boundaries, past and beyond excluded', () => {
  assert.equal(query('20260923 10:53', '20260923 09:53', '涉谷')[0].waitMinutes, 0);
  assert.equal(query('20260923 11:53', '20260923 09:53', '涉谷')[0].waitMinutes, 60);
  assert.equal(query('20260923 10:52', '20260923 09:53', '涉谷').length, 0);
  assert.equal(query('20260923 11:54', '20260923 09:53', '涉谷').length, 0);
});
test('cross midnight and full date comparison', () => {
  assert.equal(query('20260924 00:00', '20260923 22:53', '涉谷')[0].waitMinutes, 7);
  assert.equal(query('20260923 00:00', '20260923 22:53', '涉谷').length, 0);
});
test('fractional offsets', () => {
  assert.equal(query('20260923 08:00', '20260923 09:53', '加德滿都')[0].waitMinutes, 22);
  assert.equal(query('20260923 08:00', '20260923 09:53', '可倫坡')[0].waitMinutes, 37);
});
test('invalid inputs and leap days', () => {
  for (const value of ['', '20260923 9:53', '20260229 11:00', '20260931 11:00', '20260923 24:00', '20260923 11:60']) {
    assert.throws(() => parseWallTime(value));
  }
  assert.doesNotThrow(() => parseWallTime('20240229 11:00'));
  assert.equal(parseTaipeiInput('20260923 09:53').toISOString(), '2026-09-23T01:53:00.000Z');
});
test('DST nonexistent and repeated local times', () => {
  assert.equal(query('20260308 02:30', '20260308 14:00', '紐約').length, 0);
  const rows = query('20261101 01:30', '20261101 13:30', '紐約');
  assert.deepEqual(rows.map(r => r.waitMinutes), [0, 60]);
});
test('seconds preserved: a target just passed is excluded', () => {
  assert.equal(findMatches(parseWallTime('20260923 10:53'), new Date('2026-09-23T01:53:00.001Z'), city('涉谷')).length, 0);
});
test('form manual query and validation', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const elements = new Map();
  for (const id of ['targetTime','dateTime','manualArea','result','queryTime','copyBtn','queryForm']) {
    elements.set(id, { value: '', textContent: '', classList: { toggle() {} }, addEventListener(type, callback) { this[type] = callback; } });
  }
  const document = { getElementById: id => elements.get(id), querySelectorAll: () => [], querySelector: () => ({ value: 'manual' }) };
  vm.runInNewContext(fs.readFileSync('app.js','utf8'), { document, Intl, Date, setTimeout });
  assert.equal(elements.get('targetTime').value.length, 14);
  elements.get('targetTime').value = '20260923 11:00';
  elements.get('dateTime').value = '20260923 09:53';
  elements.get('queryForm').submit({ preventDefault() {} });
  assert.match(elements.get('result').textContent, /涉谷/);
  assert.match(elements.get('result').textContent, /7 分 0 秒/);
  assert.equal(elements.get('copyBtn').disabled, false);
  elements.get('dateTime').value = 'invalid';
  elements.get('queryForm').submit({ preventDefault() {} });
  assert.match(elements.get('result').textContent, /時間 B/);
  assert.equal(elements.get('copyBtn').disabled, true);
});
