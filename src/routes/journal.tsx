import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, CircleCheck, TrendingUp } from 'lucide-react';
import { TradingShell, PageHeading, SectionHeading } from '@/components/trading-shell';
import { money, signedMoney, trades } from '@/lib/trading-demo';

export const Route = createFileRoute('/journal')({ head: () => ({ meta: [
  {title:'交易日誌 | JoshQuantTrader Pro'}, {name:'description',content:'檢視 JoshQuantTrader Pro 的美股交易日誌與交易績效。'},
  {property:'og:title',content:'交易日誌 | JoshQuantTrader Pro'}, {property:'og:description',content:'檢視量化美股交易日誌與歷史交易績效。'},
  {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary'},
] }), component: Journal });

type Trade = typeof trades[number];

function Journal() {
  const [rows, setRows] = useState<Trade[]>(trades);
  const [live, setLive] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/alpaca-journal');
        const data = await r.json() as { source: string; trades: Trade[] | null };
        if (data.source === 'alpaca-paper' && data.trades) { setRows(data.trades); setLive(true); }
      } catch { /* keep demo fixtures */ }
    })();
  }, []);
  return <TradingShell live={live}><PageHeading eyebrow="TRADE HISTORY" title="交易日誌" description="回顧每一筆交易，讓決策有跡可循。" action={<span className="flex items-center gap-2 rounded-sm border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground"><CalendarDays size={15}/> {live ? 'Alpaca 歷史成交' : '2026 年 9 月 — 10 月'}</span>}/>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen size={15} className="text-primary"/>交易紀錄</div><p className="mt-3 text-2xl font-semibold tabular-nums">{rows.length.toString().padStart(2,'0')} <span className="text-xs font-normal text-subtle">筆交易</span></p></div><div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp size={15} className="text-primary"/>已實現盈虧</div><p className={`mt-3 text-2xl font-semibold tabular-nums ${live ? 'text-foreground' : 'text-positive'}`}>{live ? '—' : '+$740.80'}</p></div><div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><CircleCheck size={15} className="text-primary"/>已平倉交易</div><p className="mt-3 text-2xl font-semibold tabular-nums">{rows.length.toString().padStart(2,'0')} <span className="text-xs font-normal text-subtle">筆紀錄</span></p></div></div>
    <section className="overflow-hidden rounded-sm border border-border bg-card"><SectionHeading title="所有交易" subtitle="Trade history" action={<span className="rounded-sm border border-border bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{live ? 'Alpaca 模擬帳戶' : '模擬紀錄'}</span>}/><div className="overflow-x-auto"><table className="data-table w-full min-w-[790px] text-left"><thead><tr><th>日期 / DATE</th><th>股票 / SYMBOL</th><th>方向 / SIDE</th><th>數量 / QTY</th><th>成交價 / PRICE</th><th>成交金額 / TOTAL</th><th>已實現盈虧 / P&L</th><th>交易備註</th></tr></thead><tbody>{rows.map((t,i) => <tr key={i}><td><span className="block tabular-nums text-foreground">{t.date}</span><small className="text-[10px] text-subtle">{t.time}</small></td><td className="font-semibold text-foreground">{t.symbol}</td><td><span className={`rounded-sm border px-2 py-1 text-[11px] font-semibold ${t.side === '買入' ? 'border-positive/25 bg-positive/10 text-positive' : 'border-negative/25 bg-negative/10 text-negative'}`}>{t.side}</span></td><td className="tabular-nums text-foreground">{t.qty}</td><td className="tabular-nums text-foreground">{money(t.price)}</td><td className="tabular-nums text-foreground">{money(t.amount)}</td><td className="font-medium tabular-nums text-positive">{t.pnl === null ? <span className="text-subtle">—</span> : signedMoney(t.pnl)}</td><td className="text-muted-foreground">{t.note}</td></tr>)}</tbody></table></div><div className="border-t border-border px-6 py-4 text-[11px] text-subtle">{live ? 'Alpaca 模擬帳戶成交紀錄，僅供研究參考。' : '此頁為模擬交易日誌，不代表實際成交紀錄。'}</div></section>
  </TradingShell>;
}
