import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import DashboardCard from "../../components/DashboardCard";
import useAuth from "../../hooks/useAuth";
import api from "../../services/api";
import { formatDate } from "../../utils/schoolMetrics";

const QUICK_ACTIONS = [
  {
    key: "attendance",
    label: "Mark Attendance",
    helperText: "Open attendance entry page",
    route: "/teacher/attendance",
  },
  {
    key: "marks",
    label: "Add Marks",
    helperText: "Open marks upload page",
    route: "/teacher/marks",
  },
  {
    key: "assignment",
    label: "Create Assignment",
    helperText: "Open assignment creation page",
    route: "/teacher/assignments",
  },
  {
    key: "students",
    label: "View Students",
    helperText: "Open student roster page",
    route: "/teacher/students",
  },
];

const ACTIVITY_STYLE_BY_TYPE = {
  attendance: {
    icon: "AT",
    iconClass: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  marks: {
    icon: "MK",
    iconClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  assignment: {
    icon: "AS",
    iconClass: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  admin: {
    icon: "AD",
    iconClass: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  message: {
    icon: "MS",
    iconClass: "bg-teal-50 text-teal-700 ring-teal-200",
  },
};

const NOTIFICATION_BADGE_BY_TYPE = {
  assignment: "bg-amber-50 text-amber-700 ring-amber-200",
  admin: "bg-slate-100 text-slate-700 ring-slate-200",
  message: "bg-teal-50 text-teal-700 ring-teal-200",
};

const getRelativeTimeLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  const diffMs = Math.max(Date.now() - date.getTime(), 0);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `${Math.max(diffMinutes, 1)} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

const toPercent = (value) => `${Math.max(Math.round(Number(value) || 0), 0)}%`;

function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teacherData, setTeacherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/teachers/${user?.email}`);
        setTeacherData(response.data);
        setError(null);
      } catch (fetchError) {
        setTeacherData(null);
        setError(
          fetchError.response?.data?.message ||
            fetchError.message ||
            "Unable to load teacher dashboard data."
        );
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      void fetchTeacherData();
    }
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-slate-600">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !teacherData) {
    return (
      <DashboardLayout>
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p>Error loading teacher data: {error}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!teacherData) {
    return (
      <DashboardLayout>
        <div className="text-center text-slate-600">No teacher data available</div>
      </DashboardLayout>
    );
  }

  const assignedClasses = Array.isArray(teacherData.assignedClasses)
    ? teacherData.assignedClasses
    : [];
  const upcomingClasses = Array.isArray(teacherData.upcomingClasses)
    ? teacherData.upcomingClasses
    : [];
  const recentActivity = Array.isArray(teacherData.recentActivity)
    ? teacherData.recentActivity
    : [];
  const notifications = Array.isArray(teacherData.notifications)
    ? teacherData.notifications
    : [];

  const pendingWork = teacherData.pendingWork || {
    pendingEvaluations: Number(teacherData.pendingEvaluations || 0),
    assignmentsToCheck: Number(teacherData.assignmentsDue || 0),
    attendanceNotMarked: 0,
    total:
      Number(teacherData.pendingEvaluations || 0) +
      Number(teacherData.assignmentsDue || 0),
  };

  const studentInsights = teacherData.studentInsights || {
    topPerformers: [],
    lowAttendanceStudents: [],
    weakStudents: [],
  };

  const performanceSummary = teacherData.performanceSummary || {
    classAverageMarks: 0,
    attendancePercent: 0,
    classesOnTrack: 0,
    totalClasses: assignedClasses.length,
  };

  const cards = [
    {
      title: "Subject",
      value: teacherData.subject || "-",
      subtitle: "Primary teaching subject",
      accent: "bg-blue-600",
    },
    {
      title: "Department",
      value: teacherData.department || "-",
      subtitle: "Current faculty department",
      accent: "bg-cyan-600",
    },
    {
      title: "Total Students",
      value: teacherData.totalStudents || 0,
      subtitle: "Across all assigned classes",
      accent: "bg-emerald-600",
    },
    {
      title: "Classes Assigned",
      value: assignedClasses.length,
      subtitle: "Active sections handled",
      accent: "bg-teal-600",
    },
    {
      title: "Pending Evaluations",
      value: pendingWork.pendingEvaluations || 0,
      subtitle: "Result entries pending",
      accent: "bg-amber-600",
    },
    {
      title: "Assignments Due",
      value:
        Number(teacherData.assignmentsDue || pendingWork.assignmentsToCheck) ||
        0,
      subtitle: "Needs submission review",
      accent: "bg-rose-600",
    },
  ];

  const onQuickAction = (action) => {
    navigate(action.route);
  };

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome, {teacherData.name}
          </h1>
          <p className="mt-2 text-slate-500">
            Teacher ID: {teacherData.teacherId} | Subject: {teacherData.subject}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <DashboardCard
              key={card.title}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              accent={card.accent}
            />
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Quick Actions</h2>
            <p className="text-xs text-slate-500">
              Fast access to daily teaching workflow
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => onQuickAction(action)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                <p className="mt-1 text-xs text-slate-500">{action.helperText}</p>
              </button>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section
            id="assigned-classes"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Assigned Classes</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-3 font-semibold">Class</th>
                    <th className="p-3 font-semibold">Standard</th>
                    <th className="p-3 font-semibold">Total Students</th>
                    <th className="p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedClasses.length ? (
                    assignedClasses.map((cls) => (
                      <tr
                        key={cls.classId}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="p-3 font-medium text-slate-800">{cls.name}</td>
                        <td className="p-3 text-slate-600">{cls.standard}</td>
                        <td className="p-3 text-slate-600">{cls.totalStudents}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                navigate("/teacher/attendance", {
                                  state: { className: cls.name },
                                })
                              }
                              className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Take Attendance
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                navigate("/teacher/students", {
                                  state: { className: cls.name },
                                })
                              }
                              className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              View Students
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-b border-slate-100">
                      <td className="p-4 text-slate-500" colSpan={5}>
                        No assigned classes found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            id="today-schedule"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Today&apos;s Schedule</h2>
            <div className="space-y-3">
              {upcomingClasses.length ? (
                upcomingClasses.map((item) => (
                  <div
                    key={`${item.time}-${item.className}`}
                    className={`rounded-xl border p-4 ${
                      item.isCurrentClass
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.time}</p>
                        <p className="mt-1 text-sm text-slate-700">{item.className}</p>
                        <p className="text-xs text-slate-500">
                          {item.subject} | Room {item.room}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                            item.isCurrentClass
                              ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {item.isCurrentClass ? "Current Class" : "Upcoming"}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            navigate("/teacher/attendance", {
                              state: { className: item.className },
                            })
                          }
                          className="mt-2 block rounded-md bg-[#7dc242] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#6cae3c]"
                        >
                          Start Class
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No schedule available for today.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <section
            id="pending-work"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-slate-900">Pending Work</h2>
            <p className="mt-1 text-sm text-slate-500">
              Combined view of evaluations, assignment checks, and attendance gaps.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <article className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Pending Evaluations
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-700">
                  {pendingWork.pendingEvaluations || 0}
                </p>
              </article>

              <article className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                  Assignments To Check
                </p>
                <p className="mt-2 text-2xl font-bold text-cyan-700">
                  {pendingWork.assignmentsToCheck || 0}
                </p>
              </article>

              <article className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Attendance Not Marked
                </p>
                <p className="mt-2 text-2xl font-bold text-rose-700">
                  {pendingWork.attendanceNotMarked || 0}
                </p>
              </article>
            </div>

            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Total pending work items: {" "}
              <span className="font-semibold">{pendingWork.total || 0}</span>
            </p>
          </section>

          <section
            id="student-insights"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-slate-900">Student Insights</h2>
            <p className="mt-1 text-sm text-slate-500">
              Top performers, low attendance alerts, and weak learners.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <article className="rounded-lg bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-800">Top Performers</p>
                <div className="mt-2 space-y-2">
                  {studentInsights.topPerformers?.length ? (
                    studentInsights.topPerformers.map((student) => (
                      <div key={student.studentId} className="rounded-md bg-white/80 p-2">
                        <p className="text-sm font-semibold text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-500">
                          {student.className} | Avg {toPercent(student.averageMarks)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No performance data yet.</p>
                  )}
                </div>
              </article>

              <article className="rounded-lg bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-800">Low Attendance</p>
                <div className="mt-2 space-y-2">
                  {studentInsights.lowAttendanceStudents?.length ? (
                    studentInsights.lowAttendanceStudents.map((student) => (
                      <div key={student.studentId} className="rounded-md bg-white/80 p-2">
                        <p className="text-sm font-semibold text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-500">
                          {student.className} | Attendance {toPercent(student.attendancePercent)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No low attendance alerts.</p>
                  )}
                </div>
              </article>

              <article className="rounded-lg bg-rose-50 p-3">
                <p className="text-sm font-semibold text-rose-800">Weak Students</p>
                <div className="mt-2 space-y-2">
                  {studentInsights.weakStudents?.length ? (
                    studentInsights.weakStudents.map((student) => (
                      <div key={student.studentId} className="rounded-md bg-white/80 p-2">
                        <p className="text-sm font-semibold text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-500">
                          {student.className} | Avg {toPercent(student.averageMarks)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No weak students detected.</p>
                  )}
                </div>
              </article>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Performance Summary</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Class Average Marks
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {toPercent(performanceSummary.classAverageMarks)}
              </p>
            </article>

            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Attendance Coverage
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {toPercent(performanceSummary.attendancePercent)}
              </p>
            </article>

            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Classes On Track
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {performanceSummary.classesOnTrack || 0}/{performanceSummary.totalClasses || 0}
              </p>
            </article>
          </div>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section
            id="recent-activity"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Recent Activity</h2>
            <div className="space-y-3">
              {recentActivity.length ? (
                recentActivity.map((activity) => {
                  const style = ACTIVITY_STYLE_BY_TYPE[activity.type] || {
                    icon: "AC",
                    iconClass: "bg-slate-100 text-slate-700 ring-slate-200",
                  };

                  return (
                    <div
                      key={activity.id || `${activity.activity}-${activity.date}`}
                      className="flex items-start gap-3 rounded-lg border border-slate-100 p-3"
                    >
                      <span
                        className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1 ${style.iconClass}`}
                      >
                        {style.icon}
                      </span>

                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">
                          {activity.activity}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {activity.timeAgo ||
                            getRelativeTimeLabel(activity.timestamp || activity.date)}
                          {" | "}
                          {formatDate(activity.date || activity.timestamp)}
                        </p>
                      </div>

                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700 ring-1 ring-emerald-200">
                        {activity.status || "done"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No recent activity available.
                </p>
              )}
            </div>
          </section>

          <section
            id="notifications"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Notifications</h2>
            <div className="space-y-3">
              {notifications.length ? (
                notifications.map((notification) => (
                  <article
                    key={notification.id}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {notification.message}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ring-1 ${
                          NOTIFICATION_BADGE_BY_TYPE[notification.type] ||
                          "bg-slate-100 text-slate-700 ring-slate-200"
                        }`}
                      >
                        {notification.type || "notice"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      {notification.timeAgo ||
                        getRelativeTimeLabel(notification.timestamp || notification.date)}
                      {" | "}
                      {notification.source || "System"}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No new notifications.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default TeacherDashboard;