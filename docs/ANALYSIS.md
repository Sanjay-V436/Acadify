# Acadify Platform Architecture & Refactoring Analysis

> **Branch:** `feat/admin-module-restructure`  
> **Target Strategic Pivot:** Transition from "Resource Management" to Project-Oriented Workflow (Open Lab / Project Phase Courses: Team Formation, Mentor Selection, Coordinator Management, Panel-Based Reviews for Combined ECE + CCE Batches).

---

## 1. Tech Stack & Setup

### Architecture Overview
Acadify is structured as a polyglot monorepo containing three core applications orchestrated via a root orchestrator:
1. **`apps/backend`**: NestJS 11 REST API with Prisma ORM.
2. **`apps/frontend`**: Next.js 16 (App Router) client application with Tailwind CSS v4.
3. **`apps/ai-service`**: FastAPI microservice for semantic vector search and LLM compatibility analysis.

```mermaid
graph TD
    Client[Next.js 16 Frontend :3001] -->|HTTP / JSON + Bearer JWT| Backend[NestJS 11 Backend :3000]
    Backend -->|Prisma Client 6.x| Postgres[(PostgreSQL / Supabase)]
    Backend -->|POST /ai/mentor-recommendation| AIService[FastAPI AI Service :8001]
    Backend -->|POST /ai/faculty-profile/embed| AIService
    AIService -->|BAAI/bge-small-en-v1.5 embeddings| ChromaDB[(ChromaDB :8000)]
    AIService -->|GenAI SDK| Gemini[Google Gemini 3.5 Flash Lite]
```

### Stack Breakdown

