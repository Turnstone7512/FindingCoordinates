const CITIES = [
  { name: "勞托卡", lat: -17.752011, lon: 177.451234, tz: "Pacific/Fiji" },
  { name: "威靈頓", lat: -41.284212, lon: 174.775681, tz: "Pacific/Auckland" },
  { name: "諾美亞", lat: -22.285410, lon: 166.445664, tz: "Pacific/Noumea" },
  { name: "布里斯班", lat: -27.469553, lon: 153.026319, tz: "Australia/Brisbane" },
  { name: "雪梨", lat: -33.873966, lon: 151.206727, tz: "Australia/Sydney" },
  { name: "阿得雷德", lat: -34.924074, lon: 138.600717, tz: "Australia/Adelaide" },
  { name: "東京", lat: 35.680606, lon: 139.763719, tz: "Asia/Tokyo" },
  { name: "涉谷", lat: 35.658863, lon: 139.700918, tz: "Asia/Tokyo" },
  { name: "台北", lat: 25.033429, lon: 121.537823, tz: "Asia/Taipei" },
  { name: "曼谷", lat: 13.748380, lon: 100.503438, tz: "Asia/Bangkok" },
  { name: "胡志明市", lat: 10.792277, lon: 106.680761, tz: "Asia/Ho_Chi_Minh" },
  { name: "加德滿都", lat: 27.700214, lon: 85.356936, tz: "Asia/Kathmandu" },
  { name: "可倫坡", lat: 6.927426, lon: 79.844689, tz: "Asia/Colombo" },
  { name: "馬爾地夫", lat: 4.176791, lon: 73.518123, tz: "Indian/Maldives" },
  { name: "杜拜", lat: 25.254678, lon: 55.304404, tz: "Asia/Dubai" },
  { name: "科威特城", lat: 29.374533, lon: 47.987123, tz: "Asia/Kuwait" },
  { name: "雅典", lat: 37.969056, lon: 23.752648, tz: "Europe/Athens" },
  { name: "巴黎", lat: 48.879752, lon: 2.356136, tz: "Europe/Paris" },
  { name: "倫敦", lat: 51.510223, lon: -0.133832, tz: "Europe/London" },
  { name: "英雄港", lat: 38.656718, lon: -27.219463, tz: "Atlantic/Azores" },
  { name: "雷克雅維克", lat: 64.145725, lon: -21.926867, tz: "Atlantic/Reykjavik" },
  { name: "聖約翰", lat: 47.560547, lon: -52.756198, tz: "America/St_Johns" },
  { name: "哈利法斯", lat: 44.670640, lon: -63.574253, tz: "America/Halifax" },
  { name: "聖保羅", lat: -23.555305, lon: -46.662340, tz: "America/Sao_Paulo" },
  { name: "聖路易斯", lat: -2.518875, lon: -44.225159, tz: "America/Fortaleza" },
  { name: "紐約", lat: 40.726315, lon: -73.996669, tz: "America/New_York" },
  { name: "芝加哥", lat: 41.853454, lon: -87.634872, tz: "America/Chicago" },
  { name: "丹佛", lat: 39.742650, lon: -104.840074, tz: "America/Denver" },
  { name: "舊金山", lat: 37.794980, lon: -122.394246, tz: "America/Los_Angeles" },
  { name: "安克拉治", lat: 61.217990, lon: -149.900375, tz: "America/Anchorage" },
  { name: "檀香山", lat: 21.307190, lon: -157.854928, tz: "Pacific/Honolulu" },
  { name: "美屬薩摩亞", lat: -14.277986, lon: -170.687944, tz: "Pacific/Pago_Pago" }
];

const TAIPEI_TZ = "Asia/Taipei";
const MINUTE = 60000;
const formatters = new Map();

function parseWallTime(value) {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) throw new Error("請使用 YYYYMMDD HH:MM，例如 20260923 11:00。");
  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, mi, 0, 0);
  if (y < 1 || date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 ||
      date.getUTCDate() !== d || date.getUTCHours() !== h || date.getUTCMinutes() !== mi) {
    throw new Error("日期時間無效，請確認日期與時間。");
  }
  return date.getTime();
}

function parseTaipeiInput(value) {
  return new Date(parseWallTime(value) - 8 * 60 * MINUTE);
}

function getDateTimeParts(date, timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }));
  }
  return Object.fromEntries(formatters.get(timeZone).formatToParts(date)
    .filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]));
}

function wallTimeFromParts(p) {
  const date = new Date(0);
  date.setUTCFullYear(p.year, p.month - 1, p.day);
  date.setUTCHours(p.hour, p.minute, p.second, 0);
  return date.getTime();
}

