-- Visit plans, missed visits and reports.
-- companies.time_zone: "end of the due day" and report months are counted in the company's
--   own time zone (default India). The app validates the name against PostgreSQL's list.
-- activities.source / plan_month: visits created by "Generate plan" are tagged PLAN with the
--   month they belong to, so generating the same month again never duplicates them.
-- The history table gets the same columns so record_history() keeps them.

-- ==== UP ====

ALTER TABLE companies
  ADD COLUMN time_zone varchar(64) NOT NULL DEFAULT 'Asia/Kolkata';

ALTER TABLE activities
  ADD COLUMN source     varchar(10) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN plan_month date        NULL,
  ADD CONSTRAINT ck_activities_source CHECK (source IN ('MANUAL', 'PLAN')),
  ADD CONSTRAINT ck_activities_plan_month CHECK (
    (source = 'PLAN') = (plan_month IS NOT NULL)
    AND (plan_month IS NULL OR EXTRACT(DAY FROM plan_month) = 1));

ALTER TABLE activities_history
  ADD COLUMN source     varchar(10) NULL,
  ADD COLUMN plan_month date        NULL;

-- Reports and the missed-visits job filter by company and due date.
CREATE INDEX ix_activities_company_due ON activities (company_id, due_at) WHERE NOT is_deleted;
-- Plan generation counts what a rep already has for an account in a month.
CREATE INDEX ix_activities_company_account_rep ON activities (company_id, account_id, assigned_to)
  WHERE NOT is_deleted;

-- ==== DOWN ====

DROP INDEX IF EXISTS ix_activities_company_account_rep;
DROP INDEX IF EXISTS ix_activities_company_due;
ALTER TABLE activities_history DROP COLUMN IF EXISTS plan_month, DROP COLUMN IF EXISTS source;
ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS ck_activities_plan_month,
  DROP CONSTRAINT IF EXISTS ck_activities_source,
  DROP COLUMN IF EXISTS plan_month,
  DROP COLUMN IF EXISTS source;
ALTER TABLE companies DROP COLUMN IF EXISTS time_zone;
