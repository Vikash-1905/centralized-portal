export const SCHOOL_DATA_VERSION = 4;

export const createInitialSchoolData = () => ({
  version: SCHOOL_DATA_VERSION,
  users: [],
  classes: [],
  sections: [],
  subjects: [],
  departments: [],
  teachers: [],
  students: [],
  parents: [],
  attendance: [],
  results: [],
  enquiries: [],
  notices: [],
});
