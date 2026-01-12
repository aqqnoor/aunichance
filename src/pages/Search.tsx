import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface SearchResult {
  id: number;
  program_name: string;
  degree_level: string;
  field_of_study: string;
  language: string;
  tuition_fee: number;
  tuition_currency: string;
  university_name: string;
  city: string;
  country_name: string;
  qs_ranking: number;
  has_scholarship: boolean;
  next_deadline: string;
  avg_acceptance_rate: number;
}

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

const API_BASE_URL = 'http://localhost:3001/api';

export default function Search() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    country: '',
    city: '',
    region: '',
    field_of_study: '',
    degree_level: '',
    language: '',
    min_tuition: '',
    max_tuition: '',
    has_scholarship: false,
    deadline_before: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`${API_BASE_URL}/search?${params.toString()}`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Поиск университетов и программ
      </h1>

      {/* Search Bar */}
      <div className="card mb-6">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Поиск по названию университета или программы..."
            value={filters.query}
            onChange={(e) => handleFilterChange('query', e.target.value)}
            className="input-field flex-1"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="btn-primary">
            Поиск
          </button>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
        >
          {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'} {showFilters ? '▲' : '▼'}
        </button>

        {showFilters && (
          <div className="mt-4 grid md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Страна</label>
              <input
                type="text"
                value={filters.country}
                onChange={(e) => handleFilterChange('country', e.target.value)}
                className="input-field"
                placeholder="US, GB, CA..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Город</label>
              <input
                type="text"
                value={filters.city}
                onChange={(e) => handleFilterChange('city', e.target.value)}
                className="input-field"
                placeholder="Boston, London..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Регион</label>
              <select
                value={filters.region}
                onChange={(e) => handleFilterChange('region', e.target.value)}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Направление</label>
              <input
                type="text"
                value={filters.field_of_study}
                onChange={(e) => handleFilterChange('field_of_study', e.target.value)}
                className="input-field"
                placeholder="Computer Science, Business..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Уровень</label>
              <select
                value={filters.degree_level}
                onChange={(e) => handleFilterChange('degree_level', e.target.value)}
                className="input-field"
              >
                <option value="">Все уровни</option>
                <option value="Bachelor">Бакалавр</option>
                <option value="Master">Магистр</option>
                <option value="PhD">PhD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Язык</label>
              <select
                value={filters.language}
                onChange={(e) => handleFilterChange('language', e.target.value)}
                className="input-field"
              >
                <option value="">Все языки</option>
                <option value="English">English</option>
                <option value="German">German</option>
                <option value="French">French</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Мин. стоимость</label>
              <input
                type="number"
                value={filters.min_tuition}
                onChange={(e) => handleFilterChange('min_tuition', e.target.value)}
                className="input-field"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Макс. стоимость</label>
              <input
                type="number"
                value={filters.max_tuition}
                onChange={(e) => handleFilterChange('max_tuition', e.target.value)}
                className="input-field"
                placeholder="100000"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.has_scholarship}
                  onChange={(e) => handleFilterChange('has_scholarship', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Только со стипендиями</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-600">Загрузка...</div>
        </div>
      ) : results.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">Результаты не найдены. Попробуйте изменить фильтры.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <ProgramCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProgramCard({ result }: { result: SearchResult }) {
  return (
    <div className="card">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {result.program_name}
          </h3>
          <p className="text-gray-600 mb-2">
            <Link to={`/universities/${result.id}`} className="text-primary-600 hover:text-primary-700 font-medium">
              {result.university_name}
            </Link>
            {' • '}
            {result.city}, {result.country_name}
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              {result.degree_level}
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              {result.field_of_study}
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
          {result.tuition_fee && (
            <p className="text-sm text-gray-600">
              Стоимость: {result.tuition_fee.toLocaleString()} {result.tuition_currency}/год
            </p>
          )}
          {result.qs_ranking && (
            <p className="text-sm text-gray-600">
              QS Ranking: #{result.qs_ranking}
            </p>
          )}
        </div>
        <div className="flex items-center">
          <Link to={`/programs/${result.id}`} className="btn-secondary">
            Подробнее
          </Link>
        </div>
      </div>
    </div>
  );
}