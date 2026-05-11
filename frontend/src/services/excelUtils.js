/**
 * Excel utilities for student bulk import
 */

// Import XLSX dynamically to avoid build issues
let XLSX = null;

const initXLSX = async () => {
  if (!XLSX) {
    const xlsxModule = await import("xlsx");
    XLSX = xlsxModule?.default || xlsxModule;
  }
  return XLSX;
};

/**
 * Download a sample Excel template for bulk student import
 */
export const downloadSampleExcel = async () => {
  try {
    const XLSX_LIB = await initXLSX();

    const sampleData = [
      {
        Name: "Rahul Kumar",
        DateOfBirth: "2010-05-15",
        Gender: "Male",
        AadhaarNumber: "123412341234",
        MobileNumber: "9876543210",
        Email: "rahul@test.com",
        Address: "123 School Road",
        City: "Mumbai",
        State: "Maharashtra",
        Pincode: "400001",
        Class: "6",
        FatherName: "Amit Kumar",
        FatherPhone: "9876543200",
        MotherName: "Sunita Kumar",
        MotherPhone: "9876543299",
        RollNumber: "601",
        AdmissionNumber: "AUTO-2024-001",
        ParentEmail: "parent.rahul@test.com",
      },
      {
        Name: "Priya Sharma",
        DateOfBirth: "2011-03-22",
        Gender: "Female",
        AadhaarNumber: "987698769876",
        MobileNumber: "9876543211",
        Email: "priya@test.com",
        Address: "456 Park Lane",
        City: "Pune",
        State: "Maharashtra",
        Pincode: "411001",
        Class: "6",
        FatherName: "Raj Sharma",
        FatherPhone: "9876543201",
        MotherName: "Meena Sharma",
        MotherPhone: "9876543298",
        RollNumber: "602",
        AdmissionNumber: "AUTO-2024-002",
        ParentEmail: "parent.priya@test.com",
      },
    ];

    const ws = XLSX_LIB.utils.json_to_sheet(sampleData);

    // Set column widths
    ws["!cols"] = [
      { wch: 20 }, // Name
      { wch: 15 }, // DateOfBirth
      { wch: 10 }, // Gender
      { wch: 16 }, // AadhaarNumber
      { wch: 15 }, // MobileNumber
      { wch: 20 }, // Email
      { wch: 24 }, // Address
      { wch: 14 }, // City
      { wch: 14 }, // State
      { wch: 10 }, // Pincode
      { wch: 8 }, // Class
      { wch: 20 }, // FatherName
      { wch: 15 }, // FatherPhone
      { wch: 20 }, // MotherName
      { wch: 15 }, // MotherPhone
      { wch: 12 }, // RollNumber
      { wch: 18 }, // AdmissionNumber
      { wch: 20 }, // ParentEmail
    ];

    const wb = XLSX_LIB.utils.book_new();
    XLSX_LIB.utils.book_append_sheet(wb, ws, "Students");

    XLSX_LIB.writeFile(wb, "sample_students_template.xlsx");
  } catch (err) {
    throw new Error(`Failed to generate sample Excel: ${err.message}`);
  }
};

/**
 * Generate error report Excel file
 */
export const downloadErrorReport = async (invalidRows) => {
  try {
    const XLSX_LIB = await initXLSX();

    const errorData = invalidRows.map((row) => ({
      "Row Number": row.rowNum,
      Name: row.data.name || "",
      "Error Details": row.errors.join("; "),
    }));

    const ws = XLSX_LIB.utils.json_to_sheet(errorData);

    // Set column widths
    ws["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 50 }];

    const wb = XLSX_LIB.utils.book_new();
    XLSX_LIB.utils.book_append_sheet(wb, ws, "Errors");

    XLSX_LIB.writeFile(wb, `student_import_errors_${new Date().getTime()}.xlsx`);
  } catch (err) {
    throw new Error(`Failed to generate error report: ${err.message}`);
  }
};

/**
 * Parse uploaded Excel file
 */
export const parseExcelFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target.result;
        // This will be processed on the backend via API
        resolve(file);
      } catch (err) {
        reject(new Error(`Failed to read Excel file: ${err.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read Excel file"));
    };

    reader.readAsArrayBuffer(file);
  });
};
