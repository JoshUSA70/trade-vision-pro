// 每周候選池重選：主名單（master-universe.json，約 200 檔）→
// 過濾（股價≥$10、20日均成交金額≥$10M、K線≥45根）→ 依流動性排序取前 POOL_SIZE 檔 →
// 寫入 Supabase candidate_pool 表。screener 優先讀該表，讀不到退回 candidate-pool.json。

import masterData from './master-universe.json';
import { fetchYahooDaily } from './yahoo';
import { getSupabaseAdmin } from './supabase';

export const MASTER_UNIVERSE: Array<{ symbol: string; name: string; sector: string }> = masterData;
export const POOL_SIZE = 101;

export const POOL_REFRESH_CONFIG = {
  MIN_PRICE: 10,
  MIN_DOLLAR_VOL_M: 10,
  MIN_BARS: 45,
  CONCURRENCY: 40,
};

export type PoolPick = {
  symbol: string;
  name: string;
  sector: string;
  rank: number;
  avgDollarVolM: number;
};

export type PoolRefreshResult = {
  picks: PoolPick[];
  master: number;
  fetched: number;
  qualified: number;
  durationMs: number;
  sectorMix: Record<string, number>;
};

function sma(values: number[], n: number): number {
  const slice = values.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

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

export async function refreshCandidatePool(): Promise<PoolRefreshResult> {
  const t0 = Date.now();
  const cfg = POOL_REFRESH_CONFIG;
  const hists = await mapPool(
    MASTER_UNIVERSE,
    async (c) => ({ ...c, hist: await fetchYahooDaily(c.symbol, '3mo') }),
    cfg.CONCURRENCY,
  );
  const qualified: Array<{ symbol: string; name: string; sector: string; avgDollarVolM: number }> = [];
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
    qualified.push({ symbol: h.symbol, name: h.name, sector: h.sector, avgDollarVolM: Math.round(avgDollarVolM * 10) / 10 });
  }
  qualified.sort((a, b) => b.avgDollarVolM - a.avgDollarVolM);
  const picks: PoolPick[] = qualified.slice(0, POOL_SIZE).map((q, i) => ({ ...q, rank: i + 1 }));
  const sectorMix: Record<string, number> = {};
  for (const p of picks) sectorMix[p.sector] = (sectorMix[p.sector] ?? 0) + 1;
  return { picks, master: MASTER_UNIVERSE.length, fetched, qualified: qualified.length, durationMs: Date.now() - t0, sectorMix };
}

/** 將重選結果寫入 Supabase（先 upsert 再清掉舊名單外的） */
export async function savePoolToSupabase(picks: PoolPick[]): Promise<{ saved: boolean; note?: string }> {
  const supa = getSupabaseAdmin();
  if (!supa) return { saved: false, note: '未設定 SUPABASE_SERVICE_ROLE_KEY' };
  const rows = picks.map((p) => ({
    symbol: p.symbol, name: p.name, sector: p.sector, rank: p.rank,
    avg_dollar_vol_m: p.avgDollarVolM, updated_at: new Date().toISOString(),
  }));
  const { error: upErr } = await supa.from('candidate_pool').upsert(rows, { onConflict: 'symbol' });
  if (upErr) return { saved: false, note: `upsert 失敗：${upErr.message}` };
  const syms = picks.map((p) => p.symbol);
  const { error: delErr } = await supa.from('candidate_pool').delete().not('symbol', 'in', `(${syms.join(',')})`);
  if (delErr) return { saved: false, note: `清理舊名單失敗：${delErr.message}` };
  return { saved: true };
}

/** 讀取 Supabase 中的候選池（依 rank 排序）；失敗回 null，由呼叫端退回 JSON */
export async function loadPoolFromSupabase(): Promise<Array<{ symbol: string; name: string }> | null> {
  const supa = getSupabaseAdmin();
  if (!supa) return null;
  const { data, error } = await supa.from('candidate_pool').select('symbol,name').order('rank', { ascending: true });
  if (error || !data || data.length === 0) return null;
  return data as Array<{ symbol: string; name: string }>;
}
