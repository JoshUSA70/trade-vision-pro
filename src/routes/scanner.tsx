import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Radar, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TradingShell, PageHeading, SectionHeading, SymbolCell } from '@/components/trading-shell';
import { money } from '@/lib/trading-demo';

export const Route = createFileRoute('/scanner')({ head: () => ({ meta: [
  {title:'股票掃描 | JoshQuantTrader Pro'}, {name:'description',content:'RSI + 量能智能選股，評分達標即顯示買入訊號。'},
  {property:'og:title',content:'股票掃描 | JoshQuantTrader Pro'}, {property:'og:description',content:'RSI + 量能智能選股引擎。'},
  {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary'},
] }), component: Scanner });

type Signal = {
  symbol: string; name: string; price: number; rsi: number;
  volume_ratio: number; score: number; signal: 'STRONG_BUY' | 'BUY'; sma50: number;
  trend: '多頭排列' | '偏多' | '偏空'; macd_hist: number | null;
};
type Risk = {
  source: string; todayOrderCount: number; dayLossPct: number | null;
  dayLossBreached: boolean; maxPositionPct: number | null; maxPositionSymbol: string | null;
  concentrationBreached: boolean;
} | null;

function Scanner() {
  const [rows, setRows] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState('尚未掃描');
  const [src, setSrc] = useState('demo');
  const [counts, setCounts] = useState({ candidates: 0, universe: 0 });
  const [error, setError] = useState('');
  const [risk, setRisk] = useState<Risk>(null);
  const [confirmSym, setConfirmSym] = useState<Signal | null>(null);
  const [ordering, setOrdering] = useState(false);
  const live = src === 'yahoo' || src === 'yahoo-dynamic';

  async function loadRisk() {
    try {
      const r = await fetch('/api/risk');
      const data = await r.json();
      if (data.source === 'alpaca-paper' || data.source === 'demo') setRisk(data);
    } catch { /* 風控面板保持空白 */ }
  }
  useEffect(() => { void loadRisk(); }, []);

  async function scan() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/scan');
      const data = await response.json() as {signals: Signal[]; scanned_at: string; source: string; error?: string; candidates?: number; universe?: number};
      if (!response.ok || data.source === 'error') throw new Error(data.error || '掃描暫時無法使用');
      setRows(data.signals); setSrc(data.source);
      setCounts({ candidates: data.candidates ?? 0, universe: data.universe ?? 0 });
      setLastScan(`即時掃描 · ${new Date(data.scanned_at).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}`);
      if (data.signals.length === 0) toast.info('本次掃描沒有 Score ≥ 60 的標的');
    } catch (e) { setError(e instanceof Error ? e.message : '掃描暫時無法使用，請稍後再試。'); }
    finally { setLoading(false); }
  }

  async function placeOrder() {
    if (!confirmSym) return;
    setOrdering(true);
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: confirmSym.symbol, qty: 1, side: 'buy' }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; order?: { status?: string }; logNote?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || '下單失敗');
      toast.success(`買入 1 股 ${confirmSym.symbol} 成功（${data.order?.status ?? '已送出'}）`, {
        description: data.logNote,
      });
      void loadRisk();
    } catch (e) {
      toast.error('下單失敗', { description: e instanceof Error ? e.message : '請稍後再試' });
    } finally {
      setOrdering(false);
      setConfirmSym(null);
    }
  }

  const strongBuys = rows.filter(s => s.signal === 'STRONG_BUY').length;
  return <TradingShell live={live}><PageHeading eyebrow="MARKET INTELLIGENCE" title="智能選股" description="RSI + 量能雙因子評分，達標即顯示買入訊號，可一鍵下單到 Alpaca 模擬帳戶。" action={<Button type="button" onClick={scan} disabled={loading} className="h-9 rounded-sm px-4 text-xs font-semibold"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>{loading ? '掃描中…' : '開始掃描'}</Button>}/>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Radar size={15} className="text-primary"/>達標標的</div><p className="mt-3 text-2xl font-semibold tabular-nums">{rows.length.toString().padStart(2,'0')} <span className="text-xs font-normal text-subtle">檔股票</span></p></div><div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-positive"/>強力買入</div><p className="mt-3 text-2xl font-semibold tabular-nums text-positive">{strongBuys.toString().padStart(2,'0')} <span className="text-xs font-normal text-subtle">個訊號</span></p></div><div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><SlidersHorizontal size={15} className="text-primary"/>掃描狀態</div><p className="mt-3 text-sm font-semibold">{lastScan}</p></div></div>
    {error && <p role="alert" className="mb-4 text-sm text-negative">{error}</p>}
    <section className="overflow-hidden rounded-sm border border-border bg-card"><SectionHeading title="選股結果" subtitle={live && counts.candidates > 0 ? `候選 ${counts.candidates} 檔 → 精選 ${counts.universe} 檔` : live ? 'US Equities · 即時行情' : 'Score ≥ 60 才顯示'} action={<span className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary"/> {rows.length} 個標的</span>}/><div className="overflow-x-auto"><table className="data-table w-full min-w-[980px] text-left"><thead><tr><th>股票 / SYMBOL</th><th>價格 / PRICE</th><th>RSI(14)</th><th>量比 / VOL RATIO</th><th>SMA50</th><th>趨勢 / TREND</th><th className="text-right">評分 / SCORE</th><th>訊號 / SIGNAL</th><th className="text-right">操作 / ACTION</th></tr></thead><tbody>{rows.map(s => <tr key={s.symbol}><td><SymbolCell symbol={s.symbol} name={s.name}/></td><td className="font-medium tabular-nums text-foreground">{money(s.price)}</td><td><span className={`tabular-nums ${s.rsi < 35 ? 'font-semibold text-positive' : s.rsi > 70 ? 'text-negative' : 'text-foreground'}`}>{s.rsi.toFixed(1)}</span><div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-secondary"><div className={`h-full ${s.rsi > 70 ? 'bg-negative' : 'bg-primary'}`} style={{width:`${Math.min(s.rsi,100)}%`}}/></div></td><td className={`tabular-nums ${s.volume_ratio > 1.5 ? 'font-semibold text-positive' : 'text-foreground'}`}>{s.volume_ratio.toFixed(2)}x</td><td className="tabular-nums text-muted-foreground">{money(s.sma50)}</td><td><span className={`inline-flex rounded-sm border px-2 py-1 text-[11px] font-semibold ${s.trend === '多頭排列' ? 'border-positive/40 bg-positive/15 text-positive' : s.trend === '偏多' ? 'border-positive/25 bg-positive/10 text-positive' : 'border-border bg-secondary text-muted-foreground'}`}>{s.trend}</span><div className={`mt-1 text-[10px] tabular-nums ${s.macd_hist !== null && s.macd_hist >= 0 ? 'text-positive' : 'text-negative'}`}>MACD {s.macd_hist !== null ? `${s.macd_hist >= 0 ? '+' : ''}${s.macd_hist.toFixed(2)}` : '—'}</div></td><td className="text-right"><span className="inline-flex min-w-12 justify-center rounded-sm border border-border bg-secondary px-2 py-1 font-semibold tabular-nums text-foreground">{s.score}</span><span className="ml-1 text-[10px] text-subtle">/100</span></td><td><span className={`inline-flex rounded-sm border px-2 py-1 text-[11px] font-semibold ${s.signal === 'STRONG_BUY' ? 'border-positive/40 bg-positive/15 text-positive' : 'border-positive/25 bg-positive/10 text-positive'}`}>{s.signal === 'STRONG_BUY' ? 'STRONG_BUY 強力買入' : 'BUY 買入'}</span></td><td className="text-right"><Button type="button" size="sm" onClick={() => setConfirmSym(s)} className="h-8 rounded-sm bg-positive px-3 text-[11px] font-semibold text-white hover:bg-positive/90">一鍵買入</Button></td></tr>)}</tbody></table></div><div className="border-t border-border px-6 py-4 text-[11px] text-subtle">{live ? '即時市場數據（Yahoo Finance），評分僅供研究參考，不構成投資建議。' : '尚未掃描。按下「開始掃描」執行智能選股＋四因子評分（RSI/量比/趨勢/MACD）。'}</div></section>

    <section className="mt-6 overflow-hidden rounded-sm border border-border bg-card"><SectionHeading title="風控狀態" subtitle="Risk monitor" action={<ShieldCheck size={15} className="text-muted-foreground" />} /><div className="grid gap-3 px-6 py-5 sm:grid-cols-3">
      <div><p className="text-[11px] text-muted-foreground">今日已下單</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{risk ? `${risk.todayOrderCount} 筆` : '—'}</p></div>
      <div><p className="text-[11px] text-muted-foreground">今日虧損（上限 2%）</p><p className={`mt-1 text-xl font-semibold tabular-nums ${risk?.dayLossBreached ? 'text-negative' : 'text-foreground'}`}>{risk?.dayLossPct === null || risk?.dayLossPct === undefined ? '—' : `${risk.dayLossPct >= 0 ? '+' : ''}${risk.dayLossPct.toFixed(2)}%`}{risk?.dayLossBreached ? ' ⚠ 超標' : ''}</p></div>
      <div><p className="text-[11px] text-muted-foreground">最大單檔持倉（上限 25%）</p><p className={`mt-1 text-xl font-semibold tabular-nums ${risk?.concentrationBreached ? 'text-negative' : 'text-foreground'}`}>{risk?.maxPositionPct === null || risk?.maxPositionPct === undefined ? '—' : `${risk.maxPositionSymbol} ${risk.maxPositionPct.toFixed(2)}%`}{risk?.concentrationBreached ? ' ⚠ 超標' : ''}</p></div>
    </div></section>

    <AlertDialog open={!!confirmSym} onOpenChange={(open) => { if (!open) setConfirmSym(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確認下單</AlertDialogTitle>
          <AlertDialogDescription>
            確定要買入 1 股 {confirmSym?.symbol} @ 市價嗎？ Score: {confirmSym?.score}（{confirmSym?.signal}）。市價單將以 Alpaca 模擬帳戶成交。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ordering}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); void placeOrder(); }} disabled={ordering} className="bg-positive text-white hover:bg-positive/90">
            {ordering ? '下單中…' : '確認買入'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </TradingShell>;
}
