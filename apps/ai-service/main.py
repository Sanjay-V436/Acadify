import logging
import os
import random

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
from sentence_transformers import SentenceTransformer
import chromadb

from gemini_service import GeminiAnalysisService, RecommendationAnalysis


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("acadify-ai-service")


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------

app = FastAPI(title="Acadify AI Service")


# ---------------------------------------------------------------------------
# BGE-Small
# ---------------------------------------------------------------------------

print("Loading BGE-Small model...")
model = SentenceTransformer("BAAI/bge-small-en-v1.5")
print("Model loaded.")


# ---------------------------------------------------------------------------
# ChromaDB
# ---------------------------------------------------------------------------

CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.environ.get("CHROMA_PORT", "8000"))

chroma_client = chromadb.HttpClient(
    host=CHROMA_HOST,
    port=CHROMA_PORT,
)

# Existing collection — KEEPING THIS UNCHANGED
faculty_collection = chroma_client.get_or_create_collection(
    name="faculty_profiles"
)

# New publication-aware collection
publication_faculty_collection = chroma_client.get_or_create_collection(
    name="faculty_profiles_pub_v1"
)

logger.info(
    "Existing faculty collection count: %d",
    faculty_collection.count(),
)

logger.info(
    "Publication-aware faculty collection count: %d",
    publication_faculty_collection.count(),
)


# ---------------------------------------------------------------------------
# Gemini
# ---------------------------------------------------------------------------

gemini_service = GeminiAnalysisService()


# ---------------------------------------------------------------------------
# Basic endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "service": "acadify-ai-service",
    }


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
        "faculty_collection_count": faculty_collection.count(),
        "publication_collection_count": publication_faculty_collection.count(),
    }


# ---------------------------------------------------------------------------
# Embedding test
# ---------------------------------------------------------------------------

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
            raise ValueError(
                "project_title cannot be empty or just whitespace"
            )

        return v.strip()


# ---------------------------------------------------------------------------
# MOCK AVAILABILITY DATA
# ---------------------------------------------------------------------------

def get_availability(faculty_id: str) -> dict:
    """
    MOCK.

    Returns deterministic availability data for a faculty_id.

    TODO:
    Replace this with the real FacultyProfile data from the backend.
    """

    try:
        seed = int(faculty_id.replace("-", "")[:8], 16)
    except ValueError:
        seed = sum(ord(char) for char in faculty_id)

    rng = random.Random(seed)

    max_students = rng.choice([2, 3, 4, 5])

    current_students = rng.randint(
        0,
        max_students,
    )

    available_for_projects = rng.random() > 0.15

    available_slots = (
        max(0, max_students - current_students)
        if available_for_projects
        else 0
    )

    return {
        "available_for_projects": available_for_projects,
        "max_students": max_students,
        "current_students": current_students,
        "available_slots": available_slots,
    }


# ---------------------------------------------------------------------------
# Availability reranking
# ---------------------------------------------------------------------------

def rerank_with_availability(
    mentors: list[dict],
) -> list[dict]:

    """
    Re-rank semantic matches using availability.

    Semantic similarity remains the primary signal.
    Availability adjusts the ranking afterward.
    """

    for mentor in mentors:

        availability = get_availability(
            mentor["faculty_id"]
        )

        mentor["available_slots"] = availability[
            "available_slots"
        ]

        mentor["available_for_projects"] = availability[
            "available_for_projects"
        ]

        mentor["max_students"] = availability[
            "max_students"
        ]

        mentor["current_students"] = availability[
            "current_students"
        ]

        if (
            not availability["available_for_projects"]
            or availability["available_slots"] == 0
        ):

            availability_weight = 0.3

        else:

            slot_ratio = (
                availability["available_slots"]
                / max(1, availability["max_students"])
            )

            availability_weight = (
                0.85
                + (0.15 * slot_ratio)
            )

        raw_score = mentor["confidence_score"]

        mentor["confidence_score"] = round(
            raw_score * availability_weight,
            3,
        )

    mentors.sort(
        key=lambda m: m["confidence_score"],
        reverse=True,
    )

    return mentors


# ---------------------------------------------------------------------------
# Fallback explanation
# ---------------------------------------------------------------------------

FALLBACK_REASON = (
    "Semantic match found from the faculty research profile. "
    "AI explanation is temporarily unavailable."
)


