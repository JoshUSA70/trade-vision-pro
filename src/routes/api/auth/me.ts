import { createFileRoute } from '@tanstack/react-router';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getSessionUser, clearSessionCookieHeader } from '@/lib/auth';

export const Route = createFileRoute('/api/auth/me')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const headers = { 'Cache-Control': 'no-store' };
        const user = getSessionUser(ctx.request);
        if (!user) return Response.json({ ok: false, user: null }, { status: 401, headers });
        const supa = getSupabaseAdmin();
        if (supa) {
          const { data } = await supa.from('app_users').select('active').eq('id', user.id).maybeSingle();
          if (!data || !(data as { active: boolean }).active) {
            return Response.json(
              { ok: false, user: null },
              { status: 401, headers: { ...headers, 'Set-Cookie': clearSessionCookieHeader() } },
            );
          }
        }
        return Response.json({ ok: true, user: { username: user.username, role: user.role } }, { headers });
      },
    },
  },
});
