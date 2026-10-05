import { redirectIfAuthed } from '@/lib/route-auth';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Activity, KeyRound, Loader2, UserRound } from 'lucide-react';

export const Route = createFileRoute('/login')({ head: () => ({ meta: [
  {title:'登入 | JoshQuantTrader Pro'}, {name:'description',content:'登入 JoshQuantTrader Pro。'},
  {property:'og:title',content:'登入 | JoshQuantTrader Pro'}, {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary'},
] }), beforeLoad: redirectIfAuthed,
  component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'loading' | 'setup' | 'login'>('loading');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await (await fetch('/api/auth/setup-status')).json() as { needsSetup?: boolean; dbConnected?: boolean };
        if (!s.dbConnected) { setError('系統尚未連接資料庫，請先完成 Supabase 接線'); setMode('login'); return; }
        if (s.needsSetup) { setMode('setup'); return; }
        const me = await (await fetch('/api/auth/me')).json() as { ok?: boolean };
        if (me.ok) { navigate({ to: '/' }); return; }
        setMode('login');
      } catch {
        setError('無法連接伺服器'); setMode('login');
      }
    })();
  }, [navigate]);

  async function submit() {
    setBusy(true); setError('');
    try {
      const endpoint = mode === 'setup' ? '/api/auth/setup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || '失敗');
      navigate({ to: '/' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '失敗，請再試一次');
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex min-h-screen items-center justify-center bg-background px-4">
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="grid size-12 place-items-center rounded-sm bg-primary text-primary-foreground"><Activity size={26} strokeWidth={2.5}/></span>
        <h1 className="mt-4 text-xl font-bold text-foreground">JOSH<span className="text-primary">QUANT</span></h1>
        <p className="mt-1 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">TRADER PRO</p>
      </div>
      <div className="rounded-sm border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">{mode === 'setup' ? '建立第一個管理員帳號' : '登入'}</h2>
        <p className="mt-1 text-[11px] text-subtle">{mode === 'setup' ? '系統尚無帳號，請建立管理員（只需一次）。' : '請輸入你的帳號與密碼。'}</p>
        {mode === 'loading' ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground"/></div> : <>
          <label className="mt-5 block text-[11px] font-medium text-muted-foreground">帳號</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-sm border border-border bg-secondary px-3">
            <UserRound size={15} className="shrink-0 text-subtle"/>
            <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-subtle" placeholder="username" autoComplete="username"/>
          </div>
          <label className="mt-4 block text-[11px] font-medium text-muted-foreground">密碼</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-sm border border-border bg-secondary px-3">
            <KeyRound size={15} className="shrink-0 text-subtle"/>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-subtle" placeholder={mode === 'setup' ? '至少 8 個字元' : 'password'} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}/>
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-negative">{error}</p>}
          <button type="button" onClick={submit} disabled={busy || !username || !password}
            className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
            {busy && <Loader2 size={15} className="animate-spin"/>}{mode === 'setup' ? '建立並登入' : '登入'}
          </button>
        </>}
      </div>
      <p className="mt-4 text-center text-[11px] text-subtle">僅供授權使用者存取</p>
    </div>
  </div>;
}
