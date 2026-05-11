import { useContext } from "react";
import SchoolDataContext from "../context/school-data-context";

function useSchoolData() {
  const ctx = useContext(SchoolDataContext);
  if (!ctx) {
    throw new Error("useSchoolData must be used inside SchoolDataProvider");
  }
  return ctx;
}

export default useSchoolData;
