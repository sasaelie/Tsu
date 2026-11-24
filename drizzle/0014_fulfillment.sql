CREATE TABLE fulfillment_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1))
);
ALTER TABLE shop_orders ADD COLUMN sync_token TEXT;
ALTER TABLE shop_orders ADD COLUMN sync_expires INTEGER NOT NULL DEFAULT 0;
