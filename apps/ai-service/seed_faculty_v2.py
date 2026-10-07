"""
Acadify AI Service — Faculty Profile Embedding + ChromaDB Storage (v2)

Seeds targeted faculty from apps/backend/prisma/faculty_dataset.csv:
- ECE: startsWith("Department of Electronics and Communication Engineering") -> 22 faculty
- MECH: startsWith("Department of Mechanical Engineering") -> 15 faculty
- Total: 37 faculty seeded with complete metadata.
- Other 15 non-ECE/non-MECH rows are skipped.

Faculty without email:
- Do NOT invent fake emails or fake credentials.
- Seeded into Chroma with deterministic UUIDs.
- Includes complete metadata (department, designation, research_interests, profile_url, etc.)
"""

import csv
import os
import uuid
import chromadb
from sentence_transformers import SentenceTransformer


def normalize_name(name: str) -> str:
    """Lowercase, strip titles/whitespace so name matching is more forgiving."""
    n = name.lower().strip()
    for prefix in ["dr. ", "dr.", "prof. ", "prof."]:
        if n.startswith(prefix):
            n = n[len(prefix):].strip()
    return " ".join(n.split())


def load_id_mapping(mapping_csv_path: str):
    """
    Loads faculty-id-mapping.csv if available.
    Returns lookup dicts:
      by_email: { email -> facultyProfileId }
      by_name:  { normalized_name -> facultyProfileId }
    """
    by_email = {}
    by_name = {}

    if not os.path.exists(mapping_csv_path):
        return by_email, by_name

    with open(mapping_csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            faculty_id = (row.get("facultyProfileId") or "").strip()
            email = (row.get("email") or "").strip().lower()
            name = (row.get("name") or "").strip()

            if not faculty_id:
                continue
            if email:
                by_email[email] = faculty_id
            if name:
                by_name[normalize_name(name)] = faculty_id

    print(f"Loaded ID mapping: {len(by_email)} by email, {len(by_name)} by name.")
    return by_email, by_name


def parse_faculty_row(row: dict) -> dict | None:
    raw_dept = (row.get("department") or "").strip()
    name = (row.get("name") or "").strip()

    if not name:
        return None

    # Prefix matching for ECE and MECH
    if raw_dept.startswith("Department of Electronics and Communication Engineering"):
        canonical_dept = "Electronics and Communication Engineering"
    elif raw_dept.startswith("Department of Mechanical Engineering"):
        canonical_dept = "Mechanical Engineering"
    else:
        # Skip other 15 rows (Science & Humanities, Amrita Darshanam, empty)
        return None

    return {
        "name": name,
        "email": (row.get("email") or "").strip(),
        "department": canonical_dept,
        "designation": (row.get("designation") or "").strip(),
        "qualification": (row.get("qualification") or "").strip(),
        "research_interests": (row.get("research_interests") or row.get("researchInterests") or "").strip(),
        "publications": (row.get("publications") or "").strip(),
        "orcid": (row.get("orcid") or "").strip(),
        "profile_url": (row.get("profile_url") or row.get("profileUrl") or "").strip(),
    }


def build_embedding_text(faculty: dict) -> str:
    parts = []
    if faculty.get("department"):
        parts.append(f"Department of {faculty['department']}")
    if faculty.get("designation"):
        parts.append(faculty["designation"])
    if faculty.get("research_interests"):
        parts.append("Research interests: " + faculty["research_interests"])
    if faculty.get("qualification"):
        parts.append("Qualification: " + faculty["qualification"])
    if faculty.get("publications"):
        pubs = [p.strip() for p in faculty["publications"].split("|") if p.strip()]
        if pubs:
            parts.append("Key publications: " + "; ".join(pubs[:5]))
    return ". ".join(parts)


def load_target_faculty_from_csv(csv_path: str) -> list[dict]:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Faculty dataset not found at: {csv_path}")

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        all_rows = list(reader)

    target_faculty = []
    skipped_count = 0

    for r in all_rows:
        parsed = parse_faculty_row(r)
        if parsed and build_embedding_text(parsed):
            target_faculty.append(parsed)
        else:
            skipped_count += 1

    ece_count = sum(1 for f in target_faculty if f["department"] == "Electronics and Communication Engineering")
    mech_count = sum(1 for f in target_faculty if f["department"] == "Mechanical Engineering")

    print(f"Loaded {len(target_faculty)} target faculty (ECE: {ece_count}, MECH: {mech_count}). Skipped {skipped_count} rows.")
    return target_faculty


def assign_faculty_ids(faculty_list: list[dict], by_email: dict, by_name: dict) -> list[dict]:
    """
    Assigns real facultyProfileId if present in mapping file,
    or generates a deterministic UUID if unmapped or for no-email faculty.
    """
    enriched = []
    for f in faculty_list:
        faculty_id = None
        email = f["email"].lower() if f.get("email") else ""

        if email and email in by_email:
            faculty_id = by_email[email]

        if not faculty_id:
            name_key = normalize_name(f["name"])
            if name_key in by_name:
                faculty_id = by_name[name_key]

        # Deterministic UUID fallback (ensures stability across re-runs)
        if not faculty_id:
            if email:
                faculty_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"faculty:{email}"))
            else:
                faculty_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"noemail:{normalize_name(f['name'])}"))

        enriched.append({**f, "faculty_id": faculty_id})

    return enriched


