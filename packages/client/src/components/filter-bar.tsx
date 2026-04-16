import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFilterStore, type StatusRange, type ModeFilter } from '@/stores/use-filter-store';

export function FilterBar() {
  const mode = useFilterStore((s) => s.mode);
  const statusRange = useFilterStore((s) => s.statusRange);
  const selectedProxy = useFilterStore((s) => s.selectedProxy);
  const setMode = useFilterStore((s) => s.setMode);
  const setStatusRange = useFilterStore((s) => s.setStatusRange);
  const setSelectedProxy = useFilterStore((s) => s.setSelectedProxy);
  const clearFilters = useFilterStore((s) => s.clearFilters);

  const hasActiveFilters = mode !== 'all' || statusRange !== 'all' || selectedProxy !== null;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={mode}
        onValueChange={(v) => setMode(v as ModeFilter)}
      >
        <SelectTrigger className="h-8 w-28 text-xs shadow-none">
          <SelectValue>{mode === 'all' ? 'All' : mode}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={statusRange}
        onValueChange={(v) => setStatusRange(v as StatusRange)}
      >
        <SelectTrigger className="h-8 w-20 text-xs shadow-none">
          <SelectValue>{statusRange === 'all' ? 'All' : statusRange}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="2xx">2xx</SelectItem>
          <SelectItem value="3xx">3xx</SelectItem>
          <SelectItem value="4xx">4xx</SelectItem>
          <SelectItem value="5xx">5xx</SelectItem>
        </SelectContent>
      </Select>

      {selectedProxy && (
        <Badge
          variant="outline"
          className="gap-1 h-7 pl-2 pr-1 text-xs font-mono text-purple-400 border-purple-500/30"
        >
          {selectedProxy}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setSelectedProxy(null)}
            className="h-4 w-4 text-purple-400/60 hover:text-purple-400 hover:bg-purple-500/10"
          >
            <X size={12} />
          </Button>
        </Badge>
      )}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
