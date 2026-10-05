import { createFileRoute } from '@tanstack/react-router';
import { requireApiAdmin } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccount } from '@/lib/alpaca';
import { fetchYahooDaily } from '@/lib/yahoo';

type Check = { ok: boolean; detail: string };

// 系統健康檢查（管理員）：Supabase / Alpaca / Telegram / Yahoo
export const Route = createFileRoute('/api/admin/health')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const authed = requireApiAdmin(ctx.request);
        if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        const checks: Record<string, Check> = {};

        // Supabase
        const supa = getSupabaseAdmin();
        if (!supa) {
          checks['supabase'] = { ok: false, detail: '未設定 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' };
        } else {
          try {
            const { error } = await supa.from('app_config').select('key').limit(1);
            checks['supabase'] = error
              ? { ok: false, detail: `連線失敗：${error.message}` }
              : { ok: true, detail: '連線正常' };
          } catch (e) {
            checks['supabase'] = { ok: false, detail: `連線異常：${e instanceof Error ? e.message : 'unknown'}` };
          }
        }

        // Alpaca
        try {
          const acct = await getAccount();
          checks['alpaca'] = { ok: true, detail: `Paper 帳戶正常（Equity $${Number(acct.equity).toFixed(2)}）` };
        } catch (e) {
          checks['alpaca'] = { ok: false, detail: `連線失敗：${e instanceof Error ? e.message : 'unknown'}` };
        }

        // Telegram（只檢查設定，不發測試訊息）
        const tgOk = !!process.env['TELEGRAM_BOT_TOKEN'] && !!process.env['TELEGRAM_CHAT_ID'];
        checks['telegram'] = tgOk
          ? { ok: true, detail: 'Bot Token 與 Chat ID 已設定' }
          : { ok: false, detail: '未設定 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID' };

        // Yahoo
        try {
          const d = await fetchYahooDaily('SPY', '3mo', 8000);
          checks['yahoo'] = d ? { ok: true, detail: '行情源正常' } : { ok: false, detail: '抓取失敗' };
        } catch {
          checks['yahoo'] = { ok: false, detail: '抓取異常' };
        }

        const allOk = Object.values(checks).every((c) => c.ok);
        return Response.json({ source: 'admin-health', ok: allOk, checks }, { headers });
      },
    },
  },
});
