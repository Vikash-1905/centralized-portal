export const AUTH_STORAGE_KEY = "school_crm_auth";

export const ROLE_HOME_ROUTES = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
  crm: "/crm",
};

export const ROLE_LABELS = {
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
  crm: "CRM",
};

export const getDefaultRouteForRole = (role) => ROLE_HOME_ROUTES[role] || "/login";
