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

function TeacherAssignments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [teacherData, setTeacherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [className, setClassName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState(getTodayIso());

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
            "Unable to load assignment data."
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

  useEffect(() => {
    if (className || !classes.length) {
      return;
    }

    const matchedClass = classes.find(
      (entry) => toClassKey(entry.name) === toClassKey(initialClassFromRoute)
    );

    setClassName(matchedClass?.name || classes[0].name);
  }, [className, classes, initialClassFromRoute]);

  const createAssignment = async (event) => {
    event.preventDefault();
    setStatus("");
    setSubmitError("");

    if (!title.trim() || !description.trim() || !className) {
      setSubmitError("Class, title, and description are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post("/teachers/assignments", {
        className,
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        dueDate,
      });
      setStatus("Assignment created and shared with students.");
      setTitle("");
      setDescription("");
    } catch (saveError) {
      setSubmitError(
        saveError.response?.data?.message ||
          saveError.message ||
          "Failed to create assignment."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-slate-600">Loading assignment page...</div>
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
            <h1 className="text-3xl font-bold text-slate-900">Create Assignment</h1>
            <p className="mt-1 text-slate-500">
              Publish assignment instructions and due date for your classes.
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
          onSubmit={createAssignment}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Class
              <select
                value={className}
                onChange={(event) => setClassName(event.target.value)}
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
              Subject
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Assignment Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Chapter 4 Worksheet"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                placeholder="Explain the task, instructions, and submission format."
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Due Date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#7dc242] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6cae3c] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Creating..." : "Create Assignment"}
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

export default TeacherAssignments;
