import { requireApiUser } from '@/lib/auth';
import { createFileRoute } from '@tanstack/react-router';
import { scanUniverse, scoreCandidates } from '@/lib/scan-engine';
import { runScreener } from '@/lib/screener';

// 智能選股＋四因子評分：先由選股程式從候選池挑出適合交易的股票，
// 再對這批名單做 RSI/量比/趨勢/MACD 評分（Score >= 60 回傳）。
// 選股失敗時退回靜態 universe.json 名單。
export const Route = createFileRoute('/api/scan')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const authed = requireApiUser(ctx.request); if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        try {
          let signals;
          let candidates = 0;
          let universe = 0;
          try {
            const r = await runScreener();
            candidates = r.candidates;
            universe = r.picks.length;
            signals = scoreCandidates(r.picks, 60);
          } catch {
            signals = await scanUniverse(60);
            universe = signals.length;
          }
          return Response.json(
            {
              source: 'yahoo-dynamic',
              scanned_at: new Date().toISOString(),
              candidates,
              universe,
              signals,
            },
            { headers },
          );
        } catch (err) {
          return Response.json(
            { source: 'error', error: err instanceof Error ? err.message : '掃描請求失敗', signals: [] },
            { status: 502, headers },
          );
        }
      },
    },
  },
});
