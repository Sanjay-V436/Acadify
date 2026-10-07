"""
Acadify — Synchronize ChromaDB with Current PostgreSQL Faculty Profiles

This script:
1. Connects to PostgreSQL using DIRECT_URL / DATABASE_URL from environment or apps/backend/.env.
2. Queries all 26 current active FacultyProfile records joining User and Department.
3. Prints a summary of the stale ChromaDB collection before deletion.
4. Safely drops and recreates the ChromaDB `faculty_profiles` collection.
5. Generates semantic embeddings with BGE-small-en-v1.5 (excluding availability fields).
6. Upserts the 26 records into ChromaDB using PostgreSQL FacultyProfile.id as the document ID.
7. Performs automated cross-verification:
   - Matching count == 26
   - Only in Postgres == 0
   - Only in Chroma == 0
   - Duplicates == 0
"""

import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import psycopg2
import chromadb
from sentence_transformers import SentenceTransformer


def load_db_url() -> str:
    # Check environment first
    db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if db_url:
        return db_url

    # Check apps/backend/.env
    backend_env = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
    )
    if os.path.exists(backend_env):
        with open(backend_env, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DIRECT_URL="):
                    return line.split("=", 1)[1].strip('"\'')
                if not db_url and line.startswith("DATABASE_URL="):
                    db_url = line.split("=", 1)[1].strip('"\'')

    if db_url:
        return db_url

    raise ValueError("Could not find DIRECT_URL or DATABASE_URL in environment or apps/backend/.env")


def fetch_postgres_faculty(db_url: str) -> list[dict]:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    query = """
    SELECT 
        fp.id AS faculty_id,
        fp."userId" AS user_id,
        u.name,
        u.email,
        d.name AS department_name,
        d.code AS department_code,
        fp.designation,
        fp.bio,
        fp.qualification,
        fp."experienceYears" AS experience_years,
        fp."researchInterests" AS research_interests,
        fp.publications,
        fp."currentResearch" AS current_research,
        fp.skills,
        fp.specialization,
        fp."preferredDomains" AS preferred_domains,
        fp."preferredTechnologies" AS preferred_technologies,
        fp."facultyWebpageUrl" AS faculty_webpage_url,
        fp."googleScholarUrl" AS google_scholar_url,
        fp."orcidUrl" AS orcid_url,
        fp."linkedinUrl" AS linkedin_url,
        fp."availableForProjects" AS available_for_projects,
        fp."maxStudents" AS max_students,
        fp."currentStudents" AS current_students
    FROM "FacultyProfile" fp
    JOIN "User" u ON fp."userId" = u.id
    LEFT JOIN "Department" d ON u."departmentId" = d.id
    ORDER BY u.name ASC;
    """

    cur.execute(query)
    rows = cur.fetchall()
    colnames = [desc[0] for desc in cur.description]
    cur.close()
    conn.close()

    faculty_list = [dict(zip(colnames, row)) for row in rows]
    return faculty_list


def build_semantic_text(faculty: dict) -> str:
    """
    Constructs the semantic text representation for BGE embedding.
    Uses relevant academic profile fields (department, designation, qualification,
    specialization, research interests, current research, preferred domains/tech, skills,
    bio, key publications).
    Availability fields (availableForProjects, maxStudents, currentStudents) are EXCLUDED.
    """
    parts = []

    dept = faculty.get("department_name") or faculty.get("department_code")
    if dept:
        parts.append(f"Department of {dept}")

    if faculty.get("designation"):
        parts.append(str(faculty["designation"]).strip())

    if faculty.get("qualification"):
        parts.append(f"Qualification: {str(faculty['qualification']).strip()}")

    if faculty.get("specialization"):
        parts.append(f"Specialization: {str(faculty['specialization']).strip()}")

    ri = faculty.get("research_interests")
    if ri:
        ri_text = ", ".join(ri) if isinstance(ri, list) else str(ri)
        if ri_text.strip():
            parts.append(f"Research interests: {ri_text.strip()}")

    if faculty.get("current_research"):
        parts.append(f"Current research: {str(faculty['current_research']).strip()}")

    pd = faculty.get("preferred_domains")
    if pd:
        pd_text = ", ".join(pd) if isinstance(pd, list) else str(pd)
        if pd_text.strip():
            parts.append(f"Preferred domains: {pd_text.strip()}")

    pt = faculty.get("preferred_technologies")
    if pt:
        pt_text = ", ".join(pt) if isinstance(pt, list) else str(pt)
        if pt_text.strip():
            parts.append(f"Preferred technologies: {pt_text.strip()}")

    skills = faculty.get("skills")
    if skills:
        skills_text = ", ".join(skills) if isinstance(skills, list) else str(skills)
        if skills_text.strip():
            parts.append(f"Skills: {skills_text.strip()}")

    if faculty.get("bio"):
        parts.append(str(faculty["bio"]).strip())

    pubs = faculty.get("publications")
    if pubs:
        if isinstance(pubs, list):
            pub_list = [p.strip() for p in pubs if p.strip()]
        else:
            pub_list = [p.strip() for p in str(pubs).split("|") if p.strip()]
        if pub_list:
            parts.append("Key publications: " + "; ".join(pub_list[:10]))

    return ". ".join([p for p in parts if p and p.strip()])


def build_chroma_metadata(faculty: dict) -> dict:
    """
    Constructs metadata dictionary with complete faculty details.
    Only primitive values (str, int, bool) are stored in Chroma metadata.
    """
    ri = faculty.get("research_interests") or []
    ri_str = ", ".join(ri) if isinstance(ri, list) else str(ri or "")

    pubs = faculty.get("publications") or []
    pubs_str = " | ".join(pubs) if isinstance(pubs, list) else str(pubs or "")

    pd = faculty.get("preferred_domains") or []
    pd_str = ", ".join(pd) if isinstance(pd, list) else str(pd or "")

    pt = faculty.get("preferred_technologies") or []
    pt_str = ", ".join(pt) if isinstance(pt, list) else str(pt or "")

    qual = str(faculty.get("qualification") or "")
    dept = str(faculty.get("department_name") or faculty.get("department_code") or "")

    return {
        "faculty_id": str(faculty["faculty_id"]),
        "name": str(faculty.get("name") or ""),
        "email": str(faculty.get("email") or ""),
        "department": dept,
        "designation": str(faculty.get("designation") or ""),
        "qualification": qual,
        "qualifications": qual,
        "research_interests": ri_str,
        "preferred_domains": pd_str,
        "preferred_technologies": pt_str,
        "publications": pubs_str,
        "orcid": str(faculty.get("orcid_url") or ""),
        "profile_url": str(faculty.get("faculty_webpage_url") or ""),
        "available_for_projects": bool(faculty.get("available_for_projects", True)),
        "max_students": int(faculty.get("max_students") or 5),
        "current_students": int(faculty.get("current_students") or 0),
    }


def synchronize():
    print("==================================================")
    print("ACADIFY CHROMADB FACULTY SYNCHRONIZATION")
    print("==================================================\n")

    # 1. Fetch current PostgreSQL faculty
    db_url = load_db_url()
    print("Connecting to PostgreSQL...")
    pg_faculty = fetch_postgres_faculty(db_url)
    pg_count = len(pg_faculty)
    print(f"PostgreSQL FacultyProfile count: {pg_count}")
    if pg_count != 26:
        print(f"WARNING: Expected 26 PostgreSQL FacultyProfiles, but found {pg_count}!")

    # 2. Inspect existing Chroma collection before modification
    chroma_host = os.environ.get("CHROMA_HOST", "localhost")
    chroma_port = int(os.environ.get("CHROMA_PORT", "8000"))
    collection_name = "faculty_profiles"

    print(f"\nConnecting to ChromaDB at {chroma_host}:{chroma_port}...")
    chroma_client = chromadb.HttpClient(host=chroma_host, port=chroma_port)

    print("\n--- STEP 3: PRE-REPLACEMENT CHROMA SUMMARY ---")
    try:
        old_col = chroma_client.get_collection(name=collection_name)
        old_count = old_col.count()
        old_data = old_col.get(include=["metadatas"])
        old_ids = old_data.get("ids", [])
        print(f"Existing collection name: '{collection_name}'")
        print(f"Existing record count: {old_count}")
        print(f"Existing IDs ({len(old_ids)}):")
        for i, oid in enumerate(old_ids):
            meta = old_data["metadatas"][i] if old_data.get("metadatas") else {}
            print(f"  [{i+1}] {oid} ({meta.get('name', 'Unknown')})")
    except Exception as e:
        print(f"No existing collection '{collection_name}' or error retrieving: {e}")
        old_count = 0

    # 3. Delete existing collection safely
    print(f"\nDeleting stale '{collection_name}' collection...")
    try:
        chroma_client.delete_collection(name=collection_name)
        print(f"Successfully deleted collection '{collection_name}'.")
    except Exception as e:
        print(f"Collection deletion notice: {e}")

    # 4. Recreate collection
    print(f"Recreating empty '{collection_name}' collection...")
    collection = chroma_client.create_collection(name=collection_name)
    print(f"Collection '{collection_name}' recreated.")

    # 5. Load BGE-small-en-v1.5
    print("\nLoading embedding model 'BAAI/bge-small-en-v1.5'...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    print("Model loaded successfully.")

    # 6. Generate embeddings and prepare payloads
    print(f"\nEmbedding {len(pg_faculty)} PostgreSQL faculty profiles...")
    ids = []
    documents = []
    embeddings = []
    metadatas = []
    failed_count = 0

    for idx, f in enumerate(pg_faculty):
        try:
            doc_text = build_semantic_text(f)
            if not doc_text.strip():
                print(f"Warning: Empty semantic text for faculty {f['name']} ({f['faculty_id']})")
                doc_text = f"{f['name']}. Department of {f.get('department_name', 'Engineering')}"

            embedding = model.encode(doc_text).tolist()
            meta = build_chroma_metadata(f)

            ids.append(str(f["faculty_id"]))
            documents.append(doc_text)
            embeddings.append(embedding)
            metadatas.append(meta)

            print(f"  [{idx+1}/{len(pg_faculty)}] Embedded: {f['name']} (ID: {f['faculty_id']})")
        except Exception as err:
            print(f"  FAILED to embed {f.get('name')}: {err}")
            failed_count += 1

    # 7. Upsert into Chroma
    print(f"\nUpserting {len(ids)} documents into Chroma collection '{collection_name}'...")
    collection.upsert(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )
    print("Upsert complete.")

    # 8. Post-synchronization Verification
    print("\n==================================================")
    print("STEP 8 — AUTOMATED VERIFICATION")
    print("==================================================")

    new_count = collection.count()
    new_data = collection.get(include=["metadatas"])
    chroma_ids = new_data.get("ids", [])
    pg_ids = [str(f["faculty_id"]) for f in pg_faculty]

    matching_ids = set(pg_ids).intersection(set(chroma_ids))
    only_in_pg = set(pg_ids) - set(chroma_ids)
    only_in_chroma = set(chroma_ids) - set(pg_ids)
    duplicates = len(chroma_ids) - len(set(chroma_ids))

    print(f"PostgreSQL faculty count:    {len(pg_ids)}")
    print(f"Chroma faculty count:        {new_count}")
    print(f"Successfully embedded:       {len(ids)}")
    print(f"Failed count:                {failed_count}")
    print(f"Matching IDs:                {len(matching_ids)}")
    print(f"Only in PostgreSQL:          {len(only_in_pg)}")
    print(f"Only in Chroma:              {len(only_in_chroma)}")
    print(f"Duplicate IDs:               {duplicates}")

    # Strict assertion
    if (
        len(pg_ids) != 26
        or new_count != 26
        or len(matching_ids) != 26
        or len(only_in_pg) != 0
        or len(only_in_chroma) != 0
        or duplicates != 0
    ):
        print("\n[ERROR] AUTOMATED VERIFICATION FAILED!")
        sys.exit(1)

    print("\n[SUCCESS] AUTOMATED VERIFICATION PASSED: EXACT 26/26 1-to-1 MATCH!")

    # 9. Verify Sample Metadata
    print("\n==================================================")
    print("STEP 9 — SAMPLE METADATA INSPECTION")
    print("==================================================")
    sample_indices = [0, 7, 15, 24]  # Check diverse samples
    for s_idx in sample_indices:
        if s_idx < len(chroma_ids):
            c_id = chroma_ids[s_idx]
            c_meta = new_data["metadatas"][s_idx]
            print(f"\nFaculty: {c_meta.get('name')}")
            print(f"  Chroma ID:           {c_id}")
            print(f"  Email:               {c_meta.get('email')}")
            print(f"  Department:          {c_meta.get('department')}")
            print(f"  Designation:         {c_meta.get('designation')}")
            print(f"  Qualification:       {c_meta.get('qualification')}")
            print(f"  Research Interests:  {c_meta.get('research_interests')[:80]}...")
            print(f"  Available:           {c_meta.get('available_for_projects')} (Max: {c_meta.get('max_students')})")

    print("\nSynchronization complete.")


if __name__ == "__main__":
    synchronize()
