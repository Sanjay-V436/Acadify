import logging
import os
import random

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
from sentence_transformers import SentenceTransformer
import chromadb

from gemini_service import GeminiAnalysisService, RecommendationAnalysis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("acadify-ai-service")

app = FastAPI(title="Acadify AI Service")

print("Loading BGE-Small model...")
model = SentenceTransformer("BAAI/bge-small-en-v1.5")
print("Model loaded.")

CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.environ.get("CHROMA_PORT", "8000"))
chroma_client = chromadb.HttpClient(
    host=CHROMA_HOST,
    port=CHROMA_PORT,
)
faculty_collection = chroma_client.get_or_create_collection(name="faculty_profiles")
gemini_service = GeminiAnalysisService()


@app.get("/")
def read_root():
    return {"status": "ok", "service": "acadify-ai-service"}


@app.get("/health")
def health_check():
    try:
        chroma_client.heartbeat()
        chroma_ok = True
    except Exception:
        chroma_ok = False
        logger.warning("Health check: ChromaDB is unreachable")

    return {
        "status": "healthy" if chroma_ok else "degraded",
        "model_loaded": model is not None,
        "chromadb_connected": chroma_ok,
    }


class EmbedRequest(BaseModel):
    text: str


@app.post("/test/embed")
def test_embed(request: EmbedRequest):
    embedding = model.encode(request.text).tolist()
    return {
        "text": request.text,
        "embedding_dimensions": len(embedding),
        "embedding_preview": embedding[:5],
    }


# ---------------------------------------------------------------------------
# Mentor Recommendation
# ---------------------------------------------------------------------------

class MentorRecommendationRequest(BaseModel):
    project_title: str
    description: str | None = None
    top_k: int = 5

    @field_validator("project_title")
    @classmethod
    def project_title_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("project_title cannot be empty or just whitespace")
        return v.strip()


# -----------------------------------------------------------------
# MOCK AVAILABILITY DATA
#
# This stands in for Sanjay's real FacultyProfile.availableForProjects /
# maxStudents / currentStudents data, which we don't have access to yet.
#
# Keyed by faculty_id (the real UUIDs from prisma/faculty-id-mapping.csv),
# so swapping this for a real lookup later is a one-line change — nothing
# else in the ranking logic needs to move.
#
# TODO: replace get_availability() with a real call to Sanjay's backend
# or a direct DB read, once that access is worked out.
# -----------------------------------------------------------------

def get_availability(faculty_id: str) -> dict:
    """
    MOCK. Returns fake but deterministic availability data for a faculty_id,
    so the same faculty always gets the same mock numbers across requests
    (makes testing/demoing consistent instead of random every time).
    """
    seed = int(faculty_id.replace("-", "")[:8], 16)
    rng = random.Random(seed)

    max_students = rng.choice([2, 3, 4, 5])
    current_students = rng.randint(0, max_students)
    available_for_projects = rng.random() > 0.15  # ~85% of faculty accepting

    available_slots = max(0, max_students - current_students) if available_for_projects else 0

    return {
        "available_for_projects": available_for_projects,
        "max_students": max_students,
        "current_students": current_students,
        "available_slots": available_slots,
    }


def rerank_with_availability(mentors: list[dict]) -> list[dict]:
    """
    Re-ranks semantic matches by factoring in availability, not just
    similarity. A high-similarity faculty member with zero open slots
    should rank below a lower-similarity faculty member with open slots —
    this is the "relevant AND available" logic from the original project plan.

    Approach: multiply the raw similarity score by an availability weight.
    - available_slots = 0 (or not accepting projects)  -> heavy penalty
    - available_slots > 0                               -> small bonus,
      scaled by how much room they have relative to their max capacity
    """
    for mentor in mentors:
        availability = get_availability(mentor["faculty_id"])

        mentor["available_slots"] = availability["available_slots"]

        if not availability["available_for_projects"] or availability["available_slots"] == 0:
            availability_weight = 0.3  # heavy penalty, but not zeroed out entirely
        else:
            slot_ratio = availability["available_slots"] / max(1, availability["max_students"])
            availability_weight = 0.85 + (0.15 * slot_ratio)  # ranges ~0.85 to 1.0

        raw_score = mentor["confidence_score"]
        mentor["confidence_score"] = round(raw_score * availability_weight, 3)

    # Re-sort by the adjusted confidence_score, highest first
    mentors.sort(key=lambda m: m["confidence_score"], reverse=True)
    return mentors


FALLBACK_REASON = (
    "Semantic match found from the faculty research profile. "
    "AI explanation is temporarily unavailable."
)


def fallback_match_level(semantic_similarity: float) -> str:
    if semantic_similarity >= 0.65:
        return "High"
    if semantic_similarity >= 0.4:
        return "Moderate"
    return "Low"


def build_recommendation(
    candidate: dict,
    analysis: RecommendationAnalysis | None,
) -> dict:
    if analysis is None:
        analysis_data = {
            "match_level": fallback_match_level(candidate["semantic_similarity"]),
            "why_matched": [],
            "why_not_higher": [],
            "technical_overlap": [],
            "domain_overlap": [],
            "missing_expertise": [],
            "strengths": [],
            "limitations": [],
            "summary": FALLBACK_REASON,
            "recommendation_reason": FALLBACK_REASON,
        }
    else:
        analysis_data = analysis.model_dump(exclude={"faculty_id"})

    return {
        "faculty_id": candidate["faculty_id"],
        "name": candidate["name"],
        "designation": candidate["designation"],
        "department": candidate["department"],
        "research_interests": candidate["research_interests"],
        "qualifications": candidate["qualifications"],
        "profile_url": candidate["profile_url"],
        "confidence_score": candidate["confidence_score"],
        "research_match_percent": candidate["research_match_percent"],
        "semantic_similarity": candidate["semantic_similarity"],
        "chroma_distance": candidate["chroma_distance"],
        "available_for_projects": candidate["available_for_projects"],
        "available_slots": candidate["available_slots"],
        "max_students": candidate["max_students"],
        "current_students": candidate["current_students"],
        "reasoning": analysis_data["recommendation_reason"],
        **analysis_data,
    }


