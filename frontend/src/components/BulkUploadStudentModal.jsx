import { useCallback, useState } from "react";
import { uploadBulkStudentExcel, confirmBulkStudentImport } from "../services/schoolApi";
import {
  downloadSampleExcel,
  downloadErrorReport,
} from "../services/excelUtils";

export function BulkUploadStudentModal({
  isOpen,
  onClose,
  onSuccess,
  classCount = 0,
}) {
  const [uploadState, setUploadState] = useState("idle"); // idle, uploading, preview, importing
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [importLog, setImportLog] = useState(null);
  const hasMastersConfigured = classCount > 0;

  const resetModal = useCallback(() => {
    setUploadState("idle");
    setUploadProgress(0);
    setValidationResult(null);
    setError("");
    setSelectedFile(null);
    setImportLog(null);
  }, []);

  const handleCloseModal = useCallback(() => {
    resetModal();
    onClose();
  }, [resetModal, onClose]);

  const handleDownloadSample = async () => {
    try {
      setError("");
      await downloadSampleExcel();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileSelect = async (file) => {
    if (!file) {
      setError("");
      setSelectedFile(null);
      return;
    }

    try {
      setError("");
      // Validate file type
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        throw new Error("Please upload an Excel file (.xlsx or .xls)");
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("File size must be less than 5MB");
      }

      setSelectedFile(file);
    } catch (err) {
      setError(err.message);
      setSelectedFile(null);
    }
  };

  const handleUploadAndValidate = async () => {
    if (!hasMastersConfigured) {
      setError("Add at least one class before bulk upload.");
      return;
    }

    if (!selectedFile) {
      setError("Please select a file");
      return;
    }

    try {
      setError("");
      setUploadState("uploading");
      setUploadProgress(0);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const result = await uploadBulkStudentExcel(selectedFile);

      clearInterval(progressInterval);
      setUploadProgress(100);

      setValidationResult(result);
      setUploadState("preview");

      // Show success message if all rows are valid
      if (result.invalid === 0) {
        setError(`✅ All ${result.valid} rows are valid! Ready to import.`);
      } else {
        setError(
          `⚠️ ${result.valid} valid rows, ${result.invalid} invalid rows found. Review errors below.`
        );
      }

      setTimeout(() => setUploadProgress(0), 500);
    } catch (err) {
      setError(err.message);
      setUploadState("idle");
      setUploadProgress(0);
    }
  };

  const handleDownloadErrors = async () => {
    if (!validationResult?.validations) {
      return;
    }

    try {
      const invalidRows = validationResult.validations.filter((v) => !v.valid);
      await downloadErrorReport(invalidRows);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConfirmImport = async () => {
    if (!validationResult?.processedStudents) {
      return;
    }

    try {
      setError("");
      setUploadState("importing");
      setUploadProgress(0);

      // Simulate import progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 15, 95));
      }, 100);

      const result = await confirmBulkStudentImport(validationResult.processedStudents);

      clearInterval(progressInterval);
      setUploadProgress(100);

      setImportLog(result);
      setUploadState("idle");

      // Success
      setError(`✅ Successfully imported ${result.imported} students!`);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess(result);
        }
        setUploadProgress(0);
        setTimeout(() => handleCloseModal(), 1500);
      }, 1000);
    } catch (err) {
      setError(err.message);
      setUploadState("preview");
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Bulk Upload Students</h2>
              <p className="text-sm text-slate-600">
                {uploadState === "idle"
                  ? "Upload an Excel file to add multiple students at once"
                  : uploadState === "preview"
                    ? "Review validation results"
                    : "Importing students..."}
              </p>
            </div>
            <button
              onClick={handleCloseModal}
              disabled={uploadState === "uploading" || uploadState === "importing"}
              className="text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {uploadState === "idle" && (
            <div className="space-y-6">
              {/* Upload Area */}
              <div>
                <label className="mb-3 block text-sm font-semibold text-slate-700">
                  Upload Excel File
                </label>

                {!hasMastersConfigured && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-800">
                      Setup Required Before Upload
                    </p>
                    <p className="mt-1 text-sm text-amber-700">
                      Configure classes first. Current setup: {classCount} classes.
                    </p>
                  </div>
                )}

                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    disabled={!hasMastersConfigured}
                    className="hidden"
                    id="bulk-upload-input"
                  />
                  <label
                    htmlFor="bulk-upload-input"
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors ${
                      !hasMastersConfigured
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-70"
                        :
                      selectedFile
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-300 bg-slate-50 hover:border-emerald-300"
                    }`}
                  >
                    <div className="text-center">
                      <div className="mb-2 text-3xl">📊</div>
                      <p className="font-semibold text-slate-700">
                        {selectedFile ? selectedFile.name : "Drag and drop Excel file here"}
                      </p>
                      <p className="text-sm text-slate-600">or click to browse</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Supported formats: .xlsx, .xls | Max size: 5MB
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sample Template */}
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm text-slate-700 mb-3">
                  <strong>📥 First time?</strong> Download the sample Excel template to see the
                  required columns and format.
                </p>
                <button
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200 transition-colors"
                >
                  📋 Download Sample Excel
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Upload Button */}
              <div className="flex gap-3">
                <button
                  onClick={handleUploadAndValidate}
                  disabled={!hasMastersConfigured || !selectedFile || uploadState !== "idle"}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400 transition-colors"
                >
                  {uploadState === "uploading" ? "Uploading..." : "Upload & Validate"}
                </button>
                <button
                  onClick={handleCloseModal}
                  className="rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* Progress Bar */}
              {uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600">{uploadProgress}% complete</p>
                </div>
              )}
            </div>
          )}

          {uploadState === "preview" && validationResult && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Total Rows</p>
                  <p className="text-2xl font-bold text-emerald-700">{validationResult.total}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Valid</p>
                  <p className="text-2xl font-bold text-green-700">{validationResult.valid}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Invalid</p>
                  <p className="text-2xl font-bold text-red-700">{validationResult.invalid}</p>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className={`rounded-lg p-4 ${
                  validationResult.invalid === 0 ? "bg-green-50" : "bg-yellow-50"
                }`}>
                  <p className={`text-sm ${
                    validationResult.invalid === 0 ? "text-green-700" : "text-yellow-700"
                  }`}>
                    {error}
                  </p>
                </div>
              )}

              {/* Invalid Rows Preview */}
              {validationResult.invalid > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Invalid Rows</h3>
                    <button
                      onClick={handleDownloadErrors}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      📥 Download Error Report
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                    {validationResult.validations
                      .filter((v) => !v.valid)
                      .slice(0, 10)
                      .map((validation, idx) => (
                        <div key={idx} className="border-b border-slate-100 p-3 last:border-b-0">
                          <p className="text-sm font-semibold text-slate-700">
                            Row {validation.rowNum}: {validation.data.name || "N/A"}
                          </p>
                          <ul className="mt-1 ml-4 list-inside list-disc space-y-0.5">
                            {validation.errors.map((error, eIdx) => (
                              <li key={eIdx} className="text-xs text-red-600">
                                {error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    {validationResult.invalid > 10 && (
                      <div className="p-3 text-center text-sm text-slate-600">
                        ... and {validationResult.invalid - 10} more invalid rows
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Valid Rows Preview */}
              {validationResult.valid > 0 && (
                <div>
                  <h3 className="mb-3 font-semibold text-slate-900">
                    Ready to Import ({validationResult.valid} rows)
                  </h3>
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-emerald-50 p-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-emerald-200">
                          <th className="pb-2 text-left font-semibold text-slate-700">Name</th>
                          <th className="pb-2 text-left font-semibold text-slate-700">Class</th>
                          <th className="pb-2 text-left font-semibold text-slate-700">
                            Phone
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResult.validations
                          .filter((v) => v.valid)
                          .slice(0, 5)
                          .map((v, idx) => (
                            <tr key={idx} className="border-t border-emerald-100">
                              <td className="py-1">{v.data.name}</td>
                              <td className="py-1">{v.data.className}</td>
                              <td className="py-1">{v.data.mobileNumber}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {validationResult.valid > 5 && (
                      <p className="mt-2 text-center text-xs text-slate-600">
                        ... and {validationResult.valid - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmImport}
                  disabled={validationResult.valid === 0 || uploadState !== "preview"}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400 transition-colors"
                >
                  {uploadState === "importing"
                    ? "Importing..."
                    : `✓ Import ${validationResult.valid} Students`}
                </button>
                <button
                  onClick={() => {
                    setUploadState("idle");
                    setValidationResult(null);
                    setSelectedFile(null);
                  }}
                  disabled={uploadState !== "preview"}
                  className="rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCloseModal}
                  className="rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* Progress Bar for Import */}
              {uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600">{uploadProgress}% complete</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
