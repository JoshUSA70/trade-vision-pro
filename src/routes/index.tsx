import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, BriefcaseBusiness, CircleDollarSign, Clock3, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TradingShell, PageHeading, SectionHeading, Movement, SymbolCell } from '@/components/trading-shell';
import { equityCurve, money, positions, signedMoney } from '@/lib/trading-demo';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: '總覽儀表板 | JoshQuantTrader Pro' }, { name: 'description', content: 'JoshQuantTrader Pro 個人量化美股交易總覽：資產、資金曲線與持倉。' },
    { property: 'og:title', content: '總覽儀表板 | JoshQuantTrader Pro' }, { property: 'og:description', content: '個人量化美股交易終端，檢視資產、資金曲線與持倉。' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Dashboard,
});


type Position = Omit<typeof positions[number], 'name'> & { name?: string };
type Account = { equity: number; cash: number; buying_power: number; portfolio_value: number } | null;
type CurvePoint = { t: number; equity: number };

const DEMO_3M = [{date:'07/04',value:96120},{date:'07/18',value:98760},{date:'08/01',value:100430},{date:'08/15',value:99670},{date:'08/29',value:103100},...equityCurve];
const DEMO_1Y = [{date:'01/01',value:82400},{date:'02/01',value:86420},{date:'03/01',value:84270},{date:'04/01',value:92350},{date:'05/01',value:90620},{date:'06/01',value:94780},{date:'07/01',value:96120},{date:'08/01',value:100430},...equityCurve];

