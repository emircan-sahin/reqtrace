import { useState } from 'react';
import { Download, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConnectionStore } from '@/stores/use-connection-store';
import { useLogStore } from '@/stores/use-log-store';
import { useFilterStore } from '@/stores/use-filter-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { del, post, download } from '@/services/http';
import { SearchInput } from './search-input';
import { ProjectFilter } from './project-filter';
import { FilterBar } from './filter-bar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildServerFilters } from '@/hooks/use-server-filters';

export function Header() {
  const connected = useConnectionStore((s) => s.connected);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Exports whatever the current filters describe, not just the loaded window.
  const handleExport = async (format: 'ndjson' | 'har') => {
    if (exporting) return;
    setExporting(true);
    try {
      await download('/api/logs/export', { ...buildServerFilters().params, format });
    } catch {
      // nothing downloaded; the user still sees the unchanged view
    } finally {
      setExporting(false);
    }
  };

  const handleClear = async () => {
    if (clearing) return;
    if (!window.confirm('Delete every stored request log? This cannot be undone.')) return;

    setClearing(true);
    try {
      await del('/api/logs');
      // Reset locally too — the server broadcast also reaches other tabs.
      useLogStore.getState().reset();
      useFilterStore.getState().setProjects([]);
      useConnectionStore.getState().bumpDataEpoch();
    } catch {
      // Server still holds the data; leave the view untouched rather than lying.
    } finally {
      setClearing(false);
    }
  };

  const handleLogout = () => {
    post('/api/auth/logout', {}).catch(() => {});
    logout();
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">reqtrace</h1>
        <Badge
          variant="outline"
          className={`text-xs gap-1.5 border-transparent ${
            connected ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          />
          {connected ? 'Connected' : 'Disconnected'}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <FilterBar />
        <SearchInput />
        <ProjectFilter />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" disabled={exporting} title="Export logs">
              <Download className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('ndjson')}>
              Export NDJSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('har')}>
              Export HAR
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" onClick={handleClear} disabled={clearing}>
          {clearing ? 'Clearing...' : 'Clear'}
        </Button>
        {token && (
          <Button variant="ghost" size="icon-sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
