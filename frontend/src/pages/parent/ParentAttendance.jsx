import { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  formatDate,
  getStatusClassName,
} from "../../utils/schoolMetrics";
import {
  clampPercent,
  getChildDashboardRows,
  toMonthLabel,
  useParentDashboardData,
} from "./parentDashboardShared";

function ParentAttendance() {
  const { dashboard, loading, error } = useParentDashboardData();
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse">
          <div className="h-8 w-44 rounded bg-slate-200" />
          <div className="mt-6 h-64 rounded-2xl bg-slate-100" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !dashboard) {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      </DashboardLayout>
    );
  }

  if (!dashboard || !dashboard.children?.length) {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
          No child linked yet.
        </div>
      </DashboardLayout>
    );
  }

  const { children } = dashboard;
  const child = children[selectedChildIndex] || children[0];
  const { monthlyAttendance, attendanceLog } = getChildDashboardRows(child);

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Attendance — {child.name}</h1>
            <p className="mt-1 text-slate-500">
              Class {child.className} | Overall {clampPercent(child.attendance?.percent)}%
            </p>
          </div>
          {children.length > 1 ? (
            <select
              value={selectedChildIndex}
              onChange={(e) => setSelectedChildIndex(Number(e.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            >
              {children.map((c, idx) => (
                <option key={c.studentId} value={idx}>{c.name}</option>
              ))}
            </select>
          ) : null}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Monthly Trend</h2>
          <div className="mt-4 space-y-3">
            {monthlyAttendance.map((entry) => (
              <article key={entry.month}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <p className="font-medium text-slate-700">{toMonthLabel(entry.month)}</p>
                  <p className="text-slate-500">{clampPercent(entry.percent)}% ({entry.present}/{entry.total})</p>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full transition-all duration-500 ${entry.percent < 75 ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(clampPercent(entry.percent), 8)}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Attendance Records</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Class</th>
                  <th className="p-3 font-semibold">Subject</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLog.map((entry) => (
                  <tr key={`${entry.id}-${entry.date}`} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-800">{formatDate(entry.date)}</td>
                    <td className="p-3 text-slate-600">{entry.className}</td>
                    <td className="p-3 text-slate-600">{entry.subject || "-"}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!attendanceLog.length ? (
                  <tr><td className="p-4 text-slate-500" colSpan={4}>No records yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </DashboardLayout>
  );
}

export default ParentAttendance;
