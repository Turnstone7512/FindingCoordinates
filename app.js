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
  { name: "加德滿都", lat: 27.700214, lon: 85.356936, tz: "Asia/Kathmandu", offsetMinutes: 15 },
  { name: "可倫坡", lat: 6.927426, lon: 79.844689, tz: "Asia/Colombo", offsetMinutes: 30 },
  { name: "馬爾地夫", lat: 4.176791, lon: 73.518123, tz: "Indian/Maldives" },
  { name: "杜拜", lat: 25.254678, lon: 55.304404, tz: "Asia/Dubai" },
  { name: "科威特城", lat: 29.374533, lon: 47.987123, tz: "Asia/Kuwait" },
  { name: "雅典", lat: 37.969056, lon: 23.752648, tz: "Europe/Athens" },
  { name: "巴黎", lat: 48.879752, lon: 2.356136, tz: "Europe/Paris" },
  { name: "倫敦", lat: 51.510223, lon: -0.133832, tz: "Europe/London" },
  { name: "英雄港", lat: 38.656718, lon: -27.219463, tz: "Atlantic/Azores" },
  { name: "雷克雅維克", lat: 64.145725, lon: -21.926867, tz: "Atlantic/Reykjavik" },
  { name: "聖約翰", lat: 47.560547, lon: -52.756198, tz: "America/St_Johns", offsetMinutes: 30 },
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

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const TAIPEI_TZ = "Asia/Taipei";

const modeInputs = document.querySelectorAll('input[name="mode"]');
const manualArea = document.getElementById("manualArea");
const dateTimeInput = document.getElementById("dateTime");
const queryBtn = document.getElementById("queryBtn");
const copyBtn = document.getElementById("copyBtn");
const resultEl = document.getElementById("result");
const queryTimeEl = document.getElementById("queryTime");

modeInputs.forEach(input => {
  input.addEventListener("change", () => {
    manualArea.classList.toggle("hidden", input.value !== "manual");
  });
});

queryBtn.addEventListener("click", runQuery);
copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(resultEl.textContent);
  copyBtn.textContent = "已複製";
  setTimeout(() => copyBtn.textContent = "複製結果", 1200);
});

function getSelectedMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function parseTaipeiInput(value) {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error("日期時間格式錯誤，請使用 YYYYMMDD HH:MM，例如 20260731 15:30。");
  }

  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi));

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d ||
    date.getUTCHours() !== h ||
    date.getUTCMinutes() !== mi
  ) {
    throw new Error("日期時間無效，請確認日期與時間。");
  }

  // 輸入視為台灣時間 UTC+8。
  return new Date(date.getTime() - 8 * 60 * 60 * 1000);
}

function getTaipeiNow() {
  const parts = getDateTimeParts(new Date(), TAIPEI_TZ);
  return partsToInstant(parts, 8 * 60);
}

function getDateTimeParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(p => p.type !== "literal")
      .map(p => [p.type, Number(p.value)])
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second || 0
  };
}

function partsToInstant(parts, offsetMinutes) {
  return new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  ) - offsetMinutes * 60 * 1000);
}

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getLocalDateParts(instant, city) {
  return getDateTimeParts(instant, city.tz);
}

function getDateLabel(parts) {
  return `${parts.month}/${parts.day}(${WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()]})`;
}

function getOffsetMinutes(instant, timeZone) {
  const p = getDateTimeParts(instant, timeZone);
  const utcRepresentation = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((utcRepresentation - instant.getTime()) / 60000);
}

function getLocalEventInstant(city, year, month, day) {
  // 每個城市的活動固定為當地時間 18:00-19:00。
  // 透過 Intl 取得該城市當日 UTC offset，因此可正確處理夏令時間。
  const localWallTime = Date.UTC(year, month - 1, day, 18, 0, 0);
  let instant = new Date(localWallTime);

  let offset = getOffsetMinutes(instant, city.tz);
  instant = new Date(localWallTime - offset * 60000);

  // DST 切換附近重新取得 offset，避免第一次估算落在不同 offset。
  offset = getOffsetMinutes(instant, city.tz);
  instant = new Date(localWallTime - offset * 60000);

  return instant;
}

function formatTaipeiEvent(instant, city) {
  const start = getDateTimeParts(instant, TAIPEI_TZ);
  const endInstant = new Date(instant.getTime() + 60 * 60 * 1000);
  const end = getDateTimeParts(endInstant, TAIPEI_TZ);

  return `${getDateLabel(start)} ${formatTime(start.hour, start.minute)}-${formatTime(end.hour, end.minute)} ${city.name} ${city.lat.toFixed(6)}, ${city.lon.toFixed(6)}`;
}

function getCandidateDates(queryStart) {
  const p = getDateTimeParts(queryStart, TAIPEI_TZ);
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day));

  return [-1, 0, 1].map(delta => {
    const d = new Date(base.getTime() + delta * 24 * 60 * 60 * 1000);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate()
    };
  });
}

function getEventWindow(queryInstant) {
  // 依範例：輸入 15:30 時，以 15:00 作為查詢起點，
  // 查詢「輸入時間所在整點～下一個整點結束前」開始的活動。
  const taipei = getDateTimeParts(queryInstant, TAIPEI_TZ);
  const baseTaipei = new Date(Date.UTC(
    taipei.year, taipei.month - 1, taipei.day, taipei.hour, 0, 0
  ) - 8 * 60 * 60 * 1000);

  return {
    start: baseTaipei,
    end: new Date(baseTaipei.getTime() + 2 * 60 * 60 * 1000)
  };
}

function runQuery() {
  try {
    let queryInstant;

    if (getSelectedMode() === "now") {
      queryInstant = new Date();
    } else {
      queryInstant = parseTaipeiInput(dateTimeInput.value);
    }

    const { start, end } = getEventWindow(queryInstant);
    const rows = [];
    const candidateDates = getCandidateDates(start);

    for (const city of CITIES) {
      for (const date of candidateDates) {
        const eventInstant = getLocalEventInstant(
          city,
          date.year,
          date.month,
          date.day
        );

        if (eventInstant >= start && eventInstant < end) {
          rows.push({
            city,
            instant: eventInstant,
            text: formatTaipeiEvent(eventInstant, city)
          });
        }
      }
    }

    // 依台灣時間排序；若同一時間，維持 CITIES 原始順序。
    rows.sort((a, b) => a.instant - b.instant);

    const taipeiParts = getDateTimeParts(start, TAIPEI_TZ);
    queryTimeEl.textContent =
      `查詢基準：${getDateLabel(taipeiParts)} ${formatTime(taipeiParts.hour, taipeiParts.minute)}（台灣時間）`;

    resultEl.textContent = rows.length
      ? rows.map(r => r.text).join("\n")
      : "未找到符合條件的時區資訊。";

    copyBtn.disabled = rows.length === 0;
  } catch (error) {
    queryTimeEl.textContent = "";
    resultEl.textContent = error.message;
    copyBtn.disabled = true;
  }
}

// 預設載入時立即查詢。
runQuery();
