# Acadify Project Handoff

Last handoff update: 2026-09-17

This repository is a student/faculty academic platform under active development. This README is written as a continuity note for another developer or AI chat. The complete non-secret source export is in `PROJECT_CODE_EXPORT.txt`.

## Current Architecture

- `apps/backend`: NestJS API on port 3000, backed by PostgreSQL through Prisma.
- `apps/frontend`: Next.js 16 application on port 3001.
- `apps/ai-service`: FastAPI service on port 8001. It embeds faculty research profiles with `BAAI/bge-small-en-v1.5` and searches ChromaDB on port 8000.
- `docker-compose.yml`: Development orchestration for backend, frontend, AI service, and ChromaDB.
- `packages/shared-types`: Present in the workspace but currently has no implementation files.

## Implemented So Far

### Backend

- Prisma schema contains users, roles, departments, subjects, faculty profiles, projects, project-student links, and academic resources.
- Prisma migrations exist for the initial schema and removal of the earlier multi-tenancy design.
- Authentication supports signup, login, refresh, JWT-protected profile lookup, and an admin-only route.
- Passwords are hashed with bcrypt.
- JWT access tokens expire after 15 minutes; refresh tokens expire after 7 days.
- Faculty CSV import creates or updates faculty users and profiles and writes `prisma/faculty-id-mapping.csv`.
- The mentor recommendation module is registered in `AppModule`.
- The recommendation service calls the AI service and enriches returned mentors with real Postgres availability.

### AI Service

- FastAPI health and root endpoints are available.
- BGE-small embeddings are loaded once at service startup.
- Faculty profiles can be seeded into ChromaDB from `faculty_scraper/faculty_export.csv`.
- `/ai/mentor-recommendation` accepts `project_title` and optional `description`, performs semantic search, and returns mentor scores and reasoning.
- `available_slots` in the AI response is currently a placeholder; the backend service replaces it with values from `FacultyProfile` when IDs match.
- Data quality, embedding, ChromaDB, and semantic-search scripts are present.

### Frontend

- Login page calls the backend auth endpoint and stores access/refresh tokens in `localStorage`.
- Dashboard redirects unauthenticated users to login and renders role-specific student, faculty, and admin placeholders.
- Logout clears the stored auth state and redirects to login.
- The current visual design uses a light off-white background and Acadify maroon accents.

## Important Current Gaps

1. `apps/backend/src/mentor-recommendation/mentor-recommendation.controller.ts` is currently an empty controller. The service exists, but there is no public NestJS route wired to call it yet.
2. The AI seed script still creates generated IDs such as `faculty_0`; the backend enrichment expects real `FacultyProfile.id` values. The mapping file and a future reseeding step are needed to close this integration gap.
3. The frontend dashboard is still a role-based placeholder. Mentor recommendations, project workflows, resources, faculty management, and admin analytics are not implemented in the UI.
4. Authentication stores JWTs in `localStorage`; token refresh handling and a production-grade cookie/session strategy are not implemented.
5. Environment files are local-only and intentionally excluded from the code export. Never copy the existing secret values into a new chat or commit them.
6. The AI service downloads the embedding model at startup and requires a working ChromaDB instance. First startup can be slow and resource-intensive.

## Local Configuration

Create `apps/backend/.env` with:

```env
DATABASE_URL=<postgres connection string>
DIRECT_URL=<direct postgres connection string>
JWT_ACCESS_SECRET=<random secret>
JWT_REFRESH_SECRET=<random secret>
AI_SERVICE_URL=http://localhost:8001
```

Create `apps/frontend/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Do not reuse exposed secrets from an old environment. Rotate them if this repository has been shared outside the trusted development environment.

## Run With Docker Compose

From the repository root:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000`
- AI service: `http://localhost:8001`
- ChromaDB: `http://localhost:8000`

The compose setup expects the backend and frontend env files to exist. The backend container runs `npm run start:dev`; the frontend runs Next.js on port 3001; the AI service uses `CHROMA_HOST=chromadb` inside the compose network.

## Run Without Docker

Install dependencies in `apps/backend` and `apps/frontend` with `npm install`. Install `apps/ai-service/requirements.txt` in a Python 3.11 environment. Start PostgreSQL and ChromaDB separately, then run:

```bash
# apps/backend
npm run start:dev

# apps/frontend
npm run dev -- -p 3001

# apps/ai-service
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Useful backend commands:

```bash
npx prisma migrate dev
npx prisma db seed
npm test
npm run test:e2e
npm run build
```

## Seeded Test Accounts

The Prisma seed creates an admin, faculty user, and student user with the password defined in `apps/backend/prisma/seed.ts`. Treat these as development-only accounts and change them before any shared or deployed environment.

## Current Git State At Handoff

- Branch: `main`
- Latest commit before this handoff: `d0f46b4 feat(backend): import scraped faculty data into Postgres`
- Existing uncommitted changes before the handoff: `apps/backend/src/app.module.ts`, `apps/frontend/app/dashboard/page.tsx`, and the new `apps/backend/src/mentor-recommendation/` module.
- The two handoff files added by this task are `README.md` and `PROJECT_CODE_EXPORT.txt`.

## Suggested Next Step

Implement the NestJS mentor recommendation controller and its authenticated route, then add a focused controller/service integration test. After that, reconcile the ChromaDB faculty IDs with the Postgres faculty profile mapping before building the dashboard recommendation workflow.