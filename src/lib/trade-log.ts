// 下單成功後寫入 Supabase trades 表（best-effort：沒設定 service key 不影響下單本身）
import { createClient } from '@supabase/supabase-js';

export async function logTradeToSupabase(input: {
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  notes: string;
}): Promise<{ logged: boolean; note?: string }> {
  const supaUrl = process.env['SUPABASE_URL'];
  const supaKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!supaUrl || !supaKey) {
    return { logged: false, note: '未設定 SUPABASE_SERVICE_ROLE_KEY，交易紀錄未寫入 Supabase' };
  }
  try {
    const supa = createClient(supaUrl, supaKey);
    const ownerId = process.env['TRADING_OWNER_ID'] ?? '00000000-0000-0000-0000-000000000000';
    const { error } = await supa.from('trades').insert({
      owner_id: ownerId,
      symbol: input.symbol,
      side: input.side,
      qty: input.qty,
      price: input.price,
      executed_at: new Date().toISOString(),
      notes: input.notes,
    });
    if (error) return { logged: false, note: `Supabase 寫入失敗：${error.message}` };
    return { logged: true };
  } catch (e) {
    return { logged: false, note: `Supabase 寫入異常：${e instanceof Error ? e.message : 'unknown'}` };
  }
}
