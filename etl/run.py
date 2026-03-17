from config import ETL_COUNTRIES
from sources.hipolabs import fetch_hipolabs
from sources.scorecard import fetch_all_scorecard
from transforms.normalize_universities import normalize_universities
from loaders.upsert_universities import upsert_universities

def main():
    hipolabs_rows = []
    for code in ETL_COUNTRIES:
        if code == "US":
            hipolabs_rows.extend(fetch_hipolabs("US"))
        else:
            hipolabs_rows.extend(fetch_hipolabs(code))

    scorecard_rows = fetch_all_scorecard() if "US" in ETL_COUNTRIES else []

    universities = normalize_universities(hipolabs_rows, scorecard_rows)
    upsert_universities(universities)

    print(f"Imported universities: {len(universities)}")

if __name__ == "__main__":
    main()