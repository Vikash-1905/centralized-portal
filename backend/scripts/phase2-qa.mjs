import "dotenv/config";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const PORT = Number(process.env.PORT || 5000);
const API_BASE = process.env.QA_API_BASE_URL || `http://localhost:${PORT}/api`;
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");
const HEALTH_ENDPOINT = `${API_BASE}/health`;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/school-crm";
const JWT_SECRET = process.env.JWT_SECRET || "school-crm-dev-secret-change-this";
const SERVER_BOOT_TIMEOUT_MS = Number(process.env.QA_SERVER_BOOT_TIMEOUT_MS || 20000);

const STATUS_PASS = "PASS";
const STATUS_FAIL = "FAIL";
const STATUS_INFO = "INFO";

const results = [];

const addResult = (name, status, detail = "") => {
  results.push({ name, status, detail });
};

const pass = (name, detail = "") => addResult(name, STATUS_PASS, detail);
const fail = (name, detail = "") => addResult(name, STATUS_FAIL, detail);
const info = (name, detail = "") => addResult(name, STATUS_INFO, detail);

const readJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 1500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const isHealthOk = async () => {
  try {
    const response = await fetchWithTimeout(HEALTH_ENDPOINT, {}, 1500);
    if (!response.ok) {
      return false;
    }

    const body = await readJsonSafe(response);
    return Boolean(body?.ok);
  } catch {
    return false;
  }
};

const authRequest = async (token, path, options = {}) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const hasBody = options.body !== undefined;
  const isFormDataBody =
    hasBody &&
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;
  const shouldSerializeJson = hasBody && !isFormDataBody && typeof options.body !== "string";
  const body = shouldSerializeJson ? JSON.stringify(options.body) : options.body;

  if (shouldSerializeJson && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body,
  });
};

