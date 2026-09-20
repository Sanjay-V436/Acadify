import os
import json
import time
import re
import pandas as pd
import numpy as np

from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from google import genai


# ============================================================
# 1. LOAD ENVIRONMENT
# ============================================================

load_dotenv("../.env")

api_key = os.getenv("GEMINI_API_KEY_1")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY_1 not found in apps/ai-service/.env"
    )

gemini_model = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.5-flash-lite"
)

client = genai.Client(api_key=api_key)


# ============================================================
# 2. LOAD DATA
# ============================================================

faculty = pd.read_csv(
    "data/faculty_export.csv"
)

students = pd.read_csv(
    "data/student_queries_filled.csv"
)

# Remove invalid faculty names
faculty = faculty.dropna(
    subset=["name"]
).copy()

faculty["name_normalized"] = (
    faculty["name"]
    .astype(str)
    .str.strip()
    .str.lower()
)

# Faculty text used by BGE
faculty["text"] = (
    faculty["department"]
    .fillna("")
    .astype(str)
    + " "
    +
    faculty["researchInterests"]
    .fillna("")
    .astype(str)
    + " "
    +
    faculty["qualification"]
    .fillna("")
    .astype(str)
)


# ============================================================
# 3. LOAD BGE-SMALL
# ============================================================

print("Loading BGE-small...")

model = SentenceTransformer(
    "BAAI/bge-small-en-v1.5"
)

print("Creating faculty embeddings...")

faculty_embeddings = model.encode(
    faculty["text"].tolist(),
    normalize_embeddings=True,
    show_progress_bar=True
)


# ============================================================
# 4. HELPERS
# ============================================================

def normalize_name(name):
    return str(name).strip().lower()


def get_relevant_names(row):

    if pd.isna(
        row["relevant_faculty_names"]
    ):
        return set()

    names = str(
        row["relevant_faculty_names"]
    ).split("|")

    return {
        normalize_name(name)
        for name in names
        if name.strip()
    }


# ============================================================
# 5. METRICS
# ============================================================

def hit_at_k(
    recommended,
    relevant,
    k
):

    return int(
        any(
            name in relevant
            for name in recommended[:k]
        )
    )


def recall_at_k(
    recommended,
    relevant,
    k
):

    if not relevant:
        return 0.0

    retrieved = sum(
        name in relevant
        for name in recommended[:k]
    )

    return retrieved / len(relevant)


def reciprocal_rank(
    recommended,
    relevant
):

    for rank, name in enumerate(
        recommended,
        start=1
    ):

        if name in relevant:
            return 1 / rank

    return 0.0


def ndcg_at_k(
    recommended,
    relevant,
    k
):

    relevance = [
        1 if name in relevant else 0
        for name in recommended[:k]
    ]

    if not any(relevance):
        return 0.0

    dcg = sum(
        rel / np.log2(rank + 1)
        for rank, rel in enumerate(
            relevance,
            start=1
        )
    )

    ideal = sorted(
        relevance,
        reverse=True
    )

    idcg = sum(
        rel / np.log2(rank + 1)
        for rank, rel in enumerate(
            ideal,
            start=1
        )
    )

    return (
        dcg / idcg
        if idcg > 0
        else 0.0
    )


# ============================================================
# 6. GEMINI RE-RANKING
# ============================================================

def rerank_with_gemini(
    student_profile,
    candidates
):

    candidate_text = ""

    for i, candidate in enumerate(
        candidates,
        start=1
    ):

        candidate_text += f"""

Candidate {i}
Faculty Name: {candidate['name']}
Department: {candidate['department']}
Qualification: {candidate['qualification']}
Research Interests: {candidate['researchInterests']}
BGE Similarity: {candidate['bge_score']:.4f}

"""

    prompt = f"""
You are a faculty recommendation ranking system.

Student project/profile:
{student_profile}

The following faculty members were retrieved by BGE-small:

{candidate_text}

Re-rank ALL candidates according to their relevance
to the student's project.

Consider:

1. Technical skill overlap
2. Research/domain overlap
3. Project requirements
4. Research interests
5. Department relevance

Rules:

- Use ONLY the supplied candidates.
- Do not introduce new faculty.
- Include every candidate exactly once.
- Rank from most relevant to least relevant.
- Return ONLY valid JSON.

Required format:

{{
    "ranking": [
        {{
            "faculty_name": "exact faculty name",
            "reason": "short reason"
        }}
    ]
}}
"""

    # --------------------------------------------------------
    # Retry handling for rate limits
    # --------------------------------------------------------

    while True:

        try:

            response = client.models.generate_content(
                model=gemini_model,
                contents=prompt,
                config={
                    "temperature": 0.1,
                    "response_mime_type": "application/json"
                }
            )

            data = json.loads(
                response.text
            )

            return data["ranking"]

        except Exception as e:

            error_text = str(e)

            # Detect Gemini 429
            if (
                "429" in error_text
                or "RESOURCE_EXHAUSTED"
                in error_text
            ):

                # Try to extract retry seconds
                match = re.search(
                    r"retry in ([0-9.]+)s",
                    error_text,
                    re.IGNORECASE
                )

                if match:

                    wait_time = (
                        float(match.group(1))
                        + 5
                    )

                else:

                    wait_time = 65

                print(
                    f"\nGemini quota reached."
                )

                print(
                    f"Waiting {wait_time:.0f} seconds..."
                )

                time.sleep(
                    wait_time
                )

                print(
                    "Retrying..."
                )

            else:

                raise e


