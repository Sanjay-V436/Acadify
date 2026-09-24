"use client";

import { useEffect, useState } from "react";
import {
  Department,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/admin-api";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Department | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Forms
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getDepartments(search);
      setDepartments(res.data);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to load departments", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    try {
      setSubmitting(true);
      await createDepartment({ name: name.trim(), code: code.trim().toUpperCase() });
      setToast({ message: "Department created successfully", type: "success" });
      setIsCreateOpen(false);
      setName("");
      setCode("");
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to create department", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !name.trim() || !code.trim()) return;
    try {
      setSubmitting(true);
      await updateDepartment(editItem.id, { name: name.trim(), code: code.trim().toUpperCase() });
      setToast({ message: "Department updated successfully", type: "success" });
      setEditItem(null);
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to update department", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setSubmitting(true);
      await deleteDepartment(deleteId);
      setToast({ message: "Department deleted successfully", type: "success" });
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to delete department", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2B2B2E]">Departments</h1>
          <p className="text-sm text-[#2B2B2E]/70">Manage academic departments and faculty divisions.</p>
        </div>
        <button
          onClick={() => {
            setName("");
            setCode("");
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-[#A4123F] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#A4123F]/90 cursor-pointer"
        >
          + Add Department
        </button>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-[#2B2B2E]/10 bg-white p-4 shadow-xs">
        <input
          type="text"
          placeholder="Search departments by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm text-[#2B2B2E] placeholder-[#2B2B2E]/40 focus:border-[#A4123F] focus:outline-hidden"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2B2B2E]/10 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-[#2B2B2E]">
          <thead className="border-b border-[#2B2B2E]/10 bg-[#F5F3EF] text-xs uppercase font-semibold text-[#2B2B2E]/70">
            <tr>
              <th className="px-6 py-3.5">Code</th>
              <th className="px-6 py-3.5">Name</th>
              <th className="px-6 py-3.5">Classes</th>
              <th className="px-6 py-3.5">Subjects</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2B2B2E]/10">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-6 py-4 text-right"><Skeleton className="ml-auto h-4 w-20" /></td>
                </tr>
              ))
            ) : departments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#2B2B2E]/50">
                  No departments found.
                </td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept.id} className="hover:bg-[#F5F3EF]/50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-[#A4123F]">{dept.code}</td>
                  <td className="px-6 py-4 font-medium">{dept.name}</td>
                  <td className="px-6 py-4 text-[#2B2B2E]/70">{dept._count?.classes ?? 0}</td>
                  <td className="px-6 py-4 text-[#2B2B2E]/70">{dept._count?.subjects ?? 0}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditItem(dept);
                        setName(dept.name);
                        setCode(dept.code);
                      }}
                      className="text-xs font-semibold text-[#A4123F] hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(dept.id)}
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
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add New Department">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Department Code</label>
            <input
              type="text"
              required
              placeholder="e.g. CSE"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Department Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Computer Science & Engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Department">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Department Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Department Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
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
        title="Delete Department"
        message="Are you sure you want to delete this department? This action cannot be undone."
      />
    </div>
  );
}