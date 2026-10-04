// V2/V3 共用：RSI + 量能 + 趨勢 + MACD 四因子智能選股引擎（歷史數據走 Yahoo Finance 免費日線，免 key）
// 註：Finnhub 免費版不開放 /stock/candle（歷史 K 線一律 403），故不用 Finnhub。

// 選股池改由 src/lib/universe.json 讀取，不再寫死在程式中。
// 想增減標的：直接編輯該 JSON 檔後重新部署即可。
import universeData from './universe.json';
import { fetchYahooDaily } from './yahoo';

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
  trend: '多頭排列' | '偏多' | '偏空';
  macd_hist: number | null;
};

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period; // 以 SMA 播種
  out.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export type MacdResult = { line: number; signal: number; histogram: number; prevHistogram: number };

/** MACD(12,26,9)：回傳最後一根的 line / signal / histogram（含前一根 histogram 判斷動能增減） */
export function macd(closes: number[]): MacdResult | null {
  if (closes.length < 35) return null;
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const aligned12 = ema12.slice(ema12.length - ema26.length);
  const macdLine = aligned12.map((v, i) => v - ema26[i]!);
  const signalLine = ema(macdLine, 9);
  const line = macdLine.slice(macdLine.length - signalLine.length);
  const last = line.length - 1;
  const histogram = line[last]! - signalLine[last]!;
  const prevHistogram = line[last - 1]! - signalLine[last - 1]!;
  return { line: line[last]!, signal: signalLine[last]!, histogram, prevHistogram };
}

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


export type ScoreFeatures = {
  price: number;
  rsi: number;
  volume_ratio: number;
  sma20: number;
  sma50: number;
  macd: MacdResult | null;
};

/**
 * 四因子評分（0–100）：
 * 均值回歸 60 分 — RSI<35 得 35，RSI<40 得 18；量比>1.5 得 25，>1.2 得 12
 * 趨勢動能 40 分 — 價格>SMA20>SMA50（多頭排列）得 20，價格>SMA50 得 10；
 *   MACD 柱>0 且擴大得 20，MACD 線>訊號線得 10
 */
export function scoreStock(f: ScoreFeatures): number {
  let score = 0;
  if (f.rsi < 35) score += 35;
  else if (f.rsi < 40) score += 18;
  if (f.volume_ratio > 1.5) score += 25;
  else if (f.volume_ratio > 1.2) score += 12;
  if (f.price > f.sma20 && f.sma20 > f.sma50) score += 20;
  else if (f.price > f.sma50) score += 10;
  if (f.macd) {
    if (f.macd.histogram > 0 && f.macd.histogram > f.macd.prevHistogram) score += 20;
    else if (f.macd.line > f.macd.signal) score += 10;
  }
  return score;
}

/** 掃描整個股票池，回傳 Score >= minScore 的訊號（預設 60），按分數排序 */
export type CandidateBars = { symbol: string; name: string; closes: number[]; volumes: number[] };

/** 對已抓好的K線直接評分（不重複抓取），供 screener 選出的名單使用 */
export function scoreCandidates(cands: CandidateBars[], minScore = 60): ScanSignal[] {
  const out: ScanSignal[] = [];
  for (const c of cands) {
    const { closes, volumes } = c;
    const rsi = rsi14(closes);
    if (rsi === null) continue;
    const price = closes[closes.length - 1]!;
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const m = macd(closes);
    const todayVol = volumes[volumes.length - 1]!;
    const avgVol20 = sma(volumes.slice(0, -1), 20);
    const volume_ratio = avgVol20 > 0 ? Math.round((todayVol / avgVol20) * 100) / 100 : 0;
    const score = scoreStock({ price, rsi, volume_ratio, sma20, sma50, macd: m });
    if (score < minScore) continue;
    const trend = price > sma20 && sma20 > sma50 ? '多頭排列' : price > sma50 ? '偏多' : '偏空';
    out.push({
      symbol: c.symbol,
      name: c.name,
      price: Math.round(price * 100) / 100,
      rsi,
      volume_ratio,
      score,
      signal: score > 80 ? 'STRONG_BUY' : 'BUY',
      sma50: Math.round(sma50 * 100) / 100,
      trend,
      macd_hist: m ? Math.round(m.histogram * 100) / 100 : null,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** 靜態 universe.json 快掃（screener 失敗時的退回路徑） */
export async function scanUniverse(minScore = 60): Promise<ScanSignal[]> {
  const cands: CandidateBars[] = [];
  const hists = await Promise.all(
    UNIVERSE.map(async (s) => ({ ...s, hist: await fetchYahooDaily(s.symbol, '6mo') })),
  );
  for (const h of hists) {
    if (h.hist) cands.push({ symbol: h.symbol, name: h.name, closes: h.hist.closes, volumes: h.hist.volumes });
  }
  return scoreCandidates(cands, minScore);
}
