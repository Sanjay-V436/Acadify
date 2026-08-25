from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Acadify AI Service")

# Loaded once when the server starts, not per-request.
# Loading it per-request would make every API call painfully slow.
print("Loading BGE-Small model...")
model = SentenceTransformer("BAAI/bge-small-en-v1.5")
print("Model loaded.")


@app.get("/")
def read_root():
    return {
        "status": "ok",
        "service": "acadify-ai-service"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": model is not None
    }


class EmbedRequest(BaseModel):
    text: str


@app.post("/test/embed")
def test_embed(request: EmbedRequest):
    """
    Test endpoint: takes raw text, returns its BGE-Small embedding.
    """
    embedding = model.encode(request.text).tolist()
    return {
        "text": request.text,
        "embedding_dimensions": len(embedding),
        "embedding_preview": embedding[:5]
    }