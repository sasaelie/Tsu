CREATE TABLE IF NOT EXISTS printful_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  encrypted_token TEXT NOT NULL,
  nonce TEXT NOT NULL,
  store_name TEXT NOT NULL
);
