-- Apply only after a successful authenticated test against the intended
-- HTTPS endpoint. Supabase Vault holds tsu_catalog_origin and
-- tsu_catalog_runner. The origin is the HTTPS shop origin, without a path.
-- The anonymous private Sites login page cannot run this operator job.
-- This job targets the independent Vercel shop once its data and auth migrate.
select cron.schedule('tsu_printful_catalog','*/15 * * * *',$job$
  select net.http_post(
    url := rtrim((select decrypted_secret from vault.decrypted_secrets where name='tsu_catalog_origin'),'/') || '/api/jobs/printful-catalog',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='tsu_catalog_runner')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