def seed_chromadb(faculty_list: list[dict], collection_name: str = "faculty_profiles"):
    print("Loading BGE-Small model...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    print("Model loaded.")

    client = chromadb.HttpClient(host="localhost", port=8000)

    try:
        client.delete_collection(name=collection_name)
        print(f"Deleted old '{collection_name}' collection.")
    except Exception:
        pass

    collection = client.get_or_create_collection(name=collection_name)

    ids, documents, embeddings, metadatas = [], [], [], []

    for faculty in faculty_list:
        text = build_embedding_text(faculty)
        embedding = model.encode(text).tolist()

        ids.append(faculty["faculty_id"])
        documents.append(text)
        embeddings.append(embedding)
        metadatas.append({
            "name": faculty["name"],
            "department": faculty["department"],
            "designation": faculty["designation"],
            "qualification": faculty["qualification"],
            "research_interests": faculty["research_interests"],
            "publications": faculty["publications"],
            "email": faculty["email"],
            "orcid": faculty["orcid"],
            "profile_url": faculty["profile_url"],
            "available_for_projects": True,
            "max_students": 5,
            "current_students": 0,
        })

    collection.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)
    print(f"Seeded {len(ids)} faculty profiles into ChromaDB collection '{collection_name}' with complete metadata.")


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    primary_csv = os.path.join(current_dir, "..", "backend", "prisma", "faculty_dataset.csv")
    fallback_csv = os.path.join(current_dir, "prisma", "faculty_dataset.csv")
    csv_path = primary_csv if os.path.exists(primary_csv) else fallback_csv

    mapping_path = os.path.join(current_dir, "..", "backend", "prisma", "faculty-id-mapping.csv")
    by_email, by_name = load_id_mapping(mapping_path)

    faculty_list = load_target_faculty_from_csv(csv_path)
    faculty_with_ids = assign_faculty_ids(faculty_list, by_email, by_name)

    print(f"\nTotal faculty ready for Chroma: {len(faculty_with_ids)}")
    with_email = sum(1 for f in faculty_with_ids if f["email"])
    no_email = sum(1 for f in faculty_with_ids if not f["email"])
    print(f"  - With email (DB mapped/deterministic): {with_email}")
    print(f"  - Without email (deterministic noemail-UUID): {no_email}")

    # Note: seed_chromadb() is called explicitly when authorized to seed Chroma.
    seed_chromadb(faculty_with_ids)