CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  order_ref TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  items TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('fr','en')),
  received_at INTEGER NOT NULL,
  attempted_at INTEGER,
  acknowledged_at INTEGER
);
CREATE INDEX IF NOT EXISTS withdrawals_received ON withdrawals(received_at DESC, id);
