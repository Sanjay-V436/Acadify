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
  getClasses,
  getDepartments,
  BulkImportStudentRow,
} from "@/lib/admin-api";
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
  const [csvParsingError, setCsvParsingError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<{
    imported: number;
    failed: number;
    errors: Array<{ row: number; field?: string; message: string }>;
  } | null>(null);

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

  // CSV Helper: Download Sample Template
  const handleDownloadTemplate = () => {
    const sampleClassId = classes[0]?.id || "INSERT_CLASS_ID_HERE";
    const csvContent =
      "studentId,name,email,password,classId\n" +
      `2023-CS-001,John Doe,john.doe@acadify.edu,Pass123!,${sampleClassId}\n` +
      `2023-CS-002,Jane Smith,jane.smith@acadify.edu,Pass123!,${sampleClassId}\n`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "student_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Parser
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setCsvParsingError(null);
    setImportReport(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

      if (lines.length < 2) {
        setCsvParsingError("CSV file must contain a header row and at least one data row.");
        setCsvRows([]);
        return;
      }

      const rows: BulkImportStudentRow[] = [];
      const header = lines[0].toLowerCase().split(",").map((h) => h.trim());

      const sIdIdx = header.findIndex((h) => h.includes("studentid") || h.includes("roll"));
      const nameIdx = header.findIndex((h) => h === "name");
      const emailIdx = header.findIndex((h) => h === "email");
      const passIdx = header.findIndex((h) => h.includes("password") || h.includes("pass"));
      const classIdx = header.findIndex((h) => h.includes("classid") || h.includes("class"));

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts.length >= 4) {
          const sId = parts[sIdIdx >= 0 ? sIdIdx : 0] || "";
          const n = parts[nameIdx >= 0 ? nameIdx : 1] || "";
          const em = parts[emailIdx >= 0 ? emailIdx : 2] || "";
          const pw = parts[passIdx >= 0 ? passIdx : 3] || "TempPass123!";
          const cId = parts[classIdx >= 0 ? classIdx : 4] || classes[0]?.id || "";

          rows.push({
            studentId: sId,
            name: n,
            email: em,
            password: pw,
            classId: cId,
          });
        }
      }

      setCsvRows(rows);
    } catch (err: any) {
      setCsvParsingError(`Failed to parse CSV: ${err.message}`);
      setCsvRows([]);
    }
  };

  const handleBulkSubmit = async () => {
    if (csvRows.length === 0) return;
    try {
      setSubmitting(true);
      setImportReport(null);
      const res = await importStudentsBulk(csvRows);
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
              Bulk Import (CSV)
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
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#A4123F]/30 bg-[#A4123F]/5 px-3 py-1.5 text-xs font-semibold text-[#A4123F] hover:bg-[#A4123F]/10 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download CSV Template
            </button>
          )}
        </div>

        {/* Tab Content 1: CSV Import */}
        {activeTab === "csv" && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-[#2B2B2E]/20 bg-[#F5F3EF]/50 p-6 text-center">
              <input
                type="file"
                accept=".csv"
                id="csv-file-input"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#A4123F]/10 text-[#A4123F]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[#2B2B2E]">
                  {csvFile ? csvFile.name : "Click to select or drag & drop student CSV file"}
                </p>
                <p className="text-xs text-[#2B2B2E]/60">
                  Expected format: <code className="bg-[#2B2B2E]/10 px-1 py-0.5 rounded font-mono">studentId, name, email, password, classId</code>
                </p>
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
                        <th className="px-4 py-2">Class ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B2E]/10 bg-white">
                      {csvRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-[#2B2B2E]/50 font-mono">{idx + 1}</td>
                          <td className="px-4 py-2 font-mono font-semibold text-[#A4123F]">{row.studentId}</td>
                          <td className="px-4 py-2 font-medium">{row.name}</td>
                          <td className="px-4 py-2 text-[#2B2B2E]/70">{row.email}</td>
                          <td className="px-4 py-2 font-mono text-[#2B2B2E]/60">{row.classId}</td>
                        </tr>
                      ))}
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
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.department?.code} Batch {c.batchYear} {c.section ? `(${c.section})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#2B2B2E]/10 bg-white shadow-xs">
          <table className="w-full text-left text-sm text-[#2B2B2E]">
            <thead className="border-b border-[#2B2B2E]/10 bg-[#F5F3EF] text-xs uppercase font-semibold text-[#2B2B2E]/70">
              <tr>
                <th className="px-6 py-3.5">Roll Number</th>
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Class Cohort</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2B2E]/10">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-44" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="ml-auto h-4 w-16" /></td>
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#2B2B2E]/50">
                    No students found.
                  </td>
                </tr>
              ) : (
                students.map((stu) => (
                  <tr key={stu.id} className="hover:bg-[#F5F3EF]/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-[#A4123F]">{stu.studentId}</td>
                    <td className="px-6 py-4 font-medium">{stu.name}</td>
                    <td className="px-6 py-4 text-[#2B2B2E]/70 font-mono text-xs">{stu.email}</td>
                    <td className="px-6 py-4 font-semibold text-[#2B2B2E]/80">{stu.department?.code || "—"}</td>
                    <td className="px-6 py-4">
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
                ))
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
