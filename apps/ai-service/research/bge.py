import os
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer


# ============================================================
# 1. LOAD DATA
# ============================================================

faculty = pd.read_csv("data/faculty_export.csv")
students = pd.read_csv("data/student_queries_filled.csv")

# Remove faculty entries without names
faculty = faculty.dropna(subset=["name"]).copy()

faculty["name_normalized"] = (
    faculty["name"]
    .astype(str)
    .str.strip()
    .str.lower()
)

# Build faculty profile text
faculty["text"] = (
    faculty["department"].fillna("").astype(str) + " " +
    faculty["researchInterests"].fillna("").astype(str) + " " +
    faculty["qualification"].fillna("").astype(str)
)


# ============================================================
# 2. LOAD BGE-SMALL
# ============================================================

print("Loading BGE-small model...")

model = SentenceTransformer(
    "BAAI/bge-small-en-v1.5"
)

print("Model loaded.")


# ============================================================
# 3. CREATE FACULTY EMBEDDINGS
# ============================================================

print("Creating faculty embeddings...")

faculty_embeddings = model.encode(
    faculty["text"].tolist(),
    normalize_embeddings=True,
    show_progress_bar=True
)


# ============================================================
# 4. NAME NORMALIZATION
# ============================================================

def normalize_name(name):
    return str(name).strip().lower()


def get_relevant_names(row):

    if pd.isna(row["relevant_faculty_names"]):
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

def hit_at_k(recommended, relevant, k):

    return int(
        any(name in relevant for name in recommended[:k])
    )


def recall_at_k(recommended, relevant, k):

    if not relevant:
        return 0.0

    retrieved = sum(
        1
        for name in recommended[:k]
        if name in relevant
    )

    return retrieved / len(relevant)


def reciprocal_rank(recommended, relevant):

    for rank, name in enumerate(recommended, start=1):

        if name in relevant:
            return 1 / rank

    return 0.0


def ndcg_at_k(recommended, relevant, k):

    relevance = [
        1 if name in relevant else 0
        for name in recommended[:k]
    ]

    if not any(relevance):
        return 0.0

    dcg = sum(
        rel / np.log2(rank + 1)
        for rank, rel in enumerate(relevance, start=1)
    )

    ideal = sorted(relevance, reverse=True)

    idcg = sum(
        rel / np.log2(rank + 1)
        for rank, rel in enumerate(ideal, start=1)
    )

    return dcg / idcg if idcg > 0 else 0.0


# ============================================================
# 6. RUN BGE RECOMMENDATIONS
# ============================================================

results = []

print("\nRunning BGE evaluation...\n")

for _, student in students.iterrows():

    query = str(student["student_profile"])

    # Encode student query
    query_embedding = model.encode(
        query,
        normalize_embeddings=True
    )

    # Because embeddings are normalized,
    # dot product = cosine similarity
    scores = np.dot(
        faculty_embeddings,
        query_embedding
    )

    # Rank highest similarity first
    ranked_indices = np.argsort(scores)[::-1]

    recommended_names = [
        faculty.iloc[i]["name_normalized"]
        for i in ranked_indices
    ]

    recommended_display_names = [
        faculty.iloc[i]["name"]
        for i in ranked_indices
    ]

    relevant = get_relevant_names(student)

    # Metrics
    hit1 = hit_at_k(
        recommended_names,
        relevant,
        1
    )

    hit3 = hit_at_k(
        recommended_names,
        relevant,
        3
    )

    hit5 = hit_at_k(
        recommended_names,
        relevant,
        5
    )

    recall1 = recall_at_k(
        recommended_names,
        relevant,
        1
    )

    recall3 = recall_at_k(
        recommended_names,
        relevant,
        3
    )

    recall5 = recall_at_k(
        recommended_names,
        relevant,
        5
    )

    mrr = reciprocal_rank(
        recommended_names,
        relevant
    )

    ndcg5 = ndcg_at_k(
        recommended_names,
        relevant,
        5
    )

    results.append({

        "student_id": student["student_id"],

        "Hit@1": hit1,
        "Hit@3": hit3,
        "Hit@5": hit5,

        "Recall@1": recall1,
        "Recall@3": recall3,
        "Recall@5": recall5,

        "MRR": mrr,
        "NDCG@5": ndcg5,

        "Top1": recommended_display_names[0],
        "Top2": recommended_display_names[1],
        "Top3": recommended_display_names[2],
        "Top4": recommended_display_names[3],
        "Top5": recommended_display_names[4],
    })


# ============================================================
# 7. RESULTS
# ============================================================

results_df = pd.DataFrame(results)

summary = {

    "Hit@1": results_df["Hit@1"].mean(),

    "Hit@3": results_df["Hit@3"].mean(),

    "Hit@5": results_df["Hit@5"].mean(),

    "Recall@1": results_df["Recall@1"].mean(),

    "Recall@3": results_df["Recall@3"].mean(),

    "Recall@5": results_df["Recall@5"].mean(),

    "MRR": results_df["MRR"].mean(),

    "NDCG@5": results_df["NDCG@5"].mean(),
}

summary_df = pd.DataFrame(
    list(summary.items()),
    columns=["Metric", "Score"]
)


# ============================================================
# 8. SAVE
# ============================================================

os.makedirs("results", exist_ok=True)

results_df.to_csv(
    "results/bge_student_results.csv",
    index=False
)

summary_df.to_csv(
    "results/bge_summary.csv",
    index=False
)


# ============================================================
# 9. PRINT
# ============================================================

print("\n==============================")
print("BGE-SMALL EVALUATION RESULTS")
print("==============================\n")

for metric, score in summary.items():

    print(
        f"{metric:<10}: {score:.4f}"
    )

print("\nDetailed results saved to:")

print("results/bge_student_results.csv")
print("results/bge_summary.csv")