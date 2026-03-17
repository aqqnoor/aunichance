import uuid

def normalize_universities(hipolabs_rows: list[dict], scorecard_rows: list[dict]) -> list[dict]:
    merged = {}

    for row in hipolabs_rows:
        key = (row["name"].strip().lower(), row["country_code"])
        merged[key] = {
            "id": str(uuid.uuid4()),
            "name": row["name"],
            "country_code": row["country_code"],
            "city": row.get("city"),
            "website": row.get("website"),
            "qs_rank": row.get("qs_rank"),
            "the_rank": row.get("the_rank"),
            "source": row.get("external_source"),
        }

    for row in scorecard_rows:
        key = (row["name"].strip().lower(), "US")
        if key not in merged:
            merged[key] = {
                "id": str(uuid.uuid4()),
                "name": row["name"],
                "country_code": "US",
                "city": row.get("city"),
                "website": row.get("website"),
                "qs_rank": None,
                "the_rank": None,
                "source": row.get("external_source"),
            }
        else:
            merged[key]["city"] = merged[key]["city"] or row.get("city")
            merged[key]["website"] = merged[key]["website"] or row.get("website")
            merged[key]["source"] = "hipolabs+scorecard"

    return list(merged.values())