import { useEffect, useState } from "react";
import useAuth from "../../hooks/useAuth";
import { fetchStudentDashboard } from "../../services/schoolApi";

export const ASSIGNMENT_STATUS_CLASS = {
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
  Submitted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Overdue: "bg-rose-50 text-rose-700 ring-rose-200",
};

export const clampPercent = (value) =>
  Math.max(Math.min(Math.round(Number(value) || 0), 100), 0);

export const toMonthLabel = (value) => {
  if (!/^\d{4}-\d{2}$/.test(String(value || ""))) {
    return String(value || "-");
  }

  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

export const getStudentDashboardRows = (dashboard) => ({
  scheduleRows: Array.isArray(dashboard?.schedule) ? dashboard.schedule : [],
  assignmentRows: Array.isArray(dashboard?.assignments) ? dashboard.assignments : [],
  noticeRows: Array.isArray(dashboard?.notices) ? dashboard.notices : [],
  resultRows: Array.isArray(dashboard?.results) ? dashboard.results : [],
  monthlyAttendance: Array.isArray(dashboard?.attendance?.monthly)
    ? dashboard.attendance.monthly
    : [],
  attendanceLog: Array.isArray(dashboard?.attendance?.log)
    ? dashboard.attendance.log
    : [],
  subjectWise: Array.isArray(dashboard?.performance?.subjectWise)
    ? dashboard.performance.subjectWise
    : [],
  badges: Array.isArray(dashboard?.performance?.badges)
    ? dashboard.performance.badges
    : [],
  paymentHistory: Array.isArray(dashboard?.fees?.paymentHistory)
    ? dashboard.fees.paymentHistory
    : [],
});

export const useStudentDashboardData = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      if (!user?.email) {
        setDashboard(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetchStudentDashboard(user.email);
        if (!isMounted) {
          return;
        }

        setDashboard(response);
        setError("");
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setDashboard(null);
        setError(loadError.message || "Unable to load student dashboard.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [user?.email]);

  return {
    dashboard,
    loading,
    error,
  };
};