const toAbsoluteUrl = (pathOrUrl = "") => {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `${API_ORIGIN}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

const startManagedServer = async () => {
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let outputBuffer = "";
  child.stdout?.on("data", (chunk) => {
    outputBuffer += String(chunk || "");
  });
  child.stderr?.on("data", (chunk) => {
    outputBuffer += String(chunk || "");
  });

  const startTime = Date.now();
  while (Date.now() - startTime < SERVER_BOOT_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      throw new Error(
        `Backend exited during QA bootstrap (code=${child.exitCode}). Logs:\n${outputBuffer}`
      );
    }

    // Poll until backend is available.
    if (await isHealthOk()) {
      return child;
    }

    await delay(400);
  }

  child.kill();
  throw new Error(`Timed out waiting for backend to boot. Logs:\n${outputBuffer}`);
};

const stopManagedServer = async (child) => {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill();

  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (child.exitCode !== null) {
      return;
    }
    await delay(100);
  }

  child.kill("SIGKILL");
};

let managedServer = null;
let token = "";
let originalSettings = null;
let settingsMutated = false;
let tempNoticeId = "";
let tempSystemUserId = "";
let tempClassName = "";
let tempSectionName = "";
let tempStudentId = "";
let tempStudentDocumentPath = "";

try {
  if (await isHealthOk()) {
    info("Backend bootstrap", "Using already-running backend instance");
  } else {
    managedServer = await startManagedServer();
    pass("Backend bootstrap", "Started backend for QA run");
  }

  await mongoose.connect(MONGO_URI);
  const usersCollection = mongoose.connection.collection("users");
  const admin = await usersCollection.findOne({
    role: "admin",
    status: { $ne: "Inactive" },
  });

  if (!admin?.id || !admin?.email) {
    throw new Error("No active admin account found. Create admin first, then rerun QA.");
  }

  token = jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: "admin",
    },
    JWT_SECRET,
    { expiresIn: "30m" }
  );
  pass("Auth bootstrap", `admin=${admin.email}`);

  const settingsGetResponse = await authRequest(token, "/admin/settings");
  const settingsGetBody = await readJsonSafe(settingsGetResponse);
  if (!settingsGetResponse.ok || !settingsGetBody) {
    fail("Settings GET", `status=${settingsGetResponse.status}`);
  } else {
    originalSettings = settingsGetBody;
    pass("Settings GET", "received settings payload");
  }

  if (originalSettings) {
    const qaSchoolCode = `${originalSettings.schoolCode || "CS-01"}-QA`;
    const settingsPutResponse = await authRequest(token, "/admin/settings", {
      method: "PUT",
      body: {
        ...originalSettings,
        schoolCode: qaSchoolCode,
      },
    });
    const settingsPutBody = await readJsonSafe(settingsPutResponse);

    if (!settingsPutResponse.ok || !settingsPutBody) {
      fail("Settings PUT", `status=${settingsPutResponse.status}`);
    } else if (settingsPutBody.schoolCode !== qaSchoolCode) {
      fail("Settings PUT", "schoolCode did not update");
    } else {
      settingsMutated = true;
      pass("Settings PUT", "settings update accepted");
    }

    const settingsRevertResponse = await authRequest(token, "/admin/settings", {
      method: "PUT",
      body: originalSettings,
    });
    if (!settingsRevertResponse.ok) {
      fail("Settings revert", `status=${settingsRevertResponse.status}`);
    } else {
      settingsMutated = false;
      pass("Settings revert", "restored original settings");
    }
  }

  const noticeTitle = `QA Notice ${Date.now()}`;
  const createNoticeResponse = await authRequest(token, "/notices/upsert", {
    method: "POST",
    body: {
      title: noticeTitle,
      message: "Automated phase-2 QA notice",
      audience: ["all"],
      date: new Date().toISOString().slice(0, 10),
      status: "Published",
    },
  });
  const createNoticeBody = await readJsonSafe(createNoticeResponse);

  if (!createNoticeResponse.ok || !createNoticeBody) {
    fail("Notice create", `status=${createNoticeResponse.status}`);
  } else {
    const notice = Array.isArray(createNoticeBody.notices)
      ? createNoticeBody.notices.find((entry) => entry.title === noticeTitle)
      : null;

    if (!notice?.id) {
      fail("Notice create", "created notice id not found");
    } else {
      tempNoticeId = notice.id;
      pass("Notice create", `id=${tempNoticeId}`);
    }
  }

  const listNoticeResponse = await authRequest(token, "/notices");
  const listNoticeBody = await readJsonSafe(listNoticeResponse);

  if (!listNoticeResponse.ok || !Array.isArray(listNoticeBody)) {
    fail("Notice list", `status=${listNoticeResponse.status}`);
  } else {
    const exists = tempNoticeId
      ? listNoticeBody.some((entry) => entry.id === tempNoticeId)
      : false;

    if (tempNoticeId && !exists) {
      fail("Notice list", "new notice missing from list");
    } else {
      pass("Notice list", `count=${listNoticeBody.length}`);
    }
  }

  if (tempNoticeId) {
    const deleteNoticeResponse = await authRequest(
      token,
      `/notices/${encodeURIComponent(tempNoticeId)}`,
      { method: "DELETE" }
    );
    const deleteNoticeBody = await readJsonSafe(deleteNoticeResponse);

    if (!deleteNoticeResponse.ok || !deleteNoticeBody) {
      fail("Notice delete", `status=${deleteNoticeResponse.status}`);
    } else {
      const stillExists = Array.isArray(deleteNoticeBody.notices)
        ? deleteNoticeBody.notices.some((entry) => entry.id === tempNoticeId)
        : false;

      if (stillExists) {
        fail("Notice delete", "notice still present after delete");
      } else {
        pass("Notice delete", `removed id=${tempNoticeId}`);
        tempNoticeId = "";
      }
    }
  }

  const listUsersResponse = await authRequest(token, "/users/accounts");
  const listUsersBody = await readJsonSafe(listUsersResponse);
  if (!listUsersResponse.ok || !Array.isArray(listUsersBody)) {
    fail("Users accounts list", `status=${listUsersResponse.status}`);
  } else {
    pass("Users accounts list", `count=${listUsersBody.length}`);
  }

  const tempEmail = `qa.crm.${Date.now()}@schoolcrm.com`;
  const createSystemUserResponse = await authRequest(token, "/users/system-upsert", {
    method: "POST",
    body: {
      name: "QA CRM User",
      email: tempEmail,
      role: "crm",
      password: "QaTemp#123",
      status: "Active",
    },
  });
  const createSystemUserBody = await readJsonSafe(createSystemUserResponse);

  if (!createSystemUserResponse.ok || !createSystemUserBody) {
    fail("System user create", `status=${createSystemUserResponse.status}`);
  } else {
    const createdUser = Array.isArray(createSystemUserBody.users)
      ? createSystemUserBody.users.find(
          (entry) => String(entry.email || "").toLowerCase() === tempEmail
        )
      : null;

    if (!createdUser?.id) {
      fail("System user create", "created user not found in state response");
    } else {
      tempSystemUserId = createdUser.id;
      pass("System user create", `id=${tempSystemUserId}`);
    }
  }

  if (tempSystemUserId) {
    const deactivateResponse = await authRequest(
      token,
      `/users/accounts/crm/${encodeURIComponent(tempSystemUserId)}/status`,
      {
        method: "POST",
        body: { status: "Inactive" },
      }
    );
    if (!deactivateResponse.ok) {
      fail("System user deactivate", `status=${deactivateResponse.status}`);
    } else {
      pass("System user deactivate", `id=${tempSystemUserId}`);
    }

    const activateResponse = await authRequest(
      token,
      `/users/accounts/crm/${encodeURIComponent(tempSystemUserId)}/status`,
      {
        method: "POST",
        body: { status: "Active" },
      }
    );
    if (!activateResponse.ok) {
      fail("System user activate", `status=${activateResponse.status}`);
    } else {
      pass("System user activate", `id=${tempSystemUserId}`);
    }

    const resetPasswordResponse = await authRequest(
      token,
      `/users/accounts/crm/${encodeURIComponent(tempSystemUserId)}/reset-password`,
      {
        method: "POST",
        body: { password: "QaTemp#456" },
      }
    );
    if (!resetPasswordResponse.ok) {
      fail("System user password reset", `status=${resetPasswordResponse.status}`);
    } else {
      pass("System user password reset", `id=${tempSystemUserId}`);
    }

    const deleteSystemUserResponse = await authRequest(
      token,
      `/users/system/${encodeURIComponent(tempSystemUserId)}`,
      {
        method: "DELETE",
      }
    );
    const deletedUserId = tempSystemUserId;
    if (!deleteSystemUserResponse.ok) {
      fail("System user delete", `status=${deleteSystemUserResponse.status}`);
    } else {
      pass("System user delete", `id=${deletedUserId}`);
      tempSystemUserId = "";
    }

    const verifyUsersResponse = await authRequest(token, "/users/accounts");
    const verifyUsersBody = await readJsonSafe(verifyUsersResponse);
    const stillExists = Array.isArray(verifyUsersBody)
      ? verifyUsersBody.some((entry) => entry.id === deletedUserId)
      : false;

    if (!verifyUsersResponse.ok || stillExists) {
      fail(
        "System user deletion verify",
        `status=${verifyUsersResponse.status} exists=${stillExists}`
      );
    } else {
      pass("System user deletion verify", "temporary user removed");
    }
  }

  const qaSuffix = Date.now();
  const qaClass = `QA-CLASS-${qaSuffix}`;
  const qaSection = `QA-SECTION-${qaSuffix}`;
  const qaStudentEmail = `qa.student.${qaSuffix}@schoolcrm.com`;
  const qaParentEmail = `qa.parent.${qaSuffix}@parents.schoolcrm.com`;
  const qaAdmissionDate = new Date().toISOString().slice(0, 10);

  const createClassResponse = await authRequest(token, "/masters/classes", {
    method: "POST",
    body: { name: qaClass },
  });
  const createClassBody = await readJsonSafe(createClassResponse);
  if (!createClassResponse.ok || !createClassBody) {
    fail("Class master create", `status=${createClassResponse.status}`);
  } else if (!Array.isArray(createClassBody.classes) || !createClassBody.classes.includes(qaClass)) {
    fail("Class master create", "created class not found in state response");
  } else {
    tempClassName = qaClass;
    pass("Class master create", `name=${tempClassName}`);
  }

  if (tempClassName) {
    const uploadPhotoV1Data = new FormData();
    uploadPhotoV1Data.append(
      "file",
      new Blob([`QA student document v1 ${qaSuffix}`], { type: "application/pdf" }),
      `qa-student-photo-v1-${qaSuffix}.pdf`
    );
    uploadPhotoV1Data.append("documentType", "studentPhoto");

    const uploadPhotoV1Response = await authRequest(token, "/uploads/student-document", {
      method: "POST",
      body: uploadPhotoV1Data,
    });
    const uploadPhotoV1Body = await readJsonSafe(uploadPhotoV1Response);

    if (!uploadPhotoV1Response.ok || !uploadPhotoV1Body?.path) {
      fail("Student document upload v1", `status=${uploadPhotoV1Response.status}`);
    } else {
      tempStudentDocumentPath = uploadPhotoV1Body.path;
      pass("Student document upload v1", `path=${tempStudentDocumentPath}`);
    }

    const createStudentResponse = await authRequest(token, "/students/upsert", {
      method: "POST",
      body: {
        name: "QA Student",
        dateOfBirth: "2012-04-01",
        gender: "Male",
        mobileNumber: "9999999999",
        address: "QA Address Lane",
        fatherName: "QA Father",
        fatherPhone: "9999999998",
        admissionDate: qaAdmissionDate,
        email: qaStudentEmail,
        password: "QaPhase2#Student123",
        className: tempClassName,
        rollNumber: `QA-${qaSuffix}`,
        createStudentLogin: true,
        parentName: "QA Parent",
        parentEmail: qaParentEmail,
        parentPhone: "9999999999",
        parentPassword: "QaPhase2#Parent123",
        createParentLogin: true,
        studentPhoto: tempStudentDocumentPath,
        status: "Active",
      },
    });
    const createStudentBody = await readJsonSafe(createStudentResponse);

    if (!createStudentResponse.ok || !createStudentBody) {
      fail("Student admission create", `status=${createStudentResponse.status}`);
    } else {
      const createdStudent = Array.isArray(createStudentBody.students)
        ? createStudentBody.students.find(
            (entry) => String(entry.email || "").toLowerCase() === qaStudentEmail
          )
        : null;

      if (!createdStudent?.id) {
        fail("Student admission create", "created student not found in state response");
      } else if (createdStudent.className !== tempClassName) {
        fail(
          "Student admission create",
          `unexpected class=${createdStudent.className}`
        );
      } else {
        tempStudentId = createdStudent.id;
        pass("Student admission create", `id=${tempStudentId}`);

        if (tempStudentDocumentPath) {
          const initialDocumentResponse = await fetchWithTimeout(
            toAbsoluteUrl(tempStudentDocumentPath),
            {},
            3000
          );
          if (!initialDocumentResponse.ok) {
            fail(
              "Student document initial availability",
              `status=${initialDocumentResponse.status}`
            );
          } else {
            pass(
              "Student document initial availability",
              `status=${initialDocumentResponse.status}`
            );
          }
        }

        const previousDocumentPath = tempStudentDocumentPath;
        const uploadPhotoV2Data = new FormData();
        uploadPhotoV2Data.append(
          "file",
          new Blob([`QA student document v2 ${qaSuffix}`], { type: "application/pdf" }),
          `qa-student-photo-v2-${qaSuffix}.pdf`
        );
        uploadPhotoV2Data.append("documentType", "studentPhoto");

        const uploadPhotoV2Response = await authRequest(token, "/uploads/student-document", {
          method: "POST",
          body: uploadPhotoV2Data,
        });
        const uploadPhotoV2Body = await readJsonSafe(uploadPhotoV2Response);

        if (!uploadPhotoV2Response.ok || !uploadPhotoV2Body?.path) {
          fail("Student document upload v2", `status=${uploadPhotoV2Response.status}`);
        } else {
          tempStudentDocumentPath = uploadPhotoV2Body.path;
          pass("Student document upload v2", `path=${tempStudentDocumentPath}`);

          const updateStudentResponse = await authRequest(token, "/students/upsert", {
            method: "POST",
            body: {
              id: tempStudentId,
              name: "QA Student",
              dateOfBirth: "2012-04-01",
              gender: "Male",
              mobileNumber: "9999999999",
              address: "QA Address Lane",
              fatherName: "QA Father",
              fatherPhone: "9999999998",
              admissionDate: qaAdmissionDate,
              email: qaStudentEmail,
              className: tempClassName,
              section: tempSectionName,
              rollNumber: `QA-${qaSuffix}`,
              createStudentLogin: true,
              parentName: "QA Parent",
              parentEmail: qaParentEmail,
              parentPhone: "9999999999",
              createParentLogin: true,
              studentPhoto: tempStudentDocumentPath,
              status: "Active",
            },
          });
          const updateStudentBody = await readJsonSafe(updateStudentResponse);

          if (!updateStudentResponse.ok || !updateStudentBody) {
            fail("Student document replacement update", `status=${updateStudentResponse.status}`);
          } else {
            const updatedStudent = Array.isArray(updateStudentBody.students)
              ? updateStudentBody.students.find((entry) => entry.id === tempStudentId)
              : null;

            if (!updatedStudent) {
              fail("Student document replacement update", "updated student not found in state");
            } else if (String(updatedStudent.studentPhoto || "") !== tempStudentDocumentPath) {
              fail(
                "Student document replacement update",
                "studentPhoto did not update to uploaded replacement"
              );
            } else {
              pass("Student document replacement update", `id=${tempStudentId}`);
            }
          }

          if (previousDocumentPath) {
            const oldDocumentResponse = await fetchWithTimeout(
              toAbsoluteUrl(previousDocumentPath),
              {},
              3000
            );
            if (oldDocumentResponse.ok) {
              fail("Student document replacement cleanup", "old document still accessible");
            } else {
              pass(
                "Student document replacement cleanup",
                `old file removed status=${oldDocumentResponse.status}`
              );
            }
          }

          if (tempStudentDocumentPath) {
            const latestDocumentResponse = await fetchWithTimeout(
              toAbsoluteUrl(tempStudentDocumentPath),
              {},
              3000
            );
            if (!latestDocumentResponse.ok) {
              fail(
                "Student document latest availability",
                `status=${latestDocumentResponse.status}`
              );
            } else {
              pass(
                "Student document latest availability",
                `status=${latestDocumentResponse.status}`
              );
            }
          }
        }
      }
    }
  }

  if (tempStudentId) {
    const deleteStudentResponse = await authRequest(
      token,
      `/students/${encodeURIComponent(tempStudentId)}`,
      {
        method: "DELETE",
      }
    );
    const deleteStudentBody = await readJsonSafe(deleteStudentResponse);
    if (!deleteStudentResponse.ok || !deleteStudentBody) {
      fail("Student admission delete", `status=${deleteStudentResponse.status}`);
    } else {
      const stillExists = Array.isArray(deleteStudentBody.students)
        ? deleteStudentBody.students.some((entry) => entry.id === tempStudentId)
        : false;
      if (stillExists) {
        fail("Student admission delete", "student still present after delete");
      } else {
        pass("Student admission delete", `id=${tempStudentId}`);

        if (tempStudentDocumentPath) {
          const deletedDocumentResponse = await fetchWithTimeout(
            toAbsoluteUrl(tempStudentDocumentPath),
            {},
            3000
          );
          if (deletedDocumentResponse.ok) {
            fail("Student document delete cleanup", "latest document still accessible");
          } else {
            pass(
              "Student document delete cleanup",
              `status=${deletedDocumentResponse.status}`
            );
          }
          tempStudentDocumentPath = "";
        }

        tempStudentId = "";
      }
    }
  }

  if (tempClassName) {
    const deleteClassResponse = await authRequest(
      token,
      `/masters/classes/${encodeURIComponent(tempClassName)}`,
      {
        method: "DELETE",
      }
    );
    const deletedClass = tempClassName;
    if (!deleteClassResponse.ok) {
      fail("Class master delete", `status=${deleteClassResponse.status}`);
    } else {
      pass("Class master delete", `name=${deletedClass}`);
      tempClassName = "";
    }
  }

  info(
    "Non-system role mutation",
    "Skipped teacher/student/parent password mutation to avoid changing live user credentials"
  );
} catch (error) {
  fail("QA execution", error?.message || String(error));
} finally {
  try {
    if (token && originalSettings && settingsMutated) {
      const revertResponse = await authRequest(token, "/admin/settings", {
        method: "PUT",
        body: originalSettings,
      });

      if (revertResponse.ok) {
        info("Cleanup settings", "settings reverted during cleanup");
      } else {
        fail("Cleanup settings", `status=${revertResponse.status}`);
      }
    }

    if (token && tempNoticeId) {
      const cleanupNotice = await authRequest(
        token,
        `/notices/${encodeURIComponent(tempNoticeId)}`,
        {
          method: "DELETE",
        }
      );
      if (cleanupNotice.ok) {
        info("Cleanup notice", `removed id=${tempNoticeId}`);
      } else {
        fail("Cleanup notice", `status=${cleanupNotice.status}`);
      }
    }

    if (token && tempSystemUserId) {
      const cleanupUser = await authRequest(
        token,
        `/users/system/${encodeURIComponent(tempSystemUserId)}`,
        {
          method: "DELETE",
        }
      );
      if (cleanupUser.ok) {
        info("Cleanup system user", `removed id=${tempSystemUserId}`);
      } else {
        fail("Cleanup system user", `status=${cleanupUser.status}`);
      }
    }

    if (token && tempStudentId) {
      const cleanupStudent = await authRequest(
        token,
        `/students/${encodeURIComponent(tempStudentId)}`,
        {
          method: "DELETE",
        }
      );
      if (cleanupStudent.ok) {
        info("Cleanup student", `removed id=${tempStudentId}`);
      } else {
        fail("Cleanup student", `status=${cleanupStudent.status}`);
      }
    }

    if (token && tempSectionName) {
      const cleanupSection = await authRequest(
        token,
        `/masters/sections/${encodeURIComponent(tempSectionName)}`,
        {
          method: "DELETE",
        }
      );
      if (cleanupSection.ok) {
        info("Cleanup section", `removed name=${tempSectionName}`);
      } else {
        fail("Cleanup section", `status=${cleanupSection.status}`);
      }
    }

    if (token && tempClassName) {
      const cleanupClass = await authRequest(
        token,
        `/masters/classes/${encodeURIComponent(tempClassName)}`,
        {
          method: "DELETE",
        }
      );
      if (cleanupClass.ok) {
        info("Cleanup class", `removed name=${tempClassName}`);
      } else {
        fail("Cleanup class", `status=${cleanupClass.status}`);
      }
    }
  } catch (cleanupError) {
    fail("Cleanup execution", cleanupError?.message || String(cleanupError));
  }

  await mongoose.disconnect().catch(() => {});
  await stopManagedServer(managedServer);

  console.table(results);
  const failedCount = results.filter((entry) => entry.status === STATUS_FAIL).length;
  if (failedCount > 0) {
    process.exitCode = 1;
  }
}
