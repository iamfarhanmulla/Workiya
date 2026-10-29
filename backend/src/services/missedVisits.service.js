const visitPlanRepository = require("../repositories/visitPlan.repository");
const auditService = require("./audit.service");
const { AUDIT_EVENTS } = require("../constants/auditEvents");

const MAX_IDS_IN_AUDIT = 200;

// Marks every overdue Pending / InProgress visit as Missed (companyId null = all companies, used
// by the nightly cron) and writes one audit entry per affected company.
async function markMissed({ companyId = null, performedBy = null, requestCtx = {} } = {}) {
  const rows = await visitPlanRepository.markMissed(companyId);
  const byCompany = new Map();
  rows.forEach((row) => {
    const ids = byCompany.get(row.company_id) || [];
    ids.push(row.id);
    byCompany.set(row.company_id, ids);
  });
  await Promise.all([...byCompany].map(([company, ids]) => auditService.log({
    eventType: AUDIT_EVENTS.MISSED_VISITS_MARKED,
    entityType: "Activity",
    entityId: null,
    companyId: company,
    performedBy,
    newValue: { count: ids.length, activityIds: ids.slice(0, MAX_IDS_IN_AUDIT) },
    ipAddress: requestCtx.ipAddress || null,
    userAgent: requestCtx.userAgent || null,
  })));
  return { marked: rows.length, companies: byCompany.size };
}

module.exports = { markMissed };
