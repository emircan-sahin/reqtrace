import { useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useWebSocket } from '@/hooks/use-websocket';
import { useLogLoader } from '@/hooks/use-log-loader';
import { useAuthStore } from '@/stores/use-auth-store';
import { get } from '@/services/http';
import { Header } from '@/components/header';
import { StatsBar } from '@/components/stats-bar';
import { LogFeed } from '@/components/log-feed';
import { AuthPage } from '@/components/auth-page';

function Dashboard() {
  useWebSocket();
  const { loadMore } = useLogLoader();

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <StatsBar />
      <LogFeed loadMore={loadMore} />
    </div>
  );
}

export function App() {
  const token = useAuthStore((s) => s.token);
  const registered = useAuthStore((s) => s.registered);
  const setRegistered = useAuthStore((s) => s.setRegistered);
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    get<{ registered: boolean }>('/api/auth/status')
      .then((data) => {
        setRegistered(data.registered);
        setAuthEnabled(true);
      })
      .catch(() => {
        setAuthEnabled(false);
      });
  }, [setRegistered]);

  // Loading
  if (authEnabled === null) return null;

  // Auth not enabled (test mode) — show dashboard directly
  if (!authEnabled) {
    return (
      <TooltipProvider>
        <Dashboard />
      </TooltipProvider>
    );
  }

  // Auth enabled but not logged in
  if (!token) {
    return <AuthPage />;
  }

  return (
    <TooltipProvider>
      <Dashboard />
    </TooltipProvider>
  );
}