@app.post("/ai/mentor-recommendation")
def mentor_recommendation(
    request: MentorRecommendationRequest,
    top_n: int | None = None,
):
    """
    Matches the agreed API contract with Person B (Sanjay):

    Request:  { "project_title": string, "description"?: string }
    Response: { "mentors": [ { faculty_id, name, confidence_score,
                                research_match_percent, available_slots,
                                reasoning } ] }

    Ranking: semantic similarity first (via ChromaDB), then re-ranked by
    availability so a highly-matched but fully-booked faculty member ranks
    below a decently-matched faculty member with open slots.

    NOTE: availability data is currently MOCKED (see get_availability above)
    since real availableForProjects/maxStudents/currentStudents data isn't
    accessible from this service yet. Swap get_availability() for a real
    lookup once that's sorted with Sanjay.
    """
    recommendation_limit = max(1, min(top_n if top_n is not None else request.top_k, 5))

    query_text = request.project_title
    if request.description:
        query_text += ". " + request.description

    # --- Generate embedding ---
    try:
        query_embedding = model.encode(query_text).tolist()
    except Exception:
        logger.exception("Failed to generate embedding for query: %s", query_text)
        raise HTTPException(
            status_code=500,
            detail="Failed to process the project description. Please try again.",
        )

    # Retrieve the top 10 semantic candidates for second-stage analysis.
    fetch_n = min(10, faculty_collection.count())
    if fetch_n == 0:
        logger.warning("No faculty matches found for query: %s", query_text)
        return {
            "mentors": [],
            "recommendations": [],
            "ai_analysis_available": False,
        }

    # --- Query ChromaDB ---
    try:
        results = faculty_collection.query(
            query_embeddings=[query_embedding],
            n_results=fetch_n,
            include=["documents", "metadatas", "distances"],
        )
    except Exception:
        logger.exception("ChromaDB query failed")
        raise HTTPException(
            status_code=503,
            detail="Faculty matching service is temporarily unavailable. Please try again shortly.",
        )

    # --- Handle empty collection / no matches gracefully ---
    if not results.get("ids") or not results["ids"][0]:
        logger.warning("No faculty matches found for query: %s", query_text)
        return {"mentors": []}

    candidates = []
    for i in range(len(results["ids"][0])):
        faculty_id = results["ids"][0][i]
        metadata = results["metadatas"][0][i] or {}
        document = (results.get("documents") or [[]])[0][i] or ""
        distance = results["distances"][0][i]
        availability = get_availability(faculty_id)

        research_match_percent = round(max(0, (1 - distance) * 100), 1)
        semantic_similarity = round(research_match_percent / 100, 3)

        candidates.append({
            "faculty_id": faculty_id,
            "name": metadata.get("name", "Not provided"),
            "designation": metadata.get("designation", "Not provided"),
            "department": "Not provided",
            "research_interests": metadata.get("research_interests", "Not provided"),
            "qualifications": "Not provided",
            "profile_url": metadata.get("profile_url", "Not provided"),
            "profile_document": document,
            "confidence_score": semantic_similarity,
            "research_match_percent": research_match_percent,
            "semantic_similarity": semantic_similarity,
            "chroma_distance": distance,
            **availability,
        })

    try:
        candidates = rerank_with_availability(candidates)
    except Exception:
        # If availability re-ranking fails for any reason, fall back to
        # raw semantic ranking rather than failing the whole request —
        # a slightly-worse-ranked result is much better than no result.
        logger.exception("Availability re-ranking failed, falling back to raw semantic ranking")

    logger.info("[AI] Chroma candidates: %d", len(candidates))
    analysis = gemini_service.analyze(
        project_title=request.project_title,
        project_description=request.description or "",
        candidates=candidates,
    )
    analysis_by_id = {
        item.faculty_id: item
        for item in (analysis.recommendations if analysis else [])
    }

    ordered_candidates = candidates
    if analysis:
        candidate_by_id = {
            candidate["faculty_id"]: candidate for candidate in candidates
        }
        analyzed_ids = [
            item.faculty_id
            for item in analysis.recommendations
            if item.faculty_id in candidate_by_id
        ]
        ordered_candidates = [candidate_by_id[faculty_id] for faculty_id in analyzed_ids]
        ordered_candidates.extend(
            candidate
            for candidate in candidates
            if candidate["faculty_id"] not in set(analyzed_ids)
        )

    recommendations = [
        build_recommendation(
            candidate,
            analysis_by_id.get(candidate["faculty_id"]) if analysis else None,
        )
        for candidate in ordered_candidates[:recommendation_limit]
    ]
    logger.info("[AI] Gemini recommendations returned: %d", len(recommendations))

    return {
        "mentors": recommendations,
        "recommendations": recommendations,
        "ai_analysis_available": analysis is not None,
    }