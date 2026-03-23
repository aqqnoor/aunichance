import { useState, useEffect } from "react";
import { apiGet, apiPost } from "../lib/api";
import { Link } from "react-router-dom";
import { ScoreResult } from "../types";



type SearchMode = "basic" | "smart";

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

type SortField = "title" | "tuition" | "qs_rank" | "score";
type SortOrder = "asc" | "desc";

const POPULAR_COUNTRIES = [
  { code: "DE", name: "Германия" },
  { code: "US", name: "США" },
  { code: "GB", name: "Великобритания" },
  { code: "FR", name: "Франция" },
  { code: "NL", name: "Нидерланды" },
  { code: "CA", name: "Канада" },
  { code: "AU", name: "Австралия" },
  { code: "IT", name: "Италия" },
  { code: "SE", name: "Швеция" },
  { code: "CH", name: "Швейцария" },
];

function normalizeLevel(uiLevel: string): string {
  if (uiLevel === "Bachelor") return "bachelor";
  if (uiLevel === "Master") return "master";
  return "";
}

function formatTuition(amount: number | undefined): string {
  if (!amount) return "Н/А";
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + "M";
  if (amount >= 1000) return (amount / 1000).toFixed(0) + "K";
  return amount.toString();
}

const DEFAULT_FILTERS: SearchFilters = {
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
};

const FILTERS_STORAGE_KEY = "search_filters";
const SEARCH_HISTORY_KEY = "search_history";
const FAVORITES_KEY = "favorite_programs";

function loadFiltersFromStorage(): SearchFilters {
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_FILTERS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.debug("Failed to load filters from localStorage:", error);
  }
  return DEFAULT_FILTERS;
}

function loadFavoritesFromStorage(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (error) {
    console.debug("Failed to load favorites from localStorage:", error);
  }
  return new Set<string>();
}

function saveFavoritesToStorage(favorites: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
  } catch (error) {
    console.debug("Failed to save favorites to localStorage:", error);
  }
}

function saveFiltersToStorage(filters: SearchFilters): void {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.debug("Failed to save filters to localStorage:", error);
  }
}

