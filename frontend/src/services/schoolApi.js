import { createInitialSchoolData } from "../data/schoolSeed";
import api from "./api";

const asSchoolState = (data) => {
  if (data && typeof data === "object") {
    return data;
  }

  return createInitialSchoolData();
};

const getErrorMessage = (error, fallbackMessage) =>
  error.response?.data?.message || error.message || fallbackMessage;

const stateRequest = async (requestFn, fallbackMessage) => {
  try {
    const response = await requestFn();
    return asSchoolState(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error, fallbackMessage));
  }
};

export const fetchSchoolState = async () => {
  return stateRequest(() => api.get("/state"), "Unable to load school state");
};

export const fetchEnquiries = async () => {
  try {
    const response = await api.get("/enquiries");
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load enquiries"));
  }
};

export const updateEnquiryStage = async (enquiryId, stage) =>
  stateRequest(
    () =>
      api.put(`/enquiries/${encodeURIComponent(enquiryId)}/stage`, {
        stage,
      }),
    "Unable to update enquiry stage"
  );

export const fetchStudentDashboard = async (email) => {
  const encodedEmail = encodeURIComponent(String(email || "").trim());
  if (!encodedEmail) {
    throw new Error("Student email is required to load dashboard");
  }

  try {
    const response = await api.get(`/students/${encodedEmail}/dashboard`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load student dashboard"));
  }
};

export const fetchParentDashboard = async (email) => {
  const encodedEmail = encodeURIComponent(String(email || "").trim());
  if (!encodedEmail) {
    throw new Error("Parent email is required to load dashboard");
  }

  try {
    const response = await api.get(`/parents/${encodedEmail}/dashboard`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load parent dashboard"));
  }
};

export const sendParentMessage = async (payload) => {
  try {
    const response = await api.post("/messages", payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to send message"));
  }
};

export const fetchParentMessages = async (parentId) => {
  try {
    const response = await api.get(`/messages/${encodeURIComponent(parentId)}`);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load messages"));
  }
};

export const resetRemoteSchoolState = async () => {
  return stateRequest(() => api.post("/state/reset"), "Unable to reset school state");
};

export const cleanupOrphanedData = async () => {
  return stateRequest(
    () => api.post("/state/cleanup-orphaned"),
    "Unable to cleanup orphaned data"
  );
};

export const addSubjectMaster = async (name) =>
  stateRequest(() => api.post("/masters/subjects", { name }), "Unable to create subject");

export const addClassMaster = async (name) =>
  stateRequest(() => api.post("/masters/classes", { name }), "Unable to create class");

export const renameClassMaster = async (currentName, name) =>
  stateRequest(
    () =>
      api.put(`/masters/classes/${encodeURIComponent(currentName)}`, {
        name,
      }),
    "Unable to rename class"
  );

export const deleteClassMaster = async (name) =>
  stateRequest(
    () => api.delete(`/masters/classes/${encodeURIComponent(name)}`),
    "Unable to delete class"
  );

export const renameSubjectMaster = async (currentName, name) =>
  stateRequest(
    () =>
      api.put(`/masters/subjects/${encodeURIComponent(currentName)}`, {
        name,
      }),
    "Unable to rename subject"
  );

export const deleteSubjectMaster = async (name) =>
  stateRequest(
    () => api.delete(`/masters/subjects/${encodeURIComponent(name)}`),
    "Unable to delete subject"
  );

export const addDepartmentMaster = async (name) =>
  stateRequest(
    () => api.post("/masters/departments", { name }),
    "Unable to create department"
  );

export const renameDepartmentMaster = async (currentName, name) =>
  stateRequest(
    () =>
      api.put(`/masters/departments/${encodeURIComponent(currentName)}`, {
        name,
      }),
    "Unable to rename department"
  );

export const deleteDepartmentMaster = async (name) =>
  stateRequest(
    () => api.delete(`/masters/departments/${encodeURIComponent(name)}`),
    "Unable to delete department"
  );

export const upsertTeacher = async (teacher) =>
  stateRequest(() => api.post("/teachers/upsert", teacher), "Unable to save teacher");

export const removeTeacher = async (teacherId) =>
  stateRequest(
    () => api.delete(`/teachers/${encodeURIComponent(teacherId)}`),
    "Unable to delete teacher"
  );

export const resetTeacherCredential = async (teacherId, password) =>
  stateRequest(
    () =>
      api.post(`/teachers/${encodeURIComponent(teacherId)}/reset-password`, {
        password,
      }),
    "Unable to reset teacher password"
  );

export const uploadStudentDocument = async (file, documentType = "document") => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);

    const response = await api.post("/uploads/student-document", formData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to upload student document"));
  }
};

export const upsertStudent = async (student) =>
  stateRequest(() => api.post("/students/upsert", student), "Unable to save student");

export const removeStudent = async (studentId) =>
  stateRequest(
    () => api.delete(`/students/${encodeURIComponent(studentId)}`),
    "Unable to delete student"
  );

export const upsertEnquiry = async (enquiry) =>
  stateRequest(() => api.post("/enquiries/upsert", enquiry), "Unable to save enquiry");

export const removeEnquiry = async (enquiryId) =>
  stateRequest(
    () => api.delete(`/enquiries/${encodeURIComponent(enquiryId)}`),
    "Unable to delete enquiry"
  );

export const convertEnquiryToStudent = async (enquiryId) =>
  stateRequest(
    () => api.post(`/enquiries/${encodeURIComponent(enquiryId)}/convert`),
    "Unable to start enquiry conversion"
  );

export const upsertAttendance = async (payload) =>
  stateRequest(
    () => api.post("/attendance/upsert", payload),
    "Unable to save attendance"
  );

export const upsertResult = async (payload) =>
  stateRequest(() => api.post("/results/upsert", payload), "Unable to save result");

export const upsertNotice = async (payload) =>
  stateRequest(() => api.post("/notices/upsert", payload), "Unable to save notice");

export const removeNotice = async (noticeId) =>
  stateRequest(
    () => api.delete(`/notices/${encodeURIComponent(noticeId)}`),
    "Unable to delete notice"
  );

export const upsertSystemUser = async (payload) =>
  stateRequest(
    () => api.post("/users/system-upsert", payload),
    "Unable to save user account"
  );

export const removeSystemUser = async (userId) =>
  stateRequest(
    () => api.delete(`/users/system/${encodeURIComponent(userId)}`),
    "Unable to delete user account"
  );

export const updateAccountStatus = async (role, id, status) =>
  stateRequest(
    () =>
      api.post(`/users/accounts/${encodeURIComponent(role)}/${encodeURIComponent(id)}/status`, {
        status,
      }),
    "Unable to update account status"
  );

export const resetAccountPassword = async (role, id, password) =>
  stateRequest(
    () =>
      api.post(
        `/users/accounts/${encodeURIComponent(role)}/${encodeURIComponent(id)}/reset-password`,
        {
          password,
        }
      ),
    "Unable to reset account password"
  );

export const fetchAdminSettings = async () => {
  try {
    const response = await api.get("/admin/settings");
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load admin settings"));
  }
};

export const saveAdminSettings = async (settings) => {
  try {
    const response = await api.put("/admin/settings", settings);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to save admin settings"));
  }
};

export const fetchCurrentUser = async () => {
  try {
    const response = await api.get("/auth/me");
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to validate session"));
  }
};

export const fetchSetupStatus = async () => {
  try {
    const response = await api.get("/auth/setup-status");
    const hasAdmin = Boolean(response.data?.hasAdmin);

    return {
      hasAdmin,
      requiresAdminSetup: Boolean(response.data?.requiresAdminSetup ?? !hasAdmin),
    };
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to fetch setup status"));
  }
};

export const setupAdmin = async ({ name, email, password }) => {
  try {
    const response = await api.post("/auth/setup-admin", {
      name,
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to setup admin"));
  }
};

export const signupSchoolAdmin = async ({
  schoolName,
  adminName,
  email,
  password,
  phone,
  address,
}) => {
  try {
    const response = await api.post("/auth/signup", {
      schoolName,
      adminName,
      email,
      password,
      phone,
      address,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to create school account"));
  }
};

export const loginUser = async (email, password) => {
  try {
    const response = await api.post("/auth/login", { email, password });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to login"));
  }
};

/**
 * Upload Excel file for bulk student import
 * Returns validation results with valid and invalid rows
 */
export const uploadBulkStudentExcel = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/students/bulk-upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to upload Excel file. Please check the file format.")
    );
  }
};

/**
 * Confirm and import validated students from bulk upload
 */
export const confirmBulkStudentImport = async (students) => {
  try {
    const response = await api.post("/students/bulk-import", { students });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to import students"));
  }
};

export const fetchStudentsSearch = async (q, page = 1, pageSize = 25, options = {}) => {
  try {
    const params = new URLSearchParams();
    if (q) params.append("q", String(q || ""));
    params.append("page", String(page));
    params.append("pageSize", String(pageSize));

    if (options.sortBy) params.append("sortBy", String(options.sortBy));
    if (options.sortOrder) params.append("sortOrder", String(options.sortOrder));
    if (options.className) params.append("className", String(options.className));
    if (options.status) params.append("status", String(options.status));
    if (options.admissionSource) params.append("admissionSource", String(options.admissionSource));

    const response = await api.get(`/students/search?${params.toString()}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to search students"));
  }
};

export const fetchStudentsFilterCounts = async () => {
  try {
    const response = await api.get("/students/filters");
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load student filter counts"));
  }
};
