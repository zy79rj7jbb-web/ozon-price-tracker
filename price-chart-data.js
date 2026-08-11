const db = require("./database");

const [, , productIdArg, hoursArg] = process.argv;

if (!productIdArg) {
  console.error("Использование: node price-chart-data.js <product_id> [hours]");
  process.exit(1);
}

const productId = Number(productIdArg);
const hours = hoursArg ? Number(hoursArg) : 24;

if (!Number.isInteger(productId) || productId <= 0) {
  console.error("product_id должен быть положительным целым числом");
  process.exit(1);
}

if (!Number.isFinite(hours) || hours <= 0) {
  console.error("hours должен быть положительным числом");
  process.exit(1);
}

const product = db
  .prepare(
    `
    SELECT id, name
    FROM products
    WHERE id = ?
  `,
  )
  .get(productId);

if (!product) {
  console.error(`Товар с id ${productId} не найден`);
  process.exit(1);
}

function getPeriodStart(hours) {
  const date = new Date();
  date.setHours(date.getHours() - hours);

  return date;
}

function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function parseTimestamp(timestamp) {
  return new Date(timestamp.replace(" ", "T"));
}

function floorTo15Minutes(date) {
  const result = new Date(date);

  result.setMinutes(Math.floor(result.getMinutes() / 15) * 15);
  result.setSeconds(0);
  result.setMilliseconds(0);

  return result;
}

const periodStartDate = getPeriodStart(hours);
const periodStart = formatTimestamp(periodStartDate);

const rows = db
  .prepare(
    `
    SELECT
      id,
      price,
      timestamp
    FROM price_history
    WHERE product_id = ?
      AND timestamp >= ?
    ORDER BY timestamp ASC, id ASC
  `,
  )
  .all(productId, periodStart);

if (rows.length === 0) {
  console.log(
    JSON.stringify(
      {
        product,
        period: {
          hours,
          period_start: periodStart,
        },
        measurements: 0,
        points: [],
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

/*
 * Группируем реальные измерения
 * по 15-минутным интервалам.
 *
 * Если в одном интервале несколько измерений,
 * сохраняем последнее.
 */
const measuredIntervals = new Map();

for (const row of rows) {
  const date = parseTimestamp(row.timestamp);
  const interval = floorTo15Minutes(date);
  const key = interval.getTime();

  measuredIntervals.set(key, {
    price: row.price,
    measured_at: row.timestamp,
  });
}

/*
 * Начало графика:
 * первый интервал, в котором есть
 * реальное измерение.
 */
const firstInterval = floorTo15Minutes(parseTimestamp(rows[0].timestamp));

/*
 * Конец графика:
 * интервал последнего реального измерения.
 *
 * Поэтому будущих точек нет.
 */
const lastInterval = floorTo15Minutes(
  parseTimestamp(rows[rows.length - 1].timestamp),
);

const points = [];

let lastKnownPrice = null;
let lastMeasuredAt = null;

for (
  let time = new Date(firstInterval);
  time <= lastInterval;
  time.setMinutes(time.getMinutes() + 15)
) {
  const key = time.getTime();

  const measured = measuredIntervals.get(key);

  if (measured) {
    lastKnownPrice = measured.price;
    lastMeasuredAt = measured.measured_at;
  }

  if (lastKnownPrice === null) {
    continue;
  }

  points.push({
    timestamp: formatTimestamp(time),
    price: lastKnownPrice,
    measured: Boolean(measured),
    measured_at: lastMeasuredAt,
  });
}

/*
 * Итоговая структура данных графика.
 */
const chartData = {
  product: {
    id: product.id,
    name: product.name,
  },

  period: {
    hours,
    period_start: periodStart,
    period_end: rows[rows.length - 1].timestamp,
  },

  measurements: {
    count: rows.length,
  },

  points,
};

/*
 * JSON для будущего frontend.
 */
console.log(JSON.stringify(chartData, null, 2));
