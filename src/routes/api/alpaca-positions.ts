import { createFileRoute } from '@tanstack/react-router';
import { positions as demoPositions } from '@/lib/trading-demo';

const PAPER_BASE = 'https://paper-api.alpaca.markets';

async function alpacaGet(path: string, key: string, secret: string) {
  const res = await fetch(`${PAPER_BASE}${path}`, {
    headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret },
  });
  if (!res.ok) throw new Error(`Alpaca ${path} → ${res.status}`);
  return res.json();
}

export const Route = createFileRoute('/api/alpaca-positions')({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env['ALPACA_API_KEY'];
        const secret = process.env['ALPACA_SECRET_KEY'];
        const headers = { 'Cache-Control': 'no-store' };

        // No keys configured yet → demo fixtures so the UI keeps working.
        if (!key || !secret) {
          return Response.json({ source: 'demo', account: null, positions: demoPositions }, { headers });
        }

        try {
          const [account, rawPositions] = await Promise.all([
            alpacaGet('/v2/account', key, secret),
            alpacaGet('/v2/positions', key, secret),
          ]);
          const positions = (rawPositions as Array<Record<string, string>>).map((p) => ({
            symbol: p.symbol,
            qty: Number(p.qty),
            avg_price: Number(p.avg_entry_price),
            market_price: Number(p.current_price),
            pnl: Number(p.unrealized_pl),
            change: Number(p.unrealized_plpc) * 100,
          }));
          return Response.json({
            source: 'alpaca-paper',
            account: {
              equity: Number(account.equity),
              cash: Number(account.cash),
              buying_power: Number(account.buying_power),
              portfolio_value: Number(account.portfolio_value),
            },
            positions,
          }, { headers });
        } catch (err) {
          return Response.json(
            { source: 'error', error: err instanceof Error ? err.message : 'Alpaca request failed', account: null, positions: demoPositions },
            { status: 502, headers },
          );
        }
      },
    },
  },
});
