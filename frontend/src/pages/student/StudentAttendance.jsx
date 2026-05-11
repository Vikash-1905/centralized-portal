import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { formatDate, getStatusClassName } from "../../utils/schoolMetrics";
import {
  clampPercent,
  getStudentDashboardRows,
  toMonthLabel,
  useStudentDashboardData,
} from "./studentDashboardShared";

function StudentAttendance() {
  const navigate = useNavigate();
  const { dashboard, loading, error } = useStudentDashboardData();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-slate-600">Loading attendance...</div>
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
          Attendance data is not available.
        </div>
      </DashboardLayout>
    );
  }

  const { monthlyAttendance, attendanceLog } = getStudentDashboardRows(dashboard);
  const attendancePercent = clampPercent(dashboard.attendance?.percent);
  const presentCount = Number(dashboard.attendance?.present || 0);
  const totalCount = Number(dashboard.attendance?.total || 0);

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Attendance Analytics</h1>
            <p className="mt-1 text-slate-500">
              Track monthly attendance trends and your recent attendance log.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/student")}
            className="self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Attendance Percent</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">{attendancePercent}%</h2>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Present Sessions</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">{presentCount}</h2>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Sessions</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">{totalCount}</h2>
          </article>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Monthly Trend</h2>
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
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Attendance Log</h2>
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
                    <td className="p-3 text-slate-700">{formatDate(entry.date)}</td>
                    <td className="p-3 text-slate-700">
                      {entry.className || dashboard.className}
                    </td>
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
                    <td className="p-4 text-slate-500" colSpan={4}>
                      Attendance records are not available yet.
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

export default StudentAttendance;
