import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import { createInitialSchoolData, SCHOOL_DATA_VERSION } from "../../frontend/src/data/schoolSeed.js";

const DEFAULT_STATE_KEY = "default";
const getCliArgValue = (flagName) => {
  const prefix = `${flagName}=`;
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = String(process.argv[index] || "");
    if (!arg) {
      continue;
    }

    if (arg === flagName) {
      return String(process.argv[index + 1] || "").trim();
    }

    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).trim();
    }
  }

  return "";
};

const toValidPort = (value, fallback = 5000) => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }

  return fallback;
};

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
};

const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");

const toOriginList = (...values) => {
  const parsed = values
    .flatMap((value) => String(value || "").split(","))
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  return Array.from(new Set(parsed));
};

const HOST = getCliArgValue("--host") || process.env.HOST || "0.0.0.0";
const PORT = toValidPort(getCliArgValue("--port") || process.env.PORT, 5000);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/school-crm";
const FRONTEND_ORIGINS = toOriginList(
  process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5173"
);
const isAllowedCorsOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  return FRONTEND_ORIGINS.includes(normalizeOrigin(origin));
};
const JWT_SECRET = process.env.JWT_SECRET || "school-crm-dev-secret-change-this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const IS_PRODUCTION =
  String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const envRateLimitDefault = (productionValue, nonProductionValue) =>
  IS_PRODUCTION ? productionValue : nonProductionValue;
const RATE_LIMIT_ENABLED =
  String(process.env.RATE_LIMIT_ENABLED || "true").toLowerCase() !== "false";
const LOGIN_RATE_LIMIT_WINDOW_MS = toPositiveInteger(
  process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const LOGIN_RATE_LIMIT_MAX_PER_IP = toPositiveInteger(
  process.env.LOGIN_RATE_LIMIT_MAX_PER_IP,
  envRateLimitDefault(60, 120)
);
const LOGIN_RATE_LIMIT_MAX_PER_IDENTITY = toPositiveInteger(
  process.env.LOGIN_RATE_LIMIT_MAX_PER_IDENTITY,
  envRateLimitDefault(15, 40)
);
const AUTH_SETUP_RATE_LIMIT_WINDOW_MS = toPositiveInteger(
  process.env.AUTH_SETUP_RATE_LIMIT_WINDOW_MS,
  10 * 60 * 1000
);
const AUTH_SETUP_RATE_LIMIT_MAX_PER_IP = toPositiveInteger(
  process.env.AUTH_SETUP_RATE_LIMIT_MAX_PER_IP,
  envRateLimitDefault(10, 20)
);
const DASHBOARD_RATE_LIMIT_WINDOW_MS = toPositiveInteger(
  process.env.DASHBOARD_RATE_LIMIT_WINDOW_MS,
  60 * 1000
);
const DASHBOARD_RATE_LIMIT_MAX = toPositiveInteger(
  process.env.DASHBOARD_RATE_LIMIT_MAX,
  envRateLimitDefault(120, 240)
);
const MESSAGE_WRITE_RATE_LIMIT_WINDOW_MS = toPositiveInteger(
  process.env.MESSAGE_WRITE_RATE_LIMIT_WINDOW_MS,
  60 * 1000
);
const MESSAGE_WRITE_RATE_LIMIT_MAX = toPositiveInteger(
  process.env.MESSAGE_WRITE_RATE_LIMIT_MAX,
  envRateLimitDefault(15, 30)
);
const MESSAGE_READ_RATE_LIMIT_WINDOW_MS = toPositiveInteger(
  process.env.MESSAGE_READ_RATE_LIMIT_WINDOW_MS,
  60 * 1000
);
const MESSAGE_READ_RATE_LIMIT_MAX = toPositiveInteger(
  process.env.MESSAGE_READ_RATE_LIMIT_MAX,
  envRateLimitDefault(120, 180)
);
const MAX_STUDENT_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_STUDENT_DOCUMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
const GRIDFS_BUCKET_NAME = "student_documents";
let studentDocumentBucket = null;

const ROLE_ADMIN = "admin";
const ROLE_CRM = "crm";
const ROLE_TEACHER = "teacher";
const ROLE_STUDENT = "student";
const ROLE_PARENT = "parent";
const INACTIVE_STATUS = "inactive";
const HASHED_PASSWORD_PATTERN = /^\$2[aby]\$/;
const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const NOTICE_AUDIENCE_OPTIONS = [
  "all",
  ROLE_ADMIN,
  ROLE_CRM,
  ROLE_TEACHER,
  ROLE_STUDENT,
  ROLE_PARENT,
];
const SYSTEM_USER_ROLES = [ROLE_ADMIN, ROLE_CRM];
const ENQUIRY_STAGE_OPTIONS = [
  "New Lead",
  "Contacted",
  "Visit Scheduled",
  "Applied",
  "Converted",
  "Rejected",
];
const ENQUIRY_PIPELINE_FLOW_STAGES = [
  "New Lead",
  "Contacted",
  "Visit Scheduled",
  "Applied",
  "Converted",
];
const LEGACY_ENQUIRY_STAGE_MAP = {
  new: "New Lead",
  "new lead": "New Lead",
  counselling: "Contacted",
  interested: "Contacted",
  "campus visit": "Visit Scheduled",
  application: "Applied",
  admitted: "Converted",
  "follow-up today": "Contacted",
  "campus visit booked": "Visit Scheduled",
  "application shared": "Applied",
};
const ENQUIRY_STAGE_TO_STATUS = {
  "New Lead": "Active",
  Contacted: "Contacted",
  "Visit Scheduled": "Active",
  Applied: "Active",
  Converted: "Converted",
  Rejected: "Rejected",
};
const ENQUIRY_DEFAULT_STAGE = "New Lead";
const ENQUIRY_CONVERSION_STATUS_OPTIONS = [
  "Not Converted",
  "In Progress",
  "Converted",
];
const ENQUIRY_DEFAULT_CONVERSION_STATUS = "Not Converted";
const ADMIN_SETTINGS_DEFAULTS = {
  schoolName: "Centralized School",
  schoolCode: "CS-01",
  academicSession: "2026-2027",
  passwordMinLength: 6,
  enforceStrongPasswords: false,
  forceLogoutOnPasswordReset: false,
};
const DEFAULT_SCHOOL_NAME = "Centralized School";
const DEFAULT_SCHOOL_SLUG = "centralized-school";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedCorsOrigin(origin));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

const schemaOptions = {
  timestamps: true,
  minimize: false,
  strict: false,
};

const withIdSchema = (extraShape = {}) => {
  const schema = new mongoose.Schema(
    {
      schoolId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },
      id: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },
      ...extraShape,
    },
    schemaOptions
  );

  schema.index({ schoolId: 1, id: 1 }, { unique: true });
  return schema;
};

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: String,
    address: String,
    status: {
      type: String,
      default: "Active",
    },
  },
  schemaOptions
);

const legacySchoolStateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      required: true,
      default: DEFAULT_STATE_KEY,
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  schemaOptions
);

const adminSettingsSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      default: DEFAULT_STATE_KEY,
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  schemaOptions
);
adminSettingsSchema.index({ schoolId: 1, key: 1 }, { unique: true });

const userSchema = withIdSchema({
  name: String,
  email: {
    type: String,
    trim: true,
    lowercase: true,
    index: true,
  },
  password: String,
  role: String,
  status: String,
});

const teacherSchema = withIdSchema({
  name: String,
  email: {
    type: String,
    trim: true,
    lowercase: true,
    index: true,
  },
  password: String,
  subject: String,
  subjects: [String],
  department: String,
  phone: String,
  classes: [String],
  status: String,
  joiningDate: String,
});

const studentSchema = withIdSchema({
  name: String,
  email: {
    type: String,
    trim: true,
    lowercase: true,
    index: true,
  },
  password: String,
  className: String,
  rollNumber: String,
  admissionNumber: String,
  dateOfBirth: String,
  gender: String,
  bloodGroup: String,
  aadhaarNumber: String,
  mobileNumber: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  fatherName: String,
  fatherPhone: String,
  motherName: String,
  motherPhone: String,
  guardianName: String,
  guardianPhone: String,
  previousSchoolName: String,
  previousClass: String,
  studentPhoto: String,
  birthCertificate: String,
  aadhaarCard: String,
  tcDocument: String,
  documents: mongoose.Schema.Types.Mixed,
  parentId: String,
  parentName: String,
  parentEmail: String,
  parentPhone: String,
  admissionDate: String,
  admissionSource: String,
  conversionStatus: String,
  enquiryId: String,
  userId: String,
  createdBy: String,
  updatedBy: String,
  createStudentLogin: Boolean,
  createParentLogin: Boolean,
  status: String,
  attendance: mongoose.Schema.Types.Mixed,
  fee: mongoose.Schema.Types.Mixed,
});

const parentSchema = withIdSchema({
  name: String,
  email: {
    type: String,
    trim: true,
    lowercase: true,
    index: true,
  },
  password: String,
  phone: String,
  studentId: String,
  fatherName: String,
  fatherPhone: String,
  motherName: String,
  motherPhone: String,
  guardianName: String,
  guardianPhone: String,
  userId: String,
  createdBy: String,
  updatedBy: String,
  status: String,
});

const attendanceSchema = withIdSchema({
  className: String,
  date: String,
  subject: String,
  teacherId: String,
  records: [mongoose.Schema.Types.Mixed],
});

const resultSchema = withIdSchema({
  studentId: String,
  subject: String,
  exam: String,
  marks: Number,
  maxMarks: Number,
  teacherId: String,
  publishedDate: String,
});

const enquirySchema = withIdSchema({
  studentName: String,
  parentName: String,
  guardianName: String,
  classInterest: String,
  phone: String,
  email: String,
  source: String,
  assignedTo: String,
  owner: String,
  stage: String,
  status: String,
  followUpDate: String,
  notes: mongoose.Schema.Types.Mixed,
  activity: mongoose.Schema.Types.Mixed,
  callHistory: mongoose.Schema.Types.Mixed,
  lastUpdatedAt: String,
  createdAt: String,
  convertedStudentId: String,
  conversionStatus: String,
  isConverted: Boolean,
});

const noticeSchema = withIdSchema({});

const masterSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  schemaOptions
);
masterSchema.index({ schoolId: 1, name: 1 }, { unique: true });

const LegacySchoolState =
  mongoose.models.LegacySchoolState ||
  mongoose.model("LegacySchoolState", legacySchoolStateSchema, "schoolstates");
const School = mongoose.models.School || mongoose.model("School", schoolSchema, "schools");
const User = mongoose.models.SchoolUser || mongoose.model("SchoolUser", userSchema, "users");
const Teacher =
  mongoose.models.SchoolTeacher || mongoose.model("SchoolTeacher", teacherSchema, "teachers");
const Student =
  mongoose.models.SchoolStudent || mongoose.model("SchoolStudent", studentSchema, "students");
const Parent =
  mongoose.models.SchoolParent || mongoose.model("SchoolParent", parentSchema, "parents");
const Attendance =
  mongoose.models.SchoolAttendance ||
  mongoose.model("SchoolAttendance", attendanceSchema, "attendance");
const Result =
  mongoose.models.SchoolResult || mongoose.model("SchoolResult", resultSchema, "results");
const Enquiry =
  mongoose.models.SchoolEnquiry || mongoose.model("SchoolEnquiry", enquirySchema, "enquiries");
const Notice =
  mongoose.models.SchoolNotice || mongoose.model("SchoolNotice", noticeSchema, "notices");
const Subject =
  mongoose.models.SubjectMaster || mongoose.model("SubjectMaster", masterSchema, "subjects");
const Department =
  mongoose.models.DepartmentMaster ||
  mongoose.model("DepartmentMaster", masterSchema, "departments");
const ClassMaster =
  mongoose.models.ClassMaster || mongoose.model("ClassMaster", masterSchema, "classes");
const SectionMaster =
  mongoose.models.SectionMaster ||
  mongoose.model("SectionMaster", masterSchema, "sections");
const AdminSettings =
  mongoose.models.AdminSettings ||
  mongoose.model("AdminSettings", adminSettingsSchema, "adminsettings");

const messageSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true, index: true, trim: true },
    parentId: { type: String, required: true, index: true },
    parentEmail: { type: String, index: true },
    parentName: String,
    teacherId: String,
    teacherName: String,
    childId: String,
    childName: String,
    subject: String,
    body: { type: String, required: true },
    sentAt: { type: String, default: () => new Date().toISOString() },
    direction: { type: String, enum: ["parent-to-teacher", "teacher-to-parent"], default: "parent-to-teacher" },
    readByTeacher: { type: Boolean, default: false },
    readByParent: { type: Boolean, default: true },
  },
  schemaOptions
);

const Message =
  mongoose.models.ParentMessage ||
  mongoose.model("ParentMessage", messageSchema, "parent_messages");

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const cloneData = (value) => JSON.parse(JSON.stringify(value));

const isPasswordHash = (value) => HASHED_PASSWORD_PATTERN.test(String(value || ""));

const getTodayISO = () => new Date().toISOString().slice(0, 10);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
};

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeSchoolId = (value) => String(value || "").trim();

const getSchoolIdFromDocument = (school) =>
  normalizeSchoolId(school?._id || school?.id || school?.schoolId);

const normalizeSchoolSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const buildSchoolCodeFromName = (schoolName) => {
  const cleaned = String(schoolName || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ");
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  if (!tokens.length) {
    return "SCH";
  }

  if (tokens.length >= 2) {
    return tokens
      .slice(0, 4)
      .map((token) => token[0])
      .join("")
      .slice(0, 4);
  }

  return (tokens[0] || "SCH").slice(0, 4);
};

const toStudentDocumentPublicPath = (fileId, fileName = "document") => {
  const normalizedId = String(fileId || "").trim();
  const normalizedFileName =
    encodeURIComponent(String(fileName || "document").trim() || "document");

  return `/api/uploads/student-document/${normalizedId}/${normalizedFileName}`;
};

const toUploadPublicUrl = (req, publicPath) => {
  const host = String(req.get("host") || "").trim();
  if (!host) {
    return publicPath;
  }

  return `${req.protocol}://${host}${publicPath}`;
};

const getUploadPathname = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    return new URL(raw).pathname || "";
  } catch {
    return raw;
  }
};

const extractStudentDocumentId = (value) => {
  const pathname = getUploadPathname(value).replace(/\\/g, "/");
  const marker = "/api/uploads/student-document/";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) {
    return "";
  }

  const relative = pathname.slice(markerIndex + marker.length).replace(/^\/+/, "");
  const [documentId] = relative.split("/").filter(Boolean);
  return String(documentId || "").trim();
};

const toObjectId = (value) => {
  const raw = String(value || "").trim();
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return null;
  }

  return new mongoose.Types.ObjectId(raw);
};

const ensureStudentDocumentBucket = () => {
  if (!studentDocumentBucket) {
    const storageError = new Error("Document storage is not ready.");
    storageError.statusCode = 503;
    throw storageError;
  }

  return studentDocumentBucket;
};

const uploadStudentDocumentToMongo = async (file, documentType = "document") => {
  const bucket = ensureStudentDocumentBucket();
  const normalizedOriginalName =
    String(file?.originalname || "document").trim() || "document";

  const uploadStream = bucket.openUploadStream(normalizedOriginalName, {
    contentType: String(file?.mimetype || "application/octet-stream"),
    metadata: {
      documentType: String(documentType || "document").trim() || "document",
      uploadedAt: new Date().toISOString(),
    },
  });

  await new Promise((resolve, reject) => {
    uploadStream.on("finish", resolve);
    uploadStream.on("error", reject);
    uploadStream.end(file.buffer);
  });

  return {
    fileId: String(uploadStream.id || ""),
    originalName: normalizedOriginalName,
    mimeType: String(file?.mimetype || "application/octet-stream"),
    size: Number(file?.size || 0),
  };
};

const deleteStudentDocumentById = async (value) => {
  const bucket = ensureStudentDocumentBucket();
  const documentId = toObjectId(value);
  if (!documentId) {
    return;
  }

  try {
    await bucket.delete(documentId);
  } catch (error) {
    if (String(error?.message || "").includes("FileNotFound")) {
      return;
    }

    console.error("Failed to delete MongoDB document file", error);
  }
};

const deleteUploadedFile = async (value) => {
  const storedDocumentId = extractStudentDocumentId(value);
  if (!storedDocumentId) {
    return;
  }

  await deleteStudentDocumentById(storedDocumentId);
};

const getStudentDocumentReferences = (student = {}) =>
  [...new Set(
    [
      student.studentPhoto,
      student.birthCertificate,
      student.aadhaarCard,
      student.tcDocument,
      student.documents?.studentPhoto,
      student.documents?.birthCertificate,
      student.documents?.aadhaarCard,
      student.documents?.tcDocument,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )];

const studentDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_STUDENT_DOCUMENT_UPLOAD_BYTES,
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_STUDENT_DOCUMENT_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
      const mimeTypeError = new Error(
        "Unsupported file type. Please upload JPG, PNG, WEBP, GIF, or PDF."
      );
      mimeTypeError.statusCode = 400;
      callback(mimeTypeError);
      return;
    }

    callback(null, true);
  },
});

const bulkStudentExcelUpload = multer({
  storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, callback) => {
      const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      if (ext !== '.xlsx' && ext !== '.xls') {
        callback(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        return;
      }
    callback(null, true);
  },
});

const normalizeAdminSettings = (incoming = {}) => ({
  schoolName: String(
    incoming.schoolName || ADMIN_SETTINGS_DEFAULTS.schoolName
  ).trim(),
  schoolCode: String(
    incoming.schoolCode || ADMIN_SETTINGS_DEFAULTS.schoolCode
  ).trim(),
  academicSession: String(
    incoming.academicSession || ADMIN_SETTINGS_DEFAULTS.academicSession
  ).trim(),
  passwordMinLength: Math.min(
    32,
    Math.max(
      6,
      toNumber(incoming.passwordMinLength) || ADMIN_SETTINGS_DEFAULTS.passwordMinLength
      )
  ),
  enforceStrongPasswords: toBoolean(incoming.enforceStrongPasswords),
  forceLogoutOnPasswordReset: toBoolean(incoming.forceLogoutOnPasswordReset),
});

const buildDefaultAdminSettingsForSchool = (schoolName) =>
  normalizeAdminSettings({
    ...ADMIN_SETTINGS_DEFAULTS,
    schoolName: String(schoolName || DEFAULT_SCHOOL_NAME).trim() || DEFAULT_SCHOOL_NAME,
    schoolCode: buildSchoolCodeFromName(schoolName || DEFAULT_SCHOOL_NAME),
  });

const getPasswordPolicyMessage = (
  password,
  settings,
  options = { required: true, label: "Password" }
) => {
  const value = String(password || "");
  const required = options.required !== false;
  const label = options.label || "Password";

  if (!value) {
    return required ? `${label} is required.` : "";
  }

  const minLength = toNumber(settings?.passwordMinLength) || 6;
  if (value.length < minLength) {
    return `${label} must be at least ${minLength} characters long.`;
  }

  if (settings?.enforceStrongPasswords && !STRONG_PASSWORD_PATTERN.test(value)) {
    return `${label} must include upper, lower, number, and special characters.`;
  }

  return "";
};

const normalizeNoticeAudience = (value) => {
  const rawAudience = Array.isArray(value) ? value : [value];
  const normalized = [...new Set(
    rawAudience
      .map((entry) => String(entry || "").trim().toLowerCase())
      .filter(Boolean)
  )].filter((entry) => NOTICE_AUDIENCE_OPTIONS.includes(entry));

  return normalized.length ? normalized : ["all"];
};

const buildPolicyCompliantDefaultPassword = (basePassword, settings) => {
  const minLength = toNumber(settings?.passwordMinLength) || 6;
  const suffixLength = Math.max(0, minLength - String(basePassword).length);
  return `${basePassword}${"X".repeat(suffixLength)}`;
};

const getDefaultPasswordForRole = (role, settings) => {
  if (role === ROLE_PARENT) {
    return buildPolicyCompliantDefaultPassword("Parent@123", settings);
  }

  if (role === ROLE_STUDENT) {
    return buildPolicyCompliantDefaultPassword("Student@123", settings);
  }

  if (role === ROLE_TEACHER) {
    return buildPolicyCompliantDefaultPassword("Teacher@123", settings);
  }

  return buildPolicyCompliantDefaultPassword("User@123", settings);
};

const createMetaEntryId = (prefix = "meta") =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeEnquiryStage = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return ENQUIRY_DEFAULT_STAGE;
  }

  const normalizedKey = raw.toLowerCase();
  if (LEGACY_ENQUIRY_STAGE_MAP[normalizedKey]) {
    return LEGACY_ENQUIRY_STAGE_MAP[normalizedKey];
  }

  const matching = ENQUIRY_STAGE_OPTIONS.find(
    (entry) => entry.toLowerCase() === normalizedKey
  );
  return matching || ENQUIRY_DEFAULT_STAGE;
};

const normalizeEnquiryStatus = (value, fallbackStage = ENQUIRY_DEFAULT_STAGE) => {
  const raw = String(value || "").trim();
  const fallback = ENQUIRY_STAGE_TO_STATUS[fallbackStage] || ENQUIRY_DEFAULT_STAGE;
  if (!raw) {
    return fallback;
  }

  const normalizedKey = raw.toLowerCase();
  if (LEGACY_ENQUIRY_STAGE_MAP[normalizedKey]) {
    const mappedStage = LEGACY_ENQUIRY_STAGE_MAP[normalizedKey];
    return ENQUIRY_STAGE_TO_STATUS[mappedStage] || mappedStage;
  }

  const matching = ENQUIRY_STAGE_OPTIONS.find(
    (entry) => entry.toLowerCase() === normalizedKey
  );
  if (matching) {
    return ENQUIRY_STAGE_TO_STATUS[matching] || matching;
  }

  return fallback;
};

const normalizeEnquiryConversionStatus = (value, options = {}) => {
  const convertedStudentId = String(options.convertedStudentId || "").trim();
  if (convertedStudentId) {
    return "Converted";
  }

  const raw = String(value || "").trim();
  const normalizedKey = raw.toLowerCase();
  const matched = ENQUIRY_CONVERSION_STATUS_OPTIONS.find(
    (entry) => entry.toLowerCase() === normalizedKey
  );
  if (matched) {
    return matched;
  }

  const stage = normalizeEnquiryStage(options.stage || "");
  if (stage === "Converted") {
    return "Converted";
  }

  if (toBoolean(options.isConverted)) {
    return "In Progress";
  }

  return ENQUIRY_DEFAULT_CONVERSION_STATUS;
};

const isKnownEnquiryStageInput = (value) => {
  const key = String(value || "").trim().toLowerCase();
  if (!key) {
    return false;
  }

  if (LEGACY_ENQUIRY_STAGE_MAP[key]) {
    return true;
  }

  return ENQUIRY_STAGE_OPTIONS.some((entry) => entry.toLowerCase() === key);
};

