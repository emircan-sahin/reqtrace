import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

export function SearchInput({ value, onChange, debounceMs = 300 }: SearchInputProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (v: string) => {
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), debounceMs);
  };

  const handleClear = () => {
    setLocal('');
    clearTimeout(timerRef.current);
    onChange('');
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="relative flex items-center">
      <Search size={12} className="absolute left-2 text-zinc-500 pointer-events-none" />
      <input
        type="text"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search URL, method, error..."
        className="text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded pl-6 pr-6 py-1 outline-none hover:border-zinc-600 focus:border-zinc-500 transition-colors w-52"
      />
      {local && (
        <button
          onClick={handleClear}
          className="absolute right-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
