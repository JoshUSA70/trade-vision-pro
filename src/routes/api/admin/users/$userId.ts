import { createFileRoute } from '@tanstack/react-router';
import { requireApiAdmin, hashPassword, type SessionUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// 單一用戶管理（管理員）：停用/啟用、重設密碼、刪除（不能刪自己、不能刪最後一個管理員）
export const Route = createFileRoute('/api/admin/users/$userId')({
  server: {
    handlers: {
      PATCH: async (ctx) => {
        const authed = requireApiAdmin(ctx.request);
        if (authed instanceof Response) return authed;
        const me = authed as SessionUser;
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const { userId } = ctx.params as { userId: string };
          const body = (await ctx.request.json()) as { active?: boolean; password?: string; role?: string };
          const supa = getSupabaseAdmin();
          if (!supa) return Response.json({ ok: false, error: '系統尚未連接資料庫' }, { status: 500, headers });
          const patch: Record<string, unknown> = {};
          if (typeof body.active === 'boolean') {
            if (!body.active && userId === me.id) return Response.json({ ok: false, error: '不能停用自己' }, { status: 400, headers });
            patch['active'] = body.active;
          }
          if (body.password !== undefined) {
            if (body.password.length < 8) return Response.json({ ok: false, error: '密碼至少 8 個字元' }, { status: 400, headers });
            patch['password_hash'] = hashPassword(body.password);
          }
          if (body.role !== undefined) {
            if (!['admin', 'viewer'].includes(body.role)) return Response.json({ ok: false, error: '角色無效' }, { status: 400, headers });
            if (userId === me.id && body.role !== 'admin') return Response.json({ ok: false, error: '不能降級自己' }, { status: 400, headers });
            patch['role'] = body.role;
          }
          if (Object.keys(patch).length === 0) return Response.json({ ok: false, error: '沒有要更新的欄位' }, { status: 400, headers });
          const { error } = await supa.from('app_users').update(patch).eq('id', userId);
          if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers });
          return Response.json({ ok: true }, { headers });
        } catch {
          return Response.json({ ok: false, error: '更新失敗' }, { status: 500, headers });
        }
      },
      DELETE: async (ctx) => {
        const authed = requireApiAdmin(ctx.request);
        if (authed instanceof Response) return authed;
        const me = authed as SessionUser;
        const headers = { 'Cache-Control': 'no-store' };
        const { userId } = ctx.params as { userId: string };
        if (userId === me.id) return Response.json({ ok: false, error: '不能刪除自己' }, { status: 400, headers });
        const supa = getSupabaseAdmin();
        if (!supa) return Response.json({ ok: false, error: '系統尚未連接資料庫' }, { status: 500, headers });
        const { data: target } = await supa.from('app_users').select('role').eq('id', userId).maybeSingle();
        if ((target as { role: string } | null)?.role === 'admin') {
          const { count } = await supa.from('app_users').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
          if ((count ?? 0) <= 1) return Response.json({ ok: false, error: '不能刪除最後一個管理員' }, { status: 400, headers });
        }
        const { error } = await supa.from('app_users').delete().eq('id', userId);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers });
        return Response.json({ ok: true }, { headers });
      },
    },
  },
});
