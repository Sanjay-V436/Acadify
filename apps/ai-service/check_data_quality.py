"""
Data quality check for faculty_export.csv (scraped data).

Doesn't touch ChromaDB or BGE — just looks at the raw CSV and tells you,
honestly, how much usable content each faculty member actually has.
This is what decides whether a match will be meaningful or just noise.
"""

import csv


def parse_faculty_row(row: dict) -> dict:
    return {
        "name": (row.get("name") or "").strip(),
        "email": (row.get("email") or "").strip(),
        "designation": (row.get("designation") or "").strip(),
        "qualification": (row.get("qualification") or "").strip(),
        "research_interests": (row.get("researchInterests") or "").strip(),
    }


def quality_tier(faculty: dict) -> str:
    """
    Rough tiering of how usable a profile is for semantic matching.
    Research interests matter most — that's the strongest matching signal.
    """
    has_research = bool(faculty["research_interests"])
    has_qualification = bool(faculty["qualification"])

    if has_research:
        return "GOOD (has research interests)"
    elif has_qualification:
        return "WEAK (only qualification, no research interests)"
    else:
        return "THIN (designation only, almost nothing to match on)"


def main(csv_path: str):
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [parse_faculty_row(row) for row in reader if (row.get("name") or "").strip()]

    tiers = {"GOOD (has research interests)": [], "WEAK (only qualification, no research interests)": [], "THIN (designation only, almost nothing to match on)": []}

    for f in rows:
        tiers[quality_tier(f)].append(f["name"])

    total = len(rows)
    print(f"Total faculty rows: {total}\n")

    for tier, names in tiers.items():
        pct = round(100 * len(names) / total, 1) if total else 0
        print(f"{tier}: {len(names)} ({pct}%)")
        for name in names:
            print(f"   - {name}")
        print()


if __name__ == "__main__":
    main("faculty_scraper/faculty_export.csv")