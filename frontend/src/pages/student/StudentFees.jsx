import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  formatCurrency,
  formatDate,
  getStatusClassName,
} from "../../utils/schoolMetrics";
import {
  clampPercent,
  getStudentDashboardRows,
  useStudentDashboardData,
} from "./studentDashboardShared";

function StudentFees() {
  const navigate = useNavigate();
  const { dashboard, loading, error } = useStudentDashboardData();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-slate-600">Loading fee details...</div>
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
          Fee data is not available.
        </div>
      </DashboardLayout>
    );
  }

  const { paymentHistory } = getStudentDashboardRows(dashboard);
  const feeProgress = clampPercent(dashboard.fees?.progressPercent);

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Fees & Payments</h1>
            <p className="mt-1 text-slate-500">
              Review your annual fee status and complete payment records.
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Current Fee Status</h2>
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

          <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Annual Fee
              </dt>
              <dd className="mt-1 text-base font-semibold text-slate-900">
                {formatCurrency(dashboard.fees?.annualFee)}
              </dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Paid
              </dt>
              <dd className="mt-1 text-base font-semibold text-slate-900">
                {formatCurrency(dashboard.fees?.paid)}
              </dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Due
              </dt>
              <dd className="mt-1 text-base font-semibold text-slate-900">
                {formatCurrency(dashboard.fees?.due)}
              </dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Due Date
              </dt>
              <dd className="mt-1 text-base font-semibold text-slate-900">
                {formatDate(dashboard.fees?.dueDate)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Online payment gateway integration is coming soon. Until then, contact the accounts
            desk for receipt-backed payments.
          </p>
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
                    <td className="p-3 text-slate-700">{formatDate(entry.date)}</td>
                    <td className="p-3 text-slate-700">{formatCurrency(entry.amount)}</td>
                    <td className="p-3 text-slate-700">{entry.method || "-"}</td>
                    <td className="p-3 text-slate-700">{entry.reference || "-"}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(
                          entry.status
                        )}`}
                      >
                        {entry.status || "Paid"}
                      </span>
                    </td>
                  </tr>
                ))}

                {!paymentHistory.length ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={5}>
                      No payment history has been recorded yet.
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

export default StudentFees;