export default function Search() {
  const [results, setResults] = useState<ProgramDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [scores, setScores] = useState<Record<string, ScoreResult>>({});
  const [loadingScores, setLoadingScores] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filters, setFilters] = useState<SearchFilters>(loadFiltersFromStorage);
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchFilters[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavoritesFromStorage);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  const [showComparisonModal, setShowComparisonModal] = useState(false);

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
    setErrorMsg("");
    try {
      // Валидация: min_tuition не должна быть больше max_tuition
      if (filters.min_tuition && filters.max_tuition) {
        const minVal = parseInt(filters.min_tuition);
        const maxVal = parseInt(filters.max_tuition);
        if (minVal > maxVal) {
          setErrorMsg("Минимальная стоимость не может быть больше максимальной");
          setLoading(false);
          return;
        }
      }

      // Save to history
      saveToHistory(filters);

      const params = new URLSearchParams();

      // Backend expects: q, country, degree, field, min_tuition, max_tuition, scholarship, page, limit
      if (filters.query) params.set("q", filters.query.trim());
      // countries: manual OR from region OR MVP default
      let countries = (filters.country || "").replace(/\s+/g, "");

      if (!countries && filters.region) {
        const regionCountries: Record<string, string> = {
          USA: "US",
          UK: "GB",
          Europe: "DE,FR",
          Canada: "CA",
          Australia: "AU",
          Other: "",
        };
        countries = regionCountries[filters.region] || "";
      }

      // MVP default (сен бекіткен): DE/US/GB/FR
      if (!countries) {
        countries = "DE,US,GB,FR";
      }

      if (countries) params.set("countries", countries);

      const lvl = normalizeLevel(filters.degree_level);
      if (lvl) params.set("levels", lvl);

      if (filters.city && filters.city.trim() !== "") {
        params.set("city", filters.city.trim());
      }

      if (filters.field_of_study && filters.field_of_study.trim() !== "") {
        params.set("fields", filters.field_of_study.trim());
      }

      if (filters.language && filters.language !== "Все языки") {
        params.set("language", filters.language);
      }

      if (filters.min_tuition) params.set("min_tuition", filters.min_tuition);
      if (filters.max_tuition) params.set("max_tuition", filters.max_tuition);

      if (filters.has_scholarship) params.set("scholarship", "true");

      // MVP defaults
      params.set("page", "1");
      params.set("limit", "50");

      const url = `/programs?${params.toString()}`;
      console.log("Request:", url);

      const response = await apiGet<{ items: ProgramDTO[]; total: number }>(url);
      console.log("API data:", response.items?.length, response);
      const formattedPrograms = response.items || [];

      setResults(sortPrograms(formattedPrograms, sortField, sortOrder));
      console.log("🔥 Первый элемент formattedPrograms:", formattedPrograms[0]);

      // Load scores for all programs (if user is authenticated)
      loadScoresForPrograms(response.items || []);
    } catch (error) {
      console.error("Search error:", error);
      setErrorMsg(error instanceof Error ? error.message : String(error));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load search history
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        setSearchHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.debug("Failed to load search history:", error);
    }

    // Perform initial search
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save filters whenever they change
  useEffect(() => {
    saveFiltersToStorage(filters);
  }, [filters]);

  const sortPrograms = (programs: ProgramDTO[], field: SortField, order: SortOrder): ProgramDTO[] => {
    const sorted = [...programs].sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      switch (field) {
        case "title":
          aVal = a.title;
          bVal = b.title;
          break;
        case "tuition":
          aVal = a.tuition_amount || 0;
          bVal = b.tuition_amount || 0;
          break;
        case "qs_rank":
          aVal = a.qs_rank || 999999;
          bVal = b.qs_rank || 999999;
          break;
        case "score":
          aVal = scores[a.id]?.score || 0;
          bVal = scores[b.id]?.score || 0;
          break;
      }

      if (aVal < bVal) return order === "asc" ? -1 : 1;
      if (aVal > bVal) return order === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setResults(sortPrograms(results, field, sortOrder === "asc" ? "desc" : "asc"));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setErrorMsg("");
  };

  const saveToHistory = (filter: SearchFilters) => {
    setSearchHistory((prev) => {
      const updated = [filter, ...prev.filter((f) => JSON.stringify(f) !== JSON.stringify(filter))].slice(0, 5);
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch (error) {
        console.debug("Failed to save search history:", error);
      }
      return updated;
    });
  };

  const loadFromHistory = (filter: SearchFilters) => {
    setFilters(filter);
  };

  const toggleFavorite = (programId: string) => {
    setFavorites((prev) => {
      const updated = new Set(prev);
      if (updated.has(programId)) {
        updated.delete(programId);
      } else {
        updated.add(programId);
      }
      saveFavoritesToStorage(updated);
      return updated;
    });
  };

  const isFavorite = (programId: string): boolean => {
    return favorites.has(programId);
  };

  const toggleComparisonSelection = (programId: string) => {
    setSelectedForComparison((prev) => {
      const updated = new Set(prev);
      if (updated.has(programId)) {
        updated.delete(programId);
      } else {
        if (updated.size < 3) {
          updated.add(programId);
        }
      }
      return updated;
    });
  };

  const getSelectedProgramsForComparison = (): ProgramDTO[] => {
    return results.filter((p) => selectedForComparison.has(p.id));
  };



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
              <select
                value={filters.country}
                onChange={(e) => handleFilterChange("country", e.target.value)}
                className="input-field"
              >
                <option value="">Все страны</option>
                {POPULAR_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
                <option value="---custom---" disabled>─────────────</option>
                <option value="">Другая (вводить вручную)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Или введи коды: DE, US, GB, FR (через запятую)
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
                Мин. стоимость ($)
              </label>
              <input
                type="number"
                value={filters.min_tuition}
                onChange={(e) =>
                  handleFilterChange("min_tuition", e.target.value)
                }
                className="input-field"
                placeholder="0"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Макс. стоимость ($)
              </label>
              <input
                type="number"
                value={filters.max_tuition}
                onChange={(e) =>
                  handleFilterChange("max_tuition", e.target.value)
                }
                className="input-field"
                placeholder="100000"
                min="0"
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

            <div className="col-span-full flex gap-2 pt-2">
              <button onClick={handleSearch} className="btn-primary">
                Применить фильтры
              </button>
              <button onClick={clearFilters} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition">
                Очистить
              </button>
            </div>
          </div>
        )}

        {searchHistory.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Последние поиски:</p>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((historyFilter, idx) => {
                const label = historyFilter.query || 
                  (historyFilter.country ? `${historyFilter.country}` : "Все страны") +
                  (historyFilter.field_of_study ? ` - ${historyFilter.field_of_study}` : "");
                return (
                  <button
                    key={idx}
                    onClick={() => loadFromHistory(historyFilter)}
                    className="px-3 py-1 bg-gray-100 hover:bg-primary-50 text-gray-700 hover:text-primary-700 rounded text-sm transition border border-gray-200"
                    title={label}
                  >
                    {label || "Фильтры"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {errorMsg && (
        <div className="mt-3 p-3 rounded border border-red-300 bg-red-50 text-red-700">
          ⚠️ {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin"></div>
          </div>
          <div className="text-gray-600 mt-4">Загрузка программ...</div>
        </div>
      ) : results.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 text-lg">
            📚 Результаты не найдены. Попробуйте изменить фильтры.
          </p>
        </div>
      ) : (
        <div>
          <div className="card mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex gap-4 items-center">
                <div>
                  <p className="text-gray-700">
                    <span className="font-bold text-lg text-primary-600">
                      {showFavoritesOnly ? favorites.size : results.length}
                    </span>
                    {" "}программ{(showFavoritesOnly ? favorites.size : results.length) % 10 === 1 && (showFavoritesOnly ? favorites.size : results.length) !== 11 ? "а" : (showFavoritesOnly ? favorites.size : results.length) % 10 >= 2 && (showFavoritesOnly ? favorites.size : results.length) % 10 <= 4 && ((showFavoritesOnly ? favorites.size : results.length) < 10 || (showFavoritesOnly ? favorites.size : results.length) > 20) ? "ы" : ""}
                  </p>
                </div>
                {favorites.size > 0 && (
                  <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`px-4 py-2 rounded font-medium transition ${
                      showFavoritesOnly
                        ? "bg-red-100 text-red-800 border-2 border-red-300"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    ❤️ Избранное ({favorites.size})
                  </button>
                )}
              </div>

              <div className="flex gap-2 flex-wrap md:flex-nowrap items-center">
                <span className="text-sm text-gray-600">Сортировать по:</span>
                <button
                  onClick={() => handleSort("title")}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    sortField === "title"
                      ? "bg-primary-100 text-primary-800"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Названию {sortField === "title" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
                <button
                  onClick={() => handleSort("tuition")}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    sortField === "tuition"
                      ? "bg-primary-100 text-primary-800"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Цене {sortField === "tuition" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
                <button
                  onClick={() => handleSort("qs_rank")}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    sortField === "qs_rank"
                      ? "bg-primary-100 text-primary-800"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Рейтингу {sortField === "qs_rank" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>

                {selectedForComparison.size > 0 && (
                  <button
                    onClick={() => setShowComparisonModal(true)}
                    className="px-4 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium hover:bg-blue-200 transition ml-2"
                  >
                    ⚖️ Сравнить ({selectedForComparison.size})
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {(showFavoritesOnly ? results.filter(r => isFavorite(r.id)) : results).map((result) => (
              <ProgramCard 
                key={result.id} 
                result={result} 
                score={scores[result.id]}
                loadingScore={loadingScores[result.id]}
                isFavorite={isFavorite(result.id)}
                onToggleFavorite={() => toggleFavorite(result.id)}
                isSelectedForComparison={selectedForComparison.has(result.id)}
                onToggleComparisonSelection={() => toggleComparisonSelection(result.id)}
              />
            ))}
          </div>
        </div>
      )}

      {showComparisonModal && (
        <ComparisonModal
          programs={getSelectedProgramsForComparison()}
          scores={scores}
          onClose={() => setShowComparisonModal(false)}
        />
      )}
    </div>
  );
}

function ProgramCard({ 
  result, 
  score, 
  loadingScore,
  isFavorite,
  onToggleFavorite,
  isSelectedForComparison,
  onToggleComparisonSelection
}: { 
  result: ProgramDTO;
  score?: ScoreResult;
  loadingScore?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isSelectedForComparison?: boolean;
  onToggleComparisonSelection?: () => void;
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

  const getCategoryEmoji = (category?: string) => {
    switch (category) {
      case "reach":
        return "🔴";
      case "target":
        return "🟡";
      case "safety":
        return "🟢";
      default:
        return "";
    }
  };

  return (
    <div className={`card hover:shadow-lg transition ${isSelectedForComparison ? "border-2 border-blue-400 bg-blue-50" : ""}`}>
      {onToggleComparisonSelection && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSelectedForComparison || false}
              onChange={onToggleComparisonSelection}
              className="w-4 h-4 mr-2"
            />
            <span className="text-sm text-gray-600">Выбрать для сравнения</span>
          </label>
        </div>
      )}
      <div className="grid md:grid-cols-5 gap-4">
        <div className="md:col-span-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-start gap-2">
                <h3 className="text-xl font-bold text-gray-900 mb-2 flex-1">
                   {result.title || result.university_name|| "Без названия"}
                </h3>
                {onToggleFavorite && (
                  <button
                    onClick={onToggleFavorite}
                    className="flex-shrink-0 text-2xl hover:scale-110 transition"
                    title={isFavorite ? "Удалить из избранного" : "Добавить в избранное"}
                  >
                    {isFavorite ? "❤️" : "🤍"}
                  </button>
                )}
              </div>
            </div>
            {score && (
              <div className="flex flex-col items-end gap-1 ml-4 flex-shrink-0">
                <div className={`px-4 py-2 rounded-lg border-2 font-bold text-lg ${getCategoryColor(score.category)}`}>
                  {score.score}%
                </div>
                <span className="text-xs font-medium text-gray-600">
                  {getCategoryEmoji(score.category)} {getCategoryLabel(score.category)}
                </span>
              </div>
            )}
            {loadingScore && (
              <div className="px-4 py-2 rounded-lg border-2 border-gray-300 bg-gray-50 text-gray-600 text-sm animate-pulse flex-shrink-0">
                ⏳
              </div>
            )}
          </div>

          <p className="text-gray-600 mb-3 font-medium">
            {result.university_id && result.university_id !== "undefined" ? (
              <Link to={`/universities/${result.university_id}`} className="text-primary-600 font-semibold hover:underline">
                {result.university_name}
              </Link>
            ) : (
              <span className="text-gray-600 font-semibold">
                {result.university_name}
              </span>
            )}
          </p>

          <p className="text-gray-500 text-sm mb-3">
            {result.city ? `📍 ${result.city}, ` : ""}
            {result.country_code}
            {result.qs_rank && ` • QS Ranking: #${result.qs_rank}`}
            {result.the_rank && ` • THE Ranking: #${result.the_rank}`}
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
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
                💰 Стипендии доступны
              </span>
            )}
          </div>
        </div>

        <div className="md:col-span-2 border-l border-gray-200 pl-4 flex flex-col justify-between">
          <div>
            {typeof result.tuition_amount === "number" && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">Стоимость в год</p>
                <p className="text-2xl font-bold text-primary-600">
                  ${formatTuition(result.tuition_amount)}
                </p>
                {result.tuition_currency && result.tuition_currency !== "USD" && (
                  <p className="text-xs text-gray-500">{result.tuition_currency}/год</p>
                )}
              </div>
            )}

            {result.scholarship_type && (
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs text-gray-600 mb-1">Тип стипендии</p>
                <p className="text-sm font-medium text-gray-800">{result.scholarship_type}</p>
                {result.scholarship_percent_min && result.scholarship_percent_max && (
                  <p className="text-xs text-gray-600 mt-1">
                    {result.scholarship_percent_min}% - {result.scholarship_percent_max}%
                  </p>
                )}
              </div>
            )}
          </div>

          <Link 
            to={`/universities/${result.university_id}`}
            className="btn-primary text-center block"
          >
            Подробнее
          </Link>
          
        </div>
      </div>
    </div>
  );
}

function ComparisonModal({
  programs,
  scores,
  onClose,
}: {
  programs: ProgramDTO[];
  scores: Record<string, ScoreResult>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] overflow-auto w-full">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">⚖️ Сравнение программ ({programs.length})</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50">
                  Характеристика
                </th>
                {programs.map((program) => (
                  <th key={program.id} className="px-6 py-3 text-left text-sm font-semibold text-gray-900 min-w-[250px]">
                    <Link to={`/universities/${program.university_id}`} className="text-primary-600 hover:underline">
                      {program.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">Университет</td>
                {programs.map((program) => (
                  <td key={program.id} className="px-6 py-3 text-gray-900">
                    <Link to={`/universities/${program.university_id}`} className="text-primary-600 hover:underline font-medium">
                      {program.university_name}
                    </Link>
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">Страна</td>
                {programs.map((program) => (
                  <td key={program.id} className="px-6 py-3 text-gray-900">
                    {program.country_code}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">Город</td>
                {programs.map((program) => (
                  <td key={program.id} className="px-6 py-3 text-gray-900">
                    {program.city || "N/A"}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">Уровень</td>
                {programs.map((program) => (
                  <td key={program.id} className="px-6 py-3 text-gray-900">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {program.degree_level}
                    </span>
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">Направление</td>
                {programs.map((program) => (
                  <td key={program.id} className="px-6 py-3 text-gray-900">
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {program.field}
                    </span>
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">Язык</td>
                {programs.map((program) => (
                  <td key={program.id} className="px-6 py-3 text-gray-900">
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                      {program.language}
                    </span>
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">Стоимость/год</td>
                {programs.map((program) => (
                  <td key={program.id} className="px-6 py-3 text-gray-900 font-bold text-lg text-primary-600">
                    {program.tuition_amount ? `$${formatTuition(program.tuition_amount)}` : "N/A"}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">Стипендия</td>
                {programs.map((program) => (
                  <td key={program.id} className="px-6 py-3 text-gray-900">
                    {program.has_scholarship ? (
                      <div>
                        <p className="font-medium text-green-700">✓ Доступна</p>
                        {program.scholarship_type && <p className="text-sm text-gray-600">{program.scholarship_type}</p>}
                        {program.scholarship_percent_min && program.scholarship_percent_max && (
                          <p className="text-sm text-gray-600">{program.scholarship_percent_min}% - {program.scholarship_percent_max}%</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500">✗ Нет</p>
                    )}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">QS Рейтинг</td>
                {programs.map((program) => (
                  <td key={program.id} className="px-6 py-3 text-gray-900">
                    {program.qs_rank ? `#${program.qs_rank}` : "N/A"}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">THE Рейтинг</td>
                {programs.map((program) => (
                  <td key={program.id} className="px-6 py-3 text-gray-900">
                    {program.the_rank ? `#${program.the_rank}` : "N/A"}
                  </td>
                ))}
              </tr>

              {Object.keys(scores).length > 0 && (
                <tr className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-white">Match Score</td>
                  {programs.map((program) => {
                    const score = scores[program.id];
                    return (
                      <td key={program.id} className="px-6 py-3 text-gray-900">
                        {score ? (
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold text-primary-600">{score.score}%</div>
                            <span className="text-sm">{score.category === "reach" ? "🔴 Reach" : score.category === "target" ? "🟡 Target" : score.category === "safety" ? "🟢 Safety" : ""}</span>
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition font-medium"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
