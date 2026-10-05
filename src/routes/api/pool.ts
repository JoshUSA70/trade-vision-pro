import { requireApiUser } from '@/lib/auth';
import { createFileRoute } from '@tanstack/react-router';
import poolData from '@/lib/candidate-pool.json';
import { getSupabaseAdmin } from '@/lib/supabase';

// 本週候選池：優先讀 Supabase（每周重選結果），讀不到退回靜態 JSON
export const Route = createFileRoute('/api/pool')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const authed = requireApiUser(ctx.request); if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        const supa = getSupabaseAdmin();
        if (supa) {
          const { data, error } = await supa
            .from('candidate_pool')
            .select('symbol,name,sector,rank,avg_dollar_vol_m,updated_at')
            .order('rank', { ascending: true });
          if (!error && data && data.length > 0) {
            const first = data[0]!;
            return Response.json(
              { source: 'supabase-weekly', updatedAt: first.updated_at, count: data.length, picks: data },
              { headers },
            );
          }
        }
        const picks = (poolData as Array<{ symbol: string; name: string }>).map((p, i) => ({
          symbol: p.symbol, name: p.name, sector: null, rank: i + 1, avg_dollar_vol_m: null, updated_at: null,
        }));
        return Response.json({ source: 'static-json', updatedAt: null, count: picks.length, picks }, { headers });
      },
    },
  },
});
