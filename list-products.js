const db = require("./database");

const products = db
  .prepare(
    `
    SELECT
      p.id,
      p.ozon_product_id,
      p.name,
      p.is_active,
      p.target_price,
      p.target_triggered,
      ph.price AS current_price,
      ph.timestamp AS last_timestamp
    FROM products p
    LEFT JOIN price_history ph
      ON ph.id = (
        SELECT id
        FROM price_history
        WHERE product_id = p.id
        ORDER BY timestamp DESC, id DESC
        LIMIT 1
      )
    ORDER BY p.id
  `,
  )
  .all();

if (products.length === 0) {
  console.log("Товаров нет.");
  process.exit(0);
}

console.table(
  products.map((product) => ({
    ID: product.id,
    "Ozon ID": product.ozon_product_id,
    Название: product.name,
    Цена: product.current_price ?? "—",
    Цель: product.target_price ?? "—",
    Статус: product.is_active ? "Активен" : "Отключён",
    Порог: product.target_triggered ? "Достигнут" : "—",
    "Последняя проверка": product.last_timestamp ?? "—",
  })),
);
