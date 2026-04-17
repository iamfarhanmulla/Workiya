import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function DashboardLayout({ children }) {
  return (
    <ThemeProvider>
      <div className="dash-shell">
        <div className="dash-body">
          <Sidebar />
          <div className="dash-content">
            <DashboardHeader />
            <main className="dash-main">{children}</main>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
