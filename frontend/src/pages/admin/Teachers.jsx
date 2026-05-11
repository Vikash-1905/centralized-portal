import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import useSchoolData from "../../hooks/useSchoolData";
import { formatDate, getStatusClassName } from "../../utils/schoolMetrics";

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

const TEACHER_DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "classes", label: "Classes" },
  { id: "performance", label: "Performance" },
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function Teachers() {
  const navigate = useNavigate();
  const { schoolData, deleteTeacher, resetTeacherPassword, saveTeacher } =
    useSchoolData();
  const {
    classes = [],
    departments = [],
    subjects = [],
    teachers = [],
    students = [],
    attendance = [],
    results = [],
  } = schoolData;

  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    subjects: [],
    department: "",
    phone: "",
    classes: [],
  });
  const [showPassword, setShowPassword] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [isAssignedClassDropdownOpen, setAssignedClassDropdownOpen] = useState(false);
  const [assignedClassSearch, setAssignedClassSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [activeDetailTab, setActiveDetailTab] = useState(TEACHER_DETAIL_TABS[0].id);
  const subjectDropdownRef = useRef(null);
  const assignedClassDropdownRef = useRef(null);

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => String(teacher.id) === String(selectedTeacherId)) || null,
    [selectedTeacherId, teachers]
  );

  const selectedTeacherDetails = useMemo(() => {
    if (!selectedTeacher) {
      return null;
    }

    const teacherClasses = [...new Set(toAssignedClassList(selectedTeacher.classes))];
    const teacherClassKeys = new Set(
      teacherClasses.map((entry) => normalizeAssignedClassValue(entry))
    );

    const studentLookup = new Map(
      students.map((student) => [String(student.id || ""), student])
    );

    const assignedStudents = students.filter((student) => {
      const exactClass = formatAssignedClassLabel(student.className);
      const classOnly = String(student.className || "").trim();

      return (
        teacherClassKeys.has(normalizeAssignedClassValue(exactClass)) ||
        teacherClassKeys.has(normalizeAssignedClassValue(classOnly))
      );
    });

    const attendanceRows = attendance
      .filter((entry) => String(entry.teacherId || "") === String(selectedTeacher.id))
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

    const resultRows = results
      .filter((entry) => String(entry.teacherId || "") === String(selectedTeacher.id))
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

    const averageResultPercent = resultRows.length
      ? Math.round(
          resultRows.reduce((sum, row) => sum + toNumber(row.percent), 0) / resultRows.length
        )
      : 0;

    const averageClassAttendance = assignedStudents.length
      ? Math.round(
          assignedStudents.reduce((sum, student) => {
            const studentAttendance = student.attendance || {};
            const present = toNumber(studentAttendance.present);
            const total = toNumber(studentAttendance.total);
            const percent = total ? Math.round((present / total) * 100) : 0;
            return sum + percent;
          }, 0) / assignedStudents.length
        )
      : 0;

    const classSummary = teacherClasses.map((classLabel) => {
      const classKey = normalizeAssignedClassValue(classLabel);
      const studentsInClass = assignedStudents.filter((student) => {
        const normalizedLabel = normalizeAssignedClassValue(
          formatAssignedClassLabel(student.className)
        );
        const normalizedClassOnly = normalizeAssignedClassValue(student.className);

        return classKey === normalizedLabel || classKey === normalizedClassOnly;
      });

      const classStudentIds = new Set(
        studentsInClass.map((student) => String(student.id || ""))
      );

      const classResultRows = resultRows.filter((entry) =>
        classStudentIds.has(String(entry.studentId || ""))
      );

      const classAverage = classResultRows.length
        ? Math.round(
            classResultRows.reduce((sum, row) => sum + toNumber(row.percent), 0) /
              classResultRows.length
          )
        : 0;

      return {
        classLabel,
        students: studentsInClass.length,
        averageMarks: classAverage,
      };
    });

    return {
      teacherClasses,
      assignedStudents,
      attendanceRows,
      resultRows,
      classSummary,
      averageResultPercent,
      averageClassAttendance,
    };
  }, [attendance, results, selectedTeacher, students]);

  const closeTeacherDetails = () => {
    setSelectedTeacherId("");
    setActiveDetailTab(TEACHER_DETAIL_TABS[0].id);
  };

  const openTeacherDetails = (teacher) => {
    setSelectedTeacherId(teacher.id);
    setActiveDetailTab(TEACHER_DETAIL_TABS[0].id);
  };

  const subjectOptions = useMemo(() => {
    const entries = new Map();

    [...subjects, ...formData.subjects].forEach((subject) => {
      const label = String(subject || "").trim();
      if (!label) {
        return;
      }

      const key = label.toLowerCase();
      if (!entries.has(key)) {
        entries.set(key, label);
      }
    });

    return [...entries.values()].sort((first, second) => first.localeCompare(second));
  }, [formData.subjects, subjects]);

  const filteredSubjectOptions = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    if (!query) {
      return subjectOptions;
    }

    return subjectOptions.filter((entry) => entry.toLowerCase().includes(query));
  }, [subjectOptions, subjectSearch]);

  const subjectSummary = useMemo(() => {
    if (!formData.subjects.length) {
      return "Select assigned subjects";
    }

    if (formData.subjects.length <= 2) {
      return formData.subjects.join(", ");
    }

    return `${formData.subjects.slice(0, 2).join(", ")} +${formData.subjects.length - 2} more`;
  }, [formData.subjects]);

  const departmentOptions = useMemo(() => {
    const items = [...departments];
    if (formData.department && !items.includes(formData.department)) {
      items.push(formData.department);
    }

    return items.sort((first, second) => first.localeCompare(second));
  }, [departments, formData.department]);

  const assignedClassOptions = useMemo(() => {
    const options = classes.map((className) => formatAssignedClassLabel(className));
    return [...new Set(options)].sort((first, second) => first.localeCompare(second));
  }, [classes]);

  const filteredAssignedClassOptions = useMemo(() => {
    const query = assignedClassSearch.trim().toLowerCase();
    if (!query) {
      return assignedClassOptions;
    }

    return assignedClassOptions.filter((entry) => entry.toLowerCase().includes(query));
  }, [assignedClassOptions, assignedClassSearch]);

  const assignedClassSummary = useMemo(() => {
    if (!formData.classes.length) {
      return "Select assigned classes";
    }

    if (formData.classes.length <= 2) {
      return formData.classes.join(", ");
    }

    return `${formData.classes.slice(0, 2).join(", ")} +${formData.classes.length - 2} more`;
  }, [formData.classes]);

  const hasAssignedClassMasters = classes.length > 0;
  const hasSubjectMasters = subjectOptions.length > 0;

  useEffect(() => {
    if (!isAssignedClassDropdownOpen && !isSubjectDropdownOpen) {
      return undefined;
    }

    const handleDocumentClick = (event) => {
      if (
        assignedClassDropdownRef.current?.contains(event.target) ||
        subjectDropdownRef.current?.contains(event.target)
      ) {
        return;
      }

      setAssignedClassDropdownOpen(false);
      setSubjectDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, [isAssignedClassDropdownOpen, isSubjectDropdownOpen]);

  const handleAddTeacher = () => {
    setEditingTeacher(null);
    closeTeacherDetails();
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      subjects: [],
      department: "",
      phone: "",
      classes: [],
    });
    setSubjectDropdownOpen(false);
    setSubjectSearch("");
    setAssignedClassDropdownOpen(false);
    setAssignedClassSearch("");
    setShowModal(true);
  };

  const handleEditTeacher = (teacher) => {
    const subjectMap = new Map(
      subjects.map((entry) => {
        const label = String(entry || "").trim();
        return [label.toLowerCase(), label];
      })
    );

    const assignedClassMap = new Map(
      classes.map((className) => {
        const label = formatAssignedClassLabel(className);
        return [normalizeAssignedClassValue(label), label];
      })
    );

    setEditingTeacher(teacher);
    closeTeacherDetails();
    setFormData({
      name: teacher.name,
      email: teacher.email,
      password: "",
      confirmPassword: "",
      subjects: [...new Set(
        toTeacherSubjectList(teacher).map((entry) => {
          const key = String(entry || "").trim().toLowerCase();
          return subjectMap.get(key) || entry;
        })
      )],
      department: teacher.department,
      phone: teacher.phone,
      classes: [...new Set(
        toAssignedClassList(teacher.classes)
          .map((entry) => assignedClassMap.get(normalizeAssignedClassValue(entry)))
          .filter(Boolean)
      )],
    });
    setSubjectDropdownOpen(false);
    setSubjectSearch("");
    setAssignedClassDropdownOpen(false);
    setAssignedClassSearch("");
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleToggleAssignedClass = (label) => {
    setFormData((prev) => ({
      ...prev,
      classes: prev.classes.includes(label)
        ? prev.classes.filter((entry) => entry !== label)
        : [...prev.classes, label],
    }));
  };

  const handleToggleSubject = (label) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(label)
        ? prev.subjects.filter((entry) => entry !== label)
        : [...prev.subjects, label],
    }));
  };

  const handleSelectAllSubjects = () => {
    setFormData((prev) => ({
      ...prev,
      subjects: [...subjectOptions],
    }));
  };

  const handleClearSubjects = () => {
    setFormData((prev) => ({
      ...prev,
      subjects: [],
    }));
  };

  const handleSelectAllAssignedClasses = () => {
    setFormData((prev) => ({
      ...prev,
      classes: [...assignedClassOptions],
    }));
  };

  const handleClearAssignedClasses = () => {
    setFormData((prev) => ({
      ...prev,
      classes: [],
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      alert("Please enter teacher name");
      return false;
    }
    if (!formData.email.trim()) {
      alert("Please enter email");
      return false;
    }
    const hasNewPassword = Boolean(formData.password);

    if (!editingTeacher && !hasNewPassword) {
      alert("Please enter password");
      return false;
    }

    if (hasNewPassword && formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return false;
    }

    if (hasNewPassword && formData.password.length < 6) {
      alert("Password must be at least 6 characters");
      return false;
    }

    if (!hasNewPassword && formData.confirmPassword) {
      alert("Enter password before confirmation");
      return false;
    }

    if (
      !editingTeacher &&
      teachers.some(
        (teacher) =>
          teacher.email?.toLowerCase() === formData.email.trim().toLowerCase()
      )
    ) {
      alert("Teacher with this email already exists");
      return false;
    }
    if (!formData.subjects.length) {
      alert("Please select at least one subject");
      return false;
    }

    const validSubjectEntries = new Set(
      subjects
        .map((entry) => String(entry || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const invalidSubjects = formData.subjects.filter(
      (entry) => !validSubjectEntries.has(String(entry || "").trim().toLowerCase())
    );

    if (invalidSubjects.length) {
      alert("Selected subjects contain invalid values. Re-select from available options.");
      return false;
    }

    const validAssignedClasses = new Set(
      assignedClassOptions.map((entry) => normalizeAssignedClassValue(entry))
    );
    const invalidAssignedClasses = formData.classes.filter(
      (entry) => !validAssignedClasses.has(normalizeAssignedClassValue(entry))
    );
    if (invalidAssignedClasses.length) {
      alert("Assigned classes contain invalid values. Re-select from available options.");
      return false;
    }

    return true;
  };

  const handleSaveTeacher = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const normalizedSubjects = [...new Set(
        formData.subjects
          .map((entry) => String(entry || "").trim())
          .filter(Boolean)
      )];

      const teacher = {
        id: editingTeacher?.id,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password.trim(),
        subject: normalizedSubjects[0] || "",
        subjects: normalizedSubjects,
        department: formData.department.trim(),
        phone: formData.phone,
        classes: formData.classes,
        status: "Active",
        joiningDate: editingTeacher?.joiningDate || new Date().toISOString().split("T")[0],
      };

      await saveTeacher(teacher);

      if (editingTeacher) {
        setSuccessMessage(`Teacher ${formData.name} updated successfully!`);
      } else {
        setSuccessMessage(`Teacher ${formData.name} added successfully with credentials!`);
      }

      setTimeout(() => setSuccessMessage(""), 3000);
      setShowModal(false);
    } catch (error) {
      alert("Error saving teacher: " + error.message);
    }
  };

  const handleDeleteTeacher = async (id) => {
    if (window.confirm("Are you sure you want to delete this teacher?")) {
      const deletedTeacher = teachers.find((t) => t.id === id);
      if (!deletedTeacher) return;

      try {
        await deleteTeacher(id);
        if (String(selectedTeacherId) === String(id)) {
          closeTeacherDetails();
        }
        setSuccessMessage(`Teacher ${deletedTeacher.name} deleted successfully!`);
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (error) {
        alert("Error deleting teacher: " + error.message);
      }
    }
  };

  const handleResetPassword = async (teacher) => {
    const newPassword = prompt("Enter new password for " + teacher.name + ":");
    if (newPassword && newPassword.length >= 6) {
      try {
        await resetTeacherPassword(teacher.id, newPassword);
        setSuccessMessage(`Password reset for ${teacher.name}!`);
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (error) {
        alert("Error resetting password: " + error.message);
      }
    } else if (newPassword) {
      alert("Password must be at least 6 characters");
    }
  };

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Teachers Management</h1>
            <p className="mt-2 text-slate-500">
              Manage faculty credentials, subject allocation, and class assignments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/classes-subjects")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Manage Classes & Subjects
            </button>
            <button
              onClick={handleAddTeacher}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              + Add Teacher
            </button>
          </div>
        </div>

        {successMessage && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4 text-green-700">
            {successMessage}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4 font-semibold">ID</th>
                <th className="p-4 font-semibold">Name</th>
                <th className="p-4 font-semibold">Email</th>
                <th className="p-4 font-semibold">Subjects</th>
                <th className="p-4 font-semibold">Department</th>
                <th className="p-4 font-semibold">Phone</th>
                <th className="p-4 font-semibold">Classes</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-800">{teacher.id}</td>
                  <td className="p-4 text-slate-800">{teacher.name}</td>
                  <td className="p-4 text-slate-600">{teacher.email}</td>
                  <td className="p-4 text-slate-600">{formatTeacherSubjects(teacher)}</td>
                  <td className="p-4 text-slate-600">{teacher.department}</td>
                  <td className="p-4 text-slate-600">{teacher.phone}</td>
                  <td className="p-4 text-slate-600">
                    {Array.isArray(teacher.classes)
                      ? teacher.classes.join(", ")
                      : teacher.classes}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(
                        teacher.status || "Active"
                      )}`}
                    >
                      {teacher.status || "Active"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <button
                        onClick={() => openTeacherDetails(teacher)}
                        className="table-action-btn touch-target rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      >
                        View
                      </button>
                      <button
                        onClick={() => navigate(`/admin/teachers/${teacher.id}`)}
                        className="table-action-btn touch-target rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800"
                      >
                        Profile
                      </button>
                      <button
                        onClick={() => handleEditTeacher(teacher)}
                        className="table-action-btn touch-target rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleResetPassword(teacher)}
                        className="table-action-btn touch-target rounded-md px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 hover:text-amber-800"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        className="table-action-btn touch-target rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedTeacher && selectedTeacherDetails ? (
          <div className="fixed inset-0 z-50 flex justify-end">
            <button
              type="button"
              onClick={closeTeacherDetails}
              className="h-full flex-1 bg-slate-900/35"
              aria-label="Close teacher details"
            />

            <aside className="relative h-full w-full max-w-full overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl sm:max-w-[520px] sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedTeacher.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatTeacherSubjects(selectedTeacher)} | {selectedTeacher.department || "No department"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeTeacherDetails();
                      navigate(`/admin/teachers/${selectedTeacher.id}`);
                    }}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Full Profile
                  </button>

                  <button
                    type="button"
                    onClick={closeTeacherDetails}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                {TEACHER_DETAIL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDetailTab(tab.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeDetailTab === tab.id
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeDetailTab === "overview" ? (
                <div className="space-y-4">
                  <section className="grid gap-3 sm:grid-cols-2">
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned Classes</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {selectedTeacherDetails.teacherClasses.length}
                      </p>
                    </article>

                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned Students</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {selectedTeacherDetails.assignedStudents.length}
                      </p>
                    </article>

                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg Marks</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {selectedTeacherDetails.averageResultPercent}%
                      </p>
                    </article>

                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Class Attendance Avg</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {selectedTeacherDetails.averageClassAttendance}%
                      </p>
                    </article>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher Info</h3>
                    <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Email</dt>
                        <dd className="font-medium text-slate-800">{selectedTeacher.email || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Phone</dt>
                        <dd className="font-medium text-slate-800">{selectedTeacher.phone || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Joining Date</dt>
                        <dd className="font-medium text-slate-800">{formatDate(selectedTeacher.joiningDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Status</dt>
                        <dd className="font-medium text-slate-800">{selectedTeacher.status || "Active"}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              ) : null}

              {activeDetailTab === "classes" ? (
                <div className="space-y-4">
                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">Assigned Classes</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedTeacherDetails.teacherClasses.map((entry) => (
                        <span
                          key={entry}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                        >
                          {entry}
                        </span>
                      ))}

                      {!selectedTeacherDetails.teacherClasses.length ? (
                        <p className="text-sm text-slate-500">No classes assigned.</p>
                      ) : null}
                    </div>
                  </section>

                  <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="p-3 font-semibold">Class</th>
                          <th className="p-3 font-semibold">Students</th>
                          <th className="p-3 font-semibold">Average Marks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTeacherDetails.classSummary.map((entry) => (
                          <tr key={entry.classLabel} className="border-b border-slate-100">
                            <td className="p-3 text-slate-700">{entry.classLabel}</td>
                            <td className="p-3 text-slate-700">{entry.students}</td>
                            <td className="p-3 text-slate-700">{entry.averageMarks}%</td>
                          </tr>
                        ))}

                        {!selectedTeacherDetails.classSummary.length ? (
                          <tr>
                            <td className="p-4 text-slate-500" colSpan={3}>
                              Class summary not available.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </section>
                </div>
              ) : null}

              {activeDetailTab === "performance" ? (
                <div className="space-y-4">
                  <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="p-3 font-semibold">Date</th>
                          <th className="p-3 font-semibold">Class</th>
                          <th className="p-3 font-semibold">Present</th>
                          <th className="p-3 font-semibold">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTeacherDetails.attendanceRows.slice(0, 10).map((entry) => (
                          <tr key={entry.id} className="border-b border-slate-100">
                            <td className="p-3 text-slate-700">{formatDate(entry.date)}</td>
                            <td className="p-3 text-slate-700">{entry.className || "-"}</td>
                            <td className="p-3 text-slate-700">
                              {entry.presentCount}/{entry.totalCount}
                            </td>
                            <td className="p-3 text-slate-700">{entry.attendancePercent}%</td>
                          </tr>
                        ))}

                        {!selectedTeacherDetails.attendanceRows.length ? (
                          <tr>
                            <td className="p-4 text-slate-500" colSpan={4}>
                              No attendance submissions yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </section>

                  <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
                        {selectedTeacherDetails.resultRows.slice(0, 12).map((entry) => (
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

                        {!selectedTeacherDetails.resultRows.length ? (
                          <tr>
                            <td className="p-4 text-slate-500" colSpan={5}>
                              No marks published yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </section>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3 sm:p-4">
            <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-lg bg-white p-4 sm:p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                {editingTeacher ? "Edit Teacher" : "Add New Teacher"}
              </h2>

              <form onSubmit={handleSaveTeacher} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email (Login ID) *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={editingTeacher ? true : false}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                      placeholder="teacher@schoolcrm.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Password {editingTeacher ? "(Optional)" : "*"}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword.password ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={
                          editingTeacher
                            ? "Leave blank to keep current password"
                            : "Minimum 6 characters"
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev) => ({
                            ...prev,
                            password: !prev.password,
                          }))
                        }
                        className="absolute right-3 top-2.5 text-slate-600"
                      >
                        {showPassword.password ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword.confirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Confirm password"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev) => ({
                            ...prev,
                            confirmPassword: !prev.confirmPassword,
                          }))
                        }
                        className="absolute right-3 top-2.5 text-slate-600"
                      >
                        {showPassword.confirmPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Assigned Subjects *
                    </label>
                    <div className="relative" ref={subjectDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setSubjectDropdownOpen((current) => !current)}
                        disabled={!hasSubjectMasters}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2 text-left text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <span className="truncate">{subjectSummary}</span>
                        <span className="ml-3 text-xs text-slate-500">
                          {isSubjectDropdownOpen ? "Close" : "Select"}
                        </span>
                      </button>

                      {isSubjectDropdownOpen ? (
                        <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                          <input
                            type="text"
                            value={subjectSearch}
                            onChange={(event) => setSubjectSearch(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Search subject"
                          />

                          <div className="mt-2 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={handleSelectAllSubjects}
                              className="font-semibold text-blue-700 hover:text-blue-800"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={handleClearSubjects}
                              className="font-semibold text-slate-600 hover:text-slate-700"
                            >
                              Clear
                            </button>
                          </div>

                          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                            {filteredSubjectOptions.length ? (
                              filteredSubjectOptions.map((subject) => {
                                const selected = formData.subjects.includes(subject);

                                return (
                                  <label
                                    key={subject}
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => handleToggleSubject(subject)}
                                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>{subject}</span>
                                  </label>
                                );
                              })
                            ) : (
                              <p className="px-2 py-2 text-xs text-slate-500">No matches found.</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {!hasSubjectMasters ? (
                      <p className="mt-2 text-xs text-amber-700">
                        No subjects available. Create subjects from Manage Subjects & Departments.
                      </p>
                    ) : null}

                    {formData.subjects.length ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Selected: {formData.subjects.join(", ")}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        No subjects selected.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Department
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Department</option>
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                    {!departments.length ? (
                      <p className="mt-2 text-xs text-amber-700">
                        No departments available. Create departments from Manage Subjects & Departments.
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+91-XXXXXXXXXX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Assigned Classes
                    </label>
                    <div className="relative" ref={assignedClassDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setAssignedClassDropdownOpen((current) => !current)}
                        disabled={!hasAssignedClassMasters}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2 text-left text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <span className="truncate">{assignedClassSummary}</span>
                        <span className="ml-3 text-xs text-slate-500">
                          {isAssignedClassDropdownOpen ? "Close" : "Select"}
                        </span>
                      </button>

                      {isAssignedClassDropdownOpen ? (
                        <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                          <input
                            type="text"
                            value={assignedClassSearch}
                            onChange={(event) => setAssignedClassSearch(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Search class-section"
                          />

                          <div className="mt-2 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={handleSelectAllAssignedClasses}
                              className="font-semibold text-blue-700 hover:text-blue-800"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={handleClearAssignedClasses}
                              className="font-semibold text-slate-600 hover:text-slate-700"
                            >
                              Clear
                            </button>
                          </div>

                          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                            {filteredAssignedClassOptions.length ? (
                              filteredAssignedClassOptions.map((assignedClass) => {
                                const selected = formData.classes.includes(assignedClass);

                                return (
                                  <label
                                    key={assignedClass}
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => handleToggleAssignedClass(assignedClass)}
                                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>{assignedClass}</span>
                                  </label>
                                );
                              })
                            ) : (
                              <p className="px-2 py-2 text-xs text-slate-500">No matches found.</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {!hasAssignedClassMasters ? (
                      <p className="mt-2 text-xs text-amber-700">
                        Create class and section masters first in Classes & Subjects.
                      </p>
                    ) : null}

                    {formData.classes.length ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Selected: {formData.classes.join(", ")}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        No classes selected.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <p className="text-sm text-blue-800">
                    <strong>Login Credentials:</strong> Teacher will login with Email (Login ID) and Password set above.
                  </p>
                </div>

                <div className="flex justify-end space-x-4 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setSubjectDropdownOpen(false);
                      setSubjectSearch("");
                      setAssignedClassDropdownOpen(false);
                      setAssignedClassSearch("");
                    }}
                    className="px-6 py-2 bg-slate-200 text-slate-800 font-semibold rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                  >
                    {editingTeacher ? "Update Teacher" : "Add Teacher"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

export default Teachers;
