// Yahoo Finance 免費日線抓取（免 key），供 screener / scan-engine 共用
// 注意：非官方接口，呼叫端都應有失敗退回機制。

type YahooChart = {
  chart?: {
    result?: Array<{
      indicators?: { quote?: Array<{ close?: (number | null)[]; volume?: (number | null)[] }> };
    }>;
  };
};

export type YahooDaily = { closes: number[]; volumes: number[] };

async function fetchOnce(url: string, timeoutMs: number): Promise<YahooDaily | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooChart;
    const q = data.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!q || !Array.isArray(q.close) || !Array.isArray(q.volume)) return null;
    const closes = q.close.filter((c): c is number => typeof c === 'number' && Number.isFinite(c));
    const volumes = q.volume.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (closes.length === 0 || volumes.length === 0) return null;
    return { closes, volumes };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 抓取日線（預設 6 個月，足夠 SMA50 / MACD / RSI / 量比計算） */
export async function fetchYahooDaily(
  symbol: string,
  range: '3mo' | '6mo' = '6mo',
  timeoutMs = 12000,
): Promise<YahooDaily | null> {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    const r = await fetchOnce(`https://${host}/v8/finance/chart/${symbol}?range=${range}&interval=1d`, timeoutMs);
    if (r) return r;
  }
  return null;
}
