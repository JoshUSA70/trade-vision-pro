import { createFileRoute } from '@tanstack/react-router';

// S&P 100 成分股中流動性最高的代表名單
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

type YahooChart = {
  chart?: {
    result?: Array<{ indicators?: { quote?: Array<{ close?: (number | null)[] }> } }>;
    error?: unknown;
  };
};

// Yahoo Finance 免費日線（免 key）。注意：非官方接口，失敗時退回示範資料。
async function fetchCloses(symbol: string): Promise<number[] | null> {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    try {
      const res = await fetch(`https://${host}/v8/finance/chart/${symbol}?range=3mo&interval=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as YahooChart;
      const raw = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      if (!Array.isArray(raw)) continue;
      const closes = raw.filter((c): c is number => typeof c === 'number' && Number.isFinite(c));
      if (closes.length >= 15) return closes;
    } catch {
      continue;
    }
  }
  return null;
}

function demoSignals() {
  return DEMO_FALLBACK.map((s) => {
    const rsi = Math.round((30 + Math.random() * 40) * 10) / 10;
    const { signal, kind } = signalFor(rsi);
    return { ...s, rsi, signal, kind, score: scoreFor(rsi) };
  });
}

export const Route = createFileRoute('/api/scan')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const results = await Promise.all(
            UNIVERSE.map(async (s) => {
              const closes = await fetchCloses(s.symbol);
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
          if (signals.length === 0) throw new Error('市場數據暫時無法取得');
          return Response.json(
            { source: 'yahoo', scanned_at: new Date().toISOString(), signals },
            { headers },
          );
        } catch (err) {
          return Response.json(
            {
              source: 'error',
              error: err instanceof Error ? err.message : '掃描請求失敗',
              scanned_at: new Date().toISOString(),
              signals: demoSignals(),
            },
            { status: 502, headers },
          );
        }
      },
    },
  },
});
