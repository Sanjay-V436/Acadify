import { authFetch } from "./auth";

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    students?: number;
    classes?: number;
    subjects?: number;
  };
}

export interface Class {
  id: string;
  departmentId: string;
  batchYear: number;
  section?: string | null;
  currentSemester: number;
  createdAt?: string;
  updatedAt?: string;
  department?: Department;
  _count?: {
    students?: number;
    teachingAssignments?: number;
  };
  students?: Array<{
    id: string;
    name: string;
    email: string;
    studentId: string;
  }>;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  semester: number;
  departmentId: string;
  createdAt?: string;
  updatedAt?: string;
  department?: Department;
}

export interface TeachingAssignment {
  id: string;
  classId: string;
  subjectId: string;
  facultyId: string;
  createdAt?: string;
  class?: Class;
  subject?: Subject;
  faculty?: {
    id: string; // FacultyProfile ID
    userId: string;
    user?: {
      id: string;
      name: string;
      email: string;
    };
  };
}

export interface Student {
  id: string; // User ID
  email: string;
  name: string;
  studentId: string; // Roll number
  role: "STUDENT";
  departmentId?: string | null;
  classId?: string | null;
  department?: Department | null;
  class?: Class | null;
}

export interface Faculty {
  userId: string;
  facultyProfileId: string | null;
  name: string;
  email: string;
  role: "FACULTY";
  departmentId?: string | null;
  department?: Department | null;
  profile?: {
    id: string;
    designation?: string | null;
    specialization?: string | null;
    experienceYears?: number | null;
    qualification?: string | null;
    bio?: string | null;
  };
}

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message || `API error (${res.status})`;
    throw new Error(errorMsg);
  }
  return data as T;
}

// Departments API
export const getDepartments = (search?: string, page = 1, limit = 100) => {
  const q = new URLSearchParams();
  if (search) q.append("search", search);
  q.append("page", String(page));
  q.append("limit", String(limit));
  return apiCall<PaginatedResponse<Department>>(`/admin/departments?${q.toString()}`);
};

export const createDepartment = (body: { name: string; code: string }) =>
  apiCall<Department>("/admin/departments", { method: "POST", body: JSON.stringify(body) });

