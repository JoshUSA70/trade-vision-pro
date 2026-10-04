import { createFileRoute } from '@tanstack/react-router';
import { refreshCandidatePool, savePoolToSupabase, POOL_SIZE, MASTER_UNIVERSE } from '@/lib/pool-refresh';
import { sendTelegram } from '@/lib/telegram';

// 每周候選池重選（Vercel Cron：每周日 12:00 UTC = 台灣周日 20:00）
// 主名單 → 過濾 → 依流動性取前 101 檔 → 寫入 Supabase candidate_pool
export const Route = createFileRoute('/api/cron/weekly-pool')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const headers = { 'Cache-Control': 'no-store' };
        const url = new URL(ctx.request.url);
        const secret = process.env['CRON_SECRET'];
        const provided = url.searchParams.get('secret') ?? ctx.request.headers.get('authorization')?.replace(/^Bearer /i, '');
        if (secret && provided !== secret) {
          return Response.json({ ok: false, error: 'unauthorized' }, { status: 401, headers });
        }
        try {
          const r = await refreshCandidatePool();
          const save = await savePoolToSupabase(r.picks);
          const mix = Object.entries(r.sectorMix)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k} ${v}`)
            .join('、');
          const top5 = r.picks.slice(0, 5).map((p) => p.symbol).join(', ');
          const msg =
            `📋 *每周候選池更新*\n\n` +
            `主名單 ${r.master} 檔 → 抓到 ${r.fetched} 檔 → 通過 ${r.qualified} 檔 → 選出前 ${r.picks.length} 檔\n` +
            `板塊：${mix}\n` +
            `前5：${top5}\n` +
            `Supabase：${save.saved ? '已寫入 ✅' : `未寫入 ⚠️（${save.note}）`}`;
          await sendTelegram(msg);
          return Response.json(
            {
              ok: true, poolSize: POOL_SIZE, master: r.master, fetched: r.fetched,
              qualified: r.qualified, picks: r.picks.length, sectorMix: r.sectorMix,
              durationMs: r.durationMs, saved: save.saved, saveNote: save.note ?? null,
            },
            { headers },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : '未知錯誤';
          await sendTelegram(`🔥 *每周候選池更新失敗*\n\n錯誤：${msg}`);
          return Response.json({ ok: false, error: msg }, { status: 500, headers });
        }
      },
    },
  },
});
