import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SchoolDataContext from "./school-data-context";
import { createInitialSchoolData } from "../data/schoolSeed";
import { cloneSchoolState } from "../services/schoolStore";
import {
  addClassMaster,
  addDepartmentMaster,
  addSubjectMaster,
  cleanupOrphanedData,
  convertEnquiryToStudent,
  deleteClassMaster,
  deleteDepartmentMaster,
  resetAccountPassword,
  removeNotice,
  fetchSchoolState,
  removeEnquiry,
  removeStudent,
  removeSystemUser,
  removeTeacher,
  renameClassMaster,
  deleteSubjectMaster,
  renameDepartmentMaster,
  renameSubjectMaster,
  resetRemoteSchoolState,
  resetTeacherCredential,
  updateAccountStatus,
  updateEnquiryStage,
  upsertAttendance,
  upsertEnquiry,
  upsertNotice,
  upsertResult,
  upsertStudent,
  upsertSystemUser,
  upsertTeacher,
} from "../services/schoolApi";
import useAuth from "../hooks/useAuth";

const AUTO_SYNC_INTERVAL_MS = 10000;

export function SchoolDataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [schoolData, setSchoolData] = useState(() => createInitialSchoolData());
  const [isSyncing, setIsSyncing] = useState(false);
  const schoolDataRef = useRef(schoolData);
  const syncOpsCountRef = useRef(0);
  const mutationQueueRef = useRef(Promise.resolve());

  const beginSync = useCallback(() => {
    syncOpsCountRef.current += 1;
    if (syncOpsCountRef.current === 1) {
      setIsSyncing(true);
    }
  }, []);

  const endSync = useCallback(() => {
    syncOpsCountRef.current = Math.max(syncOpsCountRef.current - 1, 0);
    if (syncOpsCountRef.current === 0) {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    schoolDataRef.current = schoolData;
  }, [schoolData]);

  const applyRemoteState = useCallback((remoteState) => {
    const nextState = cloneSchoolState(remoteState);
    schoolDataRef.current = nextState;
    setSchoolData(nextState);
    return nextState;
  }, []);

  const resetLocalState = useCallback(() => {
    const nextState = createInitialSchoolData();
    schoolDataRef.current = nextState;
    setSchoolData(nextState);
  }, []);

  const refreshSchoolData = useCallback(
    async (options = {}) => {
      const { silent = false } = options;

      if (!silent) {
        beginSync();
      }

      try {
        const remoteState = await fetchSchoolState();
        return applyRemoteState(remoteState);
      } finally {
        if (!silent) {
          endSync();
        }
      }
    },
    [applyRemoteState, beginSync, endSync]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      mutationQueueRef.current = Promise.resolve();
      syncOpsCountRef.current = 0;
      setIsSyncing(false);
      resetLocalState();
      return;
    }

    let isMounted = true;

    const loadSchoolData = async () => {
      try {
        await refreshSchoolData();
        if (!isMounted) return;
      } catch (error) {
        console.error("Failed to load school data from API", error);
      }
    };

    void loadSchoolData();

    const intervalId = setInterval(() => {
      if (!isMounted || syncOpsCountRef.current > 0) {
        return;
      }

      void refreshSchoolData({ silent: true }).catch((error) => {
        if (!isMounted) {
          return;
        }

        console.error("Failed to refresh school data from API", error);
      });
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isAuthenticated, refreshSchoolData, resetLocalState]);

  const runMutation = useCallback(
    (requestFn) => {
      if (!isAuthenticated) {
        return Promise.reject(new Error("Please login to continue."));
      }

      const executeMutation = async () => {
        beginSync();
        try {
          const remoteState = await requestFn();
          return applyRemoteState(remoteState);
        } finally {
          endSync();
        }
      };

      const queuedMutation = mutationQueueRef.current.then(
        executeMutation,
        executeMutation
      );

      mutationQueueRef.current = queuedMutation.catch(() => {});
      return queuedMutation;
    },
    [applyRemoteState, beginSync, endSync, isAuthenticated]
  );

  const resetData = useCallback(async () => {
    if (!isAuthenticated) {
      resetLocalState();
      return;
    }
    try {
      await runMutation(() => resetRemoteSchoolState());
    } catch (error) {
      console.error("Failed to reset school data", error);
      throw error;
    }
  }, [isAuthenticated, resetLocalState, runMutation]);

  const cleanupData = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      await runMutation(() => cleanupOrphanedData());
    } catch (error) {
      console.error("Failed to cleanup orphaned data", error);
      throw error;
    }
  }, [isAuthenticated, runMutation]);

  const saveTeacher = useCallback(
    (formData) => runMutation(() => upsertTeacher(formData)),
    [runMutation]
  );

  const createSubject = useCallback(
    (name) => runMutation(() => addSubjectMaster(name)),
    [runMutation]
  );

  const createClass = useCallback(
    (name) => runMutation(() => addClassMaster(name)),
    [runMutation]
  );

  const renameClass = useCallback(
    (currentName, nextName) => runMutation(() => renameClassMaster(currentName, nextName)),
    [runMutation]
  );

  const deleteClass = useCallback(
    (name) => runMutation(() => deleteClassMaster(name)),
    [runMutation]
  );

  const renameSubject = useCallback(
    (currentName, nextName) =>
      runMutation(() => renameSubjectMaster(currentName, nextName)),
    [runMutation]
  );

  const deleteSubject = useCallback(
    (name) => runMutation(() => deleteSubjectMaster(name)),
    [runMutation]
  );

  const createDepartment = useCallback(
    (name) => runMutation(() => addDepartmentMaster(name)),
    [runMutation]
  );

  const renameDepartment = useCallback(
    (currentName, nextName) =>
      runMutation(() => renameDepartmentMaster(currentName, nextName)),
    [runMutation]
  );

  const deleteDepartment = useCallback(
    (name) => runMutation(() => deleteDepartmentMaster(name)),
    [runMutation]
  );

  const deleteTeacher = useCallback(
    (teacherId) => runMutation(() => removeTeacher(teacherId)),
    [runMutation]
  );

  const resetTeacherPassword = useCallback(
    (teacherId, password) =>
      runMutation(() => resetTeacherCredential(teacherId, password)),
    [runMutation]
  );

  const saveStudent = useCallback(
    (formData) => runMutation(() => upsertStudent(formData)),
    [runMutation]
  );

  const deleteStudent = useCallback(
    (studentId) => runMutation(() => removeStudent(studentId)),
    [runMutation]
  );

  const saveAttendance = useCallback(
    (payload) => runMutation(() => upsertAttendance(payload)),
    [runMutation]
  );

  const saveResult = useCallback(
    (payload) => runMutation(() => upsertResult(payload)),
    [runMutation]
  );

  const saveEnquiry = useCallback(
    (formData) => runMutation(() => upsertEnquiry(formData)),
    [runMutation]
  );

  const deleteEnquiry = useCallback(
    (enquiryId) => runMutation(() => removeEnquiry(enquiryId)),
    [runMutation]
  );

  const convertEnquiry = useCallback(
    (enquiryId) => runMutation(() => convertEnquiryToStudent(enquiryId)),
    [runMutation]
  );

  const moveEnquiryStage = useCallback(
    (enquiryId, stage) => runMutation(() => updateEnquiryStage(enquiryId, stage)),
    [runMutation]
  );

  const saveNotice = useCallback(
    (payload) => runMutation(() => upsertNotice(payload)),
    [runMutation]
  );

  const deleteNotice = useCallback(
    (noticeId) => runMutation(() => removeNotice(noticeId)),
    [runMutation]
  );

  const saveSystemUser = useCallback(
    (payload) => runMutation(() => upsertSystemUser(payload)),
    [runMutation]
  );

  const deleteSystemUser = useCallback(
    (userId) => runMutation(() => removeSystemUser(userId)),
    [runMutation]
  );

  const setAccountStatus = useCallback(
    (role, id, status) => runMutation(() => updateAccountStatus(role, id, status)),
    [runMutation]
  );

  const resetUserPassword = useCallback(
    (role, id, password) => runMutation(() => resetAccountPassword(role, id, password)),
    [runMutation]
  );

  const value = useMemo(
    () => ({
      schoolData,
      isSyncing,
      refreshSchoolData,
      resetData,
      cleanupData,
      createClass,
      renameClass,
      deleteClass,
      createSubject,
      renameSubject,
      deleteSubject,
      createDepartment,
      renameDepartment,
      deleteDepartment,
      saveTeacher,
      deleteTeacher,
      resetTeacherPassword,
      saveStudent,
      deleteStudent,
      saveAttendance,
      saveResult,
      saveEnquiry,
      deleteEnquiry,
      convertEnquiry,
      moveEnquiryStage,
      saveNotice,
      deleteNotice,
      saveSystemUser,
      deleteSystemUser,
      setAccountStatus,
      resetUserPassword,
    }),
    [
      createDepartment,
      createClass,
      createSubject,
      convertEnquiry,
      moveEnquiryStage,
      deleteClass,
      deleteNotice,
      deleteDepartment,
      deleteEnquiry,
      deleteSubject,
      deleteStudent,
      deleteSystemUser,
      deleteTeacher,
      isSyncing,
      renameDepartment,
      renameClass,
      renameSubject,
      resetUserPassword,
      resetData,
      cleanupData,
      resetTeacherPassword,
      saveNotice,
      saveAttendance,
      saveEnquiry,
      saveResult,
      saveStudent,
      saveSystemUser,
      saveTeacher,
      setAccountStatus,
      schoolData,
      refreshSchoolData,
    ]
  );

  return (
    <SchoolDataContext.Provider value={value}>
      {children}
    </SchoolDataContext.Provider>
  );
}
