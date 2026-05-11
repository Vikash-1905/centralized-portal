import { useEffect, useState } from "react";
import useAuth from "../../hooks/useAuth";
import { fetchParentDashboard } from "../../services/schoolApi";

export { clampPercent, toMonthLabel } from "../student/studentDashboardShared";

export const ASSIGNMENT_STATUS_CLASS = {
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
  Submitted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Overdue: "bg-rose-50 text-rose-700 ring-rose-200",
};

export const ALERT_SEVERITY_CLASS = {
  critical: {
    bg: "bg-rose-50 border-rose-200",
    icon: "text-rose-600",
    text: "text-rose-800",
    badge: "bg-rose-100 text-rose-700 ring-rose-300",
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    icon: "text-amber-600",
    text: "text-amber-800",
    badge: "bg-amber-100 text-amber-700 ring-amber-300",
  },
  info: {
    bg: "bg-sky-50 border-sky-200",
    icon: "text-sky-600",
    text: "text-sky-800",
    badge: "bg-sky-100 text-sky-700 ring-sky-300",
  },
};

export const ALERT_TYPE_LABEL = {
  attendance: "Attendance",
  fee: "Fees",
  assignment: "Homework",
  marks: "Performance",
};

export const getChildDashboardRows = (childDashboard) => ({
  scheduleRows: Array.isArray(childDashboard?.schedule) ? childDashboard.schedule : [],
  assignmentRows: Array.isArray(childDashboard?.assignments) ? childDashboard.assignments : [],
  resultRows: Array.isArray(childDashboard?.results) ? childDashboard.results : [],
  monthlyAttendance: Array.isArray(childDashboard?.attendance?.monthly)
    ? childDashboard.attendance.monthly
    : [],
  attendanceLog: Array.isArray(childDashboard?.attendance?.log)
    ? childDashboard.attendance.log
    : [],
  subjectWise: Array.isArray(childDashboard?.performance?.subjectWise)
    ? childDashboard.performance.subjectWise
    : [],
  badges: Array.isArray(childDashboard?.performance?.badges)
    ? childDashboard.performance.badges
    : [],
  paymentHistory: Array.isArray(childDashboard?.fees?.paymentHistory)
    ? childDashboard.fees.paymentHistory
    : [],
});

export const useParentDashboardData = () => {
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
        const response = await fetchParentDashboard(user.email);
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
        setError(loadError.message || "Unable to load parent dashboard.");
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
