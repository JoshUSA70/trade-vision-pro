import { requireApiUser } from '@/lib/auth';
import { createFileRoute } from '@tanstack/react-router';
import { sendTelegram } from '@/lib/telegram';

// 測試 Telegram Bot Token / Chat ID 是否正確
export const Route = createFileRoute('/api/telegram/test')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const authed = requireApiUser(ctx.request); if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        const result = await sendTelegram(
          `✅ *Trade Vision Telegram 測試*\n\n連線正常，${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`,
        );
        if (!result.ok) {
          return Response.json({ ok: false, error: result.error }, { status: 400, headers });
        }
        return Response.json({ ok: true }, { headers });
      },
    },
  },
});
