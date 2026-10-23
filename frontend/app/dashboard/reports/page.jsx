import ComingSoon from "@/components/ComingSoon";

export const metadata = { title: "Reports · Workiya" };

export default function ReportsPage() {
  return (
    <ComingSoon
      title="Reports"
      sub="Coverage and field performance over time"
      icon="monitoring"
      points={[
        "Planned versus completed work, week by week.",
        "Coverage: which customers were visited as often as planned.",
        "Missed work by rep and by territory.",
        "Filters by date range, team and rep, with Excel and PDF export.",
      ]}
      link={{ href: "/dashboard", label: "See today's numbers on the Dashboard" }}
    />
  );
}
