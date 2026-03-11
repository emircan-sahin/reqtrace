import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFilterStore } from '@/stores/use-filter-store';

export function SearchInput({ debounceMs = 300 }: { debounceMs?: number }) {
  const search = useFilterStore((s) => s.search);
  const setSearch = useFilterStore((s) => s.setSearch);
  const [local, setLocal] = useState(search);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocal(search);
  }, [search]);

  const handleChange = (v: string) => {
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearch(v), debounceMs);
  };

  const handleClear = () => {
    setLocal('');
    clearTimeout(timerRef.current);
    setSearch('');
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="relative flex items-center">
      <Search size={12} className="absolute left-2 text-muted-foreground pointer-events-none z-10" />
      <Input
        type="text"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search URL, method, error..."
        className="h-8 w-52 pl-6 pr-7 text-xs shadow-none"
      />
      {local && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleClear}
          className="absolute right-0.5 h-5 w-5 text-muted-foreground hover:text-foreground"
        >
          <X size={12} />
        </Button>
      )}
    </div>
  );
}
