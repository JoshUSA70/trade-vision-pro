/** Demo-only market fixtures. Replace the API handlers with provider-backed data later. */
export const positions = [
  { symbol: 'NVDA', name: 'NVIDIA Corp.', qty: 42, avg_price: 124.80, market_price: 142.56, pnl: 745.92, change: 14.23 },
  { symbol: 'AAPL', name: 'Apple Inc.', qty: 85, avg_price: 198.42, market_price: 211.35, pnl: 1099.05, change: 6.52 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', qty: 36, avg_price: 402.18, market_price: 418.92, pnl: 602.64, change: 4.16 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', qty: 64, avg_price: 183.25, market_price: 178.64, pnl: -295.04, change: -2.52 },
  { symbol: 'META', name: 'Meta Platforms Inc.', qty: 18, avg_price: 521.40, market_price: 548.72, pnl: 491.76, change: 5.24 },
];

export const equityCurve = [
  { date: '09/01', value: 101200 }, { date: '09/04', value: 102450 }, { date: '09/07', value: 101780 },
  { date: '09/10', value: 104300 }, { date: '09/13', value: 103620 }, { date: '09/16', value: 106890 },
  { date: '09/19', value: 105920 }, { date: '09/22', value: 108460 }, { date: '09/25', value: 107940 },
  { date: '09/28', value: 110210 }, { date: '10/01', value: 109480 }, { date: '10/04', value: 112648.32 },
];

export const signals = [
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 142.56, rsi: 38.2, signal: '強勢買入', kind: 'buy', score: 92 },
  { symbol: 'PLTR', name: 'Palantir Technologies', price: 46.18, rsi: 42.7, signal: '買入', kind: 'buy', score: 86 },
  { symbol: 'AAPL', name: 'Apple Inc.', price: 211.35, rsi: 56.4, signal: '觀望', kind: 'hold', score: 72 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.50, rsi: 74.8, signal: '賣出', kind: 'sell', score: 41 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', price: 164.28, rsi: 34.1, signal: '強勢買入', kind: 'buy', score: 89 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 418.92, rsi: 61.3, signal: '觀望', kind: 'hold', score: 68 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.64, rsi: 68.9, signal: '觀望', kind: 'hold', score: 64 },
];

export const trades = [
  { date: '2026-10-02', time: '14:32', symbol: 'NVDA', side: '買入', qty: 12, price: 139.80, amount: 1677.60, pnl: null, note: '突破關鍵阻力位' },
  { date: '2026-10-01', time: '10:18', symbol: 'TSLA', side: '賣出', qty: 20, price: 252.40, amount: 5048.00, pnl: 428.00, note: '達到目標價位' },
  { date: '2026-09-29', time: '11:45', symbol: 'AMD', side: '買入', qty: 30, price: 158.60, amount: 4758.00, pnl: null, note: 'RSI 超賣反彈' },
  { date: '2026-09-26', time: '15:07', symbol: 'META', side: '賣出', qty: 8, price: 542.10, amount: 4336.80, pnl: 312.80, note: '部分獲利了結' },
  { date: '2026-09-24', time: '09:52', symbol: 'AAPL', side: '買入', qty: 25, price: 205.30, amount: 5132.50, pnl: null, note: '趨勢延續加倉' },
  { date: '2026-09-20', time: '13:21', symbol: 'AMZN', side: '買入', qty: 24, price: 181.20, amount: 4348.80, pnl: null, note: '回踩支撐位' },
];

export const money = (value: number) => '$' + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const signedMoney = (value: number) => `${value >= 0 ? '+' : '−'}${money(value)}`;
