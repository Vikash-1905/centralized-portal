import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import useAuth from "../../hooks/useAuth";
import api from "../../services/api";

const toClassKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const getTodayIso = () => new Date().toISOString().slice(0, 10);

function TeacherAttendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [teacherData, setTeacherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(getTodayIso());
  const [subject, setSubject] = useState("");
  const [records, setRecords] = useState({});
  const [status, setStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialClassFromRoute = String(location.state?.className || "").trim();

  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/teachers/${user?.email}`);
        setTeacherData(response.data);
        setSubject(response.data?.subject || "");
        setError("");
      } catch (fetchError) {
        setTeacherData(null);
        setError(
          fetchError.response?.data?.message ||
            fetchError.message ||
            "Unable to load attendance data."
        );
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      void fetchTeacherData();
    }
  }, [user?.email]);

  const classes = useMemo(
    () =>
      Array.isArray(teacherData?.assignedClasses)
        ? teacherData.assignedClasses
        : [],
    [teacherData?.assignedClasses]
  );

  const assignedStudents = useMemo(
    () =>
      Array.isArray(teacherData?.assignedStudents)
        ? teacherData.assignedStudents
        : [],
    [teacherData?.assignedStudents]
  );

  useEffect(() => {
    if (selectedClass || !classes.length) {
      return;
    }

    const matchedClass = classes.find(
      (entry) => toClassKey(entry.name) === toClassKey(initialClassFromRoute)
    );

    setSelectedClass(matchedClass?.name || classes[0].name);
  }, [classes, selectedClass, initialClassFromRoute]);

  const studentsForClass = useMemo(
    () =>
      assignedStudents.filter((student) => {
        const selectedClassKey = toClassKey(selectedClass);
        if (!selectedClassKey) {
          return true;
        }

        const assignedClassKey = toClassKey(student.assignedClass);
        const mergedClassKey = toClassKey(student.className);
        return (
          assignedClassKey === selectedClassKey ||
          mergedClassKey === selectedClassKey
        );
      }),
    [assignedStudents, selectedClass]
  );

  useEffect(() => {
    setRecords((current) => {
      const next = {};
      studentsForClass.forEach((student) => {
        next[student.id] = current[student.id] || "Present";
      });
      return next;
    });
  }, [studentsForClass]);

  const presentCount = studentsForClass.filter(
    (student) => records[student.id] !== "Absent"
  ).length;
  const absentCount = Math.max(studentsForClass.length - presentCount, 0);

  const updateRecord = (studentId, statusValue) => {
    setRecords((current) => ({
      ...current,
      [studentId]: statusValue,
    }));
  };

  const submitAttendance = async (event) => {
    event.preventDefault();
    setStatus("");
    setSubmitError("");

    if (!selectedClass || !attendanceDate || !subject.trim()) {
      setSubmitError("Class, date, and subject are required.");
      return;
    }

    if (!studentsForClass.length) {
      setSubmitError("No students found for the selected class.");
      return;
    }

    const payload = {
      className: selectedClass,
      date: attendanceDate,
      subject: subject.trim(),
      records: studentsForClass.map((student) => ({
        studentId: student.id,
        status: records[student.id] || "Present",
      })),
    };

    try {
      setIsSubmitting(true);
      await api.post("/attendance/upsert", payload);
      setStatus(`Attendance saved for ${selectedClass} on ${attendanceDate}.`);
    } catch (saveError) {
      setSubmitError(
        saveError.response?.data?.message ||
          saveError.message ||
          "Failed to save attendance."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-slate-600">Loading attendance page...</div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Mark Attendance</h1>
            <p className="mt-1 text-slate-500">
              Record attendance for assigned classes and submit in one click.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/teacher")}
            className="self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </button>
        </div>

        <form
          onSubmit={submitAttendance}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">
              Class
              <select
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                {classes.map((entry) => (
                  <option key={entry.classId} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Date
              <input
                type="date"
                value={attendanceDate}
                onChange={(event) => setAttendanceDate(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Subject
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subject"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-200">
              Present: {presentCount}
            </span>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700 ring-1 ring-rose-200">
              Absent: {absentCount}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 ring-1 ring-slate-200">
              Total: {studentsForClass.length}
            </span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Roll No.</th>
                  <th className="p-3 font-semibold">Student Name</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {studentsForClass.map((student) => {
                  const studentStatus = records[student.id] || "Present";
                  return (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">
                        {student.rollNumber || "-"}
                      </td>
                      <td className="p-3 font-medium text-slate-800">{student.name}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateRecord(student.id, "Present")}
                            className={`rounded-md px-3 py-1 text-xs font-semibold ${
                              studentStatus === "Present"
                                ? "bg-emerald-600 text-white"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => updateRecord(student.id, "Absent")}
                            className={`rounded-md px-3 py-1 text-xs font-semibold ${
                              studentStatus === "Absent"
                                ? "bg-rose-600 text-white"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!studentsForClass.length ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={3}>
                      No students available for this class.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#7dc242] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6cae3c] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Saving..." : "Submit Attendance"}
            </button>
          </div>

          {status ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {status}
            </p>
          ) : null}

          {submitError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}
        </form>
      </section>
    </DashboardLayout>
  );
}

export default TeacherAttendance;
