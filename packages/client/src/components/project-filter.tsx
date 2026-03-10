interface ProjectFilterProps {
  projects: string[];
  selected: string | null;
  onChange: (project: string | null) => void;
}

export function ProjectFilter({ projects, selected, onChange }: ProjectFilterProps) {
  if (projects.length === 0) return null;

  return (
    <select
      value={selected ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded px-2 py-1 outline-none hover:border-zinc-600 transition-colors"
    >
      <option value="">All projects</option>
      {projects.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
