import { requireApiUser } from '@/lib/auth';
import { createFileRoute } from '@tanstack/react-router';

const PAPER_BASE = 'https://paper-api.alpaca.markets';

const MAX_DAY_LOSS_PCT = 2;
const MAX_POSITION_PCT = 25;
const MAX_ORDER_PCT = 10;

function alpacaHeaders(key: string, secret: string) {
  return { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret };
}

// 美東當日日期字串（Alpaca 時間戳為 UTC，轉美東判定「當日」）
function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export const Route = createFileRoute('/api/risk')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const authed = requireApiUser(ctx.request); if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const key = process.env['ALPACA_API_KEY'];
          const secret = process.env['ALPACA_SECRET_KEY'];
          if (!key || !secret) {
            return Response.json(
              {
                source: 'demo',
                notice: '請在 Vercel 設定 API Key（ALPACA_API_KEY / ALPACA_SECRET_KEY）',
                todayOrderCount: 0,
                dayLossPct: null,
                dayLossBreached: false,
                maxPositionPct: null,
                maxPositionSymbol: null,
                concentrationBreached: false,
                limits: { maxDayLossPct: MAX_DAY_LOSS_PCT, maxPositionPct: MAX_POSITION_PCT, maxOrderPct: MAX_ORDER_PCT },
              },
              { headers },
            );
          }

          const h = alpacaHeaders(key, secret);
          const [acctRes, ordersRes, posRes] = await Promise.all([
            fetch(`${PAPER_BASE}/v2/account`, { headers: h }),
            fetch(`${PAPER_BASE}/v2/orders?status=all&limit=200&direction=desc`, { headers: h }),
            fetch(`${PAPER_BASE}/v2/positions`, { headers: h }),
          ]);
          if (!acctRes.ok) throw new Error(`讀取帳戶失敗（${acctRes.status}）`);
          if (!ordersRes.ok) throw new Error(`讀取訂單失敗（${ordersRes.status}）`);
          if (!posRes.ok) throw new Error(`讀取持倉失敗（${posRes.status}）`);

          const account = (await acctRes.json()) as { equity?: string; last_equity?: string; portfolio_value?: string };
          const equity = Number(account.equity);
          const lastEquity = Number(account.last_equity);
          const portfolioValue = Number(account.portfolio_value) || equity;
          const dayLossPct =
            Number.isFinite(equity) && Number.isFinite(lastEquity) && lastEquity > 0
              ? Math.round(((lastEquity - equity) / lastEquity) * 10000) / 100
              : null;

          const orders = (await ordersRes.json()) as Array<{ submitted_at?: string; status?: string }>;
          const today = todayET();
          const todayOrderCount = orders.filter((o) => {
            if (!o.submitted_at) return false;
            const d = new Date(o.submitted_at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
            return d === today;
          }).length;

          const positions = (await posRes.json()) as Array<{ symbol?: string; market_value?: string }>;
          let maxPositionPct: number | null = null;
          let maxPositionSymbol: string | null = null;
          for (const p of positions) {
            const mv = Number(p.market_value);
            if (!Number.isFinite(mv) || portfolioValue <= 0) continue;
            const pct = (Math.abs(mv) / portfolioValue) * 100;
            if (maxPositionPct === null || pct > maxPositionPct) {
              maxPositionPct = Math.round(pct * 100) / 100;
              maxPositionSymbol = p.symbol ?? null;
            }
          }

          return Response.json(
            {
              source: 'alpaca-paper',
              todayOrderCount,
              dayLossPct,
              dayLossBreached: dayLossPct !== null && dayLossPct > MAX_DAY_LOSS_PCT,
              maxPositionPct,
              maxPositionSymbol,
              concentrationBreached: maxPositionPct !== null && maxPositionPct > MAX_POSITION_PCT,
              limits: { maxDayLossPct: MAX_DAY_LOSS_PCT, maxPositionPct: MAX_POSITION_PCT, maxOrderPct: MAX_ORDER_PCT },
            },
            { headers },
          );
        } catch (err) {
          return Response.json(
            { source: 'error', error: err instanceof Error ? err.message : '風控檢查失敗' },
            { status: 502, headers },
          );
        }
      },
    },
  },
});
