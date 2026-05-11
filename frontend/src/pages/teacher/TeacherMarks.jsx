import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import useAuth from "../../hooks/useAuth";
import api from "../../services/api";

const getTodayIso = () => new Date().toISOString().slice(0, 10);

const toClassKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function TeacherMarks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [teacherData, setTeacherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedClass, setSelectedClass] = useState("");
  const [studentId, setStudentId] = useState("");
  const [exam, setExam] = useState("Class Test 1");
  const [subject, setSubject] = useState("");
  const [marks, setMarks] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [publishedDate, setPublishedDate] = useState(getTodayIso());

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
            "Unable to load marks data."
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

  // Get unique assigned classes
  const assignedClasses = useMemo(() => {
    const classSet = new Set();
    students.forEach((student) => {
      const className = student.assignedClass || student.className;
      if (className) {
        classSet.add(className);
      }
    });
    return Array.from(classSet).sort();
  }, [students]);

  // Filter students based on selected class
  const studentsForSelection = useMemo(() => {
    if (!selectedClass) {
      return students;
    }

    return students.filter((student) => {
      const className = student.assignedClass || student.className;
      return className === selectedClass;
    });
  }, [students, selectedClass]);

  useEffect(() => {
    if (initialClassFromRoute && assignedClasses.length > 0) {
      const classExists = assignedClasses.includes(initialClassFromRoute);
      if (classExists) {
        setSelectedClass(initialClassFromRoute);
      }
    }
  }, [initialClassFromRoute, assignedClasses]);

  useEffect(() => {
    if (!studentsForSelection.length) {
      setStudentId("");
      return;
    }

    const hasCurrentStudent = studentsForSelection.some(
      (entry) => entry.id === studentId
    );

    if (!hasCurrentStudent) {
      setStudentId(studentsForSelection[0].id);
    }
  }, [studentId, studentsForSelection]);

  const selectedStudent = useMemo(
    () => studentsForSelection.find((entry) => entry.id === studentId),
    [studentId, studentsForSelection]
  );

  const submitMarks = async (event) => {
    event.preventDefault();
    setStatus("");
    setSubmitError("");

    const marksNumber = Number(marks);
    const maxMarksNumber = Number(maxMarks);

    if (!studentId || !subject.trim() || !exam.trim()) {
      setSubmitError("Student, subject, and exam are required.");
      return;
    }

    if (!Number.isFinite(marksNumber) || !Number.isFinite(maxMarksNumber)) {
      setSubmitError("Marks and max marks must be valid numbers.");
      return;
    }

    if (maxMarksNumber <= 0 || marksNumber < 0 || marksNumber > maxMarksNumber) {
      setSubmitError("Marks must be between 0 and max marks.");
      return;
    }

    const payload = {
      studentId,
      subject: subject.trim(),
      exam: exam.trim(),
      marks: marksNumber,
      maxMarks: maxMarksNumber,
      publishedDate,
    };

    try {
      setIsSubmitting(true);
      await api.post("/results/upsert", payload);
      setStatus("Marks saved successfully.");
      setMarks("");
    } catch (saveError) {
      setSubmitError(
        saveError.response?.data?.message ||
          saveError.message ||
          "Failed to save marks."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-slate-600">Loading marks page...</div>
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
            <h1 className="text-3xl font-bold text-slate-900">Add Marks</h1>
            <p className="mt-1 text-slate-500">
              Publish exam marks for students in your assigned classes.
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
          onSubmit={submitMarks}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Class
              <select
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">-- Select Class --</option>
                {assignedClasses.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Student
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">-- Select Student --</option>
                {studentsForSelection.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.rollNumber})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Exam
              <input
                value={exam}
                onChange={(event) => setExam(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Subject
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Marks Obtained
              <input
                type="number"
                min="0"
                value={marks}
                onChange={(event) => setMarks(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Max Marks
              <input
                type="number"
                min="1"
                value={maxMarks}
                onChange={(event) => setMaxMarks(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Published Date
              <input
                type="date"
                value={publishedDate}
                onChange={(event) => setPublishedDate(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          {selectedStudent ? (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Selected student: <span className="font-semibold">{selectedStudent.name}</span>
              {" | "}
              Class: <span className="font-semibold">{selectedStudent.assignedClass || selectedStudent.className}</span>
            </p>
          ) : null}

          <div className="mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#7dc242] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6cae3c] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Saving..." : "Submit Marks"}
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

export default TeacherMarks;
