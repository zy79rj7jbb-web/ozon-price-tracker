const db = require("./database");

const [, , productId, name, targetPriceArg] = process.argv;

if (!productId || !name) {
  console.error(
    'Использование: node add-product.js <ozon_product_id> "<name>" [target_price]',
  );
  process.exit(1);
}

let targetPrice = null;

if (targetPriceArg !== undefined) {
  targetPrice = Number(targetPriceArg);

  if (!Number.isInteger(targetPrice) || targetPrice <= 0) {
    console.error("target_price должен быть положительным целым числом");
    process.exit(1);
  }
}

const result = db
  .prepare(
    `
    INSERT OR IGNORE INTO products (ozon_product_id, name, target_price)
    VALUES (?, ?, ?)
  `,
  )
  .run(productId, name, targetPrice);

const product = db
  .prepare(
    `
    SELECT *
    FROM products
    WHERE ozon_product_id = ?
  `,
  )
  .get(productId);

if (result.changes === 0) {
  console.log("Товар уже существует:");
} else {
  console.log("Товар добавлен:");
}

console.log(product);
