CREATE TABLE password_recovery (
  scope TEXT NOT NULL CHECK (scope IN ('customer','owner')),
  account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (scope, account_id)
);

CREATE TRIGGER customer_password_changed AFTER UPDATE OF password_hash ON customers
BEGIN
  DELETE FROM customer_sessions WHERE customer_id = NEW.id;
  DELETE FROM password_recovery WHERE scope='customer' AND account_id=NEW.id;
END;

CREATE TRIGGER owner_password_changed AFTER UPDATE OF password_hash ON tsu_owner
BEGIN
  DELETE FROM tsu_sessions;
  DELETE FROM password_recovery WHERE scope='owner' AND account_id=NEW.subject;
END;
