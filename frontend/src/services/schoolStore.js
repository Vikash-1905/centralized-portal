import {
  SCHOOL_DATA_VERSION,
  createInitialSchoolData,
} from "../data/schoolSeed";

const cloneData = (value) => JSON.parse(JSON.stringify(value));

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

const getTeacherSubjects = (teacher = {}) =>
  [...new Set([...normalizeSubjectList(teacher.subjects), ...normalizeSubjectList(teacher.subject)])];

const normalizeTeacherRecord = (teacher) => {
  const subjectList = getTeacherSubjects(teacher);

  return {
    ...teacher,
    subject: subjectList[0] || "",
    subjects: subjectList,
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

const normalizeSchoolData = (incoming) => {
  const seed = createInitialSchoolData();
  if (!incoming || typeof incoming !== "object") {
    return seed;
  }

  const teachers = Array.isArray(incoming.teachers)
    ? incoming.teachers.map(normalizeTeacherRecord)
    : seed.teachers;

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
    ...(Array.isArray(incoming.students) ? incoming.students : seed.students).map(
      (student) => student.className
    ),
  ]);

  return {
    ...seed,
    ...incoming,
    version: SCHOOL_DATA_VERSION,
    users: Array.isArray(incoming.users) ? incoming.users : seed.users,
    classes,
    subjects,
    departments,
    teachers,
    students: Array.isArray(incoming.students) ? incoming.students : seed.students,
    parents: Array.isArray(incoming.parents) ? incoming.parents : seed.parents,
    attendance: Array.isArray(incoming.attendance)
      ? incoming.attendance
      : seed.attendance,
    results: Array.isArray(incoming.results) ? incoming.results : seed.results,
    enquiries: Array.isArray(incoming.enquiries)
      ? incoming.enquiries
      : seed.enquiries,
    notices: Array.isArray(incoming.notices) ? incoming.notices : seed.notices,
  };
};

export const readSchoolState = () => {
  return createInitialSchoolData();
};

export const writeSchoolState = (state) => {
  return normalizeSchoolData(state);
};

export const resetSchoolState = () => {
  const seed = createInitialSchoolData();
  return seed;
};

export const getNextRecordId = (records, prefix) => {
  const highest = records.reduce((max, record) => {
    const value = Number(String(record.id || "").replace(prefix, ""));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);

  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
};

export const createUniqueEmail = (records, fallbackName, domain = "schoolcrm.com") => {
  const baseName = String(fallbackName || "user")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  const baseEmail = `${baseName || "user"}@${domain}`;
  const emails = new Set(
    records
      .map((record) => record.email?.toLowerCase())
      .filter(Boolean)
  );

  if (!emails.has(baseEmail)) {
    return baseEmail;
  }

  let counter = 2;
  let nextEmail = `${baseName || "user"}.${counter}@${domain}`;
  while (emails.has(nextEmail)) {
    counter += 1;
    nextEmail = `${baseName || "user"}.${counter}@${domain}`;
  }

  return nextEmail;
};

export const getTodayISO = () => new Date().toISOString().slice(0, 10);

export const cloneSchoolState = (state) => cloneData(normalizeSchoolData(state));
