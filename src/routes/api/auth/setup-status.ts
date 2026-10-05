import { createFileRoute } from '@tanstack/react-router';
import { getSupabaseAdmin } from '@/lib/supabase';

export const Route = createFileRoute('/api/auth/setup-status')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'Cache-Control': 'no-store' };
        const supa = getSupabaseAdmin();
        if (!supa) return Response.json({ needsSetup: false, dbConnected: false }, { headers });
        const { count, error } = await supa.from('app_users').select('id', { count: 'exact', head: true });
        if (error) return Response.json({ needsSetup: false, dbConnected: true, error: error.message }, { headers });
        return Response.json({ needsSetup: (count ?? 0) === 0, dbConnected: true }, { headers });
      },
    },
  },
});
