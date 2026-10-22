"use client";

import AccountFormModal from "./AccountFormModal";
import AccountViewPanel from "./AccountViewPanel";
import AssignRepsModal from "./AssignRepsModal";
import TransferModal from "./TransferModal";

// Renders the one open modal. modal = { type: "form" | "view" | "assign" | "transfer", account }.
// completions = { onFormSaved(edited), onAssigned(), onTransferred(moved) }.
export default function AccountModals({
  modal, setModal, terms, user, companies, canManage, completions,
}) {
  if (!modal) return null;
  const close = () => setModal(null);
  const callerRole = user?.roleCode;
  switch (modal.type) {
    case "form":
      return (
        <AccountFormModal
          account={modal.account}
          singular={terms.singular}
          companies={companies}
          isSuperAdmin={callerRole === "SUPER_ADMIN"}
          onClose={close}
          onSaved={completions.onFormSaved}
        />
      );
    case "view":
      return (
        <AccountViewPanel
          account={modal.account}
          singular={terms.singular}
          canManage={canManage}
          onClose={close}
          onEdit={(a) => setModal({ type: "form", account: a })}
        />
      );
    case "assign":
      return (
        <AssignRepsModal
          account={modal.account}
          callerRole={callerRole}
          onClose={close}
          onSaved={completions.onAssigned}
        />
      );
    case "transfer":
      return (
        <TransferModal
          plural={terms.plural}
          callerRole={callerRole}
          onClose={close}
          onDone={completions.onTransferred}
        />
      );
    default:
      return null;
  }
}
