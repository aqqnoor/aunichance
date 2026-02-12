
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

const RETRY_INTERVAL = Number(import.meta.env.VITE_HEALTH_RETRY_INTERVAL) || 10; // seconds
const AUTO_RETRY = import.meta.env.VITE_HEALTH_AUTO_RETRY !== 'false';
const MAX_RETRIES = Number(import.meta.env.VITE_HEALTH_RETRY_MAX) || 0; // 0 = unlimited
const MAX_INTERVAL = Number(import.meta.env.VITE_HEALTH_RETRY_MAX_INTERVAL) || 300; // seconds

export default function Layout({ backendAvailable, recheckBackend }: { backendAvailable?: boolean | null; recheckBackend?: () => Promise<void> }) {
  const location = useLocation();
  const [countdown, setCountdown] = useState<number>(RETRY_INTERVAL);
  const intervalRef = useRef<number | null>(null);
  const [attempts, setAttempts] = useState<number>(0);
  const [currentInterval, setCurrentInterval] = useState<number>(RETRY_INTERVAL);
  const [recoveredVisible, setRecoveredVisible] = useState<boolean>(false);
  const prevAvailable = useRef<boolean | null>(null);

  // useEffect(() => {
  //   // show recovered indicator when backend flips from false -> true
  //   if (prevAvailable.current === false && backendAvailable === true) {
  //     setRecoveredVisible(true);
  //     setTimeout(() => setRecoveredVisible(false), 3000);
  //     setAttempts(0);
  //     setCurrentInterval(RETRY_INTERVAL);
  //   }

  //   // start countdown only if backend is unavailable
  //   if (backendAvailable === false) {
  //     setCountdown(currentInterval);
  //     if (intervalRef.current) {
  //       clearInterval(intervalRef.current);
  //     }
  //     intervalRef.current = window.setInterval(() => {
  //       setCountdown((c) => c - 1);
  //     }, 1000);
  //   } else {
  //     // clear interval when backend becomes available
  //     if (intervalRef.current) {
  //       clearInterval(intervalRef.current);
  //       intervalRef.current = null;
  //     }
  //   }

  //   prevAvailable.current = backendAvailable ?? null;

  //   return () => {
  //     if (intervalRef.current) {
  //       clearInterval(intervalRef.current);
  //       intervalRef.current = null;
  //     }
  //   };
  // }, [backendAvailable, currentInterval]);

  useEffect(() => {
    // Только когда таймер доходит до 0 И бэкенд недоступен
    if (countdown > 0 || backendAvailable !== false) return;
    
    // auto retry
    if (!AUTO_RETRY) {
      setCountdown(currentInterval);
      return;
    }

    if (MAX_RETRIES > 0 && attempts >= MAX_RETRIES) {
      // reached max attempts, stop auto retry
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (recheckBackend) {
      setAttempts((a) => a + 1);
      recheckBackend()
        .then(() => {
          // recovered
          setAttempts(0);
          setCurrentInterval(RETRY_INTERVAL);
          setRecoveredVisible(true);
          setTimeout(() => setRecoveredVisible(false), 3000);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        })
        .catch(() => {
          // failed -> increase interval (exponential backoff)
          const next = Math.min((currentInterval || RETRY_INTERVAL) * 2, MAX_INTERVAL);
          setCurrentInterval(next);
          setCountdown(next);
        });
    } else {
      setCountdown(currentInterval);
    }
  }, [countdown, backendAvailable, attempts]); // убрал currentInterval из зависимостей

  const handleRetry = async () => {
    setCountdown(RETRY_INTERVAL);
    setAttempts(0);
    setCurrentInterval(RETRY_INTERVAL);
    if (recheckBackend) {
      try {
        await recheckBackend();
        // show recovered indicator
        setRecoveredVisible(true);
        setTimeout(() => setRecoveredVisible(false), 3000);
      } catch (e) {
        // ignore, banner stays
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/50 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2 group">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-primary rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative px-4 py-2 bg-gradient-primary rounded-xl">
                    <span className="text-2xl font-black text-white">UC</span>
                  </div>
                </div>
                <div>
                  <span className="text-2xl font-black bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">UniChance</span>
                  <p className="text-xs text-gray-500 font-medium">Smart Matching</p>
                </div>
              </Link>

              {/* Navigation Links */}
              <div className="hidden sm:flex gap-1">
                {[
                  { path: '/', label: '🏠 Главная' },
                  { path: '/search', label: '🔍 Поиск и умный анализ' },
                  { path: '/profile', label: '👤 Профиль' },
                ].map((link) => {
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`
                        relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300
                        ${isActive
                          ? 'bg-gradient-primary text-white shadow-medium'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }
                      `}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side - Status indicator */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2">
                {backendAvailable !== false ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-success-50 border border-success-200 rounded-lg">
                    <span className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></span>
                    <span className="text-xs font-medium text-success-700">Готов</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-warning-50 border border-warning-200 rounded-lg">
                    <span className="w-2 h-2 bg-warning-500 rounded-full animate-pulse"></span>
                    <span className="text-xs font-medium text-warning-700">Загрузка...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Alert Banners */}
      {backendAvailable === false && (
        <div className="bg-gradient-to-r from-warning-50 to-warning-100/50 border-b border-warning-200/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-semibold text-warning-900">Сервер временно недоступен</p>
                  <p className="text-sm text-warning-700">Некоторые функции могут быть отключены</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-warning-700 font-medium">Повтор через {countdown}s</span>
                {MAX_RETRIES > 0 && (
                  <span className="text-sm text-warning-700">({attempts}/{MAX_RETRIES})</span>
                )}
                <button 
                  onClick={handleRetry} 
                  className="ml-2 px-4 py-1.5 bg-white text-warning-700 rounded-lg text-sm font-medium hover:bg-warning-50 transition-colors border border-warning-300"
                >
                  Попробовать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {recoveredVisible && (
        <div className="bg-gradient-to-r from-success-50 to-success-100/50 border-b border-success-200/50 backdrop-blur-sm animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
            <span className="text-xl">✅</span>
            <p className="font-semibold text-success-900">Сервер восстановлен — все функции доступны</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200/50 bg-gradient-to-t from-gray-50 to-transparent backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Об UniChance</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Платформа для умного подбора и поступления в университеты
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Ссылки</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="text-gray-600 hover:text-primary-600 transition-colors">Главная</Link></li>
                <li><Link to="/search" className="text-gray-600 hover:text-primary-600 transition-colors">Поиск</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Статус</h3>
              <p className="text-sm text-gray-600">
                {backendAvailable === true ? '✅ Все системы работают' : '⚠️ Некоторые системы недоступны'}
              </p>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
            <p>© 2026 UniChance. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
