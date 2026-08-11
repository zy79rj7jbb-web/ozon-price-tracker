const db = require("./database");

const [, , target] = process.argv;

if (!target) {
  console.error("Не указан режим очистки.");
  console.error("");
  console.error("Очистить историю всех товаров:");
  console.error("  node clear-history.js all");
  console.error("");
  console.error("Очистить историю одного товара:");
  console.error("  node clear-history.js <product_id>");
  process.exit(1);
}

if (target === "all") {
  const result = db
    .prepare(
      `
      DELETE FROM price_history
    `,
    )
    .run();

  console.log(
    `История всех товаров очищена. Удалено записей: ${result.changes}`,
  );
  process.exit(0);
}

const productId = Number(target);

if (!Number.isInteger(productId) || productId <= 0) {
  console.error('Ошибка: укажите "all" или корректный product_id.');
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
  console.error(`Товар с id ${productId} не найден.`);
  process.exit(1);
}

const result = db
  .prepare(
    `
    DELETE FROM price_history
    WHERE product_id = ?
  `,
  )
  .run(productId);

console.log(
  `История товара "${product.name}" очищена. Удалено записей: ${result.changes}`,
);
