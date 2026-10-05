import { createFileRoute } from '@tanstack/react-router';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashPassword, signSession, sessionCookieHeader } from '@/lib/auth';

// 只在 app_users 為空時可建立第一個管理員
export const Route = createFileRoute('/api/auth/setup')({
  server: {
    handlers: {
      POST: async (ctx) => {
        const headers = { 'Cache-Control': 'no-store' };
        try {
          const supa = getSupabaseAdmin();
          if (!supa) return Response.json({ ok: false, error: '系統尚未連接資料庫' }, { status: 500, headers });
          const { count } = await supa.from('app_users').select('id', { count: 'exact', head: true });
          if ((count ?? 0) > 0) return Response.json({ ok: false, error: '管理員已存在' }, { status: 403, headers });
          const body = (await ctx.request.json()) as { username?: string; password?: string };
          const username = (body.username ?? '').trim();
          const password = body.password ?? '';
          if (username.length < 3) return Response.json({ ok: false, error: '帳號至少 3 個字元' }, { status: 400, headers });
          if (password.length < 8) return Response.json({ ok: false, error: '密碼至少 8 個字元' }, { status: 400, headers });
          const { data, error } = await supa
            .from('app_users')
            .insert({ username, password_hash: hashPassword(password), role: 'admin', active: true })
            .select('id,username,role')
            .single();
          if (error || !data) return Response.json({ ok: false, error: '建立失敗' }, { status: 500, headers });
          const token = signSession({ id: (data as { id: string }).id, username, role: 'admin' });
          return Response.json(
            { ok: true, user: { username, role: 'admin' } },
            { headers: { ...headers, 'Set-Cookie': sessionCookieHeader(token) } },
          );
        } catch {
          return Response.json({ ok: false, error: '建立失敗，請稍後再試' }, { status: 500, headers });
        }
      },
    },
  },
});
