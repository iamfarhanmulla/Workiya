import ComingSoon from "@/components/ComingSoon";

export const metadata = { title: "Leaves · Workiya" };

export default function LeavesPage() {
  return (
    <ComingSoon
      title="Leaves"
      sub="Leave requests and approvals"
      icon="beach_access"
      points={[
        "Reps request leave from the app and see its status.",
        "Managers approve or reject requests with a comment.",
        "Leave balance per person and a team calendar.",
        "Planned work is flagged when the assignee is on leave.",
      ]}
    />
  );
}
