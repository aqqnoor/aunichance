import { useState, useEffect } from "react";
import { apiGet } from "../lib/api";
import { Link } from "react-router-dom";

type ProgramCard = {
  id: string;
  university_id: string;
  title: string;
  degree_level: string;
  field: string;
  language: string;
  tuition_amount?: number;
  tuition_currency?: string;
  has_scholarship: boolean;
  university_name: string;
  country_code: string;
  city?: string;
  qs_rank?: number;
};

type SmartSearchResult = {
  program: ProgramCard;
  score: number;
  category: string; // "reach" | "target" | "safety"
  breakdown: {
    gpa: number;
    language: number;
    tests: number;
    extras: number;
  };
  reasons: string[];
  advice: string;
  financial_info: {
    covered_by_budget: boolean;
    annual_cost_usd: number;
    budget_usd: number;
    shortfall_usd: number;
    best_scholarship_coverage?: number;
    needs_scholarship: boolean;
  };
  improvement_path: {
    target_score: number;
    gap_points: number;
    next_3_steps: string[];
    gpa_impact_percent: number;
    sat_impact_percent: number;
    achieve_impact_percent: number;
  };
};

type SmartSearchResponse = {
  reach: SmartSearchResult[];
  target: SmartSearchResult[];
  safety: SmartSearchResult[];
  total: number;
};

interface SmartSearchFilters {
  countries: string; // "US,UK" etc
  fields: string; // "CS,MATH" etc
  degree_levels: string; // "BACHELOR,MASTER" etc
  max_tuition: string;
}

