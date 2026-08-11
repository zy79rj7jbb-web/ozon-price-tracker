const db = require("./database");

db.exec(`
  ALTER TABLE products
  ADD COLUMN target_price INTEGER
`);

console.log("Колонка target_price добавлена");
