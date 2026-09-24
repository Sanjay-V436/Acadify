export interface PaginationQuery {
  page?: number | string;
  limit?: number | string;
}

export function parsePagination(query: PaginationQuery) {
  const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || 20), 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

// Class DTOs
export class CreateClassDto {
  departmentId!: string;
  batchYear!: number;
  section?: string | null;
  currentSemester?: number;
}

export class UpdateClassDto {
  departmentId?: string;
  batchYear?: number;
  section?: string | null;
  currentSemester?: number;
}

export class FilterClassDto {
  departmentId?: string;
  batchYear?: number | string;
  section?: string;
  currentSemester?: number | string;
  page?: number | string;
  limit?: number | string;
}

// Student DTOs
export class CreateStudentDto {
  email!: string;
  password!: string;
  name!: string;
  studentId!: string;
  classId?: string | null;
  departmentId?: string | null;
  programme?: string;
}

export class UpdateStudentDto {
  name?: string;
  studentId?: string;
  classId?: string | null;
  departmentId?: string | null;
  programme?: string;
  password?: string;
}

export class FilterStudentDto {
  departmentId?: string;
  classId?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export class BulkImportStudentRowDto {
  studentId!: string;
  name!: string;
  email!: string;
  password!: string;
  classId!: string;
}

export class BulkImportStudentsDto {
  students!: BulkImportStudentRowDto[];
}

// Faculty DTOs
export class CreateFacultyDto {
  email!: string;
  password!: string;
  name!: string;
  departmentId!: string;
  designation?: string;
  bio?: string;
  qualification?: string;
  experienceYears?: number;
  specialization?: string;
  maxStudents?: number;
}

export class UpdateFacultyDto {
  name?: string;
  departmentId?: string;
  designation?: string;
  bio?: string;
  qualification?: string;
  experienceYears?: number;
  specialization?: string;
  maxStudents?: number;
}

export class FilterFacultyDto {
  departmentId?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

// Department DTOs
export class CreateDepartmentDto {
  name!: string;
  code!: string;
}

export class UpdateDepartmentDto {
  name?: string;
  code?: string;
}

// Subject DTOs
export class CreateSubjectDto {
  name!: string;
  code!: string;
  semester!: number;
  departmentId!: string;
}

export class UpdateSubjectDto {
  name?: string;
  code?: string;
  semester?: number;
  departmentId?: string;
}

export class FilterSubjectDto {
  departmentId?: string;
  semester?: number | string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

// TeachingAssignment DTOs
export class AssignFacultyDto {
  classId!: string;
  subjectId!: string;
  facultyId!: string;
}
