import TopNav from "@/components/TopNav";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function DashboardLayout({ children }) {
  return (
    <ThemeProvider>
      <div className="wk-shell">
        <TopNav />
        <main className="wk-shell-main">{children}</main>
      </div>
    </ThemeProvider>
  );
}
