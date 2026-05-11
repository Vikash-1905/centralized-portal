import { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  formatCurrency,
  formatDate,
  getStatusClassName,
} from "../../utils/schoolMetrics";
import {
  clampPercent,
  getChildDashboardRows,
  useParentDashboardData,
} from "./parentDashboardShared";

function ParentFees() {
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
  const feeDue = Number(child.fees?.due || 0);
  const feeProgress = clampPercent(child.fees?.progressPercent);
  const { paymentHistory } = getChildDashboardRows(child);

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Fees — {child.name}</h1>
            <p className="mt-1 text-slate-500">
              Class {child.className}
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
          <h2 className="text-xl font-semibold text-slate-900">Fee Summary</h2>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Current status</p>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(child.fees?.status)}`}>
                {child.fees?.status || "Pending"}
              </span>
            </div>
            <div className="mt-4 h-2.5 rounded-full bg-slate-100">
              <div className="h-2.5 rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${feeProgress}%` }} />
            </div>
            <dl className="mt-5 space-y-4 text-sm text-slate-600">
              <div className="flex justify-between gap-4">
                <dt>Annual Fee</dt>
                <dd className="font-semibold text-slate-800">{formatCurrency(child.fees?.annualFee)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Paid</dt>
                <dd className="font-semibold text-emerald-700">{formatCurrency(child.fees?.paid)}</dd>
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
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="rounded-lg bg-[#7dc242] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6cae3c]">
                Pay Now
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Payment History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Amount</th>
                  <th className="p-3 font-semibold">Method</th>
                  <th className="p-3 font-semibold">Reference</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-800">{formatDate(entry.date)}</td>
                    <td className="p-3 text-slate-700">{formatCurrency(entry.amount)}</td>
                    <td className="p-3 text-slate-700">{entry.method}</td>
                    <td className="p-3 text-slate-600">{entry.reference || "-"}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!paymentHistory.length ? (
                  <tr><td className="p-4 text-slate-500" colSpan={5}>No payment records yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </DashboardLayout>
  );
}

export default ParentFees;
