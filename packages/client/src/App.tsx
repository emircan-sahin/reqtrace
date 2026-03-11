import { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import { useSocket } from './hooks/use-socket';
import { useStats } from './hooks/use-stats';
import { StatsBar } from './components/stats-bar';
import { LogFeed } from './components/log-feed';
import { ProjectFilter } from './components/project-filter';
import { SearchInput } from './components/search-input';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3100';

export function App() {
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<string[]>([]);
  const { logs, pending, connected, hasMore, loadMore, clear } = useSocket(SERVER_URL, selectedProject, search);

  // Fetch project list from server
  useEffect(() => {
    fetch(`${SERVER_URL.replace(/\/+$/, '')}/api/projects`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setProjects(data.projects); })
      .catch(() => {});
  }, []);

  // Update project list from incoming logs
  useEffect(() => {
    const seen = new Set(projects);
    let changed = false;
    for (const log of logs) {
      if (!seen.has(log.project)) {
        seen.add(log.project);
        changed = true;
      }
    }
    if (changed) setProjects([...seen].sort());
  }, [logs, projects]);

  // Client-side filter for real-time WS messages (API logs already filtered)
  const matchesSearch = useCallback((text: string) => {
    if (!search) return true;
    return text.toLowerCase().includes(search.toLowerCase());
  }, [search]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (selectedProject) {
      result = result.filter((l) => l.project === selectedProject);
    }
    if (search) {
      result = result.filter((l) =>
        matchesSearch(l.url) ||
        matchesSearch(l.method) ||
        (l.status !== null && String(l.status).includes(search)) ||
        (l.error_message && matchesSearch(l.error_message)) ||
        (l.proxy_host && matchesSearch(l.proxy_host)),
      );
    }
    return result;
  }, [logs, selectedProject, search, matchesSearch]);

  const filteredPending = useMemo(() => {
    if (!selectedProject && !search) return pending;
    const filtered = new Map(pending);
    for (const [id, entry] of filtered) {
      const projectMatch = !selectedProject || entry.project === selectedProject;
      const searchMatch = !search || matchesSearch(entry.url) || matchesSearch(entry.method);
      if (!projectMatch || !searchMatch) filtered.delete(id);
    }
    return filtered;
  }, [pending, selectedProject, search, matchesSearch]);

  const stats = useStats(filteredLogs);

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
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} />
          <ProjectFilter
            projects={projects}
            selected={selectedProject}
            onChange={setSelectedProject}
          />
          <button
            onClick={clear}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
          >
            Clear
          </button>
        </div>
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
      <LogFeed logs={filteredLogs} pending={filteredPending} autoScroll={autoScroll} hasMore={hasMore} loadMore={loadMore} />
    </div>
  );
}
