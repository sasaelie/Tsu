CREATE TABLE IF NOT EXISTS tsu_owner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  subject TEXT NOT NULL,
  email TEXT NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  retry_after INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tsu_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tsu_sessions_expiry ON tsu_sessions (expires_at);
