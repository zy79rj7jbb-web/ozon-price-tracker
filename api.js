const http = require("http");

const db = require("./database");

const PORT = 3000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });

  res.end(JSON.stringify(data, null, 2));
}

function getProducts() {
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
      ORDER BY id
    `,
    )
    .all();
}

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
}

function getMaxPricePoint(productId, periodStart) {
  return db
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
}

function getFirstHistoryPoint(productId) {
  return db
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
}

function getFirstPointInPeriod(productId, periodStart) {
  return db
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
}

function getBaselinePoint(productId, periodStart) {
  return db
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

  if (historyStatus === "full") {
    firstPrice = baselinePoint?.price ?? null;
    firstTimestamp = baselinePoint?.timestamp ?? null;
  }

  if (historyStatus === "partial") {
    firstPrice = firstPointInPeriod?.price ?? null;
    firstTimestamp = firstPointInPeriod?.timestamp ?? null;
  }

  let change = null;
  let changePercent = null;

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

function getAllTimeStats(productId) {
  return db
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
}

function floorTo15Minutes(date) {
  const result = new Date(date);

  result.setMinutes(Math.floor(result.getMinutes() / 15) * 15);

  result.setSeconds(0);
  result.setMilliseconds(0);

  return result;
}

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

  if (rows.length === 0) {
    return {
      period: {
        hours,
        period_start: periodStart,
        period_end: null,
      },
      measurements: {
        count: 0,
      },
      points: [],
    };
  }

  const measuredIntervals = new Map();

  for (const row of rows) {
    const date = new Date(row.timestamp.replace(" ", "T"));

    const interval = floorTo15Minutes(date);

    const key = interval.getTime();

    measuredIntervals.set(key, {
      price: row.price,
      measured_at: row.timestamp,
    });
  }

  let lastKnownPrice = null;
  let lastMeasuredAt = null;

  const firstInterval = floorTo15Minutes(
    new Date(rows[0].timestamp.replace(" ", "T")),
  );

  const lastMeasurement = rows[rows.length - 1];

  const lastInterval = floorTo15Minutes(
    new Date(lastMeasurement.timestamp.replace(" ", "T")),
  );

  const points = [];

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

  return {
    period: {
      hours,
      period_start: periodStart,
      period_end: lastMeasurement.timestamp,
    },

    measurements: {
      count: rows.length,
    },

    points,
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    /*
     * GET /api/products
     */
    if (req.method === "GET" && url.pathname === "/api/products") {
      return sendJson(res, 200, {
        products: getProducts(),
      });
    }

    /*
     * GET /api/products/:id
     */
    const productMatch = url.pathname.match(/^\/api\/products\/(\d+)$/);

    if (req.method === "GET" && productMatch) {
      const productId = Number(productMatch[1]);

      const product = getProduct(productId);

      if (!product) {
        return sendJson(res, 404, {
          error: "Товар не найден",
        });
      }

      const current = getCurrentPrice(productId);

      return sendJson(res, 200, {
        product,

        current_price: current?.price ?? null,

        current_timestamp: current?.timestamp ?? null,
      });
    }

    /*
     * GET /api/products/:id/stats
     */
    const statsMatch = url.pathname.match(/^\/api\/products\/(\d+)\/stats$/);

    if (req.method === "GET" && statsMatch) {
      const productId = Number(statsMatch[1]);

      const product = getProduct(productId);

      if (!product) {
        return sendJson(res, 404, {
          error: "Товар не найден",
        });
      }

      const current = getCurrentPrice(productId);

      const currentPrice = current?.price ?? null;

      const allTime = getAllTimeStats(productId);

      const stats24h = buildPeriodStats(productId, 24, currentPrice);

      const stats7d = buildPeriodStats(productId, 24 * 7, currentPrice);

      const stats30d = buildPeriodStats(productId, 24 * 30, currentPrice);

      return sendJson(res, 200, {
        product,

        current: {
          price: currentPrice,
          timestamp: current?.timestamp ?? null,
        },

        all_time: allTime,

        periods: {
          "24h": stats24h,
          "7d": stats7d,
          "30d": stats30d,
        },

        target: {
          price: product.target_price,
          triggered: Boolean(product.target_triggered),
        },
      });
    }

    /*
     * GET /api/products/:id/chart?hours=24
     */
    const chartMatch = url.pathname.match(/^\/api\/products\/(\d+)\/chart$/);

    if (req.method === "GET" && chartMatch) {
      const productId = Number(chartMatch[1]);

      const product = getProduct(productId);

      if (!product) {
        return sendJson(res, 404, {
          error: "Товар не найден",
        });
      }

      const hoursArg = url.searchParams.get("hours");

      const hours = hoursArg ? Number(hoursArg) : 24;

      if (!Number.isFinite(hours) || hours <= 0) {
        return sendJson(res, 400, {
          error: "Параметр hours должен быть положительным числом",
        });
      }

      const chart = getChartData(productId, hours);

      return sendJson(res, 200, {
        product: {
          id: product.id,
          name: product.name,
        },

        ...chart,
      });
    }

    return sendJson(res, 404, {
      error: "Маршрут не найден",
    });
  } catch (error) {
    console.error(error);

    return sendJson(res, 500, {
      error: "Внутренняя ошибка сервера",
      message: error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`API сервер запущен: http://localhost:${PORT}`);
});
