CREATE TABLE editorial_ai_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  encrypted_key TEXT NOT NULL,
  nonce TEXT NOT NULL,
  model TEXT NOT NULL
);

CREATE TABLE journal_articles (
  slug TEXT PRIMARY KEY,
  draft TEXT NOT NULL,
  published TEXT,
  published_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
