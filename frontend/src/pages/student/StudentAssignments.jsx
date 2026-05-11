import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { formatDate } from "../../utils/schoolMetrics";
import {
  ASSIGNMENT_STATUS_CLASS,
  getStudentDashboardRows,
  useStudentDashboardData,
} from "./studentDashboardShared";

function StudentAssignments() {
  const navigate = useNavigate();
  const { dashboard, loading, error } = useStudentDashboardData();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-slate-600">Loading assignments...</div>
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
          Assignment data is not available.
        </div>
      </DashboardLayout>
    );
  }

  const { assignmentRows, noticeRows } = getStudentDashboardRows(dashboard);
  const pendingCount = assignmentRows.filter((entry) => entry.status === "Pending").length;
  const submittedCount = assignmentRows.filter((entry) => entry.status === "Submitted").length;
  const overdueCount = assignmentRows.filter((entry) => entry.status === "Overdue").length;

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Assignments & Homework</h1>
            <p className="mt-1 text-slate-500">
              Manage due work and keep up with assignment-related notices.
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

        <div className="grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">{assignmentRows.length}</h2>
          </article>

          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-700">Pending</p>
            <h2 className="mt-2 text-3xl font-bold text-amber-800">{pendingCount}</h2>
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">Submitted</p>
            <h2 className="mt-2 text-3xl font-bold text-emerald-800">{submittedCount}</h2>
          </article>

          <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-rose-700">Overdue</p>
            <h2 className="mt-2 text-3xl font-bold text-rose-800">{overdueCount}</h2>
          </article>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Your Assignments</h2>

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

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Recent Notices</h2>
          <div className="mt-4 space-y-3">
            {noticeRows.slice(0, 6).map((notice) => (
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
            ))}

            {!noticeRows.length ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No notices available.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </DashboardLayout>
  );
}

export default StudentAssignments;
