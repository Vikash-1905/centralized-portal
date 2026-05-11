import { useMemo, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import DashboardCard from "../../components/DashboardCard";
import useSchoolData from "../../hooks/useSchoolData";
import useAuth from "../../hooks/useAuth";
import { formatCurrency, formatDate } from "../../utils/schoolMetrics";

const ONBOARDING_SKIP_STORAGE_KEY = "adminOnboardingDismissed";
const ENABLE_ADMIN_ONBOARDING = false;
const getTodayISO = () => new Date().toISOString().slice(0, 10);
const normalizeText = (value) => String(value || "").trim().toLowerCase();
const hasValueIgnoreCase = (items, value) =>
  (Array.isArray(items) ? items : []).some(
    (entry) => normalizeText(entry) === normalizeText(value)
  );

const readOnboardingDismissed = (schoolKey) => {
  try {
    return localStorage.getItem(`${ONBOARDING_SKIP_STORAGE_KEY}:${schoolKey}`) === "1";
  } catch {
    return false;
  }
};

const writeOnboardingDismissed = (schoolKey, value) => {
  try {
    const storageKey = `${ONBOARDING_SKIP_STORAGE_KEY}:${schoolKey}`;
    if (value) {
      localStorage.setItem(storageKey, "1");
      return;
    }

    localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
};

const toMonthKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const buildMonthBuckets = (count) => {
  const now = new Date();

  return [...Array(count)].map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    return {
      key,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      firstDate: date,
    };
  });
};

const classifyEnquiry = (enquiry) => {
  const text = `${enquiry.status || ""} ${enquiry.stage || ""}`.toLowerCase();

  if (text.includes("convert") || text.includes("admitted")) {
    return "Converted";
  }

  if (text.includes("reject") || text.includes("drop") || text.includes("lost")) {
    return "Rejected";
  }

  if (
    text.includes("interest") ||
    text.includes("visit") ||
    text.includes("application") ||
    text.includes("follow") ||
    text.includes("counsel")
  ) {
    return "Interested";
  }

  return "New";
};

