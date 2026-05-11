import { useMemo } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import useSchoolData from "../../hooks/useSchoolData";
import { formatCurrency, getFeeSummary } from "../../utils/schoolMetrics";

function FeesManagement() {
  const { schoolData } = useSchoolData();
  const { students } = schoolData;

  const feeSummary = useMemo(() => getFeeSummary(students), [students]);

  const collectionRate =
    feeSummary.annual > 0 ? Math.round((feeSummary.paid / feeSummary.annual) * 100) : 0;

  const pendingStudents = useMemo(
    () =>
      [...students]
        .filter((student) => Number(student.fee?.due || 0) > 0)
        .sort((a, b) => Number(b.fee?.due || 0) - Number(a.fee?.due || 0)),
    [students]
  );

  const classWiseFees = useMemo(() => {
    const bucket = new Map();

    students.forEach((student) => {
      const className = student.className || "Unassigned";
      const current = bucket.get(className) || { annual: 0, paid: 0, due: 0, students: 0 };

      bucket.set(className, {
        annual: current.annual + Number(student.fee?.annualFee || 0),
        paid: current.paid + Number(student.fee?.paid || 0),
        due: current.due + Number(student.fee?.due || 0),
        students: current.students + 1,
      });
    });

    return [...bucket.entries()]
      .map(([className, value]) => ({ className, ...value }))
      .sort((a, b) => b.due - a.due);
  }, [students]);

  const highestDue = Math.max(...classWiseFees.map((entry) => entry.due), 1);

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Fee Management</h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Track school collections, pending dues, and class-wise fee health with one finance view.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Revenue</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(feeSummary.paid)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Fees</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(feeSummary.due)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Annual Fee Base</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(feeSummary.annual)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collection Rate</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{collectionRate}%</p>
          </article>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Class-wise Due Distribution</h2>
            <div className="mt-5 space-y-4">
              {classWiseFees.length ? (
                classWiseFees.map((entry) => (
                  <div key={entry.className}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{entry.className}</span>
                      <span className="text-slate-500">{formatCurrency(entry.due)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-cyan-500"
                        style={{ width: `${(entry.due / highestDue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No fee records available yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Finance Signals</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Students with pending dues</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{pendingStudents.length}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Average due per pending student</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {formatCurrency(
                    pendingStudents.length ? feeSummary.due / pendingStudents.length : 0
                  )}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Fine calculation</p>
                <p className="mt-1 text-sm text-slate-500">
                  Fine and online payment integration can be attached to this module in phase 2.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Pending Dues</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Student</th>
                  <th className="p-3 font-semibold">Class</th>
                  <th className="p-3 font-semibold">Annual</th>
                  <th className="p-3 font-semibold">Paid</th>
                  <th className="p-3 font-semibold">Due</th>
                  <th className="p-3 font-semibold">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {pendingStudents.length ? (
                  pendingStudents.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="p-3">
                        <p className="font-semibold text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-500">{student.id}</p>
                      </td>
                      <td className="p-3 text-slate-600">{student.className || "-"}</td>
                      <td className="p-3 text-slate-600">{formatCurrency(student.fee?.annualFee)}</td>
                      <td className="p-3 text-slate-600">{formatCurrency(student.fee?.paid)}</td>
                      <td className="p-3 text-slate-600">{formatCurrency(student.fee?.due)}</td>
                      <td className="p-3 text-slate-600">{student.fee?.dueDate || "Not set"}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b border-slate-100">
                    <td className="p-4 text-slate-500" colSpan={6}>
                      No pending dues found.
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

export default FeesManagement;
