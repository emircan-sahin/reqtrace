import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export function JsonTree({ value, name, defaultOpen = true }: { value: unknown; name?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  if (value === null) {
    return (
      <div className="flex">
        {name !== undefined && <span className="text-muted-foreground">{name}<span className="text-muted-foreground/50">: </span></span>}
        <span className="text-red-400">null</span>
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <div className="flex">
        {name !== undefined && <span className="text-muted-foreground">{name}<span className="text-muted-foreground/50">: </span></span>}
        <span className="text-blue-400">{String(value)}</span>
      </div>
    );
  }

  if (typeof value === 'number') {
    return (
      <div className="flex">
        {name !== undefined && <span className="text-muted-foreground">{name}<span className="text-muted-foreground/50">: </span></span>}
        <span className="text-amber-400">{value}</span>
      </div>
    );
  }

  if (typeof value === 'string') {
    return (
      <div className="flex">
        {name !== undefined && <span className="text-muted-foreground">{name}<span className="text-muted-foreground/50">: </span></span>}
        <span className="text-emerald-400 break-all">&quot;{value}&quot;</span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="flex">
          {name !== undefined && <span className="text-muted-foreground">{name}<span className="text-muted-foreground/50">: </span></span>}
          <span className="text-muted-foreground/50">[]</span>
        </div>
      );
    }

    return (
      <div>
        <div
          className="flex items-center gap-1 cursor-pointer hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        >
          <ChevronRight size={12} className={`text-muted-foreground/50 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
          {name !== undefined && <span className="text-muted-foreground">{name}</span>}
          <span className="text-muted-foreground/50">Array[{value.length}]</span>
        </div>
        {open && (
          <div className="ml-4 border-l border-border pl-2">
            {value.map((item, i) => (
              <JsonTree key={i} value={item} name={`[${i}]`} defaultOpen={false} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      return (
        <div className="flex">
          {name !== undefined && <span className="text-muted-foreground">{name}<span className="text-muted-foreground/50">: </span></span>}
          <span className="text-muted-foreground/50">{'{}'}</span>
        </div>
      );
    }

    return (
      <div>
        <div
          className="flex items-center gap-1 cursor-pointer hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        >
          <ChevronRight size={12} className={`text-muted-foreground/50 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
          {name !== undefined && <span className="text-muted-foreground">{name}</span>}
          <span className="text-muted-foreground/50">{`{${entries.length}}`}</span>
        </div>
        {open && (
          <div className="ml-4 border-l border-border pl-2">
            {entries.map(([key, val]) => (
              <JsonTree key={key} value={val} name={key} defaultOpen={false} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-foreground">{String(value)}</span>;
}
