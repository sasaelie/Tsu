-- Provisional rates for the private Stripe Checkout preview.
INSERT INTO shop_profile (id, data)
VALUES (1, '{"shippingPreview":true,"shipping":{"BE":{"fee":499,"min":7,"max":25},"FR":{"fee":499,"min":7,"max":25}}}')
ON CONFLICT (id) DO NOTHING;
