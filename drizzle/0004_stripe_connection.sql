CREATE TABLE IF NOT EXISTS stripe_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  encrypted_key TEXT NOT NULL,
  nonce TEXT NOT NULL
);
