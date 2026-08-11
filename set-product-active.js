const db = require("./database");

const [, , productIdArg, activeArg] = process.argv;

if (!productIdArg || activeArg === undefined) {
  console.error("Использование: node set-product-active.js <product_id> <0|1>");
  process.exit(1);
}

const productId = Number(productIdArg);

if (!Number.isInteger(productId) || productId <= 0) {
  console.error("product_id должен быть положительным целым числом");
  process.exit(1);
}

const isActive = Number(activeArg);

if (isActive !== 0 && isActive !== 1) {
  console.error("is_active должен быть 0 или 1");
  process.exit(1);
}

const result = db
  .prepare(
    `
    UPDATE products
    SET is_active = ?
    WHERE id = ?
  `,
  )
  .run(isActive, productId);

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

console.log("Статус товара обновлён:");
console.log(product);
