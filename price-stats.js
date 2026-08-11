const db = require("./database");

const [, , productIdArg] = process.argv;

if (!productIdArg) {
  console.error("Использование: node price-stats.js <product_id>");
  process.exit(1);
}

const productId = Number(productIdArg);

if (!Number.isInteger(productId) || productId <= 0) {
  console.error("product_id должен быть положительным целым числом");
  process.exit(1);
}

const product = db
  .prepare(
    `
    SELECT id, name, target_price
    FROM products
    WHERE id = ?
  `,
  )
  .get(productId);

if (!product) {
  console.error(`Товар с id ${productId} не найден`);
  process.exit(1);
}

const current = db
  .prepare(
    `
    SELECT price, timestamp
    FROM price_history
    WHERE product_id = ?
    ORDER BY timestamp DESC, id DESC
    LIMIT 1
  `,
  )
  .get(productId);

const totalStats = db
  .prepare(
    `
    SELECT
      COUNT(*) AS measurements,
      MIN(price) AS min_price,
      MAX(price) AS max_price,
      ROUND(AVG(price), 2) AS average_price,
      MIN(timestamp) AS first_timestamp,
      MAX(timestamp) AS last_timestamp
    FROM price_history
    WHERE product_id = ?
  `,
  )
  .get(productId);

function getPeriodStart(hours) {
  const date = new Date();
  date.setHours(date.getHours() - hours);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getPeriodStats(productId, periodStart) {
  return db
    .prepare(
      `
      SELECT
        COUNT(*) AS measurements,
        MIN(price) AS min_price,
        MAX(price) AS max_price,
        ROUND(AVG(price), 2) AS average_price
      FROM price_history
      WHERE product_id = ?
        AND timestamp >= ?
    `,
    )
    .get(productId, periodStart);
}

function getMinPricePoint(productId, periodStart) {
  return db
    .prepare(
      `
      SELECT price, timestamp
      FROM price_history
      WHERE product_id = ?
        AND timestamp >= ?
      ORDER BY price ASC, timestamp ASC, id ASC
      LIMIT 1
    `,
    )
    .get(productId, periodStart);
}

function getMaxPricePoint(productId, periodStart) {
  return db
    .prepare(
      `
      SELECT price, timestamp
      FROM price_history
      WHERE product_id = ?
        AND timestamp >= ?
      ORDER BY price DESC, timestamp ASC, id ASC
      LIMIT 1
    `,
    )
    .get(productId, periodStart);
}

function getFirstHistoryPoint(productId) {
  return db
    .prepare(
      `
      SELECT price, timestamp
      FROM price_history
      WHERE product_id = ?
      ORDER BY timestamp ASC, id ASC
      LIMIT 1
    `,
    )
    .get(productId);
}

function getFirstPointInPeriod(productId, periodStart) {
  return db
    .prepare(
      `
      SELECT price, timestamp
      FROM price_history
      WHERE product_id = ?
        AND timestamp >= ?
      ORDER BY timestamp ASC, id ASC
      LIMIT 1
    `,
    )
    .get(productId, periodStart);
}

function getBaselinePoint(productId, periodStart) {
  return db
    .prepare(
      `
      SELECT price, timestamp
      FROM price_history
      WHERE product_id = ?
        AND timestamp <= ?
      ORDER BY timestamp DESC, id DESC
      LIMIT 1
    `,
    )
    .get(productId, periodStart);
}

function calculateChange(startPrice, currentPrice) {
  if (startPrice === null || currentPrice === null) {
    return {
      difference: null,
      percent: null,
    };
  }

  const difference = currentPrice - startPrice;

  const percent = startPrice === 0 ? null : (difference / startPrice) * 100;

  return {
    difference,
    percent: percent === null ? null : Number(percent.toFixed(2)),
  };
}

function buildPeriodStats(productId, hours, currentPrice) {
  const periodStart = getPeriodStart(hours);

  const stats = getPeriodStats(productId, periodStart);

  const min = getMinPricePoint(productId, periodStart);
  const max = getMaxPricePoint(productId, periodStart);

  const firstHistoryPoint = getFirstHistoryPoint(productId);
  const firstPointInPeriod = getFirstPointInPeriod(productId, periodStart);
  const baselinePoint = getBaselinePoint(productId, periodStart);

  let historyStatus = "none";

  if (stats.measurements > 0) {
    if (firstHistoryPoint && firstHistoryPoint.timestamp <= periodStart) {
      historyStatus = "full";
    } else {
      historyStatus = "partial";
    }
  }

  let firstPrice = null;
  let firstTimestamp = null;
  let change = null;
  let changePercent = null;

  if (historyStatus === "full") {
    firstPrice = baselinePoint?.price ?? null;
    firstTimestamp = baselinePoint?.timestamp ?? null;
  }

  if (historyStatus === "partial") {
    firstPrice = firstPointInPeriod?.price ?? null;
    firstTimestamp = firstPointInPeriod?.timestamp ?? null;
  }

  if (historyStatus !== "none") {
    const calculatedChange = calculateChange(firstPrice, currentPrice);

    change = calculatedChange.difference;
    changePercent = calculatedChange.percent;
  }

  return {
    period_start: periodStart,

    history_status: historyStatus,

    measurements: stats.measurements,

    first_price: firstPrice,
    first_timestamp: firstTimestamp,

    current_price: currentPrice ?? null,

    min_price: stats.min_price,
    min_timestamp: min?.timestamp ?? null,

    max_price: stats.max_price,
    max_timestamp: max?.timestamp ?? null,

    average_price: stats.average_price,

    change,
    change_percent: changePercent,
  };
}

const currentPrice = current?.price ?? null;

const stats24h = buildPeriodStats(productId, 24, currentPrice);

const stats7d = buildPeriodStats(productId, 24 * 7, currentPrice);

const stats30d = buildPeriodStats(productId, 24 * 30, currentPrice);

console.log("Товар:");
console.log(product);

console.log("\nТекущая цена:");
console.log({
  price: currentPrice,
  timestamp: current?.timestamp ?? null,
});

console.log("\nСтатистика за всю историю:");
console.log({
  measurements: totalStats.measurements,
  min_price: totalStats.min_price,
  max_price: totalStats.max_price,
  average_price: totalStats.average_price,
  first_timestamp: totalStats.first_timestamp,
  last_timestamp: totalStats.last_timestamp,
});

console.log("\nСтатистика за 24 часа:");
console.log(stats24h);

console.log("\nСтатистика за 7 дней:");
console.log(stats7d);

console.log("\nСтатистика за 30 дней:");
console.log(stats30d);

console.log("\nЦелевая цена:");
console.log({
  target_price: product.target_price,
});
