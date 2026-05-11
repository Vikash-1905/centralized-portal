export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export const formatDate = (value) => {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

export const getAttendancePercent = (attendance) => {
  if (!attendance?.total) return 0;
  return Math.round((attendance.present / attendance.total) * 100);
};

export const getResultAverage = (results) => {
  if (!results.length) return 0;

  const totalPercent = results.reduce(
    (sum, result) => sum + (Number(result.marks) / Number(result.maxMarks || 100)) * 100,
    0
  );

  return Math.round(totalPercent / results.length);
};

export const getStudentClassLabel = (student) =>
  student?.className || [student?.standard, student?.section].filter(Boolean).join("");

export const getClassStudents = (students, className) =>
  students.filter((student) => getStudentClassLabel(student) === className);

export const getFeeSummary = (students) =>
  students.reduce(
    (summary, student) => ({
      annual: summary.annual + Number(student.fee?.annualFee || 0),
      paid: summary.paid + Number(student.fee?.paid || 0),
      due: summary.due + Number(student.fee?.due || 0),
    }),
    { annual: 0, paid: 0, due: 0 }
  );

export const statusClasses = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  New: "bg-slate-100 text-slate-700 ring-slate-200",
  Contacted: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  Interested: "bg-blue-50 text-blue-700 ring-blue-200",
  "Visit Scheduled": "bg-teal-50 text-teal-700 ring-teal-200",
  Applied: "bg-amber-50 text-amber-700 ring-amber-200",
  Rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  Paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Partial: "bg-teal-50 text-teal-700 ring-teal-200",
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
  Due: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  Present: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Absent: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  Converted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Follow-up Today": "bg-teal-50 text-teal-700 ring-teal-200",
  "Campus Visit Booked": "bg-teal-50 text-teal-700 ring-teal-200",
  "Application Shared": "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "New Lead": "bg-slate-100 text-slate-700 ring-slate-200",
};

export const getStatusClassName = (status) =>
  statusClasses[status] || "bg-slate-100 text-slate-700 ring-slate-200";
