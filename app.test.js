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
test('grouped results, coordinate copy, full copy and validation', async () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const copied = [];
  class Element {
    constructor() { this.children = []; this.value = ''; this.classList = { toggle() {} }; }
    set textContent(value) { this.children = [value]; }
    get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
    append(...children) { this.children.push(...children); }
    replaceChildren() { this.children = []; }
    setAttribute() {}
    addEventListener(type, callback) { this[type] = callback; }
  }
  const elements = new Map();
  for (const id of ['targetDate','targetHour','manualDate','manualHour','manualArea','result','queryTime','copyBtn','queryForm']) {
    elements.set(id, new Element());
  }
  const document = { createElement: () => new Element(), getElementById: id => elements.get(id), querySelectorAll: () => [], querySelector: () => ({ value: 'manual' }) };
  vm.runInNewContext(fs.readFileSync('app.js','utf8'), { document, Intl, Date, setTimeout: callback => callback(), navigator: { clipboard: { writeText: async text => copied.push(text) } } });
  assert.equal(elements.get('targetDate').value.length, 10);
  assert.equal(elements.get('targetHour').children.length, 24);
  assert.equal(elements.get('targetHour').children[0].value, '00');
  assert.equal(elements.get('targetHour').children[23].value, '23');
  elements.get('targetDate').value = '2026-09-23';
  elements.get('targetHour').value = '11';
  elements.get('manualDate').value = '2026-09-23';
  elements.get('manualHour').value = '09';
  elements.get('queryForm').submit({ preventDefault() {} });
  assert.match(elements.get('result').textContent, /涉谷/);
  assert.match(elements.get('result').textContent, /台灣時間：20260923 10:00/);
  elements.get('targetHour').value = '18';
  elements.get('manualHour').value = '14';
  elements.get('queryForm').submit({ preventDefault() {} });
  const groups = elements.get('result').children;
  assert.equal(groups.length, 2);
  assert.equal(groups[0].children[0].textContent, '台灣時間：20260923 14:00');
  assert.equal(groups[1].children[0].textContent, '台灣時間：20260923 15:00');
  assert.equal(groups[0].children[0].children[1].textContent, '14');
  assert.equal(groups[0].children.length, 3);
  const copyCoordinate = groups[0].children[1].children[1].children[1];
  await copyCoordinate.click();
  assert.equal(copied[0], '-17.752011, 177.451234');
  await elements.get('copyBtn').click();
  assert.equal(copied[1], '台灣時間：20260923 14:00\n\n勞托卡（Pacific/Fiji）\n-17.752011, 177.451234\n\n威靈頓（Pacific/Auckland）\n-41.284212, 174.775681\n\n台灣時間：20260923 15:00\n\n諾美亞（Pacific/Noumea）\n-22.285410, 166.445664');
  assert.equal(elements.get('copyBtn').disabled, false);
  elements.get('manualDate').value = '';
  elements.get('queryForm').submit({ preventDefault() {} });
  assert.match(elements.get('result').textContent, /時間 B/);
  assert.equal(elements.get('copyBtn').disabled, true);
});
test('early B shows all earliest cities, including targets several days away', () => {
  const { queryWithEarliest, formatDateTime } = require('./app');
  for (const b of ['20260923 12:00', '20260920 12:00']) {
    const result = queryWithEarliest(parseWallTime('20260923 18:00'), parseTaipeiInput(b));
    assert.equal(result.earliest, true);
    assert.deepEqual(result.rows.map(r => r.city.name), ['勞托卡', '威靈頓']);
    assert.equal(formatDateTime(result.rows[0].instant, 'Asia/Taipei'), '20260923 14:00:00');
  }
});
test('earliest city follows daylight saving rather than list order', () => {
  const { queryWithEarliest, formatDateTime } = require('./app');
  const result = queryWithEarliest(parseWallTime('20261223 18:00'), parseTaipeiInput('20261223 10:00'));
  assert.deepEqual(result.rows.map(r => r.city.name), ['威靈頓']);
  assert.equal(formatDateTime(result.rows[0].instant, 'Asia/Taipei'), '20261223 13:00:00');
});
test('normal window and already-passed targets do not trigger fallback', () => {
  const { queryWithEarliest } = require('./app');
  const target = parseWallTime('20260923 18:00');
  const normal = queryWithEarliest(target, parseTaipeiInput('20260923 14:00'));
  assert.equal(normal.earliest, false);
  assert.deepEqual(normal.rows.map(r => r.city.name), ['勞托卡', '威靈頓', '諾美亞']);
  const past = queryWithEarliest(target, parseTaipeiInput('20260925 14:00'));
  assert.equal(past.earliest, false);
  assert.equal(past.rows.length, 0);
  const gap = queryWithEarliest(target, parseTaipeiInput('20260923 16:00'), CITIES.filter(c => ['勞托卡', '台北'].includes(c.name)));
  assert.equal(gap.rows.length, 0);
  assert.equal(gap.earliest, false);
});
test('A selection persists across reloads and tolerates invalid or blocked storage', () => {
  const vm = require('node:vm');
  const source = require('node:fs').readFileSync('app.js', 'utf8');
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  function open(localStorage = storage) {
    const elements = new Map();
    const document = {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { value: '', append() {}, classList: { toggle() {} }, addEventListener(event, handler) { this[event] = handler; } });
        return elements.get(id);
      },
      createElement: () => ({}), querySelectorAll: () => [], querySelector: () => ({ value: 'now' })
    };
    vm.runInNewContext(source, { document, localStorage, Date, Intl });
    return elements;
  }
  const first = open();
  first.get('targetDate').value = '2030-12-25';
  first.get('targetHour').value = '00';
  first.get('targetDate').input();
  assert.match(first.get('targetStorageStatus').textContent, /已儲存/);
  const second = open();
  assert.equal(second.get('targetDate').value, '2030-12-25');
  assert.match(second.get('targetStorageStatus').textContent, /已還原/);
  assert.equal(second.get('targetHour').value, '00');
  second.get('targetHour').value = '23';
  second.get('targetHour').change();
  assert.equal(open().get('targetHour').value, '23');
  second.get('targetDate').value = '';
  second.get('targetDate').change();
  assert.equal(open().get('targetDate').value, '2030-12-25');
  for (const value of ['not json', '{"date":"2030-02-30","hour":"23"}']) {
    values.set('findingCoordinates.targetTime.v1', value);
    assert.notEqual(open().get('targetDate').value, '2030-02-30');
  }
  const blocked = open({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  assert.doesNotThrow(() => blocked.get('targetHour').change());
  assert.match(blocked.get('targetStorageStatus').textContent, /尚未儲存/);
});
