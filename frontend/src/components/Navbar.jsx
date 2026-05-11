import { useNavigate } from "react-router-dom";
import { ROLE_LABELS } from "../constants/auth";
import useAuth from "../hooks/useAuth";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

function Navbar({
  onToggleSidebar = () => {},
  isMobileSidebarOpen = false,
  isDesktopCollapsed = false,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isDesktopViewport =
    typeof window !== "undefined" && window.matchMedia(DESKTOP_MEDIA_QUERY).matches;

  const sidebarToggleLabel = isDesktopViewport
    ? isDesktopCollapsed
      ? "Expand navigation rail"
      : "Collapse navigation rail"
    : isMobileSidebarOpen
    ? "Close navigation"
    : "Open navigation";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-10 border-b border-emerald-100/70 bg-white/60 px-4 py-3 shadow-sm backdrop-blur sm:px-6 sm:py-4">
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarToggleLabel}
            aria-expanded={isDesktopViewport ? !isDesktopCollapsed : isMobileSidebarOpen}
            title={sidebarToggleLabel}
            className="touch-target inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-white/80 text-slate-700 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:h-10 sm:w-10"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M3 6H21" />
              <path d="M3 12H21" />
              <path d="M3 18H21" />
            </svg>
          </button>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-700 sm:text-xs sm:tracking-[0.35em]">
              Centralized School Portal
            </p>
            <h1 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
              {user?.role ? `${ROLE_LABELS[user.role]} Dashboard` : "Dashboard"}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-2 text-right text-sm text-slate-600">
            <p className="font-semibold text-slate-800">{user?.name}</p>
            <p>{user?.role ? ROLE_LABELS[user.role] : "User"}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="touch-target rounded-xl bg-[var(--portal-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--portal-primary-hover)]"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
