import { Link, useRouterState } from '@tanstack/react-router';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, BookOpen, CircleHelp, Command, Layers, LayoutDashboard, Search, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

const links = [
  { to: '/' as const, label: '總覽儀表板', english: 'Dashboard', icon: LayoutDashboard },
  { to: '/scanner' as const, label: '股票掃描', english: 'Scanner', icon: Search },
  { to: '/pool' as const, label: '股票池', english: 'Pool', icon: Layers },
  { to: '/journal' as const, label: '交易日誌', english: 'Journal', icon: BookOpen },
];

export function TradingShell({ children, live }: { children: ReactNode; live?: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return <div className="terminal-shell min-h-screen bg-background text-foreground">
    <aside className="terminal-sidebar flex flex-col border-r border-border bg-sidebar">
      <Link to="/" className="brand flex items-center gap-3 border-b border-border px-6 no-underline">
        <span className="brand-mark grid size-9 place-items-center rounded-sm bg-primary text-primary-foreground"><Activity size={21} strokeWidth={2.5}/></span>
        <span className="min-w-0"><strong className="block text-[15px] font-bold leading-none text-foreground">JOSH<span className="text-primary">QUANT</span></strong><small className="mt-1.5 block text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">TRADER PRO</small></span>
      </Link>
      <div className="px-4 pt-8"><p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">工作空間</p>
        <nav className="mt-4 flex flex-col gap-1" aria-label="主選單">{links.map(({to,label,english,icon:Icon}) => <Link key={to} to={to} className={`nav-item flex items-center gap-3 rounded-sm px-3 py-3 text-sm transition-colors ${pathname === to ? 'active bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'}`}><Icon size={17}/><span className="font-medium">{label}</span><span className="ml-auto text-[10px] text-subtle nav-english">{english}</span></Link>)}</nav>
      </div>
      <div className="mt-auto px-4 pb-5"><div className="border-t border-border pt-5"><div className="flex items-center gap-2 px-3 text-xs text-muted-foreground"><span className="status-dot size-1.5 rounded-full bg-primary"/> {live ? '即時資料模式' : '示範資料模式'}</div><p className="mt-2 px-3 text-[11px] leading-5 text-subtle">{live ? '已連接真實市場數據來源。' : '行情及交易紀錄均為模擬資料，非即時報價。'}</p></div><div className="mt-5 flex items-center gap-3 rounded-sm border border-border bg-secondary p-3"><div className="grid size-8 place-items-center rounded-sm bg-accent text-primary text-xs font-bold">JT</div><div><div className="text-xs font-semibold text-foreground">Joshua Tzeng</div><div className="text-[10px] text-muted-foreground">個人工作空間</div></div><Command className="ml-auto text-subtle" size={14}/></div></div>
    </aside>
    <div className="terminal-main min-w-0">
      <header className="topbar flex items-center justify-between gap-3 border-b border-border px-6 md:px-10"><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="hidden sm:inline">工作空間</span><span className="hidden sm:inline text-subtle">/</span><span className="font-medium text-foreground">{links.find(x => x.to === pathname)?.label ?? '總覽儀表板'}</span></div><div className="flex items-center gap-3 sm:gap-5 text-[11px] text-muted-foreground"><span className="hidden sm:flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary"/> 系統運行中</span><span className="hidden md:inline border-l border-border pl-5">美股市場 · NYSE / NASDAQ</span><span className="rounded-sm border border-border px-2 py-1 text-subtle">{live ? 'LIVE' : 'DEMO'}</span></div></header>
      <main className="mx-auto w-full max-w-[1580px] px-5 py-8 sm:px-7 md:px-10 md:py-9">{children}</main>
      <footer className="mx-auto flex w-full max-w-[1580px] flex-wrap items-center justify-between gap-2 px-5 pb-8 text-[11px] text-subtle sm:px-7 md:px-10"><span>© 2026 JoshQuantTrader Pro</span><span className="flex items-center gap-1.5"><ShieldCheck size={13}/> 僅供研究參考，不構成投資建議</span></footer>
    </div>
    <nav className="mobile-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-sidebar" aria-label="手機選單">{links.map(({to,label,icon:Icon}) => <Link key={to} to={to} className={`flex flex-col items-center justify-center gap-1 py-2 text-[10px] ${pathname === to ? 'text-primary' : 'text-muted-foreground'}`}><Icon size={19}/>{label}</Link>)}</nav>
  </div>;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary"><span className="h-px w-4 bg-primary"/>{eyebrow}</div><h1 className="text-[29px] font-semibold leading-tight text-foreground sm:text-[34px]">{title}</h1><p className="mt-2 text-[13px] text-muted-foreground">{description}</p></div>{action}</div>;
}

export function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><h2 className="text-sm font-semibold text-foreground">{title}</h2>{subtitle && <span className="text-[11px] text-subtle">{subtitle}</span>}</div>{action}</div>;
}

export function Movement({ value, percent = false }: { value: number; percent?: boolean }) {
  return <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${value >= 0 ? 'text-positive' : 'text-negative'}`}>{value >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {percent ? `${Math.abs(value).toFixed(2)}%` : `$${Math.abs(value).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`}</span>;
}

export function SymbolCell({symbol,name}:{symbol:string;name:string}) { return <div className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-sm border border-border bg-secondary text-[10px] font-bold text-foreground">{symbol.slice(0,2)}</span><span><strong className="block text-xs font-semibold text-foreground">{symbol}</strong><small className="block max-w-36 truncate text-[10px] text-subtle">{name}</small></span></div>; }
