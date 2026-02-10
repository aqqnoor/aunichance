import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentProfile, Region } from '../types';

interface HomeProps {
  profile: StudentProfile;
  setProfile: (profile: StudentProfile) => void;
}

export default function Home({ profile, setProfile }: HomeProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    gpa: profile.gpa?.toString() || '',
    gpaScale: profile.gpaScale || '4.0',
    englishTest: profile.englishTest || 'none',
    englishScore: profile.englishScore?.toString() || '',
    achievements: profile.otherAchievements?.join(', ') || '',
    region: (profile.preferredRegions?.[0] as Region) || 'USA',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newProfile: StudentProfile = {
      ...profile,
      gpa: formData.gpa ? parseFloat(formData.gpa) : undefined,
      gpaScale: formData.gpaScale as '4.0' | '5.0' | '100',
      englishTest: formData.englishTest === 'none' ? undefined : formData.englishTest as 'IELTS' | 'TOEFL',
      englishScore: formData.englishScore ? parseFloat(formData.englishScore) : undefined,
      otherAchievements: formData.achievements 
        ? formData.achievements.split(',').map(a => a.trim()).filter(a => a)
        : undefined,
      preferredRegions: [formData.region],
    };

    setProfile(newProfile);
    navigate('/results');
  };

  return (
    <div className="w-full overflow-hidden">
      {/* Hero Section with Gradient */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl animate-float"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-accent-300 rounded-full mix-blend-multiply filter blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-warning-300 rounded-full mix-blend-multiply filter blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 animate-slide-up">
              <div className="mb-4">
                <span className="inline-block px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
                  ✨ Технология умного подбора
                </span>
              </div>
              <h1 className="text-5xl md:text-6xl font-black mb-6 text-gradient-primary leading-tight">
                Узнайте свои шансы
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 mb-8 leading-relaxed">
                UniChance использует передовой алгоритм для анализа вашего профиля и подбора лучших университетов
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => navigate('/search')}
                  className="btn-primary text-lg"
                >
                  🔍 Начать поиск
                </button>
                <button 
                  onClick={() => navigate('/smart-search')}
                  className="btn-secondary text-lg"
                >
                  ✨ Умный подбор
                </button>
              </div>
            </div>

            <div className="flex-1 relative">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-2xl opacity-20"></div>
                <div className="relative bg-gradient-to-br from-primary-50 to-accent-50 rounded-2xl p-8 border border-primary-200/50 shadow-strong">
                  <div className="space-y-6">
                    {[
                      { icon: '🎓', label: 'GPA 3.8', value: 'Отличная оценка' },
                      { icon: '📝', label: 'IELTS 7.5', value: 'Высокий уровень' },
                      { icon: '🏆', label: '5 достижений', value: 'Конкурентный профиль' },
                      { icon: '🌍', label: 'USA + UK', value: 'Выбранные регионы' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-100 hover-lift">
                        <span className="text-3xl">{item.icon}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-600">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Form Section */}
      <section className="py-16 md:py-24 bg-white relative">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Заполните ваш профиль</h2>
            <p className="text-lg text-gray-600">Несколько основных параметров для точной оценки</p>
          </div>

          <div className="card-elevated">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* GPA Field */}
              <div className="space-y-3">
                <label className="input-label">💯 Ваш средний балл (GPA)</label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={formData.gpaScale === '100' ? '100' : formData.gpaScale}
                    value={formData.gpa}
                    onChange={(e) => setFormData({ ...formData, gpa: e.target.value })}
                    className="input-field flex-1"
                    placeholder={formData.gpaScale === '100' ? '85.5' : '3.5'}
                    required
                  />
                  <select
                    value={formData.gpaScale}
                    onChange={(e) => setFormData({ ...formData, gpaScale: e.target.value as any })}
                    className="input-field w-40"
                  >
                    <option value="4.0">Шкала 4.0</option>
                    <option value="5.0">Шкала 5.0</option>
                    <option value="100">Процент</option>
                  </select>
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <span>ℹ️</span>
                  Укажите ваш средний балл по выбранной шкале
                </p>
              </div>

              {/* English Test */}
              <div className="space-y-3">
                <label className="input-label">🌐 Уровень английского</label>
                <div className="flex gap-3">
                  <select
                    value={formData.englishTest}
                    onChange={(e) => setFormData({ ...formData, englishTest: e.target.value as any })}
                    className="input-field flex-1"
                  >
                    <option value="none">Не сдавал</option>
                    <option value="IELTS">IELTS</option>
                    <option value="TOEFL">TOEFL</option>
                  </select>
                  {formData.englishTest !== 'none' && (
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max={formData.englishTest === 'IELTS' ? '9' : '120'}
                      value={formData.englishScore}
                      onChange={(e) => setFormData({ ...formData, englishScore: e.target.value })}
                      className="input-field w-40"
                      placeholder={formData.englishTest === 'IELTS' ? '6.5' : '90'}
                    />
                  )}
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <span>ℹ️</span>
                  {formData.englishTest === 'none' 
                    ? 'Результаты тестов помогут уточнить оценку'
                    : `Ваш балл в ${formData.englishTest}`
                  }
                </p>
              </div>

              {/* Achievements */}
              <div className="space-y-3">
                <label className="input-label">🏆 Основные достижения (опционально)</label>
                <input
                  type="text"
                  value={formData.achievements}
                  onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
                  className="input-field"
                  placeholder="Олимпиады, волонтерство, спорт, лидерство..."
                />
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <span>ℹ️</span>
                  Перечислите через запятую ваши значимые достижения
                </p>
              </div>

              {/* Region */}
              <div className="space-y-3">
                <label className="input-label">🌍 Желаемый регион обучения</label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value as Region })}
                  className="input-field"
                >
                  <option value="USA">🇺🇸 США</option>
                  <option value="UK">🇬🇧 Великобритания</option>
                  <option value="Europe">🇪🇺 Европа</option>
                  <option value="Canada">🇨🇦 Канада</option>
                  <option value="Australia">🇦🇺 Австралия</option>
                  <option value="Other">🌐 Другое</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button type="submit" className="btn-primary w-full text-lg py-4 font-bold">
                  🎯 Оценить мои шансы
                </button>
              </div>

              {/* Additional Link */}
              <div className="pt-4 border-t border-gray-100 text-center">
                <p className="text-gray-600">
                  Хотите более точную оценку?{' '}
                  <a href="/profile" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                    Заполните подробный профиль →
                  </a>
                </p>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Почему UniChance?</h2>
            <p className="text-lg text-gray-600">Всё что нужно для успешного поступления в один сервис</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                emoji: '⚡',
                title: 'Быстро',
                description: 'Получите оценку своих шансов за несколько секунд благодаря передовому алгоритму',
              },
              {
                emoji: '🎯',
                title: 'Точно',
                description: 'Анализ основан на актуальных данных 100+ университетов и требованиях приёма',
              },
              {
                emoji: '💡',
                title: 'Полезно',
                description: 'Получайте персональные рекомендации по улучшению вашего профиля',
              },
              {
                emoji: '📊',
                title: 'Данные в реальном времени',
                description: 'Актуальная информация о требованиях, стоимости и стипендиях',
              },
              {
                emoji: '🔐',
                title: 'Безопасно',
                description: 'Ваши данные защищены и не передаются третьим лицам',
              },
              {
                emoji: '🌐',
                title: 'Глобально',
                description: 'Поиск и анализ университетов по всему миру',
              },
            ].map((feature, i) => (
              <div key={i} className="card-gradient hover-lift">
                <div className="text-4xl mb-4">{feature.emoji}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-gradient-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 bg-white rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-white rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Готовы найти свой идеальный университет?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Начните своё путешествие к успеху прямо сейчас
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/smart-search')}
              className="px-8 py-4 bg-white text-primary-600 rounded-xl font-bold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Начать сейчас →
            </button>
            <a 
              href="/search"
              className="px-8 py-4 border-2 border-white text-white rounded-xl font-bold hover:bg-white/20 transition-all duration-300"
            >
              Просмотреть программы
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}