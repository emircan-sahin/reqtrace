import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { post } from '@/services/http';
import type { RequestLog } from '@/types';

export function ActionMenu({ log }: { log: RequestLog }) {
  function resend() {
    post('/api/resend', {
      url: log.url,
      method: log.method,
      headers: log.request_headers,
      body: log.request_body,
    }).catch(() => {});
  }

  function copyCurl() {
    const headers = Object.entries(log.request_headers)
      .map(([k, v]) => `-H '${k}: ${v}'`)
      .join(' ');
    const body = log.request_body ? ` -d '${log.request_body}'` : '';
    const cmd = `curl -X ${log.method} '${log.url}' ${headers}${body}`;
    navigator.clipboard.writeText(cmd);
  }

  function copyRequest() {
    navigator.clipboard.writeText(JSON.stringify({
      url: log.url,
      method: log.method,
      headers: log.request_headers,
      body: log.request_body,
    }, null, 2));
  }

  function copyResponse() {
    navigator.clipboard.writeText(JSON.stringify({
      status: log.status,
      headers: log.response_headers,
      body: log.response_body,
    }, null, 2));
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground"
        >
          <MoreVertical size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={resend}>Resend</DropdownMenuItem>
        <DropdownMenuItem onClick={copyRequest}>Copy Request</DropdownMenuItem>
        <DropdownMenuItem onClick={copyCurl}>Copy as cURL</DropdownMenuItem>
        <DropdownMenuItem onClick={copyResponse}>Copy Response</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