function formatDateTime(date, timeZone) {
  const p = getDateTimeParts(date, timeZone);
  const pad = n => String(n).padStart(2, "0");
  return `${String(p.year).padStart(4, "0")}${pad(p.month)}${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

function findMatches(targetWallTime, queryInstant, cities = CITIES) {
  const start = queryInstant.getTime();
  const end = start + 60 * MINUTE;
  const rows = [];
  for (const city of cities) {
    // Sample offsets inside the actual window to handle DST changes.
    const offsets = new Set();
    for (let time = start; time <= end; time += MINUTE) {
      const wholeSecond = Math.floor(time / 1000) * 1000;
      offsets.add(wallTimeFromParts(getDateTimeParts(new Date(wholeSecond), city.tz)) - wholeSecond);
    }
    for (const offset of offsets) {
      const time = targetWallTime - offset;
      const instant = new Date(time);
      // Verification rejects nonexistent times and preserves repeated local times.
      if (time >= start && time <= end &&
          wallTimeFromParts(getDateTimeParts(instant, city.tz)) === targetWallTime) {
        rows.push({ city, instant, waitMinutes: (time - start) / MINUTE });
      }
    }
  }
  return rows.sort((a, b) => a.instant - b.instant);
}

function renderResults(rows, resultEl) {
  resultEl.replaceChildren();
  const groups = new Map();
  for (const row of rows) {
    const time = formatDateTime(row.instant, TAIPEI_TZ).slice(0, 14);
    if (!groups.has(time)) groups.set(time, []);
    groups.get(time).push(row.city);
  }
  const textGroups = [];
  for (const [time, cities] of groups) {
    const group = document.createElement("section");
    group.className = "time-group";
    const heading = document.createElement("h3");
    heading.append("台灣時間：" + time.slice(0, 9));
    const hour = document.createElement("span");
    hour.className = "taipei-hour";
    hour.textContent = time.slice(9, 11);
    heading.append(hour, time.slice(11));
    group.append(heading);
    const lines = ["台灣時間：" + time];
    for (const city of cities) {
      const entry = document.createElement("div");
      entry.className = "city-result";
      const name = document.createElement("div");
      name.textContent = city.name + "（" + city.tz + "）";
      const coordinateRow = document.createElement("div");
      coordinateRow.className = "coordinate-row";
      const coordinates = city.lat.toFixed(6) + ", " + city.lon.toFixed(6);
      const value = document.createElement("span");
      value.className = "coordinates";
      value.textContent = coordinates;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "copy-coordinate";
      button.textContent = "複製";
      button.setAttribute("aria-label", "複製" + city.name + "的座標");
      button.addEventListener("click", () => copyText(coordinates, button, "複製"));
      coordinateRow.append(value, button);
      entry.append(name, coordinateRow);
      group.append(entry);
      lines.push(name.textContent + "\n" + coordinates);
    }
    resultEl.append(group);
    textGroups.push(lines.join("\n\n"));
  }
  if (!rows.length) resultEl.textContent = "未來一小時內，內建城市清單中沒有符合指定日期時間 A 的地點。";
  return textGroups.join("\n\n");
}

async function copyText(text, button, label) {
  button.disabled = true;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "已複製";
  } catch {
    button.textContent = "複製失敗，請手動選取";
  }
  setTimeout(() => {
    button.textContent = label;
    button.disabled = false;
  }, 2000);
}

if (typeof document !== "undefined") {
  const targetInput = document.getElementById("targetTime");
  const dateTimeInput = document.getElementById("dateTime");
  const manualArea = document.getElementById("manualArea");
  const resultEl = document.getElementById("result");
  const queryTimeEl = document.getElementById("queryTime");
  const copyBtn = document.getElementById("copyBtn");
  let resultText = "";
  const nowText = formatDateTime(new Date(), TAIPEI_TZ).slice(0, 14);
  targetInput.value = nowText;
  dateTimeInput.value = nowText;
  document.querySelectorAll('input[name="mode"]').forEach(input => {
    input.addEventListener("change", () => {
      manualArea.classList.toggle("hidden", input.value !== "manual");
    });
  });
  document.getElementById("queryForm").addEventListener("submit", event => {
    event.preventDefault();
    try {
      let target;
      try { target = parseWallTime(targetInput.value); }
      catch (error) { throw new Error(`時間 A：${error.message}`); }
      let queryInstant = new Date();
      if (document.querySelector('input[name="mode"]:checked').value === "manual") {
        try { queryInstant = parseTaipeiInput(dateTimeInput.value); }
        catch (error) { throw new Error(`時間 B：${error.message}`); }
      }
      const rows = findMatches(target, queryInstant);
      queryTimeEl.textContent = `目標 A（各地當地時間）：${targetInput.value.trim()}\n` +
        `查詢範圍（台灣時間）：${formatDateTime(queryInstant, TAIPEI_TZ)} ～ ${formatDateTime(new Date(queryInstant.getTime() + 60 * MINUTE), TAIPEI_TZ)}（包含兩端）`;
      resultText = renderResults(rows, resultEl);
      copyBtn.disabled = rows.length === 0;
    } catch (error) {
      queryTimeEl.textContent = "";
      resultText = "";
      resultEl.textContent = error.message;
      copyBtn.disabled = true;
    }
  });
  copyBtn.addEventListener("click", () => copyText(resultText, copyBtn, "複製結果"));
}
if (typeof module !== "undefined") {
  module.exports = { CITIES, parseWallTime, parseTaipeiInput, findMatches, formatDateTime };
}