const getAllowedEnquiryStageTransitions = (currentStage, options = {}) => {
  const normalizedCurrent = normalizeEnquiryStage(currentStage);
  const convertedStudentId = String(options.convertedStudentId || "").trim();

  if (convertedStudentId || normalizedCurrent === "Converted") {
    return [];
  }

  if (normalizedCurrent === "Rejected") {
    return ["Contacted"];
  }

  const currentIndex = ENQUIRY_PIPELINE_FLOW_STAGES.indexOf(normalizedCurrent);
  if (currentIndex < 0) {
    return [ENQUIRY_DEFAULT_STAGE];
  }

  const allowed = [];
  if (currentIndex > 0) {
    allowed.push(ENQUIRY_PIPELINE_FLOW_STAGES[currentIndex - 1]);
  }

  if (currentIndex < ENQUIRY_PIPELINE_FLOW_STAGES.length - 1) {
    allowed.push(ENQUIRY_PIPELINE_FLOW_STAGES[currentIndex + 1]);
  }

  // "Converted" is a terminal system stage and is set only after admission is completed.
  const filteredAllowed = allowed.filter((entry) => entry !== "Converted");
  filteredAllowed.push("Rejected");

  return [...new Set(filteredAllowed)];
};

const isValidEnquiryStageTransition = (currentStage, nextStage, options = {}) => {
  const normalizedNext = normalizeEnquiryStage(nextStage);
  return getAllowedEnquiryStageTransitions(currentStage, options).includes(normalizedNext);
};

const normalizeEnquiryNotes = (value, options = {}) => {
  const fallbackDate = String(options.fallbackDate || getTodayISO()).slice(0, 10);
  const defaultAuthor = String(options.defaultAuthor || "CRM").trim() || "CRM";

  const toNote = (entry, index) => {
    if (typeof entry === "string") {
      const text = entry.trim();
      if (!text) {
        return null;
      }

      return {
        id: createMetaEntryId(`note-${index}`),
        text,
        createdAt: fallbackDate,
        author: defaultAuthor,
      };
    }

    if (!entry || typeof entry !== "object") {
      return null;
    }

    const text = String(entry.text || entry.note || entry.message || "").trim();
    if (!text) {
      return null;
    }

    return {
      id: String(entry.id || createMetaEntryId(`note-${index}`)).trim(),
      text,
      createdAt: String(entry.createdAt || entry.date || fallbackDate).trim().slice(0, 10),
      author: String(entry.author || defaultAuthor).trim() || defaultAuthor,
    };
  };

  if (Array.isArray(value)) {
    return value
      .map((entry, index) => toNote(entry, index))
      .filter(Boolean);
  }

  const singleNote = toNote(value, 0);
  return singleNote ? [singleNote] : [];
};

const normalizeEnquiryActivity = (value, options = {}) => {
  const fallbackDate = String(options.fallbackDate || getTodayISO()).slice(0, 10);
  const defaultActor = String(options.defaultActor || "CRM").trim() || "CRM";

  const toActivity = (entry, index) => {
    if (typeof entry === "string") {
      const text = entry.trim();
      if (!text) {
        return null;
      }

      return {
        id: createMetaEntryId(`activity-${index}`),
        type: "note",
        text,
        createdAt: fallbackDate,
        actor: defaultActor,
      };
    }

    if (!entry || typeof entry !== "object") {
      return null;
    }

    const text = String(entry.text || entry.message || entry.label || "").trim();
    if (!text) {
      return null;
    }

    return {
      id: String(entry.id || createMetaEntryId(`activity-${index}`)).trim(),
      type: String(entry.type || "update").trim() || "update",
      text,
      createdAt: String(entry.createdAt || entry.date || fallbackDate).trim().slice(0, 10),
      actor: String(entry.actor || defaultActor).trim() || defaultActor,
    };
  };

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => toActivity(entry, index))
    .filter(Boolean);
};

const createEnquiryActivityEntry = (type, text, actor, createdAt = getTodayISO()) => ({
  id: createMetaEntryId("activity"),
  type: String(type || "update").trim() || "update",
  text: String(text || "").trim(),
  createdAt: String(createdAt || getTodayISO()).slice(0, 10),
  actor: String(actor || "CRM").trim() || "CRM",
});

const createEnquiryNoteEntry = (text, author, createdAt = getTodayISO()) => ({
  id: createMetaEntryId("note"),
  text: String(text || "").trim(),
  createdAt: String(createdAt || getTodayISO()).slice(0, 10),
  author: String(author || "CRM").trim() || "CRM",
});

const normalizeEnquiryRecord = (record = {}) => {
  const parentName = String(record.parentName || record.guardianName || "").trim();
  const assignedTo = String(record.assignedTo || record.owner || "").trim();
  const createdAt = String(record.createdAt || getTodayISO()).trim().slice(0, 10);
  const stage = normalizeEnquiryStage(record.stage || record.status);
  const status = normalizeEnquiryStatus(record.status, stage);
  const convertedStudentId = String(record.convertedStudentId || "").trim();
  const isConverted =
    Boolean(convertedStudentId) ||
    toBoolean(
      record.isConverted === undefined ? record.conversionStatus === "In Progress" : record.isConverted
    );
  const conversionStatus = normalizeEnquiryConversionStatus(record.conversionStatus, {
    convertedStudentId,
    stage,
    isConverted,
  });
  const notes = normalizeEnquiryNotes(record.notes, {
    fallbackDate: createdAt,
    defaultAuthor: assignedTo || "CRM",
  });
  const activity = normalizeEnquiryActivity(record.activity, {
    fallbackDate: createdAt,
    defaultActor: assignedTo || "CRM",
  });

  if (!activity.length) {
    activity.push(
      createEnquiryActivityEntry(
        "created",
        "Lead was created",
        assignedTo || "CRM",
        createdAt
      )
    );
  }

  return {
    ...record,
    parentName,
    guardianName: parentName,
    assignedTo,
    owner: assignedTo,
    stage,
    status,
    source: String(record.source || "Website").trim() || "Website",
    followUpDate: String(record.followUpDate || createdAt).trim().slice(0, 10),
    notes,
    activity,
    callHistory: Array.isArray(record.callHistory) ? record.callHistory : [],
    createdAt,
    lastUpdatedAt: String(record.lastUpdatedAt || createdAt).trim().slice(0, 10),
    convertedStudentId,
    isConverted,
    conversionStatus,
  };
};

const getFeeStatus = (due, paid = 0) => {
  const normalizedDue = toNumber(due);
  const normalizedPaid = toNumber(paid);

  if (normalizedDue <= 0) {
    return "Paid";
  }

  if (normalizedPaid > 0) {
    return "Partial";
  }

  return "Pending";
};

