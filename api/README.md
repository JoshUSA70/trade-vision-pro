# JoshQuantTrader Pro API contract

TanStack Start serves the working demo endpoints from `src/routes/api/`. This root-level folder is reserved for API documentation and future provider integration.

- `GET /api/alpaca-positions` → `{ source: "demo", positions: [{ symbol, qty, avg_price, market_price, pnl, ... }] }`
- `GET /api/scan` → `{ source: "demo", scanned_at, signals: [{ symbol, price, rsi, signal, score, ... }] }`

Both endpoints currently return fixture data only. Replace their handlers with authenticated, server-side provider calls before connecting a brokerage account. Never place brokerage keys in browser code.
