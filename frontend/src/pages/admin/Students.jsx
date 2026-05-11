import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import useSchoolData from "../../hooks/useSchoolData";
import {
  uploadStudentDocument,
  fetchStudentsSearch,
  fetchStudentsFilterCounts,
} from "../../services/schoolApi";
import { BulkUploadStudentModal } from "../../components/BulkUploadStudentModal";
import {
  formatCurrency,
  formatDate,
  getAttendancePercent,
  getStatusClassName,
} from "../../utils/schoolMetrics";

const ADMISSION_STEPS = [
  { id: "student", label: "1. Student" },
  { id: "contact", label: "2. Contact" },
  { id: "parent", label: "3. Parent" },
  { id: "academic", label: "4. Academic" },
  { id: "fees", label: "5. Fees" },
  { id: "documents", label: "6. Documents" },
  { id: "login-crm", label: "7. Login + CRM" },
];

const STUDENT_DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "attendance", label: "Attendance" },
  { id: "results", label: "Results" },
  { id: "fees", label: "Fees" },
  { id: "documents", label: "Documents" },
];

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const BLOOD_GROUP_OPTIONS = [
  "",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];
const FEE_PLAN_OPTIONS = ["Standard", "Monthly", "Quarterly", "Annual"];
const PAYMENT_STATUS_OPTIONS = ["Paid", "Partial", "Pending"];
const ADMISSION_SOURCE_OPTIONS = ["Walk-in", "Website", "Referral", "CRM", "Other"];
const CONVERSION_STATUS_OPTIONS = [
  "Not Converted",
  "In Progress",
  "Converted",
];
const CONVERSION_QUEUE_DATE_FILTER_OPTIONS = [
  "All",
  "Today",
  "This Week",
  "Overdue",
  "No Follow-up Date",
];

const getTodayISO = () => new Date().toISOString().slice(0, 10);

