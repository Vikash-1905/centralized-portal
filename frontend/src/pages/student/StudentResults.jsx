import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { formatDate } from "../../utils/schoolMetrics";
import {
  clampPercent,
  getStudentDashboardRows,
  useStudentDashboardData,
} from "./studentDashboardShared";

function StudentResults() {
  const navigate = useNavigate();
  const { dashboard, loading, error } = useStudentDashboardData();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-slate-600">Loading results...</div>
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
          Student result data is not available.
        </div>
      </DashboardLayout>
    );
  }

  const { resultRows, subjectWise, badges } = getStudentDashboardRows(dashboard);
  const averageMarks = clampPercent(dashboard.performance?.averageMarks);

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Results & Performance</h1>
            <p className="mt-1 text-slate-500">
              Monitor exam outcomes, subject trends, and ranking insights.
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Average Marks</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">{averageMarks}%</h2>
            <p className="mt-2 text-sm text-slate-500">Across published assessments</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Best Subject</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {dashboard.performance?.bestSubject?.subject || "-"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {dashboard.performance?.bestSubject
                ? `${dashboard.performance.bestSubject.averageMarks}% average`
                : "No marks published yet"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Weak Subject</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {dashboard.performance?.weakSubject?.subject || "-"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {dashboard.performance?.weakSubject
                ? `${dashboard.performance.weakSubject.averageMarks}% average`
                : "No marks published yet"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Class Rank</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {dashboard.performance?.classRank ? `#${dashboard.performance.classRank}` : "-"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Class size {dashboard.performance?.classSize || 0}
            </p>
          </article>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Subject Performance</h2>

          <div className="mt-4 space-y-3">
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

          {badges.length ? (
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
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

export default StudentResults;
