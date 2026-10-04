// 智能選股程式：從候選池篩出「適合交易」的股票
// 流程：候選池（candidate-pool.json，約100檔）→ 過濾 → 依流動性排序 → 取前 TOP_N 檔
// 過濾條件（可調）：股價 ≥ MIN_PRICE、20日均成交金額 ≥ MIN_DOLLAR_VOL_M、數據完整
// 輸出直接餵給 scan-engine 的 scoreCandidates 做四因子評分（不重複抓數據）。

import poolData from './candidate-pool.json';
import { fetchYahooDaily, type YahooDaily } from './yahoo';

export const CANDIDATE_POOL: Array<{ symbol: string; name: string }> = poolData;

export const SCREENER_CONFIG = {
  TOP_N: 25, // 輸出檔數
  MIN_PRICE: 10, // 最低股價（美元），過濾仙股
  MIN_DOLLAR_VOL_M: 30, // 20日均成交金額下限（百萬美元），確保流動性
  MIN_BARS: 60, // 最少K線數（數據完整性）
  CONCURRENCY: 30, // 同時抓取數（避免打爆 Yahoo）
};

export type ScreenerPick = {
  symbol: string;
  name: string;
  closes: number[];
  volumes: number[];
  price: number;
  avgDollarVolM: number; // 20日均成交金額（百萬美元）
};

export type ScreenerResult = {
  picks: ScreenerPick[];
  candidates: number; // 候選池總數
  fetched: number; // 成功抓到數據
  qualified: number; // 通過過濾
  durationMs: number;
};

function sma(values: number[], n: number): number {
  const slice = values.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// 簡易併發池
async function mapPool<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function runScreener(): Promise<ScreenerResult> {
  const t0 = Date.now();
  const cfg = SCREENER_CONFIG;
  const hists = await mapPool(
    CANDIDATE_POOL,
    async (c): Promise<{ symbol: string; name: string; hist: YahooDaily | null }> => ({
      ...c,
      hist: await fetchYahooDaily(c.symbol, '6mo'),
    }),
    cfg.CONCURRENCY,
  );

  const qualified: ScreenerPick[] = [];
  let fetched = 0;
  for (const h of hists) {
    if (!h.hist) continue;
    fetched++;
    const { closes, volumes } = h.hist;
    if (closes.length < cfg.MIN_BARS || volumes.length < 21) continue;
    const price = closes[closes.length - 1]!;
    if (price < cfg.MIN_PRICE) continue;
    const avgVol20 = sma(volumes.slice(0, -1), 20);
    const avgDollarVolM = (avgVol20 * price) / 1e6;
    if (avgDollarVolM < cfg.MIN_DOLLAR_VOL_M) continue;
    qualified.push({
      symbol: h.symbol,
      name: h.name,
      closes,
      volumes,
      price: Math.round(price * 100) / 100,
      avgDollarVolM: Math.round(avgDollarVolM * 10) / 10,
    });
  }

  // 依流動性（20日均成交金額）排序，取前 N 檔
  qualified.sort((a, b) => b.avgDollarVolM - a.avgDollarVolM);
  const picks = qualified.slice(0, cfg.TOP_N);
  return { picks, candidates: CANDIDATE_POOL.length, fetched, qualified: qualified.length, durationMs: Date.now() - t0 };
}
