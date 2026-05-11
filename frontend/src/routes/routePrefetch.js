const ROUTE_PREFETCH_LOADERS = {
  "/": () => import("../pages/Login"),
  "/login": () => import("../pages/Login"),

  "/admin": () => import("../pages/admin/AdminDashboard"),
  "/admin/students": () => import("../pages/admin/Students"),
  "/admin/students/:studentId": () => import("../pages/admin/StudentProfile"),
  "/admin/users": () => import("../pages/admin/Users"),
  "/admin/teachers": () => import("../pages/admin/Teachers"),
  "/admin/teachers/:teacherId": () => import("../pages/admin/TeacherProfile"),
  "/admin/classes-subjects": () => import("../pages/admin/Masters"),
  "/admin/attendance": () => import("../pages/admin/AttendanceOverview"),
  "/admin/fees": () => import("../pages/admin/FeesManagement"),
  "/admin/notifications": () => import("../pages/admin/Notifications"),
  "/admin/reports": () => import("../pages/admin/Reports"),
  "/admin/settings": () => import("../pages/admin/Settings"),

  "/teacher": () => import("../pages/teacher/TeacherDashboard"),
  "/teacher/attendance": () => import("../pages/teacher/TeacherAttendance"),
  "/teacher/marks": () => import("../pages/teacher/TeacherMarks"),
  "/teacher/assignments": () => import("../pages/teacher/TeacherAssignments"),
  "/teacher/students": () => import("../pages/teacher/TeacherStudents"),

  "/student": () => import("../pages/student/StudentDashboard"),
  "/student/results": () => import("../pages/student/StudentResults"),
  "/student/attendance": () => import("../pages/student/StudentAttendance"),
  "/student/assignments": () => import("../pages/student/StudentAssignments"),
  "/student/fees": () => import("../pages/student/StudentFees"),

  "/parent": () => import("../pages/parent/ParentDashboard"),
  "/parent/attendance": () => import("../pages/parent/ParentAttendance"),
  "/parent/fees": () => import("../pages/parent/ParentFees"),
  "/parent/communication": () => import("../pages/parent/ParentCommunication"),

  "/crm": () => import("../pages/crm/CRMDashboard"),
};

const ROLE_PREFETCH_ROUTES = {
  admin: ["/admin/students", "/crm", "/admin/teachers"],
  crm: ["/crm", "/admin/students"],
  teacher: ["/teacher/attendance", "/teacher/students", "/teacher/marks"],
  student: ["/student/results", "/student/attendance", "/student/assignments"],
  parent: ["/parent/attendance", "/parent/communication"],
};

const prefetchedRoutes = new Set();

const normalizePath = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  return raw.split("?")[0].split("#")[0];
};

const getConnection = () => {
  if (typeof navigator === "undefined") {
    return null;
  }

  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
};

export const shouldSkipPrefetchByConnection = () => {
  const connection = getConnection();
  if (!connection) {
    return false;
  }

  const effectiveType = String(connection.effectiveType || "").toLowerCase();
  return Boolean(connection.saveData) || effectiveType.includes("2g");
};

export const getPrefetchRoutesForRole = (role) => {
  const normalizedRole = String(role || "").toLowerCase();
  return ROLE_PREFETCH_ROUTES[normalizedRole] || [];
};

export const prefetchRoute = async (path, options = {}) => {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) {
    return false;
  }

  const force = Boolean(options.force);
  if (!force && shouldSkipPrefetchByConnection()) {
    return false;
  }

  const loader = ROUTE_PREFETCH_LOADERS[normalizedPath];
  if (!loader) {
    return false;
  }

  if (prefetchedRoutes.has(normalizedPath)) {
    return false;
  }

  prefetchedRoutes.add(normalizedPath);

  try {
    await loader();
    return true;
  } catch {
    prefetchedRoutes.delete(normalizedPath);
    return false;
  }
};

export const prefetchRoutes = (paths, options = {}) => {
  if (!Array.isArray(paths) || !paths.length) {
    return;
  }

  paths.forEach((path) => {
    void prefetchRoute(path, options);
  });
};