export default function SmartSearch() {
  const [response, setResponse] = useState<SmartSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<SmartSearchFilters>({
    countries: "US,UK,CA",
    fields: "",
    degree_levels: "",
    max_tuition: "100000",
  });

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (filters.countries) params.set("countries", filters.countries);
      if (filters.fields) params.set("fields", filters.fields);
      if (filters.degree_levels) params.set("degree_levels", filters.degree_levels);
      if (filters.max_tuition) params.set("max_tuition", filters.max_tuition);

      const url = `/programs/smart-search?${params.toString()}`;
      console.log("SmartSearch request:", url);

      const data = await apiGet<SmartSearchResponse>(url);
      setResponse(data);
      setErrorMsg("");
    } catch (error) {
      console.error("SmartSearch error:", error);
      setErrorMsg(error instanceof Error ? error.message : String(error));
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (key: keyof SmartSearchFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Умный поиск университетов
      </h1>
      <p className="text-gray-600 mb-6">
        Найдите программы, которые соответствуют вашему профилю и целям
      </p>

      <div className="card mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-primary-600 hover:text-primary-700 font-medium text-sm mb-4"
        >
          {showFilters ? "Скрыть фильтры" : "Показать фильтры"}{" "}
          {showFilters ? "▲" : "▼"}
        </button>

        {showFilters && (
          <div className="grid md:grid-cols-2 gap-4 p-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Страны (comma-separated)
              </label>
              <input
                type="text"
                value={filters.countries}
                onChange={(e) => handleFilterChange("countries", e.target.value)}
                className="input-field"
                placeholder="US, UK, CA..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Примеры: US, UK, CA, DE, FR, AU
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Направления (comma-separated)
              </label>
              <input
                type="text"
                value={filters.fields}
                onChange={(e) => handleFilterChange("fields", e.target.value)}
                className="input-field"
                placeholder="Computer Science, Business..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Уровень образования
              </label>
              <input
                type="text"
                value={filters.degree_levels}
                onChange={(e) =>
                  handleFilterChange("degree_levels", e.target.value)
                }
                className="input-field"
                placeholder="BACHELOR, MASTER..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Максимальная стоимость (USD/год)
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
          </div>
        )}

        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
          <button onClick={handleSearch} className="btn-primary">
            Поиск
          </button>
          <button
            onClick={() => {
              setFilters({
                countries: "US,UK,CA",
                fields: "",
                degree_levels: "",
                max_tuition: "100000",
              });
            }}
            className="btn-secondary"
          >
            Сброс
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 p-3 rounded border border-red-300 bg-red-50 text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-600">Загрузка результатов...</div>
        </div>
      ) : !response ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">
            Нет результатов. Проверьте подключение.
          </p>
        </div>
      ) : (response.reach.length === 0 &&
          response.target.length === 0 &&
          response.safety.length === 0) ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">
            Результаты не найдены. Попробуйте изменить фильтры.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* REACH Programs */}
          {response.reach.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-red-700 mb-4">
                🔴 REACH - Сложные программы ({response.reach.length})
              </h2>
              <p className="text-gray-600 mb-4">
                Для этих программ нужно значительно улучшить свой профиль.
                Шансы низкие, но есть что улучшить.
              </p>
              <div className="space-y-4">
                {response.reach.map((result) => (
                  <ProgramCard key={result.program.id} result={result} />
                ))}
              </div>
            </div>
          )}

          {/* TARGET Programs */}
          {response.target.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-yellow-700 mb-4">
                🟡 TARGET - Реалистичные программы ({response.target.length})
              </h2>
              <p className="text-gray-600 mb-4">
                На эти программы вы хорошо подходите. Сосредоточьтесь на
                этом списке для лучших результатов.
              </p>
              <div className="space-y-4">
                {response.target.map((result) => (
                  <ProgramCard key={result.program.id} result={result} />
                ))}
              </div>
            </div>
          )}

          {/* SAFETY Programs */}
          {response.safety.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-green-700 mb-4">
                🟢 SAFETY - Вероятные программы ({response.safety.length})
              </h2>
              <p className="text-gray-600 mb-4">
                У вас высокие шансы на поступление в эти программы.
              </p>
              <div className="space-y-4">
                {response.safety.map((result) => (
                  <ProgramCard key={result.program.id} result={result} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProgramCard({ result }: { result: SmartSearchResult }) {
  const program = result.program;
  const categoryColor =
    result.category === "reach"
      ? "bg-red-100 border-red-300"
      : result.category === "target"
        ? "bg-yellow-100 border-yellow-300"
        : "bg-green-100 border-green-300";

  const breakdownTotal =
    result.breakdown.gpa +
    result.breakdown.language +
    result.breakdown.tests +
    result.breakdown.extras;

  return (
    <div className="card border-l-4 border-gray-300">
      <div className="grid md:grid-cols-4 gap-4">
        {/* Program Info */}
        <div className="md:col-span-2">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {program.title}
          </h3>
          <p className="text-gray-600 mb-2">
            <Link
              to={`/universities/${program.university_id}`}
              className="text-primary-600 font-medium hover:underline"
            >
              {program.university_name}
            </Link>
            {" • "}
            {program.city ? `${program.city}, ` : ""}
            {program.country_code}
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
              {program.degree_level}
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
              {program.field}
            </span>
            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
              {program.language}
            </span>
            {program.has_scholarship && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                Стипендии
              </span>
            )}
          </div>

          {typeof program.tuition_amount === "number" && (
            <p className="text-sm text-gray-600 mb-1">
              💰 {program.tuition_amount.toLocaleString()}{" "}
              {program.tuition_currency || "USD"}/год
            </p>
          )}

          {program.qs_rank && (
            <p className="text-sm text-gray-600">
              🏆 QS Ranking: #{program.qs_rank}
            </p>
          )}
        </div>

        {/* Score Card */}
        <div className="flex items-center justify-center">
          <div className={`${categoryColor} border-2 rounded-lg p-4 text-center`}>
            <div className="text-3xl font-bold text-gray-900">
              {result.score}
            </div>
            <div className="text-xs text-gray-600 mt-1">из 100</div>
            <div className="text-xs font-medium text-gray-700 mt-2">
              {result.category.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="text-sm">
          <div className="font-semibold text-gray-900 mb-2">Оценка:</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>GPA:</span>
              <span className="font-medium">{result.breakdown.gpa}/25</span>
            </div>
            <div className="flex justify-between">
              <span>Языки:</span>
              <span className="font-medium">{result.breakdown.language}/10</span>
            </div>
            <div className="flex justify-between">
              <span>Тесты:</span>
              <span className="font-medium">{result.breakdown.tests}/5</span>
            </div>
            <div className="flex justify-between">
              <span>Доп.:</span>
              <span className="font-medium">{result.breakdown.extras}/10</span>
            </div>
            <div className="border-t-2 border-gray-300 pt-1 mt-1 flex justify-between">
              <span className="font-semibold">Всего:</span>
              <span className="font-bold">{breakdownTotal}/50</span>
            </div>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="mt-4 pt-4 border-t border-gray-200 grid md:grid-cols-2 gap-4">
        {/* Reasons */}
        <div>
          <div className="font-semibold text-gray-900 mb-2">Почему этот балл:</div>
          <ul className="text-sm text-gray-700 space-y-1">
            {result.reasons.slice(0, 3).map((reason, i) => (
              <li key={i}>• {reason}</li>
            ))}
          </ul>
          {result.reasons.length > 3 && (
            <p className="text-xs text-gray-500 mt-1">
              +{result.reasons.length - 3} еще
            </p>
          )}
        </div>

        {/* Financial Info */}
        <div>
          <div className="font-semibold text-gray-900 mb-2">💰 Финансы:</div>
          <div className="text-sm text-gray-700 space-y-1">
            <div>
              Стоимость: ${result.financial_info.annual_cost_usd.toLocaleString()}
            </div>
            <div>Бюджет: ${result.financial_info.budget_usd.toLocaleString()}</div>
            {result.financial_info.shortfall_usd > 0 && (
              <div className="text-red-600 font-medium">
                Недостаток: $
                {result.financial_info.shortfall_usd.toLocaleString()}
              </div>
            )}
            {result.financial_info.covered_by_budget && (
              <div className="text-green-600 font-medium">
                ✓ Покрывается бюджетом
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advice and Improvement Path */}
      {result.improvement_path.gap_points > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 bg-blue-50 rounded p-3">
          <div className="font-semibold text-gray-900 mb-2">
            💡 Как улучшить свой профиль:
          </div>
          <p className="text-sm text-gray-700 mb-2">
            Нужно <span className="font-bold">{result.improvement_path.gap_points} баллов</span> до целевого уровня ({result.improvement_path.target_score})
          </p>
          <ul className="text-sm text-gray-700 space-y-1 mb-2">
            {result.improvement_path.next_3_steps.map((step, i) => (
              <li key={i}>
                {i + 1}. {step}
              </li>
            ))}
          </ul>
          <div className="text-xs text-gray-600 grid grid-cols-3 gap-2">
            <div>
              📚 GPA: <span className="font-semibold">+{result.improvement_path.gpa_impact_percent}%</span>
            </div>
            <div>
              📝 SAT: <span className="font-semibold">+{result.improvement_path.sat_impact_percent}%</span>
            </div>
            <div>
              🏆 Достижения: <span className="font-semibold">+{result.improvement_path.achieve_impact_percent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Advice */}
      {result.advice && (
        <div className="mt-3 p-3 bg-gray-50 rounded">
          <div className="text-sm text-gray-800">
            <span className="font-semibold">Совет: </span>
            {result.advice}
          </div>
        </div>
      )}
    </div>
  );
}
