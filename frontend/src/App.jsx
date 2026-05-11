import { Suspense, lazy, useEffect, useRef } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SchoolDataProvider } from "./context/SchoolDataProvider";
import useAuth from "./hooks/useAuth";
import ProtectedRoute from "./routes/ProtectedRoute";
import PublicRoute from "./routes/PublicRoute";
import { getPrefetchRoutesForRole, prefetchRoute } from "./routes/routePrefetch";

const Login = lazy(() => import("./pages/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const Masters = lazy(() => import("./pages/admin/Masters"));
const Users = lazy(() => import("./pages/admin/Users"));
const Students = lazy(() => import("./pages/admin/Students"));
const StudentProfile = lazy(() => import("./pages/admin/StudentProfile"));
const Teachers = lazy(() => import("./pages/admin/Teachers"));
const TeacherProfile = lazy(() => import("./pages/admin/TeacherProfile"));
const AttendanceOverview = lazy(() => import("./pages/admin/AttendanceOverview"));
const FeesManagement = lazy(() => import("./pages/admin/FeesManagement"));
const Notifications = lazy(() => import("./pages/admin/Notifications"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard"));
const TeacherAttendance = lazy(() => import("./pages/teacher/TeacherAttendance"));
const TeacherMarks = lazy(() => import("./pages/teacher/TeacherMarks"));
const TeacherAssignments = lazy(() => import("./pages/teacher/TeacherAssignments"));
const TeacherStudents = lazy(() => import("./pages/teacher/TeacherStudents"));
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const StudentResults = lazy(() => import("./pages/student/StudentResults"));
const StudentAttendance = lazy(() => import("./pages/student/StudentAttendance"));
const StudentAssignments = lazy(() => import("./pages/student/StudentAssignments"));
const StudentFees = lazy(() => import("./pages/student/StudentFees"));
const ParentDashboard = lazy(() => import("./pages/parent/ParentDashboard"));
const ParentAttendance = lazy(() => import("./pages/parent/ParentAttendance"));
const ParentFees = lazy(() => import("./pages/parent/ParentFees"));
const ParentCommunication = lazy(() => import("./pages/parent/ParentCommunication"));
const CRMDashboard = lazy(() => import("./pages/crm/CRMDashboard"));

const scheduleIdle = (callback) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(callback, { timeout: 1200 });
    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }

  const timeoutId = window.setTimeout(callback, 320);
  return () => {
    window.clearTimeout(timeoutId);
  };
};

function RoutePrefetcher() {
  const { isAuthenticated, user } = useAuth();
  const prefetchedRolesRef = useRef(new Set());

  useEffect(() => {
    const role = String(user?.role || "").toLowerCase();
    if (!isAuthenticated || !role || prefetchedRolesRef.current.has(role)) {
      return;
    }

    const routes = getPrefetchRoutesForRole(role);
    if (!routes.length) {
      return;
    }

    prefetchedRolesRef.current.add(role);
    let cancelled = false;

    const runPrefetch = () => {
      routes.forEach((path, index) => {
        window.setTimeout(() => {
          if (cancelled) {
            return;
          }

          void prefetchRoute(path);
        }, index * 180);
      });
    };

    const cleanupIdle = scheduleIdle(runPrefetch);

    return () => {
      cancelled = true;
      cleanupIdle();
    };
  }, [isAuthenticated, user?.role]);

  return null;
}

function App() {
  const routeFallback = (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-sm font-medium text-slate-600">
      Loading dashboard...
    </div>
  );

  return (
    <AuthProvider>
      <SchoolDataProvider>
        <BrowserRouter>
          <RoutePrefetcher />
          <Suspense fallback={routeFallback}>
            <Routes>
              <Route
                path="/"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Students />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/students/:studentId"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <StudentProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Users />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/teachers"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Teachers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/teachers/:teacherId"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <TeacherProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/classes-subjects"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Masters />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/masters"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Navigate to="/admin/classes-subjects" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/attendance"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AttendanceOverview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/fees"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <FeesManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/notifications"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Settings />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/teacher"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <TeacherDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/attendance"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <TeacherAttendance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/marks"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <TeacherMarks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/assignments"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <TeacherAssignments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/students"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <TeacherStudents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/results"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentResults />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/attendance"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentAttendance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/assignments"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentAssignments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/fees"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentFees />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/parent"
                element={
                  <ProtectedRoute allowedRoles={["parent"]}>
                    <ParentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/parent/attendance"
                element={
                  <ProtectedRoute allowedRoles={["parent"]}>
                    <ParentAttendance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/parent/fees"
                element={
                  <ProtectedRoute allowedRoles={["parent"]}>
                    <ParentFees />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/parent/communication"
                element={
                  <ProtectedRoute allowedRoles={["parent"]}>
                    <ParentCommunication />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/crm"
                element={
                  <ProtectedRoute allowedRoles={["crm", "admin"]}>
                    <CRMDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crm/enquiries"
                element={
                  <ProtectedRoute allowedRoles={["crm", "admin"]}>
                    <Navigate to="/crm" replace />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SchoolDataProvider>
    </AuthProvider>
  );
}

export default App;
