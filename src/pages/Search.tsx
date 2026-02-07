import { useState, useEffect } from "react";
import { apiGet, apiPost } from "../lib/api";
import { Link } from "react-router-dom";
import { ScoreResult } from "../types";

type ProgramDTO = {
  id: string;
  university_id: string; 
  title: string;
  degree_level: string; // "bachelor" | "master"
  field: string;
  language: string;
  tuition_amount?: number;
  tuition_currency?: string;
  has_scholarship: boolean;
  scholarship_type?: string | null;
  scholarship_percent_min?: number | null;
  scholarship_percent_max?: number | null;
  university_name: string;
  country_code: string; // "DE" etc
  city?: string;
  qs_rank?: number;
  the_rank?: number;
  
};

interface SearchFilters {
  query: string;
  country: string; // expects "DE,US" etc OR single "DE"
  city: string; // MVP: backend-та фильтр жоқ болса, UI-да қалдырамыз бірақ request-ке қоспаймыз
  region: string; // MVP: backend-та фильтр жоқ болса, request-ке қоспаймыз
  field_of_study: string; // MVP: backend-та "fields" болса ғана қосамыз
  degree_level: string; // "Bachelor" | "Master" | ""
  language: string; // MVP: backend-та фильтр жоқ болса, request-ке қоспаймыз
  min_tuition: string;
  max_tuition: string;
  has_scholarship: boolean;
  deadline_before: string; // MVP: жоқ
}

function normalizeLevel(uiLevel: string): string {
  if (uiLevel === "Bachelor") return "bachelor";
  if (uiLevel === "Master") return "master";
  return "";
}

export default function Search() {
  const [results, setResults] = useState<ProgramDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [scores, setScores] = useState<Record<string, ScoreResult>>({});
  const [loadingScores, setLoadingScores] = useState<Record<string, boolean>>({});


  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    country: "",
    city: "",
    region: "",
    field_of_study: "",
    degree_level: "",
    language: "",
    min_tuition: "",
    max_tuition: "",
    has_scholarship: false,
    deadline_before: "",
  });

  const [showFilters, setShowFilters] = useState(false);

  const regionToCountries: Record<string, string> = {
  USA: "US",
  UK: "GB",
  Europe: "DE,FR",
  Canada: "CA",
  Australia: "AU",
  Other: "",
};


  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // Backend expects: q, countries, levels, min_tuition, max_tuition, scholarship, page, limit
      if (filters.query) params.set("q", filters.query.trim());
      // countries: manual OR from region OR MVP default
      let countries = (filters.country || "").replace(/\s+/g, "");

      if (!countries && filters.region) {
        countries = regionToCountries[filters.region] || "";
      }


// MVP default (сен бекіткен): DE/US/GB/FR
if (!countries) {
  countries = "DE,US,GB,FR";
}

