const db = require("./database");

const productId = Number(process.argv[2]);

if (!productId) {
  console.error("Использование: node price-history.js <product_id>");
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

const history = db
  .prepare(
    `
    SELECT price, timestamp
    FROM price_history
    WHERE product_id = ?
    ORDER BY timestamp
  `,
  )
  .all(productId);

console.log("Товар:");
console.log(product);

console.log("\nИстория цены:");

if (!history.length) {
  console.log("История отсутствует");
  process.exit(0);
}

for (const record of history) {
  console.log(`${record.timestamp} — ${record.price} ₽`);
}

console.log(`\nИзмерений: ${history.length}`);
