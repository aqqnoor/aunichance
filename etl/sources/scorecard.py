import requests
from config import COLLEGE_SCORECARD_API_KEY

BASE_URL = "https://api.data.gov/ed/collegescorecard/v1/schools"

FIELDS = ",".join([
    "id",
    "school.name",
    "school.city",
    "school.state",
    "school.school_url",
    "latest.admissions.admission_rate.overall",
    "latest.cost.tuition.in_state",
    "latest.cost.tuition.out_of_state",
    "latest.student.size",
])

def fetch_scorecard(page: int = 0, per_page: int = 100) -> dict:
    resp = requests.get(
        BASE_URL,
        params={
            "api_key": COLLEGE_SCORECARD_API_KEY,
            "fields": FIELDS,
            "page": page,
            "per_page": per_page,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()

def fetch_all_scorecard() -> list[dict]:
    results = []
    page = 0

    while True:
        payload = fetch_scorecard(page=page, per_page=100)
        batch = payload.get("results", [])
        if not batch:
            break

        for item in batch:
            results.append({
                "external_source": "college_scorecard",
                "external_id": str(item.get("id")),
                "name": item.get("school.name"),
                "country_code": "US",
                "city": item.get("school.city"),
                "website": item.get("school.school_url"),
                "admission_rate": item.get("latest.admissions.admission_rate.overall"),
                "tuition_in_state": item.get("latest.cost.tuition.in_state"),
                "tuition_out_of_state": item.get("latest.cost.tuition.out_of_state"),
                "student_size": item.get("latest.student.size"),
            })

        page += 1

    return results