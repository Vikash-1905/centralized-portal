import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import useSchoolData from "../../hooks/useSchoolData";

const ROLE_OPTIONS = ["All", "admin", "crm", "teacher", "student", "parent"];
const STATUS_OPTIONS = ["All", "Active", "Inactive"];
const SYSTEM_USER_ROLES = ["admin", "crm"];

const ROLE_LABELS = {
  admin: "Admin",
  crm: "CRM Staff",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};

const ROLE_CARD_CONFIG = [
  {
    role: "admin",
    title: "Admins",
    description: "System governance",
    gradient: "from-sky-500/20 via-cyan-400/15 to-transparent",
    iconShell: "bg-sky-100 text-sky-700",
  },
  {
    role: "crm",
    title: "CRM",
    description: "Admission operations",
    gradient: "from-teal-500/20 via-emerald-400/15 to-transparent",
    iconShell: "bg-teal-100 text-teal-700",
  },
  {
    role: "teacher",
    title: "Teachers",
    description: "Academic faculty",
    gradient: "from-indigo-500/20 via-blue-400/15 to-transparent",
    iconShell: "bg-indigo-100 text-indigo-700",
  },
  {
    role: "student",
    title: "Students",
    description: "Active learners",
    gradient: "from-orange-500/20 via-amber-400/15 to-transparent",
    iconShell: "bg-orange-100 text-orange-700",
  },
  {
    role: "parent",
    title: "Parents",
    description: "Guardians linked",
    gradient: "from-rose-500/20 via-pink-400/15 to-transparent",
    iconShell: "bg-rose-100 text-rose-700",
  },
];

const createSystemUserForm = () => ({
  id: "",
  name: "",
  email: "",
  role: "crm",
  password: "",
  status: "Active",
});

const getRoleLabel = (role) => ROLE_LABELS[role] || role;

const getAccountStatus = (status) =>
  String(status || "Active").toLowerCase() === "inactive" ? "Inactive" : "Active";

const Spinner = ({ className = "h-4 w-4" }) => (
  <span
    className={`${className} inline-block animate-spin rounded-full border-2 border-current border-r-transparent`}
    aria-hidden="true"
  />
);

const RoleIcon = ({ role, className = "h-5 w-5" }) => {
  if (role === "admin") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M12 3L5 6v6c0 4.6 2.8 7.3 7 9 4.2-1.7 7-4.4 7-9V6l-7-3Z" />
        <path d="M9.5 12.2 11.3 14l3.3-3.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (role === "crm") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M4 9.5h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8Z" />
        <path d="M8 9.5V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.5" />
        <path d="M10 13h4" strokeLinecap="round" />
      </svg>
    );
  }

  if (role === "teacher") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="m3 9 9-5 9 5-9 5-9-5Z" />
        <path d="M7 11.2v4.1c0 1.2 2.2 2.7 5 2.7s5-1.5 5-2.7v-4.1" />
        <path d="M21 9v5" strokeLinecap="round" />
      </svg>
    );
  }

  if (role === "student") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 19c1.7-3 4-4.5 7-4.5s5.3 1.5 7 4.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="8" cy="10" r="2.7" />
      <circle cx="16" cy="10" r="2.7" />
      <path d="M3.8 19c1.2-2.1 2.8-3.2 4.8-3.2" strokeLinecap="round" />
      <path d="M15.4 15.8c2 0 3.6 1.1 4.8 3.2" strokeLinecap="round" />
    </svg>
  );
};

const ActionIcon = ({ type, className = "h-4 w-4" }) => {
  if (type === "launch") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
        <path d="M14 5h5v5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m10 14 9-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "edit") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
        <path d="m15.3 5.3 3.4 3.4" strokeLinecap="round" />
        <path d="m5 19 3.7-.8 9-9a2.2 2.2 0 0 0-3.1-3.1l-9 9L5 19Z" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "toggle") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
        <rect x="3" y="9" width="18" height="10" rx="2" />
        <path d="M8 9V7a4 4 0 1 1 8 0v2" />
      </svg>
    );
  }

  if (type === "password") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
        <circle cx="8" cy="12" r="3" />
        <path d="M11 12h10" strokeLinecap="round" />
        <path d="M17 12v2" strokeLinecap="round" />
        <path d="M20 12v2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "close") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M6 6 18 18" strokeLinecap="round" />
        <path d="M18 6 6 18" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M9 7V5h6v2" strokeLinecap="round" />
      <path d="M7 7l1 12h8l1-12" strokeLinejoin="round" />
    </svg>
  );
};

