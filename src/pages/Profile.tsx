import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentProfile, Region } from '../types';
import { calculateAdmissionChance } from '../utils/calculation';
import { universities } from '../data/universities';

interface ProfileProps {
  profile: StudentProfile;
  setProfile: (profile: StudentProfile) => void;
}

export default function Profile({ profile, setProfile }: ProfileProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<StudentProfile>(profile);
  const [activeSection, setActiveSection] = useState<string>('academic');
  const [previewChance, setPreviewChance] = useState<number | null>(null);

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  // Calculate preview chance when form data changes
  useEffect(() => {
    if (formData.gpa && formData.englishScore) {
      const sampleUni = universities.find(u => u.region === (formData.preferredRegions?.[0] || 'USA'));
      if (sampleUni) {
        const chance = calculateAdmissionChance(formData, sampleUni);
        setPreviewChance(chance.chance);
      }
    } else {
      setPreviewChance(null);
    }
  }, [formData]);

  const handleSave = () => {
    setProfile(formData);
    navigate('/results');
  };

  const updateFormData = (updates: Partial<StudentProfile>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const calculateProgress = () => {
    let filled = 0;
    let total = 15;
    
    if (formData.gpa) filled++;
    if (formData.englishTest && formData.englishScore) filled++;
    if (formData.satScore) filled++;
    if (formData.greScore) filled++;
    if (formData.olympiads && formData.olympiads.length > 0) filled++;
    if (formData.sports && formData.sports.length > 0) filled++;
    if (formData.volunteering && formData.volunteering.length > 0) filled++;
    if (formData.leadership && formData.leadership.length > 0) filled++;
    if (formData.preferredRegions && formData.preferredRegions.length > 0) filled++;
    if (formData.preferredCountries && formData.preferredCountries.length > 0) filled++;
    if (formData.preferredFields && formData.preferredFields.length > 0) filled++;
    if (formData.budget) filled++;
    if (formData.languages && formData.languages.length > 0) filled++;
    if (formData.skills && formData.skills.length > 0) filled++;
    if (formData.graduationYear) filled++;

    return Math.round((filled / total) * 100);
  };

  const progress = calculateProgress();

  const sections = [
    { id: 'academic', label: 'Академические показатели', icon: '📚' },
    { id: 'achievements', label: 'Достижения', icon: '🏆' },
    { id: 'preferences', label: 'Предпочтения', icon: '🎯' },
    { id: 'additional', label: 'Дополнительно', icon: '➕' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Профиль абитуриента
        </h1>
        <p className="text-gray-600 mb-4">
          Заполните подробную информацию для максимально точной оценки шансов поступления
        </p>
        
        {/* Progress Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Профиль заполнен на {progress}%
            </span>
            {previewChance !== null && (
              <span className="text-sm font-medium text-primary-600">
                Примерный шанс: {previewChance}%
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {progress < 50 && (
            <p className="text-sm text-gray-500 mt-2">
              Заполните еще несколько полей для повышения точности прогноза
            </p>
          )}
        </div>

        {/* Section Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeSection === section.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {section.icon} {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {/* Academic Section */}
        {activeSection === 'academic' && (
          <AcademicSection formData={formData} updateFormData={updateFormData} />
        )}

        {/* Achievements Section */}
        {activeSection === 'achievements' && (
          <AchievementsSection formData={formData} updateFormData={updateFormData} />
        )}

        {/* Preferences Section */}
        {activeSection === 'preferences' && (
          <PreferencesSection formData={formData} updateFormData={updateFormData} />
        )}

        {/* Additional Section */}
        {activeSection === 'additional' && (
          <AdditionalSection formData={formData} updateFormData={updateFormData} />
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => navigate('/')}
            className="btn-secondary"
          >
            Назад
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
          >
            Сохранить и оценить шансы
          </button>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  formData: StudentProfile;
  updateFormData: (updates: Partial<StudentProfile>) => void;
}

function AcademicSection({ formData, updateFormData }: SectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Академические показатели</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Средний балл (GPA) *
        </label>
        <div className="flex gap-4">
          <input
            type="number"
            step="0.01"
            value={formData.gpa || ''}
            onChange={(e) => updateFormData({ gpa: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="input-field flex-1"
            placeholder="3.5"
          />
          <select
            value={formData.gpaScale || '4.0'}
            onChange={(e) => updateFormData({ gpaScale: e.target.value as '4.0' | '5.0' | '100' })}
            className="input-field w-32"
          >
            <option value="4.0">4.0</option>
            <option value="5.0">5.0</option>
            <option value="100">100%</option>
          </select>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {formData.gpaScale === '100' 
            ? 'GPA 3.5 – это примерно 89% успеваемости'
            : 'Для топ-университетов обычно требуется GPA ≥ 3.5'
          }
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Языковой тест
        </label>
        <div className="grid md:grid-cols-2 gap-4">
          <select
            value={formData.englishTest || 'none'}
            onChange={(e) => updateFormData({ 
              englishTest: e.target.value === 'none' ? undefined : e.target.value as 'IELTS' | 'TOEFL' 
            })}
            className="input-field"
          >
            <option value="none">Не выбран</option>
            <option value="IELTS">IELTS</option>
            <option value="TOEFL">TOEFL</option>
          </select>
          {formData.englishTest && (
            <input
              type="number"
              step="0.5"
              value={formData.englishScore || ''}
              onChange={(e) => updateFormData({ englishScore: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="input-field"
              placeholder={formData.englishTest === 'IELTS' ? '6.5' : '90'}
              max={formData.englishTest === 'IELTS' ? 9 : 120}
            />
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {formData.englishTest === 'IELTS' && formData.englishScore !== undefined && formData.englishScore < 7 && (
            'Для топ-университетов обычно требуется IELTS ≥ 7.0'
          )}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            SAT Score
          </label>
          <input
            type="number"
            value={formData.satScore || ''}
            onChange={(e) => updateFormData({ satScore: e.target.value ? parseInt(e.target.value) : undefined })}
            className="input-field"
            placeholder="1300"
            max={1600}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ACT Score
          </label>
          <input
            type="number"
            value={formData.actScore || ''}
            onChange={(e) => updateFormData({ actScore: e.target.value ? parseInt(e.target.value) : undefined })}
            className="input-field"
            placeholder="28"
            max={36}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GRE Score
          </label>
          <input
            type="number"
            value={formData.greScore || ''}
            onChange={(e) => updateFormData({ greScore: e.target.value ? parseInt(e.target.value) : undefined })}
            className="input-field"
            placeholder="310"
            max={340}
          />
          <p className="mt-1 text-sm text-gray-500">Для магистратуры</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GMAT Score
          </label>
          <input
            type="number"
            value={formData.gmatScore || ''}
            onChange={(e) => updateFormData({ gmatScore: e.target.value ? parseInt(e.target.value) : undefined })}
            className="input-field"
            placeholder="650"
            max={800}
          />
          <p className="mt-1 text-sm text-gray-500">Для MBA</p>
        </div>
      </div>
    </div>
  );
}

function AchievementsSection({ formData, updateFormData }: SectionProps) {
  const addItem = (field: keyof StudentProfile, value: string) => {
    const current = (formData[field] as string[]) || [];
    if (value.trim() && !current.includes(value.trim())) {
      updateFormData({ [field]: [...current, value.trim()] });
    }
  };

  const removeItem = (field: keyof StudentProfile, index: number) => {
    const current = (formData[field] as string[]) || [];
    updateFormData({ [field]: current.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Внеклассные достижения</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Олимпиады и конкурсы
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="Например: Призер республиканской олимпиады по математике"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addItem('olympiads', e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              addItem('olympiads', input.value);
              input.value = '';
            }}
            className="btn-secondary whitespace-nowrap"
          >
            Добавить
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.olympiads?.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
            >
              {item}
              <button
                onClick={() => removeItem('olympiads', idx)}
                className="text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Спортивные достижения
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="Например: КМС по плаванию"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addItem('sports', e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              addItem('sports', input.value);
              input.value = '';
            }}
            className="btn-secondary whitespace-nowrap"
          >
            Добавить
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.sports?.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
            >
              {item}
              <button
                onClick={() => removeItem('sports', idx)}
                className="text-green-600 hover:text-green-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Волонтерство
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="Например: Волонтер в приюте для животных (2 года)"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addItem('volunteering', e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              addItem('volunteering', input.value);
              input.value = '';
            }}
            className="btn-secondary whitespace-nowrap"
          >
            Добавить
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.volunteering?.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
            >
              {item}
              <button
                onClick={() => removeItem('volunteering', idx)}
                className="text-purple-600 hover:text-purple-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Лидерство и организации
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="Например: Президент студенческого совета"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addItem('leadership', e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              addItem('leadership', input.value);
              input.value = '';
            }}
            className="btn-secondary whitespace-nowrap"
          >
            Добавить
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.leadership?.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
            >
              {item}
              <button
                onClick={() => removeItem('leadership', idx)}
                className="text-yellow-600 hover:text-yellow-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreferencesSection({ formData, updateFormData }: SectionProps) {
  const regions: Region[] = ['USA', 'UK', 'Europe', 'Canada', 'Australia', 'Other'];
  const countries = ['USA', 'UK', 'Germany', 'France', 'Switzerland', 'Canada', 'Australia'];
  const fields = ['Computer Science', 'Engineering', 'Business', 'Medicine', 'Law', 'Arts', 'Sciences', 'Humanities'];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Предпочтения абитуриента</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Желаемые регионы
        </label>
        <div className="flex flex-wrap gap-2">
          {regions.map((region) => (
            <label key={region} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.preferredRegions?.includes(region) || false}
                onChange={(e) => {
                  const current = formData.preferredRegions || [];
                  if (e.target.checked) {
                    updateFormData({ preferredRegions: [...current, region] });
                  } else {
                    updateFormData({ preferredRegions: current.filter(r => r !== region) });
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">{region}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Желаемые страны
        </label>
        <div className="flex flex-wrap gap-2">
          {countries.map((country) => (
            <label key={country} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.preferredCountries?.includes(country) || false}
                onChange={(e) => {
                  const current = formData.preferredCountries || [];
                  if (e.target.checked) {
                    updateFormData({ preferredCountries: [...current, country] });
                  } else {
                    updateFormData({ preferredCountries: current.filter(c => c !== country) });
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">{country}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Направления обучения
        </label>
        <div className="flex flex-wrap gap-2">
          {fields.map((field) => (
            <label key={field} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.preferredFields?.includes(field) || false}
                onChange={(e) => {
                  const current = formData.preferredFields || [];
                  if (e.target.checked) {
                    updateFormData({ preferredFields: [...current, field] });
                  } else {
                    updateFormData({ preferredFields: current.filter(f => f !== field) });
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">{field}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Финансовые ограничения
        </label>
        <select
          value={formData.budget || 'both'}
          onChange={(e) => updateFormData({ budget: e.target.value as 'scholarship' | 'paid' | 'both' })}
          className="input-field"
        >
          <option value="both">Рассматриваю и стипендии, и платное обучение</option>
          <option value="scholarship">Только стипендии/бюджетное обучение</option>
          <option value="paid">Готов обучаться на платной основе</option>
        </select>
      </div>
    </div>
  );
}

function AdditionalSection({ formData, updateFormData }: SectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Дополнительная информация</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Другие языки
        </label>
        <input
          type="text"
          value={formData.languages?.join(', ') || ''}
          onChange={(e) => updateFormData({ 
            languages: e.target.value.split(',').map(l => l.trim()).filter(l => l) 
          })}
          className="input-field"
          placeholder="Например: Немецкий, Французский"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Навыки
        </label>
        <input
          type="text"
          value={formData.skills?.join(', ') || ''}
          onChange={(e) => updateFormData({ 
            skills: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
          })}
          className="input-field"
          placeholder="Например: Программирование, Дизайн"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Год окончания школы/университета
          </label>
          <input
            type="number"
            value={formData.graduationYear || ''}
            onChange={(e) => updateFormData({ 
              graduationYear: e.target.value ? parseInt(e.target.value) : undefined 
            })}
            className="input-field"
            placeholder="2024"
            min="2020"
            max="2030"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Гражданство
          </label>
          <input
            type="text"
            value={formData.citizenship || ''}
            onChange={(e) => updateFormData({ citizenship: e.target.value || undefined })}
            className="input-field"
            placeholder="Например: Казахстан"
          />
        </div>
      </div>
    </div>
  );
}