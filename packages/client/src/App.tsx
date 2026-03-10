import { useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { useSocket } from './hooks/use-socket';
import { useStats } from './hooks/use-stats';
import { StatsBar } from './components/stats-bar';
import { LogFeed } from './components/log-feed';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3100';

export function App() {
  const { logs, pending, connected, clear } = useSocket(SERVER_URL);
  const stats = useStats(logs);
  const [autoScroll, setAutoScroll] = useState(true);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">reqtrace</h1>
          <span
            className={`flex items-center gap-1.5 text-xs ${
              connected ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <button
          onClick={clear}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
        >
          Clear
        </button>
      </header>

      {/* Stats */}
      <StatsBar stats={stats}>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`ml-auto p-1 rounded transition-colors ${
            autoScroll
              ? 'text-white bg-zinc-800'
              : 'text-zinc-600 hover:text-white hover:bg-zinc-800'
          }`}
          title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
        >
          <ArrowDown size={14} />
        </button>
      </StatsBar>

      {/* Log Feed */}
      <LogFeed logs={logs} pending={pending} autoScroll={autoScroll} />
    </div>
  );
}
