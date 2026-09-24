"use client";

import { useEffect, useState } from "react";
import {
  Class,
  Department,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getDepartments,
} from "@/lib/admin-api";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Class | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form states
  const [departmentId, setDepartmentId] = useState("");
  const [batchYear, setBatchYear] = useState<number>(new Date().getFullYear());
  const [section, setSection] = useState("");
  const [currentSemester, setCurrentSemester] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clsRes, deptRes] = await Promise.all([
        getClasses({
          departmentId: selectedDept || undefined,
          batchYear: selectedBatch || undefined,
        }),
        getDepartments("", 1, 100),
      ]);
      setClasses(clsRes.data);
      setDepartments(deptRes.data);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to load classes", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDept, selectedBatch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId || !batchYear) return;
    try {
      setSubmitting(true);
      await createClass({
        departmentId,
        batchYear: Number(batchYear),
        section: section.trim() || null,
        currentSemester: Number(currentSemester) || 1,
      });
      setToast({ message: "Class created successfully", type: "success" });
      setIsCreateOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to create class", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    try {
      setSubmitting(true);
      await updateClass(editItem.id, {
        departmentId: departmentId || undefined,
        batchYear: Number(batchYear),
        section: section.trim() || null,
        currentSemester: Number(currentSemester),
      });
      setToast({ message: "Class updated successfully", type: "success" });
      setEditItem(null);
      resetForm();
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to update class", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setSubmitting(true);
      await deleteClass(deleteId);
      setToast({ message: "Class deleted successfully", type: "success" });
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to delete class", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setDepartmentId(departments[0]?.id || "");
    setBatchYear(new Date().getFullYear());
    setSection("");
    setCurrentSemester(1);
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2B2B2E]">Classes</h1>
          <p className="text-sm text-[#2B2B2E]/70">Manage academic cohorts, sections, and current semester progression.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-[#A4123F] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#A4123F]/90 cursor-pointer"
        >
          + Create Class
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-[#2B2B2E]/10 bg-white p-4 shadow-xs">
        <div className="w-full sm:w-1/2">
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
        <div className="w-full sm:w-1/2">
          <label className="block text-xs font-semibold text-[#2B2B2E]/70 mb-1">Filter by Batch Year</label>
          <input
            type="number"
            placeholder="e.g. 2023"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm text-[#2B2B2E] placeholder-[#2B2B2E]/40 focus:border-[#A4123F] focus:outline-hidden"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2B2B2E]/10 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-[#2B2B2E]">
          <thead className="border-b border-[#2B2B2E]/10 bg-[#F5F3EF] text-xs uppercase font-semibold text-[#2B2B2E]/70">
            <tr>
              <th className="px-6 py-3.5">Department</th>
              <th className="px-6 py-3.5">Batch Year</th>
              <th className="px-6 py-3.5">Section</th>
              <th className="px-6 py-3.5">Current Semester</th>
              <th className="px-6 py-3.5">Students</th>
              <th className="px-6 py-3.5">Teaching Assignments</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2B2B2E]/10">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-6 py-4 text-right"><Skeleton className="ml-auto h-4 w-20" /></td>
                </tr>
              ))
            ) : classes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-[#2B2B2E]/50">
                  No classes found.
                </td>
              </tr>
            ) : (
              classes.map((cls) => (
                <tr key={cls.id} className="hover:bg-[#F5F3EF]/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-[#A4123F]">
                    {cls.department?.code} ({cls.department?.name})
                  </td>
                  <td className="px-6 py-4 font-mono">{cls.batchYear}</td>
                  <td className="px-6 py-4 font-semibold">{cls.section || "—"}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-[#E8A33D]/15 px-2.5 py-0.5 text-xs font-semibold text-[#2B2B2E]">
                      Semester {cls.currentSemester}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#2B2B2E]/70">{cls._count?.students ?? 0}</td>
                  <td className="px-6 py-4 text-[#2B2B2E]/70">{cls._count?.teachingAssignments ?? 0}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditItem(cls);
                        setDepartmentId(cls.departmentId);
                        setBatchYear(cls.batchYear);
                        setSection(cls.section || "");
                        setCurrentSemester(cls.currentSemester);
                      }}
                      className="text-xs font-semibold text-[#A4123F] hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(cls.id)}
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

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Class">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Department</label>
            <select
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Batch Year</label>
            <input
              type="number"
              required
              placeholder="e.g. 2023"
              value={batchYear}
              onChange={(e) => setBatchYear(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Section (Optional)</label>
            <input
              type="text"
              placeholder="e.g. A, B, C or leave blank"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Current Semester</label>
            <input
              type="number"
              min={1}
              max={12}
              required
              value={currentSemester}
              onChange={(e) => setCurrentSemester(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-lg border border-[#2B2B2E]/20 px-4 py-2 text-sm font-semibold text-[#2B2B2E] hover:bg-[#F5F3EF]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#A4123F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A4123F]/90 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Class">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Department</label>
            <select
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Batch Year</label>
            <input
              type="number"
              required
              value={batchYear}
              onChange={(e) => setBatchYear(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Section (Optional)</label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Current Semester</label>
            <input
              type="number"
              min={1}
              max={12}
              required
              value={currentSemester}
              onChange={(e) => setCurrentSemester(Number(e.target.value))}
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
        title="Delete Class"
        message="Are you sure you want to delete this class? Students assigned to this class will become unassigned."
      />
    </div>
  );
}
