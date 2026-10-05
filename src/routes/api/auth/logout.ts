import { createFileRoute } from '@tanstack/react-router';
import { clearSessionCookieHeader } from '@/lib/auth';

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () => Response.json(
        { ok: true },
        { headers: { 'Cache-Control': 'no-store', 'Set-Cookie': clearSessionCookieHeader() } },
      ),
    },
  },
});
