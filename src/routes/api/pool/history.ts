import { createFileRoute } from '@tanstack/react-router';
import { getSupabaseAdmin } from '@/lib/supabase';

// 候選池週報歷史：最近 8 次重選的名單（供週報頁比較新進／剔除）
export const Route = createFileRoute('/api/pool/history')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'Cache-Control': 'no-store' };
        const supa = getSupabaseAdmin();
        if (!supa) return Response.json({ source: 'supabase', weeks: [], note: '未設定 Supabase' }, { headers });
        const { data: weekRows, error: wErr } = await supa
          .from('pool_history')
          .select('week_start')
          .order('week_start', { ascending: false })
          .limit(800);
        if (wErr) return Response.json({ source: 'supabase', weeks: [], note: wErr.message }, { headers });
        const weeks = [...new Set((weekRows ?? []).map((r) => r.week_start as string))].slice(0, 8);
        if (weeks.length === 0) return Response.json({ source: 'supabase', weeks: [] }, { headers });
        const { data, error } = await supa
          .from('pool_history')
          .select('week_start,symbol,name,sector,rank,avg_dollar_vol_m')
          .in('week_start', weeks)
          .order('week_start', { ascending: false })
          .order('rank', { ascending: true });
        if (error) return Response.json({ source: 'supabase', weeks: [], note: error.message }, { headers });
        const grouped = weeks.map((w) => ({
          week_start: w,
          count: (data ?? []).filter((r) => r.week_start === w).length,
          picks: (data ?? []).filter((r) => r.week_start === w),
        }));
        return Response.json({ source: 'supabase', weeks: grouped }, { headers });
      },
    },
  },
});
