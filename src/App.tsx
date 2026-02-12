import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { StudentProfile } from './types';
import { apiGet } from './lib/api';

import Home from './pages/Home';
import Results from './pages/Results';
import Profile from './pages/Profile';
import University from "./pages/University";


import Layout from './components/Layout';

function App() {
  const [profile, setProfile] = useState<StudentProfile>({});
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await apiGet('/health');
        if (mounted) setBackendAvailable(true);
      } catch (e) {
        if (mounted) setBackendAvailable(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const recheckBackend = async () => {
    try {
      await apiGet('/health');
      setBackendAvailable(true);
    } catch (e) {
      setBackendAvailable(false);
      throw e;
    }
  };

  return (
    <Routes>
      {/* Layout — parent */}
      <Route element={<Layout backendAvailable={backendAvailable} recheckBackend={recheckBackend} />}>
        <Route
          path="/"
          element={<Home profile={profile} setProfile={setProfile} />}
        />
        <Route
          path="/results"
          element={<Results profile={profile} />}
        />
        <Route
          path="/profile"
          element={<Profile profile={profile} setProfile={setProfile} />}
        />

        <Route path="/universities/:id" element={<University />} />

      </Route>
    </Routes>
  );
}

export default App;
