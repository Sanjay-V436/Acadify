import os
import pandas as pd
import chromadb
from sentence_transformers import SentenceTransformer

COLLECTION_NAME = "faculty_profiles_pub_v1"

CSV_FILE = "faculty_dataset.csv"

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))

print("Loading faculty dataset...")

df = pd.read_csv(CSV_FILE)

# Replace missing values
df = df.fillna("")

print(f"Faculty records loaded: {len(df)}")

# ---------------------------------------------------------
# Load BGE-Small
# ---------------------------------------------------------

print("Loading BGE-Small...")

model = SentenceTransformer(
    "BAAI/bge-small-en-v1.5"
)

print("Model loaded.")

# ---------------------------------------------------------
# Connect to ChromaDB
# ---------------------------------------------------------

print(
    f"Connecting to ChromaDB at "
    f"{CHROMA_HOST}:{CHROMA_PORT}..."
)

client = chromadb.HttpClient(
    host=CHROMA_HOST,
    port=CHROMA_PORT
)

# ---------------------------------------------------------
# Create / recreate research collection
# ---------------------------------------------------------

try:
    client.delete_collection(COLLECTION_NAME)
    print(f"Deleted existing collection: {COLLECTION_NAME}")
except Exception:
    pass

collection = client.create_collection(
    name=COLLECTION_NAME,
    metadata={
        "description": "Faculty profiles with research interests and publications"
    }
)

print(f"Created collection: {COLLECTION_NAME}")

# ---------------------------------------------------------
# Prepare faculty documents
# ---------------------------------------------------------

documents = []
metadatas = []
ids = []

for index, row in df.iterrows():

    name = str(row["name"]).strip()
    department = str(row["department"]).strip()
    designation = str(row["designation"]).strip()
    qualification = str(row["qualification"]).strip()
    research_interests = str(row["research_interests"]).strip()
    publications = str(row["publications"]).strip()
    email = str(row["email"]).strip()
    orcid = str(row["orcid"]).strip()
    profile_url = str(row["profile_url"]).strip()

    # Skip completely empty faculty records
    if not name:
        continue

    # -----------------------------------------------------
    # Build semantic document
    # -----------------------------------------------------

    parts = []

    if designation:
        parts.append(f"Designation: {designation}")

    if department:
        parts.append(f"Department: {department}")

    if qualification:
        parts.append(f"Qualification: {qualification}")

    if research_interests:
        parts.append(
            f"Research Interests: {research_interests}"
        )

    if publications:
        parts.append(
            f"Publications: {publications}"
        )

    document = "\n".join(parts)

    if not document:
        continue

    documents.append(document)

    # Chroma metadata must contain primitive values
    metadatas.append({
        "name": name,
        "department": department,
        "designation": designation,
        "qualification": qualification,
        "research_interests": research_interests,
        "publications": publications,
        "email": email,
        "orcid": orcid,
        "profile_url": profile_url,
    })

    # Unique Chroma ID
    ids.append(f"faculty_pub_{index}")

# ---------------------------------------------------------
# Generate embeddings
# ---------------------------------------------------------

print(
    f"Generating embeddings for "
    f"{len(documents)} faculty profiles..."
)

embeddings = model.encode(
    documents,
    normalize_embeddings=True,
    show_progress_bar=True
)

# ---------------------------------------------------------
# Insert into ChromaDB
# ---------------------------------------------------------

collection.add(
    ids=ids,
    documents=documents,
    embeddings=embeddings.tolist(),
    metadatas=metadatas,
)

# ---------------------------------------------------------
# Verify
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("SEEDING COMPLETE")
print("=" * 60)

print("Collection:", COLLECTION_NAME)
print("Documents:", collection.count())

# Show one example
if collection.count() > 0:

    result = collection.get(
        ids=[ids[0]]
    )

    print("\nExample faculty:")
    print(result["metadatas"][0])

    print("\nDocument:")
    print(result["documents"][0][:1000])