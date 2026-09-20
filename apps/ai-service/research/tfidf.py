import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

faculty = pd.read_csv("data/faculty_export.csv")
students = pd.read_csv("data/student_queries_filled.csv")

# Combine faculty information
faculty["text"] = (
    faculty["department"].fillna("") + " " +
    faculty["researchInterests"].fillna("") + " " +
    faculty["qualification"].fillna("")
)

vectorizer = TfidfVectorizer(
    stop_words="english",
    ngram_range=(1, 2)
)

faculty_vectors = vectorizer.fit_transform(faculty["text"])


def recommend(student_profile, top_k=5):
    student_vector = vectorizer.transform([student_profile])

    scores = cosine_similarity(
        student_vector,
        faculty_vectors
    )[0]

    top_indices = np.argsort(scores)[::-1][:top_k]

    return [
        {
            "faculty_index": int(i),
            "faculty_name": faculty.iloc[i]["name"],
            "score": float(scores[i])
        }
        for i in top_indices
    ]


if __name__ == "__main__":

    for _, student in students.iterrows():

        recommendations = recommend(
            student["student_profile"],
            top_k=5
        )

        print("\n" + "=" * 60)
        print(student["student_id"])
        print(student["student_profile"])
        print("=" * 60)

        for rank, rec in enumerate(recommendations, 1):
            print(
                f"{rank}. {rec['faculty_name']} "
                f"({rec['score']:.4f})"
            )