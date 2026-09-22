import requests
import pandas as pd
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time
import re

BASE_URL = "https://www.amrita.edu"
FACULTY_PAGE = "https://www.amrita.edu/school/engineering/chennai/faculty/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/153.0.0.0 Safari/537.36"
    )
}

session = requests.Session()
session.headers.update(HEADERS)


def clean_text(text):
    if not text:
        return ""

    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ---------------------------------------------------------
# GET FACULTY PROFILE LINKS
# ---------------------------------------------------------

def get_faculty_links():

    print("Fetching Chennai faculty listing page...")

    response = session.get(FACULTY_PAGE, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    faculty = {}

    for item in soup.select(".fc-item"):

        name_tag = item.select_one(".fc-desc h6 a")

        if not name_tag:
            continue

        name = clean_text(name_tag.get_text())

        url = urljoin(
            BASE_URL,
            name_tag.get("href", "")
        )

        if url.rstrip("/") == f"{BASE_URL}/faculty":
            continue

        if not url.startswith(f"{BASE_URL}/faculty/"):
            continue

        faculty[url] = {
            "name": name
        }

    print(f"Found {len(faculty)} faculty profiles")

    return faculty


# ---------------------------------------------------------
# FIND VALUE AFTER A LABEL
# ---------------------------------------------------------

def extract_labeled_value(lines, label):

    label_lower = label.lower()

    for i, line in enumerate(lines):

        clean_line = clean_text(line)

        if clean_line.lower().startswith(label_lower):

            value = clean_line[len(label):].strip()

            if value:
                return value

            # Value may be on next line
            if i + 1 < len(lines):
                return clean_text(lines[i + 1])

    return ""


# ---------------------------------------------------------
# EXTRACT DESIGNATION + DEPARTMENT
# ---------------------------------------------------------

def extract_designation_department(lines, name):

    name_lower = name.lower()

    for i, line in enumerate(lines):

        clean_line = clean_text(line)

        if name_lower in clean_line.lower():

            # Usually the next meaningful line contains:
            # Designation, Department, School, Campus

            for j in range(i + 1, min(i + 5, len(lines))):

                candidate = clean_text(lines[j])

                if not candidate:
                    continue

                if candidate.lower().startswith("qualification"):
                    break

                if (
                    "department" in candidate.lower()
                    or "professor" in candidate.lower()
                    or "chairperson" in candidate.lower()
                    or "dean" in candidate.lower()
                    or "director" in candidate.lower()
                ):
                    return candidate

    return ""


# ---------------------------------------------------------
# DEPARTMENT
# ---------------------------------------------------------

def extract_department(text):

    if not text:
        return ""

    matches = re.findall(
        r"(Department of .*?)(?=\s*\||$)",
        text,
        re.IGNORECASE
    )

    departments = []

    for department in matches:

        department = clean_text(department)

        if department not in departments:
            departments.append(department)

    return " | ".join(departments)


# ---------------------------------------------------------
# DESIGNATION
# ---------------------------------------------------------

def extract_designation(text):

    if not text:
        return ""

    # Extract designation from the actual designation/department line
    patterns = [
        r"\bChairperson\b",
        r"\bProfessor\b",
        r"\bAssociate Professor\b",
        r"\bAssistant Professor\b",
        r"\bDean\b",
        r"\bDirector\b",
        r"\bHead\b",
    ]

    found = []

    # Important:
    # Search the actual line, not the entire webpage.

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:
            value = match.group(0)

            if value not in found:
                found.append(value)

    return " | ".join(found)


# ---------------------------------------------------------
# PUBLICATIONS
# ---------------------------------------------------------

def extract_publications(soup):

    publications = []

    # Actual Amrita faculty publication container
    publication_section = soup.select_one(".fac-pub")

    if not publication_section:
        return ""

    # Every publication is inside .pub-item
    for item in publication_section.select(".pub-item"):

        title_tag = item.select_one("h3 a")

        if not title_tag:
            continue

        title = clean_text(title_tag.get_text())

        if title and title not in publications:
            publications.append(title)

    return " | ".join(publications)


# ---------------------------------------------------------
# EXTRACT ONE PROFILE
# ---------------------------------------------------------

def extract_profile(url, listing_data):

    print(f"Scraping: {url}")

    try:

        response = session.get(
            url,
            timeout=30
        )

        response.raise_for_status()

        soup = BeautifulSoup(
            response.text,
            "html.parser"
        )

        # Text lines
        lines = [
            clean_text(x)
            for x in soup.get_text("\n").splitlines()
        ]

        lines = [
            x for x in lines if x
        ]

        name = listing_data["name"]

        # ---------------------------------------------
        # DESIGNATION + DEPARTMENT
        # ---------------------------------------------

        designation_department = extract_designation_department(
            lines,
            name
        )

        department = extract_department(
            designation_department
        )

        designation = extract_designation(
            designation_department
        )

        # ---------------------------------------------
        # QUALIFICATION
        # ---------------------------------------------

        qualification = extract_labeled_value(
            lines,
            "Qualification:"
        )

        # ---------------------------------------------
        # RESEARCH INTERESTS
        # ---------------------------------------------

        research_interests = extract_labeled_value(
            lines,
            "Research Interest:"
        )

        # ---------------------------------------------
        # EMAIL
        # ---------------------------------------------

        email = ""

        email_match = re.search(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
            response.text
        )

        if email_match:
            email = email_match.group(0)

        # ---------------------------------------------
        # ORCID
        # ---------------------------------------------

        orcid = ""

        for a in soup.find_all("a", href=True):

            href = a["href"]

            if "orcid.org" in href.lower():

                orcid = href
                break

        # ---------------------------------------------
        # PUBLICATIONS
        # ---------------------------------------------

        publications = extract_publications(
            soup
        )

        return {
            "name": name,
            "department": department,
            "designation": designation,
            "qualification": qualification,
            "research_interests": research_interests,
            "publications": publications,
            "email": email,
            "orcid": orcid,
            "profile_url": url,
        }

    except Exception as e:

        print(f"ERROR: {url}")
        print(e)

        return None


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    faculty = get_faculty_links()

    results = []

    for url, listing_data in faculty.items():

        profile = extract_profile(
            url,
            listing_data
        )

        if profile:
            results.append(profile)

        time.sleep(1)

    df = pd.DataFrame(
        results,
        columns=[
            "name",
            "department",
            "designation",
            "qualification",
            "research_interests",
            "publications",
            "email",
            "orcid",
            "profile_url",
        ]
    )

    df.to_csv(
        "faculty_dataset.csv",
        index=False,
        encoding="utf-8-sig"
    )

    print("\n" + "=" * 60)
    print("SCRAPING COMPLETE")
    print("=" * 60)

    print(f"Faculty profiles scraped: {len(df)}")

    print("\nColumns:")
    print(", ".join(df.columns))

    print("\nResearch interests found:",
          df["research_interests"].notna().sum())

    print("Publications found:",
          df["publications"].notna().sum())


if __name__ == "__main__":
    main()