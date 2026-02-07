
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

  useEffect(() => {
    // show recovered indicator when backend flips from false -> true
    if (prevAvailable.current === false && backendAvailable === true) {
      setRecoveredVisible(true);
      setTimeout(() => setRecoveredVisible(false), 3000);
      setAttempts(0);
      setCurrentInterval(RETRY_INTERVAL);
    }

    // start countdown only if backend is unavailable
    if (backendAvailable === false) {
      setCountdown(currentInterval);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = window.setInterval(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else {
      // clear interval when backend becomes available
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    prevAvailable.current = backendAvailable ?? null;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [backendAvailable, currentInterval]);

  useEffect(() => {
    if (countdown <= 0 && backendAvailable === false) {
      // auto retry
      if (!AUTO_RETRY) {
        // reset countdown but do not auto retry
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, backendAvailable, currentInterval, attempts]);

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center">
                <span className="text-2xl font-bold text-primary-600">UniChance</span>
              </Link>

              <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                <Link
                  to="/"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === '/'
                      ? 'border-primary-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Главная
                </Link>

                <Link
                  to="/search"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === '/search'
                      ? 'border-primary-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Поиск
                </Link>

                <Link
                  to="/profile"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === '/profile'
                      ? 'border-primary-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Профиль
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {backendAvailable === false && (
        <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-center py-2 flex items-center justify-center gap-4">
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <div>Сервер временно недоступен — некоторые функции могут быть отключены.</div>
            <div className="text-sm text-yellow-700">Автоповтор через {countdown}s</div>
            {MAX_RETRIES > 0 && (
              <div className="text-sm text-yellow-700">Попыток: {attempts}/{MAX_RETRIES}</div>
            )}
          </div>
          <button onClick={handleRetry} className="ml-2 px-3 py-1 bg-yellow-100 rounded text-yellow-800 text-sm">
            Попробовать снова
          </button>
        </div>
      )}
      {recoveredVisible && (
        <div className="bg-green-50 border-b border-green-200 text-green-800 text-center py-2">
          Сервер восстановлен — все функции доступны.
        </div>
      )}

      <main>
        <Outlet />
      </main>
    </div>
  );
}
