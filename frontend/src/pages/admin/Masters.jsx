import { useMemo, useRef, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import useSchoolData from "../../hooks/useSchoolData";

const TAB_CONFIG = [
  {
    id: "classes",
    label: "Classes",
    singular: "Class",
    placeholder: "Enter class name (for example: 10)",
    description: "Manage class masters used in admissions and teacher assignment.",
    linkedLabel: "Students",
  },
  {
    id: "subjects",
    label: "Subjects",
    singular: "Subject",
    placeholder: "Enter subject name",
    description: "Create subjects and assign them while managing teachers.",
    linkedLabel: "Teachers",
  },
  {
    id: "departments",
    label: "Departments",
    singular: "Department",
    placeholder: "Enter department name",
    description: "Maintain departments for structured teacher mapping.",
    linkedLabel: "Teachers",
  },
];

const TAB_CONFIG_BY_ID = TAB_CONFIG.reduce((accumulator, entry) => {
  accumulator[entry.id] = entry;
  return accumulator;
}, {});

const INITIAL_SEARCH_BY_TAB = {
  classes: "",
  subjects: "",
  departments: "",
};

const INITIAL_FILTER_BY_TAB = {
  classes: "all",
  subjects: "all",
  departments: "all",
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const toSubjectList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const toTeacherSubjectList = (teacher) =>
  [...new Set([...toSubjectList(teacher?.subjects), ...toSubjectList(teacher?.subject)])];

const emptyStatus = () => ({ type: "", message: "" });

const emptyEditorModal = () => ({
  open: false,
  mode: "add",
  tab: "classes",
  currentValue: "",
  inputValue: "",
  submitting: false,
});

const emptyDeleteModal = () => ({
  open: false,
  tab: "classes",
  value: "",
  submitting: false,
});

function IconSearch({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20L16.5 16.5" />
    </svg>
  );
}

function IconPlus({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5V19" />
      <path d="M5 12H19" />
    </svg>
  );
}

function IconEdit({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 17.25V21H6.75L18.81 8.94L15.06 5.19L3 17.25Z" />
      <path d="M14.12 6.12L17.87 9.87" />
    </svg>
  );
}

function IconTrash({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7H20" />
      <path d="M9 7V5H15V7" />
      <path d="M6 7L7 20H17L18 7" />
      <path d="M10 11V17" />
      <path d="M14 11V17" />
    </svg>
  );
}

function IconBook({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4H18C19.1 4 20 4.9 20 6V20L17 18L14 20L11 18L8 20L5 18V4Z" />
      <path d="M8 8H16" />
      <path d="M8 12H16" />
    </svg>
  );
}

function IconGrid({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function IconFlask({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3H15" />
      <path d="M10 3V9L4.5 18.5C3.8 19.7 4.7 21 6.1 21H17.9C19.3 21 20.2 19.7 19.5 18.5L14 9V3" />
      <path d="M8 14H16" />
    </svg>
  );
}

function IconUsers({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21V19C16 17.3 14.7 16 13 16H5C3.3 16 2 17.3 2 19V21" />
      <circle cx="9" cy="9" r="3" />
      <path d="M22 21V19C22 17.6 21.1 16.4 19.8 16" />
      <path d="M16.5 6.2C17.4 6.6 18 7.5 18 8.5C18 9.5 17.4 10.4 16.5 10.8" />
    </svg>
  );
}

const tabIconById = {
  classes: IconBook,
  subjects: IconFlask,
  departments: IconUsers,
};

const cardToneById = {
  classes: {
    icon: "bg-emerald-50 text-emerald-700",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  subjects: {
    icon: "bg-emerald-50 text-emerald-700",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  departments: {
    icon: "bg-emerald-50 text-emerald-700",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

function Masters() {
  const {
    schoolData,
    createClass,
    createDepartment,
    createSubject,
    deleteClass,
    deleteDepartment,
    deleteSubject,
    renameClass,
    renameDepartment,
    renameSubject,
  } = useSchoolData();
  const { classes = [], departments = [], students = [], subjects = [], teachers = [] } = schoolData;

  const [activeTab, setActiveTab] = useState("classes");
  const [searchByTab, setSearchByTab] = useState(INITIAL_SEARCH_BY_TAB);
  const [filterByTab, setFilterByTab] = useState(INITIAL_FILTER_BY_TAB);
  const [status, setStatus] = useState(emptyStatus());
  const [editorModal, setEditorModal] = useState(emptyEditorModal());
  const [deleteModal, setDeleteModal] = useState(emptyDeleteModal());
  const detailPanelRef = useRef(null);
  const detailHeadingRef = useRef(null);

  const focusActiveContentPanel = () => {
    detailPanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    detailHeadingRef.current?.focus();
  };

  const handleDashboardCardClick = (tabId) => {
    setActiveTab(tabId);

    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(focusActiveContentPanel);
      return;
    }

    focusActiveContentPanel();
  };

  const tabItems = useMemo(
    () => ({
      classes,
      subjects,
      departments,
    }),
    [classes, departments, subjects]
  );

  const classStudentCountMap = useMemo(() => {
    const map = new Map();
    students.forEach((student) => {
      const key = normalizeText(student.className);
      if (!key) {
        return;
      }
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [students]);

  

  const subjectTeacherCountMap = useMemo(() => {
    const map = new Map();
    teachers.forEach((teacher) => {
      toTeacherSubjectList(teacher).forEach((subject) => {
        const key = normalizeText(subject);
        if (!key) {
          return;
        }

        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return map;
  }, [teachers]);

  const departmentTeacherCountMap = useMemo(() => {
    const map = new Map();
    teachers.forEach((teacher) => {
      const key = normalizeText(teacher.department);
      if (!key) {
        return;
      }
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [teachers]);

  const getLinkedCount = (tabId, value) => {
    const key = normalizeText(value);

    if (!key) {
      return 0;
    }

    if (tabId === "classes") {
      return classStudentCountMap.get(key) || 0;
    }

    

    if (tabId === "subjects") {
      return subjectTeacherCountMap.get(key) || 0;
    }

    if (tabId === "departments") {
      return departmentTeacherCountMap.get(key) || 0;
    }

    return 0;
  };

  const currentConfig = TAB_CONFIG_BY_ID[activeTab] || TAB_CONFIG[0];
  const currentItems = tabItems[activeTab] || [];
  const currentSearchTerm = searchByTab[activeTab] || "";
  const currentFilter = filterByTab[activeTab] || "all";

  const searchText = normalizeText(currentSearchTerm);
  const filteredItems = currentItems.filter((entry) => {
    const label = String(entry || "").trim();
    if (!label) {
      return false;
    }

    if (searchText && !normalizeText(label).includes(searchText)) {
      return false;
    }

    const linkedCount = getLinkedCount(activeTab, label);
    if (currentFilter === "in-use" && linkedCount === 0) {
      return false;
    }

    if (currentFilter === "unused" && linkedCount > 0) {
      return false;
    }

    return true;
  });

  const actionMapByTab = {
    classes: {
      create: createClass,
      rename: renameClass,
      remove: deleteClass,
    },
    subjects: {
      create: createSubject,
      rename: renameSubject,
      remove: deleteSubject,
    },
    departments: {
      create: createDepartment,
      rename: renameDepartment,
      remove: deleteDepartment,
    },
  };

  const openAddModal = (tabId) => {
    setStatus(emptyStatus());
    setEditorModal({
      open: true,
      mode: "add",
      tab: tabId,
      currentValue: "",
      inputValue: "",
      submitting: false,
    });
  };

  const openEditModal = (tabId, value) => {
    setStatus(emptyStatus());
    setEditorModal({
      open: true,
      mode: "edit",
      tab: tabId,
      currentValue: value,
      inputValue: value,
      submitting: false,
    });
  };

  const closeEditorModal = () => {
    if (editorModal.submitting) {
      return;
    }

    setEditorModal(emptyEditorModal());
  };

  const saveModalEntry = async (event) => {
    event.preventDefault();

    const tabId = editorModal.tab;
    const config = TAB_CONFIG_BY_ID[tabId];
    const actions = actionMapByTab[tabId];
    const nextValue = String(editorModal.inputValue || "").trim();

    if (!config || !actions) {
      return;
    }

    if (!nextValue) {
      setStatus({
        type: "error",
        message: `Enter a ${config.singular.toLowerCase()} name.`,
      });
      return;
    }

    setEditorModal((current) => ({ ...current, submitting: true }));
    setStatus(emptyStatus());

    try {
      if (editorModal.mode === "add") {
        await actions.create(nextValue);
        setStatus({
          type: "success",
          message: `${config.singular} ${nextValue} created successfully.`,
        });
      } else {
        await actions.rename(editorModal.currentValue, nextValue);
        setStatus({
          type: "success",
          message: `${config.singular} renamed to ${nextValue}.`,
        });
      }

      setEditorModal(emptyEditorModal());
    } catch (saveError) {
      setStatus({ type: "error", message: saveError.message });
      setEditorModal((current) => ({ ...current, submitting: false }));
    }
  };

  const openDeleteConfirm = (tabId, value) => {
    setStatus(emptyStatus());
    setDeleteModal({
      open: true,
      tab: tabId,
      value,
      submitting: false,
    });
  };

  const closeDeleteModal = () => {
    if (deleteModal.submitting) {
      return;
    }

    setDeleteModal(emptyDeleteModal());
  };

  const confirmDelete = async () => {
    const tabId = deleteModal.tab;
    const config = TAB_CONFIG_BY_ID[tabId];
    const actions = actionMapByTab[tabId];

    if (!config || !actions) {
      return;
    }

    setDeleteModal((current) => ({ ...current, submitting: true }));
    setStatus(emptyStatus());

    try {
      await actions.remove(deleteModal.value);
      setDeleteModal(emptyDeleteModal());
      setStatus({
        type: "success",
        message: `${config.singular} ${deleteModal.value} deleted successfully.`,
      });
    } catch (deleteError) {
      setStatus({ type: "error", message: deleteError.message });
      setDeleteModal((current) => ({ ...current, submitting: false }));
    }
  };

  const dashboardCards = TAB_CONFIG.map((config) => {
    const items = tabItems[config.id] || [];
    const linkedTotal = items.reduce(
      (total, entry) => total + getLinkedCount(config.id, entry),
      0
    );

    return {
      ...config,
      total: items.length,
      linkedTotal,
    };
  });

  return (
    <DashboardLayout>
      <section className="-mx-4 -mt-4 bg-[linear-gradient(180deg,#eff8e9_0%,#e7f4df_100%)] px-4 py-4 sm:-mx-5 sm:-mt-5 sm:px-5 sm:py-5 md:-mx-6 md:-mt-6 md:px-6 md:py-6">
        <header className="mb-4 rounded-2xl bg-white/95 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">Academic Setup</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Manage classes, subjects, and departments through a clean tabbed workflow.
          </p>
        </header>

        {status.type === "success" ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 shadow-sm">
            {status.message}
          </div>
        ) : null}

        {status.type === "error" ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 shadow-sm">
            {status.message}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardCards.map((card) => {
            const TabIcon = tabIconById[card.id] || IconGrid;
            const isActive = activeTab === card.id;
            const tone = cardToneById[card.id] || cardToneById.classes;

            return (
              <button
                type="button"
                key={card.id}
                onClick={() => handleDashboardCardClick(card.id)}
                className={`group rounded-2xl border bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 ${
                  isActive
                    ? "border-emerald-300 ring-2 ring-emerald-100"
                    : "border-lime-200 hover:border-lime-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex rounded-xl p-2 transition group-hover:scale-105 ${tone.icon}`}
                  >
                    <TabIcon />
                  </span>

                  <span
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${tone.badge}`}
                  >
                    View All
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-semibold text-slate-900">{card.label}</h2>
                <p className="mt-1 text-sm text-slate-600">Total: {card.total}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {card.linkedLabel}: {card.linkedTotal}
                </p>
              </button>
            );
          })}
        </div>

        <section
          ref={detailPanelRef}
          className="mt-3 overflow-hidden rounded-2xl bg-white/95 shadow-sm"
        >
          <div className="border-b border-lime-200 bg-white p-2">
            <div className="flex flex-wrap gap-2">
              {TAB_CONFIG.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setActiveTab(entry.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 ${
                    activeTab === entry.id
                      ? "bg-[var(--portal-primary)] text-white shadow"
                      : "bg-[#eef5e9] text-slate-700 hover:-translate-y-0.5 hover:bg-[#e2edd9]"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3
                ref={detailHeadingRef}
                tabIndex={-1}
                className="text-2xl font-bold text-slate-900 focus:outline-none"
              >
                {currentConfig.label}
              </h3>
              <p className="mt-1 text-sm text-slate-500">{currentConfig.description}</p>
            </div>

            <button
              type="button"
              onClick={() => openAddModal(activeTab)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <IconPlus />
              Add {currentConfig.singular}
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative w-full lg:max-w-sm">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <IconSearch />
              </span>
              <input
                value={currentSearchTerm}
                onChange={(event) =>
                  setSearchByTab((current) => ({
                    ...current,
                    [activeTab]: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder={`Search ${currentConfig.label.toLowerCase()}...`}
              />
            </label>

            <select
              value={currentFilter}
              onChange={(event) =>
                setFilterByTab((current) => ({
                  ...current,
                  [activeTab]: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Entries</option>
              <option value="in-use">In Use</option>
              <option value="unused">Unused</option>
            </select>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-lime-200">
            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="sticky top-0 z-10 bg-slate-100 px-4 py-3 text-left font-semibold">
                    {currentConfig.singular}
                  </th>
                  <th className="sticky top-0 z-10 bg-slate-100 px-4 py-3 text-left font-semibold">
                    {currentConfig.linkedLabel}
                  </th>
                  <th className="sticky top-0 z-10 bg-slate-100 px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                {filteredItems.length ? (
                  filteredItems.map((entry) => {
                    const linkedCount = getLinkedCount(activeTab, entry);

                    return (
                      <tr
                        key={entry}
                        className="transition hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{entry}</td>
                        <td className="px-4 py-3 text-slate-600">{linkedCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(activeTab, entry)}
                              className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              title={`Edit ${currentConfig.singular}`}
                              aria-label={`Edit ${currentConfig.singular} ${entry}`}
                            >
                              <IconEdit />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteConfirm(activeTab, entry)}
                              className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                              title={`Delete ${currentConfig.singular}`}
                              aria-label={`Delete ${currentConfig.singular} ${entry}`}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center" colSpan={3}>
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                        <span className="inline-flex rounded-full bg-slate-100 p-3 text-slate-500">
                          <IconSearch className="h-5 w-5" />
                        </span>
                        <p className="text-sm font-medium text-slate-700">
                          No {currentConfig.label.toLowerCase()} found.
                        </p>
                        <p className="text-xs text-slate-500">
                          Try a different search/filter or add a new {currentConfig.singular.toLowerCase()}.
                        </p>
                        <button
                          type="button"
                          onClick={() => openAddModal(activeTab)}
                          className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Add {currentConfig.singular}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
      </section>

      {editorModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h4 className="text-xl font-semibold text-slate-900">
              {editorModal.mode === "add" ? "Add" : "Edit"} {TAB_CONFIG_BY_ID[editorModal.tab].singular}
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Keep your academic setup clean and consistent.
            </p>

            <form onSubmit={saveModalEntry} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                {TAB_CONFIG_BY_ID[editorModal.tab].singular} Name
                <input
                  value={editorModal.inputValue}
                  onChange={(event) =>
                    setEditorModal((current) => ({
                      ...current,
                      inputValue: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={TAB_CONFIG_BY_ID[editorModal.tab].placeholder}
                  autoFocus
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditorModal}
                  disabled={editorModal.submitting}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editorModal.submitting}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {editorModal.submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h4 className="text-xl font-semibold text-slate-900">Delete Confirmation</h4>
            <p className="mt-2 text-sm text-slate-600">
              Delete {TAB_CONFIG_BY_ID[deleteModal.tab].singular.toLowerCase()} <strong>{deleteModal.value}</strong>?
              This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteModal.submitting}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteModal.submitting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-400"
              >
                {deleteModal.submitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      </section>
    </DashboardLayout>
  );
}

export default Masters;
