import { requireApiUser } from '@/lib/auth';
import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { getOrders, isTodayET } from '@/lib/alpaca';

// 今日自動交易紀錄：優先讀 Supabase trades 表，未設定時退回 Alpaca 今日訂單
export const Route = createFileRoute('/api/cron/history')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const authed = requireApiUser(ctx.request); if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const supaUrl = process.env['SUPABASE_URL'];
          const supaKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
          if (supaUrl && supaKey) {
            const supa = createClient(supaUrl, supaKey);
            const startET = new Date(
              new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
            );
            startET.setHours(0, 0, 0, 0);
            const { data, error } = await supa
              .from('trades')
              .select('symbol, side, qty, price, executed_at, notes')
              .gte('executed_at', startET.toISOString())
              .order('executed_at', { ascending: false })
              .limit(20);
            if (error) throw new Error(`Supabase 讀取失敗：${error.message}`);
            return Response.json(
              {
                source: 'supabase',
                trades: (data ?? []).map((t) => ({
                  symbol: t.symbol,
                  side: t.side,
                  qty: Number(t.qty),
                  price: Number(t.price),
                  executed_at: t.executed_at,
                  auto: typeof t.notes === 'string' && t.notes.startsWith('auto:'),
                })),
              },
              { headers },
            );
          }
          // 退回：Alpaca 今日訂單
          const orders = await getOrders(50);
          const today = orders.filter((o) => o.submitted_at && isTodayET(o.submitted_at));
          return Response.json(
            {
              source: 'alpaca',
              trades: today.map((o) => ({
                symbol: o.symbol,
                side: o.side.toUpperCase(),
                qty: Number(o.qty),
                price: o.filled_avg_price ? Number(o.filled_avg_price) : null,
                executed_at: o.filled_at ?? o.submitted_at,
                auto: false,
              })),
            },
            { headers },
          );
        } catch (err) {
          return Response.json(
            { source: 'error', error: err instanceof Error ? err.message : '讀取失敗', trades: [] },
            { status: 502, headers },
          );
        }
      },
    },
  },
});
