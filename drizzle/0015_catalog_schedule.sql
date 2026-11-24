CREATE TABLE IF NOT EXISTS printful_catalog_job (
  id INTEGER PRIMARY KEY CHECK (id=1),
  next_offset INTEGER NOT NULL DEFAULT 0 CHECK (next_offset>=0),
  lease_id TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER,
  last_success_at INTEGER,
  last_complete_at INTEGER,
  cycle_failed INTEGER NOT NULL DEFAULT 0,
  last_complete_failed INTEGER,
  last_status TEXT
);
INSERT INTO printful_catalog_job (id) VALUES (1) ON CONFLICT(id) DO NOTHING;
