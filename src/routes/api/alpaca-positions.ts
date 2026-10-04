import { createFileRoute } from '@tanstack/react-router';
import { positions } from '@/lib/trading-demo';

export const Route = createFileRoute('/api/alpaca-positions')({
  server: { handlers: { GET: async () => Response.json({ source: 'demo', positions }, { headers: { 'Cache-Control': 'no-store' } }) } },
});