function fmtTick(t: number) {
  const d = new Date(t);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function Dashboard() {
  const [period, setPeriod] = useState<'1M'|'3M'|'1Y'>('1M');
  const [rows, setRows] = useState<Position[]>(positions);
  const [account, setAccount] = useState<Account>(null);
  const [curve, setCurve] = useState<CurvePoint[] | null>(null);
  const [source, setSource] = useState<'demo'|'alpaca-paper'>('demo');
  const [todayTrades, setTodayTrades] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const live = source === 'alpaca-paper';

  async function syncData() {
    setSyncing(true);
    try {
      const [posRes, histRes, riskRes] = await Promise.all([
        fetch('/api/alpaca-positions'),
        fetch('/api/portfolio-history'),
        fetch('/api/risk'),
      ]);
      const posData = await posRes.json() as {source: string; notice?: string; account: Account; positions: Position[]};
      if (posData.source === 'alpaca-paper') { setRows(posData.positions); setAccount(posData.account); setSource('alpaca-paper'); setNotice(''); }
      else if (posData.notice) setNotice(posData.notice);
      const histData = await histRes.json() as {source: string; points: CurvePoint[] | null};
      if (histData.source === 'alpaca-paper' && histData.points) setCurve(histData.points);
      const riskData = await riskRes.json().catch(() => null) as { todayOrderCount?: number } | null;
      if (riskData && typeof riskData.todayOrderCount === 'number') setTodayTrades(riskData.todayOrderCount);
    } catch { setNotice('同步失敗，請稍後再試。'); }
    finally { setSyncing(false); }
  }
  useEffect(() => {
    void syncData();
    const id = setInterval(() => { void syncData(); }, 30000); // 每 30 秒自動重新整理持倉
    return () => clearInterval(id);
  }, []);

  const liveSlice = (n: number) => (curve ?? []).slice(-n).map((p) => ({ date: fmtTick(p.t), value: Math.round(p.equity * 100) / 100 }));
  const chartData = curve
    ? period === '1M' ? liveSlice(31) : period === '3M' ? liveSlice(92) : liveSlice(366)
    : period === '1M' ? equityCurve : period === '3M' ? DEMO_3M : DEMO_1Y;

  const chartLast = chartData.length ? chartData[chartData.length - 1]!.value : 0;
  const chartFirst = chartData.length ? chartData[0]!.value : 0;
  const chartChg = chartLast - chartFirst;
  const chartPct = chartFirst ? (chartChg / chartFirst) * 100 : 0;
  const chartUp = chartChg >= 0;

  const lastEquity = curve && curve.length ? curve[curve.length - 1]!.equity : null;
  const prevEquity = curve && curve.length >= 2 ? curve[curve.length - 2]!.equity : null;
  const dayPnl = lastEquity !== null && prevEquity !== null ? lastEquity - prevEquity : null;
  const dayPnlPct = dayPnl !== null && prevEquity ? (dayPnl / prevEquity) * 100 : null;

  const equity = account ? account.equity : lastEquity ?? 112648.32;
  const cash = account ? account.cash : 52305.01;
  const marketTotal = rows.reduce((s, p) => s + p.qty * p.market_price, 0);
  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const liveMetrics = [
    { label: '總資產', english: 'TOTAL EQUITY', value: money(equity), change: live && dayPnlPct !== null ? `${dayPnlPct >= 0 ? '+' : ''}${dayPnlPct.toFixed(2)}% 本月` : '+2.21% 本月', trend: `${live ? '相較昨日收盤' : '+$2,438.16'}${todayTrades !== null ? ` · 今日已交易 ${todayTrades} 筆` : ''}`, icon: Wallet, positive: true },
    { label: '今日盈虧', english: 'DAILY P&L', value: dayPnl !== null ? signedMoney(dayPnl) : '+$1,284.56', change: dayPnlPct !== null ? `${dayPnlPct >= 0 ? '+' : ''}${dayPnlPct.toFixed(2)}%` : '+1.15%', trend: '相較昨日收盤', icon: BarChart3, positive: (dayPnl ?? 1284.56) >= 0 },
    { label: '持倉數量', english: 'OPEN POSITIONS', value: String(rows.length).padStart(2,'0'), change: `${rows.length} 檔股票`, trend: '橫跨科技與消費', icon: BriefcaseBusiness, positive: null },
    { label: '可用現金', english: 'AVAILABLE CASH', value: money(cash), change: `${(cash / equity * 100).toFixed(2)}%`, trend: '佔總資產比例', icon: CircleDollarSign, positive: null },
  ];
  return <TradingShell live={live}>
    <PageHeading eyebrow="PORTFOLIO OVERVIEW" title="總覽儀表板" description="掌握您的投資組合表現與市場動態。" action={<div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={14}/><span>資料更新於 {today}</span><span className="ml-1 rounded-sm border border-border bg-secondary px-2 py-1 text-[10px] font-semibold text-subtle">{live ? 'Alpaca 模擬帳戶' : '模擬數據'}</span></div>}/>
    {notice && <p role="alert" className="mb-4 text-sm text-negative">{notice}</p>}
    <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{liveMetrics.map(({label,english,value,change,trend,icon:Icon,positive}) => <div key={label} className="metric-card relative overflow-hidden rounded-sm border border-border bg-card px-5 py-5"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-[10px] font-medium tracking-[0.1em] text-subtle">{english}</p></div><span className="grid size-9 place-items-center rounded-sm border border-border bg-secondary text-primary"><Icon size={17}/></span></div><p className="mt-6 text-[27px] font-semibold leading-none tabular-nums text-foreground">{value}</p><div className="mt-4 flex items-center gap-2 text-[11px]"><span className={positive ? 'font-semibold text-positive' : positive === false ? 'font-semibold text-negative' : 'font-medium text-foreground'}>{change}</span><span className="text-subtle">{trend}</span></div></div>)}</div>
    <section className="mb-7 overflow-hidden rounded-sm border border-border bg-card"><SectionHeading title="資金曲線" subtitle="Portfolio performance" action={<div className="flex items-center gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => void syncData()} disabled={syncing} className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"><RefreshCw size={13} className={syncing ? 'animate-spin' : ''}/>同步</Button><div className="flex rounded-sm border border-border bg-secondary p-0.5">{(['1M','3M','1Y'] as const).map(p => <Button key={p} type="button" variant="ghost" size="sm" onClick={() => setPeriod(p)} className={`h-7 min-w-10 px-2 text-[11px] ${period === p ? 'bg-accent text-primary hover:bg-accent' : 'text-muted-foreground hover:bg-accent'}`}>{p}</Button>)}</div></div>}/><div className="px-3 pb-5 pt-5 sm:px-6"><div className="mb-6 flex flex-wrap items-end gap-x-4 gap-y-1 pl-2"><span className="text-[26px] font-semibold tabular-nums text-foreground">{money(chartLast)}</span><span className={`mb-1 flex items-center gap-1 text-xs font-semibold ${chartUp ? 'text-positive' : 'text-negative'}`}>{chartUp ? <ArrowUpRight size={15}/> : <ArrowDownRight size={15}/>} {signedMoney(chartChg)} <span className="font-normal text-muted-foreground">({chartUp ? '+' : ''}{chartPct.toFixed(2)}%)</span></span></div><div className="h-[245px] w-full sm:h-[285px]" aria-label={live ? '即時資金曲線圖' : '模擬資金曲線圖'}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:4,right:14,left:0,bottom:0}}><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.24}/><stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5"/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill:'var(--muted-foreground)',fontSize:10}} minTickGap={25} dy={12}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--muted-foreground)',fontSize:10}} domain={['dataMin - 3500','dataMax + 3500']} tickFormatter={v => `$${Math.round(v/1000)}k`} width={48}/><Tooltip contentStyle={{background:'var(--popover)',border:'1px solid var(--border)',borderRadius:3,color:'var(--popover-foreground)',fontSize:12}} formatter={(v) => [money(Number(v)), '總資產']} labelStyle={{color:'var(--muted-foreground)'}}/><Area isAnimationActive={false} type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} fill="url(#equityFill)" activeDot={{r:5,fill:'var(--primary)',stroke:'var(--background)',strokeWidth:2}}/></AreaChart></ResponsiveContainer></div></div></section>
    <section className="overflow-hidden rounded-sm border border-border bg-card"><SectionHeading title="目前持倉" subtitle={`${rows.length} 個開放倉位`} action={<Button asChild variant="ghost" size="sm" className="text-xs text-primary hover:text-primary"><Link to="/scanner">查看掃描 <ArrowRight size={14}/></Link></Button>}/><div className="overflow-x-auto"><table className="data-table w-full min-w-[720px] text-left"><thead><tr><th>股票 / SYMBOL</th><th>數量 / QTY</th><th>平均成本 / AVG PRICE</th><th>市場價格 / MARKET PRICE</th><th>報酬率</th><th className="text-right">未實現盈虧 / P&L</th></tr></thead><tbody>{rows.map(p => <tr key={p.symbol}><td><SymbolCell symbol={p.symbol} name={p.name ?? p.symbol}/></td><td className="tabular-nums text-foreground">{p.qty}</td><td className="tabular-nums text-foreground">{money(p.avg_price)}</td><td className="tabular-nums text-foreground">{money(p.market_price)}</td><td><Movement value={p.change} percent/></td><td className="text-right"><span className={`font-medium tabular-nums ${p.pnl >= 0 ? 'text-positive' : 'text-negative'}`}>{signedMoney(p.pnl)}</span></td></tr>)}</tbody></table></div><div className="flex flex-wrap justify-between gap-2 border-t border-border px-6 py-4 text-[11px] text-subtle"><span>資料來源：{live ? 'Alpaca 模擬帳戶' : '模擬投資組合'}</span><span>市值合計 <strong className="ml-2 font-semibold text-foreground">{money(marketTotal)}</strong></span></div></section>
  </TradingShell>;
}
