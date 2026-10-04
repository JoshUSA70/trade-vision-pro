import { createFileRoute } from '@tanstack/react-router';

const UNIVERSE = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 211.35 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 142.56 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.50 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 418.92 },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 575.20 },
];

function signalFor(rsi: number): { signal: string; kind: 'buy' | 'sell' | 'hold' } {
  if (rsi < 40) return { signal: '買入', kind: 'buy' };
  if (rsi > 60) return { signal: '賣出', kind: 'sell' };
  return { signal: '觀望', kind: 'hold' };
}

export const Route = createFileRoute('/api/scan')({
  server: {
    handlers: {
      GET: async () => {
        const signals = UNIVERSE.map((s) => {
          const rsi = Math.round((30 + Math.random() * 40) * 10) / 10;
          const { signal, kind } = signalFor(rsi);
          const score = Math.round(100 - Math.abs(50 - rsi) * 2);
          return { ...s, rsi, signal, kind, score };
        });
        return Response.json(
          { source: 'demo', scanned_at: new Date().toISOString(), signals },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      },
    },
  },
});
