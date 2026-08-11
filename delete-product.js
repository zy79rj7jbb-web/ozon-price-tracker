const db = require("./database");

const productId = Number(process.argv[2]);

if (!Number.isInteger(productId)) {
  console.error("Использование: node delete-product.js <id>");
  process.exit(1);
}

const product = db
  .prepare(
    `
    SELECT id, name, ozon_product_id
    FROM products
    WHERE id = ?
  `,
  )
  .get(productId);

if (!product) {
  console.error(`Товар с ID ${productId} не найден.`);
  process.exit(1);
}

const history = db
  .prepare(
    `
    SELECT COUNT(*) AS count
    FROM price_history
    WHERE product_id = ?
  `,
  )
  .get(productId);

console.log("Будет удалён товар:");
console.log(product);
console.log(`Записей истории: ${history.count}`);

const result = db
  .prepare(
    `
    DELETE FROM products
    WHERE id = ?
  `,
  )
  .run(productId);

console.log(`Удалено товаров: ${result.changes}`);
