import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";

export default function DashboardLayout({ children }) {
  return (
    <div className="dash-shell">
      <Sidebar />
      <div className="dash-main">
        <DashboardHeader />
        <div className="dash-content">
          {children}
        </div>
      </div>
    </div>
  );
}
