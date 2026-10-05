import { createFileRoute } from '@tanstack/react-router';
import { requireApiAdmin } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAppConfig, CONFIG_DEFAULTS, CONFIG_META, type AppConfig } from '@/lib/app-config';

// 交易參數讀寫（管理員）：存 Supabase app_config，下次執行自動生效
export const Route = createFileRoute('/api/admin/config')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const authed = requireApiAdmin(ctx.request);
        if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        const cfg = await getAppConfig();
        return Response.json({ source: 'admin-config', config: cfg, meta: CONFIG_META, defaults: CONFIG_DEFAULTS }, { headers });
      },
      PUT: async (ctx) => {
        const authed = requireApiAdmin(ctx.request);
        if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const body = (await ctx.request.json()) as Partial<Record<keyof AppConfig, number>>;
          const supa = getSupabaseAdmin();
          if (!supa) return Response.json({ ok: false, error: '系統尚未連接資料庫' }, { status: 500, headers });
          const rows: Array<{ key: string; value: string; updated_at: string }> = [];
          for (const k of Object.keys(CONFIG_DEFAULTS) as Array<keyof AppConfig>) {
            const v = body[k];
            if (v === undefined) continue;
            const n = Number(v);
            if (!Number.isFinite(n)) return Response.json({ ok: false, error: `${k} 必須是數字` }, { status: 400, headers });
            const meta = CONFIG_META[k];
            if (n < meta.min || n > meta.max) {
              return Response.json({ ok: false, error: `${meta.label} 需在 ${meta.min}～${meta.max} 之間` }, { status: 400, headers });
            }
            rows.push({ key: k, value: String(n), updated_at: new Date().toISOString() });
          }
          if (rows.length === 0) return Response.json({ ok: false, error: '沒有要更新的參數' }, { status: 400, headers });
          const { error } = await supa.from('app_config').upsert(rows, { onConflict: 'key' });
          if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers });
          return Response.json({ ok: true, updated: rows.length }, { headers });
        } catch {
          return Response.json({ ok: false, error: '更新失敗' }, { status: 500, headers });
        }
      },
    },
  },
});
