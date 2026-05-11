import { useEffect, useMemo, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { prefetchRoute } from "../routes/routePrefetch";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
const MOBILE_PREFETCH_BOOT_DELAY_MS = 140;
const PREFETCH_QUEUE_STEP_MS = 90;
const FALLBACK_PREFETCH_LIMIT = 6;

const NAV_LINKS = [
  { to: "/admin", label: "Dashboard", roles: ["admin"] },
  { to: "/admin/users", label: "Users", roles: ["admin"] },
  { to: "/admin/classes-subjects", label: "Classes & Subjects", roles: ["admin"] },
  { to: "/admin/teachers", label: "Teachers", roles: ["admin"] },
  { to: "/admin/students", label: "Students", roles: ["admin"] },
  { to: "/admin/attendance", label: "Attendance", roles: ["admin"] },
  { to: "/admin/fees", label: "Fees", roles: ["admin"] },
  { to: "/crm", label: "CRM (Admissions)", roles: ["admin", "crm"] },
  { to: "/admin/notifications", label: "Notifications", roles: ["admin"] },
  { to: "/admin/reports", label: "Reports", roles: ["admin"] },
  { to: "/admin/settings", label: "Settings", roles: ["admin"] },
  { to: "/teacher", label: "Teacher Dashboard", roles: ["teacher"] },
  { to: "/teacher/attendance", label: "Mark Attendance", roles: ["teacher"] },
  { to: "/teacher/marks", label: "Add Marks", roles: ["teacher"] },
  { to: "/teacher/assignments", label: "Assignments", roles: ["teacher"] },
  { to: "/teacher/students", label: "Students", roles: ["teacher"] },
  { to: "/student", label: "Student Dashboard", roles: ["student"] },
  { to: "/student/results", label: "Results", roles: ["student"] },
  { to: "/student/attendance", label: "Attendance", roles: ["student"] },
  { to: "/student/assignments", label: "Assignments", roles: ["student"] },
  { to: "/student/fees", label: "Fees", roles: ["student"] },
  { to: "/parent", label: "Parent Panel", roles: ["parent"] },
  { to: "/parent/attendance", label: "Child Attendance", roles: ["parent"] },
  { to: "/parent/fees", label: "Fees", roles: ["parent"] },
  { to: "/parent/communication", label: "Communication", roles: ["parent"] },
];

function IconHome({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 10.5L12 3L21 10.5" />
      <path d="M5.5 9.5V20H18.5V9.5" />
      <path d="M10 20V13.5H14V20" />
    </svg>
  );
}

function IconUsers({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19C3.5 15.96 5.96 13.5 9 13.5C12.04 13.5 14.5 15.96 14.5 19" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 18.5C15.23 16.39 16.94 14.75 19.1 14.75C20.38 14.75 21.53 15.34 22.3 16.27" />
    </svg>
  );
}

function IconBook({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 4.5H17.5C18.88 4.5 20 5.62 20 7V19.5H7.5C6.12 19.5 5 18.38 5 17V4.5Z" />
      <path d="M7.5 19.5V7C7.5 5.62 8.62 4.5 10 4.5" />
      <path d="M10.5 9H16.5" />
      <path d="M10.5 12.5H16.5" />
    </svg>
  );
}

function IconClipboardCheck({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5H15" />
      <path d="M9 12L11.2 14.2L15.5 9.9" />
    </svg>
  );
}

function IconWallet({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.5 7.5H18C19.38 7.5 20.5 8.62 20.5 10V18C20.5 19.38 19.38 20.5 18 20.5H6C4.62 20.5 3.5 19.38 3.5 18V7.5Z" />
      <path d="M3.5 8.5V6.5C3.5 5.4 4.4 4.5 5.5 4.5H17" />
      <circle cx="16.5" cy="14" r="1.2" />
    </svg>
  );
}

function IconMessage({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 5.5H20V15.5H9L4 19V5.5Z" />
      <path d="M8 10H16" />
      <path d="M8 13H13" />
    </svg>
  );
}

function IconBell({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 15H6C6 15 8 13.5 8 9.5C8 7.29 9.79 5.5 12 5.5C14.21 5.5 16 7.29 16 9.5C16 13.5 18 15 18 15Z" />
      <path d="M10.8 18C11.13 18.62 11.5 19 12 19C12.5 19 12.87 18.62 13.2 18" />
    </svg>
  );
}

function IconChart({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 19.5H20" />
      <path d="M7 17V11" />
      <path d="M12 17V8" />
      <path d="M17 17V6" />
    </svg>
  );
}

function IconSettings({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="2.8" />
      <path d="M19.4 12.9C19.43 12.6 19.45 12.3 19.45 12C19.45 11.7 19.43 11.4 19.4 11.1L21 9.9L19.4 7.1L17.5 7.8C17 7.4 16.45 7.08 15.85 6.86L15.55 4.9H12.45L12.15 6.86C11.55 7.08 11 7.4 10.5 7.8L8.6 7.1L7 9.9L8.6 11.1C8.57 11.4 8.55 11.7 8.55 12C8.55 12.3 8.57 12.6 8.6 12.9L7 14.1L8.6 16.9L10.5 16.2C11 16.6 11.55 16.92 12.15 17.14L12.45 19.1H15.55L15.85 17.14C16.45 16.92 17 16.6 17.5 16.2L19.4 16.9L21 14.1L19.4 12.9Z" />
    </svg>
  );
}

function IconLogout({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 4.5H5.5C4.4 4.5 3.5 5.4 3.5 6.5V17.5C3.5 18.6 4.4 19.5 5.5 19.5H10" />
      <path d="M14 8.5L18 12L14 15.5" />
      <path d="M18 12H9" />
    </svg>
  );
}

const NAV_ICON_BY_PATH = {
  "/admin": IconHome,
  "/admin/users": IconUsers,
  "/admin/students": IconUsers,
  "/admin/teachers": IconUsers,
  "/admin/classes-subjects": IconBook,
  "/admin/attendance": IconClipboardCheck,
  "/admin/fees": IconWallet,
  "/crm": IconMessage,
  "/admin/notifications": IconBell,
  "/admin/reports": IconChart,
  "/admin/settings": IconSettings,
  "/teacher": IconHome,
  "/teacher/attendance": IconClipboardCheck,
  "/teacher/marks": IconChart,
  "/teacher/assignments": IconBook,
  "/teacher/students": IconUsers,
  "/student": IconHome,
  "/student/results": IconChart,
  "/student/attendance": IconClipboardCheck,
  "/student/assignments": IconBook,
  "/student/fees": IconWallet,
  "/parent": IconUsers,
  "/parent/attendance": IconClipboardCheck,
  "/parent/fees": IconWallet,
  "/parent/communication": IconMessage,
};

const getNavIconByPath = (path) => NAV_ICON_BY_PATH[path] || IconHome;

function Sidebar({
  isMobileOpen = false,
  onCloseMobile = () => {},
  isDesktopCollapsed = false,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const visibleLinks = useMemo(
    () => NAV_LINKS.filter((link) => link.roles.includes(user?.role)),
    [user?.role]
  );
  const navLinkElementMapRef = useRef(new Map());

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const isDesktopViewport = window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
    if (!isDesktopViewport && !isMobileOpen) {
      return undefined;
    }

    const routeTargets = visibleLinks
      .map((link) => ({
        path: link.to,
        element: navLinkElementMapRef.current.get(link.to),
      }))
      .filter((entry) => entry.element);

    if (!routeTargets.length) {
      return undefined;
    }

    const startupDelay = isDesktopViewport ? 0 : MOBILE_PREFETCH_BOOT_DELAY_MS;
    const pendingTimerIds = new Set();
    let cancelled = false;
    let disconnectObserver = () => {};

    const clearPendingTimers = () => {
      pendingTimerIds.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      pendingTimerIds.clear();
    };

    const queuePrefetch = (path, queueIndex) => {
      const safePath = String(path || "").trim();
      if (!safePath) {
        return;
      }

      const timerId = window.setTimeout(() => {
        pendingTimerIds.delete(timerId);
        if (cancelled) {
          return;
        }

        void prefetchRoute(safePath);
      }, Math.max(0, queueIndex) * PREFETCH_QUEUE_STEP_MS);

      pendingTimerIds.add(timerId);
    };

    const bootTimerId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      if (typeof IntersectionObserver !== "function") {
        routeTargets.slice(0, FALLBACK_PREFETCH_LIMIT).forEach((entry, index) => {
          queuePrefetch(entry.path, index);
        });
        return;
      }

      const queuedPaths = new Set();
      let queuedCount = 0;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            const targetPath = entry.target.getAttribute("data-prefetch-path");
            if (!targetPath || queuedPaths.has(targetPath)) {
              return;
            }

            queuedPaths.add(targetPath);
            queuePrefetch(targetPath, queuedCount);
            queuedCount += 1;
            observer.unobserve(entry.target);
          });
        },
        {
          root: null,
          threshold: 0.12,
          rootMargin: "0px 0px 120px 0px",
        }
      );

      routeTargets.forEach((entry) => {
        observer.observe(entry.element);
      });

      disconnectObserver = () => {
        observer.disconnect();
      };
    }, startupDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(bootTimerId);
      clearPendingTimers();
      disconnectObserver();
    };
  }, [visibleLinks, isMobileOpen, isDesktopCollapsed]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      className={`absolute inset-y-0 left-0 z-30 flex w-[84%] max-w-[300px] -translate-x-full flex-col border-r border-lime-100/80 bg-[linear-gradient(170deg,#f3faef_0%,#e4f3de_48%,#d7ebcf_100%)] p-3 text-slate-800 shadow-[0_26px_60px_-36px_rgba(72,157,65,0.55)] transition-transform duration-300 ease-out ${
        isMobileOpen ? "translate-x-0" : ""
      } lg:static lg:z-auto lg:h-full lg:max-w-none lg:flex-shrink-0 lg:translate-x-0 lg:shadow-none lg:transition-[width,padding] ${
        isDesktopCollapsed
          ? "lg:w-24 lg:px-3 lg:py-4"
          : "lg:w-72 lg:p-5"
      }`}
    >
      <div
        className={`mb-5 flex items-start justify-between ${
          isDesktopCollapsed ? "lg:mb-5 lg:justify-center" : "lg:mb-5"
        }`}
      >
        <div className={isDesktopCollapsed ? "lg:hidden" : ""}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--portal-accent)]">
            Workspace
          </p>
          <h2 className="mt-1.5 text-xl font-bold text-slate-800">Centralized Portal</h2>
        </div>

        {isDesktopCollapsed ? (
          <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-lime-200 bg-white/90 text-xs font-extrabold tracking-wide text-[var(--portal-accent)] lg:flex">
            CP
          </div>
        ) : null}

        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="touch-target rounded-lg border border-lime-200 bg-white/85 px-3 py-2 text-xs font-semibold text-[var(--portal-accent)] transition hover:bg-white lg:hidden"
        >
          Close
        </button>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-hidden overflow-x-hidden pr-0 ${
          isDesktopCollapsed ? "lg:pr-0" : ""
        }`}
      >
        <ul className={isDesktopCollapsed ? "space-y-1 lg:space-y-1" : "space-y-1"}>
          {visibleLinks.map((link) => {
            const NavIcon = getNavIconByPath(link.to);
            const handleLinkPrefetch = () => {
              void prefetchRoute(link.to);
            };

            return (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end
                  ref={(node) => {
                    if (node) {
                      navLinkElementMapRef.current.set(link.to, node);
                      return;
                    }

                    navLinkElementMapRef.current.delete(link.to);
                  }}
                  data-prefetch-path={link.to}
                  onClick={onCloseMobile}
                  onMouseEnter={handleLinkPrefetch}
                  onFocus={handleLinkPrefetch}
                  onTouchStart={handleLinkPrefetch}
                  className={({ isActive }) => {
                    return `touch-target group relative block rounded-lg px-3 py-2.5 text-sm transition ${
                      isActive
                        ? "bg-[var(--portal-primary)] text-white shadow-[0_14px_24px_-18px_rgba(125,194,66,0.88)] font-semibold ring-1 ring-[#b9df96]"
                        : "text-slate-700 hover:bg-white/60 hover:text-[var(--portal-accent)]"
                    } ${
                      isDesktopCollapsed
                        ? "lg:flex lg:h-10 lg:items-center lg:justify-center lg:px-1.5 lg:py-0"
                        : ""
                    }`;
                  }}
                  title={isDesktopCollapsed ? link.label : undefined}
                >
                  {isDesktopCollapsed ? (
                    <>
                      <span className="lg:hidden">{link.label}</span>
                      <span className="hidden lg:inline-flex lg:h-8 lg:w-8 lg:items-center lg:justify-center lg:leading-none">
                        <NavIcon className="h-4 w-4" />
                      </span>
                    </>
                  ) : (
                    link.label
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={`mt-3 border-t border-lime-200/80 pt-3 ${isDesktopCollapsed ? "lg:mt-3 lg:pt-3" : ""}`}>
        <button
          type="button"
          onClick={handleLogout}
          title={isDesktopCollapsed ? "Logout" : undefined}
          className={`touch-target group relative block w-full rounded-xl bg-[var(--portal-primary)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-primary-hover)] ${
            isDesktopCollapsed ? "px-2 text-center lg:py-2" : "px-3 text-left"
          }`}
        >
          {isDesktopCollapsed ? (
            <>
              <span className="lg:hidden">Logout</span>
              <span className="hidden lg:inline-flex lg:h-5 lg:w-full lg:items-center lg:justify-center">
                <IconLogout className="h-4 w-4" />
              </span>
            </>
          ) : (
            "Logout"
          )}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
