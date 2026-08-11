const db = require("./database");

const index = db
  .prepare(
    `
    SELECT name
    FROM sqlite_master
    WHERE type = 'index'
      AND name = 'idx_price_history_product_id'
  `,
  )
  .get();

if (index) {
  console.log("Индекс idx_price_history_product_id уже существует");
  process.exit(0);
}

db.prepare(
  `
  CREATE INDEX idx_price_history_product_id
  ON price_history(product_id)
`,
).run();

console.log("Индекс idx_price_history_product_id добавлен");
