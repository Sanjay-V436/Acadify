import os
import chromadb
from sentence_transformers import SentenceTransformer

COLLECTION_NAME = "faculty_profiles_pub_v1"

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))

# Sample student project
PROJECT = """
AI-based electric vehicle battery health monitoring and
predictive maintenance using machine learning and IoT.
"""

print("Loading BGE-Small...")
model = SentenceTransformer("BAAI/bge-small-en-v1.5")

print(f"Connecting to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}...")
client = chromadb.HttpClient(
    host=CHROMA_HOST,
    port=CHROMA_PORT
)

collection = client.get_collection(COLLECTION_NAME)

print(f"Collection loaded: {COLLECTION_NAME}")
print(f"Faculty count: {collection.count()}")

# Create project embedding
query_embedding = model.encode(
    PROJECT,
    normalize_embeddings=True
).tolist()

# Retrieve top 5
results = collection.query(
    query_embeddings=[query_embedding],
    n_results=5
)

print("\n" + "=" * 70)
print("PROJECT")
print("=" * 70)
print(PROJECT.strip())

print("\n" + "=" * 70)
print("TOP 5 FACULTY")
print("=" * 70)

for i in range(5):
    metadata = results["metadatas"][0][i]
    distance = results["distances"][0][i]

    # Chroma distance → approximate similarity percentage
    match_score = max(0, (1 - distance) * 100)

    print(f"\n#{i + 1}")
    print("-" * 50)
    print(f"Name        : {metadata['name']}")
    print(f"Department  : {metadata['department']}")
    print(f"Designation : {metadata['designation']}")
    print(f"Match Score : {match_score:.2f}%")

    print("\nResearch Interests:")
    print(metadata["research_interests"][:500])

    print("\nPublication Evidence:")
    publications = metadata["publications"]

    if publications:
        pubs = publications.split(" | ")

        for pub in pubs[:3]:
            print(f"  • {pub}")
    else:
        print("  No publications available")

print("\n" + "=" * 70)
print("RETRIEVAL TEST COMPLETE")
print("=" * 70)