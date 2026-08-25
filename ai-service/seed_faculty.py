"""
Acadify AI Service — Faculty Profile Embedding + ChromaDB Storage
Person A (AI Engineer)

Matches the scraper.py output schema:
name, email, designation, department, qualification, researchInterests, orcid, profileUrl

This data is scraped from a public site, so it's messier than a clean DB export:
- Some rows have empty email
- department is often empty
- qualification sometimes has stray junk mixed in
- researchInterests is occasionally empty

This script handles all of that gracefully rather than crashing on missing fields.
"""

import csv
import chromadb
from sentence_transformers import SentenceTransformer


def parse_faculty_row(row: dict) -> dict:
    """Cleans one row from faculty_export.csv, filling in safe defaults for missing fields."""
    return {
        "name": (row.get("name") or "").strip(),
        "email": (row.get("email") or "").strip(),
        "designation": (row.get("designation") or "").strip(),
        "department": (row.get("department") or "").strip(),
        "qualification": (row.get("qualification") or "").strip(),
        "research_interests": (row.get("researchInterests") or "").strip(),
        "orcid": (row.get("orcid") or "").strip(),
        "profile_url": (row.get("profileUrl") or "").strip(),
    }


def build_embedding_text(faculty: dict) -> str:
    """
    Builds the text blob to embed. Only research-relevant fields go in —
    email, orcid, profileUrl are metadata, not semantic content.
    """
    parts = []

    if faculty["designation"]:
        parts.append(faculty["designation"])

    if faculty["research_interests"]:
        parts.append("Research interests: " + faculty["research_interests"])

    if faculty["qualification"]:
        parts.append("Qualification: " + faculty["qualification"])

    return ". ".join(parts)


def load_faculty_from_csv(csv_path: str) -> list[dict]:
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [parse_faculty_row(row) for row in reader]

    # Skip rows with no name (blank/junk rows) or no usable text to embed
    valid_rows = []
    skipped = 0
    for r in rows:
        if not r["name"]:
            skipped += 1
            continue
        if not build_embedding_text(r):
            skipped += 1
            continue
        valid_rows.append(r)

    print(f"Loaded {len(valid_rows)} usable faculty rows, skipped {skipped} (missing name or content).")
    return valid_rows


def seed_chromadb(faculty_list: list[dict], collection_name: str = "faculty_profiles"):
    print("Loading BGE-Small model...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    print("Model loaded.")

    client = chromadb.HttpClient(host="localhost", port=8000)
    collection = client.get_or_create_collection(name=collection_name)

    ids = []
    documents = []
    embeddings = []
    metadatas = []

    for i, faculty in enumerate(faculty_list):
        text = build_embedding_text(faculty)
        embedding = model.encode(text).tolist()

        # No faculty_id in this scraped data, so use a stable generated ID.
        # Later, once this data is matched against Sanjay's real DB, faculty_id
        # from FacultyProfile should replace this.
        faculty_id = f"faculty_{i}"

        ids.append(faculty_id)
        documents.append(text)
        embeddings.append(embedding)
        metadatas.append({
            "name": faculty["name"],
            "email": faculty["email"],
            "designation": faculty["designation"],
            "research_interests": faculty["research_interests"],
            "profile_url": faculty["profile_url"],
        })

    collection.upsert(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    print(f"Seeded {len(ids)} faculty profiles into ChromaDB collection '{collection_name}'.")


if __name__ == "__main__":
    faculty_list = load_faculty_from_csv("faculty_scraper/faculty_export.csv")

    print("\nPreview of embedding text (first 3 faculty):")
    for f in faculty_list[:3]:
        print(f"- {f['name']}: {build_embedding_text(f)}\n")

    seed_chromadb(faculty_list)