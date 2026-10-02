const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CITIES, parseWallTime, parseTaipeiInput, findMatches } = require('./app');
const city = name => CITIES.filter(c => c.name === name).slice(0, 1);
const query = (a, b, name) => findMatches(parseWallTime(a), parseTaipeiInput(b), name ? city(name) : CITIES);
test('user example: Shibuya and Tokyo in seven minutes, Taipei excluded', () => {
  const rows = query('20260923 11:00', '20260923 09:53');
  assert.deepEqual([...new Set(rows.map(r => r.city.name))], ['布里斯班', '雪梨', '阿得雷德', '東京', '東京（涉谷）']);
  assert.ok(rows.filter(r => r.city.tz === 'Asia/Tokyo').every(r => r.waitMinutes === 7));
});
test('inclusive 0 and 60 minute boundaries, past and beyond excluded', () => {
  assert.equal(query('20260923 10:53', '20260923 09:53', '東京（涉谷）')[0].waitMinutes, 0);
  assert.equal(query('20260923 11:53', '20260923 09:53', '東京（涉谷）')[0].waitMinutes, 60);
  assert.equal(query('20260923 09:59', '20260923 09:53', '東京（涉谷）').length, 0);
  assert.equal(query('20260923 11:54', '20260923 09:53', '東京（涉谷）').length, 0);
});
test('cross midnight and full date comparison', () => {
  assert.equal(query('20260924 00:00', '20260923 22:53', '東京（涉谷）')[0].waitMinutes, 7);
  assert.equal(query('20260923 00:00', '20260923 22:53', '東京（涉谷）').length, 0);
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
test('current hour includes a target that just passed', () => {
  assert.equal(findMatches(parseWallTime('20260923 10:53'), new Date('2026-09-23T01:53:00.001Z'), city('東京（涉谷）')).length, 1);
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
  for (const id of ['targetDate','targetHour','targetList','manualDate','manualHour','manualArea','result','queryTime','copyBtn','queryForm']) {
    elements.set(id, new Element());
  }
  const document = { createElement: () => { const el = new Element(); Object.defineProperty(el, "id", { set(id) { elements.set(id, el); } }); return el; }, getElementById: id => elements.get(id), querySelectorAll: () => [], querySelector: () => ({ value: 'manual' }) };
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
  assert.equal(groups[0].children.length, 1 + CITIES.filter(c => ['Pacific/Fiji', 'Pacific/Auckland'].includes(c.tz)).length);
  const copyCoordinate = groups[0].children[1].children[1].children[1];
  await copyCoordinate.click();
  assert.equal(copied[0], '-17.752011, 177.451234');
  await elements.get('copyBtn').click();
  assert.ok(copied[1].startsWith('台灣時間：20260923 14:00'));
  assert.match(copied[1], /斐濟-勞托卡/);
  assert.match(copied[1], /紐西蘭-威靈頓/);
  assert.match(copied[1], /台灣時間：20260923 15:00/);
  assert.ok(!copied[1].includes('複製'));
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
    assert.deepEqual([...new Set(result.rows.map(r => r.city.name))], ['勞托卡', '威靈頓']);
    assert.equal(formatDateTime(result.rows[0].instant, 'Asia/Taipei'), '20260923 14:00:00');
  }
});
test('earliest city follows daylight saving rather than list order', () => {
  const { queryWithEarliest, formatDateTime } = require('./app');
  const result = queryWithEarliest(parseWallTime('20261223 18:00'), parseTaipeiInput('20261223 10:00'));
  assert.deepEqual([...new Set(result.rows.map(r => r.city.name))], ['威靈頓']);
  assert.equal(formatDateTime(result.rows[0].instant, 'Asia/Taipei'), '20261223 13:00:00');
});
test('normal window and already-passed targets do not trigger fallback', () => {
  const { queryWithEarliest } = require('./app');
  const target = parseWallTime('20260923 18:00');
  const normal = queryWithEarliest(target, parseTaipeiInput('20260923 14:00'));
  assert.equal(normal.earliest, false);
  assert.deepEqual([...new Set(normal.rows.map(r => r.city.name))], ['勞托卡', '威靈頓', '諾美亞']);
  const past = queryWithEarliest(target, parseTaipeiInput('20260925 14:00'));
  assert.equal(past.earliest, false);
  assert.equal(past.rows.length, 0);
  const gap = queryWithEarliest(target, parseTaipeiInput('20260923 16:00'), CITIES.filter(c => ['勞托卡', '台北'].includes(c.name)));
  assert.equal(gap.rows.length, 0);
  assert.equal(gap.earliest, false);
});
test('multiple A rows persist, migrate, add to five, delete and report blocked storage', () => {
  const vm = require('node:vm');
  const source = require('node:fs').readFileSync('app.js', 'utf8');
  const values = new Map();
  const key = 'findingCoordinates.targetTimes.v2';
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  function open(localStorage = storage) {
    const elements = new Map();
    function element() {
      const el = { value: '', children: [], append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; }, setAttribute() {}, classList: { toggle() {} }, addEventListener(event, handler) { this[event] = handler; } };
      Object.defineProperty(el, 'id', { set(id) { elements.set(id, el); } });
      return el;
    }
    const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element, querySelectorAll: () => [], querySelector: () => ({ value: 'now' }) };
    vm.runInNewContext(source, { document, localStorage, Date, Intl });
    return elements;
  }
  values.set('findingCoordinates.targetTime.v1', JSON.stringify({ date: '2030-12-25', hour: '00' }));
  const first = open();
  assert.equal(first.get('targetDate').value, '2030-12-25');
  for (let count = 1; count < 5; count++) {
    const rows = first.get('targetList').children;
    assert.equal(rows.length, count);
    const buttons = rows.flatMap(row => row.children).filter(el => el.textContent === '+');
    assert.equal(buttons.length, 1);
    buttons[0].click();
    first.get('targetHour' + count).value = String(count).padStart(2, '0');
    first.get('targetHour' + count).input();
  }
  assert.equal(first.get('targetList').children.flatMap(row => row.children).filter(el => el.textContent === '+').length, 0);
  assert.equal(JSON.parse(values.get(key)).length, 5);
  const restored = open();
  assert.equal(restored.get('targetList').children.length, 5);
  assert.equal(restored.get('targetHour4').value, '04');
  restored.get('targetList').children[0].children.find(el => el.textContent === '×').click();
  assert.equal(restored.get('targetHour').value, '01');
  assert.equal(open().get('targetList').children.length, 4);
  while (restored.get('targetList').children.length > 1) restored.get('targetList').children[0].children.find(el => el.textContent === '×').click();
  assert.equal(restored.get('targetList').children[0].children.filter(el => el.textContent === '×').length, 0);
  restored.get('targetDate').value = ''; restored.get('targetDate').change();
  assert.equal(open().get('targetDate').value, '2030-12-25');
  values.set(key, 'invalid JSON');
  assert.match(open().get('targetStorageStatus').textContent, /無法讀取/);
  const blocked = open({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  blocked.get('targetHour').change();
  assert.match(blocked.get('targetStorageStatus').textContent, /尚未儲存/);
});

test('A selection follows city instants instead of Taiwan wall-clock comparison', () => {
  const { selectNextTarget } = require('./app');
  const targets = [{ date: '2026-10-02', hour: '19' }, { date: '2026-10-03', hour: '17' }];
  const b = parseTaipeiInput('20261002 21:00');
  assert.equal(selectNextTarget(targets, b).index, 0);
  const rows = query('20261002 19:00', '20261002 21:00');
  const colombo = rows.find(r => r.city.lat === 6.927565454456982);
  assert.ok(colombo);
  assert.equal(colombo.instant.toISOString(), '2026-10-02T13:30:00.000Z');
  assert.equal(selectNextTarget(targets, parseTaipeiInput('20261005 00:00')), null);
  assert.throws(() => selectNextTarget([{ date: '', hour: '00' }], b), /A1/);
});
test('overlapping A dates choose earliest actual event and retain current hour', () => {
  const { selectNextTarget } = require('./app');
  const targets = [{ date: '2026-10-02', hour: '19' }, { date: '2026-10-03', hour: '17' }];
  assert.equal(selectNextTarget(targets, parseTaipeiInput('20261002 21:45'), city('可倫坡')).index, 0);
  assert.equal(selectNextTarget(targets, parseTaipeiInput('20261002 22:00'), city('可倫坡')).index, 1);
  assert.equal(selectNextTarget(targets, parseTaipeiInput('20261003 12:00')).index, 1);
});
test('all supplied coordinate points are available with country and valid time zone', () => {
  const records = require('./coordinate-import.json');
  const key = c => c.lat.toFixed(6) + ',' + c.lon.toFixed(6);
  assert.equal(records.length, 45);
  assert.equal(CITIES.length, 59);
  assert.equal(new Set(CITIES.map(key)).size, CITIES.length);
  for (const record of records) {
    const city = CITIES.find(c => key(c) === key(record));
    assert.ok(city, key(record));
    assert.equal(city.tz, record.tz);
  }
  for (const city of CITIES) {
    assert.ok(city.country && city.name);
    assert.ok(Math.abs(city.lat) <= 90 && Math.abs(city.lon) <= 180);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: city.tz }));
  }
});
test('Friday reference times and seasonal corrections', () => {
  const { queryWithEarliest, formatDateTime } = require('./app');
  const records = require('./coordinate-import.json');
  for (const record of records.filter(r => r.note.startsWith('五'))) {
    const raw = record.note.slice(1);
    const expected = raw.includes(':') ? raw : raw + ':00';
    const rows = queryWithEarliest(parseWallTime('20261002 17:00'), new Date('2026-09-29T00:00:00Z'), [record]).rows;
    assert.equal(formatDateTime(rows[0].instant, 'Asia/Taipei'), '20261002 ' + expected + ':00');
  }
  const convert = (name, a) => formatDateTime(queryWithEarliest(parseWallTime(a), new Date('2026-09-29T00:00:00Z'), city(name)).rows[0].instant, 'Asia/Taipei');
  assert.equal(convert('聖約翰', '20261002 18:00'), '20261003 04:30:00');
  assert.equal(convert('雪梨', '20261002 17:00'), '20261002 15:00:00');
  assert.equal(convert('雪梨', '20261004 17:00'), '20261004 14:00:00');
  assert.equal(convert('威靈頓', '20261002 18:00'), '20261002 13:00:00');
  assert.equal(convert('帕果帕果', '20261002 17:00'), '20261003 12:00:00');
});
test('northern hemisphere summer and winter offsets follow target date', () => {
  const { queryWithEarliest, formatDateTime } = require('./app');
  function arrival(name, target) {
    return formatDateTime(queryWithEarliest(parseWallTime(target), new Date('2026-01-01T00:00:00Z'), city(name)).rows[0].instant, 'Asia/Taipei');
  }
  assert.equal(arrival('紐約', '20260701 17:00'), '20260702 05:00:00');
  assert.equal(arrival('紐約', '20270101 17:00'), '20270102 06:00:00');
  assert.equal(arrival('倫敦', '20260701 17:00'), '20260702 00:00:00');
  assert.equal(arrival('倫敦', '20270101 17:00'), '20270102 01:00:00');
});
test('overlapping A1 and A2 both appear while future unmatched A3 is omitted', () => {
  const { queryAllTargets } = require('./app');
  const result = queryAllTargets([
    { date: '2026-10-02', hour: '19' },
    { date: '2026-10-03', hour: '17' },
    { date: '2026-10-10', hour: '17' }
  ], parseTaipeiInput('20261003 12:00'));
  assert.deepEqual(result.groups.map(g => g.index), [0, 1]);
  assert.ok(result.groups[0].rows.some(r => r.city.name === '檀香山'));
  assert.ok(result.groups[1].rows.some(r => r.city.name === '威靈頓'));
  assert.ok(result.groups.every(g => !g.earliest));
});
test('multiple A query keeps expired and earliest fallback behavior', () => {
  const { queryAllTargets } = require('./app');
  const targets = [{ date: '2026-10-02', hour: '19' }];
  assert.equal(queryAllTargets(targets, parseTaipeiInput('20261005 12:00')).expired, true);
  const early = queryAllTargets(targets, parseTaipeiInput('20261001 00:00'));
  assert.equal(early.groups.length, 1);
  assert.equal(early.groups[0].earliest, true);
});
