import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import useSchoolData from "../../hooks/useSchoolData";
import {
  formatCurrency,
  formatDate,
  getAttendancePercent,
  getStatusClassName,
} from "../../utils/schoolMetrics";

const PROFILE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "attendance", label: "Attendance" },
  { id: "results", label: "Results" },
  { id: "fees", label: "Fees" },
  { id: "documents", label: "Documents" },
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampPercent = (value) =>
  Math.max(Math.min(Math.round(Number(value) || 0), 100), 0);

const getDocumentDisplayName = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const parsedUrl = new URL(raw);
    const fileName = parsedUrl.pathname.split("/").filter(Boolean).pop() || raw;
    return decodeURIComponent(fileName);
  } catch {
    const fileName = raw.replace(/\\/g, "/").split("/").filter(Boolean).pop() || raw;
    return decodeURIComponent(fileName);
  }
};

const isDocumentUrl = (value) => {
  const raw = String(value || "").trim();
  return /^https?:\/\//i.test(raw) || raw.startsWith("/uploads/");
};

const toMonthLabel = (value) => {
  if (!/^\d{4}-\d{2}$/.test(String(value || ""))) {
    return String(value || "-");
  }

  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

const toCsvCell = (value) => {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
};

function StudentProfile() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(PROFILE_TABS[0].id);
  const { schoolData } = useSchoolData();
  const {
    students = [],
    parents = [],
    teachers = [],
    attendance = [],
    results = [],
    enquiries = [],
  } = schoolData;

  const student = useMemo(
    () => students.find((entry) => String(entry.id) === String(studentId)) || null,
    [studentId, students]
  );

  const teacherLookup = useMemo(
    () =>
      new Map(
        teachers.map((teacher) => [
          String(teacher.id || "").trim(),
          String(teacher.name || "").trim(),
        ])
      ),
    [teachers]
  );

  const details = useMemo(() => {
    if (!student) {
      return null;
    }

    const linkedParent =
      parents.find((parent) => parent.id === student.parentId) ||
      parents.find((parent) => parent.studentId === student.id) ||
      null;

    const linkedEnquiry = enquiries.find(
      (entry) => String(entry.id || "") === String(student.enquiryId || "")
    );

    const attendanceRows = attendance
      .flatMap((entry) => {
        const matchedRecord = Array.isArray(entry.records)
          ? entry.records.find(
              (record) => String(record.studentId || "") === String(student.id)
            )
          : null;

        if (!matchedRecord) {
          return [];
        }

        return [
          {
            id: `${entry.id}-${student.id}`,
            date: entry.date,
            className: entry.className,
            subject: entry.subject,
            status: String(matchedRecord.status || "Present"),
          },
        ];
      })
      .sort((first, second) =>
        String(second.date || "").localeCompare(String(first.date || ""))
      );

    const resultRows = results
      .filter((entry) => String(entry.studentId || "") === String(student.id))
      .map((entry) => {
        const maxMarks = toNumber(entry.maxMarks) || 100;
        const marks = toNumber(entry.marks);
        const percent = clampPercent((marks / maxMarks) * 100);

        return {
          ...entry,
          maxMarks,
          marks,
          percent,
          teacherName:
            teacherLookup.get(String(entry.teacherId || "").trim()) || entry.teacherId || "-",
        };
      })
      .sort((first, second) =>
        String(second.publishedDate || "").localeCompare(String(first.publishedDate || ""))
      );

    const averageMarks = resultRows.length
      ? Math.round(
          resultRows.reduce((sum, row) => sum + toNumber(row.percent), 0) / resultRows.length
        )
      : 0;

    const subjectWise = [...resultRows.reduce((map, row) => {
      const key = String(row.subject || "General").trim() || "General";
      const current = map.get(key) || { scoreTotal: 0, count: 0 };
      map.set(key, {
        scoreTotal: current.scoreTotal + row.percent,
        count: current.count + 1,
      });
      return map;
    }, new Map())]
      .map(([subject, summary]) => ({
        subject,
        averageMarks: summary.count
          ? Math.round(summary.scoreTotal / summary.count)
          : 0,
      }))
      .sort((first, second) => second.averageMarks - first.averageMarks);

    const monthlyAttendance = [...attendanceRows.reduce((map, row) => {
      const month = /^\d{4}-\d{2}/.test(String(row.date || ""))
        ? String(row.date).slice(0, 7)
        : "";
      if (!month) {
        return map;
      }

      const current = map.get(month) || { present: 0, total: 0 };
      const isPresent = String(row.status || "").toLowerCase() === "present";
      map.set(month, {
        present: current.present + (isPresent ? 1 : 0),
        total: current.total + 1,
      });
      return map;
    }, new Map())]
      .sort((first, second) => first[0].localeCompare(second[0]))
      .slice(-8)
      .map(([month, summary]) => ({
        month,
        present: summary.present,
        total: summary.total,
        percent: summary.total
          ? Math.round((summary.present / summary.total) * 100)
          : 0,
      }));

    const fee = student.fee || {};
    const totalFees = toNumber(fee.totalFees ?? fee.annualFee);
    const paidAmount = toNumber(fee.paidAmount ?? fee.paid);
    const pendingAmount =
      toNumber(fee.pendingAmount ?? fee.due) || Math.max(totalFees - paidAmount, 0);
    const feeStatus = String(fee.paymentStatus || fee.status || "Pending").trim() || "Pending";

    const paymentHistory = Array.isArray(fee.paymentHistory)
      ? fee.paymentHistory
          .map((entry, index) => ({
            id: String(entry.id || `payment-${index}`),
            date: String(entry.date || "").trim(),
            amount: toNumber(entry.amount),
            method: String(entry.method || "Recorded").trim() || "Recorded",
            status: String(entry.status || "Paid").trim() || "Paid",
            reference: String(entry.reference || "").trim(),
          }))
          .sort((first, second) =>
            String(second.date || "").localeCompare(String(first.date || ""))
          )
      : [];

    const documents = [
      {
        key: "studentPhoto",
        label: "Student Photo",
        value: student.studentPhoto || student.documents?.studentPhoto || "",
      },
      {
        key: "birthCertificate",
        label: "Birth Certificate",
        value: student.birthCertificate || student.documents?.birthCertificate || "",
      },
      {
        key: "aadhaarCard",
        label: "Aadhaar Card",
        value: student.aadhaarCard || student.documents?.aadhaarCard || "",
      },
      {
        key: "tcDocument",
        label: "TC Document",
        value: student.tcDocument || student.documents?.tcDocument || "",
      },
    ];

    return {
      linkedParent,
      linkedEnquiry,
      attendanceRows,
      monthlyAttendance,
      resultRows,
      averageMarks,
      subjectWise,
      feeSummary: {
        totalFees,
        paidAmount,
        pendingAmount,
        feeStatus,
        dueDate: fee.dueDate,
        paymentHistory,
      },
      documents,
    };
  }, [attendance, enquiries, parents, results, student, teacherLookup]);

  const handleDownloadReportCard = () => {
    if (!student || !details) {
      return;
    }

    const rows = [
      ["Student Report Card"],
      ["Student ID", student.id],
      ["Name", student.name],
      ["Admission Number", student.admissionNumber || ""],
      ["Class", student.className || ""],
      ["Roll Number", student.rollNumber || ""],
      ["Attendance Percent", `${getAttendancePercent(student.attendance)}%`],
      ["Result Average", `${details.averageMarks}%`],
      ["Fee Status", details.feeSummary.feeStatus],
      ["Fee Due", formatCurrency(details.feeSummary.pendingAmount)],
      [],
      ["Exam", "Subject", "Marks", "Max Marks", "Percent", "Teacher", "Published"],
      ...details.resultRows.map((entry) => [
        entry.exam || "",
        entry.subject || "",
        entry.marks,
        entry.maxMarks,
        `${entry.percent}%`,
        entry.teacherName,
        formatDate(entry.publishedDate),
      ]),
    ];

    const csvContent = rows
      .map((row) => row.map((cell) => toCsvCell(cell)).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${student.admissionNumber || student.id}-report-card.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!student || !details) {
    return (
      <DashboardLayout>
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          <h1 className="text-2xl font-bold">Student profile not found</h1>
          <p className="mt-2 text-sm">The selected student record is unavailable.</p>
          <button
            type="button"
            onClick={() => navigate("/admin/students")}
            className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Back to Student Management
          </button>
        </section>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
              Student Profile
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">{student.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {student.admissionNumber || "Pending admission"} | {student.className} | Roll {student.rollNumber || "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadReportCard}
              className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Download Report Card
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/students")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Students
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Attendance</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {getAttendancePercent(student.attendance)}%
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Average Marks</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{details.averageMarks}%</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Fee Due</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatCurrency(details.feeSummary.pendingAmount)}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Status</p>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(
                student.status || "Active"
              )}`}
            >
              {student.status || "Active"}
            </span>
          </article>
        </div>

        <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {PROFILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Date of Birth</dt>
                  <dd className="font-medium text-slate-800">{formatDate(student.dateOfBirth)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Gender</dt>
                  <dd className="font-medium text-slate-800">{student.gender || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Blood Group</dt>
                  <dd className="font-medium text-slate-800">{student.bloodGroup || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Aadhaar</dt>
                  <dd className="font-medium text-slate-800">{student.aadhaarNumber || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Mobile</dt>
                  <dd className="font-medium text-slate-800">{student.mobileNumber || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-medium text-slate-800">{student.email || "-"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Address</dt>
                  <dd className="font-medium text-slate-800">
                    {student.address || "-"}
                    {student.city ? `, ${student.city}` : ""}
                    {student.state ? `, ${student.state}` : ""}
                    {student.pincode ? ` - ${student.pincode}` : ""}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Parent & Academic</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Father Name</dt>
                  <dd className="font-medium text-slate-800">{student.fatherName || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Father Phone</dt>
                  <dd className="font-medium text-slate-800">{student.fatherPhone || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Mother Name</dt>
                  <dd className="font-medium text-slate-800">{student.motherName || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Mother Phone</dt>
                  <dd className="font-medium text-slate-800">{student.motherPhone || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Parent Login Email</dt>
                  <dd className="font-medium text-slate-800">
                    {details.linkedParent?.email || student.parentEmail || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Admission Date</dt>
                  <dd className="font-medium text-slate-800">{formatDate(student.admissionDate)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Previous School</dt>
                  <dd className="font-medium text-slate-800">{student.previousSchoolName || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Conversion</dt>
                  <dd className="font-medium text-slate-800">{student.conversionStatus || "-"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Linked Enquiry</dt>
                  <dd className="font-medium text-slate-800">
                    {details.linkedEnquiry
                      ? `${details.linkedEnquiry.id} (${details.linkedEnquiry.stage})`
                      : student.enquiryId || "-"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        ) : null}

        {activeTab === "attendance" ? (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Monthly Attendance</h2>
              <div className="mt-4 space-y-3">
                {details.monthlyAttendance.map((entry) => (
                  <article key={entry.month}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <p className="font-medium text-slate-700">{toMonthLabel(entry.month)}</p>
                      <p className="text-slate-500">{entry.percent}%</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(entry.percent, 8)}%` }}
                      />
                    </div>
                  </article>
                ))}

                {!details.monthlyAttendance.length ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                    Monthly trend data is not available yet.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  {details.attendanceRows.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">{formatDate(entry.date)}</td>
                      <td className="p-3 text-slate-700">{entry.className || "-"}</td>
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

                  {!details.attendanceRows.length ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={4}>
                        No attendance records available.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
          </div>
        ) : null}

        {activeTab === "results" ? (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Subject Performance</h2>
              <div className="mt-4 space-y-3">
                {details.subjectWise.map((entry) => (
                  <article key={entry.subject}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <p className="font-medium text-slate-700">{entry.subject}</p>
                      <p className="text-slate-500">{entry.averageMarks}%</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${Math.max(entry.averageMarks, 8)}%` }}
                      />
                    </div>
                  </article>
                ))}

                {!details.subjectWise.length ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                    Subject-wise graph appears after marks are published.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  {details.resultRows.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">{entry.exam || "-"}</td>
                      <td className="p-3 text-slate-700">{entry.subject || "-"}</td>
                      <td className="p-3 text-slate-700">
                        {entry.marks}/{entry.maxMarks} ({entry.percent}%)
                      </td>
                      <td className="p-3 text-slate-700">{entry.teacherName}</td>
                      <td className="p-3 text-slate-700">{formatDate(entry.publishedDate)}</td>
                    </tr>
                  ))}

                  {!details.resultRows.length ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={5}>
                        No marks published for this student.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
          </div>
        ) : null}

        {activeTab === "fees" ? (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Fee Summary</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Total Fees</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatCurrency(details.feeSummary.totalFees)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Paid</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatCurrency(details.feeSummary.paidAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Due</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatCurrency(details.feeSummary.pendingAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Due Date</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatDate(details.feeSummary.dueDate)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(
                        details.feeSummary.feeStatus
                      )}`}
                    >
                      {details.feeSummary.feeStatus}
                    </span>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  {details.feeSummary.paymentHistory.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">{formatDate(entry.date)}</td>
                      <td className="p-3 text-slate-700">{formatCurrency(entry.amount)}</td>
                      <td className="p-3 text-slate-700">{entry.method || "-"}</td>
                      <td className="p-3 text-slate-700">{entry.reference || "-"}</td>
                      <td className="p-3 text-slate-700">{entry.status || "Paid"}</td>
                    </tr>
                  ))}

                  {!details.feeSummary.paymentHistory.length ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={5}>
                        No payment history available.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
          </div>
        ) : null}

        {activeTab === "documents" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {details.documents.map((document) => {
              const rawValue = String(document.value || "").trim();
              const displayName = getDocumentDisplayName(rawValue);
              const hasUrl = isDocumentUrl(rawValue);

              return (
                <article
                  key={document.key}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h2 className="text-lg font-semibold text-slate-900">{document.label}</h2>
                  {rawValue ? (
                    hasUrl ? (
                      <a
                        href={rawValue}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:text-blue-800"
                      >
                        View {displayName || "document"}
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-slate-700">{displayName || rawValue}</p>
                    )
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Not uploaded</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </DashboardLayout>
  );
}

export default StudentProfile;
