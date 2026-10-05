import { createFileRoute } from '@tanstack/react-router';
import { requireApiUser } from '@/lib/auth';
import { getAppConfig } from '@/lib/app-config';

// 供前端顯示用的公開交易參數（需登入）
export const Route = createFileRoute('/api/trade-config')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const authed = requireApiUser(ctx.request);
        if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        const cfg = await getAppConfig();
        return Response.json(
          { source: 'trade-config', minScore: cfg.trade_min_score, maxBuys: cfg.trade_max_buys },
          { headers },
        );
      },
    },
  },
});
