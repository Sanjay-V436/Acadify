"use client";

import { useEffect, useState } from "react";
import {
  Faculty,
  Department,
  getFaculty,
  createFaculty,
  updateFaculty,
  getDepartments,
} from "@/lib/admin-api";
import Modal from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";

export default function AdminFacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState("");
  const [search, setSearch] = useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Faculty | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designation, setDesignation] = useState("");
  const [qualification, setQualification] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [facRes, deptRes] = await Promise.all([
        getFaculty({
          departmentId: selectedDept || undefined,
          search: search || undefined,
        }),
        getDepartments("", 1, 100),
      ]);
      setFaculty(facRes.data);
      setDepartments(deptRes.data);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to load faculty", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDept, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !departmentId) return;
    try {
      setSubmitting(true);
      await createFaculty({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        departmentId,
        designation: designation.trim() || undefined,
        qualification: qualification.trim() || undefined,
        specialization: specialization.trim() || undefined,
      });
      setToast({ message: "Faculty member created successfully", type: "success" });
      setIsCreateOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to create faculty member", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !name.trim()) return;
    try {
      setSubmitting(true);
      await updateFaculty(editItem.userId, {
        name: name.trim(),
        departmentId: departmentId || undefined,
        designation: designation.trim() || undefined,
        qualification: qualification.trim() || undefined,
        specialization: specialization.trim() || undefined,
      });
      setToast({ message: "Faculty member updated successfully", type: "success" });
      setEditItem(null);
      resetForm();
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to update faculty member", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setDepartmentId(departments[0]?.id || "");
    setDesignation("");
    setQualification("");
    setSpecialization("");
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2B2B2E]">Faculty</h1>
          <p className="text-sm text-[#2B2B2E]/70">Manage teaching staff profiles, designations, and department assignments.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-[#A4123F] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#A4123F]/90 cursor-pointer"
        >
          + Add Faculty Member
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-[#2B2B2E]/10 bg-white p-4 shadow-xs">
        <div className="w-full sm:w-1/2">
          <label className="block text-xs font-semibold text-[#2B2B2E]/70 mb-1">Search Faculty</label>
          <input
            type="text"
            placeholder="Search by name, email, specialization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm text-[#2B2B2E] placeholder-[#2B2B2E]/40 focus:border-[#A4123F] focus:outline-hidden"
          />
        </div>
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
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2B2B2E]/10 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-[#2B2B2E]">
          <thead className="border-b border-[#2B2B2E]/10 bg-[#F5F3EF] text-xs uppercase font-semibold text-[#2B2B2E]/70">
            <tr>
              <th className="px-6 py-3.5">Name</th>
              <th className="px-6 py-3.5">Email</th>
              <th className="px-6 py-3.5">Department</th>
              <th className="px-6 py-3.5">Designation</th>
              <th className="px-6 py-3.5">Specialization</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2B2B2E]/10">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-44" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-6 py-4 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
                </tr>
              ))
            ) : faculty.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#2B2B2E]/50">
                  No faculty members found.
                </td>
              </tr>
            ) : (
              faculty.map((f) => (
                <tr key={f.userId} className="hover:bg-[#F5F3EF]/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-[#2B2B2E]">{f.name}</td>
                  <td className="px-6 py-4 text-[#2B2B2E]/70 font-mono text-xs">{f.email}</td>
                  <td className="px-6 py-4 font-bold text-[#A4123F]">{f.department?.code || "—"}</td>
                  <td className="px-6 py-4 text-[#2B2B2E]/80">{f.profile?.designation || "Faculty"}</td>
                  <td className="px-6 py-4 text-[#2B2B2E]/70">{f.profile?.specialization || "General"}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setEditItem(f);
                        setName(f.name);
                        setEmail(f.email);
                        setDepartmentId(f.departmentId || "");
                        setDesignation(f.profile?.designation || "");
                        setQualification(f.profile?.qualification || "");
                        setSpecialization(f.profile?.specialization || "");
                      }}
                      className="text-xs font-semibold text-[#A4123F] hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add New Faculty Member">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Alan Turing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Email</label>
              <input
                type="email"
                required
                placeholder="alan@university.edu"
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
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Designation</label>
              <input
                type="text"
                placeholder="e.g. Associate Professor"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Specialization</label>
              <input
                type="text"
                placeholder="e.g. Artificial Intelligence"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
              />
            </div>
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
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Faculty Profile">
        <form onSubmit={handleUpdate} className="space-y-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Specialization</label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2 text-sm focus:border-[#A4123F] focus:outline-hidden"
              />
            </div>
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
    </div>
  );
}
