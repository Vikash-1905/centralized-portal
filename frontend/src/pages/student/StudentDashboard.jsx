import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  formatCurrency,
  formatDate,
  getStatusClassName,
} from "../../utils/schoolMetrics";
import {
  ASSIGNMENT_STATUS_CLASS,
  clampPercent,
  getStudentDashboardRows,
  toMonthLabel,
  useStudentDashboardData,
} from "./studentDashboardShared";

const QUICK_ACTIONS = [
  {
    key: "results",
    label: "View Results",
    helperText: "Check exam-wise marks",
    route: "/student/results",
  },
  {
    key: "attendance",
    label: "View Attendance",
    helperText: "Open attendance analytics",
    route: "/student/attendance",
  },
  {
    key: "fees",
    label: "Pay Fees",
    helperText: "Review fee details and due",
    route: "/student/fees",
  },
  {
    key: "assignments",
    label: "View Assignments",
    helperText: "Track pending homework",
    route: "/student/assignments",
  },
];

const METRIC_TONE = {
  attendance: "bg-emerald-500",
  marks: "bg-blue-500",
  fees: "bg-amber-500",
  notifications: "bg-rose-500",
};

function StudentMetricCard({ title, value, subtitle, progress, tone }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">{value}</h3>
        </div>
        <span className={`h-2.5 w-14 rounded-full ${tone}`} />
      </div>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${tone}`}
          style={{ width: `${clampPercent(progress)}%` }}
        />
      </div>
    </article>
  );
}

function StudentDashboard() {
  const navigate = useNavigate();
  const { dashboard, loading, error } = useStudentDashboardData();

  if (loading) {
    return (
      <DashboardLayout>
        <section>
          <div className="mb-6 animate-pulse">
            <div className="h-8 w-64 rounded bg-slate-200" />
            <div className="mt-2 h-4 w-80 rounded bg-slate-100" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((entry) => (
              <article
                key={entry}
                className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="mt-3 h-8 w-20 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
                <div className="mt-4 h-2 rounded-full bg-slate-100" />
              </article>
            ))}
          </div>
        </section>
      </DashboardLayout>
    );
  }

  if (error && !dashboard) {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboard) {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
          Student dashboard data is not available.
        </div>
      </DashboardLayout>
    );
  }

  const attendancePercent = clampPercent(dashboard.attendance?.percent);
  const averageMarks = clampPercent(dashboard.performance?.averageMarks);
  const feeDue = Number(dashboard.fees?.due || 0);
  const feeProgress = clampPercent(dashboard.fees?.progressPercent);
  const notificationsCount = Number(dashboard.quickStats?.notifications || 0);
  const pendingAssignments = Number(dashboard.quickStats?.pendingAssignments || 0);

  const overviewCards = [
    {
      key: "attendance",
      title: "Attendance",
      value: `${attendancePercent}%`,
      subtitle: `${dashboard.attendance?.present || 0}/${dashboard.attendance?.total || 0} sessions present`,
      progress: attendancePercent,
      tone: METRIC_TONE.attendance,
    },
    {
      key: "marks",
      title: "Average Marks",
      value: `${averageMarks}%`,
      subtitle: `${Array.isArray(dashboard.results) ? dashboard.results.length : 0} published assessments`,
      progress: averageMarks,
      tone: METRIC_TONE.marks,
    },
    {
      key: "fees",
      title: "Fee Due",
      value: formatCurrency(feeDue),
      subtitle: `Payment progress ${feeProgress}%`,
      progress: feeProgress,
      tone: METRIC_TONE.fees,
    },
    {
      key: "notifications",
      title: "Notifications",
      value: notificationsCount,
      subtitle: `${pendingAssignments} assignments pending`,
      progress: Math.min(notificationsCount * 20, 100),
      tone: METRIC_TONE.notifications,
    },
  ];

  const {
    scheduleRows,
    assignmentRows,
    noticeRows,
    resultRows,
    monthlyAttendance,
    attendanceLog,
    subjectWise,
    badges,
  } = getStudentDashboardRows(dashboard);

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome, {dashboard.name}
          </h1>
          <p className="mt-2 text-slate-500">
            Class {dashboard.className} | Roll No. {dashboard.rollNumber}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <StudentMetricCard
              key={card.key}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              progress={card.progress}
              tone={card.tone}
            />
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Quick Actions</h2>
            <p className="text-xs text-slate-500">Open dedicated pages for each task</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.key}
                to={action.route}
                className="group flex min-h-[84px] flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-100"
              >
                <p className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-950">
                  {action.label}
                </p>
                <p className="mt-1 text-xs text-slate-500">{action.helperText}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section
            id="student-schedule"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Today&apos;s Schedule</h2>
            <div className="space-y-3">
              {scheduleRows.length ? (
                scheduleRows.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-xl border p-4 transition ${
                      item.isCurrentClass
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.time}</p>
                        <p className="mt-1 text-sm text-slate-700">{item.subject}</p>
                        <p className="text-xs text-slate-500">
                          {item.teacherName} | Room {item.room}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          item.isCurrentClass
                            ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {item.isCurrentClass ? "Current" : "Upcoming"}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No class schedule available for today.
                </p>
              )}
            </div>
          </section>

          <section
            id="student-assignments"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Assignments / Homework</h2>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                Pending: {pendingAssignments}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {assignmentRows.length ? (
                assignmentRows.map((assignment) => (
                  <article
                    key={assignment.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{assignment.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {assignment.subject} | Due {formatDate(assignment.dueDate)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          ASSIGNMENT_STATUS_CLASS[assignment.status] ||
                          "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {assignment.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{assignment.description}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No assignments are pending right now.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Performance Insights</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <article className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Best Subject</p>
                <p className="mt-2 text-sm font-semibold text-blue-800">
                  {dashboard.performance?.bestSubject?.subject || "-"}
                </p>
                <p className="text-xs text-blue-700">
                  {dashboard.performance?.bestSubject
                    ? `${dashboard.performance.bestSubject.averageMarks}%`
                    : "No published marks yet"}
                </p>
              </article>

              <article className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Weak Subject</p>
                <p className="mt-2 text-sm font-semibold text-amber-800">
                  {dashboard.performance?.weakSubject?.subject || "-"}
                </p>
                <p className="text-xs text-amber-700">
                  {dashboard.performance?.weakSubject
                    ? `${dashboard.performance.weakSubject.averageMarks}%`
                    : "No published marks yet"}
                </p>
              </article>

              <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Class Rank</p>
                <p className="mt-2 text-sm font-semibold text-emerald-800">
                  {dashboard.performance?.classRank
                    ? `#${dashboard.performance.classRank}`
                    : "Not available"}
                </p>
                <p className="text-xs text-emerald-700">
                  Class size {dashboard.performance?.classSize || 0}
                </p>
              </article>
            </div>

            <div className="mt-5 space-y-3">
              {subjectWise.length ? (
                subjectWise.map((subject) => (
                  <article key={subject.subject}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <p className="font-medium text-slate-700">{subject.subject}</p>
                      <p className="text-slate-500">{clampPercent(subject.averageMarks)}%</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${Math.max(clampPercent(subject.averageMarks), 8)}%` }}
                      />
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Subject performance chart will appear after marks are published.
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge.id}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                >
                  {badge.label}
                </span>
              ))}
            </div>
          </section>

          <section
            id="student-attendance"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-slate-900">Attendance Analytics</h2>

            <div className="mt-4 space-y-3">
              {monthlyAttendance.length ? (
                monthlyAttendance.map((entry) => (
                  <article key={entry.month}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <p className="font-medium text-slate-700">{toMonthLabel(entry.month)}</p>
                      <p className="text-slate-500">{clampPercent(entry.percent)}%</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(clampPercent(entry.percent), 8)}%` }}
                      />
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Monthly attendance trend will appear after more attendance sessions.
                </p>
              )}
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Subject</th>
                    <th className="p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLog.slice(0, 6).map((entry) => (
                    <tr key={`${entry.id}-${entry.date}`} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">{formatDate(entry.date)}</td>
                      <td className="p-3 text-slate-700">{entry.subject || "-"}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(
                            entry.status
                          )}`}
                        >
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {!attendanceLog.length ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={3}>
                        Attendance records are not available yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section
            id="student-fees"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-slate-900">Fee Section</h2>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">Current fee status</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(
                    dashboard.fees?.status
                  )}`}
                >
                  {dashboard.fees?.status || "Pending"}
                </span>
              </div>

              <div className="mt-4 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-amber-500"
                  style={{ width: `${feeProgress}%` }}
                />
              </div>

              <dl className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex justify-between gap-4">
                  <dt>Annual Fee</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatCurrency(dashboard.fees?.annualFee)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Paid</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatCurrency(dashboard.fees?.paid)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Due</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatCurrency(dashboard.fees?.due)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Due Date</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatDate(dashboard.fees?.dueDate)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/student/fees")}
                  className="rounded-lg bg-[#7dc242] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6cae3c]"
                >
                  Pay Fees
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/student/fees")}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Payment History
                </button>
              </div>
            </div>
          </section>

          <section
            id="student-notices"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-slate-900">Notices</h2>
            <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {noticeRows.length ? (
                noticeRows.map((notice) => (
                  <article
                    key={notice.id}
                    className={`rounded-lg border p-4 ${
                      notice.isNew
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{notice.title}</p>
                      {notice.isNew ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          NEW
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{notice.message}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {formatDate(notice.date)} | {notice.timeAgo}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No new notices right now.
                </p>
              )}
            </div>
          </section>
        </div>

        <section
          id="student-results"
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Published Results</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Exam</th>
                  <th className="p-3 font-semibold">Subject</th>
                  <th className="p-3 font-semibold">Marks</th>
                  <th className="p-3 font-semibold">Teacher</th>
                  <th className="p-3 font-semibold">Published</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((result) => (
                  <tr key={result.id} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-800">{result.exam}</td>
                    <td className="p-3 text-slate-700">{result.subject}</td>
                    <td className="p-3 text-slate-700">
                      {result.marks}/{result.maxMarks} ({clampPercent(result.percent)}%)
                    </td>
                    <td className="p-3 text-slate-700">{result.teacherName}</td>
                    <td className="p-3 text-slate-600">{formatDate(result.publishedDate)}</td>
                  </tr>
                ))}

                {!resultRows.length ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={5}>
                      Results are not published yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </DashboardLayout>
  );
}

export default StudentDashboard;
