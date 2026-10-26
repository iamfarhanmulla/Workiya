import ComingSoon from "@/components/ComingSoon";

export const metadata = { title: "Billing · Workiya" };

export default function BillingPage() {
  return (
    <ComingSoon
      title="Billing"
      sub="Your plan, seats and invoices"
      icon="credit_card"
      points={[
        "Your current plan and how many seats are in use.",
        "Invoices with GST details, downloadable as PDF.",
        "Upgrade, downgrade or add seats.",
      ]}
    />
  );
}
