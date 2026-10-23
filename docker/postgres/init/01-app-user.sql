\set ON_ERROR_STOP on
\getenv app_db_password APP_DB_PASSWORD
\getenv app_db_name POSTGRES_DB

SELECT format('CREATE ROLE app_user LOGIN PASSWORD %L', :'app_db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user')
\gexec

SELECT format('ALTER ROLE app_user WITH LOGIN PASSWORD %L', :'app_db_password')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user')
\gexec

GRANT CONNECT ON DATABASE :"app_db_name" TO app_user;
