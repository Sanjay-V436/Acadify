"""
Standalone test — semantic search against the faculty_profiles collection
already seeded by seed_faculty.py.

This proves the core AI pipeline works end-to-end:
  project title text -> embedding -> closest faculty matches

No FastAPI yet, no ranking/availability logic yet — just raw semantic search.
"""

import chromadb
from sentence_transformers import SentenceTransformer


def search_faculty(project_title: str, description: str = "", top_n: int = 5):
    print("Loading BGE-Small model...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")

    client = chromadb.HttpClient(host="localhost", port=8000)
    collection = client.get_or_create_collection(name="faculty_profiles")

    # Combine title + description the same way a real student query would arrive
    query_text = project_title
    if description:
        query_text += ". " + description

    query_embedding = model.encode(query_text).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_n,
    )

    print(f"\nQuery: \"{query_text}\"\n")
    print(f"Top {top_n} matching faculty:\n")

    for i in range(len(results["ids"][0])):
        name = results["metadatas"][0][i]["name"]
        designation = results["metadatas"][0][i]["designation"]
        distance = results["distances"][0][i]
        # ChromaDB returns distance (lower = more similar).
        # Convert to a rough 0-100% similarity score for readability.
        similarity_percent = max(0, round((1 - distance) * 100, 1))

        print(f"{i+1}. {name}")
        print(f"   {designation}")
        print(f"   distance={distance:.4f}  (~{similarity_percent}% similarity)\n")


if __name__ == "__main__":
    # Try a few different project titles to sanity-check match quality
    search_faculty("Machine learning for smart agriculture and IoT sensors")
    print("-" * 60)
    search_faculty("VLSI design and embedded systems for FPGA")