def fallback_match_level(
    semantic_similarity: float,
) -> str:

    if semantic_similarity >= 0.65:
        return "High"

    if semantic_similarity >= 0.4:
        return "Moderate"

    return "Low"


# ---------------------------------------------------------------------------
# Build final recommendation
# ---------------------------------------------------------------------------

def build_recommendation(
    candidate: dict,
    analysis: RecommendationAnalysis | None,
) -> dict:

    if analysis is None:

        analysis_data = {
            "match_level": fallback_match_level(
                candidate["semantic_similarity"]
            ),
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

        analysis_data = analysis.model_dump(
            exclude={"faculty_id"}
        )

    return {

        "faculty_id": candidate["faculty_id"],

        "name": candidate["name"],

        "designation": candidate["designation"],

        "department": candidate["department"],

        "research_interests": candidate[
            "research_interests"
        ],

        "qualifications": candidate[
            "qualifications"
        ],

        "profile_url": candidate[
            "profile_url"
        ],

        "email": candidate.get(
            "email",
            "",
        ),

        "orcid": candidate.get(
            "orcid",
            "",
        ),

        "publications": candidate.get(
            "publications",
            "",
        ),

        "confidence_score": candidate[
            "confidence_score"
        ],

        "research_match_percent": candidate[
            "research_match_percent"
        ],

        "semantic_similarity": candidate[
            "semantic_similarity"
        ],

        "chroma_distance": candidate[
            "chroma_distance"
        ],

        "available_for_projects": candidate[
            "available_for_projects"
        ],

        "available_slots": candidate[
            "available_slots"
        ],

        "max_students": candidate[
            "max_students"
        ],

        "current_students": candidate[
            "current_students"
        ],

        "reasoning": analysis_data[
            "recommendation_reason"
        ],

        **analysis_data,
    }


# ---------------------------------------------------------------------------
# Mentor Recommendation API
# ---------------------------------------------------------------------------

@app.post("/ai/mentor-recommendation")
def mentor_recommendation(
    request: MentorRecommendationRequest,
    top_n: int | None = None,
):

    """
    Mentor recommendation pipeline:

        Student Project
              ↓
        BGE-Small
              ↓
        Publication-aware ChromaDB
              ↓
        Top semantic candidates
              ↓
        Availability reranking
              ↓
        Gemini explanation
              ↓
        Final recommendations

    The original faculty_profiles collection is preserved.
    """

    recommendation_limit = max(
        1,
        min(
            top_n
            if top_n is not None
            else request.top_k,
            5,
        ),
    )

    # -------------------------------------------------------
    # Build project query
    # -------------------------------------------------------

    query_text = request.project_title

    if request.description:
        query_text += ". " + request.description

    logger.info(
        "[AI] Processing project: %s",
        query_text,
    )

    # -------------------------------------------------------
    # Generate project embedding
    # -------------------------------------------------------

    try:

        query_embedding = model.encode(
            query_text,
            normalize_embeddings=True,
        ).tolist()

    except Exception:

        logger.exception(
            "Failed to generate embedding for query: %s",
            query_text,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to process the project "
                "description. Please try again."
            ),
        )

    # -------------------------------------------------------
    # Use publication-aware collection
    # -------------------------------------------------------

    collection = publication_faculty_collection

    collection_count = collection.count()

    # Safety fallback:
    # If publication collection is unavailable/empty,
    # use the original collection.
    if collection_count == 0:

        logger.warning(
            "Publication-aware collection is empty. "
            "Falling back to original faculty collection."
        )

        collection = faculty_collection
        collection_count = collection.count()

    if collection_count == 0:

        logger.warning(
            "No faculty records available."
        )

        return {
            "mentors": [],
            "recommendations": [],
            "ai_analysis_available": False,
        }

    # -------------------------------------------------------
    # Retrieve semantic candidates
    # -------------------------------------------------------

    fetch_n = min(
        10,
        collection_count,
    )

    try:

        results = collection.query(
            query_embeddings=[
                query_embedding
            ],
            n_results=fetch_n,
            include=[
                "documents",
                "metadatas",
                "distances",
            ],
        )

    except Exception:

        logger.exception(
            "ChromaDB query failed"
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Faculty matching service is "
                "temporarily unavailable. "
                "Please try again shortly."
            ),
        )

    # -------------------------------------------------------
    # Handle no results
    # -------------------------------------------------------

    if (
        not results.get("ids")
        or not results["ids"][0]
    ):

        logger.warning(
            "No faculty matches found for query: %s",
            query_text,
        )

        return {
            "mentors": [],
            "recommendations": [],
            "ai_analysis_available": False,
        }

    # -------------------------------------------------------
    # Build candidates
    # -------------------------------------------------------

    candidates = []

    for i in range(
        len(results["ids"][0])
    ):

        faculty_id = results[
            "ids"
        ][0][i]

        metadata = (
            results["metadatas"][0][i]
            or {}
        )

        documents = results.get(
            "documents"
        )

        document = ""

        if documents and documents[0]:
            document = (
                documents[0][i]
                or ""
            )

        distance = results[
            "distances"
        ][0][i]

        availability = get_availability(
            faculty_id
        )

        # ---------------------------------------------------
        # Semantic score
        # ---------------------------------------------------

        research_match_percent = round(
            max(
                0,
                (1 - distance) * 100,
            ),
            1,
        )

        semantic_similarity = round(
            research_match_percent / 100,
            3,
        )

        candidates.append({

            "faculty_id": faculty_id,

            "name": metadata.get(
                "name",
                "Not provided",
            ),

            "designation": metadata.get(
                "designation",
                "Not provided",
            ),

            "department": metadata.get(
                "department",
                "Not provided",
            ),

            "research_interests": metadata.get(
                "research_interests",
                "Not provided",
            ),

            "qualifications": metadata.get(
                "qualification",
                metadata.get(
                    "qualifications",
                    "Not provided",
                ),
            ),

            "profile_url": metadata.get(
                "profile_url",
                "Not provided",
            ),

            "email": metadata.get(
                "email",
                "",
            ),

            "orcid": metadata.get(
                "orcid",
                "",
            ),

            "publications": metadata.get(
                "publications",
                "",
            ),

            "profile_document": document,

            "confidence_score": semantic_similarity,

            "research_match_percent": (
                research_match_percent
            ),

            "semantic_similarity": (
                semantic_similarity
            ),

            "chroma_distance": distance,

            **availability,
        })

    # -------------------------------------------------------
    # Availability reranking
    # -------------------------------------------------------

    try:

        candidates = rerank_with_availability(
            candidates
        )

    except Exception:

        logger.exception(
            "Availability re-ranking failed. "
            "Falling back to semantic ranking."
        )

    logger.info(
        "[AI] Chroma candidates: %d",
        len(candidates),
    )

    # -------------------------------------------------------
    # Gemini reasoning
    # -------------------------------------------------------

    try:

        analysis = gemini_service.analyze(

            project_title=request.project_title,

            project_description=(
                request.description
                or ""
            ),

            candidates=candidates,

        )

    except Exception:

        logger.exception(
            "Gemini analysis failed"
        )

        analysis = None

    # -------------------------------------------------------
    # Map Gemini results by faculty ID
    # -------------------------------------------------------

    analysis_by_id = {

        item.faculty_id: item

        for item in (
            analysis.recommendations
            if analysis
            else []
        )

    }

    # -------------------------------------------------------
    # Preserve candidate ordering
    # -------------------------------------------------------

    ordered_candidates = candidates

    if analysis:

        candidate_by_id = {

            candidate["faculty_id"]: candidate

            for candidate in candidates

        }

        analyzed_ids = [

            item.faculty_id

            for item in analysis.recommendations

            if item.faculty_id
            in candidate_by_id

        ]

        ordered_candidates = [

            candidate_by_id[faculty_id]

            for faculty_id in analyzed_ids

        ]

        analyzed_id_set = set(
            analyzed_ids
        )

        ordered_candidates.extend(

            candidate

            for candidate in candidates

            if candidate["faculty_id"]
            not in analyzed_id_set

        )

    # -------------------------------------------------------
    # Build final response
    # -------------------------------------------------------

    recommendations = [

        build_recommendation(

            candidate,

            (
                analysis_by_id.get(
                    candidate["faculty_id"]
                )
                if analysis
                else None
            ),

        )

        for candidate
        in ordered_candidates[
            :recommendation_limit
        ]

    ]

    logger.info(
        "[AI] Recommendations returned: %d",
        len(recommendations),
    )

    return {

        "mentors": recommendations,

        "recommendations": recommendations,

        "ai_analysis_available": (
            analysis is not None
        ),

    }