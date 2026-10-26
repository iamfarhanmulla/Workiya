"use client";

import { SkeletonRows } from "@/components/DataStates";
import ActivityBoard from "./ActivityBoard";
import ActivityTable from "./ActivityTable";
import PendingReviews from "./PendingReviews";
import { statusMoves } from "./activityConfig";

function ActivityList({
  view, activities, labels, user, isStaff, actions,
}) {
  const emptyLabel = `No ${labels.activities.toLowerCase()} found.`;
  if (view === "list") {
    return (
      <section className="wk-card wk-results" aria-label={labels.activities}>
        <ActivityTable
          activities={activities}
          accountLabel={labels.account}
          emptyLabel={emptyLabel}
          isStaff={isStaff}
          onView={actions.openView}
          onEdit={actions.openEdit}
          onDelete={actions.askDelete}
        />
      </section>
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
  if (data.loading) return <section className="wk-card"><SkeletonRows rows={6} /></section>;
  return (
    <>
      {data.failed && (
        <div className="wk-banner wk-banner--danger">
          <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
          <div role="alert">{`Failed to load ${labels.activities.toLowerCase()}.`}</div>
        </div>
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
