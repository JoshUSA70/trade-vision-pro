import { createFileRoute } from '@tanstack/react-router';
import { runScreener, SCREENER_CONFIG } from '@/lib/screener';

// 智能選股程式：從候選池篩出適合交易的股票（過濾＋流動性排序取前 N 檔）
// 瀏覽器打開即可手動執行一次選股。
export const Route = createFileRoute('/api/screener')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const r = await runScreener();
          return Response.json(
            {
              source: 'yahoo-screener',
              scanned_at: new Date().toISOString(),
              candidates: r.candidates,
              fetched: r.fetched,
              qualified: r.qualified,
              topN: SCREENER_CONFIG.TOP_N,
              durationMs: r.durationMs,
              filters: {
                minPrice: SCREENER_CONFIG.MIN_PRICE,
                minDollarVolM: SCREENER_CONFIG.MIN_DOLLAR_VOL_M,
                minBars: SCREENER_CONFIG.MIN_BARS,
              },
              picks: r.picks.map(({ closes, volumes, ...rest }) => rest),
            },
            { headers },
          );
        } catch (err) {
          return Response.json(
            { source: 'error', error: err instanceof Error ? err.message : '選股失敗', picks: [] },
            { status: 502, headers },
          );
        }
      },
    },
  },
});
