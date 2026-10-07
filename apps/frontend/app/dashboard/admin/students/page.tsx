"use client";

import { useEffect, useState } from "react";
import {
  Student,
  Class,
  Department,
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  importStudentsBulk,
  bulkAssignStudentsToClass,
  getClasses,
  getDepartments,
  BulkImportStudentRow,
} from "@/lib/admin-api";
import * as XLSX from "xlsx";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");

  // Tabs: 'csv' | 'single'
  const [activeTab, setActiveTab] = useState<"csv" | "single">("csv");

  // Single Student Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // CSV Import States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<BulkImportStudentRow[]>([]);
  const [importBatchClassId, setImportBatchClassId] = useState("");
  const [csvParsingError, setCsvParsingError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<{
    imported: number;
    failed: number;
    errors: Array<{ row: number; field?: string; message: string }>;
  } | null>(null);

  // Table Multi-Select & Batch Assignment
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [batchAssignClassId, setBatchAssignClassId] = useState("");
  const [batchAssigning, setBatchAssigning] = useState(false);

  // Modals & Edit
  const [editItem, setEditItem] = useState<Student | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stuRes, clsRes, deptRes] = await Promise.all([
        getStudents({
          departmentId: selectedDept || undefined,
          classId: selectedClass || undefined,
          search: search || undefined,
        }),
        getClasses({ limit: 100 }),
        getDepartments("", 1, 100),
      ]);
      setStudents(stuRes.data);
      setClasses(clsRes.data);
      setDepartments(deptRes.data);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to load students", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDept, selectedClass, search]);

  // Download Sample Template (.xlsx and .csv supported)
  const handleDownloadTemplate = (format: "xlsx" | "csv" = "xlsx") => {
    const data = [
      ["studentId", "name", "email", "password"],
      ["2026-ECE-001", "John Doe", "john.doe@acadify.edu", "Pass123!"],
      ["2026-ECE-002", "Jane Smith", "jane.smith@acadify.edu", "Pass123!"],
    ];

    if (format === "xlsx") {
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      XLSX.writeFile(wb, "student_bulk_import_template.xlsx");
    } else {
      const csvContent = data.map((row) => row.join(",")).join("\n") + "\n";
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "student_bulk_import_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleBatchClassChange = (newClassId: string) => {
    setImportBatchClassId(newClassId);
    if (csvRows.length > 0) {
      setCsvRows((prev) =>
        prev.map((r) => ({
          ...r,
          classId: newClassId || undefined,
        }))
      );
    }
  };

  // Parser: Supports Excel (.xlsx, .xls) and CSV (.csv)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setCsvParsingError(null);
    setImportReport(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("Spreadsheet contains no sheets.");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

      if (rawData.length < 2) {
        setCsvParsingError("File must contain a header row and at least one student data row.");
        setCsvRows([]);
        return;
      }

      const headerRow = rawData[0].map((h: any) => String(h ?? "").trim().toLowerCase());

      const sIdIdx = headerRow.findIndex((h) => h.includes("studentid") || h.includes("roll") || h.includes("student id") || h.includes("reg"));
      const nameIdx = headerRow.findIndex((h) => h === "name" || h.includes("name"));
      const emailIdx = headerRow.findIndex((h) => h.includes("email") || h.includes("mail"));
      const passIdx = headerRow.findIndex((h) => h.includes("password") || h.includes("pass"));
      const classIdx = headerRow.findIndex((h) => h.includes("classid") || h.includes("class"));

      const rows: BulkImportStudentRow[] = [];

      for (let i = 1; i < rawData.length; i++) {
        const parts = rawData[i].map((p: any) => String(p ?? "").trim());
        // Skip empty rows
        if (!parts.some((p) => p.length > 0)) continue;

        const sId = parts[sIdIdx >= 0 ? sIdIdx : 0] || "";
        const n = parts[nameIdx >= 0 ? nameIdx : 1] || "";
        const em = parts[emailIdx >= 0 ? emailIdx : 2] || "";
        const pw = parts[passIdx >= 0 ? passIdx : 3] || "TempPass123!";
        const rawClass = classIdx >= 0 ? parts[classIdx] : "";
        const cId = importBatchClassId || rawClass || undefined;

        if (sId || n || em) {
          rows.push({
            studentId: sId,
            name: n,
            email: em,
            password: pw,
            classId: cId,
          });
        }
      }

      if (rows.length === 0) {
        setCsvParsingError("No valid student rows found in the uploaded file.");
        setCsvRows([]);
        return;
      }

      setCsvRows(rows);
    } catch (err: any) {
      setCsvParsingError(`Failed to parse file: ${err.message}`);
      setCsvRows([]);
    }
  };

  const handleBulkSubmit = async () => {
    if (csvRows.length === 0) return;
    try {
      setSubmitting(true);
      setImportReport(null);
      const payload = csvRows.map((r) => ({
        ...r,
        classId: (importBatchClassId || r.classId || "").trim() || undefined,
      }));
      const res = await importStudentsBulk(payload);
      if (res.failed > 0) {
        setImportReport({
          imported: res.imported,
          failed: res.failed,
          errors: res.errors,
        });
        setToast({ message: `Import failed with ${res.failed} error(s). See details below.`, type: "error" });
      } else {
        setToast({ message: `Successfully imported ${res.imported} students!`, type: "success" });
        setCsvFile(null);
        setCsvRows([]);
        loadData();
      }
    } catch (err: any) {
      setToast({ message: err.message || "Failed to process bulk import", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Table Multi-Select & Batch Assign Handlers
  const toggleSelectAll = () => {
    if (students.length === 0) return;
    const allSelected = students.every((s) => selectedStudentIds.includes(s.id));
    if (allSelected) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map((s) => s.id));
    }
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = async () => {
    if (selectedStudentIds.length === 0 || !batchAssignClassId) return;
    try {
      setBatchAssigning(true);
      const res = await bulkAssignStudentsToClass(selectedStudentIds, batchAssignClassId);
      setToast({ message: res.message || "Class assigned successfully", type: "success" });
      setSelectedStudentIds([]);
      setBatchAssignClassId("");
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to assign class", type: "error" });
    } finally {
      setBatchAssigning(false);
    }
  };

  const handleSingleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !studentId.trim()) return;
    try {
      setSubmitting(true);
      await createStudent({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        studentId: studentId.trim(),
        classId: classId || null,
      });
      setToast({ message: "Student created successfully", type: "success" });
      resetSingleForm();
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to create student", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    try {
      setSubmitting(true);
      await updateStudent(editItem.id, {
        name: name.trim() || undefined,
        studentId: studentId.trim() || undefined,
        classId: classId || undefined,
        password: password.trim() || undefined,
      });
      setToast({ message: "Student updated successfully", type: "success" });
      setEditItem(null);
      resetSingleForm();
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to update student", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setSubmitting(true);
      await deleteStudent(deleteId);
      setToast({ message: "Student deleted successfully", type: "success" });
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to delete student", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetSingleForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setStudentId("");
    setClassId(classes[0]?.id || "");
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#2B2B2E]">Student Management</h1>
        <p className="text-sm text-[#2B2B2E]/70">Bulk import students via CSV or create single student accounts.</p>
      </div>

      {/* Creation Mode Tabs */}
      <div className="rounded-xl border border-[#2B2B2E]/10 bg-white p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-[#2B2B2E]/10 pb-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("csv")}
              className={`pb-2 text-sm font-bold border-b-2 cursor-pointer transition-colors ${
                activeTab === "csv"
                  ? "border-[#A4123F] text-[#A4123F]"
                  : "border-transparent text-[#2B2B2E]/60 hover:text-[#2B2B2E]"
              }`}
            >
              Bulk Import (Excel / CSV)
            </button>
            <button
              onClick={() => {
                setActiveTab("single");
                if (!classId && classes.length > 0) setClassId(classes[0].id);
              }}
              className={`pb-2 text-sm font-bold border-b-2 cursor-pointer transition-colors ${
                activeTab === "single"
                  ? "border-[#A4123F] text-[#A4123F]"
                  : "border-transparent text-[#2B2B2E]/60 hover:text-[#2B2B2E]"
              }`}
            >
              Add Single Student
            </button>
          </div>

          {activeTab === "csv" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadTemplate("xlsx")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#A4123F]/30 bg-[#A4123F]/5 px-3 py-1.5 text-xs font-semibold text-[#A4123F] hover:bg-[#A4123F]/10 cursor-pointer shadow-2xs transition-colors whitespace-nowrap"
                title="Download formatted Excel (.xlsx) spreadsheet template"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  style={{ width: "14px", height: "14px", minWidth: "14px", minHeight: "14px" }}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download Template (.xlsx)</span>
              </button>
              <button
                onClick={() => handleDownloadTemplate("csv")}
                className="inline-flex items-center rounded-lg border border-[#2B2B2E]/20 bg-white px-2.5 py-1.5 text-xs font-medium text-[#2B2B2E]/70 hover:bg-[#F5F3EF] cursor-pointer transition-colors whitespace-nowrap"
                title="Download CSV format"
              >
                .CSV
              </button>
            </div>
          )}
        </div>

        {/* Tab Content 1: CSV Import */}
        {activeTab === "csv" && (
          <div className="space-y-4">
            {/* Optional Target Class Selector */}
            <div className="rounded-xl border border-[#2B2B2E]/10 bg-[#FBFBFA] p-5 shadow-2xs">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:items-center">
                <div className="md:col-span-7">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-[#2B2B2E]">
                      Target Class Cohort
                    </label>
                    <span className="rounded-full bg-[#2B2B2E]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#2B2B2E]/70">
                      Optional
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#2B2B2E]/70 leading-relaxed">
                    Optionally enroll all imported students into a class now, or leave unassigned to group them later using checkboxes in the table below.
                  </p>
                </div>
                <div className="md:col-span-5">
                  <select
                    value={importBatchClassId}
                    onChange={(e) => handleBatchClassChange(e.target.value)}
                    className="w-full rounded-lg border border-[#2B2B2E]/20 bg-white px-3.5 py-2.5 text-xs font-medium text-[#2B2B2E] shadow-2xs focus:border-[#A4123F] focus:outline-hidden"
                  >
                    <option value="">-- Leave Unassigned (Group Later) --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.department?.code} — Batch {c.batchYear} {c.section ? `(Sec ${c.section})` : ""} [Sem {c.currentSemester}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Excel / CSV File Upload Dropzone */}
            <div className="rounded-xl border-2 border-dashed border-[#2B2B2E]/20 bg-[#F5F3EF]/40 p-8 text-center hover:bg-[#F5F3EF]/70 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                id="csv-file-input"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer space-y-3 block">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#A4123F]/10 text-[#A4123F]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2B2B2E]">
                    {csvFile ? csvFile.name : "Click to select or drag & drop Excel (.xlsx, .xls) or CSV file"}
                  </p>
                  <p className="text-xs text-[#2B2B2E]/60 mt-0.5">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV spreadsheets
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-[#2B2B2E]/5 px-3 py-1.5 text-xs text-[#2B2B2E]/70 font-mono">
                  <span>Columns:</span>
                  <span className="font-semibold text-[#A4123F]">studentId</span>,
                  <span className="font-semibold text-[#A4123F]">name</span>,
                  <span className="font-semibold text-[#A4123F]">email</span>,
                  <span className="font-semibold text-[#A4123F]">password</span>
                </div>
              </label>
            </div>

            {csvParsingError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-xs text-red-700">
                {csvParsingError}
              </div>
            )}

            {csvRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#2B2B2E]">Preview ({csvRows.length} rows ready for import)</h3>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={submitting}
                    className="rounded-lg bg-[#A4123F] px-5 py-2 text-sm font-semibold text-white hover:bg-[#A4123F]/90 disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {submitting ? "Importing..." : `Import ${csvRows.length} Students`}
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-lg border border-[#2B2B2E]/10">
                  <table className="w-full text-left text-xs text-[#2B2B2E]">
                    <thead className="bg-[#F5F3EF] sticky top-0 font-semibold border-b border-[#2B2B2E]/10">
                      <tr>
                        <th className="px-4 py-2">Row</th>
                        <th className="px-4 py-2">Student ID</th>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Email</th>
                        <th className="px-4 py-2">Assigned Class</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B2E]/10 bg-white">
                      {csvRows.map((row, idx) => {
                        const targetId = importBatchClassId || row.classId;
                        const matchedClass = classes.find((c) => c.id === targetId);
                        return (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-[#2B2B2E]/50 font-mono">{idx + 1}</td>
                            <td className="px-4 py-2 font-mono font-semibold text-[#A4123F]">{row.studentId}</td>
                            <td className="px-4 py-2 font-medium">{row.name}</td>
                            <td className="px-4 py-2 text-[#2B2B2E]/70">{row.email}</td>
                            <td className="px-4 py-2 text-xs">
                              {matchedClass ? (
                                <span className="font-semibold text-[#A4123F]">
                                  {matchedClass.department?.code} Batch {matchedClass.batchYear} {matchedClass.section ? `(Sec ${matchedClass.section})` : ""}
                                </span>
                              ) : (
                                <span className="text-[#2B2B2E]/40 italic">Unassigned (will group later)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importReport && importReport.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2 text-xs">
                <h4 className="font-bold text-red-800 uppercase tracking-wide">
                  Import Errors ({importReport.failed} rows failed — entire batch rejected)
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-red-700">
                  {importReport.errors.map((err, i) => (
                    <li key={i}>
                      <strong>Row {err.row}:</strong> {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Single Student Form */}
        {activeTab === "single" && (
          <form onSubmit={handleSingleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Student Roll Number (studentId)</label>
              <input
                type="text"
                required
                placeholder="e.g. 2023-CS-001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Email</label>
              <input
                type="email"
                required
                placeholder="john.doe@acadify.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Password</label>
              <input
                type="password"
                required
                placeholder="Initial password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Class Cohort</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
              >
                <option value="">Unassigned</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.department?.code} — Batch {c.batchYear} {c.section ? `(Sec ${c.section})` : ""} [Sem {c.currentSemester}]
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#A4123F] px-5 py-2 text-sm font-semibold text-white hover:bg-[#A4123F]/90 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {submitting ? "Creating..." : "Create Student"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Student List Table & Filters */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-xl border border-[#2B2B2E]/10 bg-white p-4 shadow-xs">
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E]/70 mb-1">Search Students</label>
            <input
              type="text"
              placeholder="Search by roll number, name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm text-[#2B2B2E] placeholder-[#2B2B2E]/40 focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E]/70 mb-1">Filter by Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E]/70 mb-1">Filter by Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden"
            >
              <option value="">All Classes</option>
              <option value="unassigned">⚠️ Unassigned Students Only</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.department?.code} Batch {c.batchYear} {c.section ? `(${c.section})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-Select Floating Bulk Action Banner */}
        {selectedStudentIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#A4123F]/30 bg-[#A4123F]/5 p-4 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#A4123F] text-xs font-bold text-white shadow-2xs">
                {selectedStudentIds.length}
              </span>
              <span className="text-sm font-semibold text-[#2B2B2E]">
                {selectedStudentIds.length === 1 ? "1 student selected" : `${selectedStudentIds.length} students selected`}
              </span>
              <button
                onClick={() => setSelectedStudentIds([])}
                className="ml-2 text-xs font-semibold text-[#A4123F] hover:underline cursor-pointer"
              >
                Clear Selection
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase text-[#2B2B2E]/70">Group / Assign To:</span>
              <select
                value={batchAssignClassId}
                onChange={(e) => setBatchAssignClassId(e.target.value)}
                className="rounded-lg border border-[#2B2B2E]/20 bg-white px-3 py-1.5 text-xs font-medium text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden shadow-2xs"
              >
                <option value="">-- Choose Target Class --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.department?.code} — Batch {c.batchYear} {c.section ? `(Sec ${c.section})` : ""} [Sem {c.currentSemester}]
                  </option>
                ))}
                <option value="unassigned">Remove from Class (Unassign)</option>
              </select>

              <button
                onClick={handleBulkAssign}
                disabled={!batchAssignClassId || batchAssigning}
                className="rounded-lg bg-[#A4123F] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#A4123F]/90 disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
              >
                {batchAssigning ? "Assigning..." : "Assign to Selected"}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-[#2B2B2E]/10 bg-white shadow-xs">
          <table className="w-full text-left text-sm text-[#2B2B2E]">
            <thead className="border-b border-[#2B2B2E]/10 bg-[#F5F3EF] text-xs uppercase font-semibold text-[#2B2B2E]/70">
              <tr>
                <th className="w-12 px-4 py-3.5 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={students.length > 0 && selectedStudentIds.length === students.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-[#2B2B2E]/30 text-[#A4123F] focus:ring-[#A4123F] cursor-pointer align-middle"
                    title="Select All Students on this page"
                  />
                </th>
                <th className="px-4 py-3.5">Roll Number</th>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-4 py-3.5">Department</th>
                <th className="px-4 py-3.5">Class Cohort</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2B2E]/10">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="w-12 px-4 py-4 text-center align-middle"><Skeleton className="h-4 w-4 mx-auto" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-4 w-44" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="ml-auto h-4 w-16" /></td>
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-[#2B2B2E]/50">
                    No students found.
                  </td>
                </tr>
              ) : (
                students.map((stu) => {
                  const isSelected = selectedStudentIds.includes(stu.id);
                  return (
                    <tr
                      key={stu.id}
                      className={`transition-colors ${isSelected ? "bg-[#A4123F]/5" : "hover:bg-[#F5F3EF]/50"}`}
                    >
                      <td className="w-12 px-4 py-4 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectStudent(stu.id)}
                          className="h-4 w-4 rounded border-[#2B2B2E]/30 text-[#A4123F] focus:ring-[#A4123F] cursor-pointer align-middle"
                        />
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-[#A4123F]">{stu.studentId}</td>
                      <td className="px-5 py-4 font-medium">{stu.name}</td>
                      <td className="px-5 py-4 text-[#2B2B2E]/70 font-mono text-xs">{stu.email}</td>
                      <td className="px-4 py-4 font-semibold text-[#2B2B2E]/80">{stu.department?.code || "—"}</td>
                      <td className="px-4 py-4">
                        {stu.class ? (
                          <span className="inline-flex items-center rounded-full bg-[#A4123F]/10 px-2.5 py-0.5 text-xs font-semibold text-[#A4123F]">
                            {stu.class.department?.code} Batch {stu.class.batchYear} {stu.class.section ? `(${stu.class.section})` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-[#2B2B2E]/40 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditItem(stu);
                            setName(stu.name);
                            setStudentId(stu.studentId);
                            setClassId(stu.classId || "");
                            setPassword("");
                          }}
                          className="text-xs font-semibold text-[#A4123F] hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(stu.id)}
                          className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Student">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Student Roll Number (studentId)</label>
            <input
              type="text"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Class Cohort</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            >
              <option value="">Unassigned</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.department?.code} — Batch {c.batchYear} {c.section ? `(Sec ${c.section})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">New Password (leave blank to keep current)</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditItem(null)}
              className="rounded-lg border border-[#2B2B2E]/20 px-4 py-2 text-sm font-semibold text-[#2B2B2E] hover:bg-[#F5F3EF]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#A4123F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A4123F]/90 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Update"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Student"
        message="Are you sure you want to delete this student account? This action cannot be undone."
      />
    </div>
  );
}
