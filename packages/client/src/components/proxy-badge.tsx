import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ProxyBadge({ host, port }: { host: string; port: number | null }) {
  const label = port ? `${host}:${port}` : host;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="font-mono text-[10px] rounded text-purple-400 border-purple-500/30 cursor-default"
        >
          Proxy {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Proxy: {label}</TooltipContent>
    </Tooltip>
  );
}
