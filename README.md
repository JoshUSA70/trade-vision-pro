# Trade Vision Pro

請建立一個名為 JoshQuantTrader Pro 的個人量化美股專業網站。

設計要求：

- 風格：深色專業交易終端，像 Bloomberg，黑色背景 + 綠色/紅色漲跌

- 版型：左側 Sidebar 導航，右側主內容

- 技術：React + Tailwind + Recharts + Supabase

頁面結構：

1. Dashboard: 4個數據卡片 (總資產、今日盈虧、持倉數量、現金)，下方一個資金曲線圖(用 Recharts AreaChart)，再下方一個目前持倉表格(symbol, qty, avg_price, market_price, pnl)

2. Scanner: 一個股票掃描表格，欄位: Symbol, Price, RSI, Signal, Score。表格上方有一個 "開始掃描" 按鈕

3. Journal: 交易日誌表格

功能要求：

- 先用 Supabase 建立 3個 table: positions, trades, signals

- 所有數據先用假數據展示，但程式碼要預留呼叫 /api/alpaca-positions 和 /api/scan 的接口

- 幫我在根目錄建立好 /api 資料夾

先把前端做漂亮，後端接口留好就行。

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bd86f4d5-aa3c-4b56-8fdc-49e476fd9da9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
