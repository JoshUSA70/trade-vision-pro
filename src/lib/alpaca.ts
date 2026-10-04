// Alpaca Paper 共用客戶端（server 端使用）

const PAPER_BASE = 'https://paper-api.alpaca.markets';

function headers() {
  const key = process.env['ALPACA_API_KEY'];
  const secret = process.env['ALPACA_SECRET_KEY'];
  if (!key || !secret) throw new Error('請在 Vercel 設定 API Key（ALPACA_API_KEY / ALPACA_SECRET_KEY）');
  return { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret, 'Content-Type': 'application/json' };
}

export type AlpacaAccount = {
  equity: string;
  last_equity: string;
  buying_power: string;
  portfolio_value: string;
};

export async function getAccount(): Promise<AlpacaAccount> {
  const res = await fetch(`${PAPER_BASE}/v2/account`, { headers: headers() });
  if (!res.ok) throw new Error(`讀取帳戶失敗（${res.status}）`);
  return (await res.json()) as AlpacaAccount;
}

export type AlpacaPosition = { symbol: string; market_value: string; qty: string };

export async function getPositions(): Promise<AlpacaPosition[]> {
  const res = await fetch(`${PAPER_BASE}/v2/positions`, { headers: headers() });
  if (!res.ok) throw new Error(`讀取持倉失敗（${res.status}）`);
  return (await res.json()) as AlpacaPosition[];
}

export type AlpacaOrder = {
  id: string;
  symbol: string;
  qty: string;
  side: string;
  status: string;
  filled_avg_price: string | null;
  submitted_at: string;
  filled_at: string | null;
};

export async function getOrders(limit = 200): Promise<AlpacaOrder[]> {
  const res = await fetch(`${PAPER_BASE}/v2/orders?status=all&limit=${limit}&direction=desc`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`讀取訂單失敗（${res.status}）`);
  return (await res.json()) as AlpacaOrder[];
}

export async function placeMarketOrder(symbol: string, qty: number, side: 'buy' | 'sell'): Promise<AlpacaOrder> {
  const res = await fetch(`${PAPER_BASE}/v2/orders`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ symbol, qty, side, type: 'market', time_in_force: 'day' }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data['message'] === 'string' ? data['message'] : `Alpaca 下單失敗（${res.status}）`;
    throw new Error(msg);
  }
  return data as unknown as AlpacaOrder;
}

/** 美東當日日期字串（Alpaca 時間戳為 UTC，轉美東判定「當日」） */
export function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function isTodayET(iso: string): boolean {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === todayET();
}