| Component | Technology | Version | Location / Config Citation |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | NestJS | `^11.0.1` | [`apps/backend/package.json:27`](file:///d:/Acadify/apps/backend/package.json#L27) |
| **Backend Runtime** | Node.js / TypeScript | TS `^5.7.3` | [`apps/backend/package.json:65`](file:///d:/Acadify/apps/backend/package.json#L65) |
| **Database & ORM** | PostgreSQL via Prisma | `^6.19.3` | [`apps/backend/package.json:32`](file:///d:/Acadify/apps/backend/package.json#L32), [`schema.prisma:5-9`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L5-L9) |
| **Authentication** | Passport JWT, bcrypt | `passport-jwt ^4.0.1`, `bcrypt ^6.0.0` | [`apps/backend/package.json:33,36`](file:///d:/Acadify/apps/backend/package.json#L33) |
| **Frontend Framework**| Next.js (App Router) | `16.2.11` | [`apps/frontend/package.json:13`](file:///d:/Acadify/apps/frontend/package.json#L13) |
| **Frontend Runtime** | React 19 | `19.2.4` | [`apps/frontend/package.json:14`](file:///d:/Acadify/apps/frontend/package.json#L14) |
| **Styling** | Tailwind CSS v4 | `@tailwindcss/postcss ^4`, `tailwindcss ^4` | [`apps/frontend/package.json:18,24`](file:///d:/Acadify/apps/frontend/package.json#L18) |
| **Icons** | Lucide React | `^1.47.0` | [`apps/frontend/package.json:12`](file:///d:/Acadify/apps/frontend/package.json#L12) |
| **AI Microservice** | FastAPI, Uvicorn | Python 3.11+, `uvicorn[standard]` | [`apps/ai-service/requirements.txt:1-2`](file:///d:/Acadify/apps/ai-service/requirements.txt#L1-L2) |
| **Vector Database** | ChromaDB (HTTP Client)| `chromadb` client connecting to port 8000 | [`apps/ai-service/requirements.txt:4`](file:///d:/Acadify/apps/ai-service/requirements.txt#L4), [`main.py:21-27`](file:///d:/Acadify/apps/ai-service/main.py#L21-L27) |
| **Embedding Model** | HuggingFace SentenceTransformer | `BAAI/bge-small-en-v1.5` (384-dimensional) | [`apps/ai-service/main.py:18`](file:///d:/Acadify/apps/ai-service/main.py#L18) |
| **LLM Reasoning** | Google GenAI SDK | `google-genai` (Model: `gemini-3.5-flash-lite`) | [`apps/ai-service/requirements.txt:10`](file:///d:/Acadify/apps/ai-service/requirements.txt#L10), [`gemini_service.py:76-80`](file:///d:/Acadify/apps/ai-service/gemini_service.py#L76-L80) |
| **Orchestration** | Concurrently / Docker | Concurrently `^10.0.5`, Docker Compose | [`package.json:5,8`](file:///d:/Acadify/package.json#L5), [`docker-compose.yml:1-54`](file:///d:/Acadify/docker-compose.yml#L1-L54) |

### Hosting & Infrastructure Assumptions
- **Database**: Cloud PostgreSQL (Supabase connection strings indicated by `DIRECT_URL` and `DATABASE_URL` in [`apps/backend/prisma/schema.prisma:7-8`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L7-L8)).
- **AI Service Vector Storage**: Local ChromaDB instance hosted via Docker container (`chromadb/chroma`) mapping volume `chroma_data:/chroma/chroma` ([`docker-compose.yml:44-50`](file:///d:/Acadify/docker-compose.yml#L44-L50)).
- **File Storage**: Currently absent. Database fields contain only string URLs (`fileUrl`, `imageUrl`, `githubUrl`). No S3/GCS or local multipart file upload pipeline is implemented.

### How to Run Locally

#### Option A: Running with Concurrently (Local Machine)
Ensure Node.js (v20+), Python 3.11 with a virtual environment in `apps/ai-service/venv`, and Docker (for ChromaDB) are installed.
```bash
# 1. From root, start ChromaDB via docker
docker run -d -p 8000:8000 --name chromadb chromadb/chroma

# 2. Run all services simultaneously
npm run dev
```
Root script executed ([`package.json:8`](file:///d:/Acadify/package.json#L8)):
- AI Service: `cd apps/ai-service && .\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8001`
- Backend: `cd apps/backend && npm run start:dev` (Port 3000)
- Frontend: `cd apps/frontend && npm run dev` (Port 3001)

#### Option B: Docker Compose
```bash
docker compose up --build
```
Orchestrates backend (:3000), frontend (:3001), ai-service (:8001), and chromadb (:8000) ([`docker-compose.yml:1-50`](file:///d:/Acadify/docker-compose.yml#L1-L50)).

### Environment Variables Needed

#### `apps/backend/.env`
```env
DATABASE_URL="postgresql://user:password@host:port/database?pgbouncer=true" # Connection pooler URL
DIRECT_URL="postgresql://user:password@host:port/database"                  # Direct connection for migrations
JWT_ACCESS_SECRET="your-256-bit-access-secret"                              # Signs 15m access token
JWT_REFRESH_SECRET="your-256-bit-refresh-secret"                            # Signs 7d refresh token
AI_SERVICE_URL="http://localhost:8001"                                      # HTTP endpoint to FastAPI AI service
PORT=3000                                                                   # Optional, defaults to 3000
```

#### `apps/frontend/.env.local`
```env
NEXT_PUBLIC_API_URL="http://localhost:3000"                                 # Next.js client backend proxy
```

#### `apps/ai-service/.env`
```env
CHROMA_HOST="localhost"                                                     # "chromadb" inside docker
CHROMA_PORT="8000"                                                          # Chroma HTTP port
GEMINI_API_KEY_1="AIzaSy..."                                                # Primary Google Gemini API key
GEMINI_API_KEY_2="AIzaSy..."                                                # Fallback Google Gemini API key
GEMINI_MODEL="gemini-3.5-flash-lite"                                        # Target Gemini LLM model identifier
```

---

## 2. Folder Structure

```
d:\Acadify\
├── package.json                         # Monorepo root definition running concurrently dev scripts
├── docker-compose.yml                   # Multi-container orchestration (backend, frontend, AI, Chroma)
├── admin_module_audit_report.md         # Previous architectural inspection report
├── README.md                            # Project overview and handoff notes
├── docs\
│   └── ANALYSIS.md                      # This comprehensive architecture report
│
├── apps\
│   ├── backend\                         # NestJS API application (:3000)
│   │   ├── Dockerfile.dev               # Development Dockerfile for backend container
│   │   ├── package.json                 # Backend dependencies (NestJS 11, Prisma 6, Passport, Bcrypt)
│   │   ├── tsconfig.json                # TypeScript compiler configuration
│   │   ├── prisma\
│   │   │   ├── schema.prisma            # Prisma ORM schema (PostgreSQL)
│   │   │   ├── seed.ts                  # Database seeder (Admin, Faculty, Student)
│   │   │   ├── import-faculty.ts        # Faculty CSV importer generating UUID mappings
│   │   │   └── migrations\              # Chronological SQL migrations (8 migration folders)
│   │   ├── scripts\
│   │   │   ├── cleanup-test-data.js     # Script purging non-essential test data
│   │   │   ├── cleanup-test-depts.js    # Script cleaning orphaned test departments
│   │   │   └── archive\                 # 8 transitional migration verification & snapshot scripts
│   │   └── src\
│   │       ├── main.ts                  # Application bootstrap, CORS configuration, listener (:3000)
│   │       ├── app.module.ts            # Root module wiring Auth, Profiles, Projects, Admin, AI
│   │       ├── admin\                   # New Admin Management Module (Restructured)
│   │       │   ├── admin.module.ts      # Registers all 6 admin controllers & 6 services
│   │       │   ├── dto\admin.dto.ts     # Data Transfer Objects & pagination helpers for Admin
│   │       │   ├── controllers\         # Admin REST Controllers (Protected by RolesGuard)
│   │       │   │   ├── admin-classes.controller.ts            # CRUD endpoints for Class cohorts
│   │       │   │   ├── admin-departments.controller.ts        # Endpoints for Departments (Missing DELETE)
│   │       │   │   ├── admin-faculty.controller.ts            # Endpoints for Faculty users & profiles
│   │       │   │   ├── admin-students.controller.ts           # Endpoints for Students & bulk import
│   │       │   │   ├── admin-subjects.controller.ts           # CRUD endpoints for curriculum Subjects
│   │       │   │   └── admin-teaching-assignments.controller.ts # Endpoints mapping Faculty to Subjects
│   │       │   └── services\            # Business logic & Prisma access for Admin domain
│   │       │       ├── admin-classes.service.ts               # Class entity lifecycle & student unlinking
│   │       │       ├── admin-departments.service.ts           # Department validation & lookup logic
│   │       │       ├── admin-faculty.service.ts               # Faculty creation, user transaction, re-embedding
│   │       │       ├── admin-students.service.ts              # Student creation, roll ID check, batch import
│   │       │       ├── admin-subjects.service.ts              # Subject management & teaching cleanup
│   │       │       └── admin-teaching-assignments.service.ts  # Upserting class-subject-faculty assignments
│   │       ├── auth\                    # JWT Authentication & RBAC Module
│   │       │   ├── auth.controller.ts   # Signup, login, refresh, profile endpoints
│   │       │   ├── auth.service.ts      # Bcrypt password hashing & JWT token issuing
│   │       │   ├── decorators\          # Custom decorators (@Roles)
│   │       │   ├── guards\              # Guards (JwtAuthGuard, RolesGuard)
│   │       │   └── strategies\          # Passport JWT strategy reading Bearer token
│   │       ├── mentor-recommendation\   # Recommendation Proxy Module
│   │       │   ├── mentor-recommendation.controller.ts # POST /mentor-recommendation
│   │       │   └── mentor-recommendation.service.ts    # Enriches Python AI scores with Postgres availability
│   │       ├── prisma\
│   │       │   └── prisma.service.ts    # Prisma Client lifecycle management service
│   │       ├── profiles\                # User & Faculty Profile Management Module
│   │       │   ├── profiles.controller.ts # GET/PATCH /profiles/me
│   │       │   └── profiles.service.ts    # Updates profile fields & calls AI re-embedding endpoint
│   │       ├── projects\                # Student Portfolio Projects Module
│   │       │   ├── projects.controller.ts # CRUD /projects restricted to STUDENT role
│   │       │   └── projects.service.ts    # Single-student project portfolio manager
│   │       └── users\
│   │           └── users.service.ts     # Internal user lookup helper
│   │
│   ├── frontend\                        # Next.js 16 Web Application (:3001)
│   │   ├── package.json                 # Next.js 16, React 19, Tailwind CSS v4, Lucide React
│   │   ├── app\
│   │   │   ├── layout.tsx               # Root HTML document layout with Manrope font
│   │   │   ├── globals.css              # Global styles & Tailwind v4 `@theme` variables
│   │   │   ├── page.tsx                 # Root landing redirector
│   │   │   ├── login\page.tsx           # Authentication login page storing tokens in localStorage
│   │   │   └── dashboard\               # Authenticated Dashboard Application
│   │   │       ├── layout.tsx           # Dashboard shell rendering Sidebar & Session Expired modal
│   │   │       ├── page.tsx             # Role-aware dashboard overview with metrics & quick actions
│   │   │       ├── profile\page.tsx     # Student & faculty profile viewer / editor
│   │   │       ├── projects\page.tsx    # Student project portfolio workspace
│   │   │       ├── mentor-recommendation\page.tsx # AI semantic mentor search interface
│   │   │       ├── resources\page.tsx   # Placeholder: "Coming soon"
│   │   │       └── admin\               # Academic Administration Pages
│   │   │           ├── departments\page.tsx           # Department CRUD table & dialog
│   │   │           ├── classes\page.tsx               # Class cohorts table & form
│   │   │           ├── subjects\page.tsx              # Curriculum subjects table & modal
│   │   │           ├── faculty\page.tsx               # Faculty accounts & credentials table
│   │   │           ├── students\page.tsx              # Student roster with CSV bulk import modal
│   │   │           └── teaching-assignments\page.tsx  # Matrix assigning faculty to class-subjects
│   │   ├── components\
│   │   │   ├── Sidebar.tsx              # Role-aware navigation sidebar (STUDENT, FACULTY, ADMIN)
│   │   │   ├── SessionExpiredModal.tsx  # Event-driven modal intercepting 401 token expiration
│   │   │   ├── admin\
│   │   │   │   └── AdminGuard.tsx       # Client-side admin check component (DEAD CODE: never imported)
│   │   │   └── ui\                      # Reusable headless UI design system
│   │   │       ├── Modal.tsx            # Accessible modal dialog with backdrop & escape listener
│   │   │       ├── ConfirmDialog.tsx    # Confirmation dialog for dangerous/destructive actions
│   │   │       ├── Toast.tsx            # Floating toast notification system
│   │   │       ├── Combobox.tsx         # Searchable dropdown select component
│   │   │       ├── Skeleton.tsx         # Loading placeholder skeleton components
│   │   │       └── EmptyState.tsx       # Standard empty data illustration & message
│   │   └── lib\
│   │       ├── auth.ts                  # Client auth helper, token refresh queue, authFetch wrapper
│   │       └── admin-api.ts             # API client methods for all /admin/* endpoints
│   │
│   └── ai-service\                      # FastAPI Microservice (:8001)
│       ├── main.py                      # FastAPI app, BGE model loader, ChromaDB integration
│       ├── gemini_service.py            # Gemini 3.5 Flash Lite structured evaluation wrapper
│       ├── requirements.txt             # Python dependencies (fastapi, chromadb, sentence-transformers)
│       ├── faculty_scraper\             # Web scraping scripts extracting faculty profiles
│       │   ├── scraper.py               # BeautifulSoup crawler
│       │   └── faculty_export.csv       # Raw scraped faculty records
│       └── prisma\
│           └── faculty-id-mapping.csv   # Mapping linking scraped names to Postgres UUIDs
```

---

## 3. Data Model

### Entity Descriptions
The active schema is defined in [`apps/backend/prisma/schema.prisma`](file:///d:/Acadify/apps/backend/prisma/schema.prisma). It contains **9 Models** and **3 Enums**.

1. **`User`** ([`schema.prisma:31-56`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L31-L56)): Base identity table for all platform actors.
   - Fields: `id` (UUID), `email` (unique), `passwordHash`, `name`, `role` (`STUDENT`, `FACULTY`, `ADMIN`), `bio`, `programme`, `studentId` (unique roll number), `academicInterests` (string[]), `careerInterests` (string[]), `skills` (string[]), `githubUrl`, `linkedinUrl`, `portfolioUrl`, `currentSemester` (Int), `departmentId` (FK), `classId` (FK), `createdAt`.
   - Relations: `department` -> `Department`, `class` -> `Class`, `facultyProfile` -> `FacultyProfile`, `uploadedResources` -> `Resource[]`, `projectsAsStudent` -> `ProjectStudent[]`.
2. **`Department`** ([`schema.prisma:58-66`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L58-L66)): Academic division.
   - Fields: `id` (UUID), `name`, `code` (unique, e.g. "ECE", "CCE").
   - Relations: `subjects` -> `Subject[]`, `students` -> `User[]`, `classes` -> `Class[]`.
3. **`Subject`** ([`schema.prisma:68-78`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L68-L78)): Curricular course unit.
   - Fields: `id` (UUID), `name`, `code` (unique, e.g. "ECE201"), `semester` (Int), `departmentId` (FK).
   - Relations: `department` -> `Department`, `teachingAssignments` -> `TeachingAssignment[]`, `resources` -> `Resource[]`.
4. **`Class`** ([`schema.prisma:80-92`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L80-L92)): Cohort grouping students by department, admission year, and section.
   - Fields: `id` (UUID), `departmentId` (FK), `batchYear` (Int), `section` (String, nullable), `currentSemester` (Int, default 1).
   - Relations: `department` -> `Department`, `students` -> `User[]`, `teachingAssignments` -> `TeachingAssignment[]`.
   - Unique Constraint: `@@unique([departmentId, batchYear, section])`.
5. **`TeachingAssignment`** ([`schema.prisma:94-104`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L94-L104)): Maps a faculty profile to teach a specific subject in a specific class.
   - Fields: `id` (UUID), `classId` (FK), `subjectId` (FK), `facultyId` (FK -> `FacultyProfile.id`).
   - Relations: `class` -> `Class`, `subject` -> `Subject`, `faculty` -> `FacultyProfile`.
   - Unique Constraint: `@@unique([classId, subjectId])`.
6. **`FacultyProfile`** ([`schema.prisma:106-132`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L106-L132)): Extended academic metadata for faculty users.
   - Fields: `id` (UUID), `userId` (unique FK), `designation`, `bio`, `qualification`, `experienceYears` (Int), `researchInterests` (string[]), `currentResearch`, `skills` (string[]), `specialization`, `preferredDomains` (string[]), `preferredTechnologies` (string[]), URLs (`facultyWebpageUrl`, `googleScholarUrl`, `orcidUrl`, `linkedinUrl`), `availableForProjects` (Boolean, default true), `maxStudents` (Int, default 4), `currentStudents` (Int, default 0).
   - Relations: `user` -> `User`, `projectsAsMentor` -> `Project[]`, `teachingAssignments` -> `TeachingAssignment[]`.
7. **`Project`** ([`schema.prisma:134-153`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L134-L153)): Project portfolio record.
   - Fields: `id` (UUID), `title`, `description`, `technologies` (string[]), `domain`, `status` (`ProjectStatus`: `PROPOSED`, `APPROVED`, `IN_PROGRESS`, `COMPLETED`, `PUBLISHED`), `githubUrl`, `liveDemoUrl`, `imageUrl`, `startDate`, `expectedCompletion`, `createdAt`, `updatedAt`, `mentorId` (FK, nullable).
   - Relations: `mentor` -> `FacultyProfile`, `students` -> `ProjectStudent[]`.
8. **`ProjectStudent`** ([`schema.prisma:155-163`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L155-L163)): Join table linking students to projects.
   - Fields: `id` (UUID), `projectId` (FK), `userId` (FK).
   - Unique Constraint: `@@unique([projectId, userId])`.
9. **`Resource`** ([`schema.prisma:165-177`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L165-L177)): Academic course material (Legacy entity).
   - Fields: `id` (UUID), `title`, `fileUrl`, `type` (`ResourceType`: `PDF`, `PPT`, `DOCX`), `subjectId` (FK), `uploadedById` (FK -> `User.id`), `createdAt`.
   - Relations: `subject` -> `Subject`, `uploadedBy` -> `User`.

### Entity-Relationship Diagram

```mermaid
erDiagram
    DEPARTMENT ||--o{ USER : "has members"
    DEPARTMENT ||--o{ SUBJECT : "offers"
    DEPARTMENT ||--o{ CLASS : "organizes"
    
    CLASS ||--o{ USER : "enrolls students"
    CLASS ||--o{ TEACHING_ASSIGNMENT : "schedules"
    
    SUBJECT ||--o{ TEACHING_ASSIGNMENT : "assigned in"
    SUBJECT ||--o{ RESOURCE : "has materials"
    
    USER ||--|| FACULTY_PROFILE : "1-to-1 profile"
    USER ||--o{ PROJECT_STUDENT : "member of"
    USER ||--o{ RESOURCE : "uploaded by"
    
    FACULTY_PROFILE ||--o{ TEACHING_ASSIGNMENT : "teaches"
    FACULTY_PROFILE ||--o{ PROJECT : "mentors"
    
    PROJECT ||--o{ PROJECT_STUDENT : "has student members"
    
    USER {
        string id PK
        string email UK
        string passwordHash
        string name
        enum role "STUDENT, FACULTY, ADMIN"
        string studentId UK "Roll number"
        int currentSemester
        string departmentId FK
        string classId FK
    }

    DEPARTMENT {
        string id PK
        string name
        string code UK
    }

    SUBJECT {
        string id PK
        string name
        string code UK
        int semester
        string departmentId FK
    }

    CLASS {
        string id PK
        string departmentId FK
        int batchYear
        string section
        int currentSemester
    }

    TEACHING_ASSIGNMENT {
        string id PK
        string classId FK
        string subjectId FK
        string facultyId FK
    }

    FACULTY_PROFILE {
        string id PK
        string userId FK,UK
        string designation
        string specialization
        boolean availableForProjects
        int maxStudents
        int currentStudents
    }

    PROJECT {
        string id PK
        string title
        string description
        enum status "PROPOSED, APPROVED, IN_PROGRESS, COMPLETED, PUBLISHED"
        string mentorId FK
    }

    PROJECT_STUDENT {
        string id PK
        string projectId FK
        string userId FK
    }

    RESOURCE {
        string id PK
        string title
        string fileUrl
        enum type "PDF, PPT, DOCX"
        string subjectId FK
        string uploadedById FK
    }
```

---

## 4. Roles & Auth

### Implemented Roles
The application defines three roles in [`apps/backend/prisma/schema.prisma:11-15`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L11-L15):
- `STUDENT`: Enrolled learners with a roll number (`studentId`) and optional class enrollment (`classId`).
- `FACULTY`: Academic staff linked to a `FacultyProfile` for teaching assignments and project mentoring.
- `ADMIN`: Platform administrator managing departments, classes, subjects, faculty, students, and teaching allocations.

### How Roles are Enforced

#### 1. Backend Guards & Metadata
- **`JwtStrategy`** ([`apps/backend/src/auth/strategies/jwt.strategy.ts:15-17`](file:///d:/Acadify/apps/backend/src/auth/strategies/jwt.strategy.ts#L15-L17)): Extracts and validates the Bearer token from the `Authorization` header, returning `{ userId: payload.sub, email: payload.email, role: payload.role }` onto `req.user`.
- **`RolesGuard`** ([`apps/backend/src/auth/guards/roles.guard.ts:10-25`](file:///d:/Acadify/apps/backend/src/auth/guards/roles.guard.ts#L10-L25)): Reads `@Roles(...)` metadata set via `Reflector`. If the user's role is not included in the allowed roles, access is forbidden.
- Applied at controller level for all admin endpoints:
  ```typescript
  @Controller('admin/classes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  export class AdminClassesController { ... }
  ```

#### 2. Frontend Navigation & Session Management
- **Token Storage**: Access token (15m) and refresh token (7d) are stored in `window.localStorage` ([`apps/frontend/lib/auth.ts:11-14,40-41`](file:///d:/Acadify/apps/frontend/lib/auth.ts#L11-L14)).
- **Role Decoding**: `getCurrentUser()` inspects base64-decoded token payload via `atob(token.split(".")[1])` ([`apps/frontend/lib/auth.ts:99-111`](file:///d:/Acadify/apps/frontend/lib/auth.ts#L99-L111)).
- **Sidebar Filtering**: [`apps/frontend/components/Sidebar.tsx:8-31`](file:///d:/Acadify/apps/frontend/components/Sidebar.tsx#L8-L31) displays distinct nav menus based on `user.role`.

### Authentication & Authorization Gaps

> [!CAUTION]
> **Critical Privilege Escalation in Signup Endpoint**  
> In [`apps/backend/src/auth/auth.controller.ts:21-33`](file:///d:/Acadify/apps/backend/src/auth/auth.controller.ts#L21-L33) and [`apps/backend/src/auth/auth.service.ts:37`](file:///d:/Acadify/apps/backend/src/auth/auth.service.ts#L37), `POST /auth/signup` directly accepts `role: Role` in the public request body without verification or admin guarding. Anyone on the public internet can send `{"email": "attacker@acadify.com", "password": "pass", "name": "Attacker", "role": "ADMIN"}` and immediately gain full administrative privileges.

Other Authorization Gaps:
1. **Unprotected Admin Client-Side Pages**:  
   [`apps/frontend/components/admin/AdminGuard.tsx`](file:///d:/Acadify/apps/frontend/components/admin/AdminGuard.tsx) was implemented but is **never imported or used anywhere** in `apps/frontend`. None of the `/dashboard/admin/*` pages wrap themselves in `AdminGuard`, nor is there an `admin/layout.tsx`. Any student or faculty user navigating to `/dashboard/admin/students` renders the admin interface (API calls fail with 403, but client-side UI renders without obstruction).
2. **Missing Coordinator Role**:  
   There is no `COORDINATOR` role. No mechanism exists to grant project phase administration to specific faculty members without giving them full global `ADMIN` powers.
3. **Faculty Locked Out of Projects API**:  
   [`apps/backend/src/projects/projects.controller.ts:29`](file:///d:/Acadify/apps/backend/src/projects/projects.controller.ts#L29) is annotated strictly with `@Roles(Role.STUDENT)`. Even though the Sidebar displays "My Projects" for Faculty ([`apps/frontend/components/Sidebar.tsx:19`](file:///d:/Acadify/apps/frontend/components/Sidebar.tsx#L19)), any request made by a faculty member to `/projects` fails with HTTP 403 Forbidden.
4. **Runtime Crash Risk in `RolesGuard`**:  
   In [`apps/backend/src/auth/guards/roles.guard.ts:20-23`](file:///d:/Acadify/apps/backend/src/auth/guards/roles.guard.ts#L20-L23), if `@Roles(...)` is attached to an endpoint without `@UseGuards(JwtAuthGuard)`, `req.user` is undefined, throwing `TypeError: Cannot read properties of undefined (reading 'role')` (HTTP 500 error instead of 401/403).

---

## 5. Routes, APIs, & Pages

### Backend API Endpoints

| Method | Endpoint | Allowed Role(s) | Handler Citation | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/signup` | Public | [`auth.controller.ts:21`](file:///d:/Acadify/apps/backend/src/auth/auth.controller.ts#L21) | Register account (Security gap: allows ADMIN role) |
| `POST` | `/auth/login` | Public | [`auth.controller.ts:36`](file:///d:/Acadify/apps/backend/src/auth/auth.controller.ts#L36) | Authenticate credentials; returns access & refresh tokens |
| `POST` | `/auth/refresh` | Public | [`auth.controller.ts:41`](file:///d:/Acadify/apps/backend/src/auth/auth.controller.ts#L41) | Issues new token pair from refresh token |
| `GET` | `/auth/me` | Authenticated | [`auth.controller.ts:46`](file:///d:/Acadify/apps/backend/src/auth/auth.controller.ts#L46) | Returns decoded user session |
| `GET` | `/auth/admin-only` | `ADMIN` | [`auth.controller.ts:52`](file:///d:/Acadify/apps/backend/src/auth/auth.controller.ts#L52) | Boilerplate admin access verification endpoint |
| `GET` | `/profiles/me` | Authenticated | [`profiles.controller.ts:17`](file:///d:/Acadify/apps/backend/src/profiles/profiles.controller.ts#L17) | Profile data + enrolled projects or faculty profile |
| `PATCH`| `/profiles/me` | Authenticated | [`profiles.controller.ts:22`](file:///d:/Acadify/apps/backend/src/profiles/profiles.controller.ts#L22) | Updates profile info; triggers re-embedding if faculty |
| `GET` | `/projects` | `STUDENT` | [`projects.controller.ts:34`](file:///d:/Acadify/apps/backend/src/projects/projects.controller.ts#L34) | Returns all projects for the requesting student |
| `GET` | `/projects/:id` | `STUDENT` | [`projects.controller.ts:39`](file:///d:/Acadify/apps/backend/src/projects/projects.controller.ts#L39) | Retrieves single student project details |
| `POST` | `/projects` | `STUDENT` | [`projects.controller.ts:44`](file:///d:/Acadify/apps/backend/src/projects/projects.controller.ts#L44) | Creates portfolio project (status `PROPOSED`) |
| `PATCH`| `/projects/:id` | `STUDENT` | [`projects.controller.ts:52`](file:///d:/Acadify/apps/backend/src/projects/projects.controller.ts#L52) | Updates project fields |
| `DELETE`| `/projects/:id` | `STUDENT` | [`projects.controller.ts:61`](file:///d:/Acadify/apps/backend/src/projects/projects.controller.ts#L61) | Deletes project and `ProjectStudent` links |
| `POST` | `/mentor-recommendation` | Authenticated | [`mentor-recommendation.controller.ts:13`](file:///d:/Acadify/apps/backend/src/mentor-recommendation/mentor-recommendation.controller.ts#L13) | AI mentor semantic match + Postgres availability |
| `GET` | `/admin/departments` | `ADMIN` | [`admin-departments.controller.ts:34`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-departments.controller.ts#L34) | Paginated list of academic departments |
| `POST` | `/admin/departments` | `ADMIN` | [`admin-departments.controller.ts:29`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-departments.controller.ts#L29) | Creates new department |
| `GET` | `/admin/departments/:id` | `ADMIN` | [`admin-departments.controller.ts:39`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-departments.controller.ts#L39) | Single department with subjects & classes |
| `PATCH`| `/admin/departments/:id` | `ADMIN` | [`admin-departments.controller.ts:44`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-departments.controller.ts#L44) | Updates department name or code |
| `DELETE`| `/admin/departments/:id` | **BROKEN** | *(Missing in controller)* | **Missing in backend; called by frontend!** |
| `GET` | `/admin/classes` | `ADMIN` | [`admin-classes.controller.ts:21`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-classes.controller.ts#L21) | Paginated list of class cohorts |
| `POST` | `/admin/classes` | `ADMIN` | [`admin-classes.controller.ts:16`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-classes.controller.ts#L16) | Creates class (departmentId, batchYear, section) |
| `GET` | `/admin/classes/:id` | `ADMIN` | [`admin-classes.controller.ts:26`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-classes.controller.ts#L26) | Single class with enrolled students & assignments |
| `PATCH`| `/admin/classes/:id` | `ADMIN` | [`admin-classes.controller.ts:31`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-classes.controller.ts#L31) | Updates class cohort attributes |
| `DELETE`| `/admin/classes/:id` | `ADMIN` | [`admin-classes.controller.ts:36`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-classes.controller.ts#L36) | Deletes class; unlinks students (`classId = null`) |
| `GET` | `/admin/subjects` | `ADMIN` | [`admin-subjects.controller.ts:35`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-subjects.controller.ts#L35) | Paginated list of curriculum subjects |
| `POST` | `/admin/subjects` | `ADMIN` | [`admin-subjects.controller.ts:30`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-subjects.controller.ts#L30) | Creates subject (name, code, semester, deptId) |
| `GET` | `/admin/subjects/:id` | `ADMIN` | [`admin-subjects.controller.ts:40`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-subjects.controller.ts#L40) | Single subject with assignments |
| `PATCH`| `/admin/subjects/:id` | `ADMIN` | [`admin-subjects.controller.ts:45`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-subjects.controller.ts#L45) | Updates subject details |
| `DELETE`| `/admin/subjects/:id` | `ADMIN` | [`admin-subjects.controller.ts:50`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-subjects.controller.ts#L50) | Deletes subject (crashes if linked to Resource) |
| `GET` | `/admin/faculty` | `ADMIN` | [`admin-faculty.controller.ts:34`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-faculty.controller.ts#L34) | Paginated list of faculty users & profiles |
| `POST` | `/admin/faculty` | `ADMIN` | [`admin-faculty.controller.ts:29`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-faculty.controller.ts#L29) | Creates User + FacultyProfile + re-embeds AI |
| `GET` | `/admin/faculty/:id` | `ADMIN` | [`admin-faculty.controller.ts:39`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-faculty.controller.ts#L39) | Single faculty record with teaching assignments |
| `PATCH`| `/admin/faculty/:id` | `ADMIN` | [`admin-faculty.controller.ts:44`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-faculty.controller.ts#L44) | Updates faculty user & profile |
| `GET` | `/admin/students` | `ADMIN` | [`admin-students.controller.ts:41`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-students.controller.ts#L41) | Paginated list of students with search |
| `POST` | `/admin/students` | `ADMIN` | [`admin-students.controller.ts:36`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-students.controller.ts#L36) | Creates student user with mandatory `studentId` |
| `POST` | `/admin/students/import`| `ADMIN` | [`admin-students.controller.ts:31`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-students.controller.ts#L31) | Bulk imports student rows in a transaction |
| `GET` | `/admin/students/:id` | `ADMIN` | [`admin-students.controller.ts:46`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-students.controller.ts#L46) | Single student details |
| `PATCH`| `/admin/students/:id` | `ADMIN` | [`admin-students.controller.ts:51`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-students.controller.ts#L51) | Updates student record |
| `DELETE`| `/admin/students/:id` | `ADMIN` | [`admin-students.controller.ts:56`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-students.controller.ts#L56) | Deletes student user |
| `POST` | `/admin/teaching-assignments` | `ADMIN` | [`admin-teaching-assignments.controller.ts:25`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-teaching-assignments.controller.ts#L25) | Upserts faculty assignment to class-subject |
| `GET` | `/admin/teaching-assignments` | `ADMIN` | [`admin-teaching-assignments.controller.ts:30`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-teaching-assignments.controller.ts#L30) | Lists teaching assignments |
| `GET` | `/admin/classes/:id/teaching-assignments` | `ADMIN` | [`admin-teaching-assignments.controller.ts:35`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-teaching-assignments.controller.ts#L35) | Matrix of subjects and assigned faculty for class |
| `DELETE`| `/admin/teaching-assignments/:id` | `ADMIN` | [`admin-teaching-assignments.controller.ts:40`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-teaching-assignments.controller.ts#L40) | Removes teaching assignment |

### FastAPI Microservice Endpoints (`apps/ai-service`)

| Method | Endpoint | Handler Citation | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | [`main.py:32`](file:///d:/Acadify/apps/ai-service/main.py#L32) | Root status check |
| `GET` | `/health` | [`main.py:37`](file:///d:/Acadify/apps/ai-service/main.py#L37) | ChromaDB heartbeat & model status |
| `POST` | `/test/embed` | [`main.py:57`](file:///d:/Acadify/apps/ai-service/main.py#L57) | Text embedding dimension preview |
| `POST` | `/ai/faculty-profile/embed` | [`main.py:72`](file:///d:/Acadify/apps/ai-service/main.py#L72) | Upserts faculty profile vector into ChromaDB |
| `POST` | `/ai/mentor-recommendation` | [`main.py:242`](file:///d:/Acadify/apps/ai-service/main.py#L242) | Semantic search + mock availability + Gemini reasoning |

### Frontend Pages (`apps/frontend/app`)

| Route | Allowed Roles | File Citation | Description |
| :--- | :--- | :--- | :--- |
| `/` | Public | [`page.tsx:1`](file:///d:/Acadify/apps/frontend/app/page.tsx#L1) | Landing page redirector |
| `/login` | Public | [`login/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/login/page.tsx#L1) | Login form storing tokens in `localStorage` |
| `/dashboard` | `STUDENT`, `FACULTY`, `ADMIN` | [`dashboard/page.tsx:15`](file:///d:/Acadify/apps/frontend/app/dashboard/page.tsx#L15) | Metric overview & quick action cards |
| `/dashboard/profile` | `STUDENT`, `FACULTY` | [`dashboard/profile/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/dashboard/profile/page.tsx#L1) | Edit academic bio, skills, research, links |
| `/dashboard/projects` | `STUDENT` (FACULTY 403) | [`dashboard/projects/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/dashboard/projects/page.tsx#L1) | Portfolio project creation & editing |
| `/dashboard/mentor-recommendation` | `STUDENT` | [`dashboard/mentor-recommendation/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/dashboard/mentor-recommendation/page.tsx#L1) | Semantic search interface matching mentors |
| `/dashboard/resources` | `STUDENT`, `FACULTY` | [`dashboard/resources/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/dashboard/resources/page.tsx#L1) | **Placeholder**: Renders `"Coming soon."` |
| `/dashboard/admin/departments` | `ADMIN` (unprotected in UI) | [`dashboard/admin/departments/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/dashboard/admin/departments/page.tsx#L1) | Department management table & modal (Delete broken) |
| `/dashboard/admin/classes` | `ADMIN` (unprotected in UI) | [`dashboard/admin/classes/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/dashboard/admin/classes/page.tsx#L1) | Class cohorts table & creation dialog |
| `/dashboard/admin/subjects` | `ADMIN` (unprotected in UI) | [`dashboard/admin/subjects/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/dashboard/admin/subjects/page.tsx#L1) | Subject catalog management table & modal |
| `/dashboard/admin/faculty` | `ADMIN` (unprotected in UI) | [`dashboard/admin/faculty/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/dashboard/admin/faculty/page.tsx#L1) | Faculty account creation & editing table |
| `/dashboard/admin/students` | `ADMIN` (unprotected in UI) | [`dashboard/admin/students/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/dashboard/admin/students/page.tsx#L1) | Student roster, filtering, and bulk CSV import |
| `/dashboard/admin/teaching-assignments`| `ADMIN` (unprotected in UI) | [`dashboard/admin/teaching-assignments/page.tsx:1`](file:///d:/Acadify/apps/frontend/app/dashboard/admin/teaching-assignments/page.tsx#L1) | Matrix assigning faculty to class-subjects |

---

## 6. Admin Module Analysis

### What the Recent Restructure Changed
In commit `c83e180` (branch `feat/admin-module-restructure`), the database underwent a major refactoring recorded in migration [`apps/backend/prisma/migrations/20260922143500_admin_module_restructure/migration.sql`](file:///d:/Acadify/apps/backend/prisma/migrations/20260922143500_admin_module_restructure/migration.sql):
1. **Discarded Earlier Over-Engineered Entities**: Dropped `AcademicYear`, `Semester`, `AcademicClass`, `ClassSubject`, and `ClassStudent` tables ([`migration.sql:27-33`](file:///d:/Acadify/apps/backend/prisma/migrations/20260922143500_admin_module_restructure/migration.sql#L27-L33)).
2. **Introduced Simplified Cohort Model**:
   - `Class`: Identified by `(departmentId, batchYear, section)` with `currentSemester`.
   - `User.classId`: Direct foreign key on `User` to assign a student to a `Class`.
   - `TeachingAssignment`: Direct mapping of `(classId, subjectId)` to `facultyId`.
3. **Reverted `Resource` Link**: Unlinked `Resource` from `ClassSubject` and re-attached it directly to `Subject` (`subjectId`).
4. **Built Full Backend Module**: Created `apps/backend/src/admin/` with 6 dedicated controllers, 6 services, and DTOs.
5. **Replaced Frontend Admin Placeholders**: Created 6 full Next.js UI management pages under `apps/frontend/app/dashboard/admin/` and deleted the old placeholder routes (`analytics/page.tsx` and `users/page.tsx`).

### Status Breakdown of Admin Submodules

```
Admin Submodules
├── Classes Management        ── [FINISHED] Complete CRUD, student unlinking, cascade assignment cleanup
├── Student Management        ── [FINISHED] Single creation, search, pagination, bulk CSV import
├── Subject Management        ── [HALF DONE] CRUD exists, but delete crashes if resources exist
├── Faculty Management        ── [HALF DONE] Create, list, edit work; Delete is not supported
├── Teaching Assignments      ── [FINISHED] Upsert, matrix view per class, remove assignment
└── Department Management     ── [BROKEN] UI calls deleteDepartment, backend route does not exist (404)
```

#### Detailed Breakdown
1. **Classes Management**: **FINISHED**
   - Backend: [`AdminClassesService`](file:///d:/Acadify/apps/backend/src/admin/services/admin-classes.service.ts) correctly validates department, enforces uniqueness on `(departmentId, batchYear, section)`, and cleans up student links (`classId = null`) and teaching assignments before deletion.
   - Frontend: [`apps/frontend/app/dashboard/admin/classes/page.tsx`](file:///d:/Acadify/apps/frontend/app/dashboard/admin/classes/page.tsx) provides a full modal dialog, validation, and table.
2. **Student Management**: **FINISHED**
   - Backend: [`AdminStudentsService`](file:///d:/Acadify/apps/backend/src/admin/services/admin-students.service.ts) mandates `studentId`, checks for duplicates, and provides `importStudentsBulk()` executing an atomic `$transaction`.
   - Frontend: [`apps/frontend/app/dashboard/admin/students/page.tsx`](file:///d:/Acadify/apps/frontend/app/dashboard/admin/students/page.tsx) contains search, department/class filtering, and a bulk CSV modal.
3. **Department Management**: **BROKEN**
   - In [`apps/frontend/lib/admin-api.ts:136-137`](file:///d:/Acadify/apps/frontend/lib/admin-api.ts#L136-L137), `deleteDepartment(id)` issues `DELETE /admin/departments/${id}`.
   - In [`apps/frontend/app/dashboard/admin/departments/page.tsx:88`](file:///d:/Acadify/apps/frontend/app/dashboard/admin/departments/page.tsx#L88), clicking "Delete" calls this method.
   - **Bug**: [`AdminDepartmentsController`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-departments.controller.ts) **has no `@Delete(':id')` endpoint!** The request always fails with HTTP 404.
4. **Subject Management**: **HALF DONE / CRASH RISK**
   - Creation, listing, and updates work properly.
   - In [`AdminSubjectsService.remove()`](file:///d:/Acadify/apps/backend/src/admin/services/admin-subjects.service.ts#L165-L176), deleting a subject cascades deletion to `TeachingAssignment`. However, `Resource` has a foreign key to `Subject` with `onDelete: Restrict` ([`schema.prisma:171`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L171)). If any `Resource` exists for the subject, deletion crashes with an unhandled Prisma foreign key error (HTTP 500).
5. **Faculty Management**: **HALF DONE**
   - Creation, updating, and listing work. Creation automatically invokes `ProfilesService.reembedFacultyProfile()` to update ChromaDB vectors.
   - Deletion is neither implemented in the backend nor exposed in the UI.
6. **Teaching Assignments**: **FINISHED**
   - [`AdminTeachingAssignmentsService`](file:///d:/Acadify/apps/backend/src/admin/services/admin-teaching-assignments.service.ts) provides `upsertAssignment` on `classId_subjectId` and `getAssignmentsByClass`.
   - Frontend provides a clean matrix displaying subjects for a class and dropdowns to assign faculty.

---

## 7. Resource Management Inventory

To refocus Acadify away from "Resource Management" and toward the project-oriented workflow, here is the complete dependency map of everything belonging to Resource Management:

### Complete Asset Inventory

| Category | File Path | Line Citation | Impact / Purpose |
| :--- | :--- | :--- | :--- |
| **Prisma Model** | `apps/backend/prisma/schema.prisma` | [`schema.prisma:165-177`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L165-L177) | `model Resource` |
| **Prisma Enum** | `apps/backend/prisma/schema.prisma` | [`schema.prisma:25-29`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L25-L29) | `enum ResourceType { PDF, PPT, DOCX }` |
| **Prisma Relations** | `apps/backend/prisma/schema.prisma` | [`schema.prisma:54,77`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L54) | `User.uploadedResources`, `Subject.resources` |
| **Backend Route/API**| *None* | *None* | **Zero backend endpoints exist for Resource** |
| **Frontend Page** | `apps/frontend/app/dashboard/resources/page.tsx` | [`page.tsx:1-8`](file:///d:/Acadify/apps/frontend/app/dashboard/resources/page.tsx#L1-L8) | Placeholder page returning `"Coming soon."` |
| **Navigation Items** | `apps/frontend/components/Sidebar.tsx` | [`Sidebar.tsx:13,20`](file:///d:/Acadify/apps/frontend/components/Sidebar.tsx#L13) | `{ label: "Resources", href: "/dashboard/resources" }` in `STUDENT` and `FACULTY` |
| **Dashboard Metrics**| `apps/frontend/app/dashboard/page.tsx` | [`dashboard/page.tsx:86,95`](file:///d:/Acadify/apps/frontend/app/dashboard/page.tsx#L86) | "Resources Available" (Student) and "Resources Uploaded" (Faculty) |
| **AI Microservice** | `apps/ai-service/requirements.txt` | [`requirements.txt:5-7`](file:///d:/Acadify/apps/ai-service/requirements.txt#L5-L7) | Unused libraries: `pymupdf`, `python-docx`, `python-pptx` |
| **Maintenance Scripts**| `apps/backend/scripts/cleanup-test-data.js` | [`cleanup-test-data.js:34-36`](file:///d:/Acadify/apps/backend/scripts/cleanup-test-data.js#L34-L36) | `prisma.resource.deleteMany({})` |

### Dependency Analysis: What Else Depends On It?
- **Zero active features depend on `Resource`**.
- No business logic, calculation, or active API queries the `Resource` table.
- The AI service documentation explicitly notes: `Document parsing (PDF/DOCX/PPTX) libraries are installed but not yet used` ([`apps/ai-service/README.md:83`](file:///d:/Acadify/apps/ai-service/README.md#L83)).
- **Safe Removal Strategy**:
  1. Remove `Resource` and `ResourceType` from `apps/backend/prisma/schema.prisma`.
  2. Generate a Prisma migration (`npx prisma migrate dev --name remove_legacy_resources`).
  3. Delete `apps/frontend/app/dashboard/resources/page.tsx`.
  4. Remove the `Resources` nav items from `Sidebar.tsx`.
  5. Replace the "Resources" stat cards on `dashboard/page.tsx` with project milestone cards.
  6. Remove `pymupdf`, `python-docx`, and `python-pptx` from `apps/ai-service/requirements.txt`.

---

## 8. Reusable Parts for the New Project Module

The following components and modules represent high-value engineering that should be preserved and adapted for the Open Lab / project phase workflow:

```mermaid
graph LR
    subgraph Reusable Foundation
        Auth[JWT Auth & Refresh Flow]
        UI[Tailwind v4 UI Components]
        Data[User / Faculty / Department / Class Models]
        AI[BGE + Chroma + Gemini Matching]
    end
    subgraph New Project Workflow
        Coord[Coordinator Management]
        Teams[Team Formation & Locking]
        Mentors[Mentor Selection & Approval]
        Panels[3-Member Review Panels]
        Rubric[Rubric-Based Evaluation]
    end
    Auth --> Teams
    Auth --> Coord
    UI --> Teams
    UI --> Panels
    Data --> Teams
    Data --> Panels
    AI --> Mentors
    AI --> Panels
```

1. **Authentication & Session Interceptor**:
   - `apps/frontend/lib/auth.ts`: `authFetch` with automatic 401 token refresh queue and `SessionExpiredModal` event dispatch.
   - `apps/backend/src/auth/`: JWT access/refresh token generation and bcrypt password hashing.
2. **Identity Models (`User`, `FacultyProfile`, `Department`, `Class`)**:
   - `User` handles student credentials and roll numbers (`studentId`).
   - `FacultyProfile` holds capacity fields (`availableForProjects`, `maxStudents`, `currentStudents`) and research areas directly applicable to mentor allocation.
   - `Class` cohorts handle semester and batch year.
3. **Headless UI Component Library (`apps/frontend/components/ui/`)**:
   - [`Modal.tsx`](file:///d:/Acadify/apps/frontend/components/ui/Modal.tsx): Reusable for team creation, invite modals, and rubric evaluation forms.
   - [`ConfirmDialog.tsx`](file:///d:/Acadify/apps/frontend/components/ui/ConfirmDialog.tsx): Reusable for team locking, mentor approval/rejection, and marks submission.
   - [`Combobox.tsx`](file:///d:/Acadify/apps/frontend/components/ui/Combobox.tsx): Reusable for searchable teammate selection and faculty panelist assignment.
   - [`Toast.tsx`](file:///d:/Acadify/apps/frontend/components/ui/Toast.tsx): Standardized application feedback.
   - [`Skeleton.tsx`](file:///d:/Acadify/apps/frontend/components/ui/Skeleton.tsx) and [`EmptyState.tsx`](file:///d:/Acadify/apps/frontend/components/ui/EmptyState.tsx): Accessible loading and blank slate states.
4. **AI Microservice Semantic Recommendation Engine**:
   - `apps/ai-service/main.py` + `gemini_service.py`: Can be adapted directly from student-mentor matching to **automated team-to-panel assignment**, matching a team's project domain against the collective research profiles of panel faculty.
5. **Pagination & Query Utilities**:
   - [`apps/backend/src/admin/dto/admin.dto.ts`](file:///d:/Acadify/apps/backend/src/admin/dto/admin.dto.ts): `parsePagination()` and `buildPaginatedResponse()` provide standard pagination across all services.

---

## 9. Code Quality & Technical Debt

### 1. Duplicated Code
- **URL Validation**: Identical URL parsing logic is copy-pasted between [`ProjectsService.validateUrl`](file:///d:/Acadify/apps/backend/src/projects/projects.service.ts#L158-L166) and [`ProfilesService.validateUrl`](file:///d:/Acadify/apps/backend/src/profiles/profiles.service.ts#L250-L258).
- **Faculty Formatting**: `formatFacultyResponse` in [`admin-faculty.service.ts:19-60`](file:///d:/Acadify/apps/backend/src/admin/services/admin-faculty.service.ts#L19-L60) duplicates the mapping logic in [`profiles.service.ts:68-89`](file:///d:/Acadify/apps/backend/src/profiles/profiles.service.ts#L68-L89).
- **Pagination Logic**: String parsing for `page` and `limit` is repeated in services despite the existence of `parsePagination()`.

### 2. Dead Code
- **Unused `AdminGuard.tsx`**: [`apps/frontend/components/admin/AdminGuard.tsx`](file:///d:/Acadify/apps/frontend/components/admin/AdminGuard.tsx) is completely unreferenced.
- **Unused AI Parsing Packages**: `pymupdf`, `python-docx`, and `python-pptx` in [`apps/ai-service/requirements.txt`](file:///d:/Acadify/apps/ai-service/requirements.txt) are installed but never imported.
- **Legacy Migration Archive Scripts**: 8 ad-hoc migration scripts left in [`apps/backend/scripts/archive/`](file:///d:/Acadify/apps/backend/scripts/archive/).
- **Default NestJS Controller**: `AppController` and `AppService` returning `"Hello World!"` remain in [`apps/backend/src/app.controller.ts`](file:///d:/Acadify/apps/backend/src/app.controller.ts).

### 3. Hardcoded Values
- **AI Model & Collection**: `"BAAI/bge-small-en-v1.5"` and `"faculty_profiles"` hardcoded in [`apps/ai-service/main.py:18,27`](file:///d:/Acadify/apps/ai-service/main.py#L18).
- **AI Availability Heuristics**: Formula `0.85 + (0.15 * slot_ratio)` hardcoded in [`apps/ai-service/main.py:176`](file:///d:/Acadify/apps/ai-service/main.py#L176).
- **Auth Timing**: Token lifespans `'15m'` and `'7d'`, and bcrypt salt rounds `10` hardcoded in [`apps/backend/src/auth/auth.service.ts:31,64,69`](file:///d:/Acadify/apps/backend/src/auth/auth.service.ts#L31).
- **UI Colors**: Hex codes `#A4123F`, `#2B2B2E`, `#E8A33D` hardcoded in multiple components instead of Tailwind `@theme` CSS tokens.

### 4. Missing Validation & Type Safety
- **Missing Global `ValidationPipe`**: [`apps/backend/src/main.ts`](file:///d:/Acadify/apps/backend/src/main.ts) does not register `app.useGlobalPipes(new ValidationPipe())`.
- **Missing Validation Packages**: `class-validator` and `class-transformer` are not even installed in [`apps/backend/package.json`](file:///d:/Acadify/apps/backend/package.json).
- **DTOs Lack Validation Decorators**: All classes in [`apps/backend/src/admin/dto/admin.dto.ts`](file:///d:/Acadify/apps/backend/src/admin/dto/admin.dto.ts) are plain TypeScript classes without runtime validation decorators. Any malformed payload passes directly to Prisma.
- **Unvalidated Request Bodies**: `AuthController.signup` ([`auth.controller.ts:22-30`](file:///d:/Acadify/apps/backend/src/auth/auth.controller.ts#L22-L30)) uses an inline object literal without class validation.

### 5. Security Issues
- **Role Escalation on Signup**: Public `POST /auth/signup` permits passing `role: Role.ADMIN` ([`auth.service.ts:37`](file:///d:/Acadify/apps/backend/src/auth/auth.service.ts#L37)).
- **Overly Permissive CORS**: `app.enableCors({ origin: true, credentials: true })` in [`main.ts:7-10`](file:///d:/Acadify/apps/backend/src/main.ts#L7-L10) reflects any Origin header with credentials enabled.
- **Client-Side Auth Tampering**: Admin frontend routes rely exclusively on unverified client-side token decoding for UI access, leaving pages accessible if guards are not mounted.
- **Raw Environment Secrets**: Local `apps/ai-service/.env` contains raw Gemini API keys.

### 6. Missing Error Handling
- **Missing `DELETE /admin/departments/:id`**: Causes client 404 error when clicking Delete on the departments page.
- **Unchecked Foreign Key Constraint Violation**: Deleting a subject with existing resources crashes with an unhandled 500 error ([`admin-subjects.service.ts:165-176`](file:///d:/Acadify/apps/backend/src/admin/services/admin-subjects.service.ts#L165-L176)).
- **Unprotected `RolesGuard` Access**: If `JwtAuthGuard` is omitted from a route decorated with `@Roles`, accessing `req.user.role` throws an unhandled `TypeError` ([`roles.guard.ts:20-23`](file:///d:/Acadify/apps/backend/src/auth/guards/roles.guard.ts#L20-L23)).

### 7. Automated Testing Status: Complete Absence
- **Backend Unit Tests**: Only 4 boilerplate spec files exist (`app.controller.spec.ts`, `auth.controller.spec.ts`, `auth.service.spec.ts`, `mentor-recommendation.controller.spec.ts`), all containing only `expect(service).toBeDefined()`.
- **Zero Tests for Core Modules**: Zero tests exist for `AdminStudentsService`, `AdminClassesService`, `AdminFacultyService`, `AdminDepartmentsService`, `AdminSubjectsService`, `AdminTeachingAssignmentsService`, `ProjectsService`, or `ProfilesService`.
- **Frontend Tests**: No test runner (Jest, Vitest, Cypress, Playwright) is installed in `apps/frontend/package.json`.
- **AI Microservice**: Only manual standalone scripts (`test_bge.py`, `test_chroma.py`, `test_semantic_search.py`); no automated pytest suite.

---

## 10. Gap Analysis vs. New Requirements

Evaluation of current capabilities against the project-oriented workflow (Open Lab / Project Phase Courses):

| Requirement | Status | Involved Files | Gap Details |
| :--- | :--- | :--- | :--- |
| **1. Coordinator Role** | **MISSING** | [`apps/backend/prisma/schema.prisma:11-15`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L11-L15), [`apps/backend/src/auth/guards/roles.guard.ts`](file:///d:/Acadify/apps/backend/src/auth/guards/roles.guard.ts), [`apps/frontend/components/Sidebar.tsx`](file:///d:/Acadify/apps/frontend/components/Sidebar.tsx) | `Role` enum only has `STUDENT`, `FACULTY`, `ADMIN`. No course-level or system-level coordinator entity exists. Faculty cannot be designated as project course coordinators. |
| **2. Panel Member / Mentor Roles for Staff** | **PARTIAL** | [`schema.prisma:106-132,149-150`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L106-L132), [`apps/backend/src/projects/projects.service.ts`](file:///d:/Acadify/apps/backend/src/projects/projects.service.ts) | Mentors exist as a relation on `Project` (`mentorId -> FacultyProfile.id`) with availability tracking. However, **Panel Member** concepts (panel composition, evaluation roles, reviewer permissions) are completely absent. |
| **3. Student Team Creation, Invites, and Locking** | **PARTIAL** | [`schema.prisma:155-163`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L155-L163), [`apps/backend/src/projects/projects.service.ts:61-74`](file:///d:/Acadify/apps/backend/src/projects/projects.service.ts#L61-L74), [`apps/frontend/app/dashboard/projects/page.tsx`](file:///d:/Acadify/apps/frontend/app/dashboard/projects/page.tsx) | `ProjectStudent` join table permits multiple students per project in the DB. However, the application currently only supports a single student creating a portfolio project (`createForStudent`). There are **no invitations, no member search/add, no acceptance/rejection, and no team locking** logic. |
| **4. Mentor Preference & Approval** | **PARTIAL** | [`apps/backend/src/mentor-recommendation/`](file:///d:/Acadify/apps/backend/src/mentor-recommendation/), [`apps/ai-service/main.py`](file:///d:/Acadify/apps/ai-service/main.py), [`apps/frontend/app/dashboard/mentor-recommendation/page.tsx`](file:///d:/Acadify/apps/frontend/app/dashboard/mentor-recommendation/page.tsx) | AI semantic search finds mentors and checks availability. However, **students cannot submit preference ranks (1st, 2nd, 3rd choice)**, and faculty/coordinators have **no approval queue or acceptance/rejection workflow**. |
| **5. Project Phases / Review Rounds** | **MISSING** | [`schema.prisma:17-23`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L17-L23) | Only a flat `ProjectStatus` enum (`PROPOSED`, `APPROVED`, `IN_PROGRESS`, etc.) exists. No `Phase` or `ReviewRound` entity (e.g., Phase 0: Ideation, Phase 1: Design, Phase 2: Implementation, Phase 3: Final Demo), no submission deadlines, and no phase-specific deliverables exist. |
| **6. Panels of 3 Staff, Team-to-Panel Assignment & Scheduling** | **MISSING** | *No existing files* | No `Panel` model, no 3-faculty allocation rules, no conflict-of-interest checks (e.g., mentor cannot be on their team's panel), no review time slots, and no scheduling engine exist. |
| **7. Per-Student Rubric-Based Marks & Consolidation** | **MISSING** | *No existing files* | No `Rubric`, `Criterion`, `Evaluation`, or `Score` models. No interface exists for panel members to grade individual team members or consolidate marks across reviewers. |
| **8. ECE and CCE Combined Batches** | **MISSING** | [`schema.prisma:80-92`](file:///d:/Acadify/apps/backend/prisma/schema.prisma#L80-L92), [`apps/backend/src/admin/services/admin-classes.service.ts`](file:///d:/Acadify/apps/backend/src/admin/services/admin-classes.service.ts) | Classes are strictly partitioned by a single `departmentId` (`@@unique([departmentId, batchYear, section])`). There is no multi-department course or cohort entity allowing ECE and CCE students to form combined teams or be evaluated in the same project course pool. |

---

## 11. Recommended Refactor Plan

```mermaid
flowchart TD
    P1[Phase 1: Stabilization & Security Hardening] --> P2[Phase 2: Project Domain Schema Expansion]
    P2 --> P3[Phase 3: Team Formation & Mentor Selection Workflow]
    P3 --> P4[Phase 4: Coordinator Management & Panel Review Engine]
    P4 --> P5[Phase 5: Rubric Evaluation & Marks Consolidation]
    P5 --> P6[Phase 6: UI Refocus & Resource Decommissioning]
```

### Phase 1: Stabilization & Security Hardening
- **Objective**: Fix active security vulnerabilities and broken admin endpoints before introducing new domain models.
- **Tasks**:
  1. Patch `POST /auth/signup` in [`auth.service.ts`](file:///d:/Acadify/apps/backend/src/auth/auth.service.ts) to restrict user registration strictly to `Role.STUDENT` (or require admin session for staff/admin creation).
  2. Install `class-validator` and `class-transformer` in `apps/backend` and enable `ValidationPipe` globally in [`main.ts`](file:///d:/Acadify/apps/backend/src/main.ts).
  3. Implement `DELETE /admin/departments/:id` in [`AdminDepartmentsController`](file:///d:/Acadify/apps/backend/src/admin/controllers/admin-departments.controller.ts) to fix the broken frontend delete action.
  4. Wrap all `/dashboard/admin/*` routes in an `AdminLayout` enforcing [`AdminGuard.tsx`](file:///d:/Acadify/apps/frontend/components/admin/AdminGuard.tsx).
- **Risk**: **Low** | **Effort**: **S (Small)**

### Phase 2: Project Domain Schema Expansion
- **Objective**: Create the relational foundation for project courses, cross-department cohorts, teams, panels, and rubrics.
- **Tasks**:
  1. Add `ProjectCourse` or `Cohort` entity supporting combined departments (`ECE` + `CCE`, batch year, academic year).
  2. Create `CourseTeam` with `status` (`DRAFT`, `LOCKED`, `APPROVED`), project title, description, and selected `mentorId`.
  3. Create `TeamMember` (`teamId`, `userId`, `role`: `LEADER` / `MEMBER`, `status`: `INVITED` / `ACCEPTED`).
  4. Create `ProjectPhase` / `ReviewRound` (`courseId`, `roundNumber`, `name`, `startDate`, `endDate`, `weightage`).
  5. Create `ReviewPanel` (`courseId`, `name`) and `PanelMember` (`panelId`, `facultyId`) with a database or service constraint enforcing exactly 3 faculty members.
  6. Create `TeamPanelAssignment` (`teamId`, `panelId`, `scheduledAt`, `venue`).
  7. Create `RubricCriterion` and `StudentEvaluation` (`panelMemberId`, `teamMemberId`, `roundId`, `criterionScores`, `totalScore`, `feedback`).
  8. Deprecate and drop `model Resource` and `enum ResourceType`.
- **Risk**: **Medium** | **Effort**: **M (Medium)**

### Phase 3: Team Formation & Mentor Selection Workflow
- **Objective**: Enable students from ECE and CCE to form teams, invite peers, lock teams, and request mentors.
- **Tasks**:
  1. Build backend `TeamsService` and `TeamsController` for creating teams, generating invite codes, accepting invites, and enforcing size constraints (e.g. 2–4 members).
  2. Implement team locking: Once locked by the team leader, no members can be added/removed.
  3. Implement mentor preference submission: Teams submit 1st, 2nd, and 3rd preference mentors.
  4. Build faculty mentor portal: Faculty can view pending team requests, inspect student profiles/project abstracts, and accept/reject requests within capacity limits (`maxStudents`).
  5. Repurpose AI recommendation microservice to score faculty suitability based on the team's combined abstract.
- **Risk**: **Medium** | **Effort**: **M (Medium)**

### Phase 4: Coordinator Management & Panel Review Engine
- **Objective**: Provide coordinators with control over the course lifecycle, panel creation, and conflict-free scheduling.
- **Tasks**:
  1. Introduce `COORDINATOR` capability (either via `Role.COORDINATOR` or a `CourseCoordinator` mapping table).
  2. Build Coordinator Workspace UI: Track team formation progress, override mentor assignments, and trigger review rounds.
  3. Implement 3-Member Panel Builder: Coordinator assigns 3 faculty members per panel.
  4. Build conflict-of-interest check: A team's mentor cannot be assigned to review that team's panel.
  5. Build team-to-panel assignment algorithm: Balance panel review workloads across combined ECE + CCE faculty.
- **Risk**: **High** | **Effort**: **L (Large)**

### Phase 5: Rubric Evaluation & Marks Consolidation
- **Objective**: Enable panel members to record individual scores per rubric criterion and consolidate marks.
- **Tasks**:
  1. Build Rubric Builder: Coordinator defines criteria (e.g. Technical Depth, System Demo, Presentation, Individual Contribution) with min/max scores.
  2. Build Panelist Scoring Interface: During a review round, panel members score each student individually on the rubric.
  3. Implement Marks Consolidation Engine: Average/aggregate scores across all 3 panel members, apply round weightages, and compute final semester grades.
  4. Export consolidated grade sheets to CSV/Excel for academic office submission.
- **Risk**: **Medium** | **Effort**: **M (Medium)**

### Phase 6: UI Refocus & Resource Decommissioning
- **Objective**: Modernize the frontend to present the new project-centric platform and remove legacy resource code.
- **Tasks**:
  1. Remove `/dashboard/resources` from `Sidebar.tsx` and delete the page.
  2. Add new navigation sections: "My Team", "Open Lab Reviews", "Coordinator Portal", "Panel Reviews".
  3. Update `/dashboard` metrics for all roles to reflect active project phase deadlines, panel schedules, and team status.
  4. Clean up `apps/ai-service/requirements.txt` (remove `pymupdf`, `python-docx`, `python-pptx`).
- **Risk**: **Low** | **Effort**: **S (Small)**

---

## 12. Open Questions & Underspecified Areas

The following items are not documented in the repository and should be clarified with the academic staff:

1. **Course Scope & Lifetime**:  
   Is "Open Lab" a one-semester course or does it span multiple semesters (e.g., Phase 1 in Semester 5, Phase 2 in Semester 6)? How should historical teams and marks be archived?
2. **Team Size Rules**:  
   What are the exact minimum and maximum team sizes allowed? Must teams include students from both ECE and CCE, or can a team be composed entirely of ECE or CCE students?
3. **Mentor Capacity & Conflict**:  
   If a faculty member is a mentor for 2 teams, can they be a panel member for other teams in the same time slot? What is the maximum number of teams a faculty member can mentor in Open Lab?
4. **Grading Weightage Distribution**:  
   What proportion of the final mark comes from the Guide/Mentor vs. the 3-Member Review Panel? (Common academic pattern: 40% Continuous Mentor Evaluation + 60% Panel Reviews).
5. **Coordinator Assignment**:  
   Can a single coordinator manage both ECE and CCE, or will there be joint coordinators (one from ECE and one from CCE)?
6. **File Deliverables**:  
   Do teams submit code repos only (GitHub URLs), or will they need to upload formal reports / PDF documentation requiring S3/Supabase storage buckets?
