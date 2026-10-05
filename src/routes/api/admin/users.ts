import { createFileRoute } from '@tanstack/react-router';
import { requireApiAdmin, hashPassword } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// 用戶管理（管理員）
export const Route = createFileRoute('/api/admin/users')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const authed = requireApiAdmin(ctx.request);
        if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        const supa = getSupabaseAdmin();
        if (!supa) return Response.json({ ok: false, error: '系統尚未連接資料庫' }, { status: 500, headers });
        const { data, error } = await supa
          .from('app_users')
          .select('id,username,role,active,created_at')
          .order('created_at', { ascending: true });
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers });
        return Response.json({ ok: true, users: data }, { headers });
      },
      POST: async (ctx) => {
        const authed = requireApiAdmin(ctx.request);
        if (authed instanceof Response) return authed;
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const body = (await ctx.request.json()) as { username?: string; password?: string; role?: string };
          const username = (body.username ?? '').trim();
          const password = body.password ?? '';
          const role = body.role === 'admin' ? 'admin' : 'viewer';
          if (username.length < 3) return Response.json({ ok: false, error: '帳號至少 3 個字元' }, { status: 400, headers });
          if (password.length < 8) return Response.json({ ok: false, error: '密碼至少 8 個字元' }, { status: 400, headers });
          const supa = getSupabaseAdmin();
          if (!supa) return Response.json({ ok: false, error: '系統尚未連接資料庫' }, { status: 500, headers });
          const { data, error } = await supa
            .from('app_users')
            .insert({ username, password_hash: hashPassword(password), role, active: true })
            .select('id,username,role,active,created_at')
            .single();
          if (error) {
            const msg = error.message.includes('duplicate') || error.code === '23505' ? '帳號已存在' : error.message;
            return Response.json({ ok: false, error: msg }, { status: 400, headers });
          }
          return Response.json({ ok: true, user: data }, { headers });
        } catch {
          return Response.json({ ok: false, error: '建立失敗' }, { status: 500, headers });
        }
      },
    },
  },
});
