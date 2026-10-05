import { createFileRoute } from '@tanstack/react-router';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyPassword, signSession, sessionCookieHeader } from '@/lib/auth';

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: async (ctx) => {
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const body = (await ctx.request.json()) as { username?: string; password?: string };
          const username = (body.username ?? '').trim();
          const password = body.password ?? '';
          if (!username || !password) {
            return Response.json({ ok: false, error: '請輸入帳號與密碼' }, { status: 400, headers });
          }
          const supa = getSupabaseAdmin();
          if (!supa) return Response.json({ ok: false, error: '系統尚未連接資料庫' }, { status: 500, headers });
          const { data, error } = await supa
            .from('app_users')
            .select('id,username,password_hash,role,active')
            .eq('username', username)
            .maybeSingle();
          if (error || !data || !data.active || !verifyPassword(password, data.password_hash as string)) {
            return Response.json({ ok: false, error: '帳號或密碼錯誤' }, { status: 401, headers });
          }
          const token = signSession({ id: data.id as string, username: data.username as string, role: data.role as 'admin' | 'viewer' });
          return Response.json(
            { ok: true, user: { username: data.username, role: data.role } },
            { headers: { ...headers, 'Set-Cookie': sessionCookieHeader(token) } },
          );
        } catch {
          return Response.json({ ok: false, error: '登入失敗，請稍後再試' }, { status: 500, headers });
        }
      },
    },
  },
});
