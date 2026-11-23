CREATE TABLE journal_editions (
  week TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);
CREATE INDEX journal_editions_published ON journal_editions(published_at,week);
