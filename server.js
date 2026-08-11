const express = require("express");
const db = require("./database");

const app = express();
app.use(express.json());

const PORT = 3000;
/*
 * ----------------------------------------
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 * ----------------------------------------
 */

function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getPeriodStart(hours) {
  const date = new Date();

  date.setHours(date.getHours() - hours);

  return formatTimestamp(date);
}

function floorTo15Minutes(date) {
  const result = new Date(date);

  result.setMinutes(Math.floor(result.getMinutes() / 15) * 15);

  result.setSeconds(0);
  result.setMilliseconds(0);

  return result;
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

/*
 * ----------------------------------------
 * ПОЛУЧЕНИЕ ТОВАРА
 * ----------------------------------------
 */

function getProduct(productId) {
  return db
    .prepare(
      `
        SELECT
          id,
          ozon_product_id,
          name,
          is_active,
          target_price,
          target_triggered,
          created_at
        FROM products
        WHERE id = ?
      `,
    )
    .get(productId);
}

/*
 * ----------------------------------------
 * ТЕКУЩАЯ ЦЕНА
 * ----------------------------------------
 */

function getCurrentPrice(productId) {
  return db
    .prepare(
      `
        SELECT
          price,
          timestamp
        FROM price_history
        WHERE product_id = ?
        ORDER BY timestamp DESC, id DESC
        LIMIT 1
      `,
    )
    .get(productId);
}

function getLatestChange(productId) {
  const rows = db
    .prepare(
      `
        SELECT
          price,
          timestamp
        FROM price_history
        WHERE product_id = ?
        ORDER BY timestamp DESC, id DESC
        LIMIT 2
      `,
    )
    .all(productId);

  const current = rows[0] ?? null;
  const previous = rows[1] ?? null;

  const change = calculateChange(
    previous?.price ?? null,
    current?.price ?? null,
  );

  return {
    current: {
      price: current?.price ?? null,
      timestamp: current?.timestamp ?? null,
    },

    change: {
      difference: change.difference,
      percent: change.percent,
    },
  };
}

/*
 * ----------------------------------------
 * СТАТИСТИКА ПЕРИОДА
 * ----------------------------------------
 */

function getPeriodStats(productId, hours, currentPrice) {
  const periodStart = getPeriodStart(hours);

  const stats = db
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

  const firstHistoryPoint = db
    .prepare(
      `
        SELECT
          price,
          timestamp
        FROM price_history
        WHERE product_id = ?
        ORDER BY timestamp ASC, id ASC
        LIMIT 1
      `,
    )
    .get(productId);

  const firstPointInPeriod = db
    .prepare(
      `
        SELECT
          price,
          timestamp
        FROM price_history
        WHERE product_id = ?
          AND timestamp >= ?
        ORDER BY timestamp ASC, id ASC
        LIMIT 1
      `,
    )
    .get(productId, periodStart);

  const baselinePoint = db
    .prepare(
      `
        SELECT
          price,
          timestamp
        FROM price_history
        WHERE product_id = ?
          AND timestamp <= ?
        ORDER BY timestamp DESC, id DESC
        LIMIT 1
      `,
    )
    .get(productId, periodStart);

  const minPoint = db
    .prepare(
      `
        SELECT
          price,
          timestamp
        FROM price_history
        WHERE product_id = ?
          AND timestamp >= ?
        ORDER BY price ASC, timestamp ASC, id ASC
        LIMIT 1
      `,
    )
    .get(productId, periodStart);

  const maxPoint = db
    .prepare(
      `
        SELECT
          price,
          timestamp
        FROM price_history
        WHERE product_id = ?
          AND timestamp >= ?
        ORDER BY price DESC, timestamp ASC, id ASC
        LIMIT 1
      `,
    )
    .get(productId, periodStart);

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

  if (historyStatus === "full") {
    firstPrice = baselinePoint?.price ?? null;
    firstTimestamp = baselinePoint?.timestamp ?? null;
  }

  if (historyStatus === "partial") {
    firstPrice = firstPointInPeriod?.price ?? null;
    firstTimestamp = firstPointInPeriod?.timestamp ?? null;
  }

  const change = calculateChange(firstPrice, currentPrice);

  return {
    period_start: periodStart,
    history_status: historyStatus,

    measurements: stats.measurements,

    first_price: firstPrice,
    first_timestamp: firstTimestamp,

    current_price: currentPrice,

    min_price: stats.min_price,
    min_timestamp: minPoint?.timestamp ?? null,

    max_price: stats.max_price,
    max_timestamp: maxPoint?.timestamp ?? null,

    average_price: stats.average_price,

    change: change.difference,
    change_percent: change.percent,
  };
}

/*
 * ----------------------------------------
 * ДАННЫЕ ГРАФИКА
 * ----------------------------------------
 */

function getChartData(productId, hours) {
  const periodStartDate = new Date();

  periodStartDate.setHours(periodStartDate.getHours() - hours);

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

  if (!rows.length) {
    return {
      interval_minutes: 15,
      measurements: 0,
      points: [],
    };
  }

  const measuredIntervals = new Map();

  for (const row of rows) {
    const date = new Date(row.timestamp.replace(" ", "T"));

    const interval = floorTo15Minutes(date);

    measuredIntervals.set(interval.getTime(), {
      price: row.price,
      measured_at: row.timestamp,
    });
  }

  let lastKnownPrice = null;
  let lastMeasuredAt = null;

  const firstInterval = floorTo15Minutes(
    new Date(rows[0].timestamp.replace(" ", "T")),
  );

  const lastInterval = floorTo15Minutes(
    new Date(rows[rows.length - 1].timestamp.replace(" ", "T")),
  );

  const points = [];

  for (
    let time = new Date(firstInterval);
    time <= lastInterval;
    time.setMinutes(time.getMinutes() + 15)
  ) {
    const measured = measuredIntervals.get(time.getTime());

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

  return {
    interval_minutes: 15,
    measurements: rows.length,
    points,
  };
}

/*
 * ----------------------------------------
 * ОБЩИЕ ДАННЫЕ ТОВАРА
 * ----------------------------------------
 */

function getProductData(productId, chartHours = 24) {
  const product = getProduct(productId);

  if (!product) {
    return null;
  }

  const current = getCurrentPrice(productId);

  const currentPrice = current?.price ?? null;

  const allTime = db
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

  return {
    product,

    current: {
      price: currentPrice,
      timestamp: current?.timestamp ?? null,
    },

    all_time: {
      measurements: allTime.measurements,
      min_price: allTime.min_price,
      max_price: allTime.max_price,
      average_price: allTime.average_price,
      first_timestamp: allTime.first_timestamp,
      last_timestamp: allTime.last_timestamp,
    },

    periods: {
      "24h": getPeriodStats(productId, 24, currentPrice),

      "7d": getPeriodStats(productId, 24 * 7, currentPrice),

      "30d": getPeriodStats(productId, 24 * 30, currentPrice),
    },

    chart: getChartData(productId, chartHours),

    target: {
      price: product.target_price,
      triggered: Boolean(product.target_triggered),
    },
  };
}

/*
 * ----------------------------------------
 * API
 * ----------------------------------------
 */

app.get("/api/products", (req, res) => {
  const products = db
    .prepare(
      `
        SELECT
          id,
          ozon_product_id,
          name,
          is_active,
          target_price,
          target_triggered,
          created_at
        FROM products
        ORDER BY id
      `,
    )
    .all();

  const productsWithData = products.map((product) => {
    const data = getLatestChange(product.id);

    return {
      ...product,
      current: data.current,
      change: data.change,
    };
  });

  res.json({
    products: productsWithData,
  });
});

app.get("/api/products/:id", (req, res) => {
  const productId = Number(req.params.id);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({
      error: "Некорректный product_id",
    });
  }

  const chartHours = req.query.hours ? Number(req.query.hours) : 24;

  if (!Number.isFinite(chartHours) || chartHours <= 0) {
    return res.status(400).json({
      error: "hours должен быть положительным числом",
    });
  }

  const data = getProductData(productId, chartHours);

  if (!data) {
    return res.status(404).json({
      error: `Товар с id ${productId} не найден`,
    });
  }

  res.json(data);
});

app.put("/api/products/:id/target-price", (req, res) => {
  const productId = Number(req.params.id);
  const { targetPrice } = req.body;

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({
      error: "product_id должен быть положительным целым числом",
    });
  }

  if (
    targetPrice !== null &&
    (!Number.isInteger(targetPrice) || targetPrice <= 0)
  ) {
    return res.status(400).json({
      error: "targetPrice должен быть положительным целым числом или null",
    });
  }

  const result = db
    .prepare(
      `
      UPDATE products
      SET target_price = ?,
          target_triggered = 0
      WHERE id = ?
      `,
    )
    .run(targetPrice, productId);

  if (result.changes === 0) {
    return res.status(404).json({
      error: `Товар с id ${productId} не найден`,
    });
  }

  const product = db
    .prepare(
      `
      SELECT *
      FROM products
      WHERE id = ?
      `,
    )
    .get(productId);

  res.json({
    success: true,
    product,
  });
});

/*
 * ----------------------------------------
 * ЗАПУСК
 * ----------------------------------------
 */

app.listen(PORT, () => {
  console.log(`API server запущен: http://localhost:${PORT}`);
});
