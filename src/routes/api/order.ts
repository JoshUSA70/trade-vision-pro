import { requireApiUser } from '@/lib/auth';
import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';

const PAPER_BASE = 'https://paper-api.alpaca.markets';
const DATA_BASE = 'https://data.alpaca.markets';

function alpacaHeaders(key: string, secret: string) {
  return { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret, 'Content-Type': 'application/json' };
}

type OrderBody = { symbol?: unknown; qty?: unknown; side?: unknown };

export const Route = createFileRoute('/api/order')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const key = process.env['ALPACA_API_KEY'];
          const secret = process.env['ALPACA_SECRET_KEY'];
          if (!key || !secret) {
            return Response.json(
              { error: '請在 Vercel 設定 API Key（ALPACA_API_KEY / ALPACA_SECRET_KEY）' },
              { status: 400, headers },
            );
          }

          const body = (await request.json().catch(() => ({}))) as OrderBody;
          const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
          const qty = Number(body.qty);
          const side = typeof body.side === 'string' ? body.side.toLowerCase() : '';

          if (!symbol) return Response.json({ error: '缺少 symbol' }, { status: 400, headers });
          if (!Number.isInteger(qty) || qty <= 0) {
            return Response.json({ error: 'qty 必須是大於 0 的整數' }, { status: 400, headers });
          }
          if (side !== 'buy' && side !== 'sell') {
            return Response.json({ error: "side 必須是 'buy' 或 'sell'" }, { status: 400, headers });
          }

          // 風控：單筆下單金額 ≤ 帳戶權益 10%
          const [acctRes, quoteRes] = await Promise.all([
            fetch(`${PAPER_BASE}/v2/account`, { headers: alpacaHeaders(key, secret) }),
            fetch(`${DATA_BASE}/v2/stocks/${symbol}/quotes/latest`, { headers: alpacaHeaders(key, secret) }),
          ]);
          if (!acctRes.ok) throw new Error(`讀取帳戶失敗（${acctRes.status}）`);
          const account = (await acctRes.json()) as { equity?: string };
          const equity = Number(account.equity);
          if (!Number.isFinite(equity) || equity <= 0) throw new Error('帳戶權益異常，無法下單');

          let refPrice: number | null = null;
          if (quoteRes.ok) {
            const q = (await quoteRes.json()) as { quote?: { ap?: number; bp?: number } };
            const ap = Number(q.quote?.ap);
            const bp = Number(q.quote?.bp);
            if (Number.isFinite(ap) && Number.isFinite(bp) && ap > 0 && bp > 0) {
              refPrice = side === 'buy' ? ap : bp;
            } else if (Number.isFinite(ap) && ap > 0) {
              refPrice = ap;
            }
          }
          if (refPrice === null) throw new Error('無法取得最新報價，請稍後再試');
          const notional = qty * refPrice;
          const limit = equity * 0.1;
          if (notional > limit) {
            return Response.json(
              { error: `單筆下單金額 $${notional.toFixed(2)} 超過帳戶權益 10% 上限 $${limit.toFixed(2)}` },
              { status: 400, headers },
            );
          }

          const orderRes = await fetch(`${PAPER_BASE}/v2/orders`, {
            method: 'POST',
            headers: alpacaHeaders(key, secret),
            body: JSON.stringify({ symbol, qty, side, type: 'market', time_in_force: 'day' }),
          });
          const orderData = (await orderRes.json().catch(() => ({}))) as Record<string, unknown>;
          if (!orderRes.ok) {
            const msg = typeof orderData['message'] === 'string' ? orderData['message'] : `Alpaca 下單失敗（${orderRes.status}）`;
            return Response.json({ error: msg }, { status: 400, headers });
          }

          // 寫入 Supabase trades 表（best-effort：沒設定 service key 不影響下單本身）
          let logged = false;
          let logNote = '';
          const supaUrl = process.env['SUPABASE_URL'];
          const supaKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
          if (supaUrl && supaKey) {
            try {
              const supa = createClient(supaUrl, supaKey);
              const ownerId = process.env['TRADING_OWNER_ID'] ?? '00000000-0000-0000-0000-000000000000';
              const { error: insErr } = await supa.from('trades').insert({
                owner_id: ownerId,
                symbol,
                side: side === 'buy' ? 'BUY' : 'SELL',
                qty,
                price: Number(orderData['filled_avg_price'] ?? refPrice),
                executed_at: new Date().toISOString(),
                notes: `alpaca:${String(orderData['id'] ?? '')} status:${String(orderData['status'] ?? '')}`,
              });
              if (insErr) logNote = `Supabase 寫入失敗：${insErr.message}`;
              else logged = true;
            } catch (e) {
              logNote = `Supabase 寫入異常：${e instanceof Error ? e.message : 'unknown'}`;
            }
          } else {
            logNote = '未設定 SUPABASE_SERVICE_ROLE_KEY，交易紀錄未寫入 Supabase';
          }

          return Response.json(
            {
              ok: true,
              order: {
                id: orderData['id'],
                symbol,
                qty,
                side,
                status: orderData['status'],
                filled_avg_price: orderData['filled_avg_price'] ?? null,
              },
              logged,
              ...(logNote ? { logNote } : {}),
            },
            { headers },
          );
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : '下單失敗，請稍後再試' },
            { status: 500, headers },
          );
        }
      },
    },
  },
});
