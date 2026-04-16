import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ProxyBadge({ host, port, onClick }: { host: string; port: number | null; onClick?: () => void }) {
  const label = port ? `${host}:${port}` : host;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`font-mono text-[10px] rounded text-purple-400 border-purple-500/30 ${onClick ? 'cursor-pointer hover:bg-purple-500/10' : 'cursor-default'}`}
          onClick={onClick}
        >
          Proxy {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{onClick ? 'Click to filter' : 'Proxy: '}{label}</TooltipContent>
    </Tooltip>
  );
}