function AdminDashboard() {
  const { user } = useAuth();
  const { schoolData, createClass, createSubject, saveTeacher, saveStudent } = useSchoolData();
  const { attendance, enquiries, students, teachers, classes, subjects } = schoolData;
  const [windowSize, setWindowSize] = useState(6);
  const [onboardingClassForm, setOnboardingClassForm] = useState({
    className: "",
    sectionName: "A",
  });
  const [onboardingTeacherForm, setOnboardingTeacherForm] = useState({
    name: "",
    email: "",
    password: "",
    subject: "",
  });
  const [onboardingStudentForm, setOnboardingStudentForm] = useState({
    name: "",
    dateOfBirth: "",
    gender: "Male",
    mobile: "",
    address: "",
    fatherName: "",
    fatherPhone: "",
    admissionDate: getTodayISO(),
  });
  const [onboardingAction, setOnboardingAction] = useState("");
  const [onboardingError, setOnboardingError] = useState("");
  const [onboardingSuccess, setOnboardingSuccess] = useState("");
  const [onboardingDismissedMap, setOnboardingDismissedMap] = useState({});

  const onboardingSchoolKey =
    user?.school?.id || user?.schoolId || user?.school?.name || user?.email || "default";
  const hasClassAndSection = classes.length > 0;
  const hasTeacher = teachers.length > 0;
  const hasStudent = students.length > 0;
  const hasCompletedOnboarding = hasClassAndSection && hasTeacher && hasStudent;
  const isOnboardingDismissed =
    onboardingDismissedMap[onboardingSchoolKey] ?? readOnboardingDismissed(onboardingSchoolKey);
  const showOnboarding =
    ENABLE_ADMIN_ONBOARDING && !hasCompletedOnboarding && !isOnboardingDismissed;
  const showOnboardingReminder =
    ENABLE_ADMIN_ONBOARDING && !hasCompletedOnboarding && isOnboardingDismissed;
  const onboardingProgress = [hasClassAndSection, hasTeacher, hasStudent].filter(Boolean)
    .length;
  const primaryClassName = classes[0] || "";
  const primarySectionName = "";
  const isOnboardingBusy = Boolean(onboardingAction);

  const monthBuckets = useMemo(() => buildMonthBuckets(windowSize), [windowSize]);

  const resetOnboardingFeedback = () => {
    setOnboardingError("");
    setOnboardingSuccess("");
  };

  const handleDismissOnboarding = () => {
    writeOnboardingDismissed(onboardingSchoolKey, true);
    setOnboardingDismissedMap((current) => ({
      ...current,
      [onboardingSchoolKey]: true,
    }));
    resetOnboardingFeedback();
  };

  const handleResumeOnboarding = () => {
    writeOnboardingDismissed(onboardingSchoolKey, false);
    setOnboardingDismissedMap((current) => ({
      ...current,
      [onboardingSchoolKey]: false,
    }));
    resetOnboardingFeedback();
  };

  const handleOnboardingClassSubmit = async (event) => {
    event.preventDefault();
    resetOnboardingFeedback();

    const className = onboardingClassForm.className.trim();

    if (!className) {
      setOnboardingError("Class is required to start onboarding.");
      return;
    }

    setOnboardingAction("class");

    try {
      if (!hasValueIgnoreCase(classes, className)) {
        await createClass(className);
      }

      setOnboardingSuccess("Step 1 complete. Now add your first teacher.");
    } catch (error) {
      setOnboardingError(error.message || "Unable to save class setup.");
    } finally {
      setOnboardingAction("");
    }
  };

  const handleOnboardingTeacherSubmit = async (event) => {
    event.preventDefault();
    resetOnboardingFeedback();

    if (!hasClassAndSection) {
      setOnboardingError("Complete step 1 first to configure class and section.");
      return;
    }

    const name = onboardingTeacherForm.name.trim();
    const email = onboardingTeacherForm.email.trim().toLowerCase();
    const password = onboardingTeacherForm.password;
    const subject = onboardingTeacherForm.subject.trim();

    if (!name || !email || !password || !subject) {
      setOnboardingError("Teacher name, email, password, and subject are required.");
      return;
    }

    setOnboardingAction("teacher");

    try {
      if (!hasValueIgnoreCase(subjects, subject)) {
        await createSubject(subject);
      }

      await saveTeacher({
        name,
        email,
        password,
        subject,
        subjects: [subject],
        classes: [],
        status: "Active",
        joiningDate: getTodayISO(),
      });

      setOnboardingTeacherForm((current) => ({
        ...current,
        name: "",
        email: "",
        password: "",
      }));
      setOnboardingSuccess("Step 2 complete. Now add your first student.");
    } catch (error) {
      setOnboardingError(error.message || "Unable to save teacher.");
    } finally {
      setOnboardingAction("");
    }
  };

  const handleOnboardingStudentSubmit = async (event) => {
    event.preventDefault();
    resetOnboardingFeedback();

    if (!hasClassAndSection) {
      setOnboardingError("Complete step 1 first to configure class and section.");
      return;
    }

    if (!hasTeacher) {
      setOnboardingError("Add your first teacher in step 2 before adding students.");
      return;
    }

    const name = onboardingStudentForm.name.trim();
    const dateOfBirth = onboardingStudentForm.dateOfBirth.trim();
    const mobile = onboardingStudentForm.mobile.trim();
    const address = onboardingStudentForm.address.trim();
    const fatherName = onboardingStudentForm.fatherName.trim();
    const fatherPhone = onboardingStudentForm.fatherPhone.trim();
    const admissionDate = onboardingStudentForm.admissionDate.trim() || getTodayISO();

    if (
      !name ||
      !dateOfBirth ||
      !mobile ||
      !address ||
      !fatherName ||
      !fatherPhone ||
      !primaryClassName ||
      !primarySectionName
    ) {
      setOnboardingError(
        "Student name, DOB, mobile, address, father name/phone, class, and section are required."
      );
      return;
    }

    setOnboardingAction("student");

    try {
      await saveStudent({
        name,
        dateOfBirth,
        gender: onboardingStudentForm.gender,
        mobileNumber: mobile,
        address,
        city: "",
        state: "",
        pincode: "",
        fatherName,
        fatherPhone,
        motherName: "",
        motherPhone: "",
        guardianName: "",
        guardianPhone: "",
        className: primaryClassName,
        section: primarySectionName,
        admissionDate,
        admissionSource: "Onboarding",
        createStudentLogin: false,
        createParentLogin: false,
        email: "",
        parentEmail: "",
        password: "",
        parentPassword: "",
        status: "Active",
      });

      setOnboardingStudentForm({
        name: "",
        dateOfBirth: "",
        gender: "Male",
        mobile: "",
        address: "",
        fatherName: "",
        fatherPhone: "",
        admissionDate: getTodayISO(),
      });
      writeOnboardingDismissed(onboardingSchoolKey, false);
      setOnboardingDismissedMap((current) => ({
        ...current,
        [onboardingSchoolKey]: false,
      }));
      setOnboardingSuccess("Onboarding complete. Your school workspace is ready.");
    } catch (error) {
      setOnboardingError(error.message || "Unable to save student.");
    } finally {
      setOnboardingAction("");
    }
  };

  const feeSummary = useMemo(
    () =>
      students.reduce(
        (summary, student) => ({
          annual: summary.annual + Number(student.fee?.annualFee || 0),
          paid: summary.paid + Number(student.fee?.paid || 0),
          due: summary.due + Number(student.fee?.due || 0),
        }),
        { annual: 0, paid: 0, due: 0 }
      ),
    [students]
  );

  const today = getTodayISO();

  const attendanceToday = useMemo(
    () =>
      attendance
        .filter((entry) => entry.date === today)
        .reduce(
          (summary, entry) => {
            const present = (entry.records || []).filter(
              (record) => record.status === "Present"
            ).length;
            const total = (entry.records || []).length;

            return {
              sessions: summary.sessions + 1,
              present: summary.present + present,
              total: summary.total + total,
            };
          },
          { sessions: 0, present: 0, total: 0 }
        ),
    [attendance, today]
  );

  const attendanceRate = attendanceToday.total
    ? Math.round((attendanceToday.present / attendanceToday.total) * 100)
    : 0;

  const newAdmissionsThisMonth = useMemo(() => {
    const now = new Date();

    return students.filter((student) => {
      const date = new Date(student.admissionDate);
      if (Number.isNaN(date.getTime())) {
        return false;
      }

      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
  }, [students]);

  const totalEnquiries = enquiries.length;

  const conversionStats = useMemo(() => {
    const base = {
      New: 0,
      Interested: 0,
      Converted: 0,
      Rejected: 0,
    };

    enquiries.forEach((enquiry) => {
      const key = classifyEnquiry(enquiry);
      base[key] += 1;
    });

    return base;
  }, [enquiries]);

  const conversionRate = totalEnquiries
    ? Math.round((conversionStats.Converted / totalEnquiries) * 100)
    : 0;

  const revenueSeries = useMemo(() => {
    const revenueByMonth = new Map();
    const fallbackKey = monthBuckets.at(-1)?.key;

    students.forEach((student) => {
      const paid = Number(student.fee?.paid || 0);
      if (paid <= 0) {
        return;
      }

      const key = toMonthKey(student.admissionDate) || fallbackKey;
      if (!key) {
        return;
      }

      revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + paid);
    });

    return monthBuckets.map((bucket) => ({
      ...bucket,
      value: revenueByMonth.get(bucket.key) || 0,
    }));
  }, [monthBuckets, students]);

  const conversionSeries = useMemo(() => {
    const total = totalEnquiries || 1;

    return ["New", "Interested", "Converted", "Rejected"].map((label) => ({
      label,
      count: conversionStats[label],
      percent: totalEnquiries ? Math.round((conversionStats[label] / total) * 100) : 0,
    }));
  }, [conversionStats, totalEnquiries]);

  const recentAdmissions = useMemo(
    () =>
      [...students]
        .filter((student) => student.admissionDate)
        .sort(
          (a, b) =>
            new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime()
        )
        .slice(0, 4)
        .map((student) => ({
          student: student.name,
          grade: student.className || "-",
          status: student.status || "Active",
          date: formatDate(student.admissionDate),
        })),
    [students]
  );

  const cards = [
    {
      title: "Total Students",
      value: students.length,
      subtitle: "Students with active records",
      accent: "bg-lime-500",
    },
    {
      title: "Total Teachers",
      value: teachers.length,
      subtitle: "Teachers currently onboarded",
      accent: "bg-emerald-500",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(feeSummary.paid),
      subtitle: "Collected fee amount",
      accent: "bg-green-600",
    },
    {
      title: "Pending Fees",
      value: formatCurrency(feeSummary.due),
      subtitle: "Outstanding dues across students",
      accent: "bg-green-700",
    },
    {
      title: "New Admissions",
      value: newAdmissionsThisMonth,
      subtitle: "Current month admissions",
      accent: "bg-emerald-600",
    },
    {
      title: "Total Enquiries",
      value: totalEnquiries,
      subtitle: `${conversionRate}% converted`,
      accent: "bg-emerald-700",
    },
    {
      title: "Attendance Today",
      value: `${attendanceRate}%`,
      subtitle: `${attendanceToday.present}/${attendanceToday.total} present`,
      accent: "bg-green-600",
    },
  ];

  const maxRevenueValue = Math.max(...revenueSeries.map((entry) => entry.value), 1);
  const revenueChartPoints = useMemo(() => {
    const maxIndex = Math.max(revenueSeries.length - 1, 1);

    return revenueSeries.map((entry, index) => ({
      ...entry,
      x: (index / maxIndex) * 100,
      y: 100 - (entry.value / maxRevenueValue) * 100,
    }));
  }, [maxRevenueValue, revenueSeries]);
  const revenueLinePath = revenueChartPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="mt-2 text-slate-500">
              Understand the entire school in seconds: academics, finance, admissions, and attendance.
            </p>
          </div>

          <label className="text-sm font-semibold text-slate-700">
            Dashboard window
            <select
              value={windowSize}
              onChange={(event) => setWindowSize(Number(event.target.value))}
              className="ml-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </label>
        </div>

        {showOnboardingReminder ? (
          <section className="mb-8 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                  Setup Reminder
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Finish your school onboarding when ready
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Core setup is paused. Resume to add your first class, teacher, and student.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResumeOnboarding}
                className="touch-target rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
              >
                Resume Setup
              </button>
            </div>
          </section>
        ) : null}

        {showOnboarding ? (
          <section className="mb-8 rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,#f0fdf4_0%,#ecfeff_100%)] p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  New School Onboarding
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Launch Your School In 3 Steps
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Create your first class, teacher, and student. Each step unlocks the next.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                  {onboardingProgress}/3 completed
                </span>
                <button
                  type="button"
                  onClick={handleDismissOnboarding}
                  disabled={isOnboardingBusy}
                  className="touch-target rounded-full border border-emerald-300 bg-white px-3 py-1 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Skip for now
                </button>
              </div>
            </div>

            {onboardingError ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {onboardingError}
              </p>
            ) : null}

            {onboardingSuccess ? (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                {onboardingSuccess}
              </p>
            ) : null}

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <form
                onSubmit={handleOnboardingClassSubmit}
                className="rounded-xl border border-emerald-200 bg-white p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Step 1</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Add First Class</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Set your default class and section foundation.
                </p>

                <label className="mt-4 block text-xs font-semibold text-slate-600">
                  Class name
                  <input
                    type="text"
                    value={onboardingClassForm.className}
                    onChange={(event) =>
                      setOnboardingClassForm((current) => ({
                        ...current,
                        className: event.target.value,
                      }))
                    }
                    disabled={isOnboardingBusy || hasClassAndSection}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="e.g. Grade 1"
                    required
                  />
                </label>

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Section
                  <input
                    type="text"
                    value={onboardingClassForm.sectionName}
                    onChange={(event) =>
                      setOnboardingClassForm((current) => ({
                        ...current,
                        sectionName: event.target.value,
                      }))
                    }
                    disabled={isOnboardingBusy || hasClassAndSection}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="e.g. A"
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={isOnboardingBusy || hasClassAndSection}
                  className="touch-target mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {hasClassAndSection
                    ? "Completed"
                    : onboardingAction === "class"
                      ? "Saving..."
                      : "Save Class Setup"}
                </button>
              </form>

              <form
                onSubmit={handleOnboardingTeacherSubmit}
                className="rounded-xl border border-cyan-200 bg-white p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Step 2</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Add First Teacher</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first faculty login and assign a subject.
                </p>

                {!hasClassAndSection ? (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Complete Step 1 first.
                  </p>
                ) : null}

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Teacher name
                  <input
                    type="text"
                    value={onboardingTeacherForm.name}
                    onChange={(event) =>
                      setOnboardingTeacherForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    disabled={isOnboardingBusy || !hasClassAndSection || hasTeacher}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="e.g. Asha Verma"
                    required
                  />
                </label>

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Teacher email
                  <input
                    type="email"
                    value={onboardingTeacherForm.email}
                    onChange={(event) =>
                      setOnboardingTeacherForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    disabled={isOnboardingBusy || !hasClassAndSection || hasTeacher}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="teacher@school.com"
                    required
                  />
                </label>

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Temporary password
                  <input
                    type="password"
                    value={onboardingTeacherForm.password}
                    onChange={(event) =>
                      setOnboardingTeacherForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    disabled={isOnboardingBusy || !hasClassAndSection || hasTeacher}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="Enter secure password"
                    required
                  />
                </label>

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Subject
                  <input
                    type="text"
                    value={onboardingTeacherForm.subject}
                    onChange={(event) =>
                      setOnboardingTeacherForm((current) => ({
                        ...current,
                        subject: event.target.value,
                      }))
                    }
                    disabled={isOnboardingBusy || !hasClassAndSection || hasTeacher}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="e.g. Mathematics"
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={isOnboardingBusy || !hasClassAndSection || hasTeacher}
                  className="touch-target mt-4 w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-300"
                >
                  {hasTeacher
                    ? "Completed"
                    : onboardingAction === "teacher"
                      ? "Saving..."
                      : "Save Teacher"}
                </button>
              </form>

              <form
                onSubmit={handleOnboardingStudentSubmit}
                className="rounded-xl border border-teal-200 bg-white p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Step 3</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Add First Student</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first admission record and complete setup.
                </p>

                {hasClassAndSection ? (
                  <p className="mt-3 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-xs text-teal-700">
                    Class assignment: {primaryClassName} - {primarySectionName}
                  </p>
                ) : (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Complete Step 1 first.
                  </p>
                )}

                {!hasTeacher ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Complete Step 2 first.
                  </p>
                ) : null}

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Student name
                  <input
                    type="text"
                    value={onboardingStudentForm.name}
                    onChange={(event) =>
                      setOnboardingStudentForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    disabled={isOnboardingBusy || !hasClassAndSection || !hasTeacher || hasStudent}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="e.g. Riya Sharma"
                    required
                  />
                </label>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Date of birth
                    <input
                      type="date"
                      value={onboardingStudentForm.dateOfBirth}
                      onChange={(event) =>
                        setOnboardingStudentForm((current) => ({
                          ...current,
                          dateOfBirth: event.target.value,
                        }))
                      }
                      disabled={isOnboardingBusy || !hasClassAndSection || !hasTeacher || hasStudent}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      required
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-600">
                    Gender
                    <select
                      value={onboardingStudentForm.gender}
                      onChange={(event) =>
                        setOnboardingStudentForm((current) => ({
                          ...current,
                          gender: event.target.value,
                        }))
                      }
                      disabled={isOnboardingBusy || !hasClassAndSection || !hasTeacher || hasStudent}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </div>

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Mobile number
                  <input
                    type="tel"
                    value={onboardingStudentForm.mobile}
                    onChange={(event) =>
                      setOnboardingStudentForm((current) => ({
                        ...current,
                        mobile: event.target.value,
                      }))
                    }
                    disabled={isOnboardingBusy || !hasClassAndSection || !hasTeacher || hasStudent}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="e.g. 9876543210"
                    required
                  />
                </label>

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Address
                  <input
                    type="text"
                    value={onboardingStudentForm.address}
                    onChange={(event) =>
                      setOnboardingStudentForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    disabled={isOnboardingBusy || !hasClassAndSection || !hasTeacher || hasStudent}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="Enter address"
                    required
                  />
                </label>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Father name
                    <input
                      type="text"
                      value={onboardingStudentForm.fatherName}
                      onChange={(event) =>
                        setOnboardingStudentForm((current) => ({
                          ...current,
                          fatherName: event.target.value,
                        }))
                      }
                      disabled={isOnboardingBusy || !hasClassAndSection || !hasTeacher || hasStudent}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      placeholder="e.g. Rajesh Sharma"
                      required
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-600">
                    Father phone
                    <input
                      type="tel"
                      value={onboardingStudentForm.fatherPhone}
                      onChange={(event) =>
                        setOnboardingStudentForm((current) => ({
                          ...current,
                          fatherPhone: event.target.value,
                        }))
                      }
                      disabled={isOnboardingBusy || !hasClassAndSection || !hasTeacher || hasStudent}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      placeholder="e.g. 9876543210"
                      required
                    />
                  </label>
                </div>

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Admission date
                  <input
                    type="date"
                    value={onboardingStudentForm.admissionDate}
                    onChange={(event) =>
                      setOnboardingStudentForm((current) => ({
                        ...current,
                        admissionDate: event.target.value,
                      }))
                    }
                    disabled={isOnboardingBusy || !hasClassAndSection || !hasTeacher || hasStudent}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={isOnboardingBusy || !hasClassAndSection || !hasTeacher || hasStudent}
                  className="touch-target mt-4 w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
                >
                  {hasStudent
                    ? "Completed"
                    : onboardingAction === "student"
                      ? "Saving..."
                      : "Save Student"}
                </button>
              </form>
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <DashboardCard
              key={card.title}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              accent={card.accent}
            />
          ))}
        </div>

        <div className="mt-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Monthly Revenue Chart</h2>
              <span className="text-sm text-slate-500">Fee collection trend</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <svg viewBox="0 0 100 100" className="h-44 w-full" preserveAspectRatio="none" role="img">
                {[0, 25, 50, 75, 100].map((line) => (
                  <line
                    key={line}
                    x1="0"
                    y1={line}
                    x2="100"
                    y2={line}
                    stroke="#cbd5e1"
                    strokeDasharray="2 2"
                    strokeWidth="0.6"
                  />
                ))}
                <polyline
                  fill="none"
                  stroke="#0891b2"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={revenueLinePath}
                />
                {revenueChartPoints.map((point) => (
                  <circle
                    key={point.key}
                    cx={point.x}
                    cy={point.y}
                    r="1.8"
                    fill="#06b6d4"
                    stroke="#0f172a"
                    strokeWidth="0.45"
                  />
                ))}
              </svg>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {revenueChartPoints.map((point) => (
                  <div key={point.key} className="rounded-lg bg-white px-3 py-2 text-center">
                    <p className="text-xs font-semibold text-slate-600">{point.label}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(point.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Admission Conversion Chart</h2>
              <span className="text-sm text-slate-500">CRM funnel</span>
            </div>

            <div className="space-y-4">
              {conversionSeries.map((entry) => (
                <div key={entry.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">{entry.label}</span>
                    <span className="text-slate-500">
                      {entry.count} ({entry.percent}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#7dc242]"
                      style={{ width: `${entry.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Today at a Glance</h2>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Attendance Sessions</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{attendanceToday.sessions}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Present Records</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {attendanceToday.present}/{attendanceToday.total}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Open Enquiries</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {totalEnquiries - conversionStats.Converted}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Recent Admissions</h2>
              <span className="text-sm text-slate-500">Latest 4 records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Student</th>
                    <th className="px-3 py-3 font-semibold">Grade</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAdmissions.length ? (
                    recentAdmissions.map((entry) => (
                      <tr key={`${entry.student}-${entry.date}`} className="border-b border-slate-100">
                        <td className="px-3 py-4 font-medium text-slate-800">{entry.student}</td>
                        <td className="px-3 py-4 text-slate-600">{entry.grade}</td>
                        <td className="px-3 py-4 text-slate-600">{entry.status}</td>
                        <td className="px-3 py-4 text-slate-600">{entry.date}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-b border-slate-100">
                      <td className="px-3 py-4 text-slate-500" colSpan={4}>
                        No admissions yet. Add students from Student Management.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Recommended Next Steps</h2>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Follow-up reminders</p>
                <p className="mt-1 text-sm text-slate-500">
                  Review CRM leads with follow-up date due today and assign owners.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Fee recovery focus</p>
                <p className="mt-1 text-sm text-slate-500">
                  Prioritize communication for students with highest pending dues.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Attendance watch</p>
                <p className="mt-1 text-sm text-slate-500">
                  Use Attendance module for low-performing classes and monthly trends.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default AdminDashboard;
