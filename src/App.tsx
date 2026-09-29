import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CardDetailPage } from './pages/CardDetailPage';
import { CollectionPage } from './pages/CollectionPage';
import { HomePage } from './pages/HomePage';
import { LogPage } from './pages/LogPage';

function RideRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/', search: location.search }} replace />;
}

function AppRoutes() {
  const location = useLocation();
  const onHome = location.pathname === '/';
  return (
    <>
      <div className="home-keep" hidden={!onHome}>
        <HomePage />
      </div>
      <Routes>
        <Route path="/" element={null} />
        <Route path="/ride" element={<RideRedirect />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/log" element={<LogPage />} />
        <Route path="/card/:id" element={<CardDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </BrowserRouter>
  );
}
