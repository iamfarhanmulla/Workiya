"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { SkeletonRows, LoadError } from "@/components/DataStates";
import { useToast, ToastContainer } from "@/components/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTerminology } from "@/hooks/useTerminology";
import { useCompanyChoice } from "@/hooks/useCompanyChoice";
import { api, getErrorMessage } from "@/lib/apiClient";
import { currentMonth, monthOptions } from "@/lib/months";
import useReports from "./useReports";
import {
  CoverageKpis, RepCoverageTable, NotVisitedTable, TrendBars,
} from "./ReportTables";

const MONTHS = monthOptions([-5, -4, -3, -2, -1, 0, 1]).reverse();

function Card({ title, sub, children }) {
  return (
    <section className="wk-card">
      <div className="wk-card-hd">
        <div>
          <h2 className="wk-card-title">{title}</h2>
          {sub && <p className="wk-card-sub">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Filters({
  month, setMonth, company, canRunJob, onRunJob, busy,
}) {
  return (
    <>
      {company.isSuper && (
        <select
          className="wk-select"
          aria-label="Company"
          value={company.companyId}
          onChange={(e) => company.setCompanyId(e.target.value)}
        >
          <option value="">Choose a company</option>
          {company.companies.map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
        </select>
      )}
      <select
        className="wk-select"
        aria-label="Month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
      >
        {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      {canRunJob && (
        <button
          type="button"
          className="wk-btn wk-btn--secondary"
          onClick={onRunJob}
          disabled={busy}
        >
          <span className="material-symbols-outlined" aria-hidden="true">event_busy</span>
          {busy ? "Checking…" : "Run missed check now"}
        </button>
      )}
    </>
  );
}

function ReportBody({ report, labels }) {
  const { coverage, trend } = report;
  return (
    <>
      <CoverageKpis totals={coverage.totals} />
      <Card
        title={`Coverage by ${labels.rep}`}
        sub={`Completed visits against each ${labels.rep}'s monthly target`}
      >
        <RepCoverageTable reps={coverage.byRep} labels={labels} />
      </Card>
      <Card
        title={`${labels.accounts} not visited`}
        sub="Assigned, but no completed visit this month"
      >
        <NotVisitedTable rows={coverage.notVisited} labels={labels} />
      </Card>
      <Card title="Last 8 weeks" sub="Completed (green) and missed (red) visits per week">
        <TrendBars weeks={trend} />
      </Card>
    </>
  );
}

function useMissedCheck(company, report, showToast) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const res = await api.post("/visit-plans/mark-missed", company.params);
      showToast(res.data.message);
      report.reload();
    } catch (err) {
      showToast(getErrorMessage(err, "The missed check failed."), "error");
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export default function ReportsView() {
  const user = useCurrentUser();
  const { t } = useTerminology();
  const { toasts, showToast } = useToast();
  const company = useCompanyChoice(user);
  const [month, setMonth] = useState(currentMonth());
  const report = useReports({ month, params: company.params, ready: company.ready });
  const missed = useMissedCheck(company, report, showToast);
  const labels = {
    account: t("account.singular"),
    accounts: t("account.plural"),
    rep: t("rep.singular"),
    reps: t("rep.plural"),
  };
  const canRunJob = ["SUPER_ADMIN", "ADMIN"].includes(user?.roleCode);
  const showBody = company.ready && !report.loading && !report.error && report.coverage;
  return (
    <div className="wk-app">
      <div className="wk-main">
        <ToastContainer toasts={toasts} />
        <PageHeader
          title={user?.roleCode === "EMPLOYEE" ? "My coverage" : "Reports"}
          sub="Planned versus completed visits, missed visits and coverage"
        >
          <Filters
            {...{
              month, setMonth, company, canRunJob,
            }}
            busy={missed.busy}
            onRunJob={missed.run}
          />
        </PageHeader>
        {!company.ready && <p className="wk-muted">Choose a company to see its reports.</p>}
        {company.ready && report.loading && <SkeletonRows rows={6} tiles />}
        {company.ready && !report.loading && report.error && (
          <LoadError what="reports" detail={` ${report.error}`} onRetry={report.reload} />
        )}
        {showBody && <ReportBody report={report} labels={labels} />}
      </div>
    </div>
  );
}
