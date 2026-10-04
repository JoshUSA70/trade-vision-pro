import { createFileRoute } from '@tanstack/react-router';
import { runAutoTrader } from '@/lib/auto-trader';
import { sendTelegram } from '@/lib/telegram';

// Vercel Cron 呼叫（GET）。驗證：CRON_SECRET 有設定時，需 query ?secret= 或 Authorization: Bearer 相符。
export const Route = createFileRoute('/api/cron/daily-scan')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const required = process.env['CRON_SECRET'];
          if (required) {
            const url = new URL(request.url);
            const q = url.searchParams.get('secret');
            const auth = request.headers.get('authorization') ?? '';
            const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
            if (q !== required && bearer !== required) {
              return Response.json({ error: '未授權' }, { status: 401, headers });
            }
          }
          const result = await runAutoTrader('cron');
          return Response.json(result, { headers });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '排程執行失敗';
          await sendTelegram(`🔥 *Trade Vision 排程異常*\n\n錯誤：${msg}`);
          return Response.json({ success: false, error: msg }, { status: 500, headers });
        }
      },
    },
  },
});
