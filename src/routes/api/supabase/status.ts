import { createFileRoute } from '@tanstack/react-router';
import { supabaseStatus } from '@/lib/supabase';

// 診斷：Supabase 環境變數是否已設定（只回傳有無，不回傳值）
export const Route = createFileRoute('/api/supabase/status')({
  server: {
    handlers: {
      GET: async () => Response.json({ source: 'supabase-status', ...supabaseStatus() }, { headers: { 'Cache-Control': 'no-store' } }),
    },
  },
});
