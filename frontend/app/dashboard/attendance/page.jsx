import ComingSoon from "@/components/ComingSoon";

export const metadata = { title: "Attendance · Workiya" };

export default function AttendancePage() {
  return (
    <ComingSoon
      title="Attendance"
      sub="Daily punch-in and punch-out for the field team"
      icon="schedule"
      points={[
        "Reps punch in and out from their phone, with the GPS location saved.",
        "A daily view per rep: present, late, half day or absent.",
        "Managers see their team's attendance; admins see the whole company.",
        "Monthly attendance export for payroll.",
      ]}
    />
  );
}
