UPDATE shop_profile
SET data = json_remove(data, '$.shipping.BE.min', '$.shipping.BE.max', '$.shipping.FR.min', '$.shipping.FR.max')
WHERE id=1 AND json_extract(data,'$.shippingPreview')=1
  AND json_extract(data,'$.shipping.BE.min')=7 AND json_extract(data,'$.shipping.BE.max')=25
  AND json_extract(data,'$.shipping.FR.min')=7 AND json_extract(data,'$.shipping.FR.max')=25;
