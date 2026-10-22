"use client";

import { useSelector } from "react-redux";
import { selectUser } from "@/store/authSlice";
import { useTerminology } from "@/hooks/useTerminology";
import StaffDashboard from "./_components/StaffDashboard";
import MyDay from "./_components/MyDay";

function greeting(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const TODAY_FORMAT = {
  weekday: "long", day: "numeric", month: "short", year: "numeric",
};

export default function DashboardPage() {
  const user = useSelector(selectUser);
  const { t } = useTerminology();
  const now = new Date();
  const name = user?.firstName ? `, ${user.firstName}` : "";

  return (
    <div className="wk-app">
      <div className="wk-main">
        <div className="wk-page-hd">
          <div>
            {/* Time-of-day text differs between the prerendered HTML and the browser. */}
            <h1 className="wk-page-title" suppressHydrationWarning>
              {`${greeting(now.getHours())}${name}`}
            </h1>
            <p className="wk-page-sub" suppressHydrationWarning>
              {now.toLocaleDateString("en-IN", TODAY_FORMAT)}
            </p>
          </div>
        </div>
        {/* No role yet means the user is still loading; render nothing until it is known. */}
        {user?.roleCode === "EMPLOYEE" && <MyDay t={t} />}
        {user && user.roleCode !== "EMPLOYEE" && <StaffDashboard t={t} />}
      </div>
    </div>
  );
}
