// 盤中策略：5 分鐘 K 線確認因子
// 在日線四因子評分之後，對領先者做盤中加減分（-15 ~ +15）：
//   5分 RSI(14) 動能、現價 vs 今日 VWAP、第一根 5分K 紅黑
// 非交易時段（無今日 5分K）時回傳 adjustment 0，不影響日線評分。

import { rsi14 } from './scan-engine';
import { todayET } from './alpaca';

export type IntradayBar = { t: number; o: number; h: number; l: number; c: number; v: number };

export type IntradayCheck = {
  available: boolean;
  barsToday: number;
  rsi5: number | null;
  vsVwapPct: number | null;
  firstBarUp: boolean | null;
  adjustment: number; // -15 ~ +15
  note: string;
};

type YahooIntraday = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
  };
};

async function fetchOnce(url: string, timeoutMs: number): Promise<IntradayBar[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooIntraday;
    const r = data.chart?.result?.[0];
    const ts = r?.timestamp;
    const q = r?.indicators?.quote?.[0];
    if (!ts || !q || !q.close) return null;
    const bars: IntradayBar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      const v = q.volume?.[i] ?? 0;
      if (typeof o !== 'number' || typeof h !== 'number' || typeof l !== 'number' || typeof c !== 'number') continue;
      bars.push({ t: ts[i]!, o, h, l, c, v: typeof v === 'number' ? v : 0 });
    }
    return bars.length > 0 ? bars : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 抓 5 天 5分K（約 390 根，足夠算 5分 RSI） */
export async function fetchIntraday5m(symbol: string, timeoutMs = 12000): Promise<IntradayBar[] | null> {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    const r = await fetchOnce(`https://${host}/v8/finance/chart/${symbol}?range=5d&interval=5m`, timeoutMs);
    if (r) return r;
  }
  return null;
}

function etDate(tSec: number): string {
  return new Date(tSec * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function intradayAdjustment(bars: IntradayBar[] | null): IntradayCheck {
  const base: IntradayCheck = {
    available: false, barsToday: 0, rsi5: null, vsVwapPct: null,
    firstBarUp: null, adjustment: 0, note: '無今日盤中數據',
  };
  if (!bars || bars.length === 0) return base;
  const today = todayET();
  const todayBars = bars.filter((b) => etDate(b.t) === today);
  if (todayBars.length === 0) return { ...base, note: '今日尚未開盤' };
  const closes = bars.map((b) => b.c);
  const rsi5 = rsi14(closes.slice(-120)); // 近 120 根 5分K 的 RSI
  const last = todayBars[todayBars.length - 1]!;
  let pv = 0;
  let vv = 0;
  for (const b of todayBars) {
    const tp = (b.h + b.l + b.c) / 3;
    pv += tp * b.v;
    vv += b.v;
  }
  const vwap = vv > 0 ? pv / vv : null;
  const vsVwapPct = vwap !== null ? Math.round(((last.c - vwap) / vwap) * 10000) / 100 : null;
  const firstBarUp = todayBars[0]!.c > todayBars[0]!.o;

  let adjustment = 0;
  const parts: string[] = [];
  if (rsi5 !== null) {
    if (rsi5 > 60) { adjustment += 8; parts.push(`RSI5 ${rsi5.toFixed(0)} 強`); }
    else if (rsi5 > 55) { adjustment += 5; parts.push(`RSI5 ${rsi5.toFixed(0)} 偏強`); }
    else if (rsi5 > 50) { adjustment += 2; parts.push(`RSI5 ${rsi5.toFixed(0)} 中性偏多`); }
    else if (rsi5 < 40) { adjustment -= 10; parts.push(`RSI5 ${rsi5.toFixed(0)} 弱`); }
    else if (rsi5 < 45) { adjustment -= 5; parts.push(`RSI5 ${rsi5.toFixed(0)} 偏弱`); }
  }
  if (vsVwapPct !== null) {
    if (vsVwapPct > 0.3) { adjustment += 4; parts.push('站上VWAP'); }
    else if (vsVwapPct > 0) { adjustment += 2; parts.push('VWAP上'); }
    else if (vsVwapPct < -0.3) { adjustment -= 4; parts.push('跌破VWAP'); }
    else { adjustment -= 2; parts.push('VWAP下'); }
  }
  if (firstBarUp) { adjustment += 3; parts.push('首根紅K'); }
  else { adjustment -= 3; parts.push('首根黑K'); }
  adjustment = Math.max(-15, Math.min(15, adjustment));

  return {
    available: true,
    barsToday: todayBars.length,
    rsi5: rsi5 !== null ? Math.round(rsi5 * 10) / 10 : null,
    vsVwapPct,
    firstBarUp,
    adjustment,
    note: parts.join('、'),
  };
}