const toDayDate = (value) => {
  const safe = String(value || "").trim();
  if (!safe) {
    return null;
  }

  const date = new Date(`${safe}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const matchesConversionQueueDateFilter = (enquiry, filter, todayISO = getTodayISO()) => {
  if (filter === "All") {
    return true;
  }

  const followUpDateValue = String(enquiry.followUpDate || "").trim().slice(0, 10);

  if (filter === "No Follow-up Date") {
    return !followUpDateValue;
  }

  if (!followUpDateValue) {
    return false;
  }

  const targetDate = toDayDate(followUpDateValue);
  const todayDate = toDayDate(todayISO);

  if (!targetDate || !todayDate) {
    return false;
  }

  if (filter === "Today") {
    return followUpDateValue === todayISO;
  }

  if (filter === "This Week") {
    const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / 86400000);
    return diffDays >= 0 && diffDays <= 6;
  }

  if (filter === "Overdue") {
    return followUpDateValue < todayISO;
  }

  return true;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getPaymentStatus = (pendingAmount, paidAmount) => {
  const due = toNumber(pendingAmount);
  const paid = toNumber(paidAmount);

  if (due <= 0) return "Paid";
  if (paid > 0) return "Partial";
  return "Pending";
};

const normalizeStudentConversionStatus = (value, fallback = "Not Converted") => {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }

  const key = raw.toLowerCase();
  if (key === "fresh admission") {
    return "Not Converted";
  }

  if (key === "converted from enquiry") {
    return "Converted";
  }

  const matched = CONVERSION_STATUS_OPTIONS.find((entry) => entry.toLowerCase() === key);
  return matched || fallback;
};

const getAdmissionSequence = (admissionNumber) => {
  const value = String(admissionNumber || "").trim();
  const parsed = Number(value.match(/(\d+)$/)?.[1] || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNextAdmissionNumber = (students, excludedStudentId = "") => {
  const highest = students.reduce((max, student) => {
    if (String(student.id || "") === String(excludedStudentId || "")) {
      return max;
    }

    return Math.max(max, getAdmissionSequence(student.admissionNumber));
  }, 1000);

  return `AUTO-${highest + 1}`;
};

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

const emptyStudentForm = {
  id: "",
  parentId: "",
  name: "",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  aadhaarNumber: "",
  mobileNumber: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  fatherName: "",
  fatherPhone: "",
  motherName: "",
  motherPhone: "",
  guardianName: "",
  guardianPhone: "",
  parentEmail: "",
  parentPassword: "",
  createParentLogin: false,
  admissionNumber: "",
  admissionDate: getTodayISO(),
  className: "",
  rollNumber: "",
  previousSchoolName: "",
  previousClass: "",
  feeStructure: "Standard",
  totalFees: "",
  admissionFee: "",
  paidAmount: "",
  pendingAmount: "",
  paymentStatus: "Pending",
  dueDate: "",
  studentPhoto: "",
  birthCertificate: "",
  aadhaarCard: "",
  tcDocument: "",
  createStudentLogin: true,
  password: "",
  confirmPassword: "",
  enquiryId: "",
  admissionSource: "Walk-in",
  conversionStatus: "Not Converted",
  status: "Active",
};

const buildAdmissionPrefillForm = (prefill = {}) => {
  const studentName = String(prefill.studentName || prefill.name || "").trim();
  const parentName = String(prefill.parentName || prefill.guardianName || "").trim();
  const phone = String(prefill.phone || prefill.mobileNumber || "").trim();
  const className = String(prefill.className || prefill.classInterest || "").trim();
  const totalFees = toNumber(prefill.totalFees);
  const paidAmount = toNumber(prefill.paidAmount);
  const pendingAmount = Math.max(totalFees - paidAmount, 0);

  return {
    ...emptyStudentForm,
    name: studentName,
    fatherName: parentName,
    guardianName: parentName,
    fatherPhone: phone,
    guardianPhone: phone,
    mobileNumber: phone,
    className,
    dateOfBirth: String(prefill.dateOfBirth || "").trim(),
    address: String(prefill.address || "").trim(),
    totalFees: totalFees > 0 ? String(totalFees) : "",
    paidAmount: paidAmount > 0 ? String(paidAmount) : "",
    pendingAmount: totalFees > 0 ? String(pendingAmount) : "",
    paymentStatus: getPaymentStatus(pendingAmount, paidAmount),
    enquiryId: String(prefill.enquiryId || "").trim(),
    admissionSource: String(prefill.admissionSource || "CRM").trim() || "CRM",
    conversionStatus: normalizeStudentConversionStatus(
      prefill.conversionStatus,
      prefill.enquiryId ? "In Progress" : "Not Converted"
    ),
  };
};

const buildAdmissionPrefillFromEnquiry = (enquiry = {}) =>
  buildAdmissionPrefillForm({
    enquiryId: String(enquiry.id || "").trim(),
    studentName: enquiry.studentName,
    parentName: enquiry.parentName || enquiry.guardianName,
    phone: enquiry.phone,
    className: enquiry.classInterest || enquiry.className,
    dateOfBirth: enquiry.dateOfBirth,
    address: enquiry.address,
    admissionSource: "CRM",
    conversionStatus: String(enquiry.convertedStudentId || "").trim()
      ? "Converted"
      : "In Progress",
  });

const getEnquiryConversionStatus = (enquiry = {}) => {
  const convertedStudentId = String(enquiry.convertedStudentId || "").trim();
  if (convertedStudentId) {
    return "Converted";
  }

  const stageOrStatus = String(enquiry.stage || enquiry.status || "").trim().toLowerCase();
  const fallback = enquiry.isConverted || stageOrStatus === "converted"
    ? "In Progress"
    : "Not Converted";

  return normalizeStudentConversionStatus(enquiry.conversionStatus, fallback);
};

const buildStudentForm = (student, parentRecord) => ({
  id: student.id || "",
  parentId: student.parentId || "",
  name: student.name || "",
  dateOfBirth: student.dateOfBirth || "",
  gender: student.gender || "",
  bloodGroup: student.bloodGroup || "",
  aadhaarNumber: student.aadhaarNumber || "",
  mobileNumber: student.mobileNumber || "",
  email: student.email || "",
  address: student.address || "",
  city: student.city || "",
  state: student.state || "",
  pincode: student.pincode || "",
  fatherName: student.fatherName || parentRecord?.fatherName || student.parentName || "",
  fatherPhone: student.fatherPhone || parentRecord?.fatherPhone || student.parentPhone || "",
  motherName: student.motherName || parentRecord?.motherName || "",
  motherPhone: student.motherPhone || parentRecord?.motherPhone || "",
  guardianName: student.guardianName || parentRecord?.guardianName || "",
  guardianPhone: student.guardianPhone || parentRecord?.guardianPhone || "",
  parentEmail: student.parentEmail || parentRecord?.email || "",
  parentPassword: "",
  createParentLogin:
    student.createParentLogin ?? Boolean(student.parentEmail || parentRecord?.email),
  admissionNumber: student.admissionNumber || "",
  admissionDate: student.admissionDate || getTodayISO(),
  className: student.className || "",
  rollNumber: student.rollNumber || "",
  previousSchoolName: student.previousSchoolName || "",
  previousClass: student.previousClass || "",
  feeStructure: student.fee?.feeStructure || "Standard",
  totalFees: String(student.fee?.totalFees ?? student.fee?.annualFee ?? ""),
  admissionFee: String(student.fee?.admissionFee ?? ""),
  paidAmount: String(student.fee?.paidAmount ?? student.fee?.paid ?? ""),
  pendingAmount: String(student.fee?.pendingAmount ?? student.fee?.due ?? ""),
  paymentStatus:
    student.fee?.paymentStatus ||
    student.fee?.status ||
    getPaymentStatus(student.fee?.due ?? 0, student.fee?.paid ?? 0),
  dueDate: student.fee?.dueDate || "",
  studentPhoto: student.studentPhoto || student.documents?.studentPhoto || "",
  birthCertificate: student.birthCertificate || student.documents?.birthCertificate || "",
  aadhaarCard: student.aadhaarCard || student.documents?.aadhaarCard || "",
  tcDocument: student.tcDocument || student.documents?.tcDocument || "",
  createStudentLogin: student.createStudentLogin ?? Boolean(student.email),
  password: "",
  confirmPassword: "",
  enquiryId: student.enquiryId || "",
  admissionSource: student.admissionSource || "Walk-in",
  conversionStatus: normalizeStudentConversionStatus(
    student.conversionStatus,
    student.enquiryId ? "Converted" : "Not Converted"
  ),
  status: student.status || "Active",
});

function Students() {
  const navigate = useNavigate();
  const location = useLocation();
  const { schoolData, saveStudent, deleteStudent, resetUserPassword } = useSchoolData();
  const {
    classes = [],
    students = [],
    parents = [],
    teachers = [],
    attendance = [],
    results = [],
    enquiries = [],
  } = schoolData;

  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState(emptyStudentForm);
  const [activeStep, setActiveStep] = useState(ADMISSION_STEPS[0].id);
  const [showPassword, setShowPassword] = useState({});
  const [documentUploadStatus, setDocumentUploadStatus] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [activeDetailTab, setActiveDetailTab] = useState(STUDENT_DETAIL_TABS[0].id);
  const [conversionQueueDateFilter, setConversionQueueDateFilter] = useState(
    CONVERSION_QUEUE_DATE_FILTER_OPTIONS[0]
  );
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(String(searchQuery || "")), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Server-side search state
  const [serverPage, setServerPage] = useState(1);
  const [serverPageSize] = useState(25);
  const [serverResults, setServerResults] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverFilterClass, setServerFilterClass] = useState("");
  const [serverSortBy, setServerSortBy] = useState("name");
  const [serverSortOrder, setServerSortOrder] = useState("asc");
  const [filterCounts, setFilterCounts] = useState({ classes: [] });

  const isServerSearchActive = debouncedQuery.trim().length >= 3;

  useEffect(() => {
    let cancelled = false;
    const fetchServer = async () => {
      if (!isServerSearchActive) {
        setServerResults([]);
        setServerTotal(0);
        setServerPage(1);
        return;
      }

      setServerLoading(true);
      try {
        const payload = await fetchStudentsSearch(debouncedQuery.trim(), serverPage, serverPageSize, {
          sortBy: serverSortBy,
          sortOrder: serverSortOrder,
          className: serverFilterClass,
        });
        if (cancelled) return;
        setServerResults(Array.isArray(payload.students) ? payload.students : []);
        setServerTotal(Number(payload.total || 0));
      } catch (err) {
        console.error("Student search failed:", err.message || err);
      } finally {
        if (!cancelled) setServerLoading(false);
      }
    };

    fetchServer();
    return () => {
      cancelled = true;
    };
    }, [
    debouncedQuery,
    serverPage,
    serverPageSize,
    isServerSearchActive,
    serverFilterClass,
    serverSortBy,
    serverSortOrder,
  ]);

  useEffect(() => {
    if (isServerSearchActive) {
      setServerPage(1);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    if (isServerSearchActive) {
      setServerPage(1);
    }
  }, [serverFilterClass, serverSortBy, serverSortOrder]);

  useEffect(() => {
    let cancelled = false;

    const loadFilterCounts = async () => {
      try {
        const payload = await fetchStudentsFilterCounts();
        if (cancelled) return;

        setFilterCounts({
          classes: Array.isArray(payload.classes) ? payload.classes : [],
        });
      } catch (error) {
        console.error("Unable to load student filter counts:", error.message || error);
      }
    };

    loadFilterCounts();
    return () => {
      cancelled = true;
    };
  }, [students.length]);

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

  const selectedStudent = useMemo(
    () => students.find((student) => String(student.id) === String(selectedStudentId)) || null,
    [selectedStudentId, students]
  );

  const selectedStudentDetails = useMemo(() => {
    if (!selectedStudent) {
      return null;
    }

    const linkedParent =
      parents.find((parent) => parent.id === selectedStudent.parentId) ||
      parents.find((parent) => parent.studentId === selectedStudent.id) ||
      null;

    const linkedEnquiry = enquiries.find(
      (entry) => String(entry.id || "") === String(selectedStudent.enquiryId || "")
    );

    const attendanceRows = attendance
      .flatMap((entry) => {
        const matchedRecord = Array.isArray(entry.records)
          ? entry.records.find(
              (record) => String(record.studentId || "") === String(selectedStudent.id)
            )
          : null;

        if (!matchedRecord) {
          return [];
        }

        return [
          {
            id: `${entry.id}-${selectedStudent.id}`,
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
      .filter((entry) => String(entry.studentId || "") === String(selectedStudent.id))
      .map((entry) => {
        const maxMarks = toNumber(entry.maxMarks) || 100;
        const marks = toNumber(entry.marks);
        const percent = Math.round((marks / maxMarks) * 100);

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

    const fee = selectedStudent.fee || {};
    const totalFees = toNumber(fee.totalFees ?? fee.annualFee);
    const paidAmount = toNumber(fee.paidAmount ?? fee.paid);
    const pendingAmount = toNumber(fee.pendingAmount ?? fee.due) || Math.max(totalFees - paidAmount, 0);
    const feeStatus = String(fee.paymentStatus || fee.status || "Pending").trim() || "Pending";
    const paymentHistory = Array.isArray(fee.paymentHistory) ? fee.paymentHistory : [];

    const documents = [
      {
        key: "studentPhoto",
        label: "Student Photo",
        value: selectedStudent.studentPhoto || selectedStudent.documents?.studentPhoto || "",
      },
      {
        key: "birthCertificate",
        label: "Birth Certificate",
        value:
          selectedStudent.birthCertificate || selectedStudent.documents?.birthCertificate || "",
      },
      {
        key: "aadhaarCard",
        label: "Aadhaar Card",
        value: selectedStudent.aadhaarCard || selectedStudent.documents?.aadhaarCard || "",
      },
      {
        key: "tcDocument",
        label: "TC Document",
        value: selectedStudent.tcDocument || selectedStudent.documents?.tcDocument || "",
      },
    ];

    return {
      linkedParent,
      linkedEnquiry,
      attendanceRows,
      resultRows,
      averageMarks,
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
  }, [attendance, enquiries, parents, results, selectedStudent, teacherLookup]);

  const openStudentDetails = (student) => {
    setSelectedStudentId(student.id);
    setActiveDetailTab(STUDENT_DETAIL_TABS[0].id);
  };

  const closeStudentDetails = () => {
    setSelectedStudentId("");
    setActiveDetailTab(STUDENT_DETAIL_TABS[0].id);
  };

  useEffect(() => {
    const admissionPrefill = location.state?.admissionPrefill;
    if (!admissionPrefill || typeof admissionPrefill !== "object") {
      return;
    }

    setEditingStudent(null);
    setSelectedStudentId("");
    setActiveDetailTab(STUDENT_DETAIL_TABS[0].id);
    setFormData(buildAdmissionPrefillForm(admissionPrefill));
    setActiveStep(ADMISSION_STEPS[0].id);
    setShowPassword({});
    setDocumentUploadStatus({});
    setShowModal(true);

    navigate("/admin/students", { replace: true, state: null });
  }, [location.state, navigate]);

  const admissionClassOptions = useMemo(() => {
    const options = [...classes];
    if (formData.className && !options.includes(formData.className)) {
      options.push(formData.className);
    }

    return [...new Set(options)].sort((first, second) => first.localeCompare(second));
  }, [classes, formData.className]);

  const enquiryById = useMemo(
    () =>
      new Map(
        enquiries
          .map((enquiry) => [String(enquiry.id || "").trim(), enquiry])
          .filter(([id]) => Boolean(id))
      ),
    [enquiries]
  );

  const enquiryOptions = useMemo(
    () =>
      [...enquiries]
        .filter((enquiry) => {
          const convertedStudentId = String(enquiry.convertedStudentId || "").trim();
          const isSelectedEnquiry =
            String(formData.enquiryId || "").trim() === String(enquiry.id || "").trim();

          return !convertedStudentId || isSelectedEnquiry;
        })
        .sort((first, second) =>
          String(second.createdAt || "").localeCompare(String(first.createdAt || ""))
        ),
    [enquiries, formData.enquiryId]
  );

  const selectedEnquiryRecord = useMemo(
    () => enquiryById.get(String(formData.enquiryId || "").trim()) || null,
    [enquiryById, formData.enquiryId]
  );

  const linkedStudentEnquiryIds = useMemo(
    () =>
      new Set(
        students
          .map((student) => String(student.enquiryId || "").trim())
          .filter(Boolean)
      ),
    [students]
  );

  const conversionQueueEnquiries = useMemo(
    () =>
      [...enquiries]
        .map((enquiry) => {
          const enquiryId = String(enquiry.id || "").trim();
          return {
            ...enquiry,
            enquiryId,
            convertedStudentId: String(enquiry.convertedStudentId || "").trim(),
            conversionStatus: getEnquiryConversionStatus(enquiry),
          };
        })
        .filter((enquiry) => {
          if (!enquiry.enquiryId || enquiry.convertedStudentId) {
            return false;
          }

          if (linkedStudentEnquiryIds.has(enquiry.enquiryId)) {
            return false;
          }

          return enquiry.conversionStatus === "In Progress";
        })
        .sort((first, second) => {
          const firstDate = String(first.followUpDate || first.createdAt || "");
          const secondDate = String(second.followUpDate || second.createdAt || "");
          return firstDate.localeCompare(secondDate);
        }),
    [enquiries, linkedStudentEnquiryIds]
  );

  const filteredConversionQueueEnquiries = useMemo(
    () =>
      conversionQueueEnquiries.filter((enquiry) =>
        matchesConversionQueueDateFilter(enquiry, conversionQueueDateFilter)
      ),
    [conversionQueueDateFilter, conversionQueueEnquiries]
  );

  const autoRollNumber = useMemo(() => {
    const className = formData.className.trim();
    if (!className) return "";

    const currentStudent = students.find((student) => student.id === formData.id);
    const keepsExistingRoll =
      currentStudent &&
      currentStudent.rollNumber &&
      String(currentStudent.className || "").trim().toLowerCase() === className.toLowerCase();

    if (keepsExistingRoll) {
      return currentStudent.rollNumber;
    }

    const prefix = `${className.replace(/\s+/g, "")}-`;
    const highestSequence = students.reduce((max, student) => {
      if (student.id === formData.id) {
        return max;
      }

      const sameClass =
        String(student.className || "").trim().toLowerCase() === className.toLowerCase();

      if (!sameClass) {
        return max;
      }

      const rollNumber = String(student.rollNumber || "").trim();
      const sequence = rollNumber.toLowerCase().startsWith(prefix.toLowerCase())
        ? Number(rollNumber.slice(prefix.length))
        : Number(rollNumber.match(/-(\d+)$/)?.[1] || 0);

      return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
    }, 0);

    return `${prefix}${String(highestSequence + 1).padStart(2, "0")}`;
  }, [formData.className, formData.id, students]);

  const resolvedAdmissionNumber = useMemo(() => {
    if (formData.admissionNumber.trim()) {
      return formData.admissionNumber.trim();
    }

    return getNextAdmissionNumber(students, formData.id);
  }, [formData.admissionNumber, formData.id, students]);

  const resolvedRollNumber = useMemo(
    () => formData.rollNumber.trim() || autoRollNumber,
    [autoRollNumber, formData.rollNumber]
  );

  const filteredStudents = useMemo(() => {
    const q = String(debouncedQuery || "").trim().toLowerCase();
    if (isServerSearchActive) {
      return serverResults;
    }

    // Apply class filter
    let result = students;
    if (serverFilterClass) {
      result = result.filter((student) =>
        String(student.className || "").trim() === serverFilterClass
      );
    }

    // Apply search query filter
    if (!q) return result;

    return result.filter((student) => {
      const parts = [
        String(student.id || ""),
        String(student.admissionNumber || ""),
        String(student.name || ""),
        String(student.fatherName || ""),
        String(student.parentName || ""),
        String(student.mobileNumber || ""),
        String(student.email || ""),
        String(student.className || ""),
      ]
        .map((p) => p.toLowerCase())
        .join(" ");

      return parts.includes(q);
    });
  }, [students, debouncedQuery, isServerSearchActive, serverResults, serverFilterClass]);

  const feePendingPreview = useMemo(() => {
    const due = Math.max(toNumber(formData.totalFees) - toNumber(formData.paidAmount), 0);
    return due;
  }, [formData.paidAmount, formData.totalFees]);

  const paymentStatusPreview = useMemo(
    () => formData.paymentStatus || getPaymentStatus(feePendingPreview, formData.paidAmount),
    [feePendingPreview, formData.paidAmount, formData.paymentStatus]
  );

  const hasAdmissionMasters = classes.length > 0;
  const activeStepIndex = ADMISSION_STEPS.findIndex((step) => step.id === activeStep);

  const resetFormState = () => {
    setFormData(emptyStudentForm);
    setActiveStep(ADMISSION_STEPS[0].id);
    setShowPassword({});
    setDocumentUploadStatus({});
  };

  const handleAddStudent = () => {
    setEditingStudent(null);
    resetFormState();
    closeStudentDetails();
    setShowModal(true);
  };

  const handleStartAdmissionFromEnquiry = (enquiry) => {
    if (!enquiry) {
      return;
    }

    setEditingStudent(null);
    setFormData(buildAdmissionPrefillFromEnquiry(enquiry));
    setActiveStep(ADMISSION_STEPS[0].id);
    setShowPassword({});
    setDocumentUploadStatus({});
    closeStudentDetails();
    setShowModal(true);
  };

  const handleEditStudent = (student) => {
    const linkedParent = parents.find((entry) => entry.id === student.parentId);
    setEditingStudent(student);
    setFormData(buildStudentForm(student, linkedParent));
    setActiveStep(ADMISSION_STEPS[0].id);
    setShowPassword({});
    setDocumentUploadStatus({});
    closeStudentDetails();
    setShowModal(true);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((current) => {
      const next = {
        ...current,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "totalFees" || name === "paidAmount") {
        const due = Math.max(toNumber(next.totalFees) - toNumber(next.paidAmount), 0);
        next.pendingAmount = String(due);
        next.paymentStatus = getPaymentStatus(due, next.paidAmount);
      }

      if (name === "enquiryId" && value && !current.conversionStatus.trim()) {
        next.conversionStatus = "In Progress";
      }

      if (name === "enquiryId" && value) {
        const selectedEnquiry = enquiryById.get(String(value).trim());

        next.admissionSource = "CRM";
        if (normalizeStudentConversionStatus(current.conversionStatus) === "Not Converted") {
          next.conversionStatus = "In Progress";
        }

        if (selectedEnquiry && !String(current.id || "").trim()) {
          const crmPrefill = buildAdmissionPrefillFromEnquiry(selectedEnquiry);

          next.name = crmPrefill.name || next.name;
          next.fatherName = crmPrefill.fatherName || next.fatherName;
          next.guardianName = crmPrefill.guardianName || next.guardianName;
          next.mobileNumber = crmPrefill.mobileNumber || next.mobileNumber;
          next.fatherPhone = crmPrefill.fatherPhone || next.fatherPhone;
          next.guardianPhone = crmPrefill.guardianPhone || next.guardianPhone;
          next.className = crmPrefill.className || next.className;
          next.dateOfBirth = crmPrefill.dateOfBirth || next.dateOfBirth;
          next.address = crmPrefill.address || next.address;
          next.admissionSource = "CRM";
          next.conversionStatus = "In Progress";
        }
      }

      if (name === "enquiryId" && !value) {
        if (normalizeStudentConversionStatus(current.conversionStatus) === "In Progress") {
          next.conversionStatus = "Not Converted";
        }

        if (!String(current.id || "").trim() && next.admissionSource === "CRM") {
          next.admissionSource = "Walk-in";
        }
      }

      if (name === "createStudentLogin" && !checked) {
        next.password = "";
        next.confirmPassword = "";
      }

      if (name === "createParentLogin" && !checked) {
        next.parentPassword = "";
      }

      return next;
    });
  };

  const handleFileUpload = async (event) => {
    const target = event.target;
    const { name, files } = target;
    const uploadedFile = files?.[0];

    if (!uploadedFile) {
      setDocumentUploadStatus((current) => ({
        ...current,
        [name]: "",
      }));
      return;
    }

    setDocumentUploadStatus((current) => ({
      ...current,
      [name]: "Uploading...",
    }));

    try {
      const uploadedDocument = await uploadStudentDocument(uploadedFile, name);
      const documentUrl = String(uploadedDocument?.url || uploadedDocument?.path || "").trim();

      if (!documentUrl) {
        throw new Error("Upload did not return a document URL.");
      }

      setFormData((current) => ({
        ...current,
        [name]: documentUrl,
      }));

      setDocumentUploadStatus((current) => ({
        ...current,
        [name]: "Uploaded",
      }));
    } catch (error) {
      setDocumentUploadStatus((current) => ({
        ...current,
        [name]: "",
      }));
      alert("Unable to upload file: " + error.message);
    } finally {
      target.value = "";
    }
  };

  const clearDocumentField = (fieldName) => {
    setFormData((current) => ({
      ...current,
      [fieldName]: "",
    }));
    setDocumentUploadStatus((current) => ({
      ...current,
      [fieldName]: "",
    }));
  };

  const moveToStep = (direction) => {
    const nextIndex = activeStepIndex + direction;
    if (nextIndex < 0 || nextIndex >= ADMISSION_STEPS.length) {
      return;
    }

    setActiveStep(ADMISSION_STEPS[nextIndex].id);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      alert("Please enter student full name");
      return false;
    }
    if (!formData.dateOfBirth) {
      alert("Please enter date of birth");
      return false;
    }
    if (!formData.gender) {
      alert("Please select gender");
      return false;
    }
    if (!formData.mobileNumber.trim()) {
      alert("Please enter student mobile number");
      return false;
    }
    if (!formData.address.trim()) {
      alert("Please enter address");
      return false;
    }
    if (!formData.fatherName.trim()) {
      alert("Please enter father name");
      return false;
    }
    if (!formData.fatherPhone.trim()) {
      alert("Please enter father phone");
      return false;
    }
    if (!formData.admissionDate) {
      alert("Please select admission date");
      return false;
    }
    if (!formData.className.trim()) {
      alert("Please select class");
      return false;
    }
    if (!admissionClassOptions.includes(formData.className)) {
      alert("Select a class from Classes & Subjects masters.");
      return false;
    }
    

    if (formData.createStudentLogin && !formData.email.trim()) {
      alert("Student login email is required when login is enabled.");
      return false;
    }

    const hasNewStudentPassword = Boolean(formData.password.trim());
    if (formData.createStudentLogin && !editingStudent && !hasNewStudentPassword) {
      alert("Please enter student password");
      return false;
    }
    if (hasNewStudentPassword && formData.password !== formData.confirmPassword) {
      alert("Student passwords do not match");
      return false;
    }
    if (hasNewStudentPassword && formData.password.length < 6) {
      alert("Student password must be at least 6 characters");
      return false;
    }
    if (!hasNewStudentPassword && formData.confirmPassword.trim()) {
      alert("Enter student password before confirmation");
      return false;
    }

    if (formData.createParentLogin && !formData.parentEmail.trim()) {
      alert("Parent login email is required when parent login is enabled.");
      return false;
    }

    if (formData.parentPassword && formData.parentPassword.length < 6) {
      alert("Parent password must be at least 6 characters");
      return false;
    }

    if (formData.email.trim()) {
      const normalizedStudentEmail = formData.email.trim().toLowerCase();
      const studentEmailExists = students.some(
        (student) =>
          String(student.email || "").toLowerCase() === normalizedStudentEmail &&
          student.id !== editingStudent?.id
      );
      if (studentEmailExists) {
        alert("A student with this email already exists");
        return false;
      }
    }

    if (formData.parentEmail.trim()) {
      const normalizedParentEmail = formData.parentEmail.trim().toLowerCase();
      const parentEmailExists = parents.some(
        (parent) =>
          String(parent.email || "").toLowerCase() === normalizedParentEmail &&
          parent.id !== formData.parentId
      );
      if (parentEmailExists) {
        alert("A parent with this email already exists");
        return false;
      }
    }

    if (toNumber(formData.totalFees) < 0 || toNumber(formData.paidAmount) < 0) {
      alert("Fee values cannot be negative");
      return false;
    }

    return true;
  };

  const handleSaveStudent = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    try {
      const parentName = formData.guardianName.trim() || formData.fatherName.trim();
      const parentPhone =
        formData.guardianPhone.trim() ||
        formData.fatherPhone.trim() ||
        formData.motherPhone.trim();

      const payload = {
        id: editingStudent?.id,
        name: formData.name.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        bloodGroup: formData.bloodGroup,
        aadhaarNumber: formData.aadhaarNumber.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        email: formData.email.trim().toLowerCase(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        fatherName: formData.fatherName.trim(),
        fatherPhone: formData.fatherPhone.trim(),
        motherName: formData.motherName.trim(),
        motherPhone: formData.motherPhone.trim(),
        guardianName: formData.guardianName.trim(),
        guardianPhone: formData.guardianPhone.trim(),
        parentName,
        parentPhone,
        parentEmail: formData.parentEmail.trim().toLowerCase(),
        parentPassword: formData.parentPassword.trim(),
        createParentLogin: formData.createParentLogin,
        admissionNumber: resolvedAdmissionNumber,
        admissionDate: formData.admissionDate,
        className: formData.className.trim(),
        rollNumber: resolvedRollNumber,
        previousSchoolName: formData.previousSchoolName.trim(),
        previousClass: formData.previousClass.trim(),
        feeStructure: formData.feeStructure,
        totalFees: toNumber(formData.totalFees),
        admissionFee: toNumber(formData.admissionFee),
        paidAmount: toNumber(formData.paidAmount),
        pendingAmount: feePendingPreview,
        paymentStatus: paymentStatusPreview,
        dueDate: formData.dueDate,
        studentPhoto: formData.studentPhoto,
        birthCertificate: formData.birthCertificate,
        aadhaarCard: formData.aadhaarCard,
        tcDocument: formData.tcDocument,
        createStudentLogin: formData.createStudentLogin,
        password: formData.password.trim(),
        enquiryId: formData.enquiryId,
        admissionSource: formData.enquiryId ? "CRM" : formData.admissionSource,
        conversionStatus: formData.enquiryId
          ? "Converted"
          : normalizeStudentConversionStatus(formData.conversionStatus),
        status: formData.status,
      };

      await saveStudent(payload);

      if (editingStudent) {
        setSuccessMessage(`Student ${payload.name} updated successfully!`);
      } else {
        setSuccessMessage(
          `Student ${payload.name} admitted successfully with admission no ${resolvedAdmissionNumber}!`
        );
      }

      setTimeout(() => setSuccessMessage(""), 3500);
      setShowModal(false);
      setEditingStudent(null);
      resetFormState();
    } catch (error) {
      alert("Error saving student: " + error.message);
    }
  };

  const handleDeleteStudent = async (id) => {
    if (window.confirm("Are you sure you want to delete this student?")) {
      const deletedStudent = students.find((student) => student.id === id);
      if (!deletedStudent) return;

      try {
        await deleteStudent(id);
        if (String(selectedStudentId) === String(id)) {
          closeStudentDetails();
        }
        setSuccessMessage(`Student ${deletedStudent.name} deleted successfully!`);
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (error) {
        alert("Error deleting student: " + error.message);
      }
    }
  };

  const handleResetPassword = async (student) => {
    if (student.createStudentLogin === false) {
      alert("Student login is not enabled for this record.");
      return;
    }

    if (!student.email) {
      alert("Student email is missing. Enable login and add login email first.");
      return;
    }

    const newPassword = prompt("Enter new password for " + student.name + ":");
    if (newPassword && newPassword.length >= 6) {
      try {
        await resetUserPassword("student", student.id, newPassword);
        setSuccessMessage(`Password reset for ${student.name}!`);
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (error) {
        alert("Error resetting password: " + error.message);
      }
    } else if (newPassword) {
      alert("Password must be at least 6 characters");
    }
  };

  const renderDocumentStatus = (fieldName) => {
    const documentValue = String(formData[fieldName] || "").trim();
    const uploadStatus = String(documentUploadStatus[fieldName] || "").trim();
    const displayName = getDocumentDisplayName(documentValue);
    const hasLinkedDocument = isDocumentUrl(documentValue);

    return (
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        {documentValue && hasLinkedDocument ? (
          <a
            href={documentValue}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-blue-700 hover:text-blue-800"
          >
            View {displayName || "document"}
          </a>
        ) : documentValue ? (
          <span className="text-slate-600">Uploaded: {displayName || "document"}</span>
        ) : (
          <span className="text-slate-500">No file uploaded</span>
        )}

        {documentValue ? (
          <button
            type="button"
            onClick={() => clearDocumentField(fieldName)}
            className="font-semibold text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        ) : null}

        {uploadStatus ? (
          <span className="font-semibold text-blue-700">{uploadStatus}</span>
        ) : null}
      </div>
    );
  };

  const renderStepContent = () => {
    if (activeStep === "student") {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Aman Kumar"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Date of Birth *
            </label>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Gender *</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Blood Group
            </label>
            <select
              name="bloodGroup"
              value={formData.bloodGroup}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {BLOOD_GROUP_OPTIONS.map((entry) => (
                <option key={entry || "none"} value={entry}>
                  {entry || "Select blood group"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Aadhaar Number
            </label>
            <input
              type="text"
              name="aadhaarNumber"
              value={formData.aadhaarNumber}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1234 5678 9012"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Mobile Number *
            </label>
            <input
              type="tel"
              name="mobileNumber"
              value={formData.mobileNumber}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+91-9876543210"
            />
          </div>
        </div>
      );
    }

    if (activeStep === "contact") {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="student@schoolcrm.com"
            />
            <p className="mt-1 text-xs text-slate-500">
              Used as login ID when student login is enabled.
            </p>
          </div>

          <div />

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Address *</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Street / Area / Landmark"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="City"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">State</label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="State"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Pincode</label>
            <input
              type="text"
              name="pincode"
              value={formData.pincode}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="110001"
            />
          </div>
        </div>
      );
    }

    if (activeStep === "parent") {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Father Name *</label>
            <input
              type="text"
              name="fatherName"
              value={formData.fatherName}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Rajesh Kumar"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Father Phone *</label>
            <input
              type="tel"
              name="fatherPhone"
              value={formData.fatherPhone}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+91-9876543210"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Mother Name</label>
            <input
              type="text"
              name="motherName"
              value={formData.motherName}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mother name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Mother Phone</label>
            <input
              type="tel"
              name="motherPhone"
              value={formData.motherPhone}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+91-9876543210"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Guardian Name</label>
            <input
              type="text"
              name="guardianName"
              value={formData.guardianName}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Guardian name (if applicable)"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Guardian Phone</label>
            <input
              type="tel"
              name="guardianPhone"
              value={formData.guardianPhone}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+91-9876543210"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Parent Email</label>
            <input
              type="email"
              name="parentEmail"
              value={formData.parentEmail}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="parent@schoolcrm.com"
            />
          </div>
        </div>
      );
    }

    if (activeStep === "academic") {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Admission Number
            </label>
            <input
              type="text"
              value={resolvedAdmissionNumber}
              readOnly
              className="w-full rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-slate-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Admission Date *
            </label>
            <input
              type="date"
              name="admissionDate"
              value={formData.admissionDate}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Class *</label>
            <select
              name="className"
              value={formData.className}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select class</option>
              {admissionClassOptions.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>

          

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Roll Number (Auto/Manual)
            </label>
            <input
              type="text"
              name="rollNumber"
              value={formData.rollNumber}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={autoRollNumber || "Auto-generated by class"}
            />
            <p className="mt-1 text-xs text-slate-500">
              Auto fallback: {autoRollNumber || "Select class first"}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Previous School Name
            </label>
            <input
              type="text"
              name="previousSchoolName"
              value={formData.previousSchoolName}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Previous school"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Previous Class</label>
            <input
              type="text"
              name="previousClass"
              value={formData.previousClass}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Previous class"
            />
          </div>

          {!hasAdmissionMasters ? (
            <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              Create class masters first in Classes & Subjects.
            </div>
          ) : null}
        </div>
      );
    }

    if (activeStep === "fees") {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Fee Structure</label>
            <select
              name="feeStructure"
              value={formData.feeStructure}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {FEE_PLAN_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Total Fees</label>
            <input
              type="number"
              name="totalFees"
              value={formData.totalFees}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="30000"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Admission Fee</label>
            <input
              type="number"
              name="admissionFee"
              value={formData.admissionFee}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="5000"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Paid Amount</label>
            <input
              type="number"
              name="paidAmount"
              value={formData.paidAmount}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="10000"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Pending Amount</label>
            <input
              type="text"
              value={formatCurrency(feePendingPreview)}
              readOnly
              className="w-full rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-slate-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Payment Status</label>
            <select
              name="paymentStatus"
              value={paymentStatusPreview}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAYMENT_STATUS_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Fee Due Date</label>
            <input
              type="date"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      );
    }

    if (activeStep === "documents") {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Student Photo</label>
            <input
              type="file"
              name="studentPhoto"
              accept="image/*"
              onChange={handleFileUpload}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {renderDocumentStatus("studentPhoto")}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Birth Certificate
            </label>
            <input
              type="file"
              name="birthCertificate"
              onChange={handleFileUpload}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {renderDocumentStatus("birthCertificate")}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Aadhaar Card</label>
            <input
              type="file"
              name="aadhaarCard"
              onChange={handleFileUpload}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {renderDocumentStatus("aadhaarCard")}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">TC Document</label>
            <input
              type="file"
              name="tcDocument"
              onChange={handleFileUpload}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {renderDocumentStatus("tcDocument")}
          </div>

          <div className="sm:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            Files are uploaded to server storage and linked directly with admission records.
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="createStudentLogin"
              checked={formData.createStudentLogin}
              onChange={handleInputChange}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Enable student login now
          </label>
          <p className="mt-2 text-xs text-slate-500">
            If disabled, student account can be activated later.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Login Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            disabled={!formData.createStudentLogin}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            placeholder="student@schoolcrm.com"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Student Password {editingStudent ? "(Optional)" : "*"}
          </label>
          <div className="relative">
            <input
              type={showPassword.password ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              disabled={!formData.createStudentLogin}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              placeholder={
                editingStudent ? "Leave blank to keep current password" : "Minimum 6 characters"
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
          <label className="mb-2 block text-sm font-semibold text-slate-700">Confirm Password</label>
          <div className="relative">
            <input
              type={showPassword.confirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              disabled={!formData.createStudentLogin}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              placeholder="Confirm student password"
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

        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="createParentLogin"
              checked={formData.createParentLogin}
              onChange={handleInputChange}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Enable parent login now
          </label>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Parent Login Email</label>
          <input
            type="email"
            name="parentEmail"
            value={formData.parentEmail}
            onChange={handleInputChange}
            disabled={!formData.createParentLogin}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            placeholder="parent@schoolcrm.com"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Parent Password</label>
          <div className="relative">
            <input
              type={showPassword.parentPassword ? "text" : "password"}
              name="parentPassword"
              value={formData.parentPassword}
              onChange={handleInputChange}
              disabled={!formData.createParentLogin}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              placeholder="Leave blank for default policy password"
            />
            <button
              type="button"
              onClick={() =>
                setShowPassword((prev) => ({
                  ...prev,
                  parentPassword: !prev.parentPassword,
                }))
              }
              className="absolute right-3 top-2.5 text-slate-600"
            >
              {showPassword.parentPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Enquiry ID</label>
          <select
            name="enquiryId"
            value={formData.enquiryId}
            onChange={handleInputChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Not linked</option>
            {enquiryOptions.map((enquiry) => (
              <option key={enquiry.id} value={enquiry.id}>
                {enquiry.id} - {enquiry.studentName}
              </option>
            ))}
          </select>
          {selectedEnquiryRecord ? (
            <p className="mt-1 text-xs text-blue-700">
              Linked CRM lead: {selectedEnquiryRecord.studentName || "-"} | Stage{" "}
              {selectedEnquiryRecord.stage || selectedEnquiryRecord.status || "-"} | Follow-up{" "}
              {formatDate(selectedEnquiryRecord.followUpDate)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Select a CRM enquiry to auto-fill admission details.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Admission Source</label>
          <select
            name="admissionSource"
            value={formData.admissionSource}
            onChange={handleInputChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ADMISSION_SOURCE_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Conversion Status
          </label>
          <select
            name="conversionStatus"
            value={formData.conversionStatus}
            onChange={handleInputChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CONVERSION_STATUS_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Record Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Student Management</h1>
              <p className="mt-2 text-slate-500">
                Complete admission workflow with student, parent, academic, fee, documents, and CRM linkage.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
              <button
                type="button"
                onClick={() => navigate("/admin/classes-subjects")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Manage Classes & Subjects
              </button>
              <button
                onClick={() => setShowBulkUploadModal(true)}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 font-semibold text-emerald-700 transition hover:bg-emerald-100"
                title="Upload multiple students from Excel file"
              >
                📤 Upload Excel
              </button>
              <button
                onClick={handleAddStudent}
                className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700"
              >
                + Add Student
              </button>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm">
            <div className="flex w-full flex-nowrap items-center gap-3 overflow-x-auto pb-1">
              <div className="relative w-[320px] min-w-[320px] shrink-0 sm:w-[380px] sm:min-w-[380px]">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Search students"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 shrink-0">
                {isServerSearchActive
                  ? serverLoading
                    ? "Searching..."
                    : `${serverTotal} results`
                  : `${filteredStudents.length}/${students.length} shown`}
              </span>

              {isServerSearchActive ? (
                <div className="flex shrink-0 items-center gap-2 rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                  <button
                    type="button"
                    onClick={() => setServerPage((p) => Math.max(1, p - 1))}
                    disabled={serverPage <= 1 || serverLoading}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-slate-600">
                    {serverPage}/{Math.max(1, Math.ceil(serverTotal / serverPageSize))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setServerPage((p) => p + 1)}
                    disabled={serverPage >= Math.max(1, Math.ceil(serverTotal / serverPageSize)) || serverLoading}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : null}

              <select
                value={serverFilterClass}
                onChange={(e) => setServerFilterClass(e.target.value)}
                className="min-w-[160px] shrink-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All classes</option>
                {filterCounts.classes.length
                  ? filterCounts.classes.map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {entry.name} ({entry.count})
                      </option>
                    ))
                  : classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
              </select>

              <select
                value={serverSortBy}
                onChange={(e) => setServerSortBy(e.target.value)}
                className="min-w-[160px] shrink-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Sort: Name</option>
                <option value="admissionNumber">Sort: Admission No</option>
                <option value="id">Sort: ID</option>
                <option value="className">Sort: Class</option>
              </select>

              <select
                value={serverSortOrder}
                onChange={(e) => setServerSortOrder(e.target.value)}
                className="min-w-[110px] shrink-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
            {successMessage}
          </div>
        )}

        <section className="mb-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-blue-900">CRM Conversion Queue</h2>
              <p className="mt-1 text-xs text-blue-700">
                In-progress CRM enquiries waiting for admission completion.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
              {filteredConversionQueueEnquiries.length}/{conversionQueueEnquiries.length} shown
            </span>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white/70 p-2 ring-1 ring-blue-100">
            {CONVERSION_QUEUE_DATE_FILTER_OPTIONS.map((filterOption) => (
              <button
                key={filterOption}
                type="button"
                onClick={() => setConversionQueueDateFilter(filterOption)}
                className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition duration-200 ease-out sm:text-sm ${
                  conversionQueueDateFilter === filterOption
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-blue-100 bg-white text-blue-700 hover:-translate-y-px hover:border-blue-300 hover:bg-white hover:shadow-[0_8px_18px_-12px_rgba(30,64,175,0.55)]"
                }`}
              >
                {filterOption}
              </button>
            ))}
          </div>

          {conversionQueueEnquiries.length ? (
            filteredConversionQueueEnquiries.length ? (
              <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-blue-50 text-blue-800">
                    <tr>
                      <th className="p-3 font-semibold">Lead</th>
                      <th className="p-3 font-semibold">Class</th>
                      <th className="p-3 font-semibold">Follow-up</th>
                      <th className="p-3 font-semibold">Stage</th>
                      <th className="p-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConversionQueueEnquiries.map((enquiry) => (
                      <tr key={enquiry.enquiryId} className="border-b border-blue-100 last:border-b-0">
                        <td className="p-3 text-slate-700">
                          <p className="font-semibold text-slate-800">
                            {enquiry.studentName || "Unnamed lead"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {enquiry.parentName || enquiry.guardianName || "Parent not set"}
                            {enquiry.phone ? ` | ${enquiry.phone}` : ""}
                          </p>
                          <p className="text-[11px] text-slate-500">{enquiry.enquiryId}</p>
                        </td>
                        <td className="p-3 text-slate-700">
                          {enquiry.classInterest || enquiry.className || "Not set"}
                        </td>
                        <td className="p-3 text-slate-700">
                          {formatDate(enquiry.followUpDate)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${getStatusClassName(
                              enquiry.stage || enquiry.status || "In Progress"
                            )}`}
                          >
                            {enquiry.stage || enquiry.status || "In Progress"}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => handleStartAdmissionFromEnquiry(enquiry)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Start Admission
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-blue-200 bg-white p-3 text-xs text-slate-600">
                No queue items match the {conversionQueueDateFilter} filter.
              </p>
            )
          ) : (
            <p className="rounded-lg border border-dashed border-blue-200 bg-white p-3 text-xs text-slate-600">
              No in-progress CRM enquiries are waiting for admission right now.
            </p>
          )}
        </section>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4 font-semibold">ID</th>
                <th className="p-4 font-semibold">Admission No</th>
                <th className="p-4 font-semibold">Student</th>
                <th className="p-4 font-semibold">Parent</th>
                <th className="p-4 font-semibold">Contact</th>
                <th className="p-4 font-semibold">Fee</th>
                <th className="p-4 font-semibold">Source</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const studentStatus = String(student.status || "Active").trim() || "Active";
                const feeStatus = student.fee?.paymentStatus || student.fee?.status || "Pending";
                const feeDue = Number((student.fee?.pendingAmount ?? student.fee?.due) || 0);
                const parentName = student.fatherName || student.parentName || "Not set";
                const parentPhone =
                  student.fatherPhone || student.guardianPhone || student.parentPhone || "Not set";
                const studentMobile = student.mobileNumber || "Not set";

                return (
                  <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-800">{student.id}</td>
                    <td className="p-4 text-slate-600">{student.admissionNumber || "Pending"}</td>
                    <td className="p-4 text-slate-600">
                      <p className="font-semibold text-slate-800">{student.name}</p>
                      <p className="text-xs text-slate-500">
                        {student.className} | {student.rollNumber || "No roll"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Attendance: {getAttendancePercent(student.attendance)}%
                      </p>
                    </td>
                    <td className="p-4 text-slate-600">
                      <p>{parentName}</p>
                      <p className="text-xs text-slate-500">{parentPhone}</p>
                    </td>
                    <td className="p-4 text-slate-600">
                      <p>{studentMobile}</p>
                      <p className="text-xs text-slate-500">{student.email || "No email"}</p>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(
                          feeStatus
                        )}`}
                      >
                        {feeStatus} {formatCurrency(feeDue)}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{student.admissionSource || "Walk-in"}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                          studentStatus === "Active"
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {studentStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        <button
                          onClick={() => openStudentDetails(student)}
                          className="table-action-btn touch-target rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        >
                          View
                        </button>
                        <button
                          onClick={() => navigate(`/admin/students/${student.id}`)}
                          className="table-action-btn touch-target rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => handleEditStudent(student)}
                          className="table-action-btn touch-target rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleResetPassword(student)}
                          className="table-action-btn touch-target rounded-md px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 hover:text-amber-800"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="table-action-btn touch-target rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!students.length ? (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={9}>
                    No student records available.
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={9}>
                    No students match your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selectedStudent && selectedStudentDetails ? (
          <div className="fixed inset-0 z-50 flex justify-end">
            <button
              type="button"
              onClick={closeStudentDetails}
              className="h-full flex-1 bg-slate-900/35"
              aria-label="Close student details"
            />

            <aside className="relative h-full w-full max-w-full overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl sm:max-w-[520px] sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedStudent.admissionNumber || "Pending admission"} | {selectedStudent.className} | Roll {selectedStudent.rollNumber || "-"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeStudentDetails();
                      navigate(`/admin/students/${selectedStudent.id}`);
                    }}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Full Profile
                  </button>

                  <button
                    type="button"
                    onClick={closeStudentDetails}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                {STUDENT_DETAIL_TABS.map((tab) => (
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
                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Basic Info</h3>
                    <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Date of Birth</dt>
                        <dd className="font-medium text-slate-800">{formatDate(selectedStudent.dateOfBirth)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Gender</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.gender || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Blood Group</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.bloodGroup || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Aadhaar</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.aadhaarNumber || "-"}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
                    <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Mobile</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.mobileNumber || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Email</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.email || "-"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-slate-500">Address</dt>
                        <dd className="font-medium text-slate-800">
                          {selectedStudent.address || "-"}
                          {selectedStudent.city ? `, ${selectedStudent.city}` : ""}
                          {selectedStudent.state ? `, ${selectedStudent.state}` : ""}
                          {selectedStudent.pincode ? ` - ${selectedStudent.pincode}` : ""}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parent</h3>
                    <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Father</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.fatherName || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Father Phone</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.fatherPhone || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Mother</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.motherName || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Mother Phone</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.motherPhone || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Parent Login Email</dt>
                        <dd className="font-medium text-slate-800">
                          {selectedStudentDetails.linkedParent?.email || selectedStudent.parentEmail || "-"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Guardian</dt>
                        <dd className="font-medium text-slate-800">
                          {selectedStudent.guardianName || selectedStudent.parentName || "-"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Academic & CRM</h3>
                    <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Admission Date</dt>
                        <dd className="font-medium text-slate-800">{formatDate(selectedStudent.admissionDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Attendance</dt>
                        <dd className="font-medium text-slate-800">
                          {getAttendancePercent(selectedStudent.attendance)}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Source</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.admissionSource || "Walk-in"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Conversion</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.conversionStatus || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Linked Enquiry</dt>
                        <dd className="font-medium text-slate-800">
                          {selectedStudentDetails.linkedEnquiry
                            ? `${selectedStudentDetails.linkedEnquiry.id} (${selectedStudentDetails.linkedEnquiry.stage})`
                            : selectedStudent.enquiryId || "-"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Record Status</dt>
                        <dd className="font-medium text-slate-800">{selectedStudent.status || "Active"}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              ) : null}

              {activeDetailTab === "attendance" ? (
                <div className="space-y-4">
                  <section className="grid gap-3 sm:grid-cols-3">
                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Percent</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {getAttendancePercent(selectedStudent.attendance)}%
                      </p>
                    </article>
                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Present</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {toNumber(selectedStudent.attendance?.present)}
                      </p>
                    </article>
                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {toNumber(selectedStudent.attendance?.total)}
                      </p>
                    </article>
                  </section>

                  <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
                        {selectedStudentDetails.attendanceRows.slice(0, 20).map((entry) => (
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

                        {!selectedStudentDetails.attendanceRows.length ? (
                          <tr>
                            <td className="p-4 text-slate-500" colSpan={4}>
                              No attendance history available.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </section>
                </div>
              ) : null}

              {activeDetailTab === "results" ? (
                <div className="space-y-4">
                  <section className="grid gap-3 sm:grid-cols-2">
                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{selectedStudentDetails.averageMarks}%</p>
                    </article>
                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exams</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{selectedStudentDetails.resultRows.length}</p>
                    </article>
                  </section>

                  <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
                        {selectedStudentDetails.resultRows.map((entry) => (
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

                        {!selectedStudentDetails.resultRows.length ? (
                          <tr>
                            <td className="p-4 text-slate-500" colSpan={5}>
                              No result history available.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </section>
                </div>
              ) : null}

              {activeDetailTab === "fees" ? (
                <div className="space-y-4">
                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Fee Summary</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClassName(
                          selectedStudentDetails.feeSummary.feeStatus
                        )}`}
                      >
                        {selectedStudentDetails.feeSummary.feeStatus}
                      </span>
                    </div>

                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Total Fees</dt>
                        <dd className="font-semibold text-slate-800">
                          {formatCurrency(selectedStudentDetails.feeSummary.totalFees)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Paid</dt>
                        <dd className="font-semibold text-slate-800">
                          {formatCurrency(selectedStudentDetails.feeSummary.paidAmount)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Due</dt>
                        <dd className="font-semibold text-slate-800">
                          {formatCurrency(selectedStudentDetails.feeSummary.pendingAmount)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Due Date</dt>
                        <dd className="font-semibold text-slate-800">
                          {formatDate(selectedStudentDetails.feeSummary.dueDate)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="p-3 font-semibold">Date</th>
                          <th className="p-3 font-semibold">Amount</th>
                          <th className="p-3 font-semibold">Method</th>
                          <th className="p-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStudentDetails.feeSummary.paymentHistory.map((entry, index) => (
                          <tr
                            key={entry.id || `${selectedStudent.id}-payment-${index}`}
                            className="border-b border-slate-100"
                          >
                            <td className="p-3 text-slate-700">{formatDate(entry.date)}</td>
                            <td className="p-3 text-slate-700">{formatCurrency(entry.amount)}</td>
                            <td className="p-3 text-slate-700">{entry.method || "-"}</td>
                            <td className="p-3 text-slate-700">{entry.status || "Paid"}</td>
                          </tr>
                        ))}

                        {!selectedStudentDetails.feeSummary.paymentHistory.length ? (
                          <tr>
                            <td className="p-4 text-slate-500" colSpan={4}>
                              No payment history available.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </section>
                </div>
              ) : null}

              {activeDetailTab === "documents" ? (
                <div className="space-y-3">
                  {selectedStudentDetails.documents.map((document) => {
                    const rawValue = String(document.value || "").trim();
                    const displayName = getDocumentDisplayName(rawValue);
                    const hasUrl = isDocumentUrl(rawValue);

                    return (
                      <article
                        key={document.key}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-sm font-semibold text-slate-900">{document.label}</p>
                        {rawValue ? (
                          hasUrl ? (
                            <a
                              href={rawValue}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-sm font-semibold text-blue-700 hover:text-blue-800"
                            >
                              View {displayName || "document"}
                            </a>
                          ) : (
                            <p className="mt-1 text-sm text-slate-700">{displayName || rawValue}</p>
                          )
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">Not uploaded</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3 sm:p-4">
            <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white p-4 sm:p-8">
              <h2 className="mb-2 text-2xl font-bold text-slate-900">
                {editingStudent ? "Edit Student Admission" : "New Student Admission"}
              </h2>
              <p className="mb-6 text-sm text-slate-500">
                Complete grouped details across sections to keep admissions clean and professional.
              </p>

              <div className="mb-6 flex flex-wrap gap-2">
                {ADMISSION_STEPS.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeStep === step.id
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {step.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSaveStudent} className="space-y-6">
                <section className="rounded-lg border border-slate-200 p-5">{renderStepContent()}</section>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={activeStepIndex <= 0}
                      onClick={() => moveToStep(-1)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={activeStepIndex >= ADMISSION_STEPS.length - 1}
                      onClick={() => moveToStep(1)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setEditingStudent(null);
                        resetFormState();
                      }}
                      className="rounded-lg bg-slate-200 px-6 py-2 font-semibold text-slate-800 hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
                    >
                      {editingStudent ? "Update Admission" : "Create Admission"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <BulkUploadStudentModal
          isOpen={showBulkUploadModal}
          onClose={() => setShowBulkUploadModal(false)}
          classCount={classes.length}
          onSuccess={() => {
            setSuccessMessage("Students imported successfully!");
            setTimeout(() => setSuccessMessage(""), 3500);
          }}
        />
      </section>
    </DashboardLayout>
  );
}

export default Students;