params.set("countries", countries);


      const lvl = normalizeLevel(filters.degree_level);
      if (lvl) params.set("levels", lvl);

      if (filters.city && filters.city.trim() !== "") {
        params.set("city", filters.city.trim());
      }

      if (filters.field_of_study && filters.field_of_study.trim() !== "") {
        // backend-go expects "fields"
        params.set("fields", filters.field_of_study.trim());
      }

      if (filters.language && filters.language !== "Все языки") {
        // сенің dropdown value "Все языки" болуы мүмкін
        params.set("language", filters.language);
      }


      if (filters.min_tuition) params.set("min_tuition", filters.min_tuition);
      if (filters.max_tuition) params.set("max_tuition", filters.max_tuition);

      if (filters.has_scholarship) params.set("scholarship", "true");

      // MVP defaults
      params.set("page", "1");
      params.set("limit", "20");

      const url = `/programs?${params.toString()}`;
      console.log("Request:", url);

      const data = await apiGet<{ items: ProgramDTO[]; total?: number }>(url);

      console.log("API items:", data.items?.length, data);

      console.log("Request:", `/programs?${params.toString()}`);

      const programs = data.items || [];
      setResults(programs);

      // Load scores for all programs (if user is authenticated)
      loadScoresForPrograms(programs);
    } catch (error) {
      console.error("Search error:", error);
      setErrorMsg(error instanceof Error ? error.message : String(error));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const loadScoresForPrograms = async (programs: ProgramDTO[]) => {
    // Check if user is authenticated
    const token = localStorage.getItem("token");
    if (!token) {
      return; // User not authenticated, skip scoring
    }

    // Filter programs that need scores
    const programsToScore = programs.filter(
      (p) => !scores[p.id] && !loadingScores[p.id]
    );

    if (programsToScore.length === 0) {
      return;
    }

    // Mark as loading
    const loadingMap: Record<string, boolean> = {};
    programsToScore.forEach((p) => {
      loadingMap[p.id] = true;
    });
    setLoadingScores((prev) => ({ ...prev, ...loadingMap }));

    // Load scores in parallel
    const scorePromises = programsToScore.map(async (program) => {
      try {
        const scoreData = await apiPost<ScoreResult>("/score", {
          program_id: program.id,
        });
        return { programId: program.id, score: scoreData };
      } catch (error) {
        // Profile might not exist, or other error - silently fail
        console.debug("Score not available for program", program.id, error);
        return null;
      }
    });

    const results = await Promise.all(scorePromises);
    
    // Update scores
    const newScores: Record<string, ScoreResult> = {};
    results.forEach((result) => {
      if (result) {
        newScores[result.programId] = result.score;
      }
    });
    setScores((prev) => ({ ...prev, ...newScores }));

    // Clear loading state
    setLoadingScores((prev) => {
      const next = { ...prev };
      programsToScore.forEach((p) => {
        delete next[p.id];
      });
      return next;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Поиск университетов и программ
      </h1>

      <div className="card mb-6">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Поиск по названию университета или программы..."
            value={filters.query}
            onChange={(e) => handleFilterChange("query", e.target.value)}
            className="input-field flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button onClick={handleSearch} className="btn-primary">
            Поиск
          </button>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
        >
          {showFilters ? "Скрыть фильтры" : "Показать фильтры"}{" "}
          {showFilters ? "▲" : "▼"}
        </button>

        {showFilters && (
          <div className="mt-4 grid md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Страна
              </label>
              <input
                type="text"
                value={filters.country}
                onChange={(e) => handleFilterChange("country", e.target.value)}
                className="input-field"
                placeholder="DE, US, GB..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Используй country code: DE, US, GB, FR, IT...
              </p>
            </div>

            {/* Қалдырдық, бірақ MVP-де backend-та жоқ болса request-ке қоспаймыз */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Город
              </label>
              <input
                type="text"
                value={filters.city}
                onChange={(e) => handleFilterChange("city", e.target.value)}
                className="input-field"
                placeholder="Boston, London..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Регион
              </label>
              <select
                value={filters.region}
                onChange={(e) => handleFilterChange("region", e.target.value)}
                className="input-field"
              >
                <option value="">Все регионы</option>
                <option value="USA">США</option>
                <option value="UK">Великобритания</option>
                <option value="Europe">Европа</option>
                <option value="Canada">Канада</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Направление
              </label>
              <input
                type="text"
                value={filters.field_of_study}
                onChange={(e) =>
                  handleFilterChange("field_of_study", e.target.value)
                }
                className="input-field"
                placeholder="Computer Science, Business..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Уровень
              </label>
              <select
                value={filters.degree_level}
                onChange={(e) =>
                  handleFilterChange("degree_level", e.target.value)
                }
                className="input-field"
              >
                <option value="">Все уровни</option>
                <option value="Bachelor">Бакалавр</option>
                <option value="Master">Магистр</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Язык
              </label>
              <select
                value={filters.language}
                onChange={(e) => handleFilterChange("language", e.target.value)}
                className="input-field"
              >
                <option value="">Все языки</option>
                <option value="EN">English</option>
                <option value="DE">German</option>
                <option value="FR">French</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Мин. стоимость
              </label>
              <input
                type="number"
                value={filters.min_tuition}
                onChange={(e) =>
                  handleFilterChange("min_tuition", e.target.value)
                }
                className="input-field"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Макс. стоимость
              </label>
              <input
                type="number"
                value={filters.max_tuition}
                onChange={(e) =>
                  handleFilterChange("max_tuition", e.target.value)
                }
                className="input-field"
                placeholder="100000"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.has_scholarship}
                  onChange={(e) =>
                    handleFilterChange("has_scholarship", e.target.checked)
                  }
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Только со стипендиями
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
      
      {errorMsg && (
        <div className="mt-3 p-3 rounded border border-red-300 bg-red-50 text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-600">Загрузка...</div>
        </div>
      ) : results.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">
            Результаты не найдены. Попробуйте изменить фильтры.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <ProgramCard 
              key={result.id} 
              result={result} 
              score={scores[result.id]}
              loadingScore={loadingScores[result.id]}
            />
          ))}
          
        </div>
      )}
    </div>
  );
}

function ProgramCard({ 
  result, 
  score, 
  loadingScore 
}: { 
  result: ProgramDTO;
  score?: ScoreResult;
  loadingScore?: boolean;
}) {
  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "reach":
        return "bg-red-100 text-red-800 border-red-300";
      case "target":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "safety":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case "reach":
        return "Reach";
      case "target":
        return "Target";
      case "safety":
        return "Safety";
      default:
        return "";
    }
  };

  return (
    <div className="card">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xl font-bold text-gray-900">
              {result.title}
            </h3>
            {score && (
              <div className="flex flex-col items-end gap-1 ml-4">
                <div className={`px-4 py-2 rounded-lg border-2 font-bold text-lg ${getCategoryColor(score.category)}`}>
                  {score.score}%
                </div>
                <span className="text-xs font-medium text-gray-600">
                  {getCategoryLabel(score.category)}
                </span>
              </div>
            )}
            {loadingScore && (
              <div className="px-4 py-2 rounded-lg border-2 border-gray-300 bg-gray-50 text-gray-600 text-sm">
                Загрузка...
              </div>
            )}
          </div>

          <p className="text-gray-600 mb-2">
            <Link to={`/universities/${result.university_id}`} className="text-primary-600 font-medium hover:underline">
              {result.university_name}
            </Link>
            {" • "}
            {(result.city ? `${result.city}, ` : "")}
            {result.country_code}
          </p>

          <div className="flex flex-wrap gap-2 mb-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              {result.degree_level}
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              {result.field}
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
              {result.language}
            </span>
            {result.has_scholarship && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                Стипендии доступны
              </span>
            )}
          </div>

          {typeof result.tuition_amount === "number" && (
            <p className="text-sm text-gray-600">
              Стоимость: {result.tuition_amount.toLocaleString()}{" "}
              {result.tuition_currency || ""}/год
            </p>
          )}

          {!!result.qs_rank && (
            <p className="text-sm text-gray-600">QS Ranking: #{result.qs_rank}</p>
          )}
        </div>
      </div>
    </div>
  );
}
