const { chromium } = require("playwright");

const db = require("./database");

const CDP_URL = "http://127.0.0.1:9222";

// const PRODUCT_ID = "2190743588";

// const API_URL = `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=/product/${PRODUCT_ID}/`;

function formatTimestamp(date = new Date()) {
  return date.toLocaleString("sv-SE");
}

function extractCardPrice(body) {
  const match = body.match(/\\"cardPrice\\"\s*:\s*\\"([^"]+)\\"/);

  if (!match) {
    return null;
  }

  return Number(match[1].replace(/[^\d]/g, ""));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkPrice(context, product) {
  const apiUrl = `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=/product/${product.ozon_product_id}/`;

  const maxAttempts = 3;
  const retryDelays = [2000, 5000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await context.request.get(apiUrl, {
        headers: {
          Referer: `https://www.ozon.ru/product/${product.ozon_product_id}/`,
        },
      });

      const status = response.status();

      console.log(
        `HTTP: ${status} | ${product.name} | попытка ${attempt}/${maxAttempts}`,
      );

      if (status === 429 || status >= 500) {
        if (attempt === maxAttempts) {
          throw new Error(`HTTP ${status} после ${maxAttempts} попыток`);
        }

        console.log(
          `Временная ошибка HTTP ${status}. Повтор через ${
            retryDelays[attempt - 1]
          } мс`,
        );

        await delay(retryDelays[attempt - 1]);
        continue;
      }

      if (!response.ok()) {
        throw new Error(`HTTP ${status}`);
      }

      const body = await response.text();

      const price = extractCardPrice(body);

      if (price === null) {
        throw new Error("cardPrice not found");
      }

      return price;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      console.log(
        `Ошибка запроса: ${error.message}. Повтор через ${
          retryDelays[attempt - 1]
        } мс`,
      );

      await delay(retryDelays[attempt - 1]);
    }
  }

  throw new Error("Не удалось получить цену");
}

function getActiveProducts() {
  return db
    .prepare(
      `
      SELECT *
      FROM products
      WHERE is_active = 1
      ORDER BY id
    `,
    )
    .all();
}
function savePrice(product, price) {
  const previous = db
    .prepare(
      `
      SELECT price
      FROM price_history
      WHERE product_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    )
    .get(product.id);

  db.prepare(
    `
    INSERT INTO price_history (product_id, price, timestamp)
    VALUES (?, ?, ?)
  `,
  ).run(product.id, price, formatTimestamp());

  if (!previous || previous.price === price) {
    return false;
  }

  const difference = price - previous.price;
  const percent = (difference / previous.price) * 100;

  const sign = difference > 0 ? "+" : "";

  console.log(
    `Цена изменилась: ${previous.price} ₽ → ${price} ₽ (${sign}${difference} ₽ / ${sign}${percent.toFixed(2)}%)`,
  );

  return true;
}

function checkTargetPrice(product, price) {
  if (product.target_price === null) {
    return;
  }

  if (price <= product.target_price) {
    if (product.target_triggered === 0) {
      db.prepare(
        `
        UPDATE products
        SET target_triggered = 1
        WHERE id = ?
      `,
      ).run(product.id);

      console.log(
        `Цена достигла порога: ${product.name} | текущая: ${price} ₽ | порог: ${product.target_price} ₽`,
      );
    }

    return;
  }

  if (product.target_triggered === 1) {
    db.prepare(
      `
      UPDATE products
      SET target_triggered = 0
      WHERE id = ?
    `,
    ).run(product.id);

    console.log(
      `Цена снова выше порога: ${product.name} | текущая: ${price} ₽ | порог: ${product.target_price} ₽`,
    );
  }
}

async function checkAllProducts(context) {
  const products = getActiveProducts();

  if (!products.length) {
    console.log("Активные товары не найдены");
    return;
  }

  const startTime = Date.now();

  let successful = 0;
  let errors = 0;
  let priceChanges = 0;
  let targetsReached = 0;

  console.log(`Найдено товаров: ${products.length}`);
  console.log("Начинаем проверку...\n");

  for (const product of products) {
    try {
      const price = await checkPrice(context, product);

      const priceChanged = savePrice(product, price);

      if (priceChanged) {
        priceChanges++;
      }

      const targetWasReached =
        product.target_price !== null &&
        product.target_triggered === 0 &&
        price <= product.target_price;

      checkTargetPrice(product, price);

      if (targetWasReached) {
        targetsReached++;
      }

      successful++;

      console.log(`[${formatTimestamp()}] ${product.name}: ${price} ₽`);
    } catch (error) {
      errors++;

      console.error(
        `Ошибка проверки товара ${product.ozon_product_id}:`,
        error.message,
      );
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n===== Результат проверки =====");
  console.log(`Всего товаров:       ${products.length}`);
  console.log(`Успешно:             ${successful}`);
  console.log(`Ошибок:              ${errors}`);
  console.log(`Изменений цены:      ${priceChanges}`);
  console.log(`Достигнуто целей:    ${targetsReached}`);
  console.log(`Время цикла:         ${duration} сек`);
  console.log("==============================\n");
}
async function main() {
  console.log("Подключаемся к Chrome...");

  const browser = await chromium.connectOverCDP(CDP_URL);

  const contexts = browser.contexts();

  if (!contexts.length) {
    throw new Error("Chrome context not found");
  }

  const context = contexts[0];

  console.log("Chrome connected");
  console.log("Context ready");

  while (true) {
    try {
      await checkAllProducts(context);
    } catch (error) {
      console.error("Ошибка проверки товаров:", error.message);
    }

    console.log("Следующая проверка через 15 минут...");

    await delay(15 * 60 * 1000);
  }
}
main().catch(console.error);
