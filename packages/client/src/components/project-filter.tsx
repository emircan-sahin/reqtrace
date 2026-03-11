import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFilterStore } from '@/stores/use-filter-store';

export function ProjectFilter() {
  const projects = useFilterStore((s) => s.projects);
  const selectedProject = useFilterStore((s) => s.selectedProject);
  const setSelectedProject = useFilterStore((s) => s.setSelectedProject);

  if (projects.length === 0) return null;

  return (
    <Select
      value={selectedProject ?? '__all__'}
      onValueChange={(v) => setSelectedProject(v === '__all__' ? null : v)}
    >
      <SelectTrigger size="sm" className="text-xs shadow-none">
        <SelectValue placeholder="All projects" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All projects</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p} value={p}>{p}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
