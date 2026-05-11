import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  formatCurrency,
  formatDate,
  getStatusClassName,
} from "../../utils/schoolMetrics";
import {
  ALERT_SEVERITY_CLASS,
  ALERT_TYPE_LABEL,
  ASSIGNMENT_STATUS_CLASS,
  clampPercent,
  getChildDashboardRows,
  toMonthLabel,
  useParentDashboardData,
} from "./parentDashboardShared";

/* ─── SVG icons (inline) ─── */

function IconAlert({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function IconCalendar({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
    </svg>
  );
}

function IconBook({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function IconTrend({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconWallet({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20.5 7.5H5.5C4.4 7.5 3.5 8.4 3.5 9.5v9c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2v-9c0-1.1-.9-2-2-2z" /><path d="M3.5 9V6.5c0-1.1.9-2 2-2h13" /><circle cx="16.5" cy="14.5" r="1.2" />
    </svg>
  );
}

function IconChat({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function IconChevronDown({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconBell({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

/* ─── Metric Card ─── */

function MetricCard({ title, value, subtitle, progress, tone, icon, warning }) {
  return (
    <article className={`parent-card-enter rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${warning ? "border-rose-200" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className={`mt-2 text-3xl font-bold ${warning ? "text-rose-600" : "text-slate-900"}`}>{value}</h3>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
          {typeof icon === "function" ? icon({ className: "h-5 w-5 text-white" }) : null}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${warning ? "bg-rose-500" : tone}`}
          style={{ width: `${clampPercent(progress)}%` }}
        />
      </div>
    </article>
  );
}

/* ─── Loading Skeleton ─── */

function DashboardSkeleton() {
  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 animate-pulse">
          <div className="h-8 w-64 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-80 rounded bg-slate-100" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((entry) => (
            <article key={entry} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="mt-3 h-8 w-20 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
              <div className="mt-4 h-2 rounded-full bg-slate-100" />
            </article>
          ))}
        </div>
        <div className="mt-6 animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-3 space-y-2">
            <div className="h-10 rounded bg-slate-100" />
            <div className="h-10 rounded bg-slate-100" />
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}

/* ─── Main Dashboard ─── */

function ParentDashboard() {
  const { dashboard, loading, error } = useParentDashboardData();
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const navigate = useNavigate();

  if (loading) {
    return <DashboardSkeleton />;
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

  if (!dashboard || !dashboard.children?.length) {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
          This parent account is not linked to a child record yet.
        </div>
      </DashboardLayout>
    );
  }

  const { parent, children, alerts, notices } = dashboard;
  const child = children[selectedChildIndex] || children[0];
  const hasMultipleChildren = children.length > 1;

  const attendancePercent = clampPercent(child.attendance?.percent);
  const averageMarks = clampPercent(child.performance?.averageMarks);
  const feeDue = Number(child.fees?.due || 0);
  const feeProgress = clampPercent(child.fees?.progressPercent);
  const pendingAssignments = Number(child.quickStats?.pendingAssignments || 0);

  const {
    scheduleRows,
    assignmentRows,
    monthlyAttendance,
    attendanceLog,
    subjectWise,
    resultRows,
    paymentHistory,
  } = getChildDashboardRows(child);

  const overviewCards = [
    {
      key: "attendance",
      title: "Attendance",
      value: `${attendancePercent}%`,
      subtitle: `${child.attendance?.present || 0}/${child.attendance?.total || 0} sessions present`,
      progress: attendancePercent,
      tone: "bg-emerald-500",
      icon: IconCalendar,
      warning: attendancePercent < 75 && (child.attendance?.total || 0) > 0,
    },
    {
      key: "marks",
      title: "Average Score",
      value: `${averageMarks}%`,
      subtitle: `${resultRows.length} published assessments`,
      progress: averageMarks,
      tone: "bg-blue-500",
      icon: IconTrend,
      warning: averageMarks > 0 && averageMarks < 40,
    },
    {
      key: "fees",
      title: "Fee Due",
      value: formatCurrency(feeDue),
      subtitle: `Payment progress ${feeProgress}%`,
      progress: feeProgress,
      tone: "bg-amber-500",
      icon: IconWallet,
      warning: feeDue > 0,
    },
    {
      key: "alerts",
      title: "Alerts",
      value: alerts.length,
      subtitle: `${pendingAssignments} assignments pending`,
      progress: Math.min(alerts.length * 25, 100),
      tone: "bg-rose-500",
      icon: IconBell,
      warning: alerts.some((a) => a.severity === "critical"),
    },
  ];

  return (
    <DashboardLayout>
      <section>
        {/* ─── Header + Multi-Child Selector ─── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Parent Dashboard
            </h1>
            <p className="mt-2 text-slate-500">
              {parent.name} monitoring{" "}
              <span className="font-semibold text-slate-700">{child.name}</span>{" "}
              | Class {child.className} | Roll No.{" "}
              {child.rollNumber}
            </p>
          </div>

          {hasMultipleChildren ? (
            <div className="relative w-full sm:w-auto">
              <select
                id="parent-child-selector"
                value={selectedChildIndex}
                onChange={(e) => setSelectedChildIndex(Number(e.target.value))}
                className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:min-w-[200px]"
              >
                {children.map((c, idx) => (
                  <option key={c.studentId} value={idx}>
                    {c.name} — {c.className}
                  </option>
                ))}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          ) : null}
        </div>

        {/* ─── 1. Smart Overview Cards ─── */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <MetricCard
              key={card.key}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              progress={card.progress}
              tone={card.tone}
              icon={card.icon}
              warning={card.warning}
            />
          ))}
        </div>

        {/* ─── 2. Alerts Panel ─── */}
        {alerts.length > 0 ? (
          <section id="parent-alerts" className="parent-card-enter mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <IconAlert className="h-5 w-5 text-rose-500" />
              <h2 className="text-xl font-semibold text-slate-900">Alerts</h2>
              <span className="ml-auto rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                {alerts.length}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {alerts.map((alert) => {
                const style = ALERT_SEVERITY_CLASS[alert.severity] || ALERT_SEVERITY_CLASS.info;
                return (
                  <div
                    key={alert.id}
                    className={`alert-pulse-enter flex items-center gap-3 rounded-xl border p-3.5 ${style.bg}`}
                  >
                    <IconAlert className={`h-4 w-4 flex-shrink-0 ${style.icon}`} />
                    <p className={`flex-1 text-sm font-medium ${style.text}`}>
                      {alert.message}
                    </p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${style.badge}`}>
                      {ALERT_TYPE_LABEL[alert.type] || alert.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ─── 3. Schedule + 4. Assignments ─── */}
        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section id="parent-schedule" className="parent-card-enter rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <IconCalendar className="h-5 w-5 text-emerald-600" />
              <h2 className="text-xl font-semibold text-slate-900">Today&apos;s Schedule</h2>
            </div>
            <div className="mt-4 space-y-3">
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

          <section id="parent-assignments" className="parent-card-enter rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <IconBook className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-semibold text-slate-900">Assignments / Homework</h2>
              </div>
              {pendingAssignments > 0 ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  Pending: {pendingAssignments}
                </span>
              ) : null}
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
                  No assignments pending right now.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* ─── 5. Performance Insights + 6. Attendance Analytics ─── */}
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section id="parent-performance" className="parent-card-enter rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <IconTrend className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900">Performance Insights</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Best Subject</p>
                <p className="mt-2 text-sm font-semibold text-emerald-800">
                  {child.performance?.bestSubject?.subject || "-"}
                </p>
                <p className="text-xs text-emerald-700">
                  {child.performance?.bestSubject
                    ? `${child.performance.bestSubject.averageMarks}%`
                    : "No marks yet"}
                </p>
              </article>
              <article className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Weak Subject</p>
                <p className="mt-2 text-sm font-semibold text-rose-800">
                  {child.performance?.weakSubject?.subject || "-"}
                </p>
                <p className="text-xs text-rose-700">
                  {child.performance?.weakSubject
                    ? `${child.performance.weakSubject.averageMarks}%`
                    : "No marks yet"}
                </p>
              </article>
              <article className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Class Rank</p>
                <p className="mt-2 text-sm font-semibold text-blue-800">
                  {child.performance?.classRank
                    ? `#${child.performance.classRank}`
                    : "Not available"}
                </p>
                <p className="text-xs text-blue-700">
                  Class size {child.performance?.classSize || 0}
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
                        className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${Math.max(clampPercent(subject.averageMarks), 8)}%` }}
                      />
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Subject performance will appear after marks are published.
                </p>
              )}
            </div>
          </section>

          <section id="parent-attendance" className="parent-card-enter rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <IconCalendar className="h-5 w-5 text-emerald-600" />
              <h2 className="text-xl font-semibold text-slate-900">Attendance Analytics</h2>
            </div>
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
                        className={`h-2 rounded-full transition-all duration-500 ${
                          entry.percent < 75 ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.max(clampPercent(entry.percent), 8)}%` }}
                      />
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Monthly attendance will appear after sessions are recorded.
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
                          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(entry.status)}`}
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

        {/* ─── 7. Fees + 8. Notices ─── */}
        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section id="parent-fees" className="parent-card-enter rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <IconWallet className="h-5 w-5 text-amber-600" />
              <h2 className="text-xl font-semibold text-slate-900">Fee Section</h2>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">Current fee status</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(child.fees?.status)}`}
                >
                  {child.fees?.status || "Pending"}
                </span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${feeProgress}%` }}
                />
              </div>
              <dl className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex justify-between gap-4">
                  <dt>Annual Fee</dt>
                  <dd className="font-semibold text-slate-800">{formatCurrency(child.fees?.annualFee)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Paid</dt>
                  <dd className="font-semibold text-slate-800">{formatCurrency(child.fees?.paid)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Due</dt>
                  <dd className={`font-semibold ${feeDue > 0 ? "text-rose-600" : "text-slate-800"}`}>
                    {formatCurrency(child.fees?.due)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Due Date</dt>
                  <dd className="font-semibold text-slate-800">{formatDate(child.fees?.dueDate)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[#7dc242] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6cae3c]"
                >
                  Pay Now
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Payment History
                </button>
              </div>
            </div>
            {paymentHistory.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recent Payments
                </p>
                <div className="space-y-2">
                  {paymentHistory.slice(0, 3).map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(payment.date)} • {payment.method}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        {payment.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section id="parent-notices" className="parent-card-enter rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <IconBell className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900">Notices</h2>
            </div>
            <div className="mt-4 max-h-[380px] space-y-3 overflow-y-auto pr-1">
              {notices.length ? (
                notices.map((notice) => (
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
                    <p className="mt-2 text-xs text-slate-400">{formatDate(notice.date)}</p>
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

        {/* ─── 9. Published Results ─── */}
        <section id="parent-results" className="parent-card-enter mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

        {/* ─── 10. Communication Panel ─── */}
        <section id="parent-communication" className="parent-card-enter mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <IconChat className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-slate-900">Communication Panel</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate("/parent/communication")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/parent/communication")}
              className="group flex min-h-[84px] cursor-pointer flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
            >
              <div className="flex items-center gap-2">
                <IconChat className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-900 transition group-hover:text-emerald-800">
                  Message Teacher
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Send a message to your child&apos;s class teacher
              </p>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate("/parent/communication")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/parent/communication")}
              className="group flex min-h-[84px] cursor-pointer flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-center gap-2">
                <IconBell className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-semibold text-slate-900 transition group-hover:text-blue-800">
                  School Announcements
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                View all school-wide announcements and updates
              </p>
            </div>
          </div>
        </section>
      </section>
    </DashboardLayout>
  );
}

export default ParentDashboard;
