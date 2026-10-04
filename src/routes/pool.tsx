import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CalendarRange, Layers, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TradingShell, PageHeading, SectionHeading, SymbolCell } from '@/components/trading-shell';

export const Route = createFileRoute('/pool')({ head: () => ({ meta: [
  {title:'股票池 | JoshQuantTrader Pro'}, {name:'description',content:'每周重選的候選股票池與週報：新進、剔除名單對照。'},
  {property:'og:title',content:'股票池 | JoshQuantTrader Pro'}, {property:'og:description',content:'每周候選池與週報。'},
  {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary'},
] }), component: PoolPage });

type Pick = {
  symbol: string; name: string; sector: string | null; rank: number;
  avg_dollar_vol_m: number | null; updated_at?: string | null;
};
type PoolData = { source: string; updatedAt: string | null; count: number; picks: Pick[] };
type WeekGroup = { week_start: string; count: number; picks: Pick[] };

const SECTOR_LABEL: Record<string, string> = {
  etf: 'ETF', tech: '科技', comm: '通訊', consumer: '消費', financial: '金融',
  healthcare: '醫療', energy: '能源', industrial: '工業', staples: '必需消費', utilities: '公用事業',
};
const sectorLabel = (s: string | null) => (s && SECTOR_LABEL[s]) || '—';

function PoolPage() {
  const [tab, setTab] = useState<'pool' | 'report'>('pool');
  const [pool, setPool] = useState<PoolData | null>(null);
  const [weeks, setWeeks] = useState<WeekGroup[]>([]);
  const [sectorFilter, setSectorFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [reportNote, setReportNote] = useState('');

  async function loadPool() {
    setLoading(true);
    try {
      const r = await fetch('/api/pool');
      const data = await r.json() as PoolData;
      setPool(data);
    } catch { toast.error('股票池載入失敗'); }
    finally { setLoading(false); }
  }
  async function loadHistory() {
    try {
      const r = await fetch('/api/pool/history');
      const data = await r.json() as { weeks: WeekGroup[]; note?: string };
      setWeeks(data.weeks ?? []);
      if (data.note) setReportNote(data.note);
    } catch { setReportNote('週報載入失敗'); }
  }
  useEffect(() => { void loadPool(); }, []);
  useEffect(() => { if (tab === 'report' && weeks.length === 0) void loadHistory(); }, [tab]);

  async function manualRefresh() {
    setConfirmRefresh(false); setRefreshing(true);
    try {
      const r = await fetch('/api/cron/weekly-pool');
      const data = await r.json() as { ok?: boolean; error?: string; picks?: number };
      if (!r.ok || !data.ok) throw new Error(data.error || '重選失敗');
      toast.success(`候選池已重選：${data.picks} 檔`);
      await loadPool(); await loadHistory();
    } catch (e) { toast.error('重選失敗', { description: e instanceof Error ? e.message : '請稍後再試' }); }
    finally { setRefreshing(false); }
  }

  const sectors = pool ? [...new Set(pool.picks.map((p) => p.sector).filter(Boolean) as string[])] : [];
  const filtered = pool ? pool.picks.filter((p) => sectorFilter === 'all' || p.sector === sectorFilter) : [];
  const mix: Record<string, number> = {};
  if (pool) for (const p of pool.picks) if (p.sector) mix[p.sector] = (mix[p.sector] ?? 0) + 1;

  // 週報：最新一週 vs 上一週
  const latest = weeks[0]; const prev = weeks[1];
  const latestSyms = new Set((latest?.picks ?? []).map((p) => p.symbol));
  const prevSyms = new Set((prev?.picks ?? []).map((p) => p.symbol));
  const added = (latest?.picks ?? []).filter((p) => !prevSyms.has(p.symbol));
  const removed = (prev?.picks ?? []).filter((p) => !latestSyms.has(p.symbol));

  return <TradingShell live><PageHeading eyebrow="UNIVERSE" title="股票池" description="每周日自動重選的候選股票池（101 檔），每日從中精選 25 檔評分交易。週報對照每周新進／剔除名單。" action={<div className="flex gap-2">
    <Button type="button" variant={tab === 'pool' ? 'default' : 'outline'} onClick={() => setTab('pool')} className="h-9 rounded-sm px-4 text-xs font-semibold"><Layers size={15}/>本週股票池</Button>
    <Button type="button" variant={tab === 'report' ? 'default' : 'outline'} onClick={() => setTab('report')} className="h-9 rounded-sm px-4 text-xs font-semibold"><CalendarRange size={15}/>週報</Button>
  </div>}/>

    {tab === 'pool' && <>
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Layers size={15} className="text-primary"/>本週檔數</div><p className="mt-3 text-2xl font-semibold tabular-nums">{pool ? pool.count : '—'} <span className="text-xs font-normal text-subtle">檔</span></p></div>
        <div className="rounded-sm border border-border bg-card p-5"><div className="text-xs text-muted-foreground">更新時間</div><p className="mt-3 text-sm font-semibold">{pool?.updatedAt ? new Date(pool.updatedAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : pool ? '靜態名單' : '—'}</p></div>
        <div className="rounded-sm border border-border bg-card p-5"><div className="text-xs text-muted-foreground">資料來源</div><p className="mt-3 text-sm font-semibold">{pool ? (pool.source === 'supabase-weekly' ? '每周自動重選 ✅' : '靜態 JSON（等 Supabase 設定）') : '—'}</p></div>
        <div className="rounded-sm border border-border bg-card p-5"><div className="text-xs text-muted-foreground">板塊分布</div><p className="mt-3 text-xs leading-5 text-foreground">{Object.entries(mix).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `${sectorLabel(k)}${v}`).join(' · ') || '—'}</p></div>
      </div>
      <section className="overflow-hidden rounded-sm border border-border bg-card"><SectionHeading title="本週候選池" subtitle={pool ? `${pool.count} 檔 · 依流動性排序` : ''} action={<div className="flex items-center gap-2">
        <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} className="h-8 rounded-sm border border-border bg-secondary px-2 text-xs text-foreground">
          <option value="all">全部板塊</option>{sectors.map((s) => <option key={s} value={s}>{sectorLabel(s)}</option>)}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmRefresh(true)} disabled={refreshing} className="h-8 rounded-sm px-3 text-[11px]"><RefreshCw size={13} className={refreshing ? 'animate-spin' : ''}/>{refreshing ? '重選中…' : '手動重選'}</Button>
      </div>}/><div className="overflow-x-auto"><table className="data-table w-full min-w-[720px] text-left"><thead><tr><th className="w-16">排名</th><th>股票 / SYMBOL</th><th>板塊</th><th className="text-right">20日均成交金額</th></tr></thead><tbody>{filtered.map((p) => <tr key={p.symbol}><td className="tabular-nums text-muted-foreground">{p.rank}</td><td><SymbolCell symbol={p.symbol} name={p.name}/></td><td><span className="inline-flex rounded-sm border border-border bg-secondary px-2 py-1 text-[11px] font-semibold text-muted-foreground">{sectorLabel(p.sector)}</span></td><td className="text-right tabular-nums text-foreground">{p.avg_dollar_vol_m !== null ? `$${p.avg_dollar_vol_m.toLocaleString('en-US')}M` : '—'}</td></tr>)}</tbody></table></div><div className="border-t border-border px-6 py-4 text-[11px] text-subtle">{loading ? '載入中…' : '每周日 20:00（台灣時間）自動重選。每日掃描從此池精選 25 檔。'}</div></section>
    </>}

    {tab === 'report' && <>
      {weeks.length < 2 ? <section className="rounded-sm border border-border bg-card p-8 text-center text-sm text-muted-foreground">{reportNote || '尚無足夠的週報歷史。第一次每周重選執行後，這裡會顯示新進／剔除對照。'}</section> : <>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp size={15} className="text-positive"/>本週新進</div><p className="mt-3 text-2xl font-semibold tabular-nums text-positive">{added.length} <span className="text-xs font-normal text-subtle">檔</span></p><p className="mt-1 text-[11px] text-subtle">{latest?.week_start} vs {prev?.week_start}</p></div>
          <div className="rounded-sm border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingDown size={15} className="text-negative"/>本週剔除</div><p className="mt-3 text-2xl font-semibold tabular-nums text-negative">{removed.length} <span className="text-xs font-normal text-subtle">檔</span></p><p className="mt-1 text-[11px] text-subtle">{latest?.week_start} vs {prev?.week_start}</p></div>
          <div className="rounded-sm border border-border bg-card p-5"><div className="text-xs text-muted-foreground">本週總數</div><p className="mt-3 text-2xl font-semibold tabular-nums">{latest?.count} <span className="text-xs font-normal text-subtle">檔</span></p><p className="mt-1 text-[11px] text-subtle">更新：{latest?.week_start}</p></div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="overflow-hidden rounded-sm border border-border bg-card"><SectionHeading title="本週新進" subtitle={`${added.length} 檔`}/><div className="max-h-[480px] overflow-y-auto"><table className="data-table w-full text-left"><thead><tr><th>股票 / SYMBOL</th><th>板塊</th><th className="text-right">排名</th></tr></thead><tbody>{added.length === 0 ? <tr><td colSpan={3} className="py-8 text-center text-sm text-subtle">本週無新進</td></tr> : added.map((p) => <tr key={p.symbol}><td><SymbolCell symbol={p.symbol} name={p.name}/></td><td><span className="inline-flex rounded-sm border border-positive/40 bg-positive/15 px-2 py-1 text-[11px] font-semibold text-positive">{sectorLabel(p.sector)}</span></td><td className="text-right tabular-nums text-foreground">{p.rank}</td></tr>)}</tbody></table></div></section>
          <section className="overflow-hidden rounded-sm border border-border bg-card"><SectionHeading title="本週剔除" subtitle={`${removed.length} 檔`}/><div className="max-h-[480px] overflow-y-auto"><table className="data-table w-full text-left"><thead><tr><th>股票 / SYMBOL</th><th>板塊</th><th className="text-right">上週排名</th></tr></thead><tbody>{removed.length === 0 ? <tr><td colSpan={3} className="py-8 text-center text-sm text-subtle">本週無剔除</td></tr> : removed.map((p) => <tr key={p.symbol}><td><SymbolCell symbol={p.symbol} name={p.name}/></td><td><span className="inline-flex rounded-sm border border-negative/40 bg-negative/15 px-2 py-1 text-[11px] font-semibold text-negative">{sectorLabel(p.sector)}</span></td><td className="text-right tabular-nums text-muted-foreground">{p.rank}</td></tr>)}</tbody></table></div></section>
        </div>
        {weeks.length > 2 && <section className="mt-6 overflow-hidden rounded-sm border border-border bg-card"><SectionHeading title="歷史週報" subtitle={`${weeks.length} 週`}/><div className="divide-y divide-border">{weeks.map((w) => <div key={w.week_start} className="flex items-center justify-between px-6 py-3 text-sm"><span className="font-medium text-foreground">{w.week_start}</span><span className="text-xs text-subtle">{w.count} 檔</span></div>)}</div></section>}
      </>}
    </>}

    <AlertDialog open={confirmRefresh} onOpenChange={setConfirmRefresh}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>手動重選候選池？</AlertDialogTitle><AlertDialogDescription>將立即從 213 檔主名單重新計算流動性，選出新的 101 檔並寫入 Supabase（約需 10 秒）。確定執行嗎？</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={manualRefresh}>確定重選</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </TradingShell>;
}
