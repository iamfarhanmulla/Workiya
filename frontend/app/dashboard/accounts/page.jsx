"use client";

import { useEffect, useState } from "react";
import { useToast, ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { api } from "@/lib/apiClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTerminology } from "@/hooks/useTerminology";
import AccountGrid from "./_components/AccountGrid";
import AccountModals from "./_components/AccountModals";
import AccountStats from "./_components/AccountStats";
import AccountTable from "./_components/AccountTable";
import AccountsHeader from "./_components/AccountsHeader";
import AccountsToolbar from "./_components/AccountsToolbar";
import Pagination from "./_components/Pagination";
import { isStaff } from "./_components/accountForm";
import useAccountMutations from "./_components/useAccountMutations";
import useAccounts from "./_components/useAccounts";

// Only SUPER_ADMIN may list companies; other roles file accounts under their own company.
function useCompanies(enabled) {
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    api.get("/companies")
      .then((res) => {
        if (!cancelled && res.data?.success) setCompanies(res.data.data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return companies;
}

function Loading({ plural }) {
  return (
    <div className="page-placeholder">
      <span
        className="material-symbols-outlined page-placeholder-icon"
        style={{ animation: "spin 1s linear infinite" }}
      >
        progress_activity
      </span>
      <p>Loading {plural.toLowerCase()}...</p>
    </div>
  );
}

function AccountResults({
  list, view, terms, canManage, handlers,
}) {
  const Results = view === "grid" ? AccountGrid : AccountTable;
  return (
    <>
      {list.loading ? <Loading plural={terms.plural} /> : (
        <Results
          items={list.items}
          singular={terms.singular}
          plural={terms.plural}
          canManage={canManage}
          handlers={handlers}
        />
      )}
      <Pagination
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        onPage={list.setPage}
      />
    </>
  );
}

// Toast texts shown after a modal finishes; each closes the modal and reloads the list.
function useCompletions(terms, finish) {
  return {
    onFormSaved: (edited) => finish(
      `${terms.singular} ${edited ? "updated" : "created"} successfully.`,
    ),
    onAssigned: () => finish("Reps assigned."),
    onTransferred: (moved) => finish(
      `${moved} ${moved === 1 ? terms.singular : terms.plural} transferred.`,
    ),
  };
}

function useAccountsPage() {
  const { toasts, showToast } = useToast();
  const { t } = useTerminology();
  const user = useCurrentUser();
  const terms = { singular: t("account.singular"), plural: t("account.plural") };
  const list = useAccounts(() => showToast("Failed to load data.", "error"));
  const { reload } = list;
  const mutations = useAccountMutations({ singular: terms.singular, showToast, reload });
  const companies = useCompanies(user?.roleCode === "SUPER_ADMIN");
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const completions = useCompletions(terms, (message) => {
    setModal(null);
    showToast(message, "success");
    reload();
  });
  const handlers = {
    onView: (account) => setModal({ type: "view", account }),
    onEdit: (account) => setModal({ type: "form", account }),
    onAssign: (account) => setModal({ type: "assign", account }),
    onToggle: mutations.toggleActive,
    onDelete: setDeleteTarget,
  };
  return {
    toasts,
    user,
    terms,
    list,
    mutations,
    companies,
    modal,
    setModal,
    deleteTarget,
    setDeleteTarget,
    completions,
    handlers,
  };
}

export default function AccountsPage() {
  const page = useAccountsPage();
  const { terms, list } = page;
  const canManage = isStaff(page.user);
  const [view, setView] = useState("grid");
  return (
    <div className="doc-page">
      <ToastContainer toasts={page.toasts} />
      <ConfirmModal
        open={!!page.deleteTarget}
        title={`Delete ${terms.singular}`}
        message={`This will remove ${page.deleteTarget?.name || "this record"} from the list.`}
        onConfirm={async () => {
          if (await page.mutations.remove(page.deleteTarget)) page.setDeleteTarget(null);
        }}
        onCancel={() => page.setDeleteTarget(null)}
      />
      <AccountsHeader
        singular={terms.singular}
        plural={terms.plural}
        canManage={canManage}
        onAdd={() => page.setModal({ type: "form", account: null })}
        onTransfer={() => page.setModal({ type: "transfer" })}
      />
      <AccountStats items={list.items} total={list.total} plural={terms.plural} />
      <AccountsToolbar
        plural={terms.plural}
        list={list}
        view={view}
        onView={setView}
      />
      <AccountResults
        list={list}
        view={view}
        terms={terms}
        canManage={canManage}
        handlers={page.handlers}
      />
      <AccountModals
        modal={page.modal}
        setModal={page.setModal}
        terms={terms}
        user={page.user}
        companies={page.companies}
        canManage={canManage}
        completions={page.completions}
      />
    </div>
  );
}