const getNextRecordId = (records, prefix) => {
  const highest = records.reduce((max, record) => {
    const value = Number(String(record.id || "").replace(prefix, ""));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);

  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
};

const getAdmissionSequenceFromValue = (admissionNumber) => {
  const value = String(admissionNumber || "").trim();
  const parsed = Number(value.match(/(\d+)$/)?.[1] || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNextAdmissionNumber = (students, excludedStudentId = "") => {
  const highestSequence = students.reduce((max, student) => {
    if (String(student.id || "") === String(excludedStudentId || "")) {
      return max;
    }

    return Math.max(max, getAdmissionSequenceFromValue(student.admissionNumber));
  }, 1000);

  return `AUTO-${highestSequence + 1}`;
};

const getRollNumberPrefix = (className) =>
  `${String(className || "").trim().replace(/\s+/g, "")}-`;

const getRollSequenceFromValue = (rollNumber, prefix) => {
  const value = String(rollNumber || "").trim();
  if (!value) {
    return 0;
  }

  if (value.toLowerCase().startsWith(prefix.toLowerCase())) {
    const parsed = Number(value.slice(prefix.length));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const fallback = Number(value.match(/-(\d+)$/)?.[1] || 0);
  return Number.isFinite(fallback) ? fallback : 0;
};

const getNextRollNumber = (students, className, excludedStudentId = "") => {
  const prefix = getRollNumberPrefix(className);
  const normalizedClass = String(className || "").trim().toLowerCase();

  const highestSequence = students.reduce((max, student) => {
    if (String(student.id || "") === String(excludedStudentId || "")) {
      return max;
    }

    const studentClass = String(student.className || "").trim().toLowerCase();
    if (studentClass !== normalizedClass) {
      return max;
    }

    return Math.max(max, getRollSequenceFromValue(student.rollNumber, prefix));
  }, 0);

  return `${prefix}${String(highestSequence + 1).padStart(2, "0")}`;
};

const normalizeAssignedClassValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "");

const formatAssignedClassLabel = (className) =>
  `${String(className || "").trim().replace(/\s+/g, "")}`;

const buildAssignedClassLookup = (classMasters = []) => {
  const lookup = new Map();

  classMasters.forEach((className) => {
    const label = formatAssignedClassLabel(className);
    lookup.set(normalizeAssignedClassValue(label), {
      className,
      label,
    });
  });

  return lookup;
};

const resolveAssignedClassEntry = (entry, lookup) =>
  lookup.get(normalizeAssignedClassValue(entry)) || null;

const resolveTeacherAssignedClasses = (classes, classMasters) => {
  const lookup = buildAssignedClassLookup(classMasters);
  const resolved = [];
  const invalid = [];

  normalizeClassList(classes).forEach((entry) => {
    const match = resolveAssignedClassEntry(entry, lookup);
    if (!match) {
      invalid.push(entry);
      return;
    }

    resolved.push(match.label);
  });

  return {
    classes: [...new Set(resolved)],
    invalid,
  };
};

const normalizeClassList = (classes) => {
  if (Array.isArray(classes)) {
    return classes.map((className) => String(className).trim()).filter(Boolean);
  }

  return String(classes || "")
    .split(",")
    .map((className) => className.trim())
    .filter(Boolean);
};

const normalizeSubjectList = (subjects) => {
  if (Array.isArray(subjects)) {
    return subjects.map((subject) => String(subject).trim()).filter(Boolean);
  }

  return String(subjects || "")
    .split(",")
    .map((subject) => subject.trim())
    .filter(Boolean);
};

const normalizeTeacherSubjects = (teacher = {}) =>
  [...new Set([...normalizeSubjectList(teacher.subjects), ...normalizeSubjectList(teacher.subject)])];

const getTeacherPrimarySubject = (teacher = {}) => normalizeTeacherSubjects(teacher)[0] || "";

const getClassScopeCandidates = (className) =>
  [...new Set(
    [formatAssignedClassLabel(className), className]
      .map((entry) => normalizeAssignedClassValue(entry))
      .filter(Boolean)
  )];

const buildTeacherClassScopeSet = (teacher, state) => {
  const lookup = buildAssignedClassLookup(state.classes);
  const scopeSet = new Set();

  normalizeClassList(teacher?.classes).forEach((entry) => {
    const normalizedEntry = normalizeAssignedClassValue(entry);
    if (normalizedEntry) {
      scopeSet.add(normalizedEntry);
    }

    const resolved = resolveAssignedClassEntry(entry, lookup);
    if (!resolved) {
      return;
    }

    scopeSet.add(normalizeAssignedClassValue(resolved.label));
    getClassScopeCandidates(resolved.className, resolved.section).forEach((candidate) =>
      scopeSet.add(candidate)
    );
  });

  return scopeSet;
};

const isStudentInTeacherClassScope = (student, classScopeSet) =>
  getClassScopeCandidates(student?.className).some((candidate) =>
    classScopeSet.has(candidate)
  );

const isStudentInClassScope = (student, className) => {
  const classKey = normalizeAssignedClassValue(className);
  if (!classKey) {
    return false;
  }

  return getClassScopeCandidates(student?.className).includes(classKey);
};

const normalizeTeacherRecord = (teacher) => {
  const subjects = normalizeTeacherSubjects(teacher);

  return {
    ...teacher,
    subject: subjects[0] || "",
    subjects,
    classes: normalizeClassList(teacher.classes),
  };
};

const normalizeMasterList = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  const entries = new Map();
  items.forEach((item) => {
    const label = String(item || "").trim();
    if (!label) {
      return;
    }

    entries.set(label.toLowerCase(), label);
  });

  return [...entries.values()].sort((first, second) => first.localeCompare(second));
};

const equalsIgnoreCase = (first, second) =>
  String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();

const hasMasterValue = (items, value) =>
  items.some((item) => equalsIgnoreCase(item, value));

const createUniqueEmail = (records, fallbackName, domain = "schoolcrm.com") => {
  const baseName = String(fallbackName || "user")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  const baseEmail = `${baseName || "user"}@${domain}`;
  const emails = new Set(
    records.map((record) => String(record.email || "").toLowerCase()).filter(Boolean)
  );

  if (!emails.has(baseEmail)) {
    return baseEmail;
  }

  let counter = 2;
  let candidate = `${baseName || "user"}.${counter}@${domain}`;

  while (emails.has(candidate)) {
    counter += 1;
    candidate = `${baseName || "user"}.${counter}@${domain}`;
  }

  return candidate;
};

const ensureRecordIds = (records, prefix) => {
  const used = new Set(
    records
      .map((record) => String(record?.id || "").trim())
      .filter(Boolean)
  );

  let counter = 1;

  return records.map((record) => {
    const currentId = String(record?.id || "").trim();
    if (currentId) {
      return {
        ...record,
        id: currentId,
      };
    }

    let nextId = "";
    do {
      nextId = `${prefix}${String(counter).padStart(3, "0")}`;
      counter += 1;
    } while (used.has(nextId));

    used.add(nextId);
    return {
      ...record,
      id: nextId,
    };
  });
};

const normalizeSchoolData = (incoming, options = {}) => {
  const seed = createInitialSchoolData();
  const schoolId = normalizeSchoolId(options.schoolId || incoming?.schoolId);

  if (!incoming || typeof incoming !== "object") {
    return {
      ...seed,
      ...(schoolId ? { schoolId } : {}),
    };
  }

  const users = ensureRecordIds(
    Array.isArray(incoming.users) ? incoming.users : seed.users,
    "U"
  );
  const teachers = ensureRecordIds(
    Array.isArray(incoming.teachers)
      ? incoming.teachers.map(normalizeTeacherRecord)
      : seed.teachers,
    "T"
  );
  const students = ensureRecordIds(
    Array.isArray(incoming.students) ? incoming.students : seed.students,
    "S"
  );
  const parents = ensureRecordIds(
    Array.isArray(incoming.parents) ? incoming.parents : seed.parents,
    "P"
  );
  const attendance = ensureRecordIds(
    Array.isArray(incoming.attendance) ? incoming.attendance : seed.attendance,
    "A"
  );
  const results = ensureRecordIds(
    Array.isArray(incoming.results) ? incoming.results : seed.results,
    "R"
  );
  const enquiries = ensureRecordIds(
    Array.isArray(incoming.enquiries) ? incoming.enquiries : seed.enquiries,
    "E"
  ).map((entry) => normalizeEnquiryRecord(entry));
  const notices = ensureRecordIds(
    Array.isArray(incoming.notices) ? incoming.notices : seed.notices,
    "N"
  );

  const subjects = normalizeMasterList([
    ...(incoming.subjects ?? seed.subjects),
    ...teachers.flatMap((teacher) => teacher.subjects || []),
  ]);

  const departments = normalizeMasterList([
    ...(incoming.departments ?? seed.departments),
    ...teachers.map((teacher) => teacher.department),
  ]);

  const classes = normalizeMasterList([
    ...(incoming.classes ?? seed.classes),
    ...students.map((student) => student.className),
  ]);

  return {
    ...seed,
    ...incoming,
    ...(schoolId ? { schoolId } : {}),
    version: SCHOOL_DATA_VERSION,
    users,
    classes,
    subjects,
    departments,
    teachers,
    students,
    parents,
    attendance,
    results,
    enquiries,
    notices,
  };
};

const hashPasswordIfNeeded = async (password) => {
  const raw = String(password || "");
  if (!raw) return "";
  if (isPasswordHash(raw)) return raw;
  return bcrypt.hash(raw, BCRYPT_ROUNDS);
};

const securePasswordCollection = async (records) => {
  const nextRecords = await Promise.all(
    records.map(async (record) => {
      if (!record || typeof record !== "object") {
        return record;
      }

      const password = await hashPasswordIfNeeded(record.password);
      return {
        ...record,
        password,
      };
    })
  );

  return nextRecords;
};

const secureStateAuthCollections = async (state) => ({
  ...state,
  users: await securePasswordCollection(state.users),
  teachers: await securePasswordCollection(state.teachers),
  students: await securePasswordCollection(state.students),
  parents: await securePasswordCollection(state.parents),
});

const stripMongoMeta = (record) => {
  if (!record || typeof record !== "object") {
    return record;
  }

  const { _id, __v, createdAt, updatedAt, ...plain } = record;
  return plain;
};

const sanitizeCollection = (records) =>
  records.map((record) => stripMongoMeta(record)).filter(Boolean);

const sortById = (records) =>
  [...records].sort((first, second) =>
    String(first?.id || "").localeCompare(String(second?.id || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );

const replaceCollection = async (Model, schoolId, records, keyField = "id") => {
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  if (!normalizedSchoolId) {
    throw createHttpError("School context is required for persistence.", 400);
  }

  const entryMap = new Map();

  sanitizeCollection(Array.isArray(records) ? records : []).forEach((record) => {
    const key = String(record?.[keyField] || "").trim();
    if (!key) {
      return;
    }

    entryMap.set(key, {
      ...record,
      schoolId: normalizedSchoolId,
      [keyField]: key,
    });
  });

  const entries = [...entryMap.values()];

  if (!entries.length) {
    await Model.deleteMany({ schoolId: normalizedSchoolId });
    return;
  }

  await Model.bulkWrite(
    entries.map((entry) => ({
      updateOne: {
        filter: { schoolId: normalizedSchoolId, [keyField]: entry[keyField] },
        update: { $set: entry },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  const keepKeys = entries.map((entry) => entry[keyField]);
  await Model.deleteMany({
    schoolId: normalizedSchoolId,
    [keyField]: { $nin: keepKeys },
  });
};

const replaceMasterCollection = async (Model, schoolId, values) => {
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  if (!normalizedSchoolId) {
    throw createHttpError("School context is required for persistence.", 400);
  }

  const names = normalizeMasterList(values).map((name) => ({
    schoolId: normalizedSchoolId,
    name,
  }));

  if (!names.length) {
    await Model.deleteMany({ schoolId: normalizedSchoolId });
    return;
  }

  await Model.bulkWrite(
    names.map((entry) => ({
      updateOne: {
        filter: { schoolId: normalizedSchoolId, name: entry.name },
        update: { $set: entry },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  await Model.deleteMany({
    schoolId: normalizedSchoolId,
    name: { $nin: names.map((entry) => entry.name) },
  });
};

const persistStateCollections = async (schoolId, state) => {
  await Promise.all([
    replaceCollection(User, schoolId, state.users, "id"),
    replaceCollection(Teacher, schoolId, state.teachers, "id"),
    replaceCollection(Student, schoolId, state.students, "id"),
    replaceCollection(Parent, schoolId, state.parents, "id"),
    replaceCollection(Attendance, schoolId, state.attendance, "id"),
    replaceCollection(Result, schoolId, state.results, "id"),
    replaceCollection(Enquiry, schoolId, state.enquiries, "id"),
    replaceCollection(Notice, schoolId, state.notices, "id"),
    replaceMasterCollection(ClassMaster, schoolId, state.classes),
    replaceMasterCollection(Subject, schoolId, state.subjects),
    replaceMasterCollection(Department, schoolId, state.departments),
  ]);
};

const readCollectionsState = async (schoolId) => {
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  if (!normalizedSchoolId) {
    throw createHttpError("School context is required for reads.", 400);
  }

  const [
    users,
    teachers,
    students,
    parents,
    attendance,
    results,
    enquiries,
    notices,
    classes,
    subjects,
    departments,
  ] = await Promise.all([
    User.find({ schoolId: normalizedSchoolId }).sort({ id: 1 }).lean(),
    Teacher.find({ schoolId: normalizedSchoolId }).sort({ id: 1 }).lean(),
    Student.find({ schoolId: normalizedSchoolId }).sort({ id: 1 }).lean(),
    Parent.find({ schoolId: normalizedSchoolId }).sort({ id: 1 }).lean(),
    Attendance.find({ schoolId: normalizedSchoolId }).sort({ id: 1 }).lean(),
    Result.find({ schoolId: normalizedSchoolId }).sort({ id: 1 }).lean(),
    Enquiry.find({ schoolId: normalizedSchoolId }).sort({ id: 1 }).lean(),
    Notice.find({ schoolId: normalizedSchoolId }).sort({ id: 1 }).lean(),
    ClassMaster.find({ schoolId: normalizedSchoolId }).sort({ name: 1 }).lean(),
    Subject.find({ schoolId: normalizedSchoolId }).sort({ name: 1 }).lean(),
    Department.find({ schoolId: normalizedSchoolId }).sort({ name: 1 }).lean(),
  ]);

  return normalizeSchoolData(
    {
      version: SCHOOL_DATA_VERSION,
      users: sortById(sanitizeCollection(users)),
      teachers: sortById(sanitizeCollection(teachers)),
      students: sortById(sanitizeCollection(students)),
      parents: sortById(sanitizeCollection(parents)),
      attendance: sortById(sanitizeCollection(attendance)),
      results: sortById(sanitizeCollection(results)),
      enquiries: sortById(sanitizeCollection(enquiries)),
      notices: sortById(sanitizeCollection(notices)),
      classes: classes.map((entry) => String(entry.name || "").trim()),
      sections: [],
      subjects: subjects.map((entry) => String(entry.name || "").trim()),
      departments: departments.map((entry) => String(entry.name || "").trim()),
    },
    { schoolId: normalizedSchoolId }
  );
};

const hasAnyCollectionData = async () => {
  const counts = await Promise.all([
    User.countDocuments({}),
    Teacher.countDocuments({}),
    Student.countDocuments({}),
    Parent.countDocuments({}),
    Attendance.countDocuments({}),
    Result.countDocuments({}),
    Enquiry.countDocuments({}),
    Notice.countDocuments({}),
    ClassMaster.countDocuments({}),
    Subject.countDocuments({}),
    Department.countDocuments({}),
    AdminSettings.countDocuments({}),
    Message.countDocuments({}),
  ]);

  return counts.some((count) => count > 0);
};

const isIndexKeyEqual = (first = {}, second = {}) => {
  const firstEntries = Object.entries(first || {});
  const secondEntries = Object.entries(second || {});

  if (firstEntries.length !== secondEntries.length) {
    return false;
  }

  return firstEntries.every(([key, value], index) => {
    const [otherKey, otherValue] = secondEntries[index] || [];
    return key === otherKey && value === otherValue;
  });
};

const dropUniqueIndexIfPresent = async (Model, keySpec) => {
  const indexes = await Model.collection.indexes().catch((error) => {
    if (error?.codeName === "NamespaceNotFound") {
      return [];
    }

    throw error;
  });
  const matching = indexes.find(
    (index) => index.unique && isIndexKeyEqual(index.key, keySpec)
  );

  if (!matching) {
    return;
  }

  try {
    await Model.collection.dropIndex(matching.name);
  } catch (error) {
    if (error?.codeName !== "IndexNotFound") {
      throw error;
    }
  }
};

const ensureScopedIndexes = async () => {
  const scopedIdModels = [User, Teacher, Student, Parent, Attendance, Result, Enquiry, Notice];
  const scopedMasterModels = [ClassMaster, Subject, Department];

  for (const Model of scopedIdModels) {
    await dropUniqueIndexIfPresent(Model, { id: 1 });
    await Model.collection.createIndex({ schoolId: 1, id: 1 }, { unique: true });
  }

  for (const Model of scopedMasterModels) {
    await dropUniqueIndexIfPresent(Model, { name: 1 });
    await Model.collection.createIndex({ schoolId: 1, name: 1 }, { unique: true });
  }

  await dropUniqueIndexIfPresent(AdminSettings, { key: 1 });
  await AdminSettings.collection.createIndex({ schoolId: 1, key: 1 }, { unique: true });
};

const hasMissingSchoolIdSelector = {
  $or: [{ schoolId: { $exists: false } }, { schoolId: null }, { schoolId: "" }],
};

const assignSchoolIdToExistingRecords = async (schoolId) => {
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  if (!normalizedSchoolId) {
    return;
  }

  await Promise.all([
    User.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    Teacher.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    Student.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    Parent.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    Attendance.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    Result.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    Enquiry.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    Notice.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    ClassMaster.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    Subject.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    Department.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
    AdminSettings.updateMany(hasMissingSchoolIdSelector, {
      $set: { schoolId: normalizedSchoolId },
    }),
    Message.updateMany(hasMissingSchoolIdSelector, { $set: { schoolId: normalizedSchoolId } }),
  ]);
};

const getOrCreateDefaultSchool = async () => {
  const existing = await School.findOne({ slug: DEFAULT_SCHOOL_SLUG }).lean();
  if (existing) {
    return existing;
  }

  const created = await School.findOneAndUpdate(
    { slug: DEFAULT_SCHOOL_SLUG },
    {
      $setOnInsert: {
        name: DEFAULT_SCHOOL_NAME,
        slug: DEFAULT_SCHOOL_SLUG,
        status: "Active",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return created;
};

const getSchoolByIdOrThrow = async (schoolId) => {
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  if (!normalizedSchoolId) {
    throw createHttpError("School context is required.", 400);
  }

  const school = await School.findById(normalizedSchoolId).lean();
  if (!school) {
    throw createHttpError("School not found.", 404);
  }

  return school;
};

const ensureSchoolAdminSettingsDefaults = async (schoolId, schoolName) => {
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  if (!normalizedSchoolId) {
    return;
  }

  const existing = await AdminSettings.findOne({
    schoolId: normalizedSchoolId,
    key: DEFAULT_STATE_KEY,
  }).lean();

  if (existing?.data) {
    return normalizeAdminSettings(existing.data);
  }

  const defaults = buildDefaultAdminSettingsForSchool(schoolName || DEFAULT_SCHOOL_NAME);
  await AdminSettings.updateOne(
    { schoolId: normalizedSchoolId, key: DEFAULT_STATE_KEY },
    {
      $set: {
        schoolId: normalizedSchoolId,
        key: DEFAULT_STATE_KEY,
        data: defaults,
      },
    },
    { upsert: true }
  );

  return defaults;
};

const cleanupLegacyStateDocument = async () => {
  const removed = await LegacySchoolState.deleteOne({ key: DEFAULT_STATE_KEY });
  if (!removed.deletedCount) {
    return;
  }

  const remaining = await LegacySchoolState.countDocuments({});
  if (remaining > 0) {
    return;
  }

  try {
    await LegacySchoolState.collection.drop();
  } catch (error) {
    // Ignore missing namespace when collection was already dropped elsewhere.
    if (error?.codeName !== "NamespaceNotFound") {
      throw error;
    }
  }
};

let storageBootstrapPromise;

const ensureStorageReady = async () => {
  if (storageBootstrapPromise) {
    return storageBootstrapPromise;
  }

  storageBootstrapPromise = (async () => {
    await ensureScopedIndexes();

    let firstSchool = await School.findOne({}).sort({ createdAt: 1 }).lean();
    const hasData = await hasAnyCollectionData();

    if (hasData) {
      if (!firstSchool) {
        firstSchool = await getOrCreateDefaultSchool();
      }

      const firstSchoolId = getSchoolIdFromDocument(firstSchool);
      await assignSchoolIdToExistingRecords(firstSchoolId);
      await ensureSchoolAdminSettingsDefaults(firstSchoolId, firstSchool?.name);
      await cleanupLegacyStateDocument();
      return;
    }

    const legacy = await LegacySchoolState.findOne({ key: DEFAULT_STATE_KEY }).lean();
    if (legacy?.data) {
      if (!firstSchool) {
        firstSchool = await getOrCreateDefaultSchool();
      }

      const firstSchoolId = getSchoolIdFromDocument(firstSchool);
      const migratedState = await secureStateAuthCollections(
        normalizeSchoolData(legacy.data, { schoolId: firstSchoolId })
      );
      await persistStateCollections(firstSchoolId, migratedState);
      await assignSchoolIdToExistingRecords(firstSchoolId);
      await ensureSchoolAdminSettingsDefaults(firstSchoolId, firstSchool?.name);
      await cleanupLegacyStateDocument();
      return;
    }

    if (firstSchool) {
      await ensureSchoolAdminSettingsDefaults(
        getSchoolIdFromDocument(firstSchool),
        firstSchool.name
      );
    }
  })().catch((error) => {
    storageBootstrapPromise = undefined;
    throw error;
  });

  return storageBootstrapPromise;
};

const readState = async (schoolId) => {
  await ensureStorageReady();
  const school = await getSchoolByIdOrThrow(schoolId);
  return readCollectionsState(getSchoolIdFromDocument(school));
};

const writeState = async (incomingState, schoolId = "") => {
  await ensureStorageReady();
  const resolvedSchoolId = normalizeSchoolId(schoolId || incomingState?.schoolId);
  const school = await getSchoolByIdOrThrow(resolvedSchoolId);
  const normalized = normalizeSchoolData(incomingState, {
    schoolId: getSchoolIdFromDocument(school),
  });
  const secured = await secureStateAuthCollections(normalized);
  await persistStateCollections(getSchoolIdFromDocument(school), secured);

  return normalizeSchoolData(secured, { schoolId: getSchoolIdFromDocument(school) });
};

const readAdminSettings = async (schoolId) => {
  await ensureStorageReady();
  const school = await getSchoolByIdOrThrow(schoolId);
  const resolvedSchoolId = getSchoolIdFromDocument(school);
  const existing = await AdminSettings.findOne({
    schoolId: resolvedSchoolId,
    key: DEFAULT_STATE_KEY,
  }).lean();

  if (existing?.data) {
    return normalizeAdminSettings(existing.data);
  }

  const defaults = buildDefaultAdminSettingsForSchool(school.name);
  await AdminSettings.updateOne(
    { schoolId: resolvedSchoolId, key: DEFAULT_STATE_KEY },
    {
      $set: {
        schoolId: resolvedSchoolId,
        key: DEFAULT_STATE_KEY,
        data: defaults,
      },
    },
    { upsert: true }
  );

  return defaults;
};

const writeAdminSettings = async (schoolId, incomingSettings) => {
  await ensureStorageReady();
  const school = await getSchoolByIdOrThrow(schoolId);
  const resolvedSchoolId = getSchoolIdFromDocument(school);
  const nextSettings = normalizeAdminSettings(incomingSettings);

  await AdminSettings.updateOne(
    { schoolId: resolvedSchoolId, key: DEFAULT_STATE_KEY },
    {
      $set: {
        schoolId: resolvedSchoolId,
        key: DEFAULT_STATE_KEY,
        data: nextSettings,
      },
    },
    { upsert: true }
  );

  return nextSettings;
};

const toSafeRecord = (record) => {
  if (!record || typeof record !== "object") {
    return record;
  }

  const { password, ...safe } = record;
  return safe;
};

const toSafeState = (state) => ({
  ...state,
  users: state.users.map(toSafeRecord),
  teachers: state.teachers.map(toSafeRecord),
  students: state.students.map(toSafeRecord),
  parents: state.parents.map(toSafeRecord),
});

const createScopedSeedState = (schoolId) => ({
  ...createInitialSchoolData(),
  version: SCHOOL_DATA_VERSION,
  ...(schoolId ? { schoolId } : {}),
});

const noticeMatchesRole = (notice, role) => {
  const audience = Array.isArray(notice?.audience) ? notice.audience : [];
  if (!audience.length) {
    return true;
  }

  return audience.includes(role) || audience.includes("all");
};

const getRoleScopedState = (state, auth) => {
  const safeState = normalizeSchoolData(state);
  const schoolId = normalizeSchoolId(safeState.schoolId || auth?.schoolId);
  const role = auth?.role;
  const email = String(auth?.email || "").toLowerCase();

  if (!role || role === ROLE_ADMIN || role === ROLE_CRM) {
    return toSafeState(safeState);
  }

  if (role === ROLE_TEACHER) {
    const teacher = safeState.teachers.find(
      (entry) => String(entry.email || "").toLowerCase() === email
    );

    const scoped = {
      ...createScopedSeedState(schoolId),
      teachers: teacher ? [teacher] : [],
      notices: safeState.notices.filter((notice) => noticeMatchesRole(notice, role)),
    };

    return toSafeState(scoped);
  }

  if (role === ROLE_STUDENT) {
    const student = safeState.students.find(
      (entry) => String(entry.email || "").toLowerCase() === email
    );

    if (!student) {
      return toSafeState({
        ...createScopedSeedState(schoolId),
      });
    }

    const attendance = safeState.attendance
      .filter((entry) =>
        entry.records?.some((record) => record.studentId === student.id)
      )
      .map((entry) => ({
        ...entry,
        records: entry.records.filter((record) => record.studentId === student.id),
      }));

    const results = safeState.results.filter(
      (entry) => entry.studentId === student.id
    );
    const teacherIds = new Set([
      ...results.map((entry) => entry.teacherId),
      ...attendance.map((entry) => entry.teacherId),
    ]);

    const scoped = {
      ...createScopedSeedState(schoolId),
      students: [student],
      teachers: safeState.teachers.filter((entry) => teacherIds.has(entry.id)),
      attendance,
      results,
      notices: safeState.notices.filter((notice) => noticeMatchesRole(notice, role)),
    };

    return toSafeState(scoped);
  }

  if (role === ROLE_PARENT) {
    const parent = safeState.parents.find(
      (entry) => String(entry.email || "").toLowerCase() === email
    );

    if (!parent) {
      return toSafeState({
        ...createScopedSeedState(schoolId),
      });
    }

    const child = safeState.students.find((entry) => entry.id === parent.studentId);

    if (!child) {
      return toSafeState({
        ...createScopedSeedState(schoolId),
        parents: [parent],
      });
    }

    const attendance = safeState.attendance
      .filter((entry) =>
        entry.records?.some((record) => record.studentId === child.id)
      )
      .map((entry) => ({
        ...entry,
        records: entry.records.filter((record) => record.studentId === child.id),
      }));

    const results = safeState.results.filter((entry) => entry.studentId === child.id);
    const teacherIds = new Set([
      ...results.map((entry) => entry.teacherId),
      ...attendance.map((entry) => entry.teacherId),
    ]);

    const scoped = {
      ...createScopedSeedState(schoolId),
      parents: [parent],
      students: [child],
      teachers: safeState.teachers.filter((entry) => teacherIds.has(entry.id)),
      attendance,
      results,
      notices: safeState.notices.filter((notice) => noticeMatchesRole(notice, role)),
    };

    return toSafeState(scoped);
  }

  return toSafeState({
    ...createScopedSeedState(schoolId),
  });
};

const mapLoginAccount = (record, role, source) => ({
  id: record.id,
  schoolId: normalizeSchoolId(record.schoolId),
  email: String(record.email || "").toLowerCase(),
  password: String(record.password || ""),
  name: record.name,
  role,
  status: String(record.status || "Active"),
  source,
  tokenInvalidBefore: toNumber(record.tokenInvalidBefore),
});

const getLoginUsers = (state) => {
  const safeState = normalizeSchoolData(state);

  return [
    ...safeState.users
      .filter((user) => user.role)
      .map((user) => mapLoginAccount(user, user.role, "users")),
    ...safeState.teachers.map((teacher) =>
      mapLoginAccount(teacher, ROLE_TEACHER, "teachers")
    ),
    ...safeState.students.map((student) =>
      mapLoginAccount(student, ROLE_STUDENT, "students")
    ),
    ...safeState.parents.map((parent) =>
      mapLoginAccount(parent, ROLE_PARENT, "parents")
    ),
  ].filter(
    (user) =>
      user.email &&
      user.password &&
      String(user.status || "").toLowerCase() !== INACTIVE_STATUS
  );
};

const buildAccountDirectory = (state) => {
  const normalized = normalizeSchoolData(state);

  const systemUsers = normalized.users
    .filter((entry) => SYSTEM_USER_ROLES.includes(entry.role))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      email: String(entry.email || "").toLowerCase(),
      role: entry.role,
      status: entry.status || "Active",
      source: "users",
    }));

  const teachers = normalized.teachers.map((entry) => ({
    id: entry.id,
    name: entry.name,
    email: String(entry.email || "").toLowerCase(),
    role: ROLE_TEACHER,
    status: entry.status || "Active",
    source: "teachers",
  }));

  const students = normalized.students.map((entry) => ({
    id: entry.id,
    name: entry.name,
    email: String(entry.email || "").toLowerCase(),
    role: ROLE_STUDENT,
    status: entry.status || "Active",
    source: "students",
  }));

  const parents = normalized.parents.map((entry) => ({
    id: entry.id,
    name: entry.name,
    email: String(entry.email || "").toLowerCase(),
    role: ROLE_PARENT,
    status: entry.status || "Active",
    source: "parents",
  }));

  return [...systemUsers, ...teachers, ...students, ...parents].sort((first, second) =>
    String(first.name || "").localeCompare(String(second.name || ""), undefined, {
      sensitivity: "base",
    })
  );
};

const findAccountByRoleAndEmail = (state, role, email) => {
  const lowered = String(email || "").toLowerCase();

  if (role === ROLE_TEACHER) {
    return state.teachers.find(
      (entry) => String(entry.email || "").toLowerCase() === lowered
    );
  }

  if (role === ROLE_STUDENT) {
    return state.students.find(
      (entry) => String(entry.email || "").toLowerCase() === lowered
    );
  }

  if (role === ROLE_PARENT) {
    return state.parents.find(
      (entry) => String(entry.email || "").toLowerCase() === lowered
    );
  }

  return state.users.find(
    (entry) =>
      String(entry.email || "").toLowerCase() === lowered &&
      String(entry.role || "") === String(role || "")
  );
};

const getAccountSourceByRole = (role) => {
  if (role === ROLE_TEACHER) return "teachers";
  if (role === ROLE_STUDENT) return "students";
  if (role === ROLE_PARENT) return "parents";
  if (SYSTEM_USER_ROLES.includes(role)) return "users";
  return "";
};

const findAccountByRoleAndId = (state, role, id) => {
  const source = getAccountSourceByRole(role);
  if (!source) {
    return null;
  }

  if (source === "users") {
    return (
      state.users.find(
        (entry) => entry.id === id && String(entry.role || "") === String(role || "")
      ) || null
    );
  }

  return state[source].find((entry) => entry.id === id) || null;
};

const findTeacherByAuth = (state, auth) => {
  const authId = String(auth?.id || "").trim();
  const authEmail = String(auth?.email || "").trim().toLowerCase();

  return (
    state.teachers.find(
      (entry) =>
        String(entry.id || "").trim() === authId ||
        String(entry.email || "").trim().toLowerCase() === authEmail
    ) || null
  );
};

const findParentByAuth = (state, auth) => {
  const authId = String(auth?.id || "").trim();
  const authEmail = String(auth?.email || "").trim().toLowerCase();

  return (
    state.parents.find(
      (entry) =>
        String(entry.id || "").trim() === authId ||
        String(entry.email || "").trim().toLowerCase() === authEmail
    ) || null
  );
};

const getBearerToken = (req) => {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
};

const buildRoleAccountLookupQuery = ({ email, id, schoolId }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedId = String(id || "").trim();
  const normalizedSchoolId = normalizeSchoolId(schoolId);

  const query = {};
  if (normalizedEmail) {
    query.email = normalizedEmail;
  }

  if (normalizedId) {
    query.id = normalizedId;
  }

  if (normalizedSchoolId) {
    query.schoolId = normalizedSchoolId;
  }

  return query;
};

const findRoleAccountDocument = async ({ role, email, id, schoolId }) => {
  const normalizedRole = String(role || "").trim();
  const query = buildRoleAccountLookupQuery({ email, id, schoolId });
  if (!normalizedRole || !Object.keys(query).length) {
    return null;
  }

  if (normalizedRole === ROLE_TEACHER) {
    return Teacher.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
  }

  if (normalizedRole === ROLE_STUDENT) {
    return Student.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
  }

  if (normalizedRole === ROLE_PARENT) {
    return Parent.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
  }

  if (SYSTEM_USER_ROLES.includes(normalizedRole)) {
    return User.findOne({ ...query, role: normalizedRole })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
  }

  return null;
};

const findLoginAccountsByEmail = async (email) => {
  await ensureStorageReady();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return [];
  }

  const [users, teachers, students, parents] = await Promise.all([
    User.find({ email: normalizedEmail, role: { $in: SYSTEM_USER_ROLES } }).lean(),
    Teacher.find({ email: normalizedEmail }).lean(),
    Student.find({ email: normalizedEmail }).lean(),
    Parent.find({ email: normalizedEmail }).lean(),
  ]);

  return [
    ...users.map((record) => mapLoginAccount(record, record.role, "users")),
    ...teachers.map((record) => mapLoginAccount(record, ROLE_TEACHER, "teachers")),
    ...students.map((record) => mapLoginAccount(record, ROLE_STUDENT, "students")),
    ...parents.map((record) => mapLoginAccount(record, ROLE_PARENT, "parents")),
  ].filter(
    (account) =>
      account.schoolId &&
      account.email &&
      account.password &&
      String(account.status || "").toLowerCase() !== INACTIVE_STATUS
  );
};

const isLoginEmailTaken = async (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const [userExists, teacherExists, studentExists, parentExists] = await Promise.all([
    User.exists({ email: normalizedEmail }),
    Teacher.exists({ email: normalizedEmail }),
    Student.exists({ email: normalizedEmail }),
    Parent.exists({ email: normalizedEmail }),
  ]);

  return Boolean(userExists || teacherExists || studentExists || parentExists);
};

const authenticate = asyncRoute(async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  const role = String(decoded.role || "");
  const email = String(decoded.email || "").toLowerCase();
  const decodedId = String(decoded.id || "").trim();
  const tokenSchoolId = normalizeSchoolId(decoded.schoolId);
  if (!role || !email || !decodedId) {
    return res.status(401).json({ message: "Invalid token payload." });
  }

  await ensureStorageReady();

  let accountDoc = await findRoleAccountDocument({
    role,
    email,
    id: decodedId,
    schoolId: tokenSchoolId,
  });

  if (!accountDoc && !tokenSchoolId) {
    accountDoc = await findRoleAccountDocument({
      role,
      email,
      id: decodedId,
    });
  }

  if (!accountDoc) {
    return res.status(401).json({ message: "Account not found for this token." });
  }

  const resolvedSchoolId = normalizeSchoolId(accountDoc.schoolId || tokenSchoolId);
  if (!resolvedSchoolId) {
    return res.status(401).json({ message: "Invalid token school context." });
  }

  if (tokenSchoolId && tokenSchoolId !== resolvedSchoolId) {
    return res.status(401).json({ message: "Invalid token school context." });
  }

  const state = await readState(resolvedSchoolId);
  const account =
    findAccountByRoleAndId(state, role, decodedId) ||
    findAccountByRoleAndEmail(state, role, email);

  if (!account) {
    return res.status(401).json({ message: "Account not found for this token." });
  }

  if (String(account.status || "").toLowerCase() === INACTIVE_STATUS) {
    return res.status(403).json({ message: "Your account is inactive." });
  }

  const tokenIssuedAtMs = toNumber(decoded.iat) * 1000;
  const tokenInvalidBefore = toNumber(account.tokenInvalidBefore);
  if (tokenInvalidBefore && tokenIssuedAtMs && tokenIssuedAtMs < tokenInvalidBefore) {
    return res.status(401).json({
      message: "Session expired after credential update. Please login again.",
    });
  }

  req.auth = {
    id: account.id,
    role,
    email: String(account.email || email).toLowerCase(),
    name: account.name,
    schoolId: resolvedSchoolId,
  };
  req.currentState = state;
  next();
});

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return res.status(403).json({ message: "You are not allowed to perform this action." });
  }

  next();
};

const getClientIp = (req) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((entry) => entry.trim())
    .find(Boolean);

  return (
    forwarded ||
    String(req.ip || req.socket?.remoteAddress || "").trim() ||
    "unknown"
  );
};

const normalizeRateLimitKey = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return normalized || "unknown";
};

const pruneRateLimitStore = (store, nowMs) => {
  for (const [key, value] of store.entries()) {
    if (toNumber(value?.resetAt) <= nowMs) {
      store.delete(key);
    }
  }
};

const createInMemoryRateLimiter = ({
  windowMs,
  max,
  keyGenerator,
  message,
  statusCode = 429,
}) => {
  const store = new Map();
  let requestCounter = 0;

  return (req, res, next) => {
    if (!RATE_LIMIT_ENABLED || windowMs <= 0 || max <= 0) {
      next();
      return;
    }

    const nowMs = Date.now();
    requestCounter += 1;

    if (requestCounter % 200 === 0 && store.size > max * 5) {
      pruneRateLimitStore(store, nowMs);
    }

    const key = normalizeRateLimitKey(
      keyGenerator ? keyGenerator(req) : getClientIp(req)
    );

    const existing = store.get(key);
    if (!existing || toNumber(existing.resetAt) <= nowMs) {
      store.set(key, {
        count: 1,
        resetAt: nowMs + windowMs,
      });
      next();
      return;
    }

    existing.count += 1;

    if (existing.count > max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((toNumber(existing.resetAt) - nowMs) / 1000)
      );
      res.set("Retry-After", String(retryAfterSeconds));
      res.status(statusCode).json({
        message: message || "Too many requests. Please try again later.",
      });
      return;
    }

    next();
  };
};

const getRateLimitActorKey = (req) =>
  req.auth?.id
    ? `${String(req.auth.role || "").toLowerCase()}:${normalizeSchoolId(
      req.auth.schoolId
    )}:${String(req.auth.id || "")}`
    : getClientIp(req);

const getStateFromRequest = async (req) =>
  req.currentState || readState(req.auth?.schoolId);

const updatePasswordBySource = async (state, source, id, nextPassword, options = {}) => {
  const tokenInvalidBefore = options.invalidateTokens ? Date.now() : undefined;
  const getUpdatedEntry = (entry) => {
    if (entry.id !== id) {
      return entry;
    }

    return {
      ...entry,
      password: nextPassword,
      ...(tokenInvalidBefore ? { tokenInvalidBefore } : {}),
    };
  };

  if (source === "users") {
    state.users = state.users.map(getUpdatedEntry);
  }

  if (source === "teachers") {
    state.teachers = state.teachers.map(getUpdatedEntry);
  }

  if (source === "students") {
    state.students = state.students.map(getUpdatedEntry);
  }

  if (source === "parents") {
    state.parents = state.parents.map(getUpdatedEntry);
  }

  return writeState(state, state.schoolId);
};

const normalizeStudentFee = (formData, existingStudent) => {
  const existingFee = existingStudent?.fee || {};
  const totalFees = toNumber(
    formData.totalFees ??
      formData.annualFee ??
      existingFee.totalFees ??
      existingFee.annualFee
  );
  const admissionFee = toNumber(formData.admissionFee ?? existingFee.admissionFee);
  const paidAmount = toNumber(
    formData.paidAmount ??
      formData.paid ??
      existingFee.paidAmount ??
      existingFee.paid
  );
  const pendingAmount = Math.max(totalFees - paidAmount, 0);
  const providedPaymentStatus = String(
    formData.paymentStatus ||
      formData.feeStatus ||
      existingFee.paymentStatus ||
      existingFee.status ||
      ""
  ).trim();
  const paymentStatus = providedPaymentStatus || getFeeStatus(pendingAmount, paidAmount);

  return {
    feeStructure: String(formData.feeStructure || existingFee.feeStructure || "").trim(),
    totalFees,
    annualFee: totalFees,
    admissionFee,
    paidAmount,
    paid: paidAmount,
    pendingAmount,
    due: pendingAmount,
    paymentStatus,
    status: paymentStatus,
    dueDate:
      String(formData.dueDate || "").trim() ||
      String(existingFee.dueDate || "").trim() ||
      getTodayISO(),
  };
};

const applyAttendanceDelta = (students, oldRecords = [], newRecords = []) =>
  students.map((student) => {
    const previous = oldRecords.find((record) => record.studentId === student.id);
    const next = newRecords.find((record) => record.studentId === student.id);

    if (!next) {
      return student;
    }

    const attendance = student.attendance || { present: 0, total: 0 };
    const wasPresent = previous?.status === "Present";
    const isPresent = next.status === "Present";
    const isNewRecord = !previous;

    return {
      ...student,
      attendance: {
        present:
          attendance.present +
          (isNewRecord && isPresent ? 1 : 0) +
          (!isNewRecord && wasPresent !== isPresent ? (isPresent ? 1 : -1) : 0),
        total: attendance.total + (isNewRecord ? 1 : 0),
      },
    };
  });

const buildTeacherDashboard = (teacher, state) => {
  const classNames = normalizeClassList(teacher.classes);
  const teacherSubjects = normalizeTeacherSubjects(teacher);
  const primarySubject = teacherSubjects[0] || "General";
  const assignedClassLookup = buildAssignedClassLookup(state.classes);
  const classRows = classNames.map((assignedClassLabel, index) => {
    const assignedClass = resolveAssignedClassEntry(assignedClassLabel, assignedClassLookup);
    const className = assignedClass?.className || assignedClassLabel;
    const totalStudents = state.students.filter((student) => {
      if (assignedClass) {
        return equalsIgnoreCase(student.className, assignedClass.className);
      }

      return equalsIgnoreCase(student.className, className);
    }).length;

    return {
      classId: `C${String(index + 1).padStart(3, "0")}`,
      name: assignedClass?.label || assignedClassLabel,
      className,
      standard: String(className).match(/\d+/)?.[0] || className,
      totalStudents,
    };
  });

  const isMatchForAssignedClass = (classRow, className) => {
    const normalizedClassName = normalizeAssignedClassValue(className);
    const normalizedLabel = normalizeAssignedClassValue(classRow.name);
    const normalizedRawClass = normalizeAssignedClassValue(classRow.className);

    return (
      normalizedClassName === normalizedLabel ||
      normalizedClassName === normalizedRawClass ||
      equalsIgnoreCase(className, classRow.className)
    );
  };

  const assignedStudents = state.students.filter((student) =>
    classRows.some((classRow) =>
      isMatchForAssignedClass(classRow, student.className)
    )
  );
  const assignedStudentIds = new Set(assignedStudents.map((student) => student.id));

  const teacherResults = state.results.filter(
    (result) => result.teacherId === teacher.id
  );
  const relevantResults = teacherResults.filter((result) =>
    assignedStudentIds.has(result.studentId)
  );

  const evaluatedStudentIds = new Set(
    relevantResults.map((result) => result.studentId)
  );

  const toResultPercent = (result) => {
    const maxMarks = toNumber(result?.maxMarks) || 100;
    const marks = toNumber(result?.marks);
    return Math.round((marks / maxMarks) * 100);
  };

  const calculateAttendancePercent = (student) => {
    const present = toNumber(student?.attendance?.present);
    const total = toNumber(student?.attendance?.total);
    if (!total) {
      return 0;
    }

    return Math.round((present / total) * 100);
  };

  const teacherAttendanceEntries = state.attendance
    .filter((entry) => {
      if (entry.teacherId === teacher.id) {
        return true;
      }

      return classRows.some((classRow) =>
        isMatchForAssignedClass(classRow, entry.className, entry.section)
      );
    })
    .sort((first, second) =>
      String(second.date || "").localeCompare(String(first.date || ""))
    );

  const toScheduleMinutes = (value) => {
    const match = String(value || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      return -1;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = String(match[3] || "").toUpperCase();
    const normalizedHours =
      (hours % 12) + (meridiem === "PM" ? 12 : 0);

    return normalizedHours * 60 + minutes;
  };

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayISO = getTodayISO();

  const todayAttendanceClasses = new Set(
    teacherAttendanceEntries
      .filter((entry) => String(entry.date || "") === todayISO)
      .map((entry) => normalizeAssignedClassValue(entry.className))
      .filter(Boolean)
  );

  const attendanceNotMarked = classRows.filter((classRow) => {
    const candidates = [
      classRow.name,
      classRow.className,
      formatAssignedClassLabel(classRow.className, classRow.section),
    ]
      .map((entry) => normalizeAssignedClassValue(entry))
      .filter(Boolean);

    return !candidates.some((candidate) => todayAttendanceClasses.has(candidate));
  }).length;

  const totalStudents = classRows.reduce(
    (count, classRow) => count + classRow.totalStudents,
    0
  );
  const totalAssignments = teacherResults.length;
  const pendingEvaluations = Math.max(
    assignedStudents.length - evaluatedStudentIds.size,
    0
  );
  const assignmentsToCheck = Math.max(
    Math.ceil((pendingEvaluations + totalAssignments * 0.2) / 2),
    0
  );
  const assignmentsDue = Math.max(
    Math.ceil((pendingEvaluations + attendanceNotMarked) / 2),
    0
  );

  const assignedStudentDirectory = assignedStudents.map((student) => {
    const matchingClass = classRows.find((classRow) =>
      isMatchForAssignedClass(classRow, student.className, student.section)
    );

    return {
      id: student.id,
      name: student.name,
      className: student.className,
      section: student.section || "",
      rollNumber: student.rollNumber || "",
      assignedClass:
        matchingClass?.name ||
        formatAssignedClassLabel(student.className, student.section),
      attendance: student.attendance || { present: 0, total: 0 },
    };
  });

  const studentPerformance = new Map();

  relevantResults.forEach((result) => {
    const percent = toResultPercent(result);
    const current = studentPerformance.get(result.studentId) || {
      scoreTotal: 0,
      count: 0,
    };

    studentPerformance.set(result.studentId, {
      scoreTotal: current.scoreTotal + percent,
      count: current.count + 1,
    });
  });

  const insightRows = assignedStudents.map((student) => {
    const performance = studentPerformance.get(student.id);
    const averageMarks = performance?.count
      ? Math.round(performance.scoreTotal / performance.count)
      : 0;

    return {
      studentId: student.id,
      name: student.name,
      className: student.className,
      section: student.section || "-",
      attendancePercent: calculateAttendancePercent(student),
      averageMarks,
    };
  });

  const topPerformers = [...insightRows]
    .filter((row) => row.averageMarks > 0)
    .sort((first, second) => second.averageMarks - first.averageMarks)
    .slice(0, 4);

  const lowAttendanceStudents = [...insightRows]
    .filter((row) => row.attendancePercent < 75)
    .sort((first, second) => first.attendancePercent - second.attendancePercent)
    .slice(0, 4);

  const weakStudents = [...insightRows]
    .filter((row) => row.averageMarks > 0 && row.averageMarks < 45)
    .sort((first, second) => first.averageMarks - second.averageMarks)
    .slice(0, 4);

  const classPerformance = classRows.map((classRow) => {
    const classStudents = assignedStudents.filter((student) =>
      isMatchForAssignedClass(classRow, student.className, student.section)
    );
    const classStudentIds = new Set(classStudents.map((student) => student.id));
    const classResults = relevantResults.filter((result) =>
      classStudentIds.has(result.studentId)
    );

    const averageMarks = classResults.length
      ? Math.round(
          classResults.reduce((sum, result) => sum + toResultPercent(result), 0) /
            classResults.length
        )
      : 0;

    const attendanceSummary = teacherAttendanceEntries
      .filter((entry) =>
        isMatchForAssignedClass(classRow, entry.className, entry.section)
      )
      .reduce(
        (summary, entry) => {
          const present = (entry.records || []).filter(
            (record) => String(record.status || "") === "Present"
          ).length;
          const total = (entry.records || []).length;

          return {
            present: summary.present + present,
            total: summary.total + total,
          };
        },
        { present: 0, total: 0 }
      );

    const attendancePercent = attendanceSummary.total
      ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
      : 0;

    return {
      className: classRow.name,
      averageMarks,
      attendancePercent,
      isOnTrack: averageMarks >= 60 && attendancePercent >= 75,
    };
  });

  const classAverageMarks = relevantResults.length
    ? Math.round(
        relevantResults.reduce((sum, result) => sum + toResultPercent(result), 0) /
          relevantResults.length
      )
    : 0;

  const attendanceTotals = teacherAttendanceEntries.reduce(
    (summary, entry) => {
      const present = (entry.records || []).filter(
        (record) => String(record.status || "") === "Present"
      ).length;
      const total = (entry.records || []).length;

      return {
        present: summary.present + present,
        total: summary.total + total,
      };
    },
    { present: 0, total: 0 }
  );

  const attendancePercent = attendanceTotals.total
    ? Math.round((attendanceTotals.present / attendanceTotals.total) * 100)
    : 0;

  const scheduleTimes = ["09:00 AM", "10:30 AM", "12:00 PM", "02:00 PM", "03:30 PM"];
  const scheduleDurationMinutes = 70;
  const scheduleRows = classRows.slice(0, 5).map((classRow, index) => {
    const time = scheduleTimes[index] || "03:30 PM";
    const startMinutes = toScheduleMinutes(time);
    const isCurrentClass =
      startMinutes >= 0 &&
      nowMinutes >= startMinutes &&
      nowMinutes < startMinutes + scheduleDurationMinutes;

    return {
      time,
      className: classRow.name,
      subject: primarySubject,
      room: `20${index + 1}`,
      isCurrentClass,
    };
  });

  const toRelativeTimeLabel = (value) => {
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

  const activityItems = [];

  teacherAttendanceEntries.slice(0, 2).forEach((entry, index) => {
    const timestamp = entry.date
      ? new Date(`${entry.date}T${String(9 + index * 2).padStart(2, "0")}:00:00`).toISOString()
      : new Date(Date.now() - (index + 1) * 7200000).toISOString();

    activityItems.push({
      id: `attendance-${entry.id || index}`,
      type: "attendance",
      status: "completed",
      activity: `Attendance submitted for ${entry.className || classRows[0]?.name || "assigned class"}`,
      timestamp,
    });
  });

  relevantResults.slice(0, 2).forEach((result, index) => {
    const student = assignedStudents.find((entry) => entry.id === result.studentId);
    const timestamp = result.publishedDate
      ? new Date(`${result.publishedDate}T${String(11 + index).padStart(2, "0")}:00:00`).toISOString()
      : new Date(Date.now() - (index + 2) * 10800000).toISOString();

    activityItems.push({
      id: `result-${result.id || index}`,
      type: "marks",
      status: "completed",
      activity: `Marks uploaded for ${student?.name || "student"} (${result.exam || "assessment"})`,
      timestamp,
    });
  });

  if (!activityItems.length) {
    activityItems.push(
      {
        id: "fallback-attendance",
        type: "attendance",
        status: "completed",
        activity: `Submitted attendance for ${classRows[0]?.name || "assigned class"}`,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: "fallback-assignment",
        type: "assignment",
        status: "completed",
        activity: "Created weekly assignment plan",
        timestamp: new Date(Date.now() - 21600000).toISOString(),
      }
    );
  }

  const recentActivity = activityItems
    .sort((first, second) =>
      String(second.timestamp || "").localeCompare(String(first.timestamp || ""))
    )
    .slice(0, 6)
    .map((item) => ({
      ...item,
      date: String(item.timestamp || "").slice(0, 10),
      timeAgo: toRelativeTimeLabel(item.timestamp),
    }));

  const notices = Array.isArray(state.notices) ? state.notices : [];

  const adminNotices = notices
    .filter((notice) => noticeMatchesRole(notice, ROLE_TEACHER))
    .slice(0, 3)
    .map((notice, index) => {
      const baseDate = String(
        notice.updatedAt || notice.date || notice.createdAt || todayISO
      ).trim();
      const timestamp = new Date(
        `${baseDate}T${String(8 + index).padStart(2, "0")}:00:00`
      ).toISOString();

      return {
        id: `notice-${notice.id || index}`,
        type: notice.type === "assignment" ? "assignment" : "admin",
        source: notice.type === "assignment" ? "Assignments" : "Admin",
        title: notice.title || "School notice",
        message: notice.message || "New update available.",
        timestamp,
      };
    });

  const assignmentNotices = classRows.slice(0, Math.max(Math.min(assignmentsDue, 2), 1)).map(
    (classRow, index) => ({
      id: `assignment-${classRow.classId}`,
      type: "assignment",
      source: "Assignments",
      title: `Assignment due: ${classRow.name}`,
      message: `Collect submissions from ${classRow.totalStudents} students and publish remarks.`,
      timestamp: new Date(Date.now() - (index + 1) * 5400000).toISOString(),
    })
  );

  const studentMessageNotices = [...lowAttendanceStudents, ...weakStudents]
    .slice(0, 2)
    .map((student, index) => ({
      id: `student-message-${student.studentId}-${index}`,
      type: "message",
      source: "Students",
      title: `Student follow-up: ${student.name}`,
      message:
        student.attendancePercent < 75
          ? `Attendance dropped to ${student.attendancePercent}%. Parent interaction recommended.`
          : `Performance is ${student.averageMarks}%. Suggest extra practice support.`,
      timestamp: new Date(Date.now() - (index + 1) * 3600000).toISOString(),
    }));

  const notifications = [
    ...assignmentNotices,
    ...adminNotices,
    ...studentMessageNotices,
  ]
    .sort((first, second) =>
      String(second.timestamp || "").localeCompare(String(first.timestamp || ""))
    )
    .slice(0, 6)
    .map((item) => ({
      ...item,
      date: String(item.timestamp || "").slice(0, 10),
      timeAgo: toRelativeTimeLabel(item.timestamp),
    }));

  return {
    teacherId: teacher.id,
    name: teacher.name,
    email: teacher.email,
    subject: primarySubject,
    subjects: teacherSubjects,
    department: teacher.department,
    phone: teacher.phone,
    joiningDate: teacher.joiningDate,
    assignedClasses: classRows,
    assignedStudents: assignedStudentDirectory,
    totalStudents,
    totalAssignments,
    pendingEvaluations,
    assignmentsDue,
    upcomingClasses: scheduleRows,
    pendingWork: {
      pendingEvaluations,
      assignmentsToCheck,
      attendanceNotMarked,
      total: pendingEvaluations + assignmentsToCheck + attendanceNotMarked,
    },
    studentInsights: {
      topPerformers,
      lowAttendanceStudents,
      weakStudents,
    },
    recentActivity,
    notifications,
    performanceSummary: {
      classAverageMarks,
      attendancePercent,
      classesOnTrack: classPerformance.filter((row) => row.isOnTrack).length,
      totalClasses: classPerformance.length,
    },
  };
};

const buildStudentDashboard = (student, state) => {
  const todayISO = getTodayISO();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const toResultPercent = (result) => {
    const maxMarks = toNumber(result?.maxMarks) || 100;
    const marks = toNumber(result?.marks);
    return Math.round((marks / maxMarks) * 100);
  };

  const toScheduleMinutes = (value) => {
    const match = String(value || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      return -1;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = String(match[3] || "").toUpperCase();
    const normalizedHours = (hours % 12) + (meridiem === "PM" ? 12 : 0);

    return normalizedHours * 60 + minutes;
  };

  const getRelativeTimeLabel = (value) => {
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

  const studentClassCandidates = [
    formatAssignedClassLabel(student.className, student.section),
    student.className,
  ]
    .map((entry) => normalizeAssignedClassValue(entry))
    .filter(Boolean);

  const studentAttendanceEntries = (Array.isArray(state.attendance)
    ? state.attendance
    : []
  )
    .filter((entry) =>
      (Array.isArray(entry.records) ? entry.records : []).some(
        (record) => String(record.studentId || "") === String(student.id)
      )
    )
    .sort((first, second) =>
      String(second.date || "").localeCompare(String(first.date || ""))
    )
    .map((entry) => {
      const matchingRecord = (Array.isArray(entry.records) ? entry.records : []).find(
        (record) => String(record.studentId || "") === String(student.id)
      );

      return {
        id: entry.id,
        className: entry.className,
        section: entry.section,
        subject: entry.subject,
        date: entry.date,
        teacherId: entry.teacherId,
        status: String(matchingRecord?.status || "Present"),
      };
    });

  const studentResults = (Array.isArray(state.results) ? state.results : [])
    .filter((entry) => String(entry.studentId || "") === String(student.id))
    .sort((first, second) =>
      String(second.publishedDate || "").localeCompare(String(first.publishedDate || ""))
    );

  const teacherDirectory = new Map(
    (Array.isArray(state.teachers) ? state.teachers : []).map((entry) => [entry.id, entry.name])
  );

  const resultRows = studentResults.map((result) => ({
    ...result,
    teacherName: teacherDirectory.get(result.teacherId) || "Faculty",
    percent: toResultPercent(result),
  }));

  const subjectPerformanceMap = new Map();
  resultRows.forEach((result) => {
    const subject = String(result.subject || "General").trim() || "General";
    const current = subjectPerformanceMap.get(subject) || {
      scoreTotal: 0,
      count: 0,
    };

    subjectPerformanceMap.set(subject, {
      scoreTotal: current.scoreTotal + toResultPercent(result),
      count: current.count + 1,
    });
  });

  const subjectWisePerformance = [...subjectPerformanceMap.entries()]
    .map(([subject, summary]) => ({
      subject,
      averageMarks: summary.count
        ? Math.round(summary.scoreTotal / summary.count)
        : 0,
      examCount: summary.count,
    }))
    .sort((first, second) => second.averageMarks - first.averageMarks);

  const bestSubject = subjectWisePerformance[0] || null;
  const weakSubject =
    [...subjectWisePerformance]
      .sort((first, second) => first.averageMarks - second.averageMarks)[0] || null;

  const averageMarks = resultRows.length
    ? Math.round(
        resultRows.reduce((sum, entry) => sum + toResultPercent(entry), 0) /
          resultRows.length
      )
    : 0;

  const attendancePresent = toNumber(student?.attendance?.present);
  const attendanceTotal = toNumber(student?.attendance?.total);
  const attendancePercent = attendanceTotal
    ? Math.round((attendancePresent / attendanceTotal) * 100)
    : 0;

  const monthlyAttendanceBuckets = new Map();
  studentAttendanceEntries.forEach((entry) => {
    const date = String(entry.date || "");
    const monthKey = /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "";
    if (!monthKey) {
      return;
    }

    const current = monthlyAttendanceBuckets.get(monthKey) || { present: 0, total: 0 };
    const isPresent = String(entry.status || "").toLowerCase() === "present";

    monthlyAttendanceBuckets.set(monthKey, {
      present: current.present + (isPresent ? 1 : 0),
      total: current.total + 1,
    });
  });

  const monthlyAttendance = [...monthlyAttendanceBuckets.entries()]
    .sort((first, second) => first[0].localeCompare(second[0]))
    .slice(-6)
    .map(([month, summary]) => ({
      month,
      present: summary.present,
      total: summary.total,
      percent: summary.total
        ? Math.round((summary.present / summary.total) * 100)
        : 0,
    }));

  const classmates = (Array.isArray(state.students) ? state.students : []).filter(
    (entry) =>
      equalsIgnoreCase(entry.className, student.className) &&
      equalsIgnoreCase(entry.section, student.section)
  );
  const classmateIds = new Set(classmates.map((entry) => String(entry.id)));

  const classPerformanceMap = new Map();
  (Array.isArray(state.results) ? state.results : []).forEach((entry) => {
    if (!classmateIds.has(String(entry.studentId || ""))) {
      return;
    }

    const current = classPerformanceMap.get(entry.studentId) || {
      scoreTotal: 0,
      count: 0,
    };

    classPerformanceMap.set(entry.studentId, {
      scoreTotal: current.scoreTotal + toResultPercent(entry),
      count: current.count + 1,
    });
  });

  const classRanking = classmates
    .map((entry) => {
      const summary = classPerformanceMap.get(entry.id);
      const score = summary?.count
        ? Math.round(summary.scoreTotal / summary.count)
        : 0;

      return {
        studentId: entry.id,
        score,
        name: entry.name,
      };
    })
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return String(first.name || "").localeCompare(String(second.name || ""));
    });

  const classRankIndex = classRanking.findIndex(
    (entry) => String(entry.studentId) === String(student.id)
  );
  const classRank = classRankIndex >= 0 ? classRankIndex + 1 : null;
  const classSize = classmates.length;

  const annualFee = toNumber(student?.fee?.annualFee);
  const paidFee = toNumber(student?.fee?.paid);
  const derivedDue = Math.max(annualFee - paidFee, 0);
  const dueFee = Math.max(toNumber(student?.fee?.due) || derivedDue, 0);
  const feeStatus = student?.fee?.status || getFeeStatus(dueFee, paidFee);
  const feeProgressPercent = annualFee
    ? Math.max(Math.min(Math.round((paidFee / annualFee) * 100), 100), 0)
    : dueFee <= 0
      ? 100
      : 0;

  const feePaymentHistory = Array.isArray(student?.fee?.paymentHistory)
    ? student.fee.paymentHistory
        .map((entry, index) => ({
          id: String(entry?.id || `payment-${index}`),
          date: String(entry?.date || todayISO).trim().slice(0, 10),
          amount: toNumber(entry?.amount),
          method: String(entry?.method || "Recorded").trim() || "Recorded",
          status: String(entry?.status || "Paid").trim() || "Paid",
          reference: String(entry?.reference || "").trim(),
        }))
        .filter((entry) => entry.amount > 0)
    : [];

  if (!feePaymentHistory.length && paidFee > 0) {
    feePaymentHistory.push({
      id: "payment-initial",
      date: todayISO,
      amount: paidFee,
      method: "Recorded",
      status: "Paid",
      reference: `PMT-${student.id}`,
    });
  }

  feePaymentHistory.sort((first, second) =>
    String(second.date || "").localeCompare(String(first.date || ""))
  );

  const studentNotices = (Array.isArray(state.notices) ? state.notices : [])
    .filter((notice) => noticeMatchesRole(notice, ROLE_STUDENT))
    .filter((notice) => {
      const className = String(notice.className || notice.metadata?.className || "").trim();
      if (!className) {
        return true;
      }

      const normalizedClassName = normalizeAssignedClassValue(className);
      if (studentClassCandidates.includes(normalizedClassName)) {
        return true;
      }

      const noticeSection = String(notice.section || notice.metadata?.section || "").trim();
      if (noticeSection && !equalsIgnoreCase(noticeSection, student.section)) {
        return false;
      }

      return equalsIgnoreCase(className, student.className);
    })
    .sort((first, second) => {
      const firstDate = String(
        first.updatedAt || first.date || first.createdAt || todayISO
      );
      const secondDate = String(
        second.updatedAt || second.date || second.createdAt || todayISO
      );
      return secondDate.localeCompare(firstDate);
    });

  const noticeRows = studentNotices.slice(0, 10).map((notice, index) => {
    const rawDate = String(
      notice.updatedAt || notice.date || notice.createdAt || todayISO
    ).trim();
    const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate)
      ? rawDate.slice(0, 10)
      : todayISO;
    const timestamp = new Date(`${date}T${String(8 + (index % 8)).padStart(2, "0")}:00:00`).toISOString();
    const ageMs = Math.max(Date.now() - new Date(`${date}T00:00:00`).getTime(), 0);

    return {
      id: notice.id || `notice-${index}`,
      type: String(notice.type || notice.metadata?.type || "notice").toLowerCase(),
      title: notice.title || "School notice",
      message: notice.message || "New update available.",
      date,
      timeAgo: getRelativeTimeLabel(timestamp),
      isNew: ageMs <= 3 * 24 * 60 * 60 * 1000,
      metadata: notice.metadata || {},
    };
  });

  const assignmentRows = noticeRows
    .filter((notice) => notice.type === "assignment")
    .map((notice, index) => {
      const dueDate = String(
        notice.metadata?.dueDate || notice.metadata?.date || notice.date || todayISO
      )
        .trim()
        .slice(0, 10);
      const submittedStudentIds = Array.isArray(notice.metadata?.submittedStudentIds)
        ? notice.metadata.submittedStudentIds.map((entry) => String(entry))
        : [];

      const isSubmitted = submittedStudentIds.includes(String(student.id));
      const isOverdue = !isSubmitted && dueDate < todayISO;

      return {
        id: notice.id || `assignment-${index}`,
        title: notice.title,
        description: notice.message,
        className:
          notice.metadata?.className ||
          formatAssignedClassLabel(student.className, student.section),
        subject: notice.metadata?.subject || "General",
        dueDate,
        status: isSubmitted ? "Submitted" : isOverdue ? "Overdue" : "Pending",
      };
    })
    .sort((first, second) => String(first.dueDate || "").localeCompare(String(second.dueDate || "")));

  const classTeachers = (Array.isArray(state.teachers) ? state.teachers : []).filter(
    (teacher) =>
      normalizeClassList(teacher.classes).some((entry) =>
        studentClassCandidates.includes(normalizeAssignedClassValue(entry))
      )
  );

  const fallbackSubjects = subjectWisePerformance.length
    ? subjectWisePerformance.map((entry) => entry.subject)
    : ["Mathematics", "Science"];

  const scheduleSubjects = [
    ...new Set([
      ...classTeachers.flatMap((teacher) => normalizeTeacherSubjects(teacher)),
      ...fallbackSubjects,
    ]),
  ]
    .filter(Boolean)
    .slice(0, 5);

  const scheduleTimes = ["09:00 AM", "10:30 AM", "12:00 PM", "02:00 PM", "03:30 PM"];
  const scheduleDurationMinutes = 70;

  const scheduleRows = scheduleSubjects.map((subject, index) => {
    const time = scheduleTimes[index] || "03:30 PM";
    const startMinutes = toScheduleMinutes(time);
    const isCurrentClass =
      startMinutes >= 0 &&
      nowMinutes >= startMinutes &&
      nowMinutes < startMinutes + scheduleDurationMinutes;

    const subjectTeacher = classTeachers.find((teacher) =>
      normalizeTeacherSubjects(teacher).some((entry) => equalsIgnoreCase(entry, subject))
    );

    return {
      id: `schedule-${index}`,
      time,
      subject,
      teacherName: subjectTeacher?.name || "Faculty",
      room: `10${index + 1}`,
      isCurrentClass,
    };
  });

  const badges = [];
  if (classRank === 1 && classSize > 1) {
    badges.push({ id: "rank1", label: "Class Rank #1" });
  }
  if (averageMarks >= 85) {
    badges.push({ id: "top", label: "Top Performer" });
  }
  if (attendancePercent >= 95) {
    badges.push({ id: "attendance", label: "Perfect Attendance" });
  }
  if (dueFee <= 0) {
    badges.push({ id: "fees", label: "Fee Cleared" });
  }
  if (!badges.length) {
    badges.push({ id: "consistent", label: "Consistent Learner" });
  }

  return {
    studentId: student.id,
    name: student.name,
    email: student.email,
    className: student.className,
    section: student.section,
    rollNumber: student.rollNumber,
    attendance: {
      percent: attendancePercent,
      present: attendancePresent,
      total: attendanceTotal,
      monthly: monthlyAttendance,
      log: studentAttendanceEntries,
    },
    performance: {
      averageMarks,
      subjectWise: subjectWisePerformance,
      bestSubject,
      weakSubject,
      classRank,
      classSize,
      badges,
    },
    fees: {
      annualFee,
      paid: paidFee,
      due: dueFee,
      dueDate: student?.fee?.dueDate || "",
      status: feeStatus,
      progressPercent: feeProgressPercent,
      paymentHistory: feePaymentHistory,
    },
    schedule: scheduleRows,
    assignments: assignmentRows,
    notices: noticeRows,
    results: resultRows,
    quickStats: {
      notifications: noticeRows.length,
      pendingAssignments: assignmentRows.filter((entry) => entry.status === "Pending").length,
    },
  };
};

const authSetupIpRateLimiter = createInMemoryRateLimiter({
  windowMs: AUTH_SETUP_RATE_LIMIT_WINDOW_MS,
  max: AUTH_SETUP_RATE_LIMIT_MAX_PER_IP,
  keyGenerator: (req) => `setup-admin:${getClientIp(req)}`,
  message: "Too many admin setup attempts. Please try again later.",
});

const authLoginIpRateLimiter = createInMemoryRateLimiter({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX_PER_IP,
  keyGenerator: (req) => `login-ip:${getClientIp(req)}`,
  message: "Too many login attempts from this network. Please try again later.",
});

const authLoginIdentityRateLimiter = createInMemoryRateLimiter({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX_PER_IDENTITY,
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `login-identity:${getClientIp(req)}:${email || "unknown"}`;
  },
  message: "Too many login attempts for this account. Please try again later.",
});

const dashboardReadRateLimiter = createInMemoryRateLimiter({
  windowMs: DASHBOARD_RATE_LIMIT_WINDOW_MS,
  max: DASHBOARD_RATE_LIMIT_MAX,
  keyGenerator: (req) => `dashboard:${getRateLimitActorKey(req)}`,
  message: "Too many dashboard requests. Please slow down and retry.",
});

const parentMessageWriteRateLimiter = createInMemoryRateLimiter({
  windowMs: MESSAGE_WRITE_RATE_LIMIT_WINDOW_MS,
  max: MESSAGE_WRITE_RATE_LIMIT_MAX,
  keyGenerator: (req) => `messages-write:${getRateLimitActorKey(req)}`,
  message: "Too many messages sent in a short time. Please wait and retry.",
});

const parentMessageReadRateLimiter = createInMemoryRateLimiter({
  windowMs: MESSAGE_READ_RATE_LIMIT_WINDOW_MS,
  max: MESSAGE_READ_RATE_LIMIT_MAX,
  keyGenerator: (req) => `messages-read:${getRateLimitActorKey(req)}`,
  message: "Too many message fetch requests. Please wait and retry.",
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, mongo: mongoose.connection.readyState === 1 });
});

app.get(
  "/api/uploads/student-document/:fileId/:fileName?",
  asyncRoute(async (req, res) => {
    const fileId = String(req.params.fileId || "").trim();
    const objectId = toObjectId(fileId);
    if (!objectId) {
      return res.status(400).json({ message: "Invalid document id." });
    }

    const bucket = ensureStudentDocumentBucket();
    const filesCollection = mongoose.connection.db.collection(`${GRIDFS_BUCKET_NAME}.files`);
    const file = await filesCollection.findOne({ _id: objectId });

    if (!file) {
      return res.status(404).json({ message: "Document not found." });
    }

    const contentType =
      String(file.contentType || "application/octet-stream").trim() ||
      "application/octet-stream";
    const originalName =
      String(file.filename || req.params.fileName || "document").trim() || "document";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(originalName)}`
    );

    await new Promise((resolve, reject) => {
      const downloadStream = bucket.openDownloadStream(objectId);
      downloadStream.on("error", reject);
      downloadStream.on("end", resolve);
      downloadStream.pipe(res);
    });
  })
);

app.post(
  "/api/uploads/student-document",
  authenticate,
  requireRoles(ROLE_ADMIN),
  (req, res, next) => {
    studentDocumentUpload.single("file")(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "File is too large. Maximum upload size is 10 MB.",
        });
      }

      const statusCode = Number(error.statusCode || 400);
      return res.status(statusCode).json({
        message: error.message || "Unable to upload document.",
      });
    });
  },
  asyncRoute(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        message: "File is required.",
      });
    }

    const documentType = String(req.body?.documentType || "document").trim() || "document";
    const savedDocument = await uploadStudentDocumentToMongo(req.file, documentType);
    const publicPath = toStudentDocumentPublicPath(
      savedDocument.fileId,
      savedDocument.originalName
    );

    return res.status(201).json({
      documentType,
      fileId: savedDocument.fileId,
      fileName: savedDocument.originalName,
      originalName: savedDocument.originalName,
      mimeType: savedDocument.mimeType,
      size: savedDocument.size,
      path: publicPath,
      url: toUploadPublicUrl(req, publicPath),
    });
  })
);

const generateUniqueSchoolSlug = async (schoolName) => {
  const baseSlug = normalizeSchoolSlug(schoolName) || "school";
  let candidate = baseSlug;
  let counter = 2;

  // Keep slug unique across schools while preserving a readable base.
  while (await School.exists({ slug: candidate })) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return candidate;
};

const createSchoolTenantWithAdmin = async ({
  schoolName,
  adminName,
  email,
  password,
  phone = "",
  address = "",
}) => {
  const normalizedSchoolName = String(schoolName || "").trim() || DEFAULT_SCHOOL_NAME;
  const normalizedAdminName = String(adminName || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const schoolSlug = await generateUniqueSchoolSlug(normalizedSchoolName);

  const school = await School.create({
    name: normalizedSchoolName,
    slug: schoolSlug,
    email: normalizedEmail,
    phone: String(phone || "").trim(),
    address: String(address || "").trim(),
    status: "Active",
  });

  const schoolId = getSchoolIdFromDocument(school);
  const baseState = normalizeSchoolData(createInitialSchoolData(), { schoolId });
  const adminUser = {
    id: getNextRecordId(baseState.users, "U"),
    name: normalizedAdminName,
    email: normalizedEmail,
    password: await hashPasswordIfNeeded(password),
    role: ROLE_ADMIN,
    status: "Active",
  };

  await writeState(
    {
      ...baseState,
      users: [...baseState.users, adminUser],
    },
    schoolId
  );

  await writeAdminSettings(
    schoolId,
    buildDefaultAdminSettingsForSchool(normalizedSchoolName)
  );

  return {
    school: {
      id: schoolId,
      name: String(school.name || normalizedSchoolName).trim(),
      slug: String(school.slug || schoolSlug).trim(),
    },
    admin: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      schoolId,
    },
  };
};

app.get(
  "/api/auth/setup-status",
  asyncRoute(async (req, res) => {
    await ensureStorageReady();
    const hasAdmin = Boolean(await User.exists({ role: ROLE_ADMIN }));

    res.json({
      hasAdmin,
      requiresAdminSetup: !hasAdmin,
    });
  })
);

app.post(
  "/api/auth/setup-admin",
  authSetupIpRateLimiter,
  asyncRoute(async (req, res) => {
    await ensureStorageReady();
    const hasSchools = Boolean(await School.exists({}));

    if (hasSchools) {
      return res.status(409).json({
        message: "Initial admin setup has already been completed.",
      });
    }

    const schoolName =
      String(req.body?.schoolName || DEFAULT_SCHOOL_NAME).trim() || DEFAULT_SCHOOL_NAME;
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required.",
      });
    }

    const passwordPolicyMessage = getPasswordPolicyMessage(
      password,
      buildDefaultAdminSettingsForSchool(schoolName),
      {
        required: true,
        label: "Password",
      }
    );
    if (passwordPolicyMessage) {
      return res.status(400).json({
        message: passwordPolicyMessage,
      });
    }

    const emailTaken = await isLoginEmailTaken(email);
    if (emailTaken) {
      return res.status(409).json({
        message: "This admin email is already registered.",
      });
    }

    const signupResult = await createSchoolTenantWithAdmin({
      schoolName,
      adminName: name,
      email,
      password,
    });

    return res.status(201).json({
      id: signupResult.admin.id,
      name: signupResult.admin.name,
      email: signupResult.admin.email,
      role: signupResult.admin.role,
      schoolId: signupResult.school.id,
      schoolName: signupResult.school.name,
      schoolSlug: signupResult.school.slug,
    });
  })
);

app.post(
  "/api/auth/signup",
  authSetupIpRateLimiter,
  asyncRoute(async (req, res) => {
    await ensureStorageReady();

    const schoolName = String(req.body?.schoolName || "").trim();
    const adminName =
      String(req.body?.adminName || req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const phone = String(req.body?.phone || "").trim();
    const address = String(req.body?.address || "").trim();

    if (!schoolName || !adminName || !email || !password) {
      return res.status(400).json({
        message: "School name, admin name, email, and password are required.",
      });
    }

    const passwordPolicyMessage = getPasswordPolicyMessage(
      password,
      buildDefaultAdminSettingsForSchool(schoolName),
      {
        required: true,
        label: "Password",
      }
    );
    if (passwordPolicyMessage) {
      return res.status(400).json({
        message: passwordPolicyMessage,
      });
    }

    const emailTaken = await isLoginEmailTaken(email);
    if (emailTaken) {
      return res.status(409).json({
        message: "This email is already registered. Please use a different email.",
      });
    }

    const signupResult = await createSchoolTenantWithAdmin({
      schoolName,
      adminName,
      email,
      password,
      phone,
      address,
    });

    const token = jwt.sign(
      {
        id: signupResult.admin.id,
        email: signupResult.admin.email,
        role: signupResult.admin.role,
        schoolId: signupResult.school.id,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      id: signupResult.admin.id,
      email: signupResult.admin.email,
      name: signupResult.admin.name,
      role: signupResult.admin.role,
      schoolId: signupResult.school.id,
      schoolName: signupResult.school.name,
      schoolSlug: signupResult.school.slug,
      token,
    });
  })
);

app.post(
  "/api/auth/login",
  authLoginIpRateLimiter,
  authLoginIdentityRateLimiter,
  asyncRoute(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const sameEmailUsers = await findLoginAccountsByEmail(email);
    if (!sameEmailUsers.length) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    let matched = null;
    for (const user of sameEmailUsers) {
      const isMatch = isPasswordHash(user.password)
        ? await bcrypt.compare(password, user.password)
        : user.password === password;
      if (isMatch) {
        matched = user;
        break;
      }
    }

    if (!matched) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!isPasswordHash(matched.password)) {
      const state = await readState(matched.schoolId);
      await updatePasswordBySource(state, matched.source, matched.id, password);
    }

    const school = await getSchoolByIdOrThrow(matched.schoolId);
    const schoolId = getSchoolIdFromDocument(school);

    const token = jwt.sign(
      {
        id: matched.id,
        email: matched.email,
        role: matched.role,
        schoolId,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      id: matched.id,
      email: matched.email,
      name: matched.name,
      role: matched.role,
      schoolId,
      schoolName: school.name,
      token,
    });
  })
);

app.get(
  "/api/auth/me",
  authenticate,
  asyncRoute(async (req, res) => {
    const school = await getSchoolByIdOrThrow(req.auth.schoolId);

    res.json({
      id: req.auth.id,
      email: req.auth.email,
      name: req.auth.name,
      role: req.auth.role,
      schoolId: getSchoolIdFromDocument(school),
      schoolName: school.name,
      schoolSlug: school.slug,
    });
  })
);

app.get(
  "/api/admin/settings",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_CRM),
  asyncRoute(async (req, res) => {
    const settings = await readAdminSettings(req.auth.schoolId);
    res.json(settings);
  })
);

app.put(
  "/api/admin/settings",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const current = await readAdminSettings(req.auth.schoolId);
    const nextSettings = await writeAdminSettings(req.auth.schoolId, {
      ...current,
      ...(req.body || {}),
    });

    res.json(nextSettings);
  })
);

app.get(
  "/api/state",
  authenticate,
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    res.json(cloneData(getRoleScopedState(state, req.auth)));
  })
);

app.put(
  "/api/state",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await writeState(req.body, req.auth.schoolId);
    res.json(cloneData(getRoleScopedState(state, req.auth)));
  })
);

app.post(
  "/api/state/reset",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const resetState = await writeState(createInitialSchoolData(), req.auth.schoolId);
    res.json(cloneData(getRoleScopedState(resetState, req.auth)));
  })
);

app.post(
  "/api/state/cleanup-orphaned",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const studentIds = new Set(state.students.map((s) => String(s.id || "")));
    const teacherIds = new Set(state.teachers.map((t) => String(t.id || "")));

    // Remove attendance entries with no records or records referencing deleted students
    const cleanedAttendance = state.attendance
      .map((entry) => ({
        ...entry,
        records: (entry.records || []).filter((record) => studentIds.has(String(record.studentId || ""))),
      }))
      .filter((entry) => Array.isArray(entry.records) && entry.records.length > 0);

    // Remove results referencing deleted students or teachers
    const cleanedResults = state.results.filter((entry) => {
      const studentExists = studentIds.has(String(entry.studentId || ""));
      const teacherExists = teacherIds.has(String(entry.teacherId || ""));
      return studentExists && (entry.teacherId ? teacherExists : true);
    });

    const cleanedState = {
      ...state,
      attendance: cleanedAttendance,
      results: cleanedResults,
    };

    const saved = await writeState(cleanedState);
    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.get(
  "/api/notices",
  authenticate,
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const notices = [ROLE_ADMIN, ROLE_CRM].includes(req.auth.role)
      ? state.notices
      : state.notices.filter((notice) => noticeMatchesRole(notice, req.auth.role));

    res.json(cloneData(notices));
  })
);

app.post(
  "/api/notices/upsert",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_CRM),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const id = String(req.body?.id || "").trim();
    const title = String(req.body?.title || "").trim();
    const message = String(req.body?.message || "").trim();
    const audience = normalizeNoticeAudience(req.body?.audience);
    const date = String(req.body?.date || "").trim();
    const status = String(req.body?.status || "Published").trim() || "Published";

    if (!title || !message) {
      return res.status(400).json({ message: "Notice title and message are required." });
    }

    const existingNotice = state.notices.find((entry) => entry.id === id);
    const notice = {
      id: existingNotice?.id || getNextRecordId(state.notices, "N"),
      title,
      message,
      audience,
      date: date || existingNotice?.date || getTodayISO(),
      status,
      createdBy: existingNotice?.createdBy || req.auth.id,
      createdAt: existingNotice?.createdAt || getTodayISO(),
      updatedAt: getTodayISO(),
    };

    const saved = await writeState({
      ...state,
      notices: existingNotice
        ? state.notices.map((entry) => (entry.id === notice.id ? notice : entry))
        : [notice, ...state.notices],
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.delete(
  "/api/notices/:id",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_CRM),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const noticeId = String(req.params.id || "");
    const exists = state.notices.some((entry) => entry.id === noticeId);

    if (!exists) {
      return res.status(404).json({ message: "Notice not found." });
    }

    const saved = await writeState({
      ...state,
      notices: state.notices.filter((entry) => entry.id !== noticeId),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/teachers/assignments",
  authenticate,
  requireRoles(ROLE_TEACHER),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const title = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();
    const className = String(req.body?.className || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const dueDate = String(req.body?.dueDate || "").trim() || getTodayISO();

    if (!title || !description || !className) {
      return res.status(400).json({
        message: "Assignment title, description, and class are required.",
      });
    }

    const teacher = findTeacherByAuth(state, req.auth);
    if (!teacher) {
      return res.status(403).json({
        message: "Only active teacher accounts can create assignments.",
      });
    }

    const teacherClassScope = buildTeacherClassScopeSet(teacher, state);
    if (!teacherClassScope.has(normalizeAssignedClassValue(className))) {
      return res.status(403).json({
        message: "You can only create assignments for your assigned classes.",
      });
    }

    const message = [
      description,
      `Class: ${className}`,
      subject ? `Subject: ${subject}` : "",
      `Due Date: ${dueDate}`,
    ]
      .filter(Boolean)
      .join(" | ");

    const assignmentNotice = {
      id: getNextRecordId(state.notices, "N"),
      title: `Assignment: ${title}`,
      message,
      audience: ["teacher", "student"],
      date: dueDate,
      status: "Published",
      type: "assignment",
      className,
      subject,
      dueDate,
      teacherId: req.auth.id,
      createdBy: req.auth.id,
      createdAt: getTodayISO(),
      updatedAt: getTodayISO(),
    };

    const saved = await writeState({
      ...state,
      notices: [assignmentNotice, ...state.notices],
    });

    return res.status(201).json({
      assignment: assignmentNotice,
      state: cloneData(getRoleScopedState(saved, req.auth)),
    });
  })
);

app.get(
  "/api/users/accounts",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const accounts = buildAccountDirectory(state);
    res.json(accounts);
  })
);

app.post(
  "/api/users/system-upsert",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const settings = await readAdminSettings(req.auth.schoolId);
    const id = String(req.body?.id || "").trim();
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "").trim().toLowerCase();
    const status =
      String(req.body?.status || "Active").trim().toLowerCase() === INACTIVE_STATUS
        ? "Inactive"
        : "Active";

    if (!name || !email || !role) {
      return res.status(400).json({ message: "Name, email, and role are required." });
    }

    if (!SYSTEM_USER_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ message: "Only Admin and CRM users are managed from this endpoint." });
    }

    const existingUser = state.users.find((entry) => entry.id === id);
    const passwordPolicyMessage = getPasswordPolicyMessage(password, settings, {
      required: !existingUser,
      label: "User password",
    });
    if (passwordPolicyMessage) {
      return res.status(400).json({ message: passwordPolicyMessage });
    }

    const emailTaken = buildAccountDirectory(state).some(
      (entry) =>
        String(entry.email || "").toLowerCase() === email &&
        !(entry.source === "users" && entry.id === existingUser?.id)
    );
    if (emailTaken) {
      return res.status(409).json({ message: "Email is already used by another account." });
    }

    if (role === ROLE_ADMIN && status.toLowerCase() === INACTIVE_STATUS && existingUser) {
      const otherActiveAdmins = state.users.filter(
        (entry) =>
          entry.id !== existingUser.id &&
          entry.role === ROLE_ADMIN &&
          String(entry.status || "Active").toLowerCase() !== INACTIVE_STATUS
      );

      if (!otherActiveAdmins.length) {
        return res
          .status(409)
          .json({ message: "At least one active admin account must remain." });
      }
    }

    if (existingUser?.role === ROLE_ADMIN && role !== ROLE_ADMIN) {
      const otherActiveAdmins = state.users.filter(
        (entry) =>
          entry.id !== existingUser.id &&
          entry.role === ROLE_ADMIN &&
          String(entry.status || "Active").toLowerCase() !== INACTIVE_STATUS
      );

      if (!otherActiveAdmins.length) {
        return res
          .status(409)
          .json({ message: "At least one active admin account must remain." });
      }
    }

    const user = {
      id: existingUser?.id || getNextRecordId(state.users, "U"),
      name,
      email,
      role,
      status,
      password: password || existingUser?.password || getDefaultPasswordForRole(role, settings),
    };

    const saved = await writeState({
      ...state,
      users: existingUser
        ? state.users.map((entry) => (entry.id === existingUser.id ? user : entry))
        : [...state.users, user],
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.delete(
  "/api/users/system/:id",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const userId = String(req.params.id || "");
    const user = state.users.find(
      (entry) => entry.id === userId && SYSTEM_USER_ROLES.includes(entry.role)
    );

    if (!user) {
      return res.status(404).json({ message: "System user not found." });
    }

    if (user.role === ROLE_ADMIN) {
      const otherActiveAdmins = state.users.filter(
        (entry) =>
          entry.id !== user.id &&
          entry.role === ROLE_ADMIN &&
          String(entry.status || "Active").toLowerCase() !== INACTIVE_STATUS
      );

      if (!otherActiveAdmins.length) {
        return res
          .status(409)
          .json({ message: "At least one active admin account must remain." });
      }
    }

    const saved = await writeState({
      ...state,
      users: state.users.filter((entry) => entry.id !== user.id),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/users/accounts/:role/:id/status",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const role = String(req.params.role || "").trim().toLowerCase();
    const accountId = String(req.params.id || "").trim();
    const status =
      String(req.body?.status || "Active").trim().toLowerCase() === INACTIVE_STATUS
        ? "Inactive"
        : "Active";

    const account = findAccountByRoleAndId(state, role, accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found." });
    }

    if (role === ROLE_ADMIN && status.toLowerCase() === INACTIVE_STATUS) {
      const otherActiveAdmins = state.users.filter(
        (entry) =>
          entry.id !== account.id &&
          entry.role === ROLE_ADMIN &&
          String(entry.status || "Active").toLowerCase() !== INACTIVE_STATUS
      );

      if (!otherActiveAdmins.length) {
        return res
          .status(409)
          .json({ message: "At least one active admin account must remain." });
      }
    }

    const source = getAccountSourceByRole(role);
    const saved = await writeState({
      ...state,
      [source]: state[source].map((entry) => {
        if (entry.id !== account.id) {
          return entry;
        }

        if (source === "users" && String(entry.role || "") !== role) {
          return entry;
        }

        return {
          ...entry,
          status,
        };
      }),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/users/accounts/:role/:id/reset-password",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const settings = await readAdminSettings(req.auth.schoolId);
    const role = String(req.params.role || "").trim().toLowerCase();
    const accountId = String(req.params.id || "").trim();
    const password = String(req.body?.password || "");

    const account = findAccountByRoleAndId(state, role, accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found." });
    }

    const passwordPolicyMessage = getPasswordPolicyMessage(password, settings, {
      required: true,
      label: "Password",
    });
    if (passwordPolicyMessage) {
      return res.status(400).json({ message: passwordPolicyMessage });
    }

    const source = getAccountSourceByRole(role);
    const saved = await updatePasswordBySource(state, source, account.id, password, {
      invalidateTokens: settings.forceLogoutOnPasswordReset,
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/masters/classes",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const name = String(req.body?.name || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Class name is required." });
    }

    if (hasMasterValue(state.classes, name)) {
      return res.status(409).json({ message: "Class already exists." });
    }

    const saved = await writeState({
      ...state,
      classes: normalizeMasterList([...(state.classes || []), name]),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.put(
  "/api/masters/classes/:name",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const assignedClassLookup = buildAssignedClassLookup(state.classes);
    const currentName = decodeURIComponent(String(req.params.name || "")).trim();
    const nextName = String(req.body?.name || "").trim();

    if (!currentName || !nextName) {
      return res.status(400).json({ message: "Current and new class names are required." });
    }

    if (!hasMasterValue(state.classes, currentName)) {
      return res.status(404).json({ message: "Class not found." });
    }

    if (!equalsIgnoreCase(currentName, nextName) && hasMasterValue(state.classes, nextName)) {
      return res.status(409).json({ message: "Another class with this name already exists." });
    }

    const saved = await writeState({
      ...state,
      classes: normalizeMasterList(
        (state.classes || []).map((entry) =>
          equalsIgnoreCase(entry, currentName) ? nextName : entry
        )
      ),
      students: state.students.map((student) =>
        equalsIgnoreCase(student.className, currentName)
          ? { ...student, className: nextName }
          : student
      ),
      attendance: state.attendance.map((entry) =>
        equalsIgnoreCase(entry.className, currentName)
          ? { ...entry, className: nextName }
          : entry
      ),
      teachers: state.teachers.map((teacher) => ({
        ...teacher,
        classes: [...new Set(
          normalizeClassList(teacher.classes).map((entry) => {
            const assignedClass = resolveAssignedClassEntry(entry, assignedClassLookup);
            if (assignedClass && equalsIgnoreCase(assignedClass.className, currentName)) {
              return formatAssignedClassLabel(nextName, assignedClass.section);
            }

            return equalsIgnoreCase(entry, currentName) ? nextName : entry;
          })
        )],
      })),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.delete(
  "/api/masters/classes/:name",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const assignedClassLookup = buildAssignedClassLookup(state.classes);
    const name = decodeURIComponent(String(req.params.name || "")).trim();

    if (!name) {
      return res.status(400).json({ message: "Class name is required." });
    }

    if (!hasMasterValue(state.classes, name)) {
      return res.status(404).json({ message: "Class not found." });
    }

    const inUseByStudents = state.students.some((student) =>
      equalsIgnoreCase(student.className, name)
    );
    if (inUseByStudents) {
      return res.status(409).json({
        message: "Class is assigned to one or more students. Reassign students first.",
      });
    }

    const inUseByTeachers = state.teachers.some((teacher) =>
      normalizeClassList(teacher.classes).some((entry) => {
        const assignedClass = resolveAssignedClassEntry(entry, assignedClassLookup);
        if (assignedClass) {
          return equalsIgnoreCase(assignedClass.className, name);
        }

        return equalsIgnoreCase(entry, name);
      })
    );
    if (inUseByTeachers) {
      return res.status(409).json({
        message: "Class is assigned to one or more teachers. Reassign teachers first.",
      });
    }

    const saved = await writeState({
      ...state,
      classes: normalizeMasterList(
        (state.classes || []).filter((entry) => !equalsIgnoreCase(entry, name))
      ),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

// Section master endpoints removed - `section` concept deleted from data model.

app.post(
  "/api/masters/subjects",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const name = String(req.body?.name || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Subject name is required." });
    }

    if (hasMasterValue(state.subjects, name)) {
      return res.status(409).json({ message: "Subject already exists." });
    }

    const saved = await writeState({
      ...state,
      subjects: normalizeMasterList([...(state.subjects || []), name]),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.put(
  "/api/masters/subjects/:name",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const currentName = decodeURIComponent(String(req.params.name || "")).trim();
    const nextName = String(req.body?.name || "").trim();

    if (!currentName || !nextName) {
      return res.status(400).json({ message: "Current and new subject names are required." });
    }

    if (!hasMasterValue(state.subjects, currentName)) {
      return res.status(404).json({ message: "Subject not found." });
    }

    if (!equalsIgnoreCase(currentName, nextName) && hasMasterValue(state.subjects, nextName)) {
      return res.status(409).json({ message: "Another subject with this name already exists." });
    }

    const saved = await writeState({
      ...state,
      subjects: normalizeMasterList(
        (state.subjects || []).map((subject) =>
          equalsIgnoreCase(subject, currentName) ? nextName : subject
        )
      ),
      teachers: state.teachers.map((teacher) => {
        const nextSubjects = [...new Set(
          normalizeTeacherSubjects(teacher).map((subject) =>
            equalsIgnoreCase(subject, currentName) ? nextName : subject
          )
        )];

        return {
          ...teacher,
          subject: nextSubjects[0] || "",
          subjects: nextSubjects,
        };
      }),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.delete(
  "/api/masters/subjects/:name",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const name = decodeURIComponent(String(req.params.name || "")).trim();

    if (!name) {
      return res.status(400).json({ message: "Subject name is required." });
    }

    if (!hasMasterValue(state.subjects, name)) {
      return res.status(404).json({ message: "Subject not found." });
    }

    const isInUse = state.teachers.some((teacher) =>
      normalizeTeacherSubjects(teacher).some((subject) => equalsIgnoreCase(subject, name))
    );
    if (isInUse) {
      return res.status(409).json({
        message: "Subject is assigned to one or more teachers. Reassign teachers first.",
      });
    }

    const saved = await writeState({
      ...state,
      subjects: normalizeMasterList(
        (state.subjects || []).filter((subject) => !equalsIgnoreCase(subject, name))
      ),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/masters/departments",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const name = String(req.body?.name || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Department name is required." });
    }

    if (hasMasterValue(state.departments, name)) {
      return res.status(409).json({ message: "Department already exists." });
    }

    const saved = await writeState({
      ...state,
      departments: normalizeMasterList([...(state.departments || []), name]),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.put(
  "/api/masters/departments/:name",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const currentName = decodeURIComponent(String(req.params.name || "")).trim();
    const nextName = String(req.body?.name || "").trim();

    if (!currentName || !nextName) {
      return res
        .status(400)
        .json({ message: "Current and new department names are required." });
    }

    if (!hasMasterValue(state.departments, currentName)) {
      return res.status(404).json({ message: "Department not found." });
    }

    if (
      !equalsIgnoreCase(currentName, nextName) &&
      hasMasterValue(state.departments, nextName)
    ) {
      return res
        .status(409)
        .json({ message: "Another department with this name already exists." });
    }

    const saved = await writeState({
      ...state,
      departments: normalizeMasterList(
        (state.departments || []).map((department) =>
          equalsIgnoreCase(department, currentName) ? nextName : department
        )
      ),
      teachers: state.teachers.map((teacher) =>
        equalsIgnoreCase(teacher.department, currentName)
          ? { ...teacher, department: nextName }
          : teacher
      ),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.delete(
  "/api/masters/departments/:name",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const name = decodeURIComponent(String(req.params.name || "")).trim();

    if (!name) {
      return res.status(400).json({ message: "Department name is required." });
    }

    if (!hasMasterValue(state.departments, name)) {
      return res.status(404).json({ message: "Department not found." });
    }

    const isInUse = state.teachers.some((teacher) =>
      equalsIgnoreCase(teacher.department, name)
    );
    if (isInUse) {
      return res.status(409).json({
        message: "Department is assigned to one or more teachers. Reassign teachers first.",
      });
    }

    const saved = await writeState({
      ...state,
      departments: normalizeMasterList(
        (state.departments || []).filter(
          (department) => !equalsIgnoreCase(department, name)
        )
      ),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/teachers/upsert",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const settings = await readAdminSettings(req.auth.schoolId);
    const id = String(req.body?.id || "").trim();
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const subjects = [...new Set([
      ...normalizeSubjectList(req.body?.subjects),
      ...normalizeSubjectList(req.body?.subject),
    ])];
    const department = String(req.body?.department || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const assignedClassResolution = resolveTeacherAssignedClasses(
      req.body?.classes,
      state.classes,
      state.sections
    );
    const classes = assignedClassResolution.classes;
    const status = String(req.body?.status || "Active").trim() || "Active";
    const joiningDate = String(req.body?.joiningDate || "").trim() || getTodayISO();

    if (!name || !email || !subjects.length) {
      return res
        .status(400)
        .json({ message: "Name, email, and at least one subject are required." });
    }

    const invalidSubjects = subjects.filter((subject) => !hasMasterValue(state.subjects, subject));
    if (invalidSubjects.length) {
      return res.status(400).json({
        message: "One or more selected subjects are not available. Add them in Subject & Department Masters first.",
        invalidSubjects,
      });
    }

    if (department && !hasMasterValue(state.departments, department)) {
      return res.status(400).json({
        message:
          "Selected department is not available. Add it in Subject & Department Masters first.",
      });
    }

    if (assignedClassResolution.invalid.length) {
      return res.status(400).json({
        message:
          "Invalid assigned classes. Pick only combinations available in Classes & Subjects masters.",
        invalidClasses: assignedClassResolution.invalid,
      });
    }

    const existingTeacher = state.teachers.find((entry) => entry.id === id);
    const emailTaken = state.teachers.some(
      (entry) =>
        String(entry.email || "").toLowerCase() === email &&
        entry.id !== existingTeacher?.id
    );

    if (emailTaken) {
      return res.status(409).json({ message: "Teacher email already exists." });
    }

    const passwordPolicyMessage = getPasswordPolicyMessage(password, settings, {
      required: !existingTeacher,
      label: "Teacher password",
    });
    if (passwordPolicyMessage) {
      return res.status(400).json({ message: passwordPolicyMessage });
    }

    const teacher = {
      id: existingTeacher?.id || getNextRecordId(state.teachers, "T"),
      name,
      email,
      password: password || existingTeacher?.password || "",
      subject: subjects[0] || "",
      subjects,
      department,
      phone,
      classes,
      status,
      joiningDate,
    };

    const nextState = {
      ...state,
      teachers: existingTeacher
        ? state.teachers.map((entry) => (entry.id === existingTeacher.id ? teacher : entry))
        : [...state.teachers, teacher],
    };

    const saved = await writeState(nextState);
    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.delete(
  "/api/teachers/:id",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const teacherId = String(req.params.id || "");
    const exists = state.teachers.some((entry) => entry.id === teacherId);

    if (!exists) {
      return res.status(404).json({ message: "Teacher not found." });
    }

    const saved = await writeState({
      ...state,
      teachers: state.teachers.filter((entry) => entry.id !== teacherId),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/teachers/:id/reset-password",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const settings = await readAdminSettings(req.auth.schoolId);
    const teacherId = String(req.params.id || "");
    const password = String(req.body?.password || "");

    const passwordPolicyMessage = getPasswordPolicyMessage(password, settings, {
      required: true,
      label: "Password",
    });
    if (passwordPolicyMessage) {
      return res.status(400).json({ message: passwordPolicyMessage });
    }

    const exists = state.teachers.some((entry) => entry.id === teacherId);
    if (!exists) {
      return res.status(404).json({ message: "Teacher not found." });
    }

    const saved = await updatePasswordBySource(state, "teachers", teacherId, password, {
      invalidateTokens: settings.forceLogoutOnPasswordReset,
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/students/upsert",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const settings = await readAdminSettings(req.auth.schoolId);
    const id = String(req.body?.id || "").trim();
    const existingStudent = state.students.find((entry) => entry.id === id);
    const existingParent = state.parents.find(
      (entry) => entry.id === existingStudent?.parentId
    );

    const studentName = String(req.body?.name || "").trim();
    const dateOfBirth = String(req.body?.dateOfBirth || "").trim();
    const gender = String(req.body?.gender || "").trim();
    const bloodGroup = String(req.body?.bloodGroup || "").trim();
    const aadhaarNumber = String(req.body?.aadhaarNumber || "").trim();
    const mobileNumber = String(req.body?.mobileNumber || "").trim();
    const studentEmailRaw = String(req.body?.email || "").trim().toLowerCase();
    const studentPassword = String(req.body?.password || "");

    const address = String(req.body?.address || "").trim();
    const city = String(req.body?.city || "").trim();
    const stateName = String(req.body?.state || "").trim();
    const pincode = String(req.body?.pincode || "").trim();

    const className = String(req.body?.className || "").trim();
    const section = String(req.body?.section || "").trim();

    const admissionDate = String(req.body?.admissionDate || "").trim();
    const requestedRollNumber = String(req.body?.rollNumber || "").trim();
    const previousSchoolName = String(req.body?.previousSchoolName || "").trim();
    const previousClass = String(req.body?.previousClass || "").trim();
    const admissionSource =
      String(req.body?.admissionSource || "Walk-in").trim() || "Walk-in";
    const conversionStatusRaw = String(req.body?.conversionStatus || "").trim();
    const enquiryId = String(req.body?.enquiryId || "").trim();

    const fatherName = String(req.body?.fatherName || req.body?.parentName || "").trim();
    const fatherPhone = String(req.body?.fatherPhone || req.body?.parentPhone || "").trim();
    const motherName = String(req.body?.motherName || "").trim();
    const motherPhone = String(req.body?.motherPhone || "").trim();
    const guardianName = String(req.body?.guardianName || "").trim();
    const guardianPhone = String(req.body?.guardianPhone || "").trim();
    const parentName = guardianName || fatherName;
    const parentPhone = guardianPhone || fatherPhone || motherPhone;

    const parentEmailRaw = String(req.body?.parentEmail || "").trim().toLowerCase();
    const parentPassword = String(req.body?.parentPassword || "");

    const createStudentLogin =
      req.body?.createStudentLogin === undefined
        ? Boolean(studentEmailRaw || existingStudent?.password)
        : toBoolean(req.body?.createStudentLogin);
    const createParentLogin =
      req.body?.createParentLogin === undefined
        ? Boolean(parentEmailRaw || existingParent?.password)
        : toBoolean(req.body?.createParentLogin);

    const status = String(req.body?.status || "Active").trim() || "Active";

    if (
      !studentName ||
      !dateOfBirth ||
      !gender ||
      !mobileNumber ||
      !address ||
      !fatherName ||
      !fatherPhone ||
      !className ||
      !admissionDate
    ) {
      return res.status(400).json({
        message:
          "Student name, DOB, gender, mobile, address, father name/phone, class, and admission date are required.",
      });
    }

    if (!hasMasterValue(state.classes, className)) {
      return res.status(400).json({
        message: "Selected class is not available. Add it in Classes & Subjects masters first.",
      });
    }

    if (enquiryId && !state.enquiries.some((entry) => entry.id === enquiryId)) {
      return res.status(400).json({
        message: "Selected enquiry does not exist.",
      });
    }

    const studentEmail =
      studentEmailRaw || String(existingStudent?.email || "").trim().toLowerCase();
    const parentEmail =
      parentEmailRaw || String(existingParent?.email || "").trim().toLowerCase();

    if (createStudentLogin && !studentEmail) {
      return res.status(400).json({
        message: "Student login email is required when student login is enabled.",
      });
    }

    if (createParentLogin && !parentEmail) {
      return res.status(400).json({
        message: "Parent login email is required when parent login is enabled.",
      });
    }

    const classOrSectionChanged = existingStudent
      ? !equalsIgnoreCase(existingStudent.className, className)
      : false;

    if (studentEmail) {
      const studentEmailTaken = state.students.some(
        (entry) =>
          String(entry.email || "").toLowerCase() === studentEmail &&
          entry.id !== existingStudent?.id
      );
      if (studentEmailTaken) {
        return res.status(409).json({ message: "Student email already exists." });
      }
    }

    if (parentEmail) {
      const parentEmailTaken = state.parents.some(
        (entry) =>
          String(entry.email || "").toLowerCase() === parentEmail &&
          entry.id !== existingParent?.id
      );
      if (parentEmailTaken) {
        return res.status(409).json({ message: "Parent email already exists." });
      }
    }

    const generatedStudentPassword = getDefaultPasswordForRole(ROLE_STUDENT, settings);
    const generatedParentPassword = getDefaultPasswordForRole(ROLE_PARENT, settings);

    if (createStudentLogin) {
      const studentPasswordCandidate =
        studentPassword || (!existingStudent?.password ? generatedStudentPassword : "");
      const studentPasswordPolicyMessage = getPasswordPolicyMessage(
        studentPasswordCandidate,
        settings,
        {
          required: !existingStudent?.password,
          label: "Student password",
        }
      );
      if (studentPasswordPolicyMessage) {
        return res.status(400).json({ message: studentPasswordPolicyMessage });
      }
    }

    if (createParentLogin) {
      const parentPasswordCandidate =
        parentPassword || (!existingParent?.password ? generatedParentPassword : "");
      const parentPasswordPolicyMessage = getPasswordPolicyMessage(
        parentPasswordCandidate,
        settings,
        {
          required: !existingParent?.password,
          label: "Parent password",
        }
      );
      if (parentPasswordPolicyMessage) {
        return res.status(400).json({ message: parentPasswordPolicyMessage });
      }
    }

    const studentId = existingStudent?.id || getNextRecordId(state.students, "S");
    const parentId = existingStudent?.parentId || getNextRecordId(state.parents, "P");
    const computedRollNumber = existingStudent
      ? classOrSectionChanged
        ? getNextRollNumber(state.students, className, existingStudent.id)
        : String(existingStudent.rollNumber || "").trim() ||
          getNextRollNumber(state.students, className, existingStudent.id)
      : getNextRollNumber(state.students, className);
    const rollNumber = requestedRollNumber || computedRollNumber;
    const admissionNumber =
      String(req.body?.admissionNumber || "").trim() ||
      String(existingStudent?.admissionNumber || "").trim() ||
      getNextAdmissionNumber(state.students, existingStudent?.id);

    const studentPhoto =
      String(
        req.body?.studentPhoto ||
          req.body?.documents?.studentPhoto ||
          existingStudent?.studentPhoto ||
          existingStudent?.documents?.studentPhoto ||
          ""
      ).trim();
    const birthCertificate =
      String(
        req.body?.birthCertificate ||
          req.body?.documents?.birthCertificate ||
          existingStudent?.birthCertificate ||
          existingStudent?.documents?.birthCertificate ||
          ""
      ).trim();
    const aadhaarCard =
      String(
        req.body?.aadhaarCard ||
          req.body?.documents?.aadhaarCard ||
          existingStudent?.aadhaarCard ||
          existingStudent?.documents?.aadhaarCard ||
          ""
      ).trim();
    const tcDocument =
      String(
        req.body?.tcDocument ||
          req.body?.documents?.tcDocument ||
          existingStudent?.tcDocument ||
          existingStudent?.documents?.tcDocument ||
          ""
      ).trim();

    const resolvedStudentPassword = createStudentLogin
      ? studentPassword || existingStudent?.password || generatedStudentPassword
      : "";
    const resolvedParentPassword = createParentLogin
      ? parentPassword || existingParent?.password || generatedParentPassword
      : "";
    const existingEnquiryLinkId = String(existingStudent?.enquiryId || "").trim();
    const linkedEnquiryId = enquiryId || existingEnquiryLinkId;
    const normalizedStudentConversionStatus = String(
      conversionStatusRaw || existingStudent?.conversionStatus || ""
    ).trim();
    const resolvedStudentConversionStatus = linkedEnquiryId
      ? "Converted"
      : normalizedStudentConversionStatus === "Fresh Admission"
        ? "Not Converted"
        : normalizedStudentConversionStatus === "Converted from Enquiry"
          ? "Converted"
          : normalizedStudentConversionStatus || "Not Converted";

    const parent = {
      id: parentId,
      userId: parentId,
      name: parentName,
      email: parentEmail,
      password: resolvedParentPassword,
      phone: parentPhone,
      studentId,
      fatherName,
      fatherPhone,
      motherName,
      motherPhone,
      guardianName,
      guardianPhone,
      createdBy: existingParent?.createdBy || req.auth.id,
      updatedBy: req.auth.id,
      status: String(req.body?.parentStatus || existingParent?.status || "Active"),
    };

    const student = {
      id: studentId,
      userId: studentId,
      name: studentName,
      email: studentEmail,
      password: resolvedStudentPassword,
      dateOfBirth,
      gender,
      bloodGroup,
      aadhaarNumber,
      mobileNumber,
      address,
      city,
      state: stateName,
      pincode,
      className,
      section,
      rollNumber,
      admissionNumber,
      previousSchoolName,
      previousClass,
      parentId,
      parentName: parent.name,
      parentEmail: parent.email,
      parentPhone: parent.phone,
      fatherName,
      fatherPhone,
      motherName,
      motherPhone,
      guardianName,
      guardianPhone,
      admissionDate: admissionDate || existingStudent?.admissionDate || getTodayISO(),
      studentPhoto,
      birthCertificate,
      aadhaarCard,
      tcDocument,
      documents: {
        studentPhoto,
        birthCertificate,
        aadhaarCard,
        tcDocument,
      },
      enquiryId: linkedEnquiryId,
      admissionSource,
      conversionStatus: resolvedStudentConversionStatus,
      createStudentLogin,
      createParentLogin,
      createdBy: existingStudent?.createdBy || req.auth.id,
      updatedBy: req.auth.id,
      status,
      attendance: existingStudent?.attendance || { present: 0, total: 0 },
      fee: normalizeStudentFee(req.body || {}, existingStudent),
    };

    const nextDocumentReferences = getStudentDocumentReferences(student);
    const nextDocumentReferenceSet = new Set(nextDocumentReferences);
    const staleDocumentReferences = existingStudent
      ? getStudentDocumentReferences(existingStudent).filter(
          (value) => !nextDocumentReferenceSet.has(value)
        )
      : [];

    const nextState = {
      ...state,
      students: existingStudent
        ? state.students.map((entry) => (entry.id === student.id ? student : entry))
        : [...state.students, student],
      parents: existingParent
        ? state.parents.map((entry) => (entry.id === parent.id ? parent : entry))
        : [...state.parents, parent],
      enquiries: linkedEnquiryId
        ? state.enquiries.map((entry) => {
            if (entry.id !== linkedEnquiryId) {
              return entry;
            }

            const normalizedEntry = normalizeEnquiryRecord(entry);
            const actorName = req.auth.name || "System";
            const conversionText = `Converted to admission ${admissionNumber}.`;

            return {
              ...normalizedEntry,
              stage: "Converted",
              status: "Converted",
              convertedStudentId: studentId,
              isConverted: true,
              conversionStatus: "Converted",
              notes: [
                ...normalizedEntry.notes,
                createEnquiryNoteEntry(conversionText, actorName),
              ],
              activity: [
                ...normalizedEntry.activity,
                createEnquiryActivityEntry("converted", conversionText, actorName),
              ],
              lastUpdatedAt: getTodayISO(),
            };
          })
        : state.enquiries,
    };

    const saved = await writeState(nextState);

    if (staleDocumentReferences.length) {
      await Promise.all(staleDocumentReferences.map((entry) => deleteUploadedFile(entry)));
    }

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.delete(
  "/api/students/:id",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const studentId = String(req.params.id || "");
    const student = state.students.find((entry) => entry.id === studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    const documentReferences = getStudentDocumentReferences(student);

    const saved = await writeState({
      ...state,
      students: state.students.filter((entry) => entry.id !== studentId),
      parents: state.parents.filter((entry) => {
        const entryStudentId = String(entry.studentId || "");
        const entryId = String(entry.id || "");
        const entryEmail = String(entry.email || "").toLowerCase();
        const studentParentId = String(student.parentId || "");
        const studentParentEmail = String(student.parentEmail || "").toLowerCase();

        // Keep the parent record only if it is NOT linked to this student.
        // Consider links by `studentId`, by parent `id` referenced on student, or by parent email.
        const linkedByStudentId = entryStudentId === studentId;
        const linkedByParentId = entryId === studentParentId && studentParentId;
        const linkedByEmail = studentParentEmail && entryEmail === studentParentEmail;

        return !(linkedByStudentId || linkedByParentId || linkedByEmail);
      }),
      results: state.results.filter((entry) => entry.studentId !== studentId),
      attendance: state.attendance
        .map((entry) => ({
          ...entry,
          records: entry.records.filter((record) => record.studentId !== studentId),
        }))
        .filter((entry) => Array.isArray(entry.records) && entry.records.length > 0),
      enquiries: state.enquiries.map((entry) => {
        if (entry.convertedStudentId !== student.id) {
          return entry;
        }

        const normalizedEntry = normalizeEnquiryRecord(entry);
        const reopenedStage = normalizedEntry.stage === "Converted" ? "Applied" : normalizedEntry.stage;
        const reopenedStatus = normalizeEnquiryStatus(normalizedEntry.status, reopenedStage);

        return {
          ...normalizedEntry,
          stage: reopenedStage,
          status: reopenedStatus,
          convertedStudentId: "",
          isConverted: false,
          conversionStatus: "Not Converted",
          lastUpdatedAt: getTodayISO(),
        };
      }),
    });

    await Promise.all(documentReferences.map((entry) => deleteUploadedFile(entry)));

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

// Bulk Student Upload from Excel
app.post(
  "/api/students/bulk-upload",
  authenticate,
  requireRoles(ROLE_ADMIN),
  bulkStudentExcelUpload.single("file"),
  asyncRoute(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const state = await getStateFromRequest(req);
    const xlsxModule = await import("xlsx");
    const XLSX = xlsxModule?.default || xlsxModule;

    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ message: "Excel file is empty." });
      }

      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet);

      // Validate and prepare data
      const validations = [];
      const processedStudents = [];
      const duplicatePhones = new Set();
      const duplicateEmails = new Set();

      rawData.forEach((row, index) => {
        const rowNum = index + 2; // Excel row number (header is row 1)
        const errors = [];

        // Extract and trim fields
        const name = String(row.Name || "").trim();
        const dateOfBirth = String(row.DateOfBirth || "").trim();
        const gender = String(row.Gender || "").trim();
        const aadhaarNumber = String(row.AadhaarNumber || row.Aadhaar || "").trim();
        const mobileNumber = String(row.MobileNumber || row.Phone || "").trim();
        const email = String(row.Email || "").trim().toLowerCase();
        const address = String(row.Address || "").trim();
        const city = String(row.City || "").trim();
        const stateName = String(row.State || "").trim();
        const pincode = String(row.Pincode || row.PinCode || "").trim();
        const className = String(row.Class || row.ClassName || "").trim();
        const section = String(row.Section || "").trim();
        const fatherName = String(row.FatherName || "").trim();
        const fatherPhone = String(row.FatherPhone || "").trim();
        const motherName = String(row.MotherName || "").trim();
        const motherPhone = String(row.MotherPhone || "").trim();
        const rollNumber = String(row.RollNumber || "").trim();
        const admissionNumber = String(row.AdmissionNumber || "").trim();
        const parentEmail = String(row.ParentEmail || "").trim().toLowerCase();

        // Validate required fields
        if (!name) errors.push("Name is required");
        if (!dateOfBirth) errors.push("DateOfBirth is required");
        if (!gender) errors.push("Gender is required");
        if (!mobileNumber) errors.push("MobileNumber is required");
        if (!address) errors.push("Address is required");
        if (!className) errors.push("Class is required");
        if (!fatherName) errors.push("FatherName is required");
        if (!fatherPhone) errors.push("FatherPhone is required");
        if (!admissionNumber) errors.push("AdmissionNumber is required");

        // Validate class exists
        if (className && !hasMasterValue(state.classes, className)) {
          errors.push(`Class '${className}' does not exist`);
        }

        // Check for duplicates in current batch
        if (mobileNumber) {
          if (duplicatePhones.has(mobileNumber)) {
            errors.push(`Duplicate phone number '${mobileNumber}'`);
          }
          duplicatePhones.add(mobileNumber);

          // Check against existing students
          const existingStudent = state.students.find(
            (s) => s.mobileNumber === mobileNumber
          );
          if (existingStudent) {
            errors.push(`Phone already exists for student '${existingStudent.name}'`);
          }
        }

        // Check for duplicate emails
        if (email) {
          if (duplicateEmails.has(email)) {
            errors.push(`Duplicate email '${email}'`);
          }
          duplicateEmails.add(email);

          const existingStudent = state.students.find(
            (s) => String(s.email || "").toLowerCase() === email
          );
          if (existingStudent) {
            errors.push(`Email already exists for student '${existingStudent.name}'`);
          }
        }

        validations.push({
          rowNum,
          valid: errors.length === 0,
          errors,
          data: {
            name,
            dateOfBirth,
            gender,
            aadhaarNumber,
            mobileNumber,
            email,
            address,
            city,
            state: stateName,
            pincode,
            className,
            fatherName,
            fatherPhone,
            motherName,
            motherPhone,
            rollNumber,
            admissionNumber,
            parentEmail,
          },
        });

        if (errors.length === 0) {
          processedStudents.push({
            name,
            dateOfBirth,
            gender,
            aadhaarNumber,
            mobileNumber,
            email,
            address,
            city,
            state: stateName,
            pincode,
            className,
            fatherName,
            fatherPhone,
            motherName,
            motherPhone,
            rollNumber,
            admissionNumber,
            parentEmail,
          });
        }
      });

      // Count valid and invalid rows
      const validRows = validations.filter((v) => v.valid);
      const invalidRows = validations.filter((v) => !v.valid);

      res.json({
        total: rawData.length,
        valid: validRows.length,
        invalid: invalidRows.length,
        validations,
        processedStudents,
      });
    } catch (err) {
      return res.status(400).json({
        message: "Error parsing Excel file: " + err.message,
      });
    }
  })
);

// Confirm and Save Bulk Student Upload
app.post(
  "/api/students/bulk-import",
  authenticate,
  requireRoles(ROLE_ADMIN),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const studentsToImport = req.body?.students || [];

    if (!Array.isArray(studentsToImport) || studentsToImport.length === 0) {
      return res.status(400).json({ message: "No students to import." });
    }

    try {
      const newStudents = [];
      const newParents = [];
      const errors = [];
      const studentIdPool = [...state.students];
      const parentIdPool = [...state.parents];

      for (const studentData of studentsToImport) {
        try {
          const studentId = getNextRecordId(studentIdPool, "S");
          const parentId = getNextRecordId(parentIdPool, "P");

          // Validate required fields again
          if (
            !studentData.name ||
            !studentData.dateOfBirth ||
            !studentData.gender ||
            !studentData.mobileNumber ||
            !studentData.address ||
            !studentData.fatherName ||
            !studentData.fatherPhone ||
            !studentData.className
          ) {
            errors.push(`Row skipped - Missing required fields for ${studentData.name}`);
            continue;
          }

          const student = {
            schoolId: req.auth.schoolId,
            id: studentId,
            name: studentData.name,
            dateOfBirth: studentData.dateOfBirth,
            gender: studentData.gender,
            aadhaarNumber: String(studentData.aadhaarNumber || "").trim(),
            mobileNumber: studentData.mobileNumber,
            email: studentData.email || "",
            address: studentData.address,
            city: String(studentData.city || "").trim(),
            state: String(studentData.state || "").trim(),
            pincode: String(studentData.pincode || "").trim(),
            className: studentData.className,
            rollNumber: studentData.rollNumber || `AUTO-${studentId.slice(-6)}`,
            admissionNumber: studentData.admissionNumber,
            admissionDate: getTodayISO(),
            parentId,
            parentName: studentData.fatherName,
            parentPhone: studentData.fatherPhone,
            fatherName: studentData.fatherName,
            fatherPhone: studentData.fatherPhone,
            motherName: String(studentData.motherName || "").trim(),
            motherPhone: String(studentData.motherPhone || "").trim(),
            status: "Active",
            admissionSource: "Bulk Upload",
            conversionStatus: "Not Converted",
            attendance: { present: 0, total: 0 },
            fee: {
              feeStructure: "Standard",
              totalFees: 0,
              admissionFee: 0,
              paidAmount: 0,
              dueDate: getTodayISO(),
            },
            createdBy: req.auth.id,
            updatedBy: req.auth.id,
          };

          const parent = {
            schoolId: req.auth.schoolId,
            id: parentId,
            name: studentData.fatherName,
            email: studentData.parentEmail || "",
            phone: studentData.fatherPhone,
            studentId,
            fatherName: studentData.fatherName,
            fatherPhone: studentData.fatherPhone,
            motherName: String(studentData.motherName || "").trim(),
            motherPhone: String(studentData.motherPhone || "").trim(),
            status: "Active",
            createdBy: req.auth.id,
            updatedBy: req.auth.id,
          };

          newStudents.push(student);
          newParents.push(parent);
          studentIdPool.push({ id: studentId });
          parentIdPool.push({ id: parentId });
        } catch (err) {
          errors.push(`Error processing student ${studentData.name}: ${err.message}`);
        }
      }

      const existingStudentIdSet = new Set(state.students.map((entry) => String(entry.id || "")));
      const existingParentIdSet = new Set(state.parents.map((entry) => String(entry.id || "")));
      const newStudentIdSet = new Set();
      const newParentIdSet = new Set();

      for (const entry of newStudents) {
        const id = String(entry.id || "");
        if (!id || newStudentIdSet.has(id) || existingStudentIdSet.has(id)) {
          return res.status(500).json({
            message: "Bulk import aborted due to duplicate student ID generation.",
          });
        }
        newStudentIdSet.add(id);
      }

      for (const entry of newParents) {
        const id = String(entry.id || "");
        if (!id || newParentIdSet.has(id) || existingParentIdSet.has(id)) {
          return res.status(500).json({
            message: "Bulk import aborted due to duplicate parent ID generation.",
          });
        }
        newParentIdSet.add(id);
      }

      // Save to database
      const nextState = {
        ...state,
        students: [...state.students, ...newStudents],
        parents: [...state.parents, ...newParents],
      };

      const saved = await writeState(nextState);

      res.json({
        success: true,
        message: `Successfully imported ${newStudents.length} students`,
        imported: newStudents.length,
        errors: errors.length > 0 ? errors : undefined,
        students: newStudents.map((s) => ({
          id: s.id,
          name: s.name,
          admissionNumber: s.admissionNumber,
          className: s.className,
          section: s.section,
        })),
      });
    } catch (err) {
      return res.status(500).json({
        message: "Error importing students: " + err.message,
      });
    }
  })
);

app.post(
  "/api/enquiries/upsert",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_CRM),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const body = req.body || {};
    const id = String(body.id || "").trim();
    const existingEnquiry = state.enquiries.find((entry) => entry.id === id);
    const normalizedExisting = existingEnquiry
      ? normalizeEnquiryRecord(existingEnquiry)
      : null;

    const studentName = String(body.studentName || "").trim();
    const parentName = String(
      body.parentName ||
        body.guardianName ||
        normalizedExisting?.parentName ||
        normalizedExisting?.guardianName ||
        ""
    ).trim();
    const classInterest = String(body.classInterest || normalizedExisting?.classInterest || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const source = String(body.source || normalizedExisting?.source || "Website").trim() || "Website";
    const assignedTo = String(
      body.assignedTo || body.owner || normalizedExisting?.assignedTo || normalizedExisting?.owner || ""
    ).trim();
    const convertedStudentId = String(
      body.convertedStudentId || normalizedExisting?.convertedStudentId || ""
    ).trim();
    const requestedIsConverted = Object.prototype.hasOwnProperty.call(body, "isConverted")
      ? toBoolean(body.isConverted)
      : normalizedExisting?.isConverted;

    let stage = normalizeEnquiryStage(body.stage || normalizedExisting?.stage || body.status);
    if (stage === "Converted" && !convertedStudentId) {
      stage = "Applied";
    }

    const status = normalizeEnquiryStatus(body.status, stage);
    const isConverted = Boolean(convertedStudentId) || toBoolean(requestedIsConverted);
    let conversionStatus = normalizeEnquiryConversionStatus(
      body.conversionStatus || normalizedExisting?.conversionStatus,
      {
        convertedStudentId,
        stage,
        isConverted,
      }
    );
    if (conversionStatus === "Converted" && !convertedStudentId) {
      conversionStatus = isConverted ? "In Progress" : "Not Converted";
    }

    const followUpDate = String(
      body.followUpDate || normalizedExisting?.followUpDate || getTodayISO()
    )
      .trim()
      .slice(0, 10);
    const actorName =
      String(req.auth.name || assignedTo || req.auth.role || "CRM").trim() || "CRM";

    if (!studentName || !parentName || !phone || !assignedTo) {
      return res.status(400).json({
        message: "Student name, parent name, phone, and assigned-to are required.",
      });
    }

    let notes = normalizeEnquiryNotes(normalizedExisting?.notes, {
      fallbackDate: followUpDate || getTodayISO(),
      defaultAuthor: actorName,
    });

    let noteWasAppended = false;
    const notesProvided = Object.prototype.hasOwnProperty.call(body, "notes");
    if (notesProvided) {
      if (Array.isArray(body.notes)) {
        notes = normalizeEnquiryNotes(body.notes, {
          fallbackDate: followUpDate || getTodayISO(),
          defaultAuthor: actorName,
        });
      } else {
        const noteText = String(body.notes || "").trim();
        if (!noteText) {
          notes = [];
        } else {
          const lastNoteText = String(notes[notes.length - 1]?.text || "").trim();
          if (noteText !== lastNoteText) {
            notes = [...notes, createEnquiryNoteEntry(noteText, actorName)];
            noteWasAppended = true;
          }
        }
      }
    }

    let activity = Array.isArray(body.activity)
      ? normalizeEnquiryActivity(body.activity, {
          fallbackDate: followUpDate || getTodayISO(),
          defaultActor: actorName,
        })
      : normalizeEnquiryActivity(normalizedExisting?.activity, {
          fallbackDate: followUpDate || getTodayISO(),
          defaultActor: actorName,
        });

    if (!normalizedExisting) {
      activity = [
        ...activity,
        createEnquiryActivityEntry("created", "Lead created", actorName),
      ];
    } else {
      if (normalizedExisting.stage !== stage) {
        activity = [
          ...activity,
          createEnquiryActivityEntry("stage", `Moved to ${stage}`, actorName),
        ];
      }

      if (normalizedExisting.status !== status) {
        activity = [
          ...activity,
          createEnquiryActivityEntry("status", `Status changed to ${status}`, actorName),
        ];
      }

      if (normalizedExisting.followUpDate !== followUpDate) {
        activity = [
          ...activity,
          createEnquiryActivityEntry(
            "follow-up",
            `Follow-up updated to ${followUpDate}`,
            actorName
          ),
        ];
      }

      if (normalizedExisting.assignedTo !== assignedTo) {
        activity = [
          ...activity,
          createEnquiryActivityEntry(
            "assignment",
            `Assigned to ${assignedTo}`,
            actorName
          ),
        ];
      }
    }

    if (noteWasAppended) {
      activity = [
        ...activity,
        createEnquiryActivityEntry("note", "Note added", actorName),
      ];
    }

    const enquiry = {
      id: normalizedExisting?.id || getNextRecordId(state.enquiries, "E"),
      studentName,
      parentName,
      guardianName: parentName,
      classInterest,
      phone,
      email,
      source,
      assignedTo,
      owner: assignedTo,
      stage,
      status,
      followUpDate,
      notes,
      activity,
      callHistory: Array.isArray(body.callHistory)
        ? body.callHistory
        : Array.isArray(normalizedExisting?.callHistory)
          ? normalizedExisting.callHistory
          : [],
      createdAt: normalizedExisting?.createdAt || getTodayISO(),
      lastUpdatedAt: getTodayISO(),
      convertedStudentId,
      isConverted,
      conversionStatus,
    };

    const saved = await writeState({
      ...state,
      enquiries: normalizedExisting
        ? state.enquiries.map((entry) => (entry.id === enquiry.id ? enquiry : entry))
        : [...state.enquiries, enquiry],
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.get(
  "/api/enquiries",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_CRM),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const scoped = getRoleScopedState(state, req.auth);
    res.json(cloneData(scoped.enquiries || []));
  })
);

// Server-side student search with pagination
app.get(
  "/api/students/search",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_TEACHER),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);

    const rawQ = String(req.query.q || "").trim().toLowerCase();
    const page = toPositiveInteger(req.query.page, 1);
    const pageSize = toPositiveInteger(req.query.pageSize, 25);
    const sortBy = String(req.query.sortBy || "").trim();
    const sortOrder = String(req.query.sortOrder || "").trim().toLowerCase() === "desc" ? "desc" : "asc";
    const filterClass = String(req.query.className || "").trim();
    const filterSection = String(req.query.section || "").trim();
    const filterStatus = String(req.query.status || "").trim();
    const filterSource = String(req.query.admissionSource || "").trim();

    const matchStudent = (student, q) => {
      if (!q) return true;
      const parts = [
        String(student.id || ""),
        String(student.admissionNumber || ""),
        String(student.name || ""),
        String(student.fatherName || ""),
        String(student.parentName || ""),
        String(student.mobileNumber || ""),
        String(student.email || ""),
        String(student.className || ""),
        String(student.section || ""),
      ]
        .map((p) => String(p || "").toLowerCase())
        .join(" ");

      return parts.includes(q);
    };

    let filtered = (state.students || []).filter((s) => matchStudent(s, rawQ));

    if (filterClass) {
      const fc = filterClass.toLowerCase();
      filtered = filtered.filter((s) => String(s.className || "").toLowerCase() === fc);
    }

    if (filterSection) {
      const fs = filterSection.toLowerCase();
      filtered = filtered.filter((s) => String(s.section || "").toLowerCase() === fs);
    }

    if (filterStatus) {
      const fstat = filterStatus.toLowerCase();
      filtered = filtered.filter((s) => String(s.status || "").toLowerCase() === fstat);
    }

    if (filterSource) {
      const fsrc = filterSource.toLowerCase();
      filtered = filtered.filter((s) => String(s.admissionSource || "").toLowerCase() === fsrc);
    }

    // Sorting
    const allowedSortFields = new Set(["name", "admissionNumber", "id", "className", "section"]);
    if (sortBy && allowedSortFields.has(sortBy)) {
      filtered.sort((a, b) => {
        const va = String(a[sortBy] || "").toLowerCase();
        const vb = String(b[sortBy] || "").toLowerCase();
        const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" });
        return sortOrder === "desc" ? -cmp : cmp;
      });
    }

    const total = filtered.length;
    const start = Math.max(0, (page - 1) * pageSize);
    const end = Math.min(total, start + pageSize);
    const pageItems = filtered.slice(start, end).map((s) => ({
      id: s.id,
      name: s.name,
      admissionNumber: s.admissionNumber,
      className: s.className,
      section: s.section,
      mobileNumber: s.mobileNumber,
      email: s.email,
      fatherName: s.fatherName,
      parentName: s.parentName,
    }));

    res.json({
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      students: pageItems,
    });
  })
);

// Return distinct classes, sections, admission sources and statuses with counts
app.get(
  "/api/students/filters",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_CRM, ROLE_TEACHER),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const students = Array.isArray(state.students) ? state.students : [];

    const counts = {
      classes: new Map(),
      sections: new Map(),
      admissionSources: new Map(),
      statuses: new Map(),
    };

    for (const s of students) {
      const className = String(s.className || "").trim();
      const section = String(s.section || "").trim();
      const source = String(s.admissionSource || "").trim();
      const status = String(s.status || "").trim();

      if (className) counts.classes.set(className, (counts.classes.get(className) || 0) + 1);
      if (section) counts.sections.set(section, (counts.sections.get(section) || 0) + 1);
      if (source) counts.admissionSources.set(source, (counts.admissionSources.get(source) || 0) + 1);
      if (status) counts.statuses.set(status, (counts.statuses.get(status) || 0) + 1);
    }

    const toList = (map) =>
      Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      classes: toList(counts.classes),
      sections: toList(counts.sections),
      admissionSources: toList(counts.admissionSources),
      statuses: toList(counts.statuses),
    });
  })
);

app.put(
  "/api/enquiries/:id/stage",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_CRM),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const enquiryId = String(req.params.id || "").trim();
    const stageInput = String(req.body?.stage || "").trim();

    if (!enquiryId || !stageInput) {
      return res.status(400).json({ message: "Enquiry id and stage are required." });
    }

    if (!isKnownEnquiryStageInput(stageInput)) {
      return res.status(400).json({ message: "Invalid enquiry stage provided." });
    }

    const enquiry = state.enquiries.find((entry) => entry.id === enquiryId);
    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found." });
    }

    const nextStage = normalizeEnquiryStage(stageInput);
    const normalizedEnquiry = normalizeEnquiryRecord(enquiry);
    const actorName = String(req.auth.name || req.auth.role || "CRM").trim() || "CRM";

    if (normalizedEnquiry.convertedStudentId && nextStage !== "Converted") {
      return res.status(400).json({
        message: "Converted enquiries cannot move back to earlier stages.",
      });
    }

    if (nextStage === "Converted" && !normalizedEnquiry.convertedStudentId) {
      return res.status(400).json({
        message: "Complete admission first. Converted stage is set after student creation.",
      });
    }

    if (normalizedEnquiry.stage === nextStage) {
      return res.json(cloneData(getRoleScopedState(state, req.auth)));
    }

    const allowedStages = getAllowedEnquiryStageTransitions(normalizedEnquiry.stage, {
      convertedStudentId: normalizedEnquiry.convertedStudentId,
    });
    if (
      !isValidEnquiryStageTransition(normalizedEnquiry.stage, nextStage, {
        convertedStudentId: normalizedEnquiry.convertedStudentId,
      })
    ) {
      return res.status(400).json({
        message: allowedStages.length
          ? `Invalid stage transition. Allowed from ${normalizedEnquiry.stage}: ${allowedStages.join(", ")}.`
          : `${normalizedEnquiry.stage} is a terminal stage and cannot be moved.`,
      });
    }

    const nextStatus = normalizeEnquiryStatus(nextStage, nextStage);
    const activity = [
      ...normalizedEnquiry.activity,
      createEnquiryActivityEntry("stage", `Moved to ${nextStage}`, actorName),
    ];

    const saved = await writeState({
      ...state,
      enquiries: state.enquiries.map((entry) =>
        entry.id === enquiryId
          ? {
              ...normalizedEnquiry,
              stage: nextStage,
              status: nextStatus,
              activity,
              lastUpdatedAt: getTodayISO(),
            }
          : entry
      ),
    });

    return res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.delete(
  "/api/enquiries/:id",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_CRM),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const enquiryId = String(req.params.id || "");
    const exists = state.enquiries.some((entry) => entry.id === enquiryId);

    if (!exists) {
      return res.status(404).json({ message: "Enquiry not found." });
    }

    const saved = await writeState({
      ...state,
      enquiries: state.enquiries.filter((entry) => entry.id !== enquiryId),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/enquiries/:id/convert",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_CRM),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const enquiryId = String(req.params.id || "");
    const enquiry = state.enquiries.find((entry) => entry.id === enquiryId);

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found." });
    }

    const normalizedEnquiry = normalizeEnquiryRecord(enquiry);
    if (normalizedEnquiry.convertedStudentId) {
      return res.json(cloneData(getRoleScopedState(state, req.auth)));
    }

    if (normalizedEnquiry.isConverted && normalizedEnquiry.conversionStatus === "In Progress") {
      return res.json(cloneData(getRoleScopedState(state, req.auth)));
    }

    const actorName = String(req.auth.name || req.auth.role || "CRM").trim() || "CRM";
    const conversionText =
      "Conversion started. Open admission form and complete mandatory details to create student.";
    const nextStage = normalizedEnquiry.stage === "Rejected" ? "Contacted" : "Applied";
    const nextStatus = normalizeEnquiryStatus("Active", nextStage);

    const saved = await writeState({
      ...state,
      enquiries: state.enquiries.map((entry) => {
        if (entry.id !== enquiryId) {
          return entry;
        }

        return {
          ...normalizedEnquiry,
          stage: nextStage,
          status: nextStatus,
          isConverted: true,
          conversionStatus: "In Progress",
          convertedStudentId: "",
          notes: [
            ...normalizedEnquiry.notes,
            createEnquiryNoteEntry(conversionText, actorName),
          ],
          activity: [
            ...normalizedEnquiry.activity,
            createEnquiryActivityEntry("conversion", conversionText, actorName),
          ],
          lastUpdatedAt: getTodayISO(),
        };
      }),
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/attendance/upsert",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_TEACHER),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const id = String(req.body?.id || "").trim();
    const className = String(req.body?.className || "").trim();
    const date = String(req.body?.date || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const records = Array.isArray(req.body?.records) ? req.body.records : [];
    const teacherId =
      req.auth.role === ROLE_TEACHER
        ? req.auth.id
        : String(req.body?.teacherId || "").trim();

    if (!className || !date || !subject || !teacherId) {
      return res.status(400).json({
        message: "Class, date, subject, teacher, and records are required.",
      });
    }

    const existingAttendance = state.attendance.find((entry) => {
      if (id && entry.id === id) return true;
      return (
        entry.className === className &&
        entry.date === date &&
        entry.teacherId === teacherId
      );
    });

    if (
      req.auth.role === ROLE_TEACHER &&
      existingAttendance &&
      existingAttendance.teacherId !== req.auth.id
    ) {
      return res
        .status(403)
        .json({ message: "You can only modify attendance assigned to you." });
    }

    const teacherForScope =
      req.auth.role === ROLE_TEACHER
        ? findTeacherByAuth(state, req.auth)
        :
            state.teachers.find(
              (entry) => String(entry.id || "").trim() === teacherId
            ) || null;

    if (!teacherForScope) {
      if (req.auth.role === ROLE_TEACHER) {
        return res.status(403).json({
          message: "Only active teacher accounts can submit attendance.",
        });
      }

      return res.status(404).json({ message: "Teacher not found." });
    }

    const teacherClassScope = buildTeacherClassScopeSet(teacherForScope, state);
    if (!teacherClassScope.has(normalizeAssignedClassValue(className))) {
      return res.status(403).json({
        message:
          req.auth.role === ROLE_TEACHER
            ? "You can only submit attendance for your assigned classes."
            : "Selected teacher is not assigned to the selected class.",
      });
    }

    const hasInvalidRecord = records.some((record) => {
      const studentId = String(record?.studentId || "").trim();
      if (!studentId) {
        return true;
      }

      const student = state.students.find((entry) => entry.id === studentId);
      if (!student) {
        return true;
      }

      if (!isStudentInTeacherClassScope(student, teacherClassScope)) {
        return true;
      }

      return !isStudentInClassScope(student, className);
    });

    if (hasInvalidRecord) {
      return res.status(400).json({
        message:
          "Attendance records contain students outside the selected assigned class.",
      });
    }

    const attendance = {
      id: existingAttendance?.id || getNextRecordId(state.attendance, "A"),
      className,
      date,
      subject,
      teacherId,
      records,
    };

    const nextState = {
      ...state,
      attendance: existingAttendance
        ? state.attendance.map((entry) =>
            entry.id === existingAttendance.id ? attendance : entry
          )
        : [...state.attendance, attendance],
      students: applyAttendanceDelta(
        state.students,
        existingAttendance?.records,
        records
      ),
    };

    const saved = await writeState(nextState);
    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.post(
  "/api/results/upsert",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_TEACHER),
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const id = String(req.body?.id || "").trim();
    const studentId = String(req.body?.studentId || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const exam = String(req.body?.exam || "").trim();
    const marks = toNumber(req.body?.marks);
    const maxMarks = toNumber(req.body?.maxMarks) || 100;
    const teacherId =
      req.auth.role === ROLE_TEACHER
        ? req.auth.id
        : String(req.body?.teacherId || "").trim();
    const publishedDate =
      String(req.body?.publishedDate || "").trim() || getTodayISO();

    if (!studentId || !subject || !exam || !teacherId) {
      return res
        .status(400)
        .json({ message: "Student, subject, exam, and teacher are required." });
    }

    const existingResult = state.results.find((entry) => entry.id === id);
    if (
      req.auth.role === ROLE_TEACHER &&
      existingResult &&
      existingResult.teacherId !== req.auth.id
    ) {
      return res
        .status(403)
        .json({ message: "You can only modify results assigned to you." });
    }

    const teacherForScope =
      req.auth.role === ROLE_TEACHER
        ? findTeacherByAuth(state, req.auth)
        :
            state.teachers.find(
              (entry) => String(entry.id || "").trim() === teacherId
            ) || null;

    if (!teacherForScope) {
      if (req.auth.role === ROLE_TEACHER) {
        return res.status(403).json({
          message: "Only active teacher accounts can submit results.",
        });
      }

      return res.status(404).json({ message: "Teacher not found." });
    }

    const student = state.students.find((entry) => entry.id === studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    const teacherClassScope = buildTeacherClassScopeSet(teacherForScope, state);
    if (!isStudentInTeacherClassScope(student, teacherClassScope)) {
      return res.status(403).json({
        message:
          req.auth.role === ROLE_TEACHER
            ? "You can only submit results for students in your assigned classes."
            : "Selected teacher is not assigned to this student class.",
      });
    }

    const result = {
      id: existingResult?.id || getNextRecordId(state.results, "R"),
      studentId,
      subject,
      exam,
      marks,
      maxMarks,
      teacherId,
      publishedDate,
    };

    const saved = await writeState({
      ...state,
      results: existingResult
        ? state.results.map((entry) => (entry.id === existingResult.id ? result : entry))
        : [...state.results, result],
    });

    res.json(cloneData(getRoleScopedState(saved, req.auth)));
  })
);

app.get(
  "/api/students/:email/dashboard",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_STUDENT),
  dashboardReadRateLimiter,
  asyncRoute(async (req, res) => {
    const studentEmail = decodeURIComponent(String(req.params.email || "")).toLowerCase();

    if (req.auth.role === ROLE_STUDENT && req.auth.email !== studentEmail) {
      return res.status(403).json({
        message: "You can only access your own student dashboard.",
      });
    }

    const state = await getStateFromRequest(req);
    const student = state.students.find(
      (entry) => String(entry.email || "").toLowerCase() === studentEmail
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.json(buildStudentDashboard(student, state));
  })
);

app.get(
  "/api/teachers/:email",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_TEACHER),
  dashboardReadRateLimiter,
  asyncRoute(async (req, res) => {
    const teacherEmail = decodeURIComponent(String(req.params.email || "")).toLowerCase();

    if (req.auth.role === ROLE_TEACHER && req.auth.email !== teacherEmail) {
      return res.status(403).json({
        message: "You can only access your own teacher dashboard.",
      });
    }

    let state = await getStateFromRequest(req);
    const teacher = state.teachers.find(
      (entry) => String(entry.email || "").toLowerCase() === teacherEmail
    );

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Automatically clean up orphaned data before building dashboard
    const studentIds = new Set(state.students.map((s) => String(s.id || "")));
    const teacherIds = new Set(state.teachers.map((t) => String(t.id || "")));

    const cleanedAttendance = state.attendance
      .map((entry) => ({
        ...entry,
        records: (entry.records || []).filter((record) => studentIds.has(String(record.studentId || ""))),
      }))
      .filter((entry) => Array.isArray(entry.records) && entry.records.length > 0);

    const cleanedResults = state.results.filter((entry) => {
      const studentExists = studentIds.has(String(entry.studentId || ""));
      const teacherExists = teacherIds.has(String(entry.teacherId || ""));
      return studentExists && (entry.teacherId ? teacherExists : true);
    });

    // Use cleaned state for dashboard calculation
    state = {
      ...state,
      attendance: cleanedAttendance,
      results: cleanedResults,
    };

    return res.json(buildTeacherDashboard(teacher, state));
  })
);

app.get(
  "/api/parents/:email/dashboard",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_PARENT),
  dashboardReadRateLimiter,
  asyncRoute(async (req, res) => {
    const parentEmail = decodeURIComponent(String(req.params.email || "")).toLowerCase();

    if (req.auth.role === ROLE_PARENT && req.auth.email !== parentEmail) {
      return res.status(403).json({
        message: "You can only access your own parent dashboard.",
      });
    }

    const state = await getStateFromRequest(req);
    const parent = state.parents.find(
      (entry) => String(entry.email || "").toLowerCase() === parentEmail
    );

    if (!parent) {
      return res.status(404).json({ message: "Parent not found" });
    }

    const linkedChildren = state.students.filter((student) => {
      if (String(student.parentId || "") === String(parent.id)) return true;
      if (String(student.parentEmail || "").toLowerCase() === parentEmail) return true;
      if (parent.studentId && String(student.id) === String(parent.studentId)) return true;
      return false;
    });

    const childDashboards = linkedChildren.map((child) =>
      buildStudentDashboard(child, state)
    );

    const parentNotices = (Array.isArray(state.notices) ? state.notices : [])
      .filter((notice) => noticeMatchesRole(notice, ROLE_PARENT))
      .sort((first, second) => {
        const firstDate = String(first.updatedAt || first.date || first.createdAt || "");
        const secondDate = String(second.updatedAt || second.date || second.createdAt || "");
        return secondDate.localeCompare(firstDate);
      })
      .slice(0, 15)
      .map((notice, index) => {
        const todayISO = getTodayISO();
        const rawDate = String(notice.updatedAt || notice.date || notice.createdAt || todayISO).trim();
        const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : todayISO;
        const ageMs = Math.max(Date.now() - new Date(`${date}T00:00:00`).getTime(), 0);

        return {
          id: notice.id || `notice-${index}`,
          title: notice.title || "School notice",
          message: notice.message || "New update available.",
          date,
          isNew: ageMs <= 3 * 24 * 60 * 60 * 1000,
        };
      });

    const alerts = [];
    childDashboards.forEach((child) => {
      const childLabel = child.name || "Your child";

      if (child.attendance?.percent < 75 && child.attendance?.total > 0) {
        alerts.push({
          id: `alert-attendance-${child.studentId}`,
          type: "attendance",
          severity: child.attendance.percent < 50 ? "critical" : "warning",
          message: `${childLabel} has low attendance: ${child.attendance.percent}%`,
          childId: child.studentId,
        });
      }

      if (child.fees?.due > 0) {
        const dueDate = child.fees?.dueDate || "";
        const isDueSoon = dueDate && dueDate <= getTodayISO();
        alerts.push({
          id: `alert-fee-${child.studentId}`,
          type: "fee",
          severity: isDueSoon ? "critical" : "warning",
          message: isDueSoon
            ? `Fee overdue for ${childLabel}: ₹${child.fees.due}`
            : `Fee due for ${childLabel}: ₹${child.fees.due}`,
          childId: child.studentId,
        });
      }

      const pendingAssignments = (child.assignments || []).filter(
        (a) => a.status === "Pending" || a.status === "Overdue"
      );
      if (pendingAssignments.length > 0) {
        const overdueCount = pendingAssignments.filter((a) => a.status === "Overdue").length;
        alerts.push({
          id: `alert-assignment-${child.studentId}`,
          type: "assignment",
          severity: overdueCount > 0 ? "critical" : "info",
          message: overdueCount > 0
            ? `${childLabel} has ${overdueCount} overdue assignment(s)`
            : `${childLabel} has ${pendingAssignments.length} pending assignment(s)`,
          childId: child.studentId,
        });
      }

      if (child.performance?.weakSubject && child.performance.weakSubject.averageMarks < 40) {
        alerts.push({
          id: `alert-marks-${child.studentId}`,
          type: "marks",
          severity: "warning",
          message: `${childLabel} needs improvement in ${child.performance.weakSubject.subject} (${child.performance.weakSubject.averageMarks}%)`,
          childId: child.studentId,
        });
      }

      if (child.performance?.averageMarks > 0 && child.performance.averageMarks < 40) {
        alerts.push({
          id: `alert-overall-marks-${child.studentId}`,
          type: "marks",
          severity: "critical",
          message: `${childLabel} overall average is very low: ${child.performance.averageMarks}%`,
          childId: child.studentId,
        });
      }
    });

    alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    });

    const childClassCandidates = linkedChildren.flatMap((child) => [
      formatAssignedClassLabel(child.className, child.section),
      child.className,
    ].map((e) => normalizeAssignedClassValue(e)).filter(Boolean));

    const classTeachers = (Array.isArray(state.teachers) ? state.teachers : [])
      .filter((teacher) =>
        normalizeClassList(teacher.classes).some((entry) =>
          childClassCandidates.includes(normalizeAssignedClassValue(entry))
        )
      )
      .map((teacher) => ({
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        subject: getTeacherPrimarySubject(teacher),
        subjects: normalizeTeacherSubjects(teacher),
      }));

    return res.json({
      parent: {
        id: parent.id,
        name: parent.name,
        email: parent.email,
        phone: parent.phone,
        fatherName: parent.fatherName,
        motherName: parent.motherName,
      },
      children: childDashboards,
      teachers: classTeachers,
      alerts,
      notices: parentNotices,
    });
  })
);

app.post(
  "/api/messages",
  authenticate,
  requireRoles(ROLE_PARENT),
  parentMessageWriteRateLimiter,
  asyncRoute(async (req, res) => {
    const state = await getStateFromRequest(req);
    const body = req.body || {};
    const messageBody = String(body.body || "").trim();
    const subject = String(body.subject || "").trim();
    const teacherId = String(body.teacherId || "").trim();
    const teacherNameInput = String(body.teacherName || "").trim();
    const childIdInput = String(body.childId || "").trim();
    const childNameInput = String(body.childName || "").trim();

    if (!messageBody) {
      return res.status(400).json({ message: "Message body is required." });
    }

    if (!teacherId) {
      return res.status(400).json({ message: "Teacher selection is required." });
    }

    const parent = findParentByAuth(state, req.auth);
    if (!parent) {
      return res.status(403).json({
        message: "Authenticated parent account was not found.",
      });
    }

    const teacher = state.teachers.find(
      (entry) => String(entry.id || "").trim() === teacherId
    );
    if (!teacher) {
      return res.status(404).json({ message: "Selected teacher was not found." });
    }

    const parentEmail = String(parent.email || req.auth.email || "")
      .trim()
      .toLowerCase();
    const linkedChildren = state.students.filter((student) => {
      if (String(student.parentId || "") === String(parent.id || "")) {
        return true;
      }

      if (
        String(student.parentEmail || "").trim().toLowerCase() === parentEmail &&
        parentEmail
      ) {
        return true;
      }

      if (parent.studentId && String(student.id || "") === String(parent.studentId || "")) {
        return true;
      }

      return false;
    });

    let childId = childIdInput;
    let childName = childNameInput;

    if (childId) {
      const selectedChild = linkedChildren.find(
        (student) => String(student.id || "") === childId
      );

      if (!selectedChild) {
        return res.status(403).json({
          message: "You can only message regarding children linked to your account.",
        });
      }

      childId = String(selectedChild.id || "");
      childName = String(selectedChild.name || "");
    }

    if (!childId && linkedChildren.length === 1) {
      childId = String(linkedChildren[0].id || "");
      childName = String(linkedChildren[0].name || "");
    }

    if (childId) {
      const selectedChild = linkedChildren.find(
        (student) => String(student.id || "") === childId
      );

      if (selectedChild) {
        const childClassCandidates = getClassScopeCandidates(
          selectedChild.className,
          selectedChild.section
        );
        const teacherClassCandidates = normalizeClassList(teacher.classes)
          .map((entry) => normalizeAssignedClassValue(entry))
          .filter(Boolean);

        if (
          childClassCandidates.length &&
          teacherClassCandidates.length &&
          !teacherClassCandidates.some((entry) => childClassCandidates.includes(entry))
        ) {
          return res.status(403).json({
            message: "Selected teacher is not assigned to the chosen child class.",
          });
        }
      }
    }

    const parentId = String(parent.id || "").trim();
    const parentName = String(parent.name || req.auth.name || "").trim();

    const newMessage = new Message({
      schoolId: normalizeSchoolId(req.auth.schoolId),
      parentId,
      parentEmail,
      parentName,
      teacherId,
      teacherName: String(teacher.name || "").trim() || teacherNameInput,
      childId,
      childName,
      subject: subject || "General",
      body: messageBody,
      sentAt: new Date().toISOString(),
      direction: "parent-to-teacher",
      readByTeacher: false,
      readByParent: true,
    });

    await newMessage.save();

    return res.status(201).json({
      id: newMessage._id.toString(),
      parentId: newMessage.parentId,
      parentName: newMessage.parentName,
      teacherId: newMessage.teacherId,
      teacherName: newMessage.teacherName,
      childId: newMessage.childId,
      childName: newMessage.childName,
      subject: newMessage.subject,
      body: newMessage.body,
      sentAt: newMessage.sentAt,
      direction: newMessage.direction,
    });
  })
);

app.get(
  "/api/messages/:parentId",
  authenticate,
  requireRoles(ROLE_ADMIN, ROLE_PARENT),
  parentMessageReadRateLimiter,
  asyncRoute(async (req, res) => {
    const parentId = String(req.params.parentId || "").trim();

    if (!parentId) {
      return res.status(400).json({ message: "Parent ID is required." });
    }

    if (req.auth.role === ROLE_PARENT) {
      const state = await getStateFromRequest(req);
      const parent = findParentByAuth(state, req.auth);

      if (!parent) {
        return res.status(403).json({ message: "Parent account was not found." });
      }

      if (String(parent.id || "").trim() !== parentId) {
        return res.status(403).json({
          message: "You can only access your own message history.",
        });
      }
    }

    const messages = await Message.find({
      schoolId: normalizeSchoolId(req.auth.schoolId),
      parentId,
    })
      .sort({ sentAt: -1 })
      .limit(50)
      .lean();

    const formatted = messages.map((msg) => ({
      id: msg._id.toString(),
      parentId: msg.parentId,
      parentName: msg.parentName,
      teacherId: msg.teacherId,
      teacherName: msg.teacherName,
      childId: msg.childId,
      childName: msg.childName,
      subject: msg.subject,
      body: msg.body,
      sentAt: msg.sentAt,
      direction: msg.direction,
    }));

    return res.json(formatted);
  })
);

app.use((error, req, res, next) => {
  const statusCode = Number(error.statusCode || 500);
  const message = error.message || "Internal server error";

  console.error("API error", error);
  res.status(statusCode).json({ message });
});

const startServer = async () => {
  await mongoose.connect(MONGO_URI);
  studentDocumentBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: GRIDFS_BUCKET_NAME,
  });

  const server = app.listen(PORT, HOST, () => {
    console.log(`School CRM backend listening on ${HOST}:${PORT}`);
  });

  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      console.error(
        `Failed to start backend: ${HOST}:${PORT} is already in use. Stop the existing process or use a different port.`
      );
      process.exit(1);
      return;
    }

    console.error("Backend server error", error);
    process.exit(1);
  });
};

startServer().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
