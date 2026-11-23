CREATE TABLE customers (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL,
  password_hash TEXT NOT NULL, verified_at INTEGER, newsletter_at INTEGER
);
CREATE TABLE customer_sessions (
  token_hash TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX customer_sessions_expiry ON customer_sessions(expires_at);
CREATE TABLE customer_attempts (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX customer_attempts_expiry ON customer_attempts(expires_at);
CREATE TABLE customer_email_tokens (
  token_hash TEXT PRIMARY KEY, customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
ALTER TABLE shop_orders ADD COLUMN customer_id TEXT REFERENCES customers(id);
CREATE INDEX shop_orders_customer ON shop_orders(customer_id,created_at);
CREATE TABLE support_tickets (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), order_id TEXT REFERENCES shop_orders(id),
  subject TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX support_tickets_customer ON support_tickets(customer_id,updated_at);
CREATE TABLE support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT NOT NULL REFERENCES support_tickets(id),
  sender TEXT NOT NULL CHECK (sender IN ('customer','shop')), message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX support_messages_ticket ON support_messages(ticket_id,id);
