const db = require("./database");

const column = db
  .prepare(
    `
    SELECT name
    FROM pragma_table_info('products')
    WHERE name = 'target_triggered'
  `,
  )
  .get();

if (column) {
  console.log("Колонка target_triggered уже существует");
  process.exit(0);
}

db.prepare(
  `
  ALTER TABLE products
  ADD COLUMN target_triggered INTEGER NOT NULL DEFAULT 0
`,
).run();

console.log("Колонка target_triggered добавлена");
