import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
const DESKTOP_SIDEBAR_COLLAPSE_STORAGE_KEY = "dashboard.desktopSidebarCollapsed";

const getInitialDesktopSidebarCollapsed = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(DESKTOP_SIDEBAR_COLLAPSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const persistDesktopSidebarCollapsed = (value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      DESKTOP_SIDEBAR_COLLAPSE_STORAGE_KEY,
      value ? "1" : "0"
    );
  } catch {
    // Ignore storage issues (privacy mode, quota, etc.) and keep in-memory state.
  }
};

function DashboardLayout({ children }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(
    getInitialDesktopSidebarCollapsed
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    document.body.classList.add("dashboard-shell");

    return () => {
      document.body.classList.remove("dashboard-shell");
    };
  }, []);

  const toggleSidebar = () => {
    if (typeof window !== "undefined" && window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
      setIsDesktopSidebarCollapsed((current) => {
        const next = !current;
        persistDesktopSidebarCollapsed(next);
        return next;
      });
      return;
    }

    setIsMobileSidebarOpen((current) => !current);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="portal-theme flex h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#eefae8_0,#e2f3db_34%,#d8eccf_68%,#cfe6c4_100%)]">
      <div className="relative flex h-full w-full flex-col overflow-hidden lg:flex-row">
        <Sidebar
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={closeMobileSidebar}
          isDesktopCollapsed={isDesktopSidebarCollapsed}
        />

        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={closeMobileSidebar}
          className={`absolute inset-0 z-20 bg-slate-900/35 transition lg:hidden ${
            isMobileSidebarOpen
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Navbar
            onToggleSidebar={toggleSidebar}
            isMobileSidebarOpen={isMobileSidebarOpen}
            isDesktopCollapsed={isDesktopSidebarCollapsed}
          />

          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
