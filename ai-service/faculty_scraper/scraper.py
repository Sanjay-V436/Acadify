import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
import time

HEADERS = {
    "User-Agent": "Mozilla/5.0"
}

FACULTY_LIST_URL = "https://www.amrita.edu/school/engineering/chennai/faculty/"


# -----------------------------------------
# Get all faculty profile links
# -----------------------------------------

def get_faculty_links():

    print("Getting faculty list...")

    response = requests.get(FACULTY_LIST_URL, headers=HEADERS)

    soup = BeautifulSoup(response.text, "lxml")

    links = []

    for a in soup.find_all("a", href=True):

        href = a["href"]

        if "/faculty/" in href:

            if href.startswith("/"):

                href = "https://www.amrita.edu" + href

            links.append(href)

    links = sorted(list(set(links)))

    print(f"Found {len(links)} faculty profiles.\n")

    return links


# -----------------------------------------
# Scrape one faculty profile
# -----------------------------------------

def scrape_faculty(url):

    print("Scraping:", url)

    response = requests.get(url, headers=HEADERS)

    soup = BeautifulSoup(response.text, "lxml")

    # -------------------
    # Name
    # -------------------

    name = ""

    name_tag = soup.find("h4", class_="fac-inner-name")

    if name_tag:
        name = name_tag.get_text(strip=True)

    # -------------------
    # Metadata block
    # -------------------

    meta = soup.find("div", class_="fac-inner-meta")

    email = ""

    designation = ""

    department = ""

    qualification = ""

    research_interest = ""

    orcid = ""

    if meta:

        # Email

        mail = meta.find("a", href=re.compile("^mailto:"))

        if mail:
            email = mail.get_text(strip=True)

        # ORCID

        for a in meta.find_all("a", href=True):

            if "orcid.org" in a["href"]:

                orcid = a["href"]

        # Entire text

        text = meta.get_text("\n", strip=True)

        lines = [i.strip() for i in text.split("\n") if i.strip()]

        # First line normally contains designation

        if len(lines):

            designation = lines[0]

        # Qualification

        m = re.search(
            r"Qualification:\s*(.*?)Research Interest:",
            text,
            re.S
        )

        if m:

            qualification = m.group(1).strip()

        # Research Interest

        m = re.search(
            r"Research Interest:\s*(.*)",
            text,
            re.S
        )

        if m:

            research_interest = m.group(1).strip()

    return {

        "name": name,

        "email": email,

        "designation": designation,

        "department": department,

        "qualification": qualification,

        "researchInterests": research_interest,

        "orcid": orcid,

        "profileUrl": url

    }


# -----------------------------------------
# Main
# -----------------------------------------

def main():

    links = get_faculty_links()

    faculty = []

    for link in links:

        try:

            data = scrape_faculty(link)

            faculty.append(data)

            time.sleep(1)

        except Exception as e:

            print(e)

    df = pd.DataFrame(faculty)

    df.to_csv("faculty_export.csv", index=False)

    print("\nDone!")

    print(df.head())

    print("\nSaved as faculty_export.csv")


if __name__ == "__main__":

    main()