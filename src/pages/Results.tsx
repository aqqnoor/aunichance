import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { StudentProfile, AdmissionChance, Region } from '../types';
import { universities } from '../data/universities';
import { calculateChancesForUniversities } from '../utils/calculation';

interface ResultsProps {
  profile: StudentProfile;
}

export default function Results({ profile }: ResultsProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [minChance, setMinChance] = useState<number>(0);

  const chances = useMemo(() => {
    return calculateChancesForUniversities(profile, universities);
  }, [profile]);

  const filteredChances = useMemo(() => {
    return chances.filter(chance => {
      const regionMatch = selectedRegion === 'all' || chance.university.region === selectedRegion;
      const categoryMatch = selectedCategory === 'all' || chance.category === selectedCategory;
      const chanceMatch = chance.chance >= minChance;
      return regionMatch && categoryMatch && chanceMatch;
    });
  }, [chances, selectedRegion, selectedCategory, minChance]);

  const getChanceColor = (chance: number) => {
    if (chance >= 70) return 'text-green-600 bg-green-50';
    if (chance >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      reach: 'Амбициозная цель',
      target: 'Реалистичная цель',
      safety: 'Безопасный вариант',
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      reach: 'bg-purple-100 text-purple-800',
      target: 'bg-blue-100 text-blue-800',
      safety: 'bg-green-100 text-green-800',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const reach = chances.filter(c => c.category === 'reach').length;
    const target = chances.filter(c => c.category === 'target').length;
    const safety = chances.filter(c => c.category === 'safety').length;
    return { reach, target, safety, total: chances.length };
  }, [chances]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Подходящие университеты
        </h1>
        <p className="text-gray-600">
          Найдено {filteredChances.length} университетов на основе вашего профиля
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Всего вариантов</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.reach}</div>
          <div className="text-sm text-gray-600">Reach</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.target}</div>
          <div className="text-sm text-gray-600">Target</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{stats.safety}</div>
          <div className="text-sm text-gray-600">Safety</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Регион
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="input-field"
            >
              <option value="all">Все регионы</option>
              <option value="USA">США</option>
              <option value="UK">Великобритания</option>
              <option value="Europe">Европа</option>
              <option value="Canada">Канада</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Категория
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field"
            >
              <option value="all">Все категории</option>
              <option value="safety">Safety</option>
              <option value="target">Target</option>
              <option value="reach">Reach</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Минимальный шанс: {minChance}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={minChance}
              onChange={(e) => setMinChance(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {filteredChances.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-600 mb-4">Не найдено университетов по заданным фильтрам</p>
            <button
              onClick={() => {
                setSelectedRegion('all');
                setSelectedCategory('all');
                setMinChance(0);
              }}
              className="btn-secondary"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          filteredChances.map((admissionChance) => (
            <UniversityCard
              key={admissionChance.university.id}
              admissionChance={admissionChance}
              getChanceColor={getChanceColor}
              getCategoryLabel={getCategoryLabel}
              getCategoryColor={getCategoryColor}
            />
          ))
        )}
      </div>

      {/* Strategic Advice */}
      {stats.safety > 0 && stats.target > 0 && (
        <div className="mt-8 card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            💡 Совет по стратегии поступления
          </h3>
          <p className="text-gray-700">
            Рекомендуется подать 2-3 заявления в вузы категории Safety (шанс &gt; 80%), 
            2-3 в Target (30–80%) и 1-2 в Reach (&lt;30%) для сбалансированной стратегии.
          </p>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link to="/profile" className="text-primary-600 hover:text-primary-700 font-medium">
          Заполните подробный профиль для более точных результатов →
        </Link>
      </div>
    </div>
  );
}

interface UniversityCardProps {
  admissionChance: AdmissionChance;
  getChanceColor: (chance: number) => string;
  getCategoryLabel: (category: string) => string;
  getCategoryColor: (category: string) => string;
}

function UniversityCard({ admissionChance, getChanceColor, getCategoryLabel, getCategoryColor }: UniversityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { university, chance, category, reasons, recommendations } = admissionChance;

  return (
    <div className="card">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-16 h-16 bg-primary-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-600">
                {university.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                {university.name}
              </h3>
              <p className="text-gray-600 text-sm mb-2">
                {university.city}, {university.country} • {university.degree}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(category)}`}>
                  {getCategoryLabel(category)}
                </span>
                {university.scholarshipAvailable && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Стипендии доступны
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className={`text-4xl font-bold mb-1 px-4 py-2 rounded-lg ${getChanceColor(chance)}`}>
              {chance}%
            </div>
            <div className="text-sm text-gray-600">Шанс поступления</div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
        >
          {expanded ? 'Скрыть детали' : 'Показать детали'} {expanded ? '▲' : '▼'}
        </button>

        {expanded && (
          <div className="mt-4 space-y-4">
            {university.description && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">О университете</h4>
                <p className="text-gray-600 text-sm">{university.description}</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Требования</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>Минимальный GPA: {university.minGPA}</li>
                  <li>Минимальный IELTS: {university.minIELTS}</li>
                  {university.requiresSAT && <li>Требуется SAT</li>}
                  {university.requiresGRE && <li>Требуется GRE</li>}
                  <li>Процент приема: {university.acceptanceRate}%</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Статистика</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>Средний GPA принятых: {university.avgGPA}</li>
                  <li>Средний IELTS: {university.avgIELTS}</li>
                  {university.avgTOEFL !== undefined && (
                    <li>Средний TOEFL: {university.avgTOEFL}</li>
                  )}
                  {university.tuition !== undefined && (
                    <li>Стоимость: ${university.tuition.toLocaleString()}/год</li>
                  )}
                </ul>
              </div>
            </div>

            {reasons.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Почему такой шанс?</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  {reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {recommendations.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">💡 Рекомендации по улучшению</h4>
                <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                  {recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}