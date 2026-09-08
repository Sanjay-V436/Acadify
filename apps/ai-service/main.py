import os

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import chromadb

app = FastAPI(title="Acadify AI Service")

# Loaded once at startup, not per-request.
print("Loading BGE-Small model...")
model = SentenceTransformer("BAAI/bge-small-en-v1.5")
print("Model loaded.")

# CHROMA_HOST defaults to "localhost" for running outside Docker (your
# normal local dev flow). Inside docker-compose, this is set to
# "chromadb" — the service name — since containers can't reach each
# other via localhost.
CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.environ.get("CHROMA_PORT", "8000"))
chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
faculty_collection = chroma_client.get_or_create_collection(name="faculty_profiles")


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

    return {
        "status": "healthy",
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
# Mentor Recommendation — the flagship AI feature
# ---------------------------------------------------------------------------

class MentorRecommendationRequest(BaseModel):
    project_title: str
    description: str | None = None


@app.post("/ai/mentor-recommendation")
def mentor_recommendation(request: MentorRecommendationRequest, top_n: int = 5):
    """
    Matches the agreed API contract with Person B (Sanjay):

    Request:  { "project_title": string, "description"?: string }
    Response: { "mentors": [ { faculty_id, name, confidence_score,
                                research_match_percent, available_slots,
                                reasoning } ] }

    NOTE on available_slots: real availability data (availableForProjects,
    maxStudents, currentStudents) lives in Sanjay's FacultyProfile table,
    not in this scraped faculty_profiles ChromaDB collection. Until the
    data-source question is settled with him, this returns a placeholder
    value (-1) so the response shape is correct and testable end-to-end.
    Swap this out once real availability data is wired in (Phase 3).
    """
    query_text = request.project_title
    if request.description:
        query_text += ". " + request.description

    query_embedding = model.encode(query_text).tolist()

    results = faculty_collection.query(
        query_embeddings=[query_embedding],
        n_results=top_n,
    )

    mentors = []
    for i in range(len(results["ids"][0])):
        faculty_id = results["ids"][0][i]
        metadata = results["metadatas"][0][i]
        distance = results["distances"][0][i]

        # Convert ChromaDB's distance (lower = more similar) into a
        # 0-100 style score that's easier for the frontend to display.
        research_match_percent = round(max(0, (1 - distance) * 100), 1)
        confidence_score = round(research_match_percent / 100, 3)

        mentors.append({
            "faculty_id": faculty_id,
            "name": metadata.get("name", ""),
            "confidence_score": confidence_score,
            "research_match_percent": research_match_percent,
            "available_slots": -1,  # placeholder — see NOTE above
            "reasoning": (
                f"Matched based on semantic similarity between the project "
                f"description and {metadata.get('name', 'this faculty member')}'s "
                f"research profile ({metadata.get('designation', '')})."
            ),
        })

    return {"mentors": mentors}