export const updateDepartment = (id: string, body: { name?: string; code?: string }) =>
  apiCall<Department>(`/admin/departments/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteDepartment = (id: string) =>
  apiCall<{ success: boolean }>(`/admin/departments/${id}`, { method: "DELETE" });

// Classes API
export const getClasses = (params?: { departmentId?: string; batchYear?: number | string; section?: string; currentSemester?: number | string; page?: number; limit?: number }) => {
  const q = new URLSearchParams();
  if (params?.departmentId) q.append("departmentId", params.departmentId);
  if (params?.batchYear) q.append("batchYear", String(params.batchYear));
  if (params?.section) q.append("section", params.section);
  if (params?.currentSemester) q.append("currentSemester", String(params.currentSemester));
  q.append("page", String(params?.page || 1));
  q.append("limit", String(params?.limit || 100));
  return apiCall<PaginatedResponse<Class>>(`/admin/classes?${q.toString()}`);
};

export const getClassById = (id: string) =>
  apiCall<Class>(`/admin/classes/${id}`);

export const createClass = (body: { departmentId: string; batchYear: number; section?: string | null; currentSemester?: number }) =>
  apiCall<Class>("/admin/classes", { method: "POST", body: JSON.stringify(body) });

export const updateClass = (id: string, body: Partial<{ departmentId: string; batchYear: number; section?: string | null; currentSemester: number }>) =>
  apiCall<Class>(`/admin/classes/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteClass = (id: string) =>
  apiCall<{ success: boolean }>(`/admin/classes/${id}`, { method: "DELETE" });

// Subjects API
export const getSubjects = (params?: { departmentId?: string; semester?: number | string; search?: string; page?: number; limit?: number }) => {
  const q = new URLSearchParams();
  if (params?.departmentId) q.append("departmentId", params.departmentId);
  if (params?.semester) q.append("semester", String(params.semester));
  if (params?.search) q.append("search", params.search);
  q.append("page", String(params?.page || 1));
  q.append("limit", String(params?.limit || 100));
  return apiCall<PaginatedResponse<Subject>>(`/admin/subjects?${q.toString()}`);
};

export const createSubject = (body: { name: string; code: string; semester: number; departmentId: string }) =>
  apiCall<Subject>("/admin/subjects", { method: "POST", body: JSON.stringify(body) });

export const updateSubject = (id: string, body: Partial<{ name: string; code: string; semester: number; departmentId: string }>) =>
  apiCall<Subject>(`/admin/subjects/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteSubject = (id: string) =>
  apiCall<{ success: boolean }>(`/admin/subjects/${id}`, { method: "DELETE" });

// Faculty API
export const getFaculty = (params?: { departmentId?: string; search?: string; page?: number; limit?: number }) => {
  const q = new URLSearchParams();
  if (params?.departmentId) q.append("departmentId", params.departmentId);
  if (params?.search) q.append("search", params.search);
  q.append("page", String(params?.page || 1));
  q.append("limit", String(params?.limit || 100));
  return apiCall<PaginatedResponse<Faculty>>(`/admin/faculty?${q.toString()}`);
};

export const createFaculty = (body: {
  email: string;
  password: string;
  name: string;
  departmentId: string;
  designation?: string;
  qualification?: string;
  experienceYears?: number;
  specialization?: string;
}) => apiCall<Faculty>("/admin/faculty", { method: "POST", body: JSON.stringify(body) });

export const updateFaculty = (id: string, body: Record<string, unknown>) =>
  apiCall<Faculty>(`/admin/faculty/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// Students API
export const getStudents = (params?: { departmentId?: string; classId?: string; search?: string; page?: number; limit?: number }) => {
  const q = new URLSearchParams();
  if (params?.departmentId) q.append("departmentId", params.departmentId);
  if (params?.classId) q.append("classId", params.classId);
  if (params?.search) q.append("search", params.search);
  q.append("page", String(params?.page || 1));
  q.append("limit", String(params?.limit || 100));
  return apiCall<PaginatedResponse<Student>>(`/admin/students?${q.toString()}`);
};

export const createStudent = (body: {
  email: string;
  password: string;
  name: string;
  studentId: string;
  classId?: string | null;
}) => apiCall<Student>("/admin/students", { method: "POST", body: JSON.stringify(body) });

export const updateStudent = (id: string, body: Partial<{ name: string; studentId: string; classId: string; password?: string }>) =>
  apiCall<Student>(`/admin/students/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteStudent = (id: string) =>
  apiCall<{ success: boolean }>(`/admin/students/${id}`, { method: "DELETE" });

export interface BulkImportStudentRow {
  studentId: string;
  name: string;
  email: string;
  password: string;
  classId: string;
}

export const importStudentsBulk = (students: BulkImportStudentRow[]) =>
  apiCall<{
    total: number;
    imported: number;
    failed: number;
    errors: Array<{ row: number; field?: string; message: string }>;
  }>("/admin/students/import", { method: "POST", body: JSON.stringify({ students }) });

// Teaching Assignments API
export const getTeachingAssignments = (classId?: string) => {
  const q = classId ? `?classId=${classId}` : "";
  return apiCall<TeachingAssignment[]>(`/admin/teaching-assignments${q}`);
};

export const getAssignmentsForClass = (classId: string) =>
  apiCall<{
    class: Class;
    rows: Array<{
      subject: Subject;
      assignmentId: string | null;
      assignedFacultyId: string | null;
      assignedFaculty: {
        id: string;
        user?: { name: string; email: string };
      } | null;
    }>;
  }>(`/admin/classes/${classId}/teaching-assignments`);

export const assignFacultyToSubject = (body: { classId: string; subjectId: string; facultyId: string }) =>
  apiCall<TeachingAssignment>("/admin/teaching-assignments", { method: "POST", body: JSON.stringify(body) });

export const deleteTeachingAssignment = (id: string) =>
  apiCall<{ success: boolean }>(`/admin/teaching-assignments/${id}`, { method: "DELETE" });
