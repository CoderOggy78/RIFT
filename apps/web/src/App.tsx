import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { TracesPage } from './pages/TracesPage';
import { TraceDetailPage } from './pages/TraceDetailPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReportsPage } from './pages/ReportsPage';
import { InvestigationsListPage } from './pages/InvestigationsListPage';
import { InvestigationWorkspacePage } from './pages/InvestigationWorkspacePage';
import { ReplayLabPage } from './pages/ReplayLabPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { GraphifyPage } from './pages/GraphifyPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="traces" element={<TracesPage />} />
            <Route path="traces/:traceId" element={<TraceDetailPage />} />
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="incidents/:incidentId" element={<IncidentDetailPage />} />
            <Route path="investigations" element={<InvestigationsListPage />} />
          </Route>
          {/* Full-screen dedicated Investigation Workspace */}
          <Route path="investigations/:traceId" element={<InvestigationWorkspacePage />} />
          <Route element={<AppLayout />}>
            <Route path="replay" element={<ReplayLabPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="graphify" element={<GraphifyPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
