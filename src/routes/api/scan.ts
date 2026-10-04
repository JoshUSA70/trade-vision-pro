import { createFileRoute } from '@tanstack/react-router';
import { signals } from '@/lib/trading-demo';

export const Route = createFileRoute('/api/scan')({
  server: { handlers: { GET: async () => Response.json({ source: 'demo', scanned_at: new Date().toISOString(), signals }, { headers: { 'Cache-Control': 'no-store' } }) } },
});
