import { createFileRoute } from '@tanstack/react-router';

// S&P 100 成分股中流動性最高的代表名單（控制 API 呼叫量在 Finnhub 免費額度內）
const UNIVERSE = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp.' },
  { symbol: 'UNH', name: 'UnitedHealth Group' },
  { symbol: 'HD', name: 'Home Depot Inc.' },
  { symbol: 'PG', name: 'Procter & Gamble Co.' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'LLY', name: 'Eli Lilly and Co.' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
];

const DEMO_FALLBACK = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 211.35 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 142.56 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.5 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 418.92 },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 575.2 },
];

function rsi14(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= 14; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / 14;
  let avgLoss = losses / 14;
  for (let i = 15; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    avgGain = (avgGain * 13 + Math.max(diff, 0)) / 14;
    avgLoss = (avgLoss * 13 + Math.max(-diff, 0)) / 14;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

function signalFor(rsi: number): { signal: string; kind: 'buy' | 'sell' | 'hold' } {
  if (rsi < 35) return { signal: 'BUY 買入', kind: 'buy' };
  if (rsi > 70) return { signal: 'SELL 賣出', kind: 'sell' };
  return { signal: 'HOLD 觀望', kind: 'hold' };
}

// 訊號強度：離 50 越遠分數越高
function scoreFor(rsi: number): number {
  return Math.round(100 - Math.abs(50 - rsi) * 2);
}

async function fetchCloses(symbol: string, key: string): Promise<number[] | null> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 24 * 3600; // 近 60 天日線，足夠算 RSI(14)
  const res = await fetch(
    `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${key}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { s?: string; c?: number[] };
  if (data.s !== 'ok' || !Array.isArray(data.c)) return null;
  return data.c;
}

export const Route = createFileRoute('/api/scan')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'Cache-Control': 'no-store' };
        const key = process.env['FINNHUB_KEY'];

        // 未設定金鑰 → 回傳示範資料，網站不會掛掉
        if (!key) {
          const signals = DEMO_FALLBACK.map((s) => {
            const rsi = Math.round((30 + Math.random() * 40) * 10) / 10;
            const { signal, kind } = signalFor(rsi);
            return { ...s, rsi, signal, kind, score: scoreFor(rsi) };
          });
          return Response.json(
            { source: 'demo', notice: '請在環境變數設定 FINNHUB_KEY', scanned_at: new Date().toISOString(), signals },
            { headers },
          );
        }

        try {
          const results = await Promise.all(
            UNIVERSE.map(async (s) => {
              const closes = await fetchCloses(s.symbol, key);
              if (!closes || closes.length === 0) return null;
              const rsi = rsi14(closes);
              if (rsi === null) return null;
              const { signal, kind } = signalFor(rsi);
              return {
                ...s,
                price: Math.round(closes[closes.length - 1]! * 100) / 100,
                rsi,
                signal,
                kind,
                score: scoreFor(rsi),
              };
            }),
          );
          const signals = results
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // 只回傳訊號最強的前 10 檔
          if (signals.length === 0) throw new Error('Finnhub 沒有回傳可用數據');
          return Response.json(
            { source: 'finnhub', scanned_at: new Date().toISOString(), signals },
            { headers },
          );
        } catch (err) {
          const signals = DEMO_FALLBACK.map((s) => {
            const rsi = Math.round((30 + Math.random() * 40) * 10) / 10;
            const { signal, kind } = signalFor(rsi);
            return { ...s, rsi, signal, kind, score: scoreFor(rsi) };
          });
          return Response.json(
            {
              source: 'error',
              error: err instanceof Error ? err.message : 'Finnhub 請求失敗',
              scanned_at: new Date().toISOString(),
              signals,
            },
            { status: 502, headers },
          );
        }
      },
    },
  },
});
