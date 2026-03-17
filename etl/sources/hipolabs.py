import requests

BASE_URL = "http://universities.hipolabs.com/search"

COUNTRY_MAP = {
    "US": "United States",
    "DE": "Germany",
    "GB": "United Kingdom",
    "FR": "France",
    "NL": "Netherlands",
    "CA": "Canada",
    "AU": "Australia",
}

def fetch_hipolabs(country_code: str) -> list[dict]:
    country_name = COUNTRY_MAP.get(country_code)
    if not country_name:
        return []

    resp = requests.get(BASE_URL, params={"country": country_name}, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    result = []
    for item in data:
        result.append({
            "external_source": "hipolabs",
            "name": item.get("name"),
            "country_code": country_code,
            "city": None,
            "website": (item.get("web_pages") or [None])[0],
            "qs_rank": None,
            "the_rank": None,
        })
    return result