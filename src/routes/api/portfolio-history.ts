import { createFileRoute } from '@tanstack/react-router';

const PAPER_BASE = 'https://paper-api.alpaca.markets';

export const Route = createFileRoute('/api/portfolio-history')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'Cache-Control': 'no-store' };
        const key = process.env['ALPACA_API_KEY'];
        const secret = process.env['ALPACA_SECRET_KEY'];

        // No keys configured yet → demo fixtures so the UI keeps working.
        if (!key || !secret) {
          return Response.json({ source: 'demo', points: null }, { headers });
        }

        try {
          const res = await fetch(`${PAPER_BASE}/v2/account/portfolio/history?period=1Y&timeframe=1D`, {
            headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret },
          });
          if (!res.ok) throw new Error(`Alpaca portfolio/history → ${res.status}`);
          const data = (await res.json()) as { timestamp?: number[]; equity?: (number | null)[]; base_value?: number };
          const points = (data.timestamp ?? [])
            .map((t, i) => ({ t: t * 1000, equity: data.equity?.[i] ?? null }))
            .filter((p): p is { t: number; equity: number } => p.equity !== null);
          if (points.length === 0) throw new Error('Alpaca 沒有回傳投資組合歷史');
          return Response.json(
            { source: 'alpaca-paper', base_value: data.base_value ?? null, points },
            { headers },
          );
        } catch (err) {
          return Response.json(
            { source: 'error', error: err instanceof Error ? err.message : 'Alpaca request failed', points: null },
            { status: 502, headers },
          );
        }
      },
    },
  },
});
