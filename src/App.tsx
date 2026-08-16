import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { AnomaliesPage } from '@/pages/Anomalies';
import { ForecastingPage } from '@/pages/Forecasting';
import { ModelPerformancePage } from '@/pages/ModelPerformance';
import { OverviewPage } from '@/pages/Overview';
import { PatternDriftPage } from '@/pages/PatternDrift';
import { PlanningPage } from '@/pages/Planning';
import { RegionDetailPage, RegionalIntelligencePage } from '@/pages/RegionalIntelligence';
import { ReportsPage } from '@/pages/Reports';
import { Button, Card, ErrorState, ToastProvider } from '@/components/ui';
import { AppProvider } from '@/hooks/useAppContext';

/**
 * Last-resort boundary. A render error in one page should not take the whole
 * control-centre view down with it.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PIXIL render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-dvh place-items-center bg-plane p-6">
          <Card className="w-full max-w-lg">
            <ErrorState
              title="Something went wrong"
              error={this.state.error}
              onRetry={() => this.setState({ error: null })}
            />
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="text-[15px] font-semibold text-ink">Page not found</p>
        <p className="max-w-sm text-[12.5px] text-ink-secondary">
          The page you requested does not exist in this build of the platform.
        </p>
        <Button onClick={() => window.location.assign('/')} size="sm" variant="secondary">
          Return to overview
        </Button>
      </div>
    </Card>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <Router
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="forecasting" element={<ForecastingPage />} />
                <Route path="anomalies" element={<AnomaliesPage />} />
                <Route path="regional" element={<RegionalIntelligencePage />} />
                <Route path="regional/:regionId" element={<RegionDetailPage />} />
                <Route path="drift" element={<PatternDriftPage />} />
                <Route path="models" element={<ModelPerformancePage />} />
                <Route path="planning" element={<PlanningPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="overview" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Router>
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
