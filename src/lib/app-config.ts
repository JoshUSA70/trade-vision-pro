// 交易參數：Supabase app_config 表優先，讀不到退回程式預設值
// 管理介面（/admin）可即時修改，下次執行自動生效，不需重部署。
import { getSupabaseAdmin } from './supabase';

export type AppConfig = {
  trade_min_score: number; // 最終分數買入門檻
  trade_max_buys: number; // 每次最多買入檔數
  trade_daily_prefilter: number; // 日線預篩門檻
  trade_intraday_top_n: number; // 盤中確認前 N 名
  screen_top_n: number; // 每日精選檔數
  screen_min_price: number; // 選股最低股價
  screen_min_dollar_vol_m: number; // 選股 20日均成交金額下限（百萬美元）
  pool_min_dollar_vol_m: number; // 每周重選流動性下限（百萬美元）
};

export const CONFIG_DEFAULTS: AppConfig = {
  trade_min_score: 75,
  trade_max_buys: 3,
  trade_daily_prefilter: 60,
  trade_intraday_top_n: 8,
  screen_top_n: 25,
  screen_min_price: 10,
  screen_min_dollar_vol_m: 30,
  pool_min_dollar_vol_m: 10,
};

export const CONFIG_META: Record<keyof AppConfig, { label: string; hint: string; min: number; max: number; step: number }> = {
  trade_min_score: { label: '買入門檻分數', hint: '最終分數（日線＋盤中調整）達到此分數才買入', min: 0, max: 100, step: 1 },
  trade_max_buys: { label: '每次最多買入檔數', hint: '單次自動交易最多買幾檔', min: 1, max: 10, step: 1 },
  trade_daily_prefilter: { label: '日線預篩門檻', hint: '日線四因子先取達此分數者做盤中確認', min: 0, max: 100, step: 1 },
  trade_intraday_top_n: { label: '盤中確認前 N 名', hint: '取日線前 N 名做 5分K 盤中確認', min: 1, max: 25, step: 1 },
  screen_top_n: { label: '每日精選檔數', hint: '每天從候選池依流動性取前 N 檔評分', min: 1, max: 101, step: 1 },
  screen_min_price: { label: '選股最低股價（美元）', hint: '過濾仙股', min: 1, max: 100, step: 1 },
  screen_min_dollar_vol_m: { label: '選股成交金額下限（百萬美元）', hint: '20日均成交金額低於此值剔除', min: 1, max: 500, step: 1 },
  pool_min_dollar_vol_m: { label: '每周重選成交金額下限（百萬美元）', hint: '每周候選池重選的流動性門檻', min: 1, max: 500, step: 1 },
};

export async function getAppConfig(): Promise<AppConfig> {
  const cfg: AppConfig = { ...CONFIG_DEFAULTS };
  const supa = getSupabaseAdmin();
  if (!supa) return cfg;
  try {
    const { data, error } = await supa.from('app_config').select('key,value');
    if (error || !data) return cfg;
    for (const row of data as Array<{ key: string; value: string }>) {
      const k = row.key as keyof AppConfig;
      if (!(k in CONFIG_DEFAULTS)) continue;
      const n = Number(row.value);
      if (Number.isFinite(n)) (cfg as unknown as Record<string, number>)[k] = n;
    }
  } catch {
    /* 讀不到就用預設值 */
  }
  return cfg;
}
