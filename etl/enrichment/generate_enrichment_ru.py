import csv

INPUT_FILE = "etl/enrichment/universities_sample.csv"
OUTPUT_FILE = "etl/enrichment/universities_ru_enrichment.csv"


def generate_short(name, country):
    return f"{name} — университет в {country}, предлагающий качественное образование и международную академическую среду."


def generate_full(name, country):
    return (
        f"{name} — университет, расположенный в {country}, который предлагает современные образовательные программы "
        f"и ориентирован на подготовку студентов к международной карьере.\n\n"
        f"Он подойдёт студентам, которые ищут сочетание академического качества, практических навыков "
        f"и возможностей для дальнейшего профессионального роста."
    )


def generate_campus(name):
    return (
        f"Университет предлагает комфортную учебную среду с современной инфраструктурой, "
        f"включающей учебные корпуса, библиотеки и пространства для студентов."
    )


def generate_career(name):
    return (
        f"Выпускники {name} находят работу в международных компаниях, "
        f"государственном секторе и научных организациях."
    )


def generate_admission():
    return (
        "Для поступления обычно требуется подтверждение предыдущего образования, "
        "знание языка обучения и полный пакет документов."
    )


def generate_website(name):
    slug = name.lower().replace(" ", "").replace("'", "")
    return f"https://www.{slug}.edu"


def main():
    with open(INPUT_FILE, newline="", encoding="utf-8") as infile, \
         open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as outfile:

        reader = csv.DictReader(infile)

        fieldnames = [
            "id",
            "name",
            "country_code",
            "official_website",
            "short_description",
            "full_description",
            "founded_year",
            "total_students",
            "international_students_percent",
            "tuition_min",
            "tuition_max",
            "tuition_currency",
            "admission_requirements_summary",
            "campus_summary",
            "career_outcomes_summary",
        ]

        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            name = row["name"]
            country = row["country_code"]

            writer.writerow({
                "id": row["id"],
                "name": name,
                "country_code": country,
                "official_website": generate_website(name),
                "short_description": generate_short(name, country),
                "full_description": generate_full(name, country),
                "founded_year": "",
                "total_students": "",
                "international_students_percent": "",
                "tuition_min": "",
                "tuition_max": "",
                "tuition_currency": "",
                "admission_requirements_summary": generate_admission(),
                "campus_summary": generate_campus(name),
                "career_outcomes_summary": generate_career(name),
            })

    print("✅ enrichment CSV created:", OUTPUT_FILE)


if __name__ == "__main__":
    main()