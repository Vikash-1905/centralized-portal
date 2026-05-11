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

function TeacherStudents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [teacherData, setTeacherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All");

  const initialClassFromRoute = String(location.state?.className || "").trim();

  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/teachers/${user?.email}`);
        setTeacherData(response.data);
        setError("");
      } catch (fetchError) {
        setTeacherData(null);
        setError(
          fetchError.response?.data?.message ||
            fetchError.message ||
            "Unable to load student roster."
        );
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      void fetchTeacherData();
    }
  }, [user?.email]);

  const students = useMemo(
    () =>
      Array.isArray(teacherData?.assignedStudents)
        ? teacherData.assignedStudents
        : [],
    [teacherData?.assignedStudents]
  );

  const classOptions = useMemo(
    () => [
      "All",
      ...new Set(students.map((student) => student.assignedClass).filter(Boolean)),
    ],
    [students]
  );

  useEffect(() => {
    if (!initialClassFromRoute || classFilter !== "All" || classOptions.length <= 1) {
      return;
    }

    const matched = classOptions.find(
      (entry) => toClassKey(entry) === toClassKey(initialClassFromRoute)
    );

    if (matched) {
      setClassFilter(matched);
    }
  }, [classFilter, classOptions, initialClassFromRoute]);

  const filteredStudents = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return students.filter((student) => {
      const classMatches =
        classFilter === "All" || student.assignedClass === classFilter;

      const searchMatches =
        !searchText ||
        String(student.name || "").toLowerCase().includes(searchText) ||
        String(student.rollNumber || "").toLowerCase().includes(searchText);

      return classMatches && searchMatches;
    });
  }, [students, classFilter, search]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-slate-600">Loading students page...</div>
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
            <h1 className="text-3xl font-bold text-slate-900">Assigned Students</h1>
            <p className="mt-1 text-slate-500">
              Browse students in your classes and monitor attendance percentage.
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Search Student
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or roll number"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Class Filter
              <select
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                {classOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Showing <span className="font-semibold">{filteredStudents.length}</span> students
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Roll No.</th>
                  <th className="p-3 font-semibold">Student Name</th>
                  <th className="p-3 font-semibold">Class</th>
                  <th className="p-3 font-semibold">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const present = Number(student.attendance?.present || 0);
                  const total = Number(student.attendance?.total || 0);
                  const attendancePercent = total
                    ? Math.round((present / total) * 100)
                    : 0;

                  return (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">{student.rollNumber || "-"}</td>
                      <td className="p-3 font-medium text-slate-800">{student.name}</td>
                      <td className="p-3 text-slate-700">{student.assignedClass || student.className}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                            attendancePercent >= 75
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-amber-50 text-amber-700 ring-amber-200"
                          }`}
                        >
                          {attendancePercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!filteredStudents.length ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={4}>
                      No students found for the selected filters.
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

export default TeacherStudents;
