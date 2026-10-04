import { createFileRoute } from '@tanstack/react-router';
import { scanUniverse, UNIVERSE } from '@/lib/scan-engine';

// V2 智能選股引擎：RSI(14) + 量能 + SMA50 評分（Score >= 60 才回傳）
// 歷史數據走 Yahoo Finance 免費日線（免 key）；Finnhub 免費版不開放 /stock/candle。
export const Route = createFileRoute('/api/scan')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const signals = await scanUniverse(60);
          return Response.json(
            { source: 'yahoo', scanned_at: new Date().toISOString(), universe: UNIVERSE.length, signals },
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
