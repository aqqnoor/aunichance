import { useState, useEffect } from "react";
import { apiGet, apiPost } from "../lib/api";
import { Link } from "react-router-dom";
import { ScoreResult } from "../types";

type SearchMode = "basic" | "smart";
type SortField = "title" | "tuition" | "qs_rank" | "score";
type SortOrder = "asc" | "desc";

type ProgramDTO = {
  id: string;
  university_id: string;
  title: string;
  degree_level: string;
  field: string;
  language: string;
  tuition_amount?: number;
  tuition_currency?: string;
  has_scholarship: boolean;
  scholarship_type?: string | null;
  scholarship_percent_min?: number | null;
  scholarship_percent_max?: number | null;
  university_name: string;
  country_code: string;
  city?: string;
  qs_rank?: number;
  the_rank?: number;
};

interface SearchFilters {
  query: string;
  country: string;
  city: string;
  region: string;
  field_of_study: string;
  degree_level: string;
  language: string;
  min_tuition: string;
  max_tuition: string;
  has_scholarship: boolean;
  deadline_before: string;
}

type SmartSearchResult = {
  program: ProgramDTO;
  score: number;
  category: string;
  breakdown: { gpa: number; language: number; tests: number; extras: number };
  reasons: string[];
  advice: string;
};

type SmartSearchResponse = {
  reach: SmartSearchResult[];
  target: SmartSearchResult[];
  safety: SmartSearchResult[];
  total: number;
};

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

