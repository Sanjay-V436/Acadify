"""
Generates a bar chart comparing TF-IDF, BGE-small, and BGE+Gemini across
the key metrics, using the actual summary CSVs already produced.

Run from apps/ai-service/research:
    python make_comparison_chart.py
Output: results/system_comparison_chart.png
"""

import csv
import matplotlib.pyplot as plt

TFIDF_SUMMARY = "results/tfidf_summary.csv"
BGE_SUMMARY = "results/bge_summary.csv"
GEMINI_SUMMARY = "results/bge_gemini_summary_FULL.csv"

# Metrics to show on the chart — kept to the ones most meaningful for a
# single readable bar chart. Full numbers still live in the CSVs/table.
CHART_METRICS = ["Hit@1", "Hit@3", "Hit@5", "MRR", "NDCG@5"]


def load_summary(path):
    with open(path, newline="", encoding="utf-8") as f:
        row = next(csv.DictReader(f))
    return row


def main():
    tfidf = load_summary(TFIDF_SUMMARY)
    bge = load_summary(BGE_SUMMARY)
    gemini = load_summary(GEMINI_SUMMARY)

    systems = ["TF-IDF", "BGE-small", "BGE + Gemini"]
    data = [tfidf, bge, gemini]

    x = range(len(CHART_METRICS))
    width = 0.25

    fig, ax = plt.subplots(figsize=(10, 6))

    colors = ["#B0B0B0", "#6BA3D6", "#8B1E3F"]  # neutral, blue, Acadify maroon accent

    for i, (system_name, row) in enumerate(zip(systems, data)):
        values = [float(row[m]) for m in CHART_METRICS]
        offset = (i - 1) * width
        bars = ax.bar([xi + offset for xi in x], values, width, label=system_name, color=colors[i])
        # Value labels on top of each bar
        for bar, val in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width() / 2, val + 0.015, f"{val:.2f}",
                    ha="center", va="bottom", fontsize=8)

    ax.set_xticks(list(x))
    ax.set_xticklabels(CHART_METRICS)
    ax.set_ylabel("Score")
    ax.set_ylim(0, 1.05)
    ax.set_title("Mentor Recommendation — System Comparison (30 queries)")
    ax.legend()
    ax.grid(axis="y", linestyle="--", alpha=0.3)

    plt.tight_layout()
    plt.savefig("results/system_comparison_chart.png", dpi=150)
    print("Wrote results/system_comparison_chart.png")


if __name__ == "__main__":
    main()