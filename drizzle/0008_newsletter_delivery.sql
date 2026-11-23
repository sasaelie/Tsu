CREATE TABLE newsletter_deliveries (
  product_id TEXT NOT NULL, customer_id TEXT NOT NULL REFERENCES customers(id),
  created_at INTEGER NOT NULL, sent_at INTEGER,
  PRIMARY KEY (product_id,customer_id)
);