function loadFiltersFromStorage(): SearchFilters {
  try {
    const stored = localStorage.getItem("search_filters");
    if (stored) {
      return { ...DEFAULT_FILTERS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.debug("Failed to load filters:", error);
  }
  return DEFAULT_FILTERS;
}

export default function SearchUnified() {
  // Main state
  const [searchMode, setSearchMode] = useState<SearchMode>("basic");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Basic search state
  const [basicResults, setBasicResults] = useState<ProgramDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [scores, setScores] = useState<Record<string, ScoreResult>>({});
  const [loadingScores, setLoadingScores] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filters, setFilters] = useState<SearchFilters>(loadFiltersFromStorage);
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Smart search state
  const [smartResults, setSmartResults] = useState<SmartSearchResponse | null>(null);
  const [smartFilters, setSmartFilters] = useState({
    countries: "US,UK,CA",
    fields: "",
    degree_levels: "",
    max_tuition: "100000",
  });

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, []);

  // Load all programs on mount (initial load)
  useEffect(() => {
    const loadInitialPrograms = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("countries", "DE,US,GB,FR");
        params.set("page", "1");
        params.set("limit", "50");

        const url = `/programs?${params.toString()}`;
        const data = await apiGet<{ items: ProgramDTO[]; total?: number }>(url);

        const programs = data.items || [];
        // Simple sort by title for initial load
        const sorted = [...programs].sort((a, b) => a.title.localeCompare(b.title));
        setBasicResults(sorted);
      } catch (error) {
        console.error("Initial search error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialPrograms();
  }, []);

  // Basic search handler
  const handleBasicSearch = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      if (filters.min_tuition && filters.max_tuition) {
        const minVal = parseInt(filters.min_tuition);
        const maxVal = parseInt(filters.max_tuition);
        if (minVal > maxVal) {
          setErrorMsg("Минимальная стоимость не может быть больше максимальной");
          setLoading(false);
          return;
        }
      }

      const params = new URLSearchParams();
      if (filters.query) params.set("q", filters.query.trim());

      let countries = (filters.country || "").replace(/\s+/g, "");
      if (!countries && filters.region) {
        const regionMap: Record<string, string> = {
          USA: "US",
          UK: "GB",
          Europe: "DE,FR",
          Canada: "CA",
          Australia: "AU",
        };
        countries = regionMap[filters.region] || "";
      }
      if (!countries) countries = "DE,US,GB,FR";
      params.set("countries", countries);

      if (filters.degree_level) params.set("levels", filters.degree_level.toLowerCase());
      if (filters.city && filters.city.trim() !== "") params.set("city", filters.city.trim());
      if (filters.field_of_study && filters.field_of_study.trim() !== "") params.set("fields", filters.field_of_study.trim());
      if (filters.language && filters.language !== "Все языки") params.set("language", filters.language);
      if (filters.min_tuition) params.set("min_tuition", filters.min_tuition);
      if (filters.max_tuition) params.set("max_tuition", filters.max_tuition);
      if (filters.has_scholarship) params.set("scholarship", "true");

      params.set("page", "1");
      params.set("limit", "50");

      const url = `/programs?${params.toString()}`;
      const data = await apiGet<{ items: ProgramDTO[]; total?: number }>(url);

      const programs = data.items || [];
      setBasicResults(sortPrograms(programs, sortField, sortOrder));
    } catch (error) {
      console.error("Search error:", error);
      setErrorMsg(error instanceof Error ? error.message : String(error));
      setBasicResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Smart search handler
  const handleSmartSearch = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams();
      if (smartFilters.countries) params.set("countries", smartFilters.countries);
      if (smartFilters.fields) params.set("fields", smartFilters.fields);
      if (smartFilters.degree_levels) params.set("degree_levels", smartFilters.degree_levels);
      if (smartFilters.max_tuition) params.set("max_tuition", smartFilters.max_tuition);

      const url = `/programs/smart-search?${params.toString()}`;
      const data = await apiGet<SmartSearchResponse>(url);
      setSmartResults(data);
      setErrorMsg("");
    } catch (error) {
      console.error("SmartSearch error:", error);
      setErrorMsg(error instanceof Error ? error.message : String(error));
      setSmartResults(null);
    } finally {
      setLoading(false);
    }
  };

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
    setBasicResults(sortPrograms(basicResults, field, sortOrder === "asc" ? "desc" : "asc"));
  };

  const toggleFavorite = (programId: string) => {
    setFavorites((prev) => {
      const updated = new Set(prev);
      if (updated.has(programId)) {
        updated.delete(programId);
      } else {
        updated.add(programId);
      }
      return updated;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        🔍 Поиск программ
      </h1>

      {/* Mode Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setSearchMode("basic")}
          className={`px-6 py-3 font-medium transition border-b-2 ${
            searchMode === "basic"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          📝 Обычный поиск
        </button>
        <button
          onClick={() => {
            if (isAuthenticated) {
              setSearchMode("smart");
            } else {
              setErrorMsg("Для умного поиска нужна авторизация");
            }
          }}
          className={`px-6 py-3 font-medium transition border-b-2 ${
            searchMode === "smart"
              ? "border-primary-600 text-primary-600"
              : isAuthenticated
              ? "border-transparent text-gray-600 hover:text-gray-900"
              : "border-transparent text-gray-400 cursor-not-allowed opacity-50"
          }`}
          title={isAuthenticated ? "Умный поиск с AI анализом" : "Требуется авторизация"}
        >
          🤖 Умный поиск {!isAuthenticated && "🔒"}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-700">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Basic Search Mode */}
      {searchMode === "basic" && (
        <div>
          <div className="card mb-6">
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                placeholder="Поиск по названию университета или программы..."
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                className="input-field flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleBasicSearch()}
              />
              <button onClick={handleBasicSearch} className="btn-primary">
                Поиск
              </button>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              {showFilters ? "Скрыть фильтры" : "Показать фильтры"} {showFilters ? "▲" : "▼"}
            </button>

            {showFilters && (
              <div className="mt-4 grid md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Страна</label>
                  <select
                    value={filters.country}
                    onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Все страны</option>
                    {POPULAR_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Уровень</label>
                  <select
                    value={filters.degree_level}
                    onChange={(e) => setFilters({ ...filters, degree_level: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Все уровни</option>
                    <option value="bachelor">Бакалавр</option>
                    <option value="master">Магистр</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Язык</label>
                  <select
                    value={filters.language}
                    onChange={(e) => setFilters({ ...filters, language: e.target.value })}
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
                    onChange={(e) => setFilters({ ...filters, min_tuition: e.target.value })}
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
                    onChange={(e) => setFilters({ ...filters, max_tuition: e.target.value })}
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
                      onChange={(e) => setFilters({ ...filters, has_scholarship: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Со стипендиями</span>
                  </label>
                </div>

                <div className="col-span-full flex gap-2">
                  <button onClick={handleBasicSearch} className="btn-primary">
                    Применить
                  </button>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin"></div>
              </div>
              <div className="text-gray-600 mt-4">Загрузка программ...</div>
            </div>
          ) : basicResults.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-600 text-lg">
                📚 Результаты не найдены. Попробуйте изменить фильтры.
              </p>
            </div>
          ) : (
            <div>
              <div className="card mb-6">
                <p className="text-gray-700">
                  Найдено: <span className="font-bold text-lg text-primary-600">{basicResults.length}</span> программ
                </p>
              </div>

              <div className="space-y-4">
                {basicResults.map((result) => (
                  <BasicSearchCard
                    key={result.id}
                    result={result}
                    isFavorite={favorites.has(result.id)}
                    onToggleFavorite={() => toggleFavorite(result.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Smart Search Mode */}
      {searchMode === "smart" && (
        <div>
          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-4">🤖 Умный поиск с AI анализом</h2>

            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Страны</label>
                <input
                  type="text"
                  value={smartFilters.countries}
                  onChange={(e) => setSmartFilters({ ...smartFilters, countries: e.target.value })}
                  className="input-field"
                  placeholder="US,UK,CA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Направления</label>
                <input
                  type="text"
                  value={smartFilters.fields}
                  onChange={(e) => setSmartFilters({ ...smartFilters, fields: e.target.value })}
                  className="input-field"
                  placeholder="CS,MATH"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Макс. стоимость</label>
                <input
                  type="number"
                  value={smartFilters.max_tuition}
                  onChange={(e) => setSmartFilters({ ...smartFilters, max_tuition: e.target.value })}
                  className="input-field"
                  placeholder="100000"
                />
              </div>

              <div className="flex items-end">
                <button onClick={handleSmartSearch} className="btn-primary w-full">
                  🔍 Искать
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin"></div>
              </div>
              <div className="text-gray-600 mt-4">Анализирую программы с помощью AI...</div>
            </div>
          ) : smartResults ? (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3">
                  📊 Результаты: {smartResults.total} программ
                </h2>

                {/* Safety Programs */}
                {smartResults.safety.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-green-700 mb-3">
                      🟢 Safety Programs ({smartResults.safety.length}) - Высокие шансы
                    </h3>
                    <div className="space-y-3">
                      {smartResults.safety.map((result) => (
                        <SmartSearchCard key={result.program.id} result={result} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Target Programs */}
                {smartResults.target.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-yellow-700 mb-3">
                      🟡 Target Programs ({smartResults.target.length}) - Реальные шансы
                    </h3>
                    <div className="space-y-3">
                      {smartResults.target.map((result) => (
                        <SmartSearchCard key={result.program.id} result={result} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Reach Programs */}
                {smartResults.reach.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-red-700 mb-3">
                      🔴 Reach Programs ({smartResults.reach.length}) - Амбициозные цели
                    </h3>
                    <div className="space-y-3">
                      {smartResults.reach.map((result) => (
                        <SmartSearchCard key={result.program.id} result={result} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <p className="text-gray-600 text-lg">
                Нажмите кнопку "Искать" для получения рекомендаций с AI анализом
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BasicSearchCard({
  result,
  isFavorite,
  onToggleFavorite,
}: {
  result: ProgramDTO;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="card hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900">{result.title}</h3>
          <p className="text-gray-600 mt-1">
            <Link to={`/universities/${result.university_id}`} className="text-primary-600 hover:underline">
              {result.university_name}
            </Link>
          </p>
        </div>
        <button
          onClick={onToggleFavorite}
          className="text-2xl hover:scale-110 transition"
          title={isFavorite ? "Удалить из избранного" : "Добавить в избранное"}
        >
          {isFavorite ? "❤️" : "🤍"}
        </button>
      </div>

      <p className="text-gray-500 text-sm mb-3">
        {result.city ? `📍 ${result.city}, ` : ""}
        {result.country_code}
        {result.qs_rank && ` • QS: #${result.qs_rank}`}
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
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
        <div>
          {result.tuition_amount && (
            <p className="text-lg font-bold text-primary-600">${formatTuition(result.tuition_amount)}/год</p>
          )}
          {result.has_scholarship && <p className="text-sm text-yellow-700">💰 Стипендии доступны</p>}
        </div>
        <Link to={`/universities/${result.university_id}`} className="btn-primary text-sm">
          Подробнее →
        </Link>
      </div>
    </div>
  );
}

function SmartSearchCard({ result }: { result: SmartSearchResult }) {
  return (
    <div className="card hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{result.program.title}</h3>
          <p className="text-gray-600 text-sm mt-1">
            <Link to={`/universities/${result.program.university_id}`} className="text-primary-600 hover:underline">
              {result.program.university_name}
            </Link>
          </p>
        </div>
        <div className={`px-4 py-2 rounded-lg border-2 font-bold text-lg ${
          result.category === "safety"
            ? "bg-green-100 text-green-800 border-green-300"
            : result.category === "target"
            ? "bg-yellow-100 text-yellow-800 border-yellow-300"
            : "bg-red-100 text-red-800 border-red-300"
        }`}>
          {result.score}%
        </div>
      </div>

      <p className="text-gray-500 text-sm mb-2">
        📍 {result.program.city}, {result.program.country_code} • QS: #{result.program.qs_rank || "N/A"}
      </p>

      <div className="mb-3 p-3 bg-gray-50 rounded">
        <p className="text-sm font-medium text-gray-700 mb-1">💡 Рекомендация:</p>
        <p className="text-sm text-gray-600">{result.advice}</p>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm">
          {result.program.tuition_amount && (
            <p className="font-semibold text-primary-600">${formatTuition(result.program.tuition_amount)}/год</p>
          )}
        </div>
        <Link to={`/universities/${result.program.university_id}`} className="btn-primary text-sm">
          Подробнее →
        </Link>
      </div>
    </div>
  );
}
