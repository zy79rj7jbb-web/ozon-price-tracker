const db = require("./database");

const [, , productIdArg] = process.argv;

if (!productIdArg) {
  console.error("Использование: node price-change.js <product_id>");
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

const prices = db
  .prepare(
    `
    SELECT price, timestamp
    FROM price_history
    WHERE product_id = ?
    ORDER BY id DESC
    LIMIT 2
  `,
  )
  .all(productId);

if (prices.length < 2) {
  console.log("Недостаточно данных для сравнения.");
  process.exit(0);
}

const current = prices[0];
const previous = prices[1];

const difference = current.price - previous.price;

const percent = (difference / previous.price) * 100;

console.log("Товар:");
console.log(product);

console.log("\nИзменение цены:");
console.log({
  previous_price: previous.price,
  previous_timestamp: previous.timestamp,
  current_price: current.price,
  current_timestamp: current.timestamp,
  difference,
  percent: Number(percent.toFixed(2)),
});
