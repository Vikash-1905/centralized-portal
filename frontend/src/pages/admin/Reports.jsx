import { useMemo, useCallback, useEffect } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import useSchoolData from "../../hooks/useSchoolData";
import { formatCurrency, getFeeSummary } from "../../utils/schoolMetrics";

const downloadCsv = (fileName, rows) => {
  const csvContent = rows
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

function Reports() {
  const { schoolData, isSyncing, refreshSchoolData, cleanupData } = useSchoolData();
  const { attendance, enquiries, students, teachers } = schoolData;

  const handleRefreshData = useCallback(async () => {
    try {
      // First cleanup orphaned data
      await cleanupData();
      // Then refresh to get latest state
      await refreshSchoolData();
    } catch (error) {
      console.error("Error during data refresh", error);
    }
  }, [cleanupData, refreshSchoolData]);

  const feeSummary = useMemo(() => getFeeSummary(students), [students]);

  const attendanceSummary = useMemo(() => {
    // Filter out attendance entries with no records (empty entries)
    const validAttendanceEntries = (attendance || []).filter(
      (entry) => Array.isArray(entry.records) && entry.records.length > 0
    );

    const totals = validAttendanceEntries.reduce(
      (summary, entry) => {
        const present = (entry.records || []).filter((record) => record.status === "Present").length;
        const total = (entry.records || []).length;

        return {
          present: summary.present + present,
          total: summary.total + total,
        };
      },
      { present: 0, total: 0 }
    );

    return {
      ...totals,
      percent: totals.total ? Math.round((totals.present / totals.total) * 100) : 0,
    };
  }, [attendance]);

  const conversionRate = enquiries.length
    ? Math.round(
        (enquiries.filter((entry) => String(entry.status || "").toLowerCase() === "converted")
          .length /
          enquiries.length) *
          100
      )
    : 0;

  const exportStudents = () => {
    const rows = [
      ["Student ID", "Name", "Email", "Class", "Parent", "Annual Fee", "Paid", "Due"],
      ...students.map((student) => [
        student.id,
        student.name,
        student.email,
        student.className,
        student.parentName,
        student.fee?.annualFee || 0,
        student.fee?.paid || 0,
        student.fee?.due || 0,
      ]),
    ];

    downloadCsv("students-report.csv", rows);
  };

  const exportFees = () => {
    const rows = [
      ["Student", "Class", "Annual Fee", "Paid", "Due", "Due Date", "Fee Status"],
      ...students.map((student) => [
        student.name,
        student.className,
        student.fee?.annualFee || 0,
        student.fee?.paid || 0,
        student.fee?.due || 0,
        student.fee?.dueDate || "",
        student.fee?.status || "",
      ]),
    ];

    downloadCsv("fees-report.csv", rows);
  };

  const exportAdmissions = () => {
    const rows = [
      ["Lead ID", "Student", "Guardian", "Phone", "Stage", "Status", "Owner", "Follow-Up"],
      ...enquiries.map((enquiry) => [
        enquiry.id,
        enquiry.studentName,
        enquiry.guardianName,
        enquiry.phone,
        enquiry.stage,
        enquiry.status,
        enquiry.owner,
        enquiry.followUpDate,
      ]),
    ];

    downloadCsv("admissions-report.csv", rows);
  };

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Reports and Analytics</h1>
            <p className="mt-2 max-w-3xl text-slate-500">
              Generate operational reports for students, finance, attendance, and admissions with export-ready output.
            </p>
          </div>

          <div className="flex gap-2 self-start">
            <button
              type="button"
              onClick={handleRefreshData}
              disabled={isSyncing}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? "Refreshing..." : "Refresh Data"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Print or Save PDF
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Students</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{students.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Teachers</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{teachers.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net Collection</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(feeSummary.paid)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance Average</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{attendanceSummary.percent}%</p>
          </article>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Export Center</h2>
          <p className="mt-1 text-sm text-slate-500">
            Download CSV files for Excel workflows. PDF can be generated through browser print.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportStudents}
              className="rounded-lg bg-[#7dc242] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6cae3c]"
            >
              Export Student Report
            </button>
            <button
              type="button"
              onClick={exportFees}
              className="rounded-lg bg-[#7dc242] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6cae3c]"
            >
              Export Fee Report
            </button>
            <button
              type="button"
              onClick={exportAdmissions}
              className="rounded-lg bg-[#7dc242] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6cae3c]"
            >
              Export Admission Report
            </button>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Admissions Funnel</h3>
            <p className="mt-2 text-sm text-slate-500">
              Total enquiries: {enquiries.length} | Conversion rate: {conversionRate}%
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Fees Snapshot</h3>
            <p className="mt-2 text-sm text-slate-500">
              Annual: {formatCurrency(feeSummary.annual)} | Pending: {formatCurrency(feeSummary.due)}
            </p>
          </article>
        </section>
      </section>
    </DashboardLayout>
  );
}

export default Reports;
