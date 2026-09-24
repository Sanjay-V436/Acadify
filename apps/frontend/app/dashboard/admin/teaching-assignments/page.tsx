"use client";

import { useEffect, useState } from "react";
import {
  Class,
  Faculty,
  Subject,
  getClasses,
  getFaculty,
  getAssignmentsForClass,
  assignFacultyToSubject,
  deleteTeachingAssignment,
} from "@/lib/admin-api";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";

interface AssignmentRow {
  subject: Subject;
  assignmentId: string | null;
  assignedFacultyId: string | null; // FacultyProfile ID
  assignedFaculty: {
    id: string;
    user?: { name: string; email: string };
  } | null;
}

export default function AdminTeachingAssignmentsPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  const [assignmentRows, setAssignmentRows] = useState<AssignmentRow[]>([]);
  const [departmentFaculty, setDepartmentFaculty] = useState<Faculty[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Updating tracking state per subject
  const [updatingSubjectId, setUpdatingSubjectId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoadingClasses(true);
        const res = await getClasses({ limit: 100 });
        setClasses(res.data);
        if (res.data.length > 0) {
          setSelectedClassId(res.data[0].id);
        }
      } catch (err: any) {
        setToast({ message: err.message || "Failed to load classes", type: "error" });
      } finally {
        setLoadingClasses(false);
      }
    };
    fetchClasses();
  }, []);

  // Load assignments and faculty when selected class changes
  useEffect(() => {
    if (!selectedClassId) {
      setSelectedClass(null);
      setAssignmentRows([]);
      setDepartmentFaculty([]);
      return;
    }

    const loadClassAssignments = async () => {
      try {
        setLoadingAssignments(true);
        const data = await getAssignmentsForClass(selectedClassId);
        setSelectedClass(data.class);
        setAssignmentRows(data.rows);

        // Fetch department faculty
        if (data.class.departmentId) {
          const facRes = await getFaculty({ departmentId: data.class.departmentId, limit: 100 });
          setDepartmentFaculty(facRes.data);
        }
      } catch (err: any) {
        setToast({ message: err.message || "Failed to load teaching assignments for class", type: "error" });
      } finally {
        setLoadingAssignments(false);
      }
    };

    loadClassAssignments();
  }, [selectedClassId]);

  const handleFacultyChange = async (subjectId: string, facultyProfileId: string) => {
    if (!selectedClassId) return;

    if (!facultyProfileId) {
      // Find existing assignment to delete
      const existing = assignmentRows.find((r) => r.subject.id === subjectId);
      if (existing && existing.assignmentId) {
        handleUnassign(subjectId, existing.assignmentId);
      }
      return;
    }

    try {
      setUpdatingSubjectId(subjectId);
      await assignFacultyToSubject({
        classId: selectedClassId,
        subjectId,
        facultyId: facultyProfileId,
      });

      setToast({ message: "Teaching assignment updated successfully", type: "success" });

      // Refresh rows
      const data = await getAssignmentsForClass(selectedClassId);
      setAssignmentRows(data.rows);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to update teaching assignment", type: "error" });
    } finally {
      setUpdatingSubjectId(null);
    }
  };

  const handleUnassign = async (subjectId: string, assignmentId: string) => {
    try {
      setUpdatingSubjectId(subjectId);
      await deleteTeachingAssignment(assignmentId);
      setToast({ message: "Faculty unassigned successfully", type: "success" });

      // Refresh rows
      const data = await getAssignmentsForClass(selectedClassId);
      setAssignmentRows(data.rows);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to remove assignment", type: "error" });
    } finally {
      setUpdatingSubjectId(null);
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#2B2B2E]">Teaching Assignments</h1>
        <p className="text-sm text-[#2B2B2E]/70">
          Assign faculty members to subjects for a specific class cohort and semester level.
        </p>
      </div>

      {/* Class Selector Bar */}
      <div className="rounded-xl border border-[#2B2B2E]/10 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="w-full sm:w-1/2 space-y-1">
            <label className="block text-xs font-semibold text-[#2B2B2E] uppercase">Select Class Cohort</label>
            {loadingClasses ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full rounded-lg border border-[#2B2B2E]/20 px-3.5 py-2.5 text-sm font-medium text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden"
              >
                {classes.length === 0 ? (
                  <option value="">No classes available</option>
                ) : (
                  classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.department?.code} — Batch {c.batchYear} {c.section ? `(Sec ${c.section})` : ""} — Semester {c.currentSemester}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {selectedClass && (
            <div className="flex items-center gap-3 rounded-lg bg-[#F5F3EF] px-4 py-2 text-xs">
              <div>
                <span className="text-[#2B2B2E]/60">Department:</span>{" "}
                <strong className="text-[#A4123F]">{selectedClass.department?.code}</strong>
              </div>
              <div className="h-4 w-px bg-[#2B2B2E]/20" />
              <div>
                <span className="text-[#2B2B2E]/60">Current Semester:</span>{" "}
                <strong className="text-[#2B2B2E]">Sem {selectedClass.currentSemester}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Teaching Assignment Table */}
      <div className="overflow-hidden rounded-xl border border-[#2B2B2E]/10 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-[#2B2B2E]">
          <thead className="border-b border-[#2B2B2E]/10 bg-[#F5F3EF] text-xs uppercase font-semibold text-[#2B2B2E]/70">
            <tr>
              <th className="px-6 py-3.5">Subject Code</th>
              <th className="px-6 py-3.5">Subject Name</th>
              <th className="px-6 py-3.5">Assigned Faculty</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2B2B2E]/10">
            {loadingAssignments ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-8 w-64" /></td>
                  <td className="px-6 py-4 text-right"><Skeleton className="ml-auto h-4 w-16" /></td>
                </tr>
              ))
            ) : !selectedClassId ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#2B2B2E]/50">
                  Please select a class cohort above to view subjects.
                </td>
              </tr>
            ) : assignmentRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#2B2B2E]/50">
                  No subjects found for {selectedClass?.department?.code} at Semester {selectedClass?.currentSemester}.
                </td>
              </tr>
            ) : (
              assignmentRows.map((row) => {
                const isUpdating = updatingSubjectId === row.subject.id;
                const assignedProf = row.assignedFaculty?.user?.name || null;

                return (
                  <tr key={row.subject.id} className="hover:bg-[#F5F3EF]/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-[#A4123F]">{row.subject.code}</td>
                    <td className="px-6 py-4 font-medium">{row.subject.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          disabled={isUpdating}
                          value={row.assignedFacultyId || ""}
                          onChange={(e) => handleFacultyChange(row.subject.id, e.target.value)}
                          className="w-full max-w-xs rounded-lg border border-[#2B2B2E]/20 px-3 py-1.5 text-xs text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden disabled:opacity-50"
                        >
                          <option value="">-- Unassigned --</option>
                          {departmentFaculty.map((f) => (
                            <option key={f.profile?.id || f.userId} value={f.profile?.id || ""}>
                              {f.name} ({f.profile?.designation || "Faculty"})
                            </option>
                          ))}
                        </select>
                        {isUpdating && <span className="text-xs text-[#E8A33D] font-semibold">Saving...</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {row.assignmentId ? (
                        <button
                          disabled={isUpdating}
                          onClick={() => handleUnassign(row.subject.id, row.assignmentId!)}
                          className="text-xs font-semibold text-red-600 hover:underline cursor-pointer disabled:opacity-50"
                        >
                          Unassign
                        </button>
                      ) : (
                        <span className="text-xs text-[#2B2B2E]/40 italic">Not Assigned</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
