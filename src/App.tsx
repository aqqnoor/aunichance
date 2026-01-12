import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import { StudentProfile } from './types';
import Home from './pages/Home';
import Results from './pages/Results';
import Profile from './pages/Profile';
import Search from './pages/Search';
import Layout from './components/Layout';

function App() {
  const [profile, setProfile] = useState<StudentProfile>({});

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
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
          <Route 
            path="/search" 
            element={<Search />} 
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;