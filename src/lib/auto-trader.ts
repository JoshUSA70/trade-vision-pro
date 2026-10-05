// V3 全自動交易引擎：風控 → 掃描 → 選股下單 → Telegram 通知
// 由 /api/cron/daily-scan（排程）和 /api/cron/test（手動）共用。

import { scoreCandidates, type ScanSignal } from './scan-engine';
import { runScreener } from './screener';
import { fetchIntraday5m, intradayAdjustment } from './intraday';
import { getAccount, getOrders, getPositions, isTodayET, placeMarketOrder } from './alpaca';
import { sendTelegram } from './telegram';
import { logTradeToSupabase } from './trade-log';

const MAX_DAY_LOSS_PCT = 2;
const MAX_ORDERS_PER_DAY = 5;
const MAX_POSITION_PCT = 25;
const MIN_SCORE = 75; // 盤中調整後的最終分數門檻
const DAILY_PREFILTER = 60; // 日線先取前 N 名再做盤中確認
const INTRADAY_TOP_N = 8;
const MAX_BUYS = 3;

export type AutoOrder = {
  symbol: string;
  price: number;
  score: number; // 日線四因子分數
  intraday_adj: number; // 盤中 5分K 調整（-15~+15）
  final_score: number; // 最終分數 = 日線分數 + 盤中調整
  intraday_note: string;
  rsi: number;
  volume_ratio: number;
  trend: string;
  macd_hist: number | null;
  orderId: string | null;
  status: string;
  logged: boolean;
};

export type AutoTradeResult = {
  success: boolean;
  trigger: 'cron' | 'manual';
  scanned: number; // 候選池總數
  universe: number; // 選股程式精選檔數
  qualified: number;
  intradayNote: string | null;
  orders: AutoOrder[];
  skipped: Array<{ symbol: string; reason: string }>;
  stopped?: string;
  error?: string;
};

function todayTaipei(): string {
  return new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit' });
}

export async function runAutoTrader(trigger: 'cron' | 'manual'): Promise<AutoTradeResult> {
  const result: AutoTradeResult = {
    success: true, trigger, scanned: 0, universe: 0, qualified: 0, orders: [], skipped: [],
    intradayNote: null,
  };
  try {
    // ── b) 風控檢查 ──
    const account = await getAccount();
    const equity = Number(account.equity);
    const lastEquity = Number(account.last_equity);
    const buyingPower = account.buying_power;
    if (!Number.isFinite(equity) || equity <= 0) throw new Error('帳戶權益異常，停止交易');
    const dayLossPct = lastEquity > 0 ? ((lastEquity - equity) / lastEquity) * 100 : 0;

    const orders = await getOrders();
    const todayCount = orders.filter((o) => o.submitted_at && isTodayET(o.submitted_at)).length;

    if (dayLossPct > MAX_DAY_LOSS_PCT) {
      result.success = false;
      result.stopped = `今日已達虧損上限（虧損 ${dayLossPct.toFixed(2)}% > ${MAX_DAY_LOSS_PCT}%），停止交易`;
      await sendTelegram(`🛑 *Trade Vision 風控停機*\n\n${result.stopped}\n💰 Equity $${Number(equity).toFixed(2)}`);
      return result;
    }
    if (todayCount >= MAX_ORDERS_PER_DAY) {
      result.success = false;
      result.stopped = `今日已下單 ${todayCount} 筆（上限 ${MAX_ORDERS_PER_DAY} 筆），停止交易`;
      await sendTelegram(`🛑 *Trade Vision 風控停機*\n\n${result.stopped}`);
      return result;
    }

    // ── c) 智能選股 → 日線四因子評分 ──
    const screen = await runScreener();
    result.scanned = screen.candidates;
    result.universe = screen.picks.length;
    const dailySignals: ScanSignal[] = scoreCandidates(screen.picks, DAILY_PREFILTER);

    // ── d) 盤中 5分K 確認：對日線前 N 名做加減分 ──
    const withIntraday = await Promise.all(
      dailySignals.slice(0, INTRADAY_TOP_N).map(async (sg) => {
        const bars = await fetchIntraday5m(sg.symbol);
        const check = intradayAdjustment(bars);
        return { sg, check, finalScore: sg.score + check.adjustment };
      }),
    );
    const signals = withIntraday
      .filter((x) => x.finalScore >= MIN_SCORE)
      .sort((a, b) => b.finalScore - a.finalScore);
    result.qualified = signals.length;
    result.intradayNote =
      withIntraday.length > 0 && withIntraday.every((x) => !x.check.available)
        ? '盤中數據缺失，僅用日線評分'
        : null;

    // ── d) 自動選股下單：最多 3 檔，每檔 1 股 ──
    const positions = await getPositions();
    const posPct = (symbol: string): number => {
      const p = positions.find((x) => x.symbol === symbol);
      if (!p) return 0;
      const mv = Number(p.market_value);
      return Number.isFinite(mv) && equity > 0 ? (Math.abs(mv) / equity) * 100 : 0;
    };

    for (const x of signals.slice(0, MAX_BUYS)) {
      const s = x.sg;
      const pct = posPct(s.symbol);
      if (pct > MAX_POSITION_PCT) {
        result.skipped.push({ symbol: s.symbol, reason: `持倉 ${pct.toFixed(1)}% 超過 ${MAX_POSITION_PCT}% 上限` });
        continue;
      }
      if (s.price > equity * 0.1) {
        result.skipped.push({ symbol: s.symbol, reason: `單股 $${s.price} 超過權益 10% 上限` });
        continue;
      }
      try {
        const order = await placeMarketOrder(s.symbol, 1, 'buy');
        const filledPrice = Number(order.filled_avg_price ?? s.price);
        const log = await logTradeToSupabase({
          symbol: s.symbol, side: 'BUY', qty: 1,
          price: Number.isFinite(filledPrice) ? filledPrice : s.price,
          notes: `auto:${trigger} order:${order.id} status:${order.status}`,
        });
        result.orders.push({
          symbol: s.symbol, price: s.price, score: s.score,
          intraday_adj: x.check.adjustment, final_score: x.finalScore, intraday_note: x.check.note,
          rsi: s.rsi, volume_ratio: s.volume_ratio, trend: s.trend, macd_hist: s.macd_hist,
          orderId: order.id, status: order.status, logged: log.logged,
        });
      } catch (e) {
        result.skipped.push({ symbol: s.symbol, reason: e instanceof Error ? e.message : '下單失敗' });
      }
    }

    // ── e) Telegram 通知 ──
    const date = todayTaipei();
    if (result.orders.length > 0) {
      const lines = result.orders.map(
        (o) => `- ${o.symbol} @ $${o.price} (日線 ${o.score}，盤中 ${o.intraday_adj >= 0 ? '+' : ''}${o.intraday_adj} → ${o.final_score}，${o.trend})`,
      );
      await sendTelegram(
        `🚀 *Trade Vision 每日自動報告 - ${date}*\n\n` +
          `🔍 候選 ${result.scanned} 檔 → 精選 ${result.universe} 檔 → 盤中確認後 ${result.qualified} 檔達標\n\n` +
          `買入清單：\n${lines.join('\n')}\n\n` +
          `💰 帳戶：Equity $${Number(equity).toFixed(2)}, 買力 $${Number(buyingPower).toFixed(2)}\n` +
          `⚠️ 今日已交易 ${todayCount + result.orders.length}/${MAX_ORDERS_PER_DAY} 筆`,
      );
    } else {
      const skipNote =
        result.skipped.length > 0
          ? `\n\n跳過：\n${result.skipped.map((x) => `- ${x.symbol}：${x.reason}`).join('\n')}`
          : '';
      const intraNote = result.intradayNote ? `\n📝 ${result.intradayNote}` : '';
      await sendTelegram(`😴 *Trade Vision 每日自動報告 - ${date}*\n\n今日無符合最終分數>=${MIN_SCORE} 的標的，不執行交易${intraNote}${skipNote}`);
    }
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '未知錯誤';
    result.success = false;
    result.error = msg;
    await sendTelegram(`🔥 *Trade Vision 自動交易失敗*\n\n錯誤：${msg}`);
    return result;
  }
}
