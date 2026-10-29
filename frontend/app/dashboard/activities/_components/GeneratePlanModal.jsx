"use client";

import { useState } from "react";
import Modal, { ModalFooter } from "@/components/Modal";
import { SelectField } from "@/components/FormFields";
import FormError from "@/components/FormError";
import { api, getErrorMessage } from "@/lib/apiClient";
import { monthOptions, shortDay } from "@/lib/months";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import { useCompanyChoice } from "@/hooks/useCompanyChoice";

const MONTHS = monthOptions([0, 1, 2]);

function PlanTable({ items }) {
  if (items.length === 0) {
    return <p className="wk-muted">No reps have assigned accounts with a monthly visit target.</p>;
  }
  return (
    <div className="wk-table-wrap">
      <table className="wk-table">
        <thead>
          <tr>
            <th scope="col">Rep</th>
            <th scope="col">Account</th>
            <th scope="col">Per month</th>
            <th scope="col">Already</th>
            <th scope="col">New visits</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.userId}-${item.accountId}`}>
              <td>{item.userName}</td>
              <td>{item.accountName}</td>
              <td>{item.visitsPerMonth}</td>
              <td>{item.existing}</td>
              <td>{item.dates.length ? item.dates.map(shortDay).join(", ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlanSummary({ plan }) {
  const { totals } = plan;
  return (
    <div className="wk-banner" role="status">
      <span className="material-symbols-outlined" aria-hidden="true">event_upcoming</span>
      <div>
        <strong>{`${totals.toCreate} new visit(s) for ${totals.reps} rep(s)`}</strong>
        {` · ${totals.alreadyPlanned} already planned · ${plan.workingDays} working days (Mon–Sat)`}
      </div>
    </div>
  );
}

function usePlan(company, onDone) {
  const [form, setForm] = useState({ month: MONTHS[0].value, activityTypeId: "" });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const body = {
    month: form.month,
    ...(form.activityTypeId ? { activityTypeId: Number(form.activityTypeId) } : {}),
    ...company.params,
  };
  const change = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setPlan(null);
  };
  async function run(path, onSuccess, fallback) {
    setBusy(true);
    setError("");
    try {
      onSuccess((await api.post(path, body)).data);
    } catch (err) {
      setError(getErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  }
  return {
    form,
    plan,
    busy,
    error,
    change,
    preview: () => run("/visit-plans/preview", (res) => setPlan(res.data), "Preview failed."),
    create: () => run(
      "/visit-plans",
      (res) => onDone(res.data.created),
      "Could not create the plan.",
    ),
  };
}

function PlanFields({ company, types, state }) {
  return (
    <>
      {company.isSuper && (
        <SelectField
          id="plan-company"
          label="Company"
          required
          value={company.companyId}
          onChange={(value) => {
            company.setCompanyId(value);
            state.change("activityTypeId")("");
          }}
          placeholder="Choose a company"
          options={company.companies.map((c) => ({ value: String(c.Id), label: c.Name }))}
        />
      )}
      <SelectField
        id="plan-month"
        label="Month"
        required
        value={state.form.month}
        onChange={state.change("month")}
        options={MONTHS}
      />
      {types.length > 1 && (
        <SelectField
          id="plan-type"
          label="Visit type"
          required
          value={state.form.activityTypeId}
          onChange={state.change("activityTypeId")}
          placeholder="Choose a visit type"
          options={types.map((t) => ({ value: String(t.id), label: t.name }))}
        />
      )}
    </>
  );
}

// notify + reload: after creating, the dialog closes, shows a toast and refreshes the list.
export default function GeneratePlanModal({
  user, labels, onClose, notify, reload,
}) {
  const company = useCompanyChoice(user);
  const { types } = useActivityTypes(company.params.companyId ?? null);
  const state = usePlan(company, (created) => {
    onClose();
    notify(`${created} planned ${labels.activities.toLowerCase()} created.`);
    reload();
  });
  const toCreate = state.plan ? state.plan.totals.toCreate : 0;
  const footer = (
    <ModalFooter
      onCancel={onClose}
      onSubmit={state.plan ? state.create : state.preview}
      busy={state.busy || !company.ready}
      icon={state.plan ? "event_available" : "visibility"}
      label={state.plan ? `Create ${toCreate} visit(s)` : "Preview plan"}
      busyLabel="Working…"
    />
  );
  return (
    <Modal
      icon="event_upcoming"
      title="Generate visit plan"
      sub={`Creates the missing visits from each rep's assigned ${labels.accounts.toLowerCase()}`
        + " and visits per month. Nothing is created twice."}
      onClose={onClose}
      footer={footer}
      size="lg"
    >
      <PlanFields company={company} types={types} state={state} />
      <FormError message={state.error} />
      {state.plan && <PlanSummary plan={state.plan} />}
      {state.plan && <PlanTable items={state.plan.items} />}
    </Modal>
  );
}
