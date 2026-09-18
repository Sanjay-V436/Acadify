"""
Acadify AI Service — Faculty Profile Embedding + ChromaDB Storage (v2)

Change from v1: instead of generating placeholder IDs (faculty_0, faculty_1...),
this uses the REAL facultyProfileId from Sanjay's prisma/faculty-id-mapping.csv,
matched against our scraped faculty_export.csv by email (primary) or name
(fallback, for rows with no email).

Any scraped faculty member who can't be matched to a real facultyProfileId is
SKIPPED and reported at the end — those can't be used in the real mentor-
recommendation endpoint until they're reconciled with Sanjay's DB some other way.
"""

import csv
import chromadb
from sentence_transformers import SentenceTransformer


def normalize_name(name: str) -> str:
    """Lowercase, strip titles/whitespace so name matching is more forgiving."""
    n = name.lower().strip()
    for prefix in ["dr. ", "dr.", "prof. ", "prof."]:
        if n.startswith(prefix):
            n = n[len(prefix):].strip()
    return " ".join(n.split())  # collapse extra whitespace


def load_id_mapping(mapping_csv_path: str):
    """
    Loads Sanjay's mapping file. Returns two lookup dicts:
      by_email: { email -> facultyProfileId }
      by_name:  { normalized_name -> facultyProfileId }
    """
    by_email = {}
    by_name = {}

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


def parse_faculty_row(row: dict) -> dict:
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

    valid_rows = []
    skipped = 0
    for r in rows:
        if not r["name"] or not build_embedding_text(r):
            skipped += 1
            continue
        valid_rows.append(r)

    print(f"Loaded {len(valid_rows)} usable faculty rows, skipped {skipped} (missing name or content).")
    return valid_rows


def match_faculty_ids(faculty_list: list[dict], by_email: dict, by_name: dict):
    """
    Matches each scraped faculty member to a real facultyProfileId.
    Returns (matched_list, unmatched_list).
    matched_list items have an added "faculty_id" key.
    """
    matched = []
    unmatched = []

    for faculty in faculty_list:
        faculty_id = None

        email = faculty["email"].lower()
        if email and email in by_email:
            faculty_id = by_email[email]

        if not faculty_id:
            name_key = normalize_name(faculty["name"])
            if name_key in by_name:
                faculty_id = by_name[name_key]

        if faculty_id:
            faculty = {**faculty, "faculty_id": faculty_id}
            matched.append(faculty)
        else:
            unmatched.append(faculty)

    return matched, unmatched


def seed_chromadb(faculty_list: list[dict], collection_name: str = "faculty_profiles"):
    print("Loading BGE-Small model...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    print("Model loaded.")

    client = chromadb.HttpClient(host="localhost", port=8000)

    # Fresh collection each run, so stale placeholder-ID entries from the
    # previous version of this script don't linger alongside the new real IDs.
    try:
        client.delete_collection(name=collection_name)
        print(f"Deleted old '{collection_name}' collection (removing stale placeholder IDs).")
    except Exception:
        pass  # collection didn't exist yet — fine

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
            "email": faculty["email"],
            "designation": faculty["designation"],
            "research_interests": faculty["research_interests"],
            "profile_url": faculty["profile_url"],
        })

    collection.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)
    print(f"Seeded {len(ids)} faculty profiles into ChromaDB collection '{collection_name}' with REAL facultyProfileIds.")


if __name__ == "__main__":
    by_email, by_name = load_id_mapping("prisma/faculty-id-mapping.csv")

    faculty_list = load_faculty_from_csv("faculty_scraper/faculty_export.csv")

    matched, unmatched = match_faculty_ids(faculty_list, by_email, by_name)

    print(f"\nMatched: {len(matched)} / {len(faculty_list)}")
    if unmatched:
        print(f"\nUNMATCHED ({len(unmatched)}) — these were NOT seeded, need manual reconciliation with Sanjay:")
        for f in unmatched:
            print(f"   - {f['name']} ({f['email'] or 'no email'})")

    if matched:
        seed_chromadb(matched)
    else:
        print("\nNothing matched — check that the mapping file path/columns are correct before re-running.")