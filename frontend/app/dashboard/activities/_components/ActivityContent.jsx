"use client";

import ActivityBoard from "./ActivityBoard";
import ActivityTable from "./ActivityTable";
import PendingReviews from "./PendingReviews";
import { statusMoves } from "./activityConfig";

const ERROR = { margin: "0 20px 8px", fontSize: 13, color: "#EF4444" };

function Loading({ plural }) {
  return (
    <div className="page-placeholder">
      <span
        className="material-symbols-outlined page-placeholder-icon"
        style={{ animation: "spin 1s linear infinite" }}
      >
        progress_activity
      </span>
      <p>{`Loading ${plural.toLowerCase()}...`}</p>
    </div>
  );
}

function ActivityList({
  view, activities, labels, user, isStaff, actions,
}) {
  const emptyLabel = `No ${labels.activities.toLowerCase()} found.`;
  if (view === "list") {
    return (
      <ActivityTable
        activities={activities}
        accountLabel={labels.account}
        emptyLabel={emptyLabel}
        isStaff={isStaff}
        onView={actions.openView}
        onEdit={actions.openEdit}
        onDelete={actions.askDelete}
      />
    );
  }
  return (
    <ActivityBoard
      activities={activities}
      board={{
        isStaff,
        emptyLabel,
        movesFor: (activity) => statusMoves(activity, user, isStaff),
        onAdd: actions.openAdd,
        onView: actions.openView,
        onEdit: actions.openEdit,
        onDelete: actions.askDelete,
        onMove: actions.changeStatus,
      }}
    />
  );
}

// The main area: pending-review queue, load error, loading state, board or list.
export default function ActivityContent({
  view, data, activities, ctx,
}) {
  const {
    labels, user, isStaff, actions, showToast,
  } = ctx;
  if (view === "review" && isStaff) {
    return <PendingReviews labels={labels} onReviewed={actions.finish} showToast={showToast} />;
  }
  if (data.loading) return <Loading plural={labels.activities} />;
  return (
    <>
      {data.failed && (
        <p role="alert" style={ERROR}>{`Failed to load ${labels.activities.toLowerCase()}.`}</p>
      )}
      <ActivityList
        view={view}
        activities={activities}
        labels={labels}
        user={user}
        isStaff={isStaff}
        actions={actions}
      />
    </>
  );
}