const ActionButton = ({
  label,
  onClick,
  icon,
  tone,
  disabled,
  busy,
}) => {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
      : tone === "accent"
      ? "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${toneClass} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {busy ? <Spinner className="h-4 w-4" /> : <ActionIcon type={icon} />}
      <span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white shadow-lg group-hover:block">
        {label}
      </span>
    </button>
  );
};

const getRouteForRole = (role) => {
  if (role === "teacher") return "/admin/teachers";
  if (role === "student" || role === "parent") return "/admin/students";
  if (role === "admin" || role === "crm") return "/admin/settings";
  return "/admin";
};

function Users() {
  const navigate = useNavigate();
  const {
    schoolData,
    isSyncing,
    deleteSystemUser,
    resetUserPassword,
    saveSystemUser,
    setAccountStatus,
  } = useSchoolData();
  const { users = [], teachers = [], students = [], parents = [] } = schoolData;

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [systemUserForm, setSystemUserForm] = useState(createSystemUserForm);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [passwordModalAccount, setPasswordModalAccount] = useState(null);
  const [nextPassword, setNextPassword] = useState("");
  const [deleteModalAccount, setDeleteModalAccount] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingActionKey, setPendingActionKey] = useState("");

  const accounts = useMemo(() => {
    const appUsers = users
      .filter((entry) => entry.role)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        email: entry.email,
        role: entry.role,
        status: entry.status || "Active",
        source: "System",
      }));

    const facultyUsers = teachers.map((entry) => ({
      id: entry.id,
      name: entry.name,
      email: entry.email,
      role: "teacher",
      status: entry.status || "Active",
      source: "Faculty",
    }));

    const studentUsers = students.map((entry) => ({
      id: entry.id,
      name: entry.name,
      email: entry.email,
      role: "student",
      status: entry.status || "Active",
      source: "Academics",
    }));

    const parentUsers = parents.map((entry) => ({
      id: entry.id,
      name: entry.name,
      email: entry.email,
      role: "parent",
      status: entry.status || "Active",
      source: "Family",
    }));

    return [...appUsers, ...facultyUsers, ...studentUsers, ...parentUsers].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      })
    );
  }, [parents, students, teachers, users]);

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return accounts.filter((account) => {
      const matchesRole = roleFilter === "All" || account.role === roleFilter;
      const matchesStatus =
        statusFilter === "All" || getAccountStatus(account.status) === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        [account.name, account.email, account.id, account.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [accounts, roleFilter, searchTerm, statusFilter]);

  const roleCounts = useMemo(
    () => ({
      admin: accounts.filter((entry) => entry.role === "admin").length,
      crm: accounts.filter((entry) => entry.role === "crm").length,
      teacher: accounts.filter((entry) => entry.role === "teacher").length,
      student: accounts.filter((entry) => entry.role === "student").length,
      parent: accounts.filter((entry) => entry.role === "parent").length,
    }),
    [accounts]
  );

  const clearFeedback = () => {
    setMessage("");
    setError("");
  };

  const openCreateModal = () => {
    clearFeedback();
    resetSystemForm();
    setIsUserModalOpen(true);
  };

  const closeUserModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsUserModalOpen(false);
    resetSystemForm();
  };

  const resetSystemForm = () => {
    setSystemUserForm(createSystemUserForm());
  };

  const handleSystemInputChange = (event) => {
    const { name, value } = event.target;
    setSystemUserForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSystemSubmit = async (event) => {
    event.preventDefault();
    clearFeedback();

    if (!systemUserForm.name.trim() || !systemUserForm.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    if (!systemUserForm.id && !systemUserForm.password.trim()) {
      setError("Password is required for new users.");
      return;
    }

    setIsSubmitting(true);

    try {
      await saveSystemUser(systemUserForm);
      setMessage(
        systemUserForm.id
          ? "System user updated successfully."
          : "System user created successfully."
      );
      setIsUserModalOpen(false);
      resetSystemForm();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSystemUser = (account) => {
    clearFeedback();
    setSystemUserForm({
      id: account.id,
      name: account.name || "",
      email: account.email || "",
      role: account.role,
      password: "",
      status: account.status || "Active",
    });
    setIsUserModalOpen(true);
  };

  const handleDeleteSystemUser = async () => {
    if (!deleteModalAccount) {
      return;
    }

    const actionKey = `delete-${deleteModalAccount.role}-${deleteModalAccount.id}`;
    setPendingActionKey(actionKey);
    clearFeedback();

    try {
      await deleteSystemUser(deleteModalAccount.id);
      setMessage("System user deleted.");
      if (systemUserForm.id === deleteModalAccount.id) {
        resetSystemForm();
      }
      setDeleteModalAccount(null);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setPendingActionKey("");
    }
  };

  const handleToggleStatus = async (account) => {
    const actionKey = `status-${account.role}-${account.id}`;
    setPendingActionKey(actionKey);
    clearFeedback();
    const nextStatus = getAccountStatus(account.status) === "Inactive" ? "Active" : "Inactive";

    try {
      await setAccountStatus(account.role, account.id, nextStatus);
      setMessage(`${account.name} marked ${nextStatus}.`);
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setPendingActionKey("");
    }
  };

  const openResetPasswordModal = (account) => {
    clearFeedback();
    setPasswordModalAccount(account);
    setNextPassword("");
  };

  const handleResetPassword = async () => {
    if (!passwordModalAccount) {
      return;
    }

    if (!nextPassword.trim()) {
      setError("Password is required.");
      return;
    }

    const actionKey = `password-${passwordModalAccount.role}-${passwordModalAccount.id}`;
    setPendingActionKey(actionKey);

    clearFeedback();

    try {
      await resetUserPassword(
        passwordModalAccount.role,
        passwordModalAccount.id,
        nextPassword.trim()
      );
      setMessage(`Password reset for ${passwordModalAccount.name}.`);
      setPasswordModalAccount(null);
      setNextPassword("");
    } catch (resetError) {
      setError(resetError.message);
    } finally {
      setPendingActionKey("");
    }
  };

  const activeActionsLocked = Boolean(pendingActionKey);

  return (
    <DashboardLayout>
      <section className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-emerald-50 p-6 shadow-sm">
          <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-24 h-44 w-44 rounded-full bg-emerald-200/40 blur-3xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">User Management</h1>
              <p className="mt-2 max-w-3xl text-slate-600">
                Unified account operations for admins, CRM staff, teachers, students, and parents in one interactive workspace.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
                {isSyncing ? <Spinner className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-teal-600" />}
                {isSyncing ? "Syncing latest user records" : "Live account controls enabled"}
              </div>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center rounded-xl bg-[#7dc242] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-[#6cae3c]"
            >
              + Create User
            </button>
          </div>
        </div>

        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {ROLE_CARD_CONFIG.map((card) => {
            const isHighlighted = roleFilter === card.role;

            return (
              <button
                key={card.role}
                type="button"
                onClick={() => setRoleFilter(card.role)}
                className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg ${
                  isHighlighted ? "border-cyan-300 ring-2 ring-cyan-100" : "border-slate-200"
                }`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {card.title}
                    </p>
                    <p className="mt-2 text-3xl font-bold leading-none text-slate-900">
                      {roleCounts[card.role]}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{card.description}</p>
                  </div>

                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.iconShell}`}>
                    <RoleIcon role={card.role} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="Search users by name, email, ID, or source"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All roles" : getRoleLabel(option)}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All status" : option}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center rounded-xl bg-[#7dc242] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#6cae3c] xl:hidden"
              >
                + Create User
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((option) => {
              const isActive = roleFilter === option;
              const total = option === "All" ? accounts.length : roleCounts[option] || 0;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRoleFilter(option)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    isActive
                      ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  <span>{option === "All" ? "All Users" : getRoleLabel(option)}</span>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                    {total}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Users Directory</h2>
              <p className="mt-1 text-sm text-slate-500">
                Edit, activate, reset credentials, and manage role-specific access with quick actions.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {filteredAccounts.length} visible account{filteredAccounts.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length ? (
                  filteredAccounts.map((account) => {
                    const accountKey = `${account.role}-${account.id}`;
                    const isSystemUser = SYSTEM_USER_ROLES.includes(account.role);
                    const isInactive = getAccountStatus(account.status) === "Inactive";

                    return (
                      <tr
                        key={accountKey}
                        className="transition duration-150 hover:-translate-y-0.5 hover:drop-shadow-sm"
                      >
                        <td className="rounded-l-xl border border-r-0 border-slate-200 bg-white px-3 py-3 align-top">
                          <p className="font-semibold text-slate-800">{account.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">ID: {account.id || "-"}</p>
                          <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            {account.source}
                          </span>
                        </td>

                        <td className="border-y border-slate-200 bg-white px-3 py-3 text-slate-600">
                          {account.email || "-"}
                        </td>

                        <td className="border-y border-slate-200 bg-white px-3 py-3 text-slate-600">
                          {getRoleLabel(account.role)}
                        </td>

                        <td className="border-y border-slate-200 bg-white px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                              isInactive
                                ? "bg-rose-50 text-rose-700 ring-rose-200"
                                : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            }`}
                          >
                            {isInactive ? "Inactive" : "Active"}
                          </span>
                        </td>

                        <td className="rounded-r-xl border border-l-0 border-slate-200 bg-white px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <ActionButton
                              label="Open Module"
                              icon="launch"
                              onClick={() => navigate(getRouteForRole(account.role))}
                              disabled={activeActionsLocked}
                              busy={false}
                            />

                            <ActionButton
                              label={isInactive ? "Activate User" : "Deactivate User"}
                              icon="toggle"
                              tone="accent"
                              onClick={() => handleToggleStatus(account)}
                              disabled={activeActionsLocked}
                              busy={pendingActionKey === `status-${accountKey}`}
                            />

                            <ActionButton
                              label="Reset Password"
                              icon="password"
                              tone="warning"
                              onClick={() => openResetPasswordModal(account)}
                              disabled={activeActionsLocked}
                              busy={pendingActionKey === `password-${accountKey}`}
                            />

                            {isSystemUser ? (
                              <ActionButton
                                label="Edit User"
                                icon="edit"
                                tone="accent"
                                onClick={() => handleEditSystemUser(account)}
                                disabled={activeActionsLocked}
                                busy={false}
                              />
                            ) : null}

                            {isSystemUser ? (
                              <ActionButton
                                label="Delete User"
                                icon="delete"
                                tone="danger"
                                onClick={() => setDeleteModalAccount(account)}
                                disabled={activeActionsLocked}
                                busy={pendingActionKey === `delete-${accountKey}`}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-slate-500"
                    >
                      No users found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {isUserModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
            onClick={closeUserModal}
          >
            <section
              className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {systemUserForm.id ? "Edit System User" : "Create New User"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Admin and CRM accounts are managed from this modal.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeUserModal}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100"
                  aria-label="Close modal"
                >
                  <ActionIcon type="close" />
                </button>
              </div>

              <form onSubmit={handleSystemSubmit} className="space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Name
                  <input
                    name="name"
                    value={systemUserForm.name}
                    onChange={handleSystemInputChange}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    placeholder="Enter full name"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Email
                  <input
                    type="email"
                    name="email"
                    value={systemUserForm.email}
                    onChange={handleSystemInputChange}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    placeholder="Enter email"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Role
                    <select
                      name="role"
                      value={systemUserForm.role}
                      onChange={handleSystemInputChange}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    >
                      <option value="admin">Admin</option>
                      <option value="crm">CRM</option>
                    </select>
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Status
                    <select
                      name="status"
                      value={systemUserForm.status}
                      onChange={handleSystemInputChange}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </label>
                </div>

                <label className="block text-sm font-semibold text-slate-700">
                  Password {systemUserForm.id ? "(Optional)" : "*"}
                  <input
                    type="password"
                    name="password"
                    value={systemUserForm.password}
                    onChange={handleSystemInputChange}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    placeholder={
                      systemUserForm.id
                        ? "Leave blank to keep existing password"
                        : "Create password"
                    }
                  />
                </label>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeUserModal}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#7dc242] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6cae3c] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? <Spinner /> : null}
                    {isSubmitting
                      ? "Saving..."
                      : systemUserForm.id
                      ? "Update User"
                      : "Create User"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {passwordModalAccount ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!activeActionsLocked) {
                setPasswordModalAccount(null);
                setNextPassword("");
              }
            }}
          >
            <section
              className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900">Reset Password</h3>
              <p className="mt-1 text-sm text-slate-500">
                Set a new password for <span className="font-semibold text-slate-700">{passwordModalAccount.name}</span>.
              </p>

              <label className="mt-4 block text-sm font-semibold text-slate-700">
                New password
                <input
                  type="password"
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  placeholder="Enter new password"
                />
              </label>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={activeActionsLocked}
                  onClick={() => {
                    setPasswordModalAccount(null);
                    setNextPassword("");
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={activeActionsLocked}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#7dc242] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6cae3c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeActionsLocked ? <Spinner /> : null}
                  Reset Password
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {deleteModalAccount ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!activeActionsLocked) {
                setDeleteModalAccount(null);
              }
            }}
          >
            <section
              className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900">Delete User</h3>
              <p className="mt-1 text-sm text-slate-500">
                This action permanently removes <span className="font-semibold text-slate-700">{deleteModalAccount.name}</span> from system users.
              </p>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={activeActionsLocked}
                  onClick={() => setDeleteModalAccount(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={activeActionsLocked}
                  onClick={handleDeleteSystemUser}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeActionsLocked ? <Spinner /> : null}
                  Delete User
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </DashboardLayout>
  );
}

export default Users;
