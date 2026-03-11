import { TooltipProvider } from '@/components/ui/tooltip';
import { useWebSocket } from '@/hooks/use-websocket';
import { useLogLoader } from '@/hooks/use-log-loader';
import { Header } from '@/components/header';
import { StatsBar } from '@/components/stats-bar';
import { LogFeed } from '@/components/log-feed';

export function App() {
  useWebSocket();
  const { loadMore } = useLogLoader();

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col">
        <Header />
        <StatsBar />
        <LogFeed loadMore={loadMore} />
      </div>
    </TooltipProvider>
  );
}
