# Acadify AI Service

FastAPI microservice owned by Person A. Handles semantic embeddings and the
AI Mentor Recommendation feature. Never touches the NestJS/Next.js code —
communicates with the backend only through the API contract below.

## Setup

```bash
python -m venv venv
venv\Scripts\Activate.ps1        # Windows
pip install -r requirements.txt
docker-compose up chromadb       # from repo root, in a separate terminal
uvicorn main:app --reload --port 8001
```

Interactive API docs: `http://localhost:8001/docs`

## Endpoints

### `GET /health`
Reports service status, whether the BGE model loaded, and whether ChromaDB
is reachable. Returns `"status": "degraded"` if ChromaDB is down.

### `POST /test/embed`
Debug endpoint — takes raw text, returns its BGE-Small embedding
(384-dimensional). Used to verify the model is working correctly.

### `POST /ai/mentor-recommendation`
The flagship feature. Given a project title (and optional description),
returns a ranked list of faculty mentors.

**Request:**
```json
{ "project_title": "string", "description": "string (optional)" }
```

**Response:**
```json
{
  "mentors": [
    {
      "faculty_id": "string (real UUID from FacultyProfile)",
      "name": "string",
      "confidence_score": "number (0-1)",
      "research_match_percent": "number (0-100)",
      "available_slots": "number",
      "reasoning": "string"
    }
  ]
}
```

**How it works:**
1. Embeds the project title + description using BGE-Small
2. Runs semantic search against faculty profile embeddings stored in ChromaDB
3. Fetches more candidates than needed (top_n × 3, capped at 20)
4. Re-ranks by availability — a highly-matched but fully-booked faculty
   member ranks below a decently-matched faculty member with open slots

**Error handling:**
| Situation | Response |
|---|---|
| Empty/blank `project_title` | 422 validation error |
| Embedding generation fails | 500, logged |
| ChromaDB unreachable | 503 |
| No faculty matches found | 200, `{"mentors": []}` |
| Availability re-ranking fails | Falls back to raw semantic ranking |

## Known limitations (as of this writing)

- **Availability data is MOCKED.** Real `availableForProjects` /
  `maxStudents` / `currentStudents` values live in Sanjay's Postgres
  `FacultyProfile` table, not accessible from this service yet. See
  `get_availability()` in `main.py` — this is the one function to replace
  once real data access is worked out. Mock values are deterministic per
  `faculty_id` (same faculty always gets the same mock numbers).
- **Faculty data coverage:** 35 of 49 scraped faculty profiles have been
  matched to real `facultyProfileId`s (via `prisma/faculty-id-mapping.csv`).
  The remaining 14 had no email in the scraped data and couldn't be matched
  — excluded from the demo dataset by team decision.
- Not yet deployed (local/Docker only).
- Document parsing (PDF/DOCX/PPTX) libraries are installed but not yet used
  anywhere in the service.

## Key scripts

| File | Purpose |
|---|---|
| `main.py` | FastAPI app — all endpoints |
| `seed_faculty_v2.py` | Seeds ChromaDB with real `facultyProfileId`s, matched from `prisma/faculty-id-mapping.csv` |
| `faculty_scraper/scraper.py` | Scrapes faculty profiles from Amrita's public site |
| `check_data_quality.py` | Reports how many scraped faculty have usable research-interest data |
| `test_semantic_search.py` | Standalone semantic search test, no FastAPI |

## Docker

```bash
docker-compose up --build ai-service chromadb
```

`CHROMA_HOST` / `CHROMA_PORT` env vars control the ChromaDB connection
(defaults to `localhost:8000` for local dev outside Docker).