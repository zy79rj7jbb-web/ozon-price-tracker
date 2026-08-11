const db = require("./database");

const [, , productIdArg, targetPriceArg] = process.argv;

if (!productIdArg || targetPriceArg === undefined) {
  console.error(
    "Использование: node set-target-price.js <product_id> <target_price|null>",
  );
  process.exit(1);
}

const productId = Number(productIdArg);

if (!Number.isInteger(productId) || productId <= 0) {
  console.error("product_id должен быть положительным целым числом");
  process.exit(1);
}

let targetPrice = null;

if (targetPriceArg !== "null") {
  targetPrice = Number(targetPriceArg);

  if (!Number.isInteger(targetPrice) || targetPrice <= 0) {
    console.error(
      "target_price должен быть положительным целым числом или null",
    );
    process.exit(1);
  }
}

const result = db
  .prepare(
    `
    UPDATE products
    SET target_price = ?
    WHERE id = ?
  `,
  )
  .run(targetPrice, productId);

if (result.changes === 0) {
  console.error(`Товар с id ${productId} не найден`);
  process.exit(1);
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

console.log("Порог цены обновлён:");
console.log(product);
