import { useMemo, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import useSchoolData from "../../hooks/useSchoolData";

const toMonthKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const buildMonthBuckets = (count) => {
  const now = new Date();
  return [...Array(count)].map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    return {
      key,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
    };
  });
};

function AttendanceOverview() {
  const { schoolData } = useSchoolData();
  const { attendance } = schoolData;
  const [classFilter, setClassFilter] = useState("All");

  const classOptions = useMemo(
    () => ["All", ...new Set(attendance.map((entry) => entry.className).filter(Boolean))],
    [attendance]
  );

  const filteredEntries = useMemo(
    () =>
      attendance.filter((entry) => classFilter === "All" || entry.className === classFilter),
    [attendance, classFilter]
  );

  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.date === today),
    [filteredEntries, today]
  );

  const todayTotals = useMemo(
    () =>
      todayEntries.reduce(
        (summary, entry) => {
          const presentCount = (entry.records || []).filter(
            (record) => record.status === "Present"
          ).length;
          const totalCount = (entry.records || []).length;

          return {
            sessions: summary.sessions + 1,
            present: summary.present + presentCount,
            total: summary.total + totalCount,
          };
        },
        { sessions: 0, present: 0, total: 0 }
      ),
    [todayEntries]
  );

  const classWiseStats = useMemo(() => {
    const bucket = new Map();

    filteredEntries.forEach((entry) => {
      const current = bucket.get(entry.className) || { present: 0, total: 0 };
      const presentCount = (entry.records || []).filter(
        (record) => record.status === "Present"
      ).length;
      const totalCount = (entry.records || []).length;

      bucket.set(entry.className, {
        present: current.present + presentCount,
        total: current.total + totalCount,
      });
    });

    return [...bucket.entries()]
      .map(([className, value]) => ({
        className,
        present: value.present,
        total: value.total,
        percent: value.total ? Math.round((value.present / value.total) * 100) : 0,
      }))
      .sort((a, b) => b.percent - a.percent);
  }, [filteredEntries]);

  const monthlyTrend = useMemo(() => {
    const buckets = buildMonthBuckets(6);
    const monthly = new Map();

    filteredEntries.forEach((entry) => {
      const key = toMonthKey(entry.date);
      if (!key) return;

      const current = monthly.get(key) || { present: 0, total: 0 };
      const presentCount = (entry.records || []).filter(
        (record) => record.status === "Present"
      ).length;
      const totalCount = (entry.records || []).length;

      monthly.set(key, {
        present: current.present + presentCount,
        total: current.total + totalCount,
      });
    });

    return buckets.map((bucket) => {
      const value = monthly.get(bucket.key) || { present: 0, total: 0 };
      const percent = value.total ? Math.round((value.present / value.total) * 100) : 0;

      return {
        ...bucket,
        ...value,
        percent,
      };
    });
  }, [filteredEntries]);

  const maxMonthlyPercent = Math.max(...monthlyTrend.map((entry) => entry.percent), 100);

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Attendance Management</h1>
            <p className="mt-2 max-w-3xl text-slate-500">
              Monitor daily attendance health, class-wise consistency, and monthly participation trends.
            </p>
          </div>

          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            {classOptions.map((option) => (
              <option key={option} value={option}>
                {option === "All" ? "All classes" : option}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today Sessions</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{todayTotals.sessions}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today Attendance</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {todayTotals.total
                ? `${Math.round((todayTotals.present / todayTotals.total) * 100)}%`
                : "0%"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {todayTotals.present}/{todayTotals.total} present records
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Classes Covered</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{classWiseStats.length}</p>
          </article>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Monthly Attendance Trend</h2>
            <div className="mt-5 space-y-4">
              {monthlyTrend.map((entry) => (
                <div key={entry.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{entry.label}</span>
                    <span className="text-slate-500">{entry.percent}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(entry.percent / maxMonthlyPercent) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Class-wise Performance</h2>
            <div className="mt-4 space-y-3">
              {classWiseStats.length ? (
                classWiseStats.slice(0, 8).map((entry) => (
                  <div
                    key={entry.className}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{entry.className}</p>
                      <p className="text-xs text-slate-500">
                        {entry.present}/{entry.total} present
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      {entry.percent}%
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No attendance data available yet.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Recent Attendance Logs</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Class</th>
                  <th className="p-3 font-semibold">Subject</th>
                  <th className="p-3 font-semibold">Teacher</th>
                  <th className="p-3 font-semibold">Present</th>
                  <th className="p-3 font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length ? (
                  [...filteredEntries]
                    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                    .slice(0, 20)
                    .map((entry) => {
                      const present = (entry.records || []).filter(
                        (record) => record.status === "Present"
                      ).length;
                      const total = (entry.records || []).length;
                      const percent = total ? Math.round((present / total) * 100) : 0;

                      return (
                        <tr key={entry.id} className="border-b border-slate-100">
                          <td className="p-3 font-medium text-slate-800">{entry.date}</td>
                          <td className="p-3 text-slate-600">{entry.className}</td>
                          <td className="p-3 text-slate-600">{entry.subject}</td>
                          <td className="p-3 text-slate-600">{entry.teacherId}</td>
                          <td className="p-3 text-slate-600">
                            {present}/{total}
                          </td>
                          <td className="p-3 text-slate-600">{percent}%</td>
                        </tr>
                      );
                    })
                ) : (
                  <tr className="border-b border-slate-100">
                    <td className="p-4 text-slate-500" colSpan={6}>
                      No attendance logs found for the selected class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </DashboardLayout>
  );
}

export default AttendanceOverview;
