import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE orders (id INTEGER PRIMARY KEY, total INTEGER NOT NULL);
  CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), product TEXT NOT NULL, qty INTEGER NOT NULL);
  CREATE TABLE payments (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), amount INTEGER NOT NULL);

  INSERT INTO orders (id, total) VALUES (1, 30000), (2, 15000), (3, 20000);
  INSERT INTO order_items (order_id, product, qty) VALUES (1, 'Kopi Susu', 1), (1, 'Roti Bakar', 1), (2, 'Kopi Susu', 1), (3, 'Americano', 2);
  INSERT INTO payments (order_id, amount) VALUES (1, 30000), (2, 15000);
`);

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = createServer((req, res) => {
  if (req.url === '/api/report') {
    const row = db.prepare(`
      SELECT SUM(o.total) AS total, COUNT(o.id) AS orders
      FROM orders o
      WHERE EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id)
    `).get();
    return sendJson(res, 200, { total: row.total ?? 0, orders: row.orders });
  }
  sendJson(res, 404, { error: 'Gak ketemu.' });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
