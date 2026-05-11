import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import useSchoolData from "../../hooks/useSchoolData";
import { formatDate } from "../../utils/schoolMetrics";

const PROFILE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "classes", label: "Classes & Students" },
  { id: "attendance", label: "Attendance" },
  { id: "results", label: "Results" },
  { id: "activity", label: "Activity" },
];

const toAssignedClassList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const toSubjectList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const toTeacherSubjectList = (teacher) =>
  [...new Set([...toSubjectList(teacher?.subjects), ...toSubjectList(teacher?.subject)])];

const formatTeacherSubjects = (teacher, fallback = "-") => {
  const subjectList = toTeacherSubjectList(teacher);
  return subjectList.length ? subjectList.join(", ") : fallback;
};

const formatAssignedClassLabel = (className /* section removed */) =>
  `${String(className || "").trim().replace(/\s+/g, "")}`;

const normalizeAssignedClassValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "");

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

const relativeTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  const diffMs = Math.max(Date.now() - date.getTime(), 0);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `${Math.max(diffMinutes, 1)} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

function TeacherProfile() {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(PROFILE_TABS[0].id);
  const { schoolData } = useSchoolData();
  const {
    teachers = [],
    students = [],
    attendance = [],
    results = [],
    notices = [],
  } = schoolData;

  const teacher = useMemo(
    () => teachers.find((entry) => String(entry.id) === String(teacherId)) || null,
    [teacherId, teachers]
  );
  const teacherSubjectsLabel = formatTeacherSubjects(teacher);

  const details = useMemo(() => {
    if (!teacher) {
      return null;
    }

    const teacherClasses = [...new Set(toAssignedClassList(teacher.classes))];
    const teacherClassKeys = new Set(
      teacherClasses.map((entry) => normalizeAssignedClassValue(entry))
    );

    const assignedStudents = students.filter((student) => {
      const exactClass = formatAssignedClassLabel(student.className);
      const classOnly = String(student.className || "").trim();

      return (
        teacherClassKeys.has(normalizeAssignedClassValue(exactClass)) ||
        teacherClassKeys.has(normalizeAssignedClassValue(classOnly))
      );
    });

    const studentLookup = new Map(
      assignedStudents.map((student) => [String(student.id || ""), student])
    );

    const attendanceRows = attendance
      .filter((entry) => String(entry.teacherId || "") === String(teacher.id))
      .map((entry) => {
        const records = Array.isArray(entry.records) ? entry.records : [];
        const presentCount = records.filter(
          (record) => String(record.status || "").toLowerCase() === "present"
        ).length;
        const totalCount = records.length;
        const attendancePercent = totalCount
          ? Math.round((presentCount / totalCount) * 100)
          : 0;

        return {
          id: entry.id,
          date: entry.date,
          className: entry.className,
          subject: entry.subject,
          presentCount,
          totalCount,
          attendancePercent,
        };
      })
      .sort((first, second) =>
        String(second.date || "").localeCompare(String(first.date || ""))
      );

    const monthlyAttendance = [...attendanceRows.reduce((map, row) => {
      const month = /^\d{4}-\d{2}/.test(String(row.date || ""))
        ? String(row.date).slice(0, 7)
        : "";
      if (!month) {
        return map;
      }

      const current = map.get(month) || { present: 0, total: 0 };
      map.set(month, {
        present: current.present + row.presentCount,
        total: current.total + row.totalCount,
      });
      return map;
    }, new Map())]
      .sort((first, second) => first[0].localeCompare(second[0]))
      .slice(-8)
      .map(([month, summary]) => ({
        month,
        percent: summary.total
          ? Math.round((summary.present / summary.total) * 100)
          : 0,
      }));

    const resultRows = results
      .filter((entry) => String(entry.teacherId || "") === String(teacher.id))
      .map((entry) => {
        const maxMarks = toNumber(entry.maxMarks) || 100;
        const marks = toNumber(entry.marks);
        const percent = Math.round((marks / maxMarks) * 100);
        const linkedStudent = studentLookup.get(String(entry.studentId || ""));

        return {
          ...entry,
          maxMarks,
          marks,
          percent,
          studentName: linkedStudent?.name || entry.studentId || "-",
          classLabel: linkedStudent
            ? `${linkedStudent.className || ""}`
            : "-",
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

    const averageAttendanceRate = attendanceRows.length
      ? Math.round(
          attendanceRows.reduce((sum, row) => sum + toNumber(row.attendancePercent), 0) /
            attendanceRows.length
        )
      : 0;

    const subjectPerformance = [...resultRows.reduce((map, row) => {
      const key = String(row.subject || "General").trim() || "General";
      const current = map.get(key) || { total: 0, count: 0 };
      map.set(key, {
        total: current.total + row.percent,
        count: current.count + 1,
      });
      return map;
    }, new Map())]
      .map(([subject, summary]) => ({
        subject,
        averageMarks: summary.count ? Math.round(summary.total / summary.count) : 0,
      }))
      .sort((first, second) => second.averageMarks - first.averageMarks);

    const classSummary = teacherClasses.map((classLabel) => {
      const classKey = normalizeAssignedClassValue(classLabel);
      const studentsInClass = assignedStudents.filter((student) => {
        const studentClassLabel = formatAssignedClassLabel(student.className);
        const normalizedLabel = normalizeAssignedClassValue(studentClassLabel);
        const normalizedClassOnly = normalizeAssignedClassValue(student.className);
        return classKey === normalizedLabel || classKey === normalizedClassOnly;
      });

      const studentIds = new Set(studentsInClass.map((student) => String(student.id || "")));
      const classResults = resultRows.filter((row) => studentIds.has(String(row.studentId || "")));
      const classAverageMarks = classResults.length
        ? Math.round(
            classResults.reduce((sum, row) => sum + toNumber(row.percent), 0) /
              classResults.length
          )
        : 0;

      const attendanceAvg = studentsInClass.length
        ? Math.round(
            studentsInClass.reduce((sum, student) => {
              const studentAttendance = student.attendance || {};
              const present = toNumber(studentAttendance.present);
              const total = toNumber(studentAttendance.total);
              return sum + (total ? Math.round((present / total) * 100) : 0);
            }, 0) / studentsInClass.length
          )
        : 0;

      return {
        classLabel,
        studentCount: studentsInClass.length,
        classAverageMarks,
        attendanceAvg,
      };
    });

    const activityFeed = [
      ...attendanceRows.slice(0, 4).map((entry) => ({
        id: `attendance-${entry.id}`,
        text: `Attendance submitted for ${entry.className || "class"} (${entry.subject || "subject"})`,
        date: entry.date,
        tone: "attendance",
      })),
      ...resultRows.slice(0, 4).map((entry) => ({
        id: `result-${entry.id}`,
        text: `Marks uploaded for ${entry.studentName} (${entry.exam || "assessment"})`,
        date: entry.publishedDate,
        tone: "result",
      })),
      ...notices
        .filter((entry) => String(entry.teacherId || "") === String(teacher.id))
        .slice(0, 4)
        .map((entry) => ({
          id: `notice-${entry.id}`,
          text: entry.title || "Assignment notice posted",
          date: entry.updatedAt || entry.date || entry.createdAt,
          tone: "notice",
        })),
    ]
      .sort((first, second) =>
        String(second.date || "").localeCompare(String(first.date || ""))
      )
      .slice(0, 10)
      .map((entry) => ({
        ...entry,
        timeAgo: relativeTime(entry.date || new Date().toISOString()),
      }));

    return {
      teacherClasses,
      assignedStudents,
      attendanceRows,
      monthlyAttendance,
      resultRows,
      averageMarks,
      averageAttendanceRate,
      subjectPerformance,
      classSummary,
      activityFeed,
    };
  }, [attendance, notices, results, students, teacher]);

  const handleDownloadTeacherReport = () => {
    if (!teacher || !details) {
      return;
    }

    const rows = [
      ["Teacher Profile Report"],
      ["Teacher ID", teacher.id],
      ["Name", teacher.name],
      ["Email", teacher.email || ""],
      ["Subjects", formatTeacherSubjects(teacher, "")],
      ["Department", teacher.department || ""],
      ["Phone", teacher.phone || ""],
      ["Joining Date", teacher.joiningDate || ""],
      ["Status", teacher.status || "Active"],
      ["Assigned Classes", details.teacherClasses.join(" | ")],
      ["Assigned Students", details.assignedStudents.length],
      ["Average Marks", `${details.averageMarks}%`],
      ["Average Attendance", `${details.averageAttendanceRate}%`],
      [],
      ["Class", "Students", "Average Marks", "Attendance Avg"],
      ...details.classSummary.map((entry) => [
        entry.classLabel,
        entry.studentCount,
        `${entry.classAverageMarks}%`,
        `${entry.attendanceAvg}%`,
      ]),
      [],
      ["Exam", "Student", "Class", "Marks", "Max", "Percent", "Published"],
      ...details.resultRows.map((entry) => [
        entry.exam || "",
        entry.studentName || "",
        entry.classLabel || "",
        entry.marks,
        entry.maxMarks,
        `${entry.percent}%`,
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
    link.download = `${teacher.id}-teacher-profile-report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!teacher || !details) {
    return (
      <DashboardLayout>
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          <h1 className="text-2xl font-bold">Teacher profile not found</h1>
          <p className="mt-2 text-sm">The selected teacher record is unavailable.</p>
          <button
            type="button"
            onClick={() => navigate("/admin/teachers")}
            className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Back to Teachers Management
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
              Teacher Profile
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">{teacher.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {teacherSubjectsLabel} | {teacher.department || "No department"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadTeacherReport}
              className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Download Teacher Report
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/teachers")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Teachers
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Assigned Classes</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{details.teacherClasses.length}</p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Assigned Students</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{details.assignedStudents.length}</p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Average Marks</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{details.averageMarks}%</p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Attendance Rate</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{details.averageAttendanceRate}%</p>
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
              <h2 className="text-lg font-semibold text-slate-900">Teacher Information</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-medium text-slate-800">{teacher.email || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-medium text-slate-800">{teacher.phone || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Subjects</dt>
                  <dd className="font-medium text-slate-800">{teacherSubjectsLabel}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Department</dt>
                  <dd className="font-medium text-slate-800">{teacher.department || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Joining Date</dt>
                  <dd className="font-medium text-slate-800">{formatDate(teacher.joiningDate)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-medium text-slate-800">{teacher.status || "Active"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Assigned Class Tags</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {details.teacherClasses.map((entry) => (
                  <span
                    key={entry}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    {entry}
                  </span>
                ))}

                {!details.teacherClasses.length ? (
                  <p className="text-sm text-slate-500">No classes assigned.</p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "classes" ? (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-3 font-semibold">Class</th>
                    <th className="p-3 font-semibold">Students</th>
                    <th className="p-3 font-semibold">Marks Avg</th>
                    <th className="p-3 font-semibold">Attendance Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {details.classSummary.map((entry) => (
                    <tr key={entry.classLabel} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">{entry.classLabel}</td>
                      <td className="p-3 text-slate-700">{entry.studentCount}</td>
                      <td className="p-3 text-slate-700">{entry.classAverageMarks}%</td>
                      <td className="p-3 text-slate-700">{entry.attendanceAvg}%</td>
                    </tr>
                  ))}

                  {!details.classSummary.length ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={4}>
                        Class summary is not available.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>

            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-3 font-semibold">Student</th>
                    <th className="p-3 font-semibold">Class</th>
                    <th className="p-3 font-semibold">Roll</th>
                    <th className="p-3 font-semibold">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {details.assignedStudents.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">{student.name}</td>
                      <td className="p-3 text-slate-700">
                        {student.className}
                      </td>
                      <td className="p-3 text-slate-700">{student.rollNumber || "-"}</td>
                      <td className="p-3 text-slate-700">
                        {toNumber(student.attendance?.total)
                          ? `${Math.round((toNumber(student.attendance?.present) / toNumber(student.attendance?.total)) * 100)}%`
                          : "0%"}
                      </td>
                    </tr>
                  ))}

                  {!details.assignedStudents.length ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={4}>
                        No students mapped to this teacher.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
          </div>
        ) : null}

        {activeTab === "attendance" ? (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Monthly Attendance Trend</h2>
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
                    No monthly attendance trend yet.
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
                    <th className="p-3 font-semibold">Present</th>
                    <th className="p-3 font-semibold">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {details.attendanceRows.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">{formatDate(entry.date)}</td>
                      <td className="p-3 text-slate-700">{entry.className || "-"}</td>
                      <td className="p-3 text-slate-700">{entry.subject || "-"}</td>
                      <td className="p-3 text-slate-700">
                        {entry.presentCount}/{entry.totalCount}
                      </td>
                      <td className="p-3 text-slate-700">{entry.attendancePercent}%</td>
                    </tr>
                  ))}

                  {!details.attendanceRows.length ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={5}>
                        No attendance submissions yet.
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
                {details.subjectPerformance.map((entry) => (
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

                {!details.subjectPerformance.length ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                    No subject trend available yet.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-3 font-semibold">Exam</th>
                    <th className="p-3 font-semibold">Student</th>
                    <th className="p-3 font-semibold">Class</th>
                    <th className="p-3 font-semibold">Marks</th>
                    <th className="p-3 font-semibold">Published</th>
                  </tr>
                </thead>
                <tbody>
                  {details.resultRows.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">{entry.exam || "-"}</td>
                      <td className="p-3 text-slate-700">{entry.studentName}</td>
                      <td className="p-3 text-slate-700">{entry.classLabel}</td>
                      <td className="p-3 text-slate-700">
                        {entry.marks}/{entry.maxMarks} ({entry.percent}%)
                      </td>
                      <td className="p-3 text-slate-700">{formatDate(entry.publishedDate)}</td>
                    </tr>
                  ))}

                  {!details.resultRows.length ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={5}>
                        No marks published by this teacher.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
          </div>
        ) : null}

        {activeTab === "activity" ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <div className="mt-4 space-y-3">
              {details.activityFeed.map((entry) => (
                <article key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{entry.text}</p>
                    <span className="text-xs text-slate-500">{entry.timeAgo}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(entry.date)}</p>
                </article>
              ))}

              {!details.activityFeed.length ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                  Activity will appear once attendance and result operations are recorded.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </DashboardLayout>
  );
}

export default TeacherProfile;
