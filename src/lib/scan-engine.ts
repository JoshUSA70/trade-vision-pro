// V2/V3 共用：RSI + 量能智能選股引擎（歷史數據走 Yahoo Finance 免費日線，免 key）
// 註：Finnhub 免費版不開放 /stock/candle（歷史 K 線一律 403），故不用 Finnhub。

// 選股池改由 src/lib/universe.json 讀取，不再寫死在程式中。
// 想增減標的：直接編輯該 JSON 檔後重新部署即可。
import universeData from './universe.json';

export const UNIVERSE: Array<{ symbol: string; name: string }> = universeData;

export type ScanSignal = {
  symbol: string;
  name: string;
  price: number;
  rsi: number;
  volume_ratio: number;
  score: number;
  signal: 'STRONG_BUY' | 'BUY';
  sma50: number;
};

export function rsi14(closes: number[]): number | null {
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

function sma(values: number[], n: number): number {
  const slice = values.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
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

export function scoreStock(price: number, rsi: number, volume_ratio: number, sma50: number): number {
  let score = 0;
  if (rsi < 35) score += 40;
  else if (rsi < 40) score += 20;
  if (volume_ratio > 1.5) score += 30;
  else if (volume_ratio > 1.2) score += 15;
  if (price > sma50) score += 30;
  return score;
}

/** 掃描整個股票池，回傳 Score >= minScore 的訊號（預設 60），按分數排序 */
export async function scanUniverse(minScore = 60): Promise<ScanSignal[]> {
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
      const score = scoreStock(price, rsi, volume_ratio, sma50);
      if (score < minScore) return null;
      return {
        symbol: s.symbol,
        name: s.name,
        price: Math.round(price * 100) / 100,
        rsi,
        volume_ratio,
        score,
        signal: score > 80 ? ('STRONG_BUY' as const) : ('BUY' as const),
        sma50: Math.round(sma50 * 100) / 100,
      };
    }),
  );
  return results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score);
}
