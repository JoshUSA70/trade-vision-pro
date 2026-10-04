import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Radar, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TradingShell, PageHeading, SectionHeading, SymbolCell } from '@/components/trading-shell';
import { money, signals as demoSignals } from '@/lib/trading-demo';

export const Route = createFileRoute('/scanner')({ head: () => ({ meta: [
  {title:'股票掃描 | JoshQuantTrader Pro'}, {name:'description',content:'以 RSI、訊號與評分檢視美股掃描示範結果。'},
  {property:'og:title',content:'股票掃描 | JoshQuantTrader Pro'}, {property:'og:description',content:'以 RSI、訊號與評分檢視美股掃描示範結果。'},
  {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary'},
] }), component: Scanner });

type Signal = typeof demoSignals[number];
function Scanner() {
  const [rows,setRows] = useState<Signal[]>(demoSignals);
  const [loading,setLoading] = useState(false);
  const [lastScan,setLastScan] = useState('示範結果');
  const [src,setSrc] = useState('demo');
  const [error,setError] = useState('');
  const live = src === 'finnhub';
  async function scan() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/scan');
      if (!response.ok) throw new Error('掃描暫時無法使用');
      const data = await response.json() as {signals: Signal[]; scanned_at: string; source: string};
      setRows(data.signals); setSrc(data.source);
      setLastScan(`${data.source === 'finnhub' ? 'Finnhub 即時掃描' : '模擬掃描'} · ${new Date(data.scanned_at).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}`);
    } catch { setError('掃描暫時無法使用，請稍後再試。'); }
    finally { setLoading(false); }
  }
  return <TradingShell live={live}><PageHeading eyebrow="MARKET INTELLIGENCE" title="股票掃描" description="快速辨識市場訊號，聚焦值得關注的交易機會。" action={<Button type="button" onClick={scan} disabled={loading} className="h-9 rounded-sm px-4 text-xs font-semibold"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>{loading ? '掃描中…' : '開始掃描'}</Button>}/>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Radar size={15} className="text-primary"/>掃描標的</div><p className="mt-3 text-2xl font-semibold tabular-nums">{rows.length.toString().padStart(2,'0')} <span className="text-xs font-normal text-subtle">檔股票</span></p></div><div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-positive"/>買入訊號</div><p className="mt-3 text-2xl font-semibold tabular-nums text-positive">{rows.filter(s => s.kind === 'buy').length.toString().padStart(2,'0')} <span className="text-xs font-normal text-subtle">個機會</span></p></div><div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><SlidersHorizontal size={15} className="text-primary"/>掃描狀態</div><p className="mt-3 text-sm font-semibold">{lastScan}</p></div></div>
    {error && <p role="alert" className="mb-4 text-sm text-negative">{error}</p>}
    <section className="overflow-hidden rounded-sm border border-border bg-card"><SectionHeading title="掃描結果" subtitle={live ? 'US Equities · Finnhub 即時' : 'US Equities · 模擬資料'} action={<span className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary"/> {rows.length} 個標的</span>}/><div className="overflow-x-auto"><table className="data-table w-full min-w-[650px] text-left"><thead><tr><th>股票 / SYMBOL</th><th>價格 / PRICE</th><th>相對強弱 / RSI</th><th>交易訊號 / SIGNAL</th><th className="text-right">量化評分 / SCORE</th></tr></thead><tbody>{rows.map(s => <tr key={s.symbol}><td><SymbolCell symbol={s.symbol} name={s.name}/></td><td className="font-medium tabular-nums text-foreground">{money(s.price)}</td><td><span className={`tabular-nums ${s.rsi < 40 ? 'text-positive' : s.rsi > 70 ? 'text-negative' : 'text-foreground'}`}>{s.rsi.toFixed(1)}</span><div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-secondary"><div className={`h-full ${s.rsi > 70 ? 'bg-negative' : 'bg-primary'}`} style={{width:`${s.rsi}%`}}/></div></td><td><span className={`inline-flex rounded-sm border px-2 py-1 text-[11px] font-medium ${s.kind === 'buy' ? 'border-positive/25 bg-positive/10 text-positive' : s.kind === 'sell' ? 'border-negative/25 bg-negative/10 text-negative' : 'border-border bg-secondary text-muted-foreground'}`}>{s.signal}</span></td><td className="text-right"><span className="inline-flex min-w-12 justify-center rounded-sm border border-border bg-secondary px-2 py-1 font-semibold tabular-nums text-foreground">{s.score}</span><span className="ml-1 text-[10px] text-subtle">/100</span></td></tr>)}</tbody></table></div><div className="border-t border-border px-6 py-4 text-[11px] text-subtle">{live ? 'Finnhub 即時市場數據，僅供研究參考。' : '此頁顯示模擬分析結果，非即時市場訊號。'}</div></section>
  </TradingShell>;
}
