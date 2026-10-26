-- Migration: 20261027100000_WI-TBD_extensions_and_helpers
-- Purpose : PostgreSQL extensions and the shared trigger functions used by later migrations:
--           set_valid_from() + record_history() keep change history (the PostgreSQL
--           replacement for SQL Server temporal tables), reject_audit_log_change() makes
--           audit_logs append-only.
-- Apply   : cd backend && node scripts/run-pg-migration.js up --yes
-- Revert  : cd backend && node scripts/run-pg-migration.js down <this file> --yes
-- Schema  : Objects are created unqualified, in the first schema of the search_path, so the
--           integration tests can apply every migration into their own throw-away schema.
--           Extensions are database-wide and always live in "public".

-- ==== UP ====

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- BEFORE UPDATE: the new version of a row is valid from now on.
CREATE OR REPLACE FUNCTION set_valid_from() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.valid_from := now();
  RETURN NEW;
END;
$$;

-- AFTER UPDATE OR DELETE: copies the old row into <table>_history with valid_to = now().
-- Columns are matched by name (through jsonb), so the history table only needs the same
-- column names as its table plus valid_to; column order does not matter.
CREATE OR REPLACE FUNCTION record_history() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  history_table text := format('%I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME || '_history');
BEGIN
  EXECUTE format(
    'INSERT INTO %s SELECT * FROM jsonb_populate_record(NULL::%s, $1)',
    history_table, history_table)
  USING to_jsonb(OLD) || jsonb_build_object('valid_to', now());
  RETURN NULL;
END;
$$;

-- Used as a row trigger (UPDATE, DELETE) and a statement trigger (TRUNCATE) on audit_logs.
CREATE OR REPLACE FUNCTION reject_audit_log_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed.', TG_TABLE_NAME, TG_OP;
END;
$$;

-- ==== DOWN ====

-- Extensions are left installed: they are database-wide and may be used by other schemas.
DROP FUNCTION IF EXISTS reject_audit_log_change();
DROP FUNCTION IF EXISTS record_history();
DROP FUNCTION IF EXISTS set_valid_from();
