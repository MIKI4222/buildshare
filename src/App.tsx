import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppProvider, useApp } from './store/app-context';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectNewPage } from './pages/ProjectNewPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { TaskNewPage } from './pages/TaskNewPage';

// The demo workspace is built asynchronously by the real domain reducers
// (hashing is async), so we wait for it before rendering routed pages.
function ReadyGate({ children }: { children: ReactNode }) {
  const { ready } = useApp();
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <p className="text-sm text-ink-500">Preparing workspace…</p>
      </div>
    );
  }
  return <>{children}</>;
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ReadyGate>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<DashboardPage />} />
              <Route path="/projects/new" element={<ProjectNewPage />} />
              <Route path="/projects/:projectId/tasks/new" element={<TaskNewPage />} />
              <Route path="/projects/:projectId/*" element={<ProjectDetailPage />} />
              {/* Nav entries that have no dedicated page in v0.1. */}
              <Route path="/contributions" element={<Navigate to="/dashboard" replace />} />
              <Route path="/explore" element={<Navigate to="/projects" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ReadyGate>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;