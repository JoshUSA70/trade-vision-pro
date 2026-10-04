import { createFileRoute } from '@tanstack/react-router';

// V2 智能選股池（15 檔）：指數 ETF + 大型科技股
const UNIVERSE = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'SMH', name: 'VanEck Semiconductor ETF' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
];

// 註：Finnhub 免費版不開放 /stock/candle（歷史 K 線一律 403），
// 故歷史數據走 Yahoo Finance 免費日線（免 key）；/quote 免費但此處收盤價已足夠。
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

type YahooChart = {
  chart?: {
    result?: Array<{
      indicators?: { quote?: Array<{ close?: (number | null)[]; volume?: (number | null)[] }> };
    }>;
  };
};

async function fetchHistory(symbol: string): Promise<{ closes: number[]; volumes: number[] } | null> {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    try {
      const res = await fetch(`https://${host}/v8/finance/chart/${symbol}?range=6mo&interval=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as YahooChart;
      const q = data.chart?.result?.[0]?.indicators?.quote?.[0];
      if (!q || !Array.isArray(q.close) || !Array.isArray(q.volume)) continue;
      const closes = q.close.filter((c): c is number => typeof c === 'number' && Number.isFinite(c));
      const volumes = q.volume.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (closes.length >= 51 && volumes.length >= 21) return { closes, volumes };
    } catch {
      continue;
    }
  }
  return null;
}

function sma(values: number[], n: number): number {
  const slice = values.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export const Route = createFileRoute('/api/scan')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const results = await Promise.all(
            UNIVERSE.map(async (s) => {
              const hist = await fetchHistory(s.symbol);
              if (!hist) return null;
              const { closes, volumes } = hist;
              const rsi = rsi14(closes);
              if (rsi === null) return null;
              const price = closes[closes.length - 1]!;
              const sma50 = sma(closes, 50);
              const todayVol = volumes[volumes.length - 1]!;
              const avgVol20 = sma(volumes.slice(0, -1), 20);
              const volume_ratio = avgVol20 > 0 ? Math.round((todayVol / avgVol20) * 100) / 100 : 0;

              let score = 0;
              if (rsi < 35) score += 40;
              else if (rsi < 40) score += 20;
              if (volume_ratio > 1.5) score += 30;
              else if (volume_ratio > 1.2) score += 15;
              if (price > sma50) score += 30;

              if (score < 60) return null;
              return {
                symbol: s.symbol,
                name: s.name,
                price: Math.round(price * 100) / 100,
                rsi,
                volume_ratio,
                score,
                signal: score > 80 ? 'STRONG_BUY' : 'BUY',
                sma50: Math.round(sma50 * 100) / 100,
              };
            }),
          );
          const signals = results
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .sort((a, b) => b.score - a.score);
          return Response.json(
            { source: 'yahoo', scanned_at: new Date().toISOString(), signals },
            { headers },
          );
        } catch (err) {
          return Response.json(
            { source: 'error', error: err instanceof Error ? err.message : '掃描請求失敗', signals: [] },
            { status: 502, headers },
          );
        }
      },
    },
  },
});
