"""
Merges bge_gemini_student_results.csv (25 queries) with
bge_gemini_missing_results.csv (5 queries, S017-S021) into a single,
complete 30-query result set, and recomputes summary metrics correctly
by averaging across all 30 individual rows (not averaging two summary
numbers, which would be mathematically wrong given the unequal batch sizes).

Run from apps/ai-service/research:
    python merge_gemini_results.py
"""

import csv
import statistics

MAIN_RESULTS = "results/bge_gemini_student_results.csv"
MISSING_RESULTS = "results/bge_gemini_missing_results.csv"
MERGED_OUTPUT = "results/bge_gemini_student_results_FULL.csv"
SUMMARY_OUTPUT = "results/bge_gemini_summary_FULL.csv"

METRIC_COLUMNS = ["Hit@1", "Hit@3", "Hit@5", "Recall@1", "Recall@3", "Recall@5", "MRR", "NDCG@5"]


def load_rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    main_rows = load_rows(MAIN_RESULTS)
    missing_rows = load_rows(MISSING_RESULTS)

    main_ids = {r["student_id"] for r in main_rows}
    missing_ids = {r["student_id"] for r in missing_rows}

    overlap = main_ids & missing_ids
    if overlap:
        print(f"WARNING: {len(overlap)} student_id(s) appear in BOTH files: {overlap}")
        print("These will be de-duplicated, keeping the version from the missing-queries file")
        print("(assumed to be the more recently generated / correct one).")
        main_rows = [r for r in main_rows if r["student_id"] not in overlap]

    merged_rows = main_rows + missing_rows
    merged_rows.sort(key=lambda r: r["student_id"])

    expected_ids = {f"S{str(i).zfill(3)}" for i in range(1, 31)}
    actual_ids = {r["student_id"] for r in merged_rows}
    missing_from_full_set = expected_ids - actual_ids
    if missing_from_full_set:
        print(f"WARNING: merged set is missing {len(missing_from_full_set)} expected queries: {sorted(missing_from_full_set)}")
    print(f"Merged total: {len(merged_rows)} queries")

    # Write merged per-query CSV
    with open(MERGED_OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(merged_rows[0].keys()))
        writer.writeheader()
        writer.writerows(merged_rows)
    print(f"Wrote {MERGED_OUTPUT}")

    # Recompute summary metrics correctly from all individual rows
    summary = {"system": "BGE + Gemini", "n_queries": len(merged_rows)}
    for metric in METRIC_COLUMNS:
        values = [float(r[metric]) for r in merged_rows]
        summary[metric] = round(statistics.mean(values), 4)

    with open(SUMMARY_OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(summary.keys()))
        writer.writeheader()
        writer.writerow(summary)
    print(f"Wrote {SUMMARY_OUTPUT}")

    print("\n=== FINAL 30-QUERY BGE+Gemini SUMMARY ===")
    for k, v in summary.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()