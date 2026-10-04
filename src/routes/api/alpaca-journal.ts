import { createFileRoute } from '@tanstack/react-router';

const PAPER_BASE = 'https://paper-api.alpaca.markets';

type AlpacaOrder = {
  symbol: string;
  side: string;
  filled_qty: string | null;
  filled_avg_price: string | null;
  filled_at: string | null;
};

export const Route = createFileRoute('/api/alpaca-journal')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'Cache-Control': 'no-store' };
        const key = process.env['ALPACA_API_KEY'];
        const secret = process.env['ALPACA_SECRET_KEY'];

        // No keys configured yet → demo fixtures so the UI keeps working.
        if (!key || !secret) {
          return Response.json({ source: 'demo', trades: null }, { headers });
        }

        try {
          const res = await fetch(`${PAPER_BASE}/v2/orders?status=closed&limit=100&direction=desc`, {
            headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret },
          });
          if (!res.ok) throw new Error(`Alpaca orders → ${res.status}`);
          const orders = (await res.json()) as AlpacaOrder[];
          const trades = orders
            .filter((o) => o.filled_at && o.filled_qty && o.filled_avg_price)
            .map((o) => {
              const filledAt = new Date(o.filled_at!);
              const qty = Number(o.filled_qty);
              const price = Number(o.filled_avg_price);
              return {
                date: filledAt.toISOString().slice(0, 10),
                time: filledAt.toISOString().slice(11, 16),
                symbol: o.symbol,
                side: o.side === 'buy' ? '買入' : '賣出',
                qty,
                price,
                amount: Math.round(qty * price * 100) / 100,
                pnl: null,
                note: '',
              };
            });
          return Response.json({ source: 'alpaca-paper', trades }, { headers });
        } catch (err) {
          return Response.json(
            { source: 'error', error: err instanceof Error ? err.message : 'Alpaca request failed', trades: null },
            { status: 502, headers },
          );
        }
      },
    },
  },
});
