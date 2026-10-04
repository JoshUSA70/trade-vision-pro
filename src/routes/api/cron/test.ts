import { createFileRoute } from '@tanstack/react-router';
import { runAutoTrader } from '@/lib/auto-trader';
import { sendTelegram } from '@/lib/telegram';

// 手動測試：瀏覽器打開即可立即執行一次完整流程（掃描＋下單＋Telegram）
export const Route = createFileRoute('/api/cron/test')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const result = await runAutoTrader('manual');
          return Response.json(result, { headers });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '手動執行失敗';
          await sendTelegram(`🔥 *Trade Vision 手動執行異常*\n\n錯誤：${msg}`);
          return Response.json({ success: false, error: msg }, { status: 500, headers });
        }
      },
    },
  },
});
