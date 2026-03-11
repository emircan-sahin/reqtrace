import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConnectionStore } from '@/stores/use-connection-store';
import { useLogStore } from '@/stores/use-log-store';
import { del } from '@/services/http';
import { SearchInput } from './search-input';
import { ProjectFilter } from './project-filter';

export function Header() {
  const connected = useConnectionStore((s) => s.connected);
  const clear = useLogStore((s) => s.clear);

  const handleClear = () => {
    del('/api/logs').catch(() => {});
    clear();
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
        <SearchInput />
        <ProjectFilter />
        <Button variant="outline" size="sm" onClick={handleClear}>
          Clear
        </Button>
      </div>
    </header>
  );
}