# ============================================================
# 7. ONLY PROCESS MISSING QUERIES
# ============================================================

TARGET_STUDENTS = {
    "S017",
    "S018",
    "S019",
    "S020",
    "S021"
}

students_to_process = students[
    students["student_id"]
    .astype(str)
    .isin(TARGET_STUDENTS)
].copy()


print(
    "\n===================================="
)

print(
    "BGE + GEMINI MISSING QUERIES"
)

print(
    "===================================="
)

print(
    f"Queries to process: "
    f"{len(students_to_process)}"
)

print(
    "Students: "
    + ", ".join(
        students_to_process[
            "student_id"
        ].astype(str)
    )
)

print()


# ============================================================
# 8. RESULTS FILE
# ============================================================

os.makedirs(
    "results",
    exist_ok=True
)

output_file = (
    "results/"
    "bge_gemini_missing_results.csv"
)


# ============================================================
# 9. PROCESS STUDENTS
# ============================================================

results = []

for _, student in students_to_process.iterrows():

    student_id = str(
        student["student_id"]
    )

    print(
        f"Processing {student_id}..."
    )

    query = str(
        student["student_profile"]
    )

    # --------------------------------------------------------
    # BGE retrieval
    # --------------------------------------------------------

    query_embedding = model.encode(
        query,
        normalize_embeddings=True
    )

    scores = np.dot(
        faculty_embeddings,
        query_embedding
    )

    # Top 10 BGE candidates
    ranked_indices = np.argsort(
        scores
    )[::-1][:10]

    candidates = []

    for index in ranked_indices:

        row = faculty.iloc[index]

        candidates.append({

            "name": row["name"],

            "department":
                row["department"],

            "qualification":
                row["qualification"],

            "researchInterests":
                row["researchInterests"],

            "bge_score":
                float(scores[index])
        })

    # --------------------------------------------------------
    # Gemini
    # --------------------------------------------------------

    try:

        gemini_ranking = (
            rerank_with_gemini(
                query,
                candidates
            )
        )

    except Exception as e:

        print(
            f"ERROR for {student_id}: {e}"
        )

        continue

    # --------------------------------------------------------
    # Validate Gemini output
    # --------------------------------------------------------

    if not gemini_ranking:

        print(
            f"Empty Gemini ranking "
            f"for {student_id}"
        )

        continue

    recommended_names = [
        normalize_name(
            item["faculty_name"]
        )
        for item in gemini_ranking
    ]

    recommended_display_names = [
        item["faculty_name"]
        for item in gemini_ranking
    ]

    relevant = get_relevant_names(
        student
    )

    # --------------------------------------------------------
    # Metrics
    # --------------------------------------------------------

    result = {

        "student_id":
            student_id,

        "Hit@1":
            hit_at_k(
                recommended_names,
                relevant,
                1
            ),

        "Hit@3":
            hit_at_k(
                recommended_names,
                relevant,
                3
            ),

        "Hit@5":
            hit_at_k(
                recommended_names,
                relevant,
                5
            ),

        "Recall@1":
            recall_at_k(
                recommended_names,
                relevant,
                1
            ),

        "Recall@3":
            recall_at_k(
                recommended_names,
                relevant,
                3
            ),

        "Recall@5":
            recall_at_k(
                recommended_names,
                relevant,
                5
            ),

        "MRR":
            reciprocal_rank(
                recommended_names,
                relevant
            ),

        "NDCG@5":
            ndcg_at_k(
                recommended_names,
                relevant,
                5
            ),

        "Top1":
            recommended_display_names[0]
            if len(recommended_display_names) > 0
            else "",

        "Top2":
            recommended_display_names[1]
            if len(recommended_display_names) > 1
            else "",

        "Top3":
            recommended_display_names[2]
            if len(recommended_display_names) > 2
            else "",

        "Top4":
            recommended_display_names[3]
            if len(recommended_display_names) > 3
            else "",

        "Top5":
            recommended_display_names[4]
            if len(recommended_display_names) > 4
            else "",
    }

    results.append(result)

    # --------------------------------------------------------
    # SAVE IMMEDIATELY
    # --------------------------------------------------------

    pd.DataFrame(results).to_csv(
        output_file,
        index=False
    )

    print(
        f"Saved {student_id}"
    )

    # --------------------------------------------------------
    # Wait before next Gemini request
    # --------------------------------------------------------

    print(
        "Waiting 5 seconds..."
    )

    time.sleep(5)


# ============================================================
# 10. PRINT RESULTS
# ============================================================

if not results:

    print(
        "\nNo successful Gemini results."
    )

    print(
        "Check your API quota/key."
    )

    exit()


results_df = pd.DataFrame(
    results
)

print(
    "\n===================================="
)

print(
    "MISSING QUERY RESULTS"
)

print(
    "====================================\n"
)

for metric in [
    "Hit@1",
    "Hit@3",
    "Hit@5",
    "Recall@1",
    "Recall@3",
    "Recall@5",
    "MRR",
    "NDCG@5"
]:

    print(
        f"{metric:<10}: "
        f"{results_df[metric].mean():.4f}"
    )

print(
    "\nSaved to:"
)

print(
    output_file
)

print(
    "\nThese are ONLY S017-S021."
)

print(
    "We will merge them with the previous "
    "successful 25 queries afterward."
)