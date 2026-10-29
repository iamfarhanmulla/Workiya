-- Migration: 20261029110000_WI-TBD_rep_terminology
-- Purpose : Lets each company rename the field person ("Rep" by default, e.g. MR, Agent,
--           Technician) through company_terminology keys rep.singular and rep.plural.
-- Requires: 20261027100200_WI-TBD_settings_and_field_work.sql
-- Apply   : cd backend && node scripts/run-pg-migration.js up --yes
-- Revert  : cd backend && node scripts/run-pg-migration.js down <this file> --yes

-- ==== UP ====

ALTER TABLE company_terminology DROP CONSTRAINT ck_company_terminology_term_key;
ALTER TABLE company_terminology ADD CONSTRAINT ck_company_terminology_term_key CHECK (term_key IN (
  'account.singular', 'account.plural',
  'activity.singular', 'activity.plural',
  'submission.singular', 'submission.plural',
  'rep.singular', 'rep.plural'));

-- ==== DOWN ====

-- The old check rejects rep.* rows, deleted or not, so they are removed before it returns.
DELETE FROM company_terminology WHERE term_key IN ('rep.singular', 'rep.plural');
ALTER TABLE company_terminology DROP CONSTRAINT ck_company_terminology_term_key;
ALTER TABLE company_terminology ADD CONSTRAINT ck_company_terminology_term_key CHECK (term_key IN (
  'account.singular', 'account.plural',
  'activity.singular', 'activity.plural',
  'submission.singular', 'submission.plural